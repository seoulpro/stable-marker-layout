const VALID_PLACEMENTS = new Set([
  "right",
  "left",
  "above",
  "below",
  "marker-only",
]);

const assertPositiveDimension = (value, name) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`);
  }
};

const resolveAnchor = (anchor) => {
  if (anchor === undefined || anchor === "center") {
    return { x: 0.5, y: 0.5 };
  }
  if (anchor === "bottom") {
    return { x: 0.5, y: 1 };
  }
  if (
    anchor &&
    typeof anchor === "object" &&
    Number.isFinite(anchor.x) &&
    Number.isFinite(anchor.y)
  ) {
    return { x: anchor.x, y: anchor.y };
  }
  throw new TypeError(
    "marker.anchor must be center, bottom, or a finite { x, y } ratio",
  );
};

const resolveMarkerBox = (marker) => {
  assertPositiveDimension(marker?.width, "marker.width");
  assertPositiveDimension(marker?.height, "marker.height");
  const anchor = resolveAnchor(marker.anchor);
  const left = -marker.width * anchor.x;
  const top = -marker.height * anchor.y;

  return {
    left,
    right: left + marker.width,
    top,
    bottom: top + marker.height,
  };
};

const resolveLabelBox = (markerBox, label, placement) => {
  assertPositiveDimension(label?.width, "label.width");
  assertPositiveDimension(label?.height, "label.height");
  const gap = label.gap ?? 0;
  if (typeof gap !== "number" || !Number.isFinite(gap) || gap < 0) {
    throw new RangeError("label.gap must be a finite number greater than or equal to zero");
  }

  const markerCenterX = (markerBox.left + markerBox.right) / 2;
  const markerCenterY = (markerBox.top + markerBox.bottom) / 2;
  let left;
  let top;

  switch (placement) {
    case "right":
      left = markerBox.right + gap;
      top = markerCenterY - label.height / 2;
      break;
    case "left":
      left = markerBox.left - gap - label.width;
      top = markerCenterY - label.height / 2;
      break;
    case "above":
      left = markerCenterX - label.width / 2;
      top = markerBox.top - gap - label.height;
      break;
    case "below":
      left = markerCenterX - label.width / 2;
      top = markerBox.bottom + gap;
      break;
    default:
      throw new RangeError(`unsupported label placement: ${placement}`);
  }

  return {
    left,
    right: left + label.width,
    top,
    bottom: top + label.height,
  };
};

export const createPointVariants = (point, placements) => {
  if (!point || typeof point !== "object") {
    throw new TypeError("point must be an object");
  }
  const marker = point.marker ?? point;
  const markerBox = resolveMarkerBox(marker);
  const requestedPlacements =
    placements ??
    point.label?.placements ??
    (point.label ? ["right", "left", "marker-only"] : ["marker-only"]);

  if (!Array.isArray(requestedPlacements) || requestedPlacements.length === 0) {
    throw new TypeError("placements must be a non-empty array");
  }

  const seenPlacements = new Set();
  return requestedPlacements.map((placement, index) => {
    if (!VALID_PLACEMENTS.has(placement)) {
      throw new RangeError(`unsupported placement at index ${index}: ${placement}`);
    }
    if (seenPlacements.has(placement)) {
      throw new TypeError(`duplicate placement at index ${index}: ${placement}`);
    }
    seenPlacements.add(placement);
    if (placement === "marker-only") {
      return {
        key: "marker-only",
        boxes: [{ ...markerBox }],
      };
    }
    if (!point.label) {
      throw new TypeError(`point.label is required for the ${placement} placement`);
    }
    return {
      key: `label-${placement}`,
      boxes: [
        { ...markerBox },
        resolveLabelBox(markerBox, point.label, placement),
      ],
    };
  });
};

import {
  boxesIntersect,
  createBoxIndex,
  expandBox,
  unionBoxes,
} from "./geometry.js";
import { createPointVariants } from "./variants.js";

const HIDDEN_REASONS = [
  "outside-viewport",
  "not-projectable",
  "cell-budget",
  "collision",
  "no-valid-variant",
];

const assertFiniteNumber = (value, name) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
};

const cloneBox = (box) => ({
  left: box.left,
  right: box.right,
  top: box.top,
  bottom: box.bottom,
});

const markerIdKey = (id) => {
  if (typeof id === "string") return `s:${id}`;
  if (typeof id === "number" && Number.isFinite(id)) return `n:${id}`;
  throw new TypeError("marker id must be a string or finite number");
};

const normalizeEpoch = (epoch) => {
  if (epoch === undefined || epoch === null) return null;
  if (typeof epoch === "string") return epoch;
  if (typeof epoch === "number" && Number.isFinite(epoch)) return epoch;
  throw new TypeError("epoch must be a string, finite number, or null");
};

const cloneState = (state) => ({
  version: 1,
  epoch: state.epoch,
  visible: state.visible.map((entry) => ({
    id: entry.id,
    variantKey: entry.variantKey,
  })),
});

const normalizePreviousState = (state) => {
  if (state === null || state === undefined) return null;
  if (
    !state ||
    typeof state !== "object" ||
    state.version !== 1 ||
    !Array.isArray(state.visible)
  ) {
    throw new TypeError("previousState is not a stable-marker-layout state");
  }

  const epoch = normalizeEpoch(state.epoch);
  const visible = [];
  const ids = new Set();
  state.visible.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new TypeError(`previousState.visible[${index}] must be an object`);
    }
    const idKey = markerIdKey(entry.id);
    if (ids.has(idKey)) {
      throw new TypeError(`previousState contains duplicate marker id ${String(entry.id)}`);
    }
    ids.add(idKey);
    if (typeof entry.variantKey !== "string" || entry.variantKey.length === 0) {
      throw new TypeError(
        `previousState.visible[${index}].variantKey must be a non-empty string`,
      );
    }
    visible.push({ id: entry.id, variantKey: entry.variantKey });
  });

  return { version: 1, epoch, visible };
};

const hashString = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const normalizePressure = (pressure) => {
  if (pressure === undefined) return 0;
  assertFiniteNumber(pressure, "pressure");
  if (pressure < 0 || pressure > 1) {
    throw new RangeError("pressure must be between 0 and 1");
  }
  return pressure;
};

export const DEFAULT_DENSITY_POLICY = Object.freeze({
  cellSize: 128,
  stops: Object.freeze([
    Object.freeze({ minPressure: 0, maxPerCell: null }),
    Object.freeze({ minPressure: 0.35, maxPerCell: 4 }),
    Object.freeze({ minPressure: 0.7, maxPerCell: 2 }),
    Object.freeze({ minPressure: 0.9, maxPerCell: 1 }),
  ]),
});

const normalizeDensity = (policy, pressure) => {
  if (!policy || typeof policy !== "object") {
    throw new TypeError("density must be false or a density policy object");
  }
  assertFiniteNumber(policy.cellSize, "density.cellSize");
  if (policy.cellSize <= 0) {
    throw new RangeError("density.cellSize must be greater than zero");
  }
  if (!Array.isArray(policy.stops) || policy.stops.length === 0) {
    throw new TypeError("density.stops must be a non-empty array");
  }

  let previousPressure = -Infinity;
  let previousLimit = Infinity;
  let selected = null;
  policy.stops.forEach((stop, index) => {
    if (!stop || typeof stop !== "object") {
      throw new TypeError(`density.stops[${index}] must be an object`);
    }
    assertFiniteNumber(
      stop.minPressure,
      `density.stops[${index}].minPressure`,
    );
    if (
      stop.minPressure < 0 ||
      stop.minPressure > 1 ||
      stop.minPressure <= previousPressure
    ) {
      throw new RangeError(
        "density stop pressures must be strictly increasing within 0..1",
      );
    }
    previousPressure = stop.minPressure;
    if (stop.maxPerCell !== null) {
      assertFiniteNumber(
        stop.maxPerCell,
        `density.stops[${index}].maxPerCell`,
      );
      if (!Number.isInteger(stop.maxPerCell) || stop.maxPerCell < 0) {
        throw new RangeError(
          "density stop maxPerCell must be a non-negative integer or null",
        );
      }
    }
    const currentLimit =
      stop.maxPerCell === null ? Infinity : stop.maxPerCell;
    if (currentLimit > previousLimit) {
      throw new RangeError(
        "density maxPerCell must not increase as pressure increases",
      );
    }
    previousLimit = currentLimit;
    if (stop.minPressure <= pressure) selected = stop;
  });
  if (policy.stops[0].minPressure !== 0) {
    throw new RangeError("the first density stop must start at pressure 0");
  }
  if (!selected) selected = policy.stops[0];

  return {
    cellSize: policy.cellSize,
    maxPerCell: selected.maxPerCell,
    stage: selected.minPressure,
  };
};

const normalizeViewport = (viewport, viewportPadding) => {
  if (!viewport || typeof viewport !== "object") {
    throw new TypeError("viewport must be an object");
  }
  assertFiniteNumber(viewport.width, "viewport.width");
  assertFiniteNumber(viewport.height, "viewport.height");
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError("viewport dimensions must be greater than zero");
  }

  const padding = viewportPadding ?? viewport.padding ?? 0;
  assertFiniteNumber(padding, "viewport padding");
  if (padding < 0) {
    throw new RangeError("viewport padding must be greater than or equal to zero");
  }

  return {
    width: viewport.width,
    height: viewport.height,
    padding,
    box: {
      left: -padding,
      right: viewport.width + padding,
      top: -padding,
      bottom: viewport.height + padding,
    },
  };
};

const normalizePoint = (point, name) => {
  const value = point ?? { x: 0, y: 0 };
  if (!value || typeof value !== "object") {
    throw new TypeError(`${name} must be an object`);
  }
  assertFiniteNumber(value.x, `${name}.x`);
  assertFiniteNumber(value.y, `${name}.y`);
  return { x: value.x, y: value.y };
};

const isRenderableBox = (box) =>
  box &&
  typeof box === "object" &&
  Number.isFinite(box.left) &&
  Number.isFinite(box.right) &&
  Number.isFinite(box.top) &&
  Number.isFinite(box.bottom) &&
  box.right > box.left &&
  box.bottom > box.top;

const translateBox = (box, x, y) => ({
  left: box.left + x,
  right: box.right + x,
  top: box.top + y,
  bottom: box.bottom + y,
});

const materializeVariants = (marker) => {
  if (Array.isArray(marker.variants)) {
    if (marker.variants.length === 0) {
      throw new TypeError(`marker ${String(marker.id)} has no variants`);
    }
    const keys = new Set();
    return marker.variants.map((variant, index) => {
      if (
        !variant ||
        typeof variant !== "object" ||
        typeof variant.key !== "string" ||
        variant.key.length === 0 ||
        !Array.isArray(variant.boxes) ||
        variant.boxes.length === 0 ||
        !variant.boxes.every(isRenderableBox)
      ) {
        throw new TypeError(
          `marker ${String(marker.id)} variant ${index} is invalid`,
        );
      }
      if (keys.has(variant.key)) {
        throw new TypeError(
          `marker ${String(marker.id)} has duplicate variant key ${variant.key}`,
        );
      }
      keys.add(variant.key);
      return {
        key: variant.key,
        boxes: variant.boxes.map((box) =>
          translateBox(box, marker.x, marker.y),
        ),
      };
    });
  }

  const markerDimensions =
    marker.marker ??
    (marker.width !== undefined || marker.height !== undefined
      ? {
          width: marker.width,
          height: marker.height,
          anchor: marker.anchor,
        }
      : null);
  if (!markerDimensions) return [];

  return createPointVariants(
    {
      marker: markerDimensions,
      label: marker.label,
    },
    marker.placements,
  ).map((variant) => ({
    key: variant.key,
    boxes: variant.boxes.map((box) =>
      translateBox(box, marker.x, marker.y),
    ),
  }));
};

const normalizeObstacles = (obstacles) => {
  if (obstacles === undefined) return [];
  if (!Array.isArray(obstacles)) {
    throw new TypeError("obstacleBoxes must be an array");
  }

  const normalized = obstacles.map((obstacle, index) => {
    const hasWrapper =
      obstacle &&
      typeof obstacle === "object" &&
      obstacle.box &&
      typeof obstacle.box === "object";
    const box = hasWrapper ? obstacle.box : obstacle;
    if (!isRenderableBox(box)) {
      throw new TypeError(`obstacleBoxes[${index}] must contain a non-empty finite box`);
    }
    const id = hasWrapper && obstacle.id !== undefined ? obstacle.id : null;
    if (
      id !== null &&
      typeof id !== "string" &&
      !(typeof id === "number" && Number.isFinite(id))
    ) {
      throw new TypeError(`obstacleBoxes[${index}].id must be a string or finite number`);
    }
    const padding = hasWrapper ? obstacle.padding ?? 0 : 0;
    assertFiniteNumber(padding, `obstacleBoxes[${index}].padding`);
    if (padding < 0) {
      throw new RangeError(
        `obstacleBoxes[${index}].padding must be non-negative`,
      );
    }
    const clonedBox = cloneBox(box);
    const sortKey = `${
      id === null ? "null" : markerIdKey(id)
    }|${clonedBox.left}|${clonedBox.top}|${clonedBox.right}|${clonedBox.bottom}`;
    return {
      box: clonedBox,
      id,
      padding,
      sortKey,
    };
  });
  normalized.sort((a, b) =>
    a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0,
  );
  return normalized.map((obstacle, index) => ({
    box: obstacle.box,
    padding: obstacle.padding,
    owner: {
      kind: "obstacle",
      id: obstacle.id,
      key: `obstacle:${index}:${obstacle.sortKey}`,
    },
    sortKey: obstacle.sortKey,
  }));
};

const resolvePreviousMaps = (state, epoch) => {
  if (!state) {
    return {
      forRetention: new Map(),
      forDiff: new Map(),
    };
  }
  const forDiff = new Map(
    state.visible.map((entry, rank) => [
      markerIdKey(entry.id),
      { ...entry, rank },
    ]),
  );
  return {
    forRetention: Object.is(state.epoch, epoch) ? forDiff : new Map(),
    forDiff,
  };
};

const compareEntries = (a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.retained !== b.retained) return a.retained ? -1 : 1;
  if (a.previousRank !== b.previousRank) {
    return a.previousRank - b.previousRank;
  }
  if (a.hash !== b.hash) return a.hash - b.hash;
  return a.idKey < b.idKey ? -1 : a.idKey > b.idKey ? 1 : 0;
};

const cellKeyFor = (entry, cellSize, origin) =>
  `${Math.floor((entry.x - origin.x) / cellSize)},${Math.floor(
    (entry.y - origin.y) / cellSize,
  )}`;

const ownerKey = (owner) =>
  owner.kind === "marker"
    ? `marker:${markerIdKey(owner.id)}`
    : owner.key;

const variantCollisions = (
  variant,
  boxIndex,
  collisionPadding,
  diagnostics,
) => {
  const collisions = [];
  const seen = new Set();
  for (const box of variant.boxes) {
    diagnostics.collisionChecks += 1;
    const padded = collisionPadding ? expandBox(box, collisionPadding) : box;
    for (const collision of boxIndex.allCollisions(padded)) {
      const owner = collision.value;
      const key = ownerKey(owner);
      if (seen.has(key)) continue;
      seen.add(key);
      collisions.push(owner);
    }
  }
  return collisions;
};

const addVariantToIndex = (
  variant,
  boxIndex,
  collisionPadding,
  owner,
) => {
  for (const box of variant.boxes) {
    boxIndex.add(
      collisionPadding ? expandBox(box, collisionPadding) : box,
      owner,
    );
  }
};

const publicOwner = (owner) => ({
  kind: owner.kind,
  id: owner.id,
});

const countChanges = (previous, current) => {
  if (!previous) return 0;
  const currentMap = new Map(
    current.map((entry) => [markerIdKey(entry.id), entry.variantKey]),
  );
  let changed = 0;

  for (const entry of previous.visible) {
    const key = markerIdKey(entry.id);
    if (currentMap.get(key) !== entry.variantKey) changed += 1;
    currentMap.delete(key);
  }
  changed += currentMap.size;
  return changed;
};

const runLayout = (previousState, frame, options = {}) => {
  if (!frame || typeof frame !== "object") {
    throw new TypeError("frame must be an object");
  }
  if (!Array.isArray(frame.markers)) {
    throw new TypeError("frame.markers must be an array");
  }

  const previous = normalizePreviousState(previousState);
  const pressure = normalizePressure(frame.pressure);
  const viewport = normalizeViewport(frame.viewport, options.viewportPadding);
  const densityOrigin = normalizePoint(
    frame.densityOrigin,
    "densityOrigin",
  );
  const epoch = normalizeEpoch(frame.epoch ?? options.stabilityKey);
  const density = normalizeDensity(
    options.density === false
      ? {
          cellSize: DEFAULT_DENSITY_POLICY.cellSize,
          stops: [{ minPressure: 0, maxPerCell: null }],
        }
      : options.density ?? DEFAULT_DENSITY_POLICY,
    pressure,
  );

  const collisionPadding = options.collisionPadding ?? 0;
  assertFiniteNumber(collisionPadding, "collisionPadding");
  if (collisionPadding < 0) {
    throw new RangeError("collisionPadding must be greater than or equal to zero");
  }
  const boxIndexCellSize = options.boxIndexCellSize ?? density.cellSize;
  assertFiniteNumber(boxIndexCellSize, "boxIndexCellSize");
  if (boxIndexCellSize <= 0) {
    throw new RangeError("boxIndexCellSize must be greater than zero");
  }
  const seed = options.seed ?? "stable-marker-layout";
  if (
    typeof seed !== "string" &&
    !(typeof seed === "number" && Number.isFinite(seed))
  ) {
    throw new TypeError("seed must be a string or finite number");
  }

  const previousMaps = resolvePreviousMaps(previous, epoch);
  const seenIds = new Set();
  const entries = frame.markers.map((marker, index) => {
    if (!marker || typeof marker !== "object") {
      throw new TypeError(`frame.markers[${index}] must be an object`);
    }
    const idKey = markerIdKey(marker.id);
    if (seenIds.has(idKey)) {
      throw new TypeError(`duplicate marker id ${String(marker.id)}`);
    }
    seenIds.add(idKey);
    const priority = marker.priority ?? 0;
    assertFiniteNumber(priority, `frame.markers[${index}].priority`);
    const markerCollisionPadding = marker.collisionPadding ?? 0;
    assertFiniteNumber(
      markerCollisionPadding,
      `frame.markers[${index}].collisionPadding`,
    );
    if (markerCollisionPadding < 0) {
      throw new RangeError(
        `frame.markers[${index}].collisionPadding must be non-negative`,
      );
    }
    const retained = previousMaps.forRetention.has(idKey);
    const previousEntry = previousMaps.forRetention.get(idKey) ?? null;
    return {
      marker,
      id: marker.id,
      idKey,
      x: marker.x,
      y: marker.y,
      priority,
      pinned: marker.pinned === true,
      retained,
      previous: previousEntry,
      previousRank: previousEntry?.rank ?? Infinity,
      collisionPadding: collisionPadding + markerCollisionPadding,
      hash: hashString(`${seed}|${String(epoch)}|${idKey}`),
    };
  });
  entries.sort(compareEntries);

  const boxIndex = createBoxIndex({ cellSize: boxIndexCellSize });
  const obstacles = normalizeObstacles(
    frame.obstacles ?? frame.obstacleBoxes,
  );
  for (const obstacle of obstacles) {
    const obstaclePadding = collisionPadding + obstacle.padding;
    boxIndex.add(
      obstaclePadding
        ? expandBox(obstacle.box, obstaclePadding)
        : obstacle.box,
      obstacle.owner,
    );
  }

  const visible = [];
  const hidden = [];
  const warnings = [];
  const cellCounts = new Map();
  const diagnosticsWork = { collisionChecks: 0 };
  let projectedCount = 0;

  const hide = (entry, reason, blockedBy) => {
    const hiddenEntry = { id: entry.id, reason };
    if (blockedBy !== undefined) hiddenEntry.blockedBy = blockedBy;
    hidden.push(hiddenEntry);
  };

  for (const entry of entries) {
    const projectable =
      entry.marker.visible !== false &&
      Number.isFinite(entry.x) &&
      Number.isFinite(entry.y);
    if (!projectable) {
      hide(entry, "not-projectable");
      continue;
    }
    projectedCount += 1;

    if (
      entry.x < viewport.box.left ||
      entry.x > viewport.box.right ||
      entry.y < viewport.box.top ||
      entry.y > viewport.box.bottom
    ) {
      hide(entry, "outside-viewport");
      continue;
    }

    const cellKey = cellKeyFor(entry, density.cellSize, densityOrigin);
    const cellCount = cellCounts.get(cellKey) ?? 0;
    if (
      !entry.pinned &&
      density.maxPerCell !== null &&
      cellCount >= density.maxPerCell
    ) {
      hide(entry, "cell-budget");
      continue;
    }

    let variants = materializeVariants(entry.marker);
    variants = variants.filter((variant) => {
      const union = unionBoxes(variant.boxes);
      return union && boxesIntersect(union, viewport.box);
    });
    if (variants.length === 0) {
      hide(entry, "no-valid-variant");
      continue;
    }

    if (entry.previous) {
      const previousIndex = variants.findIndex(
        (variant) => variant.key === entry.previous.variantKey,
      );
      if (previousIndex > 0) {
        variants = [
          variants[previousIndex],
          ...variants.slice(0, previousIndex),
          ...variants.slice(previousIndex + 1),
        ];
      }
    }

    let selected = null;
    let firstBlockedBy;
    if (entry.pinned) {
      for (const variant of variants) {
        const collisions = variantCollisions(
          variant,
          boxIndex,
          entry.collisionPadding,
          diagnosticsWork,
        );
        const obstacleCollision = collisions.find(
          (owner) => owner.kind === "obstacle",
        );
        if (obstacleCollision) {
          firstBlockedBy ??= publicOwner(obstacleCollision);
          continue;
        }
        selected = variant;
        for (const collision of collisions) {
          if (collision.kind !== "marker") continue;
          warnings.push({
            code: "pinned-overlap",
            ids: [collision.id, entry.id],
          });
        }
        break;
      }
    } else {
      for (const variant of variants) {
        const collisions = variantCollisions(
          variant,
          boxIndex,
          entry.collisionPadding,
          diagnosticsWork,
        );
        if (collisions.length === 0) {
          selected = variant;
          break;
        }
        firstBlockedBy ??= publicOwner(collisions[0]);
      }
    }

    if (!selected) {
      hide(entry, "collision", firstBlockedBy);
      continue;
    }

    addVariantToIndex(
      selected,
      boxIndex,
      entry.collisionPadding,
      { kind: "marker", id: entry.id },
    );
    cellCounts.set(cellKey, cellCount + 1);
    visible.push({
      id: entry.id,
      variantKey: selected.key,
      boxes: selected.boxes.map(cloneBox),
      anchor: { x: entry.x, y: entry.y },
      priority: entry.priority,
      pinned: entry.pinned,
      retained:
        entry.previous?.variantKey === selected.key,
    });
  }

  const state = {
    version: 1,
    epoch,
    visible: visible.map((entry) => ({
      id: entry.id,
      variantKey: entry.variantKey,
    })),
  };
  const retainedCount = visible.reduce(
    (count, entry) => count + (entry.retained ? 1 : 0),
    0,
  );
  const reasonCounts = Object.fromEntries(
    HIDDEN_REASONS.map((reason) => [reason, 0]),
  );
  for (const entry of hidden) reasonCounts[entry.reason] += 1;

  return {
    visible,
    hidden,
    state: cloneState(state),
    diagnostics: {
      inputCount: frame.markers.length,
      projectedCount,
      visibleCount: visible.length,
      hiddenCount: hidden.length,
      retainedCount,
      changedCount: countChanges(previous, state.visible),
      collisionChecks: diagnosticsWork.collisionChecks,
      pressure,
      density,
      byReason: reasonCounts,
      pinnedOverlapCount: warnings.length,
      warnings,
    },
  };
};

export const layoutMarkers = (frame, options) =>
  runLayout(null, frame, options);

export const updateMarkerLayout = (previousState, frame, options) =>
  runLayout(previousState, frame, options);

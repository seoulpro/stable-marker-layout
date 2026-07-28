const NUMBER_FIELDS = ["left", "right", "top", "bottom"];

const assertFiniteNumber = (value, name) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
};

const assertBox = (box, name = "box") => {
  if (!box || typeof box !== "object") {
    throw new TypeError(`${name} must be an object`);
  }
  for (const field of NUMBER_FIELDS) {
    assertFiniteNumber(box[field], `${name}.${field}`);
  }
  if (box.right < box.left || box.bottom < box.top) {
    throw new RangeError(`${name} has inverted bounds`);
  }
};

export const boxesIntersect = (a, b) => {
  assertBox(a, "a");
  assertBox(b, "b");
  return !(
    b.right <= a.left ||
    b.left >= a.right ||
    b.bottom <= a.top ||
    b.top >= a.bottom
  );
};

export const expandBox = (box, padding = 0) => {
  assertBox(box);
  assertFiniteNumber(padding, "padding");
  return {
    left: box.left - padding,
    right: box.right + padding,
    top: box.top - padding,
    bottom: box.bottom + padding,
  };
};

export const intersectBoxes = (a, b) => {
  assertBox(a, "a");
  assertBox(b, "b");
  const intersection = {
    left: Math.max(a.left, b.left),
    right: Math.min(a.right, b.right),
    top: Math.max(a.top, b.top),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return intersection.right > intersection.left &&
    intersection.bottom > intersection.top
    ? intersection
    : null;
};

export const unionBoxes = (boxes) => {
  if (!Array.isArray(boxes)) {
    throw new TypeError("boxes must be an array");
  }
  if (boxes.length === 0) return null;

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;

  boxes.forEach((box, index) => {
    assertBox(box, `boxes[${index}]`);
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
    top = Math.min(top, box.top);
    bottom = Math.max(bottom, box.bottom);
  });

  return { left, right, top, bottom };
};

const cellKey = (x, y) => `${x},${y}`;

export const createBoxIndex = (options = {}) => {
  const cellSize =
    typeof options === "number" ? options : options?.cellSize ?? 96;
  assertFiniteNumber(cellSize, "cellSize");
  if (cellSize <= 0) {
    throw new RangeError("cellSize must be greater than zero");
  }

  const cells = new Map();
  let entryCount = 0;

  const eachCell = (box, visit) => {
    const minX = Math.floor(box.left / cellSize);
    const maxX = Math.floor(box.right / cellSize);
    const minY = Math.floor(box.top / cellSize);
    const maxY = Math.floor(box.bottom / cellSize);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        visit(cellKey(x, y));
      }
    }
  };

  const findEntries = (candidate, stopAfterFirst) => {
    assertBox(candidate, "candidate");
    const seen = new Set();
    const matches = [];
    let stopped = false;

    eachCell(candidate, (key) => {
      if (stopped) return;
      const bucket = cells.get(key);
      if (!bucket) return;

      for (const entry of bucket) {
        if (seen.has(entry)) continue;
        seen.add(entry);
        if (!boxesIntersect(entry.box, candidate)) continue;
        matches.push(entry);
        if (stopAfterFirst) {
          stopped = true;
          return;
        }
      }
    });

    return matches;
  };

  return {
    get size() {
      return entryCount;
    },

    add(box, value) {
      assertBox(box);
      const entry = {
        box: { ...box },
        value,
      };
      eachCell(entry.box, (key) => {
        const bucket = cells.get(key);
        if (bucket) {
          bucket.push(entry);
        } else {
          cells.set(key, [entry]);
        }
      });
      entryCount += 1;
    },

    allCollisions(candidate) {
      return findEntries(candidate, false).map((entry) => ({
        box: { ...entry.box },
        value: entry.value,
      }));
    },

    collides(candidate) {
      return findEntries(candidate, true).length > 0;
    },

    firstCollision(candidate) {
      const entry = findEntries(candidate, true)[0];
      return entry
        ? {
            box: { ...entry.box },
            value: entry.value,
          }
        : null;
    },

    search(candidate) {
      return findEntries(candidate, false).map((entry) => entry.value);
    },

    clear() {
      cells.clear();
      entryCount = 0;
    },
  };
};

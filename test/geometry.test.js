import test from "node:test";
import assert from "node:assert/strict";

import {
  boxesIntersect,
  createBoxIndex,
  expandBox,
  intersectBoxes,
  unionBoxes,
} from "../src/geometry.js";

test("box helpers use edge-touching as a non-overlap", () => {
  const first = { left: 0, right: 10, top: 0, bottom: 10 };
  const touching = { left: 10, right: 20, top: 0, bottom: 10 };
  const overlapping = { left: 9, right: 20, top: 0, bottom: 10 };

  assert.equal(boxesIntersect(first, touching), false);
  assert.equal(boxesIntersect(first, overlapping), true);
  assert.deepEqual(expandBox(first, 2), {
    left: -2,
    right: 12,
    top: -2,
    bottom: 12,
  });
  assert.deepEqual(unionBoxes([first, overlapping]), {
    left: 0,
    right: 20,
    top: 0,
    bottom: 10,
  });
  assert.deepEqual(intersectBoxes(first, overlapping), {
    left: 9,
    right: 10,
    top: 0,
    bottom: 10,
  });
  assert.equal(intersectBoxes(first, touching), null);
  assert.equal(unionBoxes([]), null);
});

test("box index deduplicates entries that span multiple grid cells", () => {
  const index = createBoxIndex({ cellSize: 10 });
  const wide = { left: -5, right: 25, top: -5, bottom: 25 };
  index.add(wide, "wide");
  index.add({ left: 30, right: 35, top: 30, bottom: 35 }, "far");

  assert.equal(index.size, 2);
  assert.deepEqual(
    index.search({ left: 0, right: 20, top: 0, bottom: 20 }),
    ["wide"],
  );
  assert.deepEqual(
    index.firstCollision({ left: 24, right: 26, top: 0, bottom: 1 }),
    {
      box: wide,
      value: "wide",
    },
  );
  assert.equal(
    index.collides({ left: -20, right: -10, top: -20, bottom: -10 }),
    false,
  );

  index.clear();
  assert.equal(index.size, 0);
});

test("geometry rejects inverted or non-finite boxes", () => {
  assert.throws(
    () =>
      boxesIntersect(
        { left: 10, right: 0, top: 0, bottom: 10 },
        { left: 0, right: 10, top: 0, bottom: 10 },
      ),
    /inverted bounds/,
  );
  assert.throws(
    () =>
      createBoxIndex({ cellSize: 0 }),
    /greater than zero/,
  );
  assert.throws(
    () =>
      unionBoxes([
        { left: 0, right: Number.NaN, top: 0, bottom: 10 },
      ]),
    /finite number/,
  );
});

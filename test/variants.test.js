import test from "node:test";
import assert from "node:assert/strict";

import { createPointVariants } from "../src/variants.js";

test("point variants create right, left, and marker-only fallbacks", () => {
  const variants = createPointVariants({
    marker: { width: 20, height: 30, anchor: "bottom" },
    label: { width: 40, height: 16, gap: 4 },
  });

  assert.deepEqual(variants, [
    {
      key: "label-right",
      boxes: [
        { left: -10, right: 10, top: -30, bottom: 0 },
        { left: 14, right: 54, top: -23, bottom: -7 },
      ],
    },
    {
      key: "label-left",
      boxes: [
        { left: -10, right: 10, top: -30, bottom: 0 },
        { left: -54, right: -14, top: -23, bottom: -7 },
      ],
    },
    {
      key: "marker-only",
      boxes: [{ left: -10, right: 10, top: -30, bottom: 0 }],
    },
  ]);
});

test("point variants support above and below label placement", () => {
  const variants = createPointVariants(
    {
      marker: { width: 10, height: 10, anchor: "center" },
      label: { width: 20, height: 8, gap: 2 },
    },
    ["above", "below"],
  );

  assert.deepEqual(variants[0], {
    key: "label-above",
    boxes: [
      { left: -5, right: 5, top: -5, bottom: 5 },
      { left: -10, right: 10, top: -15, bottom: -7 },
    ],
  });
  assert.deepEqual(variants[1], {
    key: "label-below",
    boxes: [
      { left: -5, right: 5, top: -5, bottom: 5 },
      { left: -10, right: 10, top: 7, bottom: 15 },
    ],
  });
});

test("point variants accept a custom anchor ratio", () => {
  const [variant] = createPointVariants({
    marker: {
      width: 20,
      height: 10,
      anchor: { x: 0.25, y: 1.5 },
    },
  });

  assert.deepEqual(variant, {
    key: "marker-only",
    boxes: [{ left: -5, right: 15, top: -15, bottom: -5 }],
  });
});

test("point variants reject unsupported or incomplete placement input", () => {
  assert.throws(
    () =>
      createPointVariants({
        marker: { width: 0, height: 10 },
      }),
    /greater than zero/,
  );
  assert.throws(
    () =>
      createPointVariants(
        {
          marker: { width: 10, height: 10 },
        },
        ["right"],
      ),
    /point.label is required/,
  );
  assert.throws(
    () =>
      createPointVariants(
        {
          marker: { width: 10, height: 10 },
          label: { width: 10, height: 10 },
        },
        ["right", "right"],
      ),
    /duplicate placement/,
  );
  assert.throws(
    () =>
      createPointVariants({
        width: Number.MAX_VALUE,
        height: 1,
        anchor: { x: 2, y: 0 },
      }),
    /finite non-empty geometry/,
  );
});

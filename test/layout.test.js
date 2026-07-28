import test from "node:test";
import assert from "node:assert/strict";

import {
  boxesIntersect,
  layoutMarkers,
  updateMarkerLayout,
} from "../src/index.js";

const viewport = { width: 300, height: 200 };

test("priority, collision, and filtering produce explainable decisions", () => {
  const result = layoutMarkers({
    viewport,
    markers: [
      { id: "low", x: 50, y: 50, width: 20, height: 20 },
      {
        id: "high",
        x: 55,
        y: 50,
        width: 20,
        height: 20,
        priority: 10,
      },
      { id: "separate", x: 150, y: 50, width: 20, height: 20 },
      { id: "outside", x: 500, y: 50, width: 20, height: 20 },
      { id: "missing", x: 220, y: 50 },
      {
        id: "unprojectable",
        x: Number.NaN,
        y: 50,
        width: 20,
        height: 20,
      },
    ],
  });

  assert.deepEqual(
    result.visible.map((entry) => entry.id).sort(),
    ["high", "separate"],
  );
  assert.deepEqual(
    Object.fromEntries(result.hidden.map((entry) => [entry.id, entry.reason])),
    {
      low: "collision",
      outside: "outside-viewport",
      missing: "no-valid-variant",
      unprojectable: "not-projectable",
    },
  );
  assert.deepEqual(
    result.hidden.find((entry) => entry.id === "low")?.blockedBy,
    { kind: "marker", id: "high" },
  );
  assert.equal(result.diagnostics.visibleCount, 2);
  assert.equal(result.diagnostics.hiddenCount, 4);
  assert.equal(result.diagnostics.byReason.collision, 1);
  assert.equal(result.diagnostics.changedCount, 0);
});

test("label variants fall back and retain their prior placement until the epoch changes", () => {
  const frame = {
    viewport,
    epoch: "camera-a",
    markers: [
      {
        id: "place",
        x: 100,
        y: 80,
        marker: { width: 20, height: 20 },
        label: { width: 40, height: 16 },
      },
    ],
    obstacleBoxes: [
      {
        id: "right-side-control",
        box: { left: 120, right: 150, top: 70, bottom: 90 },
      },
    ],
  };

  const first = layoutMarkers(frame);
  assert.equal(first.visible[0].variantKey, "label-left");

  const second = updateMarkerLayout(first.state, {
    ...frame,
    obstacleBoxes: [],
  });
  assert.equal(second.visible[0].variantKey, "label-left");
  assert.equal(second.diagnostics.retainedCount, 1);
  assert.equal(second.diagnostics.changedCount, 0);

  const third = updateMarkerLayout(second.state, {
    ...frame,
    epoch: "camera-b",
    obstacleBoxes: [],
  });
  assert.equal(third.visible[0].variantKey, "label-right");
  assert.equal(third.diagnostics.changedCount, 1);
});

test("cell budgets backfill when an earlier candidate cannot be placed", () => {
  const density = {
    cellSize: 100,
    stops: [{ minPressure: 0, maxPerCell: 1 }],
  };
  const result = layoutMarkers(
    {
      viewport,
      markers: [
        {
          id: "blocked",
          x: 10,
          y: 10,
          priority: 10,
          variants: [
            {
              key: "only",
              boxes: [{ left: 0, right: 20, top: 0, bottom: 20 }],
            },
          ],
        },
        {
          id: "placed",
          x: 20,
          y: 10,
          priority: 5,
          variants: [
            {
              key: "only",
              boxes: [{ left: 40, right: 50, top: 0, bottom: 10 }],
            },
          ],
        },
        {
          id: "budget",
          x: 30,
          y: 10,
          variants: [
            {
              key: "only",
              boxes: [{ left: 60, right: 70, top: 0, bottom: 10 }],
            },
          ],
        },
      ],
      obstacleBoxes: [
        { left: 0, right: 20, top: 0, bottom: 20 },
      ],
    },
    { density },
  );

  assert.deepEqual(result.visible.map((entry) => entry.id), ["placed"]);
  assert.equal(
    result.hidden.find((entry) => entry.id === "blocked")?.reason,
    "collision",
  );
  assert.equal(
    result.hidden.find((entry) => entry.id === "budget")?.reason,
    "cell-budget",
  );
});

test("pinned markers remain visible and report overlaps", () => {
  const result = layoutMarkers({
    viewport,
    pressure: 1,
    markers: [
      {
        id: "selected",
        x: 80,
        y: 80,
        width: 30,
        height: 30,
        pinned: true,
      },
      {
        id: "focused",
        x: 80,
        y: 80,
        width: 30,
        height: 30,
        pinned: true,
      },
      {
        id: "regular",
        x: 85,
        y: 80,
        width: 20,
        height: 20,
      },
    ],
  });

  assert.deepEqual(
    result.visible.map((entry) => entry.id).sort(),
    ["focused", "selected"],
  );
  assert.equal(result.diagnostics.pinnedOverlapCount, 1);
  assert.equal(result.diagnostics.warnings[0].code, "pinned-overlap");
  assert.equal(
    result.hidden.find((entry) => entry.id === "regular")?.reason,
    "cell-budget",
  );
});

test("marker ordering is deterministic and regular visible boxes do not overlap", () => {
  const markers = Array.from({ length: 30 }, (_, index) => ({
    id: `marker-${index}`,
    x: 20 + (index % 10) * 22,
    y: 20 + Math.floor(index / 10) * 22,
    width: 24,
    height: 24,
    priority: index % 4,
  }));
  const frame = {
    viewport,
    pressure: 0.8,
    epoch: "stable",
    markers,
  };
  const first = layoutMarkers(frame, { collisionPadding: 2 });
  const second = layoutMarkers(
    { ...frame, markers: [...markers].reverse() },
    { collisionPadding: 2 },
  );

  assert.deepEqual(second, first);

  const boxes = first.visible.flatMap((entry) => entry.boxes);
  for (let outer = 0; outer < boxes.length; outer += 1) {
    for (let inner = outer + 1; inner < boxes.length; inner += 1) {
      assert.equal(boxesIntersect(boxes[outer], boxes[inner]), false);
    }
  }
});

test("layout state is serializable and inputs are not mutated", () => {
  const frame = {
    viewport: { ...viewport },
    markers: [
      {
        id: 1,
        x: 40,
        y: 40,
        marker: { width: 10, height: 20, anchor: "bottom" },
        variants: undefined,
      },
    ],
  };
  const before = structuredClone(frame);
  const result = layoutMarkers(frame);

  assert.deepEqual(frame, before);
  assert.deepEqual(JSON.parse(JSON.stringify(result.state)), result.state);

  result.state.visible[0].variantKey = "changed-by-caller";
  const next = updateMarkerLayout(
    {
      version: 1,
      epoch: null,
      visible: [{ id: 1, variantKey: "marker-only" }],
    },
    frame,
  );
  assert.equal(next.visible[0].variantKey, "marker-only");
});

test("layout rejects duplicate ids and invalid configuration", () => {
  assert.throws(
    () =>
      layoutMarkers({
        viewport,
        markers: [
          { id: "same", x: 10, y: 10, width: 10, height: 10 },
          { id: "same", x: 20, y: 20, width: 10, height: 10 },
        ],
      }),
    /duplicate marker id/,
  );
  assert.throws(
    () =>
      layoutMarkers(
        {
          viewport,
          markers: [],
        },
        {
          density: {
            cellSize: 0,
            stops: [{ minPressure: 0, maxPerCell: 1 }],
          },
        },
      ),
    /greater than zero/,
  );
  assert.throws(
    () =>
      updateMarkerLayout(
        { version: 2, epoch: null, visible: [] },
        { viewport, markers: [] },
      ),
    /not a stable-marker-layout state/,
  );
});

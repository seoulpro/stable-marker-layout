import test from "node:test";
import assert from "node:assert/strict";

import {
  createProjectedMarkerLayout,
  layoutMarkers,
  updateMarkerLayout,
} from "../src/index.js";

const viewport = { width: 240, height: 160 };

test("external obstacles block pinned markers while marker overlaps do not", () => {
  const fallback = layoutMarkers({
    viewport,
    markers: [
      {
        id: "pinned",
        x: 100,
        y: 80,
        pinned: true,
        marker: { width: 20, height: 20 },
        label: {
          width: 40,
          height: 16,
          placements: ["right", "left"],
        },
      },
    ],
    obstacles: [
      {
        id: "control",
        box: { left: 115, right: 150, top: 65, bottom: 95 },
      },
    ],
  });
  assert.equal(fallback.visible[0].variantKey, "label-left");

  const blocked = layoutMarkers({
    viewport,
    markers: [
      {
        id: "pinned",
        x: 100,
        y: 80,
        pinned: true,
        width: 20,
        height: 20,
      },
    ],
    obstacles: [
      {
        id: "modal",
        box: { left: 80, right: 120, top: 60, bottom: 100 },
      },
    ],
  });
  assert.equal(blocked.visible.length, 0);
  assert.deepEqual(blocked.hidden, [
    {
      id: "pinned",
      reason: "collision",
      blockedBy: { kind: "obstacle", id: "modal" },
    },
  ]);
});

test("marker and obstacle permutations do not change results", () => {
  const markers = [
    { id: "1", x: 80, y: 80, width: 20, height: 20 },
    { id: 1, x: 160, y: 80, width: 20, height: 20 },
  ];
  const obstacles = [
    {
      id: "z-control",
      box: { left: 70, right: 90, top: 70, bottom: 90 },
    },
    {
      id: "a-control",
      box: { left: 70, right: 90, top: 70, bottom: 90 },
    },
  ];
  const first = layoutMarkers({ viewport, markers, obstacles });
  const second = layoutMarkers({
    viewport,
    markers: [...markers].reverse(),
    obstacles: [...obstacles].reverse(),
  });

  assert.deepEqual(second, first);
  assert.deepEqual(first.visible.map((entry) => entry.id), [1]);
  assert.deepEqual(first.hidden[0].blockedBy, {
    kind: "obstacle",
    id: "a-control",
  });
});

test("density origin controls stable cell alignment", () => {
  const markers = [
    { id: "left", x: 99, y: 50, width: 1, height: 1 },
    { id: "right", x: 101, y: 50, width: 1, height: 1 },
  ];
  const density = {
    cellSize: 100,
    stops: [{ minPressure: 0, maxPerCell: 1 }],
  };
  const separateCells = layoutMarkers(
    { viewport, markers },
    { density },
  );
  const sharedCell = layoutMarkers(
    {
      viewport,
      markers,
      densityOrigin: { x: 50, y: 0 },
    },
    { density },
  );

  assert.equal(separateCells.visible.length, 2);
  assert.equal(sharedCell.visible.length, 1);
  assert.equal(
    sharedCell.hidden.find((entry) => entry.reason === "cell-budget")?.id,
    markers.find(
      (marker) => marker.id !== sharedCell.visible[0].id,
    )?.id,
  );
});

test("retention wins equal-priority ties but not a later priority increase", () => {
  const density = {
    cellSize: 200,
    stops: [{ minPressure: 0, maxPerCell: 1 }],
  };
  const first = layoutMarkers(
    {
      viewport,
      epoch: "same",
      markers: [
        { id: "a", x: 30, y: 30, width: 10, height: 10 },
        {
          id: "b",
          x: 100,
          y: 30,
          width: 10,
          height: 10,
          priority: 1,
        },
      ],
    },
    { density },
  );
  assert.equal(first.visible[0].id, "b");

  const retained = updateMarkerLayout(
    first.state,
    {
      viewport,
      epoch: "same",
      markers: [
        { id: "a", x: 30, y: 30, width: 10, height: 10 },
        { id: "b", x: 100, y: 30, width: 10, height: 10 },
      ],
    },
    { density },
  );
  assert.equal(retained.visible[0].id, "b");
  assert.equal(retained.visible[0].retained, true);

  const reprioritized = updateMarkerLayout(
    retained.state,
    {
      viewport,
      epoch: "same",
      markers: [
        {
          id: "a",
          x: 30,
          y: 30,
          width: 10,
          height: 10,
          priority: 2,
        },
        { id: "b", x: 100, y: 30, width: 10, height: 10 },
      ],
    },
    { density },
  );
  assert.equal(reprioritized.visible[0].id, "a");
});

test("validation rejects ambiguous geometry and non-monotonic density", () => {
  assert.throws(
    () =>
      layoutMarkers({
        viewport,
        pressure: 1.1,
        markers: [],
      }),
    /between 0 and 1/,
  );
  assert.throws(
    () =>
      layoutMarkers({
        viewport,
        markers: [
          {
            id: "duplicate-variant",
            x: 10,
            y: 10,
            variants: [
              {
                key: "same",
                boxes: [{ left: 0, right: 10, top: 0, bottom: 10 }],
              },
              {
                key: "same",
                boxes: [{ left: 10, right: 20, top: 0, bottom: 10 }],
              },
            ],
          },
        ],
      }),
    /duplicate variant key/,
  );
  assert.throws(
    () =>
      layoutMarkers(
        { viewport, markers: [] },
        {
          density: {
            cellSize: 100,
            stops: [
              { minPressure: 0, maxPerCell: 1 },
              { minPressure: 0.5, maxPerCell: 2 },
            ],
          },
        },
      ),
    /must not increase/,
  );
});

test("projection adapters reject non-finite points but accept an explicit null", () => {
  const invalid = createProjectedMarkerLayout({
    project: () => ({ x: Number.POSITIVE_INFINITY, y: 10 }),
  });
  assert.throws(
    () =>
      invalid.update({
        view: null,
        viewport,
        items: [{ id: "bad", width: 10, height: 10 }],
      }),
    /non-finite coordinates/,
  );

  const filtered = createProjectedMarkerLayout({
    describe: (item) => ({
      id: item.id,
      marker: { width: 10, height: 10 },
    }),
    project: () => null,
  });
  const result = filtered.update({
    view: null,
    viewport,
    items: [{ id: "filtered" }],
  });
  assert.deepEqual(result.hidden, [
    { id: "filtered", reason: "not-projectable" },
  ]);
  assert.deepEqual(structuredClone(result), result);
});

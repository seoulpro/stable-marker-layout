import test from "node:test";
import assert from "node:assert/strict";

import { createProjectedMarkerLayout } from "../src/index.js";

test("projected layouts support axis changes, height, and view-derived policy", () => {
  const layout = createProjectedMarkerLayout({
    id: (item) => item.key,
    project(item, view) {
      if (item.hidden) return null;
      return {
        x: view.offsetX + item.z * view.scale,
        y: view.offsetY - (item.x + item.height) * view.scale,
        depth: item.height,
      };
    },
    dimensions(item) {
      return {
        marker: {
          width: item.size,
          height: item.size,
          anchor: "bottom",
        },
        priority: item.rank,
        pinned: item.pinned,
      };
    },
    viewport: (view) => view.viewport,
    pressure: (view) => view.pressure,
    stabilityKey: (view) => view.revision,
  });

  const view = {
    offsetX: 100,
    offsetY: 120,
    scale: 2,
    pressure: 0,
    revision: "r1",
    viewport: { width: 300, height: 200 },
  };
  const result = layout.update({
    view,
    items: [
      { key: "tower", x: 10, z: 20, height: 5, size: 20, rank: 2 },
      {
        key: "focus",
        x: 50,
        z: 50,
        height: 0,
        size: 20,
        rank: 1,
        pinned: true,
      },
      { key: "hidden", x: 0, z: 0, height: 0, size: 20, hidden: true },
    ],
  });

  assert.deepEqual(
    result.visible.map((entry) => ({
      id: entry.id,
      anchor: entry.anchor,
      pinned: entry.pinned,
    })),
    [
      {
        id: "focus",
        anchor: { x: 200, y: 20 },
        pinned: true,
      },
      {
        id: "tower",
        anchor: { x: 140, y: 90 },
        pinned: false,
      },
    ],
  );
  assert.equal(
    result.hidden.find((entry) => entry.id === "hidden")?.reason,
    "not-projectable",
  );
  assert.equal(result.state.epoch, "r1");
});

test("projected layouts can use item dimensions without an adapter callback", () => {
  const layout = createProjectedMarkerLayout({
    project: (item) => ({ x: item.screenX, y: item.screenY }),
  });
  const result = layout.update({
    view: null,
    viewport: { width: 100, height: 100 },
    items: [
      {
        id: 1,
        screenX: 50,
        screenY: 50,
        width: 10,
        height: 10,
      },
    ],
  });

  assert.equal(result.visible[0].id, 1);
  assert.equal(result.visible[0].variantKey, "marker-only");
});

import test from "node:test";
import assert from "node:assert/strict";

import { createMarkerLayout } from "../src/index.js";

test("stateful sessions snapshot and reset their stability state", () => {
  const layout = createMarkerLayout();
  const first = layout.update({
    viewport: { width: 200, height: 100 },
    epoch: 1,
    markers: [
      {
        id: "marker",
        x: 80,
        y: 50,
        marker: { width: 20, height: 20 },
        label: { width: 30, height: 10 },
        placements: ["left", "right"],
      },
    ],
  });
  assert.equal(first.visible[0].variantKey, "label-left");

  const snapshot = layout.snapshot();
  assert.deepEqual(snapshot, first.state);
  snapshot.visible[0].variantKey = "caller-change";
  assert.deepEqual(layout.snapshot(), first.state);

  const second = layout.update({
    viewport: { width: 200, height: 100 },
    epoch: 1,
    markers: [
      {
        id: "marker",
        x: 80,
        y: 50,
        marker: { width: 20, height: 20 },
        label: { width: 30, height: 10 },
        placements: ["right", "left"],
      },
    ],
  });
  assert.equal(second.visible[0].variantKey, "label-left");

  layout.reset();
  assert.equal(layout.snapshot(), null);
  const afterReset = layout.update({
    viewport: { width: 200, height: 100 },
    epoch: 1,
    markers: [
      {
        id: "marker",
        x: 80,
        y: 50,
        marker: { width: 20, height: 20 },
        label: { width: 30, height: 10 },
        placements: ["right", "left"],
      },
    ],
  });
  assert.equal(afterReset.visible[0].variantKey, "label-right");
});

# stable-marker-layout

Deterministic, projection-agnostic layout and decluttering for moving point
annotations.

`stable-marker-layout` decides which point markers are visible, which variant
each marker uses, and why another marker was hidden. It does not render
anything. The core works with CSS-pixel boxes and has no dependency on a map
SDK, coordinate reference system, DOM, Canvas, SVG, WebGL, or React.

## Features

- deterministic output independent of marker and obstacle array order
- icon and measured-label placement with right, left, and marker-only fallback
- stateful retention of visible markers and their selected variants
- progressive per-cell density budgets driven by a generic `pressure` value
- priority and pinned-marker semantics
- named obstacles for coordination across independent layers
- explicit hidden reasons, collision owners, and pinned-overlap diagnostics
- adapters for arbitrary source coordinates and view models
- serializable state suitable for worker messages and persistence
- zero runtime dependencies

## Install

The package has not yet been published to the npm registry. To evaluate the
current repository version:

```sh
npm install github:seoulpro/stable-marker-layout
```

The package is ESM-only and supports Node.js 20.19 or newer. Its runtime code is
also browser- and worker-compatible.

## Quick start

For a marker whose dimensions are already known:

```js
import { createMarkerLayout } from "stable-marker-layout";

const layout = createMarkerLayout({ collisionPadding: 4 });

const result = layout.update({
  viewport: { width: 1280, height: 720 },
  pressure: 0.4,
  markers: [
    {
      id: "place-a",
      x: 320,
      y: 180,
      width: 24,
      height: 32,
      anchor: "bottom",
      priority: 10,
    },
  ],
});

console.log(result.visible);
console.log(result.hidden);
```

Coordinates use CSS pixels: `x` grows to the right and `y` grows downward.
Dimensions and coordinates must be measured by the caller.

## Add a measured label

Supplying `marker` and `label` dimensions creates three variants by default:

1. label to the right
2. label to the left
3. marker only

```js
const result = layout.update({
  viewport: { width: 1280, height: 720 },
  markers: [
    {
      id: "place-a",
      x: 320,
      y: 180,
      marker: {
        width: 24,
        height: 32,
        anchor: "bottom",
      },
      label: {
        width: 96,
        height: 32,
        gap: 4,
      },
    },
  ],
});
```

The engine does not measure, wrap, shape, or render text. Use the same
measurement method as the eventual renderer, then pass the resulting width and
height.

To opt into vertical variants:

```js
{
  marker: { width: 24, height: 32, anchor: "bottom" },
  label: {
    width: 96,
    height: 32,
    gap: 4,
    placements: ["right", "left", "above", "below", "marker-only"],
  },
}
```

## Frame-to-frame stability

`createMarkerLayout()` keeps the previous state internally. When priority is
equal, a previously visible marker is considered before a new marker, and its
previous variant is tried first. Geometry and collisions are still recomputed
on every call.

```js
const first = layout.update(frameA);
const second = layout.update(frameB);

const serializableState = layout.snapshot();
layout.reset();
```

Use `epoch` when a dataset revision or a deliberate layout boundary should
discard retention:

```js
layout.update({
  viewport,
  markers,
  epoch: dataRevision,
});
```

The pure equivalents are:

```js
import {
  layoutMarkers,
  updateMarkerLayout,
} from "stable-marker-layout";

const first = layoutMarkers(frame);
const second = updateMarkerLayout(first.state, nextFrame);
```

Pure calls are independent and can run concurrently. A stateful session is
synchronous and should not be re-entered.

## Density pressure

`pressure` is a normalized congestion signal from `0` through `1`. It does not
mean zoom and may instead represent data volume, viewport size, camera angle,
or a product-specific detail level.

The default policy uses 128-pixel cells:

| Minimum pressure | Maximum visible per cell |
| ---: | ---: |
| `0` | unlimited |
| `0.35` | 4 |
| `0.7` | 2 |
| `0.9` | 1 |

Pinned markers consume cell capacity but are not removed when their count
exceeds the budget. A candidate that fails collision placement does not consume
capacity, so the next candidate in the cell can backfill the slot.

Provide a custom monotonic policy:

```js
const layout = createMarkerLayout({
  density: {
    cellSize: 96,
    stops: [
      { minPressure: 0, maxPerCell: null },
      { minPressure: 0.5, maxPerCell: 3 },
      { minPressure: 0.85, maxPerCell: 1 },
    ],
  },
});
```

Set `density: false` to disable per-cell budgets. Use `densityOrigin` on a frame
to align the grid with a stable screen-space origin:

```js
layout.update({
  viewport,
  markers,
  densityOrigin: { x: 32, y: 32 },
});
```

## Priority, pinned markers, and obstacles

Higher numeric priority is considered first. Pinned markers are considered
before regular markers and are never hidden by density or by another marker.
They are still blocked by external obstacles.

```js
const result = layout.update({
  viewport,
  markers: [
    {
      id: "selected",
      x: 400,
      y: 240,
      width: 28,
      height: 36,
      anchor: "bottom",
      pinned: true,
    },
  ],
  obstacles: [
    {
      id: "floating-toolbar",
      box: { left: 0, top: 0, right: 1280, bottom: 64 },
      padding: 4,
    },
  ],
});
```

Overlapping pinned markers remain visible. Each pair is reported as a
`pinned-overlap` warning.

## Custom variants

Custom variant boxes are relative to the marker's `x` and `y`. Output boxes are
absolute screen coordinates and are not clipped to the viewport.

```js
{
  id: "custom-a",
  x: 320,
  y: 180,
  variants: [
    {
      key: "wide",
      boxes: [
        { left: -12, top: -32, right: 12, bottom: 0 },
        { left: 16, top: -28, right: 112, bottom: 4 },
      ],
    },
    {
      key: "compact",
      boxes: [
        { left: -12, top: -32, right: 12, bottom: 0 },
      ],
    },
  ],
}
```

Each box receives collision padding separately. Empty space between boxes is
not treated as occupied.

`createPointVariants()` exposes the default relative-box builder:

```js
import { createPointVariants } from "stable-marker-layout/variants";

const variants = createPointVariants({
  marker: { width: 24, height: 32, anchor: "bottom" },
  label: { width: 96, height: 32, gap: 4 },
});
```

## Arbitrary coordinate systems

`createProjectedMarkerLayout()` keeps projection policy outside the engine:

```js
import { createProjectedMarkerLayout } from "stable-marker-layout/projected";

const layout = createProjectedMarkerLayout({
  describe(item) {
    return {
      id: item.key,
      marker: item.markerSize,
      label: item.labelSize,
      priority: item.priority,
    };
  },

  project(item, view) {
    const point = customProjection(item.position, view);
    if (!point.visible) return null;

    return {
      x: point.screenX,
      y: point.screenY,
      depth: point.depth,
    };
  },
});

const result = layout.update({
  items,
  view,
  viewport: { width: 1280, height: 720 },
  pressure: view.detailPressure,
  epoch: view.dataRevision,
});
```

Axis swapping, axis inversion, height, isometric projection, perspective,
CAD coordinates, scatterplots, and other source systems belong in `project()`.
The optional `depth` value is carried by the adapter contract but has no
automatic ordering semantics; map it to priority or visibility explicitly when
needed. Returning `null` means `not-projectable`.

## Result

```js
{
  visible: [
    {
      id: "place-a",
      variantKey: "label-left",
      boxes: [
        { left: 308, top: 148, right: 332, bottom: 180 },
        { left: 208, top: 148, right: 304, bottom: 180 },
      ],
      anchor: { x: 320, y: 180 },
      priority: 10,
      pinned: false,
      retained: true,
    },
  ],
  hidden: [
    {
      id: "place-b",
      reason: "collision",
      blockedBy: { kind: "marker", id: "place-a" },
    },
  ],
  state: {
    version: 1,
    epoch: "revision-2",
    visible: [{ id: "place-a", variantKey: "label-left" }],
  },
  diagnostics: {
    inputCount: 2,
    projectedCount: 2,
    visibleCount: 1,
    hiddenCount: 1,
    retainedCount: 1,
    changedCount: 0,
    collisionChecks: 7,
    pressure: 0.4,
    density: {
      cellSize: 128,
      maxPerCell: 4,
      stage: 0.35,
    },
    pinnedOverlapCount: 0,
    byReason: {
      "not-projectable": 0,
      "outside-viewport": 0,
      "cell-budget": 0,
      "collision": 1,
      "no-valid-variant": 0,
    },
    warnings: [],
  },
}
```

Hidden reasons are:

- `not-projectable`
- `outside-viewport`
- `cell-budget`
- `collision`
- `no-valid-variant`

## Determinism contract

For the same frame, previous state, and options:

- marker and obstacle array order does not affect the result;
- numeric ID `1` and string ID `"1"` are distinct;
- pinned status, descending priority, retained status, previous visible rank,
  a stable hash, and typed ID form the deterministic order;
- the previous variant is tried first while the epoch matches;
- touching box edges are not a collision;
- input markers, obstacles, states, and boxes are not mutated;
- every input marker appears exactly once in `visible` or `hidden`;
- state and results are structured-clone and JSON friendly.

Malformed viewports, dimensions, boxes, IDs, states, density policies, and
non-finite projected coordinates fail with an explicit error.

## Resource limits

The collision index rejects boxes whose derived grid coordinates are outside
JavaScript's safe integer range. It also limits each box to 65,536 grid cells
by default so a very small cell size or very large box fails before iteration.

Set `boxIndexMaxCellsPerBox` on a layout to change that per-box limit. Direct
users of the geometry index can set `maxCellsPerBox`:

```js
import { createMarkerLayout } from "stable-marker-layout";
import { createBoxIndex } from "stable-marker-layout/geometry";

const layout = createMarkerLayout({
  boxIndexCellSize: 96,
  boxIndexMaxCellsPerBox: 16_384,
});

const index = createBoxIndex({
  cellSize: 96,
  maxCellsPerBox: 16_384,
});
```

This guard does not impose a total marker-count limit. Applications accepting
untrusted input should still bound marker counts, boxes per variant, coordinate
ranges, and box extents according to their latency and memory budgets.

## Geometry helpers

The `stable-marker-layout/geometry` export provides:

- `boxesIntersect(a, b)`
- `expandBox(box, padding)`
- `intersectBoxes(a, b)`
- `unionBoxes(boxes)`
- `createBoxIndex({ cellSize, maxCellsPerBox })`

The grid index supports `add`, `firstCollision`, `allCollisions`, `search`,
`collides`, and `clear`.

## Non-goals

This package intentionally does not provide:

- rendering components or event handling
- text measurement, wrapping, shaping, or font loading
- icon fetching or caching
- line/path labels
- clustering or aggregation
- map SDK adapters or coordinate reference systems
- camera implementations, tiles, or networking
- animation or crossfades

## Development

```sh
npm ci
npm run check
```

The quality gate runs syntax checks, TypeScript consumer checks, behavioral
tests with coverage, an executable example, package metadata validation, type
package validation, and a packed-tarball installation smoke test.

Run the synthetic 1,000/10,000/50,000-marker benchmark separately:

```sh
npm run benchmark
```

## License

The software and associated documentation are available under the
[MIT License](./LICENSE). The repository's
[Code of Conduct](https://github.com/seoulpro/stable-marker-layout/blob/main/CODE_OF_CONDUCT.md)
is separately licensed under CC BY 4.0 as stated in that file.

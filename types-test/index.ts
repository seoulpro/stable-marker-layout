import {
  createBoxIndex,
  createMarkerLayout,
  createPointVariants,
  createProjectedMarkerLayout,
  layoutMarkers,
  type Box,
  type LayoutFrame,
  type LayoutResult,
} from "stable-marker-layout";

const obstacle: Box = { left: 0, right: 10, top: 0, bottom: 10 };
const index = createBoxIndex<string>({
  cellSize: 32,
  maxCellsPerBox: 4_096,
});
index.add(obstacle, "toolbar");
const owner: { box: Box; value: string } | null =
  index.firstCollision(obstacle);
void owner;
void createBoxIndex(32);

const variants = createPointVariants({
  marker: { width: 20, height: 30, anchor: "bottom" },
  label: { width: 80, height: 20, gap: 4 },
});
void variants;

const frame: LayoutFrame = {
  viewport: { width: 800, height: 600 },
  pressure: 0.5,
  epoch: "dataset-1",
  obstacleBoxes: [{ box: obstacle, id: "toolbar" }],
  markers: [
    {
      id: "a",
      x: 100,
      y: 100,
      width: 20,
      height: 30,
      anchor: "bottom",
      priority: 2,
    },
  ],
};
const oneShot: LayoutResult = layoutMarkers(frame);
void oneShot;

const session = createMarkerLayout({
  boxIndexMaxCellsPerBox: 4_096,
  density: {
    cellSize: 96,
    stops: [{ minPressure: 0, maxPerCell: 2 }],
  },
});
const state = session.update(frame).state;
const snapshot = session.snapshot();
void state;
void snapshot;
session.reset();

type Item = {
  key: string;
  position: [number, number, number];
  size: number;
};
type View = {
  width: number;
  height: number;
  scale: number;
};

const projected = createProjectedMarkerLayout<Item, View>({
  id: (item) => item.key,
  project: (item, view) => ({
    x: item.position[2] * view.scale,
    y: item.position[0] * view.scale - item.position[1],
    depth: item.position[1],
  }),
  dimensions: (item) => ({
    marker: { width: item.size, height: item.size },
  }),
  viewport: (view) => ({ width: view.width, height: view.height }),
});

projected.update({
  items: [{ key: "a", position: [1, 2, 3], size: 10 }],
  view: { width: 100, height: 100, scale: 2 },
});

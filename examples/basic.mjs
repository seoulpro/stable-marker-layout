import { createMarkerLayout } from "stable-marker-layout";

const layout = createMarkerLayout({ collisionPadding: 4 });

const result = layout.update({
  viewport: { width: 640, height: 360 },
  pressure: 0.4,
  markers: [
    {
      id: "museum",
      x: 280,
      y: 160,
      marker: { width: 24, height: 32, anchor: "bottom" },
      label: { width: 88, height: 24, gap: 4 },
      priority: 10,
    },
    {
      id: "cafe",
      x: 310,
      y: 160,
      marker: { width: 20, height: 28, anchor: "bottom" },
      label: { width: 64, height: 24, gap: 4 },
    },
  ],
});

console.log(
  JSON.stringify(
    {
      visible: result.visible.map(({ id, variantKey }) => ({
        id,
        variantKey,
      })),
      hidden: result.hidden,
      diagnostics: result.diagnostics,
    },
    null,
    2,
  ),
);

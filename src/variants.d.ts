import type { Box } from "./geometry.js";

export type MarkerAnchor =
  | "center"
  | "bottom"
  | {
      x: number;
      y: number;
    };

export type LabelPlacement =
  | "right"
  | "left"
  | "above"
  | "below"
  | "marker-only";

export interface MarkerDimensions {
  width: number;
  height: number;
  anchor?: MarkerAnchor;
}

export interface LabelDimensions {
  width: number;
  height: number;
  gap?: number;
  placements?: readonly LabelPlacement[];
}

export interface LayoutVariant {
  key: string;
  boxes: readonly Box[];
}

export interface PointVariantInput {
  marker: MarkerDimensions;
  label?: LabelDimensions;
}

export function createPointVariants(
  point: PointVariantInput,
  placements?: readonly LabelPlacement[],
): LayoutVariant[];

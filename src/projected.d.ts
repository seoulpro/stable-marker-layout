import type {
  LayoutEpoch,
  LayoutOptions,
  LayoutResult,
  LayoutState,
  MarkerId,
  Obstacle,
  Viewport,
} from "./layout.js";
import type {
  LabelDimensions,
  LabelPlacement,
  LayoutVariant,
  MarkerAnchor,
  MarkerDimensions,
} from "./variants.js";

export interface ProjectedPoint {
  x: number;
  y: number;
  visible?: boolean;
  depth?: number;
}

export interface ProjectedMarkerDimensions {
  width?: number;
  height?: number;
  anchor?: MarkerAnchor;
  marker?: MarkerDimensions;
  label?: LabelDimensions;
  placements?: readonly LabelPlacement[];
  variants?: readonly LayoutVariant[];
  priority?: number;
  pinned?: boolean;
  collisionPadding?: number;
}

export interface ProjectedMarkerDescriptor<
  Id extends MarkerId = MarkerId,
> extends ProjectedMarkerDimensions {
  id: Id;
}

export interface ProjectedMarkerAdapter<
  Item,
  View,
  Id extends MarkerId = MarkerId,
> {
  describe?(
    item: Item,
    view: View,
    index: number,
  ): ProjectedMarkerDescriptor<Id> | null | undefined;
  id?(item: Item, index: number): Id;
  project(item: Item, view: View, index: number): ProjectedPoint | null;
  dimensions?(
    item: Item,
    view: View,
    projected: ProjectedPoint,
    index: number,
  ): ProjectedMarkerDimensions | null;
  priority?(
    item: Item,
    view: View,
    projected: ProjectedPoint | null,
    index: number,
  ): number;
  pinned?(
    item: Item,
    view: View,
    projected: ProjectedPoint | null,
    index: number,
  ): boolean;
  viewport?(view: View): Viewport;
  pressure?(view: View): number;
  epoch?(view: View): LayoutEpoch;
  stabilityKey?(view: View): LayoutEpoch;
}

export interface ProjectedLayoutInput<Item, View> {
  items: readonly Item[];
  view: View;
  viewport?: Viewport;
  pressure?: number;
  epoch?: LayoutEpoch;
  densityOrigin?: {
    x: number;
    y: number;
  };
  obstacles?: readonly Obstacle[];
  /** @deprecated Use obstacles. */
  obstacleBoxes?: readonly Obstacle[];
}

export interface ProjectedMarkerLayout<
  Item,
  View,
  Id extends MarkerId = MarkerId,
> {
  update(input: ProjectedLayoutInput<Item, View>): LayoutResult<Id>;
  reset(): void;
  snapshot(): LayoutState<Id> | null;
}

export function createProjectedMarkerLayout<
  Item,
  View,
  Id extends MarkerId = MarkerId,
>(
  adapter: ProjectedMarkerAdapter<Item, View, Id>,
  layoutOptions?: LayoutOptions,
): ProjectedMarkerLayout<Item, View, Id>;

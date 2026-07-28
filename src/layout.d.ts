import type { Box } from "./geometry.js";
import type {
  LabelDimensions,
  LabelPlacement,
  LayoutVariant,
  MarkerAnchor,
  MarkerDimensions,
} from "./variants.js";

export type MarkerId = string | number;
export type LayoutEpoch = string | number;

export interface Viewport {
  width: number;
  height: number;
  padding?: number;
}

export interface MarkerCandidate<Id extends MarkerId = MarkerId> {
  id: Id;
  x: number;
  y: number;
  visible?: boolean;
  priority?: number;
  pinned?: boolean;
  collisionPadding?: number;
  width?: number;
  height?: number;
  anchor?: MarkerAnchor;
  marker?: MarkerDimensions;
  label?: LabelDimensions;
  placements?: readonly LabelPlacement[];
  variants?: readonly LayoutVariant[];
}

export interface NamedObstacle {
  box: Box;
  id?: MarkerId;
  padding?: number;
}

export type Obstacle = Box | NamedObstacle;

export interface LayoutFrame<Id extends MarkerId = MarkerId> {
  markers: readonly MarkerCandidate<Id>[];
  viewport: Viewport;
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

export interface DensityStop {
  minPressure: number;
  maxPerCell: number | null;
}

export interface DensityPolicy {
  cellSize: number;
  stops: readonly DensityStop[];
}

export interface LayoutOptions {
  density?: false | DensityPolicy;
  collisionPadding?: number;
  viewportPadding?: number;
  boxIndexCellSize?: number;
  boxIndexMaxCellsPerBox?: number;
  seed?: string | number;
  stabilityKey?: LayoutEpoch;
}

export interface LayoutDecision<Id extends MarkerId = MarkerId> {
  id: Id;
  variantKey: string;
}

export interface LayoutState<Id extends MarkerId = MarkerId> {
  version: 1;
  epoch: LayoutEpoch | null;
  visible: LayoutDecision<Id>[];
}

export interface VisibleMarker<Id extends MarkerId = MarkerId>
  extends LayoutDecision<Id> {
  boxes: Box[];
  anchor: {
    x: number;
    y: number;
  };
  priority: number;
  pinned: boolean;
  retained: boolean;
}

export type HiddenReason =
  | "outside-viewport"
  | "not-projectable"
  | "cell-budget"
  | "collision"
  | "no-valid-variant";

export type CollisionOwner<Id extends MarkerId = MarkerId> =
  | {
      kind: "marker";
      id: Id;
    }
  | {
      kind: "obstacle";
      id: MarkerId | null;
    };

export interface HiddenMarker<Id extends MarkerId = MarkerId> {
  id: Id;
  reason: HiddenReason;
  blockedBy?: CollisionOwner<Id>;
}

export interface PinnedOverlapWarning<Id extends MarkerId = MarkerId> {
  code: "pinned-overlap";
  ids: [Id, Id];
}

export interface LayoutDiagnostics<Id extends MarkerId = MarkerId> {
  inputCount: number;
  projectedCount: number;
  visibleCount: number;
  hiddenCount: number;
  retainedCount: number;
  changedCount: number;
  collisionChecks: number;
  pressure: number;
  density: {
    cellSize: number;
    maxPerCell: number | null;
    stage: number;
  };
  byReason: Record<HiddenReason, number>;
  pinnedOverlapCount: number;
  warnings: PinnedOverlapWarning<Id>[];
}

export interface LayoutResult<Id extends MarkerId = MarkerId> {
  visible: VisibleMarker<Id>[];
  hidden: HiddenMarker<Id>[];
  state: LayoutState<Id>;
  diagnostics: LayoutDiagnostics<Id>;
}

export const DEFAULT_DENSITY_POLICY: Readonly<{
  cellSize: 128;
  stops: readonly [
    Readonly<{ minPressure: 0; maxPerCell: null }>,
    Readonly<{ minPressure: 0.35; maxPerCell: 4 }>,
    Readonly<{ minPressure: 0.7; maxPerCell: 2 }>,
    Readonly<{ minPressure: 0.9; maxPerCell: 1 }>,
  ];
}>;

export function layoutMarkers<Id extends MarkerId>(
  frame: LayoutFrame<Id>,
  options?: LayoutOptions,
): LayoutResult<Id>;

export function updateMarkerLayout<Id extends MarkerId>(
  previousState: LayoutState<Id> | null | undefined,
  frame: LayoutFrame<Id>,
  options?: LayoutOptions,
): LayoutResult<Id>;

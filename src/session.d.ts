import type {
  LayoutFrame,
  LayoutOptions,
  LayoutResult,
  LayoutState,
  MarkerId,
} from "./layout.js";

export interface MarkerLayoutSession<Id extends MarkerId = MarkerId> {
  update(frame: LayoutFrame<Id>): LayoutResult<Id>;
  reset(): void;
  snapshot(): LayoutState<Id> | null;
}

export function createMarkerLayout<Id extends MarkerId = MarkerId>(
  options?: LayoutOptions,
): MarkerLayoutSession<Id>;

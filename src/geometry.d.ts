export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BoxIndex<Value = unknown> {
  readonly size: number;
  add(box: Box, value: Value): void;
  allCollisions(candidate: Box): Array<{ box: Box; value: Value }>;
  firstCollision(candidate: Box): { box: Box; value: Value } | null;
  search(candidate: Box): Value[];
  collides(candidate: Box): boolean;
  clear(): void;
}

export function boxesIntersect(a: Box, b: Box): boolean;
export function expandBox(box: Box, padding?: number): Box;
export function intersectBoxes(a: Box, b: Box): Box | null;
export function unionBoxes(boxes: readonly Box[]): Box | null;
export function createBoxIndex<Value = unknown>(options?: {
  cellSize?: number;
}): BoxIndex<Value>;

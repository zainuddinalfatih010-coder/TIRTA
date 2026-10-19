import type { Point } from "../domain/model";

export interface RulerTick {
  value: number;
  kind: "major" | "half" | "minor";
  label: string | null;
}

export function constrainDelta(delta: Point, axisLock: boolean, snap: boolean): Point {
  let next = { ...delta };
  if (axisLock) {
    const horizontal = Math.abs(delta.x) >= Math.abs(delta.y);
    next = horizontal ? { x: delta.x, y: 0 } : { x: 0, y: delta.y };
  }
  if (!snap) return next;
  return {
    x: next.x === 0 ? 0 : Math.round(next.x * 2) / 2,
    y: next.y === 0 ? 0 : Math.round(next.y * 2) / 2,
  };
}

export function constrainPoint(origin: Point | undefined, point: Point, axisLock: boolean, snap: boolean): Point {
  if (!axisLock || !origin) return snap ? { x: Math.round(point.x * 2) / 2, y: Math.round(point.y * 2) / 2 } : point;
  const horizontal = Math.abs(point.x - origin.x) >= Math.abs(point.y - origin.y);
  return horizontal
    ? { x: snap ? Math.round(point.x * 2) / 2 : point.x, y: origin.y }
    : { x: origin.x, y: snap ? Math.round(point.y * 2) / 2 : point.y };
}

/** Tick positions are metres in the same local coordinate space as Studio geometry. */
export function rulerTicks(length: number, pixelsPerMeter: number): RulerTick[] {
  if (!Number.isFinite(length) || length <= 0) return [];
  const minorStep = pixelsPerMeter >= 34 ? 0.1 : pixelsPerMeter >= 13 ? 0.5 : 1;
  const labelEvery = Math.max(1, Math.ceil(34 / Math.max(1, pixelsPerMeter)));
  const count = Math.floor(length / minorStep + 1e-8);
  const values = new Set<number>([0, length]);
  for (let i = 1; i < count; i++) values.add(Number((i * minorStep).toFixed(6)));
  const ticks: RulerTick[] = [...values].sort((a, b) => a - b).map(value => {
    const major = Math.abs(value - Math.round(value)) < 1e-6;
    const half = !major && Math.abs(value * 2 - Math.round(value * 2)) < 1e-6;
    const atEnd = Math.abs(value - length) < 1e-6;
    const label = value === 0 ? "0" : atEnd ? `${formatMeter(value)} m` : major && Math.round(value) % labelEvery === 0 ? formatMeter(value) : null;
    return { value, kind: major ? "major" : half ? "half" : "minor", label };
  });
  const endTick = ticks.at(-1);
  const priorLabel = ticks.slice(0, -1).reverse().find(tick => tick.label !== null);
  if (endTick?.label && priorLabel && (endTick.value - priorLabel.value) * pixelsPerMeter < 50) priorLabel.label = null;
  return ticks;
}

export function formatMeter(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

export function segmentLength(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function rectangleDimensions(from: Point, to: Point) {
  const width = Math.abs(to.x - from.x);
  const height = Math.abs(to.y - from.y);
  return { width, height, area: width * height };
}

export function isAxisAlignedRectangle(points: Point[]): boolean {
  if (points.length !== 4) return false;
  const bounds = {
    minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)), maxY: Math.max(...points.map(point => point.y)),
  };
  if (bounds.maxX - bounds.minX <= 0 || bounds.maxY - bounds.minY <= 0) return false;
  const corners = new Set(points.map(point => `${point.x === bounds.minX ? 0 : 1}:${point.y === bounds.minY ? 0 : 1}`));
  return corners.size === 4 && points.every((point, index) => {
    const next = points[(index + 1) % points.length]!;
    return point.x === next.x || point.y === next.y;
  });
}

export function adjacentEdgeLength(points: Point[], index: number): number | null {
  if (points.length < 3 || index < 0 || index >= points.length) return null;
  return segmentLength(points[(index + points.length - 1) % points.length]!, points[index]!);
}

export function activeVertexDimensions(points: Point[], index: number) {
  if (isAxisAlignedRectangle(points)) {
    const { width, height, area } = rectangleDimensions(
      { x: Math.min(...points.map(point => point.x)), y: Math.min(...points.map(point => point.y)) },
      { x: Math.max(...points.map(point => point.x)), y: Math.max(...points.map(point => point.y)) },
    );
    return { kind: "rectangle" as const, width, height, area };
  }
  const length = adjacentEdgeLength(points, index);
  return length === null ? null : { kind: "edge" as const, length };
}

export interface ZoneDimension {
  index: number;
  from: Point;
  to: Point;
  length: number;
  reflexAdjacent: boolean;
}

/** Pick a few real edges, favoring long outer edges and the edges around an L-shaped notch. */
export function selectedZoneDimensions(points: Point[], pixelsPerMeter: number, maxLabels = 4): ZoneDimension[] {
  if (points.length < 3) return [];
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const area = points.reduce((sum, p, i) => sum + p.x * points[(i + 1) % points.length]!.y - points[(i + 1) % points.length]!.x * p.y, 0);
  const orientation = Math.sign(area) || 1;
  const reflex = points.map((p, i) => cross(points[(i + points.length - 1) % points.length]!, p, points[(i + 1) % points.length]!) * orientation < -1e-8);
  const edges = points.map((from, index) => {
    const to = points[(index + 1) % points.length]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const axisAligned = Math.abs(from.x - to.x) < 1e-6 || Math.abs(from.y - to.y) < 1e-6;
    const reflexAdjacent = reflex[index]! || reflex[(index + 1) % points.length]!;
    return { index, from, to, length, reflexAdjacent, axisAligned };
  }).filter(edge => edge.length * pixelsPerMeter >= 42);
  const ranked = edges.sort((a, b) => Number(b.reflexAdjacent) - Number(a.reflexAdjacent) || Number(b.axisAligned) - Number(a.axisAligned) || b.length - a.length);
  const picked: typeof ranked = [];
  for (const edge of ranked) {
    const mid = midpoint(edge.from, edge.to);
    if (picked.some(other => {
      const otherMid = midpoint(other.from, other.to);
      const width = Math.max(39, (formatMeter(edge.length).length + 2) * 7 + 12);
      const otherWidth = Math.max(39, (formatMeter(other.length).length + 2) * 7 + 12);
      return Math.abs((mid.x - otherMid.x) * pixelsPerMeter) < (width + otherWidth) / 2 + 6
        && Math.abs((mid.y - otherMid.y) * pixelsPerMeter) < 20;
    })) continue;
    picked.push(edge);
    if (picked.length >= maxLabels) break;
  }
  return picked.map(edge => ({ index: edge.index, from: edge.from, to: edge.to, length: edge.length, reflexAdjacent: edge.reflexAdjacent }));
}

function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

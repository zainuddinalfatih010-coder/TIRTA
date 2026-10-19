import type { Point } from "./model";

type IPoint = { x: bigint; y: bigint };
const integer = (p: Point): IPoint => ({
  x: BigInt(Math.round(p.x * 1000)),
  y: BigInt(Math.round(p.y * 1000)),
});
const cross = (a: IPoint, b: IPoint, c: IPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const between = (n: bigint, a: bigint, b: bigint) =>
  n >= (a < b ? a : b) && n <= (a > b ? a : b);
const onSegment = (p: IPoint, a: IPoint, b: IPoint) =>
  cross(a, b, p) === 0n && between(p.x, a.x, b.x) && between(p.y, a.y, b.y);
function intersects(a: IPoint, b: IPoint, c: IPoint, d: IPoint) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    u = cross(c, d, a),
    v = cross(c, d, b);
  return (
    (((x < 0n && y > 0n) || (x > 0n && y < 0n)) &&
      ((u < 0n && v > 0n) || (u > 0n && v < 0n))) ||
    onSegment(a, c, d) ||
    onSegment(b, c, d) ||
    onSegment(c, a, b) ||
    onSegment(d, a, b)
  );
}
function inside(p: IPoint, polygon: IPoint[], boundary = true): boolean {
  let hit = false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!,
      b = polygon[(i + 1) % polygon.length]!;
    if (onSegment(p, a, b)) return boundary;
    if (a.y > p.y !== b.y > p.y) {
      const side = cross(a, b, p);
      if ((b.y > a.y && side > 0n) || (b.y < a.y && side < 0n)) hit = !hit;
    }
  }
  return hit;
}
const area2 = (p: IPoint[]) =>
  p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length]!;
    return sum + a.x * b.y - a.y * b.x;
  }, 0n);

/** Area in drawing units². TIRTA's calibrated Studio uses one drawing unit = one metre. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let doubled = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    doubled += a.x * b.y - a.y * b.x;
  }
  return Math.abs(doubled) / 2;
}

/** Integer predicates operate on the declared 0.001 drawing-unit grid, never metres. */
export function validatePolygon(points: Point[]): string[] {
  if (points.length < 3 || points.length > 100) return ["vertex_count"];
  if (
    points.some((p) =>
      [p.x, p.y].some(
        (n) =>
          !Number.isFinite(n) ||
          Math.abs(n) > 1e6 ||
          Math.abs(n * 1000 - Math.round(n * 1000)) > 1e-7,
      ),
    )
  )
    return ["drawing_coordinate"];
  const p = points.map(integer);
  if (new Set(p.map((v) => `${v.x},${v.y}`)).size !== p.length)
    return ["duplicate_vertex"];
  const a = area2(p);
  if ((a < 0n ? -a : a) < 20000n) return ["degenerate_polygon"];
  for (let i = 0; i < p.length; i++) {
    const previous = p[(i + p.length - 1) % p.length]!,
      current = p[i]!,
      next = p[(i + 1) % p.length]!;
    if (
      cross(previous, current, next) === 0n &&
      !onSegment(current, previous, next)
    )
      return ["self_touch"];
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      if (intersects(current, next, p[j]!, p[(j + 1) % p.length]!))
        return ["self_intersection"];
    }
  }
  return [];
}
export function containsPoint(boundary: Point[], point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && !validatePolygon(boundary).length && inside(integer(point), boundary.map(integer));
}
export function containsPolygon(boundary: Point[], child: Point[]): boolean {
  if (validatePolygon(boundary).length || validatePolygon(child).length)
    return false;
  const b = boundary.map(integer),
    p = child.map(integer);
  if (p.some((v) => !inside(v, b))) return false;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!,
      c = p[(i + 1) % p.length]!;
    for (let j = 0; j < b.length; j++) {
      const d = b[j]!,
        e = b[(j + 1) % b.length]!;
      const x = cross(a, c, d),
        y = cross(a, c, e),
        u = cross(d, e, a),
        v = cross(d, e, c);
      if (
        ((x < 0n && y > 0n) || (x > 0n && y < 0n)) &&
        ((u < 0n && v > 0n) || (u > 0n && v < 0n))
      )
        return false;
    }
    // Split at boundary vertices as a segment can leave a concavity through a vertex.
    const cuts = [a, c, ...b.filter((v) => onSegment(v, a, c))].sort((u, v) =>
      a.x !== c.x
        ? u.x < v.x
          ? -1
          : u.x > v.x
            ? 1
            : 0
        : u.y < v.y
          ? -1
          : u.y > v.y
            ? 1
            : 0,
    );
    const doubled = b.map((v) => ({ x: v.x * 2n, y: v.y * 2n }));
    for (let j = 1; j < cuts.length; j++)
      if (
        !inside(
          { x: cuts[j - 1]!.x + cuts[j]!.x, y: cuts[j - 1]!.y + cuts[j]!.y },
          doubled,
        )
      )
        return false;
  }
  return true;
}
function triangles(input: IPoint[]): IPoint[][] {
  const p = area2(input) < 0n ? [...input].reverse() : [...input],
    out: IPoint[][] = [];
  // Remove straight intermediate vertices before ear clipping.
  for (let i = p.length - 1; i >= 0; i--)
    if (
      cross(
        p[(i + p.length - 1) % p.length]!,
        p[i]!,
        p[(i + 1) % p.length]!,
      ) === 0n
    )
      p.splice(i, 1);
  while (p.length > 3) {
    let found = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length]!,
        b = p[i]!,
        c = p[(i + 1) % p.length]!;
      if (
        cross(a, b, c) <= 0n ||
        p.some((v) => v !== a && v !== b && v !== c && inside(v, [a, b, c]))
      )
        continue;
      out.push([a, b, c]);
      p.splice(i, 1);
      found = true;
      break;
    }
    if (!found) throw new Error("Invalid triangulation");
  }
  out.push(p);
  return out;
}
function triangleOverlap(a: IPoint[], b: IPoint[]): boolean {
  for (const p of [a, b])
    for (let i = 0; i < 3; i++) {
      const start = p[i]!,
        end = p[(i + 1) % 3]!,
        nx = -(end.y - start.y),
        ny = end.x - start.x;
      const ap = a.map((v) => v.x * nx + v.y * ny),
        bp = b.map((v) => v.x * nx + v.y * ny);
      const min = (v: bigint[]) => v.reduce((x, y) => (x < y ? x : y)),
        max = (v: bigint[]) => v.reduce((x, y) => (x > y ? x : y));
      if (max(ap) <= min(bp) || max(bp) <= min(ap)) return false;
    }
  return true;
}
export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  if (validatePolygon(a).length || validatePolygon(b).length) return false;
  return triangles(a.map(integer)).some((x) =>
    triangles(b.map(integer)).some((y) => triangleOverlap(x, y)),
  );
}

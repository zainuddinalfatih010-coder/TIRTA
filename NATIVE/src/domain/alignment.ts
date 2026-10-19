import type { Point } from "./model";
export type AlignmentGuide = { axis: "x" | "y"; value: number; label: string };
export function alignPoint(
  point: Point,
  anchors: Point[],
  tolerance: number,
  lockedOrigin?: Point,
): { point: Point; guides: AlignmentGuide[] } {
  const result = { ...point };
  const guides: AlignmentGuide[] = [];
  if (lockedOrigin) {
    const axis =
      Math.abs(point.x - lockedOrigin.x) >= Math.abs(point.y - lockedOrigin.y)
        ? "y"
        : "x";
    result[axis] = lockedOrigin[axis];
    guides.push({
      axis,
      value: result[axis],
      label: axis === "x" ? "Sumbu vertikal" : "Sumbu horizontal",
    });
  }
  for (const axis of ["x", "y"] as const) {
    if (guides.some((g) => g.axis === axis)) continue;
    const nearest = anchors.reduce<Point | null>(
      (best, p) =>
        Math.abs(p[axis] - point[axis]) <= tolerance &&
        (!best ||
          Math.abs(p[axis] - point[axis]) < Math.abs(best[axis] - point[axis]))
          ? p
          : best,
      null,
    );
    if (nearest) {
      result[axis] = nearest[axis];
      guides.push({
        axis,
        value: nearest[axis],
        label: axis === "x" ? "Sejajar vertikal" : "Sejajar horizontal",
      });
    }
  }
  return { point: result, guides };
}

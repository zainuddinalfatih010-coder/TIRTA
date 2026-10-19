import { describe, it, expect } from "vitest";
import { validatePolygon, containsPolygon, polygonsOverlap } from "./geometry";
const box = (x = 0, y = 0, w = 10, h = 10) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
describe("schematic geometry boundary", () => {
  it("accepts exact boundary and adjacent zones without claiming overlap", () => {
    expect(validatePolygon(box())).toEqual([]);
    expect(containsPolygon(box(), box())).toBe(true);
    expect(polygonsOverlap(box(), box(10))).toBe(false);
    expect(polygonsOverlap(box(), box(9))).toBe(true);
    expect(polygonsOverlap(box(), box())).toBe(true);
  });
  it("rejects crossed, duplicate, collinear, tiny and unquantized geometry", () => {
    for (const p of [
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
      [...box(), { x: 0, y: 0 }],
      box(0, 0, 0, 10),
      box(0, 0, 0.001, 0.001),
      box(0.0001),
    ])
      expect(validatePolygon(p).length).toBeGreaterThan(0);
  });
  it("rejects concave edge excursions even with all vertices inside", () => {
    const u = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 7, y: 10 },
      { x: 7, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(
      containsPolygon(u, [
        { x: 1, y: 8 },
        { x: 9, y: 8 },
        { x: 5, y: 1 },
      ]),
    ).toBe(false);
    expect(containsPolygon(u, box(0, 0, 3, 3))).toBe(true);
    expect(containsPolygon(box(), box(-1))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { activeVertexDimensions, constrainDelta, constrainPoint, formatMeter, rectangleDimensions, rulerTicks, selectedZoneDimensions, segmentLength } from "./studioMeasurements";

describe("Studio metre rulers", () => {
  it("uses declared 10 x 10 and 15 x 10 metre extents and adaptive ticks", () => {
    const ten = rulerTicks(10, 50);
    expect(ten.at(-1)).toMatchObject({ value: 10, label: "10 m" });
    expect(ten.some(tick => tick.value === 0.5 && tick.kind === "half")).toBe(true);
    expect(ten.some(tick => tick.value === 0.1 && tick.kind === "minor")).toBe(true);
    const fifteen = rulerTicks(15, 43);
    expect(fifteen.at(-1)).toMatchObject({ value: 15, label: "15 m" });
    expect(rulerTicks(15, 20).find(tick => tick.value === 14)?.label).toBeNull();
    expect(rulerTicks(10, 8).some(tick => tick.kind === "minor")).toBe(false);
  });

  it("updates its endpoint when declared parcel dimensions change", () => {
    expect(rulerTicks(10, 50).at(-1)?.label).toBe("10 m");
    expect(rulerTicks(15, 43).at(-1)?.label).toBe("15 m");
  });
});

describe("selected zone dimensions", () => {
  it("reports rectangle edge lengths from metre coordinates", () => {
    const dimensions = selectedZoneDimensions([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], 50);
    expect(dimensions.map(edge => edge.length).sort()).toEqual([3, 3, 4, 4]);
  });

  it("prioritizes the real L-shape notch edges without emitting every small segment", () => {
    const dimensions = selectedZoneDimensions([
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 },
      { x: 2, y: 5 }, { x: 0, y: 5 },
    ], 50);
    expect(dimensions.length).toBeLessThanOrEqual(4);
    expect(dimensions.some(edge => edge.reflexAdjacent)).toBe(true);
    expect(dimensions.every(edge => edge.length > 0)).toBe(true);
  });

  it("supports irregular polygons and suppresses tiny edge labels", () => {
    const dimensions = selectedZoneDimensions([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4.2, y: 0.2 }, { x: 2, y: 3 }, { x: 0, y: 2 }], 50);
    expect(dimensions.length).toBeGreaterThan(0);
    expect(dimensions.length).toBeLessThanOrEqual(4);
    expect(dimensions.every(edge => edge.length * 50 >= 42)).toBe(true);
  });
});

describe("meter movement aids", () => {
  it("keeps free movement and existing half-metre snapping distinct", () => {
    expect(constrainDelta({ x: 3.36, y: 0.18 }, false, false)).toEqual({ x: 3.36, y: 0.18 });
    expect(constrainDelta({ x: 3.36, y: 0.18 }, false, true)).toEqual({ x: 3.5, y: 0 });
  });

  it("locks to the dominant axis and snaps only the moving axis", () => {
    expect(constrainDelta({ x: 3.36, y: 0.18 }, true, true)).toEqual({ x: 3.5, y: 0 });
    expect(constrainPoint({ x: 4, y: 3 }, { x: 7.36, y: 3.18 }, true, true)).toEqual({ x: 7.5, y: 3 });
    expect(constrainPoint({ x: 4, y: 3 }, { x: 4.18, y: 0.36 }, true, true)).toEqual({ x: 4, y: 0.5 });
  });

  it("preserves a temporary Shift lock when the persistent lock is off", () => {
    expect(constrainPoint({ x: 4, y: 3 }, { x: 7.36, y: 3.18 }, true, false)).toEqual({ x: 7.36, y: 3 });
  });
});

describe("live Studio dimensions", () => {
  it("formats useful metre precision and measures a constrained segment from model coordinates", () => {
    expect(formatMeter(6)).toBe("6");
    expect(formatMeter(6.428)).toBe("6,4");
    expect(segmentLength({ x: 2, y: 2 }, { x: 5, y: 6 })).toBe(5);
  });

  it("derives rectangle dimensions and area, and keeps a single relevant edge for irregular edits", () => {
    expect(rectangleDimensions({ x: 2, y: 2 }, { x: 12, y: 10 })).toEqual({ width: 10, height: 8, area: 80 });
    expect(activeVertexDimensions([
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 5 }, { x: 0, y: 5 },
    ], 2)).toEqual({ kind: "edge", length: 2 });
  });
});

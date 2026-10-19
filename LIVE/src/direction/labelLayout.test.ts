import { expect, test } from "vitest";
import { visualLabelWidth } from "./labelLayout";

test("upright label width respects its full height and concave boundaries", () => {
  const square = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
  expect(visualLabelWidth(square, { x: 100, y: 50 }, 15)).toBe(200);
  expect(visualLabelWidth(square, { x: 100, y: 5 }, 15)).toBe(0);
  const cutout = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 40 }, { x: 70, y: 40 }, { x: 70, y: 100 }, { x: 0, y: 100 }];
  expect(visualLabelWidth(cutout, { x: 35, y: 40 }, 15)).toBe(70);
});

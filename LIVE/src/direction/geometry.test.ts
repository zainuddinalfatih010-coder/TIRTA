import { expect, it } from "vitest";
import { dimensionParcel, restoreParcelGeometry } from "./parcelTransactions";
import { createProjectV2 } from "../domain/projectV2";
import { addShape, reshape } from "../domain/authoring";
import { writeParameter } from "../domain/planningAuthoring";
it("geometry undo keeps later engineering data and rejects invalid dimensions", () => {
  const empty = createProjectV2("test", "Test", "2026-09-21T00:00:00.000Z");
  expect(() => dimensionParcel(empty, "21", "10")).toThrow(/200/);
  expect(() => dimensionParcel(empty, "", "10")).toThrow();
  const p = dimensionParcel(empty, "15", "10");
  const original = addShape(p, "zone", [{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:0,y:5}]);
  const changed = reshape(original, "zone", [{x:0,y:0},{x:6,y:0},{x:6,y:5},{x:0,y:5}]);
  changed.zones[0]!.coefficient = writeParameter(changed, changed.zones[0]!.coefficient.id, "ratio", {text:"0.6",evidence:"USER_INPUT",source:"User observation"});
  const restored = restoreParcelGeometry(changed, original);
  expect(restored.zones[0]!.polygon).toEqual(original.zones[0]!.polygon);
  expect(restored.parameters.find(p => p.id === restored.zones[0]!.coefficient.id)?.value).toBe(.6);
  expect(restored.parameters.find(p => p.id === restored.zones[0]!.area.id)?.value).toBe(25);
});

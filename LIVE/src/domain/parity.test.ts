import { expect, it } from "vitest";
import { alignPoint } from "./alignment";
import { enforceAreaEdit, parcelScopeIssue } from "./parcelPolicy";
import { productionFixture } from "../test/productionFixtures";
it("aligns only a proposed point within tolerance or explicit axis lock", () => {
  const pointer = { x: 38, y: 19 };
  expect(alignPoint(pointer, [{ x: 0, y: 20 }], 2).point).toEqual({
    x: 38,
    y: 20,
  });
  expect(pointer).toEqual({ x: 38, y: 19 });
  expect(alignPoint(pointer, [{ x: 0, y: 40 }], 2).point).toEqual(pointer);
  expect(alignPoint(pointer, [], 2, { x: 0, y: 0 }).point).toEqual({
    x: 38,
    y: 0,
  });
});
it("keeps legacy oversize projects recoverable but rejects new area above 200 including zone totals", () => {
  const p = productionFixture();
  expect(parcelScopeIssue(p)).toContain("200");
  expect(() => enforceAreaEdit(p, p)).not.toThrow();
  const q = structuredClone(p);
  q.parameters.find((v) => v.id === q.parcel!.area.id)!.value = 200;
  expect(() => enforceAreaEdit(p, q)).not.toThrow();
  const r = structuredClone(q);
  r.parameters.find((v) => v.id === r.parcel!.area.id)!.value = 200.001;
  expect(() => enforceAreaEdit(q, r)).toThrow("200");
});

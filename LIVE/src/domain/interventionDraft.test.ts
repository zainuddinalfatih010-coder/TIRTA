import { expect, it } from "vitest";
import { demoProject, componentEditorValues, setActiveComponents, alternativeSearch } from "../direction/productionBridge";
import { emptyInput, saveComponent } from "./planningAuthoring";

it("rejects multiple porous targets with a plain instruction and leaves the project intact", () => {
  const p = demoProject(), before = structuredClone(p), sid = p.scenarios[0]!.id;
  const v = componentEditorValues(p, "porous", sid)!;
  expect(() => saveComponent(p, { id: "porous", name: v.component.name, family: "permeable", targets: p.zones.slice(0, 2).map(z => z.id), siteId: "", connection: "", applicability: "", cost: v.cost, area: emptyInput(), capacity: emptyInput(), scenarioId: sid, reuse: null })).toThrow("Pilih satu zona yang ingin diganti menjadi permukaan berpori.");
  expect(p).toEqual(before);
});

it("can save an unknown porous draft and defer it without blocking complete options", () => {
  const p = demoProject(), sid = p.scenarios[0]!.id;
  const v = componentEditorValues(p, "porous", sid)!;
  const saved = saveComponent(p, { id: "porous", name: v.component.name, family: "permeable", targets: [p.zones[1]!.id], siteId: "", connection: "", applicability: "", cost: emptyInput(), area: emptyInput(), capacity: emptyInput(), scenarioId: sid, reuse: null });
  expect(componentEditorValues(saved, "porous", sid)!.area.text).toBe("");
  const deferred = setActiveComponents(saved, ["tank"]);
  expect(deferred.components.find(c => c.id === "porous")?.enabled).toBe(false);
  expect(alternativeSearch(deferred, sid).rows.length).toBeGreaterThan(0);
  expect(componentEditorValues(setActiveComponents(deferred, ["tank", "porous"]), "porous", sid)!.capacity.text).toBe("");
});

import type { Project, Parameter } from "../domain/model";
import { emptyProject, ref } from "../domain/model";
/** Independent legacy import fixture: 100 m² × 50 mm × 0.8 = 4 m³. */
export function legacyFixture(): Project {
  const known = (
    id: string,
    value: number,
    unit: Parameter["unit"],
  ): Parameter => ({
    id,
    value,
    unit,
    evidence: "ASSUMPTION",
    source: "Hand-checked legacy fixture",
    note: "",
  });
  const area = known("area", 100, "m2"),
    rain = known("rain", 50, "mm"),
    c = known("c", 0.8, "ratio");
  const polygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  return {
    ...emptyProject("golden", "Uji tangan"),
    parameters: [area, rain, c],
    parcel: { area: ref(area), polygon },
    zones: [
      {
        id: "roof",
        name: "Atap uji",
        surface: "roof",
        polygon,
        area: ref(area),
        coefficient: ref(c),
      },
    ],
    scenarios: [{ id: "event", name: "Hujan uji", rainfall: ref(rain) }],
  };
}

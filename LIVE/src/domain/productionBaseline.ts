import { baselineV2 } from "./scenario";
import { MAX_PARCEL_AREA_M2, parcelScopeIssue } from "./parcelPolicy";
import type { ProjectV2 } from "./projectV2";
import type { Outcome } from "./model";
import type { Baseline } from "./baseline";

export function productionBaseline(
  p: ProjectV2,
  scenarioId: string,
): Outcome<Baseline> {
  const scope = parcelScopeIssue(p);
  if (scope)
    return {
      ok: false,
      issues: [{ code: "parcel_scope", path: "parcel.area", message: scope }],
    };
  const result = baselineV2(p, scenarioId);
  if (result.ok && result.value.areaM2 > MAX_PARCEL_AREA_M2)
    return {
      ok: false,
      issues: [
        {
          code: "parcel_scope",
          path: "parcel.area",
          message: "Luas pada skenario ini melebihi batas 200 m².",
        },
      ],
    };
  return result;
}

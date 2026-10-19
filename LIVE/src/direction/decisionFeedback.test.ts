import { describe, expect, it } from "vitest";
import { demoProject } from "./productionBridge";
import { decisionInterpretation, decisionVerificationItems } from "./decisionFeedback";

describe("final decision feedback", () => {
  it("states handled volume as baseline minus residual and avoids a zero-baseline percentage", () => {
    expect(decisionInterpretation(7.2, 4.2)).toEqual({ handled: 3, share: 3 / 7.2 });
    expect(decisionInterpretation(0, 0)).toEqual({ handled: 0, share: null });
  });

  it("shows only verification notes backed by declared project assumptions", () => {
    const project = demoProject(true);
    const scenario = project.scenarios[0]!;
    const rain = project.parameters.find((parameter) => parameter.id === scenario.rainfall.id)!;
    rain.evidence = "ASSUMPTION";
    scenario.rainfall.evidence = "ASSUMPTION";
    const coefficientRef = project.zones[0]!.coefficient;
    const coefficient = project.parameters.find((parameter) => parameter.id === coefficientRef.id)!;
    coefficient.evidence = "ASSUMPTION";
    coefficientRef.evidence = "ASSUMPTION";
    const before = decisionVerificationItems(project, scenario.id, []);
    expect(before).toContain("Skenario hujan adalah angka uji yang ditentukan pengguna, bukan prediksi cuaca.");
    expect(before).toContain(`${project.zones[0]!.name}: koefisien limpasan berasal dari asumsi pengguna.`);
    expect(decisionVerificationItems(demoProject(true), scenario.id, [])).toEqual([]);
  });
});

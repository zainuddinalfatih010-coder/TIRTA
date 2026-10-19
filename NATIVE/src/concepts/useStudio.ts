import { useState } from "react";
import { calculateBaseline } from "../domain/baseline";
import type { Surface } from "../domain/model";
import { conceptProject, setCoefficient, type OptionId } from "./data";

export function useStudio() {
  const [project, setProject] = useState(conceptProject);
  const [selected, select] = useState("z3");
  const [scenario, setScenario] = useState("r50");
  const [options, setOptions] = useState<OptionId[]>(["tank"]);
  const [step, setStep] = useState(0);
  const [overlay, setOverlay] = useState(false);
  const zone =
    project.zones.find((z) => z.id === selected) ?? project.zones[0]!;
  const coefficient = project.parameters.find(
    (p) => p.id === zone.coefficient.id,
  )!;
  const baseline = calculateBaseline(project, scenario);
  const missing = project.zones.filter(
    (z) =>
      project.parameters.find((p) => p.id === z.coefficient.id)?.value === null,
  );
  return {
    project,
    setProject,
    selected,
    select,
    scenario,
    setScenario,
    options,
    setOptions,
    step,
    setStep,
    overlay,
    setOverlay,
    zone,
    coefficient,
    baseline,
    missing,
    changeCoefficient: (value: number | null) =>
      setProject((p) => setCoefficient(p, selected, value)),
    changeSurface: (surface: Surface) =>
      setProject((p) => ({
        ...p,
        zones: p.zones.map((z) => (z.id === selected ? { ...z, surface } : z)),
      })),
    resolve: () => setProject((p) => {
      const target=missing[0];
      return target?setCoefficient(p,target.id,[.9,.8,.2,.3,.4][Number(target.id.slice(1))]??null):p;
    }),
    toggleOption: (id: OptionId) =>
      setOptions((o) =>
        o.includes(id) ? o.filter((x) => x !== id) : [...o, id],
      ),
  };
}
export type Studio = ReturnType<typeof useStudio>;

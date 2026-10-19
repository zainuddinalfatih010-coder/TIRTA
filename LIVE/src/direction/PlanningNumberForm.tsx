import { createContext, useContext, useState, type ComponentProps } from "react";
import { numberChange, rupiahCanonical, rupiahText } from "./planningNumbers";

type Field = { name: string; label: string; unit: string; initial: string };
type Drafts = { values: Record<string, string>; setValue: (name: string, value: string) => void; fields: Field[] };
const DraftContext = createContext<Drafts | null>(null);

export function usePlanningNumbers() {
  const drafts = useContext(DraftContext);
  if (!drafts) throw new Error("Planning fields require PlanningNumberForm");
  return drafts;
}

export function PlanningNumberForm({ fields, ...props }: ComponentProps<"form"> & { fields: Field[] }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.name, f.unit === "Rp" ? rupiahText(f.initial) : f.initial])));
  const setValue = (name: string, value: string) => setValues(previous => ({ ...previous, [name]: value }));
  return <DraftContext.Provider value={{ values, setValue, fields }}><form {...props} /></DraftContext.Provider>;
}

export function NumberChangeSummary({ scope }: { scope: string }) {
  const { fields, values } = usePlanningNumbers();
  const changes = fields.filter(f => f.name !== "reuse").flatMap(f => {
    const text = values[f.name] ?? "";
    const change = numberChange(f.initial, f.unit === "Rp" ? rupiahCanonical(text) : text, f.unit);
    return change ? [{ ...change, name: f.name, label: f.label }] : [];
  });
  return <section className="number-change-summary" aria-label={`Ringkasan perubahan ${scope}`}>
    <strong>Perubahan angka utama · {scope}</strong>
    {changes.length ? <dl>{changes.map(c => <div key={c.name} data-change={c.name}>
      <dt>{c.label}</dt><dd><span>{c.before && <><span className="change-before">{c.before}</span><span aria-label="menjadi"> → </span></>}{c.after}</span><b>{c.delta}</b></dd>
    </div>)}</dl> : <p>Angka tetap sama pada {fields.filter(f => f.name !== "reuse").map(f => f.label.toLowerCase()).join(", ")}. Sumber dan pengaturan tetap akan diterapkan.</p>}
    {changes.length > 0 && <small>Belum disimpan. Diterapkan saat Anda menekan tombol di bawah.</small>}
  </section>;
}

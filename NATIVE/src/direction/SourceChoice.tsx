import { useState } from "react";
import type { SourcedInput } from "../domain/planningAuthoring";

export const sourceChoices = {
  cost: ["Asumsi pribadi", "Survei harga / riset", "Penawaran penyedia"],
  budget: ["Asumsi pribadi", "Alokasi anggaran", "Survei / riset biaya"],
  area: ["Asumsi pribadi", "Pengukuran lapangan", "Denah / dokumen"],
  capacity: ["Asumsi pribadi", "Pengukuran / pengujian", "Spesifikasi / riset"],
} as const;

export function SourceChoice({ name, label, initial, choices, invalid = false }: {
  name: string; label: string; initial: SourcedInput; choices: readonly string[]; invalid?: boolean;
}) {
  const match = choices.find(choice => initial.source === choice || initial.source.startsWith(`${choice} · `));
  const [choice, setChoice] = useState(match ?? "");
  const [note, setNote] = useState(match ? initial.source.slice(match.length).replace(/^ · /, "") : initial.source);
  const source = [choice, note.trim()].filter(Boolean).join(" · ");
  const evidence = source === initial.source ? initial.evidence : choice === "Asumsi pribadi" ? "ASSUMPTION" : "USER_INPUT";
  return <div className="source-choice">
    <label>Dasar angka<select aria-label={label} value={choice} onChange={e => setChoice(e.target.value)} aria-invalid={invalid && !source || undefined}>
      <option value="" disabled>{note && !choice ? "Sumber tersimpan" : "Pilih dasar angka"}</option>
      {choices.map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>
    <input type="hidden" name={`${name}Source`} value={source} />
    <input type="hidden" name={`${name}Evidence`} value={evidence} />
    <details><summary>{note ? "Lihat / edit catatan" : "Catatan"}</summary><label>Catatan<textarea aria-label={`Catatan ${label.toLowerCase()}`} value={note} onChange={e => setNote(e.target.value)} maxLength={1800} rows={2} placeholder="Nama referensi, tautan, atau penjelasan singkat" /></label></details>
  </div>;
}

export function PlanningDeclaration({ name, label, initial, statement }: { name: string; label: string; initial: string; statement: string }) {
  const [confirmed, setConfirmed] = useState(!!initial.trim());
  const [note, setNote] = useState(initial);
  return <div className="planning-declaration">
    <label className="check-line"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{label}</label>
    <input type="hidden" name={name} value={confirmed ? note.trim() || statement : ""} />
    <details><summary>Catatan tambahan</summary><label>Catatan {label.toLowerCase()}<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={2} /></label></details>
  </div>;
}

export function ConnectionChoice({ initial, storage }: { initial: string; storage: boolean }) {
  const choices = storage ? ["Talang / pipa dari zona terpilih", "Saluran terbuka dari zona terpilih", "Pompa dari zona terpilih"] : ["Air jatuh langsung di zona terpilih", "Aliran permukaan dari zona terpilih", "Pipa / saluran dari zona terpilih"];
  const [value, setValue] = useState(initial);
  return <div className="connection-choice"><label>Rencana sambungan air<select aria-label="Rencana sambungan air" value={choices.includes(value) ? value : ""} onChange={e => setValue(e.target.value)}><option value="" disabled>{value ? "Menggunakan catatan tersimpan" : "Bagaimana air mencapai intervensi?"}</option>{choices.map(choice => <option key={choice}>{choice}</option>)}</select></label><input type="hidden" name="connection" value={value} /><details><summary>Detail sambungan</summary><label>Catatan sambungan air<textarea value={value} onChange={e => setValue(e.target.value)} maxLength={2000} rows={2} /></label></details></div>;
}

import { numericInput } from "../domain/validation";

export function rupiahText(canonical: string): string {
  if (!/^\d+(\.\d*)?$/.test(canonical)) return canonical;
  const [whole, fraction] = canonical.split(".");
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction === undefined ? "" : `,${fraction}`);
}

export function rupiahCanonical(display: string): string {
  if (!display.trim()) return "";
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(display)) return "invalid-rupiah";
  return display.replaceAll(".", "").replace(",", ".");
}

/** Used for edits to an already formatted input; pasted text is validated separately. */
export function formatRupiahEdit(text: string, caret: number) {
  if (!/^[\d.]*(?:,\d*)?$/.test(text)) return { text, caret };
  const significant = text.slice(0, caret).replaceAll(".", "").length;
  const formatted = rupiahText(text.replaceAll(".", "").replace(",", "."));
  let position = 0, seen = 0;
  while (position < formatted.length && seen < significant) {
    if (formatted[position] !== ".") seen++;
    position++;
  }
  return { text: formatted, caret: position };
}

export function numberChange(before: string, after: string, unit: string) {
  const old = numericInput(before), next = numericInput(after);
  if (!old.ok || !next.ok) return { before: "", after: "Periksa angka", delta: "Belum dapat dibandingkan" };
  if (old.value === next.value) return null;
  const show = (value: number | null) => value === null ? "Belum diketahui"
    : unit === "Rp" ? `Rp${rupiahText(String(value))}`
    : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 12 }).format(value)} ${unit}`;
  const difference = old.value === null || next.value === null ? null : next.value - old.value;
  const delta = next.value === null ? "Menjadi belum diketahui"
    : old.value === null ? "Angka baru"
    : `${difference! < 0 ? "−" : "+"}${show(Number(Math.abs(difference!).toPrecision(12)))}`;
  return { before: show(old.value), after: show(next.value), delta };
}

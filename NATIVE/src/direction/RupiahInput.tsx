import type { ComponentProps } from "react";
import { formatRupiahEdit, rupiahCanonical } from "./planningNumbers";

type Props = Omit<ComponentProps<"input">, "onChange" | "value" | "type"> & { value: string; onChange: (value: string) => void };
export function RupiahInput({ name, value, onChange, ...props }: Props) {
  const update = (input: HTMLInputElement, text: string, caret: number) => {
    const next = formatRupiahEdit(text, caret);
    onChange(next.text);
    requestAnimationFrame(() => { if (document.activeElement === input) input.setSelectionRange(next.caret, next.caret); });
  };
  return <span className="rupiah-input"><span aria-hidden="true">Rp</span>
    <input {...props} name={name} type="text" inputMode="decimal" value={value}
      onChange={e => {
        const input = e.currentTarget, event = e.nativeEvent as InputEvent;
        const caret = input.selectionStart ?? input.value.length;
        // Mobile decimal keyboards can insert a point without a physical keydown.
        if (event.data === ".") update(input, input.value.slice(0, caret - 1) + "," + input.value.slice(caret), caret);
        else if ((event.data?.length ?? 0) > 1 && rupiahCanonical(input.value) === "invalid-rupiah") onChange(input.value);
        else update(input, input.value, caret);
      }}
      onPaste={e => {
        e.preventDefault();
        const input = e.currentTarget;
        const pasted = e.clipboardData.getData("text").trim().replace(/^Rp\s*/i, "");
        const text = value.slice(0, input.selectionStart ?? 0) + pasted + value.slice(input.selectionEnd ?? value.length);
        const canonical = rupiahCanonical(text);
        if (canonical === "invalid-rupiah") onChange(text);
        else update(input, text, value.slice(0, input.selectionStart ?? 0).length + pasted.length);
      }}
      onKeyDown={e => {
        const input = e.currentTarget, start = input.selectionStart ?? 0, end = input.selectionEnd ?? start;
        // A typed decimal point becomes a comma; generated grouping dots are never user input.
        if (e.key === ".") {
          e.preventDefault(); update(input, value.slice(0, start) + "," + value.slice(end), start + 1); return;
        }
        if (start !== end) return;
        if (e.key === "Backspace" && value[start - 1] === ".") {
          e.preventDefault(); update(input, value.slice(0, start - 2) + value.slice(start), start - 2);
        } else if (e.key === "Delete" && value[start] === ".") {
          e.preventDefault(); update(input, value.slice(0, start) + value.slice(start + 2), start);
        }
      }} />
  </span>;
}

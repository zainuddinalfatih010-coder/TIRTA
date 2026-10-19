import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Search, X } from "lucide-react";
import type { ReadinessIssue } from "../domain/workflowReadiness";

export const readinessFieldSelector = (issue: ReadinessIssue) => {
  if (issue.componentId) return `[data-component="${CSS.escape(issue.componentId)}"] .option-config-trigger`;
  const fields: Record<string, string> = {
    projectName: '.new-project-form input', dimensions: '[aria-label="Panjang persil"]', geometry: '.map-toolstrip button[title="Tambah zona"]', coverage: '.parcel-coverage',
    surface: '[aria-label="Jenis permukaan"]', coefficient: '[data-focus="coefficient"]', coefficientSource: '[data-focus="coefficient"]', rainfall: '[aria-label="Kedalaman hujan"]',
    rainfallSource: '[aria-label="Sumber hujan"]', budget: '.constraint-editor [name="budget"]', land: '.constraint-editor [name="land"]', constraints: '.constraint-editor [name="budget"]', alternatives: '.alternative-grid button, .workspace h1',
  };
  return fields[issue.field];
};

type Box = { left: number; top: number; width: number; height: number };
type Props = { issues: ReadinessIssue[]; active: ReadinessIssue | null; destination: string; anchor?: HTMLElement; onSelect: (issue: ReadinessIssue) => void; onContinue: () => void; onClose: () => void };

export function ReadinessGuide({ issues, active, destination, anchor, onSelect, onContinue, onClose }: Props) {
  const panel = useRef<HTMLElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  const [layout, setLayout] = useState<{ host: HTMLElement; lens: Box | null; left: number; top: number; maxHeight: number; anchorValid: boolean } | null>(null);
  const dismiss = () => setClosing(true);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      if (panel.current?.contains(document.activeElement)) target.current?.focus({ preventScroll: true });
      onClose();
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160);
    return () => clearTimeout(timer);
  }, [closing, onClose]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog:modal")) return;
      e.preventDefault(); setClosing(true);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      if (anchor && !anchor.isConnected) { onClose(); return; }
      const modal = document.querySelector<HTMLDialogElement>("dialog:modal");
      if (modal) { setLayout(null); return; }
      const selector = active ? readinessFieldSelector(active) : undefined;
      const input = anchor?.isConnected ? anchor : (selector ? document.querySelector<HTMLElement>(selector) : null);
      target.current = input;
      const viewport = window.visualViewport;
      const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const w = (viewport?.width ?? innerWidth) / zoom, h = (viewport?.height ?? innerHeight) / zoom, ox = (viewport?.offsetLeft ?? 0) / zoom, oy = (viewport?.offsetTop ?? 0) / zoom;
      const bounds = input?.getBoundingClientRect();
      const r = bounds ? { left: bounds.left / zoom, top: bounds.top / zoom, right: bounds.right / zoom, bottom: bounds.bottom / zoom, width: bounds.width / zoom, height: bounds.height / zoom } : null;
      const visible = r && r.bottom > oy && r.top < oy + h && r.right > ox && r.left < ox + w;
      const lens = visible && issues.length ? { left: Math.max(ox + 6, r.left - 6), top: Math.max(oy + 6, r.top - 6), width: Math.min(r.width + 12, w - 12), height: r.height + 12 } : null;
      const width = Math.min(360, w - 24);
      const height = Math.min(panel.current?.offsetHeight ?? 290, h - 24);
      let left = ox + w - width - 12, top = oy + h - height - 12, maxHeight = h - 24;
      if (lens) {
        const above = lens.top - oy - 24, below = oy + h - lens.top - lens.height - 24;
        if (w >= 900 && lens.left - ox >= width + 32) {
          left = lens.left - width - 24; top = Math.max(oy + 12, Math.min(lens.top, oy + h - height - 12));
        } else if (w >= 900 && ox + w - lens.left - lens.width >= width + 32) {
          left = lens.left + lens.width + 24; top = Math.max(oy + 12, Math.min(lens.top, oy + h - height - 12));
        } else {
          left = Math.max(ox + 12, Math.min(lens.left, ox + w - width - 12));
          if (above > below) { maxHeight = Math.max(100, above); top = Math.max(oy + 12, lens.top - Math.min(height, maxHeight) - 18); }
          else { maxHeight = Math.max(100, below); top = lens.top + lens.height + 18; }
        }
      }
      setLayout(previous => {
        const next = { host: document.body, lens, left, top, maxHeight, anchorValid: !!anchor?.matches(":valid") };
        return previous && previous.host === next.host && JSON.stringify({ ...previous, host: null }) === JSON.stringify({ ...next, host: null }) ? previous : next;
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "aria-invalid"] });
    const size = new ResizeObserver(schedule); if (panel.current) size.observe(panel.current);
    window.addEventListener("resize", schedule); window.addEventListener("scroll", schedule, true);
    anchor?.addEventListener("input", schedule);
    window.visualViewport?.addEventListener("resize", schedule); window.visualViewport?.addEventListener("scroll", schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); size.disconnect(); anchor?.removeEventListener("input", schedule); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true); window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule); };
  }, [active, anchor, issues.length, layout?.host, onClose]);
  if (!layout) return null;
  const remaining = anchor && layout.anchorValid ? [] : issues;
  const primaryIssue = remaining[0] ?? null;
  const moreIssues = remaining.slice(1);
  return createPortal(<div className={`recovery-layer ${closing ? "is-closing" : ""}`}>
    {layout.lens && remaining.length > 0 && <div key={`${active?.zoneId}:${active?.field}`} className="recovery-lens" aria-hidden="true" style={layout.lens}><span /></div>}
    <section ref={panel} className="readiness-checklist recovery-popup" role="region" aria-label="Kelengkapan untuk melanjutkan" style={{ left: layout.left, top: layout.top, maxHeight: layout.maxHeight }}>
      <header><span className="recovery-symbol">{remaining.length ? <Search size={21} /> : <Check size={21} />}</span><div><h2>{remaining.length ? "Perlu satu langkah lagi" : anchor ? "Isian diperbarui" : "Data sudah lengkap"}</h2></div><button type="button" onClick={dismiss} aria-label="Tutup panduan isian"><X size={18} /></button></header>
      {primaryIssue ? <><button type="button" className="readiness-primary-action" onClick={() => onSelect(primaryIssue)}><span>{primaryIssue.message}</span><ArrowRight size={16} /></button>{moreIssues.length > 0 && <details className="readiness-more"><summary>+ {moreIssues.length} hal lain</summary><ul>{moreIssues.map((issue, i) => <li key={`${issue.zoneId}:${issue.field}:${i}`}><button type="button" className={issue.field === active?.field && issue.zoneId === active?.zoneId ? "active" : ""} onClick={() => onSelect(issue)}><span>{issue.message}</span><ArrowRight size={16} /></button></li>)}</ul></details>}</> : <><p role="status">{anchor ? "Isian ini siap diterapkan." : "Data yang diperlukan sudah lengkap."}</p><button type="button" className="primary" onClick={onContinue}>{anchor ? "Terapkan" : `Lanjut ke ${destination}`}<ArrowRight size={16} /></button></>}
    </section>
  </div>, layout.host);
}

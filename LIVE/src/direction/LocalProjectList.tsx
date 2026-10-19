import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, FolderOpen, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../persistence/ProjectRepository";
import { ContextDialog } from "./ContextDialog";

export function LocalProjectList({ projects, onOpen, onDelete }: { projects: ProjectSummary[]; onOpen: (id: string) => void; onDelete: (id: string, revision: number) => Promise<void> }) {
  const [removing, setRemoving] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const positionMenu = useCallback(() => {
    const summary = disclosure.current?.querySelector("summary");
    if (!summary) return;
    const rect = summary.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = (viewport?.offsetTop ?? 0) + 12;
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - 12;
    const width = Math.min(480, (viewport?.width ?? innerWidth) - 24);
    const below = Math.max(0, bottom - rect.bottom - 8);
    const above = Math.max(0, rect.top - top - 8);
    const upwards = below < 240 && above > below;
    const height = Math.min(360, upwards ? above : below);
    setMenuStyle({ width, maxHeight: height, left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)), top: upwards ? rect.top - 8 : rect.bottom + 8, transform: upwards ? "translateY(-100%)" : undefined });
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!removing && !disclosure.current?.contains(event.target as Node)) disclosure.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !removing && disclosure.current?.open) {
        disclosure.current.open = false; disclosure.current.querySelector("summary")?.focus(); event.stopPropagation();
      }
    };
    const reposition = () => { if (disclosure.current?.open) positionMenu(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
    };
  }, [positionMenu, removing]);
  const visible = projects.filter(p => p.name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")));
  return <><details ref={disclosure} className="local-projects" onToggle={event => { if (event.currentTarget.open) positionMenu(); }}><summary onClick={positionMenu}><FolderOpen size={19} aria-hidden="true"/><span>Proyek tersimpan ({projects.length})</span><ChevronDown size={18} aria-hidden="true"/></summary>
    <div className="local-project-menu" style={menuStyle}>
    {(projects.length > 5 || query.length > 0) && <label className="project-search">Cari proyek tersimpan<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama proyek" /></label>}
    <div className="local-project-scroll" role="region" aria-label="Daftar proyek tersimpan" tabIndex={0}>
    {visible.map(p => <div className="local-project-row" key={p.id}>
      <button className="open-project" title={p.name} onClick={() => onOpen(p.id)}><FolderOpen size={16} /><span>{p.name}</span><small>{p.zoneCount} zona · revisi {p.revision}{p.recovery ? " · perlu pemulihan" : ""}</small></button>
      <button className="delete-project" aria-label={`Hapus proyek ${p.name}`} onClick={() => { setError(""); setRemoving(p); }}><Trash2 size={16} /><span>Hapus</span></button>
    </div>)}
    {!visible.length && <p role="status">{projects.length ? "Tidak ada proyek dengan nama itu." : "Belum ada proyek tersimpan."}</p>}
    </div>
    </div>
  </details>
    {removing && <ContextDialog title="Hapus proyek tersimpan?" onClose={() => { if (!busy) setRemoving(null); }}>
      <p><strong>{removing.name}</strong><br />{removing.zoneCount} zona · revisi {removing.revision}</p>
      <p>Seluruh data proyek ini akan dihapus dari browser ini. Proyek lain tetap tersimpan. Gunakan cadangan proyek jika ingin menyimpan salinannya dahulu.</p>
      {error && <p role="alert">{error}</p>}
      <div className="intervention-save-actions"><button disabled={busy} onClick={() => setRemoving(null)}>Batal</button><button disabled={busy} className="primary" onClick={async () => {
        setBusy(true); setError("");
        try { await onDelete(removing.id, removing.revision); setRemoving(null); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Proyek belum terhapus. Coba lagi."); }
        finally { setBusy(false); }
      }}>{busy ? "Menghapus…" : "Ya, hapus proyek"}</button></div>
    </ContextDialog>}
  </>;
}

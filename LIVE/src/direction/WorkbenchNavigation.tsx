import {TirtaOrb} from './TirtaOrb';
import { ChevronDown, Compass, FolderOpen, MoreHorizontal, Save, FileText, Map, CloudRain, SlidersHorizontal, Scale, FileCheck2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpButton, type HelpTopic } from "./TirtaHelp";
import { TirtaAiIcon } from "./TirtaAiIcon";

type Area = "project" | "studio" | "rain" | "interventions" | "alternatives" | "compare" | "impact";
export type NavigationItem = { id: Area; label: string; state: "blocked" | "partial" | "complete"; explanation: string };
const captions = { studio: "Persil", rain: "Hujan", interventions: "Intervensi", impact: "Rencana" };
const steps = { studio: 1, rain: 2, interventions: 3, impact: 5 };
function NavigationDisclosure({ className, summary, children }: { className: string; summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current?.open) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); event.stopPropagation(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, []);
  return <details ref={ref} className={className}>{summary}{children}</details>;
}

export function WorkbenchNavigation({ items, current, name, projectId, status, editing = false, guided, helpTopic, onNavigate, onSave, onOpen, onGuidance, onAssistant, assistantOpen, onReport, onNavigator, navigatorOpen }: {
  editing?: boolean; items: NavigationItem[]; helpTopic: HelpTopic; current: Area; name: string; projectId: string; status: string; guided: boolean;
  onNavigate: (area: Area) => void; onSave: () => void; onOpen: () => void; onGuidance: () => void;
  onAssistant: () => void; assistantOpen: boolean;
  onReport?: () => void; onNavigator:()=>void; navigatorOpen:boolean;
}) {
  const [navigatorDiscovery,setNavigatorDiscovery]=useState(false);
  useEffect(()=>{
    if(current==='project'||navigatorOpen||!projectId)return;
    const key=`tirta:navigator-discovery:${projectId}`;
    try { if(sessionStorage.getItem(key))return; sessionStorage.setItem(key,'seen'); } catch { /* Show once for this mount if session storage is unavailable. */ }
    const reveal=window.setTimeout(()=>setNavigatorDiscovery(true),0);
    const dismiss=window.setTimeout(()=>setNavigatorDiscovery(false),4500);
    return ()=>{window.clearTimeout(reveal);window.clearTimeout(dismiss);};
  },[current,navigatorOpen,projectId]);
  const discoveryVisible=navigatorDiscovery&&current!=='project'&&!navigatorOpen;
  const openNavigator=()=>{setNavigatorDiscovery(false);onNavigator();};
  const saveText = editing ? "Isian belum disimpan" : ({ saved: "Tersimpan lokal", saving: "Menyimpan…", unsaved: "Belum tersimpan", error: "Simpanan gagal", empty: "Proyek baru" } as Record<string, string>)[status] ?? "Periksa simpanan";
  const project = items.find(item => item.id === "project")!;
  const step = (item: NavigationItem & { id: keyof typeof captions }) => {
    const StepIcon = item.id === "studio" ? Map : item.id === "rain" ? CloudRain : item.id === "interventions" ? SlidersHorizontal : FileCheck2;
    return <button key={item.id} className={`route-${item.id}`} data-readiness={item.state} aria-label={item.label} aria-current={!assistantOpen && !navigatorOpen && current === item.id ? "page" : undefined} title={`${item.label}: ${item.explanation}`} onClick={() => onNavigate(item.id)}><span className="mobile-step-icon" aria-hidden="true"><StepIcon size={18}/></span><span className="nav-step" aria-hidden="true">{steps[item.id]}</span><span>{captions[item.id]}</span><span className="sr-only">{item.explanation}</span></button>;
  };
  return <aside className={`app-rail ${current === "project" ? "is-project-home" : "is-project-workspace"}`} aria-label="Navigasi proyek">
    <button className="wordmark" onClick={() => onNavigate("project")} aria-label="TIRTA, buka proyek"><img className="tirta-logo" src="/tirta-logo.png" width="1280" height="1280" alt="" />TIRTA</button>
    <nav aria-label="Ruang kerja TIRTA">
      <button className="route-project" aria-label="Proyek" aria-current={!assistantOpen && !navigatorOpen && current === "project" ? "page" : undefined} title={name} onClick={() => onNavigate("project")}><span>{name}</span><ChevronDown size={16} /><span className="sr-only">{project.explanation}</span></button>
      <span className="local-save-indicator" role="status" aria-label={saveText} title={saveText}><i data-status={editing?"unsaved":status} aria-hidden="true" /><span>{saveText}</span></span>
      <div className="workflow-navigation">
        {items.filter((item): item is NavigationItem & { id: keyof typeof captions } => item.id in captions && item.id !== "impact").map(step)}
        <button className="comparison-navigation route-alternatives" aria-label="Bandingkan" aria-current={!assistantOpen && !navigatorOpen && (current==='alternatives'||current==='compare')?'page':undefined} title={items.find(i=>i.id==='alternatives')?.explanation} data-readiness={items.find(i=>i.id==='alternatives')?.state} onClick={()=>onNavigate('alternatives')}><span className="mobile-step-icon" aria-hidden="true"><Scale size={18}/></span><span className="nav-step" aria-hidden="true">4</span><span>Bandingkan</span><span className="sr-only">{items.find(i=>i.id==='alternatives')?.explanation}</span></button>
        {step({ ...items.find(item => item.id === "impact")!, id: "impact" })}
      </div>
    </nav>
    <header className="project-header">
      <NavigationDisclosure className="project-actions" summary={<summary aria-label="Tindakan proyek" title="Buka, simpan, dan petunjuk"><MoreHorizontal size={22} /></summary>}><div className="navigation-menu project-actions-menu">
        <div className="project-menu-status"><i data-status={editing?"unsaved":status} aria-hidden="true"/><span>{saveText}</span></div>
        <div className="project-menu-primary">
          <button onClick={onOpen} aria-label="Buka simpanan lokal"><FolderOpen size={18} /><span>Buka</span></button>
          <button onClick={onSave} aria-label="Simpan"><Save size={18} /><span>Simpan</span></button>
          <button disabled={!onReport} onClick={event => { const menu=event.currentTarget.closest('details');menu?.removeAttribute('open');menu?.querySelector('summary')?.focus();onReport?.(); }}><FileText size={18} /><span>Laporan proyek</span></button>
        </div>
        <div className="project-menu-support">
          <button className="project-menu-assistant" onClick={event=>{const menu=event.currentTarget.closest('details');menu?.removeAttribute('open');menu?.querySelector('summary')?.focus();onAssistant();}}><TirtaAiIcon size={18}/><span>Tanya TIRTA</span></button>
          <button onClick={onGuidance}><Compass size={18} /><span>{guided ? "Sembunyikan petunjuk" : "Tampilkan petunjuk"}</span></button>
        </div>
      </div></NavigationDisclosure>
    </header>
    <div className={`rail-bottom ${discoveryVisible?'navigator-discovery-active':''}`}>
      <button className="assistant-entry" aria-label="Navigator TIRTA" title="Navigator TIRTA" aria-current={navigatorOpen ? 'page' : undefined} onClick={openNavigator}><TirtaOrb compact/></button>
      {discoveryVisible&&<div className="navigator-discovery-hint" role="status"><strong>Bingung harus mulai dari mana?</strong><span>Buka Navigator untuk melihat langkah berikutnya kapan pun.</span></div>}
      <HelpButton topic={helpTopic} label="Dasar TIRTA" />
    </div>
  </aside>;
}

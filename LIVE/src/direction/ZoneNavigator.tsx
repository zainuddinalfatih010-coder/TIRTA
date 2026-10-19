import { useLayoutEffect, useRef, useState } from "react";
import type { ProjectV2 } from "../domain/projectV2";
import { surfaceLabels } from "../domain/model";
import { fmt } from "./productionBridge";
import { materials } from "./Parcel";

export function ZoneNavigator({ project, selected, onSelect, children }: { project: ProjectV2; selected: string; onSelect: (id: string) => void; children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const dense = project.zones.length > 7;
  const zones = project.zones.filter(zone => `${zone.name} ${zone.surface ? surfaceLabels[zone.surface] : "Belum diklasifikasikan UNKNOWN"}`.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")));
  useLayoutEffect(() => {
    const element = list.current;
    if (!element || dense) return;
    const reveal = () => {
      if (!matchMedia("(max-width: 760px)").matches) return;
      const active = element.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (active) element.scrollLeft = active.offsetLeft - element.offsetLeft - (element.clientWidth - active.clientWidth) / 2;
    };
    const observer = new ResizeObserver(reveal); observer.observe(element); reveal();
    return () => observer.disconnect();
  }, [selected, query, dense]);
  return <aside className={`zone-register ${dense ? "dense-register" : ""}`} aria-label="Daftar zona persil">
    <div className="register-title"><h2>Susunan lahan</h2><span>{project.zones.length} zona</span></div>
    {dense && <label className="zone-search">Cari zona<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nama atau permukaan" /></label>}
    <div ref={list} className="zone-navigator-list" tabIndex={dense ? 0 : undefined} aria-label={dense ? "Daftar zona, dapat digulir" : undefined}>
      {zones.map(zone => {
        const coefficient = project.parameters.find(p => p.id === zone.coefficient.id)?.value;
        const area = project.parameters.find(p => p.id === zone.area.id)?.value;
        return <button key={zone.id} className={`zone-row ${zone.id === selected ? "selected" : ""}`} aria-pressed={zone.id === selected} onClick={() => onSelect(zone.id)}>
          <span className={`material-swatch ${zone.surface ?? ""}`} style={{ backgroundColor: zone.surface ? materials[zone.surface].color : "#edf0ed" }}>{project.zones.indexOf(zone) + 1}</span>
          <span><strong>{zone.name}</strong><small>{zone.surface ? surfaceLabels[zone.surface] : "Belum diklasifikasikan"}</small><small>{area == null ? "Luas belum diisi" : `${fmt(area)} m²`}</small><small>Koefisien limpasan: {coefficient == null ? "Belum diisi" : String(coefficient).replace(".", ",")}</small></span>
        </button>;
      })}
      {!zones.length && <p role="status">{project.zones.length?'Tidak ada zona yang cocok. Ubah pencarian.':'Tambahkan area sederhana atau gambar zona pada persil.'}</p>}
    </div>
    {children}
  </aside>;
}

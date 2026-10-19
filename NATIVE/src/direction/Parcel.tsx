import {RoofRoutingEditor} from './RoofRoutingEditor';
import { InterventionIllustration } from "./Visuals";
import { SurfacePatterns } from "./SurfacePatterns";
import { visualLabelAnchor, visualLabelClearance, visualLabelWidth } from "./labelLayout";
import { ZoneMapLabel } from "./ZoneMapLabel";
import "./zone-labels.css";
import "./studio-task-layout.css";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ContextDialog } from "./ContextDialog";
import { DrawingSettings } from "./DrawingSettings";
import { dependencies } from "../domain/authoring";
import { useParcelCanvas } from "./useParcelCanvas";
import { formatMeter, rulerTicks, selectedZoneDimensions } from "./studioMeasurements";
import type { ProjectV2 } from "../domain/projectV2";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Undo2,
  Redo2,
  Trash2,
  MoreHorizontal,
  X,
  VectorSquare,
} from "lucide-react";
import { surfaceLabels, type Point, type Surface } from "../domain/model";
import { fmt, type Evaluation, type OptionId } from "./productionBridge";
import { bioporiInstallationAllowed, treatmentPlacementIssue } from '../domain/treatmentDesign';
import { containsPoint } from '../domain/geometry';

export const materials: Record<
  Surface,
  { color: string; ink: string; label: string }
> = {
  roof: { color: "#c9a28c", ink: "#785240", label: "Atap" },
  paved: { color: "#d4dcdf", ink: "#556a73", label: "Beton/Aspal" },
  vegetation: { color: "#b8c992", ink: "#526d3a", label: "Vegetasi" },
  soil: { color: "#dfc596", ink: "#7e6334", label: "Tanah terbuka" },
  porous: { color: "#b2ceca", ink: "#366762", label: "Permukaan berpori" },
};
const serialize = (points: Point[]) =>
  points.map((p) => `${p.x},${p.y}`).join(" ");
interface Props {
  project: ProjectV2;
  selected: string;
  onSelect?: (id: string) => void;
  onProject?: (p: ProjectV2) => void;
  onInspect?: () => void;
  enabled?: readonly OptionId[];
  result?: Evaluation | null;
  analytical?: boolean;
  compact?: boolean;
  showGaps?: boolean;
  fit?: boolean;
  materialTextures?: boolean;
  detailLabels?: boolean;
  illustratedMarkers?: boolean;
  activeIntervention?: string;
  roleSelecting?: boolean;
  roofGuided?: boolean;
  controls?: ReactNode;
  placement?: { pending: OptionId | null; onPlace: (id: OptionId, point: Point) => void; onEdit: (id: OptionId) => void; onClear?: () => void };
}
export function Parcel({
  project,
  selected,
  onSelect,
  onProject,
  onInspect,
  enabled = [],
  result,
  analytical = false,
  compact = false,
  showGaps = false,
  fit = false,
  materialTextures = false,
  detailLabels = false,
  illustratedMarkers = false,
  activeIntervention,
  roleSelecting = false,
  roofGuided = false,
  controls,
  placement,
}: Props) {
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReducedMotion(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  const uid = useId().replaceAll(":", "");
  const canvas = useParcelCanvas(project, selected, onSelect, onProject);
  const { svg, zoom, setZoom, vertices, setVertices, snap, setSnap, showGrid, setShowGrid, axisLock, setAxisLock, message, error, preview, liveMeasurement, toScreen, start, move, end, nudge } = canvas;
  const [hovered, setHovered] = useState<string | null>(null);
  const [roofMenuAnchor, setRoofMenuAnchor] = useState<{ zoneId: string; clientX: number; clientY: number } | null>(null);
  const markerClick = useRef(false);
  const roleClick = useRef(false);
  const markerDrag = useRef<{ id: OptionId; x: number; y: number; moved: boolean } | null>(null);
  const [markerPreview, setMarkerPreview] = useState<{ id: OptionId; point: Point } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mobileHelpOpen, setMobileHelpOpen] = useState(false);
  const mobileTools = useRef<HTMLDivElement>(null);
  const mobileMoreButton = useRef<HTMLButtonElement>(null);
  const drawingMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => { if (!drawingMenu.current?.contains(event.target as Node)) drawingMenu.current?.removeAttribute('open'); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && drawingMenu.current?.open) { event.preventDefault(); drawingMenu.current.open = false; drawingMenu.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  const deletable = project.parcel?.id === selected || project.zones.some(z => z.id === selected);
  useEffect(() => {
    if (!mobileHelpOpen) return;
    const dismissOutside = (event: globalThis.PointerEvent) => {
      if (!mobileTools.current?.contains(event.target as Node)) setMobileHelpOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMobileHelpOpen(false);
      mobileMoreButton.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [mobileHelpOpen]);
  useEffect(() => {
    if (compact || !onProject || !deletable || canvas.mode !== "select") return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Delete" || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
      event.preventDefault(); setDeleteOpen(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [compact, onProject, deletable, canvas.mode]);
  const [pixelsPerUnit, setPixelsPerUnit] = useState(1);
  const [viewportAspect, setViewportAspect] = useState(770 / 600);
  useLayoutEffect(() => {
    const element = svg.current; if (!element) return;
    const measure = () => { const box = element.getBoundingClientRect(); if (box.height > 0 && box.width > 0) setViewportAspect(box.width / box.height); const matrix = element.getScreenCTM(); if (matrix) setPixelsPerUnit(Math.max(.01, Math.hypot(matrix.a, matrix.b))); };
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, [svg, zoom, viewportAspect]);
  const [dimensionsOpen, setDimensionsOpen] = useState(false);
  const [dimensionDraft, setDimensionDraft] = useState({ length: String(project.drawingScale?.initialLength ?? ""), width: String(project.drawingScale?.initialWidth ?? "") });
  const draftArea = dimensionDraft.length && dimensionDraft.width ? Number(dimensionDraft.length) * Number(dimensionDraft.width) : null;
  const zone = project.zones.find(z => z.id === selected);
  // Camera only: fit the committed boundary, never draft vertices or measured data.
  const committedPoints = fit ? project.parcel?.polygon.map(toScreen) ?? [] : [];
  const extent = committedPoints.length ? {
    left: Math.min(...committedPoints.map(p => p.x)), right: Math.max(...committedPoints.map(p => p.x)),
    top: Math.min(...committedPoints.map(p => p.y)), bottom: Math.max(...committedPoints.map(p => p.y)),
  } : null;
  const viewHeight = extent ? Math.max(extent.bottom - extent.top + 80, (extent.right - extent.left + 80) / viewportAspect) : 600;
  const viewWidth = extent ? viewHeight * viewportAspect : 770;
  const centerX = extent ? (extent.left + extent.right) / 2 : 410;
  const centerY = extent ? (extent.top + extent.bottom) / 2 : 335;
  const canvasView = { x: centerX - viewWidth / 2 / zoom, y: centerY - viewHeight / 2 / zoom, width: viewWidth / zoom, height: viewHeight / zoom };
  const readout = canvas.mode === "select" ? zone ?? project.zones.find(z => z.id === hovered) : undefined;
  const readoutArea = project.parameters.find(p => p.id === readout?.area.id)?.value;
  const readoutRunoff = result?.baseline.zones.find(z => z.id === readout?.id)?.runoffM3;
  const coverageToastKey = JSON.stringify([project.parcel?.polygon, project.zones.map(z => [z.id, z.polygon])]);
  const labels: ReactNode[] = [];
  const parcelArea = project.parameters.find(p => p.id === project.parcel?.area.id)?.value;
  const shownPolygon = (id: string, polygon: Point[]) => (preview?.id === id ? preview.points : polygon).map(toScreen);
  const parcelPoints = project.parcel ? (preview?.id === project.parcel.id ? preview.points : project.parcel.polygon) : [];
  const parcelBounds = parcelPoints.length ? {
    minX: Math.min(...parcelPoints.map(p => p.x)), maxX: Math.max(...parcelPoints.map(p => p.x)),
    minY: Math.min(...parcelPoints.map(p => p.y)), maxY: Math.max(...parcelPoints.map(p => p.y)),
  } : null;
  const screenParcelPoints = project.parcel ? shownPolygon(project.parcel.id, project.parcel.polygon) : [];
  const screenParcelBounds = screenParcelPoints.length ? {
    minX: Math.min(...screenParcelPoints.map(p => p.x)), maxX: Math.max(...screenParcelPoints.map(p => p.x)),
    minY: Math.min(...screenParcelPoints.map(p => p.y)), maxY: Math.max(...screenParcelPoints.map(p => p.y)),
  } : null;
  const marginWaterline = (() => {
    if (compact || !screenParcelBounds) return null;
    const rightMargin = canvasView.x + canvasView.width - screenParcelBounds.maxX;
    const leftMargin = screenParcelBounds.minX - canvasView.x;
    const side = rightMargin >= 52 ? "right" : leftMargin >= 84 ? "left" : null;
    if (!side) return null;
    const x1 = side === "left" ? canvasView.x + 12 : screenParcelBounds.maxX + 12;
    const x2 = side === "left" ? screenParcelBounds.minX - 25 : canvasView.x + canvasView.width - 12;
    if (x2 - x1 < 28) return null;
    const centerY = Math.max(canvasView.y + 52, Math.min((screenParcelBounds.minY + screenParcelBounds.maxY) / 2, canvasView.y + canvasView.height - 52));
    const amplitude = Math.min(8, (canvasView.y + canvasView.height - canvasView.y) / 45);
    const line = (offset: number, phase: number) => `M${x1} ${centerY + offset} C${x1 + (x2 - x1) * .32} ${centerY + offset - amplitude * phase} ${x1 + (x2 - x1) * .68} ${centerY + offset + amplitude * phase} ${x2} ${centerY + offset}`;
    return [line(-15, 1), line(0, -.72), line(15, .52)];
  })();
  const screenMeter = parcelBounds ? Math.hypot(toScreen({ x: parcelBounds.minX + 1, y: parcelBounds.minY }).x - toScreen({ x: parcelBounds.minX, y: parcelBounds.minY }).x, toScreen({ x: parcelBounds.minX + 1, y: parcelBounds.minY }).y - toScreen({ x: parcelBounds.minX, y: parcelBounds.minY }).y) : 0;
  const drawRuler = (axis: "x" | "y", min: number, max: number, origin: Point) => {
    const ticks = rulerTicks(max - min, screenMeter * pixelsPerUnit);
    const track = toScreen(origin);
    const horizontal = axis === "x";
    const tickLength = (kind: string) => (kind === "major" ? 8 : kind === "half" ? 5 : 3) / pixelsPerUnit;
    return <g key={axis} className={`parcel-ruler parcel-ruler-${axis}`} data-testid={`parcel-ruler-${horizontal ? "horizontal" : "vertical"}`} data-length={max - min} aria-label={`Penggaris ${horizontal ? "horizontal" : "vertikal"}, ${fmt(max - min)} meter berdasarkan dimensi persil yang Anda nyatakan`}>
      <line className="ruler-baseline" x1={horizontal ? track.x : track.x - 19} y1={horizontal ? track.y - 17 : track.y} x2={horizontal ? toScreen({ x: max, y: origin.y }).x : track.x - 19} y2={horizontal ? track.y - 17 : toScreen({ x: origin.x, y: max }).y} />
      {ticks.map(tick => {
        const p = toScreen(horizontal ? { x: min + tick.value, y: origin.y } : { x: origin.x, y: min + tick.value });
        const at = horizontal ? { x: p.x, y: track.y - 17 } : { x: track.x - 19, y: p.y };
        const label = tick.label;
        return <g key={`${tick.value}`} className={`ruler-tick ${tick.kind}`}>
          <line x1={at.x} y1={at.y} x2={horizontal ? at.x : at.x + tickLength(tick.kind)} y2={horizontal ? at.y - tickLength(tick.kind) : at.y} />
          {label && <text x={horizontal ? at.x : at.x - 5 / pixelsPerUnit} y={horizontal ? at.y - 10 / pixelsPerUnit : at.y + 3 / pixelsPerUnit} fontSize={11 / pixelsPerUnit} textAnchor={horizontal ? "middle" : "end"}>{label}</text>}
        </g>;
      })}
    </g>;
  };
  const zoneDimensions = zone && project.drawingScale && zone.geometryContext !== "schematic-area" && !compact
    ? selectedZoneDimensions(preview?.id === zone.id ? preview.points : zone.polygon, screenMeter * pixelsPerUnit)
    : [];
  const selectedArea = project.parameters.find(p => p.id === zone?.area.id)?.value;
  const liveChip = (() => {
    if (!liveMeasurement || !project.drawingScale || zone?.geometryContext === "schematic-area" || !onProject || compact) return null;
    const primary = liveMeasurement.kind === "rectangle"
      ? `${formatMeter(liveMeasurement.width)} × ${formatMeter(liveMeasurement.height)} m`
      : `${formatMeter(liveMeasurement.length)} m`;
    const secondary = liveMeasurement.kind === "rectangle" ? `${formatMeter(liveMeasurement.area)} m²` : null;
    const ppu = Math.max(.01, pixelsPerUnit);
    const widthPx = Math.max(74, primary.length * 8 + 20, secondary ? secondary.length * 7 + 20 : 0);
    const heightPx = secondary ? 48 : 34;
    const width = widthPx / ppu, height = heightPx / ppu, margin = 8 / ppu, offset = 14 / ppu;
    const point = toScreen(liveMeasurement.point);
    let x = point.x + offset;
    if (x + width > canvasView.x + canvasView.width - margin) x = point.x - width - offset;
    x = Math.max(canvasView.x + margin, Math.min(x, canvasView.x + canvasView.width - width - margin));
    let y = point.y - height - offset;
    if (y < canvasView.y + margin) y = point.y + offset;
    y = Math.max(canvasView.y + margin, Math.min(y, canvasView.y + canvasView.height - height - margin));
    return { primary, secondary, width, height, x, y, ppu };
  })();
  const zoneDimensionLayer = zone && zoneDimensions.length > 0 && selectedArea !== undefined && !liveMeasurement && <g className="zone-dimension-layer" data-testid="zone-dimensions" aria-label={`Ukuran sisi zona terpilih ${zone.name}`}>
    {(() => {
      const polygon = preview?.id === zone.id ? preview.points : zone.polygon;
      const signedArea = polygon.reduce((sum, p, i) => sum + p.x * polygon[(i + 1) % polygon.length]!.y - polygon[(i + 1) % polygon.length]!.x * p.y, 0);
      const clockwise = signedArea > 0;
      return zoneDimensions.map(edge => {
        const a = toScreen(edge.from), b = toScreen(edge.to);
        const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
        const nx = (clockwise ? dy : -dy) / length, ny = (clockwise ? -dx : dx) / length;
        const offset = 13 / pixelsPerUnit;
        const ax = a.x + nx * offset, ay = a.y + ny * offset, bx = b.x + nx * offset, by = b.y + ny * offset;
        const midX = (ax + bx) / 2, midY = (ay + by) / 2;
        const text = `${fmt(edge.length)} m`, textWidth = Math.max(39, text.length * 7 + 12) / pixelsPerUnit, textHeight = 18 / pixelsPerUnit;
        return <g className="zone-dimension" key={edge.index} data-edge={edge.index} data-length-m={edge.length.toFixed(3)}>
          <line className="dimension-extension" x1={a.x + nx * 3} y1={a.y + ny * 3} x2={ax + nx * 2} y2={ay + ny * 2} />
          <line className="dimension-extension" x1={b.x + nx * 3} y1={b.y + ny * 3} x2={bx + nx * 2} y2={by + ny * 2} />
          <line className="dimension-line" x1={ax} y1={ay} x2={bx} y2={by} />
          <rect x={midX - textWidth / 2} y={midY - textHeight / 2} width={textWidth} height={textHeight} rx={3 / pixelsPerUnit} />
          <text x={midX} y={midY + 4 / pixelsPerUnit} fontSize={12 / pixelsPerUnit} textAnchor="middle">{text}</text>
        </g>;
      });
    })()}
  </g>;
  const vertexHandles = (id: string, polygon: Point[]) => {
    const canonical = preview?.id === id ? preview.points : polygon;
    const points = canonical.map(toScreen);
    return <>{points.map((p, i) => <g key={i} className="vertex-handle" role="button" tabIndex={0} aria-label={`Titik ${i + 1}; gunakan tombol panah untuk menggeser`}
      onPointerDown={e => start(e, id, i)}
      onKeyDown={e => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); canvas.commit(id, canonical.filter((_, index) => index !== i)); return; } if (!e.key.startsWith("Arrow")) return; e.preventDefault(); const step = e.shiftKey ? .5 : .1; nudge(e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0, i); }}>
      <circle cx={p.x} cy={p.y} r="16" fill="transparent" /><circle cx={p.x} cy={p.y} r="6" fill="white" stroke="#008fe8" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </g>)}{points.map((p, i) => {
      const next = points[(i + 1) % points.length]!, a = canonical[i]!, b = canonical[(i + 1) % canonical.length]!;
      const insert = () => canvas.commit(id, [...canonical.slice(0, i + 1), { x: Math.round((a.x + b.x) * 500) / 1000, y: Math.round((a.y + b.y) * 500) / 1000 }, ...canonical.slice(i + 1)]);
      return <g key={`edge-${i}`} className="edge-handle" role="button" tabIndex={0} aria-label={`Sisipkan titik pada sisi ${i + 1}`} onPointerDown={e => e.stopPropagation()} onClick={insert} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); insert(); } }}>
        <circle cx={(p.x + next.x) / 2} cy={(p.y + next.y) / 2} r="13" fill="white" fillOpacity=".9" stroke="#345cbe" /><text x={(p.x + next.x) / 2} y={(p.y + next.y) / 2 + 4} textAnchor="middle" fill="#345cbe" fontSize="15">+</text>
      </g>;
    })}</>;
  };
  return (
    <div className={`parcel-frame approved-parcel ${compact ? "compact" : ""} ${canvas.mode !== "select" || vertices ? "is-authoring" : ""}`}>
      {!compact && (
        <div className="map-topline">
          <span className="boundary-controls">
            <span className="parcel-boundary-readout"><span className="boundary-sample" /> Batas persil{" "}
            <strong>{parcelArea == null ? "Belum dibuat" : `${fmt(parcelArea)} m²`}</strong></span>{onProject && project.parcel && <button className="boundary-edit" onClick={() => { onSelect?.(project.parcel!.id); setVertices(true); canvas.cancel(); }}>Edit batas</button>}
          </span>
          {controls && <div className="map-layer-controls">{controls}</div>}
        </div>
      )}
      {!compact && onInspect && zone && <button type="button" className="mobile-zone-summary" onClick={onInspect}><b>{project.zones.indexOf(zone) + 1}</b><strong>{zone.name}</strong><span>Ubah data</span></button>}
      {!compact && onProject && <div className="mobile-studio-tools" ref={mobileTools}>
        <div className="mobile-tool-dock" role="group" aria-label="Alat Studio Persil">
          <button className={!vertices && canvas.mode === "select" ? "active" : ""} aria-pressed={!vertices && canvas.mode === "select"} aria-label="Pilih dan geser" title="Pilih" onClick={() => { canvas.cancel(); setVertices(false); }}><MousePointer2 size={19} aria-hidden="true" /></button>
          <button className={canvas.mode !== "select" ? "active" : ""} aria-pressed={canvas.mode !== "select"} aria-label="Tambah zona" title="Tambah zona" onClick={() => canvas.begin("rectangle")}><Plus size={20} aria-hidden="true" /></button>
          <button className={vertices ? "active" : ""} aria-pressed={vertices} aria-label="Edit titik zona" title="Edit titik" onClick={() => { canvas.cancel(); setVertices(value => !value); }}><VectorSquare size={19} aria-hidden="true" /></button>
          <button disabled={!deletable || canvas.mode !== "select"} aria-label={selected === project.parcel?.id ? "Hapus persil" : "Hapus zona"} title="Hapus" onClick={() => setDeleteOpen(true)}><Trash2 size={19} aria-hidden="true" /></button>
          <button disabled={!canvas.canUndo} aria-label="Urungkan" title="Urungkan" onClick={canvas.undo}><Undo2 size={19} aria-hidden="true" /></button>
          <button disabled={!canvas.canRedo} aria-label="Ulangi" title="Ulangi" onClick={canvas.redo}><Redo2 size={19} aria-hidden="true" /></button>
          <button ref={mobileMoreButton} aria-label="Bantuan gambar" title="Bantuan gambar" aria-expanded={mobileHelpOpen} aria-controls={`${uid}-mobile-help`} onClick={() => setMobileHelpOpen(open => !open)}><MoreHorizontal size={20} aria-hidden="true" /></button>
        </div>
        {mobileHelpOpen && <div id={`${uid}-mobile-help`} className="mobile-help-popover drawing-settings" role="group" aria-labelledby={`${uid}-mobile-help-heading`}>
          <DrawingSettings headingId={`${uid}-mobile-help-heading`} axisLock={axisLock} onAxisLock={setAxisLock} snap={snap} onSnap={setSnap} grid={showGrid} onGrid={setShowGrid} align={canvas.align} onAlign={canvas.setAlign} hasParcel={!!project.parcel} onDimensions={() => { setDimensionsOpen(true); setMobileHelpOpen(false); }}/>
        </div>}
      </div>}
      {!compact && onProject && (
        <div className="map-toolstrip" aria-label="Alat sketsa">
          <div className="tool-group tool-modes" role="group" aria-label="Mode kanvas">
          <button
            className={!vertices && canvas.mode === "select" ? "active" : ""}
            aria-pressed={!vertices && canvas.mode === "select"}
            onClick={() => { canvas.cancel(); setVertices(false); }}
            title="Pilih dan geser"
          >
            <MousePointer2 size={18} />
            <span>Pilih</span>
          </button>
          <button onClick={() => canvas.begin("rectangle")} aria-pressed={canvas.mode !== "select"} title="Tambah zona"><Plus size={18} /><span>Zona</span></button>
          <button
            className={vertices ? "active" : ""}
            aria-pressed={vertices}
            onClick={() => { canvas.cancel(); setVertices((v) => !v); }}
          >
            <VectorSquare size={18} />
            <span>Titik</span>
          </button>
          </div>
          <span className="tool-divider" aria-hidden="true" />
          <div className="tool-group tool-edits" role="group" aria-label="Riwayat dan tindakan objek">
          <button disabled={!deletable || canvas.mode !== "select"} aria-label={selected === project.parcel?.id ? "Hapus persil" : "Hapus zona"} title="Hapus objek terpilih (Delete)" onClick={() => setDeleteOpen(true)}><Trash2 size={18} /><span>Hapus</span></button>
          <button disabled={!canvas.canUndo} aria-label="Urungkan sketsa" onClick={canvas.undo}><Undo2 size={18} /></button>
          <button disabled={!canvas.canRedo} aria-label="Ulangi sketsa" onClick={canvas.redo}><Redo2 size={18} /></button>
          </div>
          <details ref={drawingMenu} className="tool-group tool-constraints" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.open = false; }}><summary aria-label="Bantuan gambar"><MoreHorizontal size={20} /></summary><div className="tool-settings drawing-settings" role="group" aria-labelledby={`${uid}-drawing-heading`}>
          <DrawingSettings headingId={`${uid}-drawing-heading`} axisLock={axisLock} onAxisLock={setAxisLock} snap={snap} onSnap={setSnap} grid={showGrid} onGrid={setShowGrid} align={canvas.align} onAlign={canvas.setAlign} hasParcel={!!project.parcel} onDimensions={() => { setDimensionsOpen(true); if (drawingMenu.current) drawingMenu.current.open = false; }}/>
          </div></details>
          {canvas.mode !== "select" && <div className="drawing-actions">
            <button aria-pressed={canvas.mode === "rectangle"} onClick={() => canvas.begin("rectangle")}>Persegi panjang</button>
            <button aria-pressed={canvas.mode === "polygon"} onClick={() => canvas.begin("polygon")}>Bentuk bebas</button>
            {!project.zones.length && <button onClick={() => canvas.create(project.parcel!.polygon)}>Seluruh persil</button>}
            {canvas.mode === "polygon" && <><span className="draft-count" role="status">{canvas.points.length} titik · min. 3</span><button disabled={!canvas.points.length} onClick={canvas.undoPoint} aria-label="Urungkan titik terakhir"><Undo2 size={15} />Titik terakhir</button><button disabled={canvas.points.length < 3} onClick={() => canvas.create(canvas.points)}>Selesai</button></>}
            <button aria-label="Batalkan menggambar" onClick={canvas.cancel}><X size={16} /></button>
            {error && <div className="drawing-error" role="alert"><strong>Zona belum bisa diselesaikan</strong><span>{error}</span><small>{canvas.mode === "polygon" ? "Gunakan Titik terakhir untuk mengurungkan sudut yang keliru, lalu pilih sudut penggantinya dan tekan Selesai. Draf Anda tetap ada." : "Pilih kembali sudut zona di dalam persil, tanpa menumpuk zona lain."}</small></div>}
          </div>}
        </div>
      )}
      {!compact && onProject && (!project.parcel || dimensionsOpen) && <div className="parcel-start"><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); if (canvas.dimensions(String(f.get("length") ?? ""), String(f.get("width") ?? ""))) setDimensionsOpen(false); }}>
        <h3>{project.parcel ? "Bentuk awal persegi panjang" : "Mulai dari ukuran persil Anda"}</h3>
        <p>Masukkan panjang × lebar. Setelah itu, bentuk batas dan zona langsung di kanvas.</p>
        <div><label>Panjang (m)<input name="length" aria-label="Panjang persil" type="number" min="0.001" step="0.001" required value={dimensionDraft.length} onChange={e => setDimensionDraft(d => ({ ...d, length: e.target.value }))} aria-describedby="parcel-limit" aria-invalid={draftArea !== null && draftArea > 200 || undefined} /></label><span>×</span><label>Lebar (m)<input name="width" aria-label="Lebar persil" type="number" min="0.001" step="0.001" required value={dimensionDraft.width} onChange={e => setDimensionDraft(d => ({ ...d, width: e.target.value }))} aria-describedby="parcel-limit" aria-invalid={draftArea !== null && draftArea > 200 || undefined} /></label></div>
        <small id="parcel-limit"><strong>Maks. 200 m²</strong> · contoh 15 × 10 m = 150 m². Dimensi Anda, bukan hasil survei.</small>
        {draftArea !== null && <output className={draftArea >= 180 ? "field-warning" : "dimension-preview"} aria-live="polite">{dimensionDraft.length} × {dimensionDraft.width} m = {fmt(draftArea)} m²{draftArea > 200 ? " · melebihi batas 200 m²; kurangi ukuran sesuai lahan Anda." : draftArea >= 180 ? " · mendekati batas 200 m²." : ""}</output>}
        <button type="submit" className="primary">{project.parcel ? "Terapkan ukuran" : "Buat persil"}</button>{project.parcel && <button type="button" onClick={() => setDimensionsOpen(false)}>Batal</button>}
        {error && <p role="alert">{error}</p>}
      </form></div>}
      <svg
        ref={svg}
        className="parcel-svg"
        data-zoom={zoom.toFixed(1)}
        viewBox={`${canvasView.x} ${canvasView.y} ${canvasView.width} ${canvasView.height}`}
        aria-label="Persil dan zona Anda"
        role="group"
        tabIndex={onProject || placement ? 0 : undefined}
        onDragOver={placement ? e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } : undefined}
        onDrop={placement ? e => { e.preventDefault(); const id = e.dataTransfer.getData("application/tirta-intervention"); if (["new:tank", "new:soak", "new:garden", "new:biopori"].includes(id)) placement.onPlace(id as OptionId, canvas.at(e)); } : undefined}
        onClickCapture={placement?.pending ? e => { e.stopPropagation(); placement.onPlace(placement.pending!, canvas.at(e)); } : undefined}
        onPointerDownCapture={() => { roleClick.current = roleSelecting; }}
        onClick={placement ? e => { if (markerClick.current || roleClick.current) { markerClick.current = false; roleClick.current = false; return; } if (!placement.pending && !(e.target as Element).closest('[data-intervention-marker], .zone-shape, .parcel-boundary')) placement.onClear?.(); } : undefined}
        onPointerDown={canvas.down}
        onPointerMove={e => { const drag = markerDrag.current; if (drag) { drag.moved ||= Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4; if (drag.moved) setMarkerPreview({ id: drag.id, point: canvas.at(e) }); } else move(e); }}
        onPointerUp={e => { const drag = markerDrag.current; if (drag) { markerDrag.current = null; setMarkerPreview(null); requestAnimationFrame(() => { markerClick.current = false; }); if (drag.moved) placement?.onPlace(drag.id, canvas.at(e)); else placement?.onEdit(drag.id); } else end(e); }}
        onPointerCancel={() => { markerClick.current = false; markerDrag.current = null; setMarkerPreview(null); canvas.cancel(); }}
        onPointerLeave={() => { setHovered(null); canvas.leave(); }}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); canvas.cancel(); setVertices(false); setHovered(null); onSelect?.(""); placement?.onClear?.(); }
          if (canvas.mode === "polygon" && e.key === "Enter" && canvas.points.length >= 3) { e.preventDefault(); canvas.create(canvas.points); }
          if (canvas.mode === "polygon" && (e.key === "Backspace" || e.key === "Delete")) { e.preventDefault(); canvas.undoPoint(); }
        }}
      >
        <defs>
          <pattern id={`${uid}unmodelled`} width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#c19b62" strokeWidth="1" /><rect width="12" height="12" fill="#f1ddbd" fillOpacity=".18" /></pattern>
          {showGaps && project.parcel && <mask id={`${uid}gaps`} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="700"><polygon points={serialize(shownPolygon(project.parcel.id, project.parcel.polygon))} fill="white" />{project.zones.map(z => <polygon key={z.id} points={serialize(shownPolygon(z.id, z.polygon))} fill="black" />)}</mask>}
          <radialGradient id={`${uid}paper`} cx="45%" cy="40%" r="70%">
            <stop stopColor="#d4f3ff" />
            <stop offset="1" stopColor="#c7ebfa" />
          </radialGradient>
          <pattern
            id={`${uid}grid`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".6" fill="#6bb9d2" />
          </pattern>
          <filter id={`${uid}marker-edge`} x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="expanded"/><feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge"/><feFlood floodColor="white"/><feComposite in2="edge" operator="in"/><feGaussianBlur stdDeviation="0.2"/></filter>
          <linearGradient className="marker-edge-sweep" id={`${uid}marker-sweep`} x1="0" y1="0" x2="1" y2="0">{!reducedMotion && <animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="5.5s" repeatCount="indefinite"/>}<stop offset=".35" stopColor="white" stopOpacity="0"/><stop offset=".7" stopColor="#69d5ee" stopOpacity=".85"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
          <SurfacePatterns prefix={uid} raster={materialTextures} />
        </defs>
        <rect className="canvas-paper" x="0" y="0" width="900" height="700" fill={`url(#${uid}paper)`} pointerEvents="none" />
        <g className="draft-sheet-frame" aria-hidden="true" pointerEvents="none">
          <rect x={canvasView.x + 12} y={canvasView.y + 12} width={canvasView.width - 24} height={canvasView.height - 24} rx="2" />
          <path d={`M${canvasView.x + 20} ${canvasView.y + 34}v-14h14 M${canvasView.x + canvasView.width - 20} ${canvasView.y + 34}v-14h-14 M${canvasView.x + 20} ${canvasView.y + canvasView.height - 34}v14h14 M${canvasView.x + canvasView.width - 20} ${canvasView.y + canvasView.height - 34}v14h-14`} />
        </g>
        {marginWaterline && <g className="studio-waterline" data-testid="studio-waterline" aria-hidden="true" pointerEvents="none">{marginWaterline.map((d, index) => <path key={index} d={d} />)}</g>}
        <rect
          className="canvas-grid"
          x="0"
          y="0"
          width="900"
          height="700"
          fill={showGrid && !compact ? `url(#${uid}grid)` : "transparent"}
          pointerEvents="none"
        />
        <g data-drawing-world>
        {parcelBounds && project.drawingScale && !compact && <g className="parcel-rulers" data-testid="parcel-rulers" data-user-declared-scale="true">
          {drawRuler("x", parcelBounds.minX, parcelBounds.maxX, { x: parcelBounds.minX, y: parcelBounds.minY })}
          {drawRuler("y", parcelBounds.minY, parcelBounds.maxY, { x: parcelBounds.minX, y: parcelBounds.minY })}
        </g>}
        {project.parcel && <polygon className="parcel-boundary" data-testid="parcel-boundary" points={serialize(shownPolygon(project.parcel.id, project.parcel.polygon))}
          fill="#fff" fillOpacity=".6" stroke={selected === project.parcel.id ? "#345cbe" : "#87958c"} strokeDasharray="9 5" strokeWidth="1.5"
          role={onProject ? "button" : undefined} tabIndex={onProject ? 0 : undefined} aria-label={onProject ? "Pilih batas persil" : undefined}
          onPointerDown={e => { if (vertices && selected === project.parcel!.id) start(e, project.parcel!.id, null); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(project.parcel!.id); setVertices(true); } }} />}
        {showGaps && project.parcel && <rect className="coverage-gap" x="0" y="0" width="900" height="700" fill={`url(#${uid}unmodelled)`} mask={`url(#${uid}gaps)`} pointerEvents="none" />}
        {project.zones.map((z, index) => {
          const points = shownPolygon(z.id, z.polygon);
          const { x: cx, y: cy } = visualLabelAnchor(points);
          const contribution = result?.baseline.zones.find(row => row.id === z.id)?.runoffM3;
          labels.push(<ZoneMapLabel key={`label-${z.id}`} anchor={{x:cx,y:cy}} pixelsPerUnit={pixelsPerUnit}
            clearance={visualLabelClearance(points, {x:cx,y:cy})} number={index + 1} name={z.name}
            availableWidth={Math.max(0, visualLabelWidth(points, { x: cx, y: cy }, 17 / pixelsPerUnit) * pixelsPerUnit - 12)}
            selected={selected === z.id} hovered={hovered === z.id} compact={compact && !detailLabels}
            area={detailLabels ? project.parameters.find(p => p.id === z.area.id)?.value : undefined}
            ink={z.surface ? materials[z.surface].ink : "#536169"}
            contribution={analytical && contribution !== undefined && result ? result.baseline.runoffM3 > 0 ? contribution / result.baseline.runoffM3 : 0 : undefined} />);
          return (
            <g key={z.id}>
              {selected === z.id && !compact && <polygon points={serialize(points)} fill="none" stroke="#345cbe" strokeOpacity=".14" strokeWidth="11" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
              <polygon
                data-testid={`zone-${z.id}`}
                className={`zone-shape ${selected === z.id ? "selected" : ""}`}
                points={serialize(points)}
                fill={z.surface ? `url(#${uid}${z.surface})` : "#edf0ed"}
                stroke={
                  selected === z.id
                    ? "#345cbe"
                    : materials[z.surface ?? "soil"].ink
                }
                strokeWidth={selected === z.id ? 3 : 1.3}
                vectorEffect="non-scaling-stroke"
                role={onSelect ? "button" : undefined}
                aria-label={onSelect ? `Pilih zona ${z.name}` : undefined}
                aria-pressed={onSelect ? selected === z.id : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onPointerEnter={e => { if (e.pointerType !== "touch") setHovered(z.id); }}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(z.id)}
                onBlur={() => setHovered(null)}
                onPointerDown={(e) => { if (canvas.mode === "select" && z.surface === "roof") setRoofMenuAnchor({ zoneId: z.id, clientX: e.clientX, clientY: e.clientY }); start(e, z.id, null); }}
                onClick={() => { if (canvas.mode === "select") onSelect?.(z.id); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(z.id);
                  }
                  if (
                    selected === z.id &&
                    onProject &&
                    e.key.startsWith("Arrow")
                  ) {
                    e.preventDefault();
                    nudge(
                      e.key === "ArrowLeft"
                        ? -.1
                        : e.key === "ArrowRight"
                          ? .1
                          : 0,
                      e.key === "ArrowUp" ? -.1 : e.key === "ArrowDown" ? .1 : 0,
                    );
                  }
                }}
              ><title>{z.name} · {z.surface ? surfaceLabels[z.surface] : "Permukaan belum dikonfirmasi"}</title></polygon>
              {selected === z.id && vertices && onProject && vertexHandles(z.id, z.polygon)}
            </g>
          );
        })}
        {!compact&&!placement&&onProject&&zone?.surface==='roof'&&canvas.mode==='select'&&!vertices&&<RoofRoutingEditor key={zone.id} project={project} zoneId={zone.id} svg={svg} at={canvas.at} toScreen={toScreen} pixelsPerUnit={pixelsPerUnit} guided={roofGuided} anchorClient={roofMenuAnchor?.zoneId===zone.id?{x:roofMenuAnchor.clientX,y:roofMenuAnchor.clientY}:undefined} onProject={onProject}/>}
        {zoneDimensionLayer}
        {labels}
        {selected === project.parcel?.id && vertices && onProject && vertexHandles(project.parcel.id, project.parcel.polygon)}
        {canvas.points.length > 0 && <polygon className={`zone-draft ${error ? "draft-rejected" : ""}`} points={serialize((canvas.mode === "rectangle" && canvas.cursor ? [canvas.points[0]!, { x: canvas.cursor.x, y: canvas.points[0]!.y }, canvas.cursor, { x: canvas.points[0]!.x, y: canvas.cursor.y }] : [...canvas.points, ...(canvas.cursor ? [canvas.cursor] : [])]).map(toScreen))} />}
        {canvas.mode === "polygon" && canvas.points.map((p, i) => { const q = toScreen(p), canClose = i === 0 && canvas.points.length >= 3; return <g key={i} className="draft-point" role={canClose ? "button" : undefined} aria-label={canClose ? "Tutup bentuk pada titik pertama" : undefined} tabIndex={canClose ? 0 : undefined}
          onPointerDown={canClose ? e => e.stopPropagation() : undefined} onPointerUp={canClose ? e => e.stopPropagation() : undefined} onClick={canClose ? () => canvas.create(canvas.points) : undefined} onKeyDown={canClose ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); canvas.create(canvas.points); } } : undefined}>
          <circle cx={q.x} cy={q.y} r={canClose ? 18 : 9} fill="white" fillOpacity={canClose ? .8 : 1} stroke="#345cbe" strokeWidth="2" /><text x={q.x} y={q.y + 4} textAnchor="middle" fontSize="12" fill="#24468f" pointerEvents="none">{i + 1}</text>
        </g>; })}
        {canvas.guides.map((g, i) => { const p = toScreen({ x: g.value, y: g.value }); return <line key={i} x1={g.axis === "x" ? p.x : 0} x2={g.axis === "x" ? p.x : 900} y1={g.axis === "y" ? p.y : 0} y2={g.axis === "y" ? p.y : 700} stroke="#345cbe" strokeDasharray="5 4" pointerEvents="none" />; })}
        {[...enabled].sort((a, b) => Number(a === activeIntervention) - Number(b === activeIntervention)).map((id) => {
          const c = project.components.find(c => c.id === id), target = project.zones.find(z => z.id === c?.targets[0]);
          if (!c || (!target && !c.placement)) return null;
          const site = project.zones.find(z => z.id === c.treatment?.installationZoneId);
          const biopori = c.family === 'infiltration' && c.infiltrationType === 'biopori';
          // A source roof may supply water, but Biopori itself may be installed on any non-roof zone.
          if (biopori && (!site || !bioporiInstallationAllowed(site.surface))) return null;
          const zone = site ?? target;
          const points = (zone?.polygon ?? project.parcel?.polygon ?? []).map(toScreen);
          const siblings = enabled.filter(key => { const item = project.components.find(c => c.id === key); return (item?.treatment?.installationZoneId ?? item?.targets[0]) === zone?.id; });
          const slot = siblings.indexOf(id);
          const anchor = visualLabelAnchor(points);
          const savedLocation = c.placement?.point;
          const location = markerPreview?.id === id ? markerPreview.point : savedLocation && !treatmentPlacementIssue(project, c, savedLocation) ? savedLocation : undefined;
          const offsetAnchor = { x: anchor.x + (slot - (siblings.length - 1) / 2) * 62, y: anchor.y + 45 };
          const position = location ? toScreen(location) : biopori && !containsPoint(points, offsetAnchor) ? anchor : offsetAnchor;
          return <g key={id} className="intervention-marker" aria-pressed={placement ? activeIntervention === id : undefined} data-intervention-marker={id} transform={`translate(${position.x} ${position.y})`} aria-label={`${c.name}; ${site ? `lokasi ${site.name}; ` : ''}${target ? `sumber ${target.name}` : "pilih sumber air"}`} role={placement ? "button" : "img"} tabIndex={placement ? 0 : undefined} pointerEvents={placement ? "auto" : "none"}
            onPointerDown={placement ? e => { e.preventDefault(); e.stopPropagation(); markerClick.current = true; markerDrag.current = { id, x: e.clientX, y: e.clientY, moved: false }; svg.current?.setPointerCapture(e.pointerId); } : undefined}
            onKeyDown={placement ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); placement.onEdit(id); } } : undefined}>
            {placement && <rect data-marker-hit="true" x={-Math.max(58,44 / pixelsPerUnit) / 2} y={-Math.max(48,44 / pixelsPerUnit) / 2} width={Math.max(58,44 / pixelsPerUnit)} height={Math.max(48,44 / pixelsPerUnit)} fill="transparent" stroke="none" pointerEvents="all" aria-hidden="true"/>}
            {illustratedMarkers ? <>{activeIntervention === id && <g className="marker-selection-edge" pointerEvents="none"><defs><mask id={`${uid}edge-${id}`} maskUnits="userSpaceOnUse" x="-34" y="-29" width="68" height="58"><g filter={`url(#${uid}marker-edge)`}><InterventionIllustration kind={c.family === "storage" ? "tank" : c.family === "infiltration" ? c.infiltrationType === "biopori" ? "biopori" : "soak" : c.family === "rain-garden" ? "garden" : "porous"} x={-29} y={-24} width={58} height={48}/></g></mask></defs><g mask={`url(#${uid}edge-${id})`}><rect x="-34" y="-29" width="68" height="58" fill="#25a4d0" opacity=".6"/><rect x="-34" y="-29" width="68" height="58" fill={`url(#${uid}marker-sweep)`}/></g></g>}<InterventionIllustration kind={c.family === "storage" ? "tank" : c.family === "infiltration" ? c.infiltrationType === "biopori" ? "biopori" : "soak" : c.family === "rain-garden" ? "garden" : "porous"} x={-29} y={-24} width={58} height={48}/></> : c.family === "storage" ? <><rect x="-18" y="-18" width="36" height="39" rx="8" fill="#fff" stroke="#176e83" strokeWidth="2" /><ellipse cy="-10" rx="10" ry="4" fill="#d5ecee" stroke="#176e83" /><path d="M-10-10V10q10 8 20 0V-10" fill="#d5ecee" stroke="#176e83" /></> : <><rect x="-25" y="-15" width="50" height="30" rx="12" fill="#f3f7e8" stroke="#647a40" strokeWidth="2" /><path d={c.family === "rain-garden" ? "M-14 8V-5m0 8-6-6m6 3 5-7M0 8V-6m0 10-5-5m5-1 5-5M14 8V-5" : c.family === "infiltration" ? "M-14-5H14M-10 1H10M-6 7H6" : "M-17-8H-2V0H-17ZM2-8H17V0H2ZM-7 3H8V11H-7Z"} stroke="#647a40" fill="none" /></>}
          </g>;
        })}
        {liveChip && liveMeasurement && <g
          className="live-measurement"
          data-testid="live-measurement"
          data-kind={liveMeasurement.kind}
          aria-label={`Ukuran saat ini ${liveChip.primary}${liveChip.secondary ? `, luas ${liveChip.secondary}` : ""}`}
          transform={`translate(${liveChip.x} ${liveChip.y})`}
          pointerEvents="none"
        >
          <title>{`Ukuran sementara: ${liveChip.primary}${liveChip.secondary ? ` · ${liveChip.secondary}` : ""}`}</title>
          <rect width={liveChip.width} height={liveChip.height} rx={7 / liveChip.ppu} />
          <text className="live-measurement-primary" x={10 / liveChip.ppu} y={liveChip.secondary ? 20 / liveChip.ppu : 22 / liveChip.ppu} fontSize={14 / liveChip.ppu}>{liveChip.primary}</text>
          {liveChip.secondary && <text className="live-measurement-secondary" x={10 / liveChip.ppu} y={38 / liveChip.ppu} fontSize={10.5 / liveChip.ppu}>{liveChip.secondary}</text>}
        </g>}
        </g>
      </svg>
      {!compact && (
        <div className="map-bottomline">
          <span className={`map-zone-readout ${zone ? "has-selected-zone" : ""}`}>
            {readout ? <><b className="readout-index" style={{borderColor: readout.surface ? materials[readout.surface].color : "#d4dcdf"}}>{project.zones.indexOf(readout) + 1}</b><span><strong>{zone ? "Terpilih: " : "Disorot: "}{readout.name}</strong><small>{readout.surface ? surfaceLabels[readout.surface] : "Permukaan belum dikonfirmasi"} · {readoutArea == null ? "Luas belum diketahui" : `${fmt(readoutArea)} m²`}{analytical && readoutRunoff !== undefined ? ` · ${fmt(readoutRunoff)} m³ limpasan` : ""}</small></span></> : selected === project.parcel?.id ? "Terpilih: batas persil" : null}
          </span>
      {!compact && onProject && zone && (
        <div className="map-access">
          <span>
            {vertices
              ? "Geser titik atau tambah lewat + di sisi. Shift mengunci sumbu."
              : canvas.mode !== "select" ? message : "Geser zona, atau pilih Titik untuk mengubah bentuk."}
          </span>
          <div aria-label="Geser zona tanpa menyeret">
            <button aria-label="Geser kiri" onClick={() => nudge(-.1, 0)}>
              <ArrowLeft size={14} />
            </button>
            <button aria-label="Geser atas" onClick={() => nudge(0, -.1)}>
              <ArrowUp size={14} />
            </button>
            <button aria-label="Geser bawah" onClick={() => nudge(0, .1)}>
              <ArrowDown size={14} />
            </button>
            <button aria-label="Geser kanan" onClick={() => nudge(.1, 0)}>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

          <div className="zoom-controls">
            {onInspect && zone && (
              <button className="inspect-zone" onClick={onInspect}>
                Data zona
              </button>
            )}
            <button
              aria-label="Perkecil sketsa"
              onClick={() => setZoom((v) => Math.max(0.8, v - 0.2))}
            >
              <Minus size={16} />
            </button>
            <button aria-label="Pas ke layar" onClick={() => setZoom(1)}>
              <Maximize2 size={16} aria-hidden="true" />
            </button>
            <button
              aria-label="Perbesar sketsa"
              onClick={() => setZoom((v) => Math.min(1.6, v + 0.2))}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {deleteOpen && deletable && <ContextDialog title={zone ? `Hapus ${zone.name}?` : "Hapus persil beserta semua zona?"} onClose={() => setDeleteOpen(false)}>
        <p>{zone ? "Zona ini akan dihapus dari persil." : `${project.zones.length} zona di dalam persil ini juga akan dihapus.`} Anda bisa mengembalikannya dengan Urungkan.</p>
        <p>Hujan, anggaran, dan catatan tetap tersimpan. Intervensi yang memakai zona terhapus perlu dipilihkan zona baru.</p>
        {zone && dependencies(project, selected).map((item, i) => <p key={i}>{item}</p>)}
        <div className="intervention-save-actions"><button onClick={() => setDeleteOpen(false)}>Batal</button><button className="primary" onClick={() => { canvas.remove(); setDeleteOpen(false); setHovered(null); }}>Ya, hapus {zone ? "zona" : "persil"}</button></div>
      </ContextDialog>}
      {!compact && (showGaps || ((error || message) && canvas.mode === "select")) && (
        <div className="studio-toast-stack" aria-live="polite" aria-atomic="true">
          {showGaps && <div key={coverageToastKey} className="coverage-legend studio-toast studio-toast-warning"><i />Arsiran: bagian persil yang belum menjadi zona.</div>}
          {(error || message) && canvas.mode === "select" && (
            <p key={`${error ? "error" : "message"}:${error || message}`} className={`map-message studio-toast ${error ? "studio-toast-error" : "studio-toast-transient"}`} role={error ? "alert" : "status"}>
              <Check size={14} />
              {error || message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

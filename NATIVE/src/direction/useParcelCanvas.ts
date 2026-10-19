import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Point } from "../domain/model";
import type { ProjectV2 } from "../domain/projectV2";
import { addShape, reshape, shapeById, deleteZone, deleteParcel } from "../domain/authoring";
import { alignPoint, type AlignmentGuide } from "../domain/alignment";
import { dimensionParcel, rectanglePoints, restoreParcelGeometry } from "./parcelTransactions";
import { activeVertexDimensions, constrainDelta, constrainPoint, rectangleDimensions, segmentLength } from "./studioMeasurements";

export type LiveMeasurement =
  | { kind: "segment" | "edge"; point: Point; length: number }
  | { kind: "rectangle"; point: Point; width: number; height: number; area: number };

export function useParcelCanvas(project: ProjectV2, selected: string, onSelect?: (id: string) => void, onProject?: (p: ProjectV2) => void) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [vertices, setVertices] = useState(false);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [axisLock, setAxisLock] = useState(false);
  const [align, setAlign] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [past, setPast] = useState<ProjectV2[]>([]), [future, setFuture] = useState<ProjectV2[]>([]);
  const [mode, setMode] = useState<"select" | "rectangle" | "polygon">("select");
  useEffect(() => {
    if (!message || mode !== "select") return;
    const timer = window.setTimeout(() => setMessage(""), 1500);
    return () => window.clearTimeout(timer);
  }, [message, mode]);
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [preview, setPreview] = useState<{ id: string; points: Point[] } | null>(null);
  const [liveMeasurement, setLiveMeasurement] = useState<LiveMeasurement | null>(null);
  const previewRef = useRef<typeof preview>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const drag = useRef<{ id: string; index: number | null; origin: Point; points: Point[] } | null>(null);
  const creation = useRef<Point | null>(null);
  const boundary = project.parcel?.polygon ?? [];
  const xs = boundary.map(p => p.x), ys = boundary.map(p => p.y);
  const minX = boundary.length ? Math.min(...xs) : 0, minY = boundary.length ? Math.min(...ys) : 0;
  const width = boundary.length ? Math.max(...xs) - minX : 15, height = boundary.length ? Math.max(...ys) - minY : 10;
  const scale = Math.min(650 / Math.max(.001, width), 500 / Math.max(.001, height));
  const offset = { x: 410 - width * scale / 2, y: 332 - height * scale / 2 };
  const toScreen = (p: Point): Point => ({ x: offset.x + (p.x - minX) * scale, y: offset.y + (p.y - minY) * scale });
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const at = (event: { clientX: number; clientY: number }) => {
    const matrix = (svg.current?.querySelector<SVGGElement>("[data-drawing-world]") ?? svg.current)?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: round((p.x - offset.x) / scale + minX), y: round((p.y - offset.y) / scale + minY) };
  };
  const aided = (p: Point, shift: boolean, origin?: Point, exclude?: string) => {
    const gridPoint = snap ? { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 } : p;
    const anchors = [...(project.parcel?.id !== exclude ? boundary : []), ...project.zones.filter(z => z.id !== exclude).flatMap(z => z.polygon), ...points];
    const locked = shift || (axisLock && mode === "polygon");
    const result = alignPoint(gridPoint, align ? anchors : [], 8 / scale / zoom, locked ? origin : undefined);
    setGuides(result.guides);
    const constrained = constrainPoint(origin, result.point, locked, snap);
    return { x: round(constrained.x), y: round(constrained.y) };
  };
  const apply = (edit: () => ProjectV2, success: string) => {
    if (!onProject) return false;
    try {
      const next = edit(); onProject(next);
      setPast(h => [...h.slice(-49), project]); setFuture([]); setError(""); setMessage(success);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Perubahan ditolak."); return false; }
  };
  const commit = (id: string, next: Point[]) => apply(() => reshape(project, id, next), project.zones.find(z=>z.id===id)?.geometryContext === "schematic-area" ? "Sketsa diperbarui. Luas tetap mengikuti ukuran yang Anda masukkan." : "Bentuk diperbarui. Luas mengikuti polygon.");
  const create = (polygon: Point[]) => {
    setCursor(null); setGuides([]); setLiveMeasurement(null);
    const id = crypto.randomUUID();
    if (apply(() => {
      if (!project.drawingScale) throw new Error("Nyatakan dimensi persil untuk menetapkan skala dahulu.");
      return addShape(project, id, polygon);
    }, "Zona dibuat. Pilih permukaan dan isi koefisien yang diketahui.")) {
      onSelect?.(id); setMode("select"); setPoints([]); setCursor(null); setGuides([]); return true;
    }
    return false;
  };
  const begin = (next: "rectangle" | "polygon") => {
    if (!project.parcel) { setError("Buat batas persil dari panjang × lebar terlebih dahulu."); return; }
    setMode(next); setPoints([]); setCursor(null); setLiveMeasurement(null); creation.current = null; setPreview(null); setVertices(false); setError(""); onSelect?.("");
    setMessage(next === "rectangle" ? "Tarik dari sudut awal ke sudut akhir, atau klik dua sudut zona." : "Klik tiap sudut. Tutup di titik pertama atau tekan Enter; Backspace mengurungkan titik, Esc membatalkan.");
  };
  const start = (event: PointerEvent<SVGElement>, id: string, index: number | null) => {
    if (mode !== "select") return;
    onSelect?.(id);
    event.stopPropagation();
    if (!onProject || (index === null && vertices)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const shape = shapeById(project, id);
    if (shape) drag.current = { id, index, origin: at(event), points: structuredClone(shape.polygon) };
  };
  const move = (event: PointerEvent<SVGElement>) => {
    const raw = at(event), d = drag.current;
    if (!d) {
      if (mode === "select") return;
      const p = aided(raw, event.shiftKey, points.at(-1) ?? creation.current ?? undefined);
      setCursor(p);
      if (!project.drawingScale) { setLiveMeasurement(null); return; }
      if (mode === "polygon" && points.length > 0) {
        setLiveMeasurement({ kind: "segment", point: p, length: segmentLength(points.at(-1)!, p) });
      } else if (mode === "rectangle" && points[0]) {
        setLiveMeasurement({ kind: "rectangle", point: p, ...rectangleDimensions(points[0], p) });
      } else setLiveMeasurement(null);
      return;
    }
    let next: Point[];
    if (d.index !== null) {
      const shiftOrigin = d.points[(d.index + d.points.length - 1) % d.points.length]!;
      const lockOrigin = event.shiftKey ? shiftOrigin : d.points[d.index]!;
      const p = aided(raw, event.shiftKey || axisLock, lockOrigin, d.id);
      next = d.points.map((v, i) => i === d.index ? p : v);
    } else {
      const lock = event.shiftKey || axisLock;
      const pointer = lock ? alignPoint(raw, [], 0, d.origin).point : raw;
      const delta = constrainDelta({ x: pointer.x - d.origin.x, y: pointer.y - d.origin.y }, lock, snap);
      next = d.points.map(v => ({ x: round(v.x + delta.x), y: round(v.y + delta.y) }));
    }
    previewRef.current = { id: d.id, points: next }; setPreview(previewRef.current);
    if (!project.drawingScale || d.index === null) setLiveMeasurement(null);
    else {
      const measured = activeVertexDimensions(next, d.index);
      setLiveMeasurement(measured ? { ...measured, point: next[d.index]! } : null);
    }
  };
  const end = (event: PointerEvent<SVGElement>) => {
    if (drag.current) {
      const next = previewRef.current;
      if (next) commit(next.id, next.points);
      drag.current = null; previewRef.current = null; setPreview(null); setGuides([]); setLiveMeasurement(null); return;
    }
    if (mode === "select") return;
    const p = aided(at(event), event.shiftKey, points.at(-1) ?? creation.current ?? undefined);
    if (mode === "polygon") {
      if (points.length >= 3 && Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y) * scale * zoom <= 12) { create(points); return; }
      if (points.some(v => v.x === p.x && v.y === p.y)) { setError("Titik ini sudah ada. Pilih sudut lain, atau tutup bentuk melalui titik pertama."); return; }
      setError(""); setPoints(list => [...list, p]); creation.current = null; setLiveMeasurement(null); return;
    }
    const first = points[0] ?? creation.current;
    if (!first) return;
    if (Math.hypot(first.x - p.x, first.y - p.y) * scale > 3) create(rectanglePoints(first, p));
    else { setPoints([first]); setLiveMeasurement(null); }
    creation.current = null;
  };
  const down = (event: PointerEvent<SVGElement>) => {
    svg.current?.focus({ preventScroll: true });
    if (mode === "select") { onSelect?.(""); setVertices(false); return; }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = aided(at(event), event.shiftKey, points.at(-1));
    creation.current = p;
    if (mode === "rectangle" && !points.length) { setPoints([p]); setCursor(p); }
  };
  const cancel = () => { drag.current = null; creation.current = null; previewRef.current = null; setPreview(null); setPoints([]); setCursor(null); setLiveMeasurement(null); setMode("select"); setGuides([]); setMessage(""); setError(""); };
  const undoPoint = () => { setPoints(list => list.slice(0, -1)); setCursor(null); setError(""); setGuides([]); };
  const leave = () => { if (mode !== "select") { setCursor(null); setLiveMeasurement(null); setGuides([]); } };
  const nudge = (x: number, y: number, index: number | null = null) => {
    const shape = shapeById(project, selected);
    if (shape) commit(shape.id, shape.polygon.map((p, i) => index === null || i === index ? { x: round(p.x + x), y: round(p.y + y) } : p));
  };
  const undo = () => {
    const p = past.at(-1); if (!p || !onProject) return;
    try { onProject(restoreParcelGeometry(project, p)); setPast(h => h.slice(0, -1)); setFuture(h => [...h, project]); cancel(); setError(""); setMessage("Perubahan bentuk diurungkan."); } catch (e) { setError(String(e)); }
  };
  const redo = () => {
    const p = future.at(-1); if (!p || !onProject) return;
    try { onProject(restoreParcelGeometry(project, p)); setFuture(h => h.slice(0, -1)); setPast(h => [...h, project]); cancel(); setError(""); setMessage("Perubahan bentuk diterapkan kembali."); } catch (e) { setError(String(e)); }
  };
  const remove = () => {
    if (!shapeById(project, selected)) return;
    if (apply(() => selected === project.parcel?.id ? deleteParcel(project) : deleteZone(project, selected), "Objek dihapus. Gunakan Urungkan untuk mengembalikannya; hasil terkait perlu diperiksa.")) {
      onSelect?.(""); setVertices(false);
    }
  };
  return { at, svg, zoom, setZoom, vertices, setVertices, snap, setSnap, showGrid, setShowGrid, axisLock, setAxisLock, align, setAlign, message, error, mode, points, cursor, preview, liveMeasurement, guides, toScreen, begin, start, move, end, down, leave, cancel, undoPoint, nudge, commit, create, undo, redo, remove, canUndo: !!past.length, canRedo: !!future.length,
    dimensions: (l: string, w: string) => apply(() => dimensionParcel(project, l, w), "Batas dibuat. Tambahkan zona di dalamnya."),
  };
}

import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  MousePointer2,
  Move,
  Scan,
  Undo2,
  ZoomIn,
  ZoomOut,
  Magnet,
  SquareDashedMousePointer,
} from "lucide-react";
import type { Point } from "../domain/model";
import { colors, centers, number, polygons } from "./data";
import type { Studio } from "./useStudio";

type Mode = "select" | "move" | "vertex";
const points = (polygon: Point[]) =>
  polygon.map((p) => `${p.x},${p.y}`).join(" ");
function valid(p: Point[]) {
  if (
    p.some(
      (q) =>
        !Number.isFinite(q.x) ||
        !Number.isFinite(q.y) ||
        q.x < 90 ||
        q.x > 730 ||
        q.y < 70 ||
        q.y > 595,
    )
  )
    return false;
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const n = p.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const a = p[i]!,
        b = p[(i + 1) % n]!,
        c = p[j]!,
        d = p[(j + 1) % n]!;
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0
      )
        return false;
    }
  return (
    Math.abs(
      p.reduce((sum, a, i) => {
        const b = p[(i + 1) % n]!;
        return sum + a.x * b.y - b.x * a.y;
      }, 0),
    ) > 100
  );
}

export function Spatial({
  s,
  variant = "atelier",
  small = false,
}: {
  s: Studio;
  variant?: string;
  small?: boolean;
}) {
  const pattern = useId().replace(/:/g, "");
  const [shapes, setShapes] = useState(() =>
    polygons.map((p) => p.map((q) => ({ ...q }))),
  );
  const [history, setHistory] = useState<Point[][][]>([]);
  const [mode, setMode] = useState<Mode>("select");
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(variant === 'atelier');
  const [unit, setUnit] = useState(1.5);
  const [message, setMessage] = useState(
    "Sketsa bebas · luas hitung tetap dari input",
  );
  const [guide, setGuide] = useState<Point | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const element=svg.current;
    if(!element)return;
    const update=()=>{const matrix=element.getScreenCTM();if(matrix)setUnit(1/Math.hypot(matrix.a,matrix.b));};
    const observer=new ResizeObserver(update);observer.observe(element);update();
    return ()=>observer.disconnect();
  },[zoom]);
  const drag = useRef<{
    index: number;
    vertex: number | null;
    start: Point;
    before: Point[][];
  } | null>(null);
  const coordinate = (event: PointerEvent) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const start = (
    event: PointerEvent,
    index: number,
    vertex: number | null = null,
  ) => {
    s.select(`z${index}`);
    if (mode === "select" || (mode === "vertex" && vertex === null)) return;
    event.preventDefault();
    event.stopPropagation();
    svg.current?.setPointerCapture(event.pointerId);
    drag.current = {
      index,
      vertex,
      start: coordinate(event),
      before: shapes.map((p) => p.map((q) => ({ ...q }))),
    };
  };
  const move = (event: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = coordinate(event);
    let dx = p.x - d.start.x,
      dy = p.y - d.start.y;
    if (snap) {
      dx = Math.round(dx / 10) * 10;
      dy = Math.round(dy / 10) * 10;
    }
    const next = d.before[d.index]!.map((q, i) =>
      d.vertex === null || i === d.vertex ? { x: q.x + dx, y: q.y + dy } : q,
    );
    if (!valid(next)) {
      setMessage("Bentuk ditolak: periksa titik dan batas persil.");
      return;
    }
    setShapes(d.before.map((polygon, i) => (i === d.index ? next : polygon)));
    setGuide(snap ? (next[d.vertex ?? 0] ?? null) : null);
    setMessage("Sketsa berubah · luas perhitungan tidak berubah");
  };
  const finish = () => {
    if (drag.current) {
      const before = drag.current.before;
      setHistory((h) => [...h.slice(-19), before]);
      drag.current = null;
      setGuide(null);
    }
  };
  const shift = (index: number, dx: number, dy: number) => {
    const polygon = shapes[index]?.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    if (!polygon || !valid(polygon)) return;
    setHistory((h) => [...h.slice(-19), shapes]);
    setShapes((a) => a.map((p, i) => (i === index ? polygon : p)));
    setMessage("Sketsa berubah · luas perhitungan tidak berubah");
  };
  const zoomWidth = 780 / zoom,
    zoomHeight = 590 / zoom;
  return (
    <div
      className={`spatial spatial-${variant} ${small ? "small-spatial" : ""}`}
    >
      {!small && !editing && <button className="open-sketch-tools" onClick={()=>setEditing(true)}><SquareDashedMousePointer size={16}/> Ubah sketsa</button>}
      {!small && editing && (
        <div className="map-tools" aria-label="Alat sketsa">
          {(
            [
              { id: "select", label: "Pilih zona", icon: MousePointer2 },
              { id: "move", label: "Geser zona", icon: Move },
              {
                id: "vertex",
                label: "Edit titik",
                icon: SquareDashedMousePointer,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={mode === t.id ? "active" : ""}
              aria-pressed={mode === t.id}
              title={t.label}
              aria-label={t.label}
              onClick={() => {
                setMode(t.id);
                setMessage(
                  t.id === "vertex"
                    ? "Tarik titik sudut zona terpilih."
                    : t.id === "move"
                      ? "Tarik zona, atau gunakan tombol panah saat zona fokus."
                      : "Pilih zona untuk melihat data.",
                );
              }}
            >
              <t.icon size={19} />
              <span>{t.label}</span>
            </button>
          ))}
          <span className="tool-separator" />
          <button
            aria-label="Tempel ke grid sketsa"
            title="Tempel ke grid sketsa"
            aria-pressed={snap}
            className={snap ? "active" : ""}
            onClick={() => setSnap(!snap)}
          >
            <Magnet size={18} />
          </button>
          <button
            aria-label="Urungkan perubahan sketsa"
            title="Urungkan"
            disabled={!history.length}
            onClick={() => {
              const previous = history.at(-1);
              if (previous) setShapes(previous);
              setHistory((h) => h.slice(0, -1));
              setMessage("Perubahan sketsa diurungkan.");
            }}
          >
            <Undo2 size={18} />
          </button>
        </div>
      )}
      <svg
        ref={svg}
        className={`site-drawing mode-${mode}`}
        viewBox={`${410 - zoomWidth / 2} ${330 - zoomHeight / 2} ${zoomWidth} ${zoomHeight}`}
        aria-label="Studio Persil skematis, lima zona"
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <defs>
          <pattern
            id={`${pattern}-grid`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".7" fill="currentColor" opacity=".2" />
          </pattern>
          <pattern
            id={`${pattern}-roof`}
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0V16 M8 0V16"
              stroke="#554f43"
              strokeWidth="1"
              opacity=".22"
            />
          </pattern>
          <pattern
            id={`${pattern}-paved`}
            width="34"
            height="34"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0H34V34"
              stroke="#5e635d"
              fill="none"
              strokeWidth=".8"
              opacity=".2"
            />
          </pattern>
          <pattern
            id={`${pattern}-vegetation`}
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="m5 16 3-6 3 6m7 7 2-4 2 4"
              fill="none"
              stroke="#486842"
              opacity=".32"
            />
          </pattern>
          <pattern
            id={`${pattern}-soil`}
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="5" cy="6" r="1" fill="#8b623d" />
            <circle cx="14" cy="15" r=".8" fill="#8b623d" />
          </pattern>
          <pattern
            id={`${pattern}-porous`}
            width="18"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0H18V12H0ZM9 0V12"
              stroke="#496365"
              strokeWidth=".7"
              fill="none"
              opacity=".35"
            />
          </pattern>
        </defs>
        <rect
          x="-300"
          y="-300"
          width="1500"
          height="1500"
          fill={`url(#${pattern}-grid)`}
        />
        <path className="parcel-ground" d="M85 65H735V600H85Z" />
        <path d="M85 623H735" className="site-edge" />
        <text x="410" y="644" textAnchor="middle" className="street-label">
          SISI AKSES · ILUSTRASI SKEMATIS
        </text>
        {s.project.zones.map((zone, i) => {
          const polygon = shapes[i] ?? [];
          const initial = polygons[i] ?? [];
          const offset = {
            x: (polygon[0]?.x ?? 0) - (initial[0]?.x ?? 0),
            y: (polygon[0]?.y ?? 0) - (initial[0]?.y ?? 0),
          };
          const center = centers[i]!;
          const selected = s.selected === zone.id;
          const unknown =
            s.project.parameters.find((p) => p.id === zone.coefficient.id)
              ?.value === null;
          const contribution = s.baseline.ok
            ? s.baseline.value.zones.find((z) => z.id === zone.id)?.runoffM3
            : null;
          return (
            <g
              key={zone.id}
              className={`site-zone ${selected ? "selected" : ""}`}
              data-zone={zone.id}
              role="button"
              tabIndex={0}
              aria-label={`Zona ${zone.name}${unknown ? ", koefisien belum diketahui" : ""}`}
              aria-pressed={selected}
              onPointerDown={(e) => start(e, i)}
              onClick={() => s.select(zone.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  s.select(zone.id);
                }
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  shift(
                    i,
                    e.key === "ArrowLeft"
                      ? -10
                      : e.key === "ArrowRight"
                        ? 10
                        : 0,
                    e.key === "ArrowUp" ? -10 : e.key === "ArrowDown" ? 10 : 0,
                  );
                }
              }}
            >
              <polygon
                className="zone-body"
                points={points(polygon)}
                fill={colors[zone.surface ?? "soil"]}
              />
              <polygon
                points={points(polygon)}
                fill={`url(#${pattern}-${zone.surface})`}
                pointerEvents="none"
              />
              {s.overlay && contribution != null && (
                <polygon
                  points={points(polygon)}
                  className="water-tint"
                  style={{
                    opacity:
                      0.12 +
                      (contribution /
                        Math.max(
                          1,
                          s.baseline.ok ? s.baseline.value.runoffM3 : 1,
                        )) *
                        0.65,
                  }}
                />
              )}
              <g
                className="zone-caption"
                transform={`translate(${center.x + offset.x} ${center.y + offset.y})`}
                pointerEvents="none"
              >
                <text textAnchor="middle" className="zone-name" style={{fontSize:12*unit}}>
                  {zone.name}
                </text>
                <text textAnchor="middle" y={18*unit} className="zone-data" style={{fontSize:10.5*unit}}>
                  {s.overlay
                    ? contribution != null
                      ? `${number(contribution)} m³ / kejadian`
                      : "Belum dihitung"
                    : unknown
                      ? "C belum diketahui"
                      : `${number(s.project.parameters.find((p) => p.id === zone.area.id)?.value ?? 0)} m² · data demo`}
                </text>
              </g>
              <g
                className="zone-number"
                transform={`translate(${center.x + offset.x} ${center.y + offset.y})`}
                pointerEvents="none"
              >
                <circle r={13*unit} />
                <text textAnchor="middle" y={4*unit} style={{fontSize:12*unit}}>
                  {i + 1}
                  {unknown ? "?" : ""}
                </text>
              </g>
              {selected &&
                mode === "vertex" &&
                polygon.map((p, j) => (
                  <circle
                    key={j}
                    className="vertex"
                    cx={p.x}
                    cy={p.y}
                    r={7*unit}
                    onPointerDown={(e) => start(e, i, j)}
                    aria-hidden="true"
                  />
                ))}
            </g>
          );
        })}
        {s.options.includes("tank") && (
          <g
            className="intervention-symbol"
            transform="translate(365 252)"
            pointerEvents="none"
          >
            <circle r="24" />
            <path d="M-11-10Q0-15 11-10V10Q0 15-11 10ZM-11-10Q0-4 11-10M-11 7Q0 13 11 7" />
            <text x="33" y="4">
              T · 6 m³
            </text>
          </g>
        )}
        {s.options.includes("garden") && (
          <g
            className="intervention-symbol garden-symbol"
            transform="translate(405 445)"
            pointerEvents="none"
          >
            <rect x="-23" y="-19" width="46" height="38" rx="8" />
            <path d="M0 11V-6M0 1Q-14-13-16-4Q-10 4 0 1M0-4Q15-15 15-7Q10-1 0-4" />
            <text x="33" y="5">
              H · 9 m³
            </text>
          </g>
        )}
        {guide && (
          <g className="snap-guide" pointerEvents="none">
            <path d={`M${guide.x} 65V600M85 ${guide.y}H735`} />
          </g>
        )}
      </svg>
      {!small && (
        <>
          <div className="map-bottom">
            <span className="map-status" role="status">
              {message}
            </span>
            <div className="zoom-tools">
              <button
                aria-label="Perkecil sketsa"
                onClick={() => setZoom((z) => Math.max(0.85, z - 0.15))}
              >
                <ZoomOut size={17} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Perbesar sketsa"
                onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
              >
                <ZoomIn size={17} />
              </button>
              <button
                aria-label="Tampilkan seluruh persil"
                onClick={() => setZoom(1)}
              >
                <Scan size={17} />
              </button>
            </div>
          </div>
          <div className="mobile-selection">
            Zona {Number(s.selected.slice(1)) + 1} · {s.zone.name}
          </div>
        </>
      )}
    </div>
  );
}

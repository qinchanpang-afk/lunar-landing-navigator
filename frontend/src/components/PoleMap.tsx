import { useEffect, useRef, useState } from "react";
import { Map as MapIcon, MapPinPlus, X } from "lucide-react";
import type { SiteMeta } from "../lib/types";
import { polarLatLon, polarXY } from "../lib/geo";

interface Layer { file: string; x0_m: number; y0_m: number; size_m: number; px: number }
interface BasemapMeta { source: string; layers: { region: Layer; pole: Layer } }

const BASE = `${import.meta.env.BASE_URL}data/basemap/`;
let metaP: Promise<BasemapMeta> | null = null;
const loadMeta = () => (metaP ??= fetch(`${BASE}basemap.json`).then((r) => r.json()));

const RAMP = ["#4a3510", "#94640c", "#dc9a1c", "#fbd37c", "#fde9b8"];
const sunColor = (pct: number) => RAMP[Math.min(RAMP.length - 1, Math.floor((pct / 100) * RAMP.length))];

interface Props {
  sites: SiteMeta[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPickPoint: (lat: number, lon: number) => void;
}

export default function PoleMap({ sites, selectedId, onSelect, onPickPoint }: Props) {
  const [meta, setMeta] = useState<BasemapMeta | null>(null);
  const [which, setWhich] = useState<"region" | "pole">("region");
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [pick, setPick] = useState<[number, number] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadMeta().then(setMeta).catch(() => setMeta(null));
  }, []);
  useEffect(() => setPick(null), [which]);

  if (!meta) return <div className="h-64 grid place-items-center text-xs text-slate-500">Loading map…</div>;
  const L = meta.layers[which];
  const S = L.size_m;
  const toSvg = (lat: number, lon: number) => {
    const [x, y] = polarXY(lat, lon);
    return [x - L.x0_m, L.y0_m - y] as const;
  };
  const inside = ([sx, sy]: readonly [number, number]) => sx >= 0 && sy >= 0 && sx <= S && sy <= S;
  const eventLatLon = (e: React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * S;
    const sy = ((e.clientY - r.top) / r.height) * S;
    return polarLatLon(sx + L.x0_m, L.y0_m - sy);
  };

  const polar = sites.filter((s) => s.lat <= -80);
  const offMap = sites.filter((s) => s.lat > -80);
  const u = S / 1000; // 1 viewBox unit per 0.1% of the map width
  const rings = which === "region" ? [-87.5, -85] : [-89.5, -89, -88.5];
  const center = toSvg(-90, 0);

  return (
    <section className="rounded-lg border border-space-700 bg-space-900/80 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MapIcon size={15} className="text-sky-300" />
        <h3 className="text-sm font-semibold text-slate-200">South-pole map</h3>
        <span className="text-[11px] text-slate-500">LOLA shaded relief · click a marker to open a site, or anywhere else to analyse that spot</span>
        <div className="ml-auto flex overflow-hidden rounded-md border border-space-600 text-[11px]">
          {([["region", "Pole ±160 km"], ["pole", "Pole ±48 km"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setWhich(k)} className={`px-2 py-1 ${which === k ? "bg-sky-500/20 text-sky-200" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[760px]">
        <img src={`${BASE}${L.file}`} alt={`Shaded relief of the lunar south pole (${which})`} className="block w-full rounded-md" draggable={false} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${S} ${S}`}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onMouseMove={(e) => setCursor(eventLatLon(e))}
          onMouseLeave={() => setCursor(null)}
          onClick={(e) => setPick(eventLatLon(e))}
        >
          {/* graticule */}
          {rings.map((lat) => {
            const r = Math.hypot(...polarXY(lat, 0));
            return (
              <g key={lat}>
                <circle cx={center[0]} cy={center[1]} r={r} fill="none" stroke="#e2e8f0" strokeOpacity={0.25} strokeWidth={1.2 * u} strokeDasharray={`${6 * u} ${6 * u}`} />
                <text x={center[0] + 4 * u} y={center[1] - r - 4 * u} fill="#e2e8f0" fillOpacity={0.6} fontSize={15 * u}>{lat}°</text>
              </g>
            );
          })}
          {[0, 90, 180, 270].map((lon) => {
            const [ex, ey] = toSvg(which === "region" ? -84.75 : -88.4, lon);
            return (
              <g key={lon}>
                <line x1={center[0]} y1={center[1]} x2={ex} y2={ey} stroke="#e2e8f0" strokeOpacity={0.18} strokeWidth={u} />
                <text
                  x={center[0] + (ex - center[0]) * 0.93} y={center[1] + (ey - center[1]) * 0.93}
                  fill="#e2e8f0" fillOpacity={0.6} fontSize={15 * u} textAnchor="middle" dominantBaseline="middle"
                >{lon}°E</text>
              </g>
            );
          })}
          <circle cx={center[0]} cy={center[1]} r={3 * u} fill="#e2e8f0" />

          {polar.map((s) => {
            const p = toSvg(s.lat, s.lon);
            if (!inside(p)) return null;
            const sel = s.id === selectedId;
            const custom = s.region === "Custom";
            const label = s.name.split(" (")[0];
            const left = p[0] < center[0]; // label away from the pole to reduce overlaps
            return (
              <g
                key={s.id} className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onSelect(s.id); }}
              >
                <title>{`${s.name}\nSunlight ${s.stats.sunlight_pct.toFixed(1)}% · DTE ${s.stats.dte_pct.toFixed(1)}%`}</title>
                <circle cx={p[0]} cy={p[1]} r={(sel ? 11 : 8) * u} fill={sunColor(s.stats.sunlight_pct)} stroke={sel ? "#7dd3fc" : "#0b0e18"} strokeWidth={(sel ? 3 : 2) * u} />
                {custom && <circle cx={p[0]} cy={p[1]} r={3 * u} fill="#0b0e18" />}
                <text
                  x={p[0] + (left ? -13 : 13) * u} y={p[1] + 5 * u} fontSize={15 * u} fill="#f8fafc" textAnchor={left ? "end" : "start"}
                  stroke="#0b0e18" strokeWidth={4 * u} paintOrder="stroke" fontWeight={sel ? 600 : 400}
                >
                  {label} · {s.stats.sunlight_pct.toFixed(0)}%
                </text>
              </g>
            );
          })}

          {pick && inside(toSvg(pick[0], pick[1])) && (
            <g pointerEvents="none">
              <circle cx={toSvg(...pick)[0]} cy={toSvg(...pick)[1]} r={9 * u} fill="none" stroke="#7dd3fc" strokeWidth={3 * u} />
              <circle cx={toSvg(...pick)[0]} cy={toSvg(...pick)[1]} r={2 * u} fill="#7dd3fc" />
            </g>
          )}
        </svg>

        {cursor && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-space-950/85 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">
            {cursor[0].toFixed(4)}°, {cursor[1].toFixed(3)}°E
          </div>
        )}
        {pick && (
          <div className="absolute right-2 top-2 w-60 rounded-md border border-sky-400/40 bg-space-950/95 p-2.5 text-xs text-slate-200 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono">{pick[0].toFixed(4)}°, {pick[1].toFixed(3)}°E</span>
              <button type="button" onClick={() => setPick(null)} className="text-slate-500 hover:text-slate-300" aria-label="Close"><X size={13} /></button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Ray-trace the horizon here and fetch 2 years of Sun/Earth positions from JPL Horizons (about 10–20 s).</p>
            <button
              type="button"
              onClick={() => { onPickPoint(pick[0], pick[1]); setPick(null); }}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-500/20 px-2 py-1.5 font-medium text-sky-100 hover:bg-sky-500/30"
            >
              <MapPinPlus size={13} /> Analyse this spot
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">marker colour = sunlight 2026–27
          {RAMP.map((c, i) => <span key={c} className="inline-block h-2.5 w-4" style={{ background: c }} title={`${i * 20}–${i * 20 + 20}%`} />)}
          <span className="font-mono">0 → 100%</span>
        </span>
        <span>dot in marker = your custom site</span>
        {offMap.length > 0 && (
          <span className="text-slate-500">
            Not on this map (outside the polar DEM): {offMap.map((s, i) => (
              <button key={s.id} type="button" onClick={() => onSelect(s.id)} className="text-sky-300 hover:underline">{i ? ", " : ""}{s.name.split(" (")[0]}</button>
            ))}
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-slate-600">{meta.source}. Polar stereographic, 0°E toward the top.</p>
    </section>
  );
}

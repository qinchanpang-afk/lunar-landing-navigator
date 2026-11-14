import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPinPlus, Radar, X } from "lucide-react";
import type { SiteDetail } from "../lib/types";
import { scanNearby, type NearbyCell } from "../lib/nearby";
import { compass, fmtDuration } from "../lib/time";

type Metric = "sunPct" | "bothPct" | "dtePct";
const METRICS: [Metric, string][] = [["sunPct", "Sunlight %"], ["bothPct", "Sun + DTE %"], ["dtePct", "DTE %"]];
const AREAS: [number, string][] = [[500, "±0.5 km"], [1000, "±1 km"], [2000, "±2 km"]];
const N = 11;
const MAX_SLOPE = 10;

/** Single-hue sequential ramp (amber), dark = low, bright = high, for the dark chart surface. */
const RAMP = ["#2a2112", "#4a3510", "#6e4c0e", "#94640c", "#b97d0d", "#dc9a1c", "#f2b845", "#fbd37c", "#fde9b8"];
function ramp(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  return RAMP[Math.round(x)];
}

interface Props {
  site: SiteDetail;
  onAddCustom: (lat: number, lon: number, name: string) => void;
  /** external request to scan straight away (first-screen "Find a better spot") */
  autoRun?: { siteId: string; half: number; nonce: number } | null;
}

export default function NearbyScan({ site, onAddCustom, autoRun }: Props) {
  const [half, setHalf] = useState(1000);
  const [metric, setMetric] = useState<Metric>("sunPct");
  const [safeOnly, setSafeOnly] = useState(true);
  const [cells, setCells] = useState<NearbyCell[]>([]);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<NearbyCell | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scannedFor = useRef("");

  // A new site or area invalidates the result.
  useEffect(() => {
    abort.current?.abort();
    setCells([]);
    setProgress(null);
    setErr(null);
    setHover(null);
  }, [site.id, half]);

  const pendingAuto = useRef<number | null>(null);
  useEffect(() => {
    if (!autoRun) return;
    pendingAuto.current = autoRun.nonce;
    setHalf(autoRun.half);
  }, [autoRun?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fires after the reset effect above, once the requested site and area are in place.
  useEffect(() => {
    if (pendingAuto.current == null || !autoRun || site.id !== autoRun.siteId || half !== autoRun.half) return;
    pendingAuto.current = null;
    run();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setCells([]);
    setErr(null);
    scannedFor.current = `${site.id}|${half}`;
    const acc: NearbyCell[] = [];
    try {
      await scanNearby(site, half, N, (c, done, total) => {
        acc.push(c);
        setCells([...acc]);
        setProgress([done, total]);
      }, ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (abort.current === ac) setProgress(null);
    }
  };

  const centre = cells.find((c) => c.i === (N - 1) / 2 && c.j === (N - 1) / 2);
  const done = cells.length === N * N;
  const [lo, hi] = useMemo(() => {
    if (!cells.length) return [0, 100];
    const v = cells.map((c) => c[metric]);
    return [Math.min(...v), Math.max(...v)];
  }, [cells, metric]);
  const best = useMemo(() => {
    const pool = cells.filter((c) => !safeOnly || c.slopeDeg <= MAX_SLOPE);
    return pool.reduce<NearbyCell | null>((b, c) => (!b || c[metric] > b[metric] ? c : b), null);
  }, [cells, metric, safeOnly]);

  const W = 330;
  const cs = W / N;
  const unit = metric === "sunPct" ? "sunlight" : metric === "bothPct" ? "Sun + DTE" : "DTE";
  const pctStr = (v: number) => `${v.toFixed(1)}%`;

  if (site.lat > -80) {
    return null;
  }

  return (
    <section className="rounded-lg border border-space-700 bg-space-900/80 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Radar size={15} className="text-amber-300" />
        <h3 className="text-sm font-semibold text-slate-200">Best nearby spot</h3>
        <span className="text-[11px] text-slate-400">re-traces the horizon at {N}×{N} points around the site · same Horizons ephemeris</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select value={half} onChange={(e) => setHalf(Number(e.target.value))} className="rounded border border-space-600 bg-space-800 px-1.5 py-1 text-slate-200" aria-label="Scan area">
          {AREAS.map(([v, l]) => <option key={v} value={v}>{l} ({((2 * v) / (N - 1)).toFixed(0)} m grid)</option>)}
        </select>
        <div className="flex overflow-hidden rounded-md border border-space-600 text-[11px]">
          {METRICS.map(([v, l]) => (
            <button key={v} type="button" onClick={() => setMetric(v)} className={`px-2 py-1 ${metric === v ? "bg-amber-500/20 text-amber-100" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}>{l}</button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1 text-[11px] text-slate-300">
          <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} className="accent-amber-400" />
          lander-safe only (slope ≤ {MAX_SLOPE}°)
        </label>
        {progress ? (
          <button type="button" onClick={() => abort.current?.abort()} className="ml-auto inline-flex items-center gap-1 rounded-md border border-space-600 px-2 py-1 text-slate-300 hover:bg-space-700">
            <Loader2 size={13} className="animate-spin" /> {progress[0]}/{progress[1]} · cancel <X size={12} />
          </button>
        ) : (
          <button type="button" onClick={run} className="ml-auto rounded-md bg-amber-500/20 px-3 py-1 font-medium text-amber-100 hover:bg-amber-500/30">
            {cells.length && scannedFor.current === `${site.id}|${half}` ? "Re-scan" : "Scan area"}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-[11px] text-rose-300" role="alert">{err}</p>}

      {cells.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4">
          <div className="relative" style={{ width: W }}>
            <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} role="img" aria-label={`${unit} heat map around ${site.name}`} onMouseLeave={() => setHover(null)}>
              <rect width={W} height={W} fill="#0b0e18" />
              {cells.map((c) => {
                const unsafe = c.slopeDeg > MAX_SLOPE;
                return (
                  <g key={`${c.i}_${c.j}`} onMouseEnter={() => setHover(c)}>
                    <rect
                      x={c.i * cs + 1} y={c.j * cs + 1} width={cs - 2} height={cs - 2} rx={3}
                      fill={ramp(hi > lo ? (c[metric] - lo) / (hi - lo) : 1)}
                      opacity={safeOnly && unsafe ? 0.35 : 1}
                    />
                    {safeOnly && unsafe && (
                      <line x1={c.i * cs + 4} y1={c.j * cs + cs - 4} x2={c.i * cs + cs - 4} y2={c.j * cs + 4} stroke="#0b0e18" strokeWidth={1.5} />
                    )}
                  </g>
                );
              })}
              {centre && (
                <circle cx={(centre.i + 0.5) * cs} cy={(centre.j + 0.5) * cs} r={cs / 2 - 3} fill="none" stroke="#e2e8f0" strokeWidth={2} />
              )}
              {best && done && (
                <path
                  d={`M${(best.i + 0.5) * cs} ${best.j * cs + 5} l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z`}
                  fill="#0b0e18" stroke="#fde9b8" strokeWidth={1.5}
                />
              )}
              {hover && <rect x={hover.i * cs} y={hover.j * cs} width={cs} height={cs} fill="none" stroke="#7dd3fc" strokeWidth={2} rx={3} />}
            </svg>
            {hover && (
              <div className="pointer-events-none absolute left-2 top-5 rounded-md border border-space-600 bg-space-950/95 px-2 py-1.5 text-[11px] leading-snug text-slate-200 shadow-lg">
                <div className="font-mono text-slate-400">{hover.lat.toFixed(4)}°, {hover.lon.toFixed(3)}°E</div>
                <div>{hover.distKm < 0.01 ? "site centre" : `${(hover.distKm * 1000).toFixed(0)} m ${compass(hover.bearingDeg)} of site`}</div>
                <div>Sunlight <span className="font-mono">{pctStr(hover.sunPct)}</span> · DTE <span className="font-mono">{pctStr(hover.dtePct)}</span></div>
                <div>Sun + DTE <span className="font-mono">{pctStr(hover.bothPct)}</span> · max shadow <span className="font-mono">{fmtDuration(hover.maxShadowH)}</span></div>
                <div>Slope <span className={`font-mono ${hover.slopeDeg > MAX_SLOPE ? "text-rose-300" : ""}`}>{hover.slopeDeg.toFixed(1)}°</span> · ground <span className="font-mono">{(hover.groundM / 1000).toFixed(3)} km</span></div>
              </div>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-mono">{pctStr(lo)}</span>
              <div className="h-2 flex-1 rounded-sm" style={{ background: `linear-gradient(90deg, ${RAMP.join(",")})` }} />
              <span className="font-mono">{pctStr(hi)}</span>
              <span>{unit}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
              <span>map up = toward 0°E</span><span>○ site</span><span>☆ best {safeOnly ? "safe " : ""}cell</span>{safeOnly && <span>struck-out = slope &gt; {MAX_SLOPE}°</span>}
            </div>
          </div>

          <div className="min-w-[220px] flex-1 space-y-2 text-[12px] text-slate-300">
            {!done ? (
              <p className="text-slate-400">Scanning… cells fill in from the centre outward.</p>
            ) : best && centre ? (
              <>
                <div className="rounded-md border border-amber-400/25 bg-amber-500/5 p-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-amber-200">Best {safeOnly ? "lander-safe " : ""}cell by {unit}</div>
                  <div className="mt-1 text-lg font-semibold text-amber-100">
                    {pctStr(best[metric])}{" "}
                    <span className={`text-sm font-normal ${best[metric] - centre[metric] > 0.05 ? "text-emerald-300" : "text-slate-400"}`}>
                      ({best[metric] - centre[metric] >= 0 ? "+" : ""}{(best[metric] - centre[metric]).toFixed(1)} pp vs site)
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {best.distKm < 0.01 ? "The site itself is already the best cell." : `${(best.distKm * 1000).toFixed(0)} m ${compass(best.bearingDeg)} (bearing ${best.bearingDeg.toFixed(0)}°) · slope ${best.slopeDeg.toFixed(1)}° · max shadow ${fmtDuration(best.maxShadowH)} (site ${fmtDuration(centre.maxShadowH)})`}
                  </div>
                  {best.distKm >= 0.01 && (
                    <button
                      type="button"
                      onClick={() => onAddCustom(best.lat, best.lon, `${site.name.split(" (")[0]} – best nearby`)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-2 py-1 text-xs text-sky-100 hover:bg-sky-500/30"
                    >
                      <MapPinPlus size={13} /> Analyse this spot as a custom site
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Range across the {N * N} cells: {pctStr(lo)} – {pctStr(hi)} {unit}. A few hundred metres can change the power budget
                  as much as choosing a different region. Uses the browser's hybrid 80 m / 160 m LOLA horizon (validated within 0.1 pp of the
                  full-resolution pipeline); grid spacing is in polar-stereographic metres.
                </p>
              </>
            ) : (
              <p className="text-slate-400">No cell meets the slope limit in this area — untick “lander-safe only” or widen the area.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

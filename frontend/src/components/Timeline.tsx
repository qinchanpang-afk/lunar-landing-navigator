import { memo, useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from "recharts";
import type { SiteDetail } from "../lib/types";
import { clamp, fmtUTC, maskAt, startMs, spanHours } from "../lib/time";
import type { PanelMode } from "./StatusCards";

interface Props {
  site: SiteDetail;
  tH: number;
  onSeek: (tH: number) => void;
  windowDays: number;
  panel: PanelMode;
}

const AXIS_L = 44;
const AXIS_R = 40;

interface Pt {
  t: number;
  sunEl: number;
  horizon: number;
  earthEl: number;
  pwr: number;
}

const Chart = memo(function Chart({ data, t0ms, onSeek, domain, yDomain }: {
  data: Pt[]; t0ms: number; onSeek: (t: number) => void; domain: [number, number]; yDomain: [number, number];
}) {
  const days = (domain[1] - domain[0]) / 24;
  const tickEvery = days <= 35 ? 5 * 24 : days <= 100 ? 15 * 24 : 60 * 24;
  const ticks: number[] = [];
  for (let t = Math.ceil(domain[0] / tickEvery) * tickEvery; t <= domain[1]; t += tickEvery) ticks.push(t);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
        onClick={(e) => {
          if (e && e.activeLabel != null) onSeek(Number(e.activeLabel));
        }}
      >
        <CartesianGrid stroke="#1c2538" vertical={false} />
        <XAxis
          dataKey="t" type="number" domain={domain} ticks={ticks} allowDataOverflow
          tickFormatter={(t) => fmtUTC(t0ms + t * 3_600_000, false).slice(5)}
          stroke="#64748b" fontSize={11}
        />
        <YAxis yAxisId="el" width={AXIS_L} stroke="#64748b" fontSize={11} domain={yDomain} tickFormatter={(v) => `${v}°`} allowDataOverflow />
        <YAxis yAxisId="p" orientation="right" width={AXIS_R} stroke="#64748b" fontSize={11} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
        <Tooltip
          contentStyle={{ background: "#0a0e18", border: "1px solid #2a3550", fontSize: 12 }}
          labelFormatter={(t) => fmtUTC(t0ms + Number(t) * 3_600_000)}
          formatter={(v: number, name: string) => [name === "Power" ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(2)}°`, name]}
        />
        <Area yAxisId="p" type="stepAfter" dataKey="pwr" name="Power" stroke="#ffc23d" strokeOpacity={0.4} fill="#ffc23d" fillOpacity={0.12} isAnimationActive={false} />
        <Line yAxisId="el" type="monotone" dataKey="horizon" name="Terrain at Sun az" stroke="#94a3b8" strokeDasharray="4 3" dot={false} strokeWidth={1} isAnimationActive={false} />
        <Line yAxisId="el" type="monotone" dataKey="sunEl" name="Sun elevation" stroke="#ffc23d" dot={false} strokeWidth={1.6} isAnimationActive={false} />
        <Line yAxisId="el" type="monotone" dataKey="earthEl" name="Earth elevation" stroke="#4fa8ff" dot={false} strokeWidth={1.6} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
});

/** Sunlit / DTE availability strips rendered as SVG runs. */
const Strips = memo(function Strips({ site, i0, i1, onSeek }: { site: SiteDetail; i0: number; i1: number; onSeek: (t: number) => void }) {
  const step = site.time.step_h;
  const n = i1 - i0;
  const runs = (vis: number[]) => {
    const out: [number, number][] = [];
    let s = -1;
    for (let i = i0; i <= i1; i++) {
      if (vis[i] && s < 0) s = i;
      if ((!vis[i] || i === i1) && s >= 0) {
        out.push([s - i0, (vis[i] ? i + 1 : i) - i0]);
        s = -1;
      }
    }
    return out;
  };
  const rows: [string, number[], string][] = [["Sunlit", site.sun.vis, "#ffc23d"], ["DTE", site.earth.vis, "#4fa8ff"]];
  return (
    <div style={{ paddingLeft: AXIS_L, paddingRight: AXIS_R }} className="space-y-1 mt-1">
      {rows.map(([label, vis, color]) => (
        <div key={label} className="relative">
          <span className="absolute -left-11 top-0 text-[11px] text-slate-400 w-10 text-right">{label}</span>
          <svg
            viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" className="w-full h-3 rounded-sm bg-space-800 cursor-pointer"
            onClick={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              onSeek((i0 + ((e.clientX - r.left) / r.width) * n) * step);
            }}
          >
            {runs(vis).map(([a, b]) => (
              <rect key={a} x={a} y={0} width={b - a} height={1} fill={color} opacity={0.8} />
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
});

export default function Timeline({ site, tH, onSeek, windowDays, panel }: Props) {
  const W = windowDays * 24;
  const span = spanHours(site);
  const [winStart, setWinStart] = useState(() => clamp(tH - W / 2, 0, Math.max(0, span - W)));

  // Page-flip the window only when the cursor leaves its central band (keeps playback smooth).
  useEffect(() => {
    if (tH < winStart + W * 0.05 || tH > winStart + W * 0.95 || winStart + W > span + site.time.step_h) {
      setWinStart(clamp(tH - W / 2, 0, Math.max(0, span - W)));
    }
  }, [tH, W, span, winStart, site.time.step_h]);

  const step = site.time.step_h;
  const i0 = Math.max(0, Math.floor(winStart / step));
  const i1 = Math.min(site.time.n - 1, Math.ceil((winStart + W) / step));

  const { data, yDomain } = useMemo(() => {
    const stride = Math.max(1, Math.ceil((i1 - i0) / 900));
    const pts: Pt[] = [];
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = i0; i <= i1; i += stride) {
      const p: Pt = {
        t: i * step,
        sunEl: site.sun.el[i],
        horizon: Number(maskAt(site.horizon_mask_deg, site.sun.az[i]).toFixed(2)),
        earthEl: site.earth.el[i],
        pwr: panel === "horizontal" ? site.sun.pwr[i] : site.sun.pwr_v[i],
      };
      pts.push(p);
      for (const v of [p.sunEl, p.horizon, p.earthEl]) {
        if (v > -15) lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    const yDomain: [number, number] = [Math.floor(Math.max(lo, -15) - 1), Math.ceil(hi + 1)];
    return { data: pts, yDomain };
  }, [site, i0, i1, step, panel]);

  const frac = clamp((tH - i0 * step) / ((i1 - i0) * step || 1), 0, 1);

  return (
    <div className="relative select-none">
      <div className="relative">
        <Chart data={data} t0ms={startMs(site)} onSeek={onSeek} domain={[i0 * step, i1 * step]} yDomain={yDomain} />
        <div
          className="pointer-events-none absolute top-2 bottom-6 w-px bg-white/70"
          style={{ left: `calc(${AXIS_L}px + (100% - ${AXIS_L + AXIS_R}px) * ${frac})` }}
        />
      </div>
      <Strips site={site} i0={i0} i1={i1} onSeek={onSeek} />
    </div>
  );
}

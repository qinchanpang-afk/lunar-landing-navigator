import { useMemo, useState } from "react";
import { BatteryCharging, CalendarClock, Rocket } from "lucide-react";
import type { SiteDetail } from "../lib/types";
import { landingWindows, longestShadowIn, type Need } from "../lib/planner";
import { fmtDuration, fmtUTC } from "../lib/time";

interface Props {
  site: SiteDetail;
  tH: number;
  t0ms: number;
  setTH: (t: number) => void;
}

const num = "w-20 rounded border border-space-600 bg-space-800 px-1.5 py-0.5 font-mono text-xs text-slate-100 focus:border-sky-400/60 focus:outline-none";
/** Pack-level specific energy assumed for the mass estimate (Li-ion, incl. housing/thermal). */
const WH_PER_KG = 150;

export default function MissionPlanner({ site, tH, t0ms, setTH }: Props) {
  const [need, setNeed] = useState<Need>("both");
  const [minDays, setMinDays] = useState(4);
  const [missionDays, setMissionDays] = useState(14);
  const [loadW, setLoadW] = useState(100);
  const [dod, setDod] = useState(80);
  const [landingH, setLandingH] = useState<number | null>(null);

  const spanH = (site.time.n - 1) * site.time.step_h;
  const reqH = Math.max(2, minDays * 24);
  const windows = useMemo(() => landingWindows(site, need, reqH), [site, need, reqH]);
  const upcoming = windows.filter((w) => w.closeH >= tH);
  const first = upcoming[0];
  const second = upcoming[1];
  const yearsH = spanH;
  const openFrac = windows.reduce((a, w) => a + (w.closeH - w.openH + site.time.step_h), 0) / yearsH;

  const land = landingH ?? (first ? Math.max(first.openH, tH) : tH);
  const missionH = Math.max(1, missionDays) * 24;
  const shadowH = longestShadowIn(site, land, missionH);
  const truncated = land + missionH > spanH;
  const energyWh = shadowH > 0 ? (loadW * shadowH) / Math.max(0.05, dod / 100) : 0;
  const worstH = site.stats.max_continuous_shadow_h;
  const worstWh = (loadW * worstH) / Math.max(0.05, dod / 100);
  const fmtWh = (wh: number) => (wh >= 1000 ? `${(wh / 1000).toFixed(1)} kWh` : `${Math.round(wh)} Wh`);

  const pick = (h: number) => {
    setLandingH(h);
    setTH(h);
  };

  return (
    <section className="rounded-lg border border-space-700 bg-space-900/80 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Rocket size={15} className="text-sky-300" />
        <h3 className="text-sm font-semibold text-slate-200">Mission planner</h3>
        <span className="text-[11px] text-slate-400">landing windows & battery sizing from the 2026–2027 visibility series</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Landing windows */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400"><CalendarClock size={12} /> Landing window finder</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            Need
            <select value={need} onChange={(e) => setNeed(e.target.value as Need)} className="rounded border border-space-600 bg-space-800 px-1.5 py-0.5 text-slate-200">
              <option value="both">Sun + Earth link</option>
              <option value="sun">Sun only</option>
            </select>
            for at least
            <input type="number" min={0.5} max={60} step={0.5} value={minDays} onChange={(e) => setMinDays(Number(e.target.value) || 0.5)} className={num} aria-label="Minimum continuous days" />
            days after touchdown
          </div>

          {/* Two-year strip */}
          <div className="mt-3">
            <svg viewBox="0 0 1000 26" className="h-7 w-full" preserveAspectRatio="none" role="img" aria-label="Landing windows across 2026-2027">
              <rect width={1000} height={18} y={4} rx={3} fill="#151a2b" />
              {windows.map((w) => (
                <rect
                  key={w.openH} x={(w.openH / spanH) * 1000} y={4} height={18} rx={1}
                  width={Math.max(2, ((w.closeH - w.openH + site.time.step_h) / spanH) * 1000)}
                  fill="#38bdf8" className="cursor-pointer" onClick={() => pick(w.openH)}
                />
              ))}
              <line x1={(tH / spanH) * 1000} x2={(tH / spanH) * 1000} y1={0} y2={26} stroke="#f8fafc" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex justify-between text-[11px] text-slate-400"><span>2026-01</span><span>2027-01</span><span>2027-12</span></div>
          </div>

          <p className="mt-2 text-[12px] text-slate-300">
            {windows.length === 0 ? (
              <>No landing time in 2026–2027 gives {minDays} days of continuous {need === "both" ? "Sun and Earth" : "Sun"}. Try a shorter requirement{need === "both" ? " or “Sun only”" : ""}.</>
            ) : (
              <><span className="font-mono text-sky-200">{windows.length}</span> windows, open <span className="font-mono text-sky-200">{(openFrac * 100).toFixed(1)}%</span> of the time.</>
            )}
          </p>

          {upcoming.length > 0 && (
            <table className="mt-2 w-full text-left text-[11px]">
              <thead className="text-slate-400">
                <tr><th className="font-normal">Opens (UTC)</th><th className="font-normal">Closes</th><th className="font-normal">Best guaranteed</th><th /></tr>
              </thead>
              <tbody className="font-mono text-slate-200">
                {upcoming.slice(0, 5).map((w) => (
                  <tr key={w.openH} className={`border-t border-space-800 ${landingH != null && landingH >= w.openH && landingH <= w.closeH ? "bg-sky-500/10" : ""}`}>
                    <td className="py-1">{fmtUTC(t0ms + Math.max(w.openH, 0) * 3_600_000).slice(0, 16)}</td>
                    <td>{fmtUTC(t0ms + w.closeH * 3_600_000).slice(5, 16)}</td>
                    <td>{fmtDuration(w.bestH)}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => pick(w.openH)} className="rounded bg-space-700 px-1.5 py-0.5 font-sans text-[11px] text-sky-200 hover:bg-space-600">land here</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {first && second && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-200/90">
              Launch-slip risk: if the window closing {fmtUTC(t0ms + first.closeH * 3_600_000, false)} is missed, the next one opens{" "}
              <span className="font-mono">{((second.openH - first.closeH) / 24).toFixed(1)}</span> days later.
            </p>
          )}
        </div>

        {/* Battery sizing */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400"><BatteryCharging size={12} /> Battery sizing for the longest night</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-300">
            <label className="flex items-center justify-between gap-2">Night load (W)
              <input type="number" min={1} value={loadW} onChange={(e) => setLoadW(Math.max(1, Number(e.target.value) || 1))} className={num} />
            </label>
            <label className="flex items-center justify-between gap-2">Usable depth of discharge (%)
              <input type="number" min={10} max={100} value={dod} onChange={(e) => setDod(Math.min(100, Math.max(10, Number(e.target.value) || 80)))} className={num} />
            </label>
            <label className="flex items-center justify-between gap-2">Mission length (days)
              <input type="number" min={1} max={730} value={missionDays} onChange={(e) => setMissionDays(Math.max(1, Number(e.target.value) || 1))} className={num} />
            </label>
            <div className="flex items-center justify-between gap-2 text-slate-400">Landing
              <span className="font-mono text-[11px] text-slate-200">{fmtUTC(t0ms + land * 3_600_000).slice(0, 16)}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-sky-400/25 bg-sky-500/5 p-2.5">
              <div className="text-[11px] uppercase tracking-wider text-sky-200">This mission</div>
              <div className="mt-1 text-lg font-semibold text-slate-50">{shadowH > 0 ? fmtWh(energyWh) : "No night"}</div>
              <div className="text-[11px] text-slate-400">
                longest shadow {shadowH > 0 ? fmtDuration(shadowH) : "—"}{shadowH > 0 && <> · ≈ {(energyWh / WH_PER_KG).toFixed(1)} kg</>}
              </div>
              {truncated && <div className="mt-1 text-[11px] text-amber-200/80">Mission extends past 2027-12-31; only data inside the span is counted.</div>}
            </div>
            <div className="rounded-md border border-space-600 bg-space-800/60 p-2.5">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Survive any night 2026–27</div>
              <div className="mt-1 text-lg font-semibold text-slate-50">{worstH > 0 ? fmtWh(worstWh) : "—"}</div>
              <div className="text-[11px] text-slate-400">worst shadow {worstH > 0 ? fmtDuration(worstH) : "—"}{worstH > 0 && <> · ≈ {(worstWh / WH_PER_KG).toFixed(0)} kg</>}</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Energy = load × longest continuous terrain/night shadow ÷ usable depth of discharge. Mass assumes {WH_PER_KG} Wh/kg at pack level.
            Survival heaters, which dominate real lunar-night budgets, belong in the night load. First-order sizing only.
          </p>
        </div>
      </div>
    </section>
  );
}

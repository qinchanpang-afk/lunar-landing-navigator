import { Box, Columns2, Radar, Rocket, Satellite, Sun, Timer } from "lucide-react";
import type { SiteDetail } from "../lib/types";
import { bodyState, fmtDuration } from "../lib/time";

export type StartAction = "terrain" | "slip" | "nearby" | "3d";

interface Props {
  site: SiteDetail;
  tH: number;
  onStart: (a: StartAction) => void;
}

const STARTS: { key: StartAction; icon: typeof Sun; title: string; sub: string }[] = [
  { key: "terrain", icon: Columns2, title: "Rim vs. crater floor", sub: "88% vs 0% sunlight, 13 km apart" },
  { key: "slip", icon: Timer, title: "Launch slips 14 days", sub: "same site, the Sun moves behind a ridge" },
  { key: "nearby", icon: Radar, title: "Find a better spot", sub: "Nobile: +24 pp sunlight 2 km away" },
  { key: "3d", icon: Box, title: "See the shadows in 3D", sub: "real LOLA terrain, live Sun" },
];

/** First-screen answer: does the lander have power and a link to Earth right now, and for how long? */
export default function NowCard({ site, tH, onStart }: Props) {
  const sun = bodyState(site.sun, site.horizon_mask_deg, tH, site.time.step_h);
  const earth = bodyState(site.earth, site.horizon_mask_deg, tH, site.time.step_h);
  const st = site.stats;
  const nightD = st.max_continuous_shadow_h / 24;
  const until = (v: number | null, never: string) => (v == null ? never : fmtDuration(v));

  return (
    <section className="rounded-xl border border-space-600 bg-gradient-to-br from-space-900 to-space-950 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.1fr]">
        <div className={`rounded-lg border p-3 ${sun.visible ? "border-amber-400/40 bg-amber-500/10" : "border-space-600 bg-space-800/60"}`}>
          <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-slate-300">
            <Sun size={14} className={sun.visible ? "text-sun" : "text-slate-400"} /> Solar power
          </div>
          <div className={`mt-1 text-2xl font-semibold ${sun.visible ? "text-amber-100" : "text-slate-300"}`}>{sun.visible ? "ON" : "OFF"}</div>
          <div className="text-[13px] text-slate-300">
            {sun.visible ? <>sunset in <span className="font-mono text-slate-50">{until(sun.toSet, "none before 2028")}</span></> : <>sunrise in <span className="font-mono text-slate-50">{until(sun.toRise, "never (2026–27)")}</span></>}
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${earth.visible ? "border-sky-400/40 bg-sky-500/10" : "border-space-600 bg-space-800/60"}`}>
          <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-slate-300">
            <Satellite size={14} className={earth.visible ? "text-earth" : "text-slate-400"} /> Direct link to Earth
          </div>
          <div className={`mt-1 text-2xl font-semibold ${earth.visible ? "text-sky-100" : "text-slate-300"}`}>{earth.visible ? "ON" : "OFF"}</div>
          <div className="text-[13px] text-slate-300">
            {earth.visible ? <>Earthset in <span className="font-mono text-slate-50">{until(earth.toSet, "none before 2028")}</span></> : <>Earthrise in <span className="font-mono text-slate-50">{until(earth.toRise, "never (2026–27)")}</span></>}
          </div>
        </div>
        <div className="rounded-lg border border-space-600 bg-space-800/40 p-3">
          <div className="text-[12px] font-medium uppercase tracking-wider text-slate-300">This site over 2026–2027</div>
          <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
            <div><dt className="text-[11px] text-slate-400">Sunlight</dt><dd className="font-mono text-lg text-sun">{st.sunlight_pct.toFixed(0)}%</dd></div>
            <div><dt className="text-[11px] text-slate-400">Earth link</dt><dd className="font-mono text-lg text-earth">{st.dte_pct.toFixed(0)}%</dd></div>
            <div><dt className="text-[11px] text-slate-400">Longest night</dt><dd className="font-mono text-lg text-slate-100">{st.max_continuous_shadow_h > 0 ? (nightD >= 1 ? `${nightD.toFixed(1)} d` : `${st.max_continuous_shadow_h} h`) : "none"}</dd></div>
          </dl>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-violet-200"><Rocket size={13} /> Start here</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STARTS.map(({ key, icon: Icon, title, sub }) => (
            <button
              key={key} type="button" onClick={() => onStart(key)}
              className="group flex items-start gap-2 rounded-lg border border-space-600 bg-space-800/70 px-3 py-2 text-left transition hover:border-violet-300/50 hover:bg-space-700"
            >
              <Icon size={16} className="mt-0.5 shrink-0 text-violet-300" />
              <span>
                <span className="block text-[13px] font-medium text-slate-100">{title}</span>
                <span className="block text-[12px] text-slate-400">{sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

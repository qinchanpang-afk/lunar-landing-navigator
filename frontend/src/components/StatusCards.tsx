import { BatteryCharging, Radio, Sun, Sunset, Globe2, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { Audience, SiteDetail } from "../lib/types";
import { bodyState, compass, fmtDeg, fmtDuration } from "../lib/time";

export type PanelMode = "horizontal" | "vertical";

interface Props {
  site: SiteDetail;
  tH: number;
  audience: Audience;
  panel: PanelMode;
}

function Card({ icon, title, accent, children }: { icon: ReactNode; title: string; accent: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-space-700 bg-space-900/80 p-3 min-w-0">
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${accent}`}>
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Chip({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
      {ok ? okText : badText}
    </span>
  );
}

function Big({ children }: { children: ReactNode }) {
  return <div className="font-mono text-xl font-semibold text-slate-50 leading-tight">{children}</div>;
}

function Sub({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-xs text-slate-400 leading-snug">{children}</div>;
}

export default function StatusCards({ site, tH, audience, panel }: Props) {
  const step = site.time.step_h;
  const sun = bodyState(site.sun, site.horizon_mask_deg, tH, step);
  const earth = bodyState(site.earth, site.horizon_mask_deg, tH, step);
  const explorer = audience === "explorer";
  const sunReason = sun.visible ? "" : sun.el > 0 ? "terrain shadow" : "below horizon";
  const pH = sun.visible ? Math.max(0, Math.sin((sun.el * Math.PI) / 180)) : 0;
  const pV = sun.visible ? Math.max(0, Math.cos((sun.el * Math.PI) / 180)) : 0;
  const p = panel === "horizontal" ? pH : pV;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
      <Card icon={<Sun size={13} />} title="Solar elevation" accent="text-sun">
        <div className="flex items-baseline justify-between gap-2">
          <Big>{fmtDeg(sun.el)}</Big>
          <Chip ok={sun.visible} okText="SUNLIT" badText={sunReason.toUpperCase()} />
        </div>
        <Sub>
          Az {sun.az.toFixed(1)}° ({compass(sun.az)}) · terrain {fmtDeg(sun.horizon, 1)} · clearance{" "}
          <span className={sun.margin > 0 ? "text-emerald-300" : "text-rose-300"}>{fmtDeg(sun.margin)}</span>
          {explorer && (
            <span className="block mt-1 text-slate-300">
              {sun.visible
                ? `The Sun's centre is ${Math.abs(sun.margin).toFixed(1)}° above the ${sun.horizon > 0.5 ? "hills" : "horizon"} — about ${(Math.abs(sun.margin) / 0.53).toFixed(1)} Sun-widths.`
                : sun.el > 0
                  ? "The Sun is up, but a ridge or crater wall blocks it. This is why location matters so much at the pole."
                  : "It is lunar night here: the Sun is below the horizon."}
            </span>
          )}
        </Sub>
      </Card>

      <Card icon={<BatteryCharging size={13} />} title={`Solar power (${panel === "horizontal" ? "flat panel" : "vertical tracker"})`} accent="text-sun">
        <Big>{(p * 100).toFixed(1)}%</Big>
        <div className="mt-1.5 h-1.5 rounded bg-space-700 overflow-hidden">
          <div className="h-full bg-sun transition-[width] duration-150" style={{ width: `${p * 100}%` }} />
        </div>
        <Sub>
          flat sin(el) {(pH * 100).toFixed(1)}% · vertical cos(el) {(pV * 100).toFixed(1)}%
          {explorer && (
            <span className="block mt-1 text-slate-300">
              At the pole the Sun skims the horizon, so flat panels collect almost nothing — landers use tall vertical panels instead.
            </span>
          )}
        </Sub>
      </Card>

      <Card icon={sun.visible ? <Sunset size={13} /> : <Timer size={13} />} title={sun.visible ? "Sunset → power loss" : "Sunrise → power back"} accent="text-sun">
        <Big>{fmtDuration(sun.visible ? sun.toSet : sun.toRise)}</Big>
        <Sub>
          {sun.visible ? "until the Sun drops behind terrain" : "until the Sun clears the terrain"}
          {(sun.visible ? sun.toSet : sun.toRise) == null && " (beyond 2027 data range)"}
        </Sub>
      </Card>

      <Card icon={<Globe2 size={13} />} title="Earth elevation" accent="text-earth">
        <div className="flex items-baseline justify-between gap-2">
          <Big>{fmtDeg(earth.el)}</Big>
          <Chip ok={earth.visible} okText="DTE LINK" badText="NO LINE OF SIGHT" />
        </div>
        <Sub>
          Az {earth.az.toFixed(1)}° ({compass(earth.az)}) · terrain {fmtDeg(earth.horizon, 1)} · clearance{" "}
          <span className={earth.margin > 0 ? "text-emerald-300" : "text-rose-300"}>{fmtDeg(earth.margin)}</span>
          {explorer && (
            <span className="block mt-1 text-slate-300">
              {earth.el < -20
                ? "Earth is permanently below the horizon on the far side — a relay satellite is required."
                : "Earth hangs almost still in the lunar sky; it only wobbles (libration) by a few degrees over a month."}
            </span>
          )}
        </Sub>
      </Card>

      <Card icon={<Radio size={13} />} title={earth.visible ? "Earthset → comms loss" : "Earthrise → comms back"} accent="text-earth">
        <Big>{fmtDuration(earth.visible ? earth.toSet : earth.toRise)}</Big>
        <Sub>
          {earth.visible ? "until Earth drops behind terrain" : "until Earth clears the terrain"}
          {(earth.visible ? earth.toSet : earth.toRise) == null && (earth.visible ? " (no Earthset before 2028)" : " (never in 2026–2027)")}
        </Sub>
      </Card>

      <Card icon={<BatteryCharging size={13} />} title="Mission window" accent="text-emerald-300">
        <Big>
          {sun.visible && earth.visible ? "POWER + COMMS" : sun.visible ? "POWER ONLY" : earth.visible ? "COMMS ONLY" : "SURVIVAL MODE"}
        </Big>
        <Sub>
          {sun.visible && earth.visible
            ? "Both solar power and direct-to-Earth link available."
            : !sun.visible && !earth.visible
              ? "No sunlight and no Earth link: batteries and autonomy only."
              : sun.visible
                ? "Charging, but no direct link to Earth."
                : "Talking to Earth on battery power."}
        </Sub>
      </Card>
    </div>
  );
}

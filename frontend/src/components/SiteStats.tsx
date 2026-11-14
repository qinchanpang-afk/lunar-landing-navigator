import { AlertTriangle, Download } from "lucide-react";
import type { Audience, SiteDetail } from "../lib/types";
import { download, siteCsv } from "../lib/csv";
import { fmtDuration } from "../lib/time";

interface Props {
  site: SiteDetail;
  audience: Audience;
}

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-space-800 last:border-0">
      <div className="text-xs text-slate-400">
        {k}
        {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      </div>
      <div className="font-mono text-sm text-slate-100 whitespace-nowrap">{v}</div>
    </div>
  );
}

export default function SiteStats({ site, audience }: Props) {
  const s = site.stats;
  const ex = audience === "explorer";
  return (
    <div className="rounded-lg border border-space-700 bg-space-900/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-200">2026–2027 summary</h3>
        <button
          type="button"
          onClick={() => download(`${site.id}_2026-2027_2h.csv`, siteCsv(site))}
          className="inline-flex items-center gap-1 rounded-md border border-space-600 bg-space-800 px-2 py-1 text-xs text-slate-300 hover:bg-space-700"
        >
          <Download size={13} /> CSV
        </button>
      </div>
      <Row k="Sunlight" v={`${s.sunlight_pct.toFixed(1)}%`} hint={ex ? "share of time the Sun clears the local terrain" : undefined} />
      <Row k="Direct-to-Earth visibility" v={`${s.dte_pct.toFixed(1)}%`} />
      <Row k="Sun + Earth simultaneously" v={`${s.sun_and_dte_pct.toFixed(1)}%`} />
      <Row k="Max continuous shadow" v={fmtDuration(s.max_continuous_shadow_h)} hint={ex ? "longest night the batteries must survive" : "battery survival driver"} />
      <Row k="Max continuous sunlight" v={fmtDuration(s.max_continuous_sunlight_h)} />
      <Row k="Mean daylight period" v={s.mean_daylight_period_days != null ? `${s.mean_daylight_period_days.toFixed(2)} d` : "—"} />
      <Row k="Max DTE blackout" v={fmtDuration(s.max_continuous_dte_blackout_h)} />
      <Row k="Solar elevation range" v={`${s.min_solar_elev_deg.toFixed(1)}° … ${s.max_solar_elev_deg.toFixed(1)}°`} />
      <Row k="Earth elevation range" v={`${s.earth_elev_range_deg[0].toFixed(1)}° … ${s.earth_elev_range_deg[1].toFixed(1)}°`} hint={ex ? "Earth's wobble (libration) in the sky" : undefined} />
      <Row k="Mean power eff. (flat / vertical)" v={`${(s.mean_power_eff_horizontal * 100).toFixed(1)}% / ${(s.mean_power_eff_vertical_tracking * 100).toFixed(1)}%`} />
      <Row k="Horizon max / mean" v={`${s.max_horizon_deg.toFixed(1)}° / ${s.mean_horizon_deg.toFixed(1)}°`} />
      {site.slope_deg != null && <Row k="Local slope (LOLA)" v={`${site.slope_deg.toFixed(1)}°`} />}
      {site.warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {site.warnings.map((w) => (
            <li key={w} className="flex gap-1.5 text-[11px] text-amber-300/90 leading-snug">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {w}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-[11px] text-slate-400 leading-snug">
        Horizon: {site.horizon_source}.{site.snap?.applied ? ` Snapped ${site.snap.shift_km} km from catalog point to ${site.snap.note}.` : ""}
      </div>
    </div>
  );
}

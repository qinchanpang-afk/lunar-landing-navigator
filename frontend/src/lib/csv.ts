import type { SiteDetail } from "./types";
import { maskAt, startMs } from "./time";

/** Full 2-hourly time series for one site as CSV (planner export). */
export function siteCsv(site: SiteDetail): string {
  const t0 = startMs(site);
  const step = site.time.step_h * 3_600_000;
  const head = [
    "time_utc", "sun_az_deg", "sun_el_deg", "horizon_at_sun_az_deg", "sun_visible",
    "power_eff_horizontal", "power_eff_vertical_tracking", "hours_to_sunset", "hours_to_sunrise",
    "earth_az_deg", "earth_el_deg", "horizon_at_earth_az_deg", "dte_visible", "hours_to_earthset", "hours_to_earthrise",
  ];
  const rows = [
    `# ${site.name} (${site.id}) lat=${site.lat} lon=${site.lon}E elev_km=${site.elev_km_used}`,
    `# Ephemeris: NASA JPL Horizons apparent az/el (airless). Horizon: ${site.horizon_source}`,
    "# visible = elevation > horizon (no refraction). Empty hours_to_* cell = not applicable at that step, or no such event before 2028-01-01.",
    head.join(","),
  ];
  const v = (x: number | null) => (x == null ? "" : String(x));
  for (let i = 0; i < site.time.n; i++) {
    const s = site.sun;
    const e = site.earth;
    rows.push([
      new Date(t0 + i * step).toISOString().slice(0, 16) + "Z",
      s.az[i], s.el[i], maskAt(site.horizon_mask_deg, s.az[i]).toFixed(2), s.vis[i],
      s.pwr[i], s.pwr_v[i], v(s.t_set[i]), v(s.t_rise[i]),
      e.az[i], e.el[i], maskAt(site.horizon_mask_deg, e.az[i]).toFixed(2), e.vis[i], v(e.t_set[i]), v(e.t_rise[i]),
    ].join(","));
  }
  return rows.join("\n");
}

export function download(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

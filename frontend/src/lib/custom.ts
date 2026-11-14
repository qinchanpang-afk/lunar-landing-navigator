/**
 * Custom-coordinate site computation in the browser. Same physics as scripts/build_data.py:
 * live JPL Horizons apparent az/el (via proxy) + LOLA horizon ray-trace (south of 80°S) or ideal
 * 0° horizon elsewhere; visibility strictly elevation > horizon (airless).
 */
import type { BodySeries, SiteDetail, SiteMeta, SiteStats } from "./types";
import { fetchEphemeris, type Ephemeris } from "./horizons";
import { computeHorizon } from "./dem";
import { maskAt } from "./time";

const STEP_H = 2;
const POLAR_LIMIT = -80;
const MAX_LANDER_SLOPE = 10;

function crossings(tH: number[], margin: number[], rising: boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < margin.length - 1; i++) {
    const a = margin[i] > 0;
    const b = margin[i + 1] > 0;
    if (rising ? !a && b : a && !b) {
      const m0 = margin[i];
      const m1 = margin[i + 1];
      const f = m0 !== m1 ? m0 / (m0 - m1) : 0.5;
      out.push(tH[i] + f * (tH[i + 1] - tH[i]));
    }
  }
  return out;
}

function timeToNext(tH: number[], events: number[], applies: boolean[]): (number | null)[] {
  const out: (number | null)[] = new Array(tH.length).fill(null);
  let j = 0;
  for (let i = 0; i < tH.length; i++) {
    while (j < events.length && events[j] <= tH[i]) j++;
    if (applies[i] && j < events.length) out[i] = Math.round((events[j] - tH[i]) * 10) / 10;
  }
  return out;
}

function runs(vis: boolean[], value: boolean): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= vis.length; i++) {
    const v = i < vis.length && vis[i] === value;
    if (v && s < 0) s = i;
    if (!v && s >= 0) {
      out.push([s, i - s]);
      s = -1;
    }
  }
  return out;
}

function periodStats(vis: boolean[]) {
  const n = vis.length;
  const on = runs(vis, true);
  const off = runs(vis, false);
  const complete = (r: [number, number][]) => r.filter(([s, l]) => s > 0 && s + l < n).map(([, l]) => l);
  const mean = (a: number[]) => (a.length ? Math.round(((a.reduce((x, y) => x + y, 0) / a.length) * STEP_H / 24) * 100) / 100 : null);
  return {
    maxOn: Math.max(0, ...on.map(([, l]) => l)) * STEP_H,
    maxOff: Math.max(0, ...off.map(([, l]) => l)) * STEP_H,
    meanOn: mean(complete(on)),
    meanOff: mean(complete(off)),
    nOn: complete(on).length,
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface CustomInput {
  name: string;
  lat: number;
  lon: number;
  elevKm: number;
}

export async function computeCustomSite(inp: CustomInput, onProgress: (s: string) => void, signal?: AbortSignal): Promise<{ detail: SiteDetail; meta: SiteMeta }> {
  const lat = Math.max(-89.999, Math.min(89.999, inp.lat));
  const lon = ((inp.lon % 360) + 360) % 360;
  const polar = lat <= POLAR_LIMIT;
  const warnings: string[] = [];

  let mask = new Array(360).fill(0);
  let distKm = new Array(360).fill(0);
  let elevKm = inp.elevKm;
  let slope: number | null = null;
  let horizonSource = "ideal spherical horizon (0 deg) - site outside polar DEM";
  if (polar) {
    const h = await computeHorizon(lat, lon, onProgress);
    mask = h.mask;
    distKm = h.distKm;
    elevKm = h.groundM / 1000;
    slope = h.slopeDeg;
    horizonSource = "LOLA LDEM_80S_80M raycast 100 km (80 m near field / 160 m beyond 5 km), curvature-corrected, mast 2.0 m - computed in browser";
    if (slope > MAX_LANDER_SLOPE) warnings.push(`Local slope ${slope.toFixed(1)} deg exceeds typical lander tolerance (${MAX_LANDER_SLOPE} deg)`);
    if (h.missingFrac > 0.001) warnings.push(`${(h.missingFrac * 100).toFixed(1)}% of ray samples fall outside the polar DEM (terrain there ignored)`);
  } else {
    warnings.push("Outside the LOLA 80°S polar DEM: local terrain not modelled (ideal 0° horizon)");
  }

  onProgress?.("Fetching Sun ephemeris from JPL Horizons…");
  const sunE: Ephemeris = await fetchEphemeris("sun", lon, lat, elevKm, signal);
  onProgress?.("Fetching Earth ephemeris from JPL Horizons…");
  const earthE: Ephemeris = await fetchEphemeris("earth", lon, lat, elevKm, signal);
  if (sunE.ms.length !== earthE.ms.length || sunE.ms.some((t, i) => t !== earthE.ms[i])) throw new Error("Sun/Earth timestamps differ");
  if (sunE.ms[0] !== Date.UTC(2026, 0, 1)) throw new Error("Unexpected ephemeris start");

  onProgress?.("Analysing visibility…");
  const n = sunE.ms.length;
  const tH = sunE.ms.map((t) => (t - sunE.ms[0]) / 3_600_000);
  const track = (e: Ephemeris) => {
    const margin = e.el.map((el, i) => el - maskAt(mask, e.az[i]));
    const vis = margin.map((m) => m > 0);
    const series: BodySeries = {
      az: e.az.map(r2),
      el: e.el.map(r2),
      vis: vis.map((v) => (v ? 1 : 0)),
      t_set: timeToNext(tH, crossings(tH, margin, false), vis),
      t_rise: timeToNext(tH, crossings(tH, margin, true), vis.map((v) => !v)),
    };
    return { series, vis };
  };
  const sun = track(sunE);
  const earth = track(earthE);
  const pwr = sunE.el.map((el, i) => (sun.vis[i] ? Math.round(Math.max(0, Math.sin(el * Math.PI / 180)) * 1000) / 1000 : 0));
  const pwrV = sunE.el.map((el, i) => (sun.vis[i] ? Math.round(Math.max(0, Math.cos(el * Math.PI / 180)) * 1000) / 1000 : 0));
  const pct = (a: boolean[]) => r2((100 * a.filter(Boolean).length) / a.length);
  const sp = periodStats(sun.vis);
  const ep = periodStats(earth.vis);
  const stats: SiteStats = {
    sunlight_pct: pct(sun.vis),
    dte_pct: pct(earth.vis),
    sun_and_dte_pct: pct(sun.vis.map((v, i) => v && earth.vis[i])),
    max_solar_elev_deg: r2(Math.max(...sunE.el)),
    min_solar_elev_deg: r2(Math.min(...sunE.el)),
    earth_elev_range_deg: [r2(Math.min(...earthE.el)), r2(Math.max(...earthE.el))],
    mean_power_eff_horizontal: Math.round((pwr.reduce((a, b) => a + b, 0) / n) * 1e4) / 1e4,
    mean_power_eff_vertical_tracking: Math.round((pwrV.reduce((a, b) => a + b, 0) / n) * 1e4) / 1e4,
    max_continuous_shadow_h: sp.maxOff,
    max_continuous_sunlight_h: sp.maxOn,
    mean_daylight_period_days: sp.meanOn,
    mean_night_period_days: sp.meanOff,
    complete_daylight_periods: sp.nOn,
    max_continuous_dte_blackout_h: ep.maxOff,
    max_horizon_deg: r2(Math.max(...mask)),
    mean_horizon_deg: r2(mask.reduce((a, b) => a + b, 0) / 360),
  };

  const id = `custom-${lat.toFixed(4)}_${lon.toFixed(4)}`;
  const base = {
    id,
    name: inp.name || `Custom ${lat.toFixed(3)}°, ${lon.toFixed(3)}°E`,
    agency: "User-defined coordinates",
    region: "Custom",
    description: `User-entered site. Sun & Earth positions fetched live from NASA JPL Horizons; ${polar ? "horizon ray-traced on LOLA terrain in your browser" : "ideal spherical horizon (outside the polar DEM)"}.`,
    coord_source: "user input",
    slope_deg: slope != null ? Math.round(slope * 10) / 10 : null,
    warnings,
    lat,
    lon,
    catalog_lat: lat,
    catalog_lon: lon,
    snap: null,
    elev_km_catalog: polar ? null : inp.elevKm,
    elev_km_dem: polar ? Math.round(elevKm * 1e4) / 1e4 : null,
    elev_km_used: Math.round(elevKm * 1e4) / 1e4,
    horizon_source: horizonSource,
    stats,
    horizon_mask_deg: mask.map(r2),
  };
  const detail: SiteDetail = {
    ...base,
    horizon_mask_dist_km: distKm.map(r2),
    time: { start_utc: "2026-01-01T00:00Z", step_h: STEP_H, n },
    sun: { ...sun.series, pwr, pwr_v: pwrV },
    earth: earth.series,
  };
  return { detail, meta: { ...base, file: "" } };
}

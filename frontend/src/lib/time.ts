import type { BodySeries, SiteDetail } from "./types";

export const HOUR_MS = 3_600_000;
export const SYNODIC_MONTH_H = 29.530589 * 24;

export function startMs(site: { time: { start_utc: string } }): number {
  return Date.parse(site.time.start_utc);
}

export function spanHours(site: SiteDetail): number {
  return (site.time.n - 1) * site.time.step_h;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Circular interpolation of azimuths in degrees. */
export function lerpAz(a0: number, a1: number, f: number): number {
  const d = ((a1 - a0 + 540) % 360) - 180;
  return (a0 + d * f + 360) % 360;
}

/** Horizon mask (1 deg samples, 0..359) linearly interpolated at an arbitrary azimuth. */
export function maskAt(mask: number[], az: number): number {
  const a = ((az % 360) + 360) % 360;
  const i0 = Math.floor(a) % 360;
  const f = a - Math.floor(a);
  return mask[i0] * (1 - f) + mask[(i0 + 1) % 360] * f;
}

export interface BodyState {
  az: number;
  el: number;
  horizon: number;
  margin: number;
  visible: boolean;
  /** hours until the body sets behind the terrain (null if hidden or no event before data end) */
  toSet: number | null;
  /** hours until the body rises above the terrain (null if visible or no event before data end) */
  toRise: number | null;
}

/**
 * State of a body at fractional time tH (hours since dataset start). Positions are interpolated
 * between the 2-hourly Horizons samples; event countdowns use the pipeline's pre-computed
 * (sub-step interpolated) crossing times.
 */
export function bodyState(s: BodySeries, mask: number[], tH: number, stepH: number): BodyState {
  const n = s.el.length;
  const x = clamp(tH / stepH, 0, n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  const f = x - i;
  const az = lerpAz(s.az[i], s.az[i + 1], f);
  const el = s.el[i] + (s.el[i + 1] - s.el[i]) * f;
  const horizon = maskAt(mask, az);
  const margin = el - horizon;
  const visible = margin > 0;
  const ti = i * stepH;
  const tj = ti + stepH;
  let toSet: number | null = null;
  let toRise: number | null = null;
  if (visible) {
    let setAt = s.vis[i] && s.t_set[i] != null ? ti + (s.t_set[i] as number) : null;
    if (setAt == null || setAt <= tH) setAt = s.vis[i + 1] && s.t_set[i + 1] != null ? tj + (s.t_set[i + 1] as number) : null;
    toSet = setAt != null ? Math.max(0, setAt - tH) : s.vis[i + 1] ? null : Math.max(0, tj - tH);
  } else {
    let riseAt = !s.vis[i] && s.t_rise[i] != null ? ti + (s.t_rise[i] as number) : null;
    if (riseAt == null || riseAt <= tH) riseAt = !s.vis[i + 1] && s.t_rise[i + 1] != null ? tj + (s.t_rise[i + 1] as number) : null;
    toRise = riseAt != null ? Math.max(0, riseAt - tH) : !s.vis[i + 1] ? null : Math.max(0, tj - tH);
  }
  return { az, el, horizon, margin, visible, toSet, toRise };
}

export function fmtDuration(h: number | null | undefined): string {
  if (h == null || !isFinite(h)) return "—";
  const totalMin = Math.round(h * 60);
  const d = Math.floor(totalMin / 1440);
  const hh = Math.floor((totalMin % 1440) / 60);
  const mm = totalMin % 60;
  if (d > 0) return `${d}d ${hh}h ${String(mm).padStart(2, "0")}m`;
  if (hh > 0) return `${hh}h ${String(mm).padStart(2, "0")}m`;
  return `${mm}m`;
}

export function fmtUTC(ms: number, withTime = true): string {
  const iso = new Date(ms).toISOString();
  return withTime ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso.slice(0, 10);
}

/** Value for <input type="datetime-local">, interpreted as UTC. */
export function toInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16);
}

export function fromInputValue(v: string): number {
  return Date.parse(`${v}:00Z`);
}

export function fmtDeg(v: number, digits = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}°`;
}

export function compass(az: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

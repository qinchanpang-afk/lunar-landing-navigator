/** Mission-planning helpers built purely on the pre-computed visibility series (no new physics). */
import type { SiteDetail } from "./types";

export type Need = "sun" | "both";

export interface LandingWindow {
  /** first and last 2-hourly landing time (h since dataset start) that still guarantee the requirement */
  openH: number;
  closeH: number;
  /** longest guaranteed continuous Sun(+Earth) time available inside this window, hours */
  bestH: number;
}

/** remaining[i] = hours of uninterrupted visibility starting at step i (0 if not visible at i). */
export function remainingRun(site: SiteDetail, need: Need): Float64Array {
  const n = site.time.n;
  const step = site.time.step_h;
  const out = new Float64Array(n);
  let acc = 0;
  for (let i = n - 1; i >= 0; i--) {
    const ok = site.sun.vis[i] === 1 && (need === "sun" || site.earth.vis[i] === 1);
    acc = ok ? acc + step : 0;
    out[i] = acc;
  }
  return out;
}

/** Landing windows: maximal runs of steps where landing there guarantees >= requiredH of continuous coverage. */
export function landingWindows(site: SiteDetail, need: Need, requiredH: number): LandingWindow[] {
  const rem = remainingRun(site, need);
  const step = site.time.step_h;
  const out: LandingWindow[] = [];
  let s = -1;
  let best = 0;
  for (let i = 0; i <= rem.length; i++) {
    const ok = i < rem.length && rem[i] >= requiredH;
    if (ok) {
      if (s < 0) { s = i; best = 0; }
      best = Math.max(best, rem[i]);
    } else if (s >= 0) {
      out.push({ openH: s * step, closeH: (i - 1) * step, bestH: best });
      s = -1;
    }
  }
  return out;
}

/** Longest continuous shadow (hours) within [fromH, fromH + durH] - the night a battery must survive. */
export function longestShadowIn(site: SiteDetail, fromH: number, durH: number): number {
  const step = site.time.step_h;
  const i0 = Math.max(0, Math.floor(fromH / step));
  const i1 = Math.min(site.time.n - 1, Math.ceil((fromH + durH) / step));
  let run = 0, max = 0;
  for (let i = i0; i <= i1; i++) {
    run = site.sun.vis[i] ? 0 : run + step;
    if (run > max) max = run;
  }
  return max;
}

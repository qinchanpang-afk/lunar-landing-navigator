/**
 * "Best nearby spot" scan: re-uses the site's JPL Horizons ephemeris and the unchanged browser
 * horizon ray-tracer (dem.ts computeHorizon) on a grid of points around the site.
 * The Sun/Earth directions are rotated from the site's local frame into each grid point's frame
 * (they are effectively at infinity, so only the local horizontal frame changes); visibility is the
 * same rule as everywhere else: elevation > terrain horizon at that azimuth (no refraction).
 */
import type { SiteDetail } from "./types";
import { computeHorizon } from "./dem";
import { directions, distBearing, enuFrame, polarLatLon, polarXY } from "./geo";
import { maskAt } from "./time";
import type { HorizonJob, HorizonReply } from "./horizonWorker";

type Horizon = { mask: number[]; groundM: number; slopeDeg: number };

/** Pool of module workers running computeHorizon in parallel; falls back to the main thread. */
function horizonPool(signal?: AbortSignal) {
  const size = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  let workers: Worker[] = [];
  try {
    workers = Array.from({ length: size }, () => new Worker(new URL("./horizonWorker.ts", import.meta.url), { type: "module" }));
  } catch {
    workers = [];
  }
  const idle = [...workers];
  const waiting: (() => void)[] = [];
  let seq = 0;
  const kill = () => workers.forEach((w) => w.terminate());
  signal?.addEventListener("abort", kill);
  const run = async (lat: number, lon: number): Promise<Horizon> => {
    if (!workers.length) return computeHorizon(lat, lon);
    while (!idle.length) await new Promise<void>((r) => waiting.push(r));
    const w = idle.pop()!;
    const id = ++seq;
    try {
      return await new Promise<Horizon>((resolve, reject) => {
        const onMsg = (e: MessageEvent<HorizonReply>) => {
          if (e.data.id !== id) return;
          w.removeEventListener("message", onMsg);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve({ mask: e.data.mask!, groundM: e.data.groundM!, slopeDeg: e.data.slopeDeg! });
        };
        w.addEventListener("message", onMsg);
        signal?.addEventListener("abort", () => reject(new DOMException("Scan cancelled", "AbortError")));
        w.postMessage({ id, lat, lon } satisfies HorizonJob);
      });
    } finally {
      idle.push(w);
      waiting.shift()?.();
    }
  };
  return { run, size: Math.max(1, workers.length), close: kill };
}

const DEG = 180 / Math.PI;

export interface NearbyCell {
  i: number; // column (west -> east on the map)
  j: number; // row (top -> bottom on the map)
  lat: number;
  lon: number;
  distKm: number;
  bearingDeg: number;
  groundM: number;
  slopeDeg: number;
  sunPct: number;
  dtePct: number;
  bothPct: number;
  maxShadowH: number;
}

function visibility(dir: Float64Array, mask: number[], latDeg: number, lonDeg: number): Uint8Array {
  const { E, N, U } = enuFrame(latDeg, lonDeg);
  const n = dir.length / 3;
  const vis = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const x = dir[k * 3], y = dir[k * 3 + 1], z = dir[k * 3 + 2];
    const e = x * E[0] + y * E[1] + z * E[2];
    const nn = x * N[0] + y * N[1] + z * N[2];
    const u = x * U[0] + y * U[1] + z * U[2];
    const el = Math.asin(Math.max(-1, Math.min(1, u))) * DEG;
    const az = (Math.atan2(e, nn) * DEG + 360) % 360;
    vis[k] = el > maskAt(mask, az) ? 1 : 0;
  }
  return vis;
}

export async function scanNearby(
  site: SiteDetail,
  halfM: number,
  n: number,
  onCell: (c: NearbyCell, done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<NearbyCell[]> {
  const sunDir = directions(site.sun.az, site.sun.el, site.lat, site.lon);
  const earthDir = directions(site.earth.az, site.earth.el, site.lat, site.lon);
  const [x0, y0] = polarXY(site.lat, site.lon);
  const step = (2 * halfM) / (n - 1);
  const steps = site.time.n;
  const stepH = site.time.step_h;
  // Spiral-ish order: centre first, then outward, so the useful cells appear early.
  const order: [number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) order.push([i, j]);
  const c = (n - 1) / 2;
  order.sort((a, b) => Math.hypot(a[0] - c, a[1] - c) - Math.hypot(b[0] - c, b[1] - c));

  const cells: NearbyCell[] = [];
  const pool = horizonPool(signal);
  const one = async (i: number, j: number) => {
    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
    const [lat, lon] = polarLatLon(x0 - halfM + i * step, y0 + halfM - j * step);
    const h = await pool.run(lat, lon);
    const sv = visibility(sunDir, h.mask, lat, lon);
    const ev = visibility(earthDir, h.mask, lat, lon);
    let s = 0, e = 0, b = 0, run = 0, maxRun = 0;
    for (let k = 0; k < steps; k++) {
      s += sv[k];
      e += ev[k];
      b += sv[k] & ev[k];
      run = sv[k] ? 0 : run + 1;
      if (run > maxRun) maxRun = run;
    }
    const [distKm, bearingDeg] = distBearing(site.lat, site.lon, lat, lon);
    const cell: NearbyCell = {
      i, j, lat, lon, distKm, bearingDeg,
      groundM: h.groundM,
      slopeDeg: h.slopeDeg,
      sunPct: (100 * s) / steps,
      dtePct: (100 * e) / steps,
      bothPct: (100 * b) / steps,
      maxShadowH: maxRun * stepH,
    };
    cells.push(cell);
    onCell(cell, cells.length, order.length);
  };
  try {
    // Feed the pool in centre-out order; results arrive as workers finish.
    let next = 0;
    await Promise.all(Array.from({ length: pool.size }, async () => {
      while (next < order.length) {
        const [i, j] = order[next++];
        await one(i, j);
      }
    }));
  } finally {
    pool.close();
  }
  return cells;
}

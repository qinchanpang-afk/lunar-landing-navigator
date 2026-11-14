/**
 * Browser-side LOLA polar DEM access and horizon ray-tracing for custom coordinates.
 * Mirrors scripts/build_dem_tiles.py `hybrid_mask`: observer height and the first `near_km` from the
 * 80 m level, the rest (to 100 km) from the 160 m level, exact spherical-Moon geometry.
 */
interface LevelMeta {
  dir: string;
  pixel_m: number;
  origin_x_m: number;
  origin_y_m: number;
  width: number;
  height: number;
  tile: number;
  tiles_x: number;
  tiles_y: number;
}

export interface DemMeta {
  source: string;
  radius_m: number;
  dn_scale_m: number;
  nodata: number;
  near_km: number;
  trace_km: number;
  observer_mast_m: number;
  levels: { l80: LevelMeta; l160: LevelMeta };
}

const BASE = `${import.meta.env.BASE_URL}data/dem/`;
let metaPromise: Promise<DemMeta> | null = null;

export function loadDemMeta(): Promise<DemMeta> {
  metaPromise ??= fetch(`${BASE}meta.json`).then((r) => {
    if (!r.ok) throw new Error(`DEM meta HTTP ${r.status} — run scripts/build_dem_tiles.py`);
    return r.json();
  });
  return metaPromise;
}

const RAD = Math.PI / 180;

async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf; // host already decoded it
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

class DemLevel {
  private tiles = new Map<string, Promise<Int16Array | null>>();
  private ready = new Map<string, Int16Array | null>();
  constructor(readonly m: LevelMeta, readonly nodata: number, readonly scale: number) {}

  private load(tr: number, tc: number) {
    const key = `${tr}_${tc}`;
    let p = this.tiles.get(key);
    if (!p) {
      p = fetch(`${BASE}${this.m.dir}/r${tr}_c${tc}.dem`)
        .then(async (r) => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(`DEM tile ${key} HTTP ${r.status}`);
          const a = new Int16Array(await gunzipIfNeeded(await r.arrayBuffer()));
          const T = this.m.tile;
          for (let row = 0; row < T; row++) {
            const o = row * T;
            for (let c = 1; c < T; c++) a[o + c] = a[o + c - 1] + a[o + c]; // Int16Array wraps mod 2^16
          }
          return a;
        })
        .then((a) => {
          this.ready.set(key, a);
          return a;
        });
      this.tiles.set(key, p);
    }
    return p;
  }

  /** Load every tile intersecting the square of half-size radius_m around map point (x, y). */
  async ensure(x: number, y: number, radiusM: number) {
    const { origin_x_m: ox, origin_y_m: oy, pixel_m: res, tile: T, tiles_x, tiles_y } = this.m;
    const c0 = Math.floor(((x - radiusM - ox) / res) / T);
    const c1 = Math.floor(((x + radiusM - ox) / res) / T);
    const r0 = Math.floor(((oy - (y + radiusM)) / res) / T);
    const r1 = Math.floor(((oy - (y - radiusM)) / res) / T);
    const jobs: Promise<unknown>[] = [];
    for (let tr = Math.max(0, r0); tr <= Math.min(tiles_y - 1, r1); tr++)
      for (let tc = Math.max(0, c0); tc <= Math.min(tiles_x - 1, c1); tc++) jobs.push(this.load(tr, tc));
    await Promise.all(jobs);
    return jobs.length;
  }

  private dn(row: number, col: number): number {
    const { tile: T, width, height } = this.m;
    if (row < 0 || col < 0 || row >= height || col >= width) return NaN;
    const a = this.ready.get(`${Math.floor(row / T)}_${Math.floor(col / T)}`);
    if (!a) return NaN;
    const v = a[(row % T) * T + (col % T)];
    return v === this.nodata ? NaN : v;
  }

  /** Bilinear height (m) at map coordinates; NaN outside data. */
  sample(x: number, y: number): number {
    const { origin_x_m: ox, origin_y_m: oy, pixel_m: res } = this.m;
    const col = (x - ox) / res - 0.5;
    const row = (oy - y) / res - 0.5;
    const r0 = Math.floor(row);
    const c0 = Math.floor(col);
    const fr = row - r0;
    const fc = col - c0;
    const v =
      this.dn(r0, c0) * (1 - fr) * (1 - fc) + this.dn(r0, c0 + 1) * (1 - fr) * fc +
      this.dn(r0 + 1, c0) * fr * (1 - fc) + this.dn(r0 + 1, c0 + 1) * fr * fc;
    return v * this.scale;
  }
}

let levels: Promise<{ meta: DemMeta; near: DemLevel; far: DemLevel }> | null = null;
function getLevels() {
  levels ??= loadDemMeta().then((meta) => ({
    meta,
    near: new DemLevel(meta.levels.l80, meta.nodata, meta.dn_scale_m),
    far: new DemLevel(meta.levels.l160, meta.nodata, meta.dn_scale_m),
  }));
  return levels;
}

/** South-polar stereographic (sphere, true scale at the pole), matching the LOLA product. */
export function project(latDeg: number, lonDeg: number, R: number): [number, number] {
  const rho = 2 * R * Math.tan(Math.PI / 4 + (latDeg * RAD) / 2);
  return [rho * Math.sin(lonDeg * RAD), rho * Math.cos(lonDeg * RAD)];
}

export interface HorizonResult {
  mask: number[];
  distKm: number[];
  groundM: number;
  slopeDeg: number;
  missingFrac: number;
  tiles: number;
}

export async function computeHorizon(lat: number, lon: number, onProgress?: (s: string) => void): Promise<HorizonResult> {
  const { meta, near, far } = await getLevels();
  const R = meta.radius_m;
  const [x0, y0] = project(lat, lon, R);
  onProgress?.("Loading LOLA terrain tiles…");
  const nearR = meta.near_km * 1000 + 3 * near.m.pixel_m;
  const farR = meta.trace_km * 1000 + 3 * far.m.pixel_m;
  const tiles = (await near.ensure(x0, y0, nearR)) + (await far.ensure(x0, y0, farR));

  const ground = near.sample(x0, y0);
  if (!isFinite(ground)) throw new Error("No LOLA DEM data at this location");
  const d = near.m.pixel_m;
  const gx = (near.sample(x0 + d, y0) - near.sample(x0 - d, y0)) / (2 * d);
  const gy = (near.sample(x0, y0 + d) - near.sample(x0, y0 - d)) / (2 * d);
  const slopeDeg = Math.atan(Math.hypot(gx, gy)) / RAD;

  onProgress?.("Ray-tracing 360° horizon…");
  const rObs = R + ground + meta.observer_mast_m;
  const p1 = lat * RAD;
  const l1 = lon * RAD;
  const sp1 = Math.sin(p1);
  const cp1 = Math.cos(p1);
  const mask: number[] = new Array(360);
  const distKm: number[] = new Array(360);
  let missing = 0;
  let total = 0;
  const nearSteps = Math.floor((meta.near_km * 1000) / near.m.pixel_m);
  const farStep = far.m.pixel_m;
  const farN = Math.floor((meta.trace_km * 1000 - meta.near_km * 1000) / farStep);

  for (let a = 0; a < 360; a++) {
    const A = a * RAD;
    const sA = Math.sin(A);
    const cA = Math.cos(A);
    let best = -90;
    let bestD = 0;
    const trace = (dist: number, lvl: DemLevel) => {
      const D = dist / R;
      const sD = Math.sin(D);
      const cD = Math.cos(D);
      const sp2 = Math.max(-1, Math.min(1, sp1 * cD + cp1 * sD * cA));
      const p2 = Math.asin(sp2);
      const l2 = l1 + Math.atan2(sA * sD * cp1, cD - sp1 * sp2);
      const rho = 2 * R * Math.tan(Math.PI / 4 + p2 / 2);
      const h = lvl.sample(rho * Math.sin(l2), rho * Math.cos(l2));
      total++;
      if (!isFinite(h)) {
        missing++;
        return;
      }
      const rt = R + h;
      const e = Math.atan2(rt * cD - rObs, rt * sD) / RAD;
      if (e > best) {
        best = e;
        bestD = dist;
      }
    };
    for (let k = 1; k <= nearSteps; k++) trace(k * near.m.pixel_m, near);
    for (let k = 0; k <= farN; k++) trace(meta.near_km * 1000 + k * farStep, far);
    mask[a] = best;
    distKm[a] = bestD / 1000;
  }
  return { mask, distKm, groundM: ground, slopeDeg, missingFrac: total ? missing / total : 0, tiles };
}

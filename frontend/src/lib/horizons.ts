/**
 * NASA JPL Horizons client for custom sites. The Horizons API sends no CORS headers, so requests
 * go through a same-origin proxy path (Vite dev/preview proxy, or a host rewrite in production).
 */
const ENDPOINT: string = import.meta.env.VITE_HORIZONS_URL ?? "/api/horizons";

export const EPHEM_START = "2026-01-01 00:00";
export const EPHEM_STOP = "2027-12-31 23:59";
export const EPHEM_STEP = "2h";

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const LINE_RE = /^\s*(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})/;
const FLOAT_RE = /[-+]?\d+\.\d+/g;

export interface Ephemeris {
  ms: number[];
  az: number[];
  el: number[];
}

export function parseHorizons(result: string): Ephemeris {
  const soe = result.indexOf("$$SOE");
  const eoe = result.indexOf("$$EOE");
  if (soe < 0 || eoe < 0) throw new Error(`Horizons returned no ephemeris: ${result.slice(0, 300)}`);
  const out: Ephemeris = { ms: [], az: [], el: [] };
  for (const line of result.slice(soe + 5, eoe).split("\n")) {
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const nums = line.slice(m[0].length).match(FLOAT_RE);
    if (!nums || nums.length < 2) throw new Error(`Unparseable Horizons line: ${line}`);
    out.ms.push(Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5]));
    out.az.push(parseFloat(nums[nums.length - 2]));
    out.el.push(parseFloat(nums[nums.length - 1]));
  }
  return out;
}

export async function fetchEphemeris(body: "sun" | "earth", lon: number, lat: number, elevKm: number, signal?: AbortSignal): Promise<Ephemeris> {
  const q = (v: string) => `'${v}'`;
  const params = new URLSearchParams({
    format: "json",
    COMMAND: q(body === "sun" ? "10" : "399"),
    OBJ_DATA: q("NO"),
    MAKE_EPHEM: q("YES"),
    EPHEM_TYPE: q("OBSERVER"),
    CENTER: q("coord@301"),
    COORD_TYPE: q("GEODETIC"),
    SITE_COORD: q(`${lon.toFixed(5)},${lat.toFixed(5)},${elevKm.toFixed(4)}`),
    START_TIME: q(EPHEM_START),
    STOP_TIME: q(EPHEM_STOP),
    STEP_SIZE: q(EPHEM_STEP),
    QUANTITIES: q("4"),
    ANG_FORMAT: q("DEG"),
  });
  const r = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!r.ok) throw new Error(`Horizons proxy HTTP ${r.status} — is the /api/horizons proxy configured?`);
  const data = await r.json();
  if (!data.result) throw new Error(`Horizons error: ${data.error ?? JSON.stringify(data).slice(0, 200)}`);
  return parseHorizons(data.result);
}

/** Small spherical-Moon helpers shared by the map, the nearby scan and URL state. */
const RAD = Math.PI / 180;
export const MOON_R_M = 1737400;

/** South-polar stereographic forward (same formula as dem.ts `project`). */
export function polarXY(latDeg: number, lonDeg: number, R = MOON_R_M): [number, number] {
  const rho = 2 * R * Math.tan(Math.PI / 4 + (latDeg * RAD) / 2);
  return [rho * Math.sin(lonDeg * RAD), rho * Math.cos(lonDeg * RAD)];
}

/** Inverse of polarXY: map metres -> [lat, east lon 0..360). */
export function polarLatLon(x: number, y: number, R = MOON_R_M): [number, number] {
  const rho = Math.hypot(x, y);
  const lat = (2 * Math.atan(rho / (2 * R)) - Math.PI / 2) / RAD;
  const lon = ((Math.atan2(x, y) / RAD) % 360 + 360) % 360;
  return [lat, lon];
}

/** East/North/Up unit vectors of the local horizontal frame at (lat, lon) in the Moon-fixed frame. */
export function enuFrame(latDeg: number, lonDeg: number) {
  const p = latDeg * RAD;
  const l = lonDeg * RAD;
  const sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  return {
    E: [-sl, cl, 0] as const,
    N: [-sp * cl, -sp * sl, cp] as const,
    U: [cp * cl, cp * sl, sp] as const,
  };
}

/**
 * Moon-fixed unit direction vectors for an az/el series observed at (lat, lon).
 * The Sun (and, to <0.001 deg over a few km, the Earth) are effectively at infinity, so the same
 * vectors give the apparent direction from any nearby point after re-projecting into its own frame.
 */
export function directions(az: number[], el: number[], latDeg: number, lonDeg: number): Float64Array {
  const { E, N, U } = enuFrame(latDeg, lonDeg);
  const out = new Float64Array(az.length * 3);
  for (let i = 0; i < az.length; i++) {
    const a = az[i] * RAD, e = el[i] * RAD;
    const ce = Math.cos(e), x = ce * Math.sin(a), y = ce * Math.cos(a), z = Math.sin(e);
    out[i * 3] = x * E[0] + y * N[0] + z * U[0];
    out[i * 3 + 1] = x * E[1] + y * N[1] + z * U[1];
    out[i * 3 + 2] = x * E[2] + y * N[2] + z * U[2];
  }
  return out;
}

/** Great-circle distance (km) and initial bearing (deg from north) between two points. */
export function distBearing(lat1: number, lon1: number, lat2: number, lon2: number): [number, number] {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const d = 2 * Math.asin(Math.min(1, Math.sqrt(a))) * MOON_R_M / 1000;
  const b = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD;
  return [d, (b + 360) % 360];
}

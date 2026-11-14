/**
 * Deep links into the NASA/LROC tools listed in the challenge resources.
 * QuickMap (now hosted at quickmap.lroc.im-ldi.com) accepts a projected extent in metres:
 *  - proj=17 "Orthographic (South Pole)": x = R cos(lat) sin(lon), y = R cos(lat) cos(lon)
 *    (verified: the centre of the generated view reads back -89.686, 197.42 E for Shackleton rim)
 *  - proj=16 "Equidistant Cylindrical (< 75 deg)": x = R * lon, y = R * lat (radians, lon in -180..180)
 */
const R = 1737400;
const RAD = Math.PI / 180;

export function quickmapUrl(lat: number, lon: number): string {
  let x: number, y: number, h: number, proj: number;
  if (lat < -60) {
    proj = 17;
    x = R * Math.cos(lat * RAD) * Math.sin(lon * RAD);
    y = R * Math.cos(lat * RAD) * Math.cos(lon * RAD);
    h = 4000;
  } else {
    proj = 16;
    const ls = ((lon + 180) % 360 + 360) % 360 - 180;
    x = R * ls * RAD;
    y = R * lat * RAD;
    h = 20000;
  }
  const ext = [x - h, y - h, x + h, y + h].map((v) => v.toFixed(0)).join(",");
  return `https://quickmap.lroc.im-ldi.com/?proj=${proj}&prjExtent=${encodeURIComponent(ext)}`;
}

export const MOON_TREK_URL = "https://trek.nasa.gov/moon/";

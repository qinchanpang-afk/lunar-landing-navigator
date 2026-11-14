"""
Independent NASA cross-check: LOLA long-term average Sun and Earth visibility (Mazarico et al. 2011,
NASA GSFC PGDA product 69, 2016 release, 60 m/px, 85S-90S, averaged over an 18.6-year nutation cycle).

Inputs  (raw_data/pgda/, from https://pgda.gsfc.nasa.gov/products/69):
  AVGVISIB_85S_060M_201608.TIF        fraction of time any part of the solar disc is visible
  AVGVISIB_85S_060M_201608_EARTH.TIF  same for the Earth disc
  DN * 0.00004 = fraction (PDS label SCALING_FACTOR), nodata -32768.

Outputs (frontend/public/data/pgda/):
  pgda_sites.json                      values at every catalog site south of the coverage edge
  {sun,earth}_{region,pole}.png        colour overlays aligned with the base-map layers
  {sun,earth}_{region,pole}_val.png    8-bit value layers (DN = round(fraction*250)) for hover read-out
Display / validation only: the app's own statistics do not use these maps.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "raw_data" / "pgda"
OUT = ROOT / "frontend" / "public" / "data" / "pgda"
BASEMAP = ROOT / "frontend" / "public" / "data" / "basemap" / "basemap.json"
INDEX = ROOT / "frontend" / "public" / "data" / "sites_index.json"
SCALE = 0.00004
R = 1737400.0
FILES = {"sun": "AVGVISIB_85S_060M_201608.TIF", "earth": "AVGVISIB_85S_060M_201608_EARTH.TIF"}


def load(name: str):
    with rasterio.open(SRC / name) as ds:
        a = ds.read(1).astype(np.float32)
        tr = ds.transform
        crs = ds.crs.to_proj4()
    assert "+proj=stere" in crs and "+lat_0=-90" in crs and "+R=1737400" in crs, crs
    a[a == -32768] = np.nan
    return a * SCALE, float(tr.c), float(tr.f), float(tr.a)


def project(lat: float, lon: float):
    rho = 2 * R * np.tan(np.pi / 4 + np.radians(lat) / 2)
    return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))


def bilinear(a, x0, y0, px, x, y):
    col = (x - x0) / px - 0.5
    row = (y0 - y) / px - 0.5
    r0, c0 = int(np.floor(row)), int(np.floor(col))
    if r0 < 0 or c0 < 0 or r0 + 1 >= a.shape[0] or c0 + 1 >= a.shape[1]:
        return None, None
    fr, fc = row - r0, col - c0
    v = (a[r0, c0] * (1 - fr) * (1 - fc) + a[r0, c0 + 1] * (1 - fr) * fc
         + a[r0 + 1, c0] * fr * (1 - fc) + a[r0 + 1, c0 + 1] * fr * fc)
    return float(v), None


def disc_max(a, x0, y0, px, x, y, radius_m):
    """Largest value within radius_m: at sharp peaks a few tens of metres of position or DEM
    difference changes the value a lot, so the local maximum is the fairer comparison."""
    c, r = int((x - x0) / px), int((y0 - y) / px)
    n = int(round(radius_m / px))
    yy, xx = np.mgrid[-n:n + 1, -n:n + 1]
    win = a[max(0, r - n):r + n + 1, max(0, c - n):c + n + 1]
    m = (xx ** 2 + yy ** 2 <= n * n)[: win.shape[0], : win.shape[1]]
    return float(np.nanmax(win[m]))


def resample(a, x0, y0, px, layer):
    """Nearest-neighbour resample of the PGDA grid onto a base-map layer grid (same projection)."""
    n = layer["px"]
    step = layer["size_m"] / n
    xs = layer["x0_m"] + (np.arange(n) + 0.5) * step
    ys = layer["y0_m"] - (np.arange(n) + 0.5) * step
    cols = np.floor((xs - x0) / px).astype(int)
    rows = np.floor((y0 - ys) / px).astype(int)
    ok_c = (cols >= 0) & (cols < a.shape[1])
    ok_r = (rows >= 0) & (rows < a.shape[0])
    out = np.full((n, n), np.nan, np.float32)
    rr, cc = np.meshgrid(np.where(ok_r, rows, 0), np.where(ok_c, cols, 0), indexing="ij")
    vals = a[rr, cc]
    mask = np.outer(ok_r, ok_c)
    out[mask] = vals[mask]
    return out


def colourise(v: np.ndarray, body: str) -> np.ndarray:
    """RGBA overlay. Sun: permanent shadow (0) in ice blue, lit fraction on an amber ramp.
    Earth: never visible in dark slate, visible fraction on a sky-blue ramp."""
    rgba = np.zeros(v.shape + (4,), np.uint8)
    valid = ~np.isnan(v)
    t = np.clip(np.nan_to_num(v), 0, 1)
    if body == "sun":
        lo, hi = np.array([90, 50, 10], float), np.array([255, 226, 140], float)
        rgb = lo + (hi - lo) * t[..., None] ** 0.8
        alpha = 70 + 150 * t
        psr = valid & (v <= 0.0005)
        rgb[psr] = [80, 170, 255]
        alpha = np.where(psr, 170, alpha)
    else:
        lo, hi = np.array([15, 40, 90], float), np.array([150, 220, 255], float)
        rgb = lo + (hi - lo) * t[..., None]
        alpha = 60 + 150 * t
        none = valid & (v <= 0.0005)
        rgb[none] = [30, 30, 40]
        alpha = np.where(none, 150, alpha)
    rgba[..., :3] = rgb.astype(np.uint8)
    rgba[..., 3] = np.where(valid, alpha, 0).astype(np.uint8)
    return rgba


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    layers = json.loads(BASEMAP.read_text())["layers"]
    sites = json.loads(INDEX.read_text())["sites"]
    data = {k: load(f) for k, f in FILES.items()}

    rows = []
    for s in sites:
        if s["lat"] > -80:
            continue
        x, y = project(s["lat"], s["lon"])
        row = {"id": s["id"], "name": s["name"], "lat": s["lat"], "lon": s["lon"],
               "ours_sun_pct": s["stats"]["sunlight_pct"], "ours_dte_pct": s["stats"]["dte_pct"]}
        for k, (a, x0, y0, px) in data.items():
            v, _ = bilinear(a, x0, y0, px, x, y)
            row[f"pgda_{k}_pct"] = None if v is None else round(100 * v, 2)
            row[f"pgda_{k}_max150_pct"] = None if v is None else round(100 * disc_max(a, x0, y0, px, x, y, 150), 2)
        rows.append(row)
        print(f"{s['id']:18s} ours sun {row['ours_sun_pct']:6.2f}%  NASA {row['pgda_sun_pct']}%  "
              f"(max 150 m: {row['pgda_sun_max150_pct']}) | ours DTE {row['ours_dte_pct']:6.2f}%  NASA Earth {row['pgda_earth_pct']}% (max 150 m: {row['pgda_earth_max150_pct']})")

    for k, (a, x0, y0, px) in data.items():
        for name, layer in layers.items():
            v = resample(a, x0, y0, px, layer)
            Image.fromarray(colourise(v, k)).save(OUT / f"{k}_{name}.png", optimize=True)
            dn = np.where(np.isnan(v), 255, np.round(np.clip(v, 0, 1) * 250)).astype(np.uint8)
            Image.fromarray(dn).save(OUT / f"{k}_{name}_val.png", optimize=True)

    meta = {
        "source": "NASA GSFC PGDA Lunar Polar Illumination (Mazarico et al. 2011), 2016 release: "
                  "AVGVISIB_85S_060M_201608 (+ _EARTH), LOLA LDEM_85S_060M, 60 m/px",
        "url": "https://pgda.gsfc.nasa.gov/products/69",
        "definition": "fraction of hourly time steps over an 18.6-year lunar nutation cycle in which any part of the "
                      "solar (or Earth) disc is visible from the surface",
        "value_png": "DN = round(fraction*250); 255 = no data",
        "sites": rows,
    }
    (OUT / "pgda_sites.json").write_text(json.dumps(meta, indent=1))
    for p in sorted(OUT.iterdir()):
        print(f"  {p.name}: {p.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()

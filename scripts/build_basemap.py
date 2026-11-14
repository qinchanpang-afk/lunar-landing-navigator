"""
Render shaded-relief base maps of the lunar south pole from the LOLA LDEM_80S_80M DEM for the web map.

Outputs (frontend/public/data/basemap/):
  region.jpg    - +-160 km around the pole (all polar candidate sites), 4x block mean (320 m/px)
  pole.jpg      - +-48 km around the pole at full 80 m/px (Shackleton, its floor, the CSA peak)
  basemap.json  - extents in the DEM's polar-stereographic metres, so the browser can place markers
                  and convert clicks back to latitude/longitude.
Display only: no analysis uses these images.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEM = ROOT / "raw_data" / "ldem_80s_80m.lbl"
OUT = ROOT / "frontend" / "public" / "data" / "basemap"
DN_SCALE = 0.5
POLE_HALF_KM = 48
REGION_HALF_KM = 160


def block_mean(a: np.ndarray, f: int) -> np.ndarray:
    h, w = (a.shape[0] // f) * f, (a.shape[1] // f) * f
    return np.nanmean(a[:h, :w].reshape(h // f, f, w // f, f), axis=(1, 3))


def shade(z: np.ndarray, px_m: float, az_deg=315.0, alt_deg=35.0, exag=2.0) -> np.ndarray:
    """Classic Lambertian hillshade (row 0 = north/top), blended with a subtle hypsometric tint."""
    gy, gx = np.gradient(np.nan_to_num(z, nan=np.nanmean(z)) * exag, px_m)
    gy = -gy  # rows increase southward on the image, map y increases upward
    az, alt = np.radians(az_deg), np.radians(alt_deg)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    hs = np.clip(hs, 0, 1)
    lo, hi = np.nanpercentile(z, [1, 99])
    t = np.clip((z - lo) / (hi - lo), 0, 1)
    low = np.array([38, 46, 70], float)    # deep crater floors: cool blue-grey
    high = np.array([214, 206, 188], float)  # highlands: warm grey
    tint = low[None, None, :] * (1 - t[..., None]) + high[None, None, :] * t[..., None]
    rgb = tint * (0.35 + 0.75 * hs[..., None])
    rgb[np.isnan(z)] = 0
    return np.clip(rgb, 0, 255).astype(np.uint8)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with rasterio.open(DEM) as ds:
        z = ds.read(1).astype(np.float32)
        nod = ds.nodata
        tr = ds.transform
    if nod is not None:
        z[z == nod] = np.nan
    z *= DN_SCALE
    px = float(tr.a)
    x0, y0 = float(tr.c), float(tr.f)
    assert abs(px - 80) < 1e-6, px

    meta = {"source": "LRO LOLA LDEM_80S_80M shaded relief (display only)", "layers": {}}

    def crop(half_km: float):
        half = half_km * 1000
        c0 = int(round((-half - x0) / px))
        r0 = int(round((y0 - half) / px))
        n = int(round(2 * half / px))
        return z[r0:r0 + n, c0:c0 + n], x0 + c0 * px, y0 - r0 * px

    f = 4
    reg, rx, ry = crop(REGION_HALF_KM)
    reg = block_mean(reg, f)
    Image.fromarray(shade(reg, px * f)).save(OUT / "region.jpg", quality=84, optimize=True)
    meta["layers"]["region"] = {"file": "region.jpg", "x0_m": rx, "y0_m": ry, "size_m": reg.shape[1] * px * f, "px": reg.shape[1]}

    pole, pxm, pym = crop(POLE_HALF_KM)
    Image.fromarray(shade(pole, px, exag=1.5)).save(OUT / "pole.jpg", quality=84, optimize=True)
    meta["layers"]["pole"] = {"file": "pole.jpg", "x0_m": pxm, "y0_m": pym, "size_m": pole.shape[1] * px, "px": pole.shape[1]}

    (OUT / "basemap.json").write_text(json.dumps(meta, indent=1))
    for k, v in meta["layers"].items():
        size = (OUT / v["file"]).stat().st_size / 1024
        print(f"{k}: {v['px']} px, {v['size_m'] / v['px']:.0f} m/px, {size:.0f} KB")


if __name__ == "__main__":
    main()

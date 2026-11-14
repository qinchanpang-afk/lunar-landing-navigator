#!/usr/bin/env python3
"""
Export the LOLA south-polar DEM as compressed tiles for the browser's custom-coordinate horizon
ray-tracer, and validate the browser algorithm against the 80 m pipeline.

Two pyramid levels are written to frontend/public/data/dem/:
  l80/   full-resolution 80 m/px, 128x128 tiles  -> near field (observer height + first NEAR_KM)
  l160/  2x2 block-mean 160 m/px, 256x256 tiles  -> far field (NEAR_KM .. 100 km)
Tile file format (*.dem): gzip( little-endian int16 row-wise delta of DN ), i.e. the first sample
of each row is absolute and every following sample is the difference to its left neighbour
(modulo 2^16). DN * dn_scale_m = height in metres relative to R=1737.4 km; -32768 = no data.

Validation recomputes every catalog polar site's horizon with the hybrid near/far algorithm and
compares mask and sunlight / DTE % with the 80 m results using cached Horizons ephemerides.

Usage: python scripts/build_dem_tiles.py
"""
import gzip
import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd  # noqa: E402

OUT = bd.OUT / "dem"
NEAR_KM = 5.0
LEVELS = [("l80", 1, 128), ("l160", 2, 256)]
NODATA = -32768


def encode_tile(block: np.ndarray) -> bytes:
    d = np.diff(block.astype(np.int32), axis=1, prepend=0).astype("<i2")  # wraps modulo 2^16
    return gzip.compress(d.tobytes(), 6, mtime=0)


def export_level(dem: bd.PolarDEM, name: str, tile: int) -> dict:
    out = OUT / name
    out.mkdir(parents=True, exist_ok=True)
    h = dem.height_m
    ny, nx = h.shape
    dn = np.where(np.isfinite(h), np.round(h / dem.scale), NODATA).astype(np.int16)
    nty, ntx = -(-ny // tile), -(-nx // tile)
    total = 0
    for tr in range(nty):
        for tc in range(ntx):
            block = np.full((tile, tile), NODATA, dtype=np.int16)
            sub = dn[tr * tile:(tr + 1) * tile, tc * tile:(tc + 1) * tile]
            block[: sub.shape[0], : sub.shape[1]] = sub
            if (block == NODATA).all():
                continue
            data = encode_tile(block)
            (out / f"r{tr}_c{tc}.dem").write_bytes(data)
            total += len(data)
    t = dem.transform
    print(f"  {name}: {nty}x{ntx} tiles of {tile}px @ {dem.res:.0f} m, {total / 1e6:.1f} MB")
    return {"dir": name, "pixel_m": dem.res, "origin_x_m": t.c, "origin_y_m": t.f,
            "width": nx, "height": ny, "tile": tile, "tiles_x": ntx, "tiles_y": nty}


def ray_elevations(dem, lat, lon, r_obs, dist):
    """Max terrain elevation angle per 1-deg azimuth along great circles (same maths as the browser)."""
    delta = dist / bd.R_MOON_M
    az = np.deg2rad(np.arange(360.0))
    p1, l1 = math.radians(lat), math.radians(lon)
    D, A = np.meshgrid(delta, az)
    sp2 = math.sin(p1) * np.cos(D) + math.cos(p1) * np.sin(D) * np.cos(A)
    p2 = np.arcsin(np.clip(sp2, -1, 1))
    l2 = l1 + np.arctan2(np.sin(A) * np.sin(D) * math.cos(p1), np.cos(D) - math.sin(p1) * sp2)
    h = dem.sample(np.rad2deg(l2).ravel(), np.rad2deg(p2).ravel()).reshape(D.shape)
    rt = bd.R_MOON_M + h
    e = np.degrees(np.arctan2(rt * np.cos(D) - r_obs, rt * np.sin(D)))
    return np.where(np.isfinite(e), e, -90.0).max(axis=1)


def hybrid_mask(dem80, dem160, lat, lon):
    g = float(dem80.sample(np.array([lon]), np.array([lat]))[0])
    r_obs = bd.R_MOON_M + g + bd.OBSERVER_MAST_M
    near = ray_elevations(dem80, lat, lon, r_obs, dem80.res * np.arange(1, int(NEAR_KM * 1000 / dem80.res) + 1))
    far = ray_elevations(dem160, lat, lon, r_obs, np.arange(NEAR_KM * 1000, bd.TRACE_KM * 1000 + 1, dem160.res))
    return np.maximum(near, far), g


def validate(dem80, dem160) -> list:
    index = json.loads((bd.OUT / "sites_index.json").read_text(encoding="utf-8"))
    rows = []
    print(f"\n  {'site':18s} {'maskRMS':>7s} {'max|d|':>7s} {'sun80':>6s} {'hybrid':>6s} {'DTE80':>6s} {'hybrid':>6s}")
    for s in index["sites"]:
        if s["lat"] > bd.POLAR_LAT_LIMIT:
            continue
        m, _ = hybrid_mask(dem80, dem160, s["lat"], s["lon"])
        d = m - np.array(s["horizon_mask_deg"])
        eph = bd.ephemeris(s["id"], s["lat"], s["lon"], s["elev_km_used"], offline=True)
        a = bd.analyse(s["lat"], s["lon"], s["elev_km_used"], m, eph)
        row = {"id": s["id"], "mask_rms_deg": round(float(np.sqrt((d ** 2).mean())), 3),
               "mask_max_abs_deg": round(float(np.abs(d).max()), 3),
               "sun_pct_80m": s["stats"]["sunlight_pct"], "sun_pct_hybrid": round(100 * float(a["sun"]["vis"].mean()), 2),
               "dte_pct_80m": s["stats"]["dte_pct"], "dte_pct_hybrid": round(100 * float(a["earth"]["vis"].mean()), 2),
               "hybrid_mask_deg": [round(float(v), 2) for v in m]}
        rows.append(row)
        print(f"  {s['id']:18s} {row['mask_rms_deg']:7.2f} {row['mask_max_abs_deg']:7.2f} {row['sun_pct_80m']:6.1f} "
              f"{row['sun_pct_hybrid']:6.1f} {row['dte_pct_80m']:6.1f} {row['dte_pct_hybrid']:6.1f}")
    return rows


def main():
    dem80 = bd.PolarDEM(bd.DEM_LBL)
    dem160 = dem80.downsampled(2)
    if OUT.exists():
        shutil.rmtree(OUT)
    old = bd.OUT / "dem160"
    if old.exists():
        shutil.rmtree(old)
    print("Exporting tiles:")
    levels = {name: export_level(d, name, tile) for (name, f, tile), d in zip(LEVELS, (dem80, dem160))}
    rows = validate(dem80, dem160)
    meta = {
        "source": f"{bd.DEM_LBL.name} (LRO LOLA), l160 = 2x2 block mean",
        "proj": "polar stereographic on sphere R=1737400 m, lat_0=-90, lat_ts=-90, lon_0=0 (x = rho sin lon, y = rho cos lon)",
        "encoding": "gzip(int16 LE row-delta of DN, modulo 2^16)",
        "radius_m": bd.R_MOON_M, "dn_scale_m": dem80.scale, "nodata": NODATA,
        "near_km": NEAR_KM, "trace_km": bd.TRACE_KM, "observer_mast_m": bd.OBSERVER_MAST_M,
        "levels": levels,
        "validation": rows,
    }
    (OUT / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    print(f"\nWrote {OUT / 'meta.json'}")


if __name__ == "__main__":
    main()

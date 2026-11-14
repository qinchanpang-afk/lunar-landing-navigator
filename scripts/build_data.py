#!/usr/bin/env python3
"""
Lunar Landing Site Navigator - static data pipeline.

For every site in raw_data/sites.json this script:
  1. Computes a 360-sample (0..359 deg, 1 deg step) topographic horizon mask.
     - South-polar sites (lat <= -80): ray-traced on the LOLA polar DEM
       (raw_data/ldem_80s_80m.img/.lbl) out to 100 km along great circles,
       with exact spherical-Moon curvature (R = 1737.4 km).
     - Other sites: ideal spherical horizon (0.0 deg everywhere).
  2. Fetches apparent Sun (10) and Earth (399) azimuth/elevation from the
     NASA JPL Horizons API, 2026-01-01 .. 2027-12-31 UTC every 2 h, with a raw
     response cache in raw_data/cache/.
  3. Derives per-timestep visibility (strictly elevation > horizon mask; the
     Moon is airless, so no refraction), solar power efficiency, and hours
     remaining until the next sunset / Earthset.
  4. Writes frontend/public/data/sites_index.json and <site_id>.json.
  5. Runs physical sanity checks and prints the report.

Usage:  python scripts/build_data.py [--offline] [--skip-checks]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
import requests
from pyproj import CRS, Transformer

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw_data"
CACHE = RAW / "cache"
OUT = ROOT / "frontend" / "public" / "data"
SITES_FILE = RAW / "sites.json"
DEM_LBL = RAW / "ldem_80s_80m.lbl"

R_MOON_M = 1737400.0
POLAR_LAT_LIMIT = -80.0           # DEM covers 80S..90S
TRACE_KM = 100.0                  # raycast distance
OBSERVER_MAST_M = 2.0             # instrument / solar-panel height above DEM surface
DEM_SCALE_EXPECTED = 0.5          # metres per DN (verified against .lbl at runtime)

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
START_TIME = "2026-01-01 00:00"
STOP_TIME = "2027-12-31 23:59"    # last sample: 2027-12-31 22:00
STEP_SIZE = "2h"
STEP_H = 2.0
BODIES = {"sun": "10", "earth": "399"}

MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}
LINE_RE = re.compile(r"^\s*(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})")
FLOAT_RE = re.compile(r"[-+]?\d+\.\d+")


def log(msg: str) -> None:
    print(msg, flush=True)


# --------------------------------------------------------------------------
# DEM + horizon mask
# --------------------------------------------------------------------------
class PolarDEM:
    """LOLA polar-stereographic DEM read via rasterio, sampled bilinearly."""

    def __init__(self, lbl_path: Path):
        with rasterio.open(lbl_path) as ds:
            scale = ds.scales[0]
            if not math.isclose(scale, DEM_SCALE_EXPECTED):
                raise RuntimeError(f"Unexpected DEM scale {scale}, expected {DEM_SCALE_EXPECTED}")
            if ds.crs is None:
                raise RuntimeError("DEM has no CRS")
            self.crs_proj4 = ds.crs.to_proj4()
            self.transform = ds.transform
            self.res = ds.transform.a
            raw = ds.read(1)
            nodata = ds.nodata
        self.height_m = raw.astype(np.float32) * np.float32(scale)
        if nodata is not None:
            self.height_m[raw == nodata] = np.nan
        self.shape = raw.shape
        crs = CRS.from_proj4(self.crs_proj4)
        # Planetocentric lon/lat on the same 1737.4 km sphere as the projection.
        geo = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs")
        self.fwd = Transformer.from_crs(geo, crs, always_xy=True)
        self.inv = Transformer.from_crs(crs, geo, always_xy=True)
        self.scale = scale

    def downsampled(self, factor: int) -> "PolarDEM":
        """Block-mean downsampled copy (used for the browser's custom-site DEM and its validation)."""
        ny, nx = self.shape
        h = self.height_m[: ny - ny % factor, : nx - nx % factor]
        h = h.reshape(ny // factor, factor, nx // factor, factor).mean(axis=(1, 3))
        out = object.__new__(PolarDEM)
        out.__dict__.update(self.__dict__)
        out.height_m = h.astype(np.float32)
        out.shape = h.shape
        out.transform = self.transform * rasterio.Affine.scale(factor)
        out.res = out.transform.a
        return out

    def describe(self) -> dict:
        t = self.transform
        return {
            "file": DEM_LBL.name,
            "crs": self.crs_proj4,
            "pixel_m": self.res,
            "shape": list(self.shape),
            "origin_xy_m": [t.c, t.f],
            "dn_scale_m": self.scale,
        }

    def sample(self, lon_deg: np.ndarray, lat_deg: np.ndarray) -> np.ndarray:
        x, y = self.fwd.transform(lon_deg, lat_deg)
        x = np.asarray(x)
        y = np.asarray(y)
        t = self.transform
        col = (x - t.c) / t.a - 0.5          # pixel-centre coordinates
        row = (y - t.f) / t.e - 0.5
        r0 = np.floor(row).astype(np.int64)
        c0 = np.floor(col).astype(np.int64)
        fr = row - r0
        fc = col - c0
        ny, nx = self.shape
        ok = (r0 >= 0) & (c0 >= 0) & (r0 < ny - 1) & (c0 < nx - 1)
        out = np.full(x.shape, np.nan, dtype=np.float64)
        r0o, c0o, fro, fco = r0[ok], c0[ok], fr[ok], fc[ok]
        h = self.height_m
        out[ok] = (h[r0o, c0o] * (1 - fro) * (1 - fco) + h[r0o, c0o + 1] * (1 - fro) * fco
                   + h[r0o + 1, c0o] * fro * (1 - fco) + h[r0o + 1, c0o + 1] * fro * fco)
        return out


def horizon_mask(dem: PolarDEM, lat: float, lon: float) -> tuple[np.ndarray, np.ndarray, float]:
    """Return (mask_deg[360], dist_km_of_max[360], ground_elev_m)."""
    ground = float(dem.sample(np.array([lon]), np.array([lat]))[0])
    if not np.isfinite(ground):
        raise RuntimeError(f"No DEM data at {lat},{lon}")
    r_obs = R_MOON_M + ground + OBSERVER_MAST_M

    n_steps = int(round(TRACE_KM * 1000.0 / dem.res))
    dist = dem.res * np.arange(1, n_steps + 1)               # metres
    delta = dist / R_MOON_M                                   # central angle (rad)
    az = np.deg2rad(np.arange(360.0))                         # bearing clockwise from north

    phi1 = math.radians(lat)
    lam1 = math.radians(lon)
    D, A = np.meshgrid(delta, az)                             # (360, n_steps)
    sin_phi2 = math.sin(phi1) * np.cos(D) + math.cos(phi1) * np.sin(D) * np.cos(A)
    phi2 = np.arcsin(np.clip(sin_phi2, -1, 1))
    lam2 = lam1 + np.arctan2(np.sin(A) * np.sin(D) * math.cos(phi1),
                             np.cos(D) - math.sin(phi1) * sin_phi2)

    h = dem.sample(np.rad2deg(lam2).ravel(), np.rad2deg(phi2).ravel()).reshape(D.shape)
    r_t = R_MOON_M + h
    # Exact spherical geometry: elevation of target as seen from observer.
    elev = np.degrees(np.arctan2(r_t * np.cos(D) - r_obs, r_t * np.sin(D)))
    elev = np.where(np.isfinite(elev), elev, -90.0)
    idx = np.argmax(elev, axis=1)
    mask = elev[np.arange(360), idx]
    return mask, dist[idx] / 1000.0, ground


def mask_at(mask: np.ndarray, az_deg: np.ndarray) -> np.ndarray:
    """Linear interpolation of a 1-deg circular mask at arbitrary azimuths."""
    a = np.mod(az_deg, 360.0)
    i0 = np.floor(a).astype(int) % 360
    f = a - np.floor(a)
    return mask[i0] * (1 - f) + mask[(i0 + 1) % 360] * f


# --------------------------------------------------------------------------
# Horizons
# --------------------------------------------------------------------------
def horizons_params(body_code: str, lon: float, lat: float, elev_km: float,
                    start: str = START_TIME, stop: str = STOP_TIME) -> dict:
    q = lambda v: f"'{v}'"
    return {
        "format": "json",
        "COMMAND": q(body_code),
        "OBJ_DATA": q("NO"),
        "MAKE_EPHEM": q("YES"),
        "EPHEM_TYPE": q("OBSERVER"),
        "CENTER": q("coord@301"),
        "COORD_TYPE": q("GEODETIC"),
        "SITE_COORD": q(f"{lon:.5f},{lat:.5f},{elev_km:.4f}"),
        "START_TIME": q(start),
        "STOP_TIME": q(stop),
        "STEP_SIZE": q(STEP_SIZE),
        "QUANTITIES": q("4"),
        "ANG_FORMAT": q("DEG"),
    }


def fetch_horizons(tag: str, params: dict, offline: bool) -> str:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()[:10]
    path = CACHE / f"{tag}_{key}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))["result"]
    if offline:
        raise RuntimeError(f"--offline and no cache for {tag} ({path.name})")
    last_err = None
    for attempt in range(4):
        try:
            r = requests.get(HORIZONS_URL, params=params, timeout=180)
            r.raise_for_status()
            data = r.json()
            if "result" not in data or "$$SOE" not in data["result"]:
                raise RuntimeError(f"Horizons error: {data.get('error') or data.get('result', '')[:500]}")
            path.write_text(json.dumps({"params": params, "fetched_utc": datetime.now(timezone.utc).isoformat(),
                                        "result": data["result"]}), encoding="utf-8")
            time.sleep(0.5)
            return data["result"]
        except Exception as e:  # noqa: BLE001
            last_err = e
            log(f"    Horizons request failed ({e}); retry {attempt + 1}/4")
            time.sleep(2.0 * (attempt + 1))
    raise RuntimeError(f"Horizons fetch failed for {tag}: {last_err}")


def parse_horizons(result: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (unix_seconds, az_deg, el_deg) from the $$SOE..$$EOE block."""
    block = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    ts, az, el = [], [], []
    for line in block.splitlines():
        m = LINE_RE.match(line)
        if not m:
            continue
        y, mon, d, hh, mm = m.groups()
        dt = datetime(int(y), MONTHS[mon], int(d), int(hh), int(mm), tzinfo=timezone.utc)
        nums = FLOAT_RE.findall(line[m.end():])
        if len(nums) < 2:
            raise RuntimeError(f"Unparseable Horizons line: {line!r}")
        ts.append(dt.timestamp())
        az.append(float(nums[-2]))
        el.append(float(nums[-1]))
    return np.array(ts), np.array(az), np.array(el)


# --------------------------------------------------------------------------
# Derived quantities
# --------------------------------------------------------------------------
def crossings(t_h: np.ndarray, margin: np.ndarray, rising: bool) -> np.ndarray:
    """Interpolated times (hours) where margin crosses 0 (rising: -→+, else +→-)."""
    vis = margin > 0
    if rising:
        idx = np.where(~vis[:-1] & vis[1:])[0]
    else:
        idx = np.where(vis[:-1] & ~vis[1:])[0]
    m0, m1 = margin[idx], margin[idx + 1]
    frac = np.where(m0 != m1, m0 / (m0 - m1), 0.5)
    return t_h[idx] + frac * (t_h[idx + 1] - t_h[idx])


def time_to_next(t_h: np.ndarray, events: np.ndarray, applies: np.ndarray) -> list:
    """Hours from each step to the next event; None where not applicable / no event in dataset."""
    out = [None] * len(t_h)
    if len(events) == 0:
        return out
    j = np.searchsorted(events, t_h, side="right")
    for i in np.where(applies)[0]:
        if j[i] < len(events):
            out[i] = round(float(events[j[i]] - t_h[i]), 1)
    return out


def runs(mask: np.ndarray, value: bool) -> list[tuple[int, int]]:
    """List of (start, length) runs where mask == value."""
    m = np.concatenate([[False], mask == value, [False]])
    d = np.diff(m.astype(int))
    starts = np.where(d == 1)[0]
    ends = np.where(d == -1)[0]
    return list(zip(starts, ends - starts))


def body_track(t_h, az, el, mask):
    margin = el - mask_at(mask, az)
    vis = margin > 0
    sets = crossings(t_h, margin, rising=False)
    rises = crossings(t_h, margin, rising=True)
    return margin, vis, sets, rises


def period_stats(vis: np.ndarray, n: int) -> dict:
    """Run-length statistics; runs touching the dataset edges are excluded from 'complete' means."""
    on = runs(vis, True)
    off = runs(vis, False)
    complete_on = [l for s, l in on if s > 0 and s + l < n]
    complete_off = [l for s, l in off if s > 0 and s + l < n]
    return {
        "max_continuous_visible_h": float(max((l for _, l in on), default=0) * STEP_H),
        "max_continuous_hidden_h": float(max((l for _, l in off), default=0) * STEP_H),
        "mean_complete_visible_period_days": round(float(np.mean(complete_on)) * STEP_H / 24, 2) if complete_on else None,
        "mean_complete_hidden_period_days": round(float(np.mean(complete_off)) * STEP_H / 24, 2) if complete_off else None,
        "complete_visible_periods": len(complete_on),
    }


def r(arr, nd):
    return [round(float(v), nd) for v in arr]


# --------------------------------------------------------------------------
# Per-site processing
# --------------------------------------------------------------------------
def ephemeris(tag, lat, lon, elev_km, offline):
    out = {}
    for body, code in BODIES.items():
        params = horizons_params(code, lon, lat, elev_km)
        ts, az, el = parse_horizons(fetch_horizons(f"{tag}_{body}", params, offline))
        out[body] = (ts, az, el)
    if not np.array_equal(out["sun"][0], out["earth"][0]):
        raise RuntimeError(f"{tag}: Sun/Earth timestamps differ")
    return out


def analyse(lat, lon, elev_km, mask, eph):
    ts = eph["sun"][0]
    n = len(ts)
    t_h = (ts - ts[0]) / 3600.0
    if not np.allclose(np.diff(t_h), STEP_H):
        raise RuntimeError("Non-uniform Horizons time step")
    res = {"n": n, "ts": ts, "t_h": t_h}
    for body in BODIES:
        _, az, el = eph[body]
        margin, vis, sets, rises = body_track(t_h, az, el, mask)
        res[body] = {"az": az, "el": el, "margin": margin, "vis": vis, "sets": sets, "rises": rises}
    return res


def gc_dist_bearing(lat1, lon1, lat2, lon2):
    """Great-circle distance (m) and initial bearing (deg, clockwise from north) on the R_MOON sphere."""
    p1, l1 = math.radians(lat1), math.radians(lon1)
    p2, l2 = np.radians(lat2), np.radians(lon2)
    dl = l2 - l1
    a = np.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    dist = 2 * R_MOON_M * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    brg = np.degrees(np.arctan2(np.sin(dl) * np.cos(p2),
                                math.cos(p1) * np.sin(p2) - math.sin(p1) * np.cos(p2) * np.cos(dl))) % 360
    return dist, brg


def snap_to_dem(dem: PolarDEM, lat: float, lon: float, cfg: dict) -> dict:
    """Move a catalog coordinate to the DEM extremum (max = summit/rim crest, min = crater floor)
    within an annulus [min_dist_km, radius_km] and optional bearing sector of the catalog point."""
    t = dem.transform
    x, y = dem.fwd.transform(lon, lat)
    col0 = int((x - t.c) / t.a)
    row0 = int((y - t.f) / t.e)
    rp = int(math.ceil(cfg["radius_km"] * 1000 / dem.res)) + 1
    r_lo, r_hi = max(row0 - rp, 0), min(row0 + rp + 1, dem.shape[0])
    c_lo, c_hi = max(col0 - rp, 0), min(col0 + rp + 1, dem.shape[1])
    rows, cols = np.mgrid[r_lo:r_hi, c_lo:c_hi]
    px = t.c + (cols + 0.5) * t.a
    py = t.f + (rows + 0.5) * t.e
    plon, plat = dem.inv.transform(px, py)
    plon, plat = np.asarray(plon), np.asarray(plat)
    dist, brg = gc_dist_bearing(lat, lon, plat, plon)
    ok = (dist <= cfg["radius_km"] * 1000) & (dist >= cfg.get("min_dist_km", 0.0) * 1000)
    if "bearing_range_deg" in cfg:
        b0, b1 = cfg["bearing_range_deg"]
        ok &= ((brg - b0) % 360) <= ((b1 - b0) % 360)
    h = dem.height_m[r_lo:r_hi, c_lo:c_hi].astype(np.float64)
    h = np.where(ok & np.isfinite(h), h, np.nan)
    k = np.nanargmax(h) if cfg["mode"] == "max" else np.nanargmin(h)
    i, j = np.unravel_index(k, h.shape)
    shift_m = float(dist[i, j])
    # An extremum on the outer edge of the search region means the terrain keeps rising/falling
    # beyond it: no closed summit/crest/floor was found, so the snapped point is not trustworthy.
    hit_edge = shift_m >= cfg["radius_km"] * 1000 - 1.5 * dem.res
    return {
        "lat": round(float(plat[i, j]), 5), "lon": round(float(plon[i, j]) % 360.0, 5),
        "elev_m": float(h[i, j]), "shift_km": round(shift_m / 1000, 3),
        "bearing_deg": round(float(brg[i, j]), 1),
        "hit_search_edge": bool(hit_edge),
    }


MAX_LANDER_SLOPE_DEG = 10.0


def local_slope_deg(dem: PolarDEM, lat: float, lon: float) -> float:
    """Surface slope from central differences one pixel each way in map space (polar stereographic,
    scale factor ~1 within 300 km of the pole)."""
    x, y = dem.fwd.transform(lon, lat)
    d = dem.res
    xs = np.array([x + d, x - d, x, x])
    ys = np.array([y, y, y + d, y - d])
    lo, la = dem.inv.transform(xs, ys)
    h = dem.sample(np.asarray(lo), np.asarray(la))
    gx = (h[0] - h[1]) / (2 * d)
    gy = (h[2] - h[3]) / (2 * d)
    return float(math.degrees(math.atan(math.hypot(gx, gy))))


def build_site(site, dem, offline):
    sid = site["id"]
    cat_lat, cat_lon = float(site["lat"]), float(site["lon"]) % 360.0
    lat, lon = cat_lat, cat_lon
    polar = lat <= POLAR_LAT_LIMIT
    snap_info = None
    if polar and site.get("snap"):
        snap_info = {**site["snap"], **snap_to_dem(dem, lat, lon, site["snap"])}
        if snap_info["hit_search_edge"] and site["snap"].get("keep_catalog_on_edge"):
            snap_info["applied"] = False
            log(f"    snap hit search edge ({snap_info['shift_km']} km) -> keeping catalog coordinates")
        else:
            snap_info["applied"] = True
            lat, lon = snap_info["lat"], snap_info["lon"]
            log(f"    snapped ({site['snap']['mode']}) {snap_info['shift_km']} km @ {snap_info['bearing_deg']} deg "
                f"-> {lat:.4f}, {lon:.3f}E, {snap_info['elev_m'] / 1000:.3f} km")
    if polar:
        mask, mask_dist, ground_m = horizon_mask(dem, lat, lon)
        elev_km = ground_m / 1000.0
        horizon_src = f"LOLA {DEM_LBL.stem.upper()} raycast {TRACE_KM:.0f} km, curvature-corrected, mast {OBSERVER_MAST_M} m"
    else:
        mask = np.zeros(360)
        mask_dist = np.zeros(360)
        ground_m = None
        elev_km = float(site["elev_km"])
        horizon_src = "ideal spherical horizon (0 deg) - site outside polar DEM"
    eph = ephemeris(sid, lat, lon, elev_km, offline)
    a = analyse(lat, lon, elev_km, mask, eph)
    n, t_h = a["n"], a["t_h"]
    sun, earth = a["sun"], a["earth"]

    sun_el_rad = np.radians(sun["el"])
    pwr_h = np.where(sun["vis"], np.clip(np.sin(sun_el_rad), 0, 1), 0.0)   # horizontal panel
    pwr_v = np.where(sun["vis"], np.clip(np.cos(sun_el_rad), 0, 1), 0.0)   # vertical, sun-tracking panel

    sun_ps = period_stats(sun["vis"], n)
    earth_ps = period_stats(earth["vis"], n)
    stats = {
        "sunlight_pct": round(100 * float(sun["vis"].mean()), 2),
        "dte_pct": round(100 * float(earth["vis"].mean()), 2),
        "sun_and_dte_pct": round(100 * float((sun["vis"] & earth["vis"]).mean()), 2),
        "max_solar_elev_deg": round(float(sun["el"].max()), 2),
        "min_solar_elev_deg": round(float(sun["el"].min()), 2),
        "earth_elev_range_deg": [round(float(earth["el"].min()), 2), round(float(earth["el"].max()), 2)],
        "mean_power_eff_horizontal": round(float(pwr_h.mean()), 4),
        "mean_power_eff_vertical_tracking": round(float(pwr_v.mean()), 4),
        "max_continuous_shadow_h": sun_ps["max_continuous_hidden_h"],
        "max_continuous_sunlight_h": sun_ps["max_continuous_visible_h"],
        "mean_daylight_period_days": sun_ps["mean_complete_visible_period_days"],
        "mean_night_period_days": sun_ps["mean_complete_hidden_period_days"],
        "complete_daylight_periods": sun_ps["complete_visible_periods"],
        "max_continuous_dte_blackout_h": earth_ps["max_continuous_hidden_h"],
        "max_horizon_deg": round(float(mask.max()), 2),
        "mean_horizon_deg": round(float(mask.mean()), 2),
    }

    slope = local_slope_deg(dem, lat, lon) if polar else None
    warnings = []
    if slope is not None and slope > MAX_LANDER_SLOPE_DEG:
        warnings.append(f"Local slope {slope:.1f} deg exceeds typical lander tolerance ({MAX_LANDER_SLOPE_DEG:.0f} deg)")
    if snap_info and not snap_info.get("applied", True):
        msg = (f"Official coordinates used as given (no closed local summit within {snap_info['radius_km']} km)")
        if slope is not None and slope > MAX_LANDER_SLOPE_DEG:
            msg += "; site sits on a steep slope - coordinates pending verification"
        warnings.append(msg)
    if ground_m is not None and site.get("elev_km") is not None and abs(ground_m / 1000 - site["elev_km"]) > 0.5:
        warnings.append(f"Catalog elevation {site['elev_km']} km differs from LOLA DEM {ground_m / 1000:.2f} km "
                        "(DEM value used)")

    meta = {k: site[k] for k in ("id", "name", "agency", "region", "description")}
    meta.update({
        "coord_source": site.get("coord_source"),
        "slope_deg": round(slope, 1) if slope is not None else None,
        "warnings": warnings,
        "lat": lat, "lon": lon,
        "catalog_lat": cat_lat, "catalog_lon": cat_lon,
        "snap": snap_info,
        "elev_km_catalog": site.get("elev_km"),
        "elev_km_dem": round(ground_m / 1000.0, 4) if ground_m is not None else None,
        "elev_km_used": round(elev_km, 4),
        "horizon_source": horizon_src,
    })
    detail = {
        **meta,
        "horizon_mask_deg": r(mask, 2),
        "horizon_mask_dist_km": r(mask_dist, 2),
        "time": {"start_utc": datetime.fromtimestamp(a["ts"][0], timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                 "step_h": STEP_H, "n": n},
        "fields": {
            "sun.vis/earth.vis": "1 if apparent elevation > horizon mask at that azimuth (airless, no refraction)",
            "sun.pwr": "sin(solar elevation) when sun visible else 0 (horizontal panel efficiency)",
            "sun.pwr_v": "cos(solar elevation) when sun visible else 0 (vertical sun-tracking panel)",
            "sun.t_set": "hours until next terrain sunset (power loss); null if dark or no sunset before dataset end",
            "sun.t_rise": "hours until next sunrise; null if lit or no sunrise before dataset end",
            "earth.t_set": "hours until next Earthset (DTE loss); null if Earth hidden or no Earthset before dataset end",
            "earth.t_rise": "hours until next Earthrise",
        },
        "sun": {
            "az": r(sun["az"], 2), "el": r(sun["el"], 2),
            "vis": sun["vis"].astype(int).tolist(),
            "pwr": r(pwr_h, 3), "pwr_v": r(pwr_v, 3),
            "t_set": time_to_next(t_h, sun["sets"], sun["vis"]),
            "t_rise": time_to_next(t_h, sun["rises"], ~sun["vis"]),
        },
        "earth": {
            "az": r(earth["az"], 2), "el": r(earth["el"], 2),
            "vis": earth["vis"].astype(int).tolist(),
            "t_set": time_to_next(t_h, earth["sets"], earth["vis"]),
            "t_rise": time_to_next(t_h, earth["rises"], ~earth["vis"]),
        },
        "stats": stats,
    }
    index_entry = {**meta, "stats": stats, "horizon_mask_deg": r(mask, 2), "file": f"{sid}.json"}
    return detail, index_entry


# --------------------------------------------------------------------------
# Physical sanity checks
# --------------------------------------------------------------------------
def find_shackleton_floor(dem: PolarDEM, search_km: float = 25.0):
    """Locate the lowest DEM pixel within search_km of the pole (Shackleton floor)."""
    ny, nx = dem.shape
    cy, cx = ny // 2, nx // 2
    rpx = int(search_km * 1000 / dem.res)
    sub = dem.height_m[cy - rpx:cy + rpx, cx - rpx:cx + rpx]
    i, j = np.unravel_index(np.nanargmin(sub), sub.shape)
    row, col = i + cy - rpx, j + cx - rpx
    t = dem.transform
    x = t.c + (col + 0.5) * t.a
    y = t.f + (row + 0.5) * t.e
    lon, lat = dem.inv.transform(x, y)
    return float(lat), float(lon) % 360.0, float(dem.height_m[row, col])


def run_checks(index: list[dict], dem: PolarDEM, offline: bool) -> dict:
    by = {s["id"]: s for s in index}
    checks = []

    def add(name, passed, detail):
        checks.append({"check": name, "pass": bool(passed), "detail": detail})

    a11 = by.get("apollo-11")
    if a11:
        st = a11["stats"]
        add("Apollo 11: mean daylight period ~14.7 Earth days",
            st["mean_daylight_period_days"] is not None and 13.8 <= st["mean_daylight_period_days"] <= 15.6,
            f'mean={st["mean_daylight_period_days"]} d over {st["complete_daylight_periods"]} complete lunar days, '
            f'night={st["mean_night_period_days"]} d, sunlight={st["sunlight_pct"]}%')
        add("Apollo 11: max solar elevation > 60 deg", st["max_solar_elev_deg"] > 60,
            f'max={st["max_solar_elev_deg"]} deg')
        add("Apollo 11: Earth always visible (near side)", st["dte_pct"] > 99.9,
            f'DTE={st["dte_pct"]}%, Earth elev {st["earth_elev_range_deg"]}')
    ce6 = by.get("change-6")
    if ce6:
        st = ce6["stats"]
        add("Chang'e-6 (far side): 0% DTE", st["dte_pct"] == 0.0,
            f'DTE={st["dte_pct"]}%, Earth elev range {st["earth_elev_range_deg"]} deg')
    floor = by.get("shackleton-floor")
    rim = by.get("shackleton-rim")
    mal = by.get("malapert-massif")
    if floor:
        st = floor["stats"]
        add("Shackleton floor: near-0% sunlight", st["sunlight_pct"] < 1,
            f'sunlight={st["sunlight_pct"]}%, at {floor["lat"]:.4f},{floor["lon"]:.3f}E, '
            f'DEM elev={floor["elev_km_dem"]} km, mean horizon={st["mean_horizon_deg"]} deg')
    for s in (rim, mal):
        if s:
            st = s["stats"]
            add(f'{s["name"]}: high sunlight', st["sunlight_pct"] > 50,
                f'sunlight={st["sunlight_pct"]}%, DTE={st["dte_pct"]}%, '
                f'max shadow={st["max_continuous_shadow_h"]} h, DEM elev={s["elev_km_dem"]} km')
    if floor and rim:
        add("Shackleton floor sunlight << rim sunlight",
            floor["stats"]["sunlight_pct"] < rim["stats"]["sunlight_pct"] - 30,
            f'floor={floor["stats"]["sunlight_pct"]}% vs rim={rim["stats"]["sunlight_pct"]}%')

    # Cross-check: the snapped floor must be the deepest point of Shackleton (DEM minimum near the pole).
    if floor:
        lat, lon, h = find_shackleton_floor(dem)
        d, _ = gc_dist_bearing(lat, lon, np.array([floor["lat"]]), np.array([floor["lon"]]))
        add("Shackleton floor site coincides with DEM-deepest point near pole", float(d[0]) < 1000,
            f'deepest point {lat:.4f},{lon:.3f}E ({h / 1000:.3f} km); site is {float(d[0]) / 1000:.2f} km away')

    # Informational notes (not pass/fail): unreliable snaps, catalog vs DEM elevations after snapping.
    notes = []
    for s in index:
        if s.get("snap") and s["snap"].get("hit_search_edge") and s["snap"].get("applied", True):
            notes.append(f'WARNING {s["id"]}: snap extremum lies on the search-region edge '
                         f'({s["snap"]["shift_km"]} km) - no closed feature found; verify coordinates')
    for s in index:
        if s["elev_km_dem"] is not None and s["elev_km_catalog"] is not None:
            diff = s["elev_km_dem"] - s["elev_km_catalog"]
            if abs(diff) > 0.5:
                notes.append(f'{s["id"]}: catalog elev {s["elev_km_catalog"]} km vs LOLA DEM '
                             f'{s["elev_km_dem"]:.3f} km (diff {diff:+.2f} km) - DEM value used')
    return {"generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "checks": checks, "notes": notes}


def print_report(report: dict, index: list[dict]) -> None:
    log("\n" + "=" * 78)
    log("SITE SUMMARY")
    log("=" * 78)
    log(f'{"id":18s} {"sun%":>6s} {"DTE%":>6s} {"both%":>6s} {"maxSun":>7s} {"maxShadow_h":>11s} '
        f'{"meanDay_d":>9s} {"hzn_max":>7s} {"elev_km":>7s}')
    for s in index:
        st = s["stats"]
        log(f'{s["id"]:18s} {st["sunlight_pct"]:6.2f} {st["dte_pct"]:6.2f} {st["sun_and_dte_pct"]:6.2f} '
            f'{st["max_solar_elev_deg"]:7.2f} {st["max_continuous_shadow_h"]:11.0f} '
            f'{str(st["mean_daylight_period_days"]):>9s} {st["max_horizon_deg"]:7.2f} {s["elev_km_used"]:7.3f}')
    log("\nDEM SNAPPING (catalog -> DEM feature)")
    for s in index:
        sn = s.get("snap")
        if sn and not sn.get("applied", True):
            log(f'  {s["id"]:18s} not applied (extremum on {sn["radius_km"]} km edge) - official coords '
                f'({s["lat"]}, {s["lon"]}) kept')
        elif sn:
            log(f'  {s["id"]:18s} {sn["mode"]:3s} {sn["shift_km"]:6.2f} km @ {sn["bearing_deg"]:5.1f} deg: '
                f'({s["catalog_lat"]}, {s["catalog_lon"]}) -> ({s["lat"]:.4f}, {s["lon"]:.3f})  [{sn["note"]}]')
    log("\n" + "=" * 78)
    log("PHYSICAL SANITY CHECKS")
    log("=" * 78)
    for c in report["checks"]:
        log(f'[{"PASS" if c["pass"] else "FAIL"}] {c["check"]}\n       {c["detail"]}')
    n_fail = sum(not c["pass"] for c in report["checks"])
    log(f"\n{len(report['checks']) - n_fail}/{len(report['checks'])} checks passed")
    if report.get("notes"):
        log("\nNOTES")
        for n in report["notes"]:
            log(f"  - {n}")


# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="use cached Horizons responses only")
    ap.add_argument("--skip-checks", action="store_true")
    args = ap.parse_args()

    sites = json.loads(SITES_FILE.read_text(encoding="utf-8"))
    log(f"Loaded {len(sites)} sites")
    log(f"Reading DEM {DEM_LBL.name} ...")
    dem = PolarDEM(DEM_LBL)
    log(f"  {dem.describe()}")

    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for site in sites:
        t0 = time.time()
        log(f"- {site['id']}")
        detail, entry = build_site(site, dem, args.offline)
        (OUT / f"{site['id']}.json").write_text(json.dumps(detail, separators=(",", ":")), encoding="utf-8")
        index.append(entry)
        size_kb = (OUT / f"{site['id']}.json").stat().st_size / 1024
        log(f"    done in {time.time() - t0:.1f}s, {size_kb:.0f} KB, sunlight {entry['stats']['sunlight_pct']}%, "
            f"DTE {entry['stats']['dte_pct']}%")

    index_doc = {
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "time_range_utc": [START_TIME, STOP_TIME], "step_h": STEP_H,
        "ephemeris_source": "NASA JPL Horizons API (apparent az/el, airless, MEAN_ME frame)",
        "dem": dem.describe(), "trace_km": TRACE_KM, "observer_mast_m": OBSERVER_MAST_M,
        "sites": index,
    }
    (OUT / "sites_index.json").write_text(json.dumps(index_doc, separators=(",", ":")), encoding="utf-8")
    log(f"Wrote {OUT / 'sites_index.json'}")

    if not args.skip_checks:
        report = run_checks(index, dem, args.offline)
        (OUT / "validation_report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
        print_report(report, index)
    return 0


if __name__ == "__main__":
    sys.exit(main())

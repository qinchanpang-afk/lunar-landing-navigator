# Project: Lunar Landing Site Navigator (NASA Space Apps 2026)

## Goal
Build an intuitive, fast web application that lets mission planners, educators, and the public compare lunar landing sites and dates—especially at the Moon's south pole—by visualizing Sun and Earth positions relative to the local topographic horizon to assess power generation potential and direct-to-Earth (DTE) communication windows.

## Hard Technical Rules (STRICT ENFORCEMENT)
1. **ZERO MOCK DATA**: Never fabricate solar/earth angles or horizon profiles. Ephemeris data MUST be fetched from NASA JPL Horizons API (`docs/horizons_api_spec.md`). Horizon occlusion masks MUST be computed from the real LOLA DEM file in `raw_data/`.
2. **PRE-COMPUTED STATIC ARCHITECTURE**:
   - Build a Python pipeline (`scripts/build_data.py`) that pre-computes hourly Sun & Earth azimuth/elevation for **2026-01-01 to 2027-12-31** (UTC) and 360-degree horizon elevation masks (0° to 359°, 1° step) for all sites in `raw_data/sites.json`.
   - Export compact JSON files into `frontend/public/data/` (`sites_index.json` and `<site_id>.json`) so the web UI runs at 60fps with zero API latency.
3. **LUNAR PHYSICS & DEM RULES**:
   - **DEM Scale Factor**: In LOLA `ldem_80s_100m.img`, raw `int16` pixel values represent units of **0.5 meters** (`elevation_m = raw_value * 0.5`). Always verify and apply the scaling factor from `.lbl` or raster metadata.
   - **Raycasting Radius**: For sites south of 80°S, trace terrain elevation outward along each azimuth (0°–359°) up to **100 km** (1,000 steps at 100m/px), accounting for lunar sphere curvature (`R_moon = 1737.4 km`), to find the maximum horizon elevation angle.
   - **Non-South-Pole Fallback**: For sites north of 80°S (e.g., Apollo 11, Chang'e-6), skip the polar DEM file and use an ideal spherical horizon mask (`0.0°` for all 360°).
   - **No Atmosphere**: The Moon is a vacuum. Do NOT apply atmospheric refraction corrections. Occlusion is strictly `celestial_elevation_deg > horizon_mask_deg`.
4. **MANDATORY VERIFICATION**: After running `scripts/build_data.py`, automatically verify physical sanity:
   - Apollo 11 (equator) must show ~14.7 Earth-day sunlight cycles and max solar elevation above 60°.
   - Chang'e-6 (lunar far side, lon ~206°E) must show **0% Direct-to-Earth (DTE)** visibility.
   - Shackleton Crater Floor must show near-0% sunlight, while Shackleton Rim / Malapert Massif must show high sunlight percentages.

## Tech Stack
- **Data Pipeline**: Python 3.10+, `requests`, `numpy`, `rasterio`, `pyproj`
- **Frontend**: Vite + React + TypeScript + Tailwind CSS + Lucide Icons
- **Visualization**: Custom interactive HTML5 Canvas / SVG for the 360° Horizon Panorama & Sky Dome, plus Recharts for power/visibility timelines.
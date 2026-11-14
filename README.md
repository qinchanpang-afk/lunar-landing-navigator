# Lunar Landing Site Navigator

**Compare lunar landing sites and dates by power and comms. Every result comes from the real Sun and Earth positions measured against the real lunar skyline.**

*NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator*

Missions to the lunar south pole face extreme lighting and communication constraints. The Sun circles the horizon instead of rising overhead. A ridge a few hundred metres high can cast a shadow for days. Earth wobbles up and down around the skyline. Existing tools (QuickMap, Moon Trek, JPL Horizons) are powerful but slow to use for a quick question like *"what happens to power and Direct-to-Earth (DTE) comms if we land 13 km away, or launch two weeks late?"*

This app answers that interactively, from precomputed data with no API latency. Every number comes from **NASA JPL Horizons** ephemerides and horizons **ray-traced on NASA LRO LOLA terrain**. Nothing is mocked or approximated with a toy model.

---

## Features

| | |
|---|---|
| **360° horizon panorama** | The real skyline from LOLA altimetry, with the Sun and Earth plotted at their apparent positions. ±15-day tracks show the Sun circling the horizon and Earth's libration loop. Hover for the terrain elevation and its distance at any azimuth. |
| **Sky dome** | Top-down sky map (zenith at centre) with the terrain mask as a ring, plus the Sun and Earth paths. |
| **Countdowns** | Exact time remaining before **sunset (power loss)** and **Earthset (communication loss)**, or until the next sunrise or Earthrise. Crossing times are interpolated below the 2-hour data step. |
| **Power & comms assessment** | Solar elevation, clearance above terrain, power efficiency (flat panel `sin(el)` and vertical sun-tracking panel `cos(el)`), sunlight %, DTE %, longest continuous shadow (the battery-survival driver), longest DTE blackout. |
| **Timeline scrubber** | 2026-01-01 → 2027-12-31 UTC. Date and time picker, playback from 1 h/s to 5 d/s, jumps of ±1 day or ±1 lunar day, one-click *jump to next sunset / Earthset*, and power and visibility charts you can click to seek. |
| **Side-by-side comparison** | Up to 4 slots. Each slot follows the main clock, can be shifted by a fixed offset (e.g. a launch slip), or can use its own date. |
| **Quick demo scenarios** | One click to *Terrain Impact: Shackleton Rim (88% Sun) vs. Crater Floor (0% Sun)* and *Launch Delay Impact: Nobile Rim vs. +14 Days Shift*. |
| **Custom coordinates** | Enter any latitude and longitude. The browser fetches Horizons ephemerides live and ray-traces LOLA terrain locally in about 5 s. Custom sites persist in `localStorage`. |
| **South-pole map** | LOLA shaded-relief map (±160 km and ±48 km views) with every polar site coloured by sunlight. Click a marker to open a site, or click anywhere to analyse that exact spot. |
| **Best nearby spot** | Re-traces the terrain horizon on an 11 × 11 grid (±0.5, ±1 or ±2 km) around any polar site in parallel Web Workers (~8 s). Shows a sunlight / Sun+DTE heat map and the best **lander-safe** cell (slope ≤ 10°), which can be opened as a full site in one click. |
| **Mission planner** | *Landing-window finder*: every 2026–2027 touchdown time that guarantees N days of continuous Sun (+ Earth link), with the delay until the next window if a launch slips. *Battery sizing*: energy and mass to survive the longest shadow during the mission, and the worst night of the two years. |
| **Shareable deep links** | The address bar always encodes the site, time, view, audience and comparison slots (e.g. `?site=nobile-rim&t=2026-11-30T06:00Z&view=compare&cmp=nobile-rim,nobile-rim~o336`). A link to a custom site recomputes it for the recipient. |
| **Validation & trust panel** | All pipeline self-checks, a comparison with published LOLA illumination studies, and browser-vs-pipeline accuracy, inside the app. |
| **Two audiences** | *Planner* mode gives exact angles, statistics and a CSV export of the full 2-hourly series. *Explorer* mode adds plain-language explanations: why the pole is extreme, why there is no refraction, why Earth wobbles. |

---

## Key results (2026–2027, 2-hour sampling)

| Site | Sunlight | DTE | Sun + DTE | Longest shadow | Notes |
|---|---:|---:|---:|---:|---|
| Shackleton Crater Rim (connecting ridge) | **88.0 %** | 47.0 % | 42.3 % | 74 h | "Peak of near-eternal light" |
| Shackleton Crater Floor (PSR) | **0.0 %** | 0.0 % | 0.0 % | whole period | Permanently shadowed cold trap |
| Malapert Massif summit | 82.6 % | **96.4 %** | 79.7 % | 276 h | Near-continuous Earth view |
| Nobile Western Rim (VIPER target, Mons Mouton) | 52.9 % | 66.0 % | 31.6 % | 522 h | |
| Haworth Rim (Artemis III candidate) † | 0.3 % | 0.0 % | 0.0 % | 8472 h | 19° pole-facing slope (see *Data quality*) |
| Peak near Shackleton (CSA rover target) † | 41.2 % | 51.4 % | 19.6 % | 348 h | 11° slope (see *Data quality*) |
| Chang'e-6, Apollo Basin (far side) | 50.3 % | **0.0 %** | 0.0 % | 360 h | Earth always 33–52° below horizon |
| Apollo 11, Mare Tranquillitatis | 49.7 % | 100 % | 49.7 % | 356 h | 14.78-day daylight periods, Sun up to 89.9° |

† Official coordinates used as given; flagged in the app as *pending verification*.

**A few hundred metres matter as much as the region.** The *Best nearby spot* scan around the Nobile rim coordinates finds a lander-safe cell (5° slope) **2.15 km SW** with **77.5 %** sunlight instead of 52.9 %, and a longest shadow of 11 days instead of 22. A full run at that point with its own live Horizons ephemeris confirms 77.5 %.

---

## Physics model

### Ephemeris: NASA JPL Horizons
For every site, the pipeline requests **apparent azimuth and elevation** (`QUANTITIES=4`) of the Sun (`10`) and Earth (`399`) for a topocentric observer on the Moon:

```
CENTER='coord@301'  COORD_TYPE='GEODETIC'  SITE_COORD='<E-lon>,<lat>,<elev_km>'
START_TIME='2026-01-01 00:00'  STOP_TIME='2027-12-31 23:59'  STEP_SIZE='2h'
```

Horizons resolves the site in the Moon's **MEAN_ME (Mean Earth / polar axis)** frame, the same frame as the LOLA products. It applies light-time and aberration and reports `Atmos refraction: NO (AIRLESS)`. Raw responses are cached in `raw_data/cache/`, so rebuilding needs no network.

### No atmosphere, no refraction
The Moon is effectively a vacuum. There is no refraction lift near the horizon, no twilight, and the sky is black at noon. Visibility is therefore strictly geometric:

```
visible  ⇔  apparent_elevation(t)  >  horizon_mask(azimuth(t))
```

The mask is linearly interpolated between its 1° samples. The test applies to the body's centre, with no refraction allowance and no fudge factor.

### Power and event timing
* Flat (horizontal) panel efficiency = `sin(el)` when the Sun is visible, else 0, as specified in the challenge brief.
* Vertical sun-tracking panel efficiency = `cos(el)` when visible, else 0. This is how polar landers are actually designed, because the Sun skims the horizon.
* Sunset, sunrise, Earthset and Earthrise times are found where the clearance `el − mask(az)` changes sign. They are linearly interpolated between the 2-hour samples, so countdowns are accurate below the step size.

---

## Terrain horizon algorithm

### Build pipeline: LOLA 80 m ray-tracing
Source: **LRO LOLA `LDEM_80S_80M`**, a 7600 × 7600 int16 polar stereographic grid. Its label gives `SCALING_FACTOR = 0.5` (height in m = DN × 0.5) relative to a 1737.4 km sphere, and `MAP_SCALE = 80 m/px`. The projection (`+proj=stere +lat_0=-90 +lat_ts=-90 +R=1737400`) and scale are read with **rasterio/GDAL** and checked at runtime. We verified the orientation by locating Shackleton's floor at the known crater centre.

For each site south of 80°S:
1. **Observer** = bilinear DEM height + a 2 m instrument / solar-array mast.
2. For each azimuth 0°–359° (1° steps), march along the **great circle** in 80 m steps out to **100 km** (1250 samples). Each sample point is projected and the DEM height read bilinearly.
3. **Exact spherical curvature:** for observer radius `r₀ = R + h₀ + mast` and terrain radius `r = R + h` at central angle `δ = d / R`:

   ```
   elevation = atan2( r·cos δ − r₀ ,  r·sin δ )      R = 1737.4 km
   ```

4. The horizon mask is the maximum elevation along each ray. The distance of the blocking terrain is also stored and shown on hover.

Sites north of 80°S (Apollo 11, Chang'e-6) are outside the polar DEM. They use an ideal spherical horizon (0° everywhere), as the project rules require.

### In-browser hybrid 80 m / 160 m ray-tracer (custom coordinates)
Shipping the 115 MB DEM to the browser is impractical. Instead, `scripts/build_dem_tiles.py` exports a compressed **two-level tile pyramid**: gzip of row-delta-encoded int16 tiles.

| Level | Resolution | Tiles | Used for |
|---|---|---|---|
| `l80` | 80 m (full LOLA) | 60 × 60 × 128 px, 54 MB | observer height, local slope, near field 0–5 km |
| `l160` | 160 m (2 × 2 block mean) | 15 × 15 × 256 px, 16 MB | far field 5–100 km |

A custom site downloads only the roughly 40 tiles it needs (about 2–3 MB) and ray-traces 360 × 656 samples in milliseconds.

**Why hybrid?** A pure 160 m grid flattens summits and nearby slopes. At Malapert it dropped annual sunlight from 82.6 % to 77.5 %. Keeping the first 5 km at full resolution removes that error:

| Site | Mask RMS vs 80 m | Sunlight 80 m → hybrid | DTE 80 m → hybrid |
|---|---:|---:|---:|
| Shackleton rim | 0.01° | 88.0 → 88.1 % | 47.0 → 47.0 % |
| Malapert summit | 0.01° | 82.6 → 82.6 % | 96.4 → 96.4 % |
| Nobile rim | 0.01° | 52.9 → 53.0 % | 66.0 → 66.0 % |
| Shackleton floor | 0.02° | 0.0 → 0.0 % | 0.0 → 0.0 % |

The TypeScript implementation reproduces the Python reference to within 0.01° (rounding). Statistics for a non-polar custom site match the build pipeline exactly. Validation numbers are embedded in `frontend/public/data/dem/meta.json`.

---

## Earth libration visualisation

From the Moon, Earth barely moves: the Moon's rotation is locked to its orbit. Its slightly eccentric, inclined orbit still makes Earth trace a **libration loop** of roughly ±8° in longitude and ±7° in latitude. At the south pole Earth sits right on the skyline, so this wobble alone decides whether a lander can talk to home.

* The **panorama** and **sky dome** draw Earth's ±15-day track as a closed loop, so planners see how close it comes to the terrain.
* Per site, the app reports Earth's **elevation range** (Shackleton rim: −7.4° to +6.3°), **DTE %**, the **longest DTE blackout**, and live Earthset / Earthrise countdowns.
* On the far side (Chang'e-6), Earth stays 33–52° below the horizon all the time. That is why relay satellites such as Queqiao-2 are mandatory.

---

## Validation

`scripts/build_data.py` runs physical sanity checks after every build (**9/9 pass**):

* Apollo 11: mean daylight period **14.78 d** over 24 complete lunar days; maximum solar elevation **89.9°**; Earth always visible.
* Chang'e-6: **0 % DTE**, Earth elevation −51.7° to −32.9°.
* Shackleton floor: **0 % sunlight**, and the site coincides with the DEM's deepest point near the pole.
* Shackleton rim (88.0 %) and Malapert (82.6 %): high sunlight. Rim sunlight far exceeds floor sunlight.

**Against the literature.** Gläser et al. (2014, *Icarus* 243, 78–90) found the best-lit point on the Shackleton–de Gerlache connecting ridge to be lit **92.3 %** of the time at 2 m height (20 m/px DTM, 19 years), with the longest darkness at such points typically **3–5 days**. Our Shackleton rim site on the same ridge gives **88.0 %** and **74 h (3.1 d)** on an 80 m DEM over 2 years. A few points lower is expected from the coarser DEM, the shorter window, and our site not being the single optimum point. Mazarico et al. (2011, *Icarus* 211, 1066–1081) describe the same pattern of a few near-continuously lit points beside permanently shadowed floors.

**Nearby-scan geometry.** The scan rotates the site's Sun/Earth direction vectors into each grid point's local East-North-Up frame (both bodies are effectively at infinity; Earth parallax over 2 km is < 0.001°). The Nobile cross-check above (77.5 % vs 77.5 %) validates this against an independent Horizons query.

The full report is written to `frontend/public/data/validation_report.json`.

### Data quality and coordinate snapping
Several catalog coordinates did not land on the feature they name. For example, the original "crater floor" point sat on Shackleton's outer slope. The pipeline therefore supports transparent, rule-based **DEM snapping**, declared per site in `raw_data/sites.json`:

* rim or summit → local maximum within 2 km
* crater floor → minimum within 15 km

The original coordinates are kept and both are exported. A snap that stops at the edge of its search radius (no closed feature found) is rejected, and the official coordinates are used as given. Each site also gets a LOLA **local slope** check. Sites steeper than 10° (Haworth 19.0°, CSA target 11.0°) are flagged in the UI as *coordinates pending verification*.

---

## Getting started

### 1. Data pipeline (Python ≥ 3.10)

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt

# Place LDEM_80S_80M.IMG + .LBL from the PDS Geosciences Node in raw_data/
python scripts/build_data.py              # Horizons fetch (cached) + horizons + JSON + checks
python scripts/build_data.py --offline    # rebuild from cache only
python scripts/build_dem_tiles.py         # browser DEM tile pyramid + hybrid validation
python scripts/build_basemap.py           # shaded-relief images for the south-pole map
```

The generated `frontend/public/data/` is committed, so the web app runs without the raw DEM.

### 2. Web app (Node ≥ 18)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in frontend/dist
```

### 3. Deployment note: Horizons proxy
JPL Horizons does not send CORS headers, so custom-coordinate requests go to the same-origin path `/api/horizons`, which must forward to `https://ssd.jpl.nasa.gov/api/horizons.api`. The proxy is preconfigured for the Vite dev and preview servers, Netlify (`frontend/public/_redirects`) and Vercel (`frontend/vercel.json`). Pure static hosts without rewrites (e.g. GitHub Pages) can serve every catalog feature, but not custom coordinates. Alternatively, set `VITE_HORIZONS_URL` to your own proxy.

---

## Project structure

```
├── scripts/
│   ├── build_data.py          # Horizons + LOLA ray-trace + per-step analysis + sanity checks
│   ├── build_dem_tiles.py     # browser DEM pyramid (80 m / 160 m) + hybrid validation
│   └── build_basemap.py       # LOLA shaded-relief images for the map view
├── raw_data/
│   ├── sites.json             # site catalog (+ snapping rules, coordinate sources)
│   ├── ldem_80s_80m.lbl       # PDS3 label  (the .img itself is git-ignored)
│   └── cache/                 # raw Horizons responses (git-ignored)
├── frontend/
│   ├── public/data/           # sites_index.json, <site>.json, validation_report.json, dem/, basemap/
│   └── src/
│       ├── components/        # Panorama, SkyDome, Timeline, CompareView, PoleMap, NearbyScan, MissionPlanner, ValidationPanel, …
│       └── lib/               # time engine, Horizons client, DEM ray-tracer (+ worker), nearby scan, planner, URL state, storage
└── docs/                      # challenge brief, Horizons API notes
```

Each `<site>.json` holds the 360-value horizon mask and, for every 2-hour step, Sun and Earth azimuth and elevation, visibility, power efficiency (`sin`/`cos`), and hours to the next set or rise. `sites_index.json` holds metadata and summary statistics.

---

## Limitations

* The Sun and Earth are treated as points (disc centres). Partial solar-disc occlusion near the horizon is not modelled.
* Time resolution is 2 hours. Event times are interpolated between samples.
* The horizon is traced to 100 km. Terrain beyond that, and beyond the 80°S DEM edge, is ignored. The app warns when rays leave the DEM.
* Sites north of 80°S use an ideal 0° horizon. Local craters and mountains there are not modelled.
* Power figures are geometric efficiencies only. Panel degradation, dust and temperature are not included.

---

## Acknowledgments

* **NASA Lunar Reconnaissance Orbiter, Lunar Orbiter Laser Altimeter (LOLA)**: the `LDEM_80S_80M` polar digital elevation model (LRO-L-LOLA-4-GDR-V1.0), produced by the LOLA Science Team at NASA Goddard Space Flight Center and distributed through the NASA Planetary Data System (PDS) Geosciences Node.
* **NASA Jet Propulsion Laboratory, Solar System Dynamics Group: Horizons System**: Sun and Earth topocentric ephemerides (DE441) for every lunar site, via the Horizons REST API.
* **Canadian Space Agency (CSA)**: Space Apps 2026 partner agency. Its lunar exploration and lunar rover program resources informed the CSA rover-target scenario used in this app.
* **NASA Space Apps Challenge** organisers, for the *Lunar Landing Site Navigator* challenge and its curated resources.

Built with Python (NumPy, rasterio/GDAL, pyproj, requests) and Vite + React + TypeScript + Tailwind CSS + Recharts + Lucide.

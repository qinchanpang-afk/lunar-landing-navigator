# Space Apps 2026 — submission text (copy into the project page)

> Fields marked ✏️ need your input. Everything else is ready to paste. Keep the project page in English.

---

## Project name
AetherRidge — Sun & Earth Line-of-Sight Navigator for Lunar South Pole Landings

## Team
Akasha Solo

## Challenge
Lunar Landing Site Navigator

## Link to final project
https://lunar-landing-navigator-vfdm.vercel.app
(Source code: https://github.com/qinchanpang-afk/lunar-landing-navigator)

## Link to project demo ✏️
<public YouTube / Google Drive link to the 30-second video — see script below>

---

## High-level project summary

AetherRidge is a web app that shows, for any landing site and any moment in 2026–2027, whether a lander will have sunlight for power and a direct line of sight to Earth for communications — and for how long. It uses NASA JPL Horizons Sun and Earth positions and a 360° horizon ray-traced on NASA LRO LOLA terrain, so every number is physically real. Planners can compare sites side by side, simulate a launch slip, scan the surrounding kilometres for a better-lit and lander-safe spot, find landing windows and size the battery for the longest night, while students and the public get plain-language explanations. It matters because at the lunar south pole a few hundred metres or a two-week delay can be the difference between near-continuous power and a 20-day night: the app turns that into a decision in seconds.

---

## Project details

### What it does
* **3D terrain with live shadows** — real LOLA terrain around the site rendered in 3D and lit by the Sun at the chosen time, with the 100 km skyline ring that decides power at the site.
* **First-screen answer** — "Is there power? Is there a link to Earth? For how long?" answered at a glance, with one-click demo scenarios.
* **360° horizon panorama and sky dome** — the real skyline from LOLA altimetry with the Sun and Earth at their apparent positions and ±15-day tracks (Earth's libration loop is visible).
* **Countdowns** — time to the next sunset (power loss) and Earthset (communications loss), interpolated below the 2-hour data step.
* **Power & comms statistics** — sunlight %, Direct-to-Earth (DTE) %, longest shadow, longest DTE blackout, flat-panel and vertical sun-tracking panel efficiency.
* **Side-by-side comparison and launch-slip simulation** — up to four slots, each on the main clock, shifted by a delay (e.g. +14 days) or on its own date; one-click demo scenarios.
* **South-pole map** — LOLA shaded relief with every site coloured by sunlight and NASA's long-term Sun / Earth visibility overlays (cold traps in blue); click anywhere to analyse that exact spot.
* **Best nearby spot** — re-traces the horizon on an 11 × 11 grid around a site (in parallel in the browser, ~8 s) and finds the best lander-safe cell (slope ≤ 10°).
* **Mission planner** — landing windows that guarantee N days of continuous Sun (+ Earth link), the waiting time if a window is missed, and battery energy/mass for the longest shadow.
* **Custom coordinates** — any latitude/longitude on the Moon; ephemerides fetched live from Horizons and terrain traced in the browser.
* **Shareable deep links, CSV export, Planner and Explorer modes, in-app validation panel.**

### How it works
1. A Python pipeline reads the LOLA `LDEM_80S_80M` DEM (80 m/px, scale and projection checked from the PDS label) and, for each site south of 80°S, marches along great circles in 1° azimuth steps out to 100 km with exact spherical curvature to build the terrain horizon mask. Sites north of 80°S use an ideal 0° horizon.
2. It queries JPL Horizons for topocentric apparent azimuth/elevation of the Sun and Earth every 2 hours for 2026–2027 (Moon MEAN_ME frame, airless — no refraction).
3. A body is visible when its elevation exceeds the horizon at its azimuth. The pipeline precomputes visibility, power efficiency and hours to the next set/rise for every step and exports compact JSON, so the web app runs instantly with no API latency.
4. For custom sites and the nearby scan, a compressed 80 m/160 m tile pyramid of the same DEM is ray-traced in the browser (within 0.1 percentage point of the full pipeline). The nearby scan rotates the site's Sun/Earth directions into each grid point's local frame; an independent Horizons query at the best Nobile cell confirmed the result (77.5 % vs 77.5 %).
5. Automated checks run on every build (9/9 pass): Apollo 11 has 14.78-day days and the Sun reaches 89.9°; Chang'e-6 on the far side has 0 % DTE; Shackleton's floor is 0 % lit while its rim is 88 %. Results agree with published LOLA illumination studies (Gläser et al. 2014: best ridge point 92.3 %, darkness 3–5 days; ours 88.0 %, 3.1 days) and with NASA's own 18.6-year LOLA illumination maps (Shackleton rim 88.0 % vs 87.1 % best within 150 m; permanent shadow 0 % vs 0 %).

### Key findings
* Shackleton rim vs. its floor, about 13 km apart: **88 % vs 0 %** sunlight.
* Malapert summit keeps Earth in view **96 %** of the time, which makes it a natural relay site.
* Around the Nobile rim coordinates, a lander-safe spot **2.15 km away** gets **77.5 %** sunlight instead of 52.9 %, and halves the longest night (11 vs 22 days).
* A 14-day launch slip moves the Sun to the opposite side of the sky, where different terrain decides power and communications.

### Benefits
Mission planners can screen sites, dates and contingencies in seconds instead of hours with separate tools. Educators and the public see *why* the lunar south pole is so extreme. All of it runs in a browser, free, with open code and open NASA data.

### What we hope to achieve
A quick-look tool that complements QuickMap and Moon Trek: answering "what if we land here instead, or two weeks later?" before a detailed engineering study. Next steps: full 18.6-year illumination statistics, Sun-disc partial occlusion, and a link budget for relay satellites.

### Tools, languages and software
Python (NumPy, rasterio/GDAL, pyproj, requests, Pillow); TypeScript, React, Vite, Tailwind CSS, Recharts, three.js, Lucide icons; Web Workers; Vercel hosting with a same-origin proxy for the Horizons API; Git/GitHub.

---

## Use of Super Intelligence (SI)

The problem framing, physics rules (no refraction, 100 km curvature-corrected horizon, ideal horizon north of 80°S), pre-computed architecture, tech stack, site list and validation criteria were specified by our team in a written project spec before coding. We used **Claude (Anthropic)** as an AI coding assistant in Claude Code to write most of the source code (the Python data pipeline and the TypeScript web app) and to draft the documentation, following that spec. It also suggested several feature extensions (map, best-nearby-spot scan, mission planner, shareable links, validation panel) that we reviewed and chose to include. No data are AI-generated: every Sun/Earth position comes from NASA JPL Horizons and all terrain from NASA LRO LOLA. The map images are rendered by our own script from the LOLA DEM; no AI-generated images, video or audio are used, and no NASA branding appears in the app. We verified the outputs with automated physics checks, comparison with published studies and manual review. AI-assisted commits are marked `Co-Authored-By: Claude` in the git history, and the disclosure is repeated in the README and in the app footer and page metadata.

---

## NASA data
* **LRO Lunar Orbiter Laser Altimeter (LOLA) — `LDEM_80S_80M` south-polar DEM** (`LRO-L-LOLA-4-GDR-V1.0`), NASA PDS Geosciences Node: https://pds-geosciences.wustl.edu/missions/lro/lola.htm — horizon ray-tracing, ground height, slope, map.
* **LOLA average Sun and Earth visibility maps** (`AVGVISIB_85S_060M_201608` and `_EARTH`, 60 m/px, 18.6-year average; Mazarico et al. 2011), NASA GSFC PGDA: https://pgda.gsfc.nasa.gov/products/69 — independent validation of every polar site and switchable map overlays (permanently shadowed regions, long-term sunlight, Earth visibility).
* **NASA JPL Horizons System** (Solar System Dynamics, DE441 ephemeris): https://ssd.jpl.nasa.gov/horizons/ — topocentric apparent azimuth/elevation of the Sun and Earth for every site, precomputed and live.

## Space agency partner & other data
* **Canadian Space Agency (CSA)** — Moon exploration portal (https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/), including the Canadian utility rover programme and Canada's role in Artemis, informed the "Peak Near Shackleton (CSA Rover Target)" scenario. No CSA dataset is ingested directly.

## References
* Smith, D. E. et al. (2010). The Lunar Orbiter Laser Altimeter investigation on the Lunar Reconnaissance Orbiter mission. *Space Science Reviews* 150, 209–241.
* Neumann, G. A. (2010). LRO LOLA Reduced Data Record and Derived Products, LRO-L-LOLA-4-GDR-V1.0. NASA Planetary Data System.
* Giorgini, J. D. et al. (1996). JPL's On-Line Solar System Data Service. *BAAS* 28, 1158. Horizons API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
* Park, R. S. et al. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. *The Astronomical Journal* 161, 105.
* Gläser, P. et al. (2014). Illumination conditions at the lunar south pole using high resolution Digital Terrain Models from LOLA. *Icarus* 243, 78–90.
* Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081.
* Open-source software: NumPy, rasterio/GDAL, pyproj/PROJ, requests, Pillow, React, Vite, TypeScript, Tailwind CSS, Recharts, three.js, Lucide, PostCSS/Autoprefixer; fonts Inter and JetBrains Mono (Google Fonts); hosting Vercel.
* AI assistant: Claude (Anthropic), via Claude Code (see Use of SI).

---

## 30-second demo video script (English subtitles)

Record the live site in a desktop browser at 1920 × 1080. Each line is one subtitle card. Total ≈ 30 s.

| Time | On screen | Subtitle |
|---|---|---|
| 0–4 s | Map view, ±160 km: polar sites coloured by sunlight | **At the lunar south pole, a few hundred metres decide whether a lander lives or dies.** |
| 4–9 s | Compare → preset *Terrain Impact*; panoramas show the lit rim beside the dark floor | **Shackleton's rim: 88% sunlight. Its floor, 13 km away: 0%. Real NASA terrain and ephemerides.** |
| 9–14 s | Preset *Launch Delay*; press play, the Sun crosses behind the ridge in the +14 d slot | **Launch slips two weeks? The Sun moves behind a ridge, and power is gone.** |
| 14–21 s | Site = Nobile rim → *Best nearby spot* ±2 km → heat map fills in, star appears | **We scan the ground around any site in seconds: 2 km away, 77% sunlight instead of 53%, on a safe 5° slope.** |
| 21–26 s | Mission planner: landing-window strip, *land here*, battery card | **Then pick the landing window and size the battery for the longest night.** |
| 26–30 s | Validation panel open → back to the panorama, app URL on screen | **AetherRidge — validated against published LOLA studies. Try it free online.** |

Tips: hide the cursor between clicks, start each scan off-camera so the heat map is already filling, and keep subtitles on screen for at least 2 s each.

---

## Final checklist ✏️
- [ ] All team members are listed on the team page and registered for the same event (Universal Event teams need ≥ 2 members).
- [ ] Demo video (≤ 30 s, English subtitles) uploaded and set to **public / anyone with the link**.
- [ ] Final project link opens without login.
- [ ] Use of SI, NASA Data, Space Agency Partner Data and References fields filled from this document.
- [ ] Both submission declarations ticked; submitted before **Nov 15, 11:59 pm** local time. Submit early, you can still edit until the deadline.

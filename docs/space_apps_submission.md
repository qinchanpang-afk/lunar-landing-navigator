# Space Apps 2026 — submission text (copy into the project page)

> The headings below follow the official project form, in the same order (Project Submission Guide, 2026).
> Everything below is final and ready to paste, field by field. Everything on the page and in linked material is in English.
> Deadline: **Sunday, November 15, 11:59 pm in the time zone of your Local Event**. Submit early; you can edit and resubmit until the deadline.

---

## Project Name
AetherRidge — Sun & Earth Line-of-Sight Navigator for Lunar South Pole Landings

*(Team: Akasha Solo · Challenge: Lunar Landing Site Navigator. These come from your team page, not from this form.)*

---

## High-Level Project Summary

AetherRidge is a web app that shows, for any landing site and any moment in 2026–2027, whether a lander will have sunlight for power and a direct line of sight to Earth for communications, and for how long. It uses NASA JPL Horizons Sun and Earth positions and a 360° horizon ray-traced on NASA LRO LOLA terrain, so every number comes from real data. Planners can compare sites side by side, simulate a launch slip, scan the surrounding kilometres for a better-lit and lander-safe spot, find landing windows and size the battery for the longest night. Students and the public get plain-language explanations. It matters because at the lunar south pole a few hundred metres or a two-week delay can be the difference between near-continuous power and a 20-day night. The app turns that into a decision in seconds.

---

## Link to Project Demo
https://youtu.be/eWEK2JrqiTw

*(30-second video with narration and English subtitles. The form takes one link; the 7-slide deck is linked in the Detailed Project Description.)*

## Link to Final Project
https://lunar-landing-navigator-vfdm.vercel.app/

---

## Detailed Project Description

**Links**
* Live app (no login): https://lunar-landing-navigator-vfdm.vercel.app
* Source code, data pipeline and validation: https://github.com/qinchanpang-afk/lunar-landing-navigator
* 30-second demo video: https://youtu.be/eWEK2JrqiTw
* 7-slide deck (PDF): https://github.com/qinchanpang-afk/lunar-landing-navigator/blob/main/docs/AetherRidge_slides.pdf

### What it does
* **Landing page**: the problem, key results and a scroll-driven explainer (the Sun moving behind a ridge switches power off), with one-click entry into the navigator.
* **3D terrain with live shadows**: real LOLA terrain around the site, rendered in 3D and lit by the Sun at the chosen time, with the 100 km skyline ring that decides power at the site.
* **First-screen answer**: "Is there power? Is there a link to Earth? For how long?" answered at a glance, with one-click demo scenarios.
* **360° horizon panorama and sky dome**: the real skyline from LOLA altimetry, with the Sun and Earth at their apparent positions and ±15-day tracks (Earth's libration loop is visible).
* **Countdowns**: time to the next sunset (power loss) and Earthset (communications loss), interpolated below the 2-hour data step.
* **Power & comms statistics**:
  * sunlight % and Direct-to-Earth (DTE) %
  * longest shadow and longest DTE blackout
  * flat-panel and vertical sun-tracking panel efficiency
* **Side-by-side comparison and launch-slip simulation**: up to four slots. Each runs on the main clock, shifted by a delay (e.g. +14 days), or on its own date.
* **South-pole map**: LOLA shaded relief with every site coloured by sunlight. NASA's long-term Sun and Earth visibility maps can be overlaid (cold traps in blue). Click anywhere to analyse that exact spot.
* **Best nearby spot**: re-traces the horizon on an 11 × 11 grid around a site, in parallel in the browser (~8 s), and finds the best lander-safe cell (slope ≤ 10°).
* **Mission planner**:
  * landing windows that guarantee N days of continuous Sun (+ Earth link)
  * the waiting time if a window is missed
  * battery energy and mass for the longest shadow
* **Custom coordinates**: any latitude/longitude on the Moon. Ephemerides are fetched live from Horizons and the terrain is traced in the browser.
* **Shareable deep links**: URLs that reopen the same site and view.
* **Exports**: CSV, a one-click printable PDF site report, and links that open the same spot in NASA's Moon Trek and in LROC QuickMap.
* **Planner and Explorer modes and an in-app validation panel.**

### How it works
1. **Horizon mask.** A Python pipeline reads the LOLA `LDEM_80S_80M` DEM (80 m/px; scale and projection checked against the PDS label). For each site south of 80°S it marches along great circles in 1° azimuth steps out to 100 km, with exact spherical curvature. Sites north of 80°S use an ideal 0° horizon.
2. **Sun and Earth positions.** It queries JPL Horizons for the topocentric apparent azimuth and elevation of the Sun and Earth every 2 hours for 2026–2027 (Moon MEAN_ME frame; airless, so no refraction).
3. **Visibility.** A body is visible when its elevation exceeds the horizon at its azimuth. The pipeline precomputes, for every step:
   * visibility
   * power efficiency
   * hours to the next set or rise

   It exports these as compact JSON, so the web app runs instantly with no API latency.
4. **Custom sites and the nearby scan.**
   * A compressed 80 m/160 m tile pyramid of the same DEM is ray-traced in the browser, within 0.1 percentage point of the full pipeline.
   * The nearby scan rotates the site's Sun and Earth directions into each grid point's local frame.
   * An independent Horizons query at the best Nobile cell confirmed the result (77.5 % vs 77.5 %).
5. **Validation.** Automated checks run each time the data pipeline runs (9/9 pass):
   * Apollo 11 has 14.78-day days and the Sun reaches 89.9°.
   * Chang'e-6 on the far side has 0 % DTE.
   * Shackleton's floor is 0 % lit while its rim is 88 %.

   Results also agree with:
   * Published LOLA illumination studies. Gläser et al. 2014 give the best ridge point as 92.3 % lit with 3–5 days of darkness; ours is 88.0 % and 3.1 days.
   * NASA's own 18.6-year LOLA illumination maps (NASA GSFC PGDA). Shackleton rim is 88.0 % vs 87.1 % (best within 150 m), and permanent shadow is 0 % vs 0 %. Malapert differs (82.6 % vs 68.5 %), which we explain by our 2 m mast height and 2-year window. We report this difference rather than tuning it away.

### Key findings
* Shackleton rim vs its floor, about 13 km apart: **88 % vs 0 %** sunlight.
* Malapert summit keeps Earth in view **96 %** of the time, which makes it a natural relay site.
* Around the Nobile rim coordinates, a lander-safe spot **2.15 km away** gets **77.5 %** sunlight instead of 52.9 %, and halves the longest night (11 vs 22 days).
* A 14-day launch slip moves the Sun to the opposite side of the sky, where different terrain decides power and communications.

### Benefits
* Mission planners can screen sites, dates and contingencies in seconds, instead of hours with separate tools.
* Educators and the public can see *why* the lunar south pole is so extreme.
* All of it runs in a browser, free, with open code and open NASA data.

### What we hope to achieve
A quick-look tool that complements QuickMap and Moon Trek. It answers "what if we land here instead, or two weeks later?" before a detailed engineering study.

Next steps:
* full 18.6-year illumination statistics
* Sun-disc partial occlusion
* a link budget for relay satellites

### Tools, languages and software
* **Data pipeline:** Python (NumPy, rasterio/GDAL, pyproj, requests, Pillow).
* **Web app:** TypeScript, React, Vite, Tailwind CSS, Recharts, three.js, Lucide icons, Web Workers.
* **Hosting:** Vercel, with a same-origin proxy for the Horizons API.
* **Version control:** Git/GitHub.
* **Demo video:** Playwright screen capture and FFmpeg editing.

---

## Use of Super Intelligence (SI)
*(This field is for data collection and is not shown to judges. Judges do see the AI notes inside the project: README, app footer, video end card, last slide.)*

**What the team decided before coding.** The idea and the approach were ours, written down in a project spec:
* the problem framing
* the physics rules: no refraction, a 100 km curvature-corrected horizon, and an ideal horizon north of 80°S
* the pre-computed architecture and the tech stack
* the site list and the validation criteria

**How we used Claude.** We used Claude (Anthropic) as an AI assistant in Claude Code to:
* write most of the source code (the Python data pipeline and the TypeScript web app), following that spec
* draft the documentation
* lay out the slide deck
* write the scripts that record and edit the demo video, and the script that procedurally synthesizes its background music. The music is sine-wave chords and filtered noise generated by code; no generative-AI audio model was used.

It also proposed optional feature extensions (map, best-nearby-spot scan, mission planner, shareable links, validation panel). We reviewed them and chose which to build.

**What is not AI-generated:**
* No data: every Sun/Earth position comes from NASA JPL Horizons, and all terrain from NASA LRO LOLA.
* No images or video: the map images are rendered by our own script from the LOLA DEM, and the video and slides use real screenshots of the app. No AI-generated images or video are used.
* The narration is the team member's own recorded voice.
* No NASA branding appears in the app, the video or the slides.

**How we checked it.** We verified the outputs with automated physics checks, comparison with published studies, and manual review.

**Where it is disclosed:**
* AI-assisted commits are marked `Co-Authored-By: Claude` in the git history.
* The disclosure is repeated in the README, in the app footer and page metadata, on the video end card and in the video file metadata, and on the last slide.

---

## NASA Data
* **LRO Lunar Orbiter Laser Altimeter (LOLA): `LDEM_80S_80M` south-polar DEM** (`LRO-L-LOLA-4-GDR-V1.0`), NASA PDS Geosciences Node: https://pds-geosciences.wustl.edu/missions/lro/lola.htm. Used for horizon ray-tracing, ground height, slope and the map.
* **LOLA average Sun and Earth visibility maps** (`AVGVISIB_85S_060M_201608` and `_EARTH`, 60 m/px, 18.6-year average; Mazarico et al. 2011), NASA GSFC PGDA: https://pgda.gsfc.nasa.gov/products/69. Used for independent validation of every polar site and for the switchable map overlays (permanently shadowed regions, long-term sunlight, Earth visibility).
* **NASA JPL Horizons System** (Solar System Dynamics, DE441 ephemeris): https://ssd.jpl.nasa.gov/horizons/. Used for the topocentric apparent azimuth/elevation of the Sun and Earth at every site, both precomputed and live.
* **NASA Moon Trek** (https://trek.nasa.gov/moon/) and **LROC QuickMap** (https://quickmap.lroc.im-ldi.com): linked from the app so users can inspect the same spot in NASA's own viewers. No data is ingested from them.

## Space Agency Partner Data and Other References

**Space Agency Partner**
* **Canadian Space Agency (CSA)**: the Moon exploration portal, https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/. Its coverage of the Canadian utility rover programme and Canada's role in Artemis informed the illustrative "Peak Near Shackleton (CSA Rover Scenario)" site. CSA has not published a landing site, so this point is a scenario, not an official target. No CSA dataset is ingested directly.

**Literature**
* Smith, D. E. et al. (2010). The Lunar Orbiter Laser Altimeter investigation on the Lunar Reconnaissance Orbiter mission. *Space Science Reviews* 150, 209–241.
* Neumann, G. A. (2010). LRO LOLA Reduced Data Record and Derived Products, LRO-L-LOLA-4-GDR-V1.0. NASA Planetary Data System.
* Giorgini, J. D. et al. (1996). JPL's On-Line Solar System Data Service. *BAAS* 28, 1158. Horizons API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
* Park, R. S. et al. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. *The Astronomical Journal* 161, 105.
* Gläser, P. et al. (2014). Illumination conditions at the lunar south pole using high resolution Digital Terrain Models from LOLA. *Icarus* 243, 78–90.
* Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081.

**Software, fonts and media**
* Open-source software: NumPy, rasterio/GDAL, pyproj/PROJ, requests, Pillow, React, Vite, TypeScript, Tailwind CSS, Recharts, three.js, Lucide, PostCSS/Autoprefixer, Playwright, FFmpeg.
* Fonts: Inter, JetBrains Mono and Space Grotesk (Google Fonts, SIL Open Font License).
* Hosting: Vercel.
* Demo media: all screenshots and video footage are captured from our own app. The narration is recorded by the team member. The background music is synthesized by our own script, with no third-party or copyrighted audio.
* AI assistant: Claude (Anthropic), via Claude Code (see Use of SI).

---

## Images to paste into the page (optional, recommended)
The project page accepts JPG/PNG/GIF images up to 10 MB, but not videos or documents. Six ready screenshots are in `C:\Users\USER\Documents\lunar-navigator\submission_images\`:
1. first-screen answer
2. Shackleton rim vs floor
3. 3D terrain with live shadows
4. best nearby spot
5. mission planner
6. south-pole map with the NASA illumination overlay

Put 2–4 of them in the Detailed Project Description.

---

## YouTube upload text
* **Title:** AetherRidge – Lunar South Pole Landing Navigator | NASA Space Apps 2026 | Team Akasha Solo
* **Visibility:** Public (or Unlisted; both open without login). Set "Not made for kids".
* **Description:**
  ```
  AetherRidge shows, for any lunar south pole landing site, whether a lander has sunlight for power and a direct line of sight to Earth, and for how long.
  NASA Space Apps Challenge 2026 · Challenge: Lunar Landing Site Navigator · Team Akasha Solo (Pang Qin Chan)

  Live app: https://lunar-landing-navigator-vfdm.vercel.app
  Code: https://github.com/qinchanpang-afk/lunar-landing-navigator

  Data: NASA LRO LOLA, NASA JPL Horizons, NASA GSFC PGDA illumination maps.
  Narration: Pang Qin Chan. App code, video edit scripts and the procedurally synthesized background music were made with AI assistance (Claude, Anthropic). No AI-generated images, video or voice.
  ```

---

## 30-second demo video
The shot list, narration script and recording guide are in [`demo_video_script.md`](demo_video_script.md). The final cut has:
* narration and English subtitles
* original procedural background music, ducked under the voice
* an end card with the data sources and the AI note

It is rendered by `video/record.mjs`, `video/mix.py` and `video/edit.py` (local workspace, not committed).

---

## Final checklist ✏️
- [ ] Your team is a confirmed participant (not waitlisted) at your Local Event.
- [x] Demo video (30 s, English subtitles) on YouTube, opens without login: https://youtu.be/eWEK2JrqiTw
- [x] Slide deck as a public PDF in the GitHub repo: https://github.com/qinchanpang-afk/lunar-landing-navigator/blob/main/docs/AetherRidge_slides.pdf
- [ ] Every link opens in a private/incognito window without login: the app, GitHub, YouTube and the PDF.
- [ ] Optional: request a FortiGuard Web Filter classification for the vercel.app site (category: Education or Web-based Application; Company Name: N/A), so judges on filtered networks can open it.
- [ ] All fields filled from this document: Summary, Demo, Final Project, Detailed Description, Use of SI, NASA Data, Space Agency Partner Data and Other References.
- [ ] "Terms and Conditions" and "Confirm All Work is Original" ticked, then **Submit for Judging**. Look for the confirmation banner.
- [ ] Your Profile's Full Name is correct (it is printed on the participant certificate).

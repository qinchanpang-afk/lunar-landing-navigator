# NASA Space Apps 2026: Lunar Landing Site Navigator

## Core Problem
Missions to the Moon's south pole face extreme lighting and communication constraints. Existing tools (Quickmap, Moon Trek, JPL Horizons) are overly complex for rapid scenario comparison when launch dates or landing sites shift.

## Required Features & Judging Criteria
1. **Interactive Site Selection & Comparison**: Curated list of notable sites (Apollo, CLPS/Artemis candidates, Chang'e, CSA) + custom lunar coordinates input. Must support **side-by-side comparison** of multiple sites/dates.
2. **Date & Time Flexibility**: Date/time picker + interactive timeline scrubber/animation across a full lunar day (~29.5 Earth days) and across seasons.
3. **Sun & Earth Horizon Visualization**: Show Sun and Earth positions relative to the local topographic horizon, highlighting Earth's libration (wobble) and displaying exact **time remaining before sunset (power loss) and Earthset (communication loss)**.
4. **Power & Communication Assessment**: Highlight Solar Elevation Angle, estimated solar array power efficiency (`sin(elevation)` when unoccluded), total sunlight duration %, max continuous shadow duration (battery survival metric), and DTE communication window %.
5. **Dual Accessibility**: Serve both mission planners (engineering charts, exact angles, CSV export) and educators/public (plain-language explanations of why south pole geometry is extreme and why there is no atmospheric refraction).
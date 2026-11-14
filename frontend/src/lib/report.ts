/**
 * One-click printable site report (the browser's "Save as PDF" turns it into a PDF).
 * Everything comes from data already in the app: the site's precomputed series, the planner helpers
 * and, when available, the NASA PGDA comparison values.
 */
import type { SiteDetail } from "./types";
import { bodyState, fmtDuration, fmtUTC } from "./time";
import { landingWindows } from "./planner";
import { quickmapUrl } from "./links";

interface PgdaRow { id: string; pgda_sun_pct: number | null; pgda_sun_max150_pct: number | null; pgda_earth_pct: number | null; pgda_earth_max150_pct: number | null }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function maskSvg(mask: number[]): string {
  const W = 720, H = 160, pad = 28;
  const lo = Math.min(-5, Math.floor(Math.min(...mask))), hi = Math.max(5, Math.ceil(Math.max(...mask)));
  const X = (a: number) => pad + (a / 359) * (W - pad - 8);
  const Y = (v: number) => 8 + ((hi - v) / (hi - lo)) * (H - pad - 8);
  const d = mask.map((v, a) => `${a ? "L" : "M"}${X(a).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const ticks = [0, 90, 180, 270, 359].map((a) => `<text x="${X(a)}" y="${H - 8}" font-size="10" text-anchor="middle">${a === 359 ? 360 : a}°</text>`).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="${pad}" y="8" width="${W - pad - 8}" height="${H - pad - 8}" fill="#f1f5f9"/>
    <line x1="${pad}" x2="${W - 8}" y1="${Y(0)}" y2="${Y(0)}" stroke="#94a3b8" stroke-dasharray="4 3"/>
    <path d="${d}L${X(359)},${Y(lo)}L${X(0)},${Y(lo)}Z" fill="#64748b" opacity="0.85"/>
    <text x="4" y="${Y(hi) + 4}" font-size="10">${hi}°</text><text x="4" y="${Y(lo)}" font-size="10">${lo}°</text>
    ${ticks}</svg>`;
}

export async function openSiteReport(site: SiteDetail, tH: number, t0ms: number, shareUrl: string, panoramaPng: string | null) {
  // Open the window synchronously (popup blockers), fill it when the async data is ready.
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups for this site to open the report.");
    return;
  }
  w.document.write("<p style='font-family:sans-serif'>Preparing report…</p>");

  let pgda: PgdaRow | undefined;
  try {
    const j = await (await fetch(`${import.meta.env.BASE_URL}data/pgda/pgda_sites.json`)).json();
    pgda = (j.sites as PgdaRow[]).find((r) => r.id === site.id);
  } catch { /* optional */ }

  const st = site.stats;
  const sun = bodyState(site.sun, site.horizon_mask_deg, tH, site.time.step_h);
  const earth = bodyState(site.earth, site.horizon_mask_deg, tH, site.time.step_h);
  const at = (h: number) => fmtUTC(t0ms + h * 3_600_000);
  const winBoth = landingWindows(site, "both", 96);
  const winSun = landingWindows(site, "sun", 96);
  const next = (ws: typeof winBoth) => ws.filter((x) => x.closeH >= tH).slice(0, 5);
  const rows = (ws: typeof winBoth) => next(ws).map((x) => `<tr><td>${at(Math.max(x.openH, 0))}</td><td>${at(x.closeH)}</td><td>${fmtDuration(x.bestH)}</td></tr>`).join("") || `<tr><td colspan="3">No window in 2026–2027 after the selected time.</td></tr>`;
  const night = st.max_continuous_shadow_h;
  const wh = (100 * night) / 0.8;
  const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}%`);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AetherRidge report — ${esc(site.name)}</title>
<style>
  body{font-family:Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;margin:28px;max-width:780px}
  h1{font-size:20px;margin:0} h2{font-size:14px;margin:20px 0 6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px}
  .sub{color:#475569;font-size:12px;margin-top:2px} table{border-collapse:collapse;width:100%;font-size:12px}
  td,th{border-bottom:1px solid #e2e8f0;padding:4px 6px;text-align:left} th{color:#475569;font-weight:600}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} .card{border:1px solid #cbd5e1;border-radius:8px;padding:8px}
  .big{font-size:20px;font-weight:700} .k{color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .note{color:#475569;font-size:11px;line-height:1.45} img{max-width:100%;border-radius:6px}
  .warn{background:#fef3c7;border:1px solid #f59e0b;padding:6px 8px;border-radius:6px;font-size:12px}
  @media print{body{margin:12mm} a{color:#0f172a}}
</style></head><body>
<h1>AetherRidge — site report</h1>
<div class="sub">Sun &amp; Earth Line-of-Sight Navigator for Lunar South Pole Landings · Team Akasha Solo · NASA Space Apps 2026</div>
<h2>${esc(site.name)}</h2>
<div class="sub">${esc(site.agency)} · ${site.lat.toFixed(4)}°, ${site.lon.toFixed(3)}°E · elevation ${site.elev_km_used.toFixed(3)} km${site.slope_deg != null ? ` · local slope ${site.slope_deg.toFixed(1)}°` : ""}</div>
<p class="note">${esc(site.description)}</p>
${site.warnings.length ? `<div class="warn">${site.warnings.map(esc).join("<br>")}</div>` : ""}

<h2>At ${at(tH)}</h2>
<div class="grid">
  <div class="card"><div class="k">Solar power</div><div class="big">${sun.visible ? "ON" : "OFF"}</div>${sun.visible ? `sunset in ${fmtDuration(sun.toSet)}` : `sunrise in ${sun.toRise == null ? "— (none in 2026–27)" : fmtDuration(sun.toRise)}`}<br><span class="note">Sun el ${sun.el.toFixed(2)}° vs terrain ${sun.horizon.toFixed(2)}° at az ${sun.az.toFixed(1)}°</span></div>
  <div class="card"><div class="k">Direct link to Earth</div><div class="big">${earth.visible ? "ON" : "OFF"}</div>${earth.visible ? `Earthset in ${fmtDuration(earth.toSet)}` : `Earthrise in ${earth.toRise == null ? "— (none in 2026–27)" : fmtDuration(earth.toRise)}`}<br><span class="note">Earth el ${earth.el.toFixed(2)}° vs terrain ${earth.horizon.toFixed(2)}°</span></div>
  <div class="card"><div class="k">Open live</div><a href="${esc(shareUrl)}">this exact view</a><br><a href="${esc(quickmapUrl(site.lat, site.lon))}">NASA/LROC QuickMap</a></div>
</div>

<h2>2026–2027 statistics (2-hourly, JPL Horizons + LOLA horizon)</h2>
<table><tbody>
<tr><th>Sunlight</th><td>${pct(st.sunlight_pct)}</td><th>Direct-to-Earth</th><td>${pct(st.dte_pct)}</td><th>Sun + DTE</th><td>${pct(st.sun_and_dte_pct)}</td></tr>
<tr><th>Longest shadow</th><td>${fmtDuration(st.max_continuous_shadow_h)}</td><th>Longest DTE blackout</th><td>${fmtDuration(st.max_continuous_dte_blackout_h)}</td><th>Longest sunlight</th><td>${fmtDuration(st.max_continuous_sunlight_h)}</td></tr>
<tr><th>Mean eff. flat panel</th><td>${(st.mean_power_eff_horizontal * 100).toFixed(1)}%</td><th>Mean eff. vertical tracker</th><td>${(st.mean_power_eff_vertical_tracking * 100).toFixed(1)}%</td><th>Sun elevation range</th><td>${st.min_solar_elev_deg.toFixed(1)}° … ${st.max_solar_elev_deg.toFixed(1)}°</td></tr>
<tr><th>Earth elevation range</th><td>${st.earth_elev_range_deg[0].toFixed(1)}° … ${st.earth_elev_range_deg[1].toFixed(1)}°</td><th>Max / mean horizon</th><td>${st.max_horizon_deg.toFixed(2)}° / ${st.mean_horizon_deg.toFixed(2)}°</td><th>Battery for worst night*</th><td>${night > 0 ? `${(wh / 1000).toFixed(1)} kWh` : "—"}</td></tr>
</tbody></table>
<p class="note">* 100 W night load, 80% usable depth of discharge; first-order sizing.</p>

<h2>Terrain horizon (elevation of the skyline vs azimuth)</h2>
${maskSvg(site.horizon_mask_deg)}
<p class="note">${esc(site.horizon_source)}. Dashed line = ideal smooth-Moon horizon (0°).</p>
${panoramaPng ? `<img src="${panoramaPng}" alt="Horizon panorama at the selected time">` : ""}

<h2>Landing windows guaranteeing ≥ 4 days of continuous coverage after touchdown</h2>
<table><thead><tr><th>Sun + Earth link — opens</th><th>closes</th><th>best guaranteed</th></tr></thead><tbody>${rows(winBoth)}</tbody></table>
<table style="margin-top:6px"><thead><tr><th>Sun only — opens</th><th>closes</th><th>best guaranteed</th></tr></thead><tbody>${rows(winSun)}</tbody></table>

${pgda ? `<h2>Independent check: NASA LOLA long-term illumination (Mazarico et al. 2011, 18.6-year average)</h2>
<table><thead><tr><th></th><th>This tool (2026–27)</th><th>NASA at point</th><th>NASA best ≤150 m</th></tr></thead><tbody>
<tr><td>Sunlight</td><td>${pct(st.sunlight_pct)}</td><td>${pct(pgda.pgda_sun_pct)}</td><td>${pct(pgda.pgda_sun_max150_pct)}</td></tr>
<tr><td>Earth visibility</td><td>${pct(st.dte_pct)}</td><td>${pct(pgda.pgda_earth_pct)}</td><td>${pct(pgda.pgda_earth_max150_pct)}</td></tr></tbody></table>
<p class="note">NASA: any part of the disc, ground level, 60 m DEM. This tool: disc centre, 2 m mast, 80 m DEM.</p>` : ""}

<h2>Method &amp; sources</h2>
<p class="note">Visibility = apparent elevation (NASA JPL Horizons, airless, no refraction) &gt; terrain horizon ray-traced 100 km on NASA LRO LOLA LDEM_80S_80M with exact lunar curvature. Data: NASA LRO LOLA (PDS), NASA JPL Horizons, NASA GSFC PGDA illumination maps. Code written with AI assistance (Claude, Anthropic); see the project README. Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.</p>
<script>setTimeout(function(){window.print()},400)</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

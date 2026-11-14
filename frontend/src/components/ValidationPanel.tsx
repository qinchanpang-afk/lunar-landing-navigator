import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ShieldCheck, XCircle } from "lucide-react";

interface Report { generated_utc: string; checks: { check: string; pass: boolean; detail: string }[]; notes: string[] }
interface HybridRow { id: string; mask_rms_deg: number; mask_max_abs_deg: number; sun_pct_80m: number; sun_pct_hybrid: number; dte_pct_80m: number; dte_pct_hybrid: number }

interface PgdaRow { id: string; name: string; ours_sun_pct: number; ours_dte_pct: number; pgda_sun_pct: number | null; pgda_sun_max150_pct: number | null; pgda_earth_pct: number | null; pgda_earth_max150_pct: number | null }

const DATA = `${import.meta.env.BASE_URL}data/`;

/** Independent published results to compare against (values quoted from the cited abstracts). */
const LITERATURE = [
  {
    quantity: "Best-lit spot, Shackleton–de Gerlache connecting ridge (2 m above ground)",
    ours: "87.97% (Shackleton rim site)",
    theirs: "92.27% (best single point)",
    ref: "Gläser et al. 2014, Icarus 243, 78–90",
    url: "https://doi.org/10.1016/j.icarus.2014.08.013",
    why: "They searched a 20 m/px DTM for the single best point over 19 years; our site sits on the same ridge on an 80 m DEM over 2 years, so a few points lower is expected.",
  },
  {
    quantity: "Longest continuous darkness at the best-lit ridge points",
    ours: "74 h ≈ 3.1 days",
    theirs: "typically 3–5 days",
    ref: "Gläser et al. 2014, Icarus 243",
    url: "https://doi.org/10.1016/j.icarus.2014.08.013",
    why: "Same order: the battery-sizing driver for polar landers.",
  },
  {
    quantity: "Very few polar points see near-continuous Sun; crater floors are permanently shadowed",
    ours: "Shackleton floor 0.0% Sun, rim 88%",
    theirs: "qualitative",
    ref: "Mazarico et al. 2011, Icarus 211, 1066–1081",
    url: "https://doi.org/10.1016/j.icarus.2010.10.030",
    why: "Our floor/rim contrast reproduces the permanently-shadowed-region pattern from LOLA topography.",
  },
];

export default function ValidationPanel() {
  const [open, setOpen] = useState(false);
  const [rep, setRep] = useState<Report | null>(null);
  const [hyb, setHyb] = useState<HybridRow[]>([]);
  const [pgda, setPgda] = useState<PgdaRow[]>([]);

  useEffect(() => {
    if (!open || rep) return;
    fetch(`${DATA}validation_report.json`).then((r) => r.json()).then(setRep).catch(() => {});
    fetch(`${DATA}dem/meta.json`).then((r) => r.json()).then((m) => setHyb(m.validation ?? [])).catch(() => {});
    fetch(`${DATA}pgda/pgda_sites.json`).then((r) => r.json()).then((m) => setPgda(m.sites ?? [])).catch(() => {});
  }, [open, rep]);

  const passed = rep?.checks.filter((c) => c.pass).length ?? 0;

  return (
    <section className="rounded-lg border border-emerald-400/20 bg-space-900/80 p-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <ShieldCheck size={15} className="text-emerald-300" />
        <h3 className="text-sm font-semibold text-slate-200">Validation & trust</h3>
        <span className="text-[11px] text-slate-400">automated physics checks · literature comparison · browser vs pipeline</span>
        <ChevronDown size={14} className={`ml-auto text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-4 text-[12px]">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Pipeline self-checks {rep && <span className="ml-1 font-mono normal-case text-emerald-300">{passed}/{rep.checks.length} pass</span>}
            </div>
            {!rep ? <p className="mt-1 text-slate-400">Loading…</p> : (
              <ul className="mt-1.5 space-y-1">
                {rep.checks.map((c) => (
                  <li key={c.check} className="flex items-start gap-2">
                    {c.pass ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-rose-400" />}
                    <span><span className="text-slate-200">{c.check}</span> <span className="font-mono text-[11px] text-slate-400">{c.detail}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400"><BookOpen size={12} /> Against published LOLA illumination studies</div>
            <div className="mt-1.5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead className="text-slate-400"><tr><th className="py-1 font-normal">Quantity</th><th className="font-normal">This tool</th><th className="font-normal">Published</th><th className="font-normal">Source</th></tr></thead>
                <tbody className="text-slate-300">
                  {LITERATURE.map((l) => (
                    <tr key={l.quantity} className="border-t border-space-800 align-top">
                      <td className="py-1.5 pr-2">{l.quantity}<div className="text-[11px] text-slate-400">{l.why}</div></td>
                      <td className="pr-2 font-mono text-amber-100">{l.ours}</td>
                      <td className="pr-2 font-mono text-slate-200">{l.theirs}</td>
                      <td><a href={l.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">{l.ref}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pgda.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Against NASA's long-term LOLA illumination maps (independent product)</div>
              <div className="mt-1.5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[11px]">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-1 font-normal">Site</th>
                      <th className="font-normal">Sunlight: this tool</th>
                      <th className="font-normal">NASA at point</th>
                      <th className="font-normal">NASA best ≤150 m</th>
                      <th className="font-normal">Earth view: this tool</th>
                      <th className="font-normal">NASA at point</th>
                      <th className="font-normal">NASA best ≤150 m</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-slate-300">
                    {pgda.map((p) => (
                      <tr key={p.id} className="border-t border-space-800">
                        <td className="py-1 pr-2 font-sans">{p.name.split(" (")[0]}</td>
                        <td className="text-amber-100">{p.ours_sun_pct.toFixed(1)}%</td>
                        <td>{p.pgda_sun_pct?.toFixed(1)}%</td>
                        <td>{p.pgda_sun_max150_pct?.toFixed(1)}%</td>
                        <td className="text-sky-100">{p.ours_dte_pct.toFixed(1)}%</td>
                        <td>{p.pgda_earth_pct?.toFixed(1)}%</td>
                        <td>{p.pgda_earth_max150_pct?.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                NASA GSFC PGDA product (Mazarico et al. 2011, 2016 release): fraction of hourly steps over an 18.6-year cycle in which any part of the
                Sun or Earth disc is visible from the ground, on a 60 m DEM. This tool: 2026–2027, disc centre, 2 m mast, 80 m DEM. The
                permanently shadowed floor and steep Haworth site agree at ~0–1%, and the rim, Nobile and CSA sites agree within a few points of the
                local best. On sharp summits a few tens of metres of position or DEM difference moves the value a lot, which is why the
                ≤150 m column matches far better than the single point (e.g. Shackleton rim 88.0% vs 87.1%; Malapert Earth view 96.4% vs 100%).
                Malapert sunlight stays higher here (82.6% vs ≤77.6% within 600 m), consistent with our 2 m mast and 2-year window.
              </p>
            </div>
          )}

          {hyb.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Browser ray-tracer (custom sites, nearby scan) vs full-resolution pipeline</div>
              <div className="mt-1.5 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left font-mono text-[11px] text-slate-300">
                  <thead className="font-sans text-slate-400"><tr><th className="py-1 font-normal">Site</th><th className="font-normal">Horizon RMS</th><th className="font-normal">Max |Δ|</th><th className="font-normal">Sun % (pipeline → browser)</th><th className="font-normal">DTE %</th></tr></thead>
                  <tbody>
                    {hyb.map((h) => (
                      <tr key={h.id} className="border-t border-space-800">
                        <td className="py-1 font-sans">{h.id}</td>
                        <td>{h.mask_rms_deg.toFixed(3)}°</td>
                        <td>{h.mask_max_abs_deg.toFixed(3)}°</td>
                        <td>{h.sun_pct_80m.toFixed(2)} → {h.sun_pct_hybrid.toFixed(2)}</td>
                        <td>{h.dte_pct_80m.toFixed(2)} → {h.dte_pct_hybrid.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Nearby-scan cross-check: the scan re-uses the site's ephemeris rotated into each grid point's local frame. For the best cell
                found 2.15 km SW of the Nobile rim site it predicted <span className="font-mono text-amber-100">77.5%</span> sunlight; a full
                custom-site run at that point with its own live JPL Horizons ephemeris gave <span className="font-mono text-amber-100">77.5%</span>.
              </p>
            </div>
          )}

          {rep && rep.notes.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Data-quality notes</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[11px] text-slate-400">
                {rep.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-slate-500">Known limits: 80 m DEM smooths sub-pixel peaks; 2-year window (not a full 18.6-year nodal cycle); no refraction (airless Moon); Earth treated as a point at its centre.</p>
        </div>
      )}
    </section>
  );
}

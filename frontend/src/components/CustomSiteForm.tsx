import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
import { computeCustomSite } from "../lib/custom";
import { registerSite } from "../lib/data";
import { saveCustomSite } from "../lib/storage";
import type { SiteMeta } from "../lib/types";

export interface SiteRequest {
  lat: number;
  lon: number;
  name: string;
  /** changes on every request so the same point can be re-requested */
  nonce: number;
}

interface Props {
  onAdded: (meta: SiteMeta) => void;
  /** external request (map click, nearby scan, shared link) - opens the form, fills it and computes */
  request?: SiteRequest | null;
}

export default function CustomSiteForm({ onAdded, request }: Props) {
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [elev, setElev] = useState("0");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const latN = Number(lat);
  const lonN = Number(lon);
  const valid = lat.trim() !== "" && lon.trim() !== "" && isFinite(latN) && isFinite(lonN) && latN >= -90 && latN <= 90 && isFinite(Number(elev));
  const polar = valid && latN <= -80;

  const run = async (override?: { lat: number; lon: number; name: string }) => {
    const latV = override ? override.lat : latN;
    const lonV = override ? override.lon : lonN;
    const nameV = override ? override.name : name.trim();
    if ((!override && !valid) || busy) return;
    setBusy(true);
    setErr(null);
    abort.current = new AbortController();
    const t0 = performance.now();
    try {
      const { detail, meta } = await computeCustomSite(
        { name: nameV, lat: latV, lon: lonV, elevKm: Number(elev) || 0 },
        setMsg,
        abort.current.signal,
      );
      registerSite(detail);
      onAdded(meta);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const saved = await saveCustomSite(detail, meta);
      setMsg(`Done in ${secs} s · ${saved ? "saved in this browser" : "not saved (browser storage unavailable or full) — kept for this session"}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!request) return;
    const lat4 = Number(request.lat.toFixed(4));
    const lon4 = Number(request.lon.toFixed(4));
    setOpen(true);
    setLat(String(lat4));
    setLon(String(lon4));
    setName(request.name);
    run({ lat: lat4, lon: lon4, name: request.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  const field = "w-full rounded-md border border-space-600 bg-space-800 px-2 py-1 font-mono text-xs text-slate-100 focus:border-sky-400/60 focus:outline-none";

  return (
    <div className="rounded-lg border border-space-700 bg-space-900/60 p-2.5">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left text-[13px] font-medium text-slate-200">
        <Crosshair size={14} className="text-sky-300" /> Custom coordinates
        <span className="ml-auto text-[10px] text-slate-500">{open ? "hide" : "add site"}</span>
      </button>
      {open && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-slate-400">
              Latitude (°, −90…90)
              <input className={field} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="-89.45" />
            </label>
            <label className="text-[10px] text-slate-400">
              East longitude (°)
              <input className={field} value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" placeholder="222.7" />
            </label>
          </div>
          <label className="block text-[10px] text-slate-400">
            Name (optional)
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. de Gerlache rim" />
          </label>
          {!polar && (
            <label className="block text-[10px] text-slate-400">
              Elevation (km vs 1737.4 km sphere)
              <input className={field} value={elev} onChange={(e) => setElev(e.target.value)} inputMode="decimal" />
            </label>
          )}
          <p className="text-[10px] leading-snug text-slate-500">
            {!valid
              ? "Enter a valid latitude and longitude."
              : polar
                ? "South of 80°S: elevation comes from LOLA and the horizon is ray-traced on real terrain in your browser."
                : "North of 80°S: outside the polar DEM, so an ideal 0° horizon is used."}{" "}
            Sun and Earth positions are fetched live from NASA JPL Horizons (2026–2027, every 2 h).
          </p>
          <div className="flex gap-2">
            <button
              type="submit" disabled={!valid || busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-sky-500/20 px-2 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/30 disabled:opacity-40"
            >
              {busy && <Loader2 size={13} className="animate-spin" />} Compute site
            </button>
            {busy && (
              <button type="button" onClick={() => abort.current?.abort()} className="rounded-md border border-space-600 px-2 text-xs text-slate-400 hover:bg-space-700">
                Cancel
              </button>
            )}
          </div>
          {msg && <p className="text-[11px] text-slate-400" aria-live="polite">{msg}</p>}
          {err && <p className="text-[11px] text-rose-300" role="alert">{err}</p>}
        </form>
      )}
    </div>
  );
}

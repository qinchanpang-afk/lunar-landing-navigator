import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Columns2, Compass, GraduationCap, Moon, Satellite, Wrench } from "lucide-react";
import { registerSite, useIndex, useSite } from "./lib/data";
import { clearCustomSites, loadCustomSites, removeCustomSite } from "./lib/storage";
import type { Audience, SiteMeta } from "./lib/types";
import CustomSiteForm from "./components/CustomSiteForm";
import { bodyState, clamp, spanHours, startMs } from "./lib/time";
import SiteList from "./components/SiteList";
import TimeControls from "./components/TimeControls";
import Panorama, { type CenterMode } from "./components/Panorama";
import SkyDome from "./components/SkyDome";
import StatusCards, { type PanelMode } from "./components/StatusCards";
import Timeline from "./components/Timeline";
import SiteStats from "./components/SiteStats";
import CompareView, { type Slot } from "./components/CompareView";
import Explainer from "./components/Explainer";

const T0_MS = Date.parse("2026-01-01T00:00Z");
const DEFAULT_SPAN_H = 17518;

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md overflow-hidden border border-space-600 text-[11px]">
      {options.map(([v, l]) => (
        <button
          key={String(v)} type="button" onClick={() => onChange(v)}
          className={`px-2 py-1 ${value === v ? "bg-sky-500/20 text-sky-200" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const { index, error } = useIndex();
  const [selectedId, setSelectedId] = useState("shackleton-rim");
  const [audience, setAudience] = useState<Audience>("planner");
  const [view, setView] = useState<"single" | "compare">("single");
  const [tH, setTHRaw] = useState(() => clamp((Date.now() - T0_MS) / 3_600_000, 0, DEFAULT_SPAN_H));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(24);
  const [center, setCenter] = useState<CenterMode>("north");
  const [panel, setPanel] = useState<PanelMode>("horizontal");
  const [windowDays, setWindowDays] = useState(30);
  const [slots, setSlots] = useState<Slot[]>([
    { key: 1, id: "shackleton-rim", linked: true, tH: 0 },
    { key: 2, id: "malapert-massif", linked: true, tH: 0 },
    { key: 3, id: "apollo-11", linked: true, tH: 0 },
  ]);

  const [customSites, setCustomSites] = useState<SiteMeta[]>([]);
  const allSites = useMemo(() => [...(index?.sites ?? []), ...customSites], [index, customSites]);
  const addCustom = (m: SiteMeta) => {
    setCustomSites((cs) => [...cs.filter((c) => c.id !== m.id), m]);
    setSelectedId(m.id);
    setView("single");
  };
  const removeCustom = (id: string) => {
    removeCustomSite(id);
    setCustomSites((cs) => cs.filter((c) => c.id !== id));
    setSlots((ss) => ss.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId("shackleton-rim");
  };
  const clearCustom = () => {
    clearCustomSites();
    const ids = new Set(customSites.map((c) => c.id));
    setCustomSites([]);
    setSlots((ss) => ss.filter((s) => !ids.has(s.id)));
    if (ids.has(selectedId)) setSelectedId("shackleton-rim");
  };

  // Restore custom sites saved in this browser.
  useEffect(() => {
    let live = true;
    loadCustomSites().then((list) => {
      if (!live || !list.length) return;
      list.forEach(({ detail }) => registerSite(detail));
      setCustomSites((cs) => [...cs.filter((c) => !list.some((l) => l.meta.id === c.id)), ...list.map((l) => l.meta)]);
    });
    return () => {
      live = false;
    };
  }, []);

  const site = useSite(selectedId);
  const spanH = site ? spanHours(site) : DEFAULT_SPAN_H;
  const t0ms = site ? startMs(site) : T0_MS;
  const setTH = useCallback((t: number) => setTHRaw(clamp(t, 0, spanH)), [spanH]);

  // Playback loop
  const spanRef = useRef(spanH);
  spanRef.current = spanH;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTHRaw((t) => {
        const nt = t + speed * dt;
        if (nt >= spanRef.current) {
          setPlaying(false);
          return spanRef.current;
        }
        return nt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  // Keyboard: space = play/pause, arrows = ±2 h (shift: ±1 day)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.code === "ArrowRight") setTHRaw((t) => clamp(t + (e.shiftKey ? 24 : 2), 0, spanRef.current));
      if (e.code === "ArrowLeft") setTHRaw((t) => clamp(t - (e.shiftKey ? 24 : 2), 0, spanRef.current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const events = useMemo(() => {
    if (!site) return null;
    const s = bodyState(site.sun, site.horizon_mask_deg, tH, site.time.step_h);
    const e = bodyState(site.earth, site.horizon_mask_deg, tH, site.time.step_h);
    return {
      sun: { label: s.visible ? "Next sunset" : "Next sunrise", dt: s.visible ? s.toSet : s.toRise },
      earth: { label: e.visible ? "Next Earthset" : "Next Earthrise", dt: e.visible ? e.toSet : e.toRise },
    };
  }, [site, tH]);

  const toggleCompare = (id: string) => {
    if (slots.some((s) => s.id === id)) setSlots(slots.filter((s) => s.id !== id));
    else if (slots.length < 4) setSlots([...slots, { key: Date.now(), id, linked: true, tH }]);
  };

  if (error) return <div className="p-8 text-rose-300">Failed to load data: {error}. Run scripts/build_data.py first.</div>;

  const pending = site?.warnings.some((w) => w.includes("pending"));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-space-700 bg-space-950/90 backdrop-blur">
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Moon size={20} className="text-slate-200" />
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-slate-50">Lunar Landing Site Navigator</h1>
              <p className="text-[10px] text-slate-500 hidden sm:block">
                Sun & Earth vs. the real lunar horizon · NASA JPL Horizons ephemeris · LRO LOLA {index?.dem.pixel_m ?? 80} m terrain
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-md overflow-hidden border border-space-600 text-xs">
              <button type="button" onClick={() => setView("single")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${view === "single" ? "bg-sky-500/20 text-sky-200" : "bg-space-800 text-slate-400"}`}>
                <Compass size={13} /> Site
              </button>
              <button type="button" onClick={() => setView("compare")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${view === "compare" ? "bg-violet-500/20 text-violet-200" : "bg-space-800 text-slate-400"}`}>
                <Columns2 size={13} /> Compare <span className="font-mono text-[10px] opacity-70">{slots.length}</span>
              </button>
            </div>
            <div className="flex rounded-md overflow-hidden border border-space-600 text-xs">
              <button type="button" onClick={() => setAudience("planner")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${audience === "planner" ? "bg-emerald-500/15 text-emerald-200" : "bg-space-800 text-slate-400"}`} title="Engineering view">
                <Wrench size={13} /> <span className="hidden min-[440px]:inline">Planner</span>
              </button>
              <button type="button" onClick={() => setAudience("explorer")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${audience === "explorer" ? "bg-amber-500/15 text-amber-200" : "bg-space-800 text-slate-400"}`} title="Plain-language view for educators & public">
                <GraduationCap size={13} /> <span className="hidden min-[440px]:inline">Explorer</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] grid gap-4 px-4 py-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-84px)] lg:overflow-y-auto pr-1">
          {index ? (
            <div className="space-y-3">
              <CustomSiteForm onAdded={addCustom} />
              <SiteList
                sites={allSites}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); setView("single"); }}
                compareIds={slots.map((s) => s.id)}
                toggleCompare={toggleCompare}
                onRemove={removeCustom}
                onClearCustom={clearCustom}
              />
            </div>
          ) : (
            <div className="text-xs text-slate-500">Loading sites…</div>
          )}
        </aside>

        <main className="min-w-0 space-y-4">
          <TimeControls
            tH={tH} spanH={spanH} t0ms={t0ms} setTH={setTH}
            playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
            nextSunEvent={events?.sun ?? { label: "Next sunset", dt: null }}
            nextEarthEvent={events?.earth ?? { label: "Next Earthset", dt: null }}
          />

          {view === "compare" && index ? (
            <CompareView sites={allSites} slots={slots} setSlots={setSlots} tH={tH} setTH={setTH} t0ms={t0ms} spanH={spanH} />
          ) : !site ? (
            <div className="h-64 grid place-items-center text-sm text-slate-500">Loading site data…</div>
          ) : (
            <>
              <section>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                  <h2 className="text-lg font-semibold text-slate-50">{site.name}</h2>
                  <span className="text-xs text-slate-400">{site.agency}</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {site.lat.toFixed(4)}°, {site.lon.toFixed(3)}°E · {site.elev_km_used.toFixed(3)} km
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-slate-400 max-w-4xl">{site.description}</p>
                {pending && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>Coordinates pending verification: {site.warnings.filter((w) => w.includes("slope") || w.includes("pending")).join(" · ")}</span>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-space-700 bg-space-900/80 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">360° horizon panorama</h3>
                  <span className="text-[11px] text-slate-500">
                    {site.horizon_source.startsWith("LOLA") ? "terrain ray-traced from LOLA DEM" : "ideal spherical horizon"} · dots = ±15 day track
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">centre</span>
                    <Seg value={center} onChange={setCenter} options={[["north", "N"], ["south", "S"], ["sun", "Sun"], ["earth", "Earth"]]} />
                  </div>
                </div>
                <Panorama site={site} tH={tH} center={center} height={audience === "explorer" ? 300 : 260} />
                {audience === "explorer" && (
                  <p className="mt-2 text-[12px] text-slate-400">
                    You are standing at the site looking all the way around. Grey is the real skyline from laser altimetry; the dashed line is where the horizon would be on a perfectly smooth Moon. The sky is black because the Moon has no air.
                  </p>
                )}
              </section>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <StatusCards site={site} tH={tH} audience={audience} panel={panel} />
                <div className="rounded-lg border border-space-700 bg-space-900/80 p-3">
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Sky dome <span className="text-[11px] font-normal text-slate-500">top-down, zenith centre</span></h3>
                  <SkyDome site={site} tH={tH} />
                </div>
              </div>

              <section className="rounded-lg border border-space-700 bg-space-900/80 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">Power & visibility timeline</h3>
                  <span className="text-[11px] text-slate-500">click to jump</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Seg value={panel} onChange={setPanel} options={[["horizontal", "Flat panel sin(el)"], ["vertical", "Vertical cos(el)"]]} />
                    <Seg value={windowDays} onChange={setWindowDays} options={[[30, "1 lunar day"], [90, "90 d"], [365, "1 yr"]]} />
                  </div>
                </div>
                <Timeline site={site} tH={tH} onSeek={setTH} windowDays={windowDays} panel={panel} />
                <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
                  <span><span className="inline-block w-3 h-0.5 bg-sun align-middle mr-1" />Sun elevation</span>
                  <span><span className="inline-block w-3 h-0.5 bg-earth align-middle mr-1" />Earth elevation</span>
                  <span><span className="inline-block w-3 border-t border-dashed border-slate-400 align-middle mr-1" />Terrain height at Sun azimuth</span>
                  <span><span className="inline-block w-3 h-2 bg-sun/20 align-middle mr-1" />Power efficiency (right axis)</span>
                </div>
              </section>

              {audience === "explorer" && <Explainer />}

              <SiteStats site={site} audience={audience} />

              {audience === "planner" && <Explainer />}
            </>
          )}

          <footer className="pt-2 pb-6 text-[10px] text-slate-600 flex items-center gap-1.5">
            <Satellite size={11} />
            Data generated {index?.generated_utc ?? "…"} · {index?.ephemeris_source} · horizon ray-trace {index?.trace_km} km, observer mast {index?.observer_mast_m} m · NASA Space Apps 2026
          </footer>
        </main>
      </div>
    </div>
  );
}

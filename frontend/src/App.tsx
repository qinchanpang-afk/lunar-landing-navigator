import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Columns2, Compass, ExternalLink, FileText, GraduationCap, Link as LinkIcon, Map as MapIcon, Satellite, Wrench } from "lucide-react";
import Logo from "./components/Logo";
import { MOON_TREK_URL, quickmapUrl } from "./lib/links";
import { openSiteReport } from "./lib/report";
import { registerSite, useIndex, useSite } from "./lib/data";
import { clearCustomSites, loadCustomSites, removeCustomSite } from "./lib/storage";
import type { Audience, SiteMeta } from "./lib/types";
import CustomSiteForm, { type SiteRequest } from "./components/CustomSiteForm";
import PoleMap from "./components/PoleMap";
import NowCard, { type StartAction } from "./components/NowCard";
import NearbyScan from "./components/NearbyScan";
import MissionPlanner from "./components/MissionPlanner";
import ValidationPanel from "./components/ValidationPanel";
import { buildUrl, customIdCoords, readUrl, type View } from "./lib/urlState";
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
const URL0 = readUrl();
// three.js is large: load the 3D view only when it is opened.
const Terrain3D = lazy(() => import("./components/Terrain3D"));

const SECTIONS: [string, string][] = [["sky", "Sky & 3D"], ["status", "Power & comms"], ["timeline", "Timeline"], ["plan", "Mission plan"], ["nearby", "Nearby scan"], ["stats", "Statistics"], ["validation", "Validation"]];
const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
const isCustomId = (id?: string) => !!id && id.startsWith("custom-");

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
  // Custom sites only become loadable after they are restored/recomputed, so start on a catalogue site.
  const [selectedId, setSelectedId] = useState(URL0.site && !isCustomId(URL0.site) ? URL0.site : "shackleton-rim");
  const [audience, setAudience] = useState<Audience>(URL0.aud ?? "planner");
  const [view, setView] = useState<View>(URL0.view ?? "single");
  const [tH, setTHRaw] = useState(() => clamp(((URL0.tMs ?? Date.now()) - T0_MS) / 3_600_000, 0, DEFAULT_SPAN_H));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(24);
  const [center, setCenter] = useState<CenterMode>("north");
  const [panel, setPanel] = useState<PanelMode>("horizontal");
  const [windowDays, setWindowDays] = useState(30);
  const [slots, setSlots] = useState<Slot[]>(URL0.slots ?? [
    { key: 1, id: "shackleton-rim", linked: true, tH: 0 },
    { key: 2, id: "malapert-massif", linked: true, tH: 0 },
    { key: 3, id: "apollo-11", linked: true, tH: 0 },
  ]);

  const [customSites, setCustomSites] = useState<SiteMeta[]>([]);
  const [siteRequest, setSiteRequest] = useState<SiteRequest | null>(null);
  // Phones: the site list folds away so the answer is visible first.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const requestSite = useCallback((lat: number, lon: number, name = "") => {
    setSiteRequest({ lat, lon, name, nonce: Date.now() });
    setSidebarOpen(true); // show the custom-site progress on phones
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const [copied, setCopied] = useState(false);
  const [skyView, setSkyView] = useState<"panorama" | "3d">("panorama");
  const [presetReq, setPresetReq] = useState<{ key: "terrain" | "slip"; nonce: number } | null>(null);
  const [nearbyReq, setNearbyReq] = useState<{ siteId: string; half: number; nonce: number } | null>(null);
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
      if (!live) return;
      list.forEach(({ detail }) => registerSite(detail));
      if (list.length) setCustomSites((cs) => [...cs.filter((c) => !list.some((l) => l.meta.id === c.id)), ...list.map((l) => l.meta)]);
      // A shared link to a custom site: open it if this browser has it, otherwise recompute it.
      if (isCustomId(URL0.site)) {
        if (list.some((l) => l.meta.id === URL0.site)) setSelectedId(URL0.site!);
        else {
          const c = customIdCoords(URL0.site!);
          if (c) requestSite(c[0], c[1], "Shared custom site");
        }
      }
    });
    return () => {
      live = false;
    };
  }, []);

  // Unknown catalogue id in a shared link -> fall back to the default site.
  useEffect(() => {
    if (index && !isCustomId(selectedId) && !index.sites.some((s) => s.id === selectedId)) setSelectedId("shackleton-rim");
  }, [index, selectedId]);

  const site = useSite(selectedId);

  // No time in the link: if the default site is dark right now, open at its next sunrise (+2 h)
  // so the first screen shows the Sun against the real skyline.
  const smartTime = useRef(!URL0.tMs);
  useEffect(() => {
    if (!smartTime.current || !site) return;
    smartTime.current = false;
    const s = bodyState(site.sun, site.horizon_mask_deg, tH, site.time.step_h);
    if (!s.visible && s.toRise != null) setTHRaw(clamp(tH + s.toRise + 2, 0, spanHours(site)));
  }, [site]); // eslint-disable-line react-hooks/exhaustive-deps

  const onStart = (a: StartAction) => {
    const nonce = Date.now();
    if (a === "terrain" || a === "slip") {
      setView("compare");
      setPresetReq({ key: a, nonce });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (a === "nearby") {
      setSelectedId("nobile-rim");
      setView("single");
      setNearbyReq({ siteId: "nobile-rim", half: 2000, nonce });
      setTimeout(() => goTo("nearby"), 400);
    } else {
      setSkyView("3d");
      setTimeout(() => goTo("sky"), 50);
    }
  };
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

  // Keep the address bar a shareable deep link (debounced; paused during playback).
  const shareUrl = buildUrl({ site: selectedId, tMs: T0_MS + tH * 3_600_000, view, aud: audience, slots });
  useEffect(() => {
    if (playing) return;
    const h = setTimeout(() => window.history.replaceState(null, "", shareUrl), 300);
    return () => clearTimeout(h);
  }, [shareUrl, playing]);
  const copyLink = async () => {
    window.history.replaceState(null, "", shareUrl);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };

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
            <Logo size={26} />
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-slate-50">
                AetherRidge <span className="hidden font-normal text-slate-400 min-[640px]:inline">· Sun & Earth Line-of-Sight Navigator for Lunar South Pole Landings</span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
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
                <Columns2 size={13} /> Compare <span className="font-mono text-[11px] opacity-70">{slots.length}</span>
              </button>
              <button type="button" onClick={() => setView("map")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${view === "map" ? "bg-sky-500/20 text-sky-200" : "bg-space-800 text-slate-400"}`}>
                <MapIcon size={13} /> Map
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
            <button
              type="button" onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-md border border-space-600 bg-space-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-space-700"
              title="Copy a link to exactly this site, time and view"
            >
              {copied ? <Check size={13} className="text-emerald-300" /> : <LinkIcon size={13} />}
              <span className="hidden min-[440px]:inline">{copied ? "Copied" : "Share"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-84px)] lg:overflow-y-auto pr-1">
          <button
            type="button" onClick={() => setSidebarOpen((o) => !o)} aria-expanded={sidebarOpen}
            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-space-600 bg-space-900 px-3 py-2 text-left text-[13px] text-slate-200 lg:hidden"
          >
            <span className="text-slate-400">Sites</span>
            <span className="min-w-0 flex-1 truncate font-medium">{allSites.find((s) => s.id === selectedId)?.name ?? "…"}</span>
            <span className="text-[12px] text-sky-300">{sidebarOpen ? "hide" : `all ${allSites.length}`}</span>
            <ChevronDown size={15} className={`text-slate-400 transition ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
          {index ? (
            <div className={`space-y-3 ${sidebarOpen ? "" : "hidden lg:block"}`}>
              <CustomSiteForm onAdded={addCustom} request={siteRequest} />
              <SiteList
                sites={allSites}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); setView("single"); setSidebarOpen(false); }}
                compareIds={slots.map((s) => s.id)}
                toggleCompare={toggleCompare}
                onRemove={removeCustom}
                onClearCustom={clearCustom}
              />
            </div>
          ) : (
            <div className="text-xs text-slate-400">Loading sites…</div>
          )}
        </aside>

        <main className="min-w-0 space-y-4">
          <TimeControls
            tH={tH} spanH={spanH} t0ms={t0ms} setTH={setTH}
            playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
            nextSunEvent={events?.sun ?? { label: "Next sunset", dt: null }}
            nextEarthEvent={events?.earth ?? { label: "Next Earthset", dt: null }}
          />

          {view === "map" && index ? (
            <PoleMap
              sites={allSites} selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setView("single"); }}
              onPickPoint={(lat, lon) => requestSite(lat, lon)}
            />
          ) : view === "compare" && index ? (
            <CompareView sites={allSites} slots={slots} setSlots={setSlots} tH={tH} setTH={setTH} t0ms={t0ms} spanH={spanH} presetRequest={presetReq} />
          ) : !site ? (
            <div className="h-64 grid place-items-center text-sm text-slate-400">Loading site data…</div>
          ) : (
            <>
              <section>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                  <h2 className="text-lg font-semibold text-slate-50">{site.name}</h2>
                  <span className="text-xs text-slate-400">{site.agency}</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {site.lat.toFixed(4)}°, {site.lon.toFixed(3)}°E · {site.elev_km_used.toFixed(3)} km
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    <a
                      href={quickmapUrl(site.lat, site.lon)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-space-600 bg-space-800 px-2 py-1 text-[12px] text-slate-200 hover:bg-space-700"
                      title="Open this exact spot in LROC QuickMap (NASA LRO imagery and data layers)"
                    >
                      <ExternalLink size={12} /> QuickMap
                    </a>
                    <a
                      href={MOON_TREK_URL} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-space-600 bg-space-800 px-2 py-1 text-[12px] text-slate-200 hover:bg-space-700"
                      title="Open NASA Moon Trek"
                    >
                      <ExternalLink size={12} /> Moon Trek
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const pano = skyView === "panorama" ? (document.querySelector("#sky canvas") as HTMLCanvasElement | null) : null;
                        let png: string | null = null;
                        try { png = pano ? pano.toDataURL("image/png") : null; } catch { png = null; }
                        openSiteReport(site, tH, t0ms, window.location.origin + shareUrl, png);
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[12px] font-medium text-emerald-100 hover:bg-emerald-500/25"
                      title="Printable one-page site report (use Save as PDF)"
                    >
                      <FileText size={12} /> Report / PDF
                    </button>
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

              <NowCard site={site} tH={tH} onStart={onStart} />

              <nav aria-label="Sections" className="z-10 flex gap-1 overflow-x-auto rounded-lg border border-space-700 bg-space-950/90 p-1 backdrop-blur lg:sticky lg:top-[59px]">
                {SECTIONS.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => goTo(id)} className="shrink-0 rounded-md px-2.5 py-1 text-[12px] text-slate-300 hover:bg-space-700 hover:text-slate-50">
                    {label}
                  </button>
                ))}
              </nav>

              <section id="sky" className="scroll-mt-28 rounded-lg border border-space-700 bg-space-900/80 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="flex overflow-hidden rounded-md border border-space-600 text-xs" role="tablist">
                    <button type="button" role="tab" aria-selected={skyView === "panorama"} onClick={() => setSkyView("panorama")} className={`px-2.5 py-1 font-medium ${skyView === "panorama" ? "bg-sky-500/20 text-sky-100" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}>
                      360° horizon panorama
                    </button>
                    <button
                      type="button" role="tab" aria-selected={skyView === "3d"} disabled={site.lat > -80}
                      onClick={() => setSkyView("3d")}
                      title={site.lat > -80 ? "3D terrain is available for sites inside the LOLA south-polar DEM (south of 80°S)" : "Real LOLA terrain in 3D with live Sun shadows"}
                      className={`px-2.5 py-1 font-medium disabled:opacity-40 ${skyView === "3d" ? "bg-sky-500/20 text-sky-100" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}
                    >
                      3D terrain
                    </button>
                  </div>
                  {skyView === "panorama" && (
                    <>
                      <span className="text-[11px] text-slate-400">
                        {site.horizon_source.startsWith("LOLA") ? "terrain ray-traced from LOLA DEM" : "ideal spherical horizon"} · dots = ±15 day track
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">centre</span>
                        <Seg value={center} onChange={setCenter} options={[["north", "N"], ["south", "S"], ["sun", "Sun"], ["earth", "Earth"]]} />
                      </div>
                    </>
                  )}
                </div>
                {skyView === "3d" && site.lat <= -80 ? (
                  <Suspense fallback={<div className="grid h-[360px] place-items-center text-xs text-slate-400">Loading 3D engine…</div>}>
                    <Terrain3D site={site} tH={tH} height={audience === "explorer" ? 420 : 380} />
                  </Suspense>
                ) : (
                  <Panorama site={site} tH={tH} center={center} height={audience === "explorer" ? 300 : 260} />
                )}
                {skyView === "panorama" && audience === "explorer" && (
                  <p className="mt-2 text-[12px] text-slate-400">
                    You are standing at the site looking all the way around. Grey is the real skyline from laser altimetry; the dashed line is where the horizon would be on a perfectly smooth Moon. The sky is black because the Moon has no air.
                  </p>
                )}
              </section>

              <div id="status" className="scroll-mt-28 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <StatusCards site={site} tH={tH} audience={audience} panel={panel} />
                <div className="rounded-lg border border-space-700 bg-space-900/80 p-3">
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Sky dome <span className="text-[11px] font-normal text-slate-400">top-down, zenith centre</span></h3>
                  <SkyDome site={site} tH={tH} />
                </div>
              </div>

              <section id="timeline" className="scroll-mt-28 rounded-lg border border-space-700 bg-space-900/80 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">Power & visibility timeline</h3>
                  <span className="text-[11px] text-slate-400">click to jump</span>
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

              <div id="plan" className="scroll-mt-28"><MissionPlanner site={site} tH={tH} t0ms={t0ms} setTH={setTH} /></div>

              <div id="nearby" className="scroll-mt-28">
                {site.lat <= -80 ? (
                  <NearbyScan site={site} onAddCustom={(lat, lon, name) => requestSite(lat, lon, name)} autoRun={nearbyReq} />
                ) : (
                  <p className="rounded-lg border border-space-700 bg-space-900/80 p-3 text-[12px] text-slate-400">
                    The nearby-spot scan needs real terrain: it works for sites inside the LOLA south-polar DEM (south of 80°S).
                  </p>
                )}
              </div>

              {audience === "explorer" && <Explainer />}

              <div id="stats" className="scroll-mt-28"><SiteStats site={site} audience={audience} /></div>

              {audience === "planner" && <Explainer />}

              <div id="validation" className="scroll-mt-28"><ValidationPanel /></div>
            </>
          )}

          <footer className="pt-2 pb-6 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Satellite size={11} />
            <span>
              Data generated {index?.generated_utc ?? "…"} · {index?.ephemeris_source} · horizon ray-trace {index?.trace_km} km, observer mast {index?.observer_mast_m} m · NASA Space Apps 2026 · Team Akasha Solo ·
              Code written with AI assistance (Claude, Anthropic); all data from NASA LOLA & JPL Horizons —{" "}
              <a href="https://github.com/qinchanpang-afk/lunar-landing-navigator#use-of-super-intelligence-si--ai-disclosure" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">disclosure & references</a>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link2, Link2Off, Loader2, Sparkles, X } from "lucide-react";
import type { SiteDetail, SiteMeta } from "../lib/types";
import { loadSite, useSite } from "../lib/data";
import { bodyState, fmtDeg, fmtDuration, fmtUTC, fromInputValue, toInputValue } from "../lib/time";
import Panorama from "./Panorama";

export interface Slot {
  key: number;
  id: string;
  linked: boolean;
  /** own time (hours since start) when not linked */
  tH: number;
  /** when linked: fixed shift from the main timeline in hours (e.g. +336 h = 14-day launch slip) */
  offsetH?: number;
}

interface Props {
  sites: SiteMeta[];
  slots: Slot[];
  setSlots: (s: Slot[]) => void;
  tH: number;
  setTH: (t: number) => void;
  t0ms: number;
  spanH: number;
}

const OFFSETS: [number, string][] = [[0, "±0"], [168, "+7 d"], [336, "+14 d"], [708.73, "+1 lunar day"], [-336, "−14 d"]];

function SlotCard({ slot, sites, update, remove, tMain, t0ms, spanH }: {
  slot: Slot; sites: SiteMeta[]; update: (s: Partial<Slot>) => void; remove: () => void; tMain: number; t0ms: number; spanH: number;
}) {
  const site = useSite(slot.id);
  const t = slot.linked ? Math.min(spanH, Math.max(0, tMain + (slot.offsetH ?? 0))) : slot.tH;
  const st = site ? site.stats : null;
  const sun = site ? bodyState(site.sun, site.horizon_mask_deg, t, site.time.step_h) : null;
  const earth = site ? bodyState(site.earth, site.horizon_mask_deg, t, site.time.step_h) : null;
  return (
    <div className="rounded-lg border border-space-700 bg-space-900/80 p-3 min-w-0">
      <div className="flex items-center gap-2">
        <select
          value={slot.id}
          onChange={(e) => update({ id: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-space-600 bg-space-800 px-2 py-1 text-xs text-slate-200"
        >
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={remove} className="rounded p-1 text-slate-500 hover:bg-space-700 hover:text-slate-300" aria-label="Remove slot">
          <X size={14} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => update({ linked: !slot.linked, tH: t })}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-1 ${slot.linked ? "bg-sky-500/15 text-sky-200" : "bg-violet-500/15 text-violet-200"}`}
          title={slot.linked ? "Time linked to main timeline - click to set an independent date" : "Independent date - click to re-link"}
        >
          {slot.linked ? <Link2 size={12} /> : <Link2Off size={12} />}
          {slot.linked ? "linked" : "own date"}
        </button>
        {slot.linked ? (
          <>
            <select
              value={slot.offsetH ?? 0}
              onChange={(e) => update({ offsetH: Number(e.target.value) })}
              className={`rounded border border-space-600 bg-space-800 px-1 py-0.5 font-mono text-[11px] ${slot.offsetH ? "text-amber-200" : "text-slate-300"}`}
              title="Shift relative to the main timeline (e.g. a launch delay)"
            >
              {OFFSETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="font-mono text-[11px] text-slate-400">{fmtUTC(t0ms + t * 3_600_000)}</span>
          </>
        ) : (
          <input
            type="datetime-local"
            value={toInputValue(t0ms + slot.tH * 3_600_000)}
            onChange={(e) => {
              const v = fromInputValue(e.target.value);
              if (!isNaN(v)) update({ tH: Math.min(spanH, Math.max(0, (v - t0ms) / 3_600_000)) });
            }}
            className="rounded border border-space-600 bg-space-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-200 [color-scheme:dark]"
          />
        )}
      </div>
      {site && sun && earth && st ? (
        <>
          <div className="mt-2">
            <Panorama site={site} tH={t} compact height={130} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-400">Sun</span>
            <span className={`font-mono text-right ${sun.visible ? "text-sun" : "text-slate-500"}`}>{fmtDeg(sun.el)} {sun.visible ? "lit" : "dark"}</span>
            <span className="text-slate-400">{sun.visible ? "Sunset in" : "Sunrise in"}</span>
            <span className="font-mono text-right text-slate-200">
              {(sun.visible ? sun.toSet : sun.toRise) == null ? (sun.visible ? "none in data" : "never") : fmtDuration(sun.visible ? sun.toSet : sun.toRise)}
            </span>
            <span className="text-slate-400">Earth</span>
            <span className={`font-mono text-right ${earth.visible ? "text-earth" : "text-slate-500"}`}>{fmtDeg(earth.el)} {earth.visible ? "link" : "no link"}</span>
            <span className="text-slate-400">{earth.visible ? "Earthset in" : "Earthrise in"}</span>
            <span className="font-mono text-right text-slate-200">
              {(earth.visible ? earth.toSet : earth.toRise) == null ? (earth.visible ? "none in data" : "never") : fmtDuration(earth.visible ? earth.toSet : earth.toRise)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-space-800 grid grid-cols-3 gap-1 text-center">
            {[
              ["Sunlight", `${st.sunlight_pct.toFixed(1)}%`, "text-sun"],
              ["DTE", `${st.dte_pct.toFixed(1)}%`, "text-earth"],
              ["Max shadow", fmtDuration(st.max_continuous_shadow_h), "text-slate-200"],
            ].map(([k, v, c]) => (
              <div key={k}>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
                <div className={`font-mono text-sm ${c}`}>{v}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-48 grid place-items-center text-xs text-slate-500">Loading…</div>
      )}
    </div>
  );
}

const DELAY_H = 14 * 24;

/**
 * First 2-hourly step at/after `fromH` (wrapping round the dataset) where the site is sunlit with
 * >= 24 h of light left, but is in shadow DELAY_H later - the moment that best shows a launch-slip penalty.
 */
function findSlipMoment(site: SiteDetail, fromH: number): number | null {
  const step = site.time.step_h;
  const n = site.time.n;
  const lag = Math.round(DELAY_H / step);
  const start = Math.max(0, Math.round(fromH / step));
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (i + lag >= n) continue;
    const tSet = site.sun.t_set[i];
    if (site.sun.vis[i] && !site.sun.vis[i + lag] && tSet != null && tSet >= 24) return i * step;
  }
  return null;
}

type PresetKey = "terrain" | "slip";

const PRESETS: { key: PresetKey; title: string; insight: string }[] = [
  {
    key: "terrain",
    title: "Terrain Impact: Shackleton Rim (88% Sun) vs. Crater Floor (0% Sun)",
    insight:
      "Same Sun, same instant, about 13 km apart: the rim (left) is lit 88% of 2026–2027, while the crater floor (right) is a permanently shadowed cold trap that never sees the Sun.",
  },
  {
    key: "slip",
    title: "Launch Delay Impact: Nobile Rim vs. +14 Days Shift",
    insight:
      "Same landing site, launch slipped 14 days. The timeline jumps to a moment when the on-time lander is sunlit but the delayed one sits in terrain shadow. In 14 days the Sun moves to roughly the opposite side of the sky, where different terrain decides power and comms. Scrub or play to watch the two windows drift.",
  },
];

export default function CompareView({ sites, slots, setSlots, tH, setTH, t0ms, spanH }: Props) {
  const [active, setActive] = useState<PresetKey | null>(null);
  const [busy, setBusy] = useState(false);
  const has = (id: string) => sites.some((s) => s.id === id);

  const add = () => {
    const used = new Set(slots.map((s) => s.id));
    const next = sites.find((s) => !used.has(s.id)) ?? sites[0];
    setSlots([...slots, { key: Date.now(), id: next.id, linked: true, tH }]);
  };

  const applyPreset = async (key: PresetKey) => {
    const k = Date.now();
    setActive(key);
    if (key === "terrain") {
      setSlots([
        { key: k, id: "shackleton-rim", linked: true, tH },
        { key: k + 1, id: "shackleton-floor", linked: true, tH },
      ]);
      return;
    }
    setSlots([
      { key: k, id: "nobile-rim", linked: true, tH, offsetH: 0 },
      { key: k + 1, id: "nobile-rim", linked: true, tH, offsetH: DELAY_H },
    ]);
    setBusy(true);
    try {
      const t = findSlipMoment(await loadSite("nobile-rim"), tH);
      if (t != null) setTH(t);
    } finally {
      setBusy(false);
    }
  };

  const activePreset = PRESETS.find((p) => p.key === active);

  return (
    <div>
      <div className="mb-3 rounded-lg border border-violet-400/25 bg-violet-500/5 p-3">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-violet-200">
          <Sparkles size={13} /> Quick demo scenarios
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key} type="button"
              onClick={() => applyPreset(p.key)}
              disabled={busy || (p.key === "terrain" ? !has("shackleton-rim") || !has("shackleton-floor") : !has("nobile-rim"))}
              className={`rounded-md border px-3 py-1.5 text-left text-xs transition disabled:opacity-40
                ${active === p.key ? "border-violet-300/60 bg-violet-500/20 text-violet-100" : "border-space-600 bg-space-800 text-slate-200 hover:border-violet-300/40 hover:bg-space-700"}`}
            >
              {busy && active === p.key && <Loader2 size={12} className="mr-1 inline animate-spin" />}
              {p.title}
            </button>
          ))}
        </div>
        {activePreset && <p className="mt-2 text-[12px] leading-relaxed text-slate-300">{activePreset.insight}</p>}
      </div>
    <div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {slots.map((slot, i) => (
          <SlotCard
            key={slot.key} slot={slot} sites={sites} tMain={tH} t0ms={t0ms} spanH={spanH}
            update={(u) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...u } : s)))}
            remove={() => setSlots(slots.filter((_, j) => j !== i))}
          />
        ))}
        {slots.length < 4 && (
          <button
            type="button" onClick={add}
            className="min-h-48 rounded-lg border border-dashed border-space-600 text-sm text-slate-400 hover:border-sky-400/50 hover:text-sky-200"
          >
            + Add site / date
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Each slot can follow the main timeline (optionally shifted, e.g. a launch delay) or use its own date — compare different sites at the same moment, or the same site across seasons.
      </p>
    </div>
    </div>
  );
}

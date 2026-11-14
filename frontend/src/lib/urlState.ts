/**
 * Shareable deep links: ?site=<id>&t=<ISO UTC>&view=site|compare|map&aud=explorer&cmp=<slot>,<slot>
 * A compare slot is "<id>" (linked), "<id>~o<hours>" (linked with an offset, e.g. a launch slip) or
 * "<id>~t<hours>" (own date). Custom sites are recoverable from their id: custom-<lat>_<lon>.
 */
import type { Slot } from "../components/CompareView";
import type { Audience } from "./types";

export type View = "single" | "compare" | "map";

export interface UrlState {
  site?: string;
  tMs?: number;
  view?: View;
  aud?: Audience;
  slots?: Slot[];
}

export function readUrl(): UrlState {
  const q = new URLSearchParams(window.location.search);
  const out: UrlState = {};
  const site = q.get("site");
  if (site) out.site = site;
  const t = q.get("t");
  if (t) {
    const ms = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);
    if (!isNaN(ms)) out.tMs = ms;
  }
  const v = q.get("view");
  if (v === "compare" || v === "map" || v === "single") out.view = v;
  if (q.get("aud") === "explorer") out.aud = "explorer";
  const cmp = q.get("cmp");
  if (cmp) {
    out.slots = cmp.split(",").filter(Boolean).slice(0, 4).map((tok, k) => {
      const [id, mod] = tok.split("~");
      const num = mod ? Number(mod.slice(1)) : NaN;
      if (mod?.startsWith("t") && isFinite(num)) return { key: k + 1, id, linked: false, tH: num };
      return { key: k + 1, id, linked: true, tH: 0, offsetH: mod?.startsWith("o") && isFinite(num) ? num : 0 };
    });
  }
  return out;
}

export function buildUrl(s: { site: string; tMs: number; view: View; aud: Audience; slots: Slot[] }): string {
  const q = new URLSearchParams();
  q.set("site", s.site);
  q.set("t", new Date(Math.round(s.tMs / 60000) * 60000).toISOString().slice(0, 16) + "Z");
  if (s.view !== "single") q.set("view", s.view);
  if (s.aud !== "planner") q.set("aud", s.aud);
  if (s.view === "compare" && s.slots.length) {
    q.set("cmp", s.slots.map((sl) => (sl.linked ? (sl.offsetH ? `${sl.id}~o${sl.offsetH}` : sl.id) : `${sl.id}~t${Math.round(sl.tH * 100) / 100}`)).join(","));
  }
  return `${window.location.pathname}?${q.toString()}`;
}

/** custom-<lat>_<lon> -> [lat, lon] */
export function customIdCoords(id: string): [number, number] | null {
  const m = /^custom-(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$/.exec(id);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

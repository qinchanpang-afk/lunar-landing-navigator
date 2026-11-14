import { useEffect, useState } from "react";
import type { SiteDetail, SitesIndex } from "./types";

const BASE = `${import.meta.env.BASE_URL}data/`;
const detailCache = new Map<string, Promise<SiteDetail>>();

/** Make a browser-computed custom site loadable through the same loadSite/useSite path. */
export function registerSite(detail: SiteDetail) {
  detailCache.set(detail.id, Promise.resolve(detail));
}

export async function loadIndex(): Promise<SitesIndex> {
  const r = await fetch(`${BASE}sites_index.json`);
  if (!r.ok) throw new Error(`sites_index.json: HTTP ${r.status}`);
  return r.json();
}

export function loadSite(id: string): Promise<SiteDetail> {
  let p = detailCache.get(id);
  if (!p) {
    p = fetch(`${BASE}${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`${id}.json: HTTP ${r.status}`);
      return r.json() as Promise<SiteDetail>;
    });
    p.catch(() => detailCache.delete(id));
    detailCache.set(id, p);
  }
  return p;
}

export function useIndex() {
  const [index, setIndex] = useState<SitesIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadIndex().then(setIndex, (e) => setError(String(e)));
  }, []);
  return { index, error };
}

export function useSite(id: string | null) {
  const [site, setSite] = useState<SiteDetail | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    loadSite(id).then((d) => live && setSite(d));
    return () => {
      live = false;
    };
  }, [id]);
  return site && site.id === id ? site : null;
}

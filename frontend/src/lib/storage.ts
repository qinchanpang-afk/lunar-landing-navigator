/**
 * localStorage persistence for browser-computed custom sites. Each site's full time series is
 * gzip-compressed + base64 (~0.6 MB JSON -> ~150 kB) so several sites fit in the ~5 MB quota.
 * Every access is guarded: private windows / blocked storage simply fall back to session-only sites.
 */
import type { SiteDetail, SiteMeta } from "./types";

const PREFIX = "lsn.custom.v1.";
const INDEX_KEY = `${PREFIX}index`;

function readIndex(): SiteMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SiteMeta[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(metas: SiteMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
}

async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gunzipBase64(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** Returns true when stored, false when the browser refused (quota, private mode, …). */
export async function saveCustomSite(detail: SiteDetail, meta: SiteMeta): Promise<boolean> {
  try {
    const packed = await gzipBase64(JSON.stringify(detail));
    localStorage.setItem(PREFIX + detail.id, packed);
    writeIndex([...readIndex().filter((m) => m.id !== meta.id), meta]);
    return true;
  } catch {
    try {
      localStorage.removeItem(PREFIX + detail.id);
    } catch {
      /* ignore */
    }
    return false;
  }
}

export async function loadCustomSites(): Promise<{ detail: SiteDetail; meta: SiteMeta }[]> {
  const out: { detail: SiteDetail; meta: SiteMeta }[] = [];
  for (const meta of readIndex()) {
    try {
      const packed = localStorage.getItem(PREFIX + meta.id);
      if (!packed) continue;
      out.push({ detail: JSON.parse(await gunzipBase64(packed)) as SiteDetail, meta });
    } catch {
      /* corrupt entry: skip */
    }
  }
  return out;
}

export function removeCustomSite(id: string) {
  try {
    localStorage.removeItem(PREFIX + id);
    writeIndex(readIndex().filter((m) => m.id !== id));
  } catch {
    /* ignore */
  }
}

export function clearCustomSites() {
  try {
    for (const m of readIndex()) localStorage.removeItem(PREFIX + m.id);
    localStorage.removeItem(INDEX_KEY);
  } catch {
    /* ignore */
  }
}

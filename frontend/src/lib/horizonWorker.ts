/// <reference lib="webworker" />
/** Runs the unchanged browser horizon ray-tracer (dem.ts) off the main thread, one point per message. */
import { computeHorizon } from "./dem";

export interface HorizonJob { id: number; lat: number; lon: number }
export interface HorizonReply { id: number; mask?: number[]; groundM?: number; slopeDeg?: number; error?: string }

self.onmessage = async (e: MessageEvent<HorizonJob>) => {
  const { id, lat, lon } = e.data;
  try {
    const h = await computeHorizon(lat, lon);
    (self as unknown as Worker).postMessage({ id, mask: h.mask, groundM: h.groundM, slopeDeg: h.slopeDeg } satisfies HorizonReply);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies HorizonReply);
  }
};

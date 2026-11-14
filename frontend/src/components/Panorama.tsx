import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteDetail } from "../lib/types";
import { bodyState, clamp, compass, maskAt, SYNODIC_MONTH_H } from "../lib/time";

export type CenterMode = "north" | "south" | "sun" | "earth";

interface Props {
  site: SiteDetail;
  tH: number;
  center?: CenterMode;
  height?: number;
  compact?: boolean;
  /** half-width of the plotted Sun/Earth trajectories, hours */
  trailH?: number;
}

const SUN = "#ffc23d";
const EARTH = "#4fa8ff";

export function useElevRange(site: SiteDetail) {
  return useMemo(() => {
    const m = site.horizon_mask_deg;
    let lo = Math.min(...m);
    let hi = Math.max(...m);
    for (const s of [site.sun.el, site.earth.el]) {
      for (const v of s) {
        if (v > hi) hi = v;
        if (v < lo && v > -12) lo = v;
      }
    }
    const yMin = clamp(Math.floor(lo - 1), -12, -2);
    const yMax = Math.max(6, Math.ceil(hi + 2));
    return { yMin, yMax };
  }, [site]);
}

function niceStep(range: number) {
  for (const s of [1, 2, 5, 10, 15, 30]) if (range / s <= 8) return s;
  return 30;
}

export default function Panorama({ site, tH, center = "north", height = 260, compact = false, trailH = SYNODIC_MONTH_H / 2 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const { yMin, yMax } = useElevRange(site);
  const step = site.time.step_h;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sun = bodyState(site.sun, site.horizon_mask_deg, tH, step);
  const earth = bodyState(site.earth, site.horizon_mask_deg, tH, step);
  const centerAz = center === "north" ? 0 : center === "south" ? 180 : center === "sun" ? sun.az : earth.az;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padL = compact ? 26 : 40;
    const padR = 8;
    const padT = compact ? 6 : 10;
    const padB = compact ? 16 : 24;
    const pw = width - padL - padR;
    const ph = height - padT - padB;
    const xOf = (az: number) => padL + ((((az - centerAz + 180) % 360) + 360) % 360) / 360 * pw;
    const azOf = (x: number) => (((x - padL) / pw) * 360 + centerAz - 180 + 720) % 360;
    const yOf = (el: number) => padT + ((yMax - el) / (yMax - yMin)) * ph;

    // Airless black sky
    ctx.fillStyle = "#03050a";
    ctx.fillRect(0, 0, width, height);

    // Grid
    const ys = niceStep(yMax - yMin);
    ctx.font = `${compact ? 9 : 11}px JetBrains Mono, monospace`;
    ctx.textBaseline = "middle";
    for (let e = Math.ceil(yMin / ys) * ys; e <= yMax; e += ys) {
      const y = yOf(e);
      ctx.strokeStyle = e === 0 ? "rgba(148,163,184,0.55)" : "rgba(148,163,184,0.12)";
      ctx.setLineDash(e === 0 ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pw, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(148,163,184,0.75)";
      ctx.textAlign = "right";
      ctx.fillText(`${e}°`, padL - 4, y);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const narrow = compact || pw < 560;
    for (let a = 0; a < 360; a += 45) {
      const x = xOf(a);
      ctx.strokeStyle = "rgba(148,163,184,0.10)";
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + ph);
      ctx.stroke();
      if (narrow && a % 90 !== 0) continue;
      ctx.fillStyle = a % 90 === 0 ? "rgba(226,232,240,0.9)" : "rgba(148,163,184,0.7)";
      ctx.fillText(narrow ? compass(a) : `${compass(a)} ${a}°`, x, padT + ph + 4);
    }

    // Trajectories (±trailH around now), drawn before terrain so terrain occludes them
    const i0 = Math.max(0, Math.floor((tH - trailH) / step));
    const i1 = Math.min(site.time.n - 1, Math.ceil((tH + trailH) / step));
    const drawTrail = (az: number[], el: number[], color: string) => {
      for (let i = i0; i <= i1; i++) {
        const y = yOf(el[i]);
        if (y < padT || y > padT + ph) continue;
        const past = i * step < tH;
        ctx.fillStyle = color;
        ctx.globalAlpha = past ? 0.25 : 0.6;
        ctx.fillRect(xOf(az[i]) - 1, y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    };
    drawTrail(site.sun.az, site.sun.el, SUN);
    drawTrail(site.earth.az, site.earth.el, EARTH);

    // Terrain silhouette from the LOLA horizon mask
    const grad = ctx.createLinearGradient(0, yOf(yMax), 0, padT + ph);
    grad.addColorStop(0, "#4b5160");
    grad.addColorStop(1, "#1a1d24");
    ctx.beginPath();
    ctx.moveTo(padL, padT + ph);
    for (let x = 0; x <= pw; x++) {
      const az = azOf(padL + x);
      ctx.lineTo(padL + x, clamp(yOf(maskAt(site.horizon_mask_deg, az)), padT, padT + ph));
    }
    ctx.lineTo(padL + pw, padT + ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#a3a9b8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x <= pw; x++) {
      const y = clamp(yOf(maskAt(site.horizon_mask_deg, azOf(padL + x))), padT, padT + ph);
      if (x === 0) ctx.moveTo(padL + x, y);
      else ctx.lineTo(padL + x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    // Bodies
    const pxPerDeg = ph / (yMax - yMin);
    const drawBody = (b: typeof sun, color: string, angRadiusDeg: number, label: string) => {
      const x = xOf(b.az);
      const y = yOf(b.el);
      const r = Math.max(compact ? 4 : 6, angRadiusDeg * pxPerDeg);
      if (y > padT + ph + r) {
        // below plotted range: arrow at bottom edge
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, padT + ph - 2);
        ctx.lineTo(x - 6, padT + ph - 12);
        ctx.lineTo(x + 6, padT + ph - 12);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        if (!compact) {
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${label} ${b.el.toFixed(1)}°`, x, padT + ph - 14);
        }
        return;
      }
      ctx.save();
      if (b.visible) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.setLineDash([3, 2]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (!compact) {
        const text = b.visible ? label : `${label} (occluded)`;
        const half = ctx.measureText(text).width / 2;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(text, clamp(x, padL + half + 2, padL + pw - half - 2), Math.max(padT + 12, y - r - 3));
      }
    };
    drawBody(earth, EARTH, 0.95, "Earth");
    drawBody(sun, SUN, 0.267, "Sun");

    // Hover readout
    if (hoverX != null && !compact && hoverX >= padL && hoverX <= padL + pw) {
      const az = azOf(hoverX);
      const m = maskAt(site.horizon_mask_deg, az);
      const dist = site.horizon_mask_dist_km[Math.round(az) % 360];
      ctx.strokeStyle = "rgba(226,232,240,0.5)";
      ctx.beginPath();
      ctx.moveTo(hoverX, padT);
      ctx.lineTo(hoverX, padT + ph);
      ctx.stroke();
      const text = `Az ${az.toFixed(1)}°  horizon ${m.toFixed(2)}°${dist ? `  @ ${dist.toFixed(1)} km` : ""}`;
      ctx.font = "11px JetBrains Mono, monospace";
      const tw = ctx.measureText(text).width + 12;
      const bx = clamp(hoverX + 8, padL, padL + pw - tw);
      ctx.fillStyle = "rgba(10,14,24,0.9)";
      ctx.fillRect(bx, padT + 4, tw, 20);
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx + 6, padT + 14);
    }
  }, [site, tH, width, height, compact, centerAz, yMin, yMax, hoverX, trailH, step, sun, earth]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height }}
        className="block rounded-md"
        role="img"
        aria-label={`360 degree horizon panorama for ${site.name}`}
        onMouseMove={(e) => !compact && setHoverX(e.nativeEvent.offsetX)}
        onMouseLeave={() => setHoverX(null)}
      />
    </div>
  );
}

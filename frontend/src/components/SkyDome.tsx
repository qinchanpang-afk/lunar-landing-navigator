import { useMemo } from "react";
import type { SiteDetail } from "../lib/types";
import { bodyState, SYNODIC_MONTH_H } from "../lib/time";

interface Props {
  site: SiteDetail;
  tH: number;
  size?: number;
}

const EL_MIN = -10;

/** Top-down sky map: zenith at centre, outer ring = -10°, north up, east right. */
export default function SkyDome({ site, tH, size = 280 }: Props) {
  const R = size / 2 - 18;
  const c = size / 2;
  const rOf = (el: number) => (R * (90 - Math.max(el, EL_MIN))) / (90 - EL_MIN);
  const pt = (az: number, el: number) => {
    const a = (az * Math.PI) / 180;
    const r = rOf(el);
    return [c + r * Math.sin(a), c - r * Math.cos(a)] as const;
  };
  const step = site.time.step_h;

  const terrainPath = useMemo(() => {
    const outer: string[] = [];
    const inner: string[] = [];
    for (let a = 0; a <= 360; a++) {
      const [ox, oy] = pt(a, EL_MIN);
      outer.push(`${ox.toFixed(1)},${oy.toFixed(1)}`);
      const [ix, iy] = pt(a, site.horizon_mask_deg[a % 360]);
      inner.push(`${ix.toFixed(1)},${iy.toFixed(1)}`);
    }
    return `M${outer.join("L")}Z M${inner.reverse().join("L")}Z`;
  }, [site, size]); // pt depends only on size

  const trail = (az: number[], el: number[]) => {
    const i0 = Math.max(0, Math.floor((tH - SYNODIC_MONTH_H / 2) / step));
    const i1 = Math.min(site.time.n - 1, Math.ceil((tH + SYNODIC_MONTH_H / 2) / step));
    const pts: string[] = [];
    for (let i = i0; i <= i1; i += 1) {
      if (el[i] < EL_MIN) continue;
      const [x, y] = pt(az[i], el[i]);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts;
  };

  const sun = bodyState(site.sun, site.horizon_mask_deg, tH, step);
  const earth = bodyState(site.earth, site.horizon_mask_deg, tH, step);
  const [sx, sy] = pt(sun.az, sun.el);
  const [ex, ey] = pt(earth.az, earth.el);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px] mx-auto" role="img" aria-label="Sky dome">
      <circle cx={c} cy={c} r={R} fill="#03050a" stroke="#2a3550" />
      {[60, 30, 0].map((e) => (
        <circle key={e} cx={c} cy={c} r={rOf(e)} fill="none" stroke={e === 0 ? "#64748b" : "#1c2538"} strokeDasharray={e === 0 ? "4 3" : undefined} />
      ))}
      <path d={terrainPath} fill="#3a3f4b" fillRule="evenodd" opacity={0.9} />
      {trail(site.sun.az, site.sun.el).map((p, i) => {
        const [x, y] = p.split(",");
        return <circle key={`s${i}`} cx={x} cy={y} r={1} fill="#ffc23d" opacity={0.35} />;
      })}
      {trail(site.earth.az, site.earth.el).map((p, i) => {
        const [x, y] = p.split(",");
        return <circle key={`e${i}`} cx={x} cy={y} r={1} fill="#4fa8ff" opacity={0.45} />;
      })}
      {earth.el >= EL_MIN && (
        <circle cx={ex} cy={ey} r={6} fill={earth.visible ? "#4fa8ff" : "none"} stroke="#4fa8ff" strokeDasharray={earth.visible ? undefined : "2 2"} />
      )}
      {sun.el >= EL_MIN && (
        <circle cx={sx} cy={sy} r={6} fill={sun.visible ? "#ffc23d" : "none"} stroke="#ffc23d" strokeDasharray={sun.visible ? undefined : "2 2"} />
      )}
      {[["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, a]) => {
        const rad = ((a as number) * Math.PI) / 180;
        const x = c + (R + 10) * Math.sin(rad);
        const y = c - (R + 10) * Math.cos(rad);
        return (
          <text key={l} x={x} y={y} fill="#cbd5e1" fontSize={11} textAnchor="middle" dominantBaseline="middle" fontFamily="JetBrains Mono">
            {l}
          </text>
        );
      })}
      <text x={c} y={c} fill="#475569" fontSize={9} textAnchor="middle" dominantBaseline="middle">zenith</text>
    </svg>
  );
}

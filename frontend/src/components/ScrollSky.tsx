/** Scroll-scrubbed explainer: the user's scrolling moves the Sun along a low polar arc above a jagged lunar skyline.
 * Whenever the Sun drops behind the ridge, power switches off: the core idea of AetherRidge in one gesture. */
import { useScrollProgress } from "./homeFx";

const RIDGE: [number, number][] = [
  [0, 330], [70, 300], [140, 252], [205, 292], [285, 205], [355, 262], [425, 236], [500, 302], [565, 246],
  [640, 168], [705, 232], [775, 284], [845, 214], [915, 262], [1000, 236],
];
const ridgeY = (x: number) => {
  for (let i = 1; i < RIDGE.length; i++) {
    const [x0, y0] = RIDGE[i - 1], [x1, y1] = RIDGE[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return RIDGE[RIDGE.length - 1][1];
};
const RIDGE_PATH = `M${RIDGE.map(([x, y]) => `${x},${y}`).join(" L")} L1000,420 L0,420 Z`;
const SUN_R = 18;

export default function ScrollSky() {
  const [ref, p] = useScrollProgress<HTMLElement>(true);
  const sx = 40 + p * 920;
  const sy = 286 - 96 * Math.sin(p * Math.PI);
  const margin = ridgeY(sx) - sy; // > 0: Sun centre above the skyline
  const lit = margin > SUN_R * 0.2;
  const ex = 175 + 14 * Math.sin(p * Math.PI * 2);
  const ey = 140 + 9 * Math.cos(p * Math.PI * 2);
  const day = Math.round(p * 29.5 * 10) / 10;
  const arc = Array.from({ length: 61 }, (_, i) => {
    const q = i / 60;
    return `${40 + q * 920},${286 - 96 * Math.sin(q * Math.PI)}`;
  }).join(" ");

  return (
    <section ref={ref} className="relative h-[230vh]" aria-label="Scroll to move the Sun above a lunar skyline">
      <div className="sticky top-[57px] flex h-[calc(100vh-57px)] flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sun">Scroll to move the Sun</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">At the pole, the Sun never climbs. The skyline decides.</h2>
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-space-700">
            <svg viewBox="0 0 1000 420" className="block w-full" role="img" aria-label={`Sun ${lit ? "above" : "behind"} the ridge: power ${lit ? "on" : "off"}`}>
              <defs>
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={lit ? "#0d1733" : "#05070d"} />
                  <stop offset="1" stopColor={lit ? "#1d2a4a" : "#0a0e18"} />
                </linearGradient>
                <linearGradient id="rock" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#3b4252" />
                  <stop offset={Math.min(1, Math.max(0, sx / 1000))} stopColor={lit ? "#8f96a6" : "#2b3140"} />
                  <stop offset="1" stopColor="#262b36" />
                </linearGradient>
                <radialGradient id="glow">
                  <stop offset="0" stopColor="#ffd56a" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#ffd56a" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="1000" height="420" fill="url(#sky)" style={{ transition: "fill 400ms" }} />
              <polyline points={arc} fill="none" stroke="#ffc23d" strokeOpacity="0.25" strokeDasharray="4 7" strokeWidth="2" />
              <circle cx={ex} cy={ey} r="11" fill="#4fa8ff" />
              <circle cx={ex} cy={ey} r="11" fill="none" stroke="#9fd0ff" strokeOpacity="0.5" />
              <text x={ex + 18} y={ey + 4} fill="#9fd0ff" fontSize="15" fontFamily="Inter, sans-serif">Earth</text>
              <circle cx={sx} cy={sy} r="70" fill="url(#glow)" opacity={lit ? 1 : 0.25} />
              <circle cx={sx} cy={sy} r={SUN_R} fill="#ffc23d" />
              <path d={RIDGE_PATH} fill="url(#rock)" />
              <path d={`M${RIDGE.map(([x, y]) => `${x},${y}`).join(" L")}`} fill="none" stroke="#cbd5e1" strokeOpacity="0.55" strokeWidth="2" />
              <g transform={`translate(${500},${ridgeY(500)})`}>
                <rect x="-9" y="-16" width="18" height="12" rx="2" fill="#e2e8f0" />
                <line x1="0" y1="-16" x2="0" y2="-34" stroke="#e2e8f0" strokeWidth="2" />
                <rect x="-16" y="-38" width="32" height="5" fill={lit ? "#ffc23d" : "#475569"} />
              </g>
            </svg>
            <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs font-semibold sm:left-4 sm:top-4 sm:text-sm">
              <span className={`rounded-full px-3 py-1 transition-colors ${lit ? "bg-sun text-space-950" : "bg-slate-700 text-slate-300"}`}>{lit ? "☀ POWER ON" : "☾ POWER OFF"}</span>
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-200">Earth link ON</span>
            </div>
            <div className="absolute bottom-3 right-3 rounded-md bg-space-950/70 px-2.5 py-1 font-mono text-xs text-slate-300 sm:bottom-4 sm:right-4">day {day.toFixed(1)} / 29.5</div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Illustration. In the app the same test runs on the real 360° skyline from NASA LOLA terrain, with the Sun and Earth placed by NASA JPL Horizons, every 2 hours for two years.
          </p>
        </div>
      </div>
    </section>
  );
}

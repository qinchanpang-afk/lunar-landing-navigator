import { ArrowRight, Box, CalendarClock, Crosshair, Github, Map as MapIcon, Mountain, Radio, ShieldCheck, Sun } from "lucide-react";
import Logo from "./Logo";

const APP = "/app";
const DEMO_RIM_FLOOR = "/app?site=shackleton-rim&view=compare&cmp=shackleton-rim,shackleton-floor";
const DEMO_SLIP = "/app?site=nobile-rim&view=compare&cmp=nobile-rim,nobile-rim~o336";
const REPO = "https://github.com/qinchanpang-afk/lunar-landing-navigator";

function Stat({ big, unit, label, tone }: { big: string; unit?: string; label: string; tone: "sun" | "earth" | "ok" }) {
  const color = tone === "sun" ? "text-sun" : tone === "earth" ? "text-sky-300" : "text-emerald-300";
  return (
    <div className="rounded-xl border border-space-700 bg-space-900/70 p-5">
      <p className={`font-semibold tracking-tight ${color} text-4xl sm:text-5xl`}>
        {big}
        {unit && <span className="ml-1 text-xl text-slate-400 sm:text-2xl">{unit}</span>}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{label}</p>
    </div>
  );
}

function Feature({ img, alt, icon, title, text, href, cta }: { img: string; alt: string; icon: React.ReactNode; title: string; text: string; href: string; cta: string }) {
  return (
    <a href={href} className="group flex flex-col overflow-hidden rounded-xl border border-space-700 bg-space-900/70 transition hover:border-sky-500/50">
      <img src={img} alt={alt} loading="lazy" className="aspect-video w-full object-cover object-top" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
          {icon} {title}
        </h3>
        <p className="flex-1 text-sm leading-relaxed text-slate-300">{text}</p>
        <span className="mt-1 inline-flex items-center gap-1 text-sm text-sky-300 group-hover:text-sky-200">
          {cta} <ArrowRight size={14} />
        </span>
      </div>
    </a>
  );
}

function Step({ n, title, text, icon }: { n: number; title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-space-700 bg-space-900/70 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/15 font-mono text-sm text-sky-200">{n}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{text}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen text-slate-200">
      <header className="sticky top-0 z-20 border-b border-space-700 bg-space-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <a href="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-base font-semibold tracking-tight text-slate-50">AetherRidge</span>
          </a>
          <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-4">
            <a href="#how" className="hidden px-2 py-1 text-slate-300 hover:text-white sm:inline">How it works</a>
            <a href="#validation" className="hidden px-2 py-1 text-slate-300 hover:text-white sm:inline">Validation</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-slate-300 hover:text-white" aria-label="Source code on GitHub">
              <Github size={16} /> <span className="hidden sm:inline">Code</span>
            </a>
            <a href={APP} className="inline-flex items-center gap-1 rounded-md bg-sun px-3 py-1.5 font-semibold text-space-950 hover:bg-amber-300">
              Launch <ArrowRight size={14} />
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sun">NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-slate-50 sm:text-6xl">
              Will your lander see the <span className="text-sun">Sun</span>, and <span className="text-sky-300">Earth</span>?
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              At the lunar south pole the Sun skims the horizon, so a few hundred metres or a two-week delay decide whether a lander has power and a link home.
              AetherRidge answers it for any site and any moment, from real NASA terrain and ephemerides.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={APP} className="inline-flex items-center gap-2 rounded-lg bg-sun px-5 py-3 text-base font-semibold text-space-950 hover:bg-amber-300">
                Launch the navigator <ArrowRight size={18} />
              </a>
              <a href={DEMO_RIM_FLOOR} className="inline-flex items-center gap-2 rounded-lg border border-space-600 bg-space-900/70 px-5 py-3 text-base text-slate-100 hover:border-sky-500/60">
                Demo: rim vs floor
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-400">By Pang Qin Chan · Team Akasha Solo · free and open source, runs in any browser</p>
          </div>
          <figure className="min-w-0">
            <img
              src="/home/polemap.jpg"
              alt="Lunar south pole shaded relief with NASA's long-term sunlight overlay: lit ridges in amber, permanently shadowed craters in blue"
              className="w-full rounded-2xl border border-space-700 shadow-2xl shadow-black/50"
            />
            <figcaption className="mt-2 text-xs text-slate-400">Lunar south pole, NASA LOLA terrain and 18.6-year sunlight map. Blue: never sees the Sun.</figcaption>
          </figure>
        </section>

        {/* Key numbers */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat big="88% vs 0%" label="Sunlight on Shackleton's rim vs its floor, only 13 km apart." tone="sun" />
            <Stat big="53% → 78%" label="Moving 2.15 km from the Nobile rim site to a lander-safe slope found by the nearby scan." tone="earth" />
            <Stat big="88.0 vs 87.1" unit="%" label="Shackleton rim sunlight: AetherRidge vs NASA's own 18.6-year illumination map." tone="ok" />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-space-700 bg-space-900/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-50">How it works</h2>
            <p className="mt-2 max-w-2xl text-slate-300">Every number comes from NASA data. Nothing is estimated from rules of thumb.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Step n={1} icon={<Mountain size={18} />} title="Trace the real horizon" text="NASA LRO LOLA terrain (80 m) is ray-traced 360° out to 100 km, with the Moon's curvature, to find the skyline at the site." />
              <Step n={2} icon={<Sun size={18} />} title="Place the Sun and Earth" text="NASA JPL Horizons gives where the Sun and Earth appear in the site's sky every 2 hours across 2026–2027, live for custom sites." />
              <Step n={3} icon={<Radio size={18} />} title="Decide" text="Above the skyline means power and a direct link to Earth. The app turns that into countdowns, statistics, windows and battery sizes." />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-50">From data to a landing decision</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Feature img="/home/hero.jpg" alt="First screen of the app answering power and Earth link status with countdowns" icon={<Crosshair size={18} className="text-sun" />} title="The answer first" text="Is there power? Is there a link to Earth? For how long? One glance, with countdowns to sunset and Earthset." href={APP} cta="Open a site" />
            <Feature img="/home/terrain3d.jpg" alt="3D LOLA terrain around Shackleton rim lit by a grazing Sun" icon={<Box size={18} className="text-sky-300" />} title="3D terrain, live shadows" text="Real LOLA terrain lit by the Sun at the chosen moment, with the 100 km skyline ring that decides power." href={APP} cta="See it in 3D" />
            <Feature img="/home/nearby.jpg" alt="Sunlight heat map around the Nobile site with the best lander-safe cell starred" icon={<MapIcon size={18} className="text-emerald-300" />} title="Best nearby spot" text="Re-traces the horizon on an 11 × 11 grid around any site in seconds and stars the best cell with a safe slope." href="/app?site=nobile-rim" cta="Scan around Nobile" />
            <Feature img="/home/planner.jpg" alt="Mission planner with landing windows and battery sizing" icon={<CalendarClock size={18} className="text-violet-300" />} title="Launch slip and mission planning" text="What if we launch 14 days late? Compare dates side by side, find landing windows and size the battery for the longest night." href={DEMO_SLIP} cta="Try a 14-day slip" />
          </div>
        </section>

        {/* Validation */}
        <section id="validation" className="scroll-mt-20 border-y border-space-700 bg-space-900/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-50">
                <ShieldCheck className="text-emerald-300" /> Checked three ways
              </h2>
              <ul className="mt-5 space-y-3 text-slate-300">
                <li><b className="text-slate-100">9/9 automated physics checks</b> on every build: Apollo 11 day length, Chang'e-6 never sees Earth, Shackleton floor in permanent shadow.</li>
                <li><b className="text-slate-100">Published research:</b> rim sunlight and longest night agree with Gläser et al. 2014 and Mazarico et al. 2011.</li>
                <li><b className="text-slate-100">NASA's own illumination maps</b> (GSFC PGDA, 18.6 years) for every polar site. Where we differ, at Malapert, we say why instead of tuning.</li>
              </ul>
            </div>
            <div className="min-w-0 overflow-x-auto rounded-xl border border-space-700 bg-space-950/60 p-4">
              <table className="w-full text-sm">
                <caption className="pb-3 text-left text-xs text-slate-400">Sunlight %, AetherRidge vs NASA (best within 150 m)</caption>
                <thead className="text-left text-slate-400">
                  <tr><th className="py-1.5 font-medium">Site</th><th className="py-1.5 text-right font-medium">AetherRidge</th><th className="py-1.5 text-right font-medium">NASA</th></tr>
                </thead>
                <tbody className="font-mono text-slate-200">
                  <tr className="border-t border-space-700"><td className="py-1.5 font-sans">Shackleton rim</td><td className="text-right">88.0</td><td className="text-right">87.1</td></tr>
                  <tr className="border-t border-space-700"><td className="py-1.5 font-sans">Shackleton floor</td><td className="text-right">0.0</td><td className="text-right">0.0</td></tr>
                  <tr className="border-t border-space-700"><td className="py-1.5 font-sans">Nobile rim</td><td className="text-right">52.9</td><td className="text-right">54.1</td></tr>
                  <tr className="border-t border-space-700"><td className="py-1.5 font-sans">CSA rover peak</td><td className="text-right">41.2</td><td className="text-right">44.8</td></tr>
                  <tr className="border-t border-space-700"><td className="py-1.5 font-sans">Haworth rim</td><td className="text-right">0.3</td><td className="text-right">1.4</td></tr>
                  <tr className="border-t border-space-700"><td className="py-1.5 font-sans">Malapert summit</td><td className="text-right">82.6</td><td className="text-right">68.5</td></tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-400">Malapert: 2 m mast and a 2-year window here vs ground level and 18.6 years in NASA's map.</p>
            </div>
          </div>
        </section>

        {/* CTA + credits */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-50">Pick a site. See the sky.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">For mission planners screening sites and dates, and for anyone who wants to see why the lunar south pole is so extreme.</p>
          <a href={APP} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-sun px-6 py-3 text-base font-semibold text-space-950 hover:bg-amber-300">
            Launch the navigator <ArrowRight size={18} />
          </a>
        </section>
      </main>

      <footer className="border-t border-space-700">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs leading-relaxed text-slate-400">
          <p>
            <b className="text-slate-300">Data:</b> NASA LRO LOLA (PDS) · NASA JPL Horizons · NASA GSFC PGDA illumination maps · Canadian Space Agency Moon exploration.
          </p>
          <p>
            Pang Qin Chan · Team Akasha Solo · NASA Space Apps Challenge 2026. Code written with AI assistance (Claude, Anthropic); see the{" "}
            <a href={REPO} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">README</a>. Not affiliated with or endorsed by NASA.
          </p>
        </div>
      </footer>
    </div>
  );
}

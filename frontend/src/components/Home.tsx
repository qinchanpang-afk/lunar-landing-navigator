import { useMemo } from "react";
import { ArrowRight, Box, CalendarClock, Crosshair, Github, Map as MapIcon, Mountain, Radio, ShieldCheck, Sun } from "lucide-react";
import Logo from "./Logo";
import ScrollSky from "./ScrollSky";
import { CountUp, Reveal, ScrollProgress, Starfield, Ticker, useScrollProgress } from "./homeFx";
import { lastAppUrl } from "../lib/urlState";

// Navigator links use the root path with a ?site= deep link: the same address format the app has always used.
const DEMO_RIM_FLOOR = "/?site=shackleton-rim&view=compare&cmp=shackleton-rim,shackleton-floor";
const DEMO_SLIP = "/?site=nobile-rim&view=compare&cmp=nobile-rim,nobile-rim~o336";
const NOBILE = "/?site=nobile-rim";
const RIM = "/?site=shackleton-rim";
const REPO = "https://github.com/qinchanpang-afk/lunar-landing-navigator";

const TICKER = [
  "Shackleton rim: 88% sunlight",
  "Shackleton floor, 13 km away: 0%",
  "Malapert summit sees Earth 96% of the time",
  "2.15 km from Nobile: 53% → 78% sunlight",
  "A 14-day launch slip flips which ridge blocks the Sun",
  "9/9 automated physics checks",
  "NASA LRO LOLA terrain",
  "NASA JPL Horizons ephemerides",
  "Checked against NASA GSFC illumination maps",
];

function Stat({ children, label, tone }: { children: React.ReactNode; label: string; tone: "sun" | "earth" | "ok" }) {
  const color = tone === "sun" ? "text-sun" : tone === "earth" ? "text-sky-300" : "text-emerald-300";
  return (
    <div className="h-full rounded-xl border border-space-700 bg-space-900/70 p-5 transition hover:-translate-y-1 hover:border-space-600">
      <p className={`font-semibold tracking-tight ${color} text-4xl sm:text-5xl`}>{children}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{label}</p>
    </div>
  );
}

function Feature({ img, alt, icon, title, text, href, cta }: { img: string; alt: string; icon: React.ReactNode; title: string; text: string; href: string; cta: string }) {
  return (
    <a href={href} className="group flex h-full flex-col overflow-hidden rounded-xl border border-space-700 bg-space-900/70 transition duration-300 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-900/20">
      <div className="overflow-hidden">
        <img src={img} alt={alt} loading="lazy" className="aspect-video w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
          {icon} {title}
        </h3>
        <p className="flex-1 text-sm leading-relaxed text-slate-300">{text}</p>
        <span className="mt-1 inline-flex items-center gap-1 text-sm text-sky-300 group-hover:text-sky-200">
          {cta} <ArrowRight size={14} className="transition group-hover:translate-x-1" />
        </span>
      </div>
    </a>
  );
}

function Step({ n, title, text, icon }: { n: number; title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="h-full rounded-xl border border-space-700 bg-space-900/70 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/15 font-mono text-sm text-sky-200">{n}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{text}</p>
    </div>
  );
}

const TITLE: [string, string?][] = [["Will"], ["your"], ["lander"], ["see"], ["the"], ["Sun,", "text-sun"], ["and"], ["Earth?", "text-sky-300"]];

export default function Home() {
  const app = useMemo(() => lastAppUrl(), []);
  const [heroImg, pHero] = useScrollProgress<HTMLElement>();
  const [featHead, pFeat] = useScrollProgress<HTMLDivElement>();

  return (
    <div className="min-h-screen overflow-x-clip text-slate-200">
      <ScrollProgress />
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
            <a href={app} className="inline-flex items-center gap-1 rounded-md bg-sun px-3 py-1.5 font-semibold text-space-950 hover:bg-amber-300">
              Launch <ArrowRight size={14} />
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <div className="relative">
          <Starfield />
          <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
            <div className="min-w-0">
              <p className="hero-in text-xs font-semibold uppercase tracking-[0.18em] text-sun" style={{ animationDelay: "0ms" }}>
                NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-slate-50 sm:text-6xl">
                {TITLE.map(([w, c], i) => (
                  <span key={i}>
                    <span className={`word ${c ?? ""}`} style={{ animationDelay: `${120 + i * 80}ms` }}>{w}</span>{" "}
                  </span>
                ))}
              </h1>
              <p className="hero-in mt-5 max-w-xl text-lg leading-relaxed text-slate-300" style={{ animationDelay: "850ms" }}>
                At the lunar south pole the Sun skims the horizon, so a few hundred metres or a two-week delay decide whether a lander has power and a link home.
                AetherRidge answers it for any site and any moment, from real NASA terrain and ephemerides.
              </p>
              <div className="hero-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: "1000ms" }}>
                <a href={app} className="cta-glow inline-flex items-center gap-2 rounded-lg bg-sun px-5 py-3 text-base font-semibold text-space-950 hover:bg-amber-300">
                  Launch the navigator <ArrowRight size={18} />
                </a>
                <a href={DEMO_RIM_FLOOR} className="inline-flex items-center gap-2 rounded-lg border border-space-600 bg-space-900/70 px-5 py-3 text-base text-slate-100 hover:border-sky-500/60">
                  Demo: rim vs floor
                </a>
              </div>
              <p className="hero-in mt-6 text-sm text-slate-400" style={{ animationDelay: "1150ms" }}>
                By Pang Qin Chan · Team Akasha Solo · free and open source, runs in any browser
              </p>
            </div>
            <figure ref={heroImg} className="hero-in min-w-0" style={{ animationDelay: "400ms" }}>
              <img
                src="/home/polemap.jpg"
                alt="Lunar south pole shaded relief with NASA's long-term sunlight overlay: lit ridges in amber, permanently shadowed craters in blue"
                className="w-full rounded-2xl border border-space-700 shadow-2xl shadow-black/50 will-change-transform"
                style={{ transform: `translate3d(0, ${(pHero - 0.5) * -50}px, 0) rotate(${(pHero - 0.5) * -4}deg) scale(${1 + (0.5 - Math.abs(pHero - 0.5)) * 0.06})` }}
              />
              <figcaption className="mt-2 text-xs text-slate-400">Lunar south pole, NASA LOLA terrain and 18.6-year sunlight map. Blue: never sees the Sun.</figcaption>
            </figure>
          </section>
        </div>

        <Ticker items={TICKER} />

        {/* Key numbers */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            <Reveal>
              <Stat label="Sunlight on Shackleton's rim vs its floor, only 13 km apart." tone="sun">
                <CountUp to={88} suffix="%" /> vs 0%
              </Stat>
            </Reveal>
            <Reveal delay={120}>
              <Stat label="Moving 2.15 km from the Nobile rim site to a lander-safe slope found by the nearby scan." tone="earth">
                53% → <CountUp to={78} suffix="%" />
              </Stat>
            </Reveal>
            <Reveal delay={240}>
              <Stat label="Shackleton rim sunlight (%): AetherRidge vs NASA's own 18.6-year illumination map." tone="ok">
                <CountUp to={88} decimals={1} /> vs <CountUp to={87.1} decimals={1} />
              </Stat>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-space-700 bg-space-900/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-50">How it works</h2>
              <p className="mt-2 max-w-2xl text-slate-300">Every number comes from NASA data. Nothing is estimated from rules of thumb.</p>
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Reveal delay={0}>
                <Step n={1} icon={<Mountain size={18} />} title="Trace the real horizon" text="NASA LRO LOLA terrain (80 m) is ray-traced 360° out to 100 km, with the Moon's curvature, to find the skyline at the site." />
              </Reveal>
              <Reveal delay={140}>
                <Step n={2} icon={<Sun size={18} />} title="Place the Sun and Earth" text="NASA JPL Horizons gives where the Sun and Earth appear in the site's sky every 2 hours across 2026–2027, live for custom sites." />
              </Reveal>
              <Reveal delay={280}>
                <Step n={3} icon={<Radio size={18} />} title="Decide" text="Above the skyline means power and a direct link to Earth. The app turns that into countdowns, statistics, windows and battery sizes." />
              </Reveal>
            </div>
          </div>
        </section>

        <ScrollSky />

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div ref={featHead} className="overflow-hidden">
            <h2
              className="text-3xl font-semibold tracking-tight text-slate-50 will-change-transform max-sm:![transform:none] sm:whitespace-nowrap sm:text-5xl"
              style={{ transform: `translate3d(${(1 - pFeat) * 18 - 6}%,0,0)` }}
            >
              From data to a landing decision <span className="text-sun">→</span>
            </h2>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Reveal>
              <Feature img="/home/hero.jpg" alt="First screen of the app answering power and Earth link status with countdowns" icon={<Crosshair size={18} className="text-sun" />} title="The answer first" text="Is there power? Is there a link to Earth? For how long? One glance, with countdowns to sunset and Earthset." href={RIM} cta="Open Shackleton rim" />
            </Reveal>
            <Reveal delay={120}>
              <Feature img="/home/terrain3d.jpg" alt="3D LOLA terrain around Shackleton rim lit by a grazing Sun" icon={<Box size={18} className="text-sky-300" />} title="3D terrain, live shadows" text="Real LOLA terrain lit by the Sun at the chosen moment, with the 100 km skyline ring that decides power." href={RIM} cta="See it in 3D" />
            </Reveal>
            <Reveal>
              <Feature img="/home/nearby.jpg" alt="Sunlight heat map around the Nobile site with the best lander-safe cell starred" icon={<MapIcon size={18} className="text-emerald-300" />} title="Best nearby spot" text="Re-traces the horizon on an 11 × 11 grid around any site in seconds and stars the best cell with a safe slope." href={NOBILE} cta="Scan around Nobile" />
            </Reveal>
            <Reveal delay={120}>
              <Feature img="/home/planner.jpg" alt="Mission planner with landing windows and battery sizing" icon={<CalendarClock size={18} className="text-violet-300" />} title="Launch slip and mission planning" text="What if we launch 14 days late? Compare dates side by side, find landing windows and size the battery for the longest night." href={DEMO_SLIP} cta="Try a 14-day slip" />
            </Reveal>
          </div>
        </section>

        {/* Validation */}
        <section id="validation" className="scroll-mt-20 border-y border-space-700 bg-space-900/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
            <Reveal>
              <h2 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-50">
                <ShieldCheck className="text-emerald-300" /> Checked three ways
              </h2>
              <ul className="mt-5 space-y-3 text-slate-300">
                <li><b className="text-slate-100">9/9 automated physics checks</b> each time the data pipeline runs: Apollo 11 day length, Chang'e-6 never sees Earth, Shackleton floor in permanent shadow.</li>
                <li><b className="text-slate-100">Published research:</b> rim sunlight and longest night agree with Gläser et al. 2014 and Mazarico et al. 2011.</li>
                <li><b className="text-slate-100">NASA's own illumination maps</b> (GSFC PGDA, 18.6 years) for every polar site. Where we differ, at Malapert, we say why instead of tuning.</li>
              </ul>
            </Reveal>
            <Reveal delay={150} className="min-w-0">
              <div className="overflow-x-auto rounded-xl border border-space-700 bg-space-950/60 p-4">
                <table className="w-full text-sm">
                  <caption className="pb-3 text-left text-xs text-slate-400">Sunlight %, AetherRidge vs NASA (best within 150 m)</caption>
                  <thead className="text-left text-slate-400">
                    <tr><th className="py-1.5 font-medium">Site</th><th className="py-1.5 text-right font-medium">AetherRidge</th><th className="py-1.5 text-right font-medium">NASA</th></tr>
                  </thead>
                  <tbody className="font-mono text-slate-200">
                    {[["Shackleton rim", "88.0", "87.1"], ["Shackleton floor", "0.0", "0.0"], ["Nobile rim", "52.9", "54.1"], ["Peak near Shackleton (CSA scenario)", "41.2", "44.8"], ["Haworth crater floor", "0.3", "1.4"], ["Malapert summit", "82.6", "68.5"]].map(([s, a, n]) => (
                      <tr key={s} className="border-t border-space-700 transition-colors hover:bg-space-800/60"><td className="py-1.5 font-sans">{s}</td><td className="text-right">{a}</td><td className="text-right">{n}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">Malapert: 2 m mast and a 2-year window here vs ground level and 18.6 years in NASA's map.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="relative mx-auto max-w-6xl px-4 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Pick a site. See the sky.</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">For mission planners screening sites and dates, and for anyone who wants to see why the lunar south pole is so extreme.</p>
            <a href={app} className="cta-glow mt-7 inline-flex items-center gap-2 rounded-lg bg-sun px-6 py-3 text-base font-semibold text-space-950 hover:bg-amber-300">
              Launch the navigator <ArrowRight size={18} />
            </a>
          </Reveal>
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

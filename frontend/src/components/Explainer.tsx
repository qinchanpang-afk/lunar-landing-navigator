import { BookOpen } from "lucide-react";

const ITEMS: [string, string][] = [
  [
    "Why is the south pole so extreme?",
    "The Moon's spin axis is tilted only 1.5° from the plane of its orbit around the Sun. At the pole the Sun never climbs more than about 1.5° above the ideal horizon: it circles all the way around the sky once per lunar day (29.5 Earth days), skimming the skyline. A hill a few hundred metres high can block it for days. A crater floor can stay dark for billions of years.",
  ],
  [
    "Peaks of (almost) eternal light",
    "On a high ridge, such as the Shackleton connecting ridge or the Malapert summit, the horizon dips below 0°. The Sun stays in view for most of the year, so sunlight drops to zero only for a few days at a time. In this dataset that means about 83–88% sunlight, versus 50% at the equator.",
  ],
  [
    "Permanently shadowed regions",
    "Shackleton's floor is surrounded by walls rising more than 20° above it, while the Sun never gets higher than about 2° there. It gets 0% sunlight in this dataset. Such cold traps, below 40 K, can preserve water ice.",
  ],
  [
    "No atmosphere, no refraction",
    "On Earth, air bends sunlight so we still see the Sun after it is geometrically below the horizon, and the sky glows at twilight. The Moon has no air: the sky is black even at noon, there is no twilight, and a body is visible only if it is geometrically above the terrain. This app uses that strict rule: visible = elevation > horizon.",
  ],
  [
    "Why does Earth wobble?",
    "The Moon always shows the same face to Earth, so Earth barely moves in the lunar sky. The Moon's slightly elliptical, tilted orbit makes Earth sway by about ±7° (libration). At the pole Earth sits right on the horizon, so this wobble decides whether you can talk to home. On the far side (Chang'e-6), Earth never rises at all.",
  ],
  [
    "Where does the data come from?",
    "Sun and Earth positions come from the NASA JPL Horizons ephemeris for each exact site, every 2 hours for 2026–2027. Horizons are ray-traced 100 km in every direction across the LRO LOLA 80 m polar elevation model, including the Moon's curvature.",
  ],
];

export default function Explainer() {
  return (
    <section className="rounded-lg border border-space-700 bg-space-900/80 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <BookOpen size={15} className="text-sky-300" /> Understanding lunar light & communication
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {ITEMS.map(([q, a]) => (
          <details key={q} className="group rounded-md bg-space-850 p-3 open:bg-space-800" open={q.startsWith("Why is")}>
            <summary className="cursor-pointer text-[13px] font-medium text-slate-100 marker:text-sky-400">{q}</summary>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

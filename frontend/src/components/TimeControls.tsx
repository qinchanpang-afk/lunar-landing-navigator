import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Pause, Play, Sunrise, Sunset, CalendarClock } from "lucide-react";
import { fmtUTC, fromInputValue, SYNODIC_MONTH_H, toInputValue } from "../lib/time";

export const SPEEDS = [
  { label: "1 h/s", hps: 1 },
  { label: "6 h/s", hps: 6 },
  { label: "1 d/s", hps: 24 },
  { label: "5 d/s", hps: 120 },
];

interface Props {
  tH: number;
  spanH: number;
  t0ms: number;
  setTH: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (hps: number) => void;
  nextSunEvent: { label: string; dt: number | null };
  nextEarthEvent: { label: string; dt: number | null };
}

function Btn({ onClick, title, children, active = false, disabled = false }: {
  onClick: () => void; title: string; children: React.ReactNode; active?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title} disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-40
        ${active ? "border-sky-400/60 bg-sky-500/15 text-sky-200" : "border-space-600 bg-space-800 text-slate-300 hover:bg-space-700"}`}
    >
      {children}
    </button>
  );
}

export default function TimeControls(p: Props) {
  const ms = p.t0ms + p.tH * 3_600_000;
  const jump = (dh: number) => p.setTH(Math.min(p.spanH, Math.max(0, p.tH + dh)));
  return (
    <div className="rounded-lg border border-space-700 bg-space-900/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={() => p.setPlaying(!p.playing)} title={p.playing ? "Pause" : "Play"} active={p.playing}>
          {p.playing ? <Pause size={14} /> : <Play size={14} />}
        </Btn>
        <div className="flex rounded-md overflow-hidden border border-space-600">
          {SPEEDS.map((s) => (
            <button
              key={s.hps} type="button" onClick={() => p.setSpeed(s.hps)}
              className={`px-2 py-1.5 text-[11px] font-mono ${p.speed === s.hps ? "bg-sky-500/20 text-sky-200" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Btn onClick={() => jump(-SYNODIC_MONTH_H)} title="Back one lunar day (29.5 d)"><ChevronsLeft size={14} /></Btn>
          <Btn onClick={() => jump(-24)} title="Back one Earth day"><ChevronLeft size={14} /></Btn>
          <Btn onClick={() => jump(24)} title="Forward one Earth day"><ChevronRight size={14} /></Btn>
          <Btn onClick={() => jump(SYNODIC_MONTH_H)} title="Forward one lunar day (29.5 d)"><ChevronsRight size={14} /></Btn>
        </div>
        <div className="flex gap-1">
          <Btn onClick={() => p.nextSunEvent.dt != null && jump(p.nextSunEvent.dt + 0.05)} title={`Jump to ${p.nextSunEvent.label}`} disabled={p.nextSunEvent.dt == null}>
            {p.nextSunEvent.label.includes("set") ? <Sunset size={14} /> : <Sunrise size={14} />}
            <span className="hidden sm:inline">{p.nextSunEvent.label}</span>
          </Btn>
          <Btn onClick={() => p.nextEarthEvent.dt != null && jump(p.nextEarthEvent.dt + 0.05)} title={`Jump to ${p.nextEarthEvent.label}`} disabled={p.nextEarthEvent.dt == null}>
            <span className="text-earth">⊕</span>
            <span className="hidden sm:inline">{p.nextEarthEvent.label}</span>
          </Btn>
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarClock size={14} />
          <input
            type="datetime-local"
            value={toInputValue(ms)}
            min={toInputValue(p.t0ms)}
            max={toInputValue(p.t0ms + p.spanH * 3_600_000)}
            onChange={(e) => {
              const v = fromInputValue(e.target.value);
              if (!isNaN(v)) p.setTH(Math.min(p.spanH, Math.max(0, (v - p.t0ms) / 3_600_000)));
            }}
            className="rounded-md border border-space-600 bg-space-800 px-2 py-1 font-mono text-xs text-slate-200 [color-scheme:dark]"
          />
          <span className="font-mono">UTC</span>
        </label>
      </div>
      <input
        type="range" min={0} max={p.spanH} step={0.5} value={p.tH}
        onChange={(e) => p.setTH(Number(e.target.value))}
        className="mt-3 w-full accent-sky-400"
        aria-label="Time scrubber 2026-2027"
      />
      <div className="flex justify-between text-[10px] font-mono text-slate-500">
        <span>2026-01-01</span>
        <span className="text-slate-300">{fmtUTC(ms)}</span>
        <span>2027-12-31</span>
      </div>
    </div>
  );
}

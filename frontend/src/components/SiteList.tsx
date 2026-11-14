import { AlertTriangle, Columns2, MapPin, X } from "lucide-react";
import type { SiteMeta } from "../lib/types";

interface Props {
  sites: SiteMeta[];
  selectedId: string;
  onSelect: (id: string) => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
  onRemove?: (id: string) => void;
  onClearCustom?: () => void;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1 w-full rounded bg-space-700 overflow-hidden">
      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function SiteList({ sites, selectedId, onSelect, compareIds, toggleCompare, onRemove, onClearCustom }: Props) {
  const groups = ["South Pole", ...Array.from(new Set(sites.map((s) => s.region))).filter((r) => r !== "South Pole")];
  return (
    <nav className="space-y-4" aria-label="Landing sites">
      {groups.map((g) => (
        <div key={g}>
          <div className="px-1 mb-1.5 flex items-center text-[11px] uppercase tracking-widest text-slate-400">
            {g}
            {g === "Custom" && onClearCustom && (
              <button
                type="button" onClick={onClearCustom}
                className="ml-auto normal-case tracking-normal rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-space-700 hover:text-rose-300"
                title="Remove all custom sites from this browser"
              >
                Clear custom sites
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {sites.filter((s) => s.region === g).map((s) => {
              const active = s.id === selectedId;
              const inCmp = compareIds.includes(s.id);
              return (
                <li key={s.id}>
                  <div
                    role="button" tabIndex={0}
                    onClick={() => onSelect(s.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(s.id)}
                    className={`group rounded-lg border p-2.5 cursor-pointer transition
                      ${active ? "border-sky-400/60 bg-sky-500/10" : "border-space-700 bg-space-900/60 hover:border-space-600 hover:bg-space-850"}`}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className={`mt-0.5 shrink-0 ${active ? "text-sky-300" : "text-slate-400"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-slate-100 leading-snug">{s.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{s.agency}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {s.lat.toFixed(3)}°, {s.lon.toFixed(3)}°E · {s.elev_km_used.toFixed(2)} km
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleCompare(s.id); }}
                        title={inCmp ? "Remove from comparison" : "Add to comparison"}
                        aria-label={inCmp ? "Remove from comparison" : "Add to comparison"}
                        className={`shrink-0 rounded p-1 ${inCmp ? "bg-violet-500/25 text-violet-200" : "text-slate-400 hover:text-slate-300 hover:bg-space-700"}`}
                      >
                        <Columns2 size={13} />
                      </button>
                      {s.region === "Custom" && onRemove && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRemove(s.id); }}
                          title="Remove custom site" aria-label="Remove custom site"
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-space-700 hover:text-rose-300"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono">
                      <span className="text-sun">☀ {s.stats.sunlight_pct.toFixed(1)}%</span>
                      <span className="text-earth">⊕ {s.stats.dte_pct.toFixed(1)}%</span>
                      <Bar pct={s.stats.sunlight_pct} color="#ffc23d" />
                      <Bar pct={s.stats.dte_pct} color="#4fa8ff" />
                    </div>
                    {s.warnings.some((w) => w.includes("pending") || w.includes("slope")) && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300" title={s.warnings.join("\n")}>
                        <AlertTriangle size={11} /> Coordinates pending verification
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

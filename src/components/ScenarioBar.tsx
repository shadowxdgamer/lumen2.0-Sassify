import { CloudFog, Play, ShieldCheck, Siren, Zap } from 'lucide-react';
import type { ScenarioId } from '../simulation/physicsEngine';
import { command, useSim } from '../simulation/store';

const SCENARIOS: { id: ScenarioId; label: string; detail: string; icon: typeof Play; tone: string }[] = [
  { id: 1, label: 'NOMINAL BASELINE', detail: '40.0 kWe / 410K', icon: Play, tone: '#4ade80' },
  { id: 2, label: 'TRIGGER LANDER DUST CRISIS', detail: '89% FOUL / 920K', icon: CloudFog, tone: '#f97316' },
  { id: 3, label: 'ENGAGE AUTONOMOUS PROTECTION', detail: 'EDS + NET + TRIAGE', icon: ShieldCheck, tone: '#22d3ee' },
  { id: 4, label: 'SITING HAZARD TEST', detail: 'UNSHIELDED RADIATION', icon: Siren, tone: '#ef4444' },
];

export function ScenarioBar() {
  const s = useSim();
  const dustPct = Math.round(s.dust[0] * 100);
  return (
    <div className="flex h-[46px] shrink-0 items-center gap-[8px] border-b border-edge bg-[#09121b] px-[10px]">
      <span className="mr-[4px] flex items-center gap-[6px] font-mono text-[11px] tracking-widest text-slate-500">
        <Zap size={13} strokeWidth={1.75} className="text-cyan-400" /> DEMO SCENARIOS
      </span>
      {SCENARIOS.map(({ id, label, detail, icon: Icon, tone }) => {
        const active = s.scenario === id;
        return (
          <button
            key={id}
            onClick={() => command((e) => e.applyScenario(id))}
            aria-pressed={active}
            className="flex h-[32px] items-center gap-[8px] border border-edge bg-[#0b141e] px-[10px] text-left transition-[scale,background-color,border-color] duration-150 ease-out hover:border-edge-hi hover:bg-[#122131] motion-safe:enabled:active:scale-[0.96]"
            // Inline colours only for the active state, so the hover classes stay effective otherwise.
            style={active ? { borderColor: tone, background: `${tone}1f`, boxShadow: `0 0 12px ${tone}55, inset 0 0 8px ${tone}33` } : undefined}
          >
            <span className="font-mono text-[12px] font-bold" style={{ color: tone }}>
              [{id}]
            </span>
            <Icon size={14} strokeWidth={1.75} style={{ color: tone }} />
            <span className="flex flex-col text-[12.5px] leading-[1.1] tracking-wide text-slate-100">
              {label}
              <span className="font-mono text-[10px] text-slate-400">({detail})</span>
            </span>
          </button>
        );
      })}

      <div className="ml-auto flex items-center gap-[10px] border border-edge bg-[#0b141e] px-[12px] py-[5px]">
        <label htmlFor="dust-slider" className="font-mono text-[11px] tracking-wider text-slate-400">
          WING 0 DUST FOULING
        </label>
        <input
          id="dust-slider"
          type="range"
          min={0}
          max={100}
          value={dustPct}
          onChange={(ev) => command((e) => e.setDust(0, Number(ev.target.value) / 100))}
          className="hud-range w-[200px]"
          style={{ ['--pct' as string]: `${dustPct}%`, ['--fill' as string]: dustPct > 50 ? '#f97316' : '#22d3ee' }}
        />
        <span className="w-[42px] text-right font-mono text-[14px] font-semibold tnum" style={{ color: dustPct > 50 ? '#fb923c' : '#67e8f9' }}>
          {dustPct}%
        </span>
        <span className="font-mono text-[11px] text-slate-500 tnum">ε {s.emissivity[0].toFixed(2)}</span>
      </div>
    </div>
  );
}

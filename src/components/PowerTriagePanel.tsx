import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { FREEZE_K } from '../simulation/constants';
import type { TriageRequest } from '../simulation/triage';
import { command, useSim } from '../simulation/store';
import { Panel, SegmentBar } from './Panel';

const ROWS = [
  { key: 'life', label: 'LIFE SUPPORT', color: '#f97316' },
  { key: 'comms', label: 'COMMS', color: '#eab308' },
  { key: 'habitat', label: 'HABITAT', color: '#22c55e' },
  { key: 'drills', label: 'ICE DRILLS', color: '#3b82f6' },
] as const;

const OVERRIDES: { key: keyof TriageRequest; label: string; color: string }[] = [
  { key: 'life', label: 'LIFE', color: '#f97316' },
  { key: 'comms', label: 'COMMS', color: '#eab308' },
  { key: 'drills', label: 'ICE DRILLS', color: '#3b82f6' },
];

export function PowerTriagePanel() {
  const s = useSim();
  const [open, setOpen] = useState(false);
  const { alloc, demand } = s.triage;
  const total = alloc.life + alloc.comms + alloc.habitat + alloc.drills;
  const margin = s.pipeTemp - FREEZE_K;
  return (
    <Panel
      title="SURVIVAL POWER TRIAGE"
      className="shrink-0"
      right={
        <span className={`font-mono text-[11px] ${s.triage.failsafe ? 'blink font-semibold text-red-400' : 'text-cyan-300'}`}>{s.triage.failsafe ? 'FAILSAFE PRIORITY' : 'PRIORITY'}</span>
      }
    >
      <div className="px-[12px] py-[8px]">
        <div className="mb-[8px] flex items-baseline justify-between font-mono text-[11px] text-slate-400">
          <span>
            <span className="text-[15px] text-cyan-300 tnum">{(s.pe / 1000).toFixed(1)}</span> kWe AVAILABLE · {(total / 1000).toFixed(1)} USED
          </span>
          <span className={s.triage.failsafe ? 'text-amber-300' : 'text-emerald-300'}>{s.triage.failsafe ? 'DRILLS SHED · CREW 100%' : 'CREW LOADS 100%'}</span>
        </div>
        <div className="space-y-[6px]">
          {ROWS.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-[10px]">
              <span className="w-[96px] text-[13px] leading-none">{label}</span>
              <div className="h-[16px] flex-1">
                <SegmentBar value={alloc[key] / 1000} demand={demand[key] / 1000} max={20} segments={20} color={color} />
              </div>
              <span className="w-[54px] text-right font-mono text-[12px] tnum" style={{ color }}>
                {(alloc[key] / 1000).toFixed(1)} kW
              </span>
            </div>
          ))}
        </div>
        <div className="mt-[8px] flex items-center justify-between border-t border-edge/70 pt-[6px] font-mono text-[11px] text-slate-400">
          <span>
            WATER LINE {s.pipeTemp.toFixed(1)}K · HEATERS {(s.triage.heaterPower / 1000).toFixed(1)} kW
          </span>
          <span className={margin < 3 ? 'blink font-semibold text-red-400' : 'text-emerald-300'}>+{margin.toFixed(1)}K ABOVE FREEZE</span>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="manual-override"
          className="mt-[6px] flex w-full items-center justify-between font-mono text-[11px] tracking-wider text-slate-500 transition-[color] duration-150 ease-out hover:text-cyan-200"
        >
          MANUAL OVERRIDE
          <ChevronDown size={14} strokeWidth={1.75} className="transition-[rotate] duration-150 ease-out" style={{ rotate: open ? '180deg' : '0deg' }} />
        </button>
        {open && (
          <div id="manual-override" className="mt-[6px] space-y-[6px]">
            {OVERRIDES.map(({ key, label, color }) => {
              const v = Math.round(s.request[key] * 100);
              return (
                <div key={key} className="flex items-center gap-[10px]">
                  <label htmlFor={`tri-${key}`} className="w-[60px] text-[12px]">
                    {label}
                  </label>
                  <input
                    id={`tri-${key}`}
                    type="range"
                    min={0}
                    max={100}
                    value={v}
                    onChange={(ev) => command((e) => e.setTriageRequest({ [key]: Number(ev.target.value) / 100 }))}
                    className="hud-range flex-1"
                    style={{ ['--pct' as string]: `${v}%`, ['--fill' as string]: color }}
                  />
                  <span className="w-[40px] text-right font-mono text-[11px] tnum" style={{ color }}>
                    {v}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

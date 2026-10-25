import { FREEZE_K, PIPE_BAND_ECO, PIPE_BAND_NORMAL } from '../simulation/constants';
import type { TriageRequest } from '../simulation/triage';
import { command, useSim } from '../simulation/store';
import { Panel } from './Panel';

const SLIDERS: { key: keyof TriageRequest; label: string; color: string; alloc: 'life' | 'comms' | 'science' }[] = [
  { key: 'life', label: 'LIFE', color: '#22d3ee', alloc: 'life' },
  { key: 'comms', label: 'COMMS', color: '#eab308', alloc: 'comms' },
  { key: 'science', label: 'SCIENCE', color: '#ef4444', alloc: 'science' },
];

export function TriageSliders() {
  const s = useSim();
  const pipeLo = 262;
  const pipeHi = 300;
  const pct = (t: number) => ((t - pipeLo) / (pipeHi - pipeLo)) * 100;
  const band = s.triageAuto ? PIPE_BAND_ECO : PIPE_BAND_NORMAL;
  const margin = s.pipeTemp - FREEZE_K;
  return (
    <Panel
      title="TRIAGE"
      className="shrink-0"
      windowControls
      right={
        <button
          onClick={() => command((e) => e.setTriageAuto(!s.triageAuto))}
          className="border px-[6px] py-px font-mono text-[10px]"
          style={{ borderColor: s.triageAuto ? '#22d3ee' : '#334155', color: s.triageAuto ? '#67e8f9' : '#94a3b8' }}
        >
          {s.triageAuto ? 'AUTO ON' : 'AUTO OFF'}
        </button>
      }
    >
      <div className="space-y-[6px] px-[12px] py-[6px]">
        {SLIDERS.map(({ key, label, color, alloc }) => {
          const v = Math.round(s.request[key] * 100);
          return (
            <div key={key} className="flex items-center gap-[10px]">
              <label htmlFor={`tri-${key}`} className="w-[58px] text-[13px]">
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
              <span className="w-[96px] whitespace-nowrap text-right font-mono text-[11.5px] tnum" style={{ color }}>
                {v}% · {(s.triage.alloc[alloc] / 1000).toFixed(1)} kW
              </span>
            </div>
          );
        })}
        <div className="pt-[2px]">
          <div className="flex justify-between font-mono text-[10px] text-slate-400">
            <span>HABITAT WATER LINE · HEATER {s.heaterOn ? <span className="text-amber-300">ON</span> : 'OFF'} · BAND {band[0]}–{band[1]}K</span>
            <span className={margin < 3 ? 'blink text-red-400' : 'text-emerald-300'}>+{margin.toFixed(1)}K</span>
          </div>
          <div className="relative mt-[4px] h-[10px] bg-[#132231]">
            <div className="absolute inset-y-0 bg-emerald-500/25" style={{ left: `${pct(band[0])}%`, width: `${pct(band[1]) - pct(band[0])}%` }} />
            <div className="absolute inset-y-[-3px] w-[2px] bg-red-500 shadow-[0_0_6px_#ef4444]" style={{ left: `${pct(FREEZE_K)}%` }} />
            <div className="absolute inset-y-[-2px] w-[6px] -translate-x-1/2 bg-white shadow-[0_0_6px_#fff] transition-[left]" style={{ left: `${Math.max(0, Math.min(100, pct(s.pipeTemp)))}%` }} />
          </div>
          <div className="mt-[2px] flex justify-between font-mono text-[9px] text-slate-500">
            <span>{pipeLo}K</span>
            <span className="text-red-400">273.15K FREEZE</span>
            <span>{pipeHi}K</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

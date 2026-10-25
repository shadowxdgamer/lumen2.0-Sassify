import { useSim } from '../simulation/store';
import { Panel, SegmentBar } from './Panel';

const ROWS = [
  { key: 'life', label: 'LIFE SUPPORT', color: '#f97316' },
  { key: 'comms', label: 'COMMS', color: '#eab308' },
  { key: 'habitat', label: 'HABITAT', color: '#22c55e' },
  { key: 'science', label: 'SCIENCE', color: '#3b82f6' },
] as const;

export function PowerTriagePanel() {
  const s = useSim();
  const { alloc, demand } = s.triage;
  const total = alloc.life + alloc.comms + alloc.habitat + alloc.science;
  return (
    <Panel title="SURVIVAL POWER TRIAGE" className="shrink-0" right={<span className={`font-mono text-[10px] ${s.triageAuto ? 'text-cyan-300' : 'text-slate-500'}`}>{s.triageAuto ? 'AUTO' : 'PROPORTIONAL'}</span>}>
      <div className="px-[12px] py-[5px]">
        <div className="flex items-end justify-between">
          <span className="text-[13px] tracking-wide text-amber-400">SCHEDULING AND PRIORITIZATION</span>
          <span className="font-mono text-[9px] text-slate-500">kW</span>
        </div>
        <div className="ml-[108px] mt-[2px] flex justify-between font-mono text-[9px] text-slate-500">
          {[0, 4, 8, 12, 16, 20].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="mt-[2px] space-y-[5px]">
          {ROWS.map(({ key, label, color }) => {
            const a = alloc[key];
            const d = demand[key];
            return (
              <div key={key} className="flex items-center gap-[8px]">
                <div className="w-[100px]">
                  <div className="flex justify-between text-[13px] leading-none">
                    <span>{label}</span>
                  </div>
                  <div className="mt-[4px] h-[3px] bg-[#132231]">
                    <div className="h-full transition-all" style={{ width: `${d > 0 ? Math.min(100, (a / d) * 100) : 0}%`, background: color }} />
                  </div>
                </div>
                <div className="h-[18px] flex-1">
                  <SegmentBar value={a / 1000} demand={d / 1000} max={20} segments={20} color={color} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-[5px] flex justify-between border-t border-edge/70 pt-[4px] font-mono text-[10px] text-slate-400">
          <span>
            BUDGET <span className="text-cyan-300 tnum">{(s.pe / 1000).toFixed(1)} kWe</span>
          </span>
          <span>
            LOAD <span className="tnum text-slate-200">{(total / 1000).toFixed(1)}</span>
          </span>
          <span className={s.triage.brownout ? 'blink text-red-400' : 'text-emerald-300'}>{s.triage.brownout ? 'LIFE < FLOOR' : 'LIFE FLOOR OK'}</span>
        </div>
      </div>
    </Panel>
  );
}

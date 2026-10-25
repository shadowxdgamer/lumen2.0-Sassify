import { useEffect, useRef } from 'react';
import { useSim } from '../simulation/store';
import { Panel } from './Panel';

const LEVEL_COLOR = { info: '#94a3b8', ok: '#4ade80', warn: '#fbbf24', crit: '#f87171' } as const;

export function DiagnosticLog() {
  const s = useSim();
  const box = useRef<HTMLDivElement>(null);
  const last = s.logs[s.logs.length - 1]?.id ?? 0;
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);
  return (
    <Panel title="DIAGNOSTIC LOG" className="flex-1" bodyClassName="flex">
      <div ref={box} className="log-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-[12px] py-[6px] font-mono text-[11px] leading-[1.5]">
        {s.logs.map((l) => (
          <div key={l.id} className="mb-[2px]" style={{ color: LEVEL_COLOR[l.level] }}>
            <span className="text-slate-500">[{l.time}]</span> {l.msg}
          </div>
        ))}
      </div>
    </Panel>
  );
}

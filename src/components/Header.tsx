import { UserRound } from 'lucide-react';
import { TICK_HZ, TIME_WARP } from '../simulation/constants';
import { useSim } from '../simulation/store';

const NIGHT_HOURS = 354; // one lunar night

const STATUS_COLOR = { NOMINAL: '#4ade80', WARNING: '#fbbf24', CRITICAL: '#ef4444' } as const;

function Logo() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" className="drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]">
      <defs>
        <radialGradient id="core" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#ecfeff" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0e7490" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="11" fill="url(#core)" />
      {[0, 120, 240].map((r) => (
        <path key={r} d="M32 6 A26 26 0 0 1 56 24" stroke="#38bdf8" strokeWidth="3.2" fill="none" strokeLinecap="round" transform={`rotate(${r} 32 32)`} />
      ))}
      {[60, 180, 300].map((r) => (
        <path key={r} d="M32 13 A19 19 0 0 1 49 26" stroke="#7dd3fc" strokeWidth="1.6" fill="none" strokeLinecap="round" transform={`rotate(${r} 32 32)`} />
      ))}
    </svg>
  );
}

export function Header() {
  const s = useSim();
  const hours = s.simTime / 3600;
  const nightFrac = (hours % NIGHT_HOURS) / NIGHT_HOURS;
  const dots = Math.round(nightFrac * 6);
  const statusColor = STATUS_COLOR[s.status];
  return (
    <header className="relative flex h-[68px] shrink-0 items-center gap-[22px] border-b border-edge bg-gradient-to-b from-[#0d1a26] to-[#08111a] px-[18px]">
      <div className="flex items-center gap-[8px]">
        <Logo />
        <div className="text-[38px] font-medium leading-none tracking-[0.04em] text-slate-100">
          HELIOSCORE <span className="text-cyan-300">2030</span>
        </div>
      </div>

      <div className="ml-[34px] flex w-[248px] flex-col gap-[4px] font-mono text-[12px]">
        <div className="flex items-center justify-between border border-edge bg-[#0b141e] px-[8px] py-[2px]">
          <span className="text-slate-300">SYSTEM STATUS</span>
          <span className="flex items-center gap-[6px] font-semibold" style={{ color: statusColor }}>
            <span className={s.status === 'CRITICAL' ? 'blink' : ''}>{s.status}</span>
            <span className="h-[8px] w-[8px]" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
          </span>
        </div>
        <div className="flex items-center justify-between border border-edge bg-[#0b141e] px-[8px] py-[2px]">
          <span className="text-slate-300">LUNAR NIGHT</span>
          <span className="flex gap-[4px]">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="h-[8px] w-[8px]" style={{ background: i < dots ? '#f59e0b' : '#1e2f3f' }} />
            ))}
          </span>
        </div>
      </div>

      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
        <div className="mt-[6px] text-[34px] font-medium leading-none tracking-[0.08em] text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]">
          LUNAR DIGITAL TWIN
        </div>
        <div className="mt-[4px] h-[2px] w-[110px] bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
        <div
          className="mt-[2px] border border-edge-hi bg-[#0c1823] px-[48px] py-[2px] text-[14px] tracking-[0.1em] text-slate-300"
          style={{ clipPath: 'polygon(6% 0, 94% 0, 100% 100%, 0 100%)' }}
        >
          NUCLEAR FISSION TWIN
        </div>
      </div>

      <div className="ml-auto flex items-center gap-[22px]">
        <div className="w-[330px] font-mono text-[10px] text-slate-400">
          <div className="flex justify-between">
            <span>MET {Math.floor(hours / 24)}d {Math.floor(hours % 24).toString().padStart(2, '0')}h</span>
            <span className="text-amber-300">NIGHT {(nightFrac * 100).toFixed(0)}%</span>
            <span>{NIGHT_HOURS} h</span>
          </div>
          <div className="relative mt-[3px] h-[14px]">
            {Array.from({ length: 31 }, (_, i) => (
              <span key={i} className="absolute bottom-0 w-px bg-slate-500" style={{ left: `${(i / 30) * 100}%`, height: i % 5 ? 6 : 12 }} />
            ))}
            <span className="absolute -top-[2px] h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-amber-400" style={{ left: `calc(${nightFrac * 100}% - 5px)` }} />
          </div>
          <div className="mt-[1px] flex justify-between">
            <span>PHYS {TICK_HZ} Hz · ×{TIME_WARP}</span>
            <span>Δt {s.physicsMs.toFixed(2)} + CV {s.cvMs.toFixed(1)} ms</span>
            <span>TICK {s.tick}</span>
          </div>
        </div>
        <div className="flex items-center gap-[10px] border border-edge bg-[#0b141e] px-[10px] py-[5px]">
          <UserRound size={22} className="text-slate-400" />
          <div className="text-[12px] leading-tight">
            <div className="text-slate-300">OPERATOR</div>
            <div className="text-cyan-300">HELIOS-CORE 2030</div>
          </div>
        </div>
      </div>
    </header>
  );
}

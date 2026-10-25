import { useSim } from '../simulation/store';

const STATUS_COLOR = { NOMINAL: '#4ade80', WARNING: '#fbbf24', CRITICAL: '#ef4444' } as const;

function Logo() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" className="drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]">
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
  const statusColor = STATUS_COLOR[s.status];
  return (
    <header className="relative flex h-[64px] shrink-0 items-center border-b border-edge bg-gradient-to-b from-[#0d1a26] to-[#08111a] px-[18px]">
      <div className="flex items-center gap-[8px]">
        <Logo />
        <div className="text-[34px] font-medium leading-none tracking-[0.04em] text-slate-100">
          HELIOSCORE <span className="text-cyan-300">2030</span>
        </div>
      </div>

      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
        <div className="mt-[8px] text-[30px] font-medium leading-none tracking-[0.08em] text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]">
          LUNAR DIGITAL TWIN
        </div>
        <div className="mt-[6px] text-[13px] tracking-[0.18em] text-slate-400">NUCLEAR FISSION · DUST DEFENSE · SURVIVAL GRID</div>
      </div>

      <div
        className="ml-auto flex items-center gap-[12px] border px-[14px] py-[7px]"
        style={{ borderColor: `${statusColor}99`, background: `${statusColor}14`, boxShadow: `0 0 14px ${statusColor}33` }}
      >
        <span className="font-mono text-[12px] tracking-widest text-slate-300">SYSTEM STATUS</span>
        <span className="h-[10px] w-[10px]" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
        <span className={`w-[96px] font-mono text-[18px] font-semibold ${s.status === 'CRITICAL' ? 'blink' : ''}`} style={{ color: statusColor }}>
          {s.status}
        </span>
      </div>
    </header>
  );
}

import { command, useSim } from '../simulation/store';

export function EngageButton() {
  const s = useSim();
  const active = s.netOn && (s.edsArmed || s.edsActive);
  const sub = s.edsActive
    ? `EDS PULSE WING ${s.edsWing} · D ${(s.dust[s.edsWing] * 100).toFixed(0)}% · NET ✓ · TRIAGE ✓`
    : s.edsArmed
      ? 'EDS ARMED · AWAITING CV LOCK'
      : s.netOn && s.triageAuto
        ? 'NET ✓ · TRIAGE AUTO · EDS COMPLETE'
        : 'NET + TARGETED EDS + SURVIVAL TRIAGE';
  return (
    <div className="engage-wrap shrink-0 px-[6px] py-[2px]">
      <button onClick={() => command((e) => e.engageProtection())} className="engage-btn flex h-[80px] w-full flex-col items-center justify-center">
        <span className="mb-[3px] flex gap-[3px] opacity-70">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="h-[3px] w-[8px] -skew-x-[30deg] bg-cyan-100" />
          ))}
        </span>
        <span className="text-[25px] font-semibold leading-[1.0] tracking-[0.06em] text-cyan-50 drop-shadow-[0_0_8px_#67e8f9]">
          {active ? 'PROTECTION ACTIVE' : 'ENGAGE AUTONOMOUS PROTECTION'}
        </span>
        <span className="mt-[4px] font-mono text-[10px] tracking-wider text-cyan-100/85">{sub}</span>
      </button>
    </div>
  );
}

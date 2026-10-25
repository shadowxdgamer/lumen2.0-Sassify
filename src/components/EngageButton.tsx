import type { SimSnapshot } from '../simulation/physicsEngine';
import { command, useSim } from '../simulation/store';

/** Title + subtitle for the CTA, which adapts to the current beat of the story. */
function copy(s: SimSnapshot): { title: string; sub: string } {
  const dust = s.edsWing >= 0 ? `WING ${s.edsWing} · DUST ${(s.dust[s.edsWing] * 100).toFixed(0)}%` : '';
  if (s.netFault) {
    if (s.edsActive) return { title: 'BACKUP EDS FIRING', sub: `${dust} · TRIAGE RESTORES BELOW 650K` };
    if (s.edsArmed) return { title: 'BACKUP EDS ARMED', sub: 'AWAITING THERMAL-VISION LOCK' };
    if (s.triage.failsafe || s.detection) return { title: 'EMERGENCY BACKUP EDS + RESTORE TRIAGE', sub: 'NET OFFLINE · FIRE WING ELECTRODES ON CV TARGET' };
    return { title: 'RECOVERED — NET AWAITING REPAIR', sub: 'WING CLEAN · ICE DRILLS RESTORED · CREW 100%' };
  }
  if (s.edsActive) return { title: 'EDS PULSE ACTIVE', sub: `${dust} · MESH NET UP` };
  if (s.edsArmed) return { title: 'EDS ARMED', sub: 'AWAITING THERMAL-VISION LOCK' };
  return { title: 'ENGAGE AUTONOMOUS PROTECTION', sub: 'MESH NET + TARGETED AI EDS PULSE' };
}

export function EngageButton() {
  const s = useSim();
  const { title, sub } = copy(s);
  const alert = s.netFault && !s.edsActive && (s.triage.failsafe || s.detection !== null);
  return (
    <div className={`engage-wrap shrink-0 px-[6px] py-[2px] ${alert ? 'engage-wrap--alert' : ''}`}>
      <button onClick={() => command((e) => e.engageProtection())} className={`engage-btn flex h-[80px] w-full flex-col items-center justify-center ${alert ? 'engage-btn--alert' : ''}`}>
        <span className="mb-[3px] flex gap-[3px] opacity-70">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="h-[3px] w-[8px] -skew-x-[30deg] bg-cyan-100" />
          ))}
        </span>
        <span className={`max-w-[330px] text-center font-semibold leading-[1.05] tracking-[0.05em] text-cyan-50 drop-shadow-[0_0_8px_#67e8f9] ${title.length > 28 ? 'text-[20px]' : 'text-[25px]'}`}>
          {title}
        </span>
        <span className="mt-[4px] font-mono text-[10px] tracking-wider text-cyan-100/85">{sub}</span>
      </button>
    </div>
  );
}

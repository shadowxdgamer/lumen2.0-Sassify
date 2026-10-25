import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { LOAD_NOMINAL } from '../simulation/constants';
import type { SimSnapshot } from '../simulation/physicsEngine';
import { useSim } from '../simulation/store';

const card = 'panel flex flex-col px-[14px] py-[12px]';

function CoreTempCard({ s }: { s: SimSnapshot }) {
  const t = s.coreTemp;
  const lit = Math.round(((t - 300) / 700) * 10);
  const hot = t > 750;
  const warn = t > 650;
  return (
    <div className={card}>
      <div className="whitespace-nowrap text-[22px] tracking-wide">
        CORE TEMP: <span className={`tnum ${hot ? 'text-orange-400' : warn ? 'text-amber-300' : 'text-cyan-300'}`}>{t.toFixed(0)}K</span>
      </div>
      <div className="mt-[12px] flex items-center gap-[14px]">
        <AlertTriangle size={44} strokeWidth={1.5} className={hot ? 'blink text-red-500 drop-shadow-[0_0_10px_#ef4444]' : warn ? 'text-amber-400' : 'text-slate-600'} />
        <div className="flex-1">
          <div className="flex h-[44px] gap-[5px]">
            {Array.from({ length: 10 }, (_, i) => {
              const on = i < lit;
              const c = i >= 7 ? '#ef4444' : i >= 5 ? '#f97316' : '#22d3ee';
              return <div key={i} className="flex-1 rounded-[2px]" style={{ background: on ? c : '#1a1414', boxShadow: on ? `0 0 8px ${c}` : undefined, opacity: on ? 1 : 0.6 }} />;
            })}
          </div>
          <div className="mt-[4px] flex justify-between font-mono text-[10px] text-slate-500">
            <span>300K</span>
            <span className="text-red-400/80">750K THROTTLE</span>
            <span>1000K</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AreaChart({ data, min, max, w, h, color, threshold }: { data: number[]; min: number; max: number; w: number; h: number; color: string; threshold?: number }) {
  const path = useMemo(() => {
    if (data.length < 2) return { line: '', area: '' };
    const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * h]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${w},${h} L0,${h} Z` };
  }, [data, min, max, w, h]);
  const id = `g${color.slice(1)}`;
  const ty = threshold !== undefined ? h - ((threshold - min) / (max - min)) * h : 0;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke="#16283a" strokeDasharray="2 3" />
      ))}
      {threshold !== undefined && <line x1={0} x2={w} y1={ty} y2={ty} stroke="#ef4444" strokeDasharray="4 3" opacity={0.6} />}
      <path d={path.area} fill={`url(#${id})`} />
      <path d={path.line} stroke={color} strokeWidth={2} fill="none" />
    </svg>
  );
}

function EmissivityCard({ s }: { s: SimSnapshot }) {
  const worst = Math.min(...s.emissivity);
  const wi = s.emissivity.indexOf(worst);
  return (
    <div className={`${card} flex-1`}>
      <div className="flex items-baseline justify-between whitespace-nowrap text-[19px] tracking-wide">
        <span>
          RADIATOR EMISSIVITY: <span className={`tnum ${worst < 0.6 ? 'text-amber-300' : 'text-cyan-300'}`}>{worst.toFixed(2)}</span>
        </span>
        <span className="font-mono text-[11px] text-slate-500">WING {wi}</span>
      </div>
      <div className="mt-auto flex gap-[6px] pt-[8px]">
        <div className="flex h-[178px] flex-col justify-between font-mono text-[10px] text-slate-500">
          <span>0.9</span>
          <span>0.6</span>
          <span>0.3</span>
        </div>
        <AreaChart data={s.history.eps} min={0.3} max={0.95} w={272} h={178} color="#fbbf24" threshold={0.6} />
      </div>
      <div className="mt-[4px] font-mono text-[10px] text-slate-500">LAST 30 s · DUST {(s.dust[wi] * 100).toFixed(0)}% ON WING {wi}</div>
    </div>
  );
}

function PowerCard({ s }: { s: SimSnapshot }) {
  const w = 272;
  const h = 158;
  const amp = (s.pe / 40_000) * (h / 2 - 6);
  const phase = s.tick * 0.9;
  const wave = Array.from({ length: 120 }, (_, i) => {
    const x = (i / 119) * w;
    const y = h / 2 - amp * Math.sin((i / 119) * Math.PI * 2 * 6 + phase) * (0.85 + 0.15 * Math.sin(i * 0.37 + phase));
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div className={`${card} flex-1`}>
      <div className="flex items-baseline justify-between whitespace-nowrap text-[19px] tracking-wide">
        <span>
          POWER OUTPUT: <span className={`tnum ${s.throttled ? 'text-amber-300' : 'text-cyan-300'}`}>{(s.pe / 1000).toFixed(1)} kWe</span>
        </span>
        {s.throttled && <span className="blink font-mono text-[11px] text-red-400">THROTTLED</span>}
      </div>
      <div className="mt-auto flex gap-[6px] pt-[8px]">
        <div className="flex h-[158px] flex-col justify-between font-mono text-[10px] text-slate-500">
          <span>+40</span>
          <span>0</span>
          <span>−40</span>
        </div>
        <svg width={w} height={h}>
          <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#16283a" />
          <path d={wave} stroke="#22d3ee" strokeWidth={1.8} fill="none" style={{ filter: 'drop-shadow(0 0 3px #22d3ee)' }} />
        </svg>
      </div>
      <div className="mt-[4px] font-mono text-[10px] text-slate-500">STIRLING EFFICIENCY {(s.stirlingEff * 100).toFixed(1)}% OF 175 kWt</div>
    </div>
  );
}

type Tone = 'ok' | 'idle' | 'warn' | 'bad';
const TONE: Record<Tone, string> = { ok: '#4ade80', idle: '#94a3b8', warn: '#fbbf24', bad: '#f87171' };

/** The three defense-in-depth layers the story walks through: net, drills, crew. */
function DefenseCard({ s }: { s: SimSnapshot }) {
  const drillsKw = s.triage.alloc.drills / 1000;
  const lifeKw = s.triage.alloc.life / 1000;
  const lifePct = Math.round((s.triage.alloc.life / LOAD_NOMINAL.life) * 100);
  const rows: { label: string; value: string; tone: Tone }[] = [
    {
      label: 'PERIMETER MESH NET',
      value: s.netFault ? 'MALFUNCTION (OFFLINE)' : s.netOn ? 'AUTO-ACTIVE (85% DEFLECTION)' : 'STANDBY',
      tone: s.netFault ? 'bad' : s.netOn ? 'ok' : 'idle',
    },
    {
      label: 'ICE DRILL RIGS (ISRU)',
      value: s.triage.failsafe
        ? 'DISABLED - FAILSAFE TRIAGE (0.0 kW)'
        : drillsKw < LOAD_NOMINAL.drills / 1000 - 0.5
          ? `REDUCED (${drillsKw.toFixed(1)} kW)`
          : `ACTIVE (${drillsKw.toFixed(1)} kW)`,
      tone: s.triage.failsafe ? 'bad' : drillsKw < 15.5 ? 'warn' : 'ok',
    },
    {
      label: 'HABITAT LIFE SUPPORT',
      value: `${lifeKw.toFixed(1)} kW (${lifePct}% PROTECTED)`,
      tone: lifePct >= 100 ? 'ok' : 'bad',
    },
  ];
  return (
    <div className={card}>
      <div className="text-[19px] tracking-wide">DEFENSE &amp; MINING STATUS</div>
      <div className="mt-[10px] space-y-[8px]">
        {rows.map(({ label, value, tone }) => (
          <div key={label} className="flex items-start gap-[10px] border-b border-edge/60 pb-[7px] last:border-b-0 last:pb-0">
            <span className="mt-[4px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: TONE[tone], boxShadow: `0 0 8px ${TONE[tone]}` }} />
            <div className="min-w-0">
              <div className="font-mono text-[10.5px] tracking-wider text-slate-500">{label}</div>
              <div className={`font-mono text-[13px] font-semibold ${tone === 'bad' ? 'blink' : ''}`} style={{ color: TONE[tone] }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeftTelemetry() {
  const s = useSim();
  return (
    <div className="flex min-h-0 flex-col gap-[10px]">
      <CoreTempCard s={s} />
      <EmissivityCard s={s} />
      <PowerCard s={s} />
      <DefenseCard s={s} />
    </div>
  );
}

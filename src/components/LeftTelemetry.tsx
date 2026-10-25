import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { DOSE_LIMIT, MU_REGOLITH, SHIELD_FACTOR, SHIELD_HALF_ANGLE } from '../simulation/constants';
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

/** Explains the habitat dose as its three physical factors: distance, shield, terrain. */
function RadiationCard({ s }: { s: SimSnapshot }) {
  const hab = s.radiation.habitat;
  const inShield = hab.shieldDelta <= SHIELD_HALF_ANGLE;
  const terrain = Math.exp(-MU_REGOLITH * hab.thickness);
  // Log scale 0.01 → 100 rem/yr.
  const pos = (d: number) => Math.min(100, Math.max(0, ((Math.log10(Math.max(d, 0.01)) + 2) / 4) * 100));
  const color = hab.secure ? '#4ade80' : '#f87171';
  const factors: [string, string, string, boolean][] = [
    ['DISTANCE', `${hab.distance.toFixed(0)} m`, '1 / d²', true],
    ['B4C SHIELD', inShield ? `ON TARGET (Δθ ${hab.shieldDelta.toFixed(0)}°)` : `MISSED (Δθ ${hab.shieldDelta.toFixed(0)}°)`, `× ${inShield ? SHIELD_FACTOR.toFixed(2) : '1.00'}`, inShield],
    ['TERRAIN', `${hab.thickness.toFixed(1)} m regolith`, `× ${terrain < 0.01 ? terrain.toExponential(0) : terrain.toFixed(2)}`, hab.thickness > 1],
  ];
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between whitespace-nowrap text-[19px] tracking-wide">
        <span>
          HABITAT DOSE: <span className="tnum" style={{ color }}>{hab.dose.toFixed(2)}</span>
          <span className="text-[13px] text-slate-400"> rem/yr</span>
        </span>
        <span className={`font-mono text-[12px] font-semibold ${hab.secure ? '' : 'blink'}`} style={{ color }}>
          {hab.secure ? 'SECURE' : 'BREACH'}
        </span>
      </div>
      <div className="relative mt-[10px] h-[8px] rounded-[2px] bg-gradient-to-r from-emerald-500/40 via-amber-400/40 to-red-500/50">
        <div className="absolute inset-y-[-4px] w-[2px] bg-white/70" style={{ left: `${pos(DOSE_LIMIT)}%` }} />
        <div className="absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#070d14]" style={{ left: `${pos(hab.dose)}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <div className="relative mt-[3px] h-[12px] font-mono text-[10px] text-slate-500">
        <span className="absolute left-0">0.01</span>
        <span className="absolute -translate-x-1/2 text-slate-300" style={{ left: `${pos(DOSE_LIMIT)}%` }}>
          LIMIT {DOSE_LIMIT}
        </span>
        <span className="absolute right-0">100</span>
      </div>
      <div className="mt-[8px] space-y-[5px] font-mono text-[11px]">
        {factors.map(([k, v, f, good]) => (
          <div key={k} className="flex items-center justify-between border-b border-edge/60 pb-[4px]">
            <span className="w-[84px] text-slate-500">{k}</span>
            <span className={`flex-1 ${good ? 'text-slate-200' : 'text-orange-300'}`}>{v}</span>
            <span className="text-cyan-300 tnum">{f}</span>
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
      <RadiationCard s={s} />
    </div>
  );
}

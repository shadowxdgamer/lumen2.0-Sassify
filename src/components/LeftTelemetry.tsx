import { AlertTriangle, CircleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { P_TH } from '../simulation/constants';
import type { SimSnapshot } from '../simulation/physicsEngine';
import { useSim } from '../simulation/store';
import { RadialGauge } from './Panel';

const card = 'panel px-[14px] py-[10px]';

function SensorMatrix({ s }: { s: SimSnapshot }) {
  // Columns: wing manifold temps, wing dust per panel segment, sensor health.
  const cols = [
    s.wingTemps.flatMap((t) => [t, t, t].map((x) => (x - 300) / 650)),
    s.dust.flatMap((d) => [d, d * 0.9, d * 1.05]),
    s.quadTemps.flatMap((t) => [t, t, t].map((x) => (x - 300) / 650)),
  ];
  // Share of the 100 ms tick budget spent in physics + CV (real measured time).
  const load = Math.min(100, s.physicsMs + s.cvMs);
  return (
    <div className={`${card} flex gap-[12px]`}>
      <div className="flex flex-1 gap-[10px]">
        {['WING T', 'DUST', 'CORE Q'].map((name, ci) => (
          <div key={name} className="flex flex-1 flex-col">
            <span className="mb-[4px] font-mono text-[9px] text-slate-500">{name}</span>
            <div className="grid grid-cols-4 gap-[2px]">
              {Array.from({ length: 48 }, (_, k) => {
                const row = Math.floor(k / 4);
                const v = cols[ci][row % 12] ?? 0;
                const lit = (k % 4) / 4 < v + 0.05 * Math.sin(s.tick * 0.7 + k);
                const hot = v > 0.6;
                return <span key={k} className="h-[5px]" style={{ background: lit ? (hot ? '#f97316' : '#5b7b95') : '#132231' }} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex w-[96px] flex-col items-center">
        <span className="self-end font-mono text-[9px] text-slate-500">{load.toFixed(1)}%</span>
        <RadialGauge value={load} min={0} max={10} size={78} label="CPU" warnFrom={8} />
        <div className="mt-[2px] w-full space-y-[3px]">
          {[s.physicsMs / 2, s.cvMs / 10, s.netOn ? 1 : 0.15].map((v, i) => (
            <div key={i} className="h-[3px] bg-[#132231]">
              <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, v * 100)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoreTempCard({ s }: { s: SimSnapshot }) {
  const t = s.coreTemp;
  const lit = Math.round(((t - 300) / 700) * 10);
  const hot = t > 750;
  const warn = t > 650;
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div className="whitespace-nowrap text-[21px] tracking-wide">
          CORE TEMP: <span className={`tnum ${hot ? 'text-orange-400' : warn ? 'text-amber-300' : 'text-cyan-300'}`}>{t.toFixed(0)}K</span>
        </div>
        <CircleAlert size={22} className={hot ? 'text-red-500' : 'text-slate-600'} />
      </div>
      <div className="mt-[10px] flex items-center gap-[14px]">
        <AlertTriangle size={46} strokeWidth={1.6} className={hot ? 'blink text-red-500 drop-shadow-[0_0_10px_#ef4444]' : warn ? 'text-amber-400' : 'text-slate-600'} />
        <div className="flex-1">
          <div className="flex h-[44px] gap-[5px]">
            {Array.from({ length: 10 }, (_, i) => {
              const on = i < lit;
              const c = i >= 7 ? '#ef4444' : i >= 5 ? '#f97316' : '#22d3ee';
              return <div key={i} className="flex-1 rounded-[2px]" style={{ background: on ? c : '#1a1414', boxShadow: on ? `0 0 8px ${c}` : undefined, opacity: on ? 1 : 0.6 }} />;
            })}
          </div>
          <div className="mt-[3px] flex justify-between font-mono text-[9px] text-slate-500">
            <span>300K</span>
            <span className="text-amber-500/80">650</span>
            <span className="text-red-400/80">750 THR</span>
            <span>1000K</span>
          </div>
        </div>
      </div>
      <div className="mt-[4px] font-mono text-[10px] text-slate-500">
        HOT-CHANNEL Q{s.quadTemps.indexOf(Math.max(...s.quadTemps))} · Q {s.quadTemps.map((q) => q.toFixed(0)).join('/')} K
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
      {threshold !== undefined && (
        <line x1={0} x2={w} y1={h - ((threshold - min) / (max - min)) * h} y2={h - ((threshold - min) / (max - min)) * h} stroke="#ef4444" strokeDasharray="4 3" opacity={0.6} />
      )}
      <path d={path.area} fill={`url(#${id})`} />
      <path d={path.line} stroke={color} strokeWidth={2} fill="none" />
    </svg>
  );
}

function EmissivityCard({ s }: { s: SimSnapshot }) {
  const worst = Math.min(...s.emissivity);
  const wi = s.emissivity.indexOf(worst);
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between whitespace-nowrap text-[18px] tracking-wide">
        <span>
          RADIATOR EMISSIVITY: <span className={`tnum ${worst < 0.6 ? 'text-amber-300' : 'text-cyan-300'}`}>{worst.toFixed(2)}</span>
        </span>
        <span className="font-mono text-[10px] text-slate-500">W{wi}</span>
      </div>
      <div className="mt-[6px] flex gap-[6px]">
        <div className="flex h-[92px] flex-col justify-between font-mono text-[9px] text-slate-500">
          <span>0.9</span>
          <span>0.7</span>
          <span>0.5</span>
          <span>0.3</span>
        </div>
        <AreaChart data={s.history.eps} min={0.3} max={0.95} w={252} h={92} color="#fbbf24" threshold={0.6} />
      </div>
      <div className="mt-[4px] flex justify-between font-mono text-[9.5px] text-slate-400">
        {s.emissivity.map((e, i) => (
          <span key={i} className={e < 0.6 ? 'text-amber-300' : ''}>
            W{i} {e.toFixed(2)}/{(s.dust[i] * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function PowerCard({ s }: { s: SimSnapshot }) {
  const w = 252;
  const h = 84;
  const amp = (s.pe / 40_000) * (h / 2 - 6);
  const phase = s.tick * 0.9;
  const wave = Array.from({ length: 120 }, (_, i) => {
    const x = (i / 119) * w;
    const y = h / 2 - amp * Math.sin((i / 119) * Math.PI * 2 * 6 + phase) * (0.85 + 0.15 * Math.sin(i * 0.37 + phase));
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between whitespace-nowrap text-[19px] tracking-wide">
        <span>
          POWER OUTPUT: <span className={`tnum ${s.throttled ? 'text-amber-300' : 'text-cyan-300'}`}>{(s.pe / 1000).toFixed(1)} kWe</span>
        </span>
        {s.throttled && <span className="blink font-mono text-[10px] text-red-400">THROTTLED</span>}
      </div>
      <div className="mt-[6px] flex gap-[6px]">
        <div className="flex h-[84px] flex-col justify-between font-mono text-[9px] text-slate-500">
          <span>+40</span>
          <span>0</span>
          <span>−40</span>
        </div>
        <svg width={w} height={h}>
          <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#16283a" />
          {[0.25, 0.75].map((f) => (
            <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke="#16283a" strokeDasharray="2 3" />
          ))}
          <path d={wave} stroke="#22d3ee" strokeWidth={1.8} fill="none" style={{ filter: 'drop-shadow(0 0 3px #22d3ee)' }} />
        </svg>
      </div>
      <div className="mt-[2px] flex justify-between font-mono text-[9.5px] text-slate-400">
        <span>ALTERNATOR 60 Hz</span>
        <span>P_th {(P_TH / 1000).toFixed(0)} kWt</span>
        <span>η {(s.stirlingEff * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function StirlingGauge({ s }: { s: SimSnapshot }) {
  const prad = s.pRad.reduce((a, b) => a + b, 0) / 1000;
  const rows: [string, string, boolean][] = [
    ['STIRLING η', `${(s.stirlingEff * 100).toFixed(1)}%`, s.throttled],
    ['CORE TEMP', `${s.coreTemp.toFixed(0)} K`, s.coreTemp > 750],
    ['RADIATOR ΣP', `${prad.toFixed(1)} kW`, false],
    ['SHADOW', s.radiation.habitat.secure ? 'SECURE' : 'BREACH', !s.radiation.habitat.secure],
    ['STABILIZER', s.throttled ? 'THROTTLE' : 'FULL', s.throttled],
    ['WATER LINE', `${s.pipeTemp.toFixed(1)} K`, s.pipeTemp < 276],
  ];
  const bars = [s.pe / 40_000, prad / 180];
  return (
    <div className={`${card} flex flex-1 items-center gap-[10px]`}>
      <div className="flex h-[150px] gap-[6px]">
        {bars.map((v, i) => (
          <div key={i} className="flex w-[14px] flex-col-reverse gap-[2px]">
            {Array.from({ length: 18 }, (_, k) => (
              <span key={k} className="h-[6px]" style={{ background: k / 18 < v ? '#22d3ee' : '#132231', opacity: k / 18 < v ? 0.5 + k / 36 : 1 }} />
            ))}
          </div>
        ))}
      </div>
      <RadialGauge value={s.pe / 1000} min={0} max={45} size={136} label={`${(s.pe / 1000).toFixed(1)}`} unit="kWe" warnFrom={40} />
      <div className="flex flex-1 flex-col gap-[5px] font-mono text-[10px]">
        {rows.map(([k, v, bad]) => (
          <div key={k} className="border-b border-edge/60 pb-[2px]">
            <div className="text-slate-500">{k}</div>
            <div className={`tnum ${bad ? 'text-orange-400' : 'text-slate-200'}`}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeftTelemetry() {
  const s = useSim();
  return (
    <div className="flex min-h-0 flex-col gap-[8px]">
      <SensorMatrix s={s} />
      <CoreTempCard s={s} />
      <EmissivityCard s={s} />
      <PowerCard s={s} />
      <StirlingGauge s={s} />
    </div>
  );
}

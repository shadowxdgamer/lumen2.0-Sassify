import { Maximize2, Minus, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface PanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  windowControls?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, right, windowControls, className = '', bodyClassName = '', children }: PanelProps) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      <header className="flex h-[30px] shrink-0 items-center justify-between border-b border-edge/80 bg-[#0c1823] px-[12px]">
        <h2 className="panel-title text-[15px] font-medium text-slate-100">
          {title}
          {subtitle && <span className="text-slate-400"> {subtitle}</span>}
        </h2>
        <div className="flex items-center gap-[10px] text-slate-500">
          {right}
          {windowControls && (
            <>
              <Minus size={12} />
              <Maximize2 size={11} />
              <X size={12} />
            </>
          )}
        </div>
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Segmented LED bar meter. */
export function SegmentBar({ value, max, segments, color, dim = '#132231', demand }: { value: number; max: number; segments: number; color: string; dim?: string; demand?: number }) {
  const lit = Math.round((Math.max(0, value) / max) * segments);
  const want = demand !== undefined ? Math.round((demand / max) * segments) : 0;
  return (
    <div className="flex h-full gap-[3px]">
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px] transition-colors duration-200"
          style={{
            background: i < lit ? color : i < want ? `${color}33` : dim,
            boxShadow: i < lit ? `0 0 6px ${color}88` : undefined,
            outline: i >= lit && i < want ? `1px solid ${color}66` : undefined,
            outlineOffset: -1,
          }}
        />
      ))}
    </div>
  );
}

/** Semi-circular radial gauge drawn in SVG. */
export function RadialGauge({ value, min, max, size, label, unit, warnFrom, color = '#22d3ee' }: { value: number; min: number; max: number; size: number; label?: string; unit?: string; warnFrom?: number; color?: string }) {
  const r = size * 0.4;
  const c = size / 2;
  const a0 = Math.PI * 0.8;
  const a1 = Math.PI * 2.2;
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const ang = a0 + (a1 - a0) * t;
  const pt = (a: number, rr: number) => [c + Math.cos(a) * rr, c + Math.sin(a) * rr];
  const arc = (from: number, to: number, rr: number) => {
    const [x0, y0] = pt(from, rr);
    const [x1, y1] = pt(to, rr);
    return `M ${x0} ${y0} A ${rr} ${rr} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const warnA = warnFrom !== undefined ? a0 + (a1 - a0) * ((warnFrom - min) / (max - min)) : a1;
  const [nx, ny] = pt(ang, r * 0.92);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={arc(a0, a1, r)} stroke="#15283a" strokeWidth={size * 0.07} fill="none" />
      <path d={arc(a0, Math.min(ang, warnA), r)} stroke={color} strokeWidth={size * 0.07} fill="none" />
      {warnFrom !== undefined && <path d={arc(warnA, a1, r)} stroke="#ef4444" strokeWidth={size * 0.07} fill="none" opacity={0.75} />}
      {Array.from({ length: 21 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / 20;
        const [x0, y0] = pt(a, r * 1.12);
        const [x1, y1] = pt(a, r * (i % 5 ? 1.18 : 1.24));
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#4b6478" strokeWidth={1} />;
      })}
      <line x1={c} y1={c} x2={nx} y2={ny} stroke="#fbbf24" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={c} cy={c} r={size * 0.045} fill="#0b141e" stroke="#fbbf24" strokeWidth={1.5} />
      {label && (
        <text x={c} y={c + r * 0.55} textAnchor="middle" fontSize={size * 0.11} fill="#e2e8f0" fontFamily="var(--font-mono)">
          {label}
        </text>
      )}
      {unit && (
        <text x={c} y={c + r * 0.82} textAnchor="middle" fontSize={size * 0.075} fill="#94a3b8">
          {unit}
        </text>
      )}
    </svg>
  );
}

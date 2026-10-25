import type { ReactNode } from 'react';

interface PanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, right, className = '', bodyClassName = '', children }: PanelProps) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      <header className="flex h-[30px] shrink-0 items-center justify-between border-b border-edge/80 bg-[#0c1823] px-[12px]">
        <h2 className="panel-title text-[15px] font-medium text-slate-100">
          {title}
          {subtitle && <span className="text-slate-400"> {subtitle}</span>}
        </h2>
        {right && <div className="flex items-center gap-[10px] text-slate-500">{right}</div>}
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
          className="flex-1 rounded-[1px] transition-[background-color] duration-150 ease-out"
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

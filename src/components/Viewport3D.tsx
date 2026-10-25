import { Crosshair, Grid3x3, House, Move3d, Radiation, ScanSearch, ShieldHalf, Tags, Wand2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { SceneController, type HudState } from '../scene/SceneController';
import { command, getView, setView, useSim, useView } from '../simulation/store';
import { Panel } from './Panel';

function ToolButton({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-[36px] w-[36px] items-center justify-center border bg-[#0b141e]/85 text-slate-300 transition-colors hover:border-cyan-300 hover:text-cyan-200"
      style={{ borderColor: active ? '#22d3ee' : '#28465e', color: active ? '#67e8f9' : undefined, boxShadow: active ? '0 0 10px rgba(34,211,238,0.5), inset 0 0 6px rgba(34,211,238,0.3)' : undefined }}
    >
      {children}
    </button>
  );
}

export function Viewport3D() {
  const mount = useRef<HTMLDivElement>(null);
  const compass = useRef<SVGGElement>(null);
  const gizmo = useRef<SVGSVGElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const s = useSim();
  const view = useView();

  useEffect(() => {
    if (!mount.current) return;
    const onHud = (h: HudState) => {
      compass.current?.setAttribute('transform', `rotate(${-h.azimuth} 60 60)`);
      const g = gizmo.current;
      if (g) {
        (['x', 'y', 'z'] as const).forEach((k) => {
          const [x, y] = h.axes[k];
          g.querySelector(`[data-axis="${k}"]`)?.setAttribute('x2', String(40 + x * 28));
          g.querySelector(`[data-axis="${k}"]`)?.setAttribute('y2', String(40 + y * 28));
          const dot = g.querySelector(`[data-dot="${k}"]`);
          dot?.setAttribute('cx', String(40 + x * 28));
          dot?.setAttribute('cy', String(40 + y * 28));
        });
      }
      if (fpsRef.current) fpsRef.current.textContent = `${h.fps.toFixed(0)} FPS`;
    };
    const ctl = new SceneController(mount.current, onHud);
    return () => ctl.dispose();
  }, []);

  const preset = (p: 'orbit' | 'top' | 'habitat' | 'reactor') => setView({ cameraPreset: p, presetNonce: getView().presetNonce + 1 });
  const hab = s.radiation.habitat;

  return (
    <Panel title="3D VIEWPORT" subtitle={<span className="text-slate-400">// THREE.JS ENGINE</span>} windowControls className="min-w-0" bodyClassName="relative overflow-hidden">
      <div ref={mount} className="absolute inset-0" />

      {/* Compass */}
      <svg width="120" height="120" className="pointer-events-none absolute left-[18px] top-[16px]">
        <circle cx="60" cy="60" r="56" fill="rgba(6,14,22,0.55)" stroke="#3b5872" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="44" fill="none" stroke="#1f3447" />
        <g ref={compass}>
          {(['N', 'E', 'S', 'W'] as const).map((d, i) => {
            const a = (i * Math.PI) / 2;
            return (
              <text key={d} x={60 + Math.sin(a) * 47} y={60 - Math.cos(a) * 47 + 4} textAnchor="middle" fontSize="12" fill="#cbd5e1" transform={`rotate(${i * 90} ${60 + Math.sin(a) * 47} ${60 - Math.cos(a) * 47})`}>
                {d}
              </text>
            );
          })}
          <polygon points="60,20 66,60 54,60" fill="#ef4444" />
          <polygon points="60,100 66,60 54,60" fill="#38bdf8" opacity="0.85" />
          <circle cx="60" cy="60" r="5" fill="#0b141e" stroke="#cbd5e1" />
        </g>
      </svg>

      {/* Toolbar */}
      <div className="absolute left-1/2 top-[18px] flex -translate-x-1/2 items-center gap-[8px]">
        <ToolButton title="Orbit view" active={view.cameraPreset === 'orbit'} onClick={() => preset('orbit')}>
          <Move3d size={18} />
        </ToolButton>
        <ToolButton title="Focus reactor" active={view.cameraPreset === 'reactor'} onClick={() => preset('reactor')}>
          <Crosshair size={18} />
        </ToolButton>
        <ToolButton title="Top-down siting view" active={view.cameraPreset === 'top'} onClick={() => preset('top')}>
          <Grid3x3 size={18} />
        </ToolButton>
        <ToolButton title="Habitat view" active={view.cameraPreset === 'habitat'} onClick={() => preset('habitat')}>
          <House size={18} />
        </ToolButton>
        <span className="mx-[4px] h-[24px] w-px bg-slate-700" />
        <ToolButton title="Toggle electrostatic mesh net" active={s.netOn} onClick={() => command((e) => e.setNet(!s.netOn))}>
          <ShieldHalf size={18} />
        </ToolButton>
        <ToolButton title="Toggle radiation cones" active={view.showCones} onClick={() => setView({ showCones: !view.showCones })}>
          <Radiation size={18} />
        </ToolButton>
        <ToolButton title="Toggle 3D callouts" active={view.showLabels} onClick={() => setView({ showLabels: !view.showLabels })}>
          <Tags size={18} />
        </ToolButton>
        <button
          onClick={() => command((e) => e.autoOptimize())}
          className="flex h-[36px] items-center gap-[6px] border border-emerald-400/70 bg-emerald-500/10 px-[10px] text-[12px] tracking-wide text-emerald-200 transition-colors hover:bg-emerald-500/25"
        >
          <Wand2 size={16} /> AUTO-OPTIMIZE SITING
        </button>
      </div>

      {/* Shield azimuth control */}
      <div className="absolute left-1/2 top-[64px] flex -translate-x-1/2 items-center gap-[10px] border border-edge bg-[#0b141e]/85 px-[12px] py-[4px] font-mono text-[11px]">
        <label htmlFor="shield-az" className="text-slate-400">
          B4C SHIELD θ
        </label>
        <input
          id="shield-az"
          type="range"
          min={0}
          max={359}
          value={Math.round(s.shieldAz)}
          onChange={(ev) => command((e) => e.setShield(Number(ev.target.value)))}
          className="hud-range w-[220px]"
          style={{ ['--pct' as string]: `${(s.shieldAz / 359) * 100}%`, ['--fill' as string]: '#facc15' }}
        />
        <span className="w-[36px] text-right text-amber-300 tnum">{s.shieldAz.toFixed(0)}°</span>
      </div>

      {/* XYZ gizmo */}
      <svg ref={gizmo} width="80" height="80" className="pointer-events-none absolute right-[18px] top-[16px]">
        <line data-axis="x" x1="40" y1="40" x2="68" y2="40" stroke="#ef4444" strokeWidth="2.5" />
        <line data-axis="y" x1="40" y1="40" x2="40" y2="12" stroke="#22c55e" strokeWidth="2.5" />
        <line data-axis="z" x1="40" y1="40" x2="30" y2="58" stroke="#3b82f6" strokeWidth="2.5" />
        <circle data-dot="x" cx="68" cy="40" r="6" fill="#ef4444" />
        <circle data-dot="y" cx="40" cy="12" r="6" fill="#22c55e" />
        <circle data-dot="z" cx="30" cy="58" r="6" fill="#3b82f6" />
        <circle cx="40" cy="40" r="4" fill="#cbd5e1" />
      </svg>

      {/* Siting readout */}
      <div className="pointer-events-none absolute bottom-[14px] left-[14px] border border-edge bg-[#0b141e]/85 px-[12px] py-[8px] font-mono text-[11px] leading-[1.55] text-slate-300">
        <div className="text-[10px] tracking-widest text-slate-500">SITING · RAYCAST 36 SECTORS + HABITAT</div>
        <div>
          REACTOR <span className="text-cyan-300 tnum">{(s.reactor.x * 10).toFixed(0)} m E · {(-s.reactor.z * 10).toFixed(0)} m N</span>
        </div>
        <div>
          HABITAT DOSE{' '}
          <span className={`tnum ${hab.secure ? 'text-emerald-300' : 'blink text-red-400'}`}>
            {hab.dose.toFixed(2)} rem/yr {hab.secure ? '< 5 ✓' : '> 5 ✗'}
          </span>
        </div>
        <div className="text-slate-500">
          d {hab.distance.toFixed(0)} m · x {hab.thickness.toFixed(1)} m · S {hab.shieldDelta <= 25 ? '0.04' : '1.00'} · Δθ {hab.shieldDelta.toFixed(0)}°
        </div>
        <div className="text-[10px] text-slate-500">DRAG REACTOR TO MOVE · SHIFT+DRAG TO AIM SHIELD</div>
      </div>

      <div className="absolute bottom-[14px] right-[14px] flex items-center gap-[8px]">
        <span ref={fpsRef} className="font-mono text-[10px] text-slate-500" />
        <ToolButton title="Toggle callouts" active={view.showLabels} onClick={() => setView({ showLabels: !view.showLabels })}>
          <ScanSearch size={18} />
        </ToolButton>
        <ToolButton title="Reset camera" onClick={() => preset('orbit')}>
          <Crosshair size={18} />
        </ToolButton>
      </div>
    </Panel>
  );
}

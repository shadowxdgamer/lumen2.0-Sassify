import { Crosshair, Grid3x3, House, Move3d, Radiation, ShieldHalf, Tags, Wand2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { SceneController, type HudState } from '../scene/SceneController';
import { command, getView, setView, useSim, useView } from '../simulation/store';
import { Panel } from './Panel';

const PRESS = 'transition-[scale,background-color,border-color,color] duration-150 ease-out motion-safe:enabled:active:scale-[0.96]';

function ToolButton({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-[36px] w-[36px] items-center justify-center border border-[#28465e] bg-[#0b141e]/85 text-slate-300 hover:border-cyan-300 hover:text-cyan-200 ${PRESS}`}
      style={active ? { borderColor: '#22d3ee', color: '#67e8f9', boxShadow: '0 0 10px rgba(34,211,238,0.5), inset 0 0 6px rgba(34,211,238,0.3)' } : undefined}
    >
      {children}
    </button>
  );
}

const ICON = { size: 18, strokeWidth: 1.75 } as const;

export function Viewport3D() {
  const mount = useRef<HTMLDivElement>(null);
  const compass = useRef<SVGGElement>(null);
  const s = useSim();
  const view = useView();

  useEffect(() => {
    if (!mount.current) return;
    const onHud = (h: HudState) => compass.current?.setAttribute('transform', `rotate(${-h.azimuth} 60 60)`);
    const ctl = new SceneController(mount.current, onHud);
    return () => ctl.dispose();
  }, []);

  const preset = (p: 'orbit' | 'top' | 'habitat' | 'reactor') => setView({ cameraPreset: p, presetNonce: getView().presetNonce + 1 });

  return (
    <Panel title="3D VIEWPORT" subtitle={<span className="text-slate-400">// THREE.JS ENGINE</span>} className="min-w-0" bodyClassName="relative overflow-hidden">
      <div ref={mount} className="absolute inset-0" />

      {/* Compass */}
      <svg width="120" height="120" className="pointer-events-none absolute left-[18px] top-[16px]" aria-hidden>
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

      {/* Toolbar: cameras | layers | siting */}
      <div className="absolute left-1/2 top-[18px] flex -translate-x-1/2 items-center gap-[8px]">
        <ToolButton title="Orbit view" active={view.cameraPreset === 'orbit'} onClick={() => preset('orbit')}>
          <Move3d {...ICON} />
        </ToolButton>
        <ToolButton title="Focus reactor" active={view.cameraPreset === 'reactor'} onClick={() => preset('reactor')}>
          <Crosshair {...ICON} />
        </ToolButton>
        <ToolButton title="Top-down siting view" active={view.cameraPreset === 'top'} onClick={() => preset('top')}>
          <Grid3x3 {...ICON} />
        </ToolButton>
        <ToolButton title="Habitat view" active={view.cameraPreset === 'habitat'} onClick={() => preset('habitat')}>
          <House {...ICON} />
        </ToolButton>
        <span className="mx-[4px] h-[24px] w-px bg-slate-700" />
        <ToolButton title="Toggle electrostatic mesh net" active={s.netOn} onClick={() => command((e) => e.setNet(!s.netOn))}>
          <ShieldHalf {...ICON} />
        </ToolButton>
        <ToolButton title="Toggle radiation cones" active={view.showCones} onClick={() => setView({ showCones: !view.showCones })}>
          <Radiation {...ICON} />
        </ToolButton>
        <ToolButton title="Toggle 3D callouts" active={view.showLabels} onClick={() => setView({ showLabels: !view.showLabels })}>
          <Tags {...ICON} />
        </ToolButton>
        <span className="mx-[4px] h-[24px] w-px bg-slate-700" />
        <button
          onClick={() => command((e) => e.autoOptimize())}
          className={`flex h-[36px] items-center gap-[6px] border border-emerald-400/70 bg-emerald-500/10 px-[12px] text-[13px] tracking-wide text-emerald-200 hover:bg-emerald-500/25 ${PRESS}`}
        >
          <Wand2 size={16} strokeWidth={1.75} /> AUTO-OPTIMIZE SITING
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

      <div className="pointer-events-none absolute bottom-[12px] left-[14px] font-mono text-[11px] tracking-wide text-slate-500">
        DRAG REACTOR TO MOVE · SHIFT+DRAG TO AIM SHIELD
      </div>
    </Panel>
  );
}

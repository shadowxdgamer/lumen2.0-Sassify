import { Activity, Crosshair, Gauge, LayoutGrid, Menu, Radiation, Rocket, ShieldHalf, Tags } from 'lucide-react';
import { command, getView, setView, useSim, useView } from '../simulation/store';

export function IconRail() {
  const s = useSim();
  const view = useView();
  const items = [
    { icon: Activity, title: 'Telemetry (live)', active: true, onClick: () => {} },
    { icon: Crosshair, title: 'Focus reactor camera', active: false, onClick: () => setView({ cameraPreset: 'reactor', presetNonce: getView().presetNonce + 1 }) },
    { icon: ShieldHalf, title: 'Toggle electrostatic mesh net', active: s.netOn, onClick: () => command((e) => e.setNet(!s.netOn)) },
    { icon: Radiation, title: 'Toggle radiation cones', active: view.showCones, onClick: () => setView({ showCones: !view.showCones }) },
    { icon: Rocket, title: 'Lander plume event (scenario 2)', active: s.plumeActive, onClick: () => command((e) => e.applyScenario(2)) },
    { icon: Gauge, title: 'Orbit camera', active: false, onClick: () => setView({ cameraPreset: 'orbit', presetNonce: getView().presetNonce + 1 }) },
    { icon: Tags, title: 'Toggle 3D callouts', active: view.showLabels, onClick: () => setView({ showLabels: !view.showLabels }) },
    { icon: LayoutGrid, title: 'Top-down siting view', active: false, onClick: () => setView({ cameraPreset: 'top', presetNonce: getView().presetNonce + 1 }) },
  ];
  return (
    <nav className="panel flex flex-col items-center gap-[6px] py-[10px]">
      <Menu size={24} className="mb-[10px] text-slate-400" />
      {items.map(({ icon: Icon, title, active, onClick }) => (
        <button
          key={title}
          title={title}
          aria-label={title}
          onClick={onClick}
          className="relative flex h-[56px] w-full items-center justify-center text-slate-400 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
          style={{ color: active ? '#67e8f9' : undefined, background: active ? 'rgba(34,211,238,0.10)' : undefined }}
        >
          {active && <span className="absolute left-0 top-[8px] h-[40px] w-[3px] bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />}
          <Icon size={22} strokeWidth={1.6} />
        </button>
      ))}
    </nav>
  );
}

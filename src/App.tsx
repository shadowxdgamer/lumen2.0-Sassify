import { useEffect, useState, type ReactNode } from 'react';
import { DiagnosticLog } from './components/DiagnosticLog';
import { EngageButton } from './components/EngageButton';
import { Header } from './components/Header';
import { IconRail } from './components/IconRail';
import { LeftTelemetry } from './components/LeftTelemetry';
import { PowerTriagePanel } from './components/PowerTriagePanel';
import { ScenarioBar } from './components/ScenarioBar';
import { ThermalVisionPanel } from './components/ThermalVisionPanel';
import { TriageSliders } from './components/TriageSliders';
import { Viewport3D } from './components/Viewport3D';
import type { ScenarioId } from './simulation/physicsEngine';
import { command, startSimulation } from './simulation/store';

const DESIGN_W = 1920;
let deepLinked = false;
const DESIGN_H = 1080;

/** Renders the console at a fixed 1920×1080 design size, scaled to fit any window. */
function ScaleToFit({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#070d14]">
      <div style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})`, transformOrigin: 'center center', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    startSimulation();
    // Deep-link a demo state, e.g. ?scenario=2 (useful for rehearsals and judges' Q&A).
    const sc = Number(new URLSearchParams(window.location.search).get('scenario'));
    if (!deepLinked && sc >= 1 && sc <= 4) command((e) => e.applyScenario(sc as ScenarioId));
    deepLinked = true;
  }, []);
  return (
    <ScaleToFit>
      <div className="flex h-full w-full flex-col bg-[#070d14] text-slate-200">
        <Header />
        <ScenarioBar />
        <main className="grid min-h-0 flex-1 grid-cols-[56px_316px_minmax(0,1fr)_372px] gap-[10px] px-[10px] pb-[6px] pt-[8px]">
          <IconRail />
          <LeftTelemetry />
          <Viewport3D />
          <aside className="flex min-h-0 flex-col gap-[8px]">
            <ThermalVisionPanel />
            <PowerTriagePanel />
            <TriageSliders />
            <EngageButton />
            <DiagnosticLog />
          </aside>
        </main>
        <footer className="flex h-[18px] items-center justify-between px-[26px] text-[9px] text-slate-600">
          <div className="flex gap-[3px]">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="h-[4px] w-[10px] -skew-x-[30deg] bg-slate-700/70" />
            ))}
          </div>
          <span className="font-mono tracking-widest">HELIOSCORE 2030 · IEEE LUMEN 2.0 BEYOND 2030 · DETERMINISTIC BROWSER-NATIVE TWIN · NO EXTERNAL ASSETS</span>
          <div className="flex gap-[3px]">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="h-[4px] w-[10px] -skew-x-[30deg] bg-slate-700/70" />
            ))}
          </div>
        </footer>
      </div>
    </ScaleToFit>
  );
}

import { useEffect, useRef } from 'react';
import type { Detection } from '../simulation/physicsEngine';
import { engine, getSnapshot, subscribe } from '../simulation/store';
import { detectAnomaly } from '../vision/anomalyDetector';
import { LUT, T_MAX, T_MIN, tempToIndex } from '../vision/ironbow';
import { THERMAL_H, THERMAL_W, renderThermalFrame } from '../vision/thermalRenderer';
import { Panel } from './Panel';

const K = 3; // overlay canvas supersampling for crisp HUD text
const NEON = '#39ff14';

function drawOverlay(ctx: CanvasRenderingContext2D, det: Detection | null, maxT: number, frame: number, cvMs: number) {
  const W = THERMAL_W * K;
  const H = THERMAL_H * K;
  ctx.clearRect(0, 0, W, H);
  ctx.font = `600 ${11 * K * 0.95}px ui-monospace, Consolas, monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(`TEMP ${maxT.toFixed(0)}K`, 6 * K, 5 * K);
  ctx.font = `${9 * K * 0.95}px ui-monospace, Consolas, monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${(maxT - 273.15).toFixed(1)}°C · LWIR 8–14µm`, 6 * K, 18 * K);

  // Vertical colorbar (40 K → 920 K) with threshold and 35 °C ticks.
  const bx = 244 * K;
  const by0 = 14 * K;
  const by1 = 150 * K;
  for (let y = by0; y < by1; y++) {
    const t = T_MAX - ((y - by0) / (by1 - by0)) * (T_MAX - T_MIN);
    const i = tempToIndex(t) * 3;
    ctx.fillStyle = `rgb(${LUT[i]},${LUT[i + 1]},${LUT[i + 2]})`;
    ctx.fillRect(bx, y, 7 * K, 1);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeRect(bx, by0, 7 * K, by1 - by0);
  const yFor = (t: number) => by0 + ((T_MAX - t) / (T_MAX - T_MIN)) * (by1 - by0);
  ctx.font = `${8 * K * 0.95}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.fillText('920K', bx - 2 * K, by0 - 2 * K);
  ctx.fillStyle = NEON;
  ctx.fillText('AI 690K', bx - 2 * K, yFor(690) - 4 * K);
  ctx.fillRect(bx - 1 * K, yFor(690), 9 * K, K * 0.6);
  ctx.fillStyle = '#fff';
  ctx.fillText('35°C', bx - 2 * K, yFor(308.15) - 4 * K);
  ctx.fillText('40K', bx - 2 * K, by1 - 8 * K);
  ctx.textAlign = 'left';

  // Footer telemetry.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${8 * K * 0.95}px ui-monospace, Consolas, monospace`;
  ctx.fillText(det ? `LOCKED · WING ${det.wing} · ${det.pixels} px · ${cvMs.toFixed(1)} ms` : `SCANNING · FRAME ${frame} · ${cvMs.toFixed(1)} ms`, 6 * K, 160 * K);

  if (!det) return;
  const [x0, y0, x1, y1] = det.bbox;
  const pad = 3;
  const rx = (x0 - pad) * K;
  const ry = (y0 - pad) * K;
  const rw = (x1 - x0 + 2 * pad) * K;
  const rh = (y1 - y0 + 2 * pad) * K;
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(rx, ry, rw, rh);
  // Corner brackets.
  ctx.lineWidth = 4;
  const c = 9 * K;
  for (const [cx, cy, sx, sy] of [
    [rx, ry, 1, 1],
    [rx + rw, ry, -1, 1],
    [rx, ry + rh, 1, -1],
    [rx + rw, ry + rh, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * c, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * c);
    ctx.stroke();
  }
  // Crosshair reticle at the centroid.
  const [mx, my] = [det.centroid[0] * K, det.centroid[1] * K];
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(mx - 14 * K * 0.5, my);
  ctx.lineTo(mx - 4, my);
  ctx.moveTo(mx + 4, my);
  ctx.lineTo(mx + 14 * K * 0.5, my);
  ctx.moveTo(mx, my - 14 * K * 0.5);
  ctx.lineTo(mx, my - 4);
  ctx.moveTo(mx, my + 4);
  ctx.lineTo(mx, my + 14 * K * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, my, 5 * K, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Label above the box.
  const text = `AI THERMAL ANOMALY: DUST ${det.confidence}%`;
  ctx.font = `700 ${9 * K}px ui-monospace, Consolas, monospace`;
  const tw = ctx.measureText(text).width;
  const lx = Math.min(Math.max(2 * K, rx), W - tw - 40 * K);
  const ly = Math.max(28 * K, ry - 14 * K);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(lx - 3 * K, ly - 2 * K, tw + 6 * K, 13 * K);
  ctx.fillStyle = NEON;
  ctx.fillText(text, lx, ly);
}

export function ThermalVisionPanel() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = cvs.current?.getContext('2d', { willReadFrequently: true });
    const octx = hud.current?.getContext('2d');
    if (!ctx || !octx) return;
    const frameBuf = ctx.createImageData(THERMAL_W, THERMAL_H);
    let frame = 0;
    let lastTick = -1;
    const run = () => {
      const s = getSnapshot();
      if (s.tick === lastTick) return;
      lastTick = s.tick;
      frame++;
      // Stage 1: physical temperature field → Ironbow pixels.
      renderThermalFrame(frameBuf.data, s, frame);
      ctx.putImageData(frameBuf, 0, 0);
      // Stage 2: read the real pixel buffer back and run connected-component detection.
      const t0 = performance.now();
      const px = ctx.getImageData(0, 0, THERMAL_W, THERMAL_H);
      const det = detectAnomaly(px.data, THERMAL_W, THERMAL_H, s.qLoop);
      const ms = performance.now() - t0;
      engine.setDetection(det, ms);
      // Stage 3: HUD overlay.
      let maxT = 0;
      for (let i = 0; i < 4; i++) maxT = Math.max(maxT, s.wingTemps[i]);
      drawOverlay(octx, det, Math.max(maxT, s.coreTemp * 0.72), frame, ms);
    };
    run();
    return subscribe(run);
  }, []);

  return (
    <Panel title="INFRARED THERMAL AI VISION" className="shrink-0" right={<span className="font-mono text-[10px] text-slate-500">LIVE PIXEL DETECTOR</span>}>
      <div className="relative m-[8px] h-[240px] overflow-hidden bg-black outline outline-1 -outline-offset-1 outline-white/10">
        <canvas ref={cvs} width={THERMAL_W} height={THERMAL_H} className="absolute inset-0 h-full w-full" />
        <canvas ref={hud} width={THERMAL_W * K} height={THERMAL_H * K} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </Panel>
  );
}

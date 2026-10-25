import { fbm } from '../simulation/terrain';
import { LUT, tempToIndex } from './ironbow';

// Stage 1 — synthetic overhead mast-camera LWIR frame rendered per pixel from
// the physical temperature field of the reactor and its four radiator wings.

export const THERMAL_W = 260;
export const THERMAL_H = 170;
export const CAM_CX = 130;
export const CAM_CY = 86;
const PX_PER_UNIT = 9;
const ROOT = 1.6 * PX_PER_UNIT;
const LENGTH = 7.2 * PX_PER_UNIT;
const HALF_W = 1.15 * PX_PER_UNIT;
const CAP_R = 11;
/** Wing i points at azimuth 225° + 90°·i (wing 0 = SW, toward the landing pad). */
export const wingAzimuth = (i: number) => (225 + 90 * i) % 360;

export interface ThermalInput {
  coreTemp: number;
  wingTemps: number[];
  surfaceTemps: number[];
  dust: number[];
}

const Px = { Background: 0, Cap: 1, Flange: 2, Boom: 3, Header: 4, Riser: 5, Face: 6, Seam: 7 } as const;

interface PixelMap {
  kind: Uint8Array;
  wing: Int8Array;
  u: Float32Array; // 0..1 along wing
  blotch: Float32Array; // dust-pattern threshold value 0..1
  bg: Float32Array; // background temperature [K]
}

let map: PixelMap | null = null;

function buildMap(): PixelMap {
  const n = THERMAL_W * THERMAL_H;
  const m: PixelMap = {
    kind: new Uint8Array(n),
    wing: new Int8Array(n).fill(-1),
    u: new Float32Array(n),
    blotch: new Float32Array(n),
    bg: new Float32Array(n),
  };
  // North-up camera: image x = +X (east), image y = +Z (south), so dir = (sin a, −cos a).
  const dirs = [0, 1, 2, 3].map((i) => {
    const a = (wingAzimuth(i) * Math.PI) / 180;
    return { x: Math.sin(a), y: -Math.cos(a) };
  });
  for (let y = 0; y < THERMAL_H; y++) {
    for (let x = 0; x < THERMAL_W; x++) {
      const p = y * THERMAL_W + x;
      const dx = x - CAM_CX;
      const dy = y - CAM_CY;
      const r = Math.hypot(dx, dy);
      m.bg[p] = 92 + 70 * Math.exp(-(r * r) / (2 * 38 * 38)) + 60 * fbm(x * 0.045, y * 0.045, 4, 101);
      if (r < CAP_R) {
        m.kind[p] = Px.Cap;
        continue;
      }
      if (r < CAP_R + 2.2) {
        m.kind[p] = Px.Flange;
        continue;
      }
      for (let i = 0; i < 4; i++) {
        const u = dx * dirs[i].x + dy * dirs[i].y;
        const v = -dx * dirs[i].y + dy * dirs[i].x;
        if (u < 0) continue;
        if (u < ROOT && Math.abs(v) < 1.6) {
          m.kind[p] = Px.Boom;
          m.wing[p] = i;
          break;
        }
        if (u >= ROOT && u <= ROOT + LENGTH && Math.abs(v) <= HALF_W) {
          const un = (u - ROOT) / LENGTH;
          m.wing[p] = i;
          m.u[p] = un;
          const segPos = (un * 4) % 1;
          if (un < 0.06) m.kind[p] = Px.Header;
          else if ([0, 0.55, -0.55].some((k) => Math.abs(v - k * HALF_W) < 1.0)) m.kind[p] = Px.Riser;
          else if (segPos < 0.025) m.kind[p] = Px.Seam;
          else m.kind[p] = Px.Face;
          // Blotchy regolith deposit pattern, roughly uniform in [0,1].
          m.blotch[p] = Math.min(1, Math.max(0, 0.5 + 1.7 * fbm(u * 0.16 + i * 13.1, v * 0.16 + i * 7.3, 4, 211)));
          break;
        }
      }
    }
  }
  return m;
}

/** Deterministic Gaussian noise (mulberry32 + Box–Muller). */
function makeRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    const u = Math.max(1e-9, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
}

/** Physical temperature of one pixel [K]. */
function pixelTemp(m: PixelMap, p: number, s: ThermalInput): number {
  const w = m.wing[p];
  switch (m.kind[p]) {
    case Px.Cap:
      return 120 + 0.42 * (s.coreTemp - 120); // B4C shadow-shield cap occludes the core
    case Px.Flange:
      return 0.72 * s.coreTemp;
    case Px.Boom:
    case Px.Header:
      return s.wingTemps[w];
    case Px.Riser:
      return s.wingTemps[w] - (s.wingTemps[w] - s.surfaceTemps[w]) * 0.12 * m.u[p];
    case Px.Seam:
      return s.surfaceTemps[w] - 6;
    case Px.Face: {
      const tw = s.wingTemps[w];
      const ts = s.surfaceTemps[w];
      // Dust-covered pixels show the cool blanket surface; gaps expose the hot substrate.
      if (m.blotch[p] < s.dust[w]) return ts;
      return ts + (tw - ts) * (0.92 - 0.25 * m.u[p]);
    }
    default:
      return m.bg[p];
  }
}

/** Renders one RGBA thermal frame into `out` (length W·H·4). */
export function renderThermalFrame(out: Uint8ClampedArray, s: ThermalInput, frame: number, noiseK = 5): void {
  if (!map) map = buildMap();
  const gauss = makeRng(frame * 7919 + 17);
  const n = THERMAL_W * THERMAL_H;
  for (let p = 0; p < n; p++) {
    const t = pixelTemp(map, p, s) + gauss() * noiseK;
    const li = tempToIndex(t) * 3;
    const o = p * 4;
    out[o] = LUT[li];
    out[o + 1] = LUT[li + 1];
    out[o + 2] = LUT[li + 2];
    out[o + 3] = 255;
  }
}

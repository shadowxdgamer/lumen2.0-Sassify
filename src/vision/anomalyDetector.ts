import type { Detection } from '../simulation/physicsEngine';
import { invertDust } from '../simulation/thermal';
import { pixelTemp } from './ironbow';
import { CAM_CX, CAM_CY, wingAzimuth } from './thermalRenderer';

// Stage 2 — classical computer vision on the raw RGBA buffer:
// radiometric decode → temperature threshold → 3×3 dilation → BFS 4-connected
// components → largest blob → bbox / centroid / wing → physics-informed dust inversion.

/** Healthy wings run ≈ 370–400 K; anything above this is a heat-rejection anomaly. */
export const HOT_K = 470;
const MIN_PIXELS = 25;

export function detectAnomaly(data: Uint8ClampedArray, w: number, h: number, qLoop: number[]): Detection | null {
  const n = w * h;
  const temp = new Float32Array(n);
  const hot = new Uint8Array(n);
  let any = 0;
  for (let p = 0; p < n; p++) {
    temp[p] = pixelTemp(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    if (temp[p] > HOT_K) {
      hot[p] = 1;
      any++;
    }
  }
  if (any < MIN_PIXELS) return null;

  // Morphological dilation bridges the gaps between dust blotches.
  const mask = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!hot[y * w + x]) continue;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= h) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = x + ox;
          if (xx >= 0 && xx < w) mask[yy * w + xx] = 1;
        }
      }
    }
  }

  // Connected-component labelling (BFS, 4-connectivity); keep the largest.
  const label = new Int32Array(n);
  const queue = new Int32Array(n);
  let next = 0;
  let best = { id: 0, size: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  for (let start = 0; start < n; start++) {
    if (!mask[start] || label[start]) continue;
    const id = ++next;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = id;
    let size = 0;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      size++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = id; queue[tail++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = id; queue[tail++] = p + 1; }
      if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = id; queue[tail++] = p - w; }
      if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = id; queue[tail++] = p + w; }
    }
    if (size > best.size) best = { id, size, minX, minY, maxX, maxY };
  }
  if (best.size < MIN_PIXELS) return null;

  // Centroid + decoded temperatures of the original hot pixels inside the blob.
  let sx = 0;
  let sy = 0;
  let count = 0;
  const temps: number[] = [];
  for (let p = 0; p < n; p++) {
    if (label[p] !== best.id || !hot[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    sx += x;
    sy += y;
    count++;
    temps.push(temp[p]);
  }
  if (count < MIN_PIXELS) return null;
  temps.sort((a, b) => a - b);
  const peakTemp = temps[Math.floor(temps.length * 0.9)];
  const cx = sx / count;
  const cy = sy / count;

  // Which wing? Azimuth of the centroid around the camera boresight.
  const az = ((Math.atan2(cx - CAM_CX, -(cy - CAM_CY)) * 180) / Math.PI + 360) % 360;
  let wing = 0;
  let bestDiff = 999;
  for (let i = 0; i < 4; i++) {
    const d = Math.abs((((az - wingAzimuth(i)) % 360) + 540) % 360 - 180);
    if (d < bestDiff) {
      bestDiff = d;
      wing = i;
    }
  }

  // Physics-informed inversion: which dust fraction explains the measured
  // manifold temperature given the loop heat-meter reading?
  const estDust = invertDust(Math.max(qLoop[wing], 1000), peakTemp);
  return {
    wing,
    bbox: [best.minX, best.minY, best.maxX, best.maxY],
    centroid: [Math.round(cx), Math.round(cy)],
    areaRatio: count / n,
    pixels: count,
    peakTemp,
    estDust,
    confidence: Math.min(99, Math.round(estDust * 100)),
  };
}

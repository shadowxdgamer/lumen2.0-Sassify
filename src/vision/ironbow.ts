// Ironbow false-colour palette for the synthetic LWIR camera.
// 40 K (deep indigo) → magenta/red structure → 920 K (yellow-white).

export const T_MIN = 40;
export const T_MAX = 920;

const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 8, 2, 32],
  [0.15, 40, 6, 110],
  [0.3, 95, 10, 150],
  [0.45, 165, 25, 140],
  [0.6, 215, 60, 80],
  [0.72, 240, 120, 30],
  [0.82, 252, 175, 20],
  [0.92, 255, 225, 90],
  [1.0, 255, 252, 230],
];

/** 256-entry RGB lookup table, packed as [r,g,b, r,g,b, ...]. */
export const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
    const [t0, r0, g0, b0] = STOPS[k];
    const [t1, r1, g1, b1] = STOPS[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    lut[i * 3] = r0 + (r1 - r0) * f;
    lut[i * 3 + 1] = g0 + (g1 - g0) * f;
    lut[i * 3 + 2] = b0 + (b1 - b0) * f;
  }
  return lut;
})();

export function tempToIndex(t: number): number {
  const n = (t - T_MIN) / (T_MAX - T_MIN);
  return Math.max(0, Math.min(255, Math.round(n * 255)));
}

export const indexToTemp = (i: number) => T_MIN + (i / 255) * (T_MAX - T_MIN);

/** Decodes an RGB pixel back to temperature by nearest palette entry. */
export function decodeTemp(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < 256; i++) {
    const dr = r - LUT[i * 3];
    const dg = g - LUT[i * 3 + 1];
    const db = b - LUT[i * 3 + 2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return indexToTemp(best);
}

export function cssColorForTemp(t: number): string {
  const i = tempToIndex(t) * 3;
  return `rgb(${LUT[i]},${LUT[i + 1]},${LUT[i + 2]})`;
}

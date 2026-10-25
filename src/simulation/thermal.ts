import { R_DUST_FULL, SIGMA, T_SINK, WING_AREA, emissivity } from './constants';

/**
 * Solves the massless dust layer: conduction through the blanket equals
 * Stefan–Boltzmann radiation from its surface.
 *   (T_w − T_s) / (D·R) = ε(D)·σ·A·(T_s⁴ − T_sink⁴)
 * Returns the dust-surface temperature T_s.
 */
export function solveSurfaceTemp(tWing: number, dust: number): number {
  const r = dust * R_DUST_FULL;
  if (r < 1e-9 || tWing <= T_SINK) return Math.max(tWing, T_SINK);
  const k = emissivity(dust) * SIGMA * WING_AREA;
  let lo = T_SINK;
  let hi = tWing;
  for (let i = 0; i < 48; i++) {
    const mid = 0.5 * (lo + hi);
    const f = (tWing - mid) / r - k * (mid ** 4 - T_SINK ** 4);
    if (f > 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Heat radiated by a wing into vacuum [W]. */
export function radiatedPower(tSurface: number, dust: number): number {
  return emissivity(dust) * SIGMA * WING_AREA * (tSurface ** 4 - T_SINK ** 4);
}

/**
 * Forward model used by the vision inversion: the steady manifold
 * temperature a wing needs to reject heat Q with dust fraction D.
 */
export function manifoldTempFor(q: number, dust: number): number {
  const k = emissivity(dust) * SIGMA * WING_AREA;
  const tSurf = Math.pow(Math.max(q, 0) / k + T_SINK ** 4, 0.25);
  return tSurf + q * dust * R_DUST_FULL;
}

/** Inverts manifoldTempFor for D by bisection (monotonic in D). */
export function invertDust(q: number, tMeasured: number): number {
  let lo = 0;
  let hi = 1;
  if (manifoldTempFor(q, 1) <= tMeasured) return 1;
  if (manifoldTempFor(q, 0) >= tMeasured) return 0;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    if (manifoldTempFor(q, mid) < tMeasured) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

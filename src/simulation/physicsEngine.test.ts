import { describe, expect, it } from 'vitest';
import { detectAnomaly } from '../vision/anomalyDetector';
import { THERMAL_H, THERMAL_W, renderThermalFrame } from '../vision/thermalRenderer';
import { FREEZE_K, LIFE_FLOOR, emissivity } from './constants';
import { PhysicsEngine, type SimSnapshot } from './physicsEngine';

function run(e: PhysicsEngine, seconds: number, withVision = false) {
  const buf = new Uint8ClampedArray(THERMAL_W * THERMAL_H * 4);
  for (let i = 0; i < seconds * 10; i++) {
    e.step(0.1);
    if (withVision) {
      const s = e.snapshot();
      renderThermalFrame(buf, s, i);
      e.setDetection(detectAnomaly(buf, THERMAL_W, THERMAL_H, s.qLoop));
    }
  }
  return e.snapshot();
}

const worstEps = (s: SimSnapshot) => Math.min(...s.emissivity);

describe('emissivity model', () => {
  it('matches the locked calibration points', () => {
    expect(emissivity(0.89)).toBeCloseTo(0.42, 2);
    expect(emissivity(0.02)).toBeCloseTo(0.89, 2);
  });
});

describe('PhysicsEngine thermal calibration', () => {
  it('nominal baseline ≈ 410 K / 40.0 kWe / ε 0.89', () => {
    const s = run(new PhysicsEngine(), 5);
    expect(s.coreTemp).toBeGreaterThan(400);
    expect(s.coreTemp).toBeLessThan(420);
    expect(s.pe).toBeCloseTo(40_000, -2);
    expect(worstEps(s)).toBeCloseTo(0.89, 2);
    expect(s.status).toBe('NOMINAL');
  });

  it('dust crisis climbs to ≈ 920 K and throttles to 24.5 kWe', () => {
    const e = new PhysicsEngine();
    e.applyScenario(2);
    const s = run(e, 40);
    expect(s.dust[0]).toBeCloseTo(0.89, 2);
    expect(worstEps(s)).toBeCloseTo(0.42, 2);
    expect(s.throttled).toBe(true);
    expect(s.pe).toBeCloseTo(24_500, -2);
    expect(s.coreTemp).toBeGreaterThan(905);
    expect(s.coreTemp).toBeLessThan(935);
    expect(s.status).toBe('CRITICAL');
  });

  it('proportional brown-out without triage violates the life-support floor', () => {
    const e = new PhysicsEngine();
    e.applyScenario(2);
    const s = run(e, 30);
    expect(s.triage.brownout).toBe(true);
    expect(s.triage.alloc.life).toBeLessThan(LIFE_FLOOR);
  });
});

describe('thermal vision detector', () => {
  it('finds no anomaly in the nominal frame', () => {
    const e = new PhysicsEngine();
    const s = run(e, 2);
    const buf = new Uint8ClampedArray(THERMAL_W * THERMAL_H * 4);
    renderThermalFrame(buf, s, 1);
    expect(detectAnomaly(buf, THERMAL_W, THERMAL_H, s.qLoop)).toBeNull();
  });

  it('locks onto wing 0 with ≈ 89 % dust confidence during the crisis', () => {
    const e = new PhysicsEngine();
    e.applyScenario(2);
    const s = run(e, 40);
    const buf = new Uint8ClampedArray(THERMAL_W * THERMAL_H * 4);
    renderThermalFrame(buf, s, 3);
    const det = detectAnomaly(buf, THERMAL_W, THERMAL_H, s.qLoop);
    expect(det).not.toBeNull();
    expect(det!.wing).toBe(0);
    expect(det!.confidence).toBeGreaterThanOrEqual(85);
    expect(det!.confidence).toBeLessThanOrEqual(93);
    // Wing 0 points south-west → lower-left of the camera frame.
    expect(det!.centroid[0]).toBeLessThan(130);
    expect(det!.centroid[1]).toBeGreaterThan(86);
  });
});

describe('autonomous protection', () => {
  it('EDS (gated on CV lock) clears wing 0, core recovers, triage keeps crew safe', () => {
    const e = new PhysicsEngine();
    e.applyScenario(2);
    run(e, 40, true);
    e.engageProtection();
    const mid = run(e, 7, true);
    expect(mid.netOn).toBe(true);
    expect(mid.dust[0]).toBeLessThanOrEqual(0.021);
    expect(mid.triage.alloc.life).toBeGreaterThanOrEqual(LIFE_FLOOR);
    const total = mid.triage.alloc.life + mid.triage.alloc.comms + mid.triage.alloc.habitat + mid.triage.alloc.science;
    expect(total).toBeLessThanOrEqual(mid.pe + 1);
    const end = run(e, 40, true);
    expect(end.coreTemp).toBeLessThan(420);
    expect(end.throttled).toBe(false);
    expect(end.pipeTemp).toBeGreaterThan(FREEZE_K);
    expect(worstEps(end)).toBeGreaterThan(0.88);
  }, 30_000);

  it('EDS does not fire without a vision lock', () => {
    const e = new PhysicsEngine();
    e.applyScenario(2);
    run(e, 30); // no vision pipeline
    e.engageProtection();
    const s = run(e, 6);
    expect(s.dust[0]).toBeGreaterThan(0.85);
  });
});

describe('radiation siting', () => {
  it('default siting keeps the habitat secure (< 5 rem/yr)', () => {
    const s = new PhysicsEngine().snapshot();
    expect(s.radiation.habitat.secure).toBe(true);
    expect(s.radiation.habitat.dose).toBeLessThan(5);
  });

  it('siting hazard scenario exposes the habitat, auto-optimize fixes it', () => {
    const e = new PhysicsEngine();
    e.applyScenario(4);
    let s = e.snapshot();
    expect(s.radiation.habitat.secure).toBe(false);
    expect(s.radiation.hazardSectors.length).toBeGreaterThan(0);
    e.autoOptimize();
    e.step(0.1);
    s = e.snapshot();
    expect(s.radiation.habitat.secure).toBe(true);
  });
});

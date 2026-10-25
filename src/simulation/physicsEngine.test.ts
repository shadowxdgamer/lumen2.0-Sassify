import { describe, expect, it } from 'vitest';
import { detectAnomaly } from '../vision/anomalyDetector';
import { THERMAL_H, THERMAL_W, renderThermalFrame } from '../vision/thermalRenderer';
import { FREEZE_K, emissivity } from './constants';
import { PhysicsEngine, type SimSnapshot } from './physicsEngine';

const buf = new Uint8ClampedArray(THERMAL_W * THERMAL_H * 4);

/** Steps the engine for `seconds` of wall time, optionally running the vision pipeline each tick. */
function run(e: PhysicsEngine, seconds: number, withVision = false) {
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

function detect(s: SimSnapshot) {
  renderThermalFrame(buf, s, 3);
  return detectAnomaly(buf, THERMAL_W, THERMAL_H, s.qLoop);
}

const worstEps = (s: SimSnapshot) => Math.min(...s.emissivity);
const kW = (w: number) => w / 1000;

describe('emissivity model', () => {
  it('matches the locked calibration points', () => {
    expect(emissivity(0.89)).toBeCloseTo(0.42, 2);
    expect(emissivity(0.02)).toBeCloseTo(0.89, 2);
  });
});

describe('[1] nominal baseline', () => {
  it('runs at ≈ 411 K / 40.0 kWe with drills spinning and the net on standby', () => {
    const s = run(new PhysicsEngine(), 5);
    expect(s.coreTemp).toBeGreaterThan(405);
    expect(s.coreTemp).toBeLessThan(418);
    expect(kW(s.pe)).toBeCloseTo(40, 1);
    expect(worstEps(s)).toBeCloseTo(0.89, 2);
    expect(s.netOn).toBe(false);
    expect(kW(s.triage.alloc.drills)).toBeCloseTo(16, 1);
    expect(kW(s.triage.alloc.life)).toBeCloseTo(10, 1);
    expect(kW(s.triage.alloc.habitat)).toBeCloseTo(9, 1);
    expect(kW(s.triage.alloc.comms)).toBeCloseTo(5, 1);
    expect(s.status).toBe('NOMINAL');
    expect(detect(s)).toBeNull();
  });
});

describe('[2] dust storm with auto-shield', () => {
  it('auto-engages the net, which holds wing 0 to ≈ 29 % and power to ≈ 36.5 kWe', () => {
    const e = new PhysicsEngine();
    e.applyScenario(2);
    expect(e.snapshot().netOn).toBe(true);
    const s = run(e, 40);
    expect(s.dust[0]).toBeGreaterThan(0.27);
    expect(s.dust[0]).toBeLessThan(0.31);
    expect(kW(s.pe)).toBeGreaterThan(35.5);
    expect(kW(s.pe)).toBeLessThan(37.5);
    expect(s.throttled).toBe(false);
    expect(kW(s.triage.alloc.life)).toBeCloseTo(10, 1);
    expect(s.triage.alloc.drills).toBeGreaterThan(0);
    const det = detect(s);
    expect(det?.wing).toBe(0);
    expect(det!.confidence).toBeGreaterThanOrEqual(25);
    expect(det!.confidence).toBeLessThanOrEqual(33);
  });
});

describe('[3] targeted AI EDS cleanse', () => {
  it('fires on the CV-located wing, clears dust and restores 40.0 kWe', () => {
    const e = new PhysicsEngine();
    e.applyScenario(2);
    run(e, 30, true);
    e.applyScenario(3);
    const s = run(e, 25, true);
    expect(s.netOn).toBe(true);
    expect(s.dust[0]).toBeLessThanOrEqual(0.021);
    expect(worstEps(s)).toBeGreaterThan(0.88);
    expect(kW(s.pe)).toBeGreaterThan(39.8);
    expect(s.detection).toBeNull();
  }, 30_000);

  it('preloads the post-storm state when started directly, and does not fire without a lock', () => {
    const e = new PhysicsEngine();
    e.applyScenario(3);
    expect(e.snapshot().dust[0]).toBeGreaterThan(0.25);
    const s = run(e, 3); // no vision pipeline → no lock → no pulse
    expect(s.dust[0]).toBeGreaterThan(0.25);
    expect(s.edsActive).toBe(false);
  });
});

describe('[4] shield malfunction failsafe', () => {
  it('net offline → 89 % fouling, ≈ 920 K, 24.5 kWe, drills disabled, crew loads 100 %', () => {
    const e = new PhysicsEngine();
    e.applyScenario(4);
    const s = run(e, 40);
    expect(s.netFault).toBe(true);
    expect(s.netOn).toBe(false);
    expect(s.dust[0]).toBeCloseTo(0.89, 2);
    expect(worstEps(s)).toBeCloseTo(0.42, 2);
    expect(s.coreTemp).toBeGreaterThan(905);
    expect(s.coreTemp).toBeLessThan(935);
    expect(s.throttled).toBe(true);
    expect(kW(s.pe)).toBeCloseTo(24.5, 1);
    expect(s.triage.failsafe).toBe(true);
    expect(s.triage.alloc.drills).toBe(0);
    expect(kW(s.triage.alloc.life)).toBeCloseTo(10, 1);
    expect(kW(s.triage.alloc.habitat)).toBeCloseTo(9, 1);
    expect(kW(s.triage.alloc.comms)).toBeCloseTo(5, 1);
    expect(s.pipeTemp).toBeGreaterThan(FREEZE_K + 15);
    const det = detect(s);
    expect(det?.wing).toBe(0);
    expect(det!.confidence).toBeGreaterThanOrEqual(85);
    // The faulted net cannot be re-engaged.
    e.setNet(true);
    expect(e.snapshot().netOn).toBe(false);
  });

  it('emergency backup EDS recovers the wing and restores the drills', () => {
    const e = new PhysicsEngine();
    e.applyScenario(4);
    run(e, 30, true);
    e.engageProtection();
    const s = run(e, 30, true);
    expect(s.netFault).toBe(true);
    expect(s.dust[0]).toBeLessThanOrEqual(0.021);
    expect(s.throttled).toBe(false);
    expect(s.triage.failsafe).toBe(false);
    expect(kW(s.triage.alloc.drills)).toBeCloseTo(16, 0);
    expect(s.coreTemp).toBeLessThan(420);
  }, 30_000);
});

describe('radiation model (kept for Q&A, hidden from the pitch view)', () => {
  it('default siting keeps the habitat below 5 rem/yr; turning the shield away breaches it', () => {
    const e = new PhysicsEngine();
    expect(e.snapshot().radiation.habitat.secure).toBe(true);
    e.setShield(225);
    e.step(0.1);
    expect(e.snapshot().radiation.habitat.secure).toBe(false);
    e.autoOptimize();
    e.step(0.1);
    expect(e.snapshot().radiation.habitat.secure).toBe(true);
  });
});

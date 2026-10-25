import {
  C_CORE,
  C_WING,
  CRISIS_DUST,
  DOSE_LIMIT,
  EDS_RATE,
  EDS_TARGET_DUST,
  FREEZE_K,
  G_LATERAL,
  G_LOOP,
  LIFE_FLOOR,
  NET_DEFLECTION,
  NOMINAL_DUST,
  PIPE_BAND_ECO,
  PIPE_BAND_NORMAL,
  PIPE_C,
  PIPE_T_ENV,
  PIPE_U,
  PLUME_RATE,
  P_E_NOMINAL,
  P_E_RAMP,
  P_E_THROTTLED,
  P_TH,
  SUBSTEPS,
  THROTTLE_OFF_K,
  THROTTLE_ON_K,
  TIME_WARP,
  WING_COUNT,
  emissivity,
} from './constants';
import { computeRadiation, optimizeSiting, type RadiationResult } from './radiation';
import { HABITAT_POS, SITING_RADIUS, azimuthDeg } from './terrain';
import { radiatedPower, solveSurfaceTemp } from './thermal';
import { allocatePower, type TriageRequest, type TriageResult } from './triage';

export type ScenarioId = 1 | 2 | 3 | 4;
export type SystemStatus = 'NOMINAL' | 'WARNING' | 'CRITICAL';
export type LogLevel = 'info' | 'ok' | 'warn' | 'crit';

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  msg: string;
}

/** Output of the thermal-vision connected-component detector. */
export interface Detection {
  wing: number;
  bbox: [number, number, number, number]; // minX, minY, maxX, maxY (thermal-canvas px)
  centroid: [number, number];
  areaRatio: number;
  pixels: number;
  peakTemp: number; // K, decoded from pixels
  estDust: number; // physics-informed inversion of the image
  confidence: number; // %
}

export interface SimSnapshot {
  tick: number;
  simTime: number;
  scenario: ScenarioId;
  status: SystemStatus;
  coreTemp: number;
  quadTemps: number[];
  wingTemps: number[];
  surfaceTemps: number[];
  dust: number[];
  emissivity: number[];
  pRad: number[];
  qLoop: number[];
  pe: number;
  throttled: boolean;
  pth: number;
  stirlingEff: number;
  netOn: boolean;
  edsArmed: boolean;
  edsActive: boolean;
  edsWing: number;
  plumeActive: boolean;
  triageAuto: boolean;
  request: TriageRequest;
  triage: TriageResult;
  pipeTemp: number;
  heaterOn: boolean;
  reactor: { x: number; z: number };
  shieldAz: number;
  radiation: RadiationResult;
  detection: Detection | null;
  logs: LogEntry[];
  history: { core: number[]; eps: number[]; pe: number[] };
  physicsMs: number;
  cvMs: number;
}

const HISTORY = 300; // 30 s of 10 Hz samples
const PLUME_DURATION = CRISIS_DUST[0] / PLUME_RATE; // ≈ 2 s

function clockTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export class PhysicsEngine {
  private tick = 0;
  private simTime = 0;
  private scenario: ScenarioId = 1;
  private tq = [410, 410, 410, 410];
  private tw = [371, 371, 371, 371];
  private ts = [371, 371, 371, 371];
  private dust = [NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST];
  private prad = [0, 0, 0, 0];
  private qloop = [0, 0, 0, 0];
  private pe = P_E_NOMINAL;
  private throttled = false;
  private netOn = false;
  private edsArmed = false;
  private edsActive = false;
  private edsWing = -1;
  private armedFor = 0;
  /** Active plume: elapsed wall time and remaining fouling to deposit and final level per wing. */
  private plume: { t: number; target: number[]; final: number[] } | null = null;
  private triageAuto = false;
  private request: TriageRequest = { life: 1, comms: 1, science: 1 };
  private triage: TriageResult;
  private pipeTemp = 291;
  private heaterOn = false;
  private rx = 0;
  private rz = 0;
  private shieldAz = azimuthDeg(HABITAT_POS.x, HABITAT_POS.z);
  private radiation: RadiationResult;
  private radDirty = false;
  private detection: Detection | null = null;
  private missedDetections = 0;
  private logs: LogEntry[] = [];
  private logSeq = 0;
  private flags = new Set<string>();
  private history = { core: [] as number[], eps: [] as number[], pe: [] as number[] };
  private physicsMs = 0;
  private cvMs = 0;

  constructor() {
    this.radiation = computeRadiation(this.rx, this.rz, this.shieldAz);
    this.triage = allocatePower(this.pe, this.heaterOn, this.request, this.triageAuto);
    this.applyScenario(1, true);
    this.log('info', 'HELIOSCORE 2030 digital twin online — 10 Hz coupled physics, TIME_WARP ×120');
    this.log('info', `Terrain heightfield raycaster ready — 36 sectors + habitat vector, habitat ${this.radiation.habitat.dose.toFixed(2)} rem/yr`);
    this.log('info', 'Thermal vision pipeline ready — Ironbow LWIR 260×170, CC detector R>220∧G>130');
    this.log('ok', `NOMINAL: core ${this.coreTemp.toFixed(0)}K · 40.0 kWe · ε 0.89 · water line ${this.pipeTemp.toFixed(1)}K`);
  }

  // ---------------------------------------------------------------- logging
  log(level: LogLevel, msg: string) {
    this.logs.push({ id: ++this.logSeq, time: clockTime(), level, msg });
    if (this.logs.length > 160) this.logs.splice(0, this.logs.length - 160);
  }

  /** Logs once when `cond` becomes true; re-arms when it becomes false. */
  private edge(key: string, cond: boolean, level: LogLevel, msg: () => string, clearMsg?: () => string) {
    if (cond && !this.flags.has(key)) {
      this.flags.add(key);
      this.log(level, msg());
    } else if (!cond && this.flags.has(key)) {
      this.flags.delete(key);
      if (clearMsg) this.log('ok', clearMsg());
    }
  }

  // ---------------------------------------------------------------- commands
  applyScenario(id: ScenarioId, silent = false) {
    this.scenario = id;
    if (id === 1 || id === 4) {
      this.plume = null;
      this.netOn = false;
      this.edsArmed = false;
      this.edsActive = false;
      this.edsWing = -1;
      this.triageAuto = false;
      this.request = { life: 1, comms: 1, science: 1 };
      this.dust = [NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST];
      this.pe = P_E_NOMINAL;
      this.throttled = false;
      this.pipeTemp = 291;
      if (id === 1) {
        this.rx = 0;
        this.rz = 0;
        this.shieldAz = azimuthDeg(HABITAT_POS.x, HABITAT_POS.z);
      } else {
        // Siting hazard: reactor pushed to the NW floor, shield rotated off the habitat bearing.
        this.rx = -7.4;
        this.rz = -5.6;
        this.shieldAz = (azimuthDeg(HABITAT_POS.x - this.rx, HABITAT_POS.z - this.rz) + 140) % 360;
      }
      this.radDirty = true;
      this.settle(4000);
      this.flags.clear();
      if (!silent) {
        this.log('info', id === 1 ? 'SCENARIO 1 — NOMINAL BASELINE: 40.0 kWe, 4 wings clean (D=2%)' : 'SCENARIO 4 — SITING HAZARD TEST: reactor relocated, B4C shield rotated 140° off habitat bearing');
      }
    } else if (id === 2) {
      this.edsArmed = false;
      this.edsActive = false;
      this.netOn = false;
      this.triageAuto = false;
      this.plume = { t: 0, target: CRISIS_DUST.map((d, i) => Math.max(0, d - this.dust[i])), final: [...CRISIS_DUST] };
      this.log('crit', 'SCENARIO 2 — LANDER PLUME EVENT: ejecta cloud inbound on radiator wing 0 (az 225°)');
    } else if (id === 3) {
      if (this.dust[0] < 0.5) {
        // Jump straight to the developed crisis state, then respond.
        this.plume = null;
        this.dust = [...CRISIS_DUST];
        this.pe = P_E_THROTTLED;
        this.throttled = true;
        this.settle(4000);
        this.log('crit', 'SCENARIO 3 — preloading dust crisis state (D0=89%, core ≈920K)');
      }
      this.engageProtection();
    }
    this.refreshDerived();
  }

  engageProtection() {
    this.log('info', 'AUTONOMOUS PROTECTION ENGAGED — net + targeted EDS + survival triage');
    this.setNet(true);
    this.edsArmed = true;
    this.armedFor = 0;
    this.log('info', 'EDS ARMED — awaiting thermal-vision target lock');
    if (!this.triageAuto) {
      this.triageAuto = true;
      this.log('warn', `TRIAGE AUTO: budget ${(this.pe / 1000).toFixed(1)} kWe — priority LIFE > HABITAT(ECO 278–283K) > COMMS > SCIENCE`);
    }
    if (this.scenario !== 3) this.scenario = 3;
  }

  setNet(on: boolean) {
    if (on === this.netOn) return;
    this.netOn = on;
    this.log(on ? 'ok' : 'warn', on ? 'ELECTROSTATIC MESH NET DEPLOYED — 85% charged-dust deflection' : 'ELECTROSTATIC MESH NET RETRACTED');
  }

  setReactorPose(x: number, z: number) {
    const r = Math.hypot(x, z);
    const k = r > SITING_RADIUS ? SITING_RADIUS / r : 1;
    this.rx = x * k;
    this.rz = z * k;
    this.radDirty = true;
  }

  setShield(az: number) {
    this.shieldAz = ((az % 360) + 360) % 360;
    this.radDirty = true;
  }

  autoOptimize() {
    const t0 = performance.now();
    const best = optimizeSiting();
    this.rx = best.x;
    this.rz = best.z;
    this.shieldAz = best.shieldAz;
    this.radDirty = true;
    this.log(
      'ok',
      `AUTO-SITING: (${(best.x * 10).toFixed(0)} m, ${(-best.z * 10).toFixed(0)} m) shield ${best.shieldAz.toFixed(0)}° → habitat ${best.dose.toFixed(2)} rem/yr [${(performance.now() - t0).toFixed(0)} ms raycast search]`,
    );
  }

  setDust(wing: number, value: number) {
    this.plume = null;
    this.dust[wing] = Math.min(1, Math.max(0, value));
  }

  setTriageRequest(partial: Partial<TriageRequest>) {
    this.request = { ...this.request, ...partial };
  }

  setTriageAuto(on: boolean) {
    this.triageAuto = on;
    this.log('info', on ? 'TRIAGE: autonomous priority allocation ON' : 'TRIAGE: manual / proportional mode');
  }

  /** Called by the thermal-vision pipeline every 100 ms. */
  setDetection(det: Detection | null, cvMs = 0) {
    this.cvMs = cvMs;
    if (det) {
      this.missedDetections = 0;
      if (!this.detection) {
        const [a, b, c, d] = det.bbox;
        this.log('warn', `CV LOCK: thermal anomaly wing ${det.wing} bbox [${a},${b},${c},${d}] peak ${det.peakTemp.toFixed(0)}K → dust ${det.confidence}%`);
      }
      this.detection = det;
    } else if (this.detection && ++this.missedDetections >= 3) {
      this.detection = null;
      this.log('ok', 'CV: thermal anomaly cleared (no pixels above 690K threshold)');
    }
  }

  // ---------------------------------------------------------------- physics
  /** Advances thermal + pipe ODEs by simSeconds with fixed control inputs. */
  private integrate(simSeconds: number, heaterPower: number) {
    const n = Math.max(1, Math.round(simSeconds / (TIME_WARP * 0.1 / SUBSTEPS)));
    const h = simSeconds / n;
    const tq = this.tq;
    const tw = this.tw;
    const band = this.triageAuto ? PIPE_BAND_ECO : PIPE_BAND_NORMAL;
    for (let s = 0; s < n; s++) {
      const gen = (P_TH - this.pe) / WING_COUNT;
      const nq = tq.slice();
      for (let q = 0; q < WING_COUNT; q++) {
        const lateral = G_LATERAL * (tq[(q + 3) % 4] + tq[(q + 1) % 4] - 2 * tq[q]);
        const toLoop = G_LOOP * (tq[q] - tw[q]);
        this.qloop[q] = toLoop;
        nq[q] = tq[q] + (h * (gen - toLoop + lateral)) / C_CORE;
        const tsurf = solveSurfaceTemp(tw[q], this.dust[q]);
        this.ts[q] = tsurf;
        this.prad[q] = radiatedPower(tsurf, this.dust[q]);
        tw[q] += (h * (toLoop - this.prad[q])) / C_WING;
      }
      for (let q = 0; q < WING_COUNT; q++) tq[q] = nq[q];
      // Habitat water-loop: duty-cycled heater vs. conduction to buried environment.
      const p = this.heaterOn ? heaterPower : 0;
      this.pipeTemp += (h * (p - PIPE_U * (this.pipeTemp - PIPE_T_ENV))) / PIPE_C;
      if (this.pipeTemp < band[0]) this.heaterOn = true;
      else if (this.pipeTemp > band[1]) this.heaterOn = false;
    }
  }

  /** Fast-forward to (near) steady state without dust dynamics or logging. */
  private settle(simSeconds: number) {
    const t = allocatePower(this.pe, true, this.request, this.triageAuto);
    this.integrate(simSeconds, t.heaterPower || 6000);
  }

  get coreTemp() {
    return Math.max(...this.tq);
  }

  step(dtWall: number) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    this.tick++;
    this.simTime += dtWall * TIME_WARP;

    // --- dust deposition (lander plume) ---
    if (this.plume) {
      this.plume.t += dtWall;
      const landing = 1 - NET_DEFLECTION * (this.netOn ? 1 : 0);
      for (let i = 0; i < WING_COUNT; i++) {
        // Deposit budget per wing scales with plume exposure (wing 0 faces the pad).
        const rate = (this.plume.target[i] / PLUME_DURATION) * landing;
        this.dust[i] = Math.min(Math.max(this.dust[i], this.plume.final[i]), this.dust[i] + rate * dtWall);
      }
      if (this.plume.t >= PLUME_DURATION) {
        this.plume = null;
        this.log('warn', `PLUME SETTLED: wing dust ${this.dust.map((d) => (d * 100).toFixed(0) + '%').join(' / ')}`);
      }
    }

    // --- targeted EDS travelling-wave pulse (gated on CV lock) ---
    if (this.edsArmed) {
      this.armedFor += dtWall;
      if (!this.edsActive && this.detection) {
        this.edsActive = true;
        this.edsWing = this.detection.wing;
        const [a, b, c, d] = this.detection.bbox;
        this.log('crit', `EDS 3-PHASE PULSE FIRING on wing ${this.edsWing} — target sector px [${a},${b}]→[${c},${d}], 1.2 kV travelling wave`);
      } else if (!this.edsActive && this.armedFor > 2) {
        this.edsArmed = false;
        this.log('ok', 'EDS STANDBY — no thermal anomaly to target');
      }
      if (this.edsActive) {
        const w = this.edsWing;
        this.dust[w] = Math.max(EDS_TARGET_DUST, this.dust[w] - EDS_RATE * dtWall);
        if (this.dust[w] <= EDS_TARGET_DUST + 1e-6) {
          this.edsActive = false;
          this.edsArmed = false;
          this.log('ok', `EDS COMPLETE: wing ${w} dust → ${(this.dust[w] * 100).toFixed(0)}%, ε recovered to ${emissivity(this.dust[w]).toFixed(2)}`);
        }
      }
    }

    // --- Stirling protective throttle with hysteresis ---
    const core = this.coreTemp;
    if (!this.throttled && core > THROTTLE_ON_K) {
      this.throttled = true;
      this.log('crit', `STIRLING THROTTLE: core ${core.toFixed(0)}K > ${THROTTLE_ON_K}K — output 40.0 → 24.5 kWe to protect converters`);
    } else if (this.throttled && core < THROTTLE_OFF_K) {
      this.throttled = false;
      this.log('ok', `STIRLING RESTORE: core ${core.toFixed(0)}K < ${THROTTLE_OFF_K}K — ramping to 40.0 kWe`);
    }
    const peTarget = this.throttled ? P_E_THROTTLED : P_E_NOMINAL;
    const maxStep = P_E_RAMP * dtWall;
    this.pe += Math.max(-maxStep * 3, Math.min(maxStep, peTarget - this.pe));

    // --- micro-grid triage, then thermal integration ---
    this.triage = allocatePower(this.pe, this.heaterOn, this.request, this.triageAuto);
    this.integrate(dtWall * TIME_WARP, this.triage.heaterPower);

    this.refreshDerived();
    this.checkThresholds();
    this.physicsMs = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  }

  private refreshDerived() {
    if (this.radDirty) {
      this.radiation = computeRadiation(this.rx, this.rz, this.shieldAz);
      this.radDirty = false;
    }
    this.triage = allocatePower(this.pe, this.heaterOn, this.request, this.triageAuto);
    const h = this.history;
    h.core.push(this.coreTemp);
    h.eps.push(Math.min(...this.dust.map(emissivity)));
    h.pe.push(this.pe);
    if (h.core.length > HISTORY) {
      h.core.shift();
      h.eps.shift();
      h.pe.shift();
    }
  }

  private checkThresholds() {
    const core = this.coreTemp;
    this.edge('core650', core > 650, 'warn', () => `CORE TEMP ${core.toFixed(0)}K exceeds 650K advisory — heat rejection deficit`);
    this.edge('core850', core > 850, 'crit', () => `CORE TEMP ${core.toFixed(0)}K CRITICAL — wing 0 NaK manifold ${this.tw[0].toFixed(0)}K`, () => `CORE TEMP back below 850K (${core.toFixed(0)}K)`);
    for (let i = 0; i < WING_COUNT; i++) {
      const e = emissivity(this.dust[i]);
      this.edge(`eps${i}`, e < 0.6, 'warn', () => `WING ${i} EMISSIVITY ${e.toFixed(2)} — silicate fouling ${(this.dust[i] * 100).toFixed(0)}%`, () => `WING ${i} emissivity recovered ${e.toFixed(2)}`);
    }
    const hab = this.radiation.habitat;
    this.edge(
      'radBreach',
      !hab.secure,
      'crit',
      () => `RADIATION WARNING: habitat line-of-sight ${hab.dose.toFixed(1)} rem/yr > ${DOSE_LIMIT} (Δθ shield ${hab.shieldDelta.toFixed(0)}°, regolith ${hab.thickness.toFixed(1)} m)`,
      () => `HABITAT DOME SECURE: ${hab.dose.toFixed(2)} rem/yr`,
    );
    const t = this.triage;
    this.edge('brownout', t.brownout, 'crit', () => `LIFE SUPPORT BROWNOUT: ${(t.alloc.life / 1000).toFixed(1)} kW < ${(LIFE_FLOOR / 1000).toFixed(1)} kW floor (proportional load shed)`, () => 'LIFE SUPPORT restored above floor');
    this.edge('sciShed', t.alloc.science < t.demand.science * 0.5, 'warn', () => `LOAD SHED: SCIENCE/drills ${(t.demand.science / 1000).toFixed(1)} → ${(t.alloc.science / 1000).toFixed(1)} kW`, () => 'LOAD RESTORE: science payloads re-energised');
    this.edge('lifeClamp', t.lifeClamped && this.triageAuto, 'warn', () => 'INTERLOCK: life-support request below 8.0 kW floor — clamped');
    this.edge('freezeRisk', this.pipeTemp < FREEZE_K + 3, 'crit', () => `HABITAT WATER LINE ${this.pipeTemp.toFixed(1)}K — within 3K of freezing`, () => `Water line freeze margin restored (${this.pipeTemp.toFixed(1)}K)`);
    this.edge('frozen', this.pipeTemp < FREEZE_K, 'crit', () => 'HABITAT WATER LINE FROZEN — burst risk');
  }

  get status(): SystemStatus {
    const core = this.coreTemp;
    if (core > 850 || !this.radiation.habitat.secure || this.triage.brownout || this.pipeTemp < FREEZE_K + 2) return 'CRITICAL';
    if (core > 650 || this.throttled || Math.max(...this.dust) > 0.3 || this.pe < P_E_NOMINAL - 100) return 'WARNING';
    return 'NOMINAL';
  }

  snapshot(): SimSnapshot {
    const eps = this.dust.map(emissivity);
    return {
      tick: this.tick,
      simTime: this.simTime,
      scenario: this.scenario,
      status: this.status,
      coreTemp: this.coreTemp,
      quadTemps: [...this.tq],
      wingTemps: [...this.tw],
      surfaceTemps: [...this.ts],
      dust: [...this.dust],
      emissivity: eps,
      pRad: [...this.prad],
      qLoop: [...this.qloop],
      pe: this.pe,
      throttled: this.throttled,
      pth: P_TH,
      stirlingEff: this.pe / P_TH,
      netOn: this.netOn,
      edsArmed: this.edsArmed,
      edsActive: this.edsActive,
      edsWing: this.edsWing,
      plumeActive: this.plume !== null,
      triageAuto: this.triageAuto,
      request: { ...this.request },
      triage: this.triage,
      pipeTemp: this.pipeTemp,
      heaterOn: this.heaterOn,
      reactor: { x: this.rx, z: this.rz },
      shieldAz: this.shieldAz,
      radiation: this.radiation,
      detection: this.detection,
      logs: this.logs.slice(),
      history: { core: this.history.core.slice(), eps: this.history.eps.slice(), pe: this.history.pe.slice() },
      physicsMs: this.physicsMs,
      cvMs: this.cvMs,
    };
  }
}

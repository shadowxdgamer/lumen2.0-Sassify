import {
  C_CORE,
  C_WING,
  DOSE_LIMIT,
  EDS_RATE,
  EDS_TARGET_DUST,
  FREEZE_K,
  G_LATERAL,
  G_LOOP,
  NET_DEFLECTION,
  NOMINAL_DUST,
  PIPE_C,
  PIPE_T_ENV,
  PIPE_U,
  PLUME_DURATION,
  P_E_NOMINAL,
  P_E_RAMP,
  P_E_THROTTLED,
  P_TH,
  STIRLING_DERATE,
  STIRLING_T_REF,
  STORM_DOSE_WING0,
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
  wallTime: number;
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
  netFault: boolean;
  netFaultAge: number; // wall seconds since the net fault (Infinity if none)
  edsArmed: boolean;
  edsActive: boolean;
  edsWing: number;
  plumeActive: boolean;
  request: TriageRequest;
  triage: TriageResult;
  pipeTemp: number;
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
const DEFAULT_REQUEST: TriageRequest = { life: 1, comms: 1, drills: 1 };

function clockTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Wing 0 fouling after the storm if a fraction `landing` of it reaches the radiator. */
export const stormDust = (landing: number, d0 = NOMINAL_DUST) => 1 - (1 - d0) * Math.exp(-STORM_DOSE_WING0 * landing);

/** Converter output available at a given rejection-side temperature (before the protective throttle). */
export const availablePower = (core: number) =>
  Math.min(P_E_NOMINAL, Math.max(P_E_THROTTLED, P_E_NOMINAL - STIRLING_DERATE * (core - STIRLING_T_REF)));

export class PhysicsEngine {
  private tick = 0;
  private wallTime = 0;
  private simTime = 0;
  private scenario: ScenarioId = 1;
  private tq = [411, 411, 411, 411];
  private tw = [371, 371, 371, 371];
  private ts = [371, 371, 371, 371];
  private dust = [NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST];
  private prad = [0, 0, 0, 0];
  private qloop = [0, 0, 0, 0];
  private pe = P_E_NOMINAL;
  private throttled = false;
  private netOn = false;
  private netFault = false;
  private netFaultAt = 0;
  private edsArmed = false;
  private edsActive = false;
  private edsWing = -1;
  private armedFor = 0;
  /** Active lander plume: elapsed wall time. */
  private plume: { t: number } | null = null;
  private request: TriageRequest = { ...DEFAULT_REQUEST };
  private triage: TriageResult;
  private pipeTemp = 292;
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
    this.triage = allocatePower(this.pe, this.request, false);
    this.applyScenario(1, true);
    this.log('info', 'HELIOSCORE 2030 digital twin online — 10 Hz coupled physics, TIME_WARP ×120');
    this.log('info', 'Thermal vision pipeline ready — radiometric LWIR 260×170, connected-component detector');
    this.log('ok', `NOMINAL: core ${this.coreTemp.toFixed(0)}K · 40.0 kWe · ε 0.89 · ice drills 16.0 kW`);
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

  // ---------------------------------------------------------------- scenarios
  /** Clean reactor, net standby, drills spinning — the starting point of every story beat. */
  private resetToNominal() {
    this.plume = null;
    this.netOn = false;
    this.netFault = false;
    this.edsArmed = false;
    this.edsActive = false;
    this.edsWing = -1;
    this.request = { ...DEFAULT_REQUEST };
    this.dust = [NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST, NOMINAL_DUST];
    this.pe = P_E_NOMINAL;
    this.throttled = false;
    this.pipeTemp = 292;
    this.rx = 0;
    this.rz = 0;
    this.shieldAz = azimuthDeg(HABITAT_POS.x, HABITAT_POS.z);
    this.radDirty = true;
    this.detection = null;
    this.missedDetections = 0;
    this.settle(4000);
    this.flags.clear();
  }

  applyScenario(id: ScenarioId, silent = false) {
    if (id === 3) {
      this.startCleanse();
      this.refreshDerived();
      return;
    }
    this.scenario = id;
    this.resetToNominal();
    if (id === 1) {
      if (!silent) this.log('info', 'SCENARIO 1 — NOMINAL BASELINE: 40.0 kWe, wings clean (D=2%), net standby, ice drills 16.0 kW');
    } else if (id === 2) {
      this.log('warn', 'SCENARIO 2 — DUST STORM: lander plume inbound on radiator wing 0 (az 225°)');
      this.plume = { t: 0 };
      this.netOn = true;
      this.log('ok', 'AUTO-SHIELD: perimeter dust sensors tripped — ELECTROSTATIC MESH NET AUTO-ENGAGED, deflecting 85%');
    } else {
      this.log('crit', 'SCENARIO 4 — SHIELD MALFUNCTION: heavy lander plume inbound on wing 0');
      this.plume = { t: 0 };
      this.netFault = true;
      this.netFaultAt = this.wallTime;
      this.log('crit', 'SHIELD FAULT: micrometeoroid strike on mesh-net HV bus — NET OFFLINE, plume landing unopposed');
    }
    this.refreshDerived();
  }

  /** Scenario 3: targeted EDS on the wing the thermal vision has located, with the net kept up. */
  private startCleanse() {
    if (this.dust[0] < 0.15 || this.netFault) {
      this.resetToNominal();
      this.netOn = true;
      this.dust[0] = stormDust(1 - NET_DEFLECTION);
      this.settle(4000);
      this.log('warn', `SCENARIO 3 — preloading post-storm state: net active, wing 0 dust ${(this.dust[0] * 100).toFixed(0)}%`);
    }
    this.scenario = 3;
    this.plume = null;
    this.setNet(true);
    this.edsArmed = true;
    this.armedFor = 0;
    this.log('info', 'SCENARIO 3 — TARGETED AI EDS CLEANSE armed: waiting for thermal-vision bounding box');
  }

  /** The right-hand CTA. Context-aware: normal protection, or emergency recovery after a net fault. */
  engageProtection() {
    if (this.netFault) {
      this.log('crit', 'EMERGENCY BACKUP EDS ARMED — net offline; firing wing-mounted electrodes on the CV target');
      this.log('info', 'TRIAGE RESTORE queued: ice drills return automatically once core < 650K and 40.0 kWe is back');
    } else {
      this.setNet(true);
      this.log('info', 'AUTONOMOUS PROTECTION — mesh net up, targeted EDS armed');
    }
    this.edsArmed = true;
    this.armedFor = 0;
  }

  setNet(on: boolean) {
    if (on && this.netFault) {
      this.log('warn', 'MESH NET OFFLINE — HV bus fault, cannot engage');
      return;
    }
    if (on === this.netOn) return;
    this.netOn = on;
    this.log(on ? 'ok' : 'warn', on ? 'ELECTROSTATIC MESH NET ENGAGED — 85% charged-dust deflection' : 'ELECTROSTATIC MESH NET TO STANDBY');
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
    const best = optimizeSiting();
    this.rx = best.x;
    this.rz = best.z;
    this.shieldAz = best.shieldAz;
    this.radDirty = true;
    this.log('ok', `AUTO-SITING: shield ${best.shieldAz.toFixed(0)}° → habitat ${best.dose.toFixed(2)} rem/yr`);
  }

  setDust(wing: number, value: number) {
    this.plume = null;
    this.dust[wing] = Math.min(1, Math.max(0, value));
  }

  setTriageRequest(partial: Partial<TriageRequest>) {
    this.request = { ...this.request, ...partial };
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
      this.log('ok', 'CV: thermal anomaly cleared — wing 0 back within fleet temperature band');
    }
  }

  // ---------------------------------------------------------------- physics
  /** Advances the thermal + pipe ODEs by simSeconds with fixed control inputs. */
  private integrate(simSeconds: number, heaterPower: number) {
    const n = Math.max(1, Math.round(simSeconds / ((TIME_WARP * 0.1) / SUBSTEPS)));
    const h = simSeconds / n;
    const tq = this.tq;
    const tw = this.tw;
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
      // Habitat water loop: heater input vs. conduction into the cold regolith.
      this.pipeTemp += (h * (heaterPower - PIPE_U * (this.pipeTemp - PIPE_T_ENV))) / PIPE_C;
    }
  }

  /** Fast-forward to (near) steady state, letting the converters follow their derating curve. */
  private settle(simSeconds: number) {
    for (let k = 0; k < 20; k++) {
      this.throttled = this.coreTemp > THROTTLE_ON_K || (this.throttled && this.coreTemp > THROTTLE_OFF_K);
      this.pe = this.throttled ? P_E_THROTTLED : availablePower(this.coreTemp);
      const t = allocatePower(this.pe, this.request, this.throttled);
      this.integrate(simSeconds / 20, t.heaterPower);
    }
  }

  get coreTemp() {
    return Math.max(...this.tq);
  }

  step(dtWall: number) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    this.tick++;
    this.wallTime += dtWall;
    this.simTime += dtWall * TIME_WARP;

    // --- lander plume: Poisson coverage, 85 % deflected while the net is up ---
    if (this.plume) {
      this.plume.t += dtWall;
      const landing = this.netOn ? 1 - NET_DEFLECTION : 1;
      const dose = (STORM_DOSE_WING0 / PLUME_DURATION) * landing * dtWall;
      this.dust[0] = 1 - (1 - this.dust[0]) * Math.exp(-dose);
      if (this.plume.t >= PLUME_DURATION - 1e-6) {
        this.plume = null;
        this.log(this.dust[0] > 0.6 ? 'crit' : 'warn', `PLUME SETTLED: wing 0 dust ${(this.dust[0] * 100).toFixed(0)}%${this.netOn ? ' (net blocked 85%)' : ' — no net protection'}`);
      }
    }

    // --- targeted EDS travelling-wave pulse (gated on CV lock) ---
    if (this.edsArmed) {
      this.armedFor += dtWall;
      if (!this.edsActive && this.detection) {
        this.edsActive = true;
        this.edsWing = this.detection.wing;
        const [a, b, c, d] = this.detection.bbox;
        this.log('crit', `EDS 3-PHASE PULSE FIRING on wing ${this.edsWing} — CV target px [${a},${b}]→[${c},${d}], 1.2 kV travelling wave`);
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

    // --- Stirling: Carnot-margin derating, plus protective throttle with hysteresis ---
    const core = this.coreTemp;
    if (!this.throttled && core > THROTTLE_ON_K) {
      this.throttled = true;
      this.log('crit', `STIRLING THROTTLE: core ${core.toFixed(0)}K > ${THROTTLE_ON_K}K — output → 24.5 kWe to prevent converter seizure`);
    } else if (this.throttled && core < THROTTLE_OFF_K) {
      this.throttled = false;
      this.log('ok', `STIRLING RESTORE: core ${core.toFixed(0)}K < ${THROTTLE_OFF_K}K — ramping back toward 40.0 kWe`);
    }
    const peTarget = this.throttled ? P_E_THROTTLED : availablePower(core);
    const maxStep = P_E_RAMP * dtWall;
    this.pe += Math.max(-maxStep * 3, Math.min(maxStep, peTarget - this.pe));

    // --- micro-grid triage (failsafe while throttled), then thermal integration ---
    this.triage = allocatePower(this.pe, this.request, this.throttled);
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
    this.triage = allocatePower(this.pe, this.request, this.throttled);
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
    this.edge('radBreach', !hab.secure, 'crit', () => `RADIATION WARNING: habitat ${hab.dose.toFixed(1)} rem/yr > ${DOSE_LIMIT}`, () => `HABITAT DOSE OK: ${hab.dose.toFixed(2)} rem/yr`);
    const t = this.triage;
    this.edge(
      'failsafe',
      t.failsafe,
      'crit',
      () => `FAILSAFE TRIAGE: ICE DRILLS DISABLED (16.0 → 0.0 kW) — life support ${(t.alloc.life / 1000).toFixed(1)} kW, habitat ${(t.alloc.habitat / 1000).toFixed(1)} kW, comms ${(t.alloc.comms / 1000).toFixed(1)} kW fully funded`,
      () => 'TRIAGE RESTORED: ice drills re-energised — life support never dropped below 10.0 kW',
    );
    // Failsafe supersedes "reduced": drop that flag silently so no false "back to full power".
    if (t.failsafe) this.flags.delete('drillsReduced');
    this.edge(
      'drillsReduced',
      !t.failsafe && t.alloc.drills < t.demand.drills - 500,
      'warn',
      () => 'ICE DRILLS REDUCED — variable-speed augers absorb the power dip; crew loads keep priority',
      () => 'ICE DRILLS back to full power',
    );
    this.edge('lifeClamp', t.lifeClamped, 'warn', () => 'INTERLOCK: life-support request below 8.0 kW floor — clamped');
    this.edge('freezeRisk', this.pipeTemp < FREEZE_K + 3, 'crit', () => `HABITAT WATER LINE ${this.pipeTemp.toFixed(1)}K — within 3K of freezing`, () => `Water line freeze margin restored (${this.pipeTemp.toFixed(1)}K)`);
  }

  get status(): SystemStatus {
    const core = this.coreTemp;
    if (core > 850 || !this.radiation.habitat.secure || this.pipeTemp < FREEZE_K + 2) return 'CRITICAL';
    if (core > 650 || this.throttled || this.netFault || Math.max(...this.dust) > 0.2 || this.pe < P_E_NOMINAL - 100) return 'WARNING';
    return 'NOMINAL';
  }

  snapshot(): SimSnapshot {
    return {
      tick: this.tick,
      wallTime: this.wallTime,
      simTime: this.simTime,
      scenario: this.scenario,
      status: this.status,
      coreTemp: this.coreTemp,
      quadTemps: [...this.tq],
      wingTemps: [...this.tw],
      surfaceTemps: [...this.ts],
      dust: [...this.dust],
      emissivity: this.dust.map(emissivity),
      pRad: [...this.prad],
      qLoop: [...this.qloop],
      pe: this.pe,
      throttled: this.throttled,
      pth: P_TH,
      stirlingEff: this.pe / P_TH,
      netOn: this.netOn,
      netFault: this.netFault,
      netFaultAge: this.netFault ? this.wallTime - this.netFaultAt : Infinity,
      edsArmed: this.edsArmed,
      edsActive: this.edsActive,
      edsWing: this.edsWing,
      plumeActive: this.plume !== null,
      request: { ...this.request },
      triage: this.triage,
      pipeTemp: this.pipeTemp,
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

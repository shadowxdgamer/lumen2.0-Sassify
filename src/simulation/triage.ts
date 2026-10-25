import { COMMS_FLOOR, LIFE_FLOOR, LOAD_NOMINAL } from './constants';

export interface LoadSet {
  life: number;
  comms: number;
  habitat: number;
  drills: number;
}

/** Operator requests as fractions (0–1) of nominal demand. */
export interface TriageRequest {
  life: number;
  comms: number;
  drills: number;
}

export interface TriageResult {
  demand: LoadSet;
  alloc: LoadSet;
  heaterPower: number; // watts reaching the habitat water-line heaters
  spare: number; // unallocated budget (battery trickle)
  failsafe: boolean;
  lifeClamped: boolean;
}

/**
 * Strict-priority allocation of the Stirling budget across the micro-grid:
 *   1. life support (interlocked 8 kW floor)
 *   2. habitat incl. water-line heaters (always fully funded first)
 *   3. comms (1.5 kW floor)
 *   4. ice-drill rigs (ISRU) take the remainder — variable-speed augers.
 * In FAILSAFE (protective throttle engaged) the drills are switched off entirely
 * so every remaining watt protects the crew.
 */
export function allocatePower(budget: number, req: TriageRequest, failsafe: boolean): TriageResult {
  const habitatDemand = LOAD_NOMINAL.habitatBase + LOAD_NOMINAL.heater;
  const demand: LoadSet = {
    life: Math.max(LIFE_FLOOR, LOAD_NOMINAL.life * req.life),
    comms: Math.max(COMMS_FLOOR, LOAD_NOMINAL.comms * req.comms),
    habitat: habitatDemand,
    drills: LOAD_NOMINAL.drills * req.drills,
  };

  let remaining = budget;
  const take = (want: number) => {
    const got = Math.max(0, Math.min(want, remaining));
    remaining -= got;
    return got;
  };
  const life = take(demand.life);
  const habitat = take(demand.habitat);
  const comms = take(demand.comms);
  const drills = failsafe ? 0 : take(demand.drills);

  return {
    demand: { ...demand, drills: failsafe ? 0 : demand.drills },
    alloc: { life, comms, habitat, drills },
    heaterPower: Math.max(0, habitat - LOAD_NOMINAL.habitatBase),
    spare: remaining,
    failsafe,
    lifeClamped: LOAD_NOMINAL.life * req.life < LIFE_FLOOR,
  };
}

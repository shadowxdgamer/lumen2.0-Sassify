import { COMMS_ESSENTIAL, COMMS_FLOOR, HABITAT_BASE_ECO, LIFE_FLOOR, LOAD_NOMINAL } from './constants';

export interface LoadSet {
  life: number;
  comms: number;
  habitat: number;
  science: number;
}

/** Operator requests as fractions (0–1) of nominal demand. */
export interface TriageRequest {
  life: number;
  comms: number;
  science: number;
}

export interface TriageResult {
  demand: LoadSet;
  alloc: LoadSet;
  heaterPower: number; // watts actually delivered to the pipe heaters
  lifeClamped: boolean;
  commsClamped: boolean;
  brownout: boolean;
}

const sum = (l: LoadSet) => l.life + l.comms + l.habitat + l.science;

/**
 * Allocates the available Stirling budget across the micro-grid.
 * - auto = false: legacy proportional brown-out when demand exceeds budget.
 * - auto = true : strict priority triage with safety interlocks.
 */
export function allocatePower(budget: number, heaterOn: boolean, req: TriageRequest, auto: boolean): TriageResult {
  const heaterDemand = heaterOn ? LOAD_NOMINAL.heater : 0;
  const habitatBase = auto ? HABITAT_BASE_ECO : LOAD_NOMINAL.habitatBase;
  const reqLife = LOAD_NOMINAL.life * req.life;
  const reqComms = LOAD_NOMINAL.comms * req.comms;
  const demand: LoadSet = {
    life: reqLife,
    comms: reqComms,
    habitat: habitatBase + heaterDemand,
    science: LOAD_NOMINAL.science * req.science,
  };

  if (!auto) {
    const total = sum(demand);
    const k = total > budget ? budget / total : 1;
    const alloc: LoadSet = {
      life: demand.life * k,
      comms: demand.comms * k,
      habitat: demand.habitat * k,
      science: demand.science * k,
    };
    return {
      demand,
      alloc,
      heaterPower: heaterDemand * k,
      lifeClamped: false,
      commsClamped: false,
      brownout: alloc.life < LIFE_FLOOR - 1,
    };
  }

  // Priority 1: life support (interlocked floor).
  let remaining = budget;
  const lifeTarget = Math.max(LIFE_FLOOR, reqLife);
  const life = Math.min(lifeTarget, remaining);
  remaining -= life;
  // Priority 2: habitat freeze protection (base + duty-cycled heater).
  const habitat = Math.min(habitatBase + heaterDemand, remaining);
  remaining -= habitat;
  const heaterPower = Math.max(0, habitat - habitatBase);
  // Priority 3: comms, held to essential links (DSN relay + crew voice) when short.
  const short = budget < sum(demand);
  const commsTarget = Math.max(COMMS_FLOOR, short ? Math.min(reqComms, COMMS_ESSENTIAL) : reqComms);
  const comms = Math.min(commsTarget, remaining);
  remaining -= comms;
  // Priority 4: science gets whatever is left (shed first).
  const science = Math.min(demand.science, remaining);

  return {
    demand: { ...demand, life: lifeTarget, comms: commsTarget },
    alloc: { life, comms, habitat, science },
    heaterPower,
    lifeClamped: reqLife < LIFE_FLOOR,
    commsClamped: reqComms < COMMS_FLOOR,
    brownout: life < LIFE_FLOOR - 1,
  };
}

export const totalLoad = sum;

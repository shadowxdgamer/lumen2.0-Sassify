// All physical constants and calibration values for the HELIOSCORE twin.
// See .plans/helioscore-2030-spec.md §5 for sources and rationale.

export const SIGMA = 5.670374e-8; // Stefan–Boltzmann [W/m²K⁴]

// --- Reactor & Stirling conversion ------------------------------------------
export const P_TH = 175_000; // reactor thermal power [W]
export const P_E_NOMINAL = 40_000; // Stirling electrical output [W]
export const P_E_THROTTLED = 24_500; // protective throttle output [W]
export const THROTTLE_ON_K = 750; // core temp that triggers throttle [K]
export const THROTTLE_OFF_K = 650; // core temp that restores full output [K]
export const P_E_RAMP = 6_000; // converter ramp rate [W per wall-second]
// Below the throttle point, output derates as the rejection side warms and the
// converters' Carnot margin shrinks (linearised about the nominal operating point).
export const STIRLING_T_REF = 411.5; // nominal rejection-side temperature [K]
export const STIRLING_DERATE = 18.5; // output lost per kelvin above T_REF [W/K]

// --- Radiators & thermal network --------------------------------------------
export const WING_COUNT = 4;
export const WING_AREA = 42; // [m²] per wing
export const T_SINK = 40; // lunar night effective sink [K]
export const EPS_CLEAN = 0.9;
export const EPS_DUST_SLOPE = 0.54;
export const emissivity = (dust: number) => EPS_CLEAN - EPS_DUST_SLOPE * dust;

export const G_LOOP = 850; // core quadrant ↔ NaK loop conductance [W/K]
export const G_LATERAL = 15; // quadrant ↔ quadrant conductance [W/K]
export const REGOLITH_K = 1.5e-3; // compacted lunar fines conductivity [W/m·K]
export const DUST_THICKNESS_FULL = 1.50e-3; // effective layer thickness at D = 1 [m]
/** Series resistance of a fully dust-blanketed wing [K/W]. */
export const R_DUST_FULL = DUST_THICKNESS_FULL / REGOLITH_K / WING_AREA; // ≈ 0.0238 K/W (R″ = 1.0 m²K/W)
export const C_CORE = 1.5e4; // lumped capacitance per core quadrant [J/K]
export const C_WING = 1.5e4; // lumped capacitance per wing manifold + NaK inventory [J/K]

export const TIME_WARP = 120; // simulated seconds per wall second
export const TICK_HZ = 10;
export const TICK_DT = 1 / TICK_HZ; // wall seconds per tick
export const SUBSTEPS = 20;

// --- Dust & electrostatic defense -------------------------------------------
export const NET_DEFLECTION = 0.85;
export const EDS_RATE = (0.89 - 0.02) / 6; // ≈ 0.145 /s → 89 % to 2 % in 6 s
export const EDS_TARGET_DUST = 0.02;
export const NOMINAL_DUST = 0.02;
export const STORM_DUST_UNSHIELDED = 0.89; // wing 0 fouling if the storm lands unopposed
export const PLUME_DURATION = 4; // wall seconds of inbound ejecta
/**
 * Poisson coverage: D = 1 − (1 − D₀)·e^(−k·m). The storm's total dose k·M on wing 0
 * is calibrated so an unshielded storm gives 89 %; the net's 85 % deflection leaves ≈ 29 %.
 */
export const STORM_DOSE_WING0 = Math.log((1 - NOMINAL_DUST) / (1 - STORM_DUST_UNSHIELDED));

// --- Radiation & siting ------------------------------------------------------
export const WORLD_SCALE = 10; // metres per scene unit
export const I0 = 4.16e6; // source strength [rem·m²/yr]
export const MU_REGOLITH = 0.6; // conservative effective attenuation [1/m]
export const SHIELD_HALF_ANGLE = 25; // B4C shadow cone half-angle [deg]
export const SHIELD_FACTOR = 0.04; // transmission inside shadow cone
export const DOSE_LIMIT = 5; // habitat limit [rem/yr]
export const SECTOR_COUNT = 36;
export const CORE_HEIGHT = 2.2; // core centre above ground [units]

// --- Micro-grid --------------------------------------------------------------
export const LOAD_NOMINAL = { life: 10_000, comms: 5_000, habitatBase: 3_000, heater: 6_000, drills: 16_000 };
export const LIFE_FLOOR = 8_000;
export const COMMS_FLOOR = 1_500;
export const PIPE_T_ENV = 90; // buried pipe environment [K]
export const PIPE_U = LOAD_NOMINAL.heater / (292 - PIPE_T_ENV); // fully-funded heaters hold 292 K [W/K]
export const PIPE_C = 1.2e5; // pipe-loop capacitance [J/K]
export const FREEZE_K = 273.15;

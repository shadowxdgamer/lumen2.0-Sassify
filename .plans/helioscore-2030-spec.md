# HELIOSCORE 2030 — Engineering & Pitch Defense Specification

**Product:** HELIOSCORE 2030 — Autonomous Lunar Nuclear Fission Digital Twin, Electrostatic Dust Defense & Survival Micro-Grid (SaaS)
**Event:** IEEE Lumen 2.0 "Beyond 2030" Hackathon — pitch session 25 October, 09:00
**Repository:** `lumen2.0-Sassify` (Vite + React + TypeScript + Tailwind + Three.js, 100 % browser-native, zero external assets)

---

## 1. The Future (scenario, 2030 → 2040)

| Year | Development (public roadmaps) | Consequence |
|------|-------------------------------|-------------|
| 2026–2030 | NASA *Fission Surface Power* (FSP) project targets a **40 kWe-class** reactor on the Moon by ~2030; China/Russia ILRS plan a lunar nuclear plant by 2033–2035. | First permanent nuclear power on another world. |
| 2030–2035 | Artemis Base Camp and ILRS grow into multi-module habitats near the south pole, with repeated crewed and cargo landings. | Each landing blasts regolith at > 1 km/s (Apollo 12 sandblasted Surveyor 3 from 160 m away). |
| 2032+ | Reactors are sited **inside craters** so the crater wall and regolith shield the crew; heat is rejected by large deployable radiators during the **14-day lunar night** (sink ≈ 40 K). | The radiator is now the single point of failure between the reactor and the crew's oxygen, heat and comms. |

**Why the problem appears:** solar power cannot survive the 354-hour night, so fission becomes mandatory. A fission reactor has to reject roughly 135 kW of waste heat through radiators by radiation alone. Lunar dust (a sharp, electrostatically charged silicate) sticks to those radiators. Lander plumes, rover traffic and electrostatic levitation at the terminator all add more.

## 2. The Problem

1. **Thermal choking.** Dust lowers radiator emissivity and, worse, forms an insulating blanket. Lunar regolith has a thermal conductivity of about **1.5 × 10⁻³ W/m·K**, one of the best insulators in the solar system. The NaK coolant loop of a fouled wing cannot dump heat, so core temperature climbs.
2. **Power collapse.** Above about 750 K at the rejection interface, the free-piston Stirling converters lose their Carnot margin and must be throttled to avoid seizing (40 → 24.5 kWe). A 40 kW base suddenly has 24.5 kW.
3. **Survival cascade.** Without triage, a power shortfall is shared out across every load, so life support and the habitat water-line heaters fall below safe levels. The pipes freeze at 273.15 K within hours, and a burst line in a lunar habitat is a mission-ending event.
4. **Radiation siting.** Every time crews relocate or extend the reactor, its directional B₄C shadow shield and the crater terrain must still keep the habitat below **5 rem/yr**. That is a 3-D occlusion problem nobody wants to solve by hand at 3 a.m.
5. **Latency.** Earth is 1.3 light-seconds away and ground-team staffing is limited. Lunar night shifts need *autonomous* detection and response.

**Why today's solutions fail:** current spacecraft radiators assume a dust-free LEO/GEO environment. Electrodynamic Dust Shields (EDS, flown on Blue Ghost 2025) exist as hardware, but no system *closes the loop* between thermal sensing, targeted cleaning, shielding geometry and load triage.

## 3. Users & Stakeholders

| User | Need |
|------|------|
| Surface power controllers (Earth & base) | One live picture of reactor, radiators, dust and power budget. |
| Base commander / crew | Guaranteed life support and freeze-safe habitat during anomalies. |
| Reactor & thermal engineers | A physics twin for "what-if" analysis of fouling, siting and shielding. |
| Mission planners / landing ops | Plume-exclusion and siting decisions (where to land, where to put the reactor). |
| Agencies & commercial operators (SaaS customers) | Multi-site fleet monitoring as more lunar power plants come online. |

## 4. The Solution — one "Defense-in-Depth" story

A digital twin plus a closed-loop autonomy stack. Each demo scenario adds one layer of defense:

| # | Scenario | Layer shown |
|---|----------|-------------|
| 1 | **Nominal baseline** — 40.0 kWe, 411 K, net on standby, 3 ice-drill rigs spinning at 16.0 kW | Normal ISRU mining operations |
| 2 | **Dust storm (auto-shield on)** — perimeter sensors trip and the electrostatic mesh net engages automatically. It deflects 85 %, so wing 0 fouls to only ≈ 29 % and power dips to ≈ 36.5 kWe. The drills slow but keep running. | **Protect** |
| 3 | **Targeted AI EDS cleanse** — the thermal-vision bounding box locates the warm wing. A 3-phase EDS pulse fires **only on that wing**, taking dust from 29 % to 2 % in about 2 s. ε recovers to 0.89 and power returns to 40.0 kWe. | **Detect + Clean** |
| 4 | **Shield malfunction (disable-drills failsafe)** — a micrometeoroid fault takes the net offline in the middle of a heavy plume. Wing 0 fouls to 89 % (ε 0.42), the core reaches ≈ 920 K and the converters throttle to 24.5 kWe. **Failsafe triage disables the ice drills (0.0 kW)** so life support (10), habitat heaters (9) and comms (5) stay 100 % funded. The CTA becomes **Emergency backup EDS + restore triage**: wing-mounted electrodes clean the wing, the core cools, power returns and the drills restart automatically. | **Survive** |

The radiation-siting model (B₄C shadow shield + terrain raycast, §5.4) is still in the engine and unit-tested. It is deliberately hidden from the pitch view so the jury follows one physics story; use it in Q&A if asked about siting.

---

## 5. Physics Model (all of it runs live at 10 Hz in `src/simulation/`)

### 5.1 Constants

| Symbol | Value | Source / rationale |
|--------|-------|--------------------|
| σ | 5.670374 × 10⁻⁸ W/m²K⁴ | Stefan–Boltzmann |
| P_th | 175 kWt | FSP-class core (40 kWe at ~23 % Stirling efficiency) |
| P_e (nominal / throttled) | 40.0 / 24.5 kWe | FSP target / protective throttle |
| Converter derating | −18.5 W per K above 411.5 K (floor 24.5 kWe) | Linearised Carnot-margin loss as the rejection side warms |
| T_sink | 40 K | Lunar night effective sink (polar) |
| A_i | 42 m² per wing, 4 wings | 168 m² total radiator |
| ε(D) | 0.90 − 0.54·D | Linear dust degradation (clean ε 0.90; ε(0.89) = **0.42**, ε(0.02) = **0.89**) |
| R″_dust | 1.0 m²K/W at full coverage | ≈ 1.5 mm of compacted fines with k = 1.5 × 10⁻³ W/m·K |
| G (core ↔ loop) | 850 W/K per loop | Heat-exchanger conductance, calibrated for 410 K nominal |
| G_x (quadrant ↔ quadrant) | 15 W/K | Weak conduction through the core block |
| Throttle | > 750 K → 24.5 kWe; restore < 650 K | Hysteresis prevents chattering |
| S(Δθ) | 0.04 inside ±25°, 1.0 outside | B₄C directional shadow shield |
| μ_regolith | 0.6 m⁻¹ | **Conservative** buildup-corrected effective value (narrow-beam values are 5–10× higher, so we *overestimate* dose) |
| I₀ | 4.16 × 10⁶ rem·m²/yr | Calibrated so an unshielded, unoccluded habitat at ~230 m gets ≈ 80 rem/yr |
| Dose limit | 5 rem/yr | Habitat design limit |
| World scale | 1 scene unit = 10 m | The reactor mesh is drawn oversized for visibility |
| TIME_WARP | 120 | 1 wall-second = 2 simulated minutes, so transients are visible in a demo |

### 5.2 Thermal network (one segmented NaK loop per wing)

The core is modelled as 4 quadrant nodes. Each one is cooled by its own NaK loop and wing; segmentation provides fault tolerance against micrometeoroid punctures. The reported **CORE TEMP is the hot-channel maximum** across the quadrants.

```
C_c · dT_q/dt   = (P_th − P_e)/4 − G·(T_q − T_w,q) + G_x·(T_q−1 + T_q+1 − 2·T_q)
C_w · dT_w,i/dt = G·(T_q − T_w,i) − P_rad,i
P_rad,i         = ε_i(D_i) · σ · A_i · (T_s,i⁴ − T_sink⁴)
(T_w,i − T_s,i) / (D_i · R_dust) = P_rad,i      ← massless dust layer, solved by bisection
```

* `T_w` is the substrate / NaK manifold temperature and `T_s` the dust-surface temperature.
* Integration: explicit Euler, 20 sub-steps per 100 ms tick (sim dt = 0.6 s, stable because C/G ≫ dt).
* **Why the fouled wing glows:** the dust blanket raises the series resistance, so the manifold behind it (T_w,0 ≈ 893 K) runs hotter while the dust surface stays near 395 K. The thermal camera sees the hot manifold, risers and dust-free gaps.
* Calibrated steady states (asserted by `physicsEngine.test.ts`):

| Case | D | P_e | CORE | ε (worst wing) |
|------|---|-----|------|----------------|
| [1] Nominal | 0.02 × 4 | 40.0 kWe | ≈ 411 K | 0.89 |
| [2] Storm, net on | 0.29 on wing 0 | ≈ 36.5 kWe | ≈ 600 K | 0.74 |
| [4] Storm, net faulted | 0.89 on wing 0 | 24.5 kWe (throttled) | ≈ 920 K | 0.42 |

### 5.3 Dust dynamics

A lander plume delivers a fixed dust "dose" to wing 0 over 4 s. Coverage follows a Poisson model, so a second layer of dust lands partly on the first:

```
D(t+Δt) = 1 − (1 − D(t)) · exp(−k·Δm),   Δm = (M / 4 s) · Δt · (1 − 0.85·netOn)
k·M = ln((1 − 0.02) / (1 − 0.89)) = 2.19      → unshielded storm: 2 % → 89 %
                                               → net up (15 % lands): 2 % → 29 %
dD/dt (EDS) = −0.145 /s on the CV-targeted wing only
```

The pulse is *gated* on the CV lock, so the cleaning really does depend on the vision output.

### 5.4 Radiation, siting & raycast occlusion

* A single deterministic heightfield `h(x, z)` (`terrain.ts`) produces both the rendered terrain (PlaneGeometry 80 × 80, 128 × 128 segments) and a hidden 64 × 64 physics mesh. It combines a crater floor, a rim ring at R = 22, an outer shelf, and seeded multi-octave value noise.
* `THREE.Raycaster` runs against the DoubleSide physics mesh. Hits are entry/exit pairs, and **x = Σ(exit − entry)** gives the metres of regolith along the ray.
* 36 azimuth rays aim at the rim crest (crater-wall hazard), plus one ray to the habitat deck.
* `I = I₀ · S(Δθ) / d² · e^(−μ·x)` gives the dose in rem/yr. The habitat cone is green when I < 5 rem/yr and red otherwise; a breach logs a radiation warning.
* **Auto-Optimize Siting:** a grid search over crater-floor positions (r ≤ 10). The shield points at the habitat azimuth, which is analytically optimal. The objective is habitat dose plus a small cable-length penalty.

### 5.5 Stirling output & survival micro-grid

* Converter output: `P_e = clamp(40 kWe − 18.5 W/K · (T_core − 411.5 K), 24.5, 40)`. Above 750 K the protective throttle holds 24.5 kWe until the core falls below 650 K (hysteresis).
* Nominal demand: Life 10, Habitat 9 (3 cabin + 6 water-line heaters), Comms 5, Ice drills 16 = 40 kWe.
* Pipe model: `C_p dT/dt = P_heater − U·(T − 90 K)` with U = 29.7 W/K, so fully funded heaters hold the line at 292 K.
* Allocation is always in strict priority order:
  1. Life support (8 kW interlocked floor)
  2. Habitat incl. heaters
  3. Comms (1.5 kW floor)
  4. Ice drills get the remainder. They are variable-speed augers, so in scenario 2 they run at ≈ 12.5 kW.
* **FAILSAFE PRIORITY** (whenever the protective throttle is engaged): the drills are switched off entirely. 10 + 9 + 5 = 24 kW is funded inside the 24.5 kWe budget, and the water line never approaches 273.15 K.
* Manual-override sliders set *requests*. Interlocks clamp them and log the event.

---

## 6. Thermal "AI" Vision — what it actually is (Rule 12.5 transparency)

**It is deterministic computer vision, not a trained neural network.** We call it "AI Vision" in the UI because it perceives and decides autonomously, and we say exactly what it is when asked.

| Stage | Implementation |
|-------|----------------|
| 1. Sensor synthesis | A 260 × 170 overhead mast-camera view is rendered per pixel from physical temperatures: regolith background, shield cap, NaK manifold/risers at T_w, panel face at T_s/T_w depending on a seeded dust-blotch mask thresholded by D_i, and Box–Muller Gaussian sensor noise (σ ≈ 5 K). Each temperature passes through an Ironbow LUT (40 K → 920 K) and is written with `putImageData`. |
| 2. Detection | `getImageData` reads the pixels back, and each pixel is decoded radiometrically (O(1) palette lookup) to kelvin. Threshold **T > 470 K**: healthy wings run at 370–400 K, so this flags a heat-rejection anomaly from about 15 % fouling upward. Then apply a 3 × 3 dilation, run BFS 4-connected component labelling, and keep the largest component. The result gives bbox, centroid, area ratio and wing index (from the centroid azimuth). |
| 2b. Physics-informed inversion | The component's pixels are decoded back to temperature through the LUT (nearest colour), and the 90th percentile gives T_meas. Bisection then solves `T_s(D,Q) + Q·D·R_dust = T_meas` for D, using the loop heat-meter telemetry Q. **Confidence = min(99, round(D̂·100))**, an image-derived estimate, not the ground-truth variable. |
| 3. HUD | Neon bbox, crosshair, colorbar and the `AI THERMAL ANOMALY: DUST xx%` label (with a `- CRITICAL` suffix at ≥ 60 %) are drawn over the detected coordinates. Measured: scenario 2 → 29 %, scenario 4 → 89 %. |

**Coupling:** the detection result goes back into the physics engine, and the EDS pulse will only fire on the wing the detector located.
**Production path:** the same interface accepts a real LWIR camera frame. A learned segmenter (U-Net) could replace stage 2 once real fouling imagery exists.

## 7. Architecture

```
            ┌─────────────────────── browser (single page) ───────────────────────┐
 operator → │ React UI (panels, sliders, scenario bar)                            │
            │      │ commands                         ▲ snapshot (10 Hz)          │
            │      ▼                                  │                           │
            │  PhysicsEngine (TS) ── step(0.1 s) ──► store (useSyncExternalStore) │
            │   • thermal ODEs   • dust/EDS   • Stirling   • triage   • raycast   │
            │      ▲  detection (bbox, wing, D̂)       │ state                     │
            │      │                                  ├──► ThermalVisionPanel     │
            │      └──────────── CV detector ◄────────┤    render→getImageData→CC │
            │                                         └──► SceneController (60 FPS│
            │                                              Three.js, imperative)  │
            └─────────────────────────────────────────────────────────────────────┘
```

* **No backend:** deterministic, offline-capable, demo-proof (Rule 12.3). The engine is pure TypeScript and unit-tested in Node.
* **The Three.js scene reads the store per frame** without React re-renders. React panels re-render at 10 Hz.
* **SaaS path:** in production the same engine runs server-side per site, fed by plant telemetry over a DTN link, and this UI becomes the multi-tenant operator console. Engine-agnostic snapshots make that a transport change, not a rewrite.

## 8. 5-Minute Pitch Script & Demo Run-Sheet

| Time | Beat | On screen |
|------|------|-----------|
| 0:00–0:40 | **Future:** "By 2030 the first reactor runs on the Moon, powering the habitat *and* the ice mines that make water and oxygen." | **[1] Nominal**: 40.0 kWe, drills spinning |
| 0:40–1:30 | **Problem + layer 1:** "A lander touches down and blasts dust at the radiators." | **[2] Dust storm**: the net auto-engages with sparks. Only 29 % sticks, the thermal box reads `DUST 29%`, and power dips to 36.5 kWe |
| 1:30–2:20 | **Layer 2:** "Our vision found the warm wing from pixels alone, so we clean just that wing." | **[3] Targeted EDS**: 29 → 2 %, the box clears, power is back to 40.0 kWe |
| 2:20–3:40 | **Layer 3 + users:** "Now the worst case: the shield itself fails mid-storm." | **[4] Shield malfunction**: the net flickers red and drops out. 89 % dust, 920 K, throttle to 24.5 kWe, **drills stop**, while life support, heaters and comms stay at 100 % |
| 3:40–4:20 | **Recovery:** "The operator has one button." | Click **Emergency backup EDS + restore triage**. The wing cleans, the core cools and the drills restart |
| 4:20–5:00 | **Impact:** autonomy where Earth can't help; SaaS for every lunar power plant. | Back to nominal |
| Q&A | Judges drive the **dust slider** and the manual-override sliders. | |

## 9. Q&A Defense Bank

* **Why does a dusty radiator get *hotter*?** Dust both lowers ε and adds an insulating blanket (k ≈ 1.5 × 10⁻³ W/m·K). The manifold behind it must reach a higher temperature to push the same heat through, and the segmented loop can't redistribute much (G_x = 15 W/K).
* **Why not just use the other 3 wings?** Each wing has an independent loop for puncture tolerance, and lateral core conduction is weak. That is realistic, and it is also why one fouled wing is dangerous.
* **Why does power dip in scenario 2 but crash in scenario 4?** Stirling efficiency scales with (1 − T_cold/T_hot). A warmer rejection side gradually costs output (linearised at 18.5 W/K → 36.5 kWe at ≈ 600 K). Above 750 K the pistons/regenerator risk damage, so protection cuts output to 24.5 kWe.
* **Why shed the drills, not comms?** Ice mining is deferrable: water-ice stockpiles cover days. Losing life support, frozen water lines or the Earth link is not deferrable. Variable-speed augers also make the drills the natural shock absorber in scenario 2.
* **Why 29 % and not 15 %?** Coverage is Poisson. The net cuts the arriving dust to 15 %, and 1 − 0.98·e^(−0.15·2.19) ≈ 0.29.
* **Is 920 K a real number?** It is a calibrated lumped-parameter result (two-point calibration, asserted in tests), not CFD. We state that openly.
* **How does the raycast work?** `THREE.Raycaster` hits a DoubleSide terrain mesh. Sorted hits alternate entry/exit, the thickness is the sum of the inside segments, and it is multiplied by 10 m/unit.
* **Why μ = 0.6 m⁻¹?** It is deliberately conservative: it underestimates attenuation, so it overestimates dose. A safety tool should err on the safe side.
* **Is it really AI?** It is classical CV plus physics inversion. It is explainable, deterministic and certifiable, which matters for nuclear safety. We do not claim a neural network.
* **Why 10 Hz?** The thermal time constants are seconds to minutes even after time-warp. 10 Hz resolves them with a 100 ms latency budget, while rendering stays at 60 FPS.
* **Security:** in production, command uplinks would be signed and the triage interlocks enforced on the plant controller, not just in the UI. The UI can request but never violate the life-support floor.
* **Scalability:** the engine is O(1) per site and the raycast is cached on pose change, so many sites can run per server instance.

## 10. Known Limitations (we know exactly where it's not perfect)

1. Lumped-parameter thermal network with calibrated constants; no CFD or radiative view factors between wings.
2. TIME_WARP = 120 compresses real transients (minutes to hours) into seconds for the demo.
3. Synthetic thermal sensor; the camera model, noise and dust mask are procedural.
4. Single effective μ; no neutron transport, no gamma/neutron split, no buildup tables.
5. Dust deposition is a scripted plume event, not a ballistic ejecta simulation.
6. The scene geometry is not to scale (the reactor is drawn oversized; 1 unit = 10 m for physics).
7. A single-site front-end only; multi-tenant SaaS is architected but not built.

## 11. Attribution & AI Disclosure (Rule 12.4 / 12.5)

* **Open source:** React 19, Three.js (incl. `OrbitControls`, `CSS2DRenderer` from `three/examples`), Vite, TypeScript, Tailwind CSS v4, Lucide React icons, Vitest. All MIT/ISC licensed.
* **No external models, datasets, textures or 3-D assets:** all geometry and textures are procedural.
* **AI-assisted development:** the team used an AI coding assistant to accelerate implementation. All physics equations, calibration targets, architecture and UI decisions were specified by the team and are covered by unit tests the team can run and explain.
* **Mockup images:** concept art generated for design reference only. The product UI is rebuilt from scratch.

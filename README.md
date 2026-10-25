# HELIOSCORE 2030 — Lunar Fission Digital Twin

Autonomous lunar nuclear-fission digital twin with electrostatic dust defense and a survival micro-grid. Built for the IEEE Lumen 2.0 "Beyond 2030" hackathon.

It is 100% browser-native: Vite + React 19 + TypeScript + Tailwind v4 + Three.js. There is no backend and no external assets; every mesh and texture is procedural, and every number on screen comes from a live 10 Hz coupled physics loop.

The full engineering and pitch-defense spec is in [`.plans/helioscore-2030-spec.md`](.plans/helioscore-2030-spec.md).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # physics + computer-vision calibration tests (Vitest)
npm run build    # type-check + production bundle
```

### Demo deep-links

| URL | State |
|-----|-------|
| `/?scenario=1` | Nominal baseline — 40.0 kWe, ≈410 K |
| `/?scenario=2` | Lander dust crisis — wing 0 fouled 89 %, core climbs to ≈920 K, Stirling throttles to 24.5 kWe |
| `/?scenario=3` | Autonomous protection — mesh net + CV-targeted EDS pulse + survival triage |
| `/?scenario=4` | Siting hazard — habitat in unshielded line of sight (press **Auto-Optimize Siting** to fix) |

**In the 3D viewport:**
- Drag the reactor to re-site it.
- Shift-drag to aim the B₄C shadow shield, or use the shield slider.
- Use the dust slider in the header to set any fouling level live.

## Architecture

```
src/
  simulation/   constants, terrain heightfield, thermal network, radiation raycaster,
                micro-grid triage, PhysicsEngine (10 Hz), external store
  vision/       Ironbow LUT, synthetic LWIR renderer, connected-component anomaly detector
  scene/        SceneController (imperative Three.js), procedural builders, dust + arcs
  components/   Mission-control panels (telemetry, viewport, thermal vision, triage, log)
```

- `PhysicsEngine` integrates the core-quadrant, wing-manifold and pipe ODEs, plus the dust plume, EDS, Stirling throttle and triage.
- The 3D scene reads engine snapshots every frame without causing React re-renders.
- The thermal-vision panel renders a real pixel buffer. It reads the buffer back with `getImageData`, detects the hot wing, and feeds the detection back into the engine. The EDS pulse only fires on the wing the detector located.

## Attribution

React, Three.js (incl. `OrbitControls`, `CSS2DRenderer`), Vite, TypeScript, Tailwind CSS, Lucide icons and Vitest, all MIT/ISC licensed. Development was AI-assisted; see the spec, §11.

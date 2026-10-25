# HELIOSCORE 2030 — User Guide

## What it is

HELIOSCORE 2030 is a mission-control screen for a nuclear power plant on the Moon. It shows a live simulation of the plant and protects the plant from lunar dust.

It matters because dust can stop the plant from cooling. When the plant cannot cool, it must cut its power, and the crew depends on that power for air, heat and communication.

The app is a **digital twin**: a software copy of the real plant that behaves like the real one. Everything runs in your web browser. It needs no server and no internet connection.

## Start the app

1. Install the dependencies once:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in a browser. Use full screen (F11) for the best view. The layout is designed for 1920 × 1080 and scales down to fit smaller screens.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the automatic checks for the physics and the heat-camera detector. |
| `npm run build` | Checks the code for errors and makes a production version in `dist/`. |

## Screen tour

The screen has five areas. They are listed here from top to bottom, left to right.

1. **Header** — the product name and the **SYSTEM STATUS**: green NOMINAL, amber WARNING or red CRITICAL.
2. **Scenario bar** — four demo buttons, [1] to [4], plus the **WING 0 DUST FOULING** slider. The slider sets how much dust covers radiator 0, from 0% to 100%.
3. **Left column** — four cards:
   - **CORE TEMP**: how hot the reactor is. Above 750 K the reactor protects itself by cutting power.
   - **RADIATOR EMISSIVITY**: how well the worst radiator can release heat. 0.89 is clean; 0.42 is badly covered.
   - **POWER OUTPUT**: the electricity the plant makes, in kilowatts (kW).
   - **DEFENSE & MINING STATUS**: the state of the mesh net, the ice drills and life support.
4. **3D viewport (centre)** — the crater, the reactor with its four radiator panels ("wings"), the habitat dome and three ice-drill rigs. You can drag to rotate the view and scroll to zoom. The toolbar buttons change the camera, switch the mesh net on or off, and show or hide the floating labels.
5. **Right column**:
   - **INFRARED THERMAL AI VISION**: a heat-camera image seen from above. A green box appears around any radiator that is too hot.
   - **SURVIVAL POWER TRIAGE**: how the available power is shared between life support, comms, habitat and ice drills. **MANUAL OVERRIDE** opens sliders to change the requests by hand.
   - **The large button**: starts the protection response. Its text changes with the situation.
   - **DIAGNOSTIC LOG**: a time-stamped list of every important event.

## The four scenarios

Each button starts from a clean, normal plant, so every run gives the same result. You can also open a scenario directly with a link, for example `http://localhost:5173/?scenario=2`.

### [1] Nominal baseline

- **What you see:** the radiators are clean, the reactor runs at about 411 K, and it makes 40.0 kW. The mesh net is on standby. The ice drills spin with 16.0 kW.
- **Why:** this is normal work. There is enough power for every system.

### [2] Dust storm (auto-shield on)

1. A spacecraft lands nearby and its engine blasts dust toward radiator 0.
2. Dust sensors detect the storm. The **mesh net turns on automatically**. It is a charged wire dome that pushes away 85% of the dust. You see sparks where dust hits the net.
3. Only about 29% of radiator 0 gets covered. The radiator warms up.
4. The heat camera finds the warm radiator and draws a green box: `AI THERMAL ANOMALY: DUST 29%`.
5. Power dips to about 36.5 kW. The ice drills slow down to about 12.5 kW. Life support, habitat and comms keep 100% of their power.

### [3] Targeted AI EDS cleanse (wing recovery)

1. The system uses the position of the green box to choose which radiator to clean.
2. An **EDS** (electrodynamic dust shield) pulse runs on that radiator only. EDS is a set of thin electrodes that send a moving electric wave across the panel and push the dust off.
3. Dust drops from 29% to 2% in about 2 seconds. The green box disappears.
4. Power returns to 40.0 kW and the drills return to full speed.

### [4] Shield malfunction (disable-drills failsafe)

1. A heavy dust storm starts, and at the same moment the **mesh net fails**. It flickers red and switches off. The screen shows `SHIELD FAULT: OFFLINE`.
2. With no net, 89% of radiator 0 gets covered. It glows orange in the 3D view.
3. The reactor heats up to about 920 K. Above 750 K it cuts power to 24.5 kW to protect itself.
4. **Failsafe triage** switches the ice drills off (0.0 kW). They stop spinning and their beacons turn red. This keeps life support (10 kW), habitat heating (9 kW) and comms (5 kW) at 100%. The water pipes stay well above freezing.
5. The large button turns red: **EMERGENCY BACKUP EDS + RESTORE TRIAGE**. Click it. Backup electrodes clean the radiator, the reactor cools, power returns to 40 kW and the drills start again. The net stays offline until it is repaired.

## How it works (simple version)

| Part | What it does |
|---|---|
| Physics engine | Calculates temperatures, dust, power and power sharing 10 times per second. Dust on a radiator traps heat, so the reactor gets hotter and makes less power. |
| 3D scene | Draws the crater, reactor, radiators, habitat, drills, net, dust and sparks 60 times per second from the physics values. All shapes are generated by code; no 3D model files are loaded. |
| Heat camera | Makes a heat image from the physics temperatures, then reads it back pixel by pixel. It finds the largest hot area, draws the box and estimates the dust amount. This is classic image analysis, not a trained neural network. |
| Power triage | Shares the available power in a fixed order: life support first, then habitat, then comms, then ice drills. In failsafe mode the drills get nothing. |

The code is in `src/`:

| Folder | Contents |
|---|---|
| `src/simulation/` | Physics engine, constants, power triage and the radiation model. |
| `src/vision/` | Heat-camera image and the hot-spot detector. |
| `src/scene/` | The Three.js 3D scene. |
| `src/components/` | The screen panels. |

## What is real and what is simulated

- **Real:** the software, the physics calculations, the image analysis and the automatic decisions all run live.
- **Simulated:** the sensors, the heat camera image and the dust storm. The prototype is not connected to hardware.
- **Simplified:** the heat model uses a few connected "blocks" instead of a detailed engineering model, and time runs 120 times faster than real time so the story fits in seconds.
- **Hidden:** a radiation-shielding model still exists in the code and the tests, but it is not shown on screen, to keep the pitch focused on one story.

## Troubleshooting

| Problem | Fix |
|---|---|
| The page is blank after you change code | Reload the page. If it stays blank, stop and restart `npm run dev`. |
| The 3D view is very slow | Close other browser tabs. The app needs a graphics card that supports WebGL. |
| The layout looks too small | Use full screen (F11). The screen scales to fit the window. |
| A scenario shows old values | Click the scenario button again. Every scenario starts from a clean, normal plant. |

## Glossary

| Term | Meaning |
|---|---|
| Digital twin | A live software copy of a real machine that behaves like the real one. |
| Radiator / wing | A large flat panel that releases the reactor's waste heat into space. |
| Emissivity | How well a surface releases heat. Clean radiator ≈ 0.89; dusty ≈ 0.42. |
| kW (kilowatt) | A unit of electric power. 40 kW is about the power of 20 home kettles. |
| K (kelvin) | A temperature scale that starts at absolute zero. 273 K is the freezing point of water. |
| Mesh net | A charged wire dome around the reactor that pushes dust away. |
| EDS | Electrodynamic dust shield: electrodes on the panel that push dust off with a moving electric wave. |
| ISRU | In-situ resource utilisation: using local materials, here mining ice for water and oxygen. |
| Triage | Deciding who gets power first when there is not enough for everyone. |
| Failsafe | A safe mode the system enters by itself when something fails. |

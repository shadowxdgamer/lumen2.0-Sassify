# Nuclear Safety Classifier — Programmer Documentation

An **educational simulation**: a scikit-learn model classifies a (simplified, generic PWR)
reactor operating point as `SAFE`, `WARNING` or `CRITICAL`, with a PySide6 (Qt) GUI and
2D/3D plots.

> **Not for real safety decisions.** The data is synthetic, the limits are illustrative
> figures (not licensed design limits), and real reactor protection relies on
> deterministic, certified systems, not on a machine-learning model.

## 1. Quick start

```bash
pip install -r requirements.txt
python data_generator.py   # 1. create data/nuclear_safety_dataset.csv
python train_model.py      # 2. train and save models/safety_model.joblib
python gui_app.py          # 3. open the interface
```

`gui_app.py` trains automatically on first run if no model file exists.
PySide6 is installed by pip on every OS; no system packages are required.
Headless test (CI): `QT_QPA_PLATFORM=offscreen python your_test.py`.

## 2. Project layout

| File | Role |
|---|---|
| `config.py` | Single source of truth: feature ranges/defaults, class names/colors, paths, thresholds |
| `data_generator.py` | Builds the synthetic labelled dataset from a transparent risk formula |
| `model.py` | Train / save / load / predict helpers (RandomForest) |
| `train_model.py` | CLI script: dataset -> model -> metrics report |
| `plots.py` | Matplotlib/seaborn drawing functions (no GUI code) |
| `gui_app.py` | PySide6 (Qt) window: inputs, result, 4 plot tabs. Runs on Windows, macOS, Linux |

Dependency direction (no cycles): `config` <- `data_generator`, `model` <- `train_model`, `plots` <- `gui_app`.

## 3. Features (inputs)

| Key | Meaning | Unit | Range | Default |
|---|---|---|---|---|
| `core_temp_c` | Core outlet temperature | °C | 250 – 380 | 310 |
| `pressure_mpa` | Coolant pressure | MPa | 12 – 18.5 | 15.5 |
| `coolant_flow_pct` | Coolant flow | % of nominal | 40 – 110 | 100 |
| `power_pct` | Reactor thermal power | % of nominal | 0 – 110 | 80 |
| `radiation_msv_h` | Containment radiation | mSv/h | 0 – 20 | 0.5 |
| `rod_insertion_pct` | Control rod insertion | % | 0 – 100 | 30 |

Target `safety_class`: `0 = SAFE`, `1 = WARNING`, `2 = CRITICAL`.
The CSV also contains `risk_score` (the label source). **It is not a model input**; using it
as a feature would leak the answer.

## 4. How labels are produced (`data_generator.compute_risk`)

Each feature is turned into a normalised *stress* (about 0 = comfortable, 1 = at limit):

```
temp      = max(0, (T - 280) / 70)
press     = |P - 15.5| / 1.7                  # both over- and under-pressure are bad
flow_def  = max(0, (100 - flow) / 50)         # lack of cooling
power     = P_th / 105
rad       = dose_rate / 10
rods      = (1 - rod_insertion/100) * P_th/100  # un-inserted rods at high power

risk = 0.25 temp + 0.20 press + 0.20 flow_def + 0.15 power
     + 0.10 rad + 0.10 rods + 0.30 * power * flow_def    # interaction term
```

Gaussian noise (σ = 0.03) is added, then thresholds in `config.py` give the class:
`risk < 0.55` SAFE, `< 0.85` WARNING, otherwise CRITICAL.

Sampling: 70 % of rows near nominal values (normal distribution), 30 % uniform over the
full range, so rare dangerous states are represented. Default: 6000 rows, seed 42.

## 5. Model

`RandomForestClassifier(n_estimators=200, max_depth=12, class_weight="balanced")`,
80/20 stratified split. Metrics stored in the `.joblib` file and shown in the GUI:

- `accuracy`, `precision_macro`
- `precision_critical`: of all CRITICAL alarms, the fraction that were real
- `recall_critical`: of all real CRITICAL states, the fraction detected

Typical results with defaults: accuracy ≈ 0.88, precision_critical ≈ 0.85,
**recall_critical ≈ 0.68**. For a safety tool, missed critical states matter most, so
this is the number to improve first (see section 8).

## 6. API reference

```python
# model.py
train(df) -> {"model", "metrics", "report"}
save(bundle) / load() -> {"model", "metrics"}
predict_proba_df(model, df) -> ndarray (n, 3)
predict(model, values: dict) -> (class_index, probabilities[3])

# data_generator.py
generate_dataset(n=6000, seed=42, noise=0.03) -> DataFrame
compute_risk(df) -> ndarray
risk_to_class(risk) -> ndarray

# plots.py  (each draws into a matplotlib Figure)
plot_probabilities(fig, proba, values)
plot_safety_map(fig, model, values, proba)       # 2D contour: temperature x power
plot_surface_3d(fig, model, values, proba)       # 3D: coolant flow x power -> P(SAFE)
plot_dataset_overview(fig, df, model)            # seaborn heatmap + feature importance
```

Programmatic use:

```python
import model as ml
bundle = ml.load()
cls, proba = ml.predict(bundle["model"], {
    "core_temp_c": 330, "pressure_mpa": 16.0, "coolant_flow_pct": 90,
    "power_pct": 95, "radiation_msv_h": 1.0, "rod_insertion_pct": 20})
```

Inputs to `predict` must contain all keys of `config.FEATURE_NAMES`.

## 7. GUI behaviour

- Inputs are `QDoubleSpinBox` widgets: the allowed range from `config.FEATURES` is enforced by the widget itself, so no manual validation code is needed.
- **Evaluate safety** updates the class label, confidence and three plots.
- Tabs: *Probabilities* (2D bars), *Safety map 2D* (danger contour), *Surface 3D*,
  *Dataset* (seaborn).
- The map and surface vary two features and hold the others at the entered values;
  the black ✕ marks the current point.

## 8. Extending the project

- **Add a feature**: add one entry to `FEATURES` in `config.py`, include it in
  `compute_risk`, regenerate data, retrain. The GUI builds its input rows from `FEATURES`.
- **Change limits/thresholds**: edit `config.py` (`WARNING_THRESHOLD`, `CRITICAL_THRESHOLD`)
  and the constants in `compute_risk`.
- **Improve critical recall**: lower the thresholds' ambiguity (reduce `noise`), or use
  `predict_proba` and flag CRITICAL when `P(CRITICAL) > 0.3` instead of the arg-max.
- **Swap the model**: change only `model.train`; the rest uses `predict_proba`.

## 9. Known limitations

- Labels are rule-generated, so the model learns the rule, not real physics or real plant data.
- Features are treated as independent samples (no time series, no transients).
- No unit tests are included; `python train_model.py` prints the quality report after any change.

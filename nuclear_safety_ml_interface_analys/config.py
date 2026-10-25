"""Central configuration: feature definitions, class labels and file paths.

Every other module imports from here, so a feature is declared in ONE place.
All values are simplified, illustrative figures for a generic pressurised-water
reactor (PWR). They are NOT licensed design limits.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "nuclear_safety_dataset.csv"
MODEL_PATH = BASE_DIR / "models" / "safety_model.joblib"

RANDOM_SEED = 42

# name -> (label, unit, min, max, default/nominal)
FEATURES = {
    "core_temp_c":      ("Core outlet temperature", "°C",    250.0, 380.0, 310.0),
    "pressure_mpa":     ("Coolant pressure",        "MPa",    12.0,  18.5,  15.5),
    "coolant_flow_pct": ("Coolant flow",            "% nom",  40.0, 110.0, 100.0),
    "power_pct":        ("Reactor power",           "% nom",   0.0, 110.0,  80.0),
    "radiation_msv_h":  ("Containment radiation",   "mSv/h",   0.0,  20.0,   0.5),
    "rod_insertion_pct": ("Control rod insertion",  "%",       0.0, 100.0,  30.0),
}

FEATURE_NAMES = list(FEATURES.keys())
TARGET = "safety_class"

# Class index -> name (order matters: index = predicted class)
CLASS_NAMES = ["SAFE", "WARNING", "CRITICAL"]
CLASS_COLORS = ["#2e8b57", "#e6a817", "#c0392b"]

# Risk-score thresholds used by the data generator (see data_generator.py)
WARNING_THRESHOLD = 0.55
CRITICAL_THRESHOLD = 0.85

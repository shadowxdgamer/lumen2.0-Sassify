"""Synthetic dataset generator for the nuclear safety classifier.

Labels come from a transparent, physics-inspired risk score (``compute_risk``)
plus a little measurement noise, so the ML model has a real but learnable
relationship to recover.

Run:  python data_generator.py
"""
import numpy as np
import pandas as pd

import config as cfg


def compute_risk(df: pd.DataFrame) -> np.ndarray:
    """Return a risk score per row (0 = very safe, >= 1 = severe).

    Each term is a normalised "stress" (0 at comfortable, 1 at limit):
      - temperature : rises linearly from 280 °C to the 350 °C limit
      - pressure    : deviation from nominal 15.5 MPa, limit at +/- 1.7 MPa
      - flow deficit: lack of cooling below 100 % flow
      - power       : relative to the 105 % trip setpoint
      - radiation   : relative to a 10 mSv/h alarm level
      - rod stress  : un-inserted rods while power is high
      - interaction : high power combined with low cooling flow
    """
    temp = np.clip((df["core_temp_c"] - 280.0) / 70.0, 0, None)
    press = np.abs(df["pressure_mpa"] - 15.5) / 1.7
    flow_deficit = np.clip((100.0 - df["coolant_flow_pct"]) / 50.0, 0, None)
    power = df["power_pct"] / 105.0
    rad = df["radiation_msv_h"] / 10.0
    rods = (1.0 - df["rod_insertion_pct"] / 100.0) * (df["power_pct"] / 100.0)

    risk = (
        0.25 * temp
        + 0.20 * press
        + 0.20 * flow_deficit
        + 0.15 * power
        + 0.10 * rad
        + 0.10 * rods
        + 0.30 * power * flow_deficit
    )
    return risk.to_numpy()


def risk_to_class(risk: np.ndarray) -> np.ndarray:
    """Map a risk score to class index: 0 SAFE, 1 WARNING, 2 CRITICAL."""
    return np.digitize(risk, [cfg.WARNING_THRESHOLD, cfg.CRITICAL_THRESHOLD])


def _sample_features(n: int, rng: np.random.Generator) -> pd.DataFrame:
    """Mix of 'near nominal' samples (70 %) and wide uniform samples (30 %)."""
    n_nominal = int(n * 0.7)
    data = {}
    for name, (_, _, lo, hi, nominal) in cfg.FEATURES.items():
        spread = (hi - lo) / 6.0
        near = rng.normal(nominal, spread, n_nominal)
        wide = rng.uniform(lo, hi, n - n_nominal)
        data[name] = np.clip(np.concatenate([near, wide]), lo, hi)
    df = pd.DataFrame(data)
    return df.sample(frac=1.0, random_state=int(rng.integers(1e9))).reset_index(drop=True)


def generate_dataset(n: int = 6000, seed: int = cfg.RANDOM_SEED, noise: float = 0.03) -> pd.DataFrame:
    """Build the labelled dataset. ``noise`` is the std-dev added to the risk."""
    rng = np.random.default_rng(seed)
    df = _sample_features(n, rng)
    risk = compute_risk(df) + rng.normal(0.0, noise, len(df))
    df["risk_score"] = risk.round(4)
    df[cfg.TARGET] = risk_to_class(risk)
    return df.round(3)


def main() -> None:
    df = generate_dataset()
    cfg.DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(cfg.DATA_PATH, index=False)
    counts = df[cfg.TARGET].value_counts().sort_index()
    print(f"Saved {len(df)} rows -> {cfg.DATA_PATH}")
    for idx, name in enumerate(cfg.CLASS_NAMES):
        print(f"  {name:<9}: {counts.get(idx, 0)}")


if __name__ == "__main__":
    main()

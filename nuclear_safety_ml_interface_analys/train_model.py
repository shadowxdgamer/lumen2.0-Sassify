"""Train the safety model from the CSV dataset (generates it if missing).

Run:  python train_model.py
"""
import pandas as pd

import config as cfg
import data_generator
import model as ml


def main() -> None:
    if not cfg.DATA_PATH.exists():
        data_generator.main()
    df = pd.read_csv(cfg.DATA_PATH)

    bundle = ml.train(df)
    ml.save(bundle)

    print(bundle["report"])
    for name, value in bundle["metrics"].items():
        print(f"{name:<20}: {value:.3f}")
    print(f"Model saved -> {cfg.MODEL_PATH}")


if __name__ == "__main__":
    main()

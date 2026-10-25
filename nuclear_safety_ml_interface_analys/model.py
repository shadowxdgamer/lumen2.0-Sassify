"""Training, saving, loading and prediction helpers (scikit-learn)."""
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, precision_score, recall_score
from sklearn.model_selection import train_test_split

import config as cfg


def train(df: pd.DataFrame) -> dict:
    """Fit a RandomForest and return {'model', 'metrics', 'report'}."""
    X = df[cfg.FEATURE_NAMES]
    y = df[cfg.TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=cfg.RANDOM_SEED
    )
    model = RandomForestClassifier(
        n_estimators=200, max_depth=12, class_weight="balanced",
        random_state=cfg.RANDOM_SEED, n_jobs=-1,
    )
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    metrics = {
        "accuracy": accuracy_score(y_test, pred),
        "precision_macro": precision_score(y_test, pred, average="macro", zero_division=0),
        # Precision on the dangerous class: of all CRITICAL alarms, how many were real
        "precision_critical": precision_score(y_test, pred, labels=[2], average="macro", zero_division=0),
        # Recall on the dangerous class: of all real CRITICAL states, how many were caught
        "recall_critical": recall_score(y_test, pred, labels=[2], average="macro", zero_division=0),
    }
    report = classification_report(y_test, pred, target_names=cfg.CLASS_NAMES, zero_division=0)
    return {"model": model, "metrics": metrics, "report": report}


def save(bundle: dict) -> None:
    cfg.MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": bundle["model"], "metrics": bundle["metrics"]}, cfg.MODEL_PATH)


def load() -> dict:
    """Load the saved bundle {'model', 'metrics'}."""
    if not cfg.MODEL_PATH.exists():
        raise FileNotFoundError(
            f"No trained model at {cfg.MODEL_PATH}. Run: python train_model.py"
        )
    return joblib.load(cfg.MODEL_PATH)


def predict_proba_df(model, df: pd.DataFrame) -> np.ndarray:
    """Class probabilities for many rows, shape (n_rows, n_classes)."""
    proba = model.predict_proba(df[cfg.FEATURE_NAMES])
    full = np.zeros((len(df), len(cfg.CLASS_NAMES)))
    full[:, model.classes_] = proba  # safe even if a class were missing in training
    return full


def predict(model, values: dict) -> tuple[int, np.ndarray]:
    """Predict one operating point. Returns (class_index, probabilities[3])."""
    proba = predict_proba_df(model, pd.DataFrame([values]))[0]
    return int(proba.argmax()), proba

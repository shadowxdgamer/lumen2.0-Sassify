"""Plot functions. Each one draws into a matplotlib Figure (no GUI code here)."""
import numpy as np
import pandas as pd
import seaborn as sns

import config as cfg
import model as ml

GRID_SIZE = 35  # points per axis for the safety maps


def _grid_probabilities(model, values: dict, x_key: str, y_key: str):
    """Vary two features over their full range, keep the others fixed."""
    _, _, x_lo, x_hi, _ = cfg.FEATURES[x_key]
    _, _, y_lo, y_hi, _ = cfg.FEATURES[y_key]
    xs = np.linspace(x_lo, x_hi, GRID_SIZE)
    ys = np.linspace(y_lo, y_hi, GRID_SIZE)
    X, Y = np.meshgrid(xs, ys)

    grid = pd.DataFrame([values] * X.size)
    grid[x_key] = X.ravel()
    grid[y_key] = Y.ravel()
    proba = ml.predict_proba_df(model, grid)
    return X, Y, proba


def _axis_label(key: str) -> str:
    label, unit, *_ = cfg.FEATURES[key]
    return f"{label} [{unit}]"


def plot_probabilities(fig, proba: np.ndarray, values: dict) -> None:
    """2D: class probabilities (left) and where each input sits in its range (right)."""
    fig.clear()
    ax_prob = fig.add_subplot(1, 2, 1)
    ax_prob.bar(cfg.CLASS_NAMES, proba * 100, color=cfg.CLASS_COLORS)
    ax_prob.set_ylim(0, 112)
    ax_prob.set_yticks(range(0, 101, 20))
    ax_prob.set_ylabel("Probability [%]")
    ax_prob.set_title("Predicted safety class")
    for i, p in enumerate(proba):
        ax_prob.text(i, p * 100 + 1.5, f"{p * 100:.0f}%", ha="center")

    ax_pos = fig.add_subplot(1, 2, 2)
    labels, fractions = [], []
    for key in cfg.FEATURE_NAMES:
        label, _, lo, hi, _ = cfg.FEATURES[key]
        labels.append(label)
        fractions.append((values[key] - lo) / (hi - lo))
    ax_pos.barh(labels, fractions, color="#4c72b0")
    ax_pos.set_xlim(0, 1)
    ax_pos.set_xlabel("Position in allowed range (0 = min, 1 = max)")
    ax_pos.set_title("Input levels")
    ax_pos.invert_yaxis()


def plot_safety_map(fig, model, values: dict, proba: np.ndarray) -> None:
    """2D: danger level (1 - P(SAFE)) over temperature and power."""
    fig.clear()
    ax = fig.add_subplot(1, 1, 1)
    x_key, y_key = "core_temp_c", "power_pct"
    X, Y, grid_proba = _grid_probabilities(model, values, x_key, y_key)
    danger = (1.0 - grid_proba[:, 0]).reshape(X.shape)

    contour = ax.contourf(X, Y, danger, levels=np.linspace(0, 1, 11), cmap="RdYlGn_r")
    fig.colorbar(contour, ax=ax, label="Danger level = 1 - P(SAFE)")
    ax.scatter(values[x_key], values[y_key], c="black", marker="X", s=120, label="Current point")
    ax.set_xlabel(_axis_label(x_key))
    ax.set_ylabel(_axis_label(y_key))
    ax.set_title("Safety map (other inputs held at current values)")
    ax.legend(loc="upper left")


def plot_surface_3d(fig, model, values: dict, proba: np.ndarray) -> None:
    """3D: P(SAFE) surface over coolant flow and reactor power."""
    fig.clear()
    ax = fig.add_subplot(1, 1, 1, projection="3d")
    x_key, y_key = "coolant_flow_pct", "power_pct"
    X, Y, grid_proba = _grid_probabilities(model, values, x_key, y_key)
    Z = grid_proba[:, 0].reshape(X.shape) * 100

    ax.plot_surface(X, Y, Z, cmap="RdYlGn", vmin=0, vmax=100, linewidth=0, alpha=0.9)
    ax.scatter([values[x_key]], [values[y_key]], [proba[0] * 100],
               c="black", marker="X", s=80, depthshade=False)
    ax.set_xlabel(_axis_label(x_key))
    ax.set_ylabel(_axis_label(y_key))
    ax.set_zlabel("P(SAFE) [%]")
    ax.set_zlim(0, 100)
    ax.set_title("Probability of SAFE (other inputs held at current values)")
    ax.view_init(elev=28, azim=-125)


def plot_dataset_overview(fig, df: pd.DataFrame, model) -> None:
    """Seaborn: feature correlation heatmap and model feature importance."""
    fig.clear()
    ax_corr = fig.add_subplot(1, 2, 1)
    columns = cfg.FEATURE_NAMES + ["risk_score"]
    sns.heatmap(df[columns].corr(), annot=True, fmt=".2f", cmap="coolwarm",
                vmin=-1, vmax=1, cbar=False, annot_kws={"size": 7}, ax=ax_corr)
    ax_corr.set_title("Dataset correlations")
    ax_corr.tick_params(labelsize=7)

    ax_imp = fig.add_subplot(1, 2, 2)
    importance = pd.Series(model.feature_importances_, index=cfg.FEATURE_NAMES).sort_values()
    sns.barplot(x=importance.values, y=importance.index, color="#4c72b0", ax=ax_imp)
    ax_imp.set_title("Model feature importance")
    ax_imp.tick_params(labelsize=7)

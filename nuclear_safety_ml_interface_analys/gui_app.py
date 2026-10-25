"""PySide6 (Qt) interface: enter reactor parameters, get a safety class + plots.

Works on Windows, macOS and Linux (pip install PySide6).

Run:  python gui_app.py
"""
import sys

import pandas as pd
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtWidgets import (
    QApplication, QDoubleSpinBox, QFormLayout, QGroupBox, QHBoxLayout, QLabel,
    QMainWindow, QPushButton, QTabWidget, QVBoxLayout, QWidget,
)

import config as cfg
import model as ml
import plots

TABS = ("Probabilities", "Safety map 2D", "Surface 3D", "Dataset")


class SafetyApp(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Nuclear Safety Classifier (educational simulation)")
        self.resize(1150, 650)

        self.bundle = self._load_or_train()
        self.model = self.bundle["model"]
        self.dataset = pd.read_csv(cfg.DATA_PATH) if cfg.DATA_PATH.exists() else None

        self.inputs: dict[str, QDoubleSpinBox] = {}
        self.canvases: dict[str, FigureCanvasQTAgg] = {}

        root = QWidget()
        layout = QHBoxLayout(root)
        layout.addWidget(self._build_input_panel())
        layout.addWidget(self._build_plot_tabs(), stretch=1)
        self.setCentralWidget(root)

        self._draw_dataset_tab()
        self.on_predict()

    # ---------- setup ----------
    @staticmethod
    def _load_or_train() -> dict:
        try:
            return ml.load()
        except FileNotFoundError:
            import train_model  # first run: build dataset and model automatically
            train_model.main()
            return ml.load()

    def _build_input_panel(self) -> QWidget:
        panel = QWidget()
        panel.setFixedWidth(330)
        column = QVBoxLayout(panel)

        group = QGroupBox("Reactor parameters")
        form = QFormLayout(group)
        for key, (label, unit, lo, hi, default) in cfg.FEATURES.items():
            spin = QDoubleSpinBox()
            spin.setRange(lo, hi)          # range validation is built in
            spin.setDecimals(2)
            spin.setValue(default)
            spin.setSuffix(f" {unit}")
            form.addRow(label, spin)
            self.inputs[key] = spin
        column.addWidget(group)

        buttons = QHBoxLayout()
        evaluate = QPushButton("Evaluate safety")
        evaluate.clicked.connect(self.on_predict)
        reset = QPushButton("Reset defaults")
        reset.clicked.connect(self.on_reset)
        buttons.addWidget(evaluate)
        buttons.addWidget(reset)
        column.addLayout(buttons)

        result = QGroupBox("Result")
        result_layout = QVBoxLayout(result)
        self.class_label = QLabel("-")
        self.confidence_label = QLabel("Confidence: -")
        result_layout.addWidget(self.class_label)
        result_layout.addWidget(self.confidence_label)
        column.addWidget(result)

        m = self.bundle["metrics"]
        column.addWidget(QLabel(
            f"Model accuracy: {m['accuracy']:.1%}\n"
            f"Precision (CRITICAL): {m['precision_critical']:.1%}\n"
            f"Recall (CRITICAL): {m['recall_critical']:.1%}"
        ))
        column.addStretch()
        return panel

    def _build_plot_tabs(self) -> QTabWidget:
        tabs = QTabWidget()
        for name in TABS:
            canvas = FigureCanvasQTAgg(Figure(figsize=(7, 5), constrained_layout=True))
            tabs.addTab(canvas, name)
            self.canvases[name] = canvas
        return tabs

    # ---------- logic ----------
    def read_inputs(self) -> dict:
        return {key: spin.value() for key, spin in self.inputs.items()}

    def on_predict(self) -> None:
        values = self.read_inputs()
        class_index, proba = ml.predict(self.model, values)

        color = cfg.CLASS_COLORS[class_index]
        self.class_label.setText(cfg.CLASS_NAMES[class_index])
        self.class_label.setStyleSheet(f"color: {color}; font-size: 26px; font-weight: bold;")
        self.confidence_label.setText(f"Confidence: {proba[class_index]:.1%}")

        self._redraw("Probabilities", lambda fig: plots.plot_probabilities(fig, proba, values))
        self._redraw("Safety map 2D",
                     lambda fig: plots.plot_safety_map(fig, self.model, values, proba))
        self._redraw("Surface 3D",
                     lambda fig: plots.plot_surface_3d(fig, self.model, values, proba))

    def on_reset(self) -> None:
        for key, spin in self.inputs.items():
            spin.setValue(cfg.FEATURES[key][4])
        self.on_predict()

    def _redraw(self, tab: str, draw) -> None:
        canvas = self.canvases[tab]
        draw(canvas.figure)
        canvas.draw_idle()

    def _draw_dataset_tab(self) -> None:
        if self.dataset is None:
            self._redraw("Dataset", lambda fig: fig.text(0.5, 0.5, "Dataset file not found", ha="center"))
        else:
            self._redraw("Dataset", lambda fig: plots.plot_dataset_overview(fig, self.dataset, self.model))


def main() -> None:
    app = QApplication(sys.argv)
    window = SafetyApp()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

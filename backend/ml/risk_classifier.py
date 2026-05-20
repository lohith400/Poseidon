"""
ML-based shortage risk: Random Forest classifier trained on synthetic labels
from historical fill/demand/rain patterns (per-hub features).
"""
from __future__ import annotations

from typing import List, Optional

import numpy as np

from capacity import available_litres, fill_percent

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler

    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# Risk thresholds for labeling training data
_LABEL_CRITICAL = 70
_LABEL_HIGH = 45
_LABEL_MEDIUM = 25


def _rule_risk(fill_pct: float, demand_ratio: float, rain: float) -> float:
    demand_pressure = min(100, demand_ratio * 40)
    fill_risk = max(0, 100 - fill_pct) * 0.5
    rain_relief = min(30, rain * 3)
    return max(0.0, min(100.0, demand_pressure + fill_risk - rain_relief))


def _risk_to_class(score: float) -> int:
    if score >= _LABEL_CRITICAL:
        return 2
    if score >= _LABEL_HIGH:
        return 1
    if score >= _LABEL_MEDIUM:
        return 0
    return -1


def _build_training_from_history(
    demands: List[float],
    rains: List[float],
    capacity: int,
    initial_fill_pct: float = 75.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Simulate fill level over history to generate labeled samples."""
    features, labels = [], []
    fill = capacity * (initial_fill_pct / 100.0)
    for i in range(7, len(demands)):
        d = demands[i]
        rain = rains[i] if i < len(rains) else 0.0
        avail = max(fill, 1)
        fill_pct = 100.0 * fill / max(capacity, 1)
        demand_ratio = d / avail
        trend = (demands[i] - demands[i - 7]) / max(demands[i - 7], 1)
        feat = [
            fill_pct,
            demand_ratio,
            rain,
            float(np.mean(demands[i - 7 : i])),
            trend,
            float(i % 7),
        ]
        score = _rule_risk(fill_pct, demand_ratio, rain)
        labels.append(_risk_to_class(score))
        features.append(feat)
        fill = max(0, fill - d + rain * 1000)
    return np.array(features), np.array(labels)


def ml_shortage_risk_score(
    hub,
    predicted_daily_demand: float,
    avg_rainfall_mm: float,
    historical_demands: Optional[List[float]] = None,
    historical_rain: Optional[List[float]] = None,
) -> dict:
    """
    Returns { score, method, class_label, feature_importance }.
  Falls back to rule-based if sklearn unavailable or insufficient data.
    """
    fill_pct = fill_percent(hub)
    avail = max(available_litres(hub), 1)
    demand_ratio = predicted_daily_demand / avail

    rule_score = _rule_risk(fill_pct, demand_ratio, avg_rainfall_mm)

    if not SKLEARN_AVAILABLE or not historical_demands or len(historical_demands) < 30:
        return {
            "score": round(rule_score, 1),
            "method": "rule_based",
            "class_label": _class_name(_risk_to_class(rule_score)),
        }

    try:
        x_train, y_train = _build_training_from_history(
            historical_demands,
            historical_rain or [],
            hub.capacity_litres,
        )
        if len(x_train) < 20 or len(set(y_train)) < 2:
            raise ValueError("insufficient class diversity")

        scaler = StandardScaler()
        x_scaled = scaler.fit_transform(x_train)

        clf = RandomForestClassifier(
            n_estimators=60,
            max_depth=6,
            random_state=42,
            class_weight="balanced",
        )
        clf.fit(x_scaled, y_train)

        trend = 0.0
        if len(historical_demands) >= 7:
            trend = (historical_demands[-1] - historical_demands[-7]) / max(
                historical_demands[-7], 1
            )

        x_now = np.array([[
            fill_pct,
            demand_ratio,
            avg_rainfall_mm,
            float(np.mean(historical_demands[-7:])),
            trend,
            float(len(historical_demands) % 7),
        ]])
        x_now_s = scaler.transform(x_now)
        proba = clf.predict_proba(x_now_s)[0]
        classes = clf.classes_
        # Map class index to risk score midpoint
        class_scores = {-1: 10, 0: 35, 1: 55, 2: 82}
        score = sum(proba[i] * class_scores.get(classes[i], 50) for i in range(len(classes)))

        imp = dict(zip(
            ["fill_pct", "demand_ratio", "rain", "avg_demand_7d", "trend", "dow"],
            [round(float(x), 4) for x in clf.feature_importances_],
        ))

        return {
            "score": round(float(score), 1),
            "method": "random_forest",
            "class_label": _class_name(int(clf.predict(x_now_s)[0])),
            "feature_importance": imp,
        }
    except Exception:
        return {
            "score": round(rule_score, 1),
            "method": "rule_based",
            "class_label": _class_name(_risk_to_class(rule_score)),
        }


def _class_name(cls: int) -> str:
    return {2: "critical", 1: "high", 0: "medium", -1: "low"}.get(cls, "low")

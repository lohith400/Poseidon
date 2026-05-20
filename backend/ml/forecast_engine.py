"""
Time-series ML models: ARIMA, Holt-Winters, Prophet, Gradient Boosting, ensemble.

Each model is back-tested on the last HOLDOUT_DAYS of history; ensemble weights
models by inverse MAPE.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

HOLDOUT_DAYS = 14
MIN_TRAIN_POINTS = 28

# ── Optional dependencies ─────────────────────────────────────────────────────

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    HOLT_AVAILABLE = True
except ImportError:
    HOLT_AVAILABLE = False

try:
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    ARIMA_AVAILABLE = True
except ImportError:
    ARIMA_AVAILABLE = False

try:
    from sklearn.ensemble import GradientBoostingRegressor

    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    from prophet import Prophet
    import pandas as pd

    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False


ML_MODELS_INFO = {
    "arima": {
        "name": "ARIMA (SARIMAX)",
        "type": "time_series",
        "description": "AutoRegressive Integrated Moving Average with weekly seasonality",
    },
    "holt_winters": {
        "name": "Holt-Winters",
        "type": "time_series",
        "description": "Exponential smoothing with trend and seasonality",
    },
    "prophet": {
        "name": "Facebook Prophet",
        "type": "time_series",
        "description": "Bayesian structural time series for seasonal water demand",
    },
    "gradient_boosting": {
        "name": "Gradient Boosting",
        "type": "supervised_ml",
        "description": "Scikit-learn regressor on lag + rainfall features",
    },
    "seasonal_naive": {
        "name": "Seasonal Naive",
        "type": "baseline",
        "description": "Week-of-year baseline (always available)",
    },
    "ensemble": {
        "name": "Weighted Ensemble",
        "type": "ensemble",
        "description": "Combines all available models by back-test accuracy",
    },
}


@dataclass
class ModelForecast:
    predictions: List[float]
    model_id: str
    mape: Optional[float] = None
    mae: Optional[float] = None
    weight: float = 1.0
    available: bool = True
    error: Optional[str] = None


@dataclass
class EnsembleResult:
    predictions: List[float]
    selected_model: str
    models: Dict[str, ModelForecast] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)


def get_available_models() -> Dict[str, bool]:
    return {
        "arima": ARIMA_AVAILABLE,
        "holt_winters": HOLT_AVAILABLE,
        "prophet": PROPHET_AVAILABLE,
        "gradient_boosting": SKLEARN_AVAILABLE,
        "seasonal_naive": True,
        "ensemble": True,
    }


def _mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    mask = actual != 0
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)


def _mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))


def _seasonal_naive(values: np.ndarray, dates: List[date], horizon: int) -> np.ndarray:
    if len(values) == 0:
        return np.zeros(horizon)
    seasonal: Dict[int, List[float]] = {}
    for i, v in enumerate(values):
        w = dates[i].isocalendar()[1] % 52
        seasonal.setdefault(w, []).append(float(v))
    seasonal_avg = {w: float(np.mean(vs)) for w, vs in seasonal.items()}
    global_avg = float(np.mean(values))
    last = dates[-1]
    out = []
    for h in range(1, horizon + 1):
        d = last + timedelta(days=h)
        w = d.isocalendar()[1] % 52
        out.append(max(0.0, seasonal_avg.get(w, global_avg)))
    return np.array(out)


def _arima_predict(train: np.ndarray, horizon: int) -> np.ndarray:
    # Weekly seasonality: SARIMAX(1,1,1) x (1,1,1,7) simplified to (1,0,1) with seasonal 7
    order = (1, 1, 1)
    seasonal = (1, 0, 1, 7) if len(train) >= 60 else (0, 0, 0, 0)
    model = SARIMAX(
        train,
        order=order,
        seasonal_order=seasonal,
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    fit = model.fit(disp=False, maxiter=50)
    fc = fit.forecast(steps=horizon)
    return np.maximum(fc, 0.0)


def _holt_predict(train: np.ndarray, horizon: int) -> np.ndarray:
    period = 7 if len(train) >= 14 else None
    model = ExponentialSmoothing(
        train,
        trend="add",
        seasonal="add" if period else None,
        seasonal_periods=period,
    )
    fit = model.fit(optimized=True)
    fc = fit.forecast(horizon)
    return np.maximum(np.asarray(fc), 0.0)


def _prophet_predict(dates: List[date], train: np.ndarray, horizon: int) -> np.ndarray:
    df = pd.DataFrame({"ds": dates[-len(train) :], "y": train})
    m = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
    )
    m.fit(df)
    future = m.make_future_dataframe(periods=horizon)
    pred = m.predict(future)
    tail = pred["yhat"].tail(horizon).values
    return np.maximum(tail, 0.0)


def _build_ml_features(
    values: np.ndarray,
    rain: np.ndarray,
    lags: int = 7,
) -> Tuple[np.ndarray, np.ndarray]:
    """Feature matrix: lags, rolling mean, rain, day-of-week."""
    n = len(values)
    rows, targets = [], []
    for i in range(lags, n):
        feat = list(values[i - lags : i])
        feat.append(float(np.mean(values[max(0, i - 7) : i])))
        feat.append(float(rain[i]) if i < len(rain) else 0.0)
        feat.append(float(i % 7))
        rows.append(feat)
        targets.append(values[i])
    return np.array(rows), np.array(targets)


def _gb_predict(
    values: np.ndarray,
    rain: np.ndarray,
    horizon: int,
) -> np.ndarray:
    x, y = _build_ml_features(values, rain)
    if len(y) < MIN_TRAIN_POINTS:
        raise ValueError("insufficient data for gradient boosting")
    model = GradientBoostingRegressor(
        n_estimators=80,
        max_depth=4,
        learning_rate=0.08,
        random_state=42,
    )
    model.fit(x, y)
    preds = []
    hist = list(values)
    rain_ext = list(rain)
    for _ in range(horizon):
        i = len(hist)
        lags = 7
        feat = list(hist[-lags:])
        feat.append(float(np.mean(hist[-7:])))
        feat.append(float(rain_ext[-1]) if rain_ext else 0.0)
        feat.append(float(i % 7))
        p = max(0.0, float(model.predict([feat])[0]))
        preds.append(p)
        hist.append(p)
        rain_ext.append(rain_ext[-1] if rain_ext else 0.0)
    return np.array(preds)


def _backtest(
    model_id: str,
    values: np.ndarray,
    dates: List[date],
    rain: np.ndarray,
    holdout: int = HOLDOUT_DAYS,
) -> Tuple[Optional[float], Optional[float]]:
    if len(values) < MIN_TRAIN_POINTS + holdout:
        return None, None
    train_v = values[:-holdout]
    test_v = values[-holdout:]
    train_d = dates[:-holdout]
    train_r = rain[:-holdout]
    try:
        if model_id == "seasonal_naive":
            pred = _seasonal_naive(train_v, train_d, holdout)
        elif model_id == "arima" and ARIMA_AVAILABLE:
            pred = _arima_predict(train_v, holdout)
        elif model_id == "holt_winters" and HOLT_AVAILABLE:
            pred = _holt_predict(train_v, holdout)
        elif model_id == "prophet" and PROPHET_AVAILABLE:
            pred = _prophet_predict(train_d, train_v, holdout)
        elif model_id == "gradient_boosting" and SKLEARN_AVAILABLE:
            pred = _gb_predict(train_v, train_r, holdout)
        else:
            return None, None
        return _mape(test_v, pred), _mae(test_v, pred)
    except Exception:
        return None, None


def _run_single_model(
    model_id: str,
    values: np.ndarray,
    dates: List[date],
    rain: np.ndarray,
    horizon: int,
) -> ModelForecast:
    try:
        if model_id == "seasonal_naive":
            pred = _seasonal_naive(values, dates, horizon)
        elif model_id == "arima":
            if not ARIMA_AVAILABLE:
                return ModelForecast([], model_id, available=False, error="statsmodels not installed")
            pred = _arima_predict(values, horizon)
        elif model_id == "holt_winters":
            if not HOLT_AVAILABLE:
                return ModelForecast([], model_id, available=False, error="statsmodels not installed")
            pred = _holt_predict(values, horizon)
        elif model_id == "prophet":
            if not PROPHET_AVAILABLE:
                return ModelForecast([], model_id, available=False, error="prophet not installed")
            pred = _prophet_predict(dates, values, horizon)
        elif model_id == "gradient_boosting":
            if not SKLEARN_AVAILABLE:
                return ModelForecast([], model_id, available=False, error="scikit-learn not installed")
            pred = _gb_predict(values, rain, horizon)
        else:
            return ModelForecast([], model_id, available=False, error="unknown model")
        mape, mae = _backtest(model_id, values, dates, rain)
        return ModelForecast(
            predictions=pred.tolist(),
            model_id=model_id,
            mape=round(mape, 2) if mape is not None else None,
            mae=round(mae, 0) if mae is not None else None,
            available=True,
        )
    except Exception as exc:
        return ModelForecast([], model_id, available=False, error=str(exc))


def ensemble_forecast(
    dates: List[date],
    values: List[float],
    rain: List[float],
    horizon: int,
) -> EnsembleResult:
    """Run all models, weight by inverse MAPE, return blended forecast."""
    v = np.asarray(values, dtype=float)
    r = np.asarray(rain, dtype=float) if rain else np.zeros_like(v)
    if len(r) != len(v):
        r = np.resize(r, len(v))

    candidate_ids = ["seasonal_naive"]
    if ARIMA_AVAILABLE:
        candidate_ids.append("arima")
    if HOLT_AVAILABLE:
        candidate_ids.append("holt_winters")
    if PROPHET_AVAILABLE and len(v) >= MIN_TRAIN_POINTS:
        candidate_ids.append("prophet")
    if SKLEARN_AVAILABLE and len(v) >= MIN_TRAIN_POINTS:
        candidate_ids.append("gradient_boosting")

    models: Dict[str, ModelForecast] = {}
    weights: Dict[str, float] = {}

    for mid in candidate_ids:
        mf = _run_single_model(mid, v, dates, r, horizon)
        models[mid] = mf
        if mf.available and mf.predictions:
            mape = mf.mape if mf.mape and mf.mape > 0 else 50.0
            weights[mid] = 1.0 / mape
            mf.weight = weights[mid]

    if not weights:
        sn = _run_single_model("seasonal_naive", v, dates, r, horizon)
        models["seasonal_naive"] = sn
        return EnsembleResult(
            predictions=sn.predictions,
            selected_model="seasonal_naive",
            models=models,
            metrics={"fallback": True},
        )

    total_w = sum(weights.values())
    blend = np.zeros(horizon)
    for mid, w in weights.items():
        p = np.array(models[mid].predictions[:horizon])
        if len(p) < horizon:
            p = np.resize(p, horizon)
        blend += (w / total_w) * p

    best = min(weights.keys(), key=lambda k: models[k].mape or 999)
    return EnsembleResult(
        predictions=[max(0.0, float(x)) for x in blend],
        selected_model="ensemble",
        models=models,
        metrics={
            "best_single_model": best,
            "models_used": list(weights.keys()),
            "weights": {k: round(v / total_w, 3) for k, v in weights.items()},
        },
    )


def forecast_with_model(
    dates: List[date],
    values: List[float],
    rain: List[float],
    horizon: int,
    model: str = "ensemble",
) -> EnsembleResult:
    v = np.asarray(values, dtype=float)
    r = list(rain) if rain else [0.0] * len(values)

    if model == "ensemble":
        return ensemble_forecast(dates, values, rain, horizon)

    mf = _run_single_model(model, v, dates, np.asarray(r), horizon)
    if not mf.available or not mf.predictions:
        fallback = ensemble_forecast(dates, values, rain, horizon)
        fallback.metrics["requested_model_failed"] = model
        return fallback

    return EnsembleResult(
        predictions=mf.predictions,
        selected_model=model,
        models={model: mf},
        metrics={"mape": mf.mape, "mae": mf.mae},
    )

"""
Time-series demand forecasting and shortage-risk scoring.

Uses Facebook Prophet when installed; otherwise seasonal naive + trend (ARIMA-like).
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from config import CRITICAL_FILL_PCT, FORECAST_HORIZON_DAYS
from capacity import available_litres, fill_percent
from models import HistoricalDemand, WaterHub

try:
    from prophet import Prophet
    import pandas as pd

    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False


def _seasonal_naive_forecast(
    dates: List[date],
    values: List[float],
    horizon: int,
) -> List[float]:
    """Week-of-year seasonal naive with linear trend."""
    if not values:
        return [0.0] * horizon
    n = len(values)
    avg = sum(values) / n
    # weekly seasonality (7-day lag)
    seasonal = {}
    for i, v in enumerate(values):
        w = dates[i].isocalendar()[1] % 52
        seasonal.setdefault(w, []).append(v)
    seasonal_avg = {w: sum(vs) / len(vs) for w, vs in seasonal.items()}
    global_week = sum(seasonal_avg.values()) / max(len(seasonal_avg), 1)
    trend = (values[-1] - values[0]) / max(n - 1, 1) if n > 1 else 0
    last_date = dates[-1]
    preds = []
    for h in range(1, horizon + 1):
        d = last_date + timedelta(days=h)
        w = d.isocalendar()[1] % 52
        base = seasonal_avg.get(w, global_week)
        preds.append(max(0.0, base + trend * h * 0.3))
    if not preds:
        preds = [avg] * horizon
    return preds


def _prophet_forecast(
    dates: List[date],
    values: List[float],
    horizon: int,
) -> List[float]:
    df = pd.DataFrame({"ds": dates, "y": values})
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
    )
    model.fit(df)
    future = model.make_future_dataframe(periods=horizon)
    forecast = model.predict(future)
    tail = forecast["yhat"].tail(horizon).tolist()
    return [max(0.0, float(v)) for v in tail]


def forecast_demand_series(
    dates: List[date],
    values: List[float],
    horizon: int = FORECAST_HORIZON_DAYS,
) -> List[float]:
    if len(values) < 14:
        return _seasonal_naive_forecast(dates, values, horizon)
    if PROPHET_AVAILABLE:
        try:
            return _prophet_forecast(dates, values, horizon)
        except Exception:
            pass
    return _seasonal_naive_forecast(dates, values, horizon)


def shortage_risk_score(
    hub: WaterHub,
    predicted_daily_demand: float,
    avg_rainfall_mm: float,
) -> float:
    """
    0–100 risk: higher = more likely shortage.
    Factors: low fill %, high predicted demand, low recent rain.
    """
    fill = fill_percent(hub)
    avail = available_litres(hub)
    cap = max(hub.capacity_litres, 1)
    demand_pressure = min(100, (predicted_daily_demand / max(avail, 1)) * 40)
    fill_risk = max(0, 100 - fill) * 0.5
    rain_relief = min(30, avg_rainfall_mm * 3)
    raw = demand_pressure + fill_risk - rain_relief
    return round(max(0.0, min(100.0, raw)), 1)


def days_until_critical(
    hub: WaterHub,
    daily_demand_forecast: List[float],
    critical_pct: float = CRITICAL_FILL_PCT,
) -> Optional[int]:
    """Days until fill drops below critical_pct, given forecasted daily draw."""
    fill = hub.current_fill_litres
    threshold = hub.capacity_litres * (critical_pct / 100.0)
    if fill <= threshold:
        return 0
    for day, demand in enumerate(daily_demand_forecast, start=1):
        fill -= demand
        if fill <= threshold:
            return day
    return None


def hub_forecast(db: Session, hub: WaterHub, horizon: int = FORECAST_HORIZON_DAYS) -> Dict[str, Any]:
    rows = (
        db.query(HistoricalDemand)
        .filter(HistoricalDemand.hub_id == hub.id)
        .order_by(HistoricalDemand.record_date)
        .all()
    )
    if not rows:
        return {
            "hub_id": hub.id,
            "hub_name": hub.name,
            "ward": hub.ward,
            "error": "No historical data — run seed.py",
        }

    dates = [date.fromisoformat(r.record_date) for r in rows]
    demands = [float(r.demand_litres) for r in rows]
    rain = [float(r.rainfall_mm or 0) for r in rows]
    avg_rain_30 = sum(rain[-30:]) / max(len(rain[-30:]), 1)

    preds = forecast_demand_series(dates, demands, horizon)
    risk = shortage_risk_score(hub, preds[0] if preds else 0, avg_rain_30)
    days_crit = days_until_critical(hub, preds)

    forecast_days = []
    start = dates[-1]
    for i, p in enumerate(preds):
        d = start + timedelta(days=i + 1)
        forecast_days.append({"date": d.isoformat(), "predicted_demand_litres": round(p, 0)})

    level = "low"
    if risk >= 70:
        level = "critical"
    elif risk >= 45:
        level = "high"
    elif risk >= 25:
        level = "medium"

    return {
        "hub_id": hub.id,
        "hub_name": hub.name,
        "ward": hub.ward,
        "lat": hub.lat,
        "lng": hub.lng,
        "current_fill_litres": hub.current_fill_litres,
        "capacity_litres": hub.capacity_litres,
        "fill_percent": fill_percent(hub),
        "available_litres": available_litres(hub),
        "shortage_risk_score": risk,
        "risk_level": level,
        "days_until_critical": days_crit,
        "forecast_method": "prophet" if PROPHET_AVAILABLE and len(demands) >= 14 else "seasonal_naive",
        "avg_rainfall_mm_30d": round(avg_rain_30, 2),
        "forecast_horizon_days": horizon,
        "forecast": forecast_days,
        "alert_message": _alert_message(hub, risk, days_crit),
    }


def _alert_message(hub: WaterHub, risk: float, days_crit: Optional[int]) -> str:
    ward = hub.ward or hub.name
    if days_crit is not None and days_crit <= 5:
        return f"{ward} likely critical in {days_crit} day(s) — risk {risk}%"
    if risk >= 70:
        return f"{ward}: high shortage risk ({risk}%) — increase supply"
    if risk >= 45:
        return f"{ward}: elevated risk ({risk}%) — monitor closely"
    return f"{ward}: stable ({risk}% risk)"


def forecast_all_hubs(db: Session, horizon: int = FORECAST_HORIZON_DAYS) -> Dict[str, Any]:
    hubs = db.query(WaterHub).all()
    results = [hub_forecast(db, h, horizon) for h in hubs]
    results.sort(key=lambda x: x.get("shortage_risk_score", 0), reverse=True)
    critical = [r for r in results if r.get("risk_level") in ("critical", "high")]
    return {
        "generated_at": date.today().isoformat(),
        "horizon_days": horizon,
        "prophet_enabled": PROPHET_AVAILABLE,
        "hubs_analyzed": len(results),
        "critical_count": len(critical),
        "forecasts": results,
    }

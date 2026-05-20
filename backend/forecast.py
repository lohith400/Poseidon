"""
Crisis forecasting API layer — delegates to ml/forecast_engine and ml/risk_classifier.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from config import CRITICAL_FILL_PCT, FORECAST_HORIZON_DAYS
from capacity import available_litres, fill_percent
from ml.forecast_engine import (
    ML_MODELS_INFO,
    PROPHET_AVAILABLE,
    get_available_models,
    forecast_with_model,
)
from ml.risk_classifier import ml_shortage_risk_score
from models import HistoricalDemand, WaterHub


def shortage_risk_score(
    hub: WaterHub,
    predicted_daily_demand: float,
    avg_rainfall_mm: float,
    demands: Optional[List[float]] = None,
    rains: Optional[List[float]] = None,
) -> float:
    result = ml_shortage_risk_score(
        hub, predicted_daily_demand, avg_rainfall_mm, demands, rains
    )
    return result["score"]


def days_until_critical(
    hub: WaterHub,
    daily_demand_forecast: List[float],
    critical_pct: float = CRITICAL_FILL_PCT,
) -> Optional[int]:
    fill = hub.current_fill_litres
    threshold = hub.capacity_litres * (critical_pct / 100.0)
    if fill <= threshold:
        return 0
    for day, demand in enumerate(daily_demand_forecast, start=1):
        fill -= demand
        if fill <= threshold:
            return day
    return None


def _risk_level(score: float) -> str:
    if score >= 70:
        return "critical"
    if score >= 45:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def _alert_message(hub: WaterHub, risk: float, days_crit: Optional[int]) -> str:
    ward = hub.ward or hub.name
    if days_crit is not None and days_crit <= 5:
        return f"{ward} likely critical in {days_crit} day(s) — risk {risk}%"
    if risk >= 70:
        return f"{ward}: high shortage risk ({risk}%) — increase supply"
    if risk >= 45:
        return f"{ward}: elevated risk ({risk}%) — monitor closely"
    return f"{ward}: stable ({risk}% risk)"


def hub_forecast(
    db: Session,
    hub: WaterHub,
    horizon: int = FORECAST_HORIZON_DAYS,
    model: str = "ensemble",
) -> Dict[str, Any]:
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

    ml_result = forecast_with_model(dates, demands, rain, horizon, model=model)
    preds = ml_result.predictions

    risk_info = ml_shortage_risk_score(
        hub, preds[0] if preds else 0, avg_rain_30, demands, rain
    )
    risk = risk_info["score"]
    days_crit = days_until_critical(hub, preds)

    forecast_days = []
    start = dates[-1]
    for i, p in enumerate(preds):
        d = start + timedelta(days=i + 1)
        forecast_days.append({"date": d.isoformat(), "predicted_demand_litres": round(p, 0)})

    model_metrics = {}
    for mid, mf in ml_result.models.items():
        model_metrics[mid] = {
            "mape": mf.mape,
            "mae": mf.mae,
            "weight": round(mf.weight, 4) if mf.weight else None,
            "available": mf.available,
            "error": mf.error,
        }

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
        "risk_level": _risk_level(risk),
        "risk_method": risk_info.get("method"),
        "risk_class": risk_info.get("class_label"),
        "ml_feature_importance": risk_info.get("feature_importance"),
        "days_until_critical": days_crit,
        "forecast_method": ml_result.selected_model,
        "ml_metrics": ml_result.metrics,
        "ml_model_scores": model_metrics,
        "avg_rainfall_mm_30d": round(avg_rain_30, 2),
        "forecast_horizon_days": horizon,
        "forecast": forecast_days,
        "alert_message": _alert_message(hub, risk, days_crit),
    }


def forecast_all_hubs(
    db: Session,
    horizon: int = FORECAST_HORIZON_DAYS,
    model: str = "ensemble",
) -> Dict[str, Any]:
    hubs = db.query(WaterHub).all()
    results = [hub_forecast(db, h, horizon, model) for h in hubs]
    results.sort(key=lambda x: x.get("shortage_risk_score", 0), reverse=True)
    critical = [r for r in results if r.get("risk_level") in ("critical", "high")]
    return {
        "generated_at": date.today().isoformat(),
        "horizon_days": horizon,
        "forecast_model": model,
        "ml_models_available": get_available_models(),
        "ml_models_catalog": ML_MODELS_INFO,
        "prophet_enabled": PROPHET_AVAILABLE,
        "hubs_analyzed": len(results),
        "critical_count": len(critical),
        "forecasts": results,
    }

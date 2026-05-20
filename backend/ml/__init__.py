"""Machine learning models for water demand forecasting and shortage risk."""
from ml.forecast_engine import (
    ML_MODELS_INFO,
    ensemble_forecast,
    forecast_with_model,
    get_available_models,
)
from ml.risk_classifier import ml_shortage_risk_score

__all__ = [
    "ML_MODELS_INFO",
    "ensemble_forecast",
    "forecast_with_model",
    "get_available_models",
    "ml_shortage_risk_score",
]

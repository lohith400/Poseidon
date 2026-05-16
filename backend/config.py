"""Application settings from environment variables."""
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./water_delivery.db")
SECRET_KEY = os.getenv("SECRET_KEY", "poseidon-dev-change-in-production")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

# OSRM public router (road-network distances). Set empty to force Haversine only.
OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org")
OSRM_ENABLED = os.getenv("OSRM_ENABLED", "true").lower() in ("1", "true", "yes")

# Forecasting
FORECAST_HORIZON_DAYS = int(os.getenv("FORECAST_HORIZON_DAYS", "14"))
CRITICAL_FILL_PCT = float(os.getenv("CRITICAL_FILL_PCT", "20.0"))

# Poseidon — Bengaluru Water Crisis Platform

End-to-end **crisis intelligence** and **tanker dispatch** for Bengaluru: Prophet/seasonal **shortage forecasting**, **reservoir heatmaps**, **OSRM road routing**, **live tanker GPS**, and JWT-secured multi-role apps.

---

## Features (Theme A alignment)

| Pillar | Implementation |
|--------|----------------|
| **Time-series forecasting (ML)** | **ARIMA**, **Holt-Winters**, **Prophet** (optional), **Gradient Boosting**, **weighted ensemble** — back-test MAPE per GLR |
| **Shortage risk (ML)** | **Random Forest** classifier on fill, demand, rain, trend (fallback: rule-based) |
| **Shortage risk** | 0–100 score per hub, `days_until_critical`, alerts like *"Whitefield likely critical in 5 days"* |
| **Route optimization** | Capacity-constrained nearest-neighbor + **OSRM** road distances (fallback Haversine) |
| **Driver assignment** | `driver_id` set on optimize from hub-linked drivers |
| **Reservoir ops** | `current_fill_litres`, `reserved_litres` — reserve on book, deduct on deliver |
| **Live visualization** | Leaflet heatmap, WebSocket `/ws/tankers`, driver GPS `POST /driver/location` |
| **Auth** | JWT (`/auth/login`) — `citizen` / `driver` / `admin` |
| **Optional Google Maps** | Set `VITE_GOOGLE_MAPS_KEY` (Leaflet used by default) |

---

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements-core.txt
# Core ML: scikit-learn, statsmodels, numpy (ARIMA + Holt-Winters + Gradient Boosting)
# Optional: pip install -r requirements.txt   # adds Prophet + pandas
python seed.py                  # 70+ BWSSB GLRs, drivers, history, users
uvicorn main:app --reload
```

API: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (proxies `/api` → backend)

### Demo logins

| Role | Username | Password |
|------|----------|----------|
| Citizen | `citizen` | `citizen123` |
| Driver | `driver` | `driver123` |
| Admin | `admin` | `admin123` |

---

## Admin workflow

1. **Crisis Intel** tab — heatmap + shortage alerts (auto-refresh 30s)
2. **Map + Live Tankers** — optimised routes + real-time truck markers (WebSocket)
3. Run **Optimizer** for selected date (OSRM distances)
4. Driver app broadcasts GPS every 10s while route is loaded

---

## Key API routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | JWT token |
| GET | `/forecast?model=ensemble` | All GLR forecasts — model: arima, holt_winters, prophet, gradient_boosting, ensemble |
| GET | `/ml/models` | ML model catalog and availability |
| GET | `/hubs/status` | Live fill % for heatmap |
| POST | `/orders` | Book delivery (reserves hub water) |
| POST | `/optimize/{date}` | OSRM routes + driver assign |
| GET | `/routes/{date}` | Admin routes (`stops` + `waypoints`) |
| POST | `/driver/location` | Live GPS (driver) |
| WS | `/ws/tankers` | Broadcast tanker positions |

---

## Project structure

```
backend/
  main.py           # FastAPI app
  forecast.py       # Prophet / seasonal forecasting
  optimizer.py      # Capacity TSP + OSRM
  routing.py        # OSRM table API
  capacity.py       # GLR reserve / deduct
  auth.py           # JWT + bcrypt
  seed.py           # 70 BWSSB GLRs + test data
  seed_history.py   # Historical demand series
frontend/
  src/lib/api.js    # Auth + /api proxy
  src/components/CrisisDashboard.jsx
  src/components/AdminDashboard.jsx
```

---

## Environment

Copy `backend/.env.example` and `frontend/.env.example`.  
`water_delivery.db` is gitignored — run `python seed.py` after clone.

---

## Docker (optional)

```bash
docker compose up --build
```

---

*Built for Theme A: Bengaluru Water Crisis Platform — forecasting, dispatch, and live ops.*

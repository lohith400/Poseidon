# 💧 Neer Seva — Bengaluru Water Delivery System

An intelligent water tanker delivery platform for Bengaluru that assigns citizens to their nearest BWSSB water hub and uses a **TSP (Travelling Salesman Problem) nearest-neighbor algorithm** to optimize each driver's route — minimizing fuel consumption and delivery time.

---

## 🧠 How the Intelligence Works

### Problem
10+ citizens book water delivery for the same day across different parts of Bengaluru. Naively, one driver could cover all stops randomly — wasting hours and diesel.

### Solution: Two-stage optimization

**Stage 1 — Hub Assignment (Haversine formula)**
Each order is automatically assigned to its nearest water hub (BWSSB depot, borewell, or community tank) using the Haversine formula — the real spherical-earth distance between two lat/lng points. A citizen in Whitefield won't be sent to a Koramangala hub.

**Stage 2 — Route Optimization (Nearest-Neighbor TSP)**
For each hub's batch of orders, the driver starts at the hub and always travels to the closest unvisited stop next. This greedy O(n²) algorithm runs in milliseconds and produces routes within 15–20% of the true optimal — more than good enough for delivery logistics.

**Result:** Multiple drivers each cover a small geographic cluster from their hub, instead of one driver criss-crossing the entire city.

---

## 📁 Folder Structure

```
poseidon/
├── README.md
│
├── backend/                        # FastAPI Python backend
│   ├── main.py                     # All API routes
│   ├── models.py                   # Database table definitions
│   ├── database.py                 # SQLite connection setup
│   ├── optimizer.py                # Core TSP + Haversine logic
│   ├── seed.py                     # Populate DB with test data
│   ├── requirements.txt            # Python dependencies
│   └── water_delivery.db           # SQLite DB (auto-created on first run)
│
└── frontend/                       # React + Vite frontend
    ├── index.html                  # HTML entry point
    ├── package.json                # npm dependencies
    ├── vite.config.js              # Vite config with API proxy
    └── src/
        ├── main.jsx                # React app entry point
        ├── App.jsx                 # Root component + navigation
        ├── index.css               # All global styles
        └── components/
            ├── OrderForm.jsx       # Citizen booking form
            ├── AdminDashboard.jsx  # Admin map + optimizer UI
            └── DriverView.jsx      # Driver's ordered stop list
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python) |
| Database | SQLite via SQLAlchemy |
| Optimization | Custom Haversine + Nearest-Neighbor TSP |
| Frontend | React 18 + Vite |
| Map | Leaflet.js + OpenStreetMap |
| Styling | Plain CSS (no framework) |

---

## 🚀 Setup & Installation

### Prerequisites

Make sure you have these installed:
- **Python 3.9+** — `python --version`
- **Node.js 18+** — `node --version`
- **npm** — `npm --version`

---

### Step 1 — Clone / Download the project

```bash
# If using git
git clone <your-repo-url>
cd poseidon

# Or just navigate to the folder
cd C:\Users\lohit\.vscode\Code\Personal\poseidon
```

---

### Step 2 — Backend Setup

Open **Terminal 1** and run:

```bash
cd backend
```

**Create a virtual environment (recommended):**
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Mac/Linux
python -m venv .venv
source .venv/bin/activate
```

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

`requirements.txt` contains:
```
fastapi==0.111.0
uvicorn==0.30.1
sqlalchemy==2.0.30
pydantic==2.7.2
```

**Seed the database** (run this ONCE — creates the SQLite DB, adds 8 Bengaluru water hubs, 5 drivers, and 15 test orders):
```bash
python seed.py
```

Expected output:
```
✓ 8 water hubs seeded
✓ 5 drivers seeded
✓ 15 test orders seeded for 2026-05-15
Done! Now run: uvicorn main:app --reload
```

**Start the API server:**
```bash
uvicorn main:app --reload
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

✅ Backend is live at `http://localhost:8000`

---

### Step 3 — Frontend Setup

Open **Terminal 2** (keep Terminal 1 running):

```bash
cd frontend
```

**Install npm packages:**
```bash
npm install
```

**Start the dev server:**
```bash
npm run dev
```

Expected output:
```
  VITE v5.3.4  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

✅ Frontend is live at `http://localhost:5173`

---

## 🖥️ Using the Application

Open `http://localhost:5173` in your browser. You'll see three tabs:

---

### 🏠 Tab 1 — Book Water (Citizen View)

Citizens use this to book a water delivery.

1. Enter your name
2. Select delivery date
3. Pick your area from the Bengaluru location dropdown
4. Choose how many litres you need
5. Click **Book Water Delivery**

The system automatically finds the nearest water hub and assigns your order. You'll see a confirmation with your order ID and hub distance.

---

### ⚙️ Tab 2 — Admin Dashboard

Admins use this to view all orders and run the route optimizer.

**To optimize routes:**
1. Select the delivery date
2. Click **⚡ Run TSP Optimizer**
3. The system groups all orders by nearest hub, computes the optimal stop sequence per driver, and shows:
   - Dashed colored lines on the map (one color per driver/hub)
   - Route cards showing each driver's stops in order
   - Distance, fuel estimate, and ETA per route

**Map legend:** Each color represents one hub/driver. Large circles = hubs, small circles = delivery stops.

**Stats bar at the top:**
- Total Orders for the day
- Pending / Assigned counts
- Total km across all routes

---

### 🚛 Tab 3 — Driver View

Drivers use this to see their optimized stop list for the day.

1. Select your hub from the dropdown
2. Select the date
3. Click **Get My Route**

You'll see:
- Your starting hub location on the map
- All stops in optimized order (nearest-neighbor sequence)
- Distance from previous stop for each delivery
- A **✓ Delivered** button for each stop — tap it when done
- Progress bar tracking deliveries

---

## 🌐 API Reference

All endpoints are at `http://localhost:8000`. View interactive docs at `http://localhost:8000/docs`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/hubs` | List all water hubs |
| POST | `/orders` | Create a new delivery order |
| GET | `/orders?delivery_date=YYYY-MM-DD` | List orders (filterable by date/status) |
| POST | `/optimize/{date}` | Run TSP optimizer for a date |
| GET | `/routes/{date}` | Get optimized routes for a date |
| GET | `/driver/{hub_id}/{date}` | Driver's ordered stop list |
| PATCH | `/orders/{id}/deliver` | Mark an order as delivered |

**Example — create an order:**
```bash
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "citizen_name": "Ravi Kumar",
    "address": "Indiranagar 100ft Road",
    "lat": 12.9784,
    "lng": 77.6408,
    "litres_needed": 500,
    "delivery_date": "2026-05-15"
  }'
```

**Example — run optimizer:**
```bash
curl -X POST http://localhost:8000/optimize/2026-05-15
```

---

## 🗄️ Database Schema

### `water_hubs`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | Hub name (e.g. "BWSSB Whitefield Depot") |
| hub_type | TEXT | bwssb_depot / borewell / community_tank |
| lat | FLOAT | Latitude |
| lng | FLOAT | Longitude |
| capacity_litres | INTEGER | Max daily capacity |
| available | BOOLEAN | Whether hub is active |
| ward | TEXT | Bengaluru ward name |

### `delivery_orders`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| citizen_name | TEXT | Requester's name |
| address | TEXT | Delivery address |
| lat / lng | FLOAT | GPS coordinates |
| litres_needed | INTEGER | Water quantity |
| delivery_date | TEXT | YYYY-MM-DD |
| status | TEXT | pending / assigned / delivered |
| hub_id | INTEGER | FK → water_hubs |
| hub_distance_km | FLOAT | Distance to assigned hub |
| stop_order | INTEGER | Position in driver's route (set after optimization) |

### `drivers`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | Driver name |
| phone | TEXT | Contact number |
| available | BOOLEAN | On duty or not |

### `optimized_routes`
| Column | Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| hub_id | INTEGER | Which hub this route starts from |
| driver_id | INTEGER | Assigned driver |
| delivery_date | TEXT | YYYY-MM-DD |
| total_distance_km | FLOAT | Full route length |
| total_stops | INTEGER | Number of deliveries |
| route_json | TEXT | Full route data as JSON |

---

## 🔧 Common Issues & Fixes

### White screen at localhost:5173
- Open F12 → Console and check for errors
- Verify `src/main.jsx` and `src/App.jsx` are not empty files
- Make sure `npm install` completed without errors

### `npm error EJSONPARSE` on npm install
- `package.json` is empty — paste the contents manually (see package.json in the repo)

### `No water hubs available` error on booking
- You haven't run `python seed.py` yet — run it once from the backend folder

### Orders show but map is blank
- Leaflet CSS isn't loading — check `index.html` has the Leaflet CSS `<link>` tag
- Try hard refresh: Ctrl+Shift+R

### `Route not optimized yet` in Driver view
- Admin needs to click **Run TSP Optimizer** first for that date

### Port already in use
```bash
# Kill port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Kill port 5173 (Windows)
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

---

## 📊 Seeded Test Data

Running `seed.py` adds these 8 water hubs (real Bengaluru BWSSB locations):

| Hub | Ward | Capacity |
|---|---|---|
| BWSSB Whitefield Depot | Whitefield | 50,000 L |
| BWSSB Koramangala Tank | Koramangala | 40,000 L |
| BWSSB Hebbal Depot | Hebbal | 45,000 L |
| BWSSB Electronic City Depot | Electronic City | 35,000 L |
| Community Tank Jayanagar | Jayanagar | 20,000 L |
| Borewell Hub HSR Layout | HSR Layout | 15,000 L |
| BWSSB Yelahanka Depot | Yelahanka | 40,000 L |
| BWSSB Marathahalli Tank | Marathahalli | 30,000 L |

And 15 test citizen orders spread across Bengaluru — pre-assigned to their nearest hub.

---

## 🧪 Quick Test Flow

1. Start backend → `uvicorn main:app --reload`
2. Run seed → `python seed.py`
3. Start frontend → `npm run dev`
4. Open `http://localhost:5173`
5. Go to **Admin tab** → click **⚡ Run TSP Optimizer**
6. See colored routes appear on the map
7. Go to **Driver tab** → select Hub 1 + today's date → click **Get My Route**
8. See optimized stop list with map

---

## 🏗️ Built For

**Theme A: Bengaluru Water Crisis Platform**
Hackathon project focused on intelligent water tanker dispatch using real BWSSB depot data, route optimization algorithms, and a three-role interface (citizen / admin / driver).

---

*Built with FastAPI + React + Leaflet + Love for Bengaluru 💙*
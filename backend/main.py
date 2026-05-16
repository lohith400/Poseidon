"""
Poseidon — Bengaluru Water Crisis Platform API
Forecasting · OSRM routing · Live tanker GPS · JWT auth
"""
from datetime import datetime, timezone
from typing import List, Optional
import json

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    hash_password,
    require_roles,
)
from capacity import available_litres, fill_percent, fulfill_delivery, release_reservation, reserve_for_order
from config import CORS_ORIGINS, OSRM_ENABLED
from database import get_db, migrate_schema
from forecast import forecast_all_hubs, hub_forecast, PROPHET_AVAILABLE
from live_tracking import tanker_tracker
from models import (
    DeliveryOrder,
    Driver,
    HistoricalDemand,
    OptimizedRoute,
    TankerPosition,
    User,
    WaterHub,
)
from optimizer import (
    TANKER_CAPACITY_LITRES,
    assign_hub_to_order,
    assign_driver,
    build_route_summary,
    optimize_day,
)

migrate_schema()

app = FastAPI(
    title="Poseidon — Bengaluru Water Crisis Platform",
    version="3.0.0",
    description="Crisis forecasting, reservoir monitoring, and intelligent tanker dispatch",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    display_name: Optional[str] = None
    driver_id: Optional[int] = None
    hub_id: Optional[int] = None


class OrderCreate(BaseModel):
    citizen_name: str
    address: str
    lat: float
    lng: float
    litres_needed: int = 500
    delivery_date: str


class OrderResponse(BaseModel):
    id: int
    citizen_name: str
    address: str
    lat: float
    lng: float
    litres_needed: int
    delivery_date: str
    status: str
    hub_id: Optional[int]
    hub_distance_km: Optional[float]
    stop_order: Optional[int]

    class Config:
        from_attributes = True


class HubResponse(BaseModel):
    id: int
    name: str
    hub_type: str
    lat: float
    lng: float
    capacity_litres: int
    current_fill_litres: int
    reserved_litres: int
    fill_percent: float
    available_litres: int
    available: bool
    ward: Optional[str]

    class Config:
        from_attributes = True


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    heading: float = 0.0
    speed_kmh: float = 0.0


def hub_to_response(h: WaterHub) -> dict:
    return {
        "id": h.id,
        "name": h.name,
        "hub_type": h.hub_type,
        "lat": h.lat,
        "lng": h.lng,
        "capacity_litres": h.capacity_litres,
        "current_fill_litres": h.current_fill_litres or 0,
        "reserved_litres": h.reserved_litres or 0,
        "fill_percent": fill_percent(h),
        "available_litres": available_litres(h),
        "available": h.available,
        "ward": h.ward,
    }


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token({"sub": user.username, "role": user.role})
    hub_id = None
    if user.driver_id:
        driver = db.query(Driver).filter(Driver.id == user.driver_id).first()
        hub_id = driver.hub_id if driver else None
    return TokenResponse(
        access_token=token,
        role=user.role,
        display_name=user.display_name or user.username,
        driver_id=user.driver_id,
        hub_id=hub_id,
    )


@app.get("/auth/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    hub_id = None
    if user.driver_id:
        d = db.query(Driver).filter(Driver.id == user.driver_id).first()
        hub_id = d.hub_id if d else None
    return {
        "username": user.username,
        "role": user.role,
        "display_name": user.display_name,
        "driver_id": user.driver_id,
        "hub_id": hub_id,
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "Poseidon Water Crisis Platform API v3",
        "features": {
            "forecasting": True,
            "prophet": PROPHET_AVAILABLE,
            "osrm_routing": OSRM_ENABLED,
            "live_tanker_ws": True,
            "jwt_auth": True,
        },
    }


# ── Crisis / forecasting ─────────────────────────────────────────────────────

@app.get("/forecast")
def get_all_forecasts(
    horizon: int = Query(14, ge=7, le=30),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin")),
):
    return forecast_all_hubs(db, horizon)


@app.get("/forecast/{hub_id}")
def get_hub_forecast(
    hub_id: int,
    horizon: int = Query(14, ge=7, le=30),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    hub = db.query(WaterHub).filter(WaterHub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
    return hub_forecast(db, hub, horizon)


@app.get("/hubs/status")
def hubs_reservoir_status(db: Session = Depends(get_db)):
    """Live reservoir status for heatmaps and dashboards."""
    hubs = db.query(WaterHub).all()
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "hubs": [hub_to_response(h) for h in hubs],
    }


# ── Hubs ──────────────────────────────────────────────────────────────────────

@app.get("/hubs")
def list_hubs(db: Session = Depends(get_db)):
    return [hub_to_response(h) for h in db.query(WaterHub).all()]


# ── Orders ────────────────────────────────────────────────────────────────────

@app.post("/orders", response_model=OrderResponse)
def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("citizen", "admin")),
):
    if order.litres_needed > TANKER_CAPACITY_LITRES:
        raise HTTPException(
            status_code=400,
            detail=f"Max {TANKER_CAPACITY_LITRES} L per tanker trip.",
        )

    hubs = db.query(WaterHub).filter(WaterHub.available == True).all()
    if not hubs:
        raise HTTPException(status_code=503, detail="No water hubs available")

    try:
        nearest_hub, dist_km = assign_hub_to_order(order.lat, order.lng, hubs)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    try:
        reserve_for_order(db, nearest_hub, order.litres_needed)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    name = order.citizen_name
    if user.role == "citizen" and user.display_name:
        name = user.display_name

    db_order = DeliveryOrder(
        citizen_name=name,
        address=order.address,
        lat=order.lat,
        lng=order.lng,
        litres_needed=order.litres_needed,
        delivery_date=order.delivery_date,
        hub_id=nearest_hub.id,
        hub_distance_km=round(dist_km, 2),
        status="pending",
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@app.get("/orders", response_model=List[OrderResponse])
def list_orders(
    delivery_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin", "driver", "citizen")),
):
    q = db.query(DeliveryOrder)
    if delivery_date:
        q = q.filter(DeliveryOrder.delivery_date == delivery_date)
    if status:
        q = q.filter(DeliveryOrder.status == status)
    return q.order_by(DeliveryOrder.id).all()


# ── Optimization ──────────────────────────────────────────────────────────────

@app.post("/optimize/{delivery_date}")
def run_optimization(
    delivery_date: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin")),
):
    orders = db.query(DeliveryOrder).filter(
        DeliveryOrder.delivery_date == delivery_date,
        DeliveryOrder.hub_id.isnot(None),
    ).all()
    if not orders:
        raise HTTPException(status_code=404, detail=f"No orders for {delivery_date}")

    hubs = db.query(WaterHub).all()
    drivers = db.query(Driver).filter(Driver.available == True).all()
    used_drivers: set = set()

    day_routes = optimize_day(orders, hubs, use_osrm=OSRM_ENABLED)
    results = []

    for hub_id, route_data in day_routes.items():
        driver = assign_driver(hub_id, drivers, used_drivers)
        driver_id = driver.id if driver else None
        if driver_id:
            used_drivers.add(driver_id)

        for i, order in enumerate(route_data["ordered_orders"]):
            order.stop_order = i + 1
            order.status = "assigned"
        db.commit()

        route_summary = build_route_summary(hub_id, route_data, driver_id)

        existing = db.query(OptimizedRoute).filter(
            OptimizedRoute.hub_id == hub_id,
            OptimizedRoute.delivery_date == delivery_date,
        ).first()

        if existing:
            existing.driver_id = driver_id
            existing.total_distance_km = route_data["total_distance_km"]
            existing.total_stops = route_data["total_stops"]
            existing.route_json = json.dumps(route_summary)
        else:
            db.add(
                OptimizedRoute(
                    hub_id=hub_id,
                    driver_id=driver_id,
                    delivery_date=delivery_date,
                    total_distance_km=route_data["total_distance_km"],
                    total_stops=route_data["total_stops"],
                    route_json=json.dumps(route_summary),
                )
            )
        db.commit()
        results.append(route_summary)

    return {
        "date": delivery_date,
        "total_orders": len(orders),
        "hubs_used": len(results),
        "distance_method": "osrm" if OSRM_ENABLED else "haversine",
        "routes": results,
    }


@app.get("/routes/{delivery_date}")
def get_routes(
    delivery_date: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin", "driver")),
):
    routes = db.query(OptimizedRoute).filter(
        OptimizedRoute.delivery_date == delivery_date
    ).all()
    if not routes:
        raise HTTPException(
            status_code=404,
            detail="No routes. Run POST /optimize/{date} first.",
        )
    result = []
    for r in routes:
        data = json.loads(r.route_json) if r.route_json else {}
        data["optimized_route_id"] = r.id
        data["driver_id"] = r.driver_id
        result.append(data)
    return {"date": delivery_date, "routes": result}


# ── Driver ────────────────────────────────────────────────────────────────────

@app.get("/driver/{hub_id}/{delivery_date}")
def driver_view(
    hub_id: int,
    delivery_date: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "driver")),
):
    route = db.query(OptimizedRoute).filter(
        OptimizedRoute.hub_id == hub_id,
        OptimizedRoute.delivery_date == delivery_date,
    ).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not optimised yet.")

    hub = db.query(WaterHub).filter(WaterHub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    route_data = json.loads(route.route_json)
    enriched = []
    for wp in route_data.get("waypoints", []):
        if wp["type"] == "refill":
            wp = {
                **wp,
                "hub_name": hub.name,
                "message": f"Return to {hub.name} and refill to {TANKER_CAPACITY_LITRES:,} L",
            }
        enriched.append(wp)

    return {
        "hub": {"id": hub.id, "name": hub.name, "lat": hub.lat, "lng": hub.lng},
        "driver_id": route.driver_id,
        "delivery_date": delivery_date,
        "tanker_capacity_L": TANKER_CAPACITY_LITRES,
        "total_delivery_stops": route_data["total_stops"],
        "total_refill_stops": route_data.get("refill_count", 0),
        "total_distance_km": route_data["total_distance_km"],
        "estimated_fuel_L": route_data["estimated_fuel_litres"],
        "estimated_time_min": route_data["estimated_time_minutes"],
        "waypoints": enriched,
        "stops": route_data.get("stops", []),
        "route_coords": route_data["route_coords"],
    }


@app.get("/driver/{hub_id}/{delivery_date}/stats")
def driver_stats(
    hub_id: int,
    delivery_date: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "driver")),
):
    route = db.query(OptimizedRoute).filter(
        OptimizedRoute.hub_id == hub_id,
        OptimizedRoute.delivery_date == delivery_date,
    ).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    data = json.loads(route.route_json)
    completed = db.query(DeliveryOrder).filter(
        DeliveryOrder.hub_id == hub_id,
        DeliveryOrder.delivery_date == delivery_date,
        DeliveryOrder.status == "delivered",
    ).count()
    return {
        "hub_id": hub_id,
        "driver_id": route.driver_id,
        "delivery_date": delivery_date,
        "total_stops": data["total_stops"],
        "completed_stops": completed,
        "remaining_stops": data["total_stops"] - completed,
        "total_distance_km": data["total_distance_km"],
        "refill_count": data.get("refill_count", 0),
        "estimated_fuel_litres": data["estimated_fuel_litres"],
        "estimated_time_min": data["estimated_time_minutes"],
        "tanker_capacity_L": TANKER_CAPACITY_LITRES,
    }


@app.patch("/orders/{order_id}/deliver")
def mark_delivered(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("driver", "admin")),
):
    order = db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "delivered":
        fulfill_delivery(db, order)
        order.status = "delivered"
        db.commit()
    return {"message": f"Order {order_id} delivered", "hub_fill_pct": fill_percent(order.hub) if order.hub else None}


@app.post("/driver/location")
async def update_driver_location(
    body: LocationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("driver")),
):
    if not user.driver_id:
        raise HTTPException(status_code=400, detail="No driver linked to account")
    driver = db.query(Driver).filter(Driver.id == user.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    pos = db.query(TankerPosition).filter(TankerPosition.driver_id == user.driver_id).first()
    if pos:
        pos.lat = body.lat
        pos.lng = body.lng
        pos.heading = body.heading
        pos.speed_kmh = body.speed_kmh
        pos.hub_id = driver.hub_id
        pos.updated_at = datetime.utcnow()
    else:
        pos = TankerPosition(
            driver_id=user.driver_id,
            hub_id=driver.hub_id,
            lat=body.lat,
            lng=body.lng,
            heading=body.heading,
            speed_kmh=body.speed_kmh,
        )
        db.add(pos)
    db.commit()

    payload = tanker_tracker.update_position(
        user.driver_id,
        driver.hub_id or 0,
        driver.name,
        body.lat,
        body.lng,
        body.heading,
        body.speed_kmh,
    )
    await tanker_tracker.broadcast(payload)
    return payload


@app.get("/tankers/live")
def live_tankers(db: Session = Depends(get_db)):
    rows = db.query(TankerPosition).all()
    tankers = []
    for p in rows:
        driver = db.query(Driver).filter(Driver.id == p.driver_id).first()
        tankers.append({
            "driver_id": p.driver_id,
            "driver_name": driver.name if driver else f"Driver {p.driver_id}",
            "hub_id": p.hub_id,
            "lat": p.lat,
            "lng": p.lng,
            "heading": p.heading,
            "speed_kmh": p.speed_kmh,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })
    tracker = tanker_tracker.all_positions()
    if tracker:
        return {"tankers": tracker}
    return {"tankers": tankers}


@app.websocket("/ws/tankers")
async def websocket_tankers(websocket: WebSocket):
    await tanker_tracker.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await tanker_tracker.disconnect(websocket)


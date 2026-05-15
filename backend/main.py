"""
main.py — FastAPI backend for Bengaluru Water Delivery System

Routes
------
POST /orders                        — Citizen books a water delivery
GET  /orders                        — List orders (optional filters)
GET  /hubs                          — List all water hubs
POST /optimize/{date}               — Run capacity-constrained optimizer for a date
GET  /routes/{date}                 — Admin: all optimised routes for a date
GET  /driver/{hub_id}/{date}        — Driver: full waypoint list including refill stops
GET  /driver/{hub_id}/{date}/stats  — Driver: summary stats (km, fuel, ETA)
PATCH /orders/{order_id}/deliver    — Driver marks a stop as delivered
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import json

from database import engine, get_db, Base
from models import WaterHub, DeliveryOrder, Driver, OptimizedRoute
from optimizer import (
    assign_hub_to_order,
    optimize_day,
    build_route_summary,
    TANKER_CAPACITY_LITRES,
    estimate_fuel_litres,
    estimate_time_minutes,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bengaluru Water Delivery API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    citizen_name:  str
    address:       str
    lat:           float
    lng:           float
    litres_needed: int   = 500
    delivery_date: str           # "YYYY-MM-DD"


class OrderResponse(BaseModel):
    id:               int
    citizen_name:     str
    address:          str
    lat:              float
    lng:              float
    litres_needed:    int
    delivery_date:    str
    status:           str
    hub_id:           Optional[int]
    hub_distance_km:  Optional[float]
    stop_order:       Optional[int]

    class Config:
        from_attributes = True


class HubResponse(BaseModel):
    id:               int
    name:             str
    hub_type:         str
    lat:              float
    lng:              float
    capacity_litres:  int
    available:        bool
    ward:             Optional[str]

    class Config:
        from_attributes = True


# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Bengaluru Water Delivery API v2 — capacity-constrained routing active"}


# ── Hubs ──────────────────────────────────────────────────────────────────────

@app.get("/hubs", response_model=List[HubResponse])
def list_hubs(db: Session = Depends(get_db)):
    return db.query(WaterHub).all()


# ── Orders ────────────────────────────────────────────────────────────────────

@app.post("/orders", response_model=OrderResponse)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """
    Citizen submits a water delivery request.
    Auto-assigns the nearest available hub.
    Rejects any single order that exceeds the tanker's max capacity.
    """
    if order.litres_needed > TANKER_CAPACITY_LITRES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Requested {order.litres_needed} L exceeds tanker capacity "
                f"({TANKER_CAPACITY_LITRES} L). Please split into multiple orders."
            ),
        )

    hubs = db.query(WaterHub).filter(WaterHub.available == True).all()
    if not hubs:
        raise HTTPException(status_code=503, detail="No water hubs available")

    try:
        nearest_hub, dist_km = assign_hub_to_order(order.lat, order.lng, hubs)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    db_order = DeliveryOrder(
        citizen_name=order.citizen_name,
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
    status:        Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(DeliveryOrder)
    if delivery_date:
        q = q.filter(DeliveryOrder.delivery_date == delivery_date)
    if status:
        q = q.filter(DeliveryOrder.status == status)
    return q.order_by(DeliveryOrder.id).all()


# ── Optimization ──────────────────────────────────────────────────────────────

@app.post("/optimize/{delivery_date}")
def run_optimization(delivery_date: str, db: Session = Depends(get_db)):
    """
    Capacity-constrained route optimisation for every hub on a given date.

    What changes vs v1
    ------------------
    - Uses capacity_constrained_route() instead of plain nearest-neighbor TSP
    - Inserts refill waypoints automatically when a driver's remaining water
      cannot fulfil the next stop
    - Stores full waypoint list (deliveries + refills) in route_json
    - Returns refill_count per hub so the admin can see how many detours were needed
    """
    orders = db.query(DeliveryOrder).filter(
        DeliveryOrder.delivery_date == delivery_date,
        DeliveryOrder.hub_id.isnot(None),
    ).all()

    if not orders:
        raise HTTPException(status_code=404, detail=f"No orders found for {delivery_date}")

    hubs = db.query(WaterHub).all()

    # Run the capacity-constrained optimizer
    day_routes = optimize_day(orders, hubs)

    results = []

    for hub_id, route_data in day_routes.items():

        # Assign stop_order to each delivery (refills have no stop_order)
        for i, order in enumerate(route_data["ordered_orders"]):
            order.stop_order = i + 1
            order.status     = "assigned"
        db.commit()

        # Build clean JSON summary (strips non-serialisable objects)
        route_summary = build_route_summary(hub_id, route_data)

        # Upsert OptimizedRoute record
        existing = db.query(OptimizedRoute).filter(
            OptimizedRoute.hub_id        == hub_id,
            OptimizedRoute.delivery_date == delivery_date,
        ).first()

        if existing:
            existing.total_distance_km = route_data["total_distance_km"]
            existing.total_stops       = route_data["total_stops"]
            existing.route_json        = json.dumps(route_summary)
        else:
            db.add(OptimizedRoute(
                hub_id           = hub_id,
                delivery_date    = delivery_date,
                total_distance_km= route_data["total_distance_km"],
                total_stops      = route_data["total_stops"],
                route_json       = json.dumps(route_summary),
            ))

        db.commit()
        results.append(route_summary)

    return {
        "date":         delivery_date,
        "total_orders": len(orders),
        "hubs_used":    len(results),
        "routes":       results,
    }


@app.get("/routes/{delivery_date}")
def get_routes(delivery_date: str, db: Session = Depends(get_db)):
    """Admin dashboard: all optimised routes for a date."""
    routes = db.query(OptimizedRoute).filter(
        OptimizedRoute.delivery_date == delivery_date
    ).all()

    if not routes:
        raise HTTPException(
            status_code=404,
            detail="No optimised routes found. Run POST /optimize/{date} first.",
        )

    result = []
    for r in routes:
        data = json.loads(r.route_json) if r.route_json else {}
        data["optimized_route_id"] = r.id
        data["driver_id"]          = r.driver_id
        result.append(data)

    return {"date": delivery_date, "routes": result}


# ── Driver endpoints ──────────────────────────────────────────────────────────

@app.get("/driver/{hub_id}/{delivery_date}")
def driver_view(hub_id: int, delivery_date: str, db: Session = Depends(get_db)):
    """
    What the driver sees on their phone — full ordered waypoint list.

    Response structure
    ------------------
    Each item in "waypoints" is either a DELIVERY stop or a REFILL stop:

    Delivery stop:
        {
            "type": "delivery",
            "stop_number": 1,
            "order_id": 42,
            "citizen_name": "Ravi Kumar",
            "address": "12, MG Road, Bengaluru",
            "lat": 12.9716,
            "lng": 77.5946,
            "litres_delivered": 6000,
            "remaining_capacity_L": 6000,
            "distance_from_prev_km": 2.1
        }

    Refill stop (driver returns to hub):
        {
            "type": "refill",
            "lat": 12.9352,
            "lng": 77.6245,
            "distance_from_prev_km": 3.4,
            "capacity_after_refill": 12000,
            "refill_number": 1,
            "message": "Return to hub and refill to 12 000 L"
        }

    This allows the driver app to:
    - Show a colour-coded list: blue = deliver, orange = go refill
    - Draw the full route polyline on a map
    - Alert the driver BEFORE they run out of water
    """
    route = db.query(OptimizedRoute).filter(
        OptimizedRoute.hub_id        == hub_id,
        OptimizedRoute.delivery_date == delivery_date,
    ).first()

    if not route:
        raise HTTPException(
            status_code=404,
            detail="Route not optimised yet. Ask admin to run POST /optimize/{date}.",
        )

    hub = db.query(WaterHub).filter(WaterHub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    route_data = json.loads(route.route_json)

    # Enrich refill waypoints with a human-readable message for the driver app
    enriched_waypoints = []
    for wp in route_data.get("waypoints", []):
        if wp["type"] == "refill":
            wp = {
                **wp,
                "hub_name": hub.name,
                "message": (
                    f"⚠️  Tank low — return to {hub.name} "
                    f"and refill to {TANKER_CAPACITY_LITRES:,} L "
                    f"(~{15} min stop)"
                ),
            }
        enriched_waypoints.append(wp)

    return {
        "hub": {
            "id":   hub.id,
            "name": hub.name,
            "lat":  hub.lat,
            "lng":  hub.lng,
        },
        "delivery_date":        delivery_date,
        "tanker_capacity_L":    TANKER_CAPACITY_LITRES,
        "total_delivery_stops": route_data["total_stops"],
        "total_refill_stops":   route_data["refill_count"],
        "total_distance_km":    route_data["total_distance_km"],
        "estimated_fuel_L":     route_data["estimated_fuel_litres"],
        "estimated_time_min":   route_data["estimated_time_minutes"],
        # Ordered list: delivery stops interleaved with refill waypoints
        "waypoints":            enriched_waypoints,
        # Flat coords for map polyline (hub → wp1 → wp2 → ...)
        "route_coords":         route_data["route_coords"],
    }


@app.get("/driver/{hub_id}/{delivery_date}/stats")
def driver_stats(hub_id: int, delivery_date: str, db: Session = Depends(get_db)):
    """
    Lightweight summary for the driver's top-of-screen status bar.
    Returns km, fuel cost estimate, ETA, and refill count.
    """
    route = db.query(OptimizedRoute).filter(
        OptimizedRoute.hub_id        == hub_id,
        OptimizedRoute.delivery_date == delivery_date,
    ).first()

    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    data = json.loads(route.route_json)

    # Count completed deliveries
    completed = db.query(DeliveryOrder).filter(
        DeliveryOrder.hub_id        == hub_id,
        DeliveryOrder.delivery_date == delivery_date,
        DeliveryOrder.status        == "delivered",
    ).count()

    return {
        "hub_id":                hub_id,
        "delivery_date":         delivery_date,
        "total_stops":           data["total_stops"],
        "completed_stops":       completed,
        "remaining_stops":       data["total_stops"] - completed,
        "total_distance_km":     data["total_distance_km"],
        "refill_count":          data["refill_count"],
        "estimated_fuel_litres": data["estimated_fuel_litres"],
        "estimated_time_min":    data["estimated_time_minutes"],
        "tanker_capacity_L":     TANKER_CAPACITY_LITRES,
    }


# ── Driver marks delivery done ────────────────────────────────────────────────

@app.patch("/orders/{order_id}/deliver")
def mark_delivered(order_id: int, db: Session = Depends(get_db)):
    """Driver taps 'Delivered' in the app — updates order status."""
    order = db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "delivered"
    db.commit()
    return {"message": f"Order {order_id} marked as delivered ✓"}
"""
main.py — FastAPI backend for Bengaluru Water Delivery System

Routes:
    POST /orders          — Citizen books a water delivery
    GET  /orders          — List all orders (with filters)
    GET  /hubs            — List all water hubs
    POST /optimize/{date} — Run TSP optimizer for all orders on a date
    GET  /routes/{date}   — Get optimized routes for a date
    GET  /driver/{hub_id}/{date} — Driver's view: ordered stops for their hub
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import json

from database import engine, get_db, Base
from models import WaterHub, DeliveryOrder, Driver, OptimizedRoute
from optimizer import assign_hub_to_order, optimize_day, build_route_summary

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bengaluru Water Delivery API", version="1.0.0")

# Allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas (request/response shapes) ────────────────────────────────

class OrderCreate(BaseModel):
    citizen_name: str
    address: str
    lat: float
    lng: float
    litres_needed: int = 500
    delivery_date: str  # "YYYY-MM-DD"


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
    available: bool
    ward: Optional[str]

    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Bengaluru Water Delivery API is running"}


# ── Hubs ──────────────────────────────────────────────────────────────────────

@app.get("/hubs", response_model=List[HubResponse])
def list_hubs(db: Session = Depends(get_db)):
    return db.query(WaterHub).all()


# ── Orders ────────────────────────────────────────────────────────────────────

@app.post("/orders", response_model=OrderResponse)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """
    Citizen submits a water delivery request.
    Automatically finds and assigns the nearest hub.
    """
    # Get all available hubs
    hubs = db.query(WaterHub).filter(WaterHub.available == True).all()
    if not hubs:
        raise HTTPException(status_code=503, detail="No water hubs available")

    # Find nearest hub
    try:
        nearest_hub, dist_km = assign_hub_to_order(order.lat, order.lng, hubs)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Create order record
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
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(DeliveryOrder)
    if delivery_date:
        query = query.filter(DeliveryOrder.delivery_date == delivery_date)
    if status:
        query = query.filter(DeliveryOrder.status == status)
    return query.order_by(DeliveryOrder.id).all()


# ── Optimization ──────────────────────────────────────────────────────────────

@app.post("/optimize/{delivery_date}")
def run_optimization(delivery_date: str, db: Session = Depends(get_db)):
    """
    Run the TSP optimizer for all orders on a given date.
    Groups orders by hub, then finds the nearest-neighbor route for each hub.
    Assigns stop_order to each order and creates OptimizedRoute records.
    Call this once you have 10+ orders for a day (or whenever admin wants).
    """
    orders = db.query(DeliveryOrder).filter(
        DeliveryOrder.delivery_date == delivery_date,
        DeliveryOrder.hub_id != None
    ).all()

    if not orders:
        raise HTTPException(status_code=404, detail=f"No orders found for {delivery_date}")

    hubs = db.query(WaterHub).all()

    # Run the optimizer
    day_routes = optimize_day(orders, hubs)

    results = []

    for hub_id, route_data in day_routes.items():
        optimized_orders = route_data["orders"]

        # Update each order's stop_order and status
        for i, order in enumerate(optimized_orders):
            order.stop_order = i + 1
            order.status = "assigned"

        db.commit()

        # Save the optimized route record
        existing = db.query(OptimizedRoute).filter(
            OptimizedRoute.hub_id == hub_id,
            OptimizedRoute.delivery_date == delivery_date
        ).first()

        route_summary = build_route_summary(hub_id, route_data)

        if existing:
            existing.total_distance_km = route_data["total_distance_km"]
            existing.total_stops = route_data["total_stops"]
            existing.route_json = json.dumps(route_summary)
        else:
            new_route = OptimizedRoute(
                hub_id=hub_id,
                delivery_date=delivery_date,
                total_distance_km=route_data["total_distance_km"],
                total_stops=route_data["total_stops"],
                route_json=json.dumps(route_summary),
            )
            db.add(new_route)

        db.commit()
        results.append(route_summary)

    return {
        "date": delivery_date,
        "total_orders": len(orders),
        "hubs_used": len(results),
        "routes": results
    }


@app.get("/routes/{delivery_date}")
def get_routes(delivery_date: str, db: Session = Depends(get_db)):
    """Get all optimized routes for a date (for admin dashboard)."""
    routes = db.query(OptimizedRoute).filter(
        OptimizedRoute.delivery_date == delivery_date
    ).all()

    if not routes:
        raise HTTPException(status_code=404, detail="No optimized routes found. Run /optimize/{date} first.")

    result = []
    for r in routes:
        route_data = json.loads(r.route_json) if r.route_json else {}
        route_data["optimized_route_id"] = r.id
        route_data["driver_id"] = r.driver_id
        result.append(route_data)

    return {"date": delivery_date, "routes": result}


@app.get("/driver/{hub_id}/{delivery_date}")
def driver_view(hub_id: int, delivery_date: str, db: Session = Depends(get_db)):
    """
    What a driver sees: their ordered list of stops for the day.
    Hub -> Stop 1 -> Stop 2 -> ... in optimized sequence.
    """
    route = db.query(OptimizedRoute).filter(
        OptimizedRoute.hub_id == hub_id,
        OptimizedRoute.delivery_date == delivery_date
    ).first()

    if not route:
        raise HTTPException(
            status_code=404,
            detail="Route not optimized yet. Ask admin to run optimization."
        )

    hub = db.query(WaterHub).filter(WaterHub.id == hub_id).first()

    orders = db.query(DeliveryOrder).filter(
        DeliveryOrder.hub_id == hub_id,
        DeliveryOrder.delivery_date == delivery_date,
        DeliveryOrder.stop_order != None
    ).order_by(DeliveryOrder.stop_order).all()

    return {
        "hub": {
            "id": hub.id,
            "name": hub.name,
            "lat": hub.lat,
            "lng": hub.lng,
        },
        "delivery_date": delivery_date,
        "total_stops": len(orders),
        "total_distance_km": route.total_distance_km,
        "stops": [
            {
                "stop_number": o.stop_order,
                "order_id": o.id,
                "citizen_name": o.citizen_name,
                "address": o.address,
                "lat": o.lat,
                "lng": o.lng,
                "litres_needed": o.litres_needed,
                "status": o.status,
            }
            for o in orders
        ]
    }


@app.patch("/orders/{order_id}/deliver")
def mark_delivered(order_id: int, db: Session = Depends(get_db)):
    """Driver marks a stop as delivered."""
    order = db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "delivered"
    db.commit()
    return {"message": f"Order {order_id} marked as delivered"}
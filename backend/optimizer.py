"""
optimizer.py — Core route optimization logic

Two algorithms used:
1. Haversine nearest-hub: assigns each order to its closest water hub
2. Nearest-neighbor TSP: for each hub's group of orders, finds the shortest
   delivery path starting FROM the hub, visiting all stops, minimizing km traveled.
   Not globally optimal but runs in O(n^2) — fine for n < 100 stops per driver.
"""

import math
import json
from collections import defaultdict
from typing import List, Dict, Tuple


# ── Haversine formula ────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance in km between two lat/lng points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Step 1: assign each order to the nearest available hub ───────────────────

def assign_hub_to_order(order_lat: float, order_lng: float, hubs: list) -> Tuple[object, float]:
    """
    Given an order's coordinates and a list of WaterHub objects,
    return (nearest_hub, distance_km).
    Only considers hubs that are available and have capacity.
    """
    available = [h for h in hubs if h.available and h.capacity_litres > 0]
    if not available:
        raise ValueError("No available water hubs")

    best_hub = None
    best_dist = float("inf")

    for hub in available:
        dist = haversine_km(order_lat, order_lng, hub.lat, hub.lng)
        if dist < best_dist:
            best_dist = dist
            best_hub = hub

    return best_hub, best_dist


# ── Step 2: TSP nearest-neighbor for one hub's orders ────────────────────────

def nearest_neighbor_route(hub_lat: float, hub_lng: float, orders: list) -> Tuple[List, float]:
    """
    Given a hub's location and a list of DeliveryOrder objects assigned to it,
    compute the optimal visit sequence using nearest-neighbor heuristic.

    Returns:
        (ordered_list_of_orders, total_distance_km)

    Algorithm:
        Start at hub.
        Repeatedly pick the closest unvisited stop.
        Stop when all orders are visited.
        This is greedy O(n^2) — works great for n < 50 stops.
    """
    if not orders:
        return [], 0.0

    unvisited = list(orders)
    visited = []
    total_dist = 0.0

    # Current position starts at the hub
    current_lat, current_lng = hub_lat, hub_lng

    while unvisited:
        # Find the closest unvisited order to current position
        closest = min(
            unvisited,
            key=lambda o: haversine_km(current_lat, current_lng, o.lat, o.lng)
        )
        dist = haversine_km(current_lat, current_lng, closest.lat, closest.lng)
        total_dist += dist

        visited.append(closest)
        unvisited.remove(closest)

        # Move to this stop
        current_lat = closest.lat
        current_lng = closest.lng

    return visited, round(total_dist, 2)


# ── Step 3: Full day optimization — group all orders by hub, optimize each ───

def optimize_day(orders: list, hubs: list) -> Dict:
    """
    Main optimization function. Takes all orders for a day and all hubs.
    
    Returns a dict keyed by hub_id, each containing:
    {
        "hub": hub object,
        "orders": [ordered list of DeliveryOrder],
        "total_distance_km": float,
        "route_coords": [(lat, lng), ...]  — for map display
    }

    This represents one driver per hub doing their optimized route.
    """
    # Group orders by their assigned hub
    hub_groups = defaultdict(list)
    for order in orders:
        if order.hub_id:
            hub_groups[order.hub_id].append(order)

    result = {}
    hub_map = {h.id: h for h in hubs}

    for hub_id, hub_orders in hub_groups.items():
        hub = hub_map.get(hub_id)
        if not hub:
            continue

        optimized_orders, total_km = nearest_neighbor_route(hub.lat, hub.lng, hub_orders)

        # Build coordinate list for map: hub → stop1 → stop2 → ...
        route_coords = [(hub.lat, hub.lng)] + [(o.lat, o.lng) for o in optimized_orders]

        result[hub_id] = {
            "hub": hub,
            "orders": optimized_orders,
            "total_distance_km": total_km,
            "route_coords": route_coords,
            "total_stops": len(optimized_orders),
        }

    return result


# ── Fuel + time estimates ─────────────────────────────────────────────────────

def estimate_fuel_litres(distance_km: float, fuel_efficiency_km_per_litre: float = 4.0) -> float:
    """
    A water tanker typically gets ~4 km/litre diesel.
    Returns estimated fuel consumption in litres.
    """
    return round(distance_km / fuel_efficiency_km_per_litre, 2)


def estimate_time_minutes(distance_km: float, avg_speed_kmh: float = 20.0, stop_minutes: int = 10) -> int:
    """
    Estimate total route time in minutes.
    Bengaluru city driving avg ~20 km/h, ~10 min per delivery stop.
    """
    drive_minutes = (distance_km / avg_speed_kmh) * 60
    return int(drive_minutes)


def build_route_summary(hub_id: int, route_data: dict) -> dict:
    """Build a clean JSON-serializable summary of one hub's route."""
    hub = route_data["hub"]
    orders = route_data["orders"]
    km = route_data["total_distance_km"]

    return {
        "hub_id": hub.id,
        "hub_name": hub.name,
        "hub_lat": hub.lat,
        "hub_lng": hub.lng,
        "total_stops": len(orders),
        "total_distance_km": km,
        "estimated_fuel_litres": estimate_fuel_litres(km),
        "estimated_time_minutes": estimate_time_minutes(km, stop_minutes=len(orders) * 10),
        "stops": [
            {
                "stop_number": i + 1,
                "order_id": o.id,
                "citizen_name": o.citizen_name,
                "address": o.address,
                "lat": o.lat,
                "lng": o.lng,
                "litres": o.litres_needed,
                "distance_from_prev_km": round(
                    haversine_km(
                        orders[i - 1].lat if i > 0 else hub.lat,
                        orders[i - 1].lng if i > 0 else hub.lng,
                        o.lat, o.lng
                    ), 2
                ),
            }
            for i, o in enumerate(orders)
        ],
        "route_coords": route_data["route_coords"],
    }
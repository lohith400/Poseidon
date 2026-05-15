"""
optimizer.py — Capacity-Constrained Route Optimization

Algorithms:
1. Haversine nearest-hub    : assigns each order to its geographically closest hub
2. Capacity-constrained TSP : nearest-neighbor with automatic refill waypoints

Tanker logic (from product spec):
    - Tanker holds 12 000 L max
    - Starts FULL at the assigned hub
    - Delivers to the nearest unvisited order
    - If remaining water < next order's need  →  detour back to hub, REFILL, then continue
    - Combines small orders (e.g. 6000 + 6000) in one load — avoids unnecessary refill trips
    - O(n²) per hub — perfectly fine for n < 100 stops/driver
"""

import math
from collections import defaultdict
from typing import List, Dict, Tuple, Any


# ── Constants ─────────────────────────────────────────────────────────────────

TANKER_CAPACITY_LITRES: int   = 12_000   # maximum water a tanker holds
FUEL_EFFICIENCY_KM_PER_L: float = 4.0   # diesel: ~4 km per litre for water tanker
AVG_SPEED_KMH: float          = 20.0    # Bengaluru city average
MINUTES_PER_DELIVERY: int     = 10      # time spent at each delivery stop
MINUTES_PER_REFILL: int       = 15      # time spent refilling at hub


# ── Haversine formula ─────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance in km between two lat/lng points."""
    R = 6_371.0
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

def assign_hub_to_order(
    order_lat: float,
    order_lng: float,
    hubs: list,
) -> Tuple[Any, float]:
    """
    Return (nearest_hub, distance_km) for an order.
    Only considers hubs that are marked available and have water in stock.
    """
    available = [h for h in hubs if h.available and h.capacity_litres > 0]
    if not available:
        raise ValueError("No available water hubs")

    best_hub, best_dist = None, float("inf")
    for hub in available:
        dist = haversine_km(order_lat, order_lng, hub.lat, hub.lng)
        if dist < best_dist:
            best_dist, best_hub = dist, hub

    return best_hub, best_dist


# ── Step 2: Capacity-constrained nearest-neighbor routing ────────────────────

def capacity_constrained_route(
    hub_lat: float,
    hub_lng: float,
    orders: list,
    tanker_capacity: int = TANKER_CAPACITY_LITRES,
) -> Tuple[List[Dict], float, int]:
    """
    Core routing engine with automatic refill waypoints.

    Algorithm
    ---------
    1. Start at hub, tank = FULL (12 000 L)
    2. Find the NEAREST unvisited delivery from current position
    3. Can we fill that order with what's left in the tank?
       YES → drive there, deliver, subtract litres
       NO  → detour to hub first (insert REFILL waypoint), top up, then deliver
    4. Repeat until all orders done

    Why nearest-first with capacity check beats naive TSP:
    - Minimises driving distance between stops
    - Batches small orders (e.g. 6 000 + 6 000 = 12 000) into one tank load
      → reduces total refill trips → less fuel, less time

    Parameters
    ----------
    hub_lat / hub_lng   : coordinates of this driver's hub
    orders              : list of DeliveryOrder ORM objects for this hub
    tanker_capacity     : max litres the tanker holds (default 12 000)

    Returns
    -------
    waypoints           : ordered list of dicts, each with "type" = "delivery" | "refill"
    total_distance_km   : total km driven including all refill detours
    refill_count        : how many times the driver returned to refill
    """
    if not orders:
        return [], 0.0, 0

    # Validate: if any single order exceeds tanker capacity, raise early
    oversized = [o for o in orders if o.litres_needed > tanker_capacity]
    if oversized:
        ids = [o.id for o in oversized]
        raise ValueError(
            f"Orders {ids} each need more than tanker capacity ({tanker_capacity} L). "
            "Split those orders or use a larger tanker."
        )

    unvisited        = list(orders)
    waypoints        = []
    total_dist       = 0.0
    refill_count     = 0
    current_capacity = tanker_capacity
    current_lat      = hub_lat
    current_lng      = hub_lng
    stop_number      = 0   # delivery stop counter (refills don't count)

    while unvisited:
        # ── Pick the nearest unvisited order from current position ──────────
        nearest = min(
            unvisited,
            key=lambda o: haversine_km(current_lat, current_lng, o.lat, o.lng),
        )

        # ── Do we need to refill before this delivery? ──────────────────────
        if nearest.litres_needed > current_capacity:
            dist_to_hub = haversine_km(current_lat, current_lng, hub_lat, hub_lng)
            total_dist      += dist_to_hub
            refill_count    += 1
            current_capacity = tanker_capacity          # full tank
            current_lat      = hub_lat
            current_lng      = hub_lng

            waypoints.append({
                "type":                   "refill",
                "lat":                    hub_lat,
                "lng":                    hub_lng,
                "distance_from_prev_km":  round(dist_to_hub, 2),
                "capacity_after_refill":  tanker_capacity,
                "refill_number":          refill_count,
            })

        # ── Drive to the delivery stop ───────────────────────────────────────
        dist_to_order    = haversine_km(current_lat, current_lng, nearest.lat, nearest.lng)
        total_dist      += dist_to_order
        current_capacity -= nearest.litres_needed
        stop_number      += 1
        current_lat       = nearest.lat
        current_lng       = nearest.lng

        waypoints.append({
            "type":                   "delivery",
            "stop_number":            stop_number,
            "order_id":               nearest.id,
            "citizen_name":           nearest.citizen_name,
            "address":                nearest.address,
            "lat":                    nearest.lat,
            "lng":                    nearest.lng,
            "litres_delivered":       nearest.litres_needed,
            "remaining_capacity_L":   current_capacity,
            "distance_from_prev_km":  round(dist_to_order, 2),
            "order_obj":              nearest,        # stripped before JSON export
        })

        unvisited.remove(nearest)

    return waypoints, round(total_dist, 2), refill_count


# ── Step 3: Full-day optimization ────────────────────────────────────────────

def optimize_day(orders: list, hubs: list) -> Dict:
    """
    Entry point for a day's dispatch.

    Groups orders by their pre-assigned hub_id, then runs
    capacity_constrained_route() for each hub's batch.

    Returns
    -------
    dict keyed by hub_id:
    {
        "hub"             : WaterHub object,
        "waypoints"       : [{"type": "delivery"|"refill", ...}, ...],
        "ordered_orders"  : [DeliveryOrder, ...],   # only delivery stops, in visit order
        "total_distance_km": float,
        "refill_count"    : int,
        "total_stops"     : int,
        "route_coords"    : [(lat, lng), ...],      # for map polyline
    }
    """
    hub_groups = defaultdict(list)
    for order in orders:
        if order.hub_id:
            hub_groups[order.hub_id].append(order)

    hub_map = {h.id: h for h in hubs}
    result  = {}

    for hub_id, hub_orders in hub_groups.items():
        hub = hub_map.get(hub_id)
        if not hub:
            continue

        waypoints, total_km, refill_count = capacity_constrained_route(
            hub.lat, hub.lng, hub_orders
        )

        # Ordered delivery-only list (used to set stop_order in DB)
        ordered_orders = [
            wp["order_obj"]
            for wp in waypoints
            if wp["type"] == "delivery"
        ]

        # Full coordinate path: hub → wp1 → wp2 → ... (refills back at hub included)
        route_coords = [(hub.lat, hub.lng)] + [
            (wp["lat"], wp["lng"]) for wp in waypoints
        ]

        result[hub_id] = {
            "hub":               hub,
            "waypoints":         waypoints,
            "ordered_orders":    ordered_orders,
            "total_distance_km": total_km,
            "refill_count":      refill_count,
            "total_stops":       len(ordered_orders),
            "route_coords":      route_coords,
        }

    return result


# ── Fuel & time estimates ─────────────────────────────────────────────────────

def estimate_fuel_litres(
    distance_km: float,
    efficiency: float = FUEL_EFFICIENCY_KM_PER_L,
) -> float:
    """Diesel consumed for the full route (including refill detours)."""
    return round(distance_km / efficiency, 2)


def estimate_time_minutes(
    distance_km: float,
    delivery_stops: int,
    refill_count: int,
    avg_speed: float = AVG_SPEED_KMH,
) -> int:
    """
    Total route time in minutes:
        drive time  +  (10 min × deliveries)  +  (15 min × refills)
    """
    drive_minutes   = (distance_km / avg_speed) * 60
    stop_minutes    = delivery_stops * MINUTES_PER_DELIVERY
    refill_minutes  = refill_count   * MINUTES_PER_REFILL
    return int(drive_minutes + stop_minutes + refill_minutes)


# ── Route summary builder ─────────────────────────────────────────────────────

def build_route_summary(hub_id: int, route_data: dict) -> dict:
    """
    Convert route_data (from optimize_day) into a clean JSON-serializable
    dict suitable for storage in OptimizedRoute.route_json and API responses.

    Waypoint format
    ---------------
    Each entry in "waypoints" is one of:

      Delivery stop:
        { "type": "delivery", "stop_number": 1, "order_id": 42,
          "citizen_name": "Ravi", "address": "...", "lat": ..., "lng": ...,
          "litres_delivered": 6000, "remaining_capacity_L": 6000,
          "distance_from_prev_km": 2.1 }

      Refill waypoint:
        { "type": "refill", "lat": ..., "lng": ...,
          "distance_from_prev_km": 3.4,
          "capacity_after_refill": 12000, "refill_number": 1 }
    """
    hub          = route_data["hub"]
    waypoints    = route_data["waypoints"]
    km           = route_data["total_distance_km"]
    refill_count = route_data["refill_count"]
    n_stops      = route_data["total_stops"]

    # Strip non-serialisable "order_obj" key before saving
    clean_waypoints = []
    for wp in waypoints:
        entry = {k: v for k, v in wp.items() if k != "order_obj"}
        clean_waypoints.append(entry)

    return {
        "hub_id":                   hub.id,
        "hub_name":                 hub.name,
        "hub_lat":                  hub.lat,
        "hub_lng":                  hub.lng,
        "total_stops":              n_stops,
        "total_distance_km":        km,
        "refill_count":             refill_count,
        "estimated_fuel_litres":    estimate_fuel_litres(km),
        "estimated_time_minutes":   estimate_time_minutes(km, n_stops, refill_count),
        "tanker_capacity_litres":   TANKER_CAPACITY_LITRES,
        # Full ordered waypoint list — includes both deliveries AND refill detours
        "waypoints":                clean_waypoints,
        # Flat coordinate list for map polyline rendering
        "route_coords":             route_data["route_coords"],
    }
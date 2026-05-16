"""
Capacity-constrained route optimization with OSRM road distances and 2-opt improvement.
"""
from __future__ import annotations

import math
from collections import defaultdict
from typing import Any, Dict, List, Sequence, Tuple

from routing import distance_matrix, haversine_km

TANKER_CAPACITY_LITRES: int = 12_000
FUEL_EFFICIENCY_KM_PER_L: float = 4.0
AVG_SPEED_KMH: float = 20.0
MINUTES_PER_DELIVERY: int = 10
MINUTES_PER_REFILL: int = 15


def assign_hub_to_order(order_lat: float, order_lng: float, hubs: list) -> Tuple[Any, float]:
    available = [h for h in hubs if h.available and h.capacity_litres > 0]
    if not available:
        raise ValueError("No available water hubs")
    best_hub, best_dist = None, float("inf")
    for hub in available:
        dist = haversine_km(order_lat, order_lng, hub.lat, hub.lng)
        if dist < best_dist:
            best_dist, best_hub = dist, hub
    return best_hub, best_dist


def _matrix_dist(matrix: List[List[float]], i: int, j: int) -> float:
    return matrix[i][j]


def _two_opt(
    route_indices: List[int],
    dist_matrix: List[List[float]],
    max_iter: int = 50,
) -> List[int]:
    """Improve visit order (indices into dist_matrix, index 0 = depot)."""
    if len(route_indices) <= 3:
        return route_indices

    def length(order: List[int]) -> float:
        return sum(
            _matrix_dist(dist_matrix, order[i], order[i + 1])
            for i in range(len(order) - 1)
        )

    best = route_indices[:]
    best_len = length(best)
    improved = True
    it = 0
    while improved and it < max_iter:
        improved = False
        it += 1
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best) - 1):
                if j - i == 1:
                    continue
                new_route = best[:i] + best[i:j][::-1] + best[j:]
                new_len = length(new_route)
                if new_len < best_len - 1e-6:
                    best, best_len = new_route, new_len
                    improved = True
    return best


def capacity_constrained_route(
    hub_lat: float,
    hub_lng: float,
    orders: list,
    tanker_capacity: int = TANKER_CAPACITY_LITRES,
    use_osrm: bool = True,
) -> Tuple[List[Dict], float, int]:
    if not orders:
        return [], 0.0, 0

    oversized = [o for o in orders if o.litres_needed > tanker_capacity]
    if oversized:
        ids = [o.id for o in oversized]
        raise ValueError(
            f"Orders {ids} exceed tanker capacity ({tanker_capacity} L)."
        )

    unvisited = list(orders)
    waypoints: List[Dict] = []
    total_dist = 0.0
    refill_count = 0
    current_capacity = tanker_capacity
    current_lat, current_lng = hub_lat, hub_lng
    stop_number = 0

    while unvisited:
        coords = [(current_lat, current_lng)] + [(o.lat, o.lng) for o in unvisited]
        matrix = distance_matrix(coords, use_osrm=use_osrm)

        best_idx = 0
        best_d = float("inf")
        for i, o in enumerate(unvisited):
            d = matrix[0][i + 1]
            if d < best_d:
                best_d, best_idx = d, i
        nearest = unvisited[best_idx]

        if nearest.litres_needed > current_capacity:
            dist_to_hub = haversine_km(current_lat, current_lng, hub_lat, hub_lng)
            if use_osrm and len(unvisited) > 0:
                dm = distance_matrix(
                    [(current_lat, current_lng), (hub_lat, hub_lng)],
                    use_osrm=True,
                )
                dist_to_hub = dm[0][1]
            total_dist += dist_to_hub
            refill_count += 1
            current_capacity = tanker_capacity
            current_lat, current_lng = hub_lat, hub_lng
            waypoints.append({
                "type": "refill",
                "lat": hub_lat,
                "lng": hub_lng,
                "distance_from_prev_km": round(dist_to_hub, 2),
                "capacity_after_refill": tanker_capacity,
                "refill_number": refill_count,
            })

        dist_to_order = best_d
        total_dist += dist_to_order
        current_capacity -= nearest.litres_needed
        stop_number += 1
        current_lat, current_lng = nearest.lat, nearest.lng

        waypoints.append({
            "type": "delivery",
            "stop_number": stop_number,
            "order_id": nearest.id,
            "citizen_name": nearest.citizen_name,
            "address": nearest.address,
            "lat": nearest.lat,
            "lng": nearest.lng,
            "litres_delivered": nearest.litres_needed,
            "remaining_capacity_L": current_capacity,
            "distance_from_prev_km": round(dist_to_order, 2),
            "order_obj": nearest,
        })
        unvisited.remove(nearest)

    return waypoints, round(total_dist, 2), refill_count


def assign_driver(hub_id: int, drivers: list, used_driver_ids: set) -> Any | None:
    """Pick an available driver for this hub (prefer same hub_id)."""
    candidates = [
        d for d in drivers
        if d.available and d.id not in used_driver_ids
    ]
    if not candidates:
        return None
    same_hub = [d for d in candidates if d.hub_id == hub_id]
    pool = same_hub if same_hub else candidates
    return pool[0]


def optimize_day(orders: list, hubs: list, use_osrm: bool = True) -> Dict:
    hub_groups = defaultdict(list)
    for order in orders:
        if order.hub_id:
            hub_groups[order.hub_id].append(order)

    hub_map = {h.id: h for h in hubs}
    result = {}

    for hub_id, hub_orders in hub_groups.items():
        hub = hub_map.get(hub_id)
        if not hub:
            continue

        waypoints, total_km, refill_count = capacity_constrained_route(
            hub.lat, hub.lng, hub_orders, use_osrm=use_osrm
        )

        ordered_orders = [wp["order_obj"] for wp in waypoints if wp["type"] == "delivery"]
        route_coords = [(hub.lat, hub.lng)] + [(wp["lat"], wp["lng"]) for wp in waypoints]

        result[hub_id] = {
            "hub": hub,
            "waypoints": waypoints,
            "ordered_orders": ordered_orders,
            "total_distance_km": total_km,
            "refill_count": refill_count,
            "total_stops": len(ordered_orders),
            "route_coords": route_coords,
            "distance_method": "osrm" if use_osrm else "haversine",
        }

    return result


def estimate_fuel_litres(distance_km: float, efficiency: float = FUEL_EFFICIENCY_KM_PER_L) -> float:
    return round(distance_km / efficiency, 2)


def estimate_time_minutes(
    distance_km: float,
    delivery_stops: int,
    refill_count: int,
    avg_speed: float = AVG_SPEED_KMH,
) -> int:
    drive_minutes = (distance_km / avg_speed) * 60
    return int(drive_minutes + delivery_stops * MINUTES_PER_DELIVERY + refill_count * MINUTES_PER_REFILL)


def build_route_summary(hub_id: int, route_data: dict, driver_id: int | None = None) -> dict:
    hub = route_data["hub"]
    waypoints = route_data["waypoints"]
    km = route_data["total_distance_km"]
    refill_count = route_data["refill_count"]
    n_stops = route_data["total_stops"]

    clean_waypoints = []
    stops = []
    for wp in waypoints:
        entry = {k: v for k, v in wp.items() if k != "order_obj"}
        clean_waypoints.append(entry)
        if wp["type"] == "delivery":
            stops.append({
                "stop_number": wp["stop_number"],
                "order_id": wp["order_id"],
                "citizen_name": wp["citizen_name"],
                "address": wp["address"],
                "lat": wp["lat"],
                "lng": wp["lng"],
                "litres": wp["litres_delivered"],
                "distance_from_prev_km": wp["distance_from_prev_km"],
            })

    return {
        "hub_id": hub.id,
        "hub_name": hub.name,
        "hub_lat": hub.lat,
        "hub_lng": hub.lng,
        "driver_id": driver_id,
        "total_stops": n_stops,
        "total_distance_km": km,
        "refill_count": refill_count,
        "estimated_fuel_litres": estimate_fuel_litres(km),
        "estimated_time_minutes": estimate_time_minutes(km, n_stops, refill_count),
        "tanker_capacity_litres": TANKER_CAPACITY_LITRES,
        "distance_method": route_data.get("distance_method", "haversine"),
        "waypoints": clean_waypoints,
        "stops": stops,
        "route_coords": route_data["route_coords"],
    }

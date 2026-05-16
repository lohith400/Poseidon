"""
Road-network distances via OSRM (Open Source Routing Machine).
Falls back to Haversine straight-line km when OSRM is disabled or unreachable.
"""
from __future__ import annotations

import math
from typing import List, Sequence, Tuple

import httpx

from config import OSRM_BASE_URL, OSRM_ENABLED

Coord = Tuple[float, float]  # (lat, lng)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _haversine_matrix(coords: Sequence[Coord]) -> List[List[float]]:
    n = len(coords)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine_km(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
            matrix[i][j] = matrix[j][i] = d
    return matrix


def _osrm_table_matrix(coords: Sequence[Coord], timeout: float = 8.0) -> List[List[float]] | None:
    """OSRM table API expects lng,lat pairs."""
    if len(coords) < 2 or len(coords) > 100:
        return None
    coord_str = ";".join(f"{lng},{lat}" for lat, lng in coords)
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coord_str}"
    params = {"annotations": "distance"}
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        if data.get("code") != "Ok":
            return None
        distances_m = data["distances"]
        return [[(d or 0) / 1000.0 for d in row] for row in distances_m]
    except Exception:
        return None


def distance_matrix(coords: Sequence[Coord], use_osrm: bool = True) -> List[List[float]]:
    """NxN symmetric distance matrix in kilometres."""
    if not coords:
        return []
    if len(coords) == 1:
        return [[0.0]]
    if use_osrm and OSRM_ENABLED:
        osrm = _osrm_table_matrix(coords)
        if osrm is not None:
            return osrm
    return _haversine_matrix(coords)


def pairwise_km(a: Coord, b: Coord, use_osrm: bool = True) -> float:
    matrix = distance_matrix([a, b], use_osrm=use_osrm)
    return matrix[0][1]

"""WebSocket broadcast for live tanker GPS positions."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Set

from fastapi import WebSocket


class TankerTracker:
    def __init__(self) -> None:
        self.positions: Dict[int, Dict[str, Any]] = {}
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    def update_position(
        self,
        driver_id: int,
        hub_id: int,
        driver_name: str,
        lat: float,
        lng: float,
        heading: float = 0.0,
        speed_kmh: float = 0.0,
    ) -> Dict[str, Any]:
        payload = {
            "driver_id": driver_id,
            "hub_id": hub_id,
            "driver_name": driver_name,
            "lat": lat,
            "lng": lng,
            "heading": heading,
            "speed_kmh": speed_kmh,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.positions[driver_id] = payload
        return payload

    def all_positions(self) -> List[Dict[str, Any]]:
        return list(self.positions.values())

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        await websocket.send_json({"type": "snapshot", "tankers": self.all_positions()})

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        message = json.dumps({"type": "position", "tanker": payload})
        dead: List[WebSocket] = []
        async with self._lock:
            conns = list(self._connections)
        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)


tanker_tracker = TankerTracker()

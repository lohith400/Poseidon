from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class WaterHub(Base):
    """BWSSB Ground Level Reservoir (GLR)."""
    __tablename__ = "water_hubs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    hub_type = Column(String, default="glr")
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    capacity_litres = Column(Integer, default=10_000_000)
    current_fill_litres = Column(Integer, default=0)
    reserved_litres = Column(Integer, default=0)
    available = Column(Boolean, default=True)
    ward = Column(String, nullable=True)

    orders = relationship("DeliveryOrder", back_populates="hub")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=True)
    available = Column(Boolean, default=True)

    hub = relationship("WaterHub")
    routes = relationship("OptimizedRoute", back_populates="driver")
    user = relationship("User", back_populates="driver", uselist=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # citizen | driver | admin
    display_name = Column(String, nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    driver = relationship("Driver", back_populates="user")


class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id = Column(Integer, primary_key=True, index=True)
    citizen_name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    litres_needed = Column(Integer, default=500)
    delivery_date = Column(String, nullable=False)
    status = Column(String, default="pending")
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=True)
    hub_distance_km = Column(Float, nullable=True)
    stop_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hub = relationship("WaterHub", back_populates="orders")


class OptimizedRoute(Base):
    __tablename__ = "optimized_routes"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=False)
    delivery_date = Column(String, nullable=False)
    total_distance_km = Column(Float, nullable=True)
    total_stops = Column(Integer, nullable=True)
    route_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    driver = relationship("Driver", back_populates="routes")


class HistoricalDemand(Base):
    """Daily withdrawal demand at a GLR (for Prophet / seasonal forecast)."""
    __tablename__ = "historical_demand"

    id = Column(Integer, primary_key=True, index=True)
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=False, index=True)
    record_date = Column(String, nullable=False, index=True)
    demand_litres = Column(Integer, nullable=False)
    rainfall_mm = Column(Float, default=0.0)


class ReservoirSnapshot(Base):
    """Point-in-time reservoir level readings."""
    __tablename__ = "reservoir_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=False)
    recorded_at = Column(String, nullable=False)
    fill_percent = Column(Float, nullable=False)
    level_litres = Column(Integer, nullable=False)


class TankerPosition(Base):
    """Latest GPS fix per driver (persisted + broadcast via WebSocket)."""
    __tablename__ = "tanker_positions"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), unique=True, nullable=False)
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    heading = Column(Float, default=0.0)
    speed_kmh = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

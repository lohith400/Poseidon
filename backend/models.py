from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class WaterHub(Base):
    """A water source point — BWSSB depot, borewell, community tank, etc."""
    __tablename__ = "water_hubs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    hub_type = Column(String, default="bwssb_depot")  # bwssb_depot | borewell | community_tank
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    capacity_litres = Column(Integer, default=10000)
    available = Column(Boolean, default=True)
    ward = Column(String, nullable=True)

    orders = relationship("DeliveryOrder", back_populates="hub")


class Driver(Base):
    """A tanker driver who handles deliveries from a hub."""
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    available = Column(Boolean, default=True)

    routes = relationship("OptimizedRoute", back_populates="driver")


class DeliveryOrder(Base):
    """A single citizen's water delivery request."""
    __tablename__ = "delivery_orders"

    id = Column(Integer, primary_key=True, index=True)
    citizen_name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    litres_needed = Column(Integer, default=500)
    delivery_date = Column(String, nullable=False)  # "YYYY-MM-DD"
    status = Column(String, default="pending")  # pending | assigned | delivered
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=True)
    hub_distance_km = Column(Float, nullable=True)
    stop_order = Column(Integer, nullable=True)  # position in driver's route
    created_at = Column(DateTime, default=datetime.utcnow)

    hub = relationship("WaterHub", back_populates="orders")


class OptimizedRoute(Base):
    """One driver's full optimized route for a day from a hub."""
    __tablename__ = "optimized_routes"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    hub_id = Column(Integer, ForeignKey("water_hubs.id"), nullable=False)
    delivery_date = Column(String, nullable=False)
    total_distance_km = Column(Float, nullable=True)
    total_stops = Column(Integer, nullable=True)
    route_json = Column(Text, nullable=True)  # JSON array of stop coords in order
    created_at = Column(DateTime, default=datetime.utcnow)

    driver = relationship("Driver", back_populates="routes")
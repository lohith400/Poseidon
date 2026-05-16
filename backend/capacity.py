"""GLR reservoir capacity: reserve on booking, deduct on delivery."""
from sqlalchemy.orm import Session

from models import DeliveryOrder, WaterHub


def available_litres(hub: WaterHub) -> int:
    return max(0, hub.current_fill_litres - hub.reserved_litres)


def reserve_for_order(db: Session, hub: WaterHub, litres: int) -> None:
    if litres > available_litres(hub):
        raise ValueError(
            f"Hub '{hub.name}' has only {available_litres(hub):,} L available "
            f"({hub.current_fill_litres:,} L fill, {hub.reserved_litres:,} L reserved)."
        )
    hub.reserved_litres += litres
    db.commit()


def release_reservation(db: Session, hub: WaterHub, litres: int) -> None:
    hub.reserved_litres = max(0, hub.reserved_litres - litres)
    db.commit()


def fulfill_delivery(db: Session, order: DeliveryOrder) -> None:
    """Move water from reserved → delivered (deduct fill)."""
    hub = order.hub
    if not hub and order.hub_id:
        hub = db.query(WaterHub).filter(WaterHub.id == order.hub_id).first()
    if not hub:
        return
    litres = order.litres_needed
    hub.reserved_litres = max(0, hub.reserved_litres - litres)
    hub.current_fill_litres = max(0, hub.current_fill_litres - litres)
    if hub.current_fill_litres == 0:
        hub.available = False
    db.commit()


def fill_percent(hub: WaterHub) -> float:
    if hub.capacity_litres <= 0:
        return 0.0
    return round(100.0 * hub.current_fill_litres / hub.capacity_litres, 2)

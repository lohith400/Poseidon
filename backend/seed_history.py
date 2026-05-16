"""Generate historical demand + rainfall time series for forecasting."""
import math
import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from models import HistoricalDemand, ReservoirSnapshot, WaterHub


def seed_historical_data(db: Session, days: int = 730) -> int:
    """Two years of daily demand per GLR with monsoon seasonality."""
    hubs = db.query(WaterHub).all()
    if not hubs:
        return 0

    random.seed(42)
    today = date.today()
    start = today - timedelta(days=days)
    count = 0

    for hub in hubs:
        # Initialise fill at 65–85% of capacity
        if hub.current_fill_litres is None or hub.current_fill_litres == 0:
            hub.current_fill_litres = int(hub.capacity_litres * random.uniform(0.65, 0.85))
        hub.reserved_litres = hub.reserved_litres or 0

        base_demand = max(50_000, hub.capacity_litres // 500)
        existing = (
            db.query(HistoricalDemand)
            .filter(HistoricalDemand.hub_id == hub.id)
            .count()
        )
        if existing >= days // 2:
            continue

        d = start
        while d <= today:
            if db.query(HistoricalDemand).filter(
                HistoricalDemand.hub_id == hub.id,
                HistoricalDemand.record_date == d.isoformat(),
            ).first():
                d += timedelta(days=1)
                continue

            month = d.month
            # Bengaluru monsoon Jun–Oct: lower demand stress, more rain
            monsoon = month in (6, 7, 8, 9, 10)
            summer = month in (3, 4, 5)
            season = 0.75 if monsoon else (1.25 if summer else 1.0)
            rain = random.uniform(8, 35) if monsoon else random.uniform(0, 4)
            weekly = 1.0 + 0.1 * math.sin(d.toordinal() / 7)
            noise = random.uniform(0.85, 1.15)
            demand = int(base_demand * season * weekly * noise)

            db.add(
                HistoricalDemand(
                    hub_id=hub.id,
                    record_date=d.isoformat(),
                    demand_litres=demand,
                    rainfall_mm=round(rain, 2),
                )
            )

            fill_pct = max(
                15.0,
                min(
                    98.0,
                    70
                    + (15 if monsoon else -10)
                    + random.uniform(-8, 8)
                    - (demand / max(hub.capacity_litres, 1)) * 30,
                ),
            )
            if d.day == 1 or random.random() < 0.05:
                db.add(
                    ReservoirSnapshot(
                        hub_id=hub.id,
                        recorded_at=d.isoformat(),
                        fill_percent=round(fill_pct, 2),
                        level_litres=int(hub.capacity_litres * fill_pct / 100),
                    )
                )
            count += 1
            d += timedelta(days=1)

    db.commit()
    return count

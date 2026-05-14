"""
seed.py — Populate the DB with real Bengaluru water hub locations and test orders.
Run ONCE: python seed.py

Water hub coordinates are approximate locations of known BWSSB depots/tanks in Bengaluru.
"""

from database import engine, SessionLocal, Base
from models import WaterHub, DeliveryOrder, Driver
from datetime import date

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Real BWSSB water hub locations in Bengaluru ───────────────────────────────

hubs = [
    {"name": "BWSSB Whitefield Depot",       "hub_type": "bwssb_depot",     "lat": 12.9698, "lng": 77.7500, "capacity_litres": 50000, "ward": "Whitefield"},
    {"name": "BWSSB Koramangala Tank",        "hub_type": "bwssb_depot",     "lat": 12.9352, "lng": 77.6245, "capacity_litres": 40000, "ward": "Koramangala"},
    {"name": "BWSSB Hebbal Depot",            "hub_type": "bwssb_depot",     "lat": 13.0358, "lng": 77.5970, "capacity_litres": 45000, "ward": "Hebbal"},
    {"name": "BWSSB Electronic City Depot",   "hub_type": "bwssb_depot",     "lat": 12.8399, "lng": 77.6770, "capacity_litres": 35000, "ward": "Electronic City"},
    {"name": "Community Tank Jayanagar",      "hub_type": "community_tank",  "lat": 12.9252, "lng": 77.5938, "capacity_litres": 20000, "ward": "Jayanagar"},
    {"name": "Borewell Hub HSR Layout",       "hub_type": "borewell",        "lat": 12.9116, "lng": 77.6389, "capacity_litres": 15000, "ward": "HSR Layout"},
    {"name": "BWSSB Yelahanka Depot",         "hub_type": "bwssb_depot",     "lat": 13.1007, "lng": 77.5963, "capacity_litres": 40000, "ward": "Yelahanka"},
    {"name": "BWSSB Marathahalli Tank",       "hub_type": "bwssb_depot",     "lat": 12.9591, "lng": 77.6974, "capacity_litres": 30000, "ward": "Marathahalli"},
]

for h in hubs:
    existing = db.query(WaterHub).filter(WaterHub.name == h["name"]).first()
    if not existing:
        db.add(WaterHub(**h))

db.commit()
print(f"✓ {len(hubs)} water hubs seeded")

# ── Seed drivers ──────────────────────────────────────────────────────────────

drivers = [
    {"name": "Raju Kumar",    "phone": "9880001111"},
    {"name": "Suresh Gowda",  "phone": "9880002222"},
    {"name": "Prakash Naik",  "phone": "9880003333"},
    {"name": "Mohan Reddy",   "phone": "9880004444"},
    {"name": "Anand Sharma",  "phone": "9880005555"},
]

for d in drivers:
    existing = db.query(Driver).filter(Driver.name == d["name"]).first()
    if not existing:
        db.add(Driver(**d))

db.commit()
print(f"✓ {len(drivers)} drivers seeded")

# ── Seed 15 test citizen orders spread across Bengaluru ──────────────────────

hubs_from_db = db.query(WaterHub).all()
hub_map = {h.name: h for h in hubs_from_db}

# These are realistic Bengaluru residential coordinates
test_orders = [
    # Whitefield area
    {"citizen_name": "Ananya Krishnan",   "address": "ITPL Main Rd, Whitefield",        "lat": 12.9769, "lng": 77.7480, "litres_needed": 500},
    {"citizen_name": "Rohan Mehta",       "address": "Varthur Hobli, Whitefield",        "lat": 12.9588, "lng": 77.7340, "litres_needed": 1000},
    {"citizen_name": "Sunita Rao",        "address": "Brookefield, Whitefield",          "lat": 12.9735, "lng": 77.7212, "litres_needed": 500},

    # Koramangala / HSR
    {"citizen_name": "Vikram Singh",      "address": "5th Block, Koramangala",           "lat": 12.9350, "lng": 77.6245, "litres_needed": 750},
    {"citizen_name": "Priya Nair",        "address": "HSR Layout Sector 2",              "lat": 12.9120, "lng": 77.6400, "litres_needed": 500},
    {"citizen_name": "Deepak Shetty",     "address": "7th Block, Koramangala",           "lat": 12.9278, "lng": 77.6221, "litres_needed": 1000},

    # Hebbal / North
    {"citizen_name": "Kavya Menon",       "address": "Nagavara, Hebbal",                 "lat": 13.0450, "lng": 77.6010, "litres_needed": 500},
    {"citizen_name": "Arun Nath",         "address": "Thanisandra Main Rd",              "lat": 13.0628, "lng": 77.6154, "litres_needed": 500},

    # Electronic City / South
    {"citizen_name": "Lakshmi Reddy",     "address": "Electronic City Phase 1",          "lat": 12.8447, "lng": 77.6760, "litres_needed": 750},
    {"citizen_name": "Girish Kumar",      "address": "Neeladri Rd, Electronic City",     "lat": 12.8315, "lng": 77.6765, "litres_needed": 500},

    # Jayanagar / South-West
    {"citizen_name": "Meena Pillai",      "address": "9th Block, Jayanagar",             "lat": 12.9170, "lng": 77.5920, "litres_needed": 1000},
    {"citizen_name": "Sanjay Verma",      "address": "JP Nagar 7th Phase",               "lat": 12.8905, "lng": 77.5873, "litres_needed": 500},

    # Marathahalli / East
    {"citizen_name": "Pooja Iyer",        "address": "Marathahalli Bridge",              "lat": 12.9545, "lng": 77.7012, "litres_needed": 750},
    {"citizen_name": "Rahul Gowda",       "address": "Sarjapur Rd, Bellandur",           "lat": 12.9267, "lng": 77.6749, "litres_needed": 500},

    # Yelahanka / North-West
    {"citizen_name": "Neha Sharma",       "address": "Yelahanka New Town",               "lat": 13.1050, "lng": 77.5975, "litres_needed": 1000},
]

today = str(date.today())

from optimizer import assign_hub_to_order

for o in test_orders:
    existing = db.query(DeliveryOrder).filter(
        DeliveryOrder.citizen_name == o["citizen_name"],
        DeliveryOrder.delivery_date == today
    ).first()
    if not existing:
        nearest_hub, dist_km = assign_hub_to_order(o["lat"], o["lng"], hubs_from_db)
        db.add(DeliveryOrder(
            citizen_name=o["citizen_name"],
            address=o["address"],
            lat=o["lat"],
            lng=o["lng"],
            litres_needed=o["litres_needed"],
            delivery_date=today,
            hub_id=nearest_hub.id,
            hub_distance_km=round(dist_km, 2),
            status="pending",
        ))

db.commit()
print(f"✓ {len(test_orders)} test orders seeded for {today}")
print("\nDone! Now run: uvicorn main:app --reload")
print(f"Then call: POST http://localhost:8000/optimize/{today}")
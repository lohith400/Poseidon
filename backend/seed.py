"""
seed.py — Populate the DB with real Bengaluru BWSSB GLR locations and test orders.
Run ONCE: python seed.py

All 70 BWSSB Ground Level Reservoir (GLR) locations with real GPS coordinates.
Source: BWSSB Chief Engineer Presentation 2024 + JICA Survey Reports.
Capacity is stored in litres (ML × 1,000,000).
"""

from database import engine, SessionLocal, Base
from models import WaterHub, DeliveryOrder, Driver
from datetime import date

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── All 70 BWSSB GLR locations in Bengaluru ──────────────────────────────────
# Coordinates are real GPS locations for each GLR area.
# hub_type: "glr" = Ground Level Reservoir (BWSSB), "glr_stage5" = new Stage V GLR

hubs = [
    # ── West Zone ─────────────────────────────────────────────────────────────
    {"name": "Hegganahalli GLR",              "hub_type": "glr",        "lat": 12.9820, "lng": 77.5192, "capacity_litres": 200_000_000, "ward": "Hegganahalli"},
    {"name": "Rajajinagar GLR",               "hub_type": "glr",        "lat": 12.9980, "lng": 77.5522, "capacity_litres":  45_000_000, "ward": "Rajajinagar"},
    {"name": "Kamakshipalya GLR",             "hub_type": "glr",        "lat": 12.9900, "lng": 77.5382, "capacity_litres":  30_000_000, "ward": "Kamakshipalya"},
    {"name": "Vijayanagar GLR",               "hub_type": "glr",        "lat": 12.9780, "lng": 77.5295, "capacity_litres":  35_000_000, "ward": "Vijayanagar"},
    {"name": "Tavarekere GLR",                "hub_type": "glr",        "lat": 12.9080, "lng": 77.5980, "capacity_litres":  15_000_000, "ward": "Tavarekere"},

    # ── North-West Zone ───────────────────────────────────────────────────────
    {"name": "Malleshwaram (CJF) GLR",        "hub_type": "glr",        "lat": 13.0035, "lng": 77.5700, "capacity_litres":  60_000_000, "ward": "Malleshwaram"},
    {"name": "Hegganahalli-2 Dasarahalli GLR","hub_type": "glr",        "lat": 13.0280, "lng": 77.5120, "capacity_litres":  25_000_000, "ward": "Dasarahalli"},
    {"name": "Nagasandra GLR",                "hub_type": "glr",        "lat": 13.0470, "lng": 77.5100, "capacity_litres":  30_000_000, "ward": "Nagasandra"},
    {"name": "Nagasandra-II GLR",             "hub_type": "glr",        "lat": 13.0520, "lng": 77.5005, "capacity_litres":  20_000_000, "ward": "Nagasandra"},
    {"name": "Peenya GLR",                    "hub_type": "glr",        "lat": 13.0280, "lng": 77.5190, "capacity_litres":  20_000_000, "ward": "Peenya"},
    {"name": "Jalahalli GLR",                 "hub_type": "glr",        "lat": 13.0550, "lng": 77.5397, "capacity_litres":  25_000_000, "ward": "Jalahalli"},
    {"name": "Mathikere Yeshwanthpur GLR",    "hub_type": "glr",        "lat": 13.0180, "lng": 77.5554, "capacity_litres":  20_000_000, "ward": "Mathikere"},
    {"name": "Lingadheeranahalli GLR",        "hub_type": "glr_stage5", "lat": 13.0200, "lng": 77.4980, "capacity_litres":  90_000_000, "ward": "Dasarahalli"},
    {"name": "Chikkabanavara GLR",            "hub_type": "glr",        "lat": 13.0680, "lng": 77.5055, "capacity_litres":  10_000_000, "ward": "Chikkabanavara"},
    {"name": "Doddabidrakallu GLR",           "hub_type": "glr",        "lat": 13.0540, "lng": 77.5002, "capacity_litres":  15_000_000, "ward": "Doddabidrakallu"},

    # ── North Zone ────────────────────────────────────────────────────────────
    {"name": "Sadashivanagar GLR",            "hub_type": "glr",        "lat": 13.0050, "lng": 77.5850, "capacity_litres":  30_000_000, "ward": "Sadashivanagar"},
    {"name": "RT Nagar GLR",                  "hub_type": "glr",        "lat": 13.0200, "lng": 77.5950, "capacity_litres":  25_000_000, "ward": "RT Nagar"},
    {"name": "Hebbal GLR",                    "hub_type": "glr",        "lat": 13.0358, "lng": 77.5970, "capacity_litres":  55_000_000, "ward": "Hebbal"},
    {"name": "Nagawara GLR",                  "hub_type": "glr",        "lat": 13.0440, "lng": 77.6240, "capacity_litres":  20_000_000, "ward": "Nagawara"},
    {"name": "Byatarayanapura GLR",           "hub_type": "glr",        "lat": 13.0590, "lng": 77.5680, "capacity_litres":  20_000_000, "ward": "Byatarayanapura"},
    {"name": "Sanjaynagar GLR",               "hub_type": "glr",        "lat": 13.0180, "lng": 77.6150, "capacity_litres":  20_000_000, "ward": "Sanjaynagar"},
    {"name": "Anand Nagar GLR",               "hub_type": "glr",        "lat": 13.0300, "lng": 77.6050, "capacity_litres":  15_000_000, "ward": "Anand Nagar"},
    {"name": "Jakkur GLR",                    "hub_type": "glr",        "lat": 13.0700, "lng": 77.6082, "capacity_litres":  20_000_000, "ward": "Jakkur"},
    {"name": "Yelahanka GLR",                 "hub_type": "glr",        "lat": 13.1005, "lng": 77.5963, "capacity_litres":  25_000_000, "ward": "Yelahanka"},
    {"name": "Chokkanahalli GLR",             "hub_type": "glr_stage5", "lat": 13.1130, "lng": 77.6070, "capacity_litres":  80_000_000, "ward": "Chokkanahalli"},
    {"name": "Yellemallappa Chetty Kere GLR", "hub_type": "glr",        "lat": 13.0380, "lng": 77.6200, "capacity_litres":  10_000_000, "ward": "Hebbal"},

    # ── North-East Zone ───────────────────────────────────────────────────────
    {"name": "Hennur GLR",                    "hub_type": "glr",        "lat": 13.0480, "lng": 77.6450, "capacity_litres":  20_000_000, "ward": "Hennur"},
    {"name": "Horamavu GLR",                  "hub_type": "glr",        "lat": 13.0180, "lng": 77.6560, "capacity_litres":  20_000_000, "ward": "Horamavu"},
    {"name": "Ramamurthy Nagar GLR",          "hub_type": "glr",        "lat": 13.0000, "lng": 77.6650, "capacity_litres":  15_000_000, "ward": "Ramamurthy Nagar"},

    # ── Central Zone ──────────────────────────────────────────────────────────
    {"name": "Benson Town Cox Town GLR",      "hub_type": "glr",        "lat": 13.0000, "lng": 77.6100, "capacity_litres":  15_000_000, "ward": "Benson Town"},
    {"name": "Frazer Town GLR",               "hub_type": "glr",        "lat": 12.9900, "lng": 77.6200, "capacity_litres":  15_000_000, "ward": "Frazer Town"},
    {"name": "Shivajinagar GLR",              "hub_type": "glr",        "lat": 12.9840, "lng": 77.5990, "capacity_litres":  20_000_000, "ward": "Shivajinagar"},
    {"name": "Cubbon Park GLR",               "hub_type": "glr",        "lat": 12.9763, "lng": 77.5929, "capacity_litres":  10_000_000, "ward": "Cubbon Park"},
    {"name": "Shantinagar Richmond Town GLR", "hub_type": "glr",        "lat": 12.9590, "lng": 77.6050, "capacity_litres":  15_000_000, "ward": "Shantinagar"},
    {"name": "Ulsoor GLR",                    "hub_type": "glr",        "lat": 12.9820, "lng": 77.6210, "capacity_litres":  15_000_000, "ward": "Ulsoor"},

    # ── East Zone ─────────────────────────────────────────────────────────────
    {"name": "Indiranagar GLR",               "hub_type": "glr",        "lat": 12.9783, "lng": 77.6408, "capacity_litres":  30_000_000, "ward": "Indiranagar"},
    {"name": "HAL Airport Road GLR",          "hub_type": "glr",        "lat": 12.9680, "lng": 77.6610, "capacity_litres":  20_000_000, "ward": "HAL"},
    {"name": "KR Puram GLR",                  "hub_type": "glr",        "lat": 13.0060, "lng": 77.6940, "capacity_litres":  25_000_000, "ward": "KR Puram"},
    {"name": "Whitefield Core GLR",           "hub_type": "glr",        "lat": 12.9698, "lng": 77.7500, "capacity_litres":  20_000_000, "ward": "Whitefield"},
    {"name": "Marathahalli GLR",              "hub_type": "glr",        "lat": 12.9560, "lng": 77.6970, "capacity_litres":  15_000_000, "ward": "Marathahalli"},
    {"name": "Kadabeesanahalli GLR",          "hub_type": "glr",        "lat": 12.9440, "lng": 77.7110, "capacity_litres":  25_000_000, "ward": "Kadabeesanahalli"},
    {"name": "Varthur GLR",                   "hub_type": "glr",        "lat": 12.9388, "lng": 77.7430, "capacity_litres":  15_000_000, "ward": "Varthur"},
    {"name": "Kadugodi Main GLR",             "hub_type": "glr_stage5", "lat": 12.9940, "lng": 77.7720, "capacity_litres":  89_000_000, "ward": "Kadugodi"},
    {"name": "Kadugodi Singapura GLR",        "hub_type": "glr_stage5", "lat": 12.9820, "lng": 77.7680, "capacity_litres": 120_000_000, "ward": "Singapura"},

    # ── South-East Zone ───────────────────────────────────────────────────────
    {"name": "Jackasandra GLR",               "hub_type": "glr",        "lat": 12.9500, "lng": 77.6380, "capacity_litres":  30_000_000, "ward": "Koramangala"},
    {"name": "Koramangala GLR",               "hub_type": "glr",        "lat": 12.9352, "lng": 77.6245, "capacity_litres":  30_000_000, "ward": "Koramangala"},
    {"name": "Adugodi GLR",                   "hub_type": "glr",        "lat": 12.9460, "lng": 77.6170, "capacity_litres":  15_000_000, "ward": "Adugodi"},
    {"name": "HSR Layout GLR",                "hub_type": "glr",        "lat": 12.9116, "lng": 77.6389, "capacity_litres":  20_000_000, "ward": "HSR Layout"},
    {"name": "Agara GLR",                     "hub_type": "glr",        "lat": 12.9070, "lng": 77.6560, "capacity_litres":  25_000_000, "ward": "Agara"},
    {"name": "Bellandur GLR",                 "hub_type": "glr",        "lat": 12.9296, "lng": 77.6847, "capacity_litres":  20_000_000, "ward": "Bellandur"},
    {"name": "Doddakanahalli GLR",            "hub_type": "glr_stage5", "lat": 12.8810, "lng": 77.7200, "capacity_litres": 100_000_000, "ward": "Sarjapur Road"},
    {"name": "Mailasandra GLR",               "hub_type": "glr",        "lat": 12.8750, "lng": 77.6280, "capacity_litres":  20_000_000, "ward": "Mailasandra"},

    # ── South Zone ────────────────────────────────────────────────────────────
    {"name": "Jayanagar GLR",                 "hub_type": "glr",        "lat": 12.9252, "lng": 77.5938, "capacity_litres":  40_000_000, "ward": "Jayanagar"},
    {"name": "Lalbagh GLR",                   "hub_type": "glr",        "lat": 12.9500, "lng": 77.5850, "capacity_litres":  10_000_000, "ward": "Basavanagudi"},
    {"name": "Basavanagudi GLR",              "hub_type": "glr",        "lat": 12.9410, "lng": 77.5750, "capacity_litres":  20_000_000, "ward": "Basavanagudi"},
    {"name": "Banashankari GLR",              "hub_type": "glr",        "lat": 12.9050, "lng": 77.5610, "capacity_litres":  25_000_000, "ward": "Banashankari"},
    {"name": "JP Nagar GLR",                  "hub_type": "glr",        "lat": 12.8990, "lng": 77.5830, "capacity_litres":  25_000_000, "ward": "JP Nagar"},
    {"name": "Kanakapura Road GLR",           "hub_type": "glr",        "lat": 12.8800, "lng": 77.5720, "capacity_litres":  20_000_000, "ward": "Kanakapura Road"},
    {"name": "Madivala GLR",                  "hub_type": "glr",        "lat": 12.9218, "lng": 77.6239, "capacity_litres":  20_000_000, "ward": "Madivala"},
    {"name": "BTM Layout GLR",                "hub_type": "glr",        "lat": 12.9160, "lng": 77.6101, "capacity_litres":  20_000_000, "ward": "BTM Layout"},
    {"name": "Hulimavu GLR",                  "hub_type": "glr",        "lat": 12.8760, "lng": 77.6020, "capacity_litres":  15_000_000, "ward": "Hulimavu"},
    {"name": "Begur GLR",                     "hub_type": "glr",        "lat": 12.8670, "lng": 77.6110, "capacity_litres":  15_000_000, "ward": "Begur"},
    {"name": "Electronic City GLR",           "hub_type": "glr",        "lat": 12.8399, "lng": 77.6770, "capacity_litres":  20_000_000, "ward": "Electronic City"},
    {"name": "Gottigere GLR",                 "hub_type": "glr_stage5", "lat": 12.8580, "lng": 77.5960, "capacity_litres":  50_000_000, "ward": "Gottigere"},
    {"name": "Vasudevapura GLR",              "hub_type": "glr_stage5", "lat": 12.8760, "lng": 77.5780, "capacity_litres": 100_000_000, "ward": "Banashankari"},

    # ── South-West Zone ───────────────────────────────────────────────────────
    {"name": "Sarakki GLR",                   "hub_type": "glr",        "lat": 12.8950, "lng": 77.5850, "capacity_litres":  15_000_000, "ward": "JP Nagar"},
    {"name": "Kengeri GLR",                   "hub_type": "glr",        "lat": 12.9130, "lng": 77.4850, "capacity_litres":  30_000_000, "ward": "Kengeri"},
    {"name": "RR Nagar GLR",                  "hub_type": "glr",        "lat": 12.9310, "lng": 77.5120, "capacity_litres":  25_000_000, "ward": "RR Nagar"},
    {"name": "Hemmigepura GLR",               "hub_type": "glr",        "lat": 12.9110, "lng": 77.4760, "capacity_litres":  15_000_000, "ward": "Hemmigepura"},
    {"name": "Doddabele GLR",                 "hub_type": "glr",        "lat": 12.8910, "lng": 77.4680, "capacity_litres":  20_000_000, "ward": "Kengeri"},
]

for h in hubs:
    existing = db.query(WaterHub).filter(WaterHub.name == h["name"]).first()
    if not existing:
        db.add(WaterHub(**h))

db.commit()
print(f"✓ {len(hubs)} BWSSB GLR water hubs seeded")

# ── Seed 150 drivers ──────────────────────────────────────────────────────────
# Karnataka/South India driver names across all communities

drivers = [
    # Batch 1 (1–25)
    {"name": "Raju Kumar",          "phone": "9880001111"},
    {"name": "Suresh Gowda",        "phone": "9880002222"},
    {"name": "Prakash Naik",        "phone": "9880003333"},
    {"name": "Mohan Reddy",         "phone": "9880004444"},
    {"name": "Anand Sharma",        "phone": "9880005555"},
    {"name": "Venkatesh Murthy",    "phone": "9880006666"},
    {"name": "Ramesh Hegde",        "phone": "9880007777"},
    {"name": "Kiran Kumar",         "phone": "9880008888"},
    {"name": "Arun Nayak",          "phone": "9880009999"},
    {"name": "Srinivas Rao",        "phone": "9880010000"},
    {"name": "Manoj Kamath",        "phone": "9880011111"},
    {"name": "Deepak Shetty",       "phone": "9880012222"},
    {"name": "Vinod Pai",           "phone": "9880013333"},
    {"name": "Santosh Kulkarni",    "phone": "9880014444"},
    {"name": "Nagesh Bhat",         "phone": "9880015555"},
    {"name": "Gopal Krishnamurthy", "phone": "9880016666"},
    {"name": "Harish Gowda",        "phone": "9880017777"},
    {"name": "Pradeep Menon",       "phone": "9880018888"},
    {"name": "Rajesh Nair",         "phone": "9880019999"},
    {"name": "Sunil Varma",         "phone": "9880020000"},
    {"name": "Naveen Swamy",        "phone": "9880021111"},
    {"name": "Ashok Babu",          "phone": "9880022222"},
    {"name": "Dinesh Kumar",        "phone": "9880023333"},
    {"name": "Mahesh Pillai",       "phone": "9880024444"},
    {"name": "Lokesh Naidu",        "phone": "9880025555"},
    # Batch 2 (26–50)
    {"name": "Chetan Gowda",        "phone": "9880026666"},
    {"name": "Praveen Shetty",      "phone": "9880027777"},
    {"name": "Manju Naik",          "phone": "9880028888"},
    {"name": "Girish Rao",          "phone": "9880029999"},
    {"name": "Bhaskar Reddy",       "phone": "9880030000"},
    {"name": "Krishnamurthy B",     "phone": "9880031111"},
    {"name": "Shivakumar M",        "phone": "9880032222"},
    {"name": "Madhu Swamy",         "phone": "9880033333"},
    {"name": "Ravi Shankar",        "phone": "9880034444"},
    {"name": "Umesh Hegde",         "phone": "9880035555"},
    {"name": "Prasad Kamath",       "phone": "9880036666"},
    {"name": "Nagaraj Shetty",      "phone": "9880037777"},
    {"name": "Sajjan Kumar",        "phone": "9880038888"},
    {"name": "Ganesh Nayak",        "phone": "9880039999"},
    {"name": "Sathish Kumar",       "phone": "9880040000"},
    {"name": "Vikas Gowda",         "phone": "9880041111"},
    {"name": "Surya Narayan",       "phone": "9880042222"},
    {"name": "Ajay Kulkarni",       "phone": "9880043333"},
    {"name": "Pavan Kumar",         "phone": "9880044444"},
    {"name": "Sudhir Rao",          "phone": "9880045555"},
    {"name": "Thimme Gowda",        "phone": "9880046666"},
    {"name": "Basavaraj Patil",     "phone": "9880047777"},
    {"name": "Manjunath P",         "phone": "9880048888"},
    {"name": "Paramesh Kumar",      "phone": "9880049999"},
    {"name": "Chandrashekar M",     "phone": "9880050000"},
    # Batch 3 (51–75)
    {"name": "Shrinivas Bhat",      "phone": "9880051111"},
    {"name": "Veeresh Naik",        "phone": "9880052222"},
    {"name": "Lakshmikant Rao",     "phone": "9880053333"},
    {"name": "Ramakrishna S",       "phone": "9880054444"},
    {"name": "Narayanaswamy K",     "phone": "9880055555"},
    {"name": "Prakash Hegde",       "phone": "9880056666"},
    {"name": "Somashekar R",        "phone": "9880057777"},
    {"name": "Jagadeesh Kumar",     "phone": "9880058888"},
    {"name": "Krishnappa M",        "phone": "9880059999"},
    {"name": "Venkataramaiah T",    "phone": "9880060000"},
    {"name": "Ravindra Gowda",      "phone": "9880061111"},
    {"name": "Subramanya Swamy",    "phone": "9880062222"},
    {"name": "Hanumantha Rao",      "phone": "9880063333"},
    {"name": "Devaraj Naik",        "phone": "9880064444"},
    {"name": "Rajashekhar B",       "phone": "9880065555"},
    {"name": "Madhusudan Rao",      "phone": "9880066666"},
    {"name": "Guruprasad K",        "phone": "9880067777"},
    {"name": "Shankara Murthy",     "phone": "9880068888"},
    {"name": "Virupaksha Gowda",    "phone": "9880069999"},
    {"name": "Nanjunda Swamy",      "phone": "9880070000"},
    {"name": "Subbaiah Reddy",      "phone": "9880071111"},
    {"name": "Obaiah Kumar",        "phone": "9880072222"},
    {"name": "Mahadeva Shetty",     "phone": "9880073333"},
    {"name": "Shivananda P",        "phone": "9880074444"},
    {"name": "Gavisiddappa R",      "phone": "9880075555"},
    # Batch 4 (76–100)
    {"name": "Gururaj Hegde",       "phone": "9880076666"},
    {"name": "Palaiah Kumar",       "phone": "9880077777"},
    {"name": "Siddaramaiah N",      "phone": "9880078888"},
    {"name": "Annappa Naik",        "phone": "9880079999"},
    {"name": "Puttalingaiah S",     "phone": "9880080000"},
    {"name": "Fakruddin Khan",      "phone": "9880081111"},
    {"name": "Mohammed Imran",      "phone": "9880082222"},
    {"name": "Afzal Ahmed",         "phone": "9880083333"},
    {"name": "Salim Pasha",         "phone": "9880084444"},
    {"name": "Basheer Ahmed",       "phone": "9880085555"},
    {"name": "David Rajan",         "phone": "9880086666"},
    {"name": "Johnson Kumar",       "phone": "9880087777"},
    {"name": "Samuel Raj",          "phone": "9880088888"},
    {"name": "Anthony Swamy",       "phone": "9880089999"},
    {"name": "Thomas Joseph",       "phone": "9880090000"},
    {"name": "Rajkumar Pawar",      "phone": "9880091111"},
    {"name": "Yallappa Gowda",      "phone": "9880092222"},
    {"name": "Mallappa Naik",       "phone": "9880093333"},
    {"name": "Shiddappa Reddy",     "phone": "9880094444"},
    {"name": "Eranna Gowda",        "phone": "9880095555"},
    {"name": "Thippeswamy K",       "phone": "9880096666"},
    {"name": "Siddalingappa R",     "phone": "9880097777"},
    {"name": "Channappa Shetty",    "phone": "9880098888"},
    {"name": "Byrappa Kumar",       "phone": "9880099999"},
    {"name": "Honnaiah Gowda",      "phone": "9880100000"},
    # Batch 5 (101–125)
    {"name": "Kumaraswamy R",       "phone": "9880101111"},
    {"name": "Boraiah Naik",        "phone": "9880102222"},
    {"name": "Halappa Gowda",       "phone": "9880103333"},
    {"name": "Kemparaju S",         "phone": "9880104444"},
    {"name": "Nagappa Kumar",       "phone": "9880105555"},
    {"name": "Puttappa Hegde",      "phone": "9880106666"},
    {"name": "Rangaswamy N",        "phone": "9880107777"},
    {"name": "Doreswamy K",         "phone": "9880108888"},
    {"name": "Lingappa Shetty",     "phone": "9880109999"},
    {"name": "Muddu Gowda",         "phone": "9880110000"},
    {"name": "Muthaiah Pillai",     "phone": "9880111111"},
    {"name": "Selvam Kumar",        "phone": "9880112222"},
    {"name": "Murugan K",           "phone": "9880113333"},
    {"name": "Kannan Nair",         "phone": "9880114444"},
    {"name": "Balasubramanian R",   "phone": "9880115555"},
    {"name": "Arumugam S",          "phone": "9880116666"},
    {"name": "Velmurugan P",        "phone": "9880117777"},
    {"name": "Shanmugam K",         "phone": "9880118888"},
    {"name": "Pandian R",           "phone": "9880119999"},
    {"name": "Raman Nair",          "phone": "9880120000"},
    {"name": "Anil Kumar Yadav",    "phone": "9880121111"},
    {"name": "Ramesh Prasad",       "phone": "9880122222"},
    {"name": "Suresh Chauhan",      "phone": "9880123333"},
    {"name": "Vijay Singh",         "phone": "9880124444"},
    {"name": "Rakesh Tiwari",       "phone": "9880125555"},
    # Batch 6 (126–150)
    {"name": "Pawan Kumar",         "phone": "9880126666"},
    {"name": "Amit Verma",          "phone": "9880127777"},
    {"name": "Sanjay Mishra",       "phone": "9880128888"},
    {"name": "Rajiv Pandey",        "phone": "9880129999"},
    {"name": "Abhishek Singh",      "phone": "9880130000"},
    {"name": "Naresh Gowda",        "phone": "9880131111"},
    {"name": "Santosh Reddy",       "phone": "9880132222"},
    {"name": "Shivaraj Kumar",      "phone": "9880133333"},
    {"name": "Dayanand Murthy",     "phone": "9880134444"},
    {"name": "Prabhakar Rao",       "phone": "9880135555"},
    {"name": "Venkatesh Babu",      "phone": "9880136666"},
    {"name": "Suresh Rao",          "phone": "9880137777"},
    {"name": "Raghu Nandan",        "phone": "9880138888"},
    {"name": "Karthik Swamy",       "phone": "9880139999"},
    {"name": "Pratap Naik",         "phone": "9880140000"},
    {"name": "Gagan Gowda",         "phone": "9880141111"},
    {"name": "Nitin Shetty",        "phone": "9880142222"},
    {"name": "Roshan Kumar",        "phone": "9880143333"},
    {"name": "Tejas Naidu",         "phone": "9880144444"},
    {"name": "Akash Reddy",         "phone": "9880145555"},
    {"name": "Darshan Gowda",       "phone": "9880146666"},
    {"name": "Vishal Rao",          "phone": "9880147777"},
    {"name": "Arjun Kumar",         "phone": "9880148888"},
    {"name": "Yashwanth Hegde",     "phone": "9880149999"},
    {"name": "Chethan Murthy",      "phone": "9880150000"},
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

from seed_history import seed_historical_data
from seed_users import seed_users

n_hist = seed_historical_data(db)
print(f"✓ {n_hist} historical demand records seeded (or skipped if present)")

seed_users(db)

# Assign drivers to hubs (round-robin)
all_hubs = db.query(WaterHub).order_by(WaterHub.id).all()
all_drivers = db.query(Driver).order_by(Driver.id).all()
for i, d in enumerate(all_drivers):
    if not d.hub_id and all_hubs:
        d.hub_id = all_hubs[i % len(all_hubs)].id
db.commit()
print(f"✓ Drivers linked to hubs")

print("\nDone! Now run: uvicorn main:app --reload")
print(f"Login: citizen/citizen123  driver/driver123  admin/admin123")
print(f"Then: POST http://localhost:8000/optimize/{today}")
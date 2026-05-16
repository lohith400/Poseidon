"""Demo JWT users — run from seed.py."""
from auth import hash_password
from models import Driver, User


def seed_users(db) -> None:
    demos = [
        {
            "username": "citizen",
            "password": "citizen123",
            "role": "citizen",
            "display_name": "Demo Citizen",
        },
        {
            "username": "admin",
            "password": "admin123",
            "role": "admin",
            "display_name": "BWSSB Admin",
        },
    ]

    first_driver = db.query(Driver).first()
    if first_driver:
        demos.append({
            "username": "driver",
            "password": "driver123",
            "role": "driver",
            "display_name": first_driver.name,
            "driver_id": first_driver.id,
        })

    for d in demos:
        existing = db.query(User).filter(User.username == d["username"]).first()
        if existing:
            existing.password_hash = hash_password(d["password"])
            existing.role = d["role"]
            existing.display_name = d.get("display_name")
            if d.get("driver_id"):
                existing.driver_id = d["driver_id"]
        else:
            db.add(
                User(
                    username=d["username"],
                    password_hash=hash_password(d["password"]),
                    role=d["role"],
                    display_name=d.get("display_name"),
                    driver_id=d.get("driver_id"),
                )
            )
    db.commit()
    print(f"✓ {len(demos)} API users seeded (citizen / driver / admin)")

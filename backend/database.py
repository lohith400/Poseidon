from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == column for r in rows)


def migrate_schema() -> None:
    """Add new columns on existing SQLite DBs without full reset."""
    if not DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
        return

    migrations = [
        ("water_hubs", "current_fill_litres", "INTEGER DEFAULT 0"),
        ("water_hubs", "reserved_litres", "INTEGER DEFAULT 0"),
        ("drivers", "hub_id", "INTEGER"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in migrations:
            if not _sqlite_column_exists(conn, table, col):
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
        conn.commit()
    Base.metadata.create_all(bind=engine)

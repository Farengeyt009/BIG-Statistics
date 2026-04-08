"""
Centralized configuration for all migration scripts.
Credentials are read from environment variables (.env file at project root),
with fallback to the original values from 1С_migration_project.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).resolve().parents[2] / '.env'
    if _env_file.exists():
        load_dotenv(_env_file)
except ImportError:
    pass

# ── 1C ERP source database ───────────────────────────────────────────────────
db_config_1c = {
    "driver":   os.getenv("DB_1C_DRIVER",   "{ODBC Driver 18 for SQL Server}"),
    "server":   os.getenv("DB_1C_SERVER",   "FSBIG-DB1.big.local"),
    "database": os.getenv("DB_1C_DATABASE", "ERPUH_BIG_PROD"),
    "username": os.getenv("DB_1C_USERNAME", "pmc_read"),
    "password": os.getenv("DB_1C_PASSWORD", "pmc_read"),
}

# ── Target (WeChat_APP) database ─────────────────────────────────────────────
db_config_target = {
    "driver":   os.getenv("DB_TARGET_DRIVER",   "{ODBC Driver 18 for SQL Server}"),
    "server":   os.getenv("DB_TARGET_SERVER",   "192.168.110.105"),
    "database": os.getenv("DB_TARGET_DATABASE", "WeChat_APP"),
    "username": os.getenv("DB_TARGET_USERNAME", "pmc"),
    "password": os.getenv("DB_TARGET_PASSWORD", "pmc"),
}

# ── SKUD (HYHRV3) source database ─────────────────────────────────────────────
db_config_skud = {
    "driver":   os.getenv("DB_SKUD_DRIVER",   "{ODBC Driver 18 for SQL Server}"),
    "server":   os.getenv("DB_SKUD_SERVER",   "192.168.110.12,49703"),
    "database": os.getenv("DB_SKUD_DATABASE", "HYHRV3"),
    "username": os.getenv("DB_SKUD_USERNAME", "pmc_read"),
    "password": os.getenv("DB_SKUD_PASSWORD", "12121228"),
}

# ── MES (LightMES API) credentials ───────────────────────────────────────────
MES_ACCESS_KEY_ID     = os.getenv("MES_ACCESS_KEY_ID",     "B3EE6EA2425E0D7464CDCB4E6431727F")
MES_ACCESS_KEY_SECRET = os.getenv("MES_ACCESS_KEY_SECRET", "4D691E855B63D0557DEEFA8F22E60981")

# ── SQLAlchemy connection string for pandas / to_sql ─────────────────────────
TARGET_SQLALCHEMY_URL = (
    "mssql+pyodbc://{username}:{password}@{server}/{database}"
    "?driver=ODBC+Driver+17+for+SQL+Server&connect_timeout=30&charset=UTF8"
).format(**db_config_target)

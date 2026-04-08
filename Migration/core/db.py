"""
Shared database connection helpers for all migration scripts.
"""
import pyodbc
from core.config import db_config_1c, db_config_target, db_config_skud


def _build_conn_str(cfg: dict) -> str:
    return (
        f"DRIVER={cfg['driver']};"
        f"SERVER={cfg['server']};"
        f"DATABASE={cfg['database']};"
        f"UID={cfg['username']};"
        f"PWD={cfg['password']};"
        "Encrypt=no;TrustServerCertificate=yes;"
    )


def get_1c_connection() -> pyodbc.Connection:
    """Return a connection to the 1C ERP source database."""
    return pyodbc.connect(_build_conn_str(db_config_1c))


def get_target_connection() -> pyodbc.Connection:
    """Return a connection to the target (WeChat_APP) database."""
    return pyodbc.connect(_build_conn_str(db_config_target))


def get_skud_connection() -> pyodbc.Connection:
    """Return a connection to the SKUD source database."""
    return pyodbc.connect(_build_conn_str(db_config_skud))


# Backwards-compat alias used by helper functions inside modules
def get_connection(config: dict) -> pyodbc.Connection:
    return pyodbc.connect(_build_conn_str(config))

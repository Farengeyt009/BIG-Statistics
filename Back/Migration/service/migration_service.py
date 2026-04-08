"""
Migration service — reads status from Migration.ScriptStatus table
and provides restart/control functionality.
"""
import traceback
import pyodbc
import os
import sys
from pathlib import Path
from datetime import datetime

# Add Migration root to path so we can read scripts_config
_MIGRATION_ROOT = Path(__file__).resolve().parents[3] / "Migration"
if str(_MIGRATION_ROOT) not in sys.path:
    sys.path.insert(0, str(_MIGRATION_ROOT))


def _get_conn():
    """Return a pyodbc connection to the target DB using the migration config."""
    try:
        from core.config import db_config_target
        cfg = db_config_target
    except ImportError:
        # Fallback if running outside migration context
        cfg = {
            "driver":   "{ODBC Driver 18 for SQL Server}",
            "server":   os.getenv("DB_TARGET_SERVER",   "192.168.110.105"),
            "database": os.getenv("DB_TARGET_DATABASE", "WeChat_APP"),
            "username": os.getenv("DB_TARGET_USERNAME", "pmc"),
            "password": os.getenv("DB_TARGET_PASSWORD", "pmc"),
        }
    conn_str = (
        f"DRIVER={cfg['driver']};"
        f"SERVER={cfg['server']};"
        f"DATABASE={cfg['database']};"
        f"UID={cfg['username']};"
        f"PWD={cfg['password']};"
        "Encrypt=no;TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)


def get_all_statuses() -> list[dict]:
    """
    Return list of script statuses from Migration.ScriptStatus,
    merged with the manifest in scripts_config.py so that scripts
    not yet run also appear (with status 'never_run').
    """
    # Load manifest
    manifest: list[dict] = []
    try:
        from scripts_config import SCRIPTS
        manifest = SCRIPTS
    except Exception:
        pass

    # Load DB rows
    db_rows: dict[str, dict] = {}
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT
                ScriptID, ScriptName, Category, IntervalSeconds,
                Status, Pid,
                LastStart, LastSuccess, LastError,
                ErrorMessage, RecordsProcessed, CycleCount, UpdatedAt
            FROM Migration.ScriptStatus
        """)
        for row in cur.fetchall():
            sid = row[0]
            db_rows[sid] = {
                "script_id":         row[0],
                "script_name":       row[1],
                "category":          row[2],
                "interval_seconds":  row[3],
                "status":            row[4],
                "pid":               row[5],
                "last_start":        _fmt(row[6]),
                "last_success":      _fmt(row[7]),
                "last_error":        _fmt(row[8]),
                "error_message":     row[9],
                "records_processed": row[10],
                "cycle_count":       row[11],
                "updated_at":        _fmt(row[12]),
            }
        cur.close()
        conn.close()
    except Exception:
        pass

    # Merge: manifest order first, then any extra DB rows
    seen: set[str] = set()
    result: list[dict] = []

    for s in manifest:
        sid = s["id"]
        seen.add(sid)
        if sid in db_rows:
            result.append(db_rows[sid])
        else:
            result.append({
                "script_id":         sid,
                "script_name":       s.get("name", sid),
                "category":          s.get("category", "continuous"),
                "interval_seconds":  s.get("interval_seconds"),
                "status":            "never_run",
                "pid":               None,
                "last_start":        None,
                "last_success":      None,
                "last_error":        None,
                "error_message":     None,
                "records_processed": None,
                "cycle_count":       0,
                "updated_at":        None,
            })

    # Any DB rows not in manifest
    for sid, row in db_rows.items():
        if sid not in seen:
            result.append(row)

    return result


def get_script_logs(script_id: str, lines: int = 100) -> list[str]:
    """Return the last N lines from the script's log file."""
    log_path = _MIGRATION_ROOT / "logs" / f"{script_id}.log"
    if not log_path.exists():
        return [f"Log file not found: {log_path}"]
    try:
        with open(log_path, encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        return [l.rstrip() for l in all_lines[-lines:]]
    except Exception as e:
        return [f"Error reading log: {e}"]


def _set_command(script_id: str, command: str) -> dict:
    """Generic helper: write a command flag into Migration.ScriptStatus."""
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(
            """
            UPDATE Migration.ScriptStatus
            SET Status = ?, UpdatedAt = GETDATE()
            WHERE ScriptID = ?
            """,
            (command, script_id),
        )
        affected = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        if affected == 0:
            return {"success": False, "error": f"Script '{script_id}' not found in ScriptStatus table"}
        return {"success": True, "message": f"{command} requested for {script_id}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def request_restart(script_id: str) -> dict:
    """Mark script for restart — runner will kill + restart the process."""
    return _set_command(script_id, "restart_requested")


def request_stop(script_id: str) -> dict:
    """Mark script for stop — runner will kill the process."""
    return _set_command(script_id, "stop_requested")


def request_run_now(script_id: str) -> dict:
    """
    Trigger an immediate run for a scheduled script.
    Runner/scheduler will pick this up and launch the script once.
    """
    return _set_command(script_id, "run_now_requested")


def _fmt(dt) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)

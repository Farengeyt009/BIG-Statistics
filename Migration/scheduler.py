"""
scheduler.py — Cron-like scheduler for one-shot / periodic migration scripts.

Reads SCRIPTS from scripts_config.py where category == "scheduled",
uses the `schedule` library to fire each script at the configured time.

Also polls Migration.ScriptStatus every COMMAND_POLL_INTERVAL seconds for:
  - run_now_requested → trigger the script immediately
  - stop_requested    → mark the script as stopped (no process to kill for scheduler)

Supported schedule_type values:
  "daily"    — every day at HH:MM
  "weekly"   — every <weekday> at HH:MM
  "monthly"  — day <day> of each month at HH:MM

Usage:
    python scheduler.py
"""

import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from datetime import datetime

import schedule

MIGRATION_ROOT        = Path(__file__).parent
COMMAND_POLL_INTERVAL = 15  # seconds between DB command checks

(MIGRATION_ROOT / "logs").mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCHEDULER] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(MIGRATION_ROOT / "logs" / "scheduler.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("scheduler")


def _get_conn():
    sys.path.insert(0, str(MIGRATION_ROOT))
    from core.db import get_target_connection
    return get_target_connection()


def _update_status(script_id: str, status: str) -> None:
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE Migration.ScriptStatus SET Status = ?, UpdatedAt = GETDATE() WHERE ScriptID = ?",
            (status, script_id),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning(f"[{script_id}] DB status update failed: {e}")


def _run_script(script_id: str, script_path: Path) -> None:
    """Fire a scheduled script as a subprocess and wait for completion."""
    logger.info(f"[{script_id}] Running…")
    env = {**os.environ, "PYTHONPATH": str(MIGRATION_ROOT)}
    try:
        result = subprocess.run(
            [sys.executable, "-u", str(script_path)],
            cwd=str(MIGRATION_ROOT),
            env=env,
            timeout=7200,  # 2-hour hard timeout
        )
        if result.returncode == 0:
            logger.info(f"[{script_id}] Completed OK")
        else:
            logger.error(f"[{script_id}] Exited with code {result.returncode}")
    except subprocess.TimeoutExpired:
        logger.error(f"[{script_id}] Timed out after 2 h")
    except Exception as e:
        logger.error(f"[{script_id}] Error: {e}")


def _make_job(script_id: str, script_path: Path):
    """Return a job function that runs the script in a background thread."""
    def job():
        t = threading.Thread(
            target=_run_script, args=(script_id, script_path), daemon=True
        )
        t.start()
    return job


def _monthly_job(script_id: str, script_path: Path, day: int):
    """Wrapper that only executes on the configured day of the month."""
    inner = _make_job(script_id, script_path)
    def job():
        if datetime.now().day == day:
            logger.info(f"[{script_id}] Monthly trigger — day {day}")
            inner()
    return job


def _poll_commands(script_map: dict) -> None:
    """
    Check Migration.ScriptStatus for run_now_requested / stop_requested commands.
    `script_map` is dict of script_id → Path.
    """
    try:
        conn = _get_conn()
        cur = conn.cursor()
        ids = list(script_map.keys())
        placeholders = ",".join("?" * len(ids))
        cur.execute(
            f"""
            SELECT ScriptID, Status
            FROM Migration.ScriptStatus
            WHERE ScriptID IN ({placeholders})
              AND Status IN ('run_now_requested', 'stop_requested')
            """,
            ids,
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        for row in rows:
            script_id, command = row[0], row[1]
            path = script_map.get(script_id)
            if path is None:
                continue

            if command == "run_now_requested":
                logger.info(f"[{script_id}] Run-now requested via admin panel")
                _update_status(script_id, "running")
                job = _make_job(script_id, path)
                job()

            elif command == "stop_requested":
                # Scheduler scripts are not long-running processes between runs,
                # so "stop" simply marks them as stopped in DB (skips next scheduled run).
                logger.info(f"[{script_id}] Stop requested via admin panel — marking stopped")
                _update_status(script_id, "stopped")

    except Exception as e:
        logger.warning(f"Command poll failed: {e}")


def main() -> None:
    from scripts_config import SCRIPTS

    scheduled = [s for s in SCRIPTS if s.get("category") == "scheduled"]
    if not scheduled:
        logger.warning("No scheduled scripts found in scripts_config.py")
        return

    script_map: dict[str, Path] = {}

    for cfg in scheduled:
        sid   = cfg["id"]
        path  = MIGRATION_ROOT / cfg["script"]
        stype = cfg.get("schedule_type", "daily")
        t     = cfg.get("time", "02:00")

        script_map[sid] = path

        if stype == "daily":
            schedule.every().day.at(t).do(_make_job(sid, path))
            logger.info(f"[{sid}] Scheduled daily at {t}")

        elif stype == "weekly":
            weekday = cfg.get("weekday", "sunday")
            getattr(schedule.every(), weekday).at(t).do(_make_job(sid, path))
            logger.info(f"[{sid}] Scheduled weekly on {weekday} at {t}")

        elif stype == "monthly":
            day = cfg.get("day", 1)
            schedule.every().day.at(t).do(_monthly_job(sid, path, day))
            logger.info(f"[{sid}] Scheduled monthly on day {day} at {t}")

        else:
            logger.warning(f"[{sid}] Unknown schedule_type='{stype}' — skipping")

    logger.info(f"Scheduler started — {len(scheduled)} job(s) registered")

    last_poll = 0.0
    try:
        while True:
            schedule.run_pending()
            now = time.monotonic()
            if now - last_poll >= COMMAND_POLL_INTERVAL:
                _poll_commands(script_map)
                last_poll = now
            time.sleep(5)
    except KeyboardInterrupt:
        logger.info("Scheduler stopped")


if __name__ == "__main__":
    main()

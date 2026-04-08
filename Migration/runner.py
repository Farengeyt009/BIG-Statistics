"""
runner.py — Process supervisor for continuous migration scripts.

Reads SCRIPTS from scripts_config.py where category == "continuous",
launches each as a subprocess, and auto-restarts on failure with
exponential back-off (30 s → 60 s → … up to 300 s).

Every COMMAND_POLL_INTERVAL seconds the main loop checks
Migration.ScriptStatus for pending commands:
  - restart_requested → kill + restart the process
  - stop_requested    → kill the process, set status = 'stopped'
  - run_now_requested → ignored by runner (handled by scheduler)

Usage:
    python runner.py
"""

import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

MIGRATION_ROOT = Path(__file__).parent
BASE_BACKOFF        = 30
MAX_BACKOFF         = 300
COMMAND_POLL_INTERVAL = 10   # seconds between DB command checks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [RUNNER] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(MIGRATION_ROOT / "logs" / "runner.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("runner")


def _get_conn():
    """Return a pyodbc connection to the target DB (for command polling)."""
    sys.path.insert(0, str(MIGRATION_ROOT))
    from core.db import get_target_connection
    return get_target_connection()


def _poll_commands(managed: dict) -> None:
    """
    Check Migration.ScriptStatus for command flags and act on them.
    `managed` is a dict of script_id → ManagedProcess.
    """
    try:
        conn = _get_conn()
        cur = conn.cursor()
        ids = list(managed.keys())
        placeholders = ",".join("?" * len(ids))
        cur.execute(
            f"""
            SELECT ScriptID, Status
            FROM Migration.ScriptStatus
            WHERE ScriptID IN ({placeholders})
              AND Status IN ('restart_requested', 'stop_requested')
            """,
            ids,
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        for row in rows:
            script_id, command = row[0], row[1]
            mp = managed.get(script_id)
            if mp is None:
                continue

            if command == "restart_requested":
                logger.info(f"[{script_id}] Restart requested via admin panel")
                mp.restart()
            elif command == "stop_requested":
                logger.info(f"[{script_id}] Stop requested via admin panel")
                mp.stop_permanently()

    except Exception as e:
        logger.warning(f"Command poll failed: {e}")


class ManagedProcess:
    def __init__(self, config: dict):
        self.script_id   = config["id"]
        self.name        = config.get("name", config["id"])
        self.script_path = MIGRATION_ROOT / config["script"]
        self.process: subprocess.Popen | None = None
        self.backoff     = BASE_BACKOFF
        self._stop_event = threading.Event()
        self._permanently_stopped = False

    def _launch(self) -> None:
        env = {**os.environ, "PYTHONPATH": str(MIGRATION_ROOT)}
        self.process = subprocess.Popen(
            [sys.executable, "-u", str(self.script_path)],
            cwd=str(MIGRATION_ROOT),
            env=env,
        )
        logger.info(f"[{self.script_id}] Started — PID={self.process.pid}")

    def start(self) -> None:
        self._permanently_stopped = False
        self._stop_event.clear()
        self._launch()

    def _kill(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()

    def restart(self) -> None:
        """Kill + relaunch; reset backoff. Called by command poller."""
        self._kill()
        self.backoff = BASE_BACKOFF
        self._permanently_stopped = False
        self._launch()
        self._update_status("running")

    def stop_permanently(self) -> None:
        """Kill and mark as stopped — no automatic restart."""
        self._permanently_stopped = True
        self._stop_event.set()
        self._kill()
        logger.info(f"[{self.script_id}] Stopped permanently")
        self._update_status("stopped")

    def _update_status(self, status: str) -> None:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE Migration.ScriptStatus
                SET Status = ?, UpdatedAt = GETDATE()
                WHERE ScriptID = ?
                """,
                (status, self.script_id),
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            logger.warning(f"[{self.script_id}] Failed to update status in DB: {e}")

    def monitor(self) -> None:
        """Runs in a dedicated thread — auto-restarts process if it dies unexpectedly."""
        while not self._stop_event.is_set():
            if self._permanently_stopped:
                time.sleep(5)
                continue
            if self.process and self.process.poll() is not None:
                code = self.process.returncode
                logger.warning(
                    f"[{self.script_id}] Exited (code={code}). "
                    f"Restarting in {self.backoff}s…"
                )
                for _ in range(int(self.backoff)):
                    if self._stop_event.is_set() or self._permanently_stopped:
                        return
                    time.sleep(1)
                if not self._stop_event.is_set() and not self._permanently_stopped:
                    self._launch()
                    self.backoff = min(self.backoff * 2, MAX_BACKOFF)
            time.sleep(5)


def main() -> None:
    (MIGRATION_ROOT / "logs").mkdir(exist_ok=True)

    from scripts_config import SCRIPTS

    continuous = [s for s in SCRIPTS if s.get("category") == "continuous"]
    if not continuous:
        logger.warning("No continuous scripts found in scripts_config.py")
        return

    managed: dict[str, ManagedProcess] = {}
    threads: list[threading.Thread] = []

    for cfg in continuous:
        mp = ManagedProcess(cfg)
        mp.start()
        managed[cfg["id"]] = mp

        t = threading.Thread(target=mp.monitor, daemon=True, name=f"monitor-{cfg['id']}")
        t.start()
        threads.append(t)

    logger.info(f"Runner started — supervising {len(managed)} scripts")

    last_poll = 0.0
    try:
        while True:
            now = time.monotonic()
            if now - last_poll >= COMMAND_POLL_INTERVAL:
                _poll_commands(managed)
                last_poll = now
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Runner stopping…")
        for mp in managed.values():
            mp._kill()
        logger.info("Runner stopped")


if __name__ == "__main__":
    main()

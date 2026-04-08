"""
BaseMigration — base class for all migration scripts.

Usage in each module's copy_script.py:

    from core.base import BaseMigration

    class MyScript(BaseMigration):
        script_id       = "my_script"
        script_name     = "My Script Description"
        interval_seconds = 60
        category        = "continuous"   # or "scheduled"

        def run_once(self) -> int:
            # ... actual migration logic ...
            return records_count

    if __name__ == "__main__":
        MyScript().run()
"""
import abc
import logging
import os
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path


class BaseMigration(abc.ABC):
    script_id: str = ""
    script_name: str = ""
    interval_seconds: int = 60
    category: str = "continuous"

    @staticmethod
    def acquire_applock(cur, resource: str, timeout_ms: int = 120_000) -> None:
        """
        Acquire an exclusive SQL Server application lock (transaction-scoped).

        The lock is automatically released when the current transaction commits
        or rolls back — no manual release needed.

        Call this AFTER the staging COMMIT and BEFORE sp_SwitchSnapshot / any
        writes to the live table.  Both copy_script and full_sync_script for
        the same module should use the same ``resource`` name so they serialise.

        Example resource name: ``"Migration_Daily_PlanFact"``
        """
        cur.execute(
            """
            DECLARE @res INT;
            EXEC @res = sp_getapplock
                @Resource    = ?,
                @LockMode    = 'Exclusive',
                @LockOwner   = 'Transaction',
                @LockTimeout = ?;
            IF @res < 0
                RAISERROR(N'Could not acquire app lock ''%s'' (sp_getapplock result=%d)',
                          16, 1, ?, @res);
            """,
            (resource, timeout_ms, resource),
        )

    def __init__(self):
        self._logger: logging.Logger | None = None

    # ── Abstract interface ────────────────────────────────────────────────────

    @abc.abstractmethod
    def run_once(self) -> int:
        """Execute one sync cycle. Returns number of records processed."""
        ...

    # ── Public entry point ────────────────────────────────────────────────────

    def run(self) -> None:
        """
        Main entry point — called from each module's __main__ block.
        Runs run_once() immediately, then loops with interval_seconds pause.
        """
        logger = self.get_logger()
        pid = os.getpid()
        logger.info(f"=== {self.script_name} started (PID={pid}) ===")
        self._report_status("running", pid=pid)

        try:
            self._execute_cycle(logger)
            while True:
                time.sleep(self.interval_seconds)
                self._execute_cycle(logger)
        except KeyboardInterrupt:
            logger.info(f"=== {self.script_name} stopped by user ===")
            self._report_status("stopped")
        except Exception as e:
            logger.critical(f"=== {self.script_name} crashed: {e} ===", exc_info=True)
            self._report_status("error", error=str(e))
            raise

    def run_once_standalone(self) -> int:
        """
        Execute a single cycle and report status — used by scheduler.py for
        one-shot / scheduled scripts that don't run in a continuous loop.
        """
        logger = self.get_logger()
        pid = os.getpid()
        logger.info(f"=== {self.script_name} scheduled run (PID={pid}) ===")
        self._report_status("running", pid=pid)
        return self._execute_cycle(logger)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _execute_cycle(self, logger: logging.Logger) -> int:
        try:
            records = self.run_once()
            records = records if isinstance(records, int) else 0
            logger.info(f"[OK] {records} records processed")
            self._report_status("success", records=records)
            return records
        except Exception as e:
            logger.error(f"[ERROR] {e}", exc_info=True)
            self._report_status("error", error=str(e))
            return 0

    def _report_status(
        self,
        status: str,
        records: int = 0,
        error: str | None = None,
        pid: int | None = None,
    ) -> None:
        """Write/update row in Migration.ScriptStatus. Never raises."""
        try:
            from core.db import get_target_connection
            _pid = pid if pid is not None else os.getpid()
            now = datetime.now()
            conn = get_target_connection()
            cur = conn.cursor()

            # Upsert base row
            cur.execute(
                """
                MERGE Migration.ScriptStatus AS t
                USING (SELECT ? AS ScriptID) AS s ON t.ScriptID = s.ScriptID
                WHEN NOT MATCHED THEN
                    INSERT (ScriptID, ScriptName, Category, IntervalSeconds,
                            Status, Pid, UpdatedAt, CycleCount)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                WHEN MATCHED THEN
                    UPDATE SET Status = ?, Pid = ?, UpdatedAt = ?;
                """,
                (
                    self.script_id,
                    # INSERT values:
                    self.script_id, self.script_name,
                    getattr(self, 'category', 'continuous'),
                    self.interval_seconds,
                    status, _pid, now,
                    # UPDATE values:
                    status, _pid, now,
                ),
            )

            # Status-specific fields
            if status == "running":
                cur.execute(
                    "UPDATE Migration.ScriptStatus SET LastStart = ? WHERE ScriptID = ?",
                    (now, self.script_id),
                )
            elif status == "success":
                cur.execute(
                    """
                    UPDATE Migration.ScriptStatus
                    SET LastSuccess = ?,
                        RecordsProcessed = ?,
                        CycleCount = ISNULL(CycleCount, 0) + 1,
                        ErrorMessage = NULL
                    WHERE ScriptID = ?
                    """,
                    (now, records, self.script_id),
                )
            elif status == "error":
                cur.execute(
                    """
                    UPDATE Migration.ScriptStatus
                    SET LastError = ?, ErrorMessage = ?
                    WHERE ScriptID = ?
                    """,
                    (now, (str(error) if error else "")[:2000], self.script_id),
                )

            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            # Status reporting must never crash the migration script itself
            pass

    def get_logger(self) -> logging.Logger:
        if self._logger is not None:
            return self._logger

        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / f"{self.script_id or 'migration'}.log"

        handler = RotatingFileHandler(
            log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        )

        logger = logging.getLogger(self.script_id or __name__)
        logger.setLevel(logging.INFO)
        if not logger.handlers:
            logger.addHandler(handler)
        self._logger = logger
        return logger

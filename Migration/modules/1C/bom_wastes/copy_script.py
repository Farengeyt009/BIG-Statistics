"""BOM Wastes Copy Script — TRUNCATE + INSERT every 24 hours."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_BOM_WASTES


class BomWastesCopy(BaseMigration):
    script_id        = "1c_bom_wastes"
    script_name      = "BOM Wastes Copy (1C)"
    interval_seconds = 86400
    category         = "continuous"

    TABLE_TARGET = "Import_1C.BOM_Wastes"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")

            cur_1c.execute(QUERY_BOM_WASTES)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            cur_t.execute(f"TRUNCATE TABLE {self.TABLE_TARGET}")

            insert_cols  = columns_1c
            placeholders = ", ".join(["?"] * len(insert_cols))
            insert_sql   = (
                f"INSERT INTO {self.TABLE_TARGET} ({', '.join(insert_cols)}) "
                f"VALUES ({placeholders})"
            )
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, rows_1c)
            conn_t.commit()

            cur_t.execute(f"SELECT COUNT(*) FROM {self.TABLE_TARGET}")
            return cur_t.fetchone()[0]
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    BomWastesCopy().run()

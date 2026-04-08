"""Copies Nomenclature Reference from 1C into the target DB (full refresh every 24h)."""
import sys
import os
import uuid

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_NOMENCLATURE_REFERENCE_TEMPLATE

TABLE_STAGING = "Import_1C.stg_Nomenclature_Reference"


class NomenclatureCopy(BaseMigration):
    script_id        = "1c_nomenclature_reference"
    script_name      = "1C Nomenclature Reference (full refresh)"
    interval_seconds = 86400
    category         = "continuous"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()

            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")

            cur_1c.execute(QUERY_NOMENCLATURE_REFERENCE_TEMPLATE)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c = cur_1c.fetchall()

            if not rows_1c:
                return 0

            snapshot_id = str(uuid.uuid4())

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))

            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ",".join(["?"] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"

            payload = [(snapshot_id,) + tuple(row) for row in rows_1c]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)
            conn_t.commit()

            cur_t.execute(
                """
                EXEC Import_1C.sp_SwitchSnapshot_Nomenclature_Reference
                  @SnapshotID = ?, @Full = 1, @CleanupPrev = 1;
                """,
                (snapshot_id,)
            )
            conn_t.commit()

            cur_t.execute("SELECT COUNT(*) FROM Import_1C.vw_Nomenclature_Reference_Current")
            final_count = cur_t.fetchone()[0]

            return final_count
        finally:
            for obj in [cur_1c, cur_t, conn_1c, conn_t]:
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    NomenclatureCopy().run()

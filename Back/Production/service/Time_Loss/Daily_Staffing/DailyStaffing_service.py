from typing import List, Dict, Any


def _rows_to_dicts(columns, rows) -> List[Dict[str, Any]]:
    cols = [c[0] for c in columns]
    return [dict(zip(cols, r)) for r in rows]


class DailyStaffingService:
    def __init__(self, db_connection):
        self.conn = db_connection

    def get_daily_staffing(self, date_from: str, date_to: str) -> List[Dict[str, Any]]:
        sql = (
            ";WITH RefDeDup AS (\n"
            "    SELECT\n"
            "        WorkShop_CustomWS,\n"
            "        WorkCenter_CustomWS,\n"
            "        WorkShopName_ZH,\n"
            "        WorkShopName_EN,\n"
            "        WorkCenterName_ZH,\n"
            "        WorkCenterName_EN,\n"
            "        rn = ROW_NUMBER() OVER (\n"
            "                PARTITION BY WorkShop_CustomWS, WorkCenter_CustomWS\n"
            "                ORDER BY (SELECT 0)\n"
            "        )\n"
            "    FROM Ref.WorkShop_CustomWS\n"
            "),\n"
            "W AS (\n"
            "    SELECT\n"
            "        w.OnlyDate,\n"
            "        w.WorkShopID,\n"
            "        w.WorkCenterID,\n"
            "        w.People,\n"
            "        w.WorkHours,\n"
            "        w.PeopleWorkHours\n"
            "    FROM TimeLoss.WorkSchedules_ByDay AS w\n"
            "    WHERE w.DeleteMark = 0\n"
            "      AND w.OnlyDate BETWEEN ? AND ?\n"
            "),\n"
            "E AS (\n"
            "    SELECT\n"
            "        e.OnlyDate,\n"
            "        e.WorkShopID,\n"
            "        e.WorkCenterID,\n"
            "        SUM(e.ManHours) AS EntryManHours\n"
            "    FROM TimeLoss.vw_EntryGrid AS e\n"
            "    WHERE e.OnlyDate BETWEEN ? AND ?\n"
            "    GROUP BY e.OnlyDate, e.WorkShopID, e.WorkCenterID\n"
            ")\n"
            "SELECT\n"
            "    COALESCE(W.OnlyDate,      E.OnlyDate)      AS OnlyDate,\n"
            "    COALESCE(W.WorkShopID,    E.WorkShopID)    AS WorkShopID,\n"
            "    COALESCE(W.WorkCenterID,  E.WorkCenterID)  AS WorkCenterID,\n"
            "\n"
            "    W.People,\n"
            "    W.WorkHours,\n"
            "    W.PeopleWorkHours,\n"
            "\n"
            "    E.EntryManHours,\n"
            "\n"
            "    R.WorkShopName_ZH,\n"
            "    R.WorkShopName_EN,\n"
            "    R.WorkCenterName_ZH,\n"
            "    R.WorkCenterName_EN\n"
            "FROM W\n"
            "FULL OUTER JOIN E\n"
            "  ON  W.OnlyDate     = E.OnlyDate\n"
            "  AND W.WorkShopID   = E.WorkShopID\n"
            "  AND W.WorkCenterID = E.WorkCenterID\n"
            "LEFT JOIN RefDeDup AS R\n"
            "  ON  R.WorkShop_CustomWS   = COALESCE(W.WorkShopID,   E.WorkShopID)\n"
            "  AND R.WorkCenter_CustomWS = COALESCE(W.WorkCenterID, E.WorkCenterID)\n"
            "  AND R.rn = 1\n"
            "ORDER BY\n"
            "    COALESCE(W.OnlyDate, E.OnlyDate),\n"
            "    COALESCE(W.WorkShopID, E.WorkShopID),\n"
            "    COALESCE(W.WorkCenterID, E.WorkCenterID);\n"
        )

        cursor = self.conn.cursor()
        try:
            cursor.execute(sql, (date_from, date_to, date_from, date_to))
            return _rows_to_dicts(cursor.description, cursor.fetchall())
        finally:
            cursor.close()



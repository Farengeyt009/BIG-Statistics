from typing import Any, Dict, Optional
from decimal import Decimal, InvalidOperation

from ...database.db_connector import get_connection


EditableFields = (
    "ShipMonth_PlanPcs",
    "ShipWeek_PlanPcs",
    "FGStockStartWeekPcs",
    "ContainerQty",
    "Comment",
)


def _to_decimal_or_none(v) -> Optional[Decimal]:
    if v is None or v == "":
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Invalid numeric value: {v!r}")


def _fetch_current_row(cur, period_id: int) -> Optional[Dict[str, Any]]:
    cur.execute(
        """
        SELECT PeriodID, ShipMonth_PlanPcs, ShipWeek_PlanPcs,
               FGStockStartWeekPcs, ContainerQty, Comment, UpdatedAt, UpdatedBy
        FROM Orders.Shipment_Plan
        WHERE PeriodID = ?
        """,
        (period_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, row))


def upsert_shipment_plan(*, period_id: int, payload: Dict[str, Any], updated_by: str = "webapp") -> Dict[str, Any]:
    """
    PATCH-semantics: если поле отсутствует в payload — сохраняем текущее значение из БД.
    Вызывает Orders.sp_Shipment_Plan_Upsert.
    """
    if not isinstance(period_id, int):
        raise ValueError("period_id must be integer")

    with get_connection() as conn:
        cur = conn.cursor()

        current = _fetch_current_row(cur, period_id) or {}

        ship_month = payload.get("ShipMonth_PlanPcs", current.get("ShipMonth_PlanPcs"))
        ship_week = payload.get("ShipWeek_PlanPcs", current.get("ShipWeek_PlanPcs"))
        fg_start = payload.get("FGStockStartWeekPcs", current.get("FGStockStartWeekPcs"))
        cont_qty = payload.get("ContainerQty", current.get("ContainerQty"))
        comment = payload.get("Comment", current.get("Comment"))

        ship_month_dec = _to_decimal_or_none(ship_month)
        ship_week_dec = _to_decimal_or_none(ship_week)
        fg_start_dec = _to_decimal_or_none(fg_start)
        cont_qty_dec = _to_decimal_or_none(cont_qty)
        comment_str = None if comment is None else str(comment)

        cur.execute(
            "EXEC Orders.sp_Shipment_Plan_Upsert ?, ?, ?, ?, ?, ?, ?",
            (
                period_id,
                ship_month_dec,
                ship_week_dec,
                fg_start_dec,
                cont_qty_dec,
                comment_str,
                updated_by,
            ),
        )
        conn.commit()

        after = _fetch_current_row(cur, period_id)
        return after or {"PeriodID": period_id}



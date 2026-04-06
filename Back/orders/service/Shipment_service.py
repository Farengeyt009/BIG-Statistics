"""
Сервис-слой: возвращает данные об отгрузках из Orders.ShipmentData_Table, 
загружает/применяет правила фильтрации Order_No из Orders.ShipmentsOrderFilter_Rules
и предоставляет preview/publish API.
"""

from datetime import date
from typing import Any, Dict, List, Tuple
from ...database.db_connector import get_connection

# Sentinel to persist NullOrEmpty in DBs that do not allow custom MatchType values
NULL_EMPTY_SENTINEL = "__NULL_EMPTY__"


def _fetch_query(conn, sql: str, params: Tuple = ()) -> List[Dict[str, Any]]:
    """Выполняет SELECT и возвращает список dict'ов (JSON-friendly)."""
    cur = conn.cursor()
    cur.execute(sql, params) if params else cur.execute(sql)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _table_has_column(conn, schema: str, table: str, column: str) -> bool:
    """Проверяет наличие колонки в таблице через sys.columns — без риска ошибки соединения."""
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID(?) AND name = ?
            """,
            (f"{schema}.{table}", column)
        )
        return cur.fetchone() is not None
    except Exception:
        return False


def load_published_rules(conn) -> List[Dict[str, Any]]:
    has_field_name = _table_has_column(conn, "Orders", "ShipmentsOrderFilter_Rules", "FieldName")
    if has_field_name:
        sql = """
            SELECT RuleID, FieldName, MatchType, Pattern, IsExclude, IsActive, Priority, Comment
            FROM Orders.ShipmentsOrderFilter_Rules
            ORDER BY IsActive DESC, IsExclude DESC, Priority ASC, Pattern
        """
    else:
        sql = """
            SELECT RuleID, MatchType, Pattern, IsExclude, IsActive, Priority, Comment
            FROM Orders.ShipmentsOrderFilter_Rules
            ORDER BY IsActive DESC, IsExclude DESC, Priority ASC, Pattern
        """
    rows = _fetch_query(conn, sql)
    for r in rows:
        try:
            if str(r.get("MatchType", "")).lower() == "equals" and str(r.get("Pattern", "")) == NULL_EMPTY_SENTINEL:
                r["MatchType"] = "NullOrEmpty"
                r["Pattern"] = ""
        except Exception:
            pass
        if not r.get("FieldName"):
            r["FieldName"] = "Order_No"
    return rows


# Whitelist допустимых полей для фильтрации (защита от SQL injection)
ALLOWED_FILTER_FIELDS = {
    'Order_No', 'Article_number', 'Market', 'Security_Scheme', 'ProductTagZh',
    'LargeGroup', 'GroupName', 'Name_CN', 'Recipient_Name', 'Partner_Name',
    'ContainerNO_Realization', 'CI_No', 'RealizationDoc', 'SpendingOrder_No',
}


def _build_predicates_from_rules(rules: List[Dict[str, Any]], field: str = "Order_No") -> Tuple[str, List[Any]]:
    """
    Собирает SQL-предикат и параметры для правил.
    Каждое правило может содержать FieldName — поле для фильтрации.
    Если FieldName не задан или не из whitelist — используется дефолтный field.
    Логика: keep = (include_match) OR NOT (exclude_match)
    Возвращает кортеж: (" AND <extra>", [params]) либо ("", []).
    """
    include_clauses: List[str] = []
    include_params: List[Any] = []
    exclude_clauses: List[str] = []
    exclude_params: List[Any] = []

    def add_clause(rule: Dict[str, Any], target: str):
        # Определяем поле: из правила или дефолт
        rule_field = (rule.get("FieldName") or "").strip()
        effective_field = rule_field if rule_field in ALLOWED_FILTER_FIELDS else field

        match_type = (rule.get("MatchType") or "").strip().lower()
        pattern_raw = (rule.get("Pattern") or "").strip()
        # Спец-тип: NullOrEmpty / IsNullOrEmpty / Null / IsNull
        if match_type in ("nullorempty", "isnullorempty", "null", "isnull"):
            expr = f"({effective_field} IS NULL OR {effective_field} = N'')" if match_type in ("nullorempty", "isnullorempty") else f"({effective_field} IS NULL)"
            if target == "include":
                include_clauses.append(expr)
            else:
                exclude_clauses.append(expr)
            return
        if not pattern_raw or not match_type:
            return
        if match_type == "startswith":
            base_expr, param = f"{effective_field} LIKE ?", f"{pattern_raw}%"
        elif match_type == "contains":
            base_expr, param = f"{effective_field} LIKE ?", f"%{pattern_raw}%"
        elif match_type == "equals":
            base_expr, param = f"{effective_field} = ?", pattern_raw
        elif match_type == "endswith":
            base_expr, param = f"{effective_field} LIKE ?", f"%{pattern_raw}"
        else:
            return
        if target == "include":
            include_clauses.append(base_expr)
            include_params.append(param)
        else:
            # Wrap with IS NOT NULL so rows where field IS NULL are NOT excluded.
            # Without this: NOT (NULL LIKE '...') = NOT NULL = NULL → row dropped.
            exclude_clauses.append(f"({effective_field} IS NOT NULL AND {base_expr})")
            exclude_params.append(param)

    for r in rules or []:
        if not r.get("IsActive", 1):
            continue
        is_exclude = 1 if r.get("IsExclude", 1) else 0
        add_clause(r, "exclude" if is_exclude else "include")

    parts: List[str] = []
    params: List[Any] = []
    if include_clauses and exclude_clauses:
        parts.append(f"( ({' OR '.join(include_clauses)}) OR NOT ({' OR '.join(exclude_clauses)}) )")
        params.extend(include_params + exclude_params)
    elif include_clauses:
        parts.append(f"( {' OR '.join(include_clauses)} )")
        params.extend(include_params)
    elif exclude_clauses:
        parts.append(f"( NOT ({' OR '.join(exclude_clauses)}) )")
        params.extend(exclude_params)
    else:
        return "", []

    return " AND " + " AND ".join(parts), params


def _normalize_dates_in_rows(rows: List[Dict[str, Any]]) -> None:
    from datetime import datetime
    for row in rows:
        for key in ("ShipmentDate_Fact_Svod", "ShipmentDate_Plan_Svod"):
            if key in row and row[key]:
                val = row[key]
                if hasattr(val, "strftime"):
                    row[key] = val.strftime("%d.%m.%Y")
                elif isinstance(val, str):
                    try:
                        row[key] = datetime.fromisoformat(val.split('T')[0]).strftime('%d.%m.%Y')
                    except Exception:
                        pass
        # Convert binary fields (varbinary/uniqueidentifier from 1C) to hex strings for JSON
        for key, val in list(row.items()):
            if isinstance(val, (bytes, bytearray)):
                row[key] = val.hex().upper()


def get_shipment_data(start_date: date, end_date: date) -> Dict[str, Any]:
    """Возвращает отгрузки за период с применением опубликованных правил."""
    base_sql = (
        """
        SELECT
            RealizationDoc, SpendingOrder_No, RealizationDate, SpendingOrder_Date,
            ShipmentDate_Fact, Recipient_Name, Partner_Name, ShipmentDate_Fact_Svod,
            LargeGroup, Order_No, Article_number, GroupName, Name_CN,
            SpendingOrder_QTY, CBM, CBM_Total, CI_No, ContainerNO_Realization, Comment,
            Market, Security_Scheme, ProductTagZh
        FROM Orders.ShipmentData_Table
        WHERE ShipmentDate_Fact_Svod BETWEEN ? AND ?
        {extra}
        ORDER BY ShipmentDate_Fact_Svod DESC
        """
    )
    import traceback as _tb
    try:
        with get_connection() as conn:
            rules = load_published_rules(conn)
            mapped_rules: List[Dict[str, Any]] = []
            for r in rules:
                if str(r.get("MatchType", "")).lower() == "equals" and str(r.get("Pattern", "")) == NULL_EMPTY_SENTINEL:
                    mapped_rules.append({**r, "MatchType": "NullOrEmpty", "Pattern": ""})
                else:
                    mapped_rules.append(r)

            extra_sql, extra_params = _build_predicates_from_rules(mapped_rules)
            final_sql = base_sql.format(extra=extra_sql)
            params: Tuple = (start_date, end_date, *extra_params)
            print(f"[Shipment] SQL:\n{final_sql}")
            print(f"[Shipment] params: {params}")
            rows = _fetch_query(conn, final_sql, params)
            _normalize_dates_in_rows(rows)
            return {
                "data": rows,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_records": len(rows),
            }
    except Exception as e:
        detail = _tb.format_exc()
        print(f"[Shipment] ERROR:\n{detail}")
        raise Exception(f"Ошибка при получении данных об отгрузках: {str(e)}\n---\n{detail}")


def preview_shipment_data(start_date: date, end_date: date,
                          preview_rules: List[Dict[str, Any]],
                          mode: str = "merge") -> Dict[str, Any]:
    """Возвращает данные с временными правилами: mode='override' или 'merge'."""
    base_sql = (
        """
        SELECT
            RealizationDoc, SpendingOrder_No, RealizationDate, SpendingOrder_Date,
            ShipmentDate_Fact, Recipient_Name, Partner_Name, ShipmentDate_Fact_Svod,
            LargeGroup, Order_No, Article_number, GroupName, Name_CN,
            SpendingOrder_QTY, CBM, CBM_Total, CI_No, ContainerNO_Realization, Comment,
            Market, Security_Scheme, ProductTagZh
        FROM Orders.ShipmentData_Table
        WHERE ShipmentDate_Fact_Svod BETWEEN ? AND ?
        {extra}
        ORDER BY ShipmentDate_Fact_Svod DESC
        """
    )
    try:
        with get_connection() as conn:
            if mode.lower() == "override":
                effective_rules = preview_rules or []
            else:
                effective_rules = (load_published_rules(conn) or []) + (preview_rules or [])

            mapped_rules: List[Dict[str, Any]] = []
            for r in effective_rules:
                if str(r.get("MatchType", "")).lower() == "equals" and str(r.get("Pattern", "")) == NULL_EMPTY_SENTINEL:
                    mapped_rules.append({**r, "MatchType": "NullOrEmpty", "Pattern": ""})
                else:
                    mapped_rules.append(r)
            extra_sql, extra_params = _build_predicates_from_rules(mapped_rules)
            params: Tuple = (start_date, end_date, *extra_params)
            rows = _fetch_query(conn, base_sql.format(extra=extra_sql), params)
            _normalize_dates_in_rows(rows)
            return {
                "data": rows,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_records": len(rows),
                "mode": mode.lower(),
            }
    except Exception as e:
        raise Exception(f"Ошибка при PREVIEW отгрузок: {str(e)}")


def publish_rules(new_rules: List[Dict[str, Any]]) -> int:
    """Полная замена набора правил: DELETE ALL + INSERT новых. Возвращает вставленное кол-во."""
    normalized: List[Dict[str, Any]] = []
    for r in (new_rules or []):
        mt = (r.get("MatchType") or "").strip().lower()
        if mt not in ("startswith", "contains", "equals", "endswith", "nullorempty", "isnullorempty", "null", "isnull"):
            continue
        pattern = (r.get("Pattern") or "").strip()
        # Для NullOrEmpty/IsNull допускаем пустой pattern
        if mt not in ("nullorempty", "isnullorempty", "null", "isnull") and not pattern:
            continue
        # Каноническое значение для БД
        if mt in ("nullorempty", "isnullorempty", "null", "isnull"):
            # Store using sentinel to bypass DB CHECK constraints if present
            canonical_mt = "Equals"
            pattern = NULL_EMPTY_SENTINEL
        elif mt == "startswith":
            canonical_mt = "StartsWith"
        elif mt == "contains":
            canonical_mt = "Contains"
        elif mt == "equals":
            canonical_mt = "Equals"
        else:  # endswith
            canonical_mt = "EndsWith"
        field_name = (r.get("FieldName") or "Order_No").strip()
        if field_name not in ALLOWED_FILTER_FIELDS:
            field_name = "Order_No"
        normalized.append({
            "MatchType": canonical_mt,
            "Pattern": pattern,
            "IsExclude": 1 if r.get("IsExclude", 1) else 0,
            "IsActive": 1 if r.get("IsActive", 1) else 0,
            "Priority": int(r.get("Priority", 100)),
            "Comment": (r.get("Comment") or "").strip() or None,
            "FieldName": field_name,
        })

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("BEGIN TRAN")
        try:
            cur.execute("DELETE FROM Orders.ShipmentsOrderFilter_Rules")
            if normalized:
                cur.fast_executemany = True
                # Try with FieldName; fall back if column doesn't exist yet
                try:
                    cur.executemany(
                        (
                            """
                            INSERT INTO Orders.ShipmentsOrderFilter_Rules
                              (MatchType, Pattern, IsExclude, IsActive, Priority, Comment, FieldName)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            """
                        ),
                        [(
                            r["MatchType"], r["Pattern"], r["IsExclude"],
                            r["IsActive"], r["Priority"], r["Comment"], r["FieldName"]
                        ) for r in normalized]
                    )
                except Exception:
                    cur.executemany(
                        (
                            """
                            INSERT INTO Orders.ShipmentsOrderFilter_Rules
                              (MatchType, Pattern, IsExclude, IsActive, Priority, Comment)
                            VALUES (?, ?, ?, ?, ?, ?)
                            """
                        ),
                        [(
                            r["MatchType"], r["Pattern"], r["IsExclude"],
                            r["IsActive"], r["Priority"], r["Comment"]
                        ) for r in normalized]
                    )
            cur.execute("COMMIT")
            return len(normalized)
        except Exception:
            cur.execute("ROLLBACK")
            raise


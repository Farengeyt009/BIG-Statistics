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


def load_published_rules(conn) -> List[Dict[str, Any]]:
    sql = (
        """
        SELECT RuleID, MatchType, Pattern, IsExclude, IsActive, Priority, Comment
        FROM Orders.ShipmentsOrderFilter_Rules
        ORDER BY IsActive DESC, IsExclude DESC, Priority ASC, Pattern
        """
    )
    rows = _fetch_query(conn, sql)
    # Map sentinel-stored NullOrEmpty back to logical MatchType
    for r in rows:
        try:
            if str(r.get("MatchType", "")).lower() == "equals" and str(r.get("Pattern", "")) == NULL_EMPTY_SENTINEL:
                r["MatchType"] = "NullOrEmpty"
                r["Pattern"] = ""
        except Exception:
            pass
    return rows


def _build_predicates_from_rules(rules: List[Dict[str, Any]], field: str = "Order_No") -> Tuple[str, List[Any]]:
    """
    Собирает SQL-предикат и параметры для правил.
    Логика: keep = (include_match) OR NOT (exclude_match)
    Возвращает кортеж: (" AND <extra>", [params]) либо ("", []).
    """
    include_clauses: List[str] = []
    include_params: List[Any] = []
    exclude_clauses: List[str] = []
    exclude_params: List[Any] = []

    def add_clause(rule: Dict[str, Any], target: str):
        match_type = (rule.get("MatchType") or "").strip().lower()
        pattern_raw = (rule.get("Pattern") or "").strip()
        # Спец-тип: NullOrEmpty / IsNullOrEmpty / Null / IsNull
        if match_type in ("nullorempty", "isnullorempty", "null", "isnull"):
            expr = f"({field} IS NULL OR {field} = N'')" if match_type in ("nullorempty", "isnullorempty") else f"({field} IS NULL)"
            if target == "include":
                include_clauses.append(expr)
            else:
                exclude_clauses.append(expr)
            return
        if not pattern_raw or not match_type:
            return
        if match_type == "startswith":
            expr, param = f"{field} LIKE ?", f"{pattern_raw}%"
        elif match_type == "contains":
            expr, param = f"{field} LIKE ?", f"%{pattern_raw}%"
        elif match_type == "equals":
            expr, param = f"{field} = ?", pattern_raw
        elif match_type == "endswith":
            expr, param = f"{field} LIKE ?", f"%{pattern_raw}"
        else:
            return
        if target == "include":
            include_clauses.append(expr)
            include_params.append(param)
        else:
            exclude_clauses.append(expr)
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
                        # попытка привести YYYY-MM-DD или ISO к DD.MM.YYYY
                        row[key] = datetime.fromisoformat(val.split('T')[0]).strftime('%d.%m.%Y')
                    except Exception:
                        pass


def get_shipment_data(start_date: date, end_date: date) -> Dict[str, Any]:
    """Возвращает отгрузки за период с применением опубликованных правил."""
    base_sql = (
        """
        SELECT *
        FROM Orders.ShipmentData_Table
        WHERE ShipmentDate_Fact_Svod BETWEEN ? AND ?
        {extra}
        ORDER BY ShipmentDate_Fact_Svod DESC
        """
    )
    try:
        with get_connection() as conn:
            rules = load_published_rules(conn)
            # Map sentinel-stored Equals/__NULL_EMPTY__ back to logical NullOrEmpty for filtering
            mapped_rules: List[Dict[str, Any]] = []
            for r in rules:
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
            }
    except Exception as e:
        raise Exception(f"Ошибка при получении данных об отгрузках: {str(e)}")


def preview_shipment_data(start_date: date, end_date: date,
                          preview_rules: List[Dict[str, Any]],
                          mode: str = "merge") -> Dict[str, Any]:
    """Возвращает данные с временными правилами: mode='override' или 'merge'."""
    base_sql = (
        """
        SELECT *
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
        normalized.append({
            "MatchType": canonical_mt,
            "Pattern": pattern,
            "IsExclude": 1 if r.get("IsExclude", 1) else 0,
            "IsActive": 1 if r.get("IsActive", 1) else 0,
            "Priority": int(r.get("Priority", 100)),
            "Comment": (r.get("Comment") or "").strip() or None,
        })

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("BEGIN TRAN")
        try:
            cur.execute("DELETE FROM Orders.ShipmentsOrderFilter_Rules")
            if normalized:
                cur.fast_executemany = True
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


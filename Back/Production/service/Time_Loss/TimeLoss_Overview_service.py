from datetime import date
from typing import Any, Dict, List

try:
    from Back.database.db_connector import get_connection  # type: ignore
except Exception:  # pragma: no cover
    def get_connection():  # type: ignore
        raise RuntimeError("DB connector get_connection() is not available")


def _to_float(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except Exception:
        return 0.0


class TimeLossOverviewService:
    def __init__(self, cn=None) -> None:
        self._external_cn = cn

    def _get_cn(self):
        return self._external_cn or get_connection()

    def get_dashboard(self, date_from: date, date_to: date) -> Dict[str, Any]:
        cn = self._get_cn()
        cur = cn.cursor()
        try:
            # Основной путь — вызываем хранимую процедуру
            cur.execute("EXEC rpt.TimeLoss_Dashboard @DateFrom=?, @DateTo=?", (date_from, date_to))

            # 1) Справочник цехов
            workshops: List[Dict[str, Any]] = []
            order_keys: List[str] = []
            for row in cur:
                key = (getattr(row, 'WorkShopKey', '') or '').strip()
                workshops.append({
                    'key': key,
                    'name_zh': (getattr(row, 'WorkShopName_ZH', '') or '').strip(),
                    'name_en': (getattr(row, 'WorkShopName_EN', '') or '').strip(),
                    'order': getattr(row, 'SortOrder', None),
                })
                order_keys.append(key)

            # 2) Итоги
            summary: List[Dict[str, Any]] = []
            if cur.nextset():
                for row in cur:
                    plan_v = _to_float(getattr(row, 'Plan', getattr(row, 'Plan_TIME', 0)))
                    fact_v = _to_float(getattr(row, 'Fact', getattr(row, 'FACT_TIME', 0)))
                    loss_v = _to_float(getattr(row, 'Loss', getattr(row, 'Loss_Time', 0)))
                    # Net напрямую или вычисляем как fact - loss
                    net_attr = getattr(row, 'Net', getattr(row, 'NET_TIME', None))
                    net_v = _to_float(net_attr) if net_attr is not None else (fact_v - loss_v)
                    summary.append({
                        'workshopKey': (getattr(row, 'WorkShopKey', '') or '').strip(),
                        'plan': plan_v,
                        'fact': fact_v,
                        'loss': loss_v,
                        'net': net_v,
                    })

            # 3) Причины × цеха
            reasons: List[Dict[str, Any]] = []
            if cur.nextset():
                col_names = [c[0] for c in cur.description] if cur.description else []
                for row in cur:
                    reason_zh = (getattr(row, 'ReasonGroup_ZH', '') or '').strip()
                    reason_en = (getattr(row, 'ReasonGroup_EN', '') or '').strip()
                    values: Dict[str, float] = {}
                    for k in order_keys:
                        if k in col_names:
                            values[k] = _to_float(getattr(row, k))
                        else:
                            values[k] = 0.0
                    total = _to_float(getattr(row, 'Total', None))
                    if total == 0.0:
                        total = float(sum(values.values()))
                    reasons.append({'reason_zh': reason_zh, 'reason_en': reason_en, 'values': values, 'total': total})

            return {'workshops': workshops, 'summary': summary, 'reasons': reasons}
        except Exception as exc:
            # Fallback: если процедуры нет — формируем данные прямыми запросами
            msg = str(exc).lower()
            if "could not find stored procedure" in msg or "invalid object name rpt.timeloss_dashboard" in msg:
                return self._fallback_dashboard(cur, date_from, date_to)
            raise
        finally:
            try:
                cur.close()
            except Exception:
                pass
            if self._external_cn is None:
                try:
                    cn.close()
                except Exception:
                    pass

    # --- Fallback без процедуры: SQL из ТЗ, но pivot собираем в Python ---
    def _fallback_dashboard(self, cur, date_from: date, date_to: date) -> Dict[str, Any]:
        # 0) Workshops (справочник)
        workshops_sql = (
            "SELECT LTRIM(RTRIM(WorkShop_CustomWS)) AS WorkShopKey, "
            "MIN(LTRIM(RTRIM(WorkShopName_ZH))) AS WorkShopName_ZH, "
            "MIN(LTRIM(RTRIM(WorkShopName_EN))) AS WorkShopName_EN, "
            "ROW_NUMBER() OVER (ORDER BY MIN(WorkShopName_EN), LTRIM(RTRIM(WorkShop_CustomWS))) AS SortOrder "
            "FROM Ref.WorkShop_CustomWS "
            "GROUP BY LTRIM(RTRIM(WorkShop_CustomWS))"
        )
        cur.execute(workshops_sql)
        workshops = []
        order_keys = []
        for row in cur:
            key = (getattr(row, 'WorkShopKey', '') or '').strip()
            workshops.append({
                'key': key,
                'name_zh': (getattr(row, 'WorkShopName_ZH', '') or '').strip(),
                'name_en': (getattr(row, 'WorkShopName_EN', '') or '').strip(),
                'order': getattr(row, 'SortOrder', None),
            })
            order_keys.append(key)

        # 1) Summary (итоги за период)
        summary_sql = f'''
;WITH plan_cte AS (
    SELECT CAST(p.OnlyDate AS date) AS OnlyDate,
           LTRIM(RTRIM(p.WorkShopName_CH)) AS WorkShopKey,
           SUM(p.Plan_TIME) AS Plan_TIME,
           SUM(p.FACT_TIME) AS FACT_TIME
    FROM Views_For_Plan.DailyPlan_CustomWS AS p
    WHERE p.OnlyDate >= ? AND p.OnlyDate < DATEADD(day,1,?)
    GROUP BY CAST(p.OnlyDate AS date), LTRIM(RTRIM(p.WorkShopName_CH))
),
loss_cte AS (
    SELECT CAST(l.OnlyDate AS date) AS OnlyDate,
           LTRIM(RTRIM(l.WorkShopID)) AS WorkShopKey,
           SUM(l.ManHours) AS Loss_Time
    FROM TimeLoss.vw_EntryGrid AS l
    WHERE l.OnlyDate >= ? AND l.OnlyDate < DATEADD(day,1,?)
    GROUP BY CAST(l.OnlyDate AS date), LTRIM(RTRIM(l.WorkShopID))
),
plan_sum AS (
    SELECT WorkShopKey, SUM(Plan_TIME) AS Plan_TIME, SUM(FACT_TIME) AS FACT_TIME
    FROM plan_cte GROUP BY WorkShopKey
),
loss_sum AS (
    SELECT WorkShopKey, SUM(Loss_Time) AS Loss_Time
    FROM loss_cte GROUP BY WorkShopKey
)
SELECT d.WorkShopKey,
       COALESCE(p.Plan_TIME,0) AS Plan_TIME,
       COALESCE(p.FACT_TIME,0) AS FACT_TIME,
       COALESCE(l.Loss_Time,0) AS Loss_Time
FROM (
    SELECT DISTINCT LTRIM(RTRIM(WorkShop_CustomWS)) AS WorkShopKey FROM Ref.WorkShop_CustomWS
) d
LEFT JOIN plan_sum p ON p.WorkShopKey=d.WorkShopKey
LEFT JOIN loss_sum l ON l.WorkShopKey=d.WorkShopKey;
'''
        cur.execute(summary_sql, (date_from, date_to, date_from, date_to))
        summary = []
        for row in cur:
            plan_v = _to_float(getattr(row, 'Plan_TIME', 0))
            fact_v = _to_float(getattr(row, 'FACT_TIME', 0))
            loss_v = _to_float(getattr(row, 'Loss_Time', 0))
            summary.append({
                'workshopKey': (getattr(row, 'WorkShopKey', '') or '').strip(),
                'plan': plan_v,
                'fact': fact_v,
                'loss': loss_v,
                'net': fact_v - loss_v,
            })

        # 2) Reasons (сырые агрегаты, pivot в Python)
        reasons_sql = (
            "SELECT e.ReasonGroupZh AS ReasonGroup_ZH, e.ReasonGroupEn AS ReasonGroup_EN, "
            "LTRIM(RTRIM(e.WorkShopID)) AS WorkShopKey, SUM(CAST(e.ManHours AS decimal(18,2))) AS Hours "
            "FROM TimeLoss.vw_EntryGrid AS e "
            "WHERE e.OnlyDate >= ? AND e.OnlyDate < DATEADD(day,1,?) "
            "GROUP BY e.ReasonGroupZh, e.ReasonGroupEn, LTRIM(RTRIM(e.WorkShopID))"
        )
        cur.execute(reasons_sql, (date_from, date_to))
        # Собираем в структуру { (zh,en) : { key: hours } }
        tmp = {}
        for row in cur:
            zh = (getattr(row, 'ReasonGroup_ZH', '') or '').strip()
            en = (getattr(row, 'ReasonGroup_EN', '') or '').strip()
            ws = (getattr(row, 'WorkShopKey', '') or '').strip()
            hours = _to_float(getattr(row, 'Hours', 0))
            key = (zh, en)
            if key not in tmp:
                tmp[key] = {}
            tmp[key][ws] = tmp[key].get(ws, 0.0) + hours

        reasons = []
        for (zh, en), by_ws in tmp.items():
            values = {k: _to_float(by_ws.get(k, 0.0)) for k in order_keys}
            total = float(sum(values.values()))
            reasons.append({'reason_zh': zh, 'reason_en': en, 'values': values, 'total': total})

        return {'workshops': workshops, 'summary': summary, 'reasons': reasons}



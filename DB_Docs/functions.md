# Функции

> Сгенерировано: 2026-04-08 21:13

## Orders.fn_ShouldExcludeShipmentOrder `(FUNCTION)`

```sql
CREATE   FUNCTION Orders.fn_ShouldExcludeShipmentOrder
(
    @OrderNo NVARCHAR(255)
)
RETURNS TABLE
AS
RETURN
WITH K AS (
    SELECT KeyVal = COALESCE(NULLIF(LTRIM(RTRIM(@OrderNo)), N''), N'__NULL_EMPTY__')
)
SELECT
  ShouldExclude =
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM Orders.ShipmentsOrderFilter_Rules r
        CROSS JOIN K
        WHERE r.IsActive = 1 AND r.IsExclude = 0
          AND (
            (r.MatchType='StartsWith' AND K.KeyVal LIKE r.Pattern + N'%') OR
            (r.MatchType='EndsWith'   AND K.KeyVal LIKE N'%' + r.Pattern) OR
            (r.MatchType='Equals'     AND K.KeyVal = r.Pattern)          OR
            (r.MatchType='Contains'   AND K.KeyVal LIKE N'%' + r.Pattern + N'%')
          )
      ) THEN CAST(0 AS bit)
      WHEN EXISTS (
        SELECT 1
        FROM Orders.ShipmentsOrderFilter_Rules r
        CROSS JOIN K
        WHERE r.IsActive = 1 AND r.IsExclude = 1
          AND (
            (r.MatchType='StartsWith' AND K.KeyVal LIKE r.Pattern + N'%') OR
            (r.MatchType='EndsWith'   AND K.KeyVal LIKE N'%' + r.Pattern) OR
            (r.MatchType='Equals'     AND K.KeyVal = r.Pattern)          OR
            (r.MatchType='Contains'   AND K.KeyVal LIKE N'%' + r.Pattern + N'%')
          )
      ) THEN CAST(1 AS bit)
      ELSE CAST(0 AS bit)
    END
```

---

## Production_TV.fn_Fact_Day `(FUNCTION)`

```sql
CREATE FUNCTION Production_TV.fn_Fact_Day
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256)
)
RETURNS TABLE
AS
RETURN
WITH ws AS (
  SELECT DISTINCT OnlyDate, WorkShopID, WorkCenterID
  FROM TimeLoss.WorkSchedules_ByDay
  WHERE DeleteMark = 0
)
SELECT
    fd.OnlyDate,
    fd.WorkCenterID,
    fd.NormOrder,
    fd.NormArticle,
    fd.FactQtyDay,
    fd.OrderNumberRaw,
    fd.ArticleNumberRaw
FROM Production_TV.Cache_Fact_Day fd
LEFT JOIN ws
  ON ws.OnlyDate    = fd.OnlyDate
 AND ws.WorkCenterID= fd.WorkCenterID
LEFT JOIN Production_TV.Workshops_Allowlist wa
  ON wa.IsEnabled = 1 AND wa.WorkShopID = ws.WorkShopID
WHERE fd.OnlyDate = @date
  AND (@workcenter IS NULL OR fd.WorkCenterID = @workcenter)
  AND (@workshop  IS NULL OR ws.WorkShopID   = @workshop)
```

---

## Production_TV.fn_Fact_Takt `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_Fact_Takt
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256)
)
RETURNS TABLE
AS
RETURN
SELECT
    OnlyDate,
    WorkShopID,
    WorkCenterID,
    NormOrder,
    NormArticle,
    FirstValidMinute,
    LastValidMinute,
    ValidQty,
    WorkSecBetweenScans,
    TaktFactSec
FROM Production_TV.Cache_Fact_Takt
WHERE OnlyDate = @date
  AND (@workshop   IS NULL OR WorkShopID   = @workshop)
  AND (@workcenter IS NULL OR WorkCenterID = @workcenter)
```

---

## Production_TV.fn_Name_ByArticle `(FUNCTION)`

```sql
CREATE FUNCTION Production_TV.fn_Name_ByArticle
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256)
)
RETURNS TABLE
AS
RETURN
/* активные (не удалённые) графики на день */
WITH WsActive AS (
    SELECT DISTINCT OnlyDate, WorkShopID, WorkCenterID
    FROM TimeLoss.WorkSchedules_ByDay
    WHERE DeleteMark = 0
),

/* ---- имя из плана (через кэш-слой) ---- */
PlanA AS (
    SELECT
        pb.OnlyDate,
        pb.WorkCenterID,
        pb.NormArticle,
        MAX(NULLIF(LTRIM(RTRIM(pb.ProductName_CN)), N'')) AS PlanName
    FROM Production_TV.fn_Plan_Base(@date, @workshop, @workcenter) pb
    GROUP BY pb.OnlyDate, pb.WorkCenterID, pb.NormArticle
),

/* ---- имя из факта (нормализация артикула + фильтр по активным графикам) ---- */
FactA AS (
    SELECT
        @date AS OnlyDate,
        f.WorkCenter_CN AS WorkCenterID,
        UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(f.NormArticle)),
              ' ', ''), NCHAR(160), ''), CHAR(9), ''), CHAR(13), '')) AS NormArticle,
        MAX(NULLIF(LTRIM(RTRIM(f.ProductName_CN)), N'')) AS FactName
    FROM Import_1C.vw_FactScan_OnAssembly_Current f
    WHERE f.OnlyDate = @date
      AND (@workcenter IS NULL OR f.WorkCenter_CN = @workcenter)
      AND (
            @workshop IS NULL
         OR EXISTS (
                SELECT 1
                FROM WsActive ws
                JOIN Production_TV.Workshops_Allowlist wa
                  ON wa.IsEnabled = 1 AND wa.WorkShopID = ws.WorkShopID
                WHERE ws.OnlyDate     = @date
                  AND ws.WorkCenterID = f.WorkCenter_CN
                  AND ws.WorkShopID   = @workshop
            )
      )
    GROUP BY
        f.WorkCenter_CN,
        UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(f.NormArticle)),
              ' ', ''), NCHAR(160), ''), CHAR(9), ''), CHAR(13), ''))
),

/* ---- справочник: приоритетное имя по артикулу ---- */
Guide AS (
    SELECT
        UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(g.FactoryNumber)),
               ' ', ''), NCHAR(160), ''), CHAR(9), ''), CHAR(13), '')) AS NormArticle,
        NULLIF(LTRIM(RTRIM(g.GroupName)), N'') AS GroupName
    FROM Ref.Product_Guide g
),

/* ---- множество артикулов из плана или факта ---- */
Articles AS (
    SELECT OnlyDate, WorkCenterID, NormArticle FROM PlanA
    UNION
    SELECT OnlyDate, WorkCenterID, NormArticle FROM FactA
)

SELECT
    a.OnlyDate,
    a.WorkCenterID,
    a.NormArticle,
    COALESCE(g.GroupName, p.PlanName, f.FactName) AS [Name]
FROM Articles a
LEFT JOIN Guide g
  ON g.NormArticle = a.NormArticle
LEFT JOIN PlanA p
  ON p.OnlyDate     = a.OnlyDate
 AND p.WorkCenterID = a.WorkCenterID
 AND p.NormArticle  = a.NormArticle
LEFT JOIN FactA f
  ON f.OnlyDate     = a.OnlyDate
 AND f.WorkCenterID = a.WorkCenterID
 AND f.NormArticle  = a.NormArticle
```

---

## Production_TV.fn_OrderSlots_Cyclic `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_OrderSlots_Cyclic
(
  @date date,
  @workshop   nvarchar(256),
  @workcenter nvarchar(256)
)
RETURNS TABLE
AS
RETURN
WITH norm AS (
  SELECT TRIM(REPLACE(@workshop,  CHAR(160),' ')) AS ws,
         TRIM(REPLACE(@workcenter,CHAR(160),' ')) AS wc
),
Spans AS (
  SELECT w.WorkShopID, w.WorkCenterID, w.SpanStart, w.SpanEnd,
         DATEDIFF(SECOND, w.SpanStart, w.SpanEnd) AS SpanDurSec
  FROM Production_TV.Cache_WorkingSpans_Day w
  CROSS JOIN norm n
  WHERE w.OnlyDate = @date
    AND (n.ws IS NULL OR TRIM(REPLACE(w.WorkShopID,  CHAR(160),' ')) = n.ws)
    AND (n.wc IS NULL OR TRIM(REPLACE(w.WorkCenterID,CHAR(160),' ')) = n.wc)
),
S AS (
  SELECT s.*,
         SUM(SpanDurSec) OVER (PARTITION BY s.WorkShopID,s.WorkCenterID
                               ORDER BY s.SpanStart) - s.SpanDurSec AS CumStartSec,
         SUM(SpanDurSec) OVER (PARTITION BY s.WorkShopID,s.WorkCenterID
                               ORDER BY s.SpanStart)                 AS CumEndSec
  FROM Spans s
),
B AS (
  SELECT WorkShopID,WorkCenterID,
         MIN(SpanStart) AS DayStart, MAX(SpanEnd) AS DayEnd,
         MAX(CumEndSec) AS DayWorkSec
  FROM S
  GROUP BY WorkShopID,WorkCenterID
),
P0 AS (
  SELECT
    p.OnlyDate,
    TRIM(REPLACE(p.WorkShopID,  CHAR(160),' '))  AS WorkShopID,
    TRIM(REPLACE(p.WorkCenterID,CHAR(160),' '))  AS WorkCenterID,
    p.Line_No, p.OrderNumber, p.NomenclatureNumber,
    p.NormOrder, p.NormArticle,
    CAST(p.Plan_QTY      AS decimal(18,4)) AS Plan_QTY,
    CAST(p.PlanRealHours AS decimal(18,4)) AS PlanRealHours,
    CAST(CASE WHEN COALESCE(p.PlanRealHours,0)<=0 OR COALESCE(p.Plan_QTY,0)<=0
              THEN 0 ELSE CEILING(p.PlanRealHours*3600.0) END AS int) AS PlanDurSec
  FROM Production_TV.Cache_Plan_Base p
  CROSS JOIN norm n
  WHERE p.OnlyDate = @date
    AND (n.ws IS NULL OR TRIM(REPLACE(p.WorkShopID,  CHAR(160),' ')) = n.ws)
    AND (n.wc IS NULL OR TRIM(REPLACE(p.WorkCenterID,CHAR(160),' ')) = n.wc)
),
P AS (SELECT * FROM P0 WHERE PlanDurSec>0),
Seq AS (
  SELECT P.*,
         SUM(P.PlanDurSec) OVER (PARTITION BY P.WorkShopID,P.WorkCenterID
                                 ORDER BY P.Line_No) - P.PlanDurSec AS StartOffSec
  FROM P
),
Opt AS (
  SELECT ISNULL(MAX(TRY_CONVERT(int,SettingValue)),0)*60 AS GraceSec
  FROM Production_TV.Settings
  WHERE SettingKey=N'OverflowGraceMinutes'
),
Mark AS (
  SELECT q.*, b.DayStart,b.DayEnd,b.DayWorkSec, o.GraceSec,
         CASE WHEN b.DayWorkSec>0 THEN q.StartOffSec % b.DayWorkSec ELSE 0 END AS StartMod,
         CASE WHEN b.DayWorkSec>0 THEN (q.StartOffSec % b.DayWorkSec)+q.PlanDurSec ELSE q.PlanDurSec END AS FinishRaw,
         CASE WHEN b.DayWorkSec>0
              THEN CASE WHEN (q.StartOffSec % b.DayWorkSec)+q.PlanDurSec
                          <= b.DayWorkSec + o.GraceSec THEN 0 ELSE 1 END
              ELSE 0 END AS NeedsMove
  FROM Seq q
  JOIN B b ON b.WorkShopID=q.WorkShopID AND b.WorkCenterID=q.WorkCenterID
  CROSS JOIN Opt o
),
-- 1) Был ли перенос раньше по линии?
Chain AS (
  SELECT m.*,
         MAX(CASE WHEN m.NeedsMove=1 THEN 1 ELSE 0 END)
           OVER (PARTITION BY m.WorkShopID,m.WorkCenterID
                 ORDER BY m.Line_No
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS AnyMoveBefore
  FROM Mark m
),
-- 2) Эффективный перенос: переполнение ИЛИ после первого переноса
Eff AS (
  SELECT c.*,
         CASE WHEN c.NeedsMove=1 OR c.AnyMoveBefore=1 THEN 1 ELSE 0 END AS IsMoveEff
  FROM Chain c
),
-- 3) Накопленная длительность по эффективно перенесённым ДО текущей
EffCarry AS (
  SELECT e.*,
         SUM(CASE WHEN e.IsMoveEff=1 THEN e.PlanDurSec ELSE 0 END)
           OVER (PARTITION BY e.WorkShopID,e.WorkCenterID
                 ORDER BY e.Line_No
                 ROWS UNBOUNDED PRECEDING)
         - CASE WHEN e.IsMoveEff=1 THEN e.PlanDurSec ELSE 0 END AS EffMovedBeforeAbs
  FROM Eff e
),
-- 4) Старт/к
```

---

## Production_TV.fn_Plan_AsOf `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_Plan_AsOf
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256),
    @asof       datetime2(0)
)
RETURNS TABLE
AS
RETURN
WITH Slots AS (
    SELECT *
    FROM Production_TV.Cache_OrderSlots
    WHERE OnlyDate = @date
      AND (@workshop   IS NULL OR WorkShopID   = @workshop)
      AND (@workcenter IS NULL OR WorkCenterID = @workcenter)
),
Spans AS (
    SELECT *
    FROM Production_TV.fn_WorkingSpans_Day(@date, @workshop, @workcenter)
),
Capped AS (
    SELECT
        s.*,
        CASE WHEN @asof < s.SlotStart THEN s.SlotStart ELSE @asof END AS AsOfCapped
    FROM Slots s
),
Elapsed AS (
    SELECT
        c.OnlyDate, c.WorkShopID, c.WorkCenterID,
        c.Line_No, c.OrderNumber, c.NomenclatureNumber,
        c.NormOrder, c.NormArticle,
        c.Plan_QTY, c.PlanRealHours,
        c.SlotStart, c.SlotEnd,
        SUM(
            CASE
              WHEN sp.SpanEnd   > c.SlotStart
               AND sp.SpanStart < c.AsOfCapped
              THEN DATEDIFF(SECOND,
                            CASE WHEN sp.SpanStart > c.SlotStart THEN sp.SpanStart ELSE c.SlotStart END,
                            CASE WHEN sp.SpanEnd   < c.AsOfCapped THEN sp.SpanEnd   ELSE c.AsOfCapped END)
              ELSE 0
            END
        ) AS ElapsedWorkSec
    FROM Capped c
    LEFT JOIN Spans sp
      ON sp.WorkShopID   = c.WorkShopID
     AND sp.WorkCenterID = c.WorkCenterID
    GROUP BY
        c.OnlyDate, c.WorkShopID, c.WorkCenterID,
        c.Line_No, c.OrderNumber, c.NomenclatureNumber,
        c.NormOrder, c.NormArticle,
        c.Plan_QTY, c.PlanRealHours,
        c.SlotStart, c.SlotEnd,
        c.AsOfCapped
),
Result AS (
    SELECT
        e.*,
        CAST(e.Plan_QTY AS decimal(18,6))
        / NULLIF(CAST(e.PlanRealHours*3600.0 AS decimal(18,6)), 0) AS PlanRatePcsPerSec,
        CASE
          WHEN @asof < e.SlotStart THEN CAST(0 AS decimal(18,4))
          WHEN @asof >= e.SlotEnd   THEN CAST(e.Plan_QTY AS decimal(18,4))
          ELSE
            ( CAST(e.Plan_QTY AS decimal(18,6))
              / NULLIF(CAST(e.PlanRealHours*3600.0 AS decimal(18,6)), 0)
            ) * CAST(e.ElapsedWorkSec AS decimal(18,6))
        END AS PlanAsOfQty
    FROM Elapsed e
)
SELECT
    OnlyDate, WorkShopID, WorkCenterID,
    Line_No, OrderNumber, NomenclatureNumber,
    NormOrder, NormArticle,
    Plan_QTY, PlanRealHours,
    SlotStart, SlotEnd,
    PlanAsOfQty
FROM Result
```

---

## Production_TV.fn_Plan_Base `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_Plan_Base
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256)
)
RETURNS TABLE
AS
RETURN
SELECT
    OnlyDate,
    WorkShopID,
    WorkCenterID,
    Line_No,
    OrderNumber,
    NomenclatureNumber,
    ProductName_CN,
    Plan_QTY,
    PlanRealHours,
    NormOrder,
    NormArticle
FROM Production_TV.Cache_Plan_Base
WHERE OnlyDate = @date
  AND (@workshop   IS NULL OR WorkShopID   = @workshop)
  AND (@workcenter IS NULL OR WorkCenterID = @workcenter)
```

---

## Production_TV.fn_TV_Final `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_TV_Final
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256),
    @asof       datetime2(0)
)
RETURNS TABLE
AS
RETURN
WITH
PA AS (  -- план со слотами и Plan(as of)
    SELECT *
    FROM Production_TV.fn_Plan_AsOf(@date, @workshop, @workcenter, @asof)
),
FD AS (  -- дневной факт
    SELECT *
    FROM Production_TV.fn_Fact_Day(@date, @workshop, @workcenter)
),
FT AS (  -- фактический такт
    SELECT *
    FROM Production_TV.fn_Fact_Takt(@date, @workshop, @workcenter)
),
NM AS (  -- имя изделия по артикулу
    SELECT *
    FROM Production_TV.fn_Name_ByArticle(@date, @workshop, @workcenter)
),

-- минимум строки для КАЖДОГО заказа (чтобы факт был только на первой строке)
MinLinePerKey AS (
    SELECT p.OnlyDate, p.WorkCenterID, p.OrderNumber, p.NomenclatureNumber,
           MIN(p.Line_No) AS MinLineNo
    FROM PA p
    GROUP BY p.OnlyDate, p.WorkCenterID, p.OrderNumber, p.NomenclatureNumber
),

-- ФАКТ-БЕЗ-ПЛАНА: убираем размножение через WorkSchedules_ByDay
-- Берём РОВНО ОДИН WorkShopID по (дата, РЦ) через OUTER APPLY + allowlist + DeleteMark=0
FactOnly AS (
    SELECT
        fd.OnlyDate,
        COALESCE(wsbd.WorkShopID, @workshop)         AS WorkShopID,
        fd.WorkCenterID,
        CAST(NULL AS datetime2(0))                    AS SlotStart,
        CAST(NULL AS datetime2(0))                    AS SlotEnd,
        CAST(NULL AS nvarchar(20))                    AS TimeSlot,
        fd.OrderNumberRaw                             AS [Order No],
        fd.ArticleNumberRaw                           AS [Article Number],
        fd.NormOrder,
        fd.NormArticle,
        nm.[Name],
        CAST(NULL AS bigint)                          AS [Total Plan],
        CAST(NULL AS bigint)                          AS [Plan],
        fd.FactQtyDay                                 AS [Fact],
        CAST(NULL AS decimal(10,2))                   AS [TaktPlanSec],
        CAST(ft.TaktFactSec AS decimal(10,2))         AS [TaktFactSec]
    FROM FD fd
    OUTER APPLY (
        SELECT TOP (1) w.WorkShopID
        FROM TimeLoss.WorkSchedules_ByDay w
        JOIN Production_TV.Workshops_Allowlist wa
          ON wa.WorkShopID = w.WorkShopID
         AND wa.IsEnabled  = 1
        WHERE w.OnlyDate    = fd.OnlyDate
          AND w.WorkCenterID= fd.WorkCenterID
          AND w.DeleteMark  = 0
        ORDER BY w.WorkShopID
    ) wsbd
    LEFT JOIN FT ft
      ON ft.OnlyDate   = fd.OnlyDate
     AND ft.WorkCenterID = fd.WorkCenterID
     AND ft.NormOrder    = fd.NormOrder
     AND ft.NormArticle  = fd.NormArticle
    LEFT JOIN NM nm
      ON nm.OnlyDate     = fd.OnlyDate
     AND nm.WorkCenterID = fd.WorkCenterID
     AND nm.NormArticle  = fd.NormArticle
    WHERE NOT EXISTS (
        SELECT 1
        FROM PA p
        WHERE p.OnlyDate        = fd.OnlyDate
          AND p.WorkCenterID    = fd.WorkCenterID
          AND p.OrderNumber     = fd.OrderNumberRaw
          AND p.NomenclatureNumber = fd.ArticleNumberRaw
    )
),

-- ПЛАНОВЫЕ СТРОКИ: факт только на первой строке заказа
Planned AS (
    SELECT
      pa.OnlyDate, pa.WorkShopID, pa.WorkCenterID,
      pa.SlotStart, pa.SlotEnd,
      RIGHT('0'+CAST(DATEPART(HOUR,pa.SlotStart) AS varchar(2)),2)+':' +
      RIGHT('0'+CAST(DATEPART(MINUTE,pa.SlotStart) AS varchar(2)),2)+N'-' +
      RIGHT('0'+CAST(DATEPART(HOUR,pa.SlotEnd) AS varchar(2)),2)+':' +
      RIGHT('0'+CAST(DATEPART(MINUTE,pa.SlotEnd) AS varchar(2)),2) AS TimeSlot,
      pa.OrderNumber        AS [Order No],
      pa.NomenclatureNumber AS [Article Number],
      nm.[Name],
      pa.Plan_QTY                               AS [Total Plan],
      CAST(ROUND(pa.PlanAsOfQty,0) AS bigint)   AS [Plan],
      CAST(CASE
             WHEN fd.FactQtyDay IS NULL THEN 0
             WHEN pa.Line_No = ml.MinLineNo THEN fd.FactQtyDay
             ELSE 0
           END AS bigint)
```

---

## Production_TV.fn_TV_Hourly `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_TV_Hourly
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256)
)
RETURNS TABLE
AS
RETURN
WITH WS AS (
  SELECT MIN(SpanStart) AS ShiftStart, MAX(SpanEnd) AS ShiftEnd
  FROM Production_TV.fn_WorkingSpans_Day(@date, @workshop, @workcenter)
),
FactScope AS (
  SELECT f.ScanMinute, f.Scan_QTY, f.WorkCenter_CN
  FROM Import_1C.vw_FactScan_OnAssembly_Current f
  WHERE f.OnlyDate = @date
    AND (@workcenter IS NULL OR f.WorkCenter_CN = @workcenter)
    AND (
         @workshop IS NULL
         OR EXISTS (
            SELECT 1
            FROM TimeLoss.WorkSchedules_ByDay w
            JOIN Production_TV.Workshops_Allowlist wa
              ON wa.WorkShopID = w.WorkShopID AND wa.IsEnabled = 1
            WHERE w.OnlyDate = @date
              AND w.WorkCenterID = f.WorkCenter_CN
              AND w.WorkShopID = @workshop
              AND w.DeleteMark = 0
         )
    )
),
-- ID из смены (если параметры не заданы)
SpanIDs AS (
  SELECT TOP (1) s.WorkShopID, s.WorkCenterID
  FROM Production_TV.fn_WorkingSpans_Day(@date, @workshop, @workcenter) s
  ORDER BY s.WorkShopID, s.WorkCenterID
),
-- Фолбэк: ID по факту (ищем разрешённый цех для данного РЦ)
FactIDs AS (
  SELECT TOP (1) w.WorkShopID, f.WorkCenter_CN AS WorkCenterID
  FROM FactScope f
  JOIN TimeLoss.WorkSchedules_ByDay w
    ON w.OnlyDate = @date
   AND w.WorkCenterID = f.WorkCenter_CN
   AND w.DeleteMark = 0
  JOIN Production_TV.Workshops_Allowlist wa
    ON wa.WorkShopID = w.WorkShopID AND wa.IsEnabled = 1
  ORDER BY w.WorkShopID
),
IDs AS (
  SELECT
    COALESCE(NULLIF(@workshop,N''),  (SELECT WorkShopID  FROM SpanIDs),
             (SELECT WorkShopID  FROM FactIDs))  AS WorkShopID,
    COALESCE(NULLIF(@workcenter,N''),(SELECT WorkCenterID FROM SpanIDs),
             (SELECT WorkCenterID FROM FactIDs)) AS WorkCenterID
),
MM AS (
  SELECT MIN(ScanMinute) AS MinScan, MAX(ScanMinute) AS MaxScan FROM FactScope
),
AxisRaw AS (
  SELECT
    CASE
      WHEN WS.ShiftStart IS NULL THEN MM.MinScan
      WHEN MM.MinScan  IS NULL THEN WS.ShiftStart
      WHEN MM.MinScan < WS.ShiftStart THEN MM.MinScan ELSE WS.ShiftStart
    END AS StartDT,
    CASE
      WHEN WS.ShiftEnd IS NULL THEN MM.MaxScan
      WHEN MM.MaxScan  IS NULL THEN WS.ShiftEnd
      WHEN MM.MaxScan > WS.ShiftEnd THEN MM.MaxScan ELSE WS.ShiftEnd
    END AS EndDT
  FROM WS CROSS JOIN MM
),
Axis AS (
  SELECT
    DATEADD(HOUR, DATEDIFF(HOUR, 0, StartDT), 0) AS AxisStart,
    CASE WHEN DATEADD(HOUR, DATEDIFF(HOUR,0,EndDT), 0) = EndDT
         THEN EndDT
         ELSE DATEADD(HOUR, DATEDIFF(HOUR,0,EndDT)+1, 0)
    END AS AxisEnd
  FROM AxisRaw
),
Hours AS (
  SELECT a.AxisStart AS HourStart, DATEADD(HOUR,1,a.AxisStart) AS HourEnd
  FROM Axis a
  WHERE a.AxisStart IS NOT NULL AND a.AxisEnd IS NOT NULL
  UNION ALL
  SELECT DATEADD(HOUR,1,HourStart), DATEADD(HOUR,2,HourStart)
  FROM Hours h
  CROSS JOIN Axis a
  WHERE DATEADD(HOUR,1,h.HourStart) < a.AxisEnd
),
PlanCum AS (
  SELECT h.HourStart, h.HourEnd,
         SUM(pa.PlanAsOfQty) AS PlanAsOf
  FROM Hours h
  CROSS APPLY Production_TV.fn_Plan_AsOf(@date, (SELECT WorkShopID FROM IDs), (SELECT WorkCenterID FROM IDs), h.HourEnd) pa
  GROUP BY h.HourStart, h.HourEnd
),
PlanHour AS (
  SELECT
    HourStart, HourEnd,
    CAST(ROUND(PlanAsOf - LAG(PlanAsOf,1,0) OVER(ORDER BY HourEnd),0) AS bigint) AS PlanQty
  FROM PlanCum
),
FactHour AS (
  SELECT h.HourStart, h.HourEnd,
         CAST(COALESCE(SUM(f.Scan_QTY),0) AS bigint) AS FactQty
  FROM Hours h
  LEFT JOIN FactScope f
    ON f.ScanMinute >= h.HourStart AND f.ScanMinute < h.HourEnd
  GROUP BY h.HourStart, h.HourEnd
)
SELECT
  (SELECT WorkShopID  FROM IDs) AS WorkShopID,
  (SELECT WorkCenterID FROM IDs) AS WorkCenterID,
  h.HourStart,
  RIGHT('0'+CAST(DATEPART(HOUR,h.HourStart) AS varchar(2)),2)+N':00' AS HourLabel,
  COALESCE(p.PlanQty,0) AS Pla
```

---

## Production_TV.fn_TV_Workcenter_Downtime_Day `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_TV_Workcenter_Downtime_Day
(
    @OnlyDate          date,
    @WorkCenterID      nvarchar(256) = NULL,
    @ThresholdMinutes  int = 5,
    @AsOf              datetime2(0) = NULL
)
RETURNS TABLE
AS
RETURN
WITH CA AS (
    SELECT CAST(COALESCE(
             @AsOf,
             CONVERT(datetime2(0),(SYSUTCDATETIME() AT TIME ZONE 'UTC') AT TIME ZONE 'China Standard Time')
           ) AS datetime2(0)) AS asof,
           @ThresholdMinutes AS thr
),
-- 1) Рабочие окна дня (distinct)
W AS (
    SELECT w.OnlyDate, w.WorkCenterID, w.SpanStart, w.SpanEnd,
           ROW_NUMBER() OVER (PARTITION BY w.OnlyDate, w.WorkCenterID ORDER BY w.SpanStart, w.SpanEnd) AS WinID
    FROM (
      SELECT DISTINCT OnlyDate, WorkCenterID, SpanStart, SpanEnd
      FROM Production_TV.Cache_WorkingSpans_Day
      WHERE OnlyDate=@OnlyDate AND (@WorkCenterID IS NULL OR WorkCenterID=@WorkCenterID)
    ) w
),
-- 2) Перерывы между окнами (для статуса Break)
Breaks AS (
    SELECT OnlyDate, WorkCenterID,
           SpanEnd AS BreakStart,
           LEAD(SpanStart) OVER (PARTITION BY OnlyDate, WorkCenterID ORDER BY SpanStart, SpanEnd) AS BreakEnd
    FROM W
),
-- 3) Окна, обрезанные по @AsOf (для расчёта «до сейчас»)
Wcut AS (
    SELECT w.OnlyDate, w.WorkCenterID, w.WinID, w.SpanStart,
           CASE WHEN ca.asof >= w.SpanEnd THEN w.SpanEnd ELSE ca.asof END AS SpanEndEff
    FROM W w CROSS JOIN CA
    WHERE ca.asof > w.SpanStart
),
-- 4) Минутная линейка
Tally AS (SELECT TOP (2000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n FROM sys.all_objects),
Wmin AS (
    SELECT c.OnlyDate, c.WorkCenterID, c.WinID,
           DATEADD(MINUTE, n, DATEADD(MINUTE, DATEDIFF(MINUTE,0,c.SpanStart),0)) AS MinTick
    FROM Wcut c
    JOIN Tally t ON t.n < DATEDIFF(MINUTE, c.SpanStart, c.SpanEndEff)
),
-- 5) Сканы (нормализованные до минут) внутри Wcut
S AS (
    SELECT DISTINCT c.OnlyDate, c.WorkCenterID, c.WinID,
           DATEADD(MINUTE, DATEDIFF(MINUTE,0,fs.ScanMinute),0) AS ScanMin
    FROM Wcut c
    JOIN Import_1C.vw_FactScan_OnAssembly_Current fs
      ON fs.OnlyDate=c.OnlyDate
     AND fs.WorkCenter_CN=c.WorkCenterID
     AND fs.ScanMinute>=c.SpanStart AND fs.ScanMinute<c.SpanEndEff
),
-- 6) Пустые минуты подряд → интервалы «тишины»
BlankMin AS (
    SELECT w.OnlyDate,w.WorkCenterID,w.WinID,w.MinTick,
           CASE WHEN s.ScanMin IS NULL THEN 1 ELSE 0 END AS IsBlank
    FROM Wmin w
    LEFT JOIN S s ON s.OnlyDate=w.OnlyDate AND s.WorkCenterID=w.WorkCenterID AND s.WinID=w.WinID AND s.ScanMin=w.MinTick
),
BlankRuns AS (
    SELECT b.OnlyDate,b.WorkCenterID,b.WinID,b.MinTick,
           DATEDIFF(MINUTE,'20010101',b.MinTick)
           - ROW_NUMBER() OVER (PARTITION BY b.OnlyDate,b.WorkCenterID,b.WinID ORDER BY b.MinTick) AS grp
    FROM BlankMin b WHERE b.IsBlank=1
),
RunsAgg AS (
    SELECT OnlyDate,WorkCenterID,WinID,MIN(MinTick) AS RunStart,MAX(MinTick) AS RunEnd,COUNT(*) AS RunLen
    FROM BlankRuns
    GROUP BY OnlyDate,WorkCenterID,WinID,grp
),
GapsLong AS (  -- > порога
    SELECT OnlyDate,WorkCenterID,WinID,RunStart,DATEADD(MINUTE,RunLen,RunStart) AS RunEnd,RunLen
    FROM RunsAgg CROSS JOIN CA
    WHERE RunLen > CA.thr
),
-- 7) «До сейчас» и простои (по РЦ)
WinToNow AS (SELECT OnlyDate,WorkCenterID,COUNT(*) AS WindowMinutesToNow FROM Wmin GROUP BY OnlyDate,WorkCenterID),
GapsAggDay AS (
    SELECT OnlyDate,WorkCenterID,SUM(RunLen) AS DowntimeMinutesRaw,COUNT(*) AS GapsCount,MAX(RunLen) AS MaxGapMinutes
    FROM GapsLong GROUP BY OnlyDate,WorkCenterID
),
S_AggDay AS (
    SELECT OnlyDate,WorkCenterID,MIN(ScanMin) AS FirstScanAt,MAX(ScanMin) AS LastScanAt
    FROM S GROUP BY OnlyDate,WorkCenterID
),
AggFull AS (
    SELECT w.OnlyDate,w.WorkCenterID,
           SUM(DATEDIFF(MINUTE,w.SpanStart,w.SpanEnd)) AS ProductionWindowMinutes,
           MIN(w.SpanStart) AS FirstWindowStart,
           MAX(w.SpanEnd)   AS LastWindowEnd
    F
```

---

## Production_TV.fn_WorkingSpans_Day `(FUNCTION)`

```sql
CREATE   FUNCTION Production_TV.fn_WorkingSpans_Day
(
    @date       date,
    @workshop   nvarchar(256),
    @workcenter nvarchar(256)
)
RETURNS TABLE
AS
RETURN
SELECT
    WorkShopID,
    WorkCenterID,
    SpanStart,
    SpanEnd
FROM Production_TV.Cache_WorkingSpans_Day
WHERE OnlyDate = @date
  AND (@workshop   IS NULL OR WorkShopID   = @workshop)
  AND (@workcenter IS NULL OR WorkCenterID = @workcenter)
```

---

## TimeLoss.fn_ScheduleWorkMinutes `(FUNCTION)`

```sql
CREATE   FUNCTION TimeLoss.fn_ScheduleWorkMinutes
(
    @ScheduleID NVARCHAR(128)
)
RETURNS INT
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @work   INT = 0;
    DECLARE @breaks INT = 0;

    SELECT
        @work   = COALESCE(SUM(CASE WHEN st.TypeID = N'WORKSHIFT' THEN st.SpanMinutes ELSE 0 END), 0),
        @breaks = COALESCE(SUM(CASE WHEN st.TypeID = N'BREAKS'    THEN st.SpanMinutes ELSE 0 END), 0)
    FROM TimeLoss.Working_ScheduleType AS st
    WHERE st.ScheduleID = @ScheduleID;

    DECLARE @result INT = @work - @breaks;
    IF @result < 0 SET @result = 0;
    RETURN @result;
END
```

---


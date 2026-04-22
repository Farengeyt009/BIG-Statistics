# Представления (Views)

> Сгенерировано: 2026-04-08 21:13

## Содержание

- [Analytics.OrderTails](#analytics_ordertails)
- [Error_check.vw_Check_Nomenclature_Duplicates](#error_check_vw_check_nomenclature_duplicates)
- [Error_check.vw_CheckFactQTY](#error_check_vw_checkfactqty)
- [Error_check.vw_CheckProduct_Guide](#error_check_vw_checkproduct_guide)
- [Error_check.vw_Daily_PlanFact_Checks](#error_check_vw_daily_planfact_checks)
- [Error_check.vw_FactScan_OnAssembly_Checks](#error_check_vw_factscan_onassembly_checks)
- [Error_check.vw_Order_1C_v2_Checks](#error_check_vw_order_1c_v2_checks)
- [Error_check.vw_Order_1C_v2_RepeatDouble](#error_check_vw_order_1c_v2_repeatdouble)
- [Error_check.vw_Shipments_Checks](#error_check_vw_shipments_checks)
- [Import_1C.vw_Daily_PlanFact_Current](#import_1c_vw_daily_planfact_current)
- [Import_1C.vw_FactScan_OnAssembly_Current](#import_1c_vw_factscan_onassembly_current)
- [Import_1C.vw_Import_BOM_Current](#import_1c_vw_import_bom_current)
- [Import_1C.vw_Labor_Cost_Current](#import_1c_vw_labor_cost_current)
- [Import_1C.vw_Materials_Move_Current](#import_1c_vw_materials_move_current)
- [Import_1C.vw_Nomenclature_Reference_Current](#import_1c_vw_nomenclature_reference_current)
- [Import_1C.vw_Order_1C_v2_Current](#import_1c_vw_order_1c_v2_current)
- [Import_1C.vw_Outsource_Price_Current](#import_1c_vw_outsource_price_current)
- [Import_1C.vw_Price_List_Current](#import_1c_vw_price_list_current)
- [Import_1C.vw_QC_Cards_Current](#import_1c_vw_qc_cards_current)
- [Import_1C.vw_QC_Journal_Current](#import_1c_vw_qc_journal_current)
- [Import_1C.vw_Shipments_Current](#import_1c_vw_shipments_current)
- [Orders.Orders_1C_Svod](#orders_orders_1c_svod)
- [Orders.ShipmentData_Table](#orders_shipmentdata_table)
- [Orders.ShipmentPlan_Fact](#orders_shipmentplan_fact)
- [Orders.vw_SalesPlan_Details](#orders_vw_salesplan_details)
- [QC.Plastic_Weight_Summary](#qc_plastic_weight_summary)
- [QC.Stamping_Weight_Summary](#qc_stamping_weight_summary)
- [QC.vw_Production_vs_Defects](#qc_vw_production_vs_defects)
- [QC.vw_Stamping_Output](#qc_vw_stamping_output)
- [TimeLoss.vw_EntryGrid](#timeloss_vw_entrygrid)
- [TimeLoss.vw_Working_Schedule_Flat](#timeloss_vw_working_schedule_flat)
- [Views_For_Plan.DailyPlan_CustomWS](#views_for_plan_dailyplan_customws)
- [Views_For_Plan.Fact_AssemblyOnly](#views_for_plan_fact_assemblyonly)
- [Views_For_Plan.Month_Plan](#views_for_plan_month_plan)
- [Views_For_Plan.Month_PlanFact_Gantt](#views_for_plan_month_planfact_gantt)
- [Views_For_Plan.Month_PlanFact_Summary](#views_for_plan_month_planfact_summary)

---

<a name="analytics_ordertails"></a>

## Analytics.OrderTails

```sql
CREATE   VIEW Analytics.OrderTails
AS
/* ── 0. Параметры ───────────────────────────────────────────────────────── */
WITH Params AS (SELECT CAST(2 AS INT) AS MaxGap),

/* ── 1. Факт за день ────────────────────────────────────────────────────── */
DataSrc AS (
    SELECT
        dp.WorkShopName_CH,
        dp.OrderNumber,
        dp.NomenclatureNumber,
        CAST(dp.OnlyDate AS date)               AS OnlyDate,
        COALESCE(dp.Scan_QTY, dp.CloseWork_QTY) AS Fact_QTY
    FROM Import_1C.Daily_PlanFact dp
    WHERE dp.WorkShopName_CH IN (N'装配车间', N'热水器总装组')
      AND COALESCE(dp.Scan_QTY, dp.CloseWork_QTY) IS NOT NULL
),

/* ── 2. План‑объём по заказу ────────────────────────────────────────────── */
PlanSrc AS (
    SELECT
        o.Order_No        AS OrderNumber,
        o.Article_number  AS NomenclatureNumber,
        o.TotalWork_QTY   AS Total_QTY
    FROM Import_1C.Order_1C_v2 o
),

/* ── 3. Кумулятивный факт ──────────────────────────────────────────────── */
FactAgg AS (
    SELECT
        d.WorkShopName_CH,
        d.OrderNumber,
        d.NomenclatureNumber,
        SUM(d.Fact_QTY) AS FactTotal_QTY
    FROM DataSrc d
    GROUP BY d.WorkShopName_CH, d.OrderNumber, d.NomenclatureNumber
),

/* ── 4. Соседние даты для поиска разрывов ──────────────────────────────── */
Ordered AS (
    SELECT d.*,
           LAG(d.OnlyDate) OVER (
             PARTITION BY d.WorkShopName_CH, d.OrderNumber, d.NomenclatureNumber
             ORDER BY d.OnlyDate) AS PrevDate
    FROM DataSrc d
),

/* ── 5. Кандидаты на разрыв > 2 дней ───────────────────────────────────── */
GapCandidates AS (
    SELECT
        o.WorkShopName_CH, o.OrderNumber, o.NomenclatureNumber,
        o.PrevDate,
        o.OnlyDate AS NextDate,
        DATEDIFF(day, o.PrevDate, o.OnlyDate) - 1 AS GapDays
    FROM Ordered o
    JOIN Params p ON 1=1
    WHERE o.PrevDate IS NOT NULL
      AND DATEDIFF(day, o.PrevDate, o.OnlyDate) > p.MaxGap
),

/* ── 6. Оставляем разрывы, где цех точно работал (другие заказы) ───────── */
GapWithOtherProd AS (
    SELECT g.*,
           COUNT(DISTINCT d2.OnlyDate) AS OtherProdDays
    FROM GapCandidates g
    JOIN DataSrc d2
      ON d2.WorkShopName_CH = g.WorkShopName_CH
     AND d2.OnlyDate        > g.PrevDate
     AND d2.OnlyDate        < g.NextDate
     AND (d2.OrderNumber <> g.OrderNumber
       OR d2.NomenclatureNumber <> g.NomenclatureNumber)
    GROUP BY g.WorkShopName_CH, g.OrderNumber, g.NomenclatureNumber,
             g.PrevDate, g.NextDate, g.GapDays
    HAVING COUNT(DISTINCT d2.OnlyDate) > 0
),

/* ── 7. Закрытые хвосты (пауза завершилась) ────────────────────────────── */
ClosedTails AS (
    SELECT
        g.WorkShopName_CH,
        g.OrderNumber,
        g.NomenclatureNumber,
        DATEADD(day, 1, g.PrevDate) AS TailStartDate,
        g.NextDate                  AS TailResolvedDate,
        DATEDIFF(day, DATEADD(day, 1, g.PrevDate), g.NextDate) AS TailIntervalDays
    FROM GapWithOtherProd g
),

/* ── 8. Последний выпуск по заказу ─────────────────────────────────────── */
LastProd AS (
    SELECT
        d.WorkShopName_CH,
        d.OrderNumber,
        d.NomenclatureNumber,
        MAX(d.OnlyDate) AS LastProdDate
    FROM DataSrc d
    GROUP BY d.WorkShopName_CH, d.OrderNumber, d.NomenclatureNumber
),

/* ── 9. Открытые хвосты (не завершены) ─────────────────────────────────── */
OpenTails AS (
    SELECT
        l.WorkShopName_CH,
        l.OrderNumber,
        l.NomenclatureNumber,
        DATEADD(day, 1, l.LastProdDate) AS TailStartDate,
        NULL AS TailResolvedDate,
        DATEDIFF(day, DATEADD(day, 1, l.LastProdDate), CAST(GETDATE() AS date))
            AS TailIntervalDays
    FROM LastProd l
    CROSS JOIN Params p
    WHERE DATEDIFF(day, l.LastProdDate, CAST(GETDATE() AS date)) > p.MaxGap
      AND EXISTS (
            SELECT 1
            FROM DataSrc d2
            WHERE d2.WorkShopName_CH = l.WorkShopName_CH
              AND d2.OnlyDate        > l.LastProdDate
              AND (d2.OrderNumber <>
```

---

<a name="error_check_vw_check_nomenclature_duplicates"></a>

## Error_check.vw_Check_Nomenclature_Duplicates

```sql
CREATE VIEW Error_check.vw_Check_Nomenclature_Duplicates
AS
SELECT
    Delete_Mark,
    Nomenclature_ID,
    COUNT(*) AS Duplicate_Count
FROM Import_1C.vw_Nomenclature_Reference_Current
GROUP BY
    Delete_Mark,
    Nomenclature_ID
HAVING COUNT(*) > 1
```

---

<a name="error_check_vw_checkfactqty"></a>

## Error_check.vw_CheckFactQTY

```sql
---视图vw_CheckFactQTY
CREATE VIEW [Error_check].[vw_CheckFactQTY] AS

-- 第一列：DP_Fact（带条件聚合）
SELECT 
    SUM(CASE WHEN dp.Scan_QTY IS NOT NULL THEN dp.Scan_QTY ELSE dp.CloseWork_QTY END) AS DP_Fact,
    
    -- 第二列：vwDS（带条件聚合）
    (SELECT SUM(ds.FACT_QTY) 
     FROM Views_For_Plan.DailyPlan_CustomWS ds
     WHERE ds.WorkShopName_CH IN (N'装配车间', N'热水器总装组')
       AND ds.WorkCenter_Custom_CN <> N'超声') AS vwDS,
    
    -- 第三列：vwFA（直接聚合）
    (SELECT SUM(fa.FactPcs) 
     FROM Views_For_Plan.Fact_AssemblyOnly fa) AS vwFA,
     
     --第四列：vwMPG
     (SELECT SUM(mpg.FactPcs) 
     FROM Views_For_Plan.Month_PlanFact_Gantt mpg) AS vwMPG,
     
     --第五列：vwMPS
     (SELECT SUM(mps.FactQty) 
     FROM Views_For_Plan.Month_PlanFact_Summary mps) AS vwMPS

FROM Import_1C.Daily_PlanFact dp
WHERE dp.WorkShopName_CH IN (N'装配车间', N'热水器总装组')
  AND dp.WorkCentorGroup_CN <> N'超声';
```

---

<a name="error_check_vw_checkproduct_guide"></a>

## Error_check.vw_CheckProduct_Guide

```sql
CREATE VIEW [Error_check].vw_CheckProduct_Guide AS
SELECT 
    pg.FactoryNumber,
    dup_count.DuplicateCount
    
FROM 
    Ref.Product_Guide pg
INNER JOIN (
    SELECT 
        FactoryNumber, 
        COUNT(*) AS DuplicateCount
    FROM 
        Ref.Product_Guide
    GROUP BY 
        FactoryNumber
    HAVING 
        COUNT(*) > 1
) dup_count 
ON pg.FactoryNumber = dup_count.FactoryNumber;
```

---

<a name="error_check_vw_daily_planfact_checks"></a>

## Error_check.vw_Daily_PlanFact_Checks

```sql
/* Daily_PlanFact: сводная проверка */
CREATE   VIEW Error_check.vw_Daily_PlanFact_Checks
AS
WITH ptr AS (
  SELECT MIN(p.SnapshotID) AS SnapshotID
  FROM Import_1C.SnapshotPointer p
  WHERE p.TableName = 'Import_1C.Daily_PlanFact'
),
counts AS (
  SELECT SnapshotID, COUNT_BIG(*) AS RowsCnt
  FROM Import_1C.Daily_PlanFact
  GROUP BY SnapshotID
)
SELECT
  c.SnapshotID,
  c.RowsCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.Daily_PlanFact WHERE SnapshotID = p.SnapshotID)
       END AS BaseCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.vw_Daily_PlanFact_Current)
       END AS ViewCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.Daily_PlanFact WHERE SnapshotID = p.SnapshotID)
          - (SELECT COUNT_BIG(*) FROM Import_1C.vw_Daily_PlanFact_Current)
       END AS Diff,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN CAST(CASE WHEN (SELECT COUNT_BIG(*) FROM Import_1C.Daily_PlanFact WHERE SnapshotID = p.SnapshotID)
                           = (SELECT COUNT_BIG(*) FROM Import_1C.vw_Daily_PlanFact_Current)
                      THEN 1 ELSE 0 END AS bit)
       END AS IsOK
FROM counts c
CROSS JOIN ptr p
```

---

<a name="error_check_vw_factscan_onassembly_checks"></a>

## Error_check.vw_FactScan_OnAssembly_Checks

```sql
/* FactScan_OnAssembly: сводная проверка */
CREATE   VIEW Error_check.vw_FactScan_OnAssembly_Checks
AS
WITH ptr AS (
  SELECT MIN(p.SnapshotID) AS SnapshotID
  FROM Import_1C.SnapshotPointer p
  WHERE p.TableName = 'Import_1C.FactScan_OnAssembly'
),
counts AS (
  SELECT SnapshotID, COUNT_BIG(*) AS RowsCnt
  FROM Import_1C.FactScan_OnAssembly
  GROUP BY SnapshotID
)
SELECT
  c.SnapshotID,
  c.RowsCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.FactScan_OnAssembly WHERE SnapshotID = p.SnapshotID)
       END AS BaseCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.vw_FactScan_OnAssembly_Current)
       END AS ViewCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.FactScan_OnAssembly WHERE SnapshotID = p.SnapshotID)
          - (SELECT COUNT_BIG(*) FROM Import_1C.vw_FactScan_OnAssembly_Current)
       END AS Diff,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN CAST(CASE WHEN (SELECT COUNT_BIG(*) FROM Import_1C.FactScan_OnAssembly WHERE SnapshotID = p.SnapshotID)
                           = (SELECT COUNT_BIG(*) FROM Import_1C.vw_FactScan_OnAssembly_Current)
                      THEN 1 ELSE 0 END AS bit)
       END AS IsOK
FROM counts c
CROSS JOIN ptr p
```

---

<a name="error_check_vw_order_1c_v2_checks"></a>

## Error_check.vw_Order_1C_v2_Checks

```sql
CREATE VIEW Error_check.vw_Order_1C_v2_Checks
AS
WITH ptr AS (
    /* Текущий снимок из указателя (на всякий берём MIN — как в твоём шаблоне) */
    SELECT MIN(p.SnapshotID) AS SnapshotID
    FROM Import_1C.SnapshotPointer p
    WHERE p.TableName = 'Import_1C.Order_1C_v2'
),
counts AS (
    /* Развёртка по всем снимкам в таргете */
    SELECT SnapshotID, COUNT_BIG(*) AS RowsCnt
    FROM Import_1C.Order_1C_v2
    GROUP BY SnapshotID
)
SELECT
    c.SnapshotID,
    c.RowsCnt,

    /* Сколько строк в базе по текущему снимку */
    CASE WHEN c.SnapshotID = p.SnapshotID
         THEN (SELECT COUNT_BIG(*) FROM Import_1C.Order_1C_v2 WHERE SnapshotID = p.SnapshotID)
    END AS BaseCnt,

    /* Сколько строк показывает view текущего снимка */
    CASE WHEN c.SnapshotID = p.SnapshotID
         THEN (SELECT COUNT_BIG(*) FROM Import_1C.vw_Order_1C_v2_Current)
    END AS ViewCnt,

    /* Разница база(view-pointer) vs view */
    CASE WHEN c.SnapshotID = p.SnapshotID
         THEN (SELECT COUNT_BIG(*) FROM Import_1C.Order_1C_v2 WHERE SnapshotID = p.SnapshotID)
            - (SELECT COUNT_BIG(*) FROM Import_1C.vw_Order_1C_v2_Current)
    END AS Diff,

    /* Итоговый флаг ОК/неОК по текущему снимку */
    CASE WHEN c.SnapshotID = p.SnapshotID
         THEN CAST(CASE WHEN (SELECT COUNT_BIG(*) FROM Import_1C.Order_1C_v2 WHERE SnapshotID = p.SnapshotID)
                             = (SELECT COUNT_BIG(*) FROM Import_1C.vw_Order_1C_v2_Current)
                        THEN 1 ELSE 0 END AS bit)
    END AS IsOK
FROM counts c
CROSS JOIN ptr p
```

---

<a name="error_check_vw_order_1c_v2_repeatdouble"></a>

## Error_check.vw_Order_1C_v2_RepeatDouble

```sql
CREATE VIEW Error_check.vw_Order_1C_v2_RepeatDouble AS
SELECT 
    *
FROM (
    SELECT 
        t.*,
        COUNT(*) OVER (PARTITION BY OrderID, NomenclatureID) AS DuplicateCount
    FROM Import_1C.vw_Order_1C_v2_Current t
) AS sub
WHERE DuplicateCount >= 2;
```

---

<a name="error_check_vw_shipments_checks"></a>

## Error_check.vw_Shipments_Checks

```sql
/* 2) Error-check сводка по Shipments */
CREATE   VIEW Error_check.vw_Shipments_Checks
AS
WITH ptr AS (
  SELECT p.SnapshotID
  FROM Import_1C.SnapshotPointer p
  WHERE p.TableName = 'Import_1C.Shipments'
),
counts AS (
  SELECT SnapshotID, COUNT_BIG(*) AS RowsCnt
  FROM Import_1C.Shipments
  GROUP BY SnapshotID
)
SELECT
  c.SnapshotID,
  c.RowsCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.Shipments WHERE SnapshotID = p.SnapshotID)
       END AS BaseCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.vw_Shipments_Current)
       END AS ViewCnt,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN (SELECT COUNT_BIG(*) FROM Import_1C.Shipments WHERE SnapshotID = p.SnapshotID)
          - (SELECT COUNT_BIG(*) FROM Import_1C.vw_Shipments_Current)
       END AS Diff,
  CASE WHEN c.SnapshotID = p.SnapshotID
       THEN CAST(CASE WHEN (SELECT COUNT_BIG(*) FROM Import_1C.Shipments WHERE SnapshotID = p.SnapshotID)
                           = (SELECT COUNT_BIG(*) FROM Import_1C.vw_Shipments_Current)
                      THEN 1 ELSE 0 END AS bit)
       END AS IsOK
FROM counts c
CROSS JOIN ptr p
```

---

<a name="import_1c_vw_daily_planfact_current"></a>

## Import_1C.vw_Daily_PlanFact_Current

```sql
CREATE   VIEW Import_1C.vw_Daily_PlanFact_Current
AS
SELECT t.*
FROM Import_1C.Daily_PlanFact AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Daily_PlanFact'
 AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_factscan_onassembly_current"></a>

## Import_1C.vw_FactScan_OnAssembly_Current

```sql
CREATE   VIEW Import_1C.vw_FactScan_OnAssembly_Current
AS
SELECT  -- перечисли колонки явно
       *
FROM Import_1C.FactScan_OnAssembly AS t
WHERE t.SnapshotID = (
  SELECT p.SnapshotID
  FROM Import_1C.SnapshotPointer AS p
  WHERE p.TableName = 'Import_1C.FactScan_OnAssembly'
)
```

---

<a name="import_1c_vw_import_bom_current"></a>

## Import_1C.vw_Import_BOM_Current

```sql
-- ========================================
-- VIEW для текущего снимка данных
-- ========================================
CREATE VIEW Import_1C.vw_Import_BOM_Current
AS
SELECT t.*
FROM Import_1C.Import_BOM AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Import_BOM'
 AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_labor_cost_current"></a>

## Import_1C.vw_Labor_Cost_Current

```sql
CREATE VIEW Import_1C.vw_Labor_Cost_Current
AS
SELECT t.*
FROM Import_1C.Labor_Cost AS t
         JOIN Import_1C.SnapshotPointer AS p
              ON p.TableName = 'Import_1C.Labor_Cost'
                  AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_materials_move_current"></a>

## Import_1C.vw_Materials_Move_Current

```sql
-- ── 3. VIEW для текущего снимка ───────────────────────────────
CREATE VIEW Import_1C.vw_Materials_Move_Current
AS
SELECT t.*
FROM Import_1C.Materials_Move AS t
         JOIN Import_1C.SnapshotPointer AS p
              ON p.TableName = 'Import_1C.Materials_Move'
                  AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_nomenclature_reference_current"></a>

## Import_1C.vw_Nomenclature_Reference_Current

```sql
-- ========================================
-- VIEW для текущего снимка данных
-- ========================================
CREATE VIEW Import_1C.vw_Nomenclature_Reference_Current
AS
SELECT t.*
FROM Import_1C.Nomenclature_Reference AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Nomenclature_Reference'
 AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_order_1c_v2_current"></a>

## Import_1C.vw_Order_1C_v2_Current

```sql
CREATE VIEW Import_1C.vw_Order_1C_v2_Current
    AS
        SELECT
            t.Posted,
            t.NomenclatureID,
            t.Security_SchemeID,
            t.Order_StatusID,
            t.ClientID,
            t.OrderID,
            t.ProductionOrderID,
            t.Client,
            t.Security_Scheme,
            t.Order_Delete_Mark,
            t.Order_Status,
            t.OrderDate,
            t.OrderConformDay,
            t.RunOrderDay,
            t.OrderShipmentDay,
            t.OrderShipmentDay_OR_T2,
            t.PlannedShipmentDay,
            t.ProductionOrder,
            t.Order_No,
            t.Article_number,
            t.Name_CN,
            t.Market,
            t.Total_Order_QTY,
            t.ToProduce_QTY,
            t.Cancelled_QTY,
            t.ProdOrder_QTY,
            t.TotalWork_QTY,
            t.CloseWork_QTY,
            t.Scan_QTY,
            t.Shipment_QTY,
            t.CloseWork_StartDay,
            t.CloseWork_FinishDay,
            t.ScanStartDay,
            t.ScanFinishDay,
            t.ShipmentDate,
            t.UnitPrice_Base,
            t.Amount_Base,
            t.PriceTypeID,
            t.PriceTypeName,
            t.CNYRate,
            t.UnitPrice_CNY,
            t.Amount_CNY,
            t.SnapshotID,
            t.SingleDateShipmentFlag,
            -- Новые поля:
            t.IsInternal,
            t.ProductTagRu,
            t.ProductTagZh,
            t.Agent_ID,
            t.Client_Country_ID,
            t.Client_Manager_ID,
            t.Client_Country_Ru,
            t.Client_Country_En,
            t.Client_Manager
        FROM Import_1C.Order_1C_v2 AS t
                 JOIN Import_1C.SnapshotPointer AS p
                      ON p.TableName = 'Import_1C.Order_1C_v2'
                          AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_outsource_price_current"></a>

## Import_1C.vw_Outsource_Price_Current

```sql
-- ========================================
-- VIEW для текущего снимка данных
-- ========================================
CREATE VIEW Import_1C.vw_Outsource_Price_Current
AS
SELECT t.*
FROM Import_1C.Outsource_Price AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Outsource_Price'
 AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_price_list_current"></a>

## Import_1C.vw_Price_List_Current

```sql
-- VIEW
CREATE VIEW Import_1C.vw_Price_List_Current
AS
SELECT t.*
FROM Import_1C.Price_List AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Price_List'
 AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_qc_cards_current"></a>

## Import_1C.vw_QC_Cards_Current

```sql
-- ========================================
-- VIEW для текущего снимка данных
-- ========================================
CREATE VIEW Import_1C.vw_QC_Cards_Current
AS
SELECT t.*
FROM Import_1C.QC_Cards AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.QC_Cards'
 AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_qc_journal_current"></a>

## Import_1C.vw_QC_Journal_Current

```sql
-- ========================================
-- VIEW для текущего снимка данных
-- ========================================
CREATE VIEW Import_1C.vw_QC_Journal_Current
AS
SELECT t.*
FROM Import_1C.QC_Journal AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.QC_Journal'
 AND t.SnapshotID = p.SnapshotID
```

---

<a name="import_1c_vw_shipments_current"></a>

## Import_1C.vw_Shipments_Current

```sql
/* 1) Текущий снап для Shipments */
CREATE   VIEW Import_1C.vw_Shipments_Current
AS
SELECT s.*
FROM Import_1C.Shipments AS s
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Shipments'
 AND s.SnapshotID = p.SnapshotID
```

---

<a name="orders_orders_1c_svod"></a>

## Orders.Orders_1C_Svod

```sql
CREATE VIEW Orders.Orders_1C_Svod
    AS
        SELECT
            v.Security_Scheme,
            v.OrderDate,
            v.OrderConformDay,
            v.RunOrderDay,

            CASE
                WHEN v.OrderShipmentDay IS NOT NULL THEN v.OrderShipmentDay
                WHEN v.PlannedShipmentDay IS NOT NULL THEN v.PlannedShipmentDay
                ELSE NULL
                END AS AggregatedShipmentDate,

            v.ProductionOrder,
            ISNULL(v.Market, N'-') AS Market,

            N.Order_No       AS Order_No,
            N.Article_number AS Article_number,

            t2.LargeGroup    AS LargeGroup,
            t2.GroupName     AS GroupName,

            v.Name_CN,
            v.Total_Order_QTY,
            v.ToProduce_QTY,
            v.Cancelled_QTY,
            v.ProdOrder_QTY,
            v.TotalWork_QTY,

            CASE
                WHEN v.CloseWork_QTY IS NULL THEN v.Scan_QTY
                WHEN v.Scan_QTY     IS NULL THEN v.CloseWork_QTY
                WHEN v.CloseWork_QTY > v.Scan_QTY THEN v.CloseWork_QTY
                ELSE v.Scan_QTY
                END AS ProductionFact_QTY,

            ISNULL(v.ToProduce_QTY, 0) - ISNULL(
                    CASE
                        WHEN v.CloseWork_QTY IS NULL THEN v.Scan_QTY
                        WHEN v.Scan_QTY     IS NULL THEN v.CloseWork_QTY
                        WHEN v.CloseWork_QTY > v.Scan_QTY THEN v.CloseWork_QTY
                        ELSE v.Scan_QTY
                        END, 0
                                         ) AS RemainingToProduce_QTY,

            CASE
                WHEN v.CloseWork_QTY IS NULL THEN v.ScanStartDay
                WHEN v.Scan_QTY     IS NULL THEN v.CloseWork_StartDay
                WHEN v.CloseWork_QTY > v.Scan_QTY THEN v.CloseWork_StartDay
                ELSE v.ScanStartDay
                END AS ProductionStartDay,
            CASE
                WHEN v.CloseWork_QTY IS NULL THEN v.ScanFinishDay
                WHEN v.Scan_QTY     IS NULL THEN v.CloseWork_FinishDay
                WHEN v.CloseWork_QTY > v.Scan_QTY THEN v.CloseWork_FinishDay
                ELSE v.ScanFinishDay
                END AS ProductionFinishDay,

            v.Shipment_QTY,
            v.ShipmentDate,
            v.UnitPrice_Base,
            v.Amount_Base,
            v.PriceTypeName,
            v.CNYRate,
            v.UnitPrice_CNY,
            v.Amount_CNY,

            -- Новые поля:
            v.Client,
            v.IsInternal,
            v.ProductTagRu,
            v.ProductTagZh,
            v.Client_Country_Ru,
            v.Client_Country_En,
            v.Client_Manager

        FROM Import_1C.vw_Order_1C_v2_Current AS v

                 CROSS APPLY (
            SELECT
                Order_No =
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                                                            LTRIM(RTRIM(
                                                                    REPLACE(REPLACE(REPLACE(v.Order_No, CHAR(9), ' '), CHAR(160), ' '), CHAR(13), ' ')
                                                                  )),
                                                            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
                Article_number =
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                                                            LTRIM(RTRIM(
                                                                    REPLACE(REPLACE(REPLACE(v.Article_number, CHAR(9), ' '), CHAR(160), ' '), CHAR(13), ' ')
                                                                  )),
                                                            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')
        ) AS N

                 LEFT JOIN Ref.Product_Guide AS t2
                           ON N.Article_number = LTRIM(RTRIM(t2.FactoryNumber))
```

---

<a name="orders_shipmentdata_table"></a>

## Orders.ShipmentData_Table

```sql
CREATE VIEW Orders.ShipmentData_Table
AS
SELECT
    t1.RealizationDoc,
    t1.SpendingOrder_No,
    CAST(t1.RealizationDate_Real    AS date) AS RealizationDate,
    CAST(t1.SpendingOrder_Date_Real AS date) AS SpendingOrder_Date,
    CAST(t1.ShipmentDate_Fact_Real  AS date) AS ShipmentDate_Fact,
    t1.Recipient_Name,
    t1.Partner_Name,
    CASE
        WHEN t1.ShipmentDate_Fact_Real IS NOT NULL
            THEN CAST(t1.ShipmentDate_Fact_Real  AS date)
        ELSE     CAST(t1.SpendingOrder_Date_Real AS date)
        END AS ShipmentDate_Fact_Svod,
    t2.LargeGroup                                    AS LargeGroup,
    t1.OrderNo_SpendingOrder_TableProduct            AS Order_No,
    n.ArticleTrim                                    AS Article_number,
    t2.GroupName                                     AS GroupName,
    t1.Name_CN,
    t1.SpendingOrder_QTY,
    t1.CBM,
    CAST(COALESCE(t1.SpendingOrder_QTY, 0) * COALESCE(t1.CBM, 0) AS DECIMAL(18,6)) AS CBM_Total,
    t1.CI_No,
    t1.ContainerNO_Realization,
    t1.Comment,
    t1.OrderID_SpendingOrder_TableProduct,
    t1.NomenclatureID,
    ISNULL(MK.Market,          N'-') AS Market,
    MK.Security_Scheme,
    MK.ProductTagZh
FROM Import_1C.vw_Shipments_Current AS t1

         CROSS APPLY (
    SELECT
        ArticleTrim =
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                                                    LTRIM(RTRIM(
                                                            REPLACE(REPLACE(REPLACE(t1.Article_number, CHAR(9), ' '),
                                                                            CHAR(160), ' '),
                                                                    CHAR(13), ' ')
                                                          )),
                                                    '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')
) AS n

         LEFT JOIN Ref.Product_Guide AS t2
                   ON n.ArticleTrim = LTRIM(RTRIM(t2.FactoryNumber))

         OUTER APPLY (
    SELECT TOP (1)
        ord.Market,
        ord.Security_Scheme,
        ord.ProductTagZh
    FROM Import_1C.vw_Order_1C_v2_Current AS ord
    WHERE ord.OrderID        = t1.OrderID_SpendingOrder_TableProduct
      AND ord.NomenclatureID = t1.NomenclatureID
) AS MK

WHERE t1.OrderID_SpendingOrder_TableProduct IS NOT NULL
  AND t1.OrderNo_SpendingOrder_TableProduct IS NOT NULL
  AND t1.OrderNo_SpendingOrder_TableProduct <> ''
```

---

<a name="orders_shipmentplan_fact"></a>

## Orders.ShipmentPlan_Fact

```sql
CREATE   VIEW Orders.ShipmentPlan_Fact
AS
WITH Seg AS (
    SELECT DISTINCT
        s.SegmentID, s.YearNum, s.MonthNum, s.WeekNo,
        CAST(s.WeekStartDay  AS date) AS WeekStartDay,
        CAST(s.WeekFinishDay AS date) AS WeekFinishDay
    FROM Ref.WeekSegments AS s
),
Bounds AS (
    SELECT MIN(WeekStartDay) AS DFrom, MAX(WeekFinishDay) AS DTo FROM Seg
),
-- !!! Ровно как в рабочем запросе: ограниченный генератор
Nums AS (
    SELECT TOP (100000) ROW_NUMBER() OVER (ORDER BY (SELECT 0)) - 1 AS n
    FROM sys.all_objects
),
Days AS (
    SELECT DATEADD(DAY, n.n, b.DFrom) AS [Date]
    FROM Bounds b
    JOIN Nums   AS n
      ON n.n BETWEEN 0 AND DATEDIFF(DAY, b.DFrom, b.DTo)
),
DayToSeg AS (
    SELECT
        d.[Date],
        s.SegmentID, s.WeekStartDay, s.WeekFinishDay,
        s.YearNum, s.MonthNum, s.WeekNo,
        ROW_NUMBER() OVER (
            PARTITION BY d.[Date]
            ORDER BY s.WeekStartDay DESC, s.SegmentID
        ) AS rn
    FROM Days d
    JOIN Seg  s
      ON d.[Date] BETWEEN s.WeekStartDay AND s.WeekFinishDay
     AND YEAR(d.[Date]) = s.YearNum
     AND MONTH(d.[Date]) = s.MonthNum
),
MP_Daily AS (
    SELECT CAST([Date] AS date) AS [Date],
           SUM(CAST(MonthPlanPcs AS DECIMAL(19,4))) AS PlanPcs_Day
    FROM Views_For_Plan.Month_Plan
    GROUP BY CAST([Date] AS date)
),
PF_Daily AS (
    SELECT CAST([Date] AS date) AS [Date],
           SUM(CAST(FactPcs AS DECIMAL(19,4))) AS FactPcs_Day
    FROM Views_For_Plan.Fact_AssemblyOnly
    GROUP BY CAST([Date] AS date)
),
Ship_Daily AS (
    SELECT
        CAST(s.ShipmentDate_Fact_Svod AS date) AS [Date],
        SUM(CAST(s.SpendingOrder_QTY AS DECIMAL(19,4))) AS ShipQty_Day
    FROM Orders.ShipmentData_Table AS s
    OUTER APPLY (
        SELECT TOP (1) f.ShouldExclude
        FROM Orders.fn_ShouldExcludeShipmentOrder(s.Order_No) AS f
        ORDER BY (SELECT 0)
    ) AS f
    WHERE ISNULL(f.ShouldExclude, 0) = 0
    GROUP BY CAST(s.ShipmentDate_Fact_Svod AS date)
),
PlanAgg AS (
    SELECT
        p.PeriodID,
        SUM(CAST(p.ShipMonth_PlanPcs   AS DECIMAL(19,4))) AS ShipMonth_PlanPcs,
        SUM(CAST(p.ShipWeek_PlanPcs    AS DECIMAL(19,4))) AS ShipWeek_PlanPcs,
        MAX(CAST(p.FGStockStartWeekPcs AS DECIMAL(19,4))) AS FGStockStartWeekPcs,
        SUM(CAST(p.ContainerQty        AS DECIMAL(19,4))) AS ContainerQty,
        STRING_AGG(NULLIF(LTRIM(RTRIM(p.Comment)), ''), '; ')
            WITHIN GROUP (ORDER BY p.PeriodID) AS Comment
    FROM Orders.Shipment_Plan AS p
    GROUP BY p.PeriodID
)
SELECT
    m.SegmentID         AS PeriodID,
    MIN(m.WeekStartDay) AS WeekStartDay,
    MAX(m.WeekFinishDay)AS WeekFinishDay,
    MAX(m.YearNum)      AS YearNum,
    MAX(m.MonthNum)     AS MonthNum,
    MAX(m.WeekNo)       AS WeekNo,

    CAST(SUM(ISNULL(mp.PlanPcs_Day,0.0)) AS DECIMAL(19,4))             AS MonthPlanPcs_System,
    CAST(SUM(ISNULL(pf.FactPcs_Day,0.0)) AS DECIMAL(19,4))             AS FactQty,
    CAST(SUM(ISNULL(sd.ShipQty_Day,0.0)) AS DECIMAL(19,4))             AS ShipQty,
    CAST(SUM(ISNULL(mp.PlanPcs_Day,0.0)) - SUM(ISNULL(pf.FactPcs_Day,0.0)) AS DECIMAL(19,4)) AS DiffQty,

    pa.ShipMonth_PlanPcs,
    pa.ShipWeek_PlanPcs,
    pa.FGStockStartWeekPcs,
    pa.ContainerQty,
    pa.Comment
FROM DayToSeg AS m
LEFT JOIN MP_Daily   AS mp ON mp.[Date] = m.[Date]
LEFT JOIN PF_Daily   AS pf ON pf.[Date] = m.[Date]
LEFT JOIN Ship_Daily AS sd ON sd.[Date] = m.[Date]
LEFT JOIN PlanAgg    AS pa ON pa.PeriodID = m.SegmentID
WHERE m.rn = 1
GROUP BY m.SegmentID, pa.ShipMonth_PlanPcs, pa.ShipWeek_PlanPcs, pa.FGStockStartWeekPcs, pa.ContainerQty, pa.Comment
```

---

<a name="orders_vw_salesplan_details"></a>

## Orders.vw_SalesPlan_Details

```sql
CREATE VIEW Orders.vw_SalesPlan_Details
AS
SELECT
    d.DetailID,
    d.VersionID,
    d.YearNum,
    d.MonthNum,
    d.Market,
    d.Article_number,
    d.Name,
    d.QTY,
    -- Подтягиваем группы из справочника Ref.Product_Guide
    ISNULL(pg.LargeGroup, N'Non Data') AS LargeGroup,
    ISNULL(pg.GroupName, N'Non Data') AS GroupName,
    -- Метаданные версии
    v.UploadedAt,
    v.UploadedBy,
    v.FileName,
    v.Comment AS VersionComment,
    v.IsActive
FROM Orders.SalesPlan_Details AS d
LEFT JOIN Ref.Product_Guide AS pg
    ON d.Article_number = LTRIM(RTRIM(pg.FactoryNumber))
LEFT JOIN Orders.SalesPlan_Versions AS v
    ON d.VersionID = v.VersionID
```

---

<a name="qc_plastic_weight_summary"></a>

## QC.Plastic_Weight_Summary

```sql
CREATE VIEW QC.Plastic_Weight_Summary AS
WITH Production AS (
    SELECT
        a.OnlyDate                                      AS Date,
        a.WorkShopID,
        a.WorkShopName_CH,
        b.WorkShop_Ru,
        a.NomenclatureID,
        a.NomenclatureNumber,
        a.ProductName_CN,
        SUM(a.FACT_QTY)                                AS FACT_QTY
    FROM Views_For_Plan.DailyPlan_CustomWS AS a
             LEFT JOIN (
        SELECT DISTINCT WorkShop_ID, WorkShop_Ru
        FROM Import_1C.WorkCenter_1C
    ) AS b ON b.WorkShop_ID = a.WorkShopID
    WHERE a.FACT_QTY IS NOT NULL
      AND a.WorkShopID = 0xB5BC00505601355E11EDF92E2C3BF49A
    GROUP BY
        a.OnlyDate, a.WorkShopID, a.WorkShopName_CH, b.WorkShop_Ru,
        a.NomenclatureID, a.NomenclatureNumber, a.ProductName_CN
),
     Defects AS (
         SELECT
             qc.Create_Date                                 AS Date,
             qc.VinovnikDep_ID                              AS WorkShopID,
             qc.VinovnikDep_Zh                              AS WorkShopName_CH,
             b.WorkShop_Ru,
             qc.QC_Card_NomenclatureID                      AS NomenclatureID,
             qc.QC_Card_Nomenclature_No                     AS NomenclatureNumber,
             qc.QC_Card_Nomenclature_Namezh                 AS ProductName_CN,
             SUM(CASE WHEN qc.Defect_TypeID = 0xB3E7C4CBE1AC069511F0711A87DE2892
                          THEN qc.QCCard_QTY ELSE 0 END)    AS Debugging_QTY,
             SUM(CASE WHEN qc.Defect_TypeID <> 0xB3E7C4CBE1AC069511F0711A87DE2892
                 OR qc.Defect_TypeID IS NULL
                          THEN qc.QCCard_QTY ELSE 0 END)    AS QCCard_Others_QTY
         FROM QC.QC_Cards_Summary AS qc
                  LEFT JOIN (
             SELECT DISTINCT WorkShop_ID, WorkShop_Ru
             FROM Import_1C.WorkCenter_1C
         ) AS b ON b.WorkShop_ID = qc.VinovnikDep_ID
         WHERE qc.VinovnikDep_ID       = 0xB5BC00505601355E11EDF92E2C3BF49A
           AND qc.Delete_Mark          = 0x00
           AND qc.QCcardConclusion_No IN (2, 3)
         GROUP BY
             qc.Create_Date, qc.VinovnikDep_ID, qc.VinovnikDep_Zh, b.WorkShop_Ru,
             qc.QC_Card_NomenclatureID,
             qc.QC_Card_Nomenclature_No,
             qc.QC_Card_Nomenclature_Namezh
     )
SELECT
    COALESCE(p.WorkShopID,         d.WorkShopID)         AS WorkShopID,
    COALESCE(p.NomenclatureID,     d.NomenclatureID)     AS NomenclatureID,
    COALESCE(p.Date,               d.Date)               AS Date,
    COALESCE(p.WorkShopName_CH,    d.WorkShopName_CH)    AS WorkShopName_CH,
    COALESCE(p.WorkShop_Ru,        d.WorkShop_Ru)        AS WorkShop_Ru,
    COALESCE(p.NomenclatureNumber, d.NomenclatureNumber) AS NomenclatureNumber,
    COALESCE(p.ProductName_CN,     d.ProductName_CN)     AS ProductName_CN,
    -- Веса на единицу
    wt.Weight_Total,
    wt.Weight_Wastes,
    wt.GP_Weight,
    wt.Snapshot_Date                                                                 AS Weight_Snapshot_Date,
    -- Цена
    COALESCE(price_pmc.Price,         price_mat.Price)                               AS Price,
    COALESCE(price_pmc.PriceTypeName, price_mat.PriceTypeName)                       AS PriceTypeName,
    COALESCE(price_pmc.Price_Date,    price_mat.Price_Date)                          AS Price_Date,
    -- Выпуск
    p.FACT_QTY,
    ISNULL(p.FACT_QTY, 0) * wt.Weight_Total                                         AS WeightTotal_FACT,
    ISNULL(p.FACT_QTY, 0) * COALESCE(price_pmc.Price, price_mat.Price)              AS Cost_FACT,
    -- Отходы (литник)
    ISNULL(p.FACT_QTY, 0) * wt.Weight_Wastes                                        AS WeightWastes_FACT,
    ISNULL(p.FACT_QTY, 0) * wt.Weight_Wastes
        * (COALESCE(price_pmc.Price, price_mat.Price)
        / NULLIF(wt.Weight_Total, 0))                                                AS CostWastes_FACT,
    -- Бр
```

---

<a name="qc_stamping_weight_summary"></a>

## QC.Stamping_Weight_Summary

```sql
CREATE VIEW QC.Stamping_Weight_Summary AS
WITH Production AS (
    SELECT
        a.OnlyDate                                      AS Date,
        a.WorkShopID,
        a.WorkShopName_CH,
        b.WorkShop_Ru,
        a.NomenclatureID,
        a.NomenclatureNumber,
        a.ProductName_CN,
        SUM(a.FACT_QTY)                                AS FACT_QTY
    FROM Views_For_Plan.DailyPlan_CustomWS AS a
             LEFT JOIN (
        SELECT DISTINCT WorkShop_ID, WorkShop_Ru
        FROM Import_1C.WorkCenter_1C
    ) AS b ON b.WorkShop_ID = a.WorkShopID
             LEFT JOIN QC.vw_Stamping_Output AS c
                       ON c.Nomencl_ID = a.NomenclatureID
    WHERE a.FACT_QTY IS NOT NULL
      AND a.WorkShopID = 0xB5BC00505601355E11EDF0AED639127E
      AND c.Nomencl_ID IS NOT NULL
    GROUP BY
        a.OnlyDate, a.WorkShopID, a.WorkShopName_CH, b.WorkShop_Ru,
        a.NomenclatureID, a.NomenclatureNumber, a.ProductName_CN
),
     Defects AS (
         SELECT
             qc.Create_Date                                 AS Date,
             qc.VinovnikDep_ID                              AS WorkShopID,
             qc.VinovnikDep_Zh                              AS WorkShopName_CH,
             b.WorkShop_Ru,
             qc.QC_Card_NomenclatureID                      AS NomenclatureID,
             qc.QC_Card_Nomenclature_No                     AS NomenclatureNumber,
             qc.QC_Card_Nomenclature_Namezh                 AS ProductName_CN,
             SUM(CASE WHEN qc.Defect_TypeID = 0xB3E7C4CBE1AC069511F0711A87DE2892
                          THEN qc.QCCard_QTY ELSE 0 END)        AS Debugging_QTY,
             SUM(CASE WHEN qc.Defect_TypeID <> 0xB3E7C4CBE1AC069511F0711A87DE2892
                 OR qc.Defect_TypeID IS NULL
                          THEN qc.QCCard_QTY ELSE 0 END)        AS QCCard_Others_QTY
         FROM QC.QC_Cards_Summary AS qc
                  LEFT JOIN (
             SELECT DISTINCT WorkShop_ID, WorkShop_Ru
             FROM Import_1C.WorkCenter_1C
         ) AS b ON b.WorkShop_ID = qc.VinovnikDep_ID
         WHERE qc.VinovnikDep_ID       = 0xB5BC00505601355E11EDF0AED639127E
           AND qc.Delete_Mark          = 0x00
           AND qc.QCcardConclusion_No IN (2, 3)
         GROUP BY
             qc.Create_Date, qc.VinovnikDep_ID, qc.VinovnikDep_Zh, b.WorkShop_Ru,
             qc.QC_Card_NomenclatureID,
             qc.QC_Card_Nomenclature_No,
             qc.QC_Card_Nomenclature_Namezh
     )
SELECT
    COALESCE(p.WorkShopID,         d.WorkShopID)         AS WorkShopID,
    COALESCE(p.NomenclatureID,     d.NomenclatureID)     AS NomenclatureID,
    COALESCE(p.Date,               d.Date)               AS Date,
    COALESCE(p.WorkShopName_CH,    d.WorkShopName_CH)    AS WorkShopName_CH,
    COALESCE(p.WorkShop_Ru,        d.WorkShop_Ru)        AS WorkShop_Ru,
    COALESCE(p.NomenclatureNumber, d.NomenclatureNumber) AS NomenclatureNumber,
    COALESCE(p.ProductName_CN,     d.ProductName_CN)     AS ProductName_CN,
    wt.GP_Weight                                                                  AS GP_Weight,
    COALESCE(price_pmc.Price,         price_mat.Price)                            AS Price,
    p.FACT_QTY,
    wt.GP_Weight * ISNULL(p.FACT_QTY, 0)                                         AS Weight_FACT,
    ISNULL(p.FACT_QTY, 0)           * COALESCE(price_pmc.Price, price_mat.Price)  AS Cost_FACT,
    d.Debugging_QTY,
    wt.GP_Weight * ISNULL(d.Debugging_QTY, 0)                                    AS Weight_Debugging,
    ISNULL(d.Debugging_QTY, 0)      * COALESCE(price_pmc.Price, price_mat.Price)  AS Cost_Debugging,
    d.QCCard_Others_QTY,
    wt.GP_Weight * ISNULL(d.QCCard_Others_QTY, 0)                                AS Weight_Others,
    ISNULL(d.QCCard_Others_QTY, 0)  * COALESCE(price_pmc.Price, price_mat.Price)  AS Cost_Others,
    wt.Snapshot_Date                                                               AS We
```

---

<a name="qc_vw_production_vs_defects"></a>

## QC.vw_Production_vs_Defects

```sql
CREATE VIEW QC.vw_Production_vs_Defects
    AS
        SELECT
            COALESCE(a.OnlyDate,       b.Create_Date)      AS OnlyDate,
            COALESCE(a.WorkShopID,     b.VinovnikDep_ID)   AS WorkShopID,
            COALESCE(a.WorkShopName_CH, b.VinovnikDep_Zh)  AS WorkShopName_CH,
            COALESCE(a.WorkShop_Ru,    b.VinovnikDep_Ru)   AS WorkShop_Ru,

            a.FACT_QTY   AS Prod_QTY,
            a.Total_Cost AS Prod_CostTotal,
            b.Detection_QTY,
            b.Detection_CostTotal

        FROM (
                 -- Агрегируем выпуск до уровня цех+дата
                 SELECT
                     OnlyDate,
                     WorkShopID,
                     WorkShopName_CH,
                     WorkShop_Ru,
                     SUM(FACT_QTY)   AS FACT_QTY,
                     SUM(Total_Cost) AS Total_Cost
                 FROM QC.Production_Output_Cost
                 GROUP BY OnlyDate, WorkShopID, WorkShopName_CH, WorkShop_Ru
             ) AS a

                 FULL JOIN (
            -- Агрегируем брак до уровня цех+дата
            SELECT
                Create_Date,
                VinovnikDep_ID,
                MAX(VinovnikDep_Ru) AS VinovnikDep_Ru,
                MAX(VinovnikDep_Zh) AS VinovnikDep_Zh,
                SUM(QCCard_QTY)                  AS Detection_QTY,
                SUM(QCCard_QTY * Labor_Cost)     AS Detection_CostTotal
            FROM QC.QC_Cards_Summary
            WHERE Delete_Mark = 0x00
            GROUP BY Create_Date, VinovnikDep_ID
        ) AS b
                           ON  b.VinovnikDep_ID = a.WorkShopID
                               AND b.Create_Date    = a.OnlyDate
```

---

<a name="qc_vw_stamping_output"></a>

## QC.vw_Stamping_Output

```sql
-- ============================================================
-- VIEW: QC.vw_Stamping_Output
-- Выходные изделия цеха штамповки (последний партномер перед
-- переходом на следующий участок).
-- Логика:
--   1. Берём все GPNomencl_ID у которых Labor_TypeGroupeID = штамповка ТТ
--   2. Находим строки BOM где эти изделия выступают как Nomencl_ID (входящий материал)
--   3. Убираем те где сами входящие изделия тоже штамповка ТТ
--   Результат: детали которые ВЫШЛИ из штамповки и идут на следующий участок
-- ============================================================
CREATE VIEW QC.vw_Stamping_Output
AS
WITH Labor_Groupe_T AS (
    SELECT DISTINCT
        GPNomencl_ID,
        Labor_TypeGroupeID,
        GPNomencl_No,
        LaborTypeGroupe_Ru,
        LaborTypeGroupe_ZH
    FROM Import_1C.vw_Import_BOM_Current
    WHERE Labor_TypeGroupeID = 0xB3F2C4CBE1AC069511F11EAD532E636E
)
SELECT DISTINCT
    a.Nomencl_ID,
    a.Nomencl_No,
    a.Material_Name
FROM Import_1C.vw_Import_BOM_Current AS a
         LEFT JOIN Labor_Groupe_T AS b
                   ON b.GPNomencl_ID = a.Nomencl_ID
WHERE b.Labor_TypeGroupeID IS NOT NULL
  AND a.Labor_TypeGroupeID <> 0xB3F2C4CBE1AC069511F11EAD532E636E
```

---

<a name="timeloss_vw_entrygrid"></a>

## TimeLoss.vw_EntryGrid

```sql
CREATE   VIEW TimeLoss.vw_EntryGrid AS
SELECT
  e.EntryID,
  e.OnlyDate,
  e.WorkShopID,
  e.WorkCenterID,
  d.NameZh  AS DirectnessZh,
  d.NameEn  AS DirectnessEn,
  g.NameZh  AS ReasonGroupZh,
  g.NameEn  AS ReasonGroupEn,
  e.CommentText,
  e.ManHours,
  e.ActionPlan,
  e.Responsible,
  e.CompletedDate,
  e.CreatedAt,
  e.UpdatedAt
FROM TimeLoss.[Entry] e
JOIN Ref.LossDirectness d ON d.DirectnessID = e.DirectnessID
JOIN Ref.ReasonGroup   g ON g.GroupID      = e.ReasonGroupID
WHERE e.IsDeleted = 0
```

---

<a name="timeloss_vw_working_schedule_flat"></a>

## TimeLoss.vw_Working_Schedule_Flat

```sql
-- Создаём/обновляем вьюху для фронта
CREATE   VIEW TimeLoss.vw_Working_Schedule_Flat
AS
SELECT
    h.ScheduleID,
    h.ScheduleCode,      -- WS-0000001
    h.WorkShopID,
    h.ScheduleName,
    l.LineID,
    l.TypeID,
    l.IsWorkShift,
    l.StartTime,
    l.EndTime,
    h.IsFavorite,
    h.IsDeleted,
    h.DeletedAt,
    h.CreatedAt,
    h.UpdatedAt
FROM TimeLoss.Working_Schedule     AS h
JOIN TimeLoss.Working_ScheduleType AS l
  ON l.ScheduleID = h.ScheduleID
```

---

<a name="views_for_plan_dailyplan_customws"></a>

## Views_For_Plan.DailyPlan_CustomWS

```sql
CREATE VIEW Views_For_Plan.DailyPlan_CustomWS
AS
WITH DPF_CTE AS (
    SELECT
        DPF.WorkShopID,
        DPF.WorkCentorGroupID,
        CASE
            WHEN DPF.WorkShopID IN (
                                    0xB5BC00505601355E11EDF0AED639127E,
                                    0xB5BC00505601355E11EDF940AAEDDAA7
                )
                THEN DPF.WorkCentorID
            ELSE DPF.WorkCentorGroupID
            END  AS WorkCenter_CustomID,
        DPF.OnlyDate,
        DPF.Line_No,
        DPF.WorkShopName_CH,
        DPF.WorkCentorGroup_CN,
        CASE
            WHEN DPF.WorkShopID IN (
                                    0xB5BC00505601355E11EDF0AED639127E,
                                    0xB5BC00505601355E11EDF940AAEDDAA7
                )
                THEN DPF.WorkCentor_CN
            ELSE DPF.WorkCentorGroup_CN
            END  AS WorkCenter_Custom_CN,
        DPF.WorkCentor_CN,
        DPF.OrderNumber,
        DPF.NomenclatureNumber,
        DPF.ProductName_CN,
        DPF.Plan_QTY,
        DPF.CloseWork_QTY,
        DPF.Scan_QTY,
        CASE
            WHEN DPF.Scan_QTY IS NULL
                THEN DPF.CloseWork_QTY
            ELSE DPF.Scan_QTY
            END  AS FACT_QTY,
        DPF.LaborIntensity,
        DPF.PlanRealHours,
        -- Новые поля
        DPF.NomenclatureID,
        DPF.OrderNumberID,
        DPF.WorkNumberID,
        DPF.ProductionOrderID,
        DPF.ProductionOrder,
        DPF.WorkNumber
    FROM Import_1C.Daily_PlanFact AS DPF
),
     DPF_CTE2 AS (
         SELECT
             WorkShopID,
             WorkCentorGroupID,
             WorkCenter_CustomID,
             CASE
                 WHEN WorkCenter_Custom_CN IS NULL
                     THEN WorkCentorGroupID
                 ELSE WorkCenter_CustomID
                 END AS WorkCenter_CustomID1,
             OnlyDate,
             Line_No,
             WorkShopName_CH,
             WorkCentorGroup_CN,
             WorkCenter_Custom_CN,
             CASE
                 WHEN WorkCenter_Custom_CN IS NULL
                     THEN WorkCentorGroup_CN
                 ELSE WorkCenter_Custom_CN
                 END AS WorkCenter_Custom_CN1,
             WorkCentor_CN,
             OrderNumber,
             NomenclatureNumber,
             ProductName_CN,
             Plan_QTY,
             CloseWork_QTY,
             Scan_QTY,
             FACT_QTY,
             LaborIntensity,
             PlanRealHours,
             -- Новые поля
             NomenclatureID,
             OrderNumberID,
             WorkNumberID,
             ProductionOrderID,
             ProductionOrder,
             WorkNumber
         FROM DPF_CTE
     )
SELECT
    WorkShopID,
    WorkCenter_CustomID1      AS WorkCenter_CustomID,
    OnlyDate,
    Line_No,
    WorkShopName_CH,
    WorkCenter_Custom_CN1     AS WorkCenter_Custom_CN,
    WorkCentor_CN,
    OrderNumber,
    NomenclatureNumber,
    ProductName_CN,
    Plan_QTY                          AS Plan_QTY,
    FACT_QTY                          AS FACT_QTY,
    Plan_QTY * LaborIntensity         AS Plan_TIME,
    FACT_QTY * LaborIntensity         AS FACT_TIME,
    PlanRealHours,
    -- Новые поля
    NomenclatureID,
    OrderNumberID,
    WorkNumberID,
    ProductionOrderID,
    ProductionOrder,
    WorkNumber
FROM DPF_CTE2
```

---

<a name="views_for_plan_fact_assemblyonly"></a>

## Views_For_Plan.Fact_AssemblyOnly

```sql
/* ─── 2. ФАКТ (только сборка) ──────────────────────────── */
CREATE  VIEW Views_For_Plan.Fact_AssemblyOnly
AS
WITH src AS (
    SELECT  f.OnlyDate                    AS [Date],
            pg.LargeGroup,
            pg.GroupName,
            LTRIM(RTRIM(f.OrderNumber))        AS Order_No,
            LTRIM(RTRIM(f.NomenclatureNumber)) AS Article_number,
            f.ProductName_CN              AS Name_CN,
            CASE
            WHEN f.Scan_QTY is null
            THEN F.CloseWork_QTY
            ELSE F.Scan_QTY
            END  AS Qty,
            f.Plan_QTY                    AS Plan_Qty,
            f.LaborIntensity AS LaborIntensity,
            f.Plan_QTY * f.LaborIntensity AS TimeFundDailyPlan
    FROM [Import_1C].Daily_PlanFact f
    LEFT JOIN [Ref].Product_Guide pg
           ON f.NomenclatureNumber = pg.FactoryNumber
    WHERE f.WorkShopName_CH IN (N'装配车间', N'热水器总装组')
      AND f.WorkCentorGroup_CN <> N'超声 '
),
agg AS (
    SELECT
        CAST([Date] AS date)                          AS [Date],
        LargeGroup, GroupName, Order_No, Article_number, Name_CN,
        SUM(Qty)       AS FactPcs,
        SUM(Plan_Qty)  AS DailyPlanPcs,
        SUM(Qty*LaborIntensity)  AS TimeFundFact,
        SUM(TimeFundDailyPlan)  AS TimeFundDailyPlan
    FROM src
    GROUP BY
        CAST([Date] AS date),
        LargeGroup, GroupName,
        Order_No, Article_number, Name_CN
)
SELECT
    CAST(YEAR([Date]) AS nvarchar(10)) + ' year'  AS [Year],
    FORMAT([Date],'MMM','en-US')                  AS [Month],
    [Date],
    LargeGroup, GroupName, Order_No, Article_number, Name_CN,
    FactPcs, DailyPlanPcs, TimeFundFact,TimeFundDailyPlan
FROM agg
```

---

<a name="views_for_plan_month_plan"></a>

## Views_For_Plan.Month_Plan

```sql
/* ─── 1. МЕСЯЧНЫЙ ПЛАН ─────────────────────────────────── */
CREATE   VIEW Views_For_Plan.Month_Plan
AS
WITH src AS (
    /* Heaters */
    SELECT  h.PlanDate                    AS [Date],
            h.LargeGroup,
            pg.GroupName,
            LTRIM(RTRIM(h.PINumber))      AS Order_No,
            LTRIM(RTRIM(h.FactoryNumber)) AS Article_number,
            h.Name                        AS Name_CN,
            h.MonthPlanPcs,
            h.TimeFundMP
    FROM [Plan].Month_Plan_Heaters h
    LEFT JOIN [Ref].Product_Guide pg
           ON h.FactoryNumber = pg.FactoryNumber

    UNION ALL

    /* Water-heaters */
    SELECT  w.PlanDate, w.LargeGroup, pg.GroupName,
            LTRIM(RTRIM(w.PINumber)),
            LTRIM(RTRIM(w.FactoryNumber)),
            w.Name, w.MonthPlanPcs, w.TimeFundMP
    FROM [Plan].Month_Plan_WH w
    LEFT JOIN [Ref].Product_Guide pg
           ON w.FactoryNumber = pg.FactoryNumber
),
agg AS (
    SELECT
        CAST([Date] AS date)                          AS [Date],
        LargeGroup, GroupName, Order_No, Article_number, Name_CN,
        SUM(MonthPlanPcs) AS MonthPlanPcs,
        SUM(TimeFundMP)   AS TimeFundMP
    FROM src
    GROUP BY
        CAST([Date] AS date),
        LargeGroup, GroupName,
        Order_No, Article_number, Name_CN
)
SELECT
    CAST(YEAR([Date]) AS nvarchar(10)) + ' year'  AS [Year],
    FORMAT([Date],'MMM','en-US')                  AS [Month],
    [Date],
    LargeGroup, GroupName, Order_No, Article_number, Name_CN,
    MonthPlanPcs, TimeFundMP
FROM agg
```

---

<a name="views_for_plan_month_planfact_gantt"></a>

## Views_For_Plan.Month_PlanFact_Gantt

```sql
-- 2. Создаем заново с новой логикой
CREATE VIEW Views_For_Plan.Month_PlanFact_Gantt
AS
/* 1) базовый FULL JOIN «план + факт» */
WITH base AS (
    SELECT
        COALESCE(p.[Year],  f.[Year])                 AS [Year],
        COALESCE(p.[Month], f.[Month])                AS [Month],
        COALESCE(p.[Date],  f.[Date])                 AS [Date],
        COALESCE(p.LargeGroup,  f.LargeGroup)         AS LargeGroup,
        COALESCE(p.GroupName,   f.GroupName)          AS GroupName,
        COALESCE(p.Order_No,    f.Order_No)           AS Order_No,
        COALESCE(p.Article_number, f.Article_number)  AS Article_number,
        COALESCE(p.Name_CN, f.Name_CN)                AS Name_CN,
        ISNULL(p.MonthPlanPcs,0)                      AS MonthPlanPcs,
        ISNULL(p.TimeFundMP,0)                        AS TimeFundMP,
        ISNULL(f.FactPcs,0)                           AS FactPcs,
        ISNULL(f.TimeFundFact,0)                      AS TimeFundFact,
        ISNULL(f.DailyPlanPcs,0)                      AS DailyPlanPcs,
        ISNULL(f.TimeFundDailyPlan,0)                 AS TimeFundDailyPlan
    FROM Views_For_Plan.Month_Plan            AS p
    FULL JOIN Views_For_Plan.Fact_AssemblyOnly AS f
      ON p.[Date] = f.[Date]
     AND LTRIM(RTRIM(p.Order_No))       = LTRIM(RTRIM(f.Order_No))
     AND LTRIM(RTRIM(p.Article_number)) = LTRIM(RTRIM(f.Article_number))
),
/* 1.1) Нормализация ключей (trim + таб/nbsp/CR -> space + схлопывание) */
norm AS (
    SELECT
        b.*,
        Order_No_clean =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(
              REPLACE(REPLACE(REPLACE(b.Order_No,       CHAR(9), ' '),
                                      CHAR(160), ' '),
                                      CHAR(13), ' ')
            )),
            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
        Article_clean =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(
              REPLACE(REPLACE(REPLACE(b.Article_number, CHAR(9), ' '),
                                      CHAR(160), ' '),
                                      CHAR(13), ' ')
            )),
            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')
    FROM base b
),
/* 2) LEFT JOIN с ТЕКУЩИМ снимком заказов */
with_order_data AS (
    SELECT
        n.*,
        ISNULL(o.ToProduce_QTY, 0) AS Order_QTY,
        ISNULL(o.Scan_QTY, 0)      AS TotalFACT_QTY
    FROM norm AS n
    LEFT JOIN Import_1C.vw_Order_1C_v2_Current AS o
           ON n.Order_No_clean  = o.Order_No
          AND n.Article_clean   = o.Article_number
)
/* 3) Финальный SELECT с Market из Import_1C.vw_Order_1C_v2_Current (только по Order_No) */
SELECT
    wod.[Year],
    wod.[Month],
    wod.[Date],
    wod.LargeGroup,
    wod.GroupName,
    wod.Order_No_clean      AS Order_No,
    wod.Article_clean       AS Article_number,
    wod.Name_CN,
    wod.MonthPlanPcs,
    wod.TimeFundMP,
    wod.FactPcs,
    wod.TimeFundFact,
    wod.DailyPlanPcs,
    wod.TimeFundDailyPlan,
    wod.Order_QTY,
    wod.TotalFACT_QTY,

    -- Market из Import_1C.vw_Order_1C_v2_Current (только по Order_No, TOP 1)
    ISNULL(MK.Market, N'-') AS Market
FROM with_order_data AS wod
OUTER APPLY (
    SELECT TOP (1) ord.Market
    FROM Import_1C.vw_Order_1C_v2_Current AS ord
    WHERE ord.Order_No = wod.Order_No_clean
      AND ord.Market IS NOT NULL  -- Только записи с заполненным Market
) AS MK
```

---

<a name="views_for_plan_month_planfact_summary"></a>

## Views_For_Plan.Month_PlanFact_Summary

```sql
-- 2. Создаем заново с новой логикой
CREATE VIEW Views_For_Plan.Month_PlanFact_Summary
AS
/* ---- Нормализуем план ---- */
WITH p_norm AS (
    SELECT
        p.[Year], p.[Month], p.[Date],
        p.LargeGroup, p.GroupName, p.Name_CN,
        /* collapse spaces in keys */
        Order_No_clean =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(
              REPLACE(REPLACE(REPLACE(p.Order_No,       CHAR(9), ' '),
                                      CHAR(160), ' '),
                                      CHAR(13), ' ')
            )),
            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
        Article_clean =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(
              REPLACE(REPLACE(REPLACE(p.Article_number, CHAR(9), ' '),
                                      CHAR(160), ' '),
                                      CHAR(13), ' ')
            )),
            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
        p.MonthPlanPcs, p.TimeFundMP
    FROM Views_For_Plan.Month_Plan AS p
),
/* ---- Нормализуем факт ---- */
f_norm AS (
    SELECT
        f.[Year], f.[Month], f.[Date],
        f.LargeGroup, f.GroupName, f.Name_CN,
        Order_No_clean =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(
              REPLACE(REPLACE(REPLACE(f.Order_No,       CHAR(9), ' '),
                                      CHAR(160), ' '),
                                      CHAR(13), ' ')
            )),
            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
        Article_clean =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(
              REPLACE(REPLACE(REPLACE(f.Article_number, CHAR(9), ' '),
                                      CHAR(160), ' '),
                                      CHAR(13), ' ')
            )),
            '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '),
        f.FactPcs, f.DailyPlanPcs, f.TimeFundFact, f.TimeFundDailyPlan
    FROM Views_For_Plan.Fact_AssemblyOnly AS f
),
/* ---- FULL JOIN по нормализованным ключам ---- */
jf AS (
    SELECT
        COALESCE(p.[Year],  f.[Year])   AS [Year],
        COALESCE(p.[Month], f.[Month])  AS [Month],
        COALESCE(p.[Date],  f.[Date])   AS [Date],
        COALESCE(p.LargeGroup, f.LargeGroup) AS LargeGroup,
        COALESCE(p.GroupName,  f.GroupName)  AS GroupName,
        COALESCE(p.Name_CN,    f.Name_CN)    AS Name_CN,
        /* нормализованные ключи в выдачу */
        COALESCE(p.Order_No_clean,  f.Order_No_clean)  AS Order_No,
        COALESCE(p.Article_clean,   f.Article_clean)   AS Article_number,

        /* план */
        ISNULL(p.MonthPlanPcs, 0)     AS PlanQty,
        ISNULL(p.TimeFundMP,   0)     AS PlanTime,

        /* факт */
        ISNULL(f.FactPcs, 0)          AS FactQty,
        ISNULL(f.DailyPlanPcs, 0)     AS DailyPlanQty,
        ISNULL(f.TimeFundFact, 0)     AS FactTime,
        ISNULL(f.TimeFundDailyPlan,0) AS DailyPlanTime
    FROM p_norm p
    FULL JOIN f_norm f
      ON p.[Date]        = f.[Date]
     AND p.LargeGroup    = f.LargeGroup
     AND p.GroupName     = f.GroupName
     AND p.Order_No_clean  = f.Order_No_clean
     AND p.Article_clean   = f.Article_clean
)
/* ---- Финальный SELECT + Market из Import_1C.vw_Order_1C_v2_Current (только по Order_No) ---- */
SELECT
    jf.[Year], jf.[Month], jf.[Date],
    jf.LargeGroup, jf.GroupName, jf.Order_No, jf.Article_number, jf.Name_CN,
    jf.PlanQty, jf.PlanTime,
    jf.FactQty, jf.DailyPlanQty, jf.FactTime, jf.DailyPlanTime,
    
    -- Market из Import_1C.vw_Order_1C_v2_Current (только по Order_No, TOP 1)
    ISNULL(MK.Market, N'-') AS Market
FROM jf
OUTER APPLY (
    SELECT TOP (1) ord.Market
    FROM Import_1C.vw_Order_1C_v2_Current AS ord
    WHERE ord.Order_No = jf.Order_No
      AND ord.Market IS NOT NULL  -- Только записи с заполненным Market
) AS MK
```

---


QUERY_DAILY_PLANFACT_TEMPLATE = """
DECLARE @StartDay  DATE = '{start_day}';
DECLARE @FinishDay DATE = '{finish_day}';
-------------------------------------------------------------------------------
-- Начинаем общий блок CTE
-------------------------------------------------------------------------------
WITH
-------------------------------------------------------------------------------
-- 1. Вспомогательный CTE для Plan
-------------------------------------------------------------------------------
LatestDocuments AS (
    SELECT
        D._IDRRef AS DocementID,
        CONVERT(DATE, P._Fld109670) AS OnlyDate,
        P._Fld109675RRef AS WorkCentorID,
        D._Fld109662 AS LastLoadTime,
        ROW_NUMBER() OVER (
            PARTITION BY CONVERT(DATE, P._Fld109670), P._Fld109681
            ORDER BY D._Fld109662 DESC
        ) AS rn
    FROM _Document109661X1 D
    JOIN _Document109661_VT109668X1 P
        ON D._IDRRef = P._Document109661_IDRRef
    WHERE D._Fld109662 <= DATEADD(HOUR, 12, CAST(P._Fld109670 AS DATETIME))
),

-------------------------------------------------------------------------------
-- 2. Основной CTE для Plan с добавленным полем Line_No
-------------------------------------------------------------------------------
PlanCTE AS (
    SELECT
        P._Document109661_IDRRef AS DocementID,
        CONVERT(DATE, P._Fld109670) AS OnlyDate,
        P._LineNo109669 AS Line_No,
        P._Fld109675RRef AS WorkCentorID,
        P._Fld109671RRef AS WorkNumberID,
        TRY_CONVERT(INT, REPLACE(P._Fld109694, ',', '')) AS Plan_QTY,
        CAST(P._Fld109697 AS DECIMAL(18,6)) AS PlanRealHours
    FROM _Document109661_VT109668X1 P
    JOIN LatestDocuments LD
        ON P._Document109661_IDRRef = LD.DocementID
       AND CONVERT(DATE, P._Fld109670) = LD.OnlyDate
       AND P._Fld109675RRef = LD.WorkCentorID
    WHERE LD.rn = 1
      AND CONVERT(DATE, P._Fld109670) BETWEEN @StartDay AND @FinishDay
      AND TRY_CONVERT(INT, REPLACE(P._Fld109694, ',', '')) <> 0
),
-------------------------------------------------------------------------------
-- 3. ScanCTE (данные о сканировании)
-------------------------------------------------------------------------------
ScanCTE AS (
    SELECT
        CASE
            WHEN CAST(A._Fld108081 AS time) < '08:00:00'
                THEN DATEADD(DAY, -1, CAST(A._Fld108081 AS date))
                ELSE CAST(A._Fld108081 AS date)
        END AS OnlyDate,
        A._Fld108077RRef AS WorkCenterID,
        D._IDRRef        AS WorkNumberID,
        COUNT(*)         AS Scan_QTY,
        C._IDRRef        AS BaseID
    FROM _InfoRg108073X1 AS A
    JOIN _Document1964_VT49471X1 AS B
        ON A._Fld108074RRef = B._Fld49473RRef
    JOIN _Document1964X1 AS C
        ON C._IDRRef = B._Document1964_IDRRef
    LEFT JOIN _Document1964X1 AS D
        ON D._Number = SUBSTRING(
                           C._Number,
                           1,
                           LEN(C._Number) + 1
                             - CHARINDEX('.', REVERSE(C._Number)) - 1
                       ) + '.1'
    WHERE
        CASE
            WHEN CAST(A._Fld108081 AS time) < '08:00:00'
                THEN DATEADD(DAY, -1, CAST(A._Fld108081 AS date))
                ELSE CAST(A._Fld108081 AS date)
        END BETWEEN @StartDay AND @FinishDay
    GROUP BY
        CASE
            WHEN CAST(A._Fld108081 AS time) < '08:00:00'
                THEN DATEADD(DAY, -1, CAST(A._Fld108081 AS date))
                ELSE CAST(A._Fld108081 AS date)
        END,
        A._Fld108077RRef,
        D._IDRRef,
        C._IDRRef
),

-------------------------------------------------------------------------------
-- 4. CWCTE (данные о фактическом выполнении - CloseWork)
-------------------------------------------------------------------------------
CWCTE AS (
    SELECT
        CASE
            WHEN CAST(T1._Fld49363 AS time) < '08:00:00'
                THEN DATEADD(DAY, -1, CAST(T1._Fld49363 AS date))
                ELSE CAST(T1._Fld49363 AS date)
        END AS OnlyDate,
        T2._IDRRef AS WorkNumberID,
        W.WorkCenterID,
        SUM(T3._Fld49434) AS CloseWork_QTY,
        T1._IDRRef AS BaseID
    FROM _Document1964X1 AS T1
    LEFT JOIN _Document1964X1 AS T2
        ON SUBSTRING(
             T1._Number,
             1,
             LEN(T1._Number) + 1 - CHARINDEX('.', REVERSE(T1._Number)) - 1
           ) + '.1' = T2._Number
    LEFT JOIN _Document1964_VT49429X1 AS T3
        ON T3._Document1964_IDRRef = T1._IDRRef
    OUTER APPLY (
        SELECT TOP 1 T4._Fld107647_RRRef AS WorkCenterID
        FROM _InfoRg107642X1 AS T4
        WHERE T4._Fld107643RRef = T1._IDRRef
        ORDER BY ABS(DATEDIFF(MINUTE, T4._Fld107649, T1._Fld49363)) ASC
    ) AS W
    WHERE
        T1._Fld49345RRef = 0x8D548985090C24F84621C62A624549DD
        AND T1._Posted = 0x01
        AND (CASE
                 WHEN CAST(T1._Fld49363 AS time) < '08:00:00'
                     THEN DATEADD(DAY, -1, CAST(T1._Fld49363 AS date))
                     ELSE CAST(T1._Fld49363 AS date)
             END) BETWEEN @StartDay AND @FinishDay
    GROUP BY
        CASE
            WHEN CAST(T1._Fld49363 AS time) < '08:00:00'
                THEN DATEADD(DAY, -1, CAST(T1._Fld49363 AS date))
                ELSE CAST(T1._Fld49363 AS date)
        END,
        T2._IDRRef,
        W.WorkCenterID,
        T1._IDRRef
),

-------------------------------------------------------------------------------
-- 5. Объединяем ScanCTE и CWCTE в FactFinal (получаем сырые строки)
-------------------------------------------------------------------------------
FactFinal AS (
    SELECT
        COALESCE(CW.OnlyDate, S.OnlyDate) AS OnlyDate,
        COALESCE(CW.WorkNumberID, S.WorkNumberID) AS WorkNumberID,
        COALESCE(CW.WorkCenterID, S.WorkCenterID) AS WorkCenterID,
        CW.CloseWork_QTY,
        S.Scan_QTY
    FROM CWCTE AS CW
    FULL JOIN ScanCTE AS S
      ON CW.OnlyDate = S.OnlyDate
     AND CW.WorkNumberID = S.WorkNumberID
     AND (
          CW.WorkCenterID = S.WorkCenterID
          OR (CW.WorkCenterID IS NULL AND CW.BaseID = S.BaseID)
     )
),

-------------------------------------------------------------------------------
-- 6. Группируем сырые данные факта (FactCTE)
-------------------------------------------------------------------------------
FactCTE AS (
    SELECT
        OnlyDate,
        WorkNumberID,
        WorkCenterID,
        SUM(CloseWork_QTY) AS CloseWork_QTY,
        SUM(Scan_QTY)      AS Scan_QTY
    FROM FactFinal
    GROUP BY
        OnlyDate,
        WorkNumberID,
        WorkCenterID
),

-------------------------------------------------------------------------------
-- 7. Финальное объединение PlanCTE и FactCTE в общий набор PF
-------------------------------------------------------------------------------
PF AS (
    SELECT
        P.DocementID,
        COALESCE(P.OnlyDate, F.OnlyDate) AS OnlyDate,
        COALESCE(P.WorkCentorID, F.WorkCenterID) AS WorkCentorID,
        COALESCE(P.WorkNumberID, F.WorkNumberID) AS WorkNumberID,
        P.Line_No,
        P.Plan_QTY,
        P.PlanRealHours,
        F.CloseWork_QTY,
        F.Scan_QTY
    FROM PlanCTE AS P
    FULL JOIN FactCTE AS F
       ON  P.OnlyDate      = F.OnlyDate
       AND P.WorkCentorID  = F.WorkCenterID
       AND P.WorkNumberID  = F.WorkNumberID
)

-------------------------------------------------------------------------------
-- 8. Финальный запрос с нужным порядком полей
-------------------------------------------------------------------------------
SELECT
    PF.DocementID,
    PF.WorkCentorID,
    PF.WorkNumberID,
    WS._Fld49349RRef AS WorkShopID,
    WS._Fld49344RRef AS ProductionOrderID,
    WS._Fld49347RRef AS SpecificationID,
    WK_T._Fld49644RRef AS WorkCentorGroupID,
    PO_T._Fld14541_RRRef AS OrderNumberID,
    WNM_T.NomenclatureID,
    PF.Line_No,
    WSH_T._Description AS WorkShopName_RU,
    COALESCE(WCG_Fact._Description, WCG_WK._Description) AS WorkCentorGroup_RU,
    WC_T._Description AS WorkCentor_RU,
    WSH_T._Fld51315 AS WorkShopName_CH,
    COALESCE(WCG_Fact._Fld51315, WCG_WK._Fld51315) AS WorkCentorGroup_CN,
    WC_T._Fld51315 AS WorkCentor_CN,
    PF.OnlyDate,
    PO_T._Number  AS ProductionOrder,
    WS._Number    AS WorkNumber,
    OR_T._Number  AS OrderNumber,
    NM_T._Fld62053 AS NomenclatureNumber,
    NM_T._Fld51315 AS ProductName_CN,
    PF.Plan_QTY,
    PF.PlanRealHours,
    PF.CloseWork_QTY,
    PF.Scan_QTY,
    COALESCE(Additional.LaborIntensity, REF887._Fld70060) AS LaborIntensity,
    COALESCE(Additional.Staff, REF887._Fld109259)         AS Staff
FROM PF
LEFT JOIN _Document1964X1            AS WS  ON WS._IDRRef = PF.WorkNumberID
LEFT JOIN _Document1964_VT49642X1    AS WK_T ON WK_T._Document1964_IDRRef = PF.WorkNumberID
LEFT JOIN _Document1383X1            AS PO_T ON PO_T._IDRRef = WS._Fld49344RRef
LEFT JOIN _Document1378X1            AS OR_T ON OR_T._IDRRef = PO_T._Fld14541_RRRef
LEFT JOIN (
    SELECT
         _Document1964_IDRRef,
         MAX(_Fld49431RRef) AS NomenclatureID
    FROM _Document1964_VT49429X1
    GROUP BY _Document1964_IDRRef
) AS WNM_T ON WNM_T._Document1964_IDRRef = PF.WorkNumberID
LEFT JOIN _Reference557X1            AS NM_T ON NM_T._IDRRef = WNM_T.NomenclatureID
LEFT JOIN _Reference858X1            AS WC_T ON WC_T._IDRRef = PF.WorkCentorID
LEFT JOIN _Reference1023X1           AS WSH_T ON WSH_T._IDRRef = WS._Fld49349RRef
LEFT JOIN _Reference169X1            AS WCG_Fact ON WCG_Fact._IDRRef = WC_T._Fld69146RRef
LEFT JOIN _Reference169X1            AS WCG_WK   ON WCG_WK._IDRRef = WK_T._Fld49644RRef
LEFT JOIN _Reference887_VT70057X1    AS REF887 ON WS._Fld49347RRef = REF887._Reference887_IDRRef
OUTER APPLY (
    SELECT TOP 1
         PVT._Fld109689 AS LaborIntensity,
         PVT._Fld109690 AS Staff
    FROM _Document109661_VT109668X1 AS PVT
    WHERE PVT._Document109661_IDRRef = PF.DocementID
      AND CONVERT(DATE, PVT._Fld109670) = PF.OnlyDate
      AND PVT._Fld109671RRef = PF.WorkNumberID
    ORDER BY PVT._Fld109670 DESC
) AS Additional
ORDER BY
    PF.OnlyDate,
    PF.WorkCentorID,
    CASE WHEN PF.Line_No IS NULL THEN 1 ELSE 0 END,
    PF.Line_No,
    PF.WorkNumberID;
"""

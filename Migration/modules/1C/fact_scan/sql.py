QUERY_FACTSCAN_ONASSEMBLY_TEMPLATE = r"""
WITH SCAN_CTE AS (
    SELECT
        DATEADD(minute, DATEDIFF(minute, 0, A._Fld108081), 0) AS ScanMinute,
        A._Fld108077RRef AS WorkCenterID,
        D._IDRRef        AS WorkNumberID,
        A._Fld108086RRef AS ProductionOrderID,
        A._Fld108084RRef AS NomenclatureNumberID,
        COUNT(*)         AS Scan_QTY,
        C._IDRRef        AS BaseID
    FROM  _InfoRg108073X1         AS A
    JOIN  _Document1964_VT49471X1 AS B ON A._Fld108074RRef = B._Fld49473RRef
    JOIN  _Document1964X1         AS C ON C._IDRRef        = B._Document1964_IDRRef
    LEFT JOIN _Document1964X1     AS D ON D._Number        = SUBSTRING(
                                              C._Number,
                                              1,
                                              LEN(C._Number) + 1 - CHARINDEX('.', REVERSE(C._Number)) - 1
                                          ) + '.1'
    WHERE CAST(A._Fld108081 AS date) BETWEEN '{start_day}' AND '{finish_day}'
    GROUP BY
        DATEADD(minute, DATEDIFF(minute, 0, A._Fld108081), 0),
        A._Fld108077RRef, D._IDRRef, C._IDRRef, A._Fld108086RRef, A._Fld108084RRef
)
SELECT
    SCAN_CTE.WorkCenterID,
    SCAN_CTE.WorkNumberID,
    SCAN_CTE.ProductionOrderID,
    SCAN_CTE.NomenclatureNumberID,
    DATEADD(YEAR,-2000, SCAN_CTE.ScanMinute) AS ScanMinute,
    WC_T._Fld51315  AS WorkCenter_CN,
    PO_T._Number    AS ProductionOrder,
    WS._Number      AS WorkNumber,
    OR_T._Number    AS OrderNumber,
    NM_T._Fld62053  AS NomenclatureNumber,
    NM_T._Fld51315  AS ProductName_CN,
    SUM(SCAN_CTE.Scan_QTY) AS Scan_QTY
FROM SCAN_CTE
LEFT JOIN _Reference858X1  AS WC_T ON WC_T._IDRRef         = SCAN_CTE.WorkCenterID
LEFT JOIN _Document1383X1  AS PO_T ON PO_T._IDRRef         = SCAN_CTE.ProductionOrderID
LEFT JOIN _Document1964X1  AS WS   ON WS._IDRRef           = SCAN_CTE.WorkNumberID
LEFT JOIN _Document1378X1  AS OR_T ON OR_T._IDRRef         = PO_T._Fld14541_RRRef
LEFT JOIN _Reference557X1  AS NM_T ON NM_T._IDRRef         = SCAN_CTE.NomenclatureNumberID
GROUP BY
    SCAN_CTE.WorkCenterID,
    SCAN_CTE.WorkNumberID,
    SCAN_CTE.ProductionOrderID,
    SCAN_CTE.NomenclatureNumberID,
    DATEADD(YEAR,-2000, SCAN_CTE.ScanMinute),
    WC_T._Fld51315, PO_T._Number, WS._Number, OR_T._Number, NM_T._Fld62053, NM_T._Fld51315;
"""

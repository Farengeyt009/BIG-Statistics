QUERY_ORDER_1C = """
;WITH OrderCTE AS (
    SELECT
        OR_T._Posted                   AS Posted,
        OR_T._IDRRef                   AS OrderID,
        CONVERT(date, OR_T._Date_Time) AS OrderDate,
        CONVERT(date, OR_T._Fld13951)  AS OrderConformDay,
        CONVERT(date, OR_T._Fld109874) AS OrderShipmentDay,
        OR_T._Number                   AS Order_No,
        OR_T2.NomenclatureID,
        OR_T2.MaxShipmentDay           AS OrderShipmentDay_OR_T2,
        OR_T2.MaxPlannedShipmentDay    AS PlannedShipmentDay,
        OR_T2.Total_Order_QTY,
        OR_T2.ToProduce_QTY,
        OR_T2.Cancelled_QTY,
        NM_T._Fld62053                 AS Article_number,
        NM_T._Fld108912                AS Name_CN,
        NM_T._Fld62111RRef             AS Security_SchemeID,
        SSh_T._Fld51315                AS Security_Scheme,
        Prod.ProductionOrderID         AS ProductionOrderID,
        Prod.ProductionOrder           AS ProductionOrder,
        CONVERT(date, Prod.RunOrderDay) AS RunOrderDay,
        Prod.ProdOrder_QTY             AS ProdOrder_QTY,
        StatusID_T._Fld95364_RRRef     AS Order_StatusID,
        Status_T._EnumOrder            AS Order_Status,
        OR_T._Fld13935RRef             AS ClientID,
        \u0421lient_T._Description          AS Client,
        OR_T._Marked                   AS Order_Delete_Mark,
        OR_T._Fld13948                 AS SingleDateShipmentFlag,
        OR_T._Fld108450                AS IsInternal,
        MarketRef._Description         AS Market,
        ProductTagRef._Description     AS ProductTagRu,
        ProductTagRef._Fld51315        AS ProductTagZh,
        Agent_T.Agent_ID               AS Agent_ID,
        Agent_T.Client_Country_ID      AS Client_Country_ID,
        \u0421lient_T._Fld64877RRef         AS Client_Manager_ID,
        Country_T._Description         AS Client_Country_Ru,
        Country_T._Fld72637            AS Client_Country_En,
        User_T._Description            AS Client_Manager
    FROM _Document1378X1 AS OR_T
    LEFT JOIN (
        SELECT
            _Document1378_IDRRef,
            _Fld14024RRef AS NomenclatureID,
            MAX(CONVERT(date, _Fld14023))  AS MaxShipmentDay,
            MAX(CONVERT(date, _Fld109872)) AS MaxPlannedShipmentDay,
            SUM(CASE WHEN _Fld14042 <> 0x01 THEN _Fld14028 ELSE 0 END) AS Total_Order_QTY,
            SUM(CASE WHEN _Fld14042 <> 0x01 AND ISNULL(_Fld109873, 0x00) <> 0x01 THEN _Fld14028 ELSE 0 END) AS ToProduce_QTY,
            SUM(CASE WHEN _Fld14042 = 0x01 THEN _Fld14028 ELSE 0 END) AS Cancelled_QTY
        FROM _Document1378_VT14021X1
        GROUP BY _Document1378_IDRRef, _Fld14024RRef
    ) AS OR_T2 ON OR_T._IDRRef = OR_T2._Document1378_IDRRef
    LEFT JOIN _Reference557X1 AS NM_T ON NM_T._IDRRef = OR_T2.NomenclatureID
    LEFT JOIN _Reference1026 AS SSh_T ON NM_T._Fld62111RRef = SSh_T._IDRRef
    LEFT JOIN _Document1378_VT14098X1 AS OR_Market
        ON OR_Market._Document1378_IDRRef = OR_T._IDRRef
        AND OR_Market._Fld14100RRef = 0xB3EFC4CBE1AC069511F0CA656DA7B1E3
    LEFT JOIN _Reference363 AS MarketRef ON MarketRef._IDRRef = OR_Market._Fld14101_RRRef AND MarketRef._Marked = 0x00
    LEFT JOIN _Document1378_VT14098X1 AS OR_ProductTag
        ON OR_ProductTag._Document1378_IDRRef = OR_T._IDRRef
        AND OR_ProductTag._Fld14100RRef = 0xB3EFC4CBE1AC069511F0E22953559988
    LEFT JOIN _Reference363 AS ProductTagRef ON ProductTagRef._IDRRef = OR_ProductTag._Fld14101_RRRef AND ProductTagRef._Marked = 0x00
    LEFT JOIN (
        SELECT OProd_T._Fld14541_RRRef AS OrderRef, VT._Fld14568RRef AS NomenRef,
               OProd_T._IDRRef AS ProductionOrderID, OProd_T._Number AS ProductionOrder,
               OProd_T._Date_Time AS RunOrderDay, SUM(VT._Fld14572) AS ProdOrder_QTY
        FROM _Document1383X1 AS OProd_T
        LEFT JOIN _Document1383_VT14566X1 AS VT ON OProd_T._IDRRef = VT._Document1383_IDRRef AND VT._Fld14577 = 0x00
        WHERE OProd_T._Posted = 0x01
        GROUP BY OProd_T._Fld14541_RRRef, VT._Fld14568RRef, OProd_T._IDRRef, OProd_T._Number, OProd_T._Date_Time
    ) AS Prod ON OR_T._IDRRef = Prod.OrderRef AND OR_T2.NomenclatureID = Prod.NomenRef
    LEFT JOIN _InfoRg95362 AS StatusID_T ON OR_T._IDRRef = StatusID_T._Fld95363_RRRef
    LEFT JOIN _Enum2860 AS Status_T ON StatusID_T._Fld95364_RRRef = Status_T._IDRRef
    LEFT JOIN _Reference677X1 AS \u0421lient_T ON OR_T._Fld13935RRef = \u0421lient_T._IDRRef
    OUTER APPLY (
        SELECT TOP 1 a._IDRRef AS Agent_ID, a._Fld59780RRef AS Client_Country_ID
        FROM _Reference472 AS a WHERE a._Fld59789RRef = \u0421lient_T._IDRRef AND a._Marked = 0x00
    ) AS Agent_T
    LEFT JOIN _Reference1015 AS Country_T ON Country_T._IDRRef = Agent_T.Client_Country_ID
    LEFT JOIN _Reference753 AS User_T ON User_T._IDRRef = \u0421lient_T._Fld64877RRef
    WHERE OR_T._Posted = 0x01 AND OR_T._Marked = 0x00
),
ShipmentCTE AS (
    SELECT Shipment_T2._Fld39763_RRRef AS OrderID, Shipment_T2._Fld39758RRef AS NomenclatureID,
           SUM(Shipment_T2._Fld39764) AS Shipment_QTY, MAX(Shipment_T1._Fld39741) AS ShipmentDate
    FROM _Document1772_VT39756X1 AS Shipment_T2
    LEFT JOIN _Document1772X1 AS Shipment_T1 ON Shipment_T2._Document1772_IDRRef = Shipment_T1._IDRRef
    WHERE Shipment_T1._Posted = 0x01 AND Shipment_T1._Fld39754RRef = 0x90B4D31C4315BD014E644108EEB19BE0
    GROUP BY Shipment_T2._Fld39763_RRRef, Shipment_T2._Fld39758RRef
),
OrderCTE_WithShipment AS (
    SELECT O.*, S.Shipment_QTY, S.ShipmentDate
    FROM OrderCTE O LEFT JOIN ShipmentCTE S ON O.OrderID = S.OrderID AND O.NomenclatureID = S.NomenclatureID
),
WorkDetail AS (
    SELECT T2._Fld49431RRef AS NomenclatureID, T1._Fld49344RRef AS ProductionOrderID,
           SUM(T2._Fld49434) AS TotalWork_QTY,
           SUM(CASE WHEN T1._Fld49345RRef = 0x8D548985090C24F84621C62A624549DD THEN T2._Fld49434 ELSE 0 END) AS CloseWork_QTY,
           MIN(CAST(T1._Fld49363 AS date)) AS CloseWork_StartDay,
           MAX(CAST(T1._Fld49363 AS date)) AS CloseWork_FinishDay
    FROM _Document1964X1 AS T1
    LEFT JOIN _Document1964_VT49429X1 AS T2 ON T2._Document1964_IDRRef = T1._IDRRef
    WHERE T1._Posted = 0x01
    GROUP BY T2._Fld49431RRef, T1._Fld49344RRef
),
ScanCTE AS (
    SELECT _Fld108084RRef AS NomenclatureID, _Fld108086RRef AS ProductionOrderID,
           COUNT(_Fld108074RRef) AS Scan_QTY,
           MIN(CAST(_Fld108081 AS date)) AS ScanStartDay, MAX(CAST(_Fld108081 AS date)) AS ScanFinishDay
    FROM _InfoRg108073X1
    GROUP BY _Fld108084RRef, _Fld108086RRef
),
WorkCTE AS (
    SELECT WD.NomenclatureID, WD.ProductionOrderID, WD.TotalWork_QTY, WD.CloseWork_QTY,
           WD.CloseWork_StartDay, WD.CloseWork_FinishDay, SC.Scan_QTY, SC.ScanStartDay, SC.ScanFinishDay
    FROM WorkDetail WD LEFT JOIN ScanCTE SC ON WD.ProductionOrderID = SC.ProductionOrderID AND WD.NomenclatureID = SC.NomenclatureID
)
SELECT
    OrderCTE_WithShipment.Posted, OrderCTE_WithShipment.NomenclatureID, OrderCTE_WithShipment.Security_SchemeID,
    OrderCTE_WithShipment.Order_StatusID, OrderCTE_WithShipment.ClientID, OrderCTE_WithShipment.OrderID,
    OrderCTE_WithShipment.ProductionOrderID, OrderCTE_WithShipment.Client, OrderCTE_WithShipment.Security_Scheme,
    OrderCTE_WithShipment.Order_Delete_Mark, OrderCTE_WithShipment.SingleDateShipmentFlag, OrderCTE_WithShipment.IsInternal,
    OrderCTE_WithShipment.Order_Status, OrderCTE_WithShipment.OrderDate, OrderCTE_WithShipment.OrderConformDay,
    OrderCTE_WithShipment.RunOrderDay, OrderCTE_WithShipment.OrderShipmentDay, OrderCTE_WithShipment.OrderShipmentDay_OR_T2,
    OrderCTE_WithShipment.PlannedShipmentDay, OrderCTE_WithShipment.ProductionOrder, OrderCTE_WithShipment.Order_No,
    OrderCTE_WithShipment.Article_number, OrderCTE_WithShipment.Name_CN,
    OrderCTE_WithShipment.Market, OrderCTE_WithShipment.ProductTagRu, OrderCTE_WithShipment.ProductTagZh,
    OrderCTE_WithShipment.Agent_ID, OrderCTE_WithShipment.Client_Country_ID, OrderCTE_WithShipment.Client_Manager_ID,
    OrderCTE_WithShipment.Client_Country_Ru, OrderCTE_WithShipment.Client_Country_En, OrderCTE_WithShipment.Client_Manager,
    OrderCTE_WithShipment.Total_Order_QTY, OrderCTE_WithShipment.ToProduce_QTY, OrderCTE_WithShipment.Cancelled_QTY,
    OrderCTE_WithShipment.ProdOrder_QTY, WorkCTE.TotalWork_QTY, WorkCTE.CloseWork_QTY, WorkCTE.Scan_QTY,
    OrderCTE_WithShipment.Shipment_QTY, WorkCTE.CloseWork_StartDay, WorkCTE.CloseWork_FinishDay,
    WorkCTE.ScanStartDay, WorkCTE.ScanFinishDay, OrderCTE_WithShipment.ShipmentDate,
    CAST(CASE WHEN PriceAgg.Sum14027 = 0 THEN NULL ELSE PriceAgg.Sum14035 / PriceAgg.Sum14027 END AS DECIMAL(19,6)) AS UnitPrice_Base,
    CAST(PriceAgg.Sum14035 AS DECIMAL(19,2)) AS Amount_Base,
    PT.PriceTypeID, PriceType._Description AS PriceTypeName,
    CAST(RateFinal.CNYRate AS DECIMAL(19,6)) AS CNYRate,
    CAST((CASE WHEN PriceAgg.Sum14027 = 0 THEN NULL ELSE PriceAgg.Sum14035 / PriceAgg.Sum14027 END) * RateFinal.CNYRate AS DECIMAL(19,6)) AS UnitPrice_CNY,
    CAST(PriceAgg.Sum14035 * RateFinal.CNYRate AS DECIMAL(19,2)) AS Amount_CNY
FROM OrderCTE_WithShipment
LEFT JOIN WorkCTE ON OrderCTE_WithShipment.ProductionOrderID = WorkCTE.ProductionOrderID AND OrderCTE_WithShipment.NomenclatureID = WorkCTE.NomenclatureID
OUTER APPLY (SELECT SUM(tp._Fld14035) AS Sum14035, SUM(tp._Fld14027) AS Sum14027 FROM _Document1378_VT14021X1 AS tp WHERE tp._Document1378_IDRRef = OrderCTE_WithShipment.OrderID AND tp._Fld14024RRef = OrderCTE_WithShipment.NomenclatureID AND tp._Fld14042 <> 0x01) AS PriceAgg
OUTER APPLY (SELECT o._Fld13940RRef AS PriceTypeID FROM _Document1378X1 AS o WHERE o._IDRRef = OrderCTE_WithShipment.OrderID) AS PT
LEFT JOIN _Reference84 AS PriceType ON PriceType._IDRRef = PT.PriceTypeID AND PriceType._Marked = 0x00
OUTER APPLY (SELECT TOP (1) r._Fld88957 AS CNYRate FROM _InfoRg88954 AS r WHERE r._Fld88955RRef = PT.PriceTypeID AND r._Period >= '4024-01-01' ORDER BY r._Period ASC) AS RateMinValid
OUTER APPLY (SELECT TOP (1) r._Fld88957 AS CNYRate FROM _InfoRg88954 AS r WHERE r._Fld88955RRef = PT.PriceTypeID AND r._Period >= '4024-01-01' AND r._Period <= OrderCTE_WithShipment.OrderDate ORDER BY r._Period DESC) AS RateAtOrBefore
OUTER APPLY (SELECT TOP (1) r._Fld88957 AS CNYRateAfter FROM _InfoRg88954 AS r WHERE r._Fld88955RRef = PT.PriceTypeID AND r._Period >= '4024-01-01' AND r._Period > OrderCTE_WithShipment.OrderDate ORDER BY r._Period ASC) AS RateAfter
OUTER APPLY (SELECT COALESCE(RateAtOrBefore.CNYRate, RateAfter.CNYRateAfter, RateMinValid.CNYRate) AS CNYRate) AS RateFinal
ORDER BY OrderCTE_WithShipment.OrderDate;
"""

QUERY_SHIPMENTS_TEMPLATE = r"""
DECLARE @StartDay  DATE = '{start_day}';
DECLARE @FinishDay DATE = '{finish_day}';  -- включительно

WITH ShipmentCTE AS (
    SELECT
         SpendingOrder_Table._IDRRef                AS SpendingOrder_ID,
         SpendingOrder_Table._Number                AS SpendingOrder_No,
         SpendingOrder_Table._Fld39744              AS Comment,
         SpendingOrder_Table._Fld39748_RRRef        AS RecipientID,
         SpendingOrder_Table._Fld109447RRef         AS TSD_ID,
         SpendingOrder_Table._Date_Time             AS SpendingOrder_Date,
         SpendingOrder_TableProduct._Fld39758RRef   AS NomenclatureID,
         SpendingOrder_TableProduct._Fld39763_RRRef AS OrderID_SpendingOrder_TableProduct,
         SUM(SpendingOrder_TableProduct._Fld39764)  AS SpendingOrder_QTY,
         MAX(TSD_Table._Date_Time)                  AS ShipmentDate_Fact,
         TSD_Table._Fld109412RRef                   AS ContainerID_TSD,
         Realization_Tabel._IDRRef                  AS RealizationDocID,
         Realization_Tabel._Date_Time               AS RealizationDate,
         Realization_Tabel._Number                  AS RealizationDoc,
         Realization_Tabel._Fld39906RRef            AS PartnerID,
         Realization_Tabel._Fld109290RRef           AS ContainerID_Realization,
         Realization_TabelOther._Fld40054_RRRef     AS CI_NoID,
         CI_Table._Description                      AS CI_No
    FROM _Document1772X1 AS SpendingOrder_Table
    LEFT JOIN _Document1772_VT39756X1 AS SpendingOrder_TableProduct
           ON SpendingOrder_TableProduct._Document1772_IDRRef = SpendingOrder_Table._IDRRef
    LEFT JOIN _Document106962X1 AS TSD_Table
           ON SpendingOrder_Table._Fld109447RRef = TSD_Table._IDRRef
          AND TSD_Table._Posted = 0x01
    LEFT JOIN _Document1782X1 AS Realization_Tabel
           ON Realization_Tabel._IDRRef = TSD_Table._Fld109413RRef
          AND Realization_Tabel._Posted = 0x01
    LEFT JOIN _Document1782_VT40051X1 AS Realization_TabelOther
           ON Realization_Tabel._IDRRef = Realization_TabelOther._Document1782_IDRRef
    LEFT JOIN _Reference363 AS CI_Table
           ON CI_Table._IDRRef = Realization_TabelOther._Fld40054_RRRef
    WHERE SpendingOrder_Table._Posted = 0x01
      AND SpendingOrder_Table._Fld39754RRef = 0x90B4D31C4315BD014E644108EEB19BE0
    GROUP BY
         SpendingOrder_Table._IDRRef,
         SpendingOrder_Table._Number,
         SpendingOrder_Table._Fld39744,
         SpendingOrder_Table._Fld39748_RRRef,
         SpendingOrder_Table._Date_Time,
         SpendingOrder_TableProduct._Fld39758RRef,
         SpendingOrder_TableProduct._Fld39763_RRRef,
         SpendingOrder_Table._Fld109447RRef,
         TSD_Table._Fld109413RRef,
         TSD_Table._Fld109412RRef,
         Realization_Tabel._IDRRef,
         Realization_Tabel._Fld39900_RRRef,
         Realization_Tabel._Date_Time,
         Realization_Tabel._Number,
         Realization_Tabel._Fld39906RRef,
         Realization_Tabel._Fld109290RRef,
         Realization_TabelOther._Fld40054_RRRef,
         CI_Table._Description
)
SELECT
       s.*,
       OR_T._Number                   AS OrderNo_SpendingOrder_TableProduct,
       NM_T._Fld62053                 AS Article_number,
       NM_T._Fld108912                AS Name_CN,
       NM_T._Fld62107                 AS CBM,
       ContainerID_Table._Description AS ContainerNO_Realization,
       Recipient_Table._Description   AS Recipient_Name,
       Recipient_Table1._Description  AS Partner_Name,

       -- Unit price = SUM(_Fld14035) / SUM(_Fld14027) only where _Fld14042 = 0x00
       CAST(COALESCE(p.Sum14035 / NULLIF(p.Sum14027,0), 0.0) AS DECIMAL(19,6)) AS UnitPrice,

       -- Price type (ID + name)
       OR_T._Fld13940RRef             AS PriceTypeID,
       PriceType._Description         AS PriceTypeName,

       -- CNY rate as of SpendingOrder_Date
       CAST(RateApplFinal.CNYRate AS DECIMAL(19,6)) AS CNYRate
FROM ShipmentCTE AS s
-- Aggregate price by (Order, Nomenclature)
OUTER APPLY (
    SELECT
        SUM(tp._Fld14035) AS Sum14035,
        SUM(tp._Fld14027) AS Sum14027
    FROM _Document1378_VT14021X1 AS tp
    WHERE tp._Document1378_IDRRef = s.OrderID_SpendingOrder_TableProduct
      AND tp._Fld14024RRef        = s.NomenclatureID
      AND tp._Fld14042            = 0x00
) AS p
LEFT JOIN _Document1378X1 AS OR_T
       ON OR_T._IDRRef = s.OrderID_SpendingOrder_TableProduct
      AND OR_T._Posted = 0x01
LEFT JOIN _Reference84 AS PriceType
       ON PriceType._IDRRef = OR_T._Fld13940RRef
      AND PriceType._Marked = 0x00
-- Effective-dated rate lookup from _InfoRg88954
OUTER APPLY (
    SELECT TOP (1)
           r._Fld88957 AS CNYRate
    FROM _InfoRg88954 AS r
    WHERE r._Fld88955RRef = OR_T._Fld13940RRef
      AND r._Period <= s.SpendingOrder_Date
    ORDER BY r._Period DESC
) AS RateAppl
-- Fallback: earliest after date if none before/at
OUTER APPLY (
    SELECT TOP (1)
           r._Fld88957 AS CNYRateAfter
    FROM _InfoRg88954 AS r
    WHERE r._Fld88955RRef = OR_T._Fld13940RRef
      AND r._Period > s.SpendingOrder_Date
    ORDER BY r._Period ASC
) AS RateNext
-- Final: prefer <= date, else next after
OUTER APPLY (
    SELECT COALESCE(RateAppl.CNYRate, RateNext.CNYRateAfter) AS CNYRate
) AS RateApplFinal
LEFT JOIN _Reference557X1 AS NM_T
       ON NM_T._IDRRef = s.NomenclatureID
LEFT JOIN _Reference109266X1 AS ContainerID_Table
       ON ContainerID_Table._IDRRef = s.ContainerID_Realization
LEFT JOIN _Reference677X1 AS Recipient_Table
       ON Recipient_Table._IDRRef = s.RecipientID
LEFT JOIN _Reference677X1 AS Recipient_Table1
       ON Recipient_Table1._IDRRef = s.PartnerID
WHERE s.SpendingOrder_Date >= @StartDay
  AND s.SpendingOrder_Date <  DATEADD(DAY, 1, @FinishDay);
"""

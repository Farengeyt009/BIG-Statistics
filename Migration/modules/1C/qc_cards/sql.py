QUERY_QC_CARDS_TEMPLATE = r"""
-- Карты контроля качества из 1С - все данные
;WITH WorkBase AS (
    SELECT
        w._IDRRef,
        w._Fld49344RRef,
        w._Fld49345RRef,
        w._Fld49347RRef AS BOM_ID,
        w._Marked,
        w._Posted,
        w._Number AS Work_No,
        w._Fld49363 AS Work_FinishDate,
        LEFT(w._Number, LEN(w._Number) - CHARINDEX('.', REVERSE(w._Number))) AS WorkRoot
    FROM _Document1964X1 AS w
),
GoodsAgg AS (
    SELECT
        g._Document1964_IDRRef               AS Work_No_ID,
        MIN(g._Fld49431RRef)                 AS Work_NomenclatureID,
        SUM(g._Fld49433)                     AS Work_QTY_Box,
        SUM(g._Fld49434)                     AS Work_QTY
    FROM _Document1964_VT49429X1 AS g
    WHERE g._Fld49460 <> 0x01
    GROUP BY g._Document1964_IDRRef
),
TotalsAgg AS (
    SELECT
        wb.WorkRoot,
        ga.Work_NomenclatureID,
        SUM(ga.Work_QTY_Box) AS Work_QTY_BoxTotal,
        SUM(ga.Work_QTY)     AS Work_QTY_Total
    FROM WorkBase AS wb
    JOIN GoodsAgg AS ga
        ON ga.Work_No_ID = wb._IDRRef
    GROUP BY
        wb.WorkRoot,
        ga.Work_NomenclatureID
)
SELECT
    QC_CardTable._IDRRef as DocID,
    QC_CardTable._Fld107539RRef as Avtor_ID,
    QC_CardTable._Fld107533RRef as Defect_TypeID,
    QC_CardTable._Fld107543RRef as VinovnikDep_ID,
    QC_CardTable._Fld107532RRef as VinovnikPeople_ID,
    QC_CardTable._Fld107528RRef as WorkNo_ID,
    QC_CardTable._Fld107537RRef as QCcardConclusion_ID,
    QC_CardTable._Fld107529RRef as QC_Card_NomenclatureID,
    QC_CardTable._Fld107527RRef as Organization_ID,
    QC_CardTable._Fld107544RRef as Dep_OF_Detection_Unit_ID,
    QC_CardTable._Fld109903RRef as Dep_of_Definition_ID,
    QC_CardTable._Fld107540RRef as QC_Card_StatusID,
    wb._Fld49344RRef as ProdOrder_No_ID,
    wb._IDRRef       as Work_No_ID,
    wb._Fld49345RRef as Work_No_Status_ID,
    wb.BOM_ID,
    QC_CardTable._Marked as Delete_Mark,
    QC_CardTable._Posted as Posted_Mark,
    QC_CardTable._Date_Time as Create_Date,
    QC_CardTable._NumberPrefix as NumberPrefix,
    RRef_Organization._Description as Organization_Name,
    RRef_Defect_Type._Description as Defect_TypeRu,
    RRef_Defect_Type._Fld109410 as Defect_TypeZh,
    QC_CardTable._Number as QC_Card_No,
    RRef_VinovnikDep._Description as VinovnikDep_Ru,
    RRef_VinovnikDep._Fld51315 as VinovnikDep_Zh,
    po._Number        as ProdOrder_No,
    Customer_Order_T._Number AS Customer_Order_No,
    RRef_Nomenclature._Fld62053 as QC_Card_Nomenclature_No,
    RRef_Nomenclature._Description as QC_Card_Nomenclature_NameRU,
    RRef_Nomenclature._Fld108912 as QC_Card_Nomenclature_Namezh,
    RRfe_QCcardConclusion._EnumOrder as QCcardConclusion_No,
    QC_CardTable._Fld107536 as QCCard_QTY,
    RRef_QC_Card_Status._Description as QC_Card_StatusRu,
    RRef_QC_Card_Status._Fld109398 as QC_Card_StatusZh,
    QC_CardTable._Fld107535 as Cause_of_Defect,
    RRef_VinovnikPeople._Description as VinovnikPeople_Name,
    RRef_Dep_OF_Detection_Unit._Description as QC_Select_Work_Dep_Ru,
    RRef_Dep_OF_Detection_Unit._Fld51315 as QC_Select_Work_Dep_Zh,
    RRef_Dep_of_Definition._Description as Dep_OF_Detection_Ru,
    RRef_Dep_of_Definition._Fld51315 as Dep_OF_Detection_Zh,
    RRefAvtor._Description as Avtor_Name,
    QC_CardTable._Fld107542 as Comment,
    QC_CardTable._Fld107541 as Status_Date,
    wb._Marked       as Work_Delete_Mark,
    wb._Posted       as Work_Posted_Mark,
    st._EnumOrder     as Work_No_Status,
    wb.Work_No        as Work_No,
    wb.Work_FinishDate,
    ga.Work_NomenclatureID,
    RRef_WorkNomenclature._Fld62053    as Work_Nomenclature_No,
    RRef_WorkNomenclature._Description as Work_Nomenclature_NameRU,
    RRef_WorkNomenclature._Fld108912   as Work_Nomenclature_Namezh,
    ga.Work_QTY_Box,
    ga.Work_QTY,
    ta.Work_QTY_BoxTotal,
    ta.Work_QTY_Total
FROM _Document106959X1 as QC_CardTable
left join _Reference753 as RRefAvtor
    on RRefAvtor._IDRRef=QC_CardTable._Fld107539RRef
left join _Reference109331X1 as RRef_Defect_Type
    on RRef_Defect_Type._IDRRef= QC_CardTable._Fld107533RRef
left join _Reference1023X1 as RRef_VinovnikDep
    on RRef_VinovnikDep._IDRRef=QC_CardTable._Fld107543RRef
left join _Reference1186 as RRef_VinovnikPeople
    on RRef_VinovnikPeople._IDRRef= QC_CardTable._Fld107532RRef
left join _Enum106971X1 as RRfe_QCcardConclusion
    on RRfe_QCcardConclusion._IDRRef=QC_CardTable._Fld107537RRef
left join _Reference596 as RRef_Organization
    on RRef_Organization._IDRRef=QC_CardTable._Fld107527RRef
left join _Reference1023X1 as RRef_Dep_OF_Detection_Unit
    on RRef_Dep_OF_Detection_Unit._IDRRef=QC_CardTable._Fld107544RRef
left join _Reference1023X1 as RRef_Dep_of_Definition
    on RRef_Dep_of_Definition._IDRRef= QC_CardTable._Fld109903RRef
left join _Reference106945X1 as RRef_QC_Card_Status
    on RRef_QC_Card_Status._IDRRef=QC_CardTable._Fld107540RRef
left join _Reference557X1 as RRef_Nomenclature
    on RRef_Nomenclature._IDRRef = QC_CardTable._Fld107529RRef
LEFT JOIN WorkBase AS wb
    ON QC_CardTable._Fld107528RRef = wb._IDRRef
LEFT JOIN _Document1383X1 AS po
    ON wb._Fld49344RRef = po._IDRRef
LEFT JOIN _Enum3311 AS st
    ON st._IDRRef = wb._Fld49345RRef
LEFT JOIN GoodsAgg AS ga
    ON ga.Work_No_ID = wb._IDRRef
LEFT JOIN _Reference557X1 as RRef_WorkNomenclature
    ON RRef_WorkNomenclature._IDRRef = ga.Work_NomenclatureID
LEFT JOIN _Document1378X1 AS Customer_Order_T
    ON Customer_Order_T._IDRRef = po._Fld14541_RRRef
LEFT JOIN TotalsAgg AS ta
    ON ta.WorkRoot = wb.WorkRoot
   AND ta.Work_NomenclatureID = ga.Work_NomenclatureID;
"""

QUERY_QC_CARDS_WINDOW_TEMPLATE = r"""
-- Карты контроля качества из 1С с фильтром по периоду
DECLARE @DateFrom DATETIME = '{date_from}';
DECLARE @DateTo   DATETIME = '{date_to}';

;WITH WorkBase AS (
    SELECT
        w._IDRRef,
        w._Fld49344RRef,
        w._Fld49345RRef,
        w._Fld49347RRef AS BOM_ID,
        w._Marked,
        w._Posted,
        w._Number AS Work_No,
        w._Fld49363 AS Work_FinishDate,
        LEFT(w._Number, LEN(w._Number) - CHARINDEX('.', REVERSE(w._Number))) AS WorkRoot
    FROM _Document1964X1 AS w
),
GoodsAgg AS (
    SELECT
        g._Document1964_IDRRef               AS Work_No_ID,
        MIN(g._Fld49431RRef)                 AS Work_NomenclatureID,
        SUM(g._Fld49433)                     AS Work_QTY_Box,
        SUM(g._Fld49434)                     AS Work_QTY
    FROM _Document1964_VT49429X1 AS g
    WHERE g._Fld49460 <> 0x01
    GROUP BY g._Document1964_IDRRef
),
TotalsAgg AS (
    SELECT
        wb.WorkRoot,
        ga.Work_NomenclatureID,
        SUM(ga.Work_QTY_Box) AS Work_QTY_BoxTotal,
        SUM(ga.Work_QTY)     AS Work_QTY_Total
    FROM WorkBase AS wb
    JOIN GoodsAgg AS ga
        ON ga.Work_No_ID = wb._IDRRef
    GROUP BY
        wb.WorkRoot,
        ga.Work_NomenclatureID
)
SELECT
    QC_CardTable._IDRRef as DocID,
    QC_CardTable._Fld107539RRef as Avtor_ID,
    QC_CardTable._Fld107533RRef as Defect_TypeID,
    QC_CardTable._Fld107543RRef as VinovnikDep_ID,
    QC_CardTable._Fld107532RRef as VinovnikPeople_ID,
    QC_CardTable._Fld107528RRef as WorkNo_ID,
    QC_CardTable._Fld107537RRef as QCcardConclusion_ID,
    QC_CardTable._Fld107529RRef as QC_Card_NomenclatureID,
    QC_CardTable._Fld107527RRef as Organization_ID,
    QC_CardTable._Fld107544RRef as Dep_OF_Detection_Unit_ID,
    QC_CardTable._Fld109903RRef as Dep_of_Definition_ID,
    QC_CardTable._Fld107540RRef as QC_Card_StatusID,
    wb._Fld49344RRef as ProdOrder_No_ID,
    wb._IDRRef       as Work_No_ID,
    wb._Fld49345RRef as Work_No_Status_ID,
    wb.BOM_ID,
    QC_CardTable._Marked as Delete_Mark,
    QC_CardTable._Posted as Posted_Mark,
    QC_CardTable._Date_Time as Create_Date,
    QC_CardTable._NumberPrefix as NumberPrefix,
    RRef_Organization._Description as Organization_Name,
    RRef_Defect_Type._Description as Defect_TypeRu,
    RRef_Defect_Type._Fld109410 as Defect_TypeZh,
    QC_CardTable._Number as QC_Card_No,
    RRef_VinovnikDep._Description as VinovnikDep_Ru,
    RRef_VinovnikDep._Fld51315 as VinovnikDep_Zh,
    po._Number        as ProdOrder_No,
    Customer_Order_T._Number AS Customer_Order_No,
    RRef_Nomenclature._Fld62053 as QC_Card_Nomenclature_No,
    RRef_Nomenclature._Description as QC_Card_Nomenclature_NameRU,
    RRef_Nomenclature._Fld108912 as QC_Card_Nomenclature_Namezh,
    RRfe_QCcardConclusion._EnumOrder as QCcardConclusion_No,
    QC_CardTable._Fld107536 as QCCard_QTY,
    RRef_QC_Card_Status._Description as QC_Card_StatusRu,
    RRef_QC_Card_Status._Fld109398 as QC_Card_StatusZh,
    QC_CardTable._Fld107535 as Cause_of_Defect,
    RRef_VinovnikPeople._Description as VinovnikPeople_Name,
    RRef_Dep_OF_Detection_Unit._Description as QC_Select_Work_Dep_Ru,
    RRef_Dep_OF_Detection_Unit._Fld51315 as QC_Select_Work_Dep_Zh,
    RRef_Dep_of_Definition._Description as Dep_OF_Detection_Ru,
    RRef_Dep_of_Definition._Fld51315 as Dep_OF_Detection_Zh,
    RRefAvtor._Description as Avtor_Name,
    QC_CardTable._Fld107542 as Comment,
    QC_CardTable._Fld107541 as Status_Date,
    wb._Marked       as Work_Delete_Mark,
    wb._Posted       as Work_Posted_Mark,
    st._EnumOrder     as Work_No_Status,
    wb.Work_No        as Work_No,
    wb.Work_FinishDate,
    ga.Work_NomenclatureID,
    RRef_WorkNomenclature._Fld62053    as Work_Nomenclature_No,
    RRef_WorkNomenclature._Description as Work_Nomenclature_NameRU,
    RRef_WorkNomenclature._Fld108912   as Work_Nomenclature_Namezh,
    ga.Work_QTY_Box,
    ga.Work_QTY,
    ta.Work_QTY_BoxTotal,
    ta.Work_QTY_Total
FROM _Document106959X1 as QC_CardTable
left join _Reference753 as RRefAvtor
    on RRefAvtor._IDRRef=QC_CardTable._Fld107539RRef
left join _Reference109331X1 as RRef_Defect_Type
    on RRef_Defect_Type._IDRRef= QC_CardTable._Fld107533RRef
left join _Reference1023X1 as RRef_VinovnikDep
    on RRef_VinovnikDep._IDRRef=QC_CardTable._Fld107543RRef
left join _Reference1186 as RRef_VinovnikPeople
    on RRef_VinovnikPeople._IDRRef= QC_CardTable._Fld107532RRef
left join _Enum106971X1 as RRfe_QCcardConclusion
    on RRfe_QCcardConclusion._IDRRef=QC_CardTable._Fld107537RRef
left join _Reference596 as RRef_Organization
    on RRef_Organization._IDRRef=QC_CardTable._Fld107527RRef
left join _Reference1023X1 as RRef_Dep_OF_Detection_Unit
    on RRef_Dep_OF_Detection_Unit._IDRRef=QC_CardTable._Fld107544RRef
left join _Reference1023X1 as RRef_Dep_of_Definition
    on RRef_Dep_of_Definition._IDRRef= QC_CardTable._Fld109903RRef
left join _Reference106945X1 as RRef_QC_Card_Status
    on RRef_QC_Card_Status._IDRRef=QC_CardTable._Fld107540RRef
left join _Reference557X1 as RRef_Nomenclature
    on RRef_Nomenclature._IDRRef = QC_CardTable._Fld107529RRef
LEFT JOIN WorkBase AS wb
    ON QC_CardTable._Fld107528RRef = wb._IDRRef
LEFT JOIN _Document1383X1 AS po
    ON wb._Fld49344RRef = po._IDRRef
LEFT JOIN _Enum3311 AS st
    ON st._IDRRef = wb._Fld49345RRef
LEFT JOIN GoodsAgg AS ga
    ON ga.Work_No_ID = wb._IDRRef
LEFT JOIN _Reference557X1 as RRef_WorkNomenclature
    ON RRef_WorkNomenclature._IDRRef = ga.Work_NomenclatureID
LEFT JOIN _Document1378X1 AS Customer_Order_T
    ON Customer_Order_T._IDRRef = po._Fld14541_RRRef
LEFT JOIN TotalsAgg AS ta
    ON ta.WorkRoot = wb.WorkRoot
   AND ta.Work_NomenclatureID = ga.Work_NomenclatureID
WHERE QC_CardTable._Date_Time BETWEEN @DateFrom AND @DateTo;
"""

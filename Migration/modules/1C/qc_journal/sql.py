_BASE_SELECT = r"""
SELECT
    LQC_Table._Date_Time                      AS [Date],
    LQC_Table._IDRRef                         AS Doc_ID,
    LQC_Table_Goods._Fld107361RRef            AS Defect_Type_ID,
    LQC_Table_Goods._Fld109465RRef            AS Vinovnik_Dep_ID,
    LQC_Table_Goods._Fld107362_RRRef          AS Control_Tochka_ID,
    LQC_Table_Goods._Fld107357RRef            AS Prod_Order_ID,
    Prod_Order_T._Fld14541_RRRef              AS Customer_Order_ID,
    LQC_Table_Goods._Fld107365RRef            AS Work_Nomenclature_ID,
    LQC_Table._Marked                         AS Delete_Mark,
    LQC_Table._Posted                         AS Post_Mark,
    LQC_Table._Number                         AS Doc_No,
    QC_Doc_Type_T._EnumOrder                  AS Doc_Type,
    RRefAvtor._Description                    AS Avtor,
    Prod_Order_T._Number                      AS Prod_Order_No,
    Customer_Order_T._Number                  AS Customer_Order_No,
    Control_Tochka_T._Description             AS Control_Tochka_Ru,
    Control_Tochka_T._Fld51315                AS Control_Tochka_Zh,
    Defect_Type_T._Description                AS Defect_Type_Ru,
    Defect_Type_T._Fld109410                  AS Defect_Type_Zh,
    LQC_Table_Goods._Fld107363                AS Prod_Fact_QTY,
    LQC_Table_Goods._Fld107364                AS Defect_QTY,
    RRef_Nomenclature._Fld62053               AS Work_Nomenclature_No,
    RRef_Nomenclature._Description            AS Work_Nomenclature_NameRU,
    RRef_Nomenclature._Fld108912              AS Work_Nomenclature_Namezh,
    LQC_Table_Goods._Fld109459                AS Problem_Description,
    LQC_Table_Goods._Fld109460                AS QC_Status,
    LQC_Table_Goods._Fld109464                AS Problem_Description1,
    Vinovnik_Dep_T._Description               AS Vinovnik_Dep_Ru,
    Vinovnik_Dep_T._Fld51315                  AS Vinovnik_Dep_Zh,
    LQC_Table_Goods._Fld109466                AS PCI_QTY,
    LQC_Table_Goods._Fld109466                AS PCIRemove_To_Rework_QTY
FROM _Document106955X1 AS LQC_Table
LEFT JOIN _Enum109437X1 AS QC_Doc_Type_T
    ON QC_Doc_Type_T._IDRRef = LQC_Table._Fld109456RRef
LEFT JOIN _Reference753 AS RRefAvtor
    ON RRefAvtor._IDRRef = LQC_Table._Fld109457RRef
LEFT JOIN _Document106955_VT107355X1 AS LQC_Table_Goods
    ON LQC_Table._IDRRef = LQC_Table_Goods._Document106955_IDRRef
LEFT JOIN _Reference109331X1 AS Defect_Type_T
    ON Defect_Type_T._IDRRef = LQC_Table_Goods._Fld107361RRef
LEFT JOIN _Reference557X1 AS RRef_Nomenclature
    ON RRef_Nomenclature._IDRRef = LQC_Table_Goods._Fld107365RRef
LEFT JOIN _Reference1023X1 AS Vinovnik_Dep_T
    ON Vinovnik_Dep_T._IDRRef = LQC_Table_Goods._Fld109465RRef
LEFT JOIN _Document1383X1 AS Prod_Order_T
    ON LQC_Table_Goods._Fld107357RRef = Prod_Order_T._IDRRef
LEFT JOIN _Document1378X1 AS Customer_Order_T
    ON Customer_Order_T._IDRRef = Prod_Order_T._Fld14541_RRRef
LEFT JOIN _Reference858X1 AS Control_Tochka_T
    ON Control_Tochka_T._IDRRef = LQC_Table_Goods._Fld107362_RRRef
"""

QUERY_QC_JOURNAL_WINDOW_TEMPLATE = r"""
DECLARE @DateFrom DATETIME = '{date_from}';
DECLARE @DateTo   DATETIME = '{date_to}';
""" + _BASE_SELECT + r"""
WHERE LQC_Table._Date_Time BETWEEN @DateFrom AND @DateTo
ORDER BY LQC_Table._Date_Time
"""

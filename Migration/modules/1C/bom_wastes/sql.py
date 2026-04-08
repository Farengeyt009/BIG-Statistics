QUERY_BOM_WASTES = r"""
SELECT
    Spec_Wastes_T._Reference887_IDRRef AS BOM_ID,
    Spec_Wastes_T._Fld70010RRef        AS Wastes_Nomencl_ID,
    Spec_Wastes_T._Fld70014RRef        AS Work_Type_ID,
    Spec_Wastes_T._Fld70016RRef        AS Operation_ID,
    Spec_Wastes_T._Fld70018RRef        AS Colculation_Type_ID,
    Spec_Total_T._Code                 AS BOM_No,
    Spec_Total_T._Marked               AS Delete_Mark,
    Work_Type_T._Description           AS Work_Type_Ru,
    Work_Type_T._Fld51315              AS Work_Type_Zh,
    Operation_T._Description           AS Operation_Ru,
    Operation_T._Fld51315              AS Operation_Zh,
    Colculation_Type_T._Description    AS Colculation_Type_Ru,
    Colculation_Type_T._Fld51315       AS Colculation_Type_Zh,
    Nomencl_T._Fld62053                AS Nomencl_No,
    Nomencl_T._Fld108912               AS Material_Name,
    Spec_Wastes_T._Fld70013            AS QTY
FROM _Reference887_VT70008X1 AS Spec_Wastes_T
LEFT JOIN _Reference557X1 AS Nomencl_T
    ON Nomencl_T._IDRRef = Spec_Wastes_T._Fld70010RRef
LEFT JOIN _Reference1230X1 AS Work_Type_T
    ON Work_Type_T._IDRRef = Spec_Wastes_T._Fld70014RRef
LEFT JOIN _Reference1058X1 AS Operation_T
    ON Operation_T._IDRRef = Spec_Wastes_T._Fld70016RRef
LEFT JOIN _Reference1007 AS Colculation_Type_T
    ON Colculation_Type_T._IDRRef = Spec_Wastes_T._Fld70018RRef
LEFT JOIN _Reference887X1 AS Spec_Total_T
    ON Spec_Wastes_T._Reference887_IDRRef = Spec_Total_T._IDRRef
"""

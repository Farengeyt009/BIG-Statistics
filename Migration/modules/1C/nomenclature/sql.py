QUERY_NOMENCLATURE_REFERENCE_TEMPLATE = r"""
SELECT
    Nomenclature_T._Fld62052RRef AS Unit_Of_Mass_ID,
    Nomenclature_T._Fld62070RRef AS Unit_Of_Length_ID,
    Nomenclature_T._Fld62055RRef AS Unit_Of_Weight_ID,
    Nomenclature_T._Fld62054RRef AS Sales_Registration_Option_ID,
    Nomenclature_T._Fld62063RRef AS Nomenclature_Type_ID,
    Nomenclature_T._Fld62099RRef AS Nomenclature_Type_ID2,
    Nomenclature_T._Fld62086RRef AS Financial_Accounting_Group_ID,
    Nomenclature_T._Fld62094RRef AS Warehouse_Group_ID,
    Nomenclature_T._Fld62097RRef AS VAT_Rate_ID,
    Nomenclature_T._Fld62103RRef AS Volume_Unit_ID,
    Nomenclature_T._Fld62109RRef AS Area_Unit_ID,
    Nomenclature_T._Fld62100RRef AS Product_Category_ID,
    Nomenclature_T._IDRRef AS Nomenclature_ID,
    Nomenclature_T._Marked AS Delete_Mark,
    Nomenclature_T._Folder AS Its_Group,
    Nomenclature_T._Code AS Nomenclature_Doc_Cod,
    Nomenclature_T._Fld62053 AS Nomenclature_No,
    Nomenclature_T._Description AS Nomenclature_Description,
    Nomenclature_Type_T._Description AS Nomenclature_Type_Ru,
    Nomenclature_T._Fld108409 AS Units_On_Pallet,
    Nomenclature_Type_T._Fld51315 AS Nomenclature_Type_Zh,
    Nomenclature_Type_T2._EnumOrder AS Nomenclature_Type2,
    Product_Category_T._Description AS Product_Category_Ru,
    Product_Category_T._Fld51315 AS Product_Category_Zh,
    Financial_Accounting_Group_T._Description AS Financial_Accounting_Group_Ru,
    Financial_Accounting_Group_T._Fld109805 AS Financial_Accounting_Group_Zh,
    Warehouse_Group_T._Description AS Warehouse_Group_Ru,
    Warehouse_Group_T._Fld51315 AS Warehouse_Group_Zh,
    Sales_Registration_Option_T._EnumOrder AS Sales_Registration_Option,
    Ref_Unit_Of_Mass._Description AS Unit_Of_Mass_Ru,
    Ref_Unit_Of_Mass._Fld51315 AS Unit_Of_Mass_Zh,
    Nomenclature_T._Fld62059 AS Numerator_Weight,
    Unit_Rref_T1._Description AS Weight_Unit,
    Nomenclature_T._Fld62074 AS Length,
    Unit_Rref_T2._Description AS Length_Unit,
    Nomenclature_T._Fld62107 AS Volume,
    Unit_Rref_T3._Description AS Volume_Unit,
    Nomenclature_T._Fld62115 AS Area,
    Unit_Rref_T4._Description AS Area_Unit,
    VAT_Rate_T._Description AS VAT_Rate_Text,
    VAT_Rate_T._Fld72427 AS VAT_Rate_QRT,
    Nomenclature_T._Fld109573 AS Scrap_Rate,
    Nomenclature_T._Fld62066 AS Nomenclature_FullName,
    Nomenclature_T._Fld51315 AS Nomenclature_Name_Zh
FROM _Reference557X1 AS Nomenclature_T
    LEFT JOIN _Reference1153X1 AS Ref_Unit_Of_Mass ON Nomenclature_T._Fld62052RRef = Ref_Unit_Of_Mass._IDRRef
    LEFT JOIN _Enum2055 AS Sales_Registration_Option_T ON Nomenclature_T._Fld62054RRef = Sales_Registration_Option_T._IDRRef
    LEFT JOIN _Reference147X1 AS Nomenclature_Type_T ON Nomenclature_T._Fld62063RRef = Nomenclature_Type_T._IDRRef
    LEFT JOIN _Reference1153X1 AS Unit_Rref_T1 ON Nomenclature_T._Fld62055RRef = Unit_Rref_T1._IDRRef
    LEFT JOIN _Reference1153X1 AS Unit_Rref_T2 ON Nomenclature_T._Fld62070RRef = Unit_Rref_T2._IDRRef
    LEFT JOIN _Reference258X1 AS Financial_Accounting_Group_T ON Nomenclature_T._Fld62086RRef = Financial_Accounting_Group_T._IDRRef
    LEFT JOIN _Reference933 AS Warehouse_Group_T ON Nomenclature_T._Fld62094RRef = Warehouse_Group_T._IDRRef
    LEFT JOIN _Reference1000 AS VAT_Rate_T ON Nomenclature_T._Fld62097RRef = VAT_Rate_T._IDRRef
    LEFT JOIN _Enum3438 AS Nomenclature_Type_T2 ON Nomenclature_T._Fld62099RRef = Nomenclature_Type_T2._IDRRef
    LEFT JOIN _Reference147X1 AS Product_Category_T ON Nomenclature_T._Fld62100RRef = Product_Category_T._IDRRef
    LEFT JOIN _Reference1153X1 AS Unit_Rref_T3 ON Nomenclature_T._Fld62103RRef = Unit_Rref_T3._IDRRef
    LEFT JOIN _Reference1153X1 AS Unit_Rref_T4 ON Nomenclature_T._Fld62109RRef = Unit_Rref_T4._IDRRef;
"""

QUERY_BOM_TEMPLATE = """
-- _Reference887X1 as Spec_Total_T (_Fld69944RRef Статус _Marked пометка удаления)
-- _Reference887_VT69984X1 as Spec_GP_T (_Fld69986RRef ВидНоменклатуры _Fld69987RRef ID номенкл)
-- _Reference887_VT70029X1 as Spec_matireal_T --> (_Reference887_IDRRef Id спецухи  _Fld70034 - потребность  _Fld70031RRef Id номенклатеры  _Fld70039RRef Id статья калькуляции)
-- _Reference557X1 as Nomencl_T --> (_IDRRef - НоменID _Fld62053 - Артикул _Fld108912 - Наименование _Marked- ПометкаУдаления _ParentIDRRef- Болшая группаID _Fld62063RRef - Сред.группаID)
WITH Spec AS (
    SELECT
        Spec_matireal_T._Reference887_IDRRef AS Spec_ID,
        Spec_matireal_T._Fld70031RRef AS Nomencl_ID,
        Spec_matireal_T._Fld70039RRef AS Colculet_ID,
        Nomencl_T._ParentIDRRef AS Nomencl_BigGroupID,
        Nomencl_T._Fld62063RRef AS Nomencl_MidleGroupID,
        Spec_GP_T._Fld69986RRef AS GP_Nomencl_TypeID,
        Spec_GP_T._Fld69987RRef AS GPNomencl_ID,
        Spec_Total_T._Fld69944RRef AS Spec_StatusID,
        LaborType_Table._ParentIDRRef AS Labor_TypeGroupeID,
        Labor_Table._Fld70059RRef AS Labor_TypeID,
        Spec_Total_T._Marked AS Delete_Mark,
        Spec_Status_T._EnumOrder AS Spec_Status,
        Spec_Total_T._Fld69945 AS Start_Day,
        Spec_Total_T._Fld69946 AS Finish_Day,
        Spec_Total_T._Code AS BOM_No,
        GP_Nomencl_TypeI_T._Description AS GP_Nomencl_TypeName,
        Nomencl_T2._Fld62053 AS GPNomencl_No,
        Nomencl_T2._Fld108912 AS GPMaterial_Name,
        LaborTypeGroupe_Table._Description as LaborTypeGroupe_Ru,
        LaborTypeGroupe_Table._Fld51315 as LaborTypeGroupe_ZH,
        LaborType_Table._Description as LaborType_Ru,
        LaborType_Table._Fld51315 as LaborType_ZH,
        Labor_Table._Fld70060 AS GPMaterial_Labor,
        Labor_Table._Fld109259 AS GPMaterial_People,
        Nomencl_T._Fld62053 AS Nomencl_No,
        Nomencl_T._Fld108912 AS Material_Name,
        Spec_matireal_T._Fld70034 AS Porebnost,
        Colculet_T._Description AS Colculet_Name,
        NomenclBigGroup_T._Description AS Nomencl_BigGroupName,
        MidleGroup_T._Description AS Nomencl_MidleGroupName
    FROM _Reference887_VT70029X1 AS Spec_matireal_T
             LEFT JOIN _Reference557X1 AS Nomencl_T
                       ON Nomencl_T._IDRRef = Spec_matireal_T._Fld70031RRef
             LEFT JOIN _Reference557X1 AS NomenclBigGroup_T
                       ON NomenclBigGroup_T._IDRRef = Nomencl_T._ParentIDRRef
             LEFT JOIN _Reference147X1 AS MidleGroup_T
                       ON MidleGroup_T._IDRRef = Nomencl_T._Fld62063RRef
             LEFT JOIN _Reference1007 AS Colculet_T
                       ON Colculet_T._IDRRef = Spec_matireal_T._Fld70039RRef
             LEFT JOIN _Reference887_VT69984X1 AS Spec_GP_T
                       ON Spec_GP_T._Reference887_IDRRef = Spec_matireal_T._Reference887_IDRRef
             LEFT JOIN _Reference557X1 AS Nomencl_T2
                       ON Nomencl_T2._IDRRef = Spec_GP_T._Fld69987RRef
             LEFT JOIN _Reference147X1 AS GP_Nomencl_TypeI_T
                       ON GP_Nomencl_TypeI_T._IDRRef = Spec_GP_T._Fld69986RRef
             LEFT JOIN _Reference887X1 AS Spec_Total_T
                       ON Spec_matireal_T._Reference887_IDRRef = Spec_Total_T._IDRRef
             LEFT JOIN _Reference887_VT70057X1 AS Labor_Table
                       ON Labor_Table._Reference887_IDRRef = Spec_Total_T._IDRRef
             LEFT JOIN _Enum3296 AS Spec_Status_T
                       ON Spec_Status_T._IDRRef = Spec_Total_T._Fld69944RRef
             LEFT JOIN _Reference168 AS LaborType_Table
                       ON Labor_Table._Fld70059RRef=LaborType_Table._IDRRef
             LEFT JOIN _Reference168 AS LaborTypeGroupe_Table
                       ON LaborType_Table._ParentIDRRef= LaborTypeGroupe_Table._IDRRef
)
SELECT * FROM Spec;
"""

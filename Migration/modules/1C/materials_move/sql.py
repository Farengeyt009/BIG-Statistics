QUERY_MATERIALS_MOVE_WINDOW_TEMPLATE = r"""
SELECT
    Materials_Move_T._IDRRef                    AS Doc_ID,
    Warehouse_T1._ParentIDRRef                  AS Sender_Parent_WH_ID,
    Warehouse_T2._ParentIDRRef                  AS Recipient_Parent_WH_ID,
    Materials_Move_T._Fld32149RRef              AS Sender_WH_ID,
    Materials_Move_T._Fld32150RRef              AS Recipient_WH_ID,
    Materials_Move_T._Fld32147RRef              AS Dep_ID,
    Materials_Move_T._Fld32177RRef              AS Avtor_ID,
    Materials_Move_T._Fld32145RRef              AS Responsible_ID,
    Materials_Move_Goods_T._Fld32183RRef        AS Nomencl_ID,
    Nomencl_T._Fld62063RRef                     AS Nomencl_Type_ID,
    Materials_Move_Goods_T._Fld108470_RRRef     AS Guilty_Dep_ID,
    Materials_Move_T._Marked                    AS Delete_Mark,
    Materials_Move_T._Posted                    AS Posted,
    Materials_Move_T._Date_Time                 AS Doc_Date,
    User_T1._Description                        AS Avtor_Name,
    Dep_T._Description                          AS Dep_Name_RU,
    Dep_T._Fld51315                             AS Dep_Name_ZH,
    User_T2._Description                        AS Responsible_Name,
    Materials_Move_T._Number                    AS Doc_No,
    Parent_Warehouse_T1._Description            AS Sender_Parent_WH_Ru,
    Parent_Warehouse_T1._Fld51315               AS Sender_Parent_WH_Zh,
    Parent_Warehouse_T2._Description            AS Recipient_Parent_WH_Ru,
    Parent_Warehouse_T2._Fld51315               AS Recipient_Parent_WH_Zh,
    Warehouse_T1._Description                   AS Sender_WH_Ru,
    Warehouse_T1._Fld51315                      AS Sender_WH_Zh,
    Warehouse_T2._Description                   AS Recipient_WH_Ru,
    Warehouse_T2._Fld51315                      AS Recipient_WH_Zh,
    Materials_Move_T._Fld32142                  AS Doc_Comment,
    Nomencl_T._Fld62053                         AS Nomencl_No,
    Nomencl_T._Description                      AS Nomencl_Name_RU,
    Nomencl_T._Fld108912                        AS Nomencl_Name_ZH,
    Materials_Move_Goods_T._Fld32187            AS QTY,
    Materials_Move_Goods_T._Fld108468           AS Goods_Doc_Comment,
    Company_Structure_T._Description            AS Guilty_Dep_RU,
    Company_Structure_T._Fld51315               AS Guilty_Dep_ZH,
    Nomencl_Type_T._Description                 AS Nomencl_Type_RU,
    Nomencl_Type_T._Fld51315                    AS Nomencl_Type_ZH
FROM _Document1655X1 AS Materials_Move_T
LEFT JOIN _Reference937X1 AS Warehouse_T1 ON Materials_Move_T._Fld32149RRef = Warehouse_T1._IDRRef
LEFT JOIN _Reference937X1 AS Warehouse_T2 ON Materials_Move_T._Fld32150RRef = Warehouse_T2._IDRRef
LEFT JOIN _Reference753 AS User_T1 ON Materials_Move_T._Fld32177RRef = User_T1._IDRRef
LEFT JOIN _Reference753 AS User_T2 ON Materials_Move_T._Fld32145RRef = User_T2._IDRRef
LEFT JOIN _Reference1023X1 AS Dep_T ON Materials_Move_T._Fld32147RRef = Dep_T._IDRRef
LEFT JOIN _Document1655_VT32181X1 AS Materials_Move_Goods_T ON Materials_Move_T._IDRRef = Materials_Move_Goods_T._Document1655_IDRRef
LEFT JOIN _Reference557X1 AS Nomencl_T ON Materials_Move_Goods_T._Fld32183RRef = Nomencl_T._IDRRef
LEFT JOIN _Reference147X1 AS Nomencl_Type_T ON Nomencl_T._Fld62063RRef = Nomencl_Type_T._IDRRef
LEFT JOIN _Reference1023X1 AS Company_Structure_T ON Materials_Move_Goods_T._Fld108470_RRRef = Company_Structure_T._IDRRef
LEFT JOIN _Reference937X1 AS Parent_Warehouse_T1 ON Warehouse_T1._ParentIDRRef = Parent_Warehouse_T1._IDRRef
LEFT JOIN _Reference937X1 AS Parent_Warehouse_T2 ON Warehouse_T2._ParentIDRRef = Parent_Warehouse_T2._IDRRef
WHERE Materials_Move_T._Date_Time >= '{date_from}'
  AND Materials_Move_T._Date_Time <= '{date_to}'
"""

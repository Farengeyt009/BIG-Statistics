QUERY_WORKCENTER_1C = """
SELECT
        WSH_T._IDRRef AS WorkShop_ID,
        WC_Type._IDRRef AS WorkCenter_Type_ID,
        StructuraWC._IDRRef AS WorkCenter_ID,
        WSH_T._Description AS WorkShop_Ru,
        WSH_T._Fld51315 AS WorkShop_Cn,
        WC_Type._Description AS WorkCenter_Type_Ru,
        WC_Type._Fld51315 AS WorkCenter_Type_Cn,
        StructuraWC._Description AS WorkCenter_Ru,
        StructuraWC._Fld51315 AS WorkCenter_Cn

FROM _Reference858X1 AS StructuraWC

LEFT JOIN _Reference169X1 AS WC_Type
ON StructuraWC._Fld69146RRef = WC_Type._IDRRef

LEFT JOIN _Reference1023X1  AS WSH_T
ON  WC_Type._Fld52785RRef =  WSH_T._IDRRef

where StructuraWC._Marked = 0x00
AND WC_Type._Marked = 0x00
AND WSH_T._Marked = 0x00
AND StructuraWC._Description <> 'Лаборатория RND'
"""

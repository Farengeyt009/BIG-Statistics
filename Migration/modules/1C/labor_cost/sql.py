QUERY_LABOR_COST_TEMPLATE = r"""
SELECT
    a._Fld92072RRef   AS LaborTypeID,
    a._Period         AS Date,
    b._Description    AS LaborType_Ru,
    b._Fld51315       AS LaborType_ZH,
    a._Fld92074       AS Labor_Cost
FROM _InfoRg92071 AS a
LEFT JOIN _Reference168 AS b
    ON a._Fld92072RRef = b._IDRRef
"""

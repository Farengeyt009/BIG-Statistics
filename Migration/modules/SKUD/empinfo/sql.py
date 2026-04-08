QUERY_empinfo = """
SELECT  empcode,
        empname,
        birthday,
        age,
        entrydate,
        emptype,
        isactive,
        deptname2,
        deptname3,
        deptname4,
        deptname5

FROM vps_empinfo
WHERE empcode IS NOT NULL
"""

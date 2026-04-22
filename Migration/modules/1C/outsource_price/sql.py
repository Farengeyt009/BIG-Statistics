QUERY_OUTSOURCE_PRICE_TEMPLATE = r"""
-- Цены на аутсорсинг из 1С - все данные
SELECT
    Outsource_Price._Fld109775RRef              AS Nomencl_ID,
    Outsource_Price._Period                     AS [Date],
    Nomencl_T._Fld62053                         AS Nomencl_No,
    Nomencl_T._Fld108912                        AS Material_NameZh,
    Nomencl_T._Fld108911                        AS Material_NameRu,
    CurrType._Description                       AS CurrencyName,
    Outsource_Price._Fld109777                  AS Price,
    Tax_Raite_T._Description                    AS Tax_Raite,
    Outsource_Price._Fld109777                  AS VAT_Price,
    Outsource_Price._Fld109780                  AS Nomencl_No_in_Outsource_PriceDoc
FROM _InfoRg109774X1 AS Outsource_Price
    LEFT JOIN _Reference557X1 AS Nomencl_T
        ON Nomencl_T._IDRRef = Outsource_Price._Fld109775RRef
    LEFT JOIN _Reference84 AS CurrType
        ON Outsource_Price._Fld109776RRef = CurrType._IDRRef
    LEFT JOIN _Reference1000 AS Tax_Raite_T
        ON Outsource_Price._Fld109779RRef= Tax_Raite_T._IDRRef;
"""

QUERY_OUTSOURCE_PRICE_WINDOW_TEMPLATE = r"""
-- Цены на аутсорсинг из 1С с фильтром по периоду
DECLARE @DateFrom DATE = '{date_from}';
DECLARE @DateTo   DATE = '{date_to}';

SELECT
    Outsource_Price._Fld109775RRef              AS Nomencl_ID,
    Outsource_Price._Period                     AS [Date],
    Nomencl_T._Fld62053                         AS Nomencl_No,
    Nomencl_T._Fld108912                        AS Material_NameZh,
    Nomencl_T._Fld108911                        AS Material_NameRu,
    CurrType._Description                       AS CurrencyName,
    Outsource_Price._Fld109777                  AS Price,
    Tax_Raite_T._Description                    AS Tax_Raite,
    Outsource_Price._Fld109777                  AS VAT_Price,
    Outsource_Price._Fld109780                  AS Nomencl_No_in_Outsource_PriceDoc
FROM _InfoRg109774X1 AS Outsource_Price
    LEFT JOIN _Reference557X1 AS Nomencl_T
        ON Nomencl_T._IDRRef = Outsource_Price._Fld109775RRef
    LEFT JOIN _Reference84 AS CurrType
        ON Outsource_Price._Fld109776RRef = CurrType._IDRRef
    LEFT JOIN _Reference1000 AS Tax_Raite_T
        ON Outsource_Price._Fld109779RRef= Tax_Raite_T._IDRRef
WHERE Outsource_Price._Period BETWEEN @DateFrom AND @DateTo;
"""

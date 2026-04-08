QUERY_PRICE_LIST_WINDOW_TEMPLATE = r"""
-- Прайс-лист из 1С с фильтром по периоду
DECLARE @DateFrom DATE = '{date_from}';
DECLARE @DateTo   DATE = '{date_to}';

SELECT
    Price_T._IDRRef                             AS RecorderDoc_ID,
    Pice_25_T._Fld98581RRef                     AS Nomencl_ID,
    Pice_25_T._Period                           AS [Date],
    PriceType_T._Fld53072                       AS PriceTypeName,
    Price_T._Number                             AS RecorderDoc_No,
    Nomencl_T._Fld62053                         AS Nomencl_No,
    Nomencl_T._Fld108912                        AS Material_NameZh,
    Nomencl_T._Fld108911                        AS Material_NameRu,
    CurrType._Description                       AS CurrencyName,
    Pice_25_T._Fld98586                         AS Price
FROM _InfoRg98580 AS Pice_25_T
    LEFT JOIN _Document1940 AS Price_T
        ON Price_T._IDRRef = Pice_25_T._RecorderRRef
    LEFT JOIN _Reference557X1 AS Nomencl_T
        ON Nomencl_T._IDRRef = Pice_25_T._Fld98581RRef
    LEFT JOIN _Reference191X1 AS PriceType_T
        ON Pice_25_T._Fld98585RRef = PriceType_T._IDRRef
    LEFT JOIN _Reference84 AS CurrType
        ON Pice_25_T._Fld98588RRef = CurrType._IDRRef
WHERE PriceType_T._Fld53072 IN
    (
        N'ПоследняяЗакупочная',
        N'ПоследняяЗакупочнаяБезНДС',
        N'БюджетнаяЦена',
        N'PMC_Материальная',
        N'PMC_Цеховая'
    )
    AND Pice_25_T._Period BETWEEN @DateFrom AND @DateTo;
"""

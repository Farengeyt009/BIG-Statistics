-- =============================================
-- Представление для детальных данных Sale Plan с подтягиванием групп
-- =============================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_SalesPlan_Details' AND schema_id = SCHEMA_ID('Orders'))
BEGIN
    DROP VIEW Orders.vw_SalesPlan_Details;
    PRINT 'Старое представление удалено';
END
GO

CREATE VIEW Orders.vw_SalesPlan_Details
AS
SELECT
    d.DetailID,
    d.VersionID,
    d.YearNum,
    d.MonthNum,
    d.Market,
    d.Article_number,
    d.Name,
    d.QTY,
    -- Подтягиваем группы из справочника Ref.Product_Guide
    ISNULL(pg.LargeGroup, N'Non Data') AS LargeGroup,
    ISNULL(pg.GroupName, N'Non Data') AS GroupName,
    -- Метаданные версии
    v.UploadedAt,
    v.UploadedBy,
    v.FileName,
    v.Comment AS VersionComment,
    v.IsActive
FROM Orders.SalesPlan_Details AS d
LEFT JOIN Ref.Product_Guide AS pg
    ON d.Article_number = LTRIM(RTRIM(pg.FactoryNumber))
LEFT JOIN Orders.SalesPlan_Versions AS v
    ON d.VersionID = v.VersionID
GO

PRINT '========================================='
PRINT 'Представление Orders.vw_SalesPlan_Details создано!'
PRINT 'Подтягивает LargeGroup и GroupName из Ref.Product_Guide'
PRINT '========================================='
GO

-- Проверка
SELECT TOP 10 * FROM Orders.vw_SalesPlan_Details;
GO


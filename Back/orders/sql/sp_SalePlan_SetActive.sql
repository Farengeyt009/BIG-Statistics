-- =============================================
-- Процедура для установки активной версии Sale Plan
-- Только одна версия может быть активной в пределах одного года
-- =============================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_SalePlan_SetActive' AND schema_id = SCHEMA_ID('Orders'))
BEGIN
    DROP PROCEDURE Orders.sp_SalePlan_SetActive;
    PRINT 'Старая процедура удалена';
END
GO

CREATE PROCEDURE Orders.sp_SalePlan_SetActive
    @VersionID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    
    -- Проверяем существование версии
    IF NOT EXISTS (SELECT 1 FROM Orders.SalesPlan_Versions WHERE VersionID = @VersionID)
    BEGIN
        RAISERROR('Версия с ID %d не найдена', 16, 1, @VersionID);
        RETURN;
    END
    
    -- Получаем год этой версии
    DECLARE @Year INT;
    SELECT @Year = MinYear 
    FROM Orders.SalesPlan_Versions 
    WHERE VersionID = @VersionID;
    
    BEGIN TRANSACTION;
    
    -- Снимаем флаг IsActive со всех версий ЭТОГО ЖЕ ГОДА
    UPDATE Orders.SalesPlan_Versions
    SET IsActive = 0
    WHERE MinYear = @Year;
    
    -- Устанавливаем флаг IsActive для выбранной версии
    UPDATE Orders.SalesPlan_Versions
    SET IsActive = 1
    WHERE VersionID = @VersionID;
    
    COMMIT TRANSACTION;
    
    PRINT CONCAT('Версия ', @VersionID, ' установлена как активная для ', @Year, ' года');
END
GO

PRINT '========================================='
PRINT 'Процедура Orders.sp_SalePlan_SetActive создана!'
PRINT 'Логика: только одна активная версия на год'
PRINT '========================================='
GO


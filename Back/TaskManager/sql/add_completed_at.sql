-- =============================================
-- Добавление колонки completed_at для отслеживания даты завершения
-- =============================================

-- Добавляем колонку completed_at в таблицу tasks
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.tasks') 
    AND name = 'completed_at'
)
BEGIN
    ALTER TABLE Task_Manager.tasks
    ADD completed_at DATETIME2 NULL;
    
    PRINT 'Колонка completed_at добавлена в Task_Manager.tasks';
END
ELSE
BEGIN
    PRINT 'Колонка completed_at уже существует';
END
GO

PRINT '========================================='
PRINT 'Обновление схемы завершено!'
PRINT '========================================='


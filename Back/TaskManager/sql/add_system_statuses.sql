-- =============================================
-- Добавление флага is_system для защиты системных статусов
-- =============================================

-- Добавляем колонку is_system
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_statuses') 
    AND name = 'is_system'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_statuses
    ADD is_system BIT DEFAULT 0;
    
    PRINT 'Колонка is_system добавлена в Task_Manager.workflow_statuses';
END
GO

-- Помечаем существующие базовые статусы как системные
-- Это нужно сделать для каждого проекта
UPDATE Task_Manager.workflow_statuses
SET is_system = 1
WHERE name IN ('Новая', 'В работе', 'Завершена', 'Отменена')
GO

PRINT '========================================='
PRINT 'Системные статусы защищены!'
PRINT 'Помечены: Новая, В работе, Завершена, Отменена'
PRINT '========================================='


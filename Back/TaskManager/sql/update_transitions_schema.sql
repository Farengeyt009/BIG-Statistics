-- =============================================
-- Обновление схемы переходов для гибких прав
-- =============================================

-- Добавляем колонку для списка конкретных пользователей
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'allowed_users'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD allowed_users NVARCHAR(MAX) NULL;  -- JSON массив: [106, 108, 109]
    
    PRINT 'Колонка allowed_users добавлена';
END
GO

-- Добавляем тип проверки: по ролям или по пользователям
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'permission_type'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD permission_type NVARCHAR(20) DEFAULT 'roles' CHECK (permission_type IN ('roles', 'users', 'any'));
    -- 'roles' - по ролям (используется allowed_roles)
    -- 'users' - по конкретным пользователям (используется allowed_users)
    -- 'any' - любой участник проекта
    
    PRINT 'Колонка permission_type добавлена';
END
GO

PRINT '========================================='
PRINT 'Схема переходов обновлена!'
PRINT '========================================='


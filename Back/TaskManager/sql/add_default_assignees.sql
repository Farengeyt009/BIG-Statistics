-- =============================================
-- Добавление полей для исполнителей по умолчанию
-- =============================================

-- Добавляем колонку для исполнителя задач по умолчанию
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.projects') 
    AND name = 'default_assignee_id'
)
BEGIN
    ALTER TABLE Task_Manager.projects
    ADD default_assignee_id INT NULL;
    
    ALTER TABLE Task_Manager.projects
    ADD CONSTRAINT FK_projects_default_assignee 
    FOREIGN KEY (default_assignee_id) REFERENCES Users.users(UserID);
    
    PRINT 'Колонка default_assignee_id добавлена в Task_Manager.projects';
END
GO

-- Добавляем колонку для исполнителя подзадач по умолчанию
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.projects') 
    AND name = 'default_subtask_assignee_id'
)
BEGIN
    ALTER TABLE Task_Manager.projects
    ADD default_subtask_assignee_id INT NULL;
    
    ALTER TABLE Task_Manager.projects
    ADD CONSTRAINT FK_projects_default_subtask_assignee 
    FOREIGN KEY (default_subtask_assignee_id) REFERENCES Users.users(UserID);
    
    PRINT 'Колонка default_subtask_assignee_id добавлена в Task_Manager.projects';
END
GO

PRINT '========================================='
PRINT 'Колонки для исполнителей по умолчанию добавлены!'
PRINT '========================================='


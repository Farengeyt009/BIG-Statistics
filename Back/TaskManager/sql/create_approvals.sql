-- =============================================
-- Таблица согласований задач
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_approvals' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.task_approvals (
        id INT IDENTITY(1,1) PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        approved_at DATETIME2 DEFAULT GETDATE(),
        comment NVARCHAR(MAX),
        CONSTRAINT FK_task_approvals_task FOREIGN KEY (task_id) REFERENCES Task_Manager.tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_task_approvals_user FOREIGN KEY (user_id) REFERENCES Users.users(UserID),
        CONSTRAINT UQ_task_approval UNIQUE (task_id, user_id) -- Один пользователь = одно согласование
    );
    
    CREATE INDEX idx_task_approvals_task ON Task_Manager.task_approvals(task_id);
    CREATE INDEX idx_task_approvals_user ON Task_Manager.task_approvals(user_id);
    
    PRINT 'Таблица Task_Manager.task_approvals создана';
END
ELSE
BEGIN
    PRINT 'Таблица Task_Manager.task_approvals уже существует';
END
GO

PRINT '========================================='
PRINT 'Таблица согласований готова!'
PRINT '========================================='


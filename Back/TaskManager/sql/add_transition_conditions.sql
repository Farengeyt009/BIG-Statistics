-- Добавление условий для переходов
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'requires_attachment'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD requires_attachment BIT DEFAULT 0;
    
    PRINT 'Колонка requires_attachment добавлена';
END
GO

-- Для будущих условий
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'requires_approvals'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD requires_approvals BIT DEFAULT 0;
    
    PRINT 'Колонка requires_approvals добавлена';
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'required_approvals_count'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD required_approvals_count INT DEFAULT 0;
    
    PRINT 'Колонка required_approvals_count добавлена';
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'required_approvers'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD required_approvers NVARCHAR(MAX) NULL;  -- JSON массив user_id
    
    PRINT 'Колонка required_approvers добавлена';
END
GO

PRINT '========================================='
PRINT 'Условия переходов добавлены!'
PRINT '========================================='


-- Добавление флага для двунаправленных переходов
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'is_bidirectional'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD is_bidirectional BIT DEFAULT 0;
    
    PRINT 'Колонка is_bidirectional добавлена';
END
GO


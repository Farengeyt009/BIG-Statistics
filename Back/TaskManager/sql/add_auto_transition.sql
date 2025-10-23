-- Добавление флага автоперевода
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Task_Manager.workflow_transitions') 
    AND name = 'auto_transition'
)
BEGIN
    ALTER TABLE Task_Manager.workflow_transitions
    ADD auto_transition BIT DEFAULT 0;
    
    PRINT 'Колонка auto_transition добавлена';
END
GO

PRINT 'Флаг автоперевода добавлен!';


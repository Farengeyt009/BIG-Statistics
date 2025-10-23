-- =============================================
-- Исправление CASCADE для подзадач
-- =============================================

-- Удаляем старый FK
IF EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_tasks_parent' 
    AND parent_object_id = OBJECT_ID('Task_Manager.tasks')
)
BEGIN
    ALTER TABLE Task_Manager.tasks
    DROP CONSTRAINT FK_tasks_parent;
    
    PRINT 'Старый FK удален';
END
GO

-- Создаем новый с CASCADE
ALTER TABLE Task_Manager.tasks
ADD CONSTRAINT FK_tasks_parent 
FOREIGN KEY (parent_task_id) 
REFERENCES Task_Manager.tasks(id) 
ON DELETE CASCADE;

PRINT '========================================='
PRINT 'FK с CASCADE создан!'
PRINT 'Теперь удаление задачи удалит все подзадачи'
PRINT '========================================='


-- Обновляем по конкретным ID для проекта 1
UPDATE Task_Manager.workflow_statuses
SET is_system = 1
WHERE id IN (1, 2, 4, 5)  -- Новая, В работе, Завершена, Отменена

-- Проверяем результат
SELECT id, name, is_system FROM Task_Manager.workflow_statuses WHERE project_id = 1

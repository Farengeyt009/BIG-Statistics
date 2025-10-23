-- =============================================
-- Кастомные поля для проектов
-- =============================================

-- Определение кастомных полей
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'custom_fields' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.custom_fields (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        field_name NVARCHAR(255) NOT NULL,
        field_type NVARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox')),
        field_options NVARCHAR(MAX), -- JSON для select: ["Option 1", "Option 2"]
        is_required BIT DEFAULT 0,
        is_active BIT DEFAULT 1, -- можно скрыть поле
        order_index INT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE(),
        created_by INT NOT NULL,
        CONSTRAINT FK_custom_fields_project FOREIGN KEY (project_id) REFERENCES Task_Manager.projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_custom_fields_user FOREIGN KEY (created_by) REFERENCES Users.users(UserID)
    );
    CREATE INDEX idx_custom_fields_project ON Task_Manager.custom_fields(project_id);
    CREATE INDEX idx_custom_fields_active ON Task_Manager.custom_fields(is_active);
    PRINT 'Таблица Task_Manager.custom_fields создана'
END
GO

-- Значения кастомных полей для задач
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'custom_field_values' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.custom_field_values (
        id INT IDENTITY(1,1) PRIMARY KEY,
        task_id INT NOT NULL,
        field_id INT NOT NULL,
        value NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_custom_field_values_task FOREIGN KEY (task_id) REFERENCES Task_Manager.tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_custom_field_values_field FOREIGN KEY (field_id) REFERENCES Task_Manager.custom_fields(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_task_field UNIQUE (task_id, field_id)
    );
    CREATE INDEX idx_custom_field_values_task ON Task_Manager.custom_field_values(task_id);
    CREATE INDEX idx_custom_field_values_field ON Task_Manager.custom_field_values(field_id);
    PRINT 'Таблица Task_Manager.custom_field_values создана'
END
GO

PRINT '========================================='
PRINT 'Таблицы для кастомных полей созданы!'
PRINT '========================================='


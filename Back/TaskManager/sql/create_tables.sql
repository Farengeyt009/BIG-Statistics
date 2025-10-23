-- =============================================
-- Task Manager Database Schema for MSSQL
-- Все таблицы создаются в схеме Task_Manager
-- =============================================

-- Создание схемы Task_Manager
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Task_Manager')
BEGIN
    EXEC('CREATE SCHEMA Task_Manager')
    PRINT 'Схема Task_Manager создана'
END
GO

-- Категории проектов
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'project_categories' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.project_categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        icon NVARCHAR(50),
        color NVARCHAR(50),
        created_by INT NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_project_categories_user FOREIGN KEY (created_by) REFERENCES Users.users(UserID)
    );
    CREATE INDEX idx_project_categories_created_by ON Task_Manager.project_categories(created_by);
    PRINT 'Таблица Task_Manager.project_categories создана'
END
GO

-- Проекты
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'projects' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.projects (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        category_id INT,
        owner_id INT NOT NULL,
        has_workflow_permissions BIT DEFAULT 0, -- включены ли права на переходы между статусами
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_projects_category FOREIGN KEY (category_id) REFERENCES Task_Manager.project_categories(id) ON DELETE SET NULL,
        CONSTRAINT FK_projects_owner FOREIGN KEY (owner_id) REFERENCES Users.users(UserID)
    );
    CREATE INDEX idx_projects_owner ON Task_Manager.projects(owner_id);
    CREATE INDEX idx_projects_category ON Task_Manager.projects(category_id);
    PRINT 'Таблица Task_Manager.projects создана'
END
GO

-- Участники проектов
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'project_members' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.project_members (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        user_id INT NOT NULL,
        role NVARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        added_by INT,
        added_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_project_members_project FOREIGN KEY (project_id) REFERENCES Task_Manager.projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_project_members_user FOREIGN KEY (user_id) REFERENCES Users.users(UserID),
        CONSTRAINT FK_project_members_added_by FOREIGN KEY (added_by) REFERENCES Users.users(UserID),
        CONSTRAINT UQ_project_user UNIQUE (project_id, user_id)
    );
    CREATE INDEX idx_project_members_project ON Task_Manager.project_members(project_id);
    CREATE INDEX idx_project_members_user ON Task_Manager.project_members(user_id);
    PRINT 'Таблица Task_Manager.project_members создана'
END
GO

-- Статусы воркфлоу
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_statuses' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.workflow_statuses (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        color NVARCHAR(50),
        order_index INT DEFAULT 0,
        is_initial BIT DEFAULT 0, -- начальный статус для новых задач
        is_final BIT DEFAULT 0,   -- финальный статус (завершенные задачи)
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_workflow_statuses_project FOREIGN KEY (project_id) REFERENCES Task_Manager.projects(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_workflow_statuses_project ON Task_Manager.workflow_statuses(project_id);
    PRINT 'Таблица Task_Manager.workflow_statuses создана'
END
GO

-- Переходы воркфлоу (для проектов с has_workflow_permissions = 1)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_transitions' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.workflow_transitions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        from_status_id INT NOT NULL,
        to_status_id INT NOT NULL,
        name NVARCHAR(100), -- название кнопки перехода, например "Взять в работу"
        allowed_roles NVARCHAR(MAX), -- JSON array: ["admin", "member"]
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_workflow_transitions_project FOREIGN KEY (project_id) REFERENCES Task_Manager.projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_workflow_transitions_from FOREIGN KEY (from_status_id) REFERENCES Task_Manager.workflow_statuses(id),
        CONSTRAINT FK_workflow_transitions_to FOREIGN KEY (to_status_id) REFERENCES Task_Manager.workflow_statuses(id)
    );
    CREATE INDEX idx_workflow_transitions_project ON Task_Manager.workflow_transitions(project_id);
    CREATE INDEX idx_workflow_transitions_from ON Task_Manager.workflow_transitions(from_status_id);
    PRINT 'Таблица Task_Manager.workflow_transitions создана'
END
GO

-- Теги
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tags' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.tags (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        color NVARCHAR(50),
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_tags_project FOREIGN KEY (project_id) REFERENCES Task_Manager.projects(id) ON DELETE CASCADE,
        CONSTRAINT UQ_tag_name_project UNIQUE (project_id, name)
    );
    CREATE INDEX idx_tags_project ON Task_Manager.tags(project_id);
    PRINT 'Таблица Task_Manager.tags создана'
END
GO

-- Задачи
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tasks' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.tasks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        parent_task_id INT NULL, -- NULL для основных задач, FK для подзадач
        title NVARCHAR(500) NOT NULL,
        description NVARCHAR(MAX),
        status_id INT NOT NULL,
        assignee_id INT,
        creator_id INT NOT NULL,
        priority NVARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        due_date DATE,
        order_index INT DEFAULT 0, -- для сортировки внутри статуса
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_tasks_project FOREIGN KEY (project_id) REFERENCES Task_Manager.projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES Task_Manager.tasks(id),
        CONSTRAINT FK_tasks_status FOREIGN KEY (status_id) REFERENCES Task_Manager.workflow_statuses(id),
        CONSTRAINT FK_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES Users.users(UserID),
        CONSTRAINT FK_tasks_creator FOREIGN KEY (creator_id) REFERENCES Users.users(UserID)
    );
    CREATE INDEX idx_tasks_project ON Task_Manager.tasks(project_id);
    CREATE INDEX idx_tasks_status ON Task_Manager.tasks(status_id);
    CREATE INDEX idx_tasks_assignee ON Task_Manager.tasks(assignee_id);
    CREATE INDEX idx_tasks_creator ON Task_Manager.tasks(creator_id);
    CREATE INDEX idx_tasks_parent ON Task_Manager.tasks(parent_task_id);
    PRINT 'Таблица Task_Manager.tasks создана'
END
GO

-- Связь задач с тегами
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_tags' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.task_tags (
        task_id INT NOT NULL,
        tag_id INT NOT NULL,
        PRIMARY KEY (task_id, tag_id),
        CONSTRAINT FK_task_tags_task FOREIGN KEY (task_id) REFERENCES Task_Manager.tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_task_tags_tag FOREIGN KEY (tag_id) REFERENCES Task_Manager.tags(id) ON DELETE NO ACTION
    );
    PRINT 'Таблица Task_Manager.task_tags создана'
END
GO

-- Вложения
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_attachments' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.task_attachments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        task_id INT NOT NULL,
        file_name NVARCHAR(255) NOT NULL,
        file_path NVARCHAR(500) NOT NULL,
        file_size BIGINT,
        mime_type NVARCHAR(100),
        uploaded_by INT NOT NULL,
        uploaded_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_task_attachments_task FOREIGN KEY (task_id) REFERENCES Task_Manager.tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_task_attachments_user FOREIGN KEY (uploaded_by) REFERENCES Users.users(UserID)
    );
    CREATE INDEX idx_task_attachments_task ON Task_Manager.task_attachments(task_id);
    PRINT 'Таблица Task_Manager.task_attachments создана'
END
GO

-- Комментарии
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_comments' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.task_comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        comment NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_task_comments_task FOREIGN KEY (task_id) REFERENCES Task_Manager.tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_task_comments_user FOREIGN KEY (user_id) REFERENCES Users.users(UserID)
    );
    CREATE INDEX idx_task_comments_task ON Task_Manager.task_comments(task_id);
    CREATE INDEX idx_task_comments_user ON Task_Manager.task_comments(user_id);
    PRINT 'Таблица Task_Manager.task_comments создана'
END
GO

-- История изменений (для будущего)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_history' AND schema_id = SCHEMA_ID('Task_Manager'))
BEGIN
    CREATE TABLE Task_Manager.task_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        action_type NVARCHAR(50) NOT NULL, -- created, updated, status_changed, assigned, etc.
        field_changed NVARCHAR(100),
        old_value NVARCHAR(MAX),
        new_value NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_task_history_task FOREIGN KEY (task_id) REFERENCES Task_Manager.tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_task_history_user FOREIGN KEY (user_id) REFERENCES Users.users(UserID)
    );
    CREATE INDEX idx_task_history_task ON Task_Manager.task_history(task_id);
    CREATE INDEX idx_task_history_created_at ON Task_Manager.task_history(created_at);
    PRINT 'Таблица Task_Manager.task_history создана'
END
GO

PRINT '========================================='
PRINT 'Все таблицы Task Manager успешно созданы в схеме Task_Manager!'
PRINT '========================================='


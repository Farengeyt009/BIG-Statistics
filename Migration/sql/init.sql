-- Migration/sql/init.sql
-- Run this script ONCE on the target (WeChat_APP) database to prepare
-- the schema and table used by the migration monitoring system.
--
-- Safe to run multiple times (IF NOT EXISTS guards).
-- ============================================================

-- 1. Create schema
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'Migration')
BEGIN
    EXEC('CREATE SCHEMA Migration');
    PRINT 'Schema Migration created.';
END
ELSE
BEGIN
    PRINT 'Schema Migration already exists.';
END
GO

-- 2. Create status table
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Migration'
      AND TABLE_NAME   = 'ScriptStatus'
)
BEGIN
    CREATE TABLE Migration.ScriptStatus (
        ScriptID          NVARCHAR(100)   NOT NULL,           -- unique script identifier
        ScriptName        NVARCHAR(255)   NOT NULL,           -- human-readable name
        Category          NVARCHAR(50)    NOT NULL DEFAULT 'continuous',
        IntervalSeconds   INT             NULL,               -- NULL for scheduled scripts
        Status            NVARCHAR(50)    NOT NULL DEFAULT 'unknown',
        -- Status values: unknown | running | success | error | stopped
        Pid               INT             NULL,               -- OS process id
        LastStart         DATETIME        NULL,
        LastSuccess       DATETIME        NULL,
        LastError         DATETIME        NULL,
        ErrorMessage      NVARCHAR(2000)  NULL,
        RecordsProcessed  INT             NULL DEFAULT 0,
        CycleCount        INT             NULL DEFAULT 0,
        UpdatedAt         DATETIME        NOT NULL DEFAULT GETDATE(),

        CONSTRAINT PK_Migration_ScriptStatus PRIMARY KEY (ScriptID)
    );

    PRINT 'Table Migration.ScriptStatus created.';
END
ELSE
BEGIN
    PRINT 'Table Migration.ScriptStatus already exists.';
END
GO

# Хранимые процедуры

> Сгенерировано: 2026-04-08 21:13

## Содержание

- [Import_1C.sp_SwitchSnapshot_Daily_PlanFact](#import_1c_sp_switchsnapshot_daily_planfact)
- [Import_1C.sp_SwitchSnapshot_FactScan_OnAssembly](#import_1c_sp_switchsnapshot_factscan_onassembly)
- [Import_1C.sp_SwitchSnapshot_Import_BOM](#import_1c_sp_switchsnapshot_import_bom)
- [Import_1C.sp_SwitchSnapshot_Labor_Cost](#import_1c_sp_switchsnapshot_labor_cost)
- [Import_1C.sp_SwitchSnapshot_Materials_Move](#import_1c_sp_switchsnapshot_materials_move)
- [Import_1C.sp_SwitchSnapshot_Nomenclature_Reference](#import_1c_sp_switchsnapshot_nomenclature_reference)
- [Import_1C.sp_SwitchSnapshot_Order_1C_v2](#import_1c_sp_switchsnapshot_order_1c_v2)
- [Import_1C.sp_SwitchSnapshot_Outsource_Price](#import_1c_sp_switchsnapshot_outsource_price)
- [Import_1C.sp_SwitchSnapshot_Price_List](#import_1c_sp_switchsnapshot_price_list)
- [Import_1C.sp_SwitchSnapshot_QC_Cards](#import_1c_sp_switchsnapshot_qc_cards)
- [Import_1C.sp_SwitchSnapshot_QC_Journal](#import_1c_sp_switchsnapshot_qc_journal)
- [Import_1C.sp_SwitchSnapshot_Shipments](#import_1c_sp_switchsnapshot_shipments)
- [Orders.sp_SalePlan_SetActive](#orders_sp_saleplan_setactive)
- [Orders.sp_Shipment_Plan_Upsert](#orders_sp_shipment_plan_upsert)
- [Production_TV.sp_Refresh_AllCaches_D0](#production_tv_sp_refresh_allcaches_d0)
- [Production_TV.sp_Refresh_AllCaches_Range](#production_tv_sp_refresh_allcaches_range)
- [Production_TV.sp_Refresh_Cache_Fact_Day](#production_tv_sp_refresh_cache_fact_day)
- [Production_TV.sp_Refresh_Cache_Fact_Takt](#production_tv_sp_refresh_cache_fact_takt)
- [Production_TV.sp_Refresh_Cache_OrderSlots](#production_tv_sp_refresh_cache_orderslots)
- [Production_TV.sp_Refresh_Cache_OrderSlots_Day](#production_tv_sp_refresh_cache_orderslots_day)
- [Production_TV.sp_Refresh_Cache_Plan_Base](#production_tv_sp_refresh_cache_plan_base)
- [Production_TV.sp_Refresh_Cache_WorkingSpans_Day](#production_tv_sp_refresh_cache_workingspans_day)
- [Production_TV.sp_Update_Cache_Status](#production_tv_sp_update_cache_status)
- [QC.sp_Refresh_Defects_Movement](#qc_sp_refresh_defects_movement)
- [QC.sp_Refresh_LQC_Journal](#qc_sp_refresh_lqc_journal)
- [QC.sp_Refresh_Production_Output_Cost](#qc_sp_refresh_production_output_cost)
- [QC.sp_Refresh_QC_Cards_Summary](#qc_sp_refresh_qc_cards_summary)
- [QC.sp_Refresh_QC_Repainting_Bom](#qc_sp_refresh_qc_repainting_bom)
- [Ref.sp_Generate_WeekSegments](#ref_sp_generate_weeksegments)
- [Ref.sp_Upsert_WorkShop_CustomWS](#ref_sp_upsert_workshop_customws)
- [Ref.usp_Refresh_BOM_Plastic_Weight](#ref_usp_refresh_bom_plastic_weight)
- [Ref.usp_Refresh_BOM_Stamping_Weight](#ref_usp_refresh_bom_stamping_weight)
- [TimeLoss.sp_Entry_Copy](#timeloss_sp_entry_copy)
- [TimeLoss.sp_Entry_Delete](#timeloss_sp_entry_delete)
- [TimeLoss.sp_SaveWorkSchedules_Set](#timeloss_sp_saveworkschedules_set)
- [TimeLoss.sp_WorkingSchedule_Create](#timeloss_sp_workingschedule_create)
- [TimeLoss.sp_WorkingSchedule_Explain](#timeloss_sp_workingschedule_explain)
- [TimeLoss.sp_WorkingSchedule_Replace](#timeloss_sp_workingschedule_replace)
- [TimeLoss.sp_WorkingSchedule_Restore](#timeloss_sp_workingschedule_restore)
- [TimeLoss.sp_WorkingSchedule_Save](#timeloss_sp_workingschedule_save)
- [TimeLoss.sp_WorkingSchedule_SoftDelete](#timeloss_sp_workingschedule_softdelete)
- [TimeLoss.sp_WorkingSchedule_UpdateHeader](#timeloss_sp_workingschedule_updateheader)

---

<a name="import_1c_sp_switchsnapshot_daily_planfact"></a>

## Import_1C.sp_SwitchSnapshot_Daily_PlanFact

```sql
CREATE   PROC Import_1C.sp_SwitchSnapshot_Daily_PlanFact
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,
  @DateTo       DATE = NULL,
  @Full         BIT  = 0,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.Daily_PlanFact';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.Daily_PlanFact');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_Daily_PlanFact WHERE SnapshotID=@SnapshotID)
    THROW 52001, 'stg_Daily_PlanFact is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.Daily_PlanFact') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_Daily_PlanFact') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    IF @Full = 1
    BEGIN
      SET @sql = N'
        INSERT INTO Import_1C.Daily_PlanFact (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Daily_PlanFact
        WHERE SnapshotID = @SnapshotIDParam;';
      EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Daily_PlanFact' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Daily_PlanFact
        WHERE SnapshotID <> @SnapshotID;
    END
    ELSE
    BEGIN
      IF @DateFrom IS NULL OR @DateTo IS NULL
        THROW 52002, 'For windowed refresh provide @DateFrom and @DateTo', 1;

      SET @sql = N'
        INSERT INTO Import_1C.Daily_PlanFact (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Daily_PlanFact
        WHERE SnapshotID = @SnapshotIDParam
          AND OnlyDate BETWEEN @DateFromParam AND @DateToParam;';
      EXEC sp_executesql @sql,
        N'@SnapshotIDParam UNIQUEIDENTIFIER, @DateFromParam DATE, @DateToParam DATE',
        @SnapshotIDParam=@SnapshotID, @DateFromParam=@DateFrom, @DateToParam=@DateTo;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Daily_PlanFact' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Daily_PlanFact
        WHERE OnlyDate BETWEEN @DateFrom AND @DateTo
          AND SnapshotID <> @SnapshotID;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52003, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.Daily_PlanFact',
    FullRefresh = @Full,
    DateFrom    = @DateFrom, DateTo = @DateTo,
    NewSnapshot = @SnapshotID, PrevSnapshot = @PrevSna
```

---

<a name="import_1c_sp_switchsnapshot_factscan_onassembly"></a>

## Import_1C.sp_SwitchSnapshot_FactScan_OnAssembly

```sql
CREATE   PROC Import_1C.sp_SwitchSnapshot_FactScan_OnAssembly
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,   -- окно по CAST(ScanMinute AS date)
  @DateTo       DATE = NULL,
  @Full         BIT  = 0,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.FactScan_OnAssembly';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.FactScan_OnAssembly');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_FactScan_OnAssembly WHERE SnapshotID=@SnapshotID)
    THROW 52101, 'stg_FactScan_OnAssembly is empty for the given SnapshotID', 1;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Import_1C.stg_FactScan_OnAssembly') AND name='SnapshotID')
     OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Import_1C.FactScan_OnAssembly') AND name='SnapshotID')
    THROW 52104, 'SnapshotID column must exist in both staging and target tables', 1;

  DECLARE @colList NVARCHAR(MAX);

  ;WITH tgt AS (
    SELECT c.name, c.column_id
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('Import_1C.FactScan_OnAssembly')
      AND c.is_computed = 0
  ),
  stg AS (
    SELECT c.name
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('Import_1C.stg_FactScan_OnAssembly')
      AND c.is_computed = 0
  )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t
  JOIN stg s ON s.name = t.name;

  IF @colList IS NULL
    THROW 52105, 'No common columns found between staging and target', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    IF @Full = 1
    BEGIN
      SET @sql = N'
        INSERT INTO Import_1C.FactScan_OnAssembly (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_FactScan_OnAssembly
        WHERE SnapshotID = @SnapshotIDParam;';
      EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.FactScan_OnAssembly' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1 AND @PrevSnapshot IS NOT NULL AND @PrevSnapshot <> @SnapshotID
        DELETE FROM Import_1C.FactScan_OnAssembly WHERE SnapshotID = @PrevSnapshot;
    END
    ELSE
    BEGIN
      IF @DateFrom IS NULL OR @DateTo IS NULL
        THROW 52102, 'For windowed refresh you must pass @DateFrom and @DateTo', 1;

      SET @sql = N'
        INSERT INTO Import_1C.FactScan_OnAssembly (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_FactScan_OnAssembly s
        WHERE s.SnapshotID = @SnapshotIDParam
          AND CAST(s.ScanMinute AS date) BETWEEN @DateFromParam AND @DateToParam;';
      EXEC sp_executesql @sql,
        N'@SnapshotIDParam UNIQUEIDENTIFIER, @DateFromParam DATE, @DateToParam DATE',
        @SnapshotIDParam=@SnapshotID, @DateFromParam=@DateFrom, @DateToParam=@DateTo;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.FactScan_OnAssembly' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1 AND @PrevSnapshot IS NOT NULL AND @PrevSnapshot <> @SnapshotID
        DELETE FROM Import_1C.FactScan_OnAssembly
        WHERE Snapsho
```

---

<a name="import_1c_sp_switchsnapshot_import_bom"></a>

## Import_1C.sp_SwitchSnapshot_Import_BOM

```sql
-- ========================================
-- Процедура переключения снимка
-- ========================================
CREATE PROC Import_1C.sp_SwitchSnapshot_Import_BOM
  @SnapshotID   UNIQUEIDENTIFIER,
  @Full         BIT  = 1,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.Import_BOM';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.Import_BOM');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_Import_BOM WHERE SnapshotID=@SnapshotID)
    THROW 52001, 'stg_Import_BOM is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.Import_BOM') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_Import_BOM') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    -- Для BOM всегда полный refresh (т.к. нет дат для окон)
    SET @sql = N'
      INSERT INTO Import_1C.Import_BOM (' + @colList + N')
      SELECT ' + @colList + N'
      FROM Import_1C.stg_Import_BOM
      WHERE SnapshotID = @SnapshotIDParam;';
    EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

    MERGE Import_1C.SnapshotPointer AS tgt
    USING (SELECT CAST('Import_1C.Import_BOM' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
    ON (tgt.TableName = src.TableName)
    WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

    IF @CleanupPrev = 1
      DELETE FROM Import_1C.Import_BOM
      WHERE SnapshotID <> @SnapshotID;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52003, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.Import_BOM',
    FullRefresh = @Full,
    NewSnapshot = @SnapshotID,
    PrevSnapshot = @PrevSnapshot,
    RowsInView  = (SELECT COUNT(*) FROM Import_1C.vw_Import_BOM_Current);
END
```

---

<a name="import_1c_sp_switchsnapshot_labor_cost"></a>

## Import_1C.sp_SwitchSnapshot_Labor_Cost

```sql
CREATE PROC Import_1C.sp_SwitchSnapshot_Labor_Cost
    @SnapshotID   UNIQUEIDENTIFIER,
    @Full         BIT = 1,
    @CleanupPrev  BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sp_getapplock @Resource = 'LockLaborCost', @LockMode = 'Exclusive';

    IF NOT EXISTS (
        SELECT 1 FROM Import_1C.stg_Labor_Cost
        WHERE SnapshotID = @SnapshotID
    )
        BEGIN
            EXEC sp_releaseapplock @Resource = 'LockLaborCost';
            RAISERROR('No data in staging for given SnapshotID', 16, 1);
            RETURN;
        END

    INSERT INTO Import_1C.Labor_Cost
    SELECT * FROM Import_1C.stg_Labor_Cost
    WHERE SnapshotID = @SnapshotID;

    MERGE Import_1C.SnapshotPointer AS tgt
    USING (SELECT 'Import_1C.Labor_Cost' AS TableName, @SnapshotID AS SnapshotID) AS src
    ON tgt.TableName = src.TableName
    WHEN MATCHED THEN UPDATE SET tgt.SnapshotID = src.SnapshotID, tgt.UpdatedAt = sysutcdatetime()
    WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

    IF @CleanupPrev = 1
        BEGIN
            DELETE FROM Import_1C.Labor_Cost
            WHERE SnapshotID <> @SnapshotID;

            DELETE FROM Import_1C.stg_Labor_Cost
            WHERE SnapshotID = @SnapshotID;
        END

    EXEC sp_releaseapplock @Resource = 'LockLaborCost';
END;
```

---

<a name="import_1c_sp_switchsnapshot_materials_move"></a>

## Import_1C.sp_SwitchSnapshot_Materials_Move

```sql
-- ── 4. Хранимая процедура переключения снимка ─────────────────
CREATE PROCEDURE Import_1C.sp_SwitchSnapshot_Materials_Move
    @SnapshotID  UNIQUEIDENTIFIER,
    @DateFrom    DATE            = NULL,
    @DateTo      DATE            = NULL,
    @Full        BIT             = 0,
    @CleanupPrev BIT             = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @rc INT;

    -- Блокировка на уровне процедуры (исключаем параллельные вызовы)
    EXEC @rc = sp_getapplock
               @Resource        = 'SwitchSnapshot_Materials_Move',
               @LockMode        = 'Exclusive',
               @LockOwner       = 'Session',
               @LockTimeout     = 60000;

    IF @rc < 0
        BEGIN
            RAISERROR('sp_SwitchSnapshot_Materials_Move: не удалось получить блокировку.', 16, 1);
            RETURN;
        END;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Проверяем наличие данных в staging
        IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_Materials_Move WHERE SnapshotID = @SnapshotID)
            BEGIN
                ROLLBACK TRANSACTION;
                EXEC sp_releaseapplock @Resource = 'SwitchSnapshot_Materials_Move', @LockOwner = 'Session';
                RAISERROR('stg_Materials_Move: нет данных для SnapshotID.', 16, 1);
                RETURN;
            END;

        IF @Full = 1
            BEGIN
                -- Полное обновление: вставляем все строки из staging
                INSERT INTO Import_1C.Materials_Move
                SELECT * FROM Import_1C.stg_Materials_Move
                WHERE SnapshotID = @SnapshotID;
            END
        ELSE
            BEGIN
                -- Оконное обновление: вставляем строки за период
                INSERT INTO Import_1C.Materials_Move
                SELECT * FROM Import_1C.stg_Materials_Move
                WHERE SnapshotID = @SnapshotID
                  AND Doc_Date BETWEEN @DateFrom AND @DateTo;
            END;

        -- Очищаем staging
        DELETE FROM Import_1C.stg_Materials_Move WHERE SnapshotID = @SnapshotID;

        -- Обновляем указатель на текущий снимок
        MERGE Import_1C.SnapshotPointer AS t
        USING (SELECT 'Import_1C.Materials_Move' AS TableName) AS s
        ON t.TableName = s.TableName
        WHEN MATCHED     THEN UPDATE SET SnapshotID = @SnapshotID, UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, @SnapshotID);

        -- Удаляем старые снимки (кроме текущего)
        IF @CleanupPrev = 1
            BEGIN
                IF @Full = 1
                    BEGIN
                        -- При полном обновлении удаляем ВСЕ старые снимки
                        DELETE FROM Import_1C.Materials_Move
                        WHERE SnapshotID <> @SnapshotID;
                    END
                ELSE
                    BEGIN
                        -- При оконном обновлении удаляем только строки вне окна у старых снимков
                        -- (текущий снимок уже очищен предочисткой в Python перед вызовом процедуры)
                        DELETE FROM Import_1C.Materials_Move
                        WHERE SnapshotID <> @SnapshotID;
                    END;
            END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        EXEC sp_releaseapplock @Resource = 'SwitchSnapshot_Materials_Move', @LockOwner = 'Session';
        THROW;
    END CATCH;

    EXEC sp_releaseapplock @Resource = 'SwitchSnapshot_Materials_Move', @LockOwner = 'Session';
END;
```

---

<a name="import_1c_sp_switchsnapshot_nomenclature_reference"></a>

## Import_1C.sp_SwitchSnapshot_Nomenclature_Reference

```sql
-- ========================================
-- Процедура переключения снимка
-- ========================================
CREATE PROC Import_1C.sp_SwitchSnapshot_Nomenclature_Reference
  @SnapshotID   UNIQUEIDENTIFIER,
  @Full         BIT  = 1,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.Nomenclature_Reference';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.Nomenclature_Reference');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_Nomenclature_Reference WHERE SnapshotID=@SnapshotID)
    THROW 52001, 'stg_Nomenclature_Reference is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.Nomenclature_Reference') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_Nomenclature_Reference') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    -- Для Nomenclature_Reference всегда полный refresh (т.к. нет дат для окон)
    SET @sql = N'
      INSERT INTO Import_1C.Nomenclature_Reference (' + @colList + N')
      SELECT ' + @colList + N'
      FROM Import_1C.stg_Nomenclature_Reference
      WHERE SnapshotID = @SnapshotIDParam;';
    EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

    MERGE Import_1C.SnapshotPointer AS tgt
    USING (SELECT CAST('Import_1C.Nomenclature_Reference' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
    ON (tgt.TableName = src.TableName)
    WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

    IF @CleanupPrev = 1
      DELETE FROM Import_1C.Nomenclature_Reference
      WHERE SnapshotID <> @SnapshotID;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52003, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.Nomenclature_Reference',
    FullRefresh = @Full,
    NewSnapshot = @SnapshotID,
    PrevSnapshot = @PrevSnapshot,
    RowsInView  = (SELECT COUNT(*) FROM Import_1C.vw_Nomenclature_Reference_Current);
END
```

---

<a name="import_1c_sp_switchsnapshot_order_1c_v2"></a>

## Import_1C.sp_SwitchSnapshot_Order_1C_v2

```sql
-- ============================================================
-- Шаг 3: Обновить sp_SwitchSnapshot_Order_1C_v2
--         Добавить новые поля в оба списка INSERT
-- ============================================================
CREATE PROCEDURE Import_1C.sp_SwitchSnapshot_Order_1C_v2
    @SnapshotID UNIQUEIDENTIFIER,
    @CleanupPrev BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TableName SYSNAME = 'Import_1C.Order_1C_v2';
    DECLARE @OldSnapshotID UNIQUEIDENTIFIER;

    BEGIN TRANSACTION;

    SELECT @OldSnapshotID = SnapshotID
    FROM Import_1C.SnapshotPointer
    WHERE TableName = @TableName;

    INSERT INTO Import_1C.Order_1C_v2 (
        Posted,
        NomenclatureID,
        Security_SchemeID,
        Order_StatusID,
        ClientID,
        OrderID,
        ProductionOrderID,
        Client,
        Security_Scheme,
        Order_Delete_Mark,
        Order_Status,
        OrderDate,
        OrderConformDay,
        RunOrderDay,
        OrderShipmentDay,
        OrderShipmentDay_OR_T2,
        PlannedShipmentDay,
        ProductionOrder,
        Order_No,
        Article_number,
        Name_CN,
        Market,
        Total_Order_QTY,
        ToProduce_QTY,
        Cancelled_QTY,
        ProdOrder_QTY,
        TotalWork_QTY,
        CloseWork_QTY,
        Scan_QTY,
        Shipment_QTY,
        CloseWork_StartDay,
        CloseWork_FinishDay,
        ScanStartDay,
        ScanFinishDay,
        ShipmentDate,
        UnitPrice_Base,
        Amount_Base,
        PriceTypeID,
        PriceTypeName,
        CNYRate,
        UnitPrice_CNY,
        Amount_CNY,
        SingleDateShipmentFlag,
        -- Новые поля:
        IsInternal,
        ProductTagRu,
        ProductTagZh,
        Agent_ID,
        Client_Country_ID,
        Client_Manager_ID,
        Client_Country_Ru,
        Client_Country_En,
        Client_Manager,
        SnapshotID
    )
    SELECT
        Posted,
        NomenclatureID,
        Security_SchemeID,
        Order_StatusID,
        ClientID,
        OrderID,
        ProductionOrderID,
        Client,
        Security_Scheme,
        Order_Delete_Mark,
        Order_Status,
        OrderDate,
        OrderConformDay,
        RunOrderDay,
        OrderShipmentDay,
        OrderShipmentDay_OR_T2,
        PlannedShipmentDay,
        ProductionOrder,
        Order_No,
        Article_number,
        Name_CN,
        Market,
        Total_Order_QTY,
        ToProduce_QTY,
        Cancelled_QTY,
        ProdOrder_QTY,
        TotalWork_QTY,
        CloseWork_QTY,
        Scan_QTY,
        Shipment_QTY,
        CloseWork_StartDay,
        CloseWork_FinishDay,
        ScanStartDay,
        ScanFinishDay,
        ShipmentDate,
        UnitPrice_Base,
        Amount_Base,
        PriceTypeID,
        PriceTypeName,
        CNYRate,
        UnitPrice_CNY,
        Amount_CNY,
        SingleDateShipmentFlag,
        -- Новые поля:
        IsInternal,
        ProductTagRu,
        ProductTagZh,
        Agent_ID,
        Client_Country_ID,
        Client_Manager_ID,
        Client_Country_Ru,
        Client_Country_En,
        Client_Manager,
        SnapshotID
    FROM Import_1C.stg_Order_1C_v2
    WHERE SnapshotID = @SnapshotID;

    IF EXISTS (SELECT 1 FROM Import_1C.SnapshotPointer WHERE TableName = @TableName)
        UPDATE Import_1C.SnapshotPointer
        SET SnapshotID = @SnapshotID, UpdatedAt = SYSUTCDATETIME()
        WHERE TableName = @TableName;
    ELSE
        INSERT INTO Import_1C.SnapshotPointer (TableName, SnapshotID, UpdatedAt)
        VALUES (@TableName, @SnapshotID, SYSUTCDATETIME());

    IF @CleanupPrev = 1 AND @OldSnapshotID IS NOT NULL
        DELETE FROM Import_1C.Order_1C_v2
        WHERE SnapshotID = @OldSnapshotID;

    COMMIT TRANSACTION;

    SELECT
        @SnapshotID    AS NewSnapshotID,
        @OldSnap
```

---

<a name="import_1c_sp_switchsnapshot_outsource_price"></a>

## Import_1C.sp_SwitchSnapshot_Outsource_Price

```sql
-- ========================================
-- Процедура переключения снимка
-- ========================================
CREATE PROC Import_1C.sp_SwitchSnapshot_Outsource_Price
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,
  @DateTo       DATE = NULL,
  @Full         BIT  = 1,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.Outsource_Price';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.Outsource_Price');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_Outsource_Price WHERE SnapshotID=@SnapshotID)
    THROW 52001, 'stg_Outsource_Price is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.Outsource_Price') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_Outsource_Price') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    IF @Full = 1
    BEGIN
      SET @sql = N'
        INSERT INTO Import_1C.Outsource_Price (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Outsource_Price
        WHERE SnapshotID = @SnapshotIDParam;';
      EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Outsource_Price' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Outsource_Price
        WHERE SnapshotID <> @SnapshotID;
    END
    ELSE
    BEGIN
      IF @DateFrom IS NULL OR @DateTo IS NULL
        THROW 52002, 'For windowed refresh provide @DateFrom and @DateTo', 1;

      SET @sql = N'
        INSERT INTO Import_1C.Outsource_Price (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Outsource_Price
        WHERE SnapshotID = @SnapshotIDParam
          AND [Date] BETWEEN @DateFromParam AND @DateToParam;';
      EXEC sp_executesql @sql,
        N'@SnapshotIDParam UNIQUEIDENTIFIER, @DateFromParam DATE, @DateToParam DATE',
        @SnapshotIDParam=@SnapshotID, @DateFromParam=@DateFrom, @DateToParam=@DateTo;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Outsource_Price' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Outsource_Price
        WHERE [Date] BETWEEN @DateFrom AND @DateTo
          AND SnapshotID <> @SnapshotID;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52003, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.Outsource_Pri
```

---

<a name="import_1c_sp_switchsnapshot_price_list"></a>

## Import_1C.sp_SwitchSnapshot_Price_List

```sql
-- Stored Procedure (не меняется, работает динамически)
CREATE PROC Import_1C.sp_SwitchSnapshot_Price_List
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,
  @DateTo       DATE = NULL,
  @Full         BIT  = 1,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.Price_List';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.Price_List');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_Price_List WHERE SnapshotID=@SnapshotID)
    THROW 52001, 'stg_Price_List is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.Price_List') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_Price_List') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    IF @Full = 1
    BEGIN
      SET @sql = N'
        INSERT INTO Import_1C.Price_List (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Price_List
        WHERE SnapshotID = @SnapshotIDParam;';
      EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Price_List' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Price_List
        WHERE SnapshotID <> @SnapshotID;
    END
    ELSE
    BEGIN
      IF @DateFrom IS NULL OR @DateTo IS NULL
        THROW 52002, 'For windowed refresh provide @DateFrom and @DateTo', 1;

      SET @sql = N'
        INSERT INTO Import_1C.Price_List (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Price_List
        WHERE SnapshotID = @SnapshotIDParam
          AND [Date] BETWEEN @DateFromParam AND @DateToParam;';
      EXEC sp_executesql @sql,
        N'@SnapshotIDParam UNIQUEIDENTIFIER, @DateFromParam DATE, @DateToParam DATE',
        @SnapshotIDParam=@SnapshotID, @DateFromParam=@DateFrom, @DateToParam=@DateTo;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Price_List' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Price_List
        WHERE [Date] BETWEEN @DateFrom AND @DateTo
          AND SnapshotID <> @SnapshotID;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52003, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.Price_List',
    FullRefresh = @Full,
    DateFrom    = @DateFrom,
    DateTo      = @DateTo,
    NewSnapshot = @SnapshotID,
    PrevSnapshot = @PrevS
```

---

<a name="import_1c_sp_switchsnapshot_qc_cards"></a>

## Import_1C.sp_SwitchSnapshot_QC_Cards

```sql
-- ========================================
-- Процедура переключения снимка
-- ========================================
CREATE PROC Import_1C.sp_SwitchSnapshot_QC_Cards
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,
  @DateTo       DATE = NULL,
  @Full         BIT  = 1,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.QC_Cards';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.QC_Cards');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_QC_Cards WHERE SnapshotID=@SnapshotID)
    THROW 52001, 'stg_QC_Cards is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.QC_Cards') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_QC_Cards') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    IF @Full = 1
    BEGIN
      SET @sql = N'
        INSERT INTO Import_1C.QC_Cards (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_QC_Cards
        WHERE SnapshotID = @SnapshotIDParam;';
      EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.QC_Cards' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.QC_Cards
        WHERE SnapshotID <> @SnapshotID;
    END
    ELSE
    BEGIN
      IF @DateFrom IS NULL OR @DateTo IS NULL
        THROW 52002, 'For windowed refresh provide @DateFrom and @DateTo', 1;

      SET @sql = N'
        INSERT INTO Import_1C.QC_Cards (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_QC_Cards
        WHERE SnapshotID = @SnapshotIDParam
          AND Create_Date BETWEEN @DateFromParam AND @DateToParam;';
      EXEC sp_executesql @sql,
        N'@SnapshotIDParam UNIQUEIDENTIFIER, @DateFromParam DATE, @DateToParam DATE',
        @SnapshotIDParam=@SnapshotID, @DateFromParam=@DateFrom, @DateToParam=@DateTo;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.QC_Cards' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.QC_Cards
        WHERE Create_Date BETWEEN @DateFrom AND @DateTo
          AND SnapshotID <> @SnapshotID;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52003, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.QC_Cards',
    FullRefresh = @Full,
    DateFrom    = @DateFrom,
    DateTo      = @DateTo,
    NewSnaps
```

---

<a name="import_1c_sp_switchsnapshot_qc_journal"></a>

## Import_1C.sp_SwitchSnapshot_QC_Journal

```sql
-- ========================================
-- Процедура переключения снимка
-- ========================================
CREATE PROC Import_1C.sp_SwitchSnapshot_QC_Journal
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,
  @DateTo       DATE = NULL,
  @Full         BIT  = 1,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.QC_Journal';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.QC_Journal');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_QC_Journal WHERE SnapshotID=@SnapshotID)
    THROW 52001, 'stg_QC_Journal is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.QC_Journal') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_QC_Journal') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    IF @Full = 1
    BEGIN
      SET @sql = N'
        INSERT INTO Import_1C.QC_Journal (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_QC_Journal
        WHERE SnapshotID = @SnapshotIDParam;';
      EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.QC_Journal' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.QC_Journal
        WHERE SnapshotID <> @SnapshotID;
    END
    ELSE
    BEGIN
      IF @DateFrom IS NULL OR @DateTo IS NULL
        THROW 52002, 'For windowed refresh provide @DateFrom and @DateTo', 1;

      SET @sql = N'
        INSERT INTO Import_1C.QC_Journal (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_QC_Journal
        WHERE SnapshotID = @SnapshotIDParam
          AND [Date] BETWEEN @DateFromParam AND @DateToParam;';
      EXEC sp_executesql @sql,
        N'@SnapshotIDParam UNIQUEIDENTIFIER, @DateFromParam DATE, @DateToParam DATE',
        @SnapshotIDParam=@SnapshotID, @DateFromParam=@DateFrom, @DateToParam=@DateTo;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.QC_Journal' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.QC_Journal
        WHERE [Date] BETWEEN @DateFrom AND @DateTo
          AND SnapshotID <> @SnapshotID;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52003, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.QC_Journal',
    FullRefresh = @Full,
    DateFrom    = @DateFrom,
    DateTo      =
```

---

<a name="import_1c_sp_switchsnapshot_shipments"></a>

## Import_1C.sp_SwitchSnapshot_Shipments

```sql
CREATE   PROC Import_1C.sp_SwitchSnapshot_Shipments
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,  -- окно по SpendingOrder_Date_Real
  @DateTo       DATE = NULL,
  @Full         BIT  = 0,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @lock SYSNAME = N'Import_1C.Shipments';
  DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
    (SELECT SnapshotID FROM Import_1C.SnapshotPointer WHERE TableName='Import_1C.Shipments');

  IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_Shipments WHERE SnapshotID=@SnapshotID)
    THROW 52011, 'stg_Shipments is empty for given SnapshotID', 1;

  DECLARE @colList NVARCHAR(MAX);
  ;WITH tgt AS (
      SELECT c.name, c.column_id
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.Shipments') AND c.is_computed = 0
    ),
    stg AS (
      SELECT c.name
      FROM sys.columns c
      WHERE c.object_id = OBJECT_ID('Import_1C.stg_Shipments') AND c.is_computed = 0
    )
  SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
  FROM tgt t JOIN stg s ON s.name = t.name;

  IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
    THROW 52014, 'Common column list is empty or SnapshotID missing', 1;

  EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=60000;

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @sql NVARCHAR(MAX);

    IF @Full = 1
    BEGIN
      SET @sql = N'
        INSERT INTO Import_1C.Shipments (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Shipments
        WHERE SnapshotID = @SnapshotIDParam;';
      EXEC sp_executesql @sql, N'@SnapshotIDParam UNIQUEIDENTIFIER', @SnapshotIDParam=@SnapshotID;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Shipments' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Shipments WHERE SnapshotID <> @SnapshotID;
    END
    ELSE
    BEGIN
      IF @DateFrom IS NULL OR @DateTo IS NULL
        THROW 52012, 'For windowed refresh provide @DateFrom and @DateTo', 1;

      SET @sql = N'
        INSERT INTO Import_1C.Shipments (' + @colList + N')
        SELECT ' + @colList + N'
        FROM Import_1C.stg_Shipments
        WHERE SnapshotID = @SnapshotIDParam
          AND CONVERT(date, SpendingOrder_Date_Real) BETWEEN @DateFromParam AND @DateToParam;';
      EXEC sp_executesql @sql,
        N'@SnapshotIDParam UNIQUEIDENTIFIER, @DateFromParam DATE, @DateToParam DATE',
        @SnapshotIDParam=@SnapshotID, @DateFromParam=@DateFrom, @DateToParam=@DateTo;

      MERGE Import_1C.SnapshotPointer AS tgt
      USING (SELECT CAST('Import_1C.Shipments' AS sysname) AS TableName, @SnapshotID AS SnapshotID) AS src
      ON (tgt.TableName = src.TableName)
      WHEN MATCHED THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (src.TableName, src.SnapshotID);

      IF @CleanupPrev = 1
        DELETE FROM Import_1C.Shipments
        WHERE CONVERT(date, SpendingOrder_Date_Real) BETWEEN @DateFrom AND @DateTo
          AND SnapshotID <> @SnapshotID;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    DECLARE @msg NVARCHAR(4000)=ERROR_MESSAGE();
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
    THROW 52013, @msg, 1;
  END CATCH

  EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

  SELECT
    TableName   = 'Import_1C.Shipments',
    FullRefresh = @Full,
    DateFrom    = @DateFrom, DateTo = @DateTo,
    NewSnapshot = @SnapshotID, PrevSnapshot =
```

---

<a name="orders_sp_saleplan_setactive"></a>

## Orders.sp_SalePlan_SetActive

```sql
CREATE PROCEDURE Orders.sp_SalePlan_SetActive
    @VersionID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Проверяем существование версии
    IF NOT EXISTS (SELECT 1 FROM Orders.SalesPlan_Versions WHERE VersionID = @VersionID)
    BEGIN
        RAISERROR('Версия с ID %d не найдена', 16, 1, @VersionID);
        RETURN;
    END

    -- Получаем год этой версии
    DECLARE @Year INT;
    SELECT @Year = MinYear
    FROM Orders.SalesPlan_Versions
    WHERE VersionID = @VersionID;

    BEGIN TRANSACTION;

    -- Снимаем флаг IsActive со всех версий ЭТОГО ЖЕ ГОДА
    UPDATE Orders.SalesPlan_Versions
    SET IsActive = 0
    WHERE MinYear = @Year;

    -- Устанавливаем флаг IsActive для выбранной версии
    UPDATE Orders.SalesPlan_Versions
    SET IsActive = 1
    WHERE VersionID = @VersionID;

    COMMIT TRANSACTION;

    PRINT CONCAT('Версия ', @VersionID, ' установлена как активная для ', @Year, ' года');
END
```

---

<a name="orders_sp_shipment_plan_upsert"></a>

## Orders.sp_Shipment_Plan_Upsert

```sql
CREATE PROCEDURE Orders.sp_Shipment_Plan_Upsert
  @PeriodID             int,
  @ShipMonth_PlanPcs    decimal(19,4) = NULL,
  @ShipWeek_PlanPcs     decimal(19,4) = NULL,
  @FGStockStartWeekPcs  decimal(19,4) = NULL,
  @ContainerQty         decimal(10,2) = NULL,
  @Comment              nvarchar(500) = NULL,
  @UpdatedBy            nvarchar(128)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;

  MERGE Orders.Shipment_Plan AS t
  USING (SELECT @PeriodID AS PeriodID) AS s
     ON t.PeriodID = s.PeriodID
  WHEN MATCHED THEN
    UPDATE SET
      ShipMonth_PlanPcs    = @ShipMonth_PlanPcs,
      ShipWeek_PlanPcs     = @ShipWeek_PlanPcs,
      FGStockStartWeekPcs  = @FGStockStartWeekPcs,
      ContainerQty         = @ContainerQty,
      Comment              = @Comment,
      UpdatedAt            = sysdatetime(),
      UpdatedBy            = @UpdatedBy
  WHEN NOT MATCHED THEN
    INSERT (PeriodID, ShipMonth_PlanPcs, ShipWeek_PlanPcs, FGStockStartWeekPcs, ContainerQty, Comment, UpdatedAt, UpdatedBy)
    VALUES (@PeriodID, @ShipMonth_PlanPcs, @ShipWeek_PlanPcs, @FGStockStartWeekPcs, @ContainerQty, @Comment, sysdatetime(), @UpdatedBy);
END
```

---

<a name="production_tv_sp_refresh_allcaches_d0"></a>

## Production_TV.sp_Refresh_AllCaches_D0

```sql
CREATE   PROCEDURE Production_TV.sp_Refresh_AllCaches_D0
  @date       date = NULL,
  @workshop   nvarchar(256) = NULL,
  @workcenter nvarchar(256) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF @date IS NULL SET @date = CONVERT(date, SYSDATETIME());

  EXEC Production_TV.sp_Refresh_Cache_WorkingSpans_Day @date;
  EXEC Production_TV.sp_Refresh_Cache_Plan_Base        @date;
  EXEC Production_TV.sp_Refresh_Cache_OrderSlots       @date, @workshop, @workcenter;
  EXEC Production_TV.sp_Refresh_Cache_Fact_Day         @date;
  EXEC Production_TV.sp_Refresh_Cache_Fact_Takt        @date;
END;
```

---

<a name="production_tv_sp_refresh_allcaches_range"></a>

## Production_TV.sp_Refresh_AllCaches_Range

```sql
CREATE   PROCEDURE Production_TV.sp_Refresh_AllCaches_Range
  @date_from  date,
  @date_to    date,
  @workshop   nvarchar(256) = NULL,
  @workcenter nvarchar(256) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @date_from IS NULL OR @date_to IS NULL
  BEGIN
    RAISERROR('Both @date_from and @date_to are required.', 16, 1);
    RETURN;
  END;

  IF @date_to < @date_from
  BEGIN
    DECLARE @swap date = @date_from;
    SET @date_from = @date_to;
    SET @date_to   = @swap;
  END;

  DECLARE @d date = @date_from;

  WHILE @d <= @date_to
  BEGIN
    -- порядок важен
    EXEC Production_TV.sp_Refresh_Cache_WorkingSpans_Day @d;
    EXEC Production_TV.sp_Refresh_Cache_Plan_Base        @d;
    EXEC Production_TV.sp_Refresh_Cache_OrderSlots       @d, @workshop, @workcenter;
    EXEC Production_TV.sp_Refresh_Cache_Fact_Day         @d;
    EXEC Production_TV.sp_Refresh_Cache_Fact_Takt        @d;

    SET @d = DATEADD(DAY, 1, @d);
  END
END;
```

---

<a name="production_tv_sp_refresh_cache_fact_day"></a>

## Production_TV.sp_Refresh_Cache_Fact_Day

```sql
-- Добавим фиксацию свежести для слоя FactDay
CREATE   PROCEDURE Production_TV.sp_Refresh_Cache_Fact_Day
  @date date
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRAN;

  IF OBJECT_ID('tempdb..#FactDay','U') IS NOT NULL DROP TABLE #FactDay;

  SELECT
      @date                                 AS OnlyDate,
      f.WorkCenter_CN                       AS WorkCenterID,
      COALESCE(f.NormOrder,   N'__NULL__')  AS NormOrder,
      COALESCE(f.NormArticle, N'__NULL__')  AS NormArticle,
      SUM(f.Scan_QTY)                        AS FactQtyDay,
      MAX(LTRIM(RTRIM(f.OrderNumber)))       AS OrderNumberRaw,
      MAX(LTRIM(RTRIM(f.NomenclatureNumber)))AS ArticleNumberRaw
  INTO #FactDay
  FROM Import_1C.vw_FactScan_OnAssembly_Current f
  WHERE f.OnlyDate = @date
    AND f.WorkCenter_CN IS NOT NULL
  GROUP BY
      f.WorkCenter_CN,
      COALESCE(f.NormOrder,   N'__NULL__'),
      COALESCE(f.NormArticle, N'__NULL__');

  DELETE FROM Production_TV.Cache_Fact_Day
  WHERE OnlyDate = @date;

  INSERT INTO Production_TV.Cache_Fact_Day
      (OnlyDate, WorkCenterID, NormOrder, NormArticle, FactQtyDay, OrderNumberRaw, ArticleNumberRaw)
  SELECT OnlyDate, WorkCenterID, NormOrder, NormArticle, FactQtyDay, OrderNumberRaw, ArticleNumberRaw
  FROM #FactDay;

  COMMIT;

  EXEC Production_TV.sp_Update_Cache_Status N'FactDay', @date;
END;
```

---

<a name="production_tv_sp_refresh_cache_fact_takt"></a>

## Production_TV.sp_Refresh_Cache_Fact_Takt

```sql
CREATE PROCEDURE Production_TV.sp_Refresh_Cache_Fact_Takt
@date date
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    -- 1) Спаны на дату
    IF OBJECT_ID('tempdb..#Spans','U') IS NOT NULL DROP TABLE #Spans;
    SELECT
        WorkShopID,
        WorkCenterID,
        SpanStart,
        SpanEnd
    INTO #Spans
    FROM Production_TV.Cache_WorkingSpans_Day
    WHERE OnlyDate = @date;

    -- 2) Факты внутри спанов
    IF OBJECT_ID('tempdb..#FactInSpans','U') IS NOT NULL DROP TABLE #FactInSpans;
    SELECT
        @date                                AS OnlyDate,
        s.WorkShopID,
        s.WorkCenterID,
        COALESCE(f.NormOrder,   N'__NULL__') AS NormOrder,
        COALESCE(f.NormArticle, N'__NULL__') AS NormArticle,
        f.ScanMinute,
        f.Scan_QTY
    INTO #FactInSpans
    FROM #Spans s
             JOIN Import_1C.vw_FactScan_OnAssembly_Current f
                  ON f.WorkCenter_CN = s.WorkCenterID
                      AND f.OnlyDate      = @date
                      AND f.ScanMinute   >= s.SpanStart
                      AND f.ScanMinute   <  s.SpanEnd;

    -- 3) Агрегаты по группе
    IF OBJECT_ID('tempdb..#Agg','U') IS NOT NULL DROP TABLE #Agg;
    SELECT
        OnlyDate,
        WorkShopID,
        WorkCenterID,
        NormOrder,
        NormArticle,
        MIN(ScanMinute) AS FirstValidMinute,
        MAX(ScanMinute) AS LastValidMinute,
        SUM(Scan_QTY)   AS ValidQty
    INTO #Agg
    FROM #FactInSpans
    GROUP BY
        OnlyDate,
        WorkShopID,
        WorkCenterID,
        NormOrder,
        NormArticle;

    -- 4) Секунды работы в пределах спанов
    IF OBJECT_ID('tempdb..#WorkSec','U') IS NOT NULL DROP TABLE #WorkSec;
    SELECT
        a.OnlyDate,
        a.WorkShopID,
        a.WorkCenterID,
        a.NormOrder,
        a.NormArticle,
        a.FirstValidMinute,
        a.LastValidMinute,
        a.ValidQty,
        SUM(
                DATEDIFF(
                        SECOND,
                        CASE WHEN s.SpanStart > a.FirstValidMinute THEN s.SpanStart ELSE a.FirstValidMinute END,
                        CASE WHEN s.SpanEnd   < a.LastValidMinute  THEN s.SpanEnd   ELSE a.LastValidMinute  END
                )
        ) AS WorkSecBetweenScans
    INTO #WorkSec
    FROM #Agg a
             JOIN #Spans s
                  ON s.WorkShopID   = a.WorkShopID
                      AND s.WorkCenterID = a.WorkCenterID
                      AND s.SpanEnd   > a.FirstValidMinute
                      AND s.SpanStart < a.LastValidMinute
    GROUP BY
        a.OnlyDate,
        a.WorkShopID,
        a.WorkCenterID,
        a.NormOrder,
        a.NormArticle,
        a.FirstValidMinute,
        a.LastValidMinute,
        a.ValidQty;

    -- 5) Перезапись кэша
    DELETE FROM Production_TV.Cache_Fact_Takt
    WHERE OnlyDate = @date;

    INSERT INTO Production_TV.Cache_Fact_Takt
    (OnlyDate, WorkShopID, WorkCenterID, NormOrder, NormArticle,
     FirstValidMinute, LastValidMinute, ValidQty, WorkSecBetweenScans, TaktFactSec)
    SELECT
        OnlyDate,
        WorkShopID,
        WorkCenterID,
        NormOrder,
        NormArticle,
        FirstValidMinute,
        LastValidMinute,
        ValidQty,
        WorkSecBetweenScans,
        CAST(ROUND(CAST(WorkSecBetweenScans AS float) / NULLIF(ValidQty,0), 2) AS decimal(10,2))
    FROM #WorkSec;

    COMMIT;

    EXEC Production_TV.sp_Update_Cache_Status N'FactTakt', @date;
END;
```

---

<a name="production_tv_sp_refresh_cache_orderslots"></a>

## Production_TV.sp_Refresh_Cache_OrderSlots

```sql
CREATE   PROCEDURE Production_TV.sp_Refresh_Cache_OrderSlots
  @date       date,
  @workshop   nvarchar(256) = NULL,
  @workcenter nvarchar(256) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;

  DELETE FROM Production_TV.Cache_OrderSlots
  WHERE OnlyDate = @date
    AND (@workshop   IS NULL OR WorkShopID   = @workshop)
    AND (@workcenter IS NULL OR WorkCenterID = @workcenter);

  INSERT INTO Production_TV.Cache_OrderSlots
    (OnlyDate, WorkShopID, WorkCenterID, Line_No,
     OrderNumber, NomenclatureNumber, NormOrder, NormArticle,
     Plan_QTY, PlanRealHours, SlotStart, SlotEnd)
  SELECT
     @date,
     s.WorkShopID, s.WorkCenterID, s.Line_No,
     s.OrderNumber, s.NomenclatureNumber, s.NormOrder, s.NormArticle,
     s.Plan_QTY, s.PlanRealHours, s.SlotStart, s.SlotEnd
  FROM Production_TV.fn_OrderSlots_Cyclic(@date, @workshop, @workcenter) AS s;

  EXEC Production_TV.sp_Update_Cache_Status N'OrderSlots', @date;
END
```

---

<a name="production_tv_sp_refresh_cache_orderslots_day"></a>

## Production_TV.sp_Refresh_Cache_OrderSlots_Day

```sql
CREATE   PROCEDURE Production_TV.sp_Refresh_Cache_OrderSlots_Day
  @date date
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;

  -- 1) чистим день
  DELETE FROM Production_TV.Cache_OrderSlots WHERE OnlyDate = @date;

  -- 2) берём все пары цех/РЦ, по которым есть смены в этот день
  ;WITH Pairs AS (
    SELECT DISTINCT ws.WorkShopID, ws.WorkCenterID
    FROM Production_TV.Cache_WorkingSpans_Day ws
    WHERE ws.OnlyDate = @date
  )
  INSERT INTO Production_TV.Cache_OrderSlots
    (OnlyDate, WorkShopID, WorkCenterID, Line_No,
     OrderNumber, NomenclatureNumber, NormOrder, NormArticle,
     Plan_QTY, PlanRealHours, SlotStart, SlotEnd)
  SELECT
     @date,
     s.WorkShopID, s.WorkCenterID, s.Line_No,
     s.OrderNumber, s.NomenclatureNumber, s.NormOrder, s.NormArticle,
     s.Plan_QTY, s.PlanRealHours, s.SlotStart, s.SlotEnd
  FROM Pairs p
  CROSS APPLY Production_TV.fn_OrderSlots_Cyclic(@date, p.WorkShopID, p.WorkCenterID) AS s;

  -- 3) статус
  EXEC Production_TV.sp_Update_Cache_Status N'OrderSlots', @date;
END
```

---

<a name="production_tv_sp_refresh_cache_plan_base"></a>

## Production_TV.sp_Refresh_Cache_Plan_Base

```sql
CREATE   PROCEDURE Production_TV.sp_Refresh_Cache_Plan_Base
  @date date
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRAN;

  IF OBJECT_ID('tempdb..#Plan','U') IS NOT NULL DROP TABLE #Plan;

  SELECT DISTINCT
      d.OnlyDate,
      d.WorkShopName_CH       AS WorkShopID,
      d.WorkCenter_Custom_CN  AS WorkCenterID,
      d.Line_No,                                -- сохраняем как есть
      d.OrderNumber,
      d.NomenclatureNumber,
      d.ProductName_CN,
      CAST(d.Plan_QTY      AS decimal(18,4)) AS Plan_QTY,
      CAST(d.PlanRealHours AS decimal(18,4)) AS PlanRealHours,
      UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(d.OrderNumber))        ,' ',''),NCHAR(160),''),CHAR(9),''),CHAR(13),'')) AS NormOrder,
      UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(d.NomenclatureNumber)) ,' ',''),NCHAR(160),''),CHAR(9),''),CHAR(13),'')) AS NormArticle
  INTO #Plan
  FROM Views_For_Plan.DailyPlan_CustomWS d
  JOIN Production_TV.Workshops_Allowlist wa
    ON wa.IsEnabled = 1
   AND wa.WorkShopID = d.WorkShopName_CH
  WHERE d.OnlyDate = @date
    AND d.Line_No IS NOT NULL;                  -- исключаем «не из плана»

  DELETE FROM Production_TV.Cache_Plan_Base
  WHERE OnlyDate = @date;

  INSERT INTO Production_TV.Cache_Plan_Base
      (OnlyDate, WorkShopID, WorkCenterID, Line_No, OrderNumber, NomenclatureNumber,
       ProductName_CN, Plan_QTY, PlanRealHours, NormOrder, NormArticle)
  SELECT OnlyDate, WorkShopID, WorkCenterID, Line_No, OrderNumber, NomenclatureNumber,
         ProductName_CN, Plan_QTY, PlanRealHours, NormOrder, NormArticle
  FROM #Plan;

  COMMIT;

  -- фиксируем свежесть слоя
  EXEC Production_TV.sp_Update_Cache_Status N'PlanBase', @date;
END;
```

---

<a name="production_tv_sp_refresh_cache_workingspans_day"></a>

## Production_TV.sp_Refresh_Cache_WorkingSpans_Day

```sql
CREATE   PROCEDURE Production_TV.sp_Refresh_Cache_WorkingSpans_Day
  @date date
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRAN;

  IF OBJECT_ID('tempdb..#Spans', 'U') IS NOT NULL DROP TABLE #Spans;

  ;WITH DayBounds AS (
      SELECT CAST(@date AS datetime2(0)) AS DayStart,
             DATEADD(DAY,1,CAST(@date AS datetime2(0))) AS DayEnd
  ),
  Sched AS (
      SELECT wsbd.OnlyDate, wsbd.WorkShopID, wsbd.WorkCenterID, wsbd.ScheduleID
     FROM TimeLoss.WorkSchedules_ByDay wsbd
    JOIN Production_TV.Workshops_Allowlist wa
    ON wa.IsEnabled = 1 AND wa.WorkShopID = wsbd.WorkShopID
    WHERE wsbd.OnlyDate = @date
    AND wsbd.DeleteMark = 0 
  ),
  Lines AS (
      SELECT
          s.WorkShopID,
          s.WorkCenterID,
          wst.TypeID,
          DATEADD(SECOND, DATEDIFF(SECOND,'00:00:00',CAST(wst.StartTime AS time(0))), d.DayStart) AS RawStart,
          CASE WHEN wst.CrossesMidnight = 1
               THEN d.DayEnd
               ELSE DATEADD(SECOND, DATEDIFF(SECOND,'00:00:00',CAST(wst.EndTime AS time(0))), d.DayStart)
          END AS RawEnd
      FROM Sched s
      JOIN TimeLoss.Working_ScheduleType wst
        ON wst.ScheduleID = s.ScheduleID
      CROSS JOIN DayBounds d
  ),
  Clipped AS (
      SELECT
          WorkShopID, WorkCenterID, TypeID,
          CASE WHEN RawStart < d.DayStart THEN d.DayStart ELSE RawStart END AS StartDT,
          CASE WHEN RawEnd   > d.DayEnd   THEN d.DayEnd   ELSE RawEnd   END AS EndDT
      FROM Lines
      CROSS JOIN DayBounds d
      WHERE RawEnd > RawStart
        AND (CASE WHEN RawStart < d.DayStart THEN d.DayStart ELSE RawStart END)
          < (CASE WHEN RawEnd   > d.DayEnd   THEN d.DayEnd   ELSE RawEnd   END)
  ),
  Shifts AS (
      SELECT WorkShopID, WorkCenterID, StartDT, EndDT
      FROM Clipped
      WHERE UPPER(TypeID) = 'WORKSHIFT'
  ),
  Breaks AS (
      SELECT WorkShopID, WorkCenterID, StartDT, EndDT
      FROM Clipped
      WHERE UPPER(TypeID) = 'BREAKS'
  ),
  SpanUnion AS (
      SELECT s.WorkShopID, s.WorkCenterID, s.StartDT AS EvTime, 0 AS Delta, 1 AS SortKey FROM Shifts s
      UNION ALL
      SELECT s.WorkShopID, s.WorkCenterID, s.EndDT,   0, 1 FROM Shifts s
      UNION ALL
      SELECT s.WorkShopID, s.WorkCenterID,
             CASE WHEN b.StartDT < s.StartDT THEN s.StartDT ELSE b.StartDT END, +1, 0
      FROM Shifts s
      JOIN Breaks b ON b.WorkShopID=s.WorkShopID AND b.WorkCenterID=s.WorkCenterID
                   AND b.EndDT > s.StartDT AND b.StartDT < s.EndDT
      UNION ALL
      SELECT s.WorkShopID, s.WorkCenterID,
             CASE WHEN b.EndDT > s.EndDT THEN s.EndDT ELSE b.EndDT END, -1, 2
      FROM Shifts s
      JOIN Breaks b ON b.WorkShopID=s.WorkShopID AND b.WorkCenterID=s.WorkCenterID
                   AND b.EndDT > s.StartDT AND b.StartDT < s.EndDT
  ),
  Run AS (
      SELECT
        WorkShopID, WorkCenterID, EvTime,
        SUM(Delta) OVER (PARTITION BY WorkShopID, WorkCenterID
                         ORDER BY EvTime, SortKey
                         ROWS UNBOUNDED PRECEDING) AS Cover,
        LEAD(EvTime) OVER (PARTITION BY WorkShopID, WorkCenterID
                           ORDER BY EvTime, SortKey) AS NextEv
      FROM SpanUnion
  ),
  SpansCTE AS (
      SELECT WorkShopID, WorkCenterID, EvTime AS SpanStart, NextEv AS SpanEnd
      FROM Run
      WHERE NextEv IS NOT NULL
        AND Cover = 0
        AND EvTime < NextEv
  )
  SELECT WorkShopID, WorkCenterID, SpanStart, SpanEnd
  INTO #Spans
  FROM SpansCTE;

  DELETE FROM Production_TV.Cache_WorkingSpans_Day
  WHERE OnlyDate = @date;

  INSERT INTO Production_TV.Cache_WorkingSpans_Day
      (OnlyDate, WorkShopID, WorkCenterID, SpanStart, SpanEnd)
  SELECT @date, WorkShopID, WorkCenterID, SpanStart, SpanEnd
  FROM #Spans;

  COMMIT;

  -- фиксируем свежесть слоя
  EXEC Production_TV.sp_Update_Cache_Status N'WorkingSpans', @date;
END;
```

---

<a name="production_tv_sp_update_cache_status"></a>

## Production_TV.sp_Update_Cache_Status

```sql
CREATE   PROCEDURE Production_TV.sp_Update_Cache_Status
  @Layer    sysname,
  @OnlyDate date
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @rc bigint;

  IF @Layer = N'WorkingSpans'
    SELECT @rc = COUNT(*) FROM Production_TV.Cache_WorkingSpans_Day WHERE OnlyDate = @OnlyDate;
  ELSE IF @Layer = N'PlanBase'
    SELECT @rc = COUNT(*) FROM Production_TV.Cache_Plan_Base WHERE OnlyDate = @OnlyDate;
  ELSE IF @Layer = N'OrderSlots'
    SELECT @rc = COUNT(*) FROM Production_TV.Cache_OrderSlots WHERE OnlyDate = @OnlyDate;
  ELSE IF @Layer = N'FactDay'
    SELECT @rc = COUNT(*) FROM Production_TV.Cache_Fact_Day WHERE OnlyDate = @OnlyDate;
  ELSE IF @Layer = N'FactTakt'
    SELECT @rc = COUNT(*) FROM Production_TV.Cache_Fact_Takt WHERE OnlyDate = @OnlyDate;
  ELSE
    RAISERROR('Unknown layer: %s', 16, 1, @Layer);

  MERGE Production_TV.Cache_Status AS tgt
  USING (SELECT @Layer AS [Layer], @OnlyDate AS OnlyDate) AS src
     ON tgt.[Layer] = src.[Layer] AND tgt.OnlyDate = src.OnlyDate
  WHEN MATCHED THEN
    UPDATE SET LastRefreshedAt = SYSDATETIME(), [RowCount] = @rc
  WHEN NOT MATCHED THEN
    INSERT ([Layer], OnlyDate, LastRefreshedAt, [RowCount])
    VALUES (src.[Layer], src.OnlyDate, SYSDATETIME(), @rc);
END;
```

---

<a name="qc_sp_refresh_defects_movement"></a>

## QC.sp_Refresh_Defects_Movement

```sql
-- ── 2. Хранимая процедура обновления ─────────────────────────
CREATE   PROCEDURE QC.sp_Refresh_Defects_Movement
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- Полная перезапись таблицы
    TRUNCATE TABLE QC.Defects_Movement;

    INSERT INTO QC.Defects_Movement
    (
        Delete_Mark, Posted, Doc_Date,
        Avtor_Name, Dep_Name_RU, Dep_Name_ZH, Responsible_Name, Doc_No,
        Sender_Parent_WH_Ru, Sender_Parent_WH_Zh,
        Recipient_Parent_WH_Ru, Recipient_Parent_WH_Zh,
        Sender_WH_Ru, Sender_WH_Zh,
        Recipient_WH_Ru, Recipient_WH_Zh,
        Doc_Comment, Goods_Doc_Comment,
        Nomencl_No, Nomencl_Name_RU, Nomencl_Name_ZH,
        Nomencl_Type_RU, Nomencl_Type_ZH,
        Guilty_Dep_RU, Guilty_Dep_ZH,
        QTY, Price, Total_Cost,
        PriceTypeName, Price_Date,
        Refreshed_At
    )
    SELECT
        a.Delete_Mark,
        a.Posted,
        a.Doc_Date,
        a.Avtor_Name,
        a.Dep_Name_RU,
        a.Dep_Name_ZH,
        a.Responsible_Name,
        a.Doc_No,
        a.Sender_Parent_WH_Ru,
        a.Sender_Parent_WH_Zh,
        a.Recipient_Parent_WH_Ru,
        a.Recipient_Parent_WH_Zh,
        a.Sender_WH_Ru,
        a.Sender_WH_Zh,
        a.Recipient_WH_Ru,
        a.Recipient_WH_Zh,
        a.Doc_Comment,
        a.Goods_Doc_Comment,
        a.Nomencl_No,
        a.Nomencl_Name_RU,
        a.Nomencl_Name_ZH,
        a.Nomencl_Type_RU,
        a.Nomencl_Type_ZH,
        a.Guilty_Dep_RU,
        a.Guilty_Dep_ZH,
        a.QTY,
        COALESCE(price_pmc_by_date.Price, price_pmc_last.Price, price_budget_by_date.Price),
        a.QTY * COALESCE(price_pmc_by_date.Price, price_pmc_last.Price, price_budget_by_date.Price),
        COALESCE(price_pmc_by_date.PriceTypeName, price_pmc_last.PriceTypeName, price_budget_by_date.PriceTypeName),
        COALESCE(price_pmc_by_date.Price_Date,    price_pmc_last.Price_Date,    price_budget_by_date.Price_Date),
        SYSUTCDATETIME()

    FROM Import_1C.vw_Materials_Move_Current AS a

             OUTER APPLY (
        SELECT TOP (1)
            pl.Price,
            pl.PriceTypeName,
            pl.[Date] AS Price_Date
        FROM Import_1C.vw_Price_List_Current AS pl
        WHERE pl.Nomencl_ID    = a.Nomencl_ID
          AND pl.PriceTypeName = N'PMC_Цеховая'
          AND pl.[Date]       <= a.Doc_Date
        ORDER BY pl.[Date] DESC
    ) AS price_pmc_by_date

             OUTER APPLY (
        SELECT TOP (1)
            pl.Price,
            pl.PriceTypeName,
            pl.[Date] AS Price_Date
        FROM Import_1C.vw_Price_List_Current AS pl
        WHERE pl.Nomencl_ID    = a.Nomencl_ID
          AND pl.PriceTypeName = N'PMC_Цеховая'
        ORDER BY pl.[Date] DESC
    ) AS price_pmc_last

             OUTER APPLY (
        SELECT TOP (1)
            pl.Price,
            pl.PriceTypeName,
            pl.[Date] AS Price_Date
        FROM Import_1C.vw_Price_List_Current AS pl
        WHERE pl.Nomencl_ID    = a.Nomencl_ID
          AND pl.PriceTypeName = N'БюджетнаяЦена'
        ORDER BY
            CASE WHEN pl.[Date] <= a.Doc_Date THEN 0 ELSE 1 END ASC,
            CASE WHEN pl.[Date] <= a.Doc_Date THEN pl.[Date] END DESC,
            CASE WHEN pl.[Date] >  a.Doc_Date THEN pl.[Date] END ASC
    ) AS price_budget_by_date

    WHERE a.Doc_Date >= '2025-01-01'
      AND a.Sender_Parent_WH_ID = 0xB5BD00505601355E11EE402281C963BE
      AND a.Recipient_WH_ID IN (
                                0xB3C1C4CBE1AC069511EE629A5A860DF0,
                                0xB3C1C4CBE1AC069511EE6297F53A3D81
        );

    COMMIT TRANSACTION;
END;
```

---

<a name="qc_sp_refresh_lqc_journal"></a>

## QC.sp_Refresh_LQC_Journal

```sql
CREATE PROCEDURE QC.sp_Refresh_LQC_Journal
AS
BEGIN
    SET NOCOUNT ON;

    TRUNCATE TABLE QC.LQC_Journal;

    INSERT INTO QC.LQC_Journal
    (
        [Date], Doc_ID, Delete_Mark, Post_Mark, Doc_No, Doc_Type, Avtor,
        Prod_Order_ID, Prod_Order_No, Customer_Order_ID, Customer_Order_No,
        Control_Tochka_ID, Control_Tochka_Ru, Control_Tochka_Zh,
        Defect_Type_ID, Defect_Type_Ru, Defect_Type_Zh,
        Vinovnik_Dep_ID, Vinovnik_Dep_Ru, Vinovnik_Dep_Zh,
        Work_Nomenclature_ID, Work_Nomenclature_No, Work_Nomenclature_NameRU, Work_Nomenclature_Namezh,
        Prod_Fact_QTY, Defect_QTY, PCI_QTY, PCIRemove_To_Rework_QTY,
        Problem_Description, Problem_Description1, QC_Status,
        LargeGroup, GroupName, Prod_QTY
    )
    SELECT
        j.[Date],
        j.Doc_ID,
        j.Delete_Mark,
        j.Post_Mark,
        j.Doc_No,
        j.Doc_Type,
        j.Avtor,
        j.Prod_Order_ID,
        j.Prod_Order_No,
        j.Customer_Order_ID,
        j.Customer_Order_No,
        j.Control_Tochka_ID,
        j.Control_Tochka_Ru,
        j.Control_Tochka_Zh,
        j.Defect_Type_ID,
        j.Defect_Type_Ru,
        j.Defect_Type_Zh,
        j.Vinovnik_Dep_ID,
        j.Vinovnik_Dep_Ru,
        j.Vinovnik_Dep_Zh,
        j.Work_Nomenclature_ID,
        j.Work_Nomenclature_No,
        j.Work_Nomenclature_NameRU,
        j.Work_Nomenclature_Namezh,
        j.Prod_Fact_QTY,
        j.Defect_QTY,
        j.PCI_QTY,
        j.PCIRemove_To_Rework_QTY,
        j.Problem_Description,
        j.Problem_Description1,
        j.QC_Status,
        t2.LargeGroup,
        t2.GroupName,
        pf.Prod_QTY
    FROM Import_1C.vw_QC_Journal_Current AS j

             CROSS APPLY (
        SELECT
            Article_number =
                REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                                                        LTRIM(RTRIM(
                                                                REPLACE(REPLACE(REPLACE(j.Work_Nomenclature_No, CHAR(9), ' '), CHAR(160), ' '), CHAR(13), ' ')
                                                              )),
                                                        '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')
    ) AS N

             LEFT JOIN Ref.Product_Guide AS t2
                       ON N.Article_number = LTRIM(RTRIM(t2.FactoryNumber))

             OUTER APPLY (
        SELECT SUM(a.FACT_QTY) AS Prod_QTY
        FROM Views_For_Plan.DailyPlan_CustomWS AS a
        WHERE a.OnlyDate            = j.[Date]
          AND a.WorkCenter_CustomID = CASE
                                          WHEN j.Control_Tochka_ID = 0xB5BD00505601355E11EE0ADD7A7EB9AF
                                              THEN 0xB5BD00505601355E11EE0ADD6B568D33
                                          ELSE j.Control_Tochka_ID
            END
          AND a.ProductionOrderID   = j.Prod_Order_ID
    ) AS pf

    WHERE j.Doc_Type = 1;  -- только LQC журнал
END;
```

---

<a name="qc_sp_refresh_production_output_cost"></a>

## QC.sp_Refresh_Production_Output_Cost

```sql
-- ============================================================
-- Шаг 2: ALTER PROCEDURE QC.sp_Refresh_Production_Output_Cost
-- ============================================================
CREATE PROCEDURE QC.sp_Refresh_Production_Output_Cost
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    TRUNCATE TABLE QC.Production_Output_Cost;

    WITH Production_CTE AS (
        SELECT
            a.OnlyDate,
            a.WorkShopName_CH,
            b.WorkShop_Ru,
            a.WorkShopID,               -- новое поле
            a.NomenclatureID,
            a.NomenclatureNumber,
            a.ProductName_CN,
            SUM(a.FACT_QTY) AS FACT_QTY
        FROM Views_For_Plan.DailyPlan_CustomWS AS a
                 LEFT JOIN (
            SELECT DISTINCT WorkShop_ID, WorkShop_Ru
            FROM Import_1C.WorkCenter_1C
        ) AS b ON b.WorkShop_ID = a.WorkShopID
                 LEFT JOIN QC.vw_Stamping_Output AS c
                           ON c.Nomencl_ID = a.NomenclatureID
        WHERE a.FACT_QTY IS NOT NULL
          AND (
            (a.WorkShopID = 0xB5BC00505601355E11EDF0AED639127E AND c.Nomencl_ID IS NOT NULL)
                OR
            a.WorkShopID <> 0xB5BC00505601355E11EDF0AED639127E
            )
        GROUP BY
            a.OnlyDate,
            a.WorkShopName_CH,
            b.WorkShop_Ru,
            a.WorkShopID,
            a.NomenclatureID,
            a.NomenclatureNumber,
            a.ProductName_CN
    )
    INSERT INTO QC.Production_Output_Cost
    (
        OnlyDate, WorkShopName_CH, WorkShop_Ru, WorkShopID,
        NomenclatureID, NomenclatureNumber, ProductName_CN,
        FACT_QTY, Price, PriceTypeName, Price_Date, Total_Cost,
        Refreshed_At
    )
    SELECT
        p.OnlyDate,
        p.WorkShopName_CH,
        p.WorkShop_Ru,
        p.WorkShopID,
        p.NomenclatureID,
        p.NomenclatureNumber,
        p.ProductName_CN,
        p.FACT_QTY,
        COALESCE(price_pmc.Price,         price_mat.Price),
        COALESCE(price_pmc.PriceTypeName, price_mat.PriceTypeName),
        COALESCE(price_pmc.Price_Date,    price_mat.Price_Date),
        p.FACT_QTY * COALESCE(price_pmc.Price, price_mat.Price),
        SYSUTCDATETIME()
    FROM Production_CTE AS p
             OUTER APPLY (
        SELECT TOP 1
            pl.Price,
            pl.PriceTypeName,
            pl.[Date] AS Price_Date
        FROM Import_1C.vw_Price_List_Current AS pl
        WHERE pl.Nomencl_ID    = p.NomenclatureID
          AND pl.PriceTypeName = N'PMC_Цеховая'
        ORDER BY
            CASE WHEN pl.[Date] <= p.OnlyDate THEN 0 ELSE 1 END ASC,
            CASE WHEN pl.[Date] <= p.OnlyDate THEN pl.[Date] END DESC,
            CASE WHEN pl.[Date] >  p.OnlyDate THEN pl.[Date] END ASC
    ) AS price_pmc
             OUTER APPLY (
        SELECT TOP 1
            pl.Price,
            pl.PriceTypeName,
            pl.[Date] AS Price_Date
        FROM Import_1C.vw_Price_List_Current AS pl
        WHERE pl.Nomencl_ID    = p.NomenclatureID
          AND pl.PriceTypeName = N'PMC_Материальная'
          AND price_pmc.Price IS NULL
        ORDER BY
            CASE WHEN pl.[Date] <= p.OnlyDate THEN 0 ELSE 1 END ASC,
            CASE WHEN pl.[Date] <= p.OnlyDate THEN pl.[Date] END DESC,
            CASE WHEN pl.[Date] >  p.OnlyDate THEN pl.[Date] END ASC
    ) AS price_mat;

    COMMIT TRANSACTION;
END;
```

---

<a name="qc_sp_refresh_qc_cards_summary"></a>

## QC.sp_Refresh_QC_Cards_Summary

```sql
CREATE PROC QC.sp_Refresh_QC_Cards_Summary
AS
BEGIN
    SET NOCOUNT ON;

    TRUNCATE TABLE QC.QC_Cards_Summary;

    INSERT INTO QC.QC_Cards_Summary
    (
        BOM_ID, QC_Card_NomenclatureID, Delete_Mark, Posted_Mark,
        Create_Date, NumberPrefix, Status_Date, QC_Card_StatusRu, QC_Card_StatusZh,
        QC_Card_No, ProdOrder_No, Customer_Order_No,
        QC_Card_Nomenclature_No, QC_Card_Nomenclature_NameRU, QC_Card_Nomenclature_Namezh,
        QCcardConclusion_No, QCCard_QTY, Defect_TypeRu, Defect_TypeZh,
        Cause_of_Defect, Comment, VinovnikDep_Ru, VinovnikDep_Zh,
        QC_Select_Work_Dep_Zh, QC_Select_Work_Dep_Ru,
        Dep_OF_Detection_Ru, Dep_OF_Detection_Zh,
        Organization_Name, VinovnikPeople_Name, Avtor_Name,
        Work_Delete_Mark, Work_Posted_Mark, Work_No_Status, Work_No, Work_FinishDate,
        Work_Nomenclature_No, Work_Nomenclature_NameRU, Work_Nomenclature_Namezh,
        Work_QTY_Box, Work_QTY, Work_QTY_BoxTotal, Work_QTY_Total,
        Market, GP_Article_number, GP_Name_CN, LargeGroup, GroupName,
        Material_Cost, Labor_Hours, Labor_Cost,
        VinovnikDep_ID,
        Defect_TypeID
    )
    SELECT
        QC_Cards_T.BOM_ID,
        QC_Cards_T.QC_Card_NomenclatureID,
        QC_Cards_T.Delete_Mark,
        QC_Cards_T.Posted_Mark,
        QC_Cards_T.Create_Date,
        QC_Cards_T.NumberPrefix,
        QC_Cards_T.Status_Date,
        QC_Cards_T.QC_Card_StatusRu,
        QC_Cards_T.QC_Card_StatusZh,
        QC_Cards_T.QC_Card_No,
        QC_Cards_T.ProdOrder_No,
        QC_Cards_T.Customer_Order_No,
        QC_Cards_T.QC_Card_Nomenclature_No,
        QC_Cards_T.QC_Card_Nomenclature_NameRU,
        QC_Cards_T.QC_Card_Nomenclature_Namezh,
        QC_Cards_T.QCcardConclusion_No,
        QC_Cards_T.QCCard_QTY,
        QC_Cards_T.Defect_TypeRu,
        QC_Cards_T.Defect_TypeZh,
        QC_Cards_T.Cause_of_Defect,
        QC_Cards_T.Comment,
        QC_Cards_T.VinovnikDep_Ru,
        QC_Cards_T.VinovnikDep_Zh,
        QC_Cards_T.QC_Select_Work_Dep_Zh,
        QC_Cards_T.QC_Select_Work_Dep_Ru,
        QC_Cards_T.Dep_OF_Detection_Ru,
        QC_Cards_T.Dep_OF_Detection_Zh,
        QC_Cards_T.Organization_Name,
        QC_Cards_T.VinovnikPeople_Name,
        QC_Cards_T.Avtor_Name,
        QC_Cards_T.Work_Delete_Mark,
        QC_Cards_T.Work_Posted_Mark,
        QC_Cards_T.Work_No_Status,
        QC_Cards_T.Work_No,
        QC_Cards_T.Work_FinishDate,
        QC_Cards_T.Work_Nomenclature_No,
        QC_Cards_T.Work_Nomenclature_NameRU,
        QC_Cards_T.Work_Nomenclature_Namezh,
        QC_Cards_T.Work_QTY_Box,
        QC_Cards_T.Work_QTY,
        QC_Cards_T.Work_QTY_BoxTotal,
        QC_Cards_T.Work_QTY_Total,
        Order_T.Market,
        Order_T.Article_number,
        Order_T.Name_CN,
        Product_Guide.LargeGroup,
        Product_Guide.GroupName,

        -- Material_Cost
        CASE
            WHEN QC_Cards_T.QCcardConclusion_No = 0
                THEN (
                SELECT SUM(paint.Porebnost * ISNULL(price.Price, 0))
                FROM QC.QC_Repainting_Bom AS lvl1
                         JOIN QC.QC_Repainting_Bom AS paint
                              ON paint.Spec_ID = lvl1.BOM_ID
                         OUTER APPLY (
                    SELECT TOP 1 pl.Price
                    FROM Import_1C.vw_Price_List_Current AS pl
                    WHERE pl.Nomencl_ID    = paint.Nomencl_ID
                      AND pl.PriceTypeName = N'БюджетнаяЦена'
                    ORDER BY
                        CASE WHEN pl.Date <= QC_Cards_T.Create_Date THEN 0 ELSE 1 END ASC,
                        CASE WHEN pl.Date <= QC_Cards_T.Create_Date THEN pl.Date END DESC,
                        CASE WHEN pl.Date >  QC_Cards_T.Create_Date THEN pl.Date END ASC
                ) AS price
                WHERE lvl1.Spec_ID = (
                    SELECT TOP 1 rb.Spec_ID
                    FROM Q
```

---

<a name="qc_sp_refresh_qc_repainting_bom"></a>

## QC.sp_Refresh_QC_Repainting_Bom

```sql
-- ========================================
-- Шаг 3: Процедура обновления таблицы
-- ========================================
CREATE PROC QC.sp_Refresh_QC_Repainting_Bom
AS
BEGIN
    SET NOCOUNT ON;

    TRUNCATE TABLE QC.QC_Repainting_Bom;

    WITH BOM_Filtered AS (
        SELECT *
        FROM Import_1C.vw_Import_BOM_Current
        WHERE GPNomencl_No LIKE '8.75.11%'
          AND Nomencl_MidleGroupID = 0xB3C5C4CBE1AC069511EE9898D9D5ABD1

        UNION ALL

        SELECT *
        FROM Import_1C.vw_Import_BOM_Current
        WHERE Nomencl_No LIKE '8.75.11%'
    )
    INSERT INTO QC.QC_Repainting_Bom
    (
        Spec_ID, GPNomencl_ID, Nomencl_ID, Labor_TypeID,
        Delete_Mark, Spec_Status, Start_Day, Finish_Day,
        BOM_No, GPNomencl_No, GPMaterial_Name,
        Nomencl_No, Material_Name, GPMaterial_Labor, Porebnost,
        BOM_ID
    )
    SELECT
        f.Spec_ID,
        f.GPNomencl_ID,
        f.Nomencl_ID,
        f.Labor_TypeID,
        f.Delete_Mark,
        f.Spec_Status,
        f.Start_Day,
        f.Finish_Day,
        f.BOM_No,
        f.GPNomencl_No,
        f.GPMaterial_Name,
        f.Nomencl_No,
        f.Material_Name,
        f.GPMaterial_Labor,
        f.Porebnost,
        CASE
            WHEN f.GPNomencl_No LIKE '8.75.11%'
                THEN f.Spec_ID
            ELSE COALESCE(
                    (
                        SELECT TOP 1 r.Spec_ID
                        FROM BOM_Filtered AS r
                        WHERE r.GPNomencl_ID = f.Nomencl_ID
                          AND r.GPNomencl_No LIKE '8.75.11%'
                          AND r.Delete_Mark  = 0x00
                          AND r.Start_Day <= ISNULL(
                                NULLIF(f.Finish_Day, CAST('0001-01-01' AS date)),
                                CAST(GETDATE() AS date)
                                             )
                          AND (
                            r.Finish_Day = CAST('0001-01-01' AS date)
                                OR r.Finish_Day >= f.Start_Day
                            )
                          AND r.Start_Day <= CAST(GETDATE() AS date)
                        ORDER BY r.Start_Day DESC
                    ),
                    (
                        SELECT TOP 1 r.Spec_ID
                        FROM BOM_Filtered AS r
                        WHERE r.GPNomencl_ID = f.Nomencl_ID
                          AND r.GPNomencl_No LIKE '8.75.11%'
                          AND r.Delete_Mark  = 0x00
                        ORDER BY r.Start_Day DESC
                    )
                 )
            END
    FROM BOM_Filtered AS f;
END;
```

---

<a name="ref_sp_generate_weeksegments"></a>

## Ref.sp_Generate_WeekSegments

```sql
-- Создаем исправленную процедуру
CREATE PROCEDURE Ref.sp_Generate_WeekSegments
    @YearStart smallint,
    @YearEnd   smallint
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET DATEFIRST 1; -- Понедельник

    IF @YearStart IS NULL OR @YearEnd IS NULL OR @YearEnd < @YearStart
    BEGIN
        RAISERROR('Укажите корректный диапазон лет: @YearStart..@YearEnd',16,1);
        RETURN;
    END;

    BEGIN TRAN;

    -- ИСПРАВЛЕНИЕ: Удаляем только те записи, на которые НЕТ ссылок в Shipment_Plan
    DELETE FROM Ref.WeekSegments
    WHERE YearNum BETWEEN @YearStart AND @YearEnd
      AND SegmentID NOT IN (
          SELECT DISTINCT PeriodID
          FROM Orders.Shipment_Plan
          WHERE PeriodID IS NOT NULL
      );

    DECLARE @y smallint = @YearStart;

    WHILE @y <= @YearEnd
    BEGIN
        DECLARE @d0 date = DATEFROMPARTS(@y,1,1);
        DECLARE @dEnd date = DATEFROMPARTS(@y,12,31);

        -- 1) Первая неполная неделя: с 1 января до ближайшего воскресенья
        DECLARE @wd int = DATEPART(WEEKDAY, @d0);
        DECLARE @firstSunday date = DATEADD(DAY, (7-@wd), @d0);
        IF @firstSunday > @dEnd SET @firstSunday = @dEnd;

        ;WITH FirstBlock AS (
            SELECT
                WeekNo        = 1,
                FullStart     = @d0,
                FullFinish    = @firstSunday,
                SegStart      = @d0,
                SegFinish     = @firstSunday
        ),
        Weeks AS (
            SELECT
                WeekNo    = 2,
                FullStart = DATEADD(DAY, 1, @firstSunday),
                FullFinish= DATEADD(DAY, 7, @firstSunday)
            UNION ALL
            SELECT
                WeekNo + 1,
                DATEADD(DAY, 7, FullStart),
                DATEADD(DAY, 7, FullFinish)
            FROM Weeks
            WHERE DATEADD(DAY, 7, FullStart) <= @dEnd
        ),
        AllWeeks AS (
            SELECT WeekNo, FullStart, FullFinish FROM FirstBlock
            UNION ALL
            SELECT WeekNo, FullStart, FullFinish FROM Weeks
        ),
        Months AS (
            SELECT m AS MonthNum,
                   MonthStart = DATEFROMPARTS(@y, m, 1),
                   MonthEnd   = EOMONTH(DATEFROMPARTS(@y, m, 1))
            FROM (VALUES(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12)) v(m)
        ),
        Segments AS (
            SELECT
                YearNum  = @y,
                MonthNum = M.MonthNum,
                WeekNo   = W.WeekNo,
                WeekStartDay  = CASE WHEN W.FullStart > M.MonthStart THEN W.FullStart ELSE M.MonthStart END,
                WeekFinishDay = CASE WHEN W.FullFinish < M.MonthEnd  THEN W.FullFinish ELSE M.MonthEnd  END,
                FullWeekStart = W.FullStart,
                FullWeekFinish= W.FullFinish
            FROM AllWeeks W
            JOIN Months  M
              ON W.FullFinish >= M.MonthStart AND W.FullStart <= M.MonthEnd
        )

        INSERT INTO Ref.WeekSegments(YearNum, MonthNum, WeekNo, WeekStartDay, WeekFinishDay, FullWeekStart, FullWeekFinish)
        SELECT s.YearNum, s.MonthNum, s.WeekNo, s.WeekStartDay, s.WeekFinishDay, s.FullWeekStart, s.FullWeekFinish
        FROM Segments s
        WHERE s.WeekStartDay <= s.WeekFinishDay
        OPTION (MAXRECURSION 0);

        SET @y += 1;
    END

    COMMIT TRAN;
END
```

---

<a name="ref_sp_upsert_workshop_customws"></a>

## Ref.sp_Upsert_WorkShop_CustomWS

```sql
/* 2.1. Процедура: апсерт без модификации строк источника */
CREATE   PROCEDURE Ref.sp_Upsert_WorkShop_CustomWS
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @now DATETIME2(0) = SYSUTCDATETIME();

    /* Берем ИСКЛЮЧИТЕЛЬНО исходные значения без каких-либо TRIM/REPLACE */
    WITH src AS (
        SELECT DISTINCT
            TRIM(s.WorkShopName_CH)      AS WorkShop_CustomWS,
            TRIM(s.WorkCenter_Custom_CN) AS WorkCenter_CustomWS
        FROM Views_For_Plan.DailyPlan_CustomWS AS s
        WHERE s.WorkShopName_CH IS NOT NULL
          AND s.WorkCenter_Custom_CN IS NOT NULL
    )
    MERGE Ref.WorkShop_CustomWS AS tgt
    USING src
      ON  tgt.WorkShop_CustomWS   = src.WorkShop_CustomWS
      AND tgt.WorkCenter_CustomWS = src.WorkCenter_CustomWS

    /* Новые связки -> вставляем */
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (WorkShop_CustomWS, WorkCenter_CustomWS,
                IsActiveInSource, FirstSeenAt, LastSeenAt, LastCheckedAt, SeenCount)
        VALUES (src.WorkShop_CustomWS, src.WorkCenter_CustomWS,
                1, @now, @now, @now, 1)

    /* Найденные в источнике -> помечаем активной, «видели», не трогаем переводы */
    WHEN MATCHED THEN
        UPDATE SET
            tgt.IsActiveInSource = 1,
            tgt.LastSeenAt       = @now,
            tgt.LastCheckedAt    = @now,
            tgt.SeenCount        = tgt.SeenCount + 1

    /* То, чего в источнике сейчас НЕТ -> не удаляем, а помечаем неактуальным */
    WHEN NOT MATCHED BY SOURCE THEN
        UPDATE SET
            tgt.IsActiveInSource = 0,
            tgt.LastCheckedAt    = @now;

    /* При желании можно логировать результаты MERGE через OUTPUT в temp‑таблицу */
    /* New logic: Synchronize WorkShop_CenterWS tables */
   MERGE Ref.WorkShop_CustomWS AS tgt
USING (
    SELECT DISTINCT 
        TRIM(WorkShop_CustomWS)      AS WorkShop_CustomWS,  -- 显式去除两端空格
        TRIM(WorkCenter_CustomWS)    AS WorkCenter_CustomWS, 
        WorkShopName_ZH,
        WorkShopName_EN,
        WorkCenterName_ZH,
        WorkCenterName_EN
    FROM Ref.WorkShop_CenterWS
) AS src
ON tgt.WorkShop_CustomWS = src.WorkShop_CustomWS 
   AND tgt.WorkCenter_CustomWS = src.WorkCenter_CustomWS
-- 现有MATCHED逻辑保持不变
WHEN NOT MATCHED BY TARGET THEN 
INSERT (
    WorkShop_CustomWS, 
    WorkCenter_CustomWS,
    WorkShopName_ZH,
    WorkShopName_EN,
    WorkCenterName_ZH,
    WorkCenterName_EN,
    IsActiveInSource,
    FirstSeenAt,
    LastSeenAt,
    LastCheckedAt,
    SeenCount
)
VALUES (
    src.WorkShop_CustomWS,
    src.WorkCenter_CustomWS,
    src.WorkShopName_ZH,
    src.WorkShopName_EN,
    src.WorkCenterName_ZH,
    src.WorkCenterName_EN,
    1, -- IsActiveInSource
    @now, -- FirstSeenAt
    @now, -- LastSeenAt
    @now, -- LastCheckedAt
    1     -- SeenCount
);
END
```

---

<a name="ref_usp_refresh_bom_plastic_weight"></a>

## Ref.usp_Refresh_BOM_Plastic_Weight

```sql
CREATE PROCEDURE Ref.usp_Refresh_BOM_Plastic_Weight
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Snapshot_Date  DATE = CAST(GETDATE() AS DATE);
    DECLARE @iteration      INT  = 0;
    DECLARE @max_iter       INT  = 10;
    DECLARE @rows_updated   INT  = 1;

    PRINT 'Snapshot date: ' + CONVERT(VARCHAR(10), @Snapshot_Date, 120);

    -- ── Шаг 0: Первичные пластиковые детали ──────────────────────────────────
    DROP TABLE IF EXISTS #PlasticBase;

    SELECT
        a.Spec_ID,
        a.GPNomencl_ID,
        a.GPNomencl_No,
        a.Spec_Status,
        a.Delete_Mark,
        a.Start_Day,
        a.Finish_Day,
        SUM(a.Porebnost)                                    AS Weight_Total,
        ISNULL(MAX(bw.Total_Wastes), 0)                     AS Weight_Wastes,
        SUM(a.Porebnost) - ISNULL(MAX(bw.Total_Wastes), 0) AS GP_Weight
    INTO #PlasticBase
    FROM Import_1C.vw_Import_BOM_Current AS a
             LEFT JOIN (
        SELECT BOM_ID, SUM(QTY) AS Total_Wastes
        FROM Import_1C.BOM_Wastes
        GROUP BY BOM_ID
    ) AS bw ON bw.BOM_ID = a.Spec_ID
    WHERE a.GPNomencl_No      LIKE '8.75.12%'
      AND a.Spec_Status        =    1
      AND a.Nomencl_BigGroupID =    0xB5BD00505601355E11EE4027D74FC4CF  -- пластикат
    GROUP BY
        a.Spec_ID, a.GPNomencl_ID, a.GPNomencl_No,
        a.Spec_Status, a.Delete_Mark, a.Start_Day, a.Finish_Day;

    PRINT 'PlasticBase rows: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

    -- ── Шаг 1: Рабочая таблица — все строки BOM ──────────────────────────────
    -- GP_Weight     = plastic.GP_Weight     × Porebnost  для пластиковых компонентов
    -- Weight_Total  = plastic.Weight_Total  × Porebnost  для пластиковых компонентов
    -- GP_Weight = 0, Weight_Total = 0  для всех остальных

    DROP TABLE IF EXISTS #WorkingTable;

    SELECT
        BOM.Spec_ID,
        BOM.GPNomencl_ID,
        BOM.GPNomencl_No,
        BOM.Nomencl_ID,
        BOM.Nomencl_No,
        BOM.Porebnost,
        BOM.Spec_Status,
        BOM.Delete_Mark,
        BOM.Start_Day,
        BOM.Finish_Day,
        ISNULL(pb.GP_Weight    * BOM.Porebnost, 0) AS GP_Weight,
        ISNULL(pb.Weight_Total * BOM.Porebnost, 0) AS Weight_Total
    INTO #WorkingTable
    FROM Import_1C.vw_Import_BOM_Current AS BOM
             LEFT JOIN (
        SELECT
            GPNomencl_ID,
            GP_Weight,
            Weight_Total,
            ROW_NUMBER() OVER (
                PARTITION BY GPNomencl_ID
                ORDER BY
                    CASE WHEN Spec_Status = 1 THEN 0 ELSE 1 END,
                    Start_Day DESC
                ) AS rn
        FROM #PlasticBase
    ) AS pb
                       ON  pb.GPNomencl_ID = BOM.Nomencl_ID
                           AND pb.rn = 1
    WHERE BOM.GPNomencl_No NOT LIKE '9.%'  -- исключаем покупные изделия
      AND BOM.Spec_Status = 1;             -- только активные спецификации

    CREATE INDEX IX_WorkingTable ON #WorkingTable (Spec_ID, Nomencl_ID, GPNomencl_ID);

    -- ── Шаг 2: Итеративная развёртка ─────────────────────────────────────────
    WHILE @iteration < @max_iter AND @rows_updated > 0
        BEGIN
            SET @iteration    = @iteration + 1;
            SET @rows_updated = 0;

            PRINT 'Iteration ' + CAST(@iteration AS VARCHAR(10));

            DROP TABLE IF EXISTS #FilteredSpecs;

            SELECT
                wt.Spec_ID,
                wt.GPNomencl_ID,
                wt.GPNomencl_No,
                wt.Spec_Status,
                wt.Delete_Mark,
                wt.Start_Day,
                wt.Finish_Day,
                SUM(wt.GP_Weight)    AS Total_GP_Weight,
                SUM(wt.Weight_Total) AS Total_Weight_Total
            INTO #FilteredSpecs
            FROM #WorkingTable wt
            GROUP BY
                wt.Spec_ID, wt.GPNomencl_ID, wt.GPNomencl_No,
                wt.Spec_Status, wt.Delete_Mark, wt.Start_Day, wt.F
```

---

<a name="ref_usp_refresh_bom_stamping_weight"></a>

## Ref.usp_Refresh_BOM_Stamping_Weight

```sql
CREATE PROCEDURE Ref.usp_Refresh_BOM_Stamping_Weight
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Snapshot_Date  DATE = CAST(GETDATE() AS DATE);
    DECLARE @iteration      INT  = 0;
    DECLARE @max_iter       INT  = 10;
    DECLARE @rows_updated   INT  = 1;

    PRINT 'Snapshot date: ' + CONVERT(VARCHAR(10), @Snapshot_Date, 120);

    -- ── Шаг 0: Первичные штампованные детали ─────────────────────────────────
    DROP TABLE IF EXISTS #StampingBase;

    SELECT
        BOM.Spec_ID,
        BOM.GPNomencl_ID,
        BOM.GPNomencl_No,
        BOM.Spec_Status,
        BOM.Delete_Mark,
        BOM.Start_Day,
        BOM.Finish_Day,
        SUM(Nomenclature.Numerator_Weight * BOM.Porebnost) AS GP_Weight
    INTO #StampingBase
    FROM Import_1C.vw_Import_BOM_Current AS BOM
             LEFT JOIN Import_1C.vw_Nomenclature_Reference_Current AS Nomenclature
                       ON BOM.Nomencl_ID = Nomenclature.Nomenclature_ID
    WHERE (
        BOM.Labor_TypeGroupeID = 0xB3F2C4CBE1AC069511F11EAD532E636E
            OR BOM.Labor_TypeGroupeID = 0xB3F2C4CBE1AC069511F11EAD5CA0BC5B
        )
      AND BOM.Spec_Status = 1
      AND Nomenclature.Numerator_Weight > 0
    GROUP BY
        BOM.Spec_ID, BOM.GPNomencl_ID, BOM.GPNomencl_No,
        BOM.Spec_Status, BOM.Delete_Mark, BOM.Start_Day, BOM.Finish_Day;

    PRINT 'StampingBase rows: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

    -- ── Шаг 1: Рабочая таблица — все строки BOM ──────────────────────────────
    DROP TABLE IF EXISTS #WorkingTable;

    SELECT
        BOM.Spec_ID,
        BOM.GPNomencl_ID,
        BOM.GPNomencl_No,
        BOM.Nomencl_ID,
        BOM.Nomencl_No,
        BOM.Porebnost,
        BOM.Spec_Status,
        BOM.Delete_Mark,
        BOM.Start_Day,
        BOM.Finish_Day,
        ISNULL(sb.GP_Weight * BOM.Porebnost, 0) AS GP_Weight
    INTO #WorkingTable
    FROM Import_1C.vw_Import_BOM_Current AS BOM
             LEFT JOIN (
        SELECT
            GPNomencl_ID,
            GP_Weight,
            ROW_NUMBER() OVER (
                PARTITION BY GPNomencl_ID
                ORDER BY
                    CASE WHEN Spec_Status = 1 THEN 0 ELSE 1 END,
                    Start_Day DESC
                ) AS rn
        FROM #StampingBase
    ) AS sb
                       ON  sb.GPNomencl_ID = BOM.Nomencl_ID
                           AND sb.rn = 1
    WHERE BOM.GPNomencl_No NOT LIKE '9.%'  -- исключаем покупные изделия
      AND BOM.Spec_Status = 1;             -- только активные спецификации

    CREATE INDEX IX_WorkingTable ON #WorkingTable (Spec_ID, Nomencl_ID, GPNomencl_ID);

    -- ── Шаг 2: Итеративная развёртка ─────────────────────────────────────────
    WHILE @iteration < @max_iter AND @rows_updated > 0
        BEGIN
            SET @iteration    = @iteration + 1;
            SET @rows_updated = 0;

            PRINT 'Iteration ' + CAST(@iteration AS VARCHAR(10));

            DROP TABLE IF EXISTS #FilteredSpecs;

            SELECT
                wt.Spec_ID,
                wt.GPNomencl_ID,
                wt.GPNomencl_No,
                wt.Spec_Status,
                wt.Delete_Mark,
                wt.Start_Day,
                wt.Finish_Day,
                SUM(wt.GP_Weight) AS Total_GP_Weight
            INTO #FilteredSpecs
            FROM #WorkingTable wt
            GROUP BY
                wt.Spec_ID, wt.GPNomencl_ID, wt.GPNomencl_No,
                wt.Spec_Status, wt.Delete_Mark, wt.Start_Day, wt.Finish_Day;

            -- Pass 1: приоритет Spec_Status = 1, затем новейший Start_Day
            UPDATE wt
            SET GP_Weight = fs.Total_GP_Weight * wt.Porebnost
            FROM #WorkingTable wt
                     LEFT JOIN (
                SELECT
                    GPNomencl_ID,
                    Total_GP_Weight,
                    ROW_NUMBER() OVER (
                        PARTITION BY GPNomencl_ID
                        ORDER
```

---

<a name="timeloss_sp_entry_copy"></a>

## TimeLoss.sp_Entry_Copy

```sql
CREATE   PROCEDURE TimeLoss.sp_Entry_Copy
  @EntryID BIGINT,
  @NewDate DATE = NULL,
  @NewWorkCenterID NVARCHAR(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO TimeLoss.[Entry](
    OnlyDate, WorkShopID, WorkCenterID, DirectnessID, ReasonGroupID,
    CommentText, ManHours, ActionPlan, Responsible, CompletedDate
  )
  SELECT
    ISNULL(@NewDate, OnlyDate),
    WorkShopID,
    ISNULL(@NewWorkCenterID, WorkCenterID),
    DirectnessID, ReasonGroupID,
    CommentText, ManHours, ActionPlan, Responsible, CompletedDate
  FROM TimeLoss.[Entry]
  WHERE EntryID = @EntryID AND IsDeleted = 0;
END;
```

---

<a name="timeloss_sp_entry_delete"></a>

## TimeLoss.sp_Entry_Delete

```sql
CREATE   PROCEDURE TimeLoss.sp_Entry_Delete
  @EntryID BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE TimeLoss.[Entry] SET IsDeleted = 1 WHERE EntryID = @EntryID;
END;
```

---

<a name="timeloss_sp_saveworkschedules_set"></a>

## TimeLoss.sp_SaveWorkSchedules_Set

```sql
CREATE   PROCEDURE TimeLoss.sp_SaveWorkSchedules_Set
  @OnlyDate     DATE,
  @WorkShopID   NVARCHAR(256),
  @WorkCenterID NVARCHAR(256),
  @LinesJson    NVARCHAR(MAX)      -- [{"scheduleId":"...", "people":10}, ...]
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRAN;

  -- помечаем старые активные записи как удалённые
  UPDATE TimeLoss.WorkSchedules_ByDay
  SET DeleteMark = 1
  WHERE OnlyDate=@OnlyDate AND WorkShopID=@WorkShopID AND WorkCenterID=@WorkCenterID AND DeleteMark=0;

  -- вставляем новый набор
  IF @LinesJson IS NOT NULL AND ISJSON(@LinesJson)=1
  BEGIN
    INSERT TimeLoss.WorkSchedules_ByDay (OnlyDate, WorkShopID, WorkCenterID, ScheduleID, People)
    SELECT
        @OnlyDate,
        @WorkShopID,
        @WorkCenterID,
        j.[scheduleId],
        TRY_CONVERT(SMALLINT, j.[people])
    FROM OPENJSON(@LinesJson)
         WITH (
           [scheduleId] NVARCHAR(128) '$.scheduleId',
           [people]     NVARCHAR(10)  '$.people'
         ) AS j;
  END

  COMMIT;
END
```

---

<a name="timeloss_sp_workingschedule_create"></a>

## TimeLoss.sp_WorkingSchedule_Create

```sql
CREATE PROCEDURE TimeLoss.sp_WorkingSchedule_Create
  @WorkShopID   NVARCHAR(256),
  @ScheduleName NVARCHAR(200),
  @IsFavorite   BIT,
  @LinesJson    NVARCHAR(MAX),
  @Actor        NVARCHAR(128) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRAN;

  IF @LinesJson IS NULL OR ISJSON(@LinesJson) <> 1
    THROW 50010, N'Некорректный JSON в LinesJson', 1;

  DECLARE @lines TABLE(
    rn        INT IDENTITY(1,1) PRIMARY KEY,
    TypeID    NVARCHAR(256) NOT NULL,
    StartTime TIME(0)       NOT NULL,
    EndTime   TIME(0)       NOT NULL,
    StartMin  INT           NULL,
    SpanMin   INT           NULL,
    EndMin    INT           NULL
  );

  INSERT INTO @lines(TypeID, StartTime, EndTime)
  SELECT
    JSON_VALUE(value,'$.typeId'),
    TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.start')),
    TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.end'))
  FROM OPENJSON(@LinesJson);

  IF NOT EXISTS (SELECT 1 FROM @lines)
    THROW 50011, N'В графике отсутствуют строки', 1;

  IF EXISTS (SELECT 1 FROM @lines WHERE TypeID IS NULL OR StartTime IS NULL OR EndTime IS NULL)
    THROW 50012, N'Пустые/неверные значения в строках графика', 1;

  UPDATE l
  SET StartMin = DATEPART(HOUR, StartTime)*60 + DATEPART(MINUTE, StartTime),
      SpanMin  = CASE WHEN EndTime > StartTime
                      THEN DATEDIFF(MINUTE, StartTime, EndTime)
                      ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 24*60 END,
      EndMin   = (DATEPART(HOUR, StartTime)*60 + DATEPART(MINUTE, StartTime))
               + CASE WHEN EndTime > StartTime
                      THEN DATEDIFF(MINUTE, StartTime, EndTime)
                      ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 24*60 END
  FROM @lines AS l;

  IF EXISTS (SELECT 1 FROM @lines WHERE SpanMin <= 0 OR SpanMin > 24*60)
    THROW 50013, N'Неверная длительность интервала (1..1440 минут)', 1;

  IF OBJECT_ID(N'TimeLoss.WorkScheduleTypes') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM @lines l
       LEFT JOIN TimeLoss.WorkScheduleTypes t
         ON UPPER(t.TypeID) = UPPER(l.TypeID)
       WHERE t.TypeID IS NULL
     )
    THROW 50017, N'Неизвестный TypeID в графике', 1;

  IF (SELECT COUNT(*) FROM @lines WHERE UPPER(LTRIM(RTRIM(TypeID)))='WORKSHIFT') <> 1
    THROW 50018, N'Должна быть ровно одна запись WORKSHIFT', 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT UPPER(TypeID) AS TypeID, StartMin, EndMin,
             LAG(EndMin) OVER (PARTITION BY UPPER(TypeID) ORDER BY StartMin) AS PrevEndMin
      FROM @lines
    ) s
    WHERE s.PrevEndMin IS NOT NULL AND s.PrevEndMin > s.StartMin
  )
    THROW 50014, N'Перекрывающиеся интервалы одного типа в графике', 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT UPPER(TypeID) AS TypeID,
             MAX(EndMin) AS MaxEnd, MIN(StartMin) AS MinStart
      FROM @lines
      GROUP BY UPPER(TypeID)
    ) x
    WHERE (x.MaxEnd - 24*60) > x.MinStart
  )
    THROW 50014, N'Перекрывающиеся интервалы одного типа в графике', 1;

  /* === BREAKS ⊂ WORKSHIFT (без CTE) === */
DECLARE @WsStart int, @WsSpan int, @WsRn int;

SELECT TOP (1)
       @WsStart = StartMin,
       @WsSpan  = SpanMin,
       @WsRn    = rn
FROM @lines
WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'WORKSHIFT';

IF EXISTS (
    SELECT 1
    FROM (
        SELECT 
            ((StartMin - @WsStart + 1440) % 1440) AS s_rel,
            SpanMin AS spanm
        FROM @lines
        WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'BREAKS'
    ) x
    WHERE x.spanm <= 0            -- защита
       OR x.s_rel + x.spanm > @WsSpan  -- вылезает за конец смены
)
BEGIN
    -- (необязательно) диагностика:
    SELECT 'INSIDE_WORKSHIFT_VIOLATIONS' AS _section, *
    FROM (
        SELECT rn, TypeID, StartTime, EndTime, StartMin, SpanMin, EndMin,
               ((StartMin - @WsStart + 1440) % 1440) AS s_rel,
               ((EndMin   - @WsStart + 1440) % 1440) AS e_rel
        FROM @lines
        WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'BREAKS'
    ) d
    WHERE d.SpanMin <= 0 OR d.s_rel + d.SpanMin > @WsSpan;
```

---

<a name="timeloss_sp_workingschedule_explain"></a>

## TimeLoss.sp_WorkingSchedule_Explain

```sql
CREATE   PROCEDURE TimeLoss.sp_WorkingSchedule_Explain
  @LinesJson NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;

  IF @LinesJson IS NULL OR ISJSON(@LinesJson) <> 1
  BEGIN
    SELECT 'INVALID_JSON' AS CheckName, 0 AS IsOk, 'Некорректный JSON' AS Details;
    RETURN;
  END;

  DECLARE @lines TABLE(
      rn int IDENTITY(1,1) PRIMARY KEY,
      TypeID NVARCHAR(256) NOT NULL,
      StartTime TIME(0) NOT NULL,
      EndTime   TIME(0) NOT NULL,
      StartMin  int NULL,
      SpanMin   int NULL,
      EndMin    int NULL
  );

  INSERT INTO @lines(TypeID, StartTime, EndTime)
  SELECT JSON_VALUE(value,'$.typeId'),
         TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.start')),
         TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.end'))
  FROM OPENJSON(@LinesJson);

  UPDATE l
  SET StartMin = DATEPART(HOUR, StartTime)*60 + DATEPART(MINUTE, StartTime),
      SpanMin  = CASE WHEN EndTime > StartTime
                      THEN DATEDIFF(MINUTE, StartTime, EndTime)
                      ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 1440 END,
      EndMin   = StartMin + CASE WHEN EndTime > StartTime
                                 THEN DATEDIFF(MINUTE, StartTime, EndTime)
                                 ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 1440 END
  FROM @lines l;

  -- Входные данные
  SELECT 'LINES' AS _section, rn, TypeID, StartTime, EndTime, StartMin, SpanMin, EndMin
  FROM @lines ORDER BY rn;

  -- 1) Ровно одна WorkShift
  SELECT 'ONE_WORKSHIFT' AS CheckName,
         IIF((SELECT COUNT(*) FROM @lines WHERE UPPER(LTRIM(RTRIM(TypeID)))='WORKSHIFT')=1,1,0) AS IsOk,
         CAST((SELECT COUNT(*) FROM @lines WHERE UPPER(LTRIM(RTRIM(TypeID)))='WORKSHIFT') AS NVARCHAR(50)) AS Details;

  -- 2) Длительность 1..1440
  SELECT 'SPAN_RANGE' AS CheckName,
         IIF(NOT EXISTS(SELECT 1 FROM @lines WHERE SpanMin<=0 OR SpanMin>1440),1,0) AS IsOk,
         STRING_AGG(CAST(rn AS NVARCHAR(20)), ',') AS OffendingRows
  FROM @lines WHERE SpanMin<=0 OR SpanMin>1440;

  -- 3) Перекрытия одного типа (часть 1)
  ;WITH s AS (
    SELECT rn, UPPER(LTRIM(RTRIM(TypeID))) AS TypeID, StartMin, EndMin,
           LAG(EndMin) OVER (PARTITION BY UPPER(LTRIM(RTRIM(TypeID))) ORDER BY StartMin) AS PrevEndMin
    FROM @lines
  )
  SELECT 'OVERLAP_SAME_TYPE_1' AS CheckName,
         IIF(NOT EXISTS(SELECT 1 FROM s WHERE PrevEndMin IS NOT NULL AND PrevEndMin>StartMin),1,0) AS IsOk,
         STRING_AGG(CAST(rn AS NVARCHAR(20)), ',') AS OffendingRows
  FROM s WHERE PrevEndMin IS NOT NULL AND PrevEndMin>StartMin;

  -- 4) Перекрытия одного типа (часть 2)
  ;WITH g AS (
    SELECT UPPER(LTRIM(RTRIM(TypeID))) AS TypeID,
           MAX(EndMin) AS MaxEnd, MIN(StartMin) AS MinStart
    FROM @lines
    GROUP BY UPPER(LTRIM(RTRIM(TypeID)))
  )
  SELECT 'OVERLAP_SAME_TYPE_2' AS CheckName,
         IIF(NOT EXISTS(SELECT 1 FROM g WHERE (MaxEnd-1440)>MinStart),1,0) AS IsOk,
         STRING_AGG(TypeID, ',') AS OffendingTypes
  FROM g WHERE (MaxEnd-1440)>MinStart;

  -- 5) Все НЕ WorkShift внутри WorkShift
  DECLARE @WsStart int, @WsSpan int, @WsRn int;
  SELECT TOP (1) @WsStart=StartMin, @WsSpan=SpanMin, @WsRn=rn
  FROM @lines WHERE UPPER(LTRIM(RTRIM(TypeID)))='WORKSHIFT';

  ;WITH n AS (
    SELECT rn, TypeID,
           ((StartMin-@WsStart+1440)%1440) AS s_rel,
           ((EndMin  -@WsStart+1440)%1440) AS e_rel
    FROM @lines
    WHERE rn<>@WsRn
  )
  SELECT 'INSIDE_WORKSHIFT' AS CheckName,
         IIF(NOT EXISTS(SELECT 1 FROM n WHERE e_rel<=s_rel OR e_rel>@WsSpan),1,0) AS IsOk,
         STRING_AGG(CONCAT(rn,':',TypeID,' [',s_rel,'-',e_rel,']'), '; ') AS OffendingRows
  FROM n WHERE e_rel<=s_rel OR e_rel>@WsSpan;

  -- 6) Нормализованные интервалы
  ;WITH n AS (
    SELECT rn, TypeID, StartTime, EndTime, StartMin, EndMin, SpanMin,
           ((StartMin-@WsStart+1440)%1440) AS s_rel,
           ((EndMin  -@WsStart+1440)%1440) AS e_rel
    FROM @lines
  )
  SELECT 'NORMALIZED' AS _sect
```

---

<a name="timeloss_sp_workingschedule_replace"></a>

## TimeLoss.sp_WorkingSchedule_Replace

```sql
CREATE PROCEDURE TimeLoss.sp_WorkingSchedule_Replace
  @OldScheduleID BIGINT,
  @UpdatedAt     DATETIME2(0),
  @WorkShopID    NVARCHAR(256),
  @ScheduleName  NVARCHAR(200),
  @IsFavorite    BIT,
  @LinesJson     NVARCHAR(MAX),
  @Actor         NVARCHAR(128) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRAN;

  IF NOT EXISTS (
    SELECT 1
    FROM TimeLoss.Working_Schedule
    WHERE ScheduleID=@OldScheduleID AND UpdatedAt=@UpdatedAt AND IsDeleted=0
  )
  BEGIN
    RAISERROR(N'CONFLICT: schedule was changed or removed',16,1);
    ROLLBACK TRAN; RETURN;
  END;

  IF @LinesJson IS NULL OR ISJSON(@LinesJson) <> 1
    THROW 50010, N'Некорректный JSON в LinesJson', 1;

  DECLARE @lines TABLE(
    rn        INT IDENTITY(1,1) PRIMARY KEY,
    TypeID    NVARCHAR(256) NOT NULL,
    StartTime TIME(0)       NOT NULL,
    EndTime   TIME(0)       NOT NULL,
    StartMin  INT           NULL,
    SpanMin   INT           NULL,
    EndMin    INT           NULL
  );

  INSERT INTO @lines(TypeID, StartTime, EndTime)
  SELECT
    JSON_VALUE(value,'$.typeId'),
    TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.start')),
    TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.end'))
  FROM OPENJSON(@LinesJson);

  IF NOT EXISTS (SELECT 1 FROM @lines)
    THROW 50011, N'В графике отсутствуют строки', 1;

  IF EXISTS (SELECT 1 FROM @lines WHERE TypeID IS NULL OR StartTime IS NULL OR EndTime IS NULL)
    THROW 50012, N'Пустые/неверные значения в строках графика', 1;

  UPDATE l
  SET StartMin = DATEPART(HOUR, StartTime)*60 + DATEPART(MINUTE, StartTime),
      SpanMin  = CASE WHEN EndTime > StartTime
                      THEN DATEDIFF(MINUTE, StartTime, EndTime)
                      ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 24*60 END,
      EndMin   = (DATEPART(HOUR, StartTime)*60 + DATEPART(MINUTE, StartTime))
               + CASE WHEN EndTime > StartTime
                      THEN DATEDIFF(MINUTE, StartTime, EndTime)
                      ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 24*60 END
  FROM @lines AS l;

  IF EXISTS (SELECT 1 FROM @lines WHERE SpanMin <= 0 OR SpanMin > 24*60)
    THROW 50013, N'Неверная длительность интервала (1..1440 минут)', 1;

  IF OBJECT_ID(N'TimeLoss.WorkScheduleTypes') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM @lines l
       LEFT JOIN TimeLoss.WorkScheduleTypes t
         ON UPPER(t.TypeID) = UPPER(l.TypeID)
       WHERE t.TypeID IS NULL
     )
    THROW 50017, N'Неизвестный TypeID в графике', 1;

  IF (SELECT COUNT(*) FROM @lines WHERE UPPER(LTRIM(RTRIM(TypeID)))='WORKSHIFT') <> 1
    THROW 50018, N'Должна быть ровно одна запись WORKSHIFT', 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT UPPER(TypeID) AS TypeID, StartMin, EndMin,
             LAG(EndMin) OVER (PARTITION BY UPPER(TypeID) ORDER BY StartMin) AS PrevEndMin
      FROM @lines
    ) s
    WHERE s.PrevEndMin IS NOT NULL AND s.PrevEndMin > s.StartMin
  )
    THROW 50014, N'Перекрывающиеся интервалы одного типа в графике', 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT UPPER(TypeID) AS TypeID,
             MAX(EndMin) AS MaxEnd, MIN(StartMin) AS MinStart
      FROM @lines
      GROUP BY UPPER(TypeID)
    ) x
    WHERE (x.MaxEnd - 24*60) > x.MinStart
  )
    THROW 50014, N'Перекрывающиеся интервалы одного типа в графике', 1;

  /* === BREAKS ⊂ WORKSHIFT === */
DECLARE @WsStart int, @WsSpan int, @WsRn int;

SELECT TOP (1)
       @WsStart = StartMin,
       @WsSpan  = SpanMin,
       @WsRn    = rn
FROM @lines
WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'WORKSHIFT';

IF EXISTS (
    SELECT 1
    FROM (
        SELECT 
            ((StartMin - @WsStart + 1440) % 1440) AS s_rel,
            SpanMin AS spanm
        FROM @lines
        WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'BREAKS'
    ) x
    WHERE x.spanm <= 0            -- защита
       OR x.s_rel + x.spanm > @WsSpan  -- вылезает за конец смены
)
BEGIN
    -- (необязательно) диагностика:
    SELECT 'INSIDE_WORKSHIFT_VIOLATIONS' AS _section, *
    FROM (
        SELECT rn, TypeID, StartTime
```

---

<a name="timeloss_sp_workingschedule_restore"></a>

## TimeLoss.sp_WorkingSchedule_Restore

```sql
CREATE   PROCEDURE TimeLoss.sp_WorkingSchedule_Restore
  @ScheduleID BIGINT, @Actor NVARCHAR(128)=NULL
AS
BEGIN
  UPDATE TimeLoss.Working_Schedule
     SET IsDeleted=0, DeletedAt=NULL, UpdatedBy=@Actor, UpdatedAt=SYSUTCDATETIME()
   WHERE ScheduleID=@ScheduleID;
END
```

---

<a name="timeloss_sp_workingschedule_save"></a>

## TimeLoss.sp_WorkingSchedule_Save

```sql
CREATE PROCEDURE TimeLoss.sp_WorkingSchedule_Save
  @ScheduleID   BIGINT        = NULL OUTPUT,
  @WorkShopID   NVARCHAR(256),
  @ScheduleName NVARCHAR(200),
  @IsFavorite   BIT,
  @UpdatedAt    DATETIME2(0)  = NULL,
  @LinesJson    NVARCHAR(MAX),
  @Actor        NVARCHAR(128) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRAN;

  IF @LinesJson IS NULL OR ISJSON(@LinesJson) <> 1
    THROW 50010, N'Некорректный JSON в LinesJson', 1;

  DECLARE @lines TABLE(
    rn        INT IDENTITY(1,1) PRIMARY KEY,
    TypeID    NVARCHAR(256) NOT NULL,
    StartTime TIME(0)       NOT NULL,
    EndTime   TIME(0)       NOT NULL,
    StartMin  INT           NULL,
    SpanMin   INT           NULL,
    EndMin    INT           NULL
  );

  INSERT INTO @lines(TypeID, StartTime, EndTime)
  SELECT
    JSON_VALUE(value,'$.typeId'),
    TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.start')),
    TRY_CONVERT(TIME(0), JSON_VALUE(value,'$.end'))
  FROM OPENJSON(@LinesJson);

  IF NOT EXISTS (SELECT 1 FROM @lines)
    THROW 50011, N'В графике отсутствуют строки', 1;

  IF EXISTS (SELECT 1 FROM @lines WHERE TypeID IS NULL OR StartTime IS NULL OR EndTime IS NULL)
    THROW 50012, N'Пустые/неверные значения в строках графика', 1;

  UPDATE l
  SET StartMin = DATEPART(HOUR, StartTime)*60 + DATEPART(MINUTE, StartTime),
      SpanMin  = CASE WHEN EndTime > StartTime
                      THEN DATEDIFF(MINUTE, StartTime, EndTime)
                      ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 24*60 END,
      EndMin   = (DATEPART(HOUR, StartTime)*60 + DATEPART(MINUTE, StartTime))
               + CASE WHEN EndTime > StartTime
                      THEN DATEDIFF(MINUTE, StartTime, EndTime)
                      ELSE DATEDIFF(MINUTE, StartTime, EndTime) + 24*60 END
  FROM @lines AS l;

  IF EXISTS (SELECT 1 FROM @lines WHERE SpanMin <= 0 OR SpanMin > 24*60)
    THROW 50013, N'Неверная длительность интервала (1..1440 минут)', 1;

  IF OBJECT_ID(N'TimeLoss.WorkScheduleTypes') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM @lines l
       LEFT JOIN TimeLoss.WorkScheduleTypes t
         ON UPPER(t.TypeID) = UPPER(l.TypeID)
       WHERE t.TypeID IS NULL
     )
    THROW 50017, N'Неизвестный TypeID в графике', 1;

  IF (SELECT COUNT(*) FROM @lines WHERE UPPER(LTRIM(RTRIM(TypeID)))='WORKSHIFT') <> 1
    THROW 50018, N'Должна быть ровно одна запись WORKSHIFT', 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT UPPER(TypeID) AS TypeID, StartMin, EndMin,
             LAG(EndMin) OVER (PARTITION BY UPPER(TypeID) ORDER BY StartMin) AS PrevEndMin
      FROM @lines
    ) s
    WHERE s.PrevEndMin IS NOT NULL AND s.PrevEndMin > s.StartMin
  )
    THROW 50014, N'Перекрывающиеся интервалы одного типа в графике', 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT UPPER(TypeID) AS TypeID,
             MAX(EndMin) AS MaxEnd, MIN(StartMin) AS MinStart
      FROM @lines
      GROUP BY UPPER(TypeID)
    ) x
    WHERE (x.MaxEnd - 24*60) > x.MinStart
  )
    THROW 50014, N'Перекрывающиеся интервалы одного типа в графике', 1;

  /* === BREAKS ⊂ WORKSHIFT === */
DECLARE @WsStart int, @WsSpan int, @WsRn int;

SELECT TOP (1)
       @WsStart = StartMin,
       @WsSpan  = SpanMin,
       @WsRn    = rn
FROM @lines
WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'WORKSHIFT';

IF EXISTS (
    SELECT 1
    FROM (
        SELECT 
            ((StartMin - @WsStart + 1440) % 1440) AS s_rel,
            SpanMin AS spanm
        FROM @lines
        WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'BREAKS'
    ) x
    WHERE x.spanm <= 0            -- защита
       OR x.s_rel + x.spanm > @WsSpan  -- вылезает за конец смены
)
BEGIN
    -- (необязательно) диагностика:
    SELECT 'INSIDE_WORKSHIFT_VIOLATIONS' AS _section, *
    FROM (
        SELECT rn, TypeID, StartTime, EndTime, StartMin, SpanMin, EndMin,
               ((StartMin - @WsStart + 1440) % 1440) AS s_rel,
               ((EndMin   - @WsStart + 1440) % 1440) AS e_rel
        FROM @lines
        WHERE UPPER(LTRIM(RTRIM(TypeID))) = 'BREAKS'
```

---

<a name="timeloss_sp_workingschedule_softdelete"></a>

## TimeLoss.sp_WorkingSchedule_SoftDelete

```sql
CREATE   PROCEDURE TimeLoss.sp_WorkingSchedule_SoftDelete
  @ScheduleID BIGINT, @Actor NVARCHAR(128)=NULL
AS
BEGIN
  UPDATE TimeLoss.Working_Schedule
     SET IsDeleted=1, DeletedAt=SYSUTCDATETIME(), UpdatedBy=@Actor, UpdatedAt=SYSUTCDATETIME()
   WHERE ScheduleID=@ScheduleID;
END
```

---

<a name="timeloss_sp_workingschedule_updateheader"></a>

## TimeLoss.sp_WorkingSchedule_UpdateHeader

```sql
CREATE   PROCEDURE TimeLoss.sp_WorkingSchedule_UpdateHeader
    @ScheduleID   INT,
    @UpdatedAt    DATETIME2(0),
    @ScheduleName NVARCHAR(200),
    @IsFavorite   BIT,
    @Actor        NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    -- 1) есть ли запись
    IF NOT EXISTS (SELECT 1 FROM TimeLoss.Working_Schedule WHERE ScheduleID = @ScheduleID)
        THROW 50001, N'Not found: schedule', 1;

    -- 2) оптимистичная блокировка по UpdatedAt
    IF NOT EXISTS (
        SELECT 1
        FROM TimeLoss.Working_Schedule
        WHERE ScheduleID = @ScheduleID AND UpdatedAt = @UpdatedAt
    )
        THROW 50002, N'Conflict: schedule was changed by another user', 1;

    -- 3) апдейт шапки
    UPDATE TimeLoss.Working_Schedule
       SET ScheduleName = @ScheduleName,
           IsFavorite   = @IsFavorite,
           UpdatedAt    = SYSUTCDATETIME(),
           UpdatedBy    = @Actor
     WHERE ScheduleID = @ScheduleID;

    -- 4) вернуть то, что ждёт API
    SELECT ScheduleID, ScheduleCode, UpdatedAt
    FROM TimeLoss.Working_Schedule
    WHERE ScheduleID = @ScheduleID;
END
```

---


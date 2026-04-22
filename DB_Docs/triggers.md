# Триггеры

> Сгенерировано: 2026-04-08 21:13

## trg_Entry_Touch

- **Таблица:** `Entry`
- **Событие:** `UPDATE`
- **Статус:** ACTIVE

```sql
CREATE TRIGGER TimeLoss.trg_Entry_Touch ON TimeLoss.[Entry]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE e
    SET UpdatedAt = SYSUTCDATETIME()
  FROM TimeLoss.[Entry] e
  JOIN inserted i ON i.EntryID = e.EntryID;
END;
```

---

## trg_ShipmentsOrderFilter_Rules_u

- **Таблица:** `ShipmentsOrderFilter_Rules`
- **Событие:** `UPDATE`
- **Статус:** ACTIVE

```sql
-- автообновление UpdatedAt
CREATE   TRIGGER Orders.trg_ShipmensOrderFilter_Rules_u
ON Orders.ShipmensOrderFilter_Rules
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE r SET UpdatedAt = SYSUTCDATETIME()
  FROM Orders.ShipmensOrderFilter_Rules r
  JOIN inserted i ON i.RuleID = r.RuleID;
END
```

---

## trg_Working_Schedule_Timestamps

- **Таблица:** `Working_Schedule`
- **Событие:** `UPDATE`
- **Статус:** ACTIVE

```sql
CREATE   TRIGGER TimeLoss.trg_Working_Schedule_Timestamps
ON TimeLoss.Working_Schedule
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE ws
       SET UpdatedAt = SYSUTCDATETIME()
    FROM TimeLoss.Working_Schedule ws
    JOIN inserted i ON i.ScheduleID = ws.ScheduleID;
END;
```

---

## trg_Working_ScheduleType_Validate

- **Таблица:** `Working_ScheduleType`
- **Событие:** `INSERT`
- **Статус:** ACTIVE

```sql
CREATE   TRIGGER TimeLoss.trg_Working_ScheduleType_Validate
ON TimeLoss.Working_ScheduleType
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  -- какие графики затронуты
  DECLARE @Affected TABLE (ScheduleID bigint PRIMARY KEY);
  INSERT INTO @Affected(ScheduleID)
  SELECT DISTINCT ScheduleID FROM inserted;
  IF NOT EXISTS (SELECT 1 FROM @Affected) RETURN;

  -- рабочая смена (старт/длительность) для каждого графика
  DECLARE @ws TABLE (ScheduleID bigint PRIMARY KEY, WsStartMin int, WsSpan int);
  INSERT INTO @ws
  SELECT w.ScheduleID,
         DATEPART(HOUR,w.StartTime)*60 + DATEPART(MINUTE,w.StartTime) AS WsStartMin,
         CASE WHEN w.EndTime > w.StartTime
              THEN DATEDIFF(MINUTE, w.StartTime, w.EndTime)
              ELSE DATEDIFF(MINUTE, w.StartTime, w.EndTime) + 1440
         END AS WsSpan
  FROM TimeLoss.Working_ScheduleType w
  JOIN @Affected a ON a.ScheduleID = w.ScheduleID
  WHERE UPPER(LTRIM(RTRIM(w.TypeID))) = 'WORKSHIFT';

  -- все строки графика в минутах, с учётом «через полночь»
  DECLARE @lines TABLE (ScheduleID bigint, TypeID nvarchar(256), StartMin int, EndMin int);
  INSERT INTO @lines
  SELECT l.ScheduleID, l.TypeID,
         DATEPART(HOUR,l.StartTime)*60 + DATEPART(MINUTE,l.StartTime) AS StartMin,
         DATEPART(HOUR,l.EndTime)*60 + DATEPART(MINUTE,l.EndTime)
           + CASE WHEN l.EndTime <= l.StartTime THEN 1440 ELSE 0 END AS EndMin
  FROM TimeLoss.Working_ScheduleType l
  JOIN @Affected a ON a.ScheduleID = l.ScheduleID;

  -- нормализация к шкале, начинающейся в старте смены
  DECLARE @norm TABLE (ScheduleID bigint, TypeID nvarchar(256), s_rel int, e_rel int, WsSpan int);
  INSERT INTO @norm (ScheduleID, TypeID, s_rel, e_rel, WsSpan)
  SELECT l.ScheduleID, l.TypeID,
         ((l.StartMin - w.WsStartMin + 1440) % 1440),
         ((l.EndMin   - w.WsStartMin + 1440) % 1440),
         w.WsSpan
  FROM @lines l
  JOIN @ws w ON w.ScheduleID = l.ScheduleID;

  -- 1) все не-WorkShift должны лежать внутри смены
  IF EXISTS (
      SELECT 1
      FROM @norm n
      WHERE UPPER(LTRIM(RTRIM(n.TypeID))) <> 'WORKSHIFT'
        AND (n.e_rel <= n.s_rel OR n.s_rel < 0 OR n.e_rel > n.WsSpan)
  )
  BEGIN
      RAISERROR(N'Перерыв выходит за пределы смены', 16, 1);
      ROLLBACK TRANSACTION;
      RETURN;
  END;

  -- 2) запрещаем пересечения интервалов одного типа
  IF EXISTS (
      SELECT 1
      FROM (
        SELECT ScheduleID,
               UPPER(LTRIM(RTRIM(TypeID))) AS TypeID,
               s_rel, e_rel,
               LAG(e_rel) OVER (PARTITION BY ScheduleID, UPPER(LTRIM(RTRIM(TypeID))) ORDER BY s_rel) AS prev_e
        FROM @norm
        WHERE UPPER(LTRIM(RTRIM(TypeID))) <> 'WORKSHIFT'
      ) t
      WHERE t.prev_e IS NOT NULL AND t.prev_e > t.s_rel
  )
  BEGIN
      RAISERROR(N'Перекрывающиеся интервалы одного типа', 16, 1);
      ROLLBACK TRANSACTION;
      RETURN;
  END;
END;
```

---

## trg_Working_ScheduleType_Validate

- **Таблица:** `Working_ScheduleType`
- **Событие:** `UPDATE`
- **Статус:** ACTIVE

```sql
CREATE   TRIGGER TimeLoss.trg_Working_ScheduleType_Validate
ON TimeLoss.Working_ScheduleType
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  -- какие графики затронуты
  DECLARE @Affected TABLE (ScheduleID bigint PRIMARY KEY);
  INSERT INTO @Affected(ScheduleID)
  SELECT DISTINCT ScheduleID FROM inserted;
  IF NOT EXISTS (SELECT 1 FROM @Affected) RETURN;

  -- рабочая смена (старт/длительность) для каждого графика
  DECLARE @ws TABLE (ScheduleID bigint PRIMARY KEY, WsStartMin int, WsSpan int);
  INSERT INTO @ws
  SELECT w.ScheduleID,
         DATEPART(HOUR,w.StartTime)*60 + DATEPART(MINUTE,w.StartTime) AS WsStartMin,
         CASE WHEN w.EndTime > w.StartTime
              THEN DATEDIFF(MINUTE, w.StartTime, w.EndTime)
              ELSE DATEDIFF(MINUTE, w.StartTime, w.EndTime) + 1440
         END AS WsSpan
  FROM TimeLoss.Working_ScheduleType w
  JOIN @Affected a ON a.ScheduleID = w.ScheduleID
  WHERE UPPER(LTRIM(RTRIM(w.TypeID))) = 'WORKSHIFT';

  -- все строки графика в минутах, с учётом «через полночь»
  DECLARE @lines TABLE (ScheduleID bigint, TypeID nvarchar(256), StartMin int, EndMin int);
  INSERT INTO @lines
  SELECT l.ScheduleID, l.TypeID,
         DATEPART(HOUR,l.StartTime)*60 + DATEPART(MINUTE,l.StartTime) AS StartMin,
         DATEPART(HOUR,l.EndTime)*60 + DATEPART(MINUTE,l.EndTime)
           + CASE WHEN l.EndTime <= l.StartTime THEN 1440 ELSE 0 END AS EndMin
  FROM TimeLoss.Working_ScheduleType l
  JOIN @Affected a ON a.ScheduleID = l.ScheduleID;

  -- нормализация к шкале, начинающейся в старте смены
  DECLARE @norm TABLE (ScheduleID bigint, TypeID nvarchar(256), s_rel int, e_rel int, WsSpan int);
  INSERT INTO @norm (ScheduleID, TypeID, s_rel, e_rel, WsSpan)
  SELECT l.ScheduleID, l.TypeID,
         ((l.StartMin - w.WsStartMin + 1440) % 1440),
         ((l.EndMin   - w.WsStartMin + 1440) % 1440),
         w.WsSpan
  FROM @lines l
  JOIN @ws w ON w.ScheduleID = l.ScheduleID;

  -- 1) все не-WorkShift должны лежать внутри смены
  IF EXISTS (
      SELECT 1
      FROM @norm n
      WHERE UPPER(LTRIM(RTRIM(n.TypeID))) <> 'WORKSHIFT'
        AND (n.e_rel <= n.s_rel OR n.s_rel < 0 OR n.e_rel > n.WsSpan)
  )
  BEGIN
      RAISERROR(N'Перерыв выходит за пределы смены', 16, 1);
      ROLLBACK TRANSACTION;
      RETURN;
  END;

  -- 2) запрещаем пересечения интервалов одного типа
  IF EXISTS (
      SELECT 1
      FROM (
        SELECT ScheduleID,
               UPPER(LTRIM(RTRIM(TypeID))) AS TypeID,
               s_rel, e_rel,
               LAG(e_rel) OVER (PARTITION BY ScheduleID, UPPER(LTRIM(RTRIM(TypeID))) ORDER BY s_rel) AS prev_e
        FROM @norm
        WHERE UPPER(LTRIM(RTRIM(TypeID))) <> 'WORKSHIFT'
      ) t
      WHERE t.prev_e IS NOT NULL AND t.prev_e > t.s_rel
  )
  BEGIN
      RAISERROR(N'Перекрывающиеся интервалы одного типа', 16, 1);
      ROLLBACK TRANSACTION;
      RETURN;
  END;
END;
```

---


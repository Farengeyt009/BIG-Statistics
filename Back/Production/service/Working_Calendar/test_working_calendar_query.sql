-- Тестовый SQL запрос для Working Calendar с реальными данными потерь времени
-- Период: Июль-Август 2025
-- Цеха: 装配车间, 热水器总装组, 喷粉车间

;WITH T1A AS (  -- Выпуск/Факт времени производства по дням
    SELECT OnlyDate, SUM(FACT_TIME) AS Prod_Time
    FROM Views_For_Plan.DailyPlan_CustomWS
    WHERE OnlyDate >= '2025-07-01'
      AND OnlyDate < '2025-09-01'
      AND WorkShopName_CH IN ('装配车间', '热水器总装组', '喷粉车间')
    GROUP BY OnlyDate
),
T2A AS (  -- Сменное время и люди по дням
    SELECT OnlyDate, SUM(PeopleWorkHours) AS Shift_Time, SUM(People) AS People
    FROM TimeLoss.WorkSchedules_ByDay
    WHERE DeleteMark = 0
      AND OnlyDate >= '2025-07-01'
      AND OnlyDate < '2025-09-01'
      AND WorkShopID IN ('装配车间', '热水器总装组', '喷粉车间')
    GROUP BY OnlyDate
),
T3A AS (  -- Потери времени по дням из грид-данных потерь
    SELECT OnlyDate, SUM(ManHours) AS Time_Loss
    FROM TimeLoss.vw_EntryGrid
    WHERE OnlyDate >= '2025-07-01'
      AND OnlyDate < '2025-09-01'
      AND WorkShopID IN ('装配车间', '热水器总装组', '喷粉车间')
    GROUP BY OnlyDate
)
SELECT a.OnlyDate,
       a.Prod_Time,
       COALESCE(b.Shift_Time, 0) AS Shift_Time,
       COALESCE(c.Time_Loss, 0)  AS Time_Loss,
       COALESCE(b.People, 0)     AS People
FROM T1A a
LEFT JOIN T2A b ON b.OnlyDate = a.OnlyDate
LEFT JOIN T3A c ON c.OnlyDate = a.OnlyDate
ORDER BY a.OnlyDate;

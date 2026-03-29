# QC.Stamping_Weight_Summary

## Назначение

Представление (VIEW) с выпуском и браком цеха штамповки, обогащённое весом металла и стоимостью изделия. Даёт полную картину по цеху штамповки в одной строке на каждую (дата, номенклатура): сколько выпустили, сколько забраковали (по типам брака), какой вес металла задействован и на какую сумму.

> При необходимости заменяется физической таблицей с тем же именем — `DROP VIEW` + `CREATE TABLE` + процедура обновления.

---

## Источники данных

| Источник | Что берём |
|---|---|
| `Views_For_Plan.DailyPlan_CustomWS` | Факт выпуска (`FACT_QTY`) по датам и номенклатуре |
| `Import_1C.WorkCenter_1C` | Русское название цеха (`WorkShop_Ru`) |
| `QC.vw_Stamping_Output` | Список финальных изделий цеха штамповки |
| `QC.QC_Cards_Summary` | Количество брака по картам брака |
| `Ref.BOM_Stamping_Weight` | Снимки веса металла по спецификациям |
| `Import_1C.vw_Price_List_Current` | Цены на номенклатуру (`PMC_Цеховая` и `PMC_Материальная`) |

---

## Логика расчёта

### Выпуск (Production)

Берётся только цех штамповки (`WorkShopID = 0xB5BC00505601355E11EDF0AED639127E`) и только **финальные изделия** из `QC.vw_Stamping_Output` — промежуточные полуфабрикаты исключаются чтобы избежать двойного счёта выпуска.

### Брак (Defects)

Берутся карты брака из `QC.QC_Cards_Summary` с фильтрами:
- `VinovnikDep_ID = 0xB5BC00505601355E11EDF0AED639127E` — виновник цех штамповки
- `Delete_Mark = 0x00` — не удалённые карты
- `QCcardConclusion_No IN (2, 3)` — только утилизация и переработка

Брак разбивается на два поля:

| Поле | Условие |
|---|---|
| `Debugging_QTY` | `Defect_TypeID = 0xB3E7C4CBE1AC069511F0711A87DE2892` — отладочный брак |
| `QCCard_Others_QTY` | Все остальные типы дефектов (включая NULL) |

### Объединение выпуска и брака

Используется `FULL OUTER JOIN` по `(Date, NomenclatureID)`:
- Есть выпуск + брак → одна строка, оба значения заполнены
- Есть выпуск, нет брака → `Debugging_QTY` и `QCCard_Others_QTY = NULL`
- Есть брак, нет выпуска → `FACT_QTY = NULL`

### Подбор веса (`GP_Weight`)

Вес берётся из `Ref.BOM_Stamping_Weight` через `OUTER APPLY` по `GPNomencl_ID = NomenclatureID`. Подбирается **ближайший снимок не позже даты строки**:

```
Snapshot_Date <= Date → MAX(Snapshot_Date)  ← основной вариант
Snapshot_Date > Date  → MIN(Snapshot_Date)  ← страховка если снимков ещё нет
```

Поле `Weight_Snapshot_Date` показывает какой именно снимок был использован.

### Подбор цены

Аналогично `QC.Production_Output_Cost`:
1. Сначала ищет `PMC_Цеховая`
2. Если не найдена — берёт `PMC_Материальная` как fallback

Подбор по дате — ближайшая цена не позже даты строки.

---

## Структура полей

| Поле | Описание |
|---|---|
| `WorkShopID` | ID цеха из 1С |
| `NomenclatureID` | ID номенклатуры из 1С |
| `Date` | Дата |
| `WorkShopName_CH` | Название цеха на китайском |
| `WorkShop_Ru` | Название цеха на русском |
| `NomenclatureNumber` | Артикул номенклатуры |
| `ProductName_CN` | Название продукции на китайском |
| `GP_Weight` | Вес металла на единицу изделия (кг) |
| `Price` | Цена за единицу изделия |
| `FACT_QTY` | Факт выпуска (шт.) |
| `Weight_FACT` | Вес выпуска (`GP_Weight × FACT_QTY`) |
| `Cost_FACT` | Стоимость выпуска (`FACT_QTY × Price`) |
| `Debugging_QTY` | Брак — отладочный тип (шт.) |
| `Weight_Debugging` | Вес отладочного брака (`GP_Weight × Debugging_QTY`) |
| `Cost_Debugging` | Стоимость отладочного брака (`Debugging_QTY × Price`) |
| `QCCard_Others_QTY` | Брак — прочие типы (шт.) |
| `Weight_Others` | Вес прочего брака (`GP_Weight × QCCard_Others_QTY`) |
| `Cost_Others` | Стоимость прочего брака (`QCCard_Others_QTY × Price`) |
| `Weight_Snapshot_Date` | Дата снимка веса который был использован |
| `Price_Date` | Дата прайса который был использован |
| `PriceTypeName` | Тип цены (`PMC_Цеховая` или `PMC_Материальная`) |

---

## Схема и объект

- **Схема:** `QC`
- **Тип объекта:** VIEW (представление)
- **Полное имя:** `QC.Stamping_Weight_Summary`

---

## Зависимости

| Объект | Тип | Описание |
|---|---|---|
| `Views_For_Plan.DailyPlan_CustomWS` | VIEW | Факт выпуска из 1С |
| `Import_1C.WorkCenter_1C` | TABLE | Справочник цехов |
| `QC.vw_Stamping_Output` | VIEW | Финальные изделия цеха штамповки |
| `QC.QC_Cards_Summary` | TABLE | Карты брака с полями `Defect_TypeID`, `VinovnikDep_ID` |
| `Ref.BOM_Stamping_Weight` | TABLE | Снимки веса металла (ежемесячно) |
| `Import_1C.vw_Price_List_Current` | VIEW | Прайс на продукцию |

---

## Файлы

| Файл | Описание |
|---|---|
| `DB_Docs/QC/Stamping_Weight_Summary_DDL.sql` | DDL представления `QC.Stamping_Weight_Summary` |
| `DB_Docs/QC/Расчет_веса.sql` | Ad-hoc запрос для отладки (без CREATE VIEW) |

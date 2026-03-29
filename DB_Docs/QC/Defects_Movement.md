# QC.Defects_Movement

## Назначение

Таблица документов перемещения брака между складами. Содержит информацию о том какой брак, когда, в каком количестве и между какими складами был перемещён, кто является виновником и кто ответственный.

---

## Источник данных

Данные импортируются напрямую из 1С — таблица является физическим хранилищем документов перемещения брака.

---

## Поля таблицы

| Поле | Тип | Описание |
|---|---|---|
| `Delete_Mark` | binary(1) | Пометка на удаление (`0x00` = нет, `0x01` = да) |
| `Posted` | binary(1) | Проведён ли документ (`0x00` = нет, `0x01` = да) |
| `Doc_Date` | date | Дата документа |
| `Doc_No` | nvarchar | Номер документа |
| `Nomencl_Type_RU` | nvarchar | Тип номенклатуры на русском |
| `Nomencl_Type_ZH` | nvarchar | Тип номенклатуры на китайском |
| `Nomencl_No` | nvarchar | Артикул номенклатуры |
| `Nomencl_Name_RU` | nvarchar | Название номенклатуры на русском |
| `Nomencl_Name_ZH` | nvarchar | Название номенклатуры на китайском |
| `QTY` | decimal | Количество |
| `Total_Cost` | decimal | Общая стоимость |
| `Price` | decimal | Цена за единицу |
| `Doc_Comment` | nvarchar | Комментарий к документу |
| `Goods_Doc_Comment` | nvarchar | Комментарий к товарной строке |
| `Guilty_Dep_RU` | nvarchar | Виновный отдел на русском |
| `Guilty_Dep_ZH` | nvarchar | Виновный отдел на китайском |
| `Avtor_Name` | nvarchar | Автор документа |
| `Responsible_Name` | nvarchar | Ответственный |
| `Sender_WH_Ru` | nvarchar | Склад-отправитель на русском |
| `Sender_WH_Zh` | nvarchar | Склад-отправитель на китайском |
| `Recipient_WH_Ru` | nvarchar | Склад-получатель на русском |
| `Recipient_WH_Zh` | nvarchar | Склад-получатель на китайском |

---

## API

Данные доступны через endpoint:

```
GET /api/qc/defects-movement?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

Фильтрация по полю `Doc_Date`. Сортировка по `Doc_Date DESC`.

---

## Схема и объект

- **Схема:** `QC`
- **Тип объекта:** TABLE (физическая таблица)
- **Полное имя:** `QC.Defects_Movement`
- **Backend сервис:** `Back/QC/service/DefectsMovement_service.py`
- **Backend API:** `Back/QC/api/DefectsMovement_api.py`
- **Frontend компонент:** `Front/.../tabs/DefectCards/tabs/DefectsMovement/`

---

**Создано:** 2026-03-19

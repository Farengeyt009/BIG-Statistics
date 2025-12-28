"""
Service для загрузки и парсинга Excel файлов Sale Plan
"""
import pandas as pd  # type: ignore
from datetime import datetime
from typing import Dict, Any, List
from ....database.db_connector import get_connection


def parse_and_save_saleplan(file_path: str, uploaded_by: str, comment: str = None) -> Dict[str, Any]:
    """
    Парсит Excel файл Sale Plan и сохраняет в БД
    
    Ожидаемые колонки в Excel:
    - Year (или Yaer)
    - Month
    - Market
    - Article_number
    - Name
    - QTY
    """
    try:
        # 1. Читаем Excel файл
        df = pd.read_excel(file_path, sheet_name=0)
        
        # Нормализуем названия колонок (убираем пробелы, приводим к нижнему регистру)
        df.columns = df.columns.str.strip().str.lower()
        
        # Проверяем порядок и наличие обязательных колонок
        expected_cols_variants = [
            ['year', 'month', 'market', 'article_number', 'name', 'qty'],
            ['yaer', 'month', 'market', 'article_number', 'name', 'qty'],  # Поддержка опечатки
        ]
        
        # Находим подходящий вариант
        year_col = None
        for variant in expected_cols_variants:
            if all(col in df.columns for col in variant):
                year_col = variant[0]
                break
        
        if year_col is None:
            # Проверяем какие колонки отсутствуют
            required_cols = ['month', 'market', 'article_number', 'name', 'qty']
            year_col = 'year' if 'year' in df.columns else 'yaer' if 'yaer' in df.columns else None
            
            if year_col is None:
                raise ValueError("Колонка 'Year' (или 'Yaer') не найдена в файле")
            
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                raise ValueError(f"Отсутствуют обязательные колонки: {', '.join(missing_cols)}")
        
        # Проверяем порядок колонок (предупреждение, но не ошибка)
        actual_cols = df.columns.tolist()
        expected_order = [year_col, 'month', 'market', 'article_number', 'name', 'qty']
        if actual_cols[:6] != expected_order:
            print(f"⚠️ Порядок колонок отличается от ожидаемого: {expected_order}")
        
        # 2. Проверка на пустые значения (НЕ удаляем, выдаем ошибку)
        empty_year = df[df[year_col].isna()]
        if len(empty_year) > 0:
            raise ValueError(f"Найдены пустые значения в колонке 'Year' (строки: {empty_year.index.tolist()[:5]}...)")
        
        empty_month = df[df['month'].isna()]
        if len(empty_month) > 0:
            raise ValueError(f"Найдены пустые значения в колонке 'Month' (строки: {empty_month.index.tolist()[:5]}...)")
        
        empty_qty = df[df['qty'].isna()]
        if len(empty_qty) > 0:
            raise ValueError(f"Найдены пустые значения в колонке 'QTY' (строки: {empty_qty.index.tolist()[:5]}...)")
        
        # Проверка Year на валидность (должно быть числом)
        try:
            df[year_col] = df[year_col].astype(int)
        except Exception as e:
            invalid_years = df[~df[year_col].apply(lambda x: str(x).replace('.', '', 1).isdigit())]
            raise ValueError(f"Невалидные значения в колонке 'Year': {invalid_years[year_col].unique().tolist()[:5]}")
        
        # Преобразуем Month: если текст (January) → число (1), если уже число → оставляем
        def month_to_number(val):
            if pd.isna(val):
                return None
            if isinstance(val, (int, float)):
                return int(val)
            # Пробуем распарсить как название месяца
            month_map = {
                'january': 1, 'jan': 1,
                'february': 2, 'feb': 2,
                'march': 3, 'mar': 3,
                'april': 4, 'apr': 4,
                'may': 5,
                'june': 6, 'jun': 6,
                'july': 7, 'jul': 7,
                'august': 8, 'aug': 8,
                'september': 9, 'sep': 9,
                'october': 10, 'oct': 10,
                'november': 11, 'nov': 11,
                'december': 12, 'dec': 12,
            }
            val_lower = str(val).strip().lower()
            if val_lower in month_map:
                return month_map[val_lower]
            # Если не название - пытаемся преобразовать в число
            try:
                return int(val)
            except:
                return None
        
        df['month_parsed'] = df['month'].apply(month_to_number)
        
        # Проверяем, есть ли невалидные месяцы
        invalid_months = df[df['month_parsed'].isna()]
        if len(invalid_months) > 0:
            invalid_values = invalid_months['month'].unique().tolist()
            raise ValueError(f"Невалидные значения месяца: {invalid_values}. Используйте названия (January, February...) или числа (1-12)")
        
        df['month'] = df['month_parsed'].astype(int)
        df = df.drop(columns=['month_parsed'])
        
        # Проверка QTY на числовые значения (СТРОГАЯ - ошибка если не число)
        non_numeric_qty = df[~df['qty'].apply(lambda x: pd.api.types.is_number(x) if not pd.isna(x) else True)]
        if len(non_numeric_qty) > 0:
            invalid_values = non_numeric_qty['qty'].unique().tolist()[:5]
            raise ValueError(f"Найдены не числовые значения в колонке 'QTY': {invalid_values}")
        
        df['qty'] = pd.to_numeric(df['qty'], errors='raise')  # raise вместо coerce
        
        # Проверка диапазона месяцев
        if not df['month'].between(1, 12).all():
            raise ValueError("Некорректные значения месяца (должны быть 1-12)")
        
        total_records = len(df)
        if total_records == 0:
            raise ValueError("Файл не содержит данных")
        
        min_year = int(df[year_col].min())
        max_year = int(df[year_col].max())
        
        # 3. Генерируем VersionID
        with get_connection() as conn:
            cur = conn.cursor()
            
            # Находим последний счётчик для min_year
            cur.execute("""
                SELECT MAX(VersionID % 1000) 
                FROM Orders.SalesPlan_Versions 
                WHERE VersionID / 1000 = ?
            """, (min_year,))
            
            last_counter = cur.fetchone()[0] or 0
            version_id = min_year * 1000 + (last_counter + 1)
            
            # 4. Сохраняем метаданные версии (IsActive = 0 - неактивная по умолчанию)
            cur.execute("""
                INSERT INTO Orders.SalesPlan_Versions 
                (VersionID, UploadedBy, MinYear, MaxYear, TotalRecords, FileName, Comment, IsActive)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            """, (
                version_id,
                uploaded_by,
                min_year,
                max_year,
                total_records,
                file_path.split('\\')[-1].split('/')[-1],  # Имя файла
                comment
            ))
            
            # 5. Сохраняем детали
            details = []
            for _, row in df.iterrows():
                details.append((
                    version_id,
                    int(row[year_col]),
                    int(row['month']),
                    str(row.get('market', '')),
                    str(row.get('article_number', '')),
                    str(row.get('name', '')),
                    float(row['qty'])
                ))
            
            cur.executemany("""
                INSERT INTO Orders.SalesPlan_Details 
                (VersionID, YearNum, MonthNum, Market, Article_number, Name, QTY)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, details)
            
            conn.commit()
            
            # Примечание: Новая версия создаётся как неактивная (IsActive = 0 по умолчанию)
            # Пользователь сам устанавливает активную версию через кнопку "Сделать активной"
            
            return {
                'success': True,
                'version_id': version_id,
                'total_records': total_records,
                'min_year': min_year,
                'max_year': max_year,
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при обработке файла: {str(e)}")


def get_versions() -> List[Dict[str, Any]]:
    """Получить список всех версий Sale Plan"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                VersionID, UploadedAt, UploadedBy, MinYear, MaxYear, 
                TotalRecords, FileName, Comment, IsActive
            FROM Orders.SalesPlan_Versions
            ORDER BY VersionID DESC
        """)
        
        columns = [col[0] for col in cur.description]
        rows = cur.fetchall()
        
        return [dict(zip(columns, row)) for row in rows]


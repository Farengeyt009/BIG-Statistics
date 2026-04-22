"""
DB Documentation Generator
============================
Подключается к целевой БД WeChat_APP, собирает схему и генерирует:
  - DB_Docs/overview.md      — сводка объектов
  - DB_Docs/tables.md        — таблицы с колонками, PK/FK, индексами
  - DB_Docs/views.md         — представления с телом
  - DB_Docs/procedures.md    — хранимые процедуры
  - DB_Docs/functions.md     — функции
  - DB_Docs/triggers.md      — триггеры
  - DB_Docs/erd.md           — Mermaid ERD (связи между таблицами)

Запуск (из папки DB_Docs или корня проекта):
  python DB_Docs/generate_docs.py
"""

import sys
import os
import textwrap
from datetime import datetime
from pathlib import Path

# Добавляем корень проекта и Migration/ в путь, чтобы импортировать core.db
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "Migration"))

from core.db import get_target_connection  # noqa: E402

OUT_DIR = Path(__file__).parent
GENERATED_AT = datetime.now().strftime("%Y-%m-%d %H:%M")


# ─── SQL-запросы ──────────────────────────────────────────────────────────────

SQL_OVERVIEW = """
SELECT type_desc, COUNT(*) AS cnt
FROM sys.objects
WHERE type IN ('U','V','P','FN','IF','TF','TR')
GROUP BY type_desc
ORDER BY cnt DESC;
"""

SQL_TABLES = """
SELECT
    t.TABLE_SCHEMA                          AS [schema],
    t.TABLE_NAME                            AS [table],
    c.COLUMN_NAME                           AS [column],
    c.ORDINAL_POSITION                      AS [ordinal],
    c.DATA_TYPE                             AS [data_type],
    COALESCE(CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR), '') AS [max_len],
    c.IS_NULLABLE                           AS [nullable],
    COALESCE(c.COLUMN_DEFAULT, '')          AS [default_val],
    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS [is_pk],
    CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 'FK' ELSE '' END AS [is_fk],
    COLUMNPROPERTY(OBJECT_ID(t.TABLE_SCHEMA+'.'+t.TABLE_NAME),
                   c.COLUMN_NAME, 'IsIdentity')                AS [is_identity]
FROM INFORMATION_SCHEMA.TABLES t
JOIN INFORMATION_SCHEMA.COLUMNS c
    ON  c.TABLE_NAME   = t.TABLE_NAME
    AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
LEFT JOIN (
    SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
    FROM   INFORMATION_SCHEMA.TABLE_CONSTRAINTS  tc
    JOIN   INFORMATION_SCHEMA.KEY_COLUMN_USAGE   ku
           ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
    WHERE  tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
) pk ON pk.TABLE_SCHEMA = t.TABLE_SCHEMA
     AND pk.TABLE_NAME   = t.TABLE_NAME
     AND pk.COLUMN_NAME  = c.COLUMN_NAME
LEFT JOIN (
    SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
    FROM   INFORMATION_SCHEMA.TABLE_CONSTRAINTS  tc
    JOIN   INFORMATION_SCHEMA.KEY_COLUMN_USAGE   ku
           ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
    WHERE  tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
) fk ON fk.TABLE_SCHEMA = t.TABLE_SCHEMA
     AND fk.TABLE_NAME   = t.TABLE_NAME
     AND fk.COLUMN_NAME  = c.COLUMN_NAME
WHERE t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION;
"""

SQL_FK = """
SELECT
    fk.name                                 AS [fk_name],
    tp.name                                 AS [parent_table],
    cp.name                                 AS [parent_col],
    tr.name                                 AS [ref_table],
    cr.name                                 AS [ref_col],
    fk.delete_referential_action_desc       AS [on_delete],
    fk.update_referential_action_desc       AS [on_update]
FROM sys.foreign_keys             fk
JOIN sys.foreign_key_columns      fkc ON fk.object_id           = fkc.constraint_object_id
JOIN sys.tables  tp ON fkc.parent_object_id    = tp.object_id
JOIN sys.columns cp ON fkc.parent_object_id    = cp.object_id AND fkc.parent_column_id    = cp.column_id
JOIN sys.tables  tr ON fkc.referenced_object_id = tr.object_id
JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
ORDER BY tp.name, cp.name;
"""

SQL_INDEXES = """
SELECT
    t.name              AS [table],
    i.name              AS [index_name],
    i.type_desc         AS [type],
    i.is_unique         AS [is_unique],
    i.is_primary_key    AS [is_pk],
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS [columns]
FROM sys.tables t
JOIN sys.indexes       i  ON t.object_id = i.object_id
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns       c  ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.name IS NOT NULL
GROUP BY t.name, i.name, i.type_desc, i.is_unique, i.is_primary_key
ORDER BY t.name, i.name;
"""

SQL_VIEWS = """
SELECT
    TABLE_SCHEMA    AS [schema],
    TABLE_NAME      AS [name],
    VIEW_DEFINITION AS [definition]
FROM INFORMATION_SCHEMA.VIEWS
ORDER BY TABLE_SCHEMA, TABLE_NAME;
"""

SQL_PROCEDURES = """
SELECT
    ROUTINE_SCHEMA      AS [schema],
    ROUTINE_NAME        AS [name],
    ROUTINE_DEFINITION  AS [definition]
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME;
"""

SQL_FUNCTIONS = """
SELECT
    ROUTINE_SCHEMA      AS [schema],
    ROUTINE_NAME        AS [name],
    ROUTINE_TYPE        AS [routine_type],
    ROUTINE_DEFINITION  AS [definition]
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'FUNCTION'
ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME;
"""

SQL_TRIGGERS = """
SELECT
    t.name                        AS [name],
    OBJECT_NAME(t.parent_id)      AS [table],
    t.is_disabled                 AS [disabled],
    te.type_desc                  AS [event],
    OBJECT_DEFINITION(t.object_id) AS [definition]
FROM sys.triggers       t
JOIN sys.trigger_events te ON t.object_id = te.object_id
WHERE t.parent_class = 1
ORDER BY OBJECT_NAME(t.parent_id), t.name;
"""

SQL_TABLE_ROWCOUNTS = """
SELECT
    s.name  AS [schema],
    t.name  AS [table],
    p.rows  AS [row_count]
FROM sys.tables              t
JOIN sys.schemas             s  ON t.schema_id  = s.schema_id
JOIN sys.indexes             i  ON t.object_id  = i.object_id AND i.index_id <= 1
JOIN sys.partitions          p  ON i.object_id  = p.object_id AND i.index_id = p.index_id
ORDER BY s.name, t.name;
"""


# ─── Хелперы ─────────────────────────────────────────────────────────────────

def run_query(conn, sql: str) -> list[dict]:
    cur = conn.cursor()
    cur.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def header(text: str, level: int = 1) -> str:
    return f"{'#' * level} {text}\n\n"


def write_file(filename: str, content: str) -> None:
    path = OUT_DIR / filename
    path.write_text(content, encoding="utf-8")
    print(f"  OK {filename}")


def _type_str(row: dict) -> str:
    t = row["data_type"].upper()
    ml = row.get("max_len", "")
    if ml and ml != "-1":
        return f"{t}({ml})"
    return t


def _badge(row: dict) -> str:
    parts = []
    if row.get("is_pk") == "PK":
        parts.append("🔑 PK")
    if row.get("is_fk") == "FK":
        parts.append("🔗 FK")
    if row.get("is_identity"):
        parts.append("⬆ IDENTITY")
    return " ".join(parts)


# ─── Генераторы файлов ────────────────────────────────────────────────────────

def gen_overview(conn) -> None:
    rows = run_query(conn, SQL_OVERVIEW)
    rc   = run_query(conn, SQL_TABLE_ROWCOUNTS)

    lines = [
        f"# Обзор базы данных\n\n",
        f"> Сгенерировано: {GENERATED_AT}\n\n",
        "## Состав объектов\n\n",
        "| Тип объекта | Количество |\n",
        "|-------------|------------|\n",
    ]
    for r in rows:
        lines.append(f"| {r['type_desc']} | {r['cnt']} |\n")

    lines.append("\n## Таблицы и количество строк\n\n")
    lines.append("| Схема | Таблица | Строк |\n")
    lines.append("|-------|---------|-------|\n")
    for r in rc:
        lines.append(f"| {r['schema']} | {r['table']} | {r['row_count']:,} |\n")

    write_file("overview.md", "".join(lines))


def gen_tables(conn) -> None:
    rows    = run_query(conn, SQL_TABLES)
    fk_rows = run_query(conn, SQL_FK)
    idx_rows = run_query(conn, SQL_INDEXES)

    # Группируем индексы по таблице
    idx_by_table: dict[str, list] = {}
    for r in idx_rows:
        idx_by_table.setdefault(r["table"], []).append(r)

    # Группируем FK по parent_table
    fk_by_table: dict[str, list] = {}
    for r in fk_rows:
        fk_by_table.setdefault(r["parent_table"], []).append(r)

    # Группируем колонки по (schema, table)
    tables: dict[tuple, list] = {}
    for r in rows:
        key = (r["schema"], r["table"])
        tables.setdefault(key, []).append(r)

    lines = [
        f"# Таблицы\n\n",
        f"> Сгенерировано: {GENERATED_AT}\n\n",
        "## Содержание\n\n",
    ]
    for schema, tname in tables:
        anchor = f"{schema}_{tname}".lower().replace(" ", "-")
        lines.append(f"- [{schema}.{tname}](#{anchor})\n")
    lines.append("\n---\n\n")

    for (schema, tname), cols in tables.items():
        anchor = f"{schema}_{tname}".lower().replace(" ", "-")
        lines.append(f'<a name="{anchor}"></a>\n\n')
        lines.append(f"## {schema}.{tname}\n\n")

        lines.append("| # | Колонка | Тип | Nullable | Default | Ключ |\n")
        lines.append("|---|---------|-----|----------|---------|------|\n")
        for c in cols:
            badge = _badge(c)
            nullable = "YES" if c["nullable"] == "YES" else "NO"
            default  = str(c["default_val"]).strip() if c["default_val"] else ""
            lines.append(
                f"| {c['ordinal']} | **{c['column']}** | `{_type_str(c)}` "
                f"| {nullable} | {default} | {badge} |\n"
            )

        # FK для этой таблицы
        fks = fk_by_table.get(tname, [])
        if fks:
            lines.append("\n**Внешние ключи:**\n\n")
            lines.append("| FK | Колонка | → Таблица | → Колонка | On Delete | On Update |\n")
            lines.append("|----|---------|-----------|-----------|-----------|----------|\n")
            for fk in fks:
                lines.append(
                    f"| {fk['fk_name']} | {fk['parent_col']} | "
                    f"{fk['ref_table']} | {fk['ref_col']} | "
                    f"{fk['on_delete']} | {fk['on_update']} |\n"
                )

        # Индексы для этой таблицы
        idxs = [i for i in idx_by_table.get(tname, []) if not i["is_pk"]]
        if idxs:
            lines.append("\n**Индексы:**\n\n")
            lines.append("| Индекс | Тип | Unique | Колонки |\n")
            lines.append("|--------|-----|--------|---------|\n")
            for i in idxs:
                uniq = "YES" if i["is_unique"] else "NO"
                lines.append(f"| {i['index_name']} | {i['type']} | {uniq} | {i['columns']} |\n")

        lines.append("\n---\n\n")

    write_file("tables.md", "".join(lines))


def gen_views(conn) -> None:
    rows = run_query(conn, SQL_VIEWS)
    if not rows:
        write_file("views.md", f"# Представления (Views)\n\n> Сгенерировано: {GENERATED_AT}\n\n_Нет объектов_\n")
        return

    lines = [f"# Представления (Views)\n\n", f"> Сгенерировано: {GENERATED_AT}\n\n"]
    lines.append("## Содержание\n\n")
    for r in rows:
        anchor = f"{r['schema']}_{r['name']}".lower()
        lines.append(f"- [{r['schema']}.{r['name']}](#{anchor})\n")
    lines.append("\n---\n\n")

    for r in rows:
        anchor = f"{r['schema']}_{r['name']}".lower()
        lines.append(f'<a name="{anchor}"></a>\n\n')
        lines.append(f"## {r['schema']}.{r['name']}\n\n")
        defn = r["definition"] or "_определение недоступно_"
        lines.append(f"```sql\n{defn.strip()}\n```\n\n---\n\n")

    write_file("views.md", "".join(lines))


def gen_procedures(conn) -> None:
    rows = run_query(conn, SQL_PROCEDURES)
    if not rows:
        write_file("procedures.md", f"# Хранимые процедуры\n\n> Сгенерировано: {GENERATED_AT}\n\n_Нет объектов_\n")
        return

    lines = [f"# Хранимые процедуры\n\n", f"> Сгенерировано: {GENERATED_AT}\n\n"]
    lines.append("## Содержание\n\n")
    for r in rows:
        anchor = f"{r['schema']}_{r['name']}".lower()
        lines.append(f"- [{r['schema']}.{r['name']}](#{anchor})\n")
    lines.append("\n---\n\n")

    for r in rows:
        anchor = f"{r['schema']}_{r['name']}".lower()
        lines.append(f'<a name="{anchor}"></a>\n\n')
        lines.append(f"## {r['schema']}.{r['name']}\n\n")
        defn = r["definition"] or "_определение недоступно_"
        lines.append(f"```sql\n{defn.strip()}\n```\n\n---\n\n")

    write_file("procedures.md", "".join(lines))


def gen_functions(conn) -> None:
    rows = run_query(conn, SQL_FUNCTIONS)
    if not rows:
        write_file("functions.md", f"# Функции\n\n> Сгенерировано: {GENERATED_AT}\n\n_Нет объектов_\n")
        return

    lines = [f"# Функции\n\n", f"> Сгенерировано: {GENERATED_AT}\n\n"]
    for r in rows:
        lines.append(f"## {r['schema']}.{r['name']} `({r['routine_type']})`\n\n")
        defn = r["definition"] or "_определение недоступно_"
        lines.append(f"```sql\n{defn.strip()}\n```\n\n---\n\n")

    write_file("functions.md", "".join(lines))


def gen_triggers(conn) -> None:
    rows = run_query(conn, SQL_TRIGGERS)
    if not rows:
        write_file("triggers.md", f"# Триггеры\n\n> Сгенерировано: {GENERATED_AT}\n\n_Нет объектов_\n")
        return

    lines = [f"# Триггеры\n\n", f"> Сгенерировано: {GENERATED_AT}\n\n"]
    for r in rows:
        status = "⛔ DISABLED" if r["disabled"] else "✅ ACTIVE"
        lines.append(f"## {r['name']}\n\n")
        lines.append(f"- **Таблица:** `{r['table']}`\n")
        lines.append(f"- **Событие:** `{r['event']}`\n")
        lines.append(f"- **Статус:** {'DISABLED' if r['disabled'] else 'ACTIVE'}\n\n")
        defn = r["definition"] or "_определение недоступно_"
        lines.append(f"```sql\n{defn.strip()}\n```\n\n---\n\n")

    write_file("triggers.md", "".join(lines))


def gen_erd(conn) -> None:
    """Генерирует Mermaid ERD диаграмму связей между таблицами."""
    fk_rows  = run_query(conn, SQL_FK)
    tbl_rows = run_query(conn, SQL_TABLES)

    # Уникальные таблицы
    tables: set[str] = set()
    for r in tbl_rows:
        tables.add(r["table"])

    # Таблицы, участвующие в связях
    linked: set[str] = set()
    for r in fk_rows:
        linked.add(r["parent_table"])
        linked.add(r["ref_table"])

    lines = [
        f"# ERD — Связи между таблицами\n\n",
        f"> Сгенерировано: {GENERATED_AT}\n\n",
    ]

    if not fk_rows:
        lines.append("_Внешние ключи не найдены — диаграмма недоступна_\n")
        write_file("erd.md", "".join(lines))
        return

    lines.append("```mermaid\nerDiagram\n\n")

    # Колонки для таблиц, участвующих в связях
    cols_by_table: dict[str, list] = {}
    for r in tbl_rows:
        if r["table"] in linked:
            cols_by_table.setdefault(r["table"], []).append(r)

    for tname, cols in cols_by_table.items():
        lines.append(f"    {tname} {{\n")
        for c in cols:
            col_type = _type_str(c).replace("(", "_").replace(")", "").replace(",", "_")
            pk_marker = "PK" if c.get("is_pk") == "PK" else ("FK" if c.get("is_fk") == "FK" else "")
            pk_part = f' "{pk_marker}"' if pk_marker else ""
            lines.append(f"        {col_type} {c['column']}{pk_part}\n")
        lines.append("    }\n\n")

    # Связи
    seen_fk: set[str] = set()
    for r in fk_rows:
        key = f"{r['parent_table']}.{r['parent_col']}->{r['ref_table']}.{r['ref_col']}"
        if key in seen_fk:
            continue
        seen_fk.add(key)
        lines.append(
            f'    {r["ref_table"]} ||--o{{ {r["parent_table"]} : "{r["parent_col"]}"\n'
        )

    lines.append("```\n")
    write_file("erd.md", "".join(lines))


# ─── Точка входа ─────────────────────────────────────────────────────────────

def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Подключение к БД WeChat_APP...")
    conn = get_target_connection()
    print("Соединение установлено. Генерация документации...\n")

    gen_overview(conn)
    gen_tables(conn)
    gen_views(conn)
    gen_procedures(conn)
    gen_functions(conn)
    gen_triggers(conn)
    gen_erd(conn)

    conn.close()
    print(f"\nГотово! Файлы сохранены в {OUT_DIR}")


if __name__ == "__main__":
    main()

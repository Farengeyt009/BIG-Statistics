import os
import ast
from pathlib import Path
import importlib.util
import sys

def extract_imports_from_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=file_path)

    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module.split('.')[0])
    return imports

def is_external_module(module_name):
    if module_name.startswith('_') or module_name.startswith('__'):
        return False  # исключаем служебные модули
    try:
        spec = importlib.util.find_spec(module_name)
        if spec is None:
            return True
        return "site-packages" in (spec.origin or "")
    except Exception:
        return False

def analyze_folder_for_dependencies(folder_path):
    folder = Path(folder_path)
    all_imports = set()

    for py_file in folder.rglob("*.py"):
        # Пропускаем виртуальные окружения и служебные директории
        if ".venv" in py_file.parts or "__pycache__" in py_file.parts:
            continue
        imports = extract_imports_from_file(py_file)
        all_imports.update(imports)

    external_libs = sorted({lib for lib in all_imports if is_external_module(lib)})

    print("\n📦 Возможные внешние библиотеки (установи через pip, если не установлены):\n")
    for lib in external_libs:
        print(f"  - {lib}")

# 👉 Укажи свою рабочую директорию:
analyze_folder_for_dependencies(r"C:\Users\pphea\Documents\My progect\PyCharm")



"""backend/app/core/settings.py

Центральная конфигурация backend-приложения BIG STATISTICS.
Читает переменные из файла `.env` (в корне репозитория) либо из
переменных окружения. Основано на pydantic-settings (PEP 593).
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# ────────────────────────────────────────────────────────────────
# Основной класс конфигурации
# ────────────────────────────────────────────────────────────────


class Settings(BaseSettings):
    # ========== Подключения =====================================
    mssql_dsn: str  # строка подключения к MS SQL (ODBC Driver 18)
    redis_dsn: str | None = None  # кэш / брокер задач (опционально)

    # ========== Безопасность ====================================
    jwt_secret: str  # минимум 32 символа для подписи JWT токенов

    # ========== FastAPI / Uvicorn ===============================
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "info"

    # ========== Проектные параметры =============================
    default_page_size: int = 50
    enable_demo_mode: bool = False

    # Pydantic v2 — где искать .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # игнорируем неожиданные переменные
    )

    # --------- Служебные методы --------------------------------
    @property
    def show_debug(self) -> bool:
        """Возвращает True, если приложение запущено в DEMO-режиме."""
        return self.enable_demo_mode


# ────────────────────────────────────────────────────────────────
# Функция-single­ton для импорта настроек в других модулях
# ────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def get_settings() -> Settings:  # pragma: no cover
    """Быстрое (кэшируемое) получение Settings."""
    return Settings()


# ────────────────────────────────────────────────────────────────
# Авто­инициализация при первом импорте
# ────────────────────────────────────────────────────────────────
settings: Settings = get_settings()

# Отладочный вывод (по желанию):
# print("Loaded settings:", settings.model_dump(exclude={"jwt_secret"}))


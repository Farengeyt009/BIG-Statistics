from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

# сюда можно импортировать модели, если нужно, напр.:
# from .month_plan import MonthPlanHeaters  # noqa: F401

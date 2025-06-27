from datetime import date
from sqlalchemy import Integer, Date, NVARCHAR, Float
from sqlalchemy.orm import Mapped, mapped_column
from . import Base

class MonthPlanHeaters(Base):
    __tablename__ = "Month_Plan_Heaters"
    id: Mapped[int]            = mapped_column(primary_key=True)
    plan_date: Mapped[date]    = mapped_column("Date", Date)
    factory_number: Mapped[str]= mapped_column("FactoryNumber", NVARCHAR(50))
    month_plan_pcs: Mapped[int]= mapped_column("MonthPlanPcs", Integer)
    labor: Mapped[float]       = mapped_column("Labor", Float)

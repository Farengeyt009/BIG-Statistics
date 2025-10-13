# Run_Server.py

import os
from flask import Flask, send_from_directory
from flask_cors import CORS

from Back.Plan.api.Month_PlanFact_Gantt_api import init_app as planfact_init_app
from Back.Plan.api.Month_PlanFactSummary_api import init_app as planfact_summary_init_app
from Back.Home.api.Home_Production_api import init_app as home_production_init_app
from Back.Production.api.Production_Efficiency_api import init_app as production_efficiency_init_app
from Back.Production.api.Working_Calendar.WorkingCalendar_api import init_app as working_calendar_init_app
from Back.Production.api.Working_Calendar.WorkingSchedules_api import working_calendar_api
from Back.Production.api.Working_Calendar.Assign_Work_Schedules_api import init_app as assign_work_schedules_init_app
from Back.Production.api.Working_Calendar.WorkSchedules_ByDay_api import init_app as work_schedules_by_day_init_app
from Back.TV.api.TV_api import init_app as tv_init_app
from Back.Production.api.Time_Loss.TimeLoss_api import timeloss_router
from Back.Production.api.Time_Loss.TimeLossDashboard_api import init_app as timeloss_dashboard_init_app
from Back.Production.api.Time_Loss.Daily_Staffing.DailyStaffing_api import init_app as daily_staffing_init_app
from Back.Production.api.Order_Tails.OrderTails_api import init_app as order_tails_init_app
from Back.orders.api.Shipment_api import init_app as orders_shipment_init_app
from Back.orders.api.ShipmentPlan_Fact_api import init_app as shipment_plan_fact_init_app
from Back.orders.api.ShipmentPlan_api import init_app as shipment_plan_init_app
from Back.orders.api.OrderData.OrderData_api import init_app as order_data_init_app
from Back.Users.api.auth_api import init_app as auth_init_app
from Back.Users.api.users_api import init_app as users_init_app
from Back.Users.api.admin_api import init_app as admin_init_app


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRONT_DIST_DIR = os.path.join(BASE_DIR, 'Front', 'big-statistics-dashboard', 'dist')

# static_url_path="" → статика доступна с корня (/, /assets/*)
app = Flask(__name__, static_folder=FRONT_DIST_DIR, static_url_path='')
CORS(app)  # Разрешаем кросс-доменные запросы (CORS) от фронтенда

# Регистрация маршрутов
# Auth API (должен быть первым)
auth_init_app(app)
users_init_app(app)
admin_init_app(app)
planfact_init_app(app)
planfact_summary_init_app(app)
home_production_init_app(app)
production_efficiency_init_app(app)
working_calendar_init_app(app)
app.register_blueprint(working_calendar_api, url_prefix='/api/working-calendar')
assign_work_schedules_init_app(app)
work_schedules_by_day_init_app(app)
tv_init_app(app)
app.register_blueprint(timeloss_router, url_prefix='/api')
timeloss_dashboard_init_app(app)
daily_staffing_init_app(app)
order_tails_init_app(app)
orders_shipment_init_app(app)
shipment_plan_fact_init_app(app)
shipment_plan_init_app(app)
order_data_init_app(app)

# ----- Раздача собранного фронтенда (SPA) -----

@app.route('/')
def index():
    # Главная страница SPA
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def static_proxy(path):
    # Если запрашиваемый файл существует в dist — отдаём его
    full_path = os.path.join(app.static_folder or '', path)
    if app.static_folder and os.path.exists(full_path):
        return send_from_directory(app.static_folder, path)
    # Иначе — SPA fallback на index.html (для маршрутов React Router)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

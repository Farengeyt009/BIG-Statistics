// Конфигурация API
const getApiBaseUrl = () => {
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  WORKING_CALENDAR: {
    WORK_SCHEDULES: `${API_BASE_URL}/working-calendar/work-schedules`,
    WORK_CENTERS: `${API_BASE_URL}/working-calendar/work-centers`,
    HEALTH: `${API_BASE_URL}/working-calendar/health`,
    CALENDAR_DATA: `${API_BASE_URL}/Production/WorkingCalendar`,
    ASSIGN_WORK_SCHEDULES: `${API_BASE_URL}/Production/AssignWorkSchedules`,
    // Новые endpoints для работы с назначениями
    WORK_SCHEDULES_BY_DAY: `${API_BASE_URL}/work-schedules/day`,
    WORK_SCHEDULES_BULK_REPLACE: `${API_BASE_URL}/work-schedules/day/bulk-replace`,
    WORK_SCHEDULES_LINE_DELETE: `${API_BASE_URL}/work-schedules/line/soft-delete`,
  },
  PRODUCTION: {
    HOME_PRODUCTION: `${API_BASE_URL}/Home/Production`,
  },
  ORDERS: {
    CUSTOMER_ORDERS_TABLE: `${API_BASE_URL}/CustomerOrdersInformation/table`,
    CUSTOMER_ORDERS_VIEWS: `${API_BASE_URL}/CustomerOrdersInformation/views`,
  },
  PLAN: {
    MONTH_PLAN_FACT_GANTT: `${API_BASE_URL}/MonthPlanFactGantt`,
    MONTH_PLAN_FACT_SUMMARY: `${API_BASE_URL}/MonthPlanFactSummary`,
  },
};

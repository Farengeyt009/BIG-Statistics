export interface TaskFilters {
  statuses: number[];
  priorities: string[];
  assigneeIds: (number | 'unassigned')[];
}

export const EMPTY_FILTERS: TaskFilters = {
  statuses: [],
  priorities: [],
  assigneeIds: [],
};

export const hasActiveFilters = (f: TaskFilters) =>
  f.statuses.length > 0 || f.priorities.length > 0 || f.assigneeIds.length > 0;

export const countActiveFilters = (f: TaskFilters) =>
  f.statuses.length + f.priorities.length + f.assigneeIds.length;

export const applyFilters = (tasks: any[], filters: TaskFilters): any[] => {
  if (!hasActiveFilters(filters)) return tasks;
  return tasks.filter(task => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status_id)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
    if (filters.assigneeIds.length > 0) {
      const isUnassigned = task.assignee_id == null;
      if (isUnassigned && !filters.assigneeIds.includes('unassigned')) return false;
      if (!isUnassigned && !filters.assigneeIds.includes(task.assignee_id)) return false;
    }
    return true;
  });
};

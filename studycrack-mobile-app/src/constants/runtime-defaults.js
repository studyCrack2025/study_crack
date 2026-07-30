export const EMPTY_USER = Object.freeze({ name: '', targetUniversity: '', plan: '' });

export const DEFAULT_NOTIFICATIONS = Object.freeze({
  planner: true,
  weekly: true,
  report: true,
  billing: true
});

export function getTodayDateKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const TODAY_DATE = getTodayDateKey();

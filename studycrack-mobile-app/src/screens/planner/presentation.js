import { buildPlannerOverview } from '../../features/study/overview-presentation.js';

function finiteMinutes(value) {
  return Math.max(0, Number(value) || 0);
}

export function nextPlannerCalendarMode(currentMode = 'week', key = '') {
  if (key === 'Home') return 'week';
  if (key === 'End') return 'month';
  if (key === 'ArrowLeft' || key === 'ArrowUp') return currentMode === 'week' ? 'month' : 'week';
  if (key === 'ArrowRight' || key === 'ArrowDown') return currentMode === 'month' ? 'week' : 'month';
  return currentMode;
}

export function formatPlannerDuration(minutes = 0) {
  const safeMinutes = finiteMinutes(minutes);
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  if (hour && minute) return `${hour}시간 ${minute}분`;
  if (hour) return `${hour}시간`;
  return `${minute}분`;
}

export function buildPlannerPresentation(items = []) {
  const overview = buildPlannerOverview(items);
  const totalCount = overview.total || 0;
  const completedItems = items.filter((item) => item.done === true);
  const completedCount = overview.completed || 0;
  const totalMinutes = items.reduce((sum, item) => sum + finiteMinutes(item.minutes), 0);
  const completedMinutes = completedItems.reduce((sum, item) => sum + finiteMinutes(item.minutes), 0);
  const progress = overview.percent || 0;

  return {
    totalCount,
    completedCount,
    totalMinutes,
    completedMinutes,
    remainingCount: Math.max(0, totalCount - completedCount),
    progress: Math.max(0, Math.min(100, progress)),
    totalDurationLabel: formatPlannerDuration(totalMinutes),
    completedDurationLabel: formatPlannerDuration(completedMinutes)
  };
}

function finiteMinutes(value) {
  return Math.max(0, Number(value) || 0);
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
  const totalCount = items.length;
  const completedItems = items.filter((item) => item.done);
  const completedCount = completedItems.length;
  const totalMinutes = items.reduce((sum, item) => sum + finiteMinutes(item.minutes), 0);
  const completedMinutes = completedItems.reduce((sum, item) => sum + finiteMinutes(item.minutes), 0);
  const progress = totalMinutes
    ? Math.round((completedMinutes / totalMinutes) * 100)
    : totalCount
      ? Math.round((completedCount / totalCount) * 100)
      : 0;

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

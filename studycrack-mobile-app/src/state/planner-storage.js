export function buildPlannerId(now = Date.now(), random = Math.random()) {
  return `pl-${now}-${random.toString(16).slice(2, 8)}`;
}

const LEGACY_PLANNER_YEAR_MONTH = '2026-07';

function inferPlannerDot(category = '') {
  if (String(category).includes('수')) return 'math';
  if (String(category).includes('국')) return 'kor';
  if (String(category).includes('영')) return 'eng';
  if (String(category).includes('탐')) return 'sci';
  return 'etc';
}

function normalizePlannerDateKey(value = '') {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const day = Math.max(1, Math.min(31, Number(raw) || 14));
  return `${LEGACY_PLANNER_YEAR_MONTH}-${String(day).padStart(2, '0')}`;
}

export function normalizePlannerItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, idx) => {
    const category = item.category || item.subject || '기타';
    return {
      ...item,
      id: item.id || `pl-legacy-${idx}-${item.subject || 'item'}`,
      date: normalizePlannerDateKey(item.date),
      category,
      subject: item.subject || category,
      detailSubject: item.detailSubject || '',
      activityType: item.activityType || '',
      memo: item.memo || '',
      start: item.start || '--:--',
      end: item.end || '--:--',
      dot: item.dot || inferPlannerDot(category)
    };
  });
}

export function normalizePlannerItemGroups(items = []) {
  return normalizePlannerItems(items).reduce((acc, item) => {
    const key = item.date || `${LEGACY_PLANNER_YEAR_MONTH}-14`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

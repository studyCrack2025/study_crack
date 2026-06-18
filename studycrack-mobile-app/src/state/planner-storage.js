export function buildPlannerId(now = Date.now(), random = Math.random()) {
  return `pl-${now}-${random.toString(16).slice(2, 8)}`;
}

export function normalizePlannerItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, idx) => ({
    ...item,
    id: item.id || `pl-legacy-${idx}-${item.subject || 'item'}`,
    date: item.date || '14'
  }));
}

export function normalizePlannerItemGroups(items = []) {
  return normalizePlannerItems(items).reduce((acc, item) => {
    const key = item.date || '14';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

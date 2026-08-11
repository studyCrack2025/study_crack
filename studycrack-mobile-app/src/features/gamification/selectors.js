export function selectRecentHabitat(days, count = 7) {
  return (Array.isArray(days) ? days : []).slice(-Math.max(1, count));
}

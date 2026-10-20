export function calendarSwipeDirection(start, end) {
  if (!start || !end || start.pointerId !== end.pointerId) return 0;
  const x = end.x - start.x;
  const y = end.y - start.y;
  return Math.abs(x) >= 40 && Math.abs(x) >= Math.abs(y) * 1.3 ? (x < 0 ? 1 : -1) : 0;
}

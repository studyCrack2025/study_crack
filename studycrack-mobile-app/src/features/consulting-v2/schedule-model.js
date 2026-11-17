export function groupWrittenSlots(slots = []) {
  const groups = new Map();
  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!slot?.slotId || !slot.localDate || !slot.localTime) continue;
    if (!groups.has(slot.localDate)) groups.set(slot.localDate, []);
    groups.get(slot.localDate).push(slot);
  }
  return [...groups].map(([date, items]) => ({ date, slots: items.sort((a, b) => a.startAt.localeCompare(b.startAt)) }));
}

export function writtenCalendarGroups(slots, window) {
  const groups = groupWrittenSlots(slots);
  const { startDate, endDate } = window || {};
  if (![startDate, endDate].every(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) return groups;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const count = (end - start) / 86400000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 31) return groups;
  const byDate = new Map(groups.map(group => [group.date, group]));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
    return byDate.get(date) || { date, slots: [] };
  });
}

export function validateWrittenSelection(selected = {}) {
  const entries = Object.entries(selected).filter(([, priority]) => [1, 2, 3].includes(Number(priority)));
  if (!entries.length) return { valid: false, message: '가능 시간을 한 개 이상 선택해주세요.' };
  return { valid: true, selectedSlots: entries.map(([slotId, priority]) => ({ slotId, priority: Number(priority) })) };
}

export function formatWrittenSession(session) {
  if (!session?.startAt || !session?.endAt || !['booked', 'open'].includes(session.status)) return null;
  const start = new Date(session.startAt);
  const end = new Date(session.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(start);
  const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(start);
  const endTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(end);
  return { date, time: `${time}–${endTime}` };
}

export function writtenChangeRemaining(booking, fallbackTime = Date.now()) {
  const provided = Date.parse(booking.changeRequestDeadline);
  const deadline = Number.isFinite(provided) ? provided : Date.parse(booking.session?.startAt) - 7200000;
  const serverTime = Number.isFinite(Date.parse(booking.serverTime)) ? Date.parse(booking.serverTime) : fallbackTime;
  return deadline - serverTime;
}

export function groupWrittenSlots(slots = []) {
  const groups = new Map();
  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!slot?.slotId || !slot.localDate || !slot.localTime) continue;
    if (!groups.has(slot.localDate)) groups.set(slot.localDate, []);
    groups.get(slot.localDate).push(slot);
  }
  return [...groups].map(([date, items]) => ({ date, slots: items.sort((a, b) => a.startAt.localeCompare(b.startAt)) }));
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
  const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(start);
  const endTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(end);
  return { date, time: `${time}–${endTime}` };
}

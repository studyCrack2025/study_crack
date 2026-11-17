export function mergeWrittenMessages(current = [], incoming = []) {
  const messages = new Map();
  for (const item of [...current, ...incoming]) {
    if (!item?.messageId || !item.createdAt || !['student', 'counselor'].includes(item.senderRole)) continue;
    const previous = messages.get(item.messageId);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(item)) messages.set(item.messageId, item);
  }
  const next = [...messages.values()].sort((a, b) => a.messageId.localeCompare(b.messageId));
  return next.length === current.length && next.every((item, index) => item === current[index]) ? current : next;
}

export function nextWrittenPollDelay({ changed, unchangedCount = 0, writable = true }) {
  if (writable) return 1000;
  if (changed) return 2000;
  return unchangedCount >= 2 ? 10000 : 5000;
}

export function formatWrittenMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function createClientMessageId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`;
}

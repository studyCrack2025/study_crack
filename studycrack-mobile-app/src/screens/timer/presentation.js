export function defaultFormatHms(total) {
  const safe = Math.max(0, Number(total) || 0);
  const hour = Math.floor(safe / 3600);
  const minute = Math.floor((safe % 3600) / 60);
  const second = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

export function defaultFormatMinutesLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  if (hour && minute) return `${hour} ${minute}`;
  if (hour) return `${hour}`;
  return `${minute}`;
}

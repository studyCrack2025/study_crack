import { getTodayDateKey } from '../../constants/runtime-defaults.js';

export function shiftedPlannerDate(value, delta, mode = 'week', fallback = getTodayDateKey()) {
  const raw = String(value || fallback).trim();
  const source = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : `2026-07-${String(Math.max(1, Math.min(31, Number(raw) || 1))).padStart(2, '0')}`;
  const [year, month, day] = source.split('-').map(Number);
  const current = new Date(year, month - 1, day);
  const next = mode === 'month' ? new Date(current.getFullYear(), current.getMonth() + delta, 1) : new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta * 7);
  if (mode === 'month') next.setDate(Math.min(current.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export function plannerCalendarPeriod(dates = []) {
  const first = dates[0]?.date, last = dates[6]?.date;
  if (!first || !last) return '';
  return `${first.replaceAll('-', '.')} — ${(first.slice(0, 4) === last.slice(0, 4) ? last.slice(5) : last).replaceAll('-', '.')}`;
}

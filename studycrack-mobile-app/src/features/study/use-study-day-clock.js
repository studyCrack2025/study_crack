import { useEffect, useRef } from 'react';
import { getTodayDateKey, getKoreaDateKey } from '../../constants/runtime-defaults.js';
import { attachDayBoundaryCheck } from '../../shared/browser/day-boundary.js';

export function studyDayPatch(state, now = new Date()) {
  const todayDate = getTodayDateKey(now);
  const studyKoreaDate = getKoreaDateKey(now);
  if (state.todayDate === todayDate && state.studyKoreaDate === studyKoreaDate) return null;
  const patch = { todayDate, studyKoreaDate };
  if (!state.selectedDate || state.selectedDate === state.todayDate) patch.selectedDate = todayDate;
  if (!state.calendarSelectedDate || state.calendarSelectedDate === state.todayDate) patch.calendarSelectedDate = todayDate;
  if (!state.calendarMonthAnchor || ((!state.calendarSelectedDate || state.calendarSelectedDate === state.todayDate) && state.calendarMonthAnchor === `${state.todayDate?.slice(0, 7)}-01`)) patch.calendarMonthAnchor = `${todayDate.slice(0, 7)}-01`;
  return patch;
}

export function useStudyDayClock(state, setState) {
  const current = useRef(state);
  current.current = state;
  useEffect(() => attachDayBoundaryCheck(() => { const patch = studyDayPatch(current.current); if (patch) setState(patch); }), [setState]);
}

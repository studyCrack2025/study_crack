import { useEffect, useRef } from 'react';
import { getTodayDateKey, getKoreaDateKey } from '../../constants/runtime-defaults.js';
import { attachDayBoundaryCheck } from '../../shared/browser/day-boundary.js';

export function studyDayPatch(state, now = new Date()) {
  const todayDate = getTodayDateKey(now);
  const studyKoreaDate = getKoreaDateKey(now);
  if (state.todayDate === todayDate && state.studyKoreaDate === studyKoreaDate) return null;
  const patch = { todayDate, studyKoreaDate };
  if (!state.selectedDate || state.selectedDate === state.todayDate) patch.selectedDate = todayDate;
  return patch;
}

export function useStudyDayClock(state, setState) {
  const current = useRef(state);
  current.current = state;
  useEffect(() => attachDayBoundaryCheck(() => { const patch = studyDayPatch(current.current); if (patch) setState(patch); }), [setState]);
}

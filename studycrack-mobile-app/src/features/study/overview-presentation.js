function count(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function buildPlannerOverview(items, date = null) {
  const validDate = dateKey(date);
  const validItems = Array.isArray(items) && items.every(item => item && typeof item === 'object' && !Array.isArray(item));
  const mismatch = validItems && validDate && items.some(item => item.date !== validDate);
  const ready = validItems && (date === null || validDate) && !mismatch;
  const completedItems = ready ? items.filter(item => item.done === true) : [];
  const total = ready ? items.length : null;
  const completed = ready ? completedItems.length : null;
  const sum = rows => rows.every(item => count(item.minutes) !== null) ? rows.reduce((value, item) => value + count(item.minutes), 0) : null;
  return Object.freeze({
    source: 'local', status: mismatch ? 'date-mismatch' : ready ? 'ready' : 'unknown', date: validDate,
    total, completed, percent: total ? Math.round(completed / total * 100) : null,
    minutes: ready ? sum(items) : null, completedMinutes: ready ? sum(completedItems) : null
  });
}

export function buildStudyOverview({ plannerItems, localDate, studySummary, studySummaryStatus = 'idle', activeStudySession, studyTimerRunning = false, liveSeconds } = {}) {
  const planner = buildPlannerOverview(plannerItems, localDate || '');
  const available = studySummary?.available === true && !['idle', 'unavailable'].includes(studySummaryStatus);
  const serverDate = dateKey(studySummary?.today?.date);
  const seconds = available && serverDate ? count(studySummary.today.totalSeconds) : null;
  const fresh = studySummaryStatus === 'ready' && seconds !== null;
  const weekStart = dateKey(studySummary?.week?.startDate);
  const weekEnd = dateKey(studySummary?.week?.endDate);
  const weekSeconds = available && weekStart && weekEnd && weekStart <= weekEnd ? count(studySummary.week.totalSeconds) : null;
  const live = Boolean(activeStudySession?.sessionId && activeStudySession.status === 'running' && studyTimerRunning && Number.isFinite(Date.parse(activeStudySession.startedAt)));
  const datesMatch = Boolean(planner.date && serverDate && planner.date === serverDate);
  return Object.freeze({
    planner,
    confirmed: Object.freeze({ source: 'server', status: studySummaryStatus, date: serverDate, asOf: typeof studySummary?.updatedAt === 'string' ? studySummary.updatedAt : null, seconds, fresh }),
    week: Object.freeze({ source: 'server', status: studySummaryStatus, startDate: weekStart, endDate: weekEnd, seconds: weekSeconds, fresh: studySummaryStatus === 'ready' && weekSeconds !== null }),
    live: Object.freeze({ source: 'session', status: live ? 'running' : activeStudySession ? 'pending' : 'idle', startedAt: activeStudySession?.startedAt || null, seconds: live ? count(liveSeconds) : null }),
    timeGoal: Object.freeze({ source: 'confirmed', datesMatch, percent: fresh && datesMatch && planner.minutes > 0 ? Math.min(100, Math.round(seconds / (planner.minutes * 60) * 100)) : null })
  });
}

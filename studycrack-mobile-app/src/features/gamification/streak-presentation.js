const DAY_MS = 86400000;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function dayState(row) {
  if (!row || typeof row.validStudyDay !== 'boolean' || !Number.isFinite(row.studySeconds) || row.studySeconds < 0) return 'unknown';
  if (row.validStudyDay && row.studySeconds > 0) return 'valid';
  if (row.validStudyDay) return 'unknown';
  return row.studySeconds > 0 ? 'recorded' : 'empty';
}

const LABELS = { valid: '연속 학습 인정', recorded: '공부 기록 있음', empty: '확인된 공부 없음', unknown: '확인 필요' };

export function buildStreakPresentation({ habitatDays = [], habitatStatus = 'idle', gameProfile, gameProfileStatus = 'idle' } = {}, now = new Date()) {
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const rows = Array.isArray(habitatDays) ? habitatDays.filter(row => validDate(row?.date) && row.date <= today) : [];
  const available = !['idle', 'unavailable'].includes(habitatStatus);
  const endDate = available && rows.length ? rows.map(row => row.date).sort().at(-1) : today;
  const byDate = new Map();
  for (const row of rows) byDate.set(row.date, byDate.has(row.date) ? null : row);
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.parse(`${endDate}T00:00:00Z`) + (index - 29) * DAY_MS).toISOString().slice(0, 10);
    const row = available ? byDate.get(date) : null;
    const status = dayState(row);
    const minutes = status === 'unknown' ? null : Math.floor(row.studySeconds / 60);
    return { date, status, minutes, label: LABELS[status], today: date === today };
  });
  const streak = gameProfile?.streakDays;
  const streakDays = !['idle', 'unavailable'].includes(gameProfileStatus) && Number.isSafeInteger(streak) && streak >= 0 ? streak : null;
  return {
    days, streakDays, status: habitatStatus, profileStatus: gameProfileStatus,
    startDate: days[0].date, endDate, leadingDays: new Date(`${days[0].date}T00:00:00Z`).getUTCDay(),
    unknownDays: days.filter(day => day.status === 'unknown').length,
    stale: rows.length > 0 && (habitatStatus !== 'ready' || endDate !== today),
    streakStale: streakDays !== null && gameProfileStatus !== 'ready'
  };
}

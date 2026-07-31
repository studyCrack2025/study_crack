function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '0';
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace(/\.0$/, '');
}

export function defaultScoreTierClass(score) {
  const value = Number(score) || 0;
  if (value <= 100) return 'score-tier-low';
  if (value <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

export function defaultFormatHms(total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const hour = Math.floor(safeTotal / 3600);
  const minute = Math.floor((safeTotal % 3600) / 60);
  const second = safeTotal % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

export function defaultFormatMinutesLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  if (hour && minute) return `${hour}시간 ${minute}분`;
  if (hour) return `${hour}시간`;
  return `${minute}분`;
}

export function countUnreadNotifications(notiList = []) {
  if (!Array.isArray(notiList)) return 0;
  return notiList.reduce((sum, notification) => (notification && !notification.isRead ? sum + 1 : sum), 0);
}

export function getHomeScorePresentation(item = {}) {
  const status = item.scoreStatus || 'confirmed';
  const pending = status === 'pending';
  const empty = status === 'empty';
  const noScore = pending || empty;
  const score = Math.max(0, Number(item.score) || 0);
  const neededToPass = noScore ? null : Math.max(0, 100 - score);

  return {
    empty,
    noScore,
    pending,
    score,
    scoreLabel:
      status === 'confirmed'
        ? item.scoreUpdating ? '갱신 중' : '환산점수'
        : status === 'live' ? '예상 환산점수'
          : pending ? '분석 중' : '성적 입력 필요',
    scorePct: Math.min((score / 250) * 100, 100),
    scoreValue: noScore ? '—' : `${formatScore(score)}점`,
    neededLabel: noScore ? '—' : neededToPass > 0 ? `+${formatScore(neededToPass)}점` : '도달',
    neededToPass
  };
}

export function buildMissionSubjectRows(items = [], secondsBySubject = {}) {
  const rows = new Map();

  items.forEach((item) => {
    const subject = String(item?.subject || '기타');
    const current = rows.get(subject) || { subject, plannedMinutes: 0, actualSeconds: 0 };
    current.plannedMinutes += Math.max(0, Number(item?.minutes) || 0);
    rows.set(subject, current);
  });

  Object.entries(secondsBySubject || {}).forEach(([subject, seconds]) => {
    const current = rows.get(subject) || { subject, plannedMinutes: 0, actualSeconds: 0 };
    current.actualSeconds += Math.max(0, Number(seconds) || 0);
    rows.set(subject, current);
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      progress: row.plannedMinutes
        ? Math.min(100, Math.round((row.actualSeconds / (row.plannedMinutes * 60)) * 100))
        : row.actualSeconds > 0 ? 100 : 0
    }))
    .filter((row) => row.plannedMinutes > 0 || row.actualSeconds > 0)
    .sort((a, b) => b.plannedMinutes - a.plannedMinutes || b.actualSeconds - a.actualSeconds)
    .slice(0, 3);
}

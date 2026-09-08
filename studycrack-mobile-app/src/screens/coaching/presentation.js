function safeText(value = '') {
  return String(value || '').trim();
}

export function buildCoachingWeek(items = [], date = '') {
  const day = new Date(`${date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.getTime()) || day.getDate() !== Number(date.slice(8))) return { days: [], total: 0, minutes: 0, start: '', end: '' };
  day.setDate(day.getDate() - (day.getDay() + 6) % 7);
  const days = ['월', '화', '수', '목', '금', '토', '일'].map(label => {
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const rows = (Array.isArray(items) ? items : []).filter(item => item?.date === key).map(item => ({ ...item, minutes: Number.isFinite(Number(item.minutes)) ? Math.max(0, Number(item.minutes)) : 0 }));
    day.setDate(day.getDate() + 1);
    return { date: key, label, items: rows };
  });
  return { days, start: days[0].date, end: days[6].date, total: days.reduce((sum, day) => sum + day.items.length, 0), minutes: days.reduce((sum, day) => sum + day.items.reduce((total, item) => total + item.minutes, 0), 0) };
}

export const COACHING_PROCESS_STEPS = [
  { number: '01', title: '학습 성향 분석', description: 'MBTI + 기초조사서' },
  { number: '02', title: '목표 대학 분석', description: '대학별 환산점수' },
  { number: '03', title: '합격 설계', description: '주간 플래너 + 루틴' }
];

export function formatCoachingWeekLabel(weekId = '') {
  const value = safeText(weekId);
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return value || '이번 주 학습 점검';
  return `20${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}주차`;
}

export function formatCoachingDate(value = '') {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '제출 일시 확인 중';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function hasSubmittedCoachingFeedback(report = {}) {
  return report?.tutorFeedback?.submitted === true;
}

function feedbackSummary(report = {}) {
  const feedback = report.tutorFeedback || {};
  return safeText(
    feedback.tutorComment
    || feedback.weeklyPlanner
    || feedback.priorityCheck
    || feedback.planEvaluation
  ) || '튜터 피드백 내용을 확인해 보세요.';
}

export function buildCoachingPresentation(reports = [], status = 'idle') {
  const source = Array.isArray(reports) ? reports.filter((report) => report?.weekId).sort((a, b) => String(b.weekId).localeCompare(String(a.weekId))) : [];
  const sessions = source.map((report) => {
    const feedbackReady = hasSubmittedCoachingFeedback(report);
    return {
      weekId: safeText(report.weekId),
      title: safeText(report.title) || formatCoachingWeekLabel(report.weekId),
      weekLabel: formatCoachingWeekLabel(report.weekId),
      dateLabel: formatCoachingDate(report.updatedAt || report.date),
      tutorName: safeText(report.tutorName) || '담당 튜터 확인 중',
      feedbackReady,
      statusLabel: feedbackReady ? '피드백 도착' : '검토 대기'
    };
  });
  const feedback = source.filter(hasSubmittedCoachingFeedback).map((report) => ({
    weekId: safeText(report.weekId),
    title: formatCoachingWeekLabel(report.weekId),
    dateLabel: formatCoachingDate(report.updatedAt || report.date),
    tutorName: safeText(report.tutorName) || '담당 튜터 확인 중',
    summary: feedbackSummary(report)
  }));

  const latest = sessions[0] || null;
  const statusSummary = status === 'error'
    ? { eyebrow: '이번 주 코칭', title: '점검 기록 확인 필요', description: '최신 제출 내역을 확인하지 못했어요.', tone: 'error' }
    : status === 'loading' || status === 'idle'
    ? { eyebrow: '이번 주 코칭', title: '점검 기록 확인 중', description: '제출 내역을 불러오고 있어요.', tone: 'loading' }
    : latest
      ? { eyebrow: latest.weekLabel, title: latest.statusLabel, description: `${latest.tutorName} · ${latest.dateLabel}`, tone: latest.feedbackReady ? 'ready' : 'pending' }
      : { eyebrow: '이번 주 코칭', title: '새 점검을 시작해 보세요', description: '기록을 보내면 SKY 튜터의 피드백이 연결돼요.', tone: 'empty' };

  return {
    feedback,
    feedbackReady: feedback.length > 0,
    isError: status === 'error',
    isLoading: status === 'loading' || status === 'idle',
    latest,
    sessions,
    statusSummary,
    submitted: sessions.length > 0
  };
}

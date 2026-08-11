function safeText(value = '') {
  return String(value || '').trim();
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
    || report.weeklyGoal
  ) || '튜터 피드백 내용을 확인해 보세요.';
}

export function buildCoachingPresentation(reports = [], status = 'idle') {
  const source = Array.isArray(reports) ? reports.filter((report) => report?.weekId) : [];
  const sessions = source.map((report) => {
    const feedbackReady = hasSubmittedCoachingFeedback(report);
    return {
      weekId: safeText(report.weekId),
      title: safeText(report.title) || formatCoachingWeekLabel(report.weekId),
      weekLabel: formatCoachingWeekLabel(report.weekId),
      dateLabel: formatCoachingDate(report.updatedAt || report.date),
      tutorName: safeText(report.tutorName) || 'SKY 튜터',
      feedbackReady,
      statusLabel: feedbackReady ? '피드백 도착' : '검토 대기'
    };
  });
  const feedback = source.filter(hasSubmittedCoachingFeedback).map((report) => ({
    weekId: safeText(report.weekId),
    title: formatCoachingWeekLabel(report.weekId),
    dateLabel: formatCoachingDate(report.updatedAt || report.date),
    tutorName: safeText(report.tutorName) || 'SKY 튜터',
    summary: feedbackSummary(report)
  }));

  return {
    feedback,
    feedbackReady: feedback.length > 0,
    isLoading: status === 'loading',
    latest: sessions[0] || null,
    sessions,
    submitted: sessions.length > 0
  };
}

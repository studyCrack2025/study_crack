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
  { number: '01', title: '나의 학습 상태 확인', description: '학습 프로필과 기초조사서, 저장한 성적을 함께 확인해요. 성향은 공부 방법을 찾는 참고 자료예요.', example: '평소 공부 습관과 어려운 과목을 남겨주세요.', visual: [{ icon: 'user', label: '학습 프로필' }, { icon: 'report', label: '조사서·성적' }] },
  { number: '02', title: '목표 대학과 현재 성적 비교', description: '선택한 시험 성적을 대학별 환산점수로 비교해 공부 방향을 살펴봐요. 분석 결과는 합격을 보장하지 않아요.', example: '목표 대학과 분석할 시험을 선택해 주세요.', visual: [{ icon: 'target', label: '목표 대학' }, { icon: 'chart', label: '성적 비교' }] },
  { number: '03', title: '실행하고 피드백 받기', description: '계획을 세워 공부하고, 주간 점검에 기록과 질문을 남겨요. 튜터 피드백으로 다음 주 계획을 다듬어요.', example: '이번 주 잘된 점과 다음 주 고민을 적어주세요.', visual: [{ icon: 'calendar', label: '계획·실행' }, { icon: 'chat', label: '튜터 피드백' }] }
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

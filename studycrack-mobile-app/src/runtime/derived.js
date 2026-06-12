// 런타임 derived view-model: 원시 state에서 화면 renderer가 기대하는 계산값을 파생.
// 모놀리식 App() 본문의 계산을 도메인별 순수 함수로 이식한다(로직 1:1 유지).

const PLANNER_VIEW_PALETTE = { 국어: '#8B5CF6', 수학: '#3B82F6', 영어: '#14B8A6', 탐구: '#F97316', 기타: '#64748B' };
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 플래너 화면 derived (원본 js/studycrack-mobile.js 플래너 계산 블록과 동일).
export function buildPlannerDerived(state = {}) {
  const { plannerItems = [], selectedDate = '14', plannerEditIndex = null } = state;

  const plannerWeekDates = Array.from({ length: 15 }, (_, idx) => {
    const day = Math.min(31, Math.max(1, Number(selectedDate) - 7 + idx));
    const weekday = WEEKDAY_LABELS[new Date(2024, 4, day).getDay()];
    return { day: String(day), weekday };
  });

  const selectedPlannerDate = selectedDate;

  const plannerItemsByDate = plannerItems.reduce((acc, item) => {
    const dateKey = item.date || '14';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const plannerViewItems = plannerItemsByDate[selectedPlannerDate] || [];
  const plannerViewMinutes = plannerViewItems.reduce((acc, item) => acc + (item.minutes || 0), 0);
  const plannerViewHour = Math.floor(plannerViewMinutes / 60);
  const plannerViewMinute = plannerViewMinutes % 60;

  const plannerViewSubjectMinutes = plannerViewItems.reduce((acc, item) => {
    const key = item.subject || '기타';
    acc[key] = (acc[key] || 0) + (item.minutes || 0);
    return acc;
  }, {});

  const plannerViewSubjectStats = Object.entries(plannerViewSubjectMinutes)
    .filter(([, minutes]) => minutes > 0)
    .map(([subject, minutes]) => ({
      subject,
      minutes,
      percent: plannerViewMinutes ? Math.round((minutes / plannerViewMinutes) * 100) : 0,
      color: PLANNER_VIEW_PALETTE[subject] || PLANNER_VIEW_PALETTE['기타']
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const plannerViewDonutGradient = plannerViewSubjectStats.length
    ? `conic-gradient(${plannerViewSubjectStats
        .map((item, idx) => {
          const start = plannerViewSubjectStats.slice(0, idx).reduce((sum, cur) => sum + cur.percent, 0);
          const end = Math.min(100, start + item.percent);
          return `${item.color} ${start}% ${end}%`;
        })
        .join(',')})`
    : 'conic-gradient(#E2E8F0 0 100%)';

  const plannerEditItem = plannerItems.find((item) => item.id === plannerEditIndex) || null;

  return {
    plannerWeekDates,
    selectedPlannerDate,
    plannerViewItems,
    plannerViewHour,
    plannerViewMinute,
    plannerViewSubjectStats,
    plannerViewDonutGradient,
    plannerEditItem
  };
}

// 도메인 derived 집계. 후속 단계에서 home/analysis derived를 같은 방식으로 추가한다.
export function buildDerivedContext(state = {}) {
  return {
    ...buildPlannerDerived(state)
  };
}

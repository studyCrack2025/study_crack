export const PLANNER_CATEGORY_OPTIONS = [
  {
    value: '국어',
    label: '국어',
    dot: 'kor',
    details: ['독서', '문학', '언매', '화작', '어휘', '모의고사', '오답']
  },
  {
    value: '수학',
    label: '수학',
    dot: 'math',
    details: ['공통', '수1', '수2', '미적', '확통', '기하', '모의고사', '오답']
  },
  {
    value: '영어',
    label: '영어',
    dot: 'eng',
    details: ['단어', '구문', '독해', '듣기', '모의고사', '오답']
  },
  {
    value: '탐구',
    label: '탐구',
    dot: 'sci',
    details: ['생1', '생2', '지1', '지2', '화1', '화2', '물1', '물2', '사탐', '오답']
  },
  {
    value: '기타',
    label: '기타',
    dot: 'etc',
    details: ['입시전략', '면접', '학교/학원', '휴식', '기타']
  }
];

export const PLANNER_ACTIVITY_OPTIONS = ['개념', '문제풀이', '오답', '인강', '복습', '실전', '멘토 피드백'];

export function dotForPlannerCategory(category = '') {
  return PLANNER_CATEGORY_OPTIONS.find((item) => item.value === category)?.dot || 'etc';
}

export function getPlannerDetails(category = '') {
  return PLANNER_CATEGORY_OPTIONS.find((item) => item.value === category)?.details || PLANNER_CATEGORY_OPTIONS[0].details;
}

export function timeToMinutes(value = '') {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesBetween(start = '', end = '') {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return 0;
  return endMinutes - startMinutes;
}

export function formatPlannerMinutes(minutes = 0) {
  const safe = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safe / 60);
  const min = safe % 60;
  if (hour && min) return `${hour}시간 ${min}분`;
  if (hour) return `${hour}시간`;
  return `${min}분`;
}

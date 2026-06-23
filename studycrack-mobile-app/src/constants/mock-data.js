export const DEFAULT_USER = { name: '', targetUniversity: '연세대학교 경영학과', plan: '' };

export const DEFAULT_SCORES = {
  korean: 82,
  math: 68,
  english: 77,
  inquiry1: 70,
  inquiry2: 66
};

export const DEFAULT_NOTIFICATIONS = {
  planner: true,
  weekly: true,
  report: true,
  billing: true
};

// 모바일 플래너/홈 "오늘"은 백엔드 없이 localStorage seed로 동작하는 로컬 데모다.
// 앵커를 런타임 현재 날짜로 두어 홈/플래너가 항상 오늘 기준으로 표시되게 한다(데모 seed도 오늘 일자로 키잉).
function computeTodayYmd(now = new Date()) {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}
export const FIXED_TODAY_DATE = computeTodayYmd();
const TODAY_DAY_OF_MONTH = String(new Date().getDate());
export const SCROLL_STORAGE_KEY = 'studycrack_scroll_positions_v1';

export const DEFAULT_PLANNER_ITEMS = [
  { id: 'pl-default-1', date: TODAY_DAY_OF_MONTH, subject: '수학', content: '개념 학습', start: '10:00', end: '12:00', minutes: 120, dot: 'math' },
  { id: 'pl-default-2', date: TODAY_DAY_OF_MONTH, subject: '영어', content: '독해 문제 풀이', start: '13:00', end: '14:30', minutes: 90, dot: 'eng' },
  { id: 'pl-default-3', date: TODAY_DAY_OF_MONTH, subject: '탐구', content: '실전문제', start: '15:00', end: '17:00', minutes: 120, dot: 'sci' },
  { id: 'pl-default-4', date: TODAY_DAY_OF_MONTH, subject: '수학', content: '오답 풀이', start: '19:00', end: '22:00', minutes: 180, dot: 'math' }
];

export const PRO_ELITE_REPORTS = [
  { week: '26년 4월 4주차', desc: '심화 집중 루트 + 과목별 우선순위', fileName: 'studycrack-pro-report-26-04-w4.pdf' },
  { week: '26년 4월 3주차', desc: '중간 점검 + 리밸런싱 전략', fileName: 'studycrack-pro-report-26-04-w3.pdf' },
  { week: '26년 4월 2주차', desc: '약점 보강 로드맵 + 실행 체크', fileName: 'studycrack-pro-report-26-04-w2.pdf' },
  { week: '26년 4월 1주차', desc: '실전 루틴 안정화 + 시간 배분', fileName: 'studycrack-pro-report-26-04-w1.pdf' },
  { week: '26년 3월 4주차', desc: '오답 패턴 정리 + 단원 회독', fileName: 'studycrack-pro-report-26-03-w4.pdf' },
  { week: '26년 3월 3주차', desc: '과목 밸런스 조정 + 약점 보강', fileName: 'studycrack-pro-report-26-03-w3.pdf' },
  { week: '26년 3월 2주차', desc: '모의고사 리커버리 + 집중 강화', fileName: 'studycrack-pro-report-26-03-w2.pdf' },
  { week: '26년 3월 1주차', desc: '기본기 리빌드 + 학습 체력 관리', fileName: 'studycrack-pro-report-26-03-w1.pdf' },
  { week: '26년 2월 4주차', desc: '개념 정착 로드맵 + 주간 점검', fileName: 'studycrack-pro-report-26-02-w4.pdf' }
];

export const SCORE_LABELS = {
  korean: '국어',
  math: '수학',
  english: '영어',
  inquiry1: '탐구1',
  inquiry2: '탐구2'
};

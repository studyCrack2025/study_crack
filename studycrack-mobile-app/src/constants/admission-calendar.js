// 수험 일정 캘린더 데이터/헬퍼.
// 공식 일정(수능·평가원 모평·교육청 학력평가·수시/정시 원서접수)은 교육부·평가원·대교협의
// 확정 일정만 반영한다. 확정 날짜 검증 전까지 공식 데이터는 비워 둔다(잘못된 날짜 노출 금지).
// 개인 일정만 우선 동작(Phase 5 결정). 공식 데이터는 확정 후 OFFICIAL_ADMISSION_EVENTS_BY_YEAR에 채운다.

// 카테고리 표시 규칙. 공식/개인 공용.
export const CALENDAR_CATEGORIES = {
  exam: { label: '시험', color: '#4c79ee', official: true },
  application: { label: '원서접수', color: '#E8590C', official: true },
  school: { label: '학력평가', color: '#2F9E44', official: true },
  personal: { label: '내 일정', color: '#7048E8', official: false }
};

export const PERSONAL_CALENDAR_CATEGORIES = ['exam', 'application', 'school', 'personal'];

export function getCalendarCategoryMeta(category) {
  return CALENDAR_CATEGORIES[category] || CALENDAR_CATEGORIES.personal;
}

// 연도별 공식 일정. 확정 일정만 채운다(현재 비어 있음 — 확정 날짜 확보 후 입력).
// 항목 형태: { id, title, date: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD', category }
// 2027학년도(2026년 시행) 확정 일정. 출처: 교육청/평가원/대교협 발표(사용자 제공).
// 카테고리: exam=평가원 모평·수능, school=교육청 학력평가, application=대입 수시/정시 일정.
export const OFFICIAL_ADMISSION_EVENTS_BY_YEAR = {
  2026: [
    { id: 'official-2026-mock-03', title: '3월 학력평가 (서울교육청)', date: '2026-03-24', category: 'school' },
    { id: 'official-2026-mock-05', title: '5월 학력평가 (경기교육청)', date: '2026-05-07', category: 'school' },
    { id: 'official-2026-mopyeong-06', title: '6월 모의평가 (평가원)', date: '2026-06-04', category: 'exam' },
    { id: 'official-2026-mock-07', title: '7월 학력평가 (인천교육청)', date: '2026-07-08', category: 'school' },
    { id: 'official-2026-mopyeong-09', title: '9월 모의평가 (평가원)', date: '2026-09-02', category: 'exam' },
    { id: 'official-2026-mock-10', title: '10월 학력평가 (서울교육청)', date: '2026-10-20', category: 'school' },
    { id: 'official-2026-suneung', title: '2027학년도 대학수학능력시험', date: '2026-11-19', category: 'exam' },
    { id: 'official-2026-susi-apply', title: '수시 원서 접수', date: '2026-09-07', endDate: '2026-09-11', category: 'application' },
    { id: 'official-2026-susi-eval', title: '수시 전형 기간', date: '2026-09-12', endDate: '2026-12-17', category: 'application' },
    { id: 'official-2026-susi-result', title: '수시 합격자 발표', date: '2026-12-18', category: 'application' },
    { id: 'official-2026-susi-charge', title: '수시 미등록 충원 등록 마감', date: '2026-12-30', category: 'application' }
  ],
  2027: [
    { id: 'official-2027-jeongsi-apply', title: '정시 원서 접수', date: '2027-01-04', endDate: '2027-01-07', category: 'application' },
    { id: 'official-2027-jeongsi-ga', title: '정시 가군 전형', date: '2027-01-11', endDate: '2027-01-17', category: 'application' },
    { id: 'official-2027-jeongsi-na', title: '정시 나군 전형', date: '2027-01-18', endDate: '2027-01-24', category: 'application' },
    { id: 'official-2027-jeongsi-da', title: '정시 다군 전형', date: '2027-01-25', endDate: '2027-01-31', category: 'application' },
    { id: 'official-2027-jeongsi-result', title: '정시 합격자 발표', date: '2027-02-05', category: 'application' },
    { id: 'official-2027-jeongsi-charge', title: '정시 미등록 충원 등록 마감', date: '2027-02-18', category: 'application' },
    { id: 'official-2027-extra', title: '추가 모집', date: '2027-02-19', endDate: '2027-02-26', category: 'application' }
  ]
};

// 해당 연도 + 인접 연도(원서접수가 연말~연초로 걸치는 경우 대비) 공식 일정.
export function getOfficialAdmissionEvents(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return [];
  const merged = [];
  [y - 1, y, y + 1].forEach((yr) => {
    const list = OFFICIAL_ADMISSION_EVENTS_BY_YEAR[yr];
    if (Array.isArray(list)) merged.push(...list);
  });
  return merged.map((event) => ({ ...event, source: 'official' }));
}

// 개인 일정 검증/정규화 규칙. 백엔드 도입 전 프론트 동등 검증.
export const PERSONAL_EVENT_LIMITS = {
  maxEvents: 100,
  titleMaxLength: 60,
  noteMaxLength: 300
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  // 2026-02-30 같은 비정상 날짜 차단(파싱 후 롤오버 검출).
  const [y, m, d] = value.split('-').map(Number);
  return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d;
}

// 개인 일정 한 건을 검증·정규화. 부적합 시 null.
export function normalizePersonalEvent(input = {}) {
  const title = String(input.title ?? '').trim().slice(0, PERSONAL_EVENT_LIMITS.titleMaxLength);
  if (!title) return null;
  if (!isValidIsoDate(input.date)) return null;
  const category = PERSONAL_CALENDAR_CATEGORIES.includes(input.category) ? input.category : 'personal';
  const endDate = isValidIsoDate(input.endDate) && input.endDate >= input.date ? input.endDate : undefined;
  const note = String(input.note ?? '').trim().slice(0, PERSONAL_EVENT_LIMITS.noteMaxLength) || undefined;
  const now = new Date().toISOString();
  return {
    id: String(input.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    title,
    date: input.date,
    ...(endDate ? { endDate } : {}),
    category,
    ...(note ? { note } : {}),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    source: 'personal'
  };
}

// 기간 일정(endDate) 포함, 특정 날짜(YYYY-MM-DD)에 걸치는 이벤트 여부.
export function eventCoversDate(event, ymd) {
  if (!event || !event.date) return false;
  const start = event.date;
  const end = event.endDate || event.date;
  return ymd >= start && ymd <= end;
}

// 7일 초과 장기 기간(예: 수시 전형기간 3개월)은 매일 점을 찍으면 그리드가 가려지므로
// 시작·종료일만 마킹한다. 단일/단기 기간은 전 구간을 마킹(선택일 목록은 eventCoversDate로 항상 노출).
const GRID_LONG_PERIOD_DAYS = 7;

export function eventMarksDateInGrid(event, ymd) {
  if (!event || !event.date) return false;
  const start = event.date;
  const end = event.endDate || event.date;
  if (ymd < start || ymd > end) return false;
  const spanDays = Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000);
  if (spanDays > GRID_LONG_PERIOD_DAYS) return ymd === start || ymd === end;
  return true;
}

// 공식+개인 일정을 시작일 오름차순으로 병합(source는 각 항목에 보존).
export function mergeCalendarEvents(officialEvents = [], personalEvents = []) {
  const all = [
    ...(Array.isArray(officialEvents) ? officialEvents : []),
    ...(Array.isArray(personalEvents) ? personalEvents.map((e) => ({ ...e, source: 'personal' })) : [])
  ];
  return all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// 오늘(todayYmd) 이후 가장 가까운 일정. 진행 중 기간 일정도 포함. 없으면 null.
export function getNearestUpcomingEvent(events = [], todayYmd) {
  if (!Array.isArray(events) || !todayYmd) return null;
  const upcoming = events
    .filter((e) => e && e.date && (e.endDate || e.date) >= todayYmd)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return upcoming[0] || null;
}

// D-day 계산. 오늘이면 0(D-DAY), 미래면 양수, 진행 중 기간이면 0 이하로 보지 않고 시작일 기준.
export function computeDday(targetYmd, todayYmd) {
  if (!isValidIsoDate(targetYmd) || !isValidIsoDate(todayYmd)) return null;
  const target = new Date(`${targetYmd}T00:00:00`);
  const today = new Date(`${todayYmd}T00:00:00`);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

export function formatDdayLabel(targetYmd, todayYmd) {
  const diff = computeDday(targetYmd, todayYmd);
  if (diff === null) return '';
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

export function formatCompactCalendarTitle(event = {}) {
  const title = String(event.title || '').trim();
  if (!title) return '다가오는 일정';
  if (title.includes('대학수학능력시험')) return '수능';
  return title
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^\d{4}학년도\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

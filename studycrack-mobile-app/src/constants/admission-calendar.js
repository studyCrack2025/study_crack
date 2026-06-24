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
export const OFFICIAL_ADMISSION_EVENTS_BY_YEAR = {};

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
    updatedAt: now,
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

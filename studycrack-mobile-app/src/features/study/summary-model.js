import { isRecord } from '../../shared/model/contracts.js';

function isSummarySubject(value) {
  return isRecord(value) && typeof value.subject === 'string' && Number.isFinite(Number(value.seconds));
}

function isSummarySession(value) {
  return isRecord(value) && typeof value.subject === 'string' && typeof value.activity === 'string'
    && Number.isFinite(Number(value.durationSeconds)) && typeof value.startedAt === 'string' && typeof value.endedAt === 'string';
}

function isSummaryDay(value) {
  return isRecord(value) && /^\d{4}-\d{2}-\d{2}$/.test(String(value.date || ''))
    && Number.isFinite(Number(value.totalSeconds)) && Number.isFinite(Number(value.sessionCount))
    && Array.isArray(value.subjects) && value.subjects.every(isSummarySubject)
    && (value.sessions === undefined || (Array.isArray(value.sessions) && value.sessions.every(isSummarySession)));
}

export function validateStudySummary(value) {
  const valid = isRecord(value) && typeof value.available === 'boolean' && isSummaryDay(value.today)
    && isRecord(value.week) && /^\d{4}-\d{2}-\d{2}$/.test(String(value.week.startDate || ''))
    && /^\d{4}-\d{2}-\d{2}$/.test(String(value.week.endDate || ''))
    && Number.isFinite(Number(value.week.totalSeconds)) && Number.isFinite(Number(value.week.sessionCount))
    && Array.isArray(value.week.subjects) && value.week.subjects.every(isSummarySubject)
    && Array.isArray(value.week.days) && value.week.days.length === 7 && value.week.days.every(isSummaryDay);
  return valid ? { ok: true, value } : { ok: false, error: '공부 요약 응답이 올바르지 않습니다.' };
}

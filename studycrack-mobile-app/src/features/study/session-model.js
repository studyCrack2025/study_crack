import { isRecord } from '../../shared/model/contracts.js';

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const SESSION_STATUSES = new Set(['running', 'completed']);

function result(ok, value, error = '') {
  return ok ? { ok: true, value } : { ok: false, error };
}

export function validateStudySessionId(value) {
  const sessionId = String(value || '').trim();
  return result(SESSION_ID_PATTERN.test(sessionId), sessionId, '공부 세션 식별자가 올바르지 않습니다.');
}

export function validateServerStudySession(value) {
  const sessionId = validateStudySessionId(value?.sessionId);
  const status = String(value?.status || '');
  const startedAt = new Date(value?.startedAt || '');
  const durationSeconds = value?.durationSeconds;
  const validDuration = durationSeconds === undefined
    || (Number.isInteger(Number(durationSeconds)) && Number(durationSeconds) >= 1);
  const valid = isRecord(value) && sessionId.ok && SESSION_STATUSES.has(status)
    && !Number.isNaN(startedAt.getTime()) && validDuration;
  return result(valid, value, '공부 세션 응답이 올바르지 않습니다.');
}

export function createStudySessionCandidate({ plannerItemId = '', sessionId, subject } = {}) {
  return {
    sessionId: String(sessionId || '').trim(),
    subject: String(subject || '').trim().slice(0, 30),
    plannerItemId: String(plannerItemId || '').trim().slice(0, 100),
    status: 'starting'
  };
}

export function normalizeStoredStudySession(value) {
  if (!isRecord(value)) return null;
  const sessionId = validateStudySessionId(value.sessionId);
  const subject = String(value.subject || '').trim();
  if (!sessionId.ok || !subject || !['starting', 'running'].includes(value.status)) return null;
  if (value.status === 'running' && Number.isNaN(new Date(value.startedAt || '').getTime())) return null;
  return {
    sessionId: sessionId.value,
    subject: subject.slice(0, 30),
    plannerItemId: String(value.plannerItemId || '').slice(0, 100),
    status: value.status,
    ...(value.startedAt ? { startedAt: value.startedAt } : {})
  };
}


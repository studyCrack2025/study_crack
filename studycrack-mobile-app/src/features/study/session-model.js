import { isRecord } from '../../shared/model/contracts.js';

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

export function validateStudySessionId(value) {
  const sessionId = String(value || '').trim();
  return SESSION_ID_PATTERN.test(sessionId) ? { ok: true, value: sessionId } : { ok: false, error: '공부 세션 식별자가 올바르지 않습니다.' };
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
    activity: String(value.activity || '').trim().slice(0, 80),
    plannerItemId: String(value.plannerItemId || '').slice(0, 100),
    status: value.status,
    ...(value.startedAt ? { startedAt: value.startedAt } : {})
  };
}

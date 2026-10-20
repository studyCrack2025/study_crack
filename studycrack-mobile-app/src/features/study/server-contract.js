import { isRecord } from '../../shared/model/contracts.js';
import { validateStudySessionId } from './session-model.js';

export function validateServerStudySession(value) {
  const started = Date.parse(value?.startedAt);
  const ended = Date.parse(value?.endedAt);
  const duration = value?.durationSeconds;
  const valid = isRecord(value) && validateStudySessionId(value.sessionId).ok
    && ['running', 'completed'].includes(value.status) && Number.isFinite(started)
    && (duration === undefined || (Number.isSafeInteger(duration) && duration >= 1 && duration <= 43200))
    && (value.status !== 'completed' || (duration !== undefined && Number.isFinite(ended) && ended >= started));
  return valid ? { ok: true, value } : { ok: false, error: '공부 세션 응답이 올바르지 않습니다.' };
}

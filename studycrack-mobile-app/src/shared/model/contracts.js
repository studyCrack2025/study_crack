/**
 * @typedef {{ tier: string, status: string, startDate?: string, endDate?: string }} Subscription
 * @typedef {{ role: string, name: string, computedTier: string, currentSubscription?: Subscription|null, quantitative?: Record<string, ExamScores>, targetUnivs?: Array<string|TargetSlot> }} User
 * @typedef {{ raw?: number, std?: number, pct?: number, grd?: number, opt?: string, name?: string }} SubjectScore
 * @typedef {{ kor?: SubjectScore, math?: SubjectScore, eng?: SubjectScore, hist?: SubjectScore, inq1?: SubjectScore, inq2?: SubjectScore }} ExamScores
 * @typedef {{ univ: string, major: string, converted_score: number, score_available?: boolean, status?: string }} AnalysisResult
 * @typedef {{ univ: string, major: string, date?: string|null }} TargetSlot
 * @typedef {{ id: string, date: string, subject: string, category?: string, detailSubject?: string, activityType?: string, memo?: string, start?: string, end?: string, minutes?: number }} PlannerItem
 * @typedef {{ sessionId: string, subject: string, durationSeconds: number, startedAt?: string, endedAt?: string }} StudySession
 * @typedef {{ notiId: string, title: string, body: string, type: string, isRead: boolean, createdAt: string }} Notification
 * @typedef {{ weekId: string, title: string, date: string, updatedAt: string, tutorName: string, tutorFeedback: Record<string, unknown>|null }} WeeklyReport
 * @typedef {{ ok: true, value: unknown }|{ ok: false, error: string }} ContractResult
 */

export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isText(value) {
  return typeof value === 'string';
}

function isOptionalText(value) {
  return value === undefined || value === null || isText(value);
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function contract(ok, value, error = '') {
  return ok ? { ok: true, value } : { ok: false, error };
}

/** @returns {ContractResult} */
export function validateSubscription(value) {
  if (value === undefined || value === null) return contract(true, value);
  return contract(
    isRecord(value) && isText(value.tier) && isText(value.status)
      && isOptionalText(value.startDate) && isOptionalText(value.endDate),
    value,
    '구독 정보 필드가 올바르지 않습니다.'
  );
}

/** @returns {ContractResult} */
export function validateExamScores(value) {
  if (!isRecord(value)) return contract(false, value, '성적 정보가 객체가 아닙니다.');
  const subjectKeys = ['kor', 'math', 'eng', 'hist', 'inq1', 'inq2'];
  const valid = subjectKeys.every((key) => value[key] === undefined || isRecord(value[key]));
  return contract(valid, value, '성적 과목 정보가 올바르지 않습니다.');
}

/** @returns {ContractResult} */
export function validateTargetSlot(value) {
  const valid = isRecord(value) && isText(value.univ) && isText(value.major)
    && Boolean(value.univ.trim()) && Boolean(value.major.trim()) && isOptionalText(value.date);
  return contract(valid, value, '지원 대학 정보가 올바르지 않습니다.');
}

/** @returns {ContractResult} */
export function validateUser(value) {
  if (!isRecord(value) || !isText(value.role) || !isText(value.name) || !isText(value.computedTier)) {
    return contract(false, value, '사용자 필수 필드가 올바르지 않습니다.');
  }
  const subscription = validateSubscription(value.currentSubscription);
  if (!subscription.ok) return subscription;
  if (value.quantitative !== undefined) {
    if (!isRecord(value.quantitative)) return contract(false, value, '사용자 성적 묶음이 올바르지 않습니다.');
    for (const exam of Object.values(value.quantitative)) {
      const scores = validateExamScores(exam);
      if (!scores.ok) return scores;
    }
  }
  if (value.targetUnivs !== undefined && !Array.isArray(value.targetUnivs)) {
    return contract(false, value, '지원 대학 목록이 배열이 아닙니다.');
  }
  return contract(true, value);
}

/** @returns {ContractResult} */
export function validateAnalysisResult(value) {
  const valid = isRecord(value) && isText(value.univ) && isText(value.major)
    && (isFiniteNumber(value.converted_score) || value.score_available === false);
  return contract(valid, value, '대학 환산점수 결과 필드가 올바르지 않습니다.');
}

/** @returns {ContractResult} */
export function validatePlannerItem(value) {
  const valid = isRecord(value) && isText(value.id) && isText(value.date)
    && isText(value.subject) && isOptionalText(value.category) && isOptionalText(value.detailSubject)
    && isOptionalText(value.activityType) && isOptionalText(value.memo) && isOptionalText(value.start)
    && isOptionalText(value.end) && (value.minutes === undefined || isFiniteNumber(value.minutes));
  return contract(valid, value, '플래너 항목 필드가 올바르지 않습니다.');
}

/** @returns {ContractResult} */
export function validateStudySession(value) {
  const valid = isRecord(value) && isText(value.sessionId) && Boolean(value.sessionId.trim())
    && isText(value.subject) && Boolean(value.subject.trim()) && isFiniteNumber(value.durationSeconds)
    && Number(value.durationSeconds) >= 1
    && isOptionalText(value.startedAt) && isOptionalText(value.endedAt);
  return contract(valid, value, '공부 세션 필드가 올바르지 않습니다.');
}

/** @returns {ContractResult} */
export function validateNotification(value) {
  const id = value?.notiId || value?.id;
  const valid = isRecord(value) && isText(id) && Boolean(id.trim())
    && isOptionalText(value.title) && isOptionalText(value.body)
    && isOptionalText(value.message) && isOptionalText(value.type) && isOptionalText(value.createdAt);
  return contract(valid, value, '알림 필드가 올바르지 않습니다.');
}

/** @returns {ContractResult} */
export function validateWeeklyReport(value) {
  const valid = isRecord(value) && isText(value.weekId) && Boolean(value.weekId.trim())
    && isOptionalText(value.title) && isOptionalText(value.date) && isOptionalText(value.updatedAt)
    && isOptionalText(value.tutorName) && (value.tutorFeedback === undefined || value.tutorFeedback === null || isRecord(value.tutorFeedback));
  return contract(valid, value, '주간 리포트 필드가 올바르지 않습니다.');
}

/**
 * @param {unknown} value
 * @param {(item: unknown) => ContractResult} validator
 * @param {string} label
 * @returns {ContractResult}
 */
export function validateModelList(value, validator, label = '목록') {
  if (!Array.isArray(value)) return contract(false, value, `${label} 응답이 배열이 아닙니다.`);
  for (const item of value) {
    const result = validator(item);
    if (!result.ok) return contract(false, value, `${label}: ${result.error}`);
  }
  return contract(true, value);
}

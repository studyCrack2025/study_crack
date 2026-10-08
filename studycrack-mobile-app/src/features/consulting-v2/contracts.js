export const CONSULTING_STATES = Object.freeze([
  'ONBOARDING', 'SURVEY_DRAFT', 'MATERIAL_REVIEW', 'SUPPLEMENT_REQUIRED', 'AVAILABILITY_REQUIRED', 'SCHEDULING',
  'WRITTEN_SESSION_BOOKED', 'WRITTEN_SESSION_COMPLETED', 'REPORT_GENERATING', 'REPORT_REVIEW', 'REPORT_SCHEDULED',
  'FINAL_CALL_SCHEDULING', 'FINAL_CALL_BOOKED', 'SERVICE_COMPLETED'
]);

const PROGRESS_KEYS = Object.freeze(['onboarding', 'survey', 'materials', 'written_consultation', 'report', 'final_call']);
const PROGRESS_STATUSES = Object.freeze(['upcoming', 'current', 'completed']);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

export function parseHomeResponse(body) {
  const value = body?.success === true && isRecord(body.data) ? body.data : null;
  if (!value || typeof value.available !== 'boolean') return null;
  if (!value.available) return Object.freeze({ available: false, workflowState: null, nextAction: null, nextDueAt: null, progress: [], session: null, report: null, alerts: [] });
  if (!CONSULTING_STATES.includes(value.workflowState) || (value.nextAction !== null && (typeof value.nextAction !== 'string' || value.nextAction.length > 80))) return null;
  if (value.nextDueAt !== null && !isIsoDate(value.nextDueAt)) return null;
  if (!Array.isArray(value.progress) || value.progress.length !== PROGRESS_KEYS.length) return null;
  const progress = value.progress.map((step, index) => {
    if (!isRecord(step) || step.step !== PROGRESS_KEYS[index] || !PROGRESS_STATUSES.includes(step.status)) return null;
    return Object.freeze({ step: step.step, status: step.status });
  });
  if (progress.some(step => !step) || value.session !== null || value.report !== null || !Array.isArray(value.alerts) || value.alerts.some(alert => typeof alert !== 'string' || alert.length > 120)) return null;
  return Object.freeze({
    available: true,
    workflowState: value.workflowState,
    nextAction: value.nextAction,
    nextDueAt: value.nextDueAt,
    progress: Object.freeze(progress),
    session: null,
    report: null,
    alerts: Object.freeze([...value.alerts])
  });
}

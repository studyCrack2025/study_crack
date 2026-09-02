import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import { apiFailure, apiInvalidResponse, apiSuccess, postJson, setApiAuthExpiredHandler } from '../src/shared/api/client.js';
import {
  ANALYSIS_REQUEST_TYPES,
  AUTH_REQUEST_TYPES,
  CONSULTING_FILE_REQUEST_TYPES,
  CONSULTING_REQUEST_TYPES,
  GAME_REQUEST_TYPES,
  NOTIFICATION_REQUEST_TYPES,
  PAYMENT_REQUEST_TYPES,
  REPORT_REQUEST_TYPES,
  SUPPORT_REQUEST_TYPES,
  USER_REQUEST_TYPES
} from '../src/shared/api/request-types.js';
import {
  validateAnalysisResult,
  validateExamScores,
  validateModelList,
  validateNotification,
  validatePlannerItem,
  validateSubscription,
  validateTargetSlot,
  validateUser,
  validateWeeklyReport
} from '../src/shared/model/contracts.js';
import { normalizeNotifications } from '../src/features/notifications/api.js';
import { fetchConsultingSurveyDraft, uploadConsultingScoreFile } from '../src/features/consulting/api.js';

const envelopeKeys = ['code', 'data', 'error', 'ok', 'status'];

function assertEnvelope(result) {
  assert.deepEqual(Object.keys(result).sort(), envelopeKeys);
  assert.equal(typeof result.ok, 'boolean');
  assert.equal(typeof result.error, 'string');
  assert.equal(typeof result.status, 'number');
  assert.equal(typeof result.code, 'string');
}

assertEnvelope(apiSuccess({ value: 1 }));
assertEnvelope(apiFailure('실패'));
const invalidResponse = apiInvalidResponse({ status: 200 }, '계약 오류');
assertEnvelope(invalidResponse);
assert.equal(invalidResponse.code, 'INVALID_RESPONSE');
assert.equal(invalidResponse.status, 200);

const modelContracts = [
  [validateSubscription, { tier: 'basic', status: 'active' }, { tier: 'basic' }],
  [validateExamScores, { kor: { raw: 80 }, eng: { grd: 2 } }, []],
  [validateTargetSlot, { univ: '연세대학교', major: '정치외교학과' }, { univ: '', major: '' }],
  [validateUser, { role: 'student', name: '테스트', computedTier: 'basic' }, { role: 'student', name: '테스트' }],
  [validateAnalysisResult, { univ: '연세대학교', major: '정치외교학과', converted_score: 120 }, { univ: '연세대학교', major: '정치외교학과' }],
  [validatePlannerItem, { id: 'pl-1', date: '2026-08-08', subject: '수학' }, { id: 'pl-1', subject: '수학' }],
  [validateNotification, { notiId: 'n-1', title: '알림', body: '내용' }, { title: '알림' }],
  [validateWeeklyReport, { weekId: '260801', title: '주간 점검' }, { title: '주간 점검' }]
];
for (const [validator, validValue, invalidValue] of modelContracts) {
  assert.equal(validator(validValue).ok, true, `${validator.name} must accept its public model.`);
  assert.equal(validator(invalidValue).ok, false, `${validator.name} must reject an invalid model.`);
}

const legacyNotifications = normalizeNotifications({ notifications: [
  { id: 'legacy-detail', title: '주간 점검', message: '주간 점검', detail: '이번 주 피드백이 도착했어요.', actionType: 'weekly_report' },
  { id: 'legacy-message-only', message: '새 알림이 도착했어요.' }
] });
assert.deepEqual(legacyNotifications[0], {
  notiId: 'legacy-detail',
  title: '주간 점검',
  body: '이번 주 피드백이 도착했어요.',
  type: 'weekly_report',
  isRead: false,
  createdAt: ''
});
assert.equal(legacyNotifications[1].title, '새 알림이 도착했어요.');
assert.equal(legacyNotifications[1].body, '');
assert.equal(validateModelList([{ notiId: 'n-1' }], validateNotification, '알림').ok, true);
assert.equal(validateModelList([{ title: '알림' }], validateNotification, '알림').ok, false);

const success = await postJson({
  apiFetch: async () => ({ ok: true, status: 201, json: async () => ({ saved: true }) }),
  url: '/test',
  payload: { type: 'test' }
});
assertEnvelope(success);
assert.deepEqual(success.data, { saved: true });
assert.equal(success.status, 201);

const controller = new AbortController();
let forwardedSignal = null;
await postJson({
  apiFetch: async (_url, options) => {
    forwardedSignal = options.signal;
    return { ok: true, status: 200, json: async () => ({}) };
  },
  url: '/signal-test',
  payload: { type: 'test' },
  signal: controller.signal
});
assert.equal(forwardedSignal, controller.signal);

let expiredResult = null;
const releaseAuthExpiredHandler = setApiAuthExpiredHandler((result) => {
  expiredResult = result;
});
const failure = await postJson({
  apiFetch: async () => ({ ok: false, status: 403, json: async () => ({ error: '만료', code: 'AUTH_EXPIRED' }) }),
  url: '/test',
  payload: { type: 'test' }
});
assertEnvelope(failure);
assert.equal(failure.code, 'AUTH_EXPIRED');
assert.equal(failure.status, 403);
assert.equal(expiredResult, failure);
releaseAuthExpiredHandler();

let consultingDraftPayload = null;
const consultingDraftResult = await fetchConsultingSurveyDraft({
  apiFetch: async (_url, options) => {
    consultingDraftPayload = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ success: true, data: { draft: null } }) };
  },
  caseId: 'CASE_123e4567-e89b-12d3-a456-426614174000',
  consultingApiUrl: '/api/consulting'
});
assert.equal(consultingDraftResult.ok, true);
assert.equal(consultingDraftPayload.type, CONSULTING_REQUEST_TYPES.GET_SURVEY_DRAFT);

const scoreDocument = new Blob(['%PDF-'], { type: 'application/pdf' });
Object.defineProperty(scoreDocument, 'name', { value: 'score.pdf' });
const consultingFileCalls = [];
const scoreUploadResult = await uploadConsultingScoreFile({
  apiFetch: async (_url, options) => {
    const payload = JSON.parse(options.body);
    consultingFileCalls.push(payload);
    if (payload.type === CONSULTING_FILE_REQUEST_TYPES.CREATE_SCORE_UPLOAD) return { ok: true, status: 200, json: async () => ({ success: true, data: { fileId: 'FILE_123e4567-e89b-12d3-a456-426614174001', uploadUrl: 'https://upload.example.test', fields: { key: 'private-key' } } }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { fileId: payload.data.fileId, status: 'quarantined' } }) };
  },
  caseId: 'CASE_123e4567-e89b-12d3-a456-426614174000',
  fetchImpl: async (_url, options) => ({ ok: options.body instanceof FormData, status: 204 }),
  file: scoreDocument,
  fileApiUrl: '/api/file'
});
assert.equal(scoreUploadResult.ok, true);
assert.deepEqual(consultingFileCalls.map((call) => call.type), [CONSULTING_FILE_REQUEST_TYPES.CREATE_SCORE_UPLOAD, CONSULTING_FILE_REQUEST_TYPES.COMPLETE_SCORE_UPLOAD]);
assert.equal(consultingFileCalls[0].data.fileName, 'score.pdf');

const apiModules = [
  'src/features/account/api.js',
  'src/features/analysis/api.js',
  'src/features/consulting/api.js',
  'src/features/gamification/api.js',
  'src/features/notifications/api.js',
  'src/features/planner/api.js',
  'src/features/reports/api.js',
  'src/features/session/api.js',
  'src/features/study/api.js',
  'src/features/support/api.js'
];
for (const path of apiModules) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.equal(/\bthrow\b/.test(source), false, `${path} must return the API envelope instead of throwing.`);
  assert.equal(/return\s+null\b/.test(source), false, `${path} must not encode API failure as null.`);
  assert.equal(/return\s+\[\]/.test(source), false, `${path} must not encode API failure as an empty list.`);
}

const requestTypeGroups = [
  USER_REQUEST_TYPES,
  ANALYSIS_REQUEST_TYPES,
  NOTIFICATION_REQUEST_TYPES,
  REPORT_REQUEST_TYPES,
  SUPPORT_REQUEST_TYPES,
  AUTH_REQUEST_TYPES,
  CONSULTING_REQUEST_TYPES,
  CONSULTING_FILE_REQUEST_TYPES,
  PAYMENT_REQUEST_TYPES,
  GAME_REQUEST_TYPES
];
const requestTypeValues = requestTypeGroups.flatMap((group) => Object.values(group));
assert.equal(new Set(requestTypeValues).size, requestTypeValues.length, 'Request type values must have one owner.');
const requestConsumers = [
  ...apiModules,
  'src/features/session/auth-service.js',
  'src/features/session/mobile-session-adapter.js'
];
for (const path of requestConsumers) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const requestType of requestTypeValues) {
    assert.equal(
      source.includes(`'${requestType}'`) || source.includes(`\"${requestType}\"`),
      false,
      `${path} must import the shared constant for ${requestType}.`
    );
  }
}

await assert.rejects(access(new URL('../src/runtime/persistence.js', import.meta.url)));

const runtimeMain = await readFile(new URL('../src/runtime/main.js', import.meta.url), 'utf8');
const resourceOrchestrator = await readFile(new URL('../src/app/use-mobile-resource-orchestrator.js', import.meta.url), 'utf8');
assert.equal(/\bfetch[A-Z][A-Za-z0-9]*\s*\(/.test(runtimeMain), false, 'runtime/main.js must not own domain fetch effects.');
for (const hookName of [
  'useSession',
  'useRankingResource',
  'useAdmissionCalendarResource',
  'useReportResources',
  'useSupportResource',
  'useNotificationResource',
  'useAnalysisResources',
  'useGameProfileResource'
]) {
  assert.match(resourceOrchestrator, new RegExp(`\\b${hookName}\\s*\\(`), `resource orchestrator must compose ${hookName}.`);
}

const cancellableResourceHooks = [
  'src/features/session/use-session.js',
  'src/features/account/use-admission-calendar-resource.js',
  'src/features/analysis/use-score-resources.js',
  'src/features/analysis/use-university-resources.js',
  'src/features/gamification/use-game-profile-resource.js',
  'src/features/notifications/use-notification-resource.js',
  'src/features/planner/use-ranking-resource.js',
  'src/features/reports/use-report-resources.js',
  'src/features/support/use-support-resource.js'
];
for (const path of cancellableResourceHooks) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(source, /AbortController/, `${path} must cancel obsolete requests.`);
  assert.match(source, /RequestRef|requestKeyRef|requestKey/, `${path} must reject stale responses.`);
}

console.log('domain API envelope and ownership contracts passed');

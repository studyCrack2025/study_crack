import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { claimStudyReward } from '../src/features/gamification/api.js';
import { hydrateStudyStorage } from '../src/features/study/storage.js';
import { createTimerHandlers } from '../src/handlers/timer-handlers.js';
import { buildTimerJourneyPresentation, defaultFormatMinutesLabel } from '../src/screens/timer/presentation.js';

const sharedApiSource = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');

function createStorage() {
  const values = new Map();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] || null,
    get length() { return values.size; },
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  };
}

function createProductionApiFetch(fetch) {
  const context = vm.createContext({
    CONFIG: { api: { admin: '/admin', auth: '/auth', file: '/file', payment: '/payment', report: '/report' } },
    IS_LOCAL: true,
    console: { error() {}, warn() {} },
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    window: {
      addEventListener() {},
      atob: (value) => Buffer.from(value, 'base64').toString('binary'),
      location: { pathname: '/studycrack-mobile.html', replace() {} }
    }
  });
  vm.runInContext(`${sharedApiSource}\nglobalThis.__apiFetch = apiFetch;`, context);
  return context.__apiFetch;
}

assert.equal(defaultFormatMinutesLabel(125), '2시간 5분');
assert.equal(defaultFormatMinutesLabel(60), '1시간');
assert.equal(defaultFormatMinutesLabel(5), '5분');

const running = buildTimerJourneyPresentation({
  activeStudySession: {
    sessionId: 'session-running-1234',
    subject: '수학',
    activity: '미적분 기출 20문제',
    startedAt: '2026-09-04T01:00:00.000Z',
    status: 'running'
  },
  timerPhase: 'running'
});
assert.equal(running.visible, true);
assert.equal(running.sessionState, 'running');
assert.equal(running.completionState, 'pending');
assert.equal(running.rewardState, 'pending');
assert.equal(running.title, '수학 공부를 이어서 기록 중이에요');
assert.equal(running.detail, '미적분 기출 20문제');

const completedSession = {
  sessionId: 'session-complete-1234',
  subject: '국어',
  activity: '독서 지문 분석',
  startedAt: '2026-09-04T01:00:00.000Z',
  endedAt: '2026-09-04T01:25:00.000Z',
  durationSeconds: 1500,
  status: 'completed'
};
const claiming = buildTimerJourneyPresentation({
  lastCompletedSession: completedSession,
  timerPhase: 'claiming-reward'
});
assert.equal(claiming.completionState, 'complete');
assert.equal(claiming.rewardState, 'active');
assert.equal(claiming.durationLabel, '00:25:00');
assert.equal(claiming.title, '국어 공부를 완료했어요');
assert.equal(claiming.detail, '독서 지문 분석');

const claimingBeforePipelineReturn = buildTimerJourneyPresentation({
  activeStudySession: { ...completedSession, status: 'running' },
  timerPhase: 'claiming-reward'
});
assert.equal(claimingBeforePipelineReturn.completionState, 'pending', 'An earlier reward must not complete a newly running session.');
assert.equal(claimingBeforePipelineReturn.rewardState, 'active');

const rewardPending = buildTimerJourneyPresentation({
  completionError: '보상 서버에 연결하지 못했습니다.',
  lastCompletedSession: completedSession,
  rewardPendingSessionId: completedSession.sessionId,
  timerPhase: 'recoverable-error'
});
assert.equal(rewardPending.completionState, 'complete', '보상 실패가 완료된 공부를 되돌리면 안 됩니다.');
assert.equal(rewardPending.rewardState, 'error');
assert.equal(rewardPending.retryAction, 'retryStudyReward');
assert.equal(rewardPending.retryLabel, '보상 다시 확인');

const completionFailure = buildTimerJourneyPresentation({
  activeStudySession: { ...completedSession, status: 'running' },
  completionError: '공부 완료를 확인하지 못했습니다.',
  timerPhase: 'recoverable-error'
});
assert.equal(completionFailure.completionState, 'error');
assert.equal(completionFailure.rewardState, 'pending');
assert.equal(completionFailure.retryAction, 'stopStudyTimer');
assert.equal(completionFailure.title, '공부 완료를 다시 확인해주세요');

const rewarded = buildTimerJourneyPresentation({
  lastCompletedSession: completedSession,
  rewardResult: { sessionId: completedSession.sessionId, shells: 2, food: 2 },
  timerPhase: 'rewarded'
});
assert.equal(rewarded.completionState, 'complete');
assert.equal(rewarded.rewardState, 'complete');
assert.equal(rewarded.hasReward, true);
assert.equal(rewarded.rewardTitle, '수조가 한 걸음 성장했어요');

const recoveredRewardWithoutSummary = buildTimerJourneyPresentation({
  rewardResult: { sessionId: completedSession.sessionId, shells: 2, food: 2 },
  timerPhase: 'rewarded'
});
assert.equal(recoveredRewardWithoutSummary.title, '공부를 완료했어요');
assert.equal(recoveredRewardWithoutSummary.hasCompletedSummary, false);

let replacementStartCalls = 0;
const pendingRewardHandlers = createTimerHandlers({
  document: { querySelector: () => ({ value: '새 공부' }) },
  operationLocksRef: { current: new Set() },
  rewardPendingSessionId: completedSession.sessionId,
  startStudySession: async () => { replacementStartCalls += 1; return { ok: true }; },
  studyStartDraft: { subject: '영어', activity: '새 공부', plannerItemId: '' },
  timerPhase: 'recoverable-error'
});
// Pending-only starts and queue preservation are exercised with the complete fixture below.

let runningReplacementStartCalls = 0;
const runningSessionHandlers = createTimerHandlers({
  activeStudySession: {
    sessionId: 'session-running-1234',
    subject: '수학',
    activity: '미적분',
    startedAt: '2026-09-04T01:00:00.000Z',
    status: 'running'
  },
  document: { querySelector: () => ({ value: '새 공부' }) },
  operationLocksRef: { current: new Set() },
  rewardPendingSessionId: '',
  setActivePlannerItemId() {},
  setActiveStudySession() {},
  setActiveStudySubject() {},
  setCompletionError() {},
  setLastCompletedSession() {},
  setRewardResult() {},
  setStudyStartDraft() {},
  setStudySubjectSheetOnlyPlanned() {},
  setStudySubjectSheetOpen() {},
  setStudyTimerRunning() {},
  setTimerPhase() {},
  startStudySession: async () => { runningReplacementStartCalls += 1; return { ok: true }; },
  studyStartDraft: { subject: '영어', activity: '새 공부', plannerItemId: 'plan-english' },
  studyTimerRunning: false,
  timerPhase: 'running'
});
assert.equal(await runningSessionHandlers.confirmStudyStart(), false);
assert.equal(runningReplacementStartCalls, 0, 'A running session must not be replaced through a planner start shortcut.');

const invalidPendingStorage = new Map([
  ['studyRewardPendingSessionId', JSON.stringify('bad id')]
]);
const invalidPendingHydration = hydrateStudyStorage({
  getItem: (key) => invalidPendingStorage.get(key) ?? null,
  setItem: (key, value) => invalidPendingStorage.set(key, value)
});
assert.equal(invalidPendingHydration.rewardPendingSessionId, '', 'Malformed pending reward IDs must not survive hydration.');
assert.equal(invalidPendingHydration.timerPhase, 'idle');

const rewardFailureCases = [
  {
    code: 'STUDY_SESSION_NOT_FOUND',
    error: '공부 세션을 찾을 수 없습니다.',
    expectedPhase: 'terminal-reward-error',
    label: '404 missing session',
    status: 404,
    terminal: true
  },
  {
    code: 'STUDY_SESSION_NOT_REWARDABLE',
    error: '보상할 수 없는 공부 세션입니다.',
    expectedPhase: 'terminal-reward-error',
    label: '409 non-rewardable session',
    status: 409,
    terminal: true
  },
  {
    code: 'GAME_PROFILE_CONFLICT',
    error: '보상 상태가 갱신되었습니다.',
    expectedPhase: 'recoverable-error',
    label: '409 retryable profile conflict',
    status: 409,
    terminal: false
  },
  {
    code: 'GAME_DISABLED',
    error: '게임 기능을 준비하고 있습니다.',
    expectedPhase: 'recoverable-error',
    label: '503 retryable service failure',
    status: 503,
    terminal: false
  }
];

let terminalRecovery = null;
for (const failure of rewardFailureCases) {
  let replacementStartCalls = 0;
  const apiFetch = createProductionApiFetch(async () => new Response(JSON.stringify({
    code: failure.code,
    error: failure.error
  }), {
    status: failure.status,
    headers: { 'Content-Type': 'application/json' }
  }));
  const context = {
    activeStudySession: null,
    apiResult: null,
    async claimCompletedStudyReward(sessionId) {
      this.apiResult = await claimStudyReward({ apiFetch, gameApiUrl: '/game', sessionId });
      return this.apiResult;
    },
    document: { querySelector: () => ({ value: '새 공부' }) },
    lastCompletedSession: completedSession,
    operationLocksRef: { current: new Set() },
    studyStorage: createStorage(),
    rewardPendingSessionId: completedSession.sessionId,
    rewardResult: null,
    setActivePlannerItemId() {},
    setActiveStudySession(value) { this.activeStudySession = value; },
    setActiveStudySubject() {},
    setCompletionError(value) { this.completionError = value; },
    setLastCompletedSession(value) { this.lastCompletedSession = value; },
    setRewardPendingSessionId(value) { this.rewardPendingSessionId = value; },
    setStudyRecovery(value) { this.studyRecovery = value; },
    setRewardRecoveryError(value) { this.rewardRecoveryError = value; },
    setRewardClaimingSessionId(value) { this.rewardClaimingSessionId = value; },
    setRewardResult(value) { this.rewardResult = value; },
    setStudyStartDraft() {},
    setStudySubjectSheetOnlyPlanned() {},
    setStudySubjectSheetOpen() {},
    setStudyTimerRunning() {},
    setStudyPanelMode(value) { this.studyPanelMode = value; },
    setTimerPhase(value) { this.timerPhase = value; },
    startStudySession: async () => {
      replacementStartCalls += 1;
      return { ok: true, data: { sessionId: 'session-next-1234', startedAt: '2026-09-04T02:00:00.000Z' } };
    },
    studyStartDraft: { subject: '영어', activity: '새 공부', plannerItemId: '' },
    timerPhase: 'recoverable-error'
  };
  const handlers = createTimerHandlers(context);
  assert.equal(await handlers.retryStudyReward(), true);
  assert.equal(context.apiResult.status, failure.status, `${failure.label} must retain the backend HTTP status through apiFetch and claimStudyReward.`);
  assert.equal(context.apiResult.code, failure.code, `${failure.label} must retain the backend code through apiFetch and claimStudyReward.`);
  assert.equal(context.timerPhase, failure.expectedPhase, `${failure.label} must reach the correct timer recovery classification.`);
  assert.equal(handlers.dismissRewardResult(), failure.terminal, `${failure.label} dismissibility must match its timer classification.`);
  if (failure.terminal && !terminalRecovery) terminalRecovery = { context, handlers, replacementStartCalls: () => replacementStartCalls };
  if (!failure.terminal) {
    assert.equal(context.rewardPendingSessionId, completedSession.sessionId, `${failure.label} dismissal attempts must retain the recovery key.`);
    assert.equal(context.lastCompletedSession, completedSession, `${failure.label} dismissal attempts must retain the completed-session summary.`);
    assert.equal(context.rewardRecoveryError, context.apiResult.error, `${failure.label} dismissal attempts must retain the recovery explanation independently of timer errors.`);
  }
}

assert.equal(terminalRecovery.context.rewardPendingSessionId, '', 'Discarding failed reward recovery must release the pending key.');
assert.equal(terminalRecovery.context.lastCompletedSession, null);
assert.equal(terminalRecovery.context.completionError, '');
assert.equal(terminalRecovery.context.timerPhase, 'idle');
assert.equal(terminalRecovery.context.studyPanelMode, '', 'Dismissal must restore the inline start action without a tab round trip.');
assert.equal(await terminalRecovery.handlers.confirmStudyStart(), true, 'A terminal reward rejection must not permanently block future study.');
assert.equal(terminalRecovery.replacementStartCalls(), 1);

let claimingRewardStartCalls = 0;
const claimingRewardContext = {
  activeStudySession: null,
  document: { querySelector: () => ({ value: '새 공부' }) },
  operationLocksRef: { current: new Set() },
  rewardPendingSessionId: '',
  setActiveStudySession(value) { this.activeStudySession = value; },
  setCompletionError() {},
  setLastCompletedSession() {},
  setRewardResult() {},
  setTimerPhase(value) { this.timerPhase = value; },
  setStudyPanelMode() {},
  setStudySubjectSheetOpen() {},
  startStudySession: async () => {
    claimingRewardStartCalls += 1;
    return { ok: false, error: 'This API call must be blocked.' };
  },
  studyStartDraft: { subject: '영어', activity: '새 공부', plannerItemId: '' },
  timerPhase: 'claiming-reward'
};
assert.equal(await createTimerHandlers(claimingRewardContext).confirmStudyStart(), true, 'An earlier reward request must not block a new study.');
assert.equal(claimingRewardStartCalls, 1);

const plannedItem = { id: 'plan-current-math', subject: '수학', content: '미적분 기출 20문제', done: false };
function plannedAction(id, attributes = {}) {
  const data = { 'data-study-item-id': id, ...attributes };
  return { actionEl: { getAttribute: name => data[name] ?? null } };
}
function createPlannedStudyFixture(overrides = {}) {
  const calls = { start: [], complete: [], live: [] };
  const ctx = {
    activeStudySession: null,
    canAccessBasic: false,
    canUsePersonalPlanner: true,
    document: { querySelector: () => ({ value: '추가한 학습 내용' }) },
    operationLocksRef: { current: new Set() },
    studyStorage: createStorage(),
    plannerItems: [plannedItem],
    rewardPendingSessionId: '',
    studyRecords: [],
    studySubjectRecords: [],
    studyTimerSecondsRef: { current: 9 },
    timerPhase: 'idle',
    todayPlannerItems: [plannedItem],
    startStudySession: async candidate => {
      calls.start.push({ ...candidate });
      return { ok: true, data: { sessionId: candidate.sessionId, startedAt: '2026-09-07T03:00:00Z' } };
    },
    startLiveStudyTimer: (...args) => calls.live.push(args),
    completeStudySession: async (sessionId) => {
      calls.complete.push(sessionId);
      return { ok: true, data: { sessionId, durationSeconds: 1500, endedAt: '2026-09-07T03:25:00Z' } };
    },
    claimCompletedStudyReward: async sessionId => ({ ok: true, data: { sessionId, durationSeconds: 1500, reward: { tickets: 0, creditedSeconds: 1500, ticketPolicyVersion: 'study-ticket-v1' }, profile: { ticketBalance: 0 } } })
  };
  for (const field of ['activeStudySession', 'activeStudySubject', 'activePlannerItemId', 'completionError', 'gameProfile', 'gameProfileStatus', 'gameProfileError', 'gameRefreshTick', 'lastCompletedSession', 'plannerItems', 'rewardPendingSessionId', 'rewardResult', 'studyRecovery', 'rewardRecoveryError', 'rewardClaimingSessionId', 'studyPanelMode', 'studyRecords', 'studyStartDraft', 'studySubjectRecords', 'studySubjectSheetOpen', 'studySubjectSheetOnlyPlanned', 'studySummaryRefreshTick', 'studyTimerRunning', 'studyTimerTick', 'timerPhase']) {
    ctx[`set${field[0].toUpperCase()}${field.slice(1)}`] = value => { ctx[field] = typeof value === 'function' ? value(ctx[field]) : value; };
  }
  Object.assign(ctx, overrides);
  return { ctx, calls, handlers: createTimerHandlers(ctx) };
}

const directPlanned = createPlannedStudyFixture();
assert.equal(await directPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id, { 'data-study-subject': '조작된 과목', 'data-study-activity': '조작된 내용' })), true);
assert.equal(directPlanned.calls.start.length, 1, 'A free account must start its current unfinished plan through the existing session API.');
assert.equal(directPlanned.calls.start[0].subject, plannedItem.subject, 'The shortcut must resolve the subject from current state, not DOM attributes.');
assert.equal(directPlanned.calls.start[0].activity, plannedItem.content, 'The shortcut must resolve the activity from current state, not DOM attributes.');
assert.equal(directPlanned.calls.start[0].plannerItemId, plannedItem.id);
assert.equal(directPlanned.calls.start[0].status, 'starting');
assert.equal(directPlanned.ctx.activeStudySession.status, 'running');
assert.equal(directPlanned.ctx.studyPanelMode, 'timer');
assert.equal(directPlanned.ctx.studySubjectSheetOpen, false);
assert.equal(directPlanned.ctx.studyTimerRunning, true);
assert.equal(directPlanned.ctx.timerPhase, 'running');
assert.equal(directPlanned.ctx.studyTimerSecondsRef.current, 0);
assert.equal(directPlanned.calls.live.length, 1);
assert.equal(await directPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id)), false, 'A second shortcut must not replace a running study session.');
assert.equal(directPlanned.calls.start.length, 1);
assert.equal(await directPlanned.handlers.stopStudyTimer(), true, 'The card completion action must keep the existing completion/reward pipeline.');
assert.deepEqual(directPlanned.calls.complete, [directPlanned.calls.start[0].sessionId]);
assert.equal(directPlanned.ctx.lastCompletedSession.plannerItemId, plannedItem.id);
assert.equal(directPlanned.ctx.lastCompletedSession.activity, plannedItem.content);
assert.equal(directPlanned.ctx.plannerItems[0].doneMinutes, 25);
assert.equal(directPlanned.ctx.plannerItems[0].done, false, 'Recorded minutes must not silently mark a planner task complete.');
assert.equal(directPlanned.ctx.rewardResult.sessionId, directPlanned.calls.start[0].sessionId);
assert.equal(directPlanned.ctx.activeStudySession, null);
assert.equal(directPlanned.ctx.timerPhase, 'rewarded');

for (const [label, overrides, id = plannedItem.id] of [
  ['missing identity', {}, ''],
  ['forged identity', {}, 'plan-forged-123'],
  ['another date outside today view', { plannerItems: [plannedItem, { ...plannedItem, id: 'plan-other-date' }] }, 'plan-other-date'],
  ['already complete', { todayPlannerItems: [{ ...plannedItem, done: true }] }],
  ['unavailable planner', { canUsePersonalPlanner: false }],
  ['active session', { activeStudySession: { sessionId: 'session-existing', status: 'running' } }],
  ['starting phase', { timerPhase: 'starting-session' }],
  ['completion phase', { timerPhase: 'settling-session' }]
]) {
  const fixture = createPlannedStudyFixture(overrides);
  assert.equal(await fixture.handlers.startPlannedStudy(plannedAction(id)), false, `${label} must block the shortcut.`);
  assert.equal(fixture.calls.start.length, 0, `${label} must not call the study API.`);
  assert.equal(fixture.ctx.studySubjectSheetOpen, undefined, `${label} must not open a replacement input form.`);
}

for (const overrides of [{ rewardPendingSessionId: 'session-pending' }, { timerPhase: 'claiming-reward' }]) {
  const fixture = createPlannedStudyFixture(overrides);
  assert.equal(await fixture.handlers.startPlannedStudy(plannedAction(plannedItem.id)), true);
  assert.equal(fixture.ctx.rewardPendingSessionId, overrides.rewardPendingSessionId || '');
}

const emptyPlanned = createPlannedStudyFixture({ todayPlannerItems: [{ ...plannedItem, content: '   ' }] });
assert.equal(await emptyPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id)), true);
assert.equal(emptyPlanned.calls.start.length, 0, 'A plan without activity must collect a description before starting.');
assert.equal(emptyPlanned.ctx.studySubjectSheetOpen, true);
assert.deepEqual(emptyPlanned.ctx.studyStartDraft, { subject: plannedItem.subject, activity: '', plannerItemId: plannedItem.id });
assert.equal(await emptyPlanned.handlers.confirmStudyStart(), true);
assert.equal(emptyPlanned.calls.start[0].plannerItemId, plannedItem.id, 'Input completion must preserve the selected plan identity.');
assert.equal(emptyPlanned.calls.start[0].activity, '추가한 학습 내용');

const boundedPlanned = createPlannedStudyFixture({ todayPlannerItems: [{ ...plannedItem, subject: ` ${'가'.repeat(40)} `, content: ` ${'나'.repeat(100)} ` }] });
await boundedPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id));
assert.equal(boundedPlanned.calls.start[0].subject, '가'.repeat(30));
assert.equal(boundedPlanned.calls.start[0].activity, '나'.repeat(80));

let releaseUncertainStart;
const waitingStart = createPlannedStudyFixture({
  studySubjectSheetOpen: true,
  startStudySession: candidate => new Promise(resolve => { releaseUncertainStart = () => resolve({ ok: false }); })
});
const waiting = waitingStart.handlers.startPlannedStudy(plannedAction(plannedItem.id));
assert.equal(waitingStart.ctx.studySubjectSheetOpen, true, 'Start input must remain open until the response is confirmed.');
const waitingId = waitingStart.ctx.activeStudySession.sessionId;
assert.equal(waitingStart.handlers.closeStudySubjectSheet({}), false, 'In-flight start must not be dismissed.');
assert.equal(waitingStart.handlers.selectStudySubject(plannedAction(plannedItem.id, { 'data-study-subject': '영어' })), false);
assert.equal(await waitingStart.handlers.retryStudyStart(), false, 'In-flight start must not fan out.');
releaseUncertainStart(); await waiting;
assert.equal(waitingStart.ctx.timerPhase, 'recoverable-error');
assert.equal(waitingStart.ctx.studySubjectSheetOpen, true);
assert.equal(waitingStart.handlers.closeStudySubjectSheet({}), true);
assert.equal(waitingStart.ctx.activeStudySession.sessionId, waitingId, 'Closing uncertain input must retain the same candidate.');
assert.equal(waitingStart.handlers.openStudySubjectSheet(), true);
assert.equal(waitingStart.ctx.activeStudySession.sessionId, waitingId);
waitingStart.ctx.startStudySession = async candidate => ({ ok: true, data: { sessionId: candidate.sessionId, status: 'completed', startedAt: '2026-09-07T03:00:00Z', endedAt: '2026-09-07T03:25:00Z', durationSeconds: 1500 } });
assert.equal(await waitingStart.handlers.retryStudyStart(), true);
assert.equal(waitingStart.ctx.activeStudySession, null, 'A restored completion must not start a fake running timer.');
assert.equal(waitingStart.ctx.lastCompletedSession.sessionId, waitingId);
assert.equal(waitingStart.ctx.studySubjectSheetOpen, false);
assert.equal(waitingStart.calls.live.length, 0);
assert.equal(waitingStart.ctx.studyRecovery.pending[0].sessionId, waitingId);

const thrownStart = createPlannedStudyFixture({ startStudySession: async () => { throw new Error('offline'); } });
assert.equal(await thrownStart.handlers.startPlannedStudy(plannedAction(plannedItem.id)), true);
assert.equal(thrownStart.ctx.timerPhase, 'recoverable-error');
assert.equal(thrownStart.ctx.activeStudySession.status, 'starting');
assert.equal(thrownStart.ctx.studySubjectSheetOpen, true);

const retryPlanned = createPlannedStudyFixture();
retryPlanned.ctx.startStudySession = async candidate => {
  retryPlanned.calls.start.push({ ...candidate });
  return retryPlanned.calls.start.length === 1 ? { ok: false, error: '잠시 후 다시 확인해주세요.' } : { ok: true, data: { startedAt: '2026-09-07T03:00:00Z' } };
};
assert.equal(await retryPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id)), true);
assert.equal(retryPlanned.ctx.timerPhase, 'recoverable-error');
assert.equal(retryPlanned.ctx.activeStudySession.status, 'starting');
assert.equal(await retryPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id)), false, 'A failed start must be retried by its existing candidate rather than a new shortcut.');
assert.equal(await retryPlanned.handlers.retryStudyStart(), true);
assert.equal(retryPlanned.calls.start.length, 2);
assert.deepEqual(retryPlanned.calls.start[1], retryPlanned.calls.start[0], 'Retry must preserve the exact session candidate and plan identity.');
assert.equal(retryPlanned.ctx.timerPhase, 'running');

let releaseStart;
const concurrentPlanned = createPlannedStudyFixture({ startStudySession: candidate => new Promise(resolve => { releaseStart = () => resolve({ ok: true, data: { startedAt: '2026-09-07T03:00:00Z' } }); }) });
const inFlightStart = concurrentPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id));
assert.equal(await concurrentPlanned.handlers.startPlannedStudy(plannedAction(plannedItem.id)), false, 'Repeated clicks during an in-flight start must not create another session.');
assert.equal(concurrentPlanned.ctx.operationLocksRef.current.size, 1);
releaseStart();
assert.equal(await inFlightStart, true);
assert.equal(concurrentPlanned.ctx.operationLocksRef.current.size, 0);

const homeOverview = {
  planner: { status: 'ready', total: 5, completed: 1, percent: 20, minutes: 120, date: '2026-09-07' },
  confirmed: { status: 'ready', seconds: 0, fresh: true, date: '2026-09-07' },
  live: { status: 'idle', seconds: 0 },
  timeGoal: { datesMatch: true, percent: 0 }
};

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true }
});
try {
  const [{ StudyJourneyPanel }, { TimerScreen }] = await Promise.all([
    vite.ssrLoadModule('/src/screens/timer/StudyGamificationPanels.jsx'),
    vite.ssrLoadModule('/src/screens/timer/TimerScreen.jsx')
  ]);
  const retryableMarkup = renderToStaticMarkup(StudyJourneyPanel({
    completionError: '보상 서버에 연결하지 못했습니다.',
    lastCompletedSession: completedSession,
    rewardPendingSessionId: completedSession.sessionId,
    timerPhase: 'recoverable-error'
  }));
  assert.match(retryableMarkup, /data-action="retryStudyReward"/, 'Retryable reward recovery must keep its retry control.');
  assert.doesNotMatch(retryableMarkup, /data-action="dismissRewardResult"/, 'Retryable reward recovery must not render a destructive dismissal.');

  const terminalMarkup = renderToStaticMarkup(StudyJourneyPanel({
    completionError: '공부 세션을 찾을 수 없습니다.',
    lastCompletedSession: completedSession,
    rewardPendingSessionId: completedSession.sessionId,
    timerPhase: 'terminal-reward-error'
  }));
  assert.match(terminalMarkup, /data-action="dismissRewardResult"/, 'Explicitly terminal reward failures must expose a recovery-dismiss control.');
  assert.match(terminalMarkup, /aria-describedby="timer-reward-dismiss-warning"/, 'Terminal recovery dismissal must be tied to its consequence warning.');
  assert.match(terminalMarkup, /id="timer-reward-dismiss-warning"/, 'Terminal recovery dismissal must explain its irreversible consequence accessibly.');

  const startBlockingCases = [
    ['active session', { activeStudySession: { ...completedSession, status: 'running' }, timerPhase: 'running' }],
    ['starting phase', { timerPhase: 'starting-session' }],
    ['completion phase', { timerPhase: 'settling-session' }]
  ];
  for (const [label, blockedState] of startBlockingCases) {
    const timerMarkup = renderToStaticMarkup(TimerScreen({
      studyPanelMode: 'timer',
      canAccessBasic: false,
      canUsePersonalPlanner: true,
      studyOverview: homeOverview,
      todayPlannerItems: [{ id: 'plan-math-1', subject: '수학', content: '미적분', minutes: 30, done: false }],
      todayPlannerTotalMinutes: 30,
      ...blockedState
    }));
    const entryControls = [...timerMarkup.matchAll(/<button\b[^>]*data-action="(?:selectStudySubject|openStudySubjectSheet)"[^>]*>/g)].map(([tag]) => tag);
    assert.equal(entryControls.length, 1, `${label} fixture must keep only the disabled planner row as a study-start entry.`);
    assert.equal(entryControls.every((tag) => tag.includes('disabled=""')), true, `${label} must disable every study-start entry control.`);
    assert.equal(entryControls.every((tag) => tag.includes('aria-describedby="timer-study-start-blocked"')), true, `${label} must connect every blocked start control to the shared explanation.`);
    assert.match(timerMarkup, /id="timer-study-start-blocked"/, `${label} must render the shared accessible explanation.`);
    assert.doesNotMatch(timerMarkup, /data-action="startPlannedStudy"/, `${label} must not offer a direct next-plan shortcut.`);
    assert.match(timerMarkup, /class="home-active-study" aria-expanded="true"/, `${label} must retain the expandable inline record control.`);
  }
  const homeMarkup = renderToStaticMarkup(TimerScreen({
    canAccessBasic: false,
    canUsePersonalPlanner: true,
    studyOverview: homeOverview,
    aquariumPresentation: { streakDays: 9 },
    todayPlannerItems: [{ ...plannedItem, id: 'plan-completed', done: true }, plannedItem, ...Array.from({ length: 3 }, (_, index) => ({ ...plannedItem, id: `plan-next-${index}` }))]
  }));
  const sections = ['timer-v2-brand-head', 'home-study-highlight', 'timer-v2-target-summary', 'timer-v2-plan sc-card', 'home-week-flow'].map(name => homeMarkup.indexOf(`class="${name}"`));
  assert.equal(sections.every(index => index >= 0), true);
  assert.deepEqual(sections, [...sections].sort((a, b) => a - b), 'Home hierarchy must put study actions first, target next, two-plan preview next, and week flow last.');
  assert.doesNotMatch(homeMarkup, /timer-v2-status-rail/, 'The dense status rail must not return.');
  assert.match(homeMarkup, /class="home-active-study" data-action="openStudySubjectSheet"/, 'Manual study must remain available within the learning card.');
  assert.match(homeMarkup, /data-action="startPlannedStudy" data-study-item-id="plan-current-math"/, 'Free accounts must get the first current unfinished plan shortcut.');
  const planPreview = homeMarkup.match(/<div class="timer-v2-plan-list">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.equal([...planPreview.matchAll(/data-action="selectStudySubject"/g)].length, 2, 'Home must show at most two unfinished tasks.');
  assert.doesNotMatch(planPreview, /plan-completed/, 'Completed rows belong in the full planner, not the compact preview.');
  assert.match(homeMarkup, /class="home-study-streak" data-action="openStreakSummary">연속 학습 9일/, 'Streak access belongs inside the learning card.');
  const unknownStreak = renderToStaticMarkup(TimerScreen({ studyOverview: homeOverview, aquariumPresentation: { streakDays: null } }));
  assert.match(unknownStreak, /연속 학습 확인 필요/, 'Unknown streak data must not look like a zero-day count.');
  assert.doesNotMatch(unknownStreak, /연속 학습 0일/);
} finally {
  await vite.close();
}

const [timerScreen, panels, screenContext, timerHandlers, timerStyles] = await Promise.all([
  readFile(new URL('../src/screens/timer/TimerScreen.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/timer/StudyGamificationPanels.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/screen-context.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/handlers/timer-handlers.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/timer.css', import.meta.url), 'utf8')
]);

assert.match(timerScreen, /<HomeDashboard/, 'Timer must delegate the home presentation.');
const dashboard = await readFile(new URL('../src/screens/timer/HomeDashboard.jsx', import.meta.url), 'utf8');
const sessionPanel = await readFile(new URL('../src/screens/timer/TimerSessionPanel.jsx', import.meta.url), 'utf8');
const inlineStudy = await readFile(new URL('../src/screens/timer/HomeStudyPanel.jsx', import.meta.url), 'utf8');
assert.match(inlineStudy, /<TimerSessionPanel/, 'The home inline owner must preserve the timer panel.');
assert.doesNotMatch(inlineStudy, /<Sheet|role="dialog"/, 'Study controls must not open a dialog.');
assert.match(sessionPanel, /<StudyJourneyPanel/, 'The timer panel must preserve the study journey owner.');
assert.match(timerScreen, /lastCompletedSession=\{lastCompletedSession\}/, 'Timer must pass the confirmed session summary to the journey.');
assert.match(timerScreen, /rewardPendingSessionId=\{rewardPendingSessionId\}/, 'Timer controls must observe an unresolved reward before another study can start.');
assert.match(panels, /buildTimerJourneyPresentation/, 'Study journey UI must consume the pure phase presentation.');
assert.match(panels, /공부 기록 · \{journeyStateLabel\(journey\.completionState\)\}/, 'The completion step must expose its current state in its accessible name.');
assert.match(panels, /성장 보상 · \{journeyStateLabel\(journey\.rewardState\)\}/, 'The reward step must expose its current state in its accessible name.');
assert.match(screenContext, /'lastCompletedSession'/, 'Timer screen context must expose its completed session.');
assert.match(timerHandlers, /setLastCompletedSession\(null\)/, 'Dismissing a reward must also dismiss its completed-session summary.');
assert.match(timerHandlers, /saveStudyRecovery/, 'Recovery changes must be durable before releasing a pointer.');
assert.match(timerHandlers, /pending\.filter/, 'Dismissing one terminal recovery must preserve other sessions.');
assert.match(timerStyles, /\.timer-journey-panel\{/, 'The timer journey must have one screen-owned visual rule.');
assert.match(timerStyles, /\.timer-journey-steps\{/, 'The completion and reward stages must be visibly distinct.');

console.log('Phase 2 timer tracer contracts passed: free planned/manual starts, current IDs, bounded inputs, duplicate/retry guards, inline hierarchy, and completion/reward pipeline.');

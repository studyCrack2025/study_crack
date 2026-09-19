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
assert.equal(claimingBeforePipelineReturn.completionState, 'complete', 'Reward claim phase starts only after the server confirms completion.');
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
assert.equal(await pendingRewardHandlers.confirmStudyStart(), false);
assert.equal(replacementStartCalls, 0, 'Pending reward recovery must finish before another session can replace its key.');

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
    rewardPendingSessionId: completedSession.sessionId,
    rewardResult: null,
    setActivePlannerItemId() {},
    setActiveStudySession(value) { this.activeStudySession = value; },
    setActiveStudySubject() {},
    setCompletionError(value) { this.completionError = value; },
    setLastCompletedSession(value) { this.lastCompletedSession = value; },
    setRewardPendingSessionId(value) { this.rewardPendingSessionId = value; },
    setRewardResult(value) { this.rewardResult = value; },
    setStudyStartDraft() {},
    setStudySubjectSheetOnlyPlanned() {},
    setStudySubjectSheetOpen() {},
    setStudyTimerRunning() {},
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
    assert.equal(context.completionError, context.apiResult.error, `${failure.label} dismissal attempts must retain the recovery explanation.`);
  }
}

assert.equal(terminalRecovery.context.rewardPendingSessionId, '', 'Discarding failed reward recovery must release the pending key.');
assert.equal(terminalRecovery.context.lastCompletedSession, null);
assert.equal(terminalRecovery.context.completionError, '');
assert.equal(terminalRecovery.context.timerPhase, 'idle');
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
  startStudySession: async () => {
    claimingRewardStartCalls += 1;
    return { ok: false, error: 'This API call must be blocked.' };
  },
  studyStartDraft: { subject: '영어', activity: '새 공부', plannerItemId: '' },
  timerPhase: 'claiming-reward'
};
assert.equal(await createTimerHandlers(claimingRewardContext).confirmStudyStart(), false, 'Claiming a reward must block direct handler-level study starts even without pending pointers.');
assert.equal(claimingRewardStartCalls, 0, 'A blocked claiming-reward start must not call the start-session API.');

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
    ['pending reward', { rewardPendingSessionId: completedSession.sessionId, timerPhase: 'recoverable-error' }],
    ['starting phase', { timerPhase: 'starting-session' }],
    ['completion phase', { timerPhase: 'settling-session' }],
    ['reward phase', { timerPhase: 'claiming-reward' }]
  ];
  for (const [label, blockedState] of startBlockingCases) {
    const timerMarkup = renderToStaticMarkup(TimerScreen({
      canAccessBasic: true,
      todayPlannerItems: [{ id: 'plan-math-1', subject: '수학', content: '미적분', minutes: 30, done: false }],
      todayPlannerTotalMinutes: 30,
      ...blockedState
    }));
    const entryControls = [...timerMarkup.matchAll(/<button\b[^>]*data-action="(?:selectStudySubject|openStudySubjectSheet)"[^>]*>/g)].map(([tag]) => tag);
    assert.equal(entryControls.length, 3, `${label} fixture must render the planner row, planner shortcut, and direct timer start.`);
    assert.equal(entryControls.every((tag) => tag.includes('disabled=""')), true, `${label} must disable every study-start entry control.`);
    assert.equal(entryControls.every((tag) => tag.includes('aria-describedby="timer-study-start-blocked"')), true, `${label} must connect every blocked start control to the shared explanation.`);
    assert.match(timerMarkup, /id="timer-study-start-blocked"/, `${label} must render the shared accessible explanation.`);
  }
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
assert.match(dashboard, /<TimerSessionPanel/, 'Home must render the timer panel.');
assert.match(sessionPanel, /<StudyJourneyPanel/, 'The timer panel must preserve the study journey owner.');
assert.match(timerScreen, /lastCompletedSession=\{lastCompletedSession\}/, 'Timer must pass the confirmed session summary to the journey.');
assert.match(timerScreen, /rewardPendingSessionId=\{rewardPendingSessionId\}/, 'Timer controls must observe an unresolved reward before another study can start.');
assert.match(panels, /buildTimerJourneyPresentation/, 'Study journey UI must consume the pure phase presentation.');
assert.match(panels, /공부 기록 · \{journeyStateLabel\(journey\.completionState\)\}/, 'The completion step must expose its current state in its accessible name.');
assert.match(panels, /성장 보상 · \{journeyStateLabel\(journey\.rewardState\)\}/, 'The reward step must expose its current state in its accessible name.');
assert.match(screenContext, /'lastCompletedSession'/, 'Timer screen context must expose its completed session.');
assert.match(timerHandlers, /setLastCompletedSession\(null\)/, 'Dismissing a reward must also dismiss its completed-session summary.');
assert.match(timerHandlers, /setRewardPendingSessionId\(''\)/, 'Dismissing failed reward recovery must release its pending key.');
assert.match(timerHandlers, /ctx\.rewardPendingSessionId/, 'An unresolved reward must block a new session from replacing its recovery key.');
assert.match(timerStyles, /\.timer-journey-panel\{/, 'The timer journey must have one screen-owned visual rule.');
assert.match(timerStyles, /\.timer-journey-steps\{/, 'The completion and reward stages must be visibly distinct.');

console.log('Phase 2 timer tracer contracts passed: running, completion summary, reward pending and reward success remain distinct.');

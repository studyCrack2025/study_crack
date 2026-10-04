import assert from 'node:assert/strict';
import { createTimerHandlers } from '../src/handlers/timer-handlers.js';
import { HANDLER_STATE_FIELDS } from '../src/state/handler-state-actions.js';
import { STORAGE_KEYS } from '../src/state/storage.js';
import { hydrateStudyStorage } from '../src/features/study/storage.js';
import { hydrateStudyRecovery } from '../src/features/study/recovery-storage.js';
import { studyDayPatch } from '../src/features/study/use-study-day-clock.js';
import { completeServerStudySession } from '../src/features/study/api.js';
import { buildStudyOverview } from '../src/features/study/overview-presentation.js';

const session = { sessionId: 'session-m2-first', subject: '국어', activity: '독서', status: 'running', startedAt: '2026-10-03T14:30:00Z' };
const completed = { ...session, status: 'completed', durationSeconds: 1800, endedAt: '2026-10-03T15:00:00Z' };
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
}
function fixture(overrides = {}) {
  const state = { activeStudySession: session, studyRecords: [], studySubjectRecords: [], plannerItems: [], studySummaryRefreshTick: 0,
    studyTimerRunning: true, timerPhase: 'running', operationLocksRef: { current: new Set() }, studyStorage: storage(),
    studyStartDraft: { subject: '수학' }, document: { querySelector: () => ({ value: '기출' }) },
    completeStudySession: async () => ({ ok: true, data: completed }),
    startStudySession: async candidate => ({ ok: true, data: { ...candidate, status: 'running', startedAt: '2026-10-03T15:01:00Z' } }),
    claimCompletedStudyReward: async id => ({ ok: true, data: { sessionId: id, durationSeconds: 1800, profile: { ticketBalance: 1 } } }),
    getStudyState: () => state, isCurrentProfile: () => true, ...overrides };
  for (const field of HANDLER_STATE_FIELDS.timer) state[`set${field[0].toUpperCase()}${field.slice(1)}`] = value => { state[field] = typeof value === 'function' ? value(state[field]) : value; };
  return { state, handlers: createTimerHandlers(state) };
}

let release;
const f = fixture({ claimCompletedStudyReward: () => new Promise(resolve => { release = resolve; }) });
const waiting = f.handlers.stopStudyTimer();
async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), 'The asynchronous operation must reach its expected boundary.');
}
await waitFor(() => typeof release === 'function');
assert.equal(f.state.activeStudySession, null, 'Completion must be visible while reward is still unanswered.');
assert.equal(f.state.lastCompletedSession.durationSeconds, 1800);
assert.equal(f.state.studySummaryRefreshTick, 1, 'Summary invalidation must not wait for the game API.');
assert.equal(f.state.studyRecords[0].studyTime, 1800);
assert.equal(f.state.studyRecovery.pending.length, 1);
assert.equal(await f.handlers.confirmStudyStart(), true, 'New study must start while a previous reward is unanswered.');
const nextId = f.state.activeStudySession.sessionId;
release({ ok: false, code: 'GAME_DISABLED' });
await waiting;
assert.equal(f.state.activeStudySession.sessionId, nextId);
assert.equal(f.state.timerPhase, 'running', 'Late reward failure must not change the new timer phase.');
assert.equal(f.state.studyTimerRunning, true);
assert.equal(f.state.studyRecovery.pending[0].sessionId, session.sessionId);
f.state.completeStudySession = async id => ({ ok: true, data: { ...completed, sessionId: id } });
f.state.claimCompletedStudyReward = async () => ({ ok: false, code: 'GAME_DISABLED' });
await f.handlers.stopStudyTimer();
assert.equal(f.state.studyRecovery.pending.length, 2, 'A second completion must not overwrite an earlier claim.');
assert.equal(f.state.studyRecords[0].studyTime, 3600);
const reloaded = { ...hydrateStudyStorage(f.state.studyStorage) };
Object.assign(reloaded, hydrateStudyRecovery(reloaded, f.state.studyStorage));
assert.equal(reloaded.studyRecovery.pending.length, 2);
assert.equal(reloaded.studyRecords[0].studyTime, 3600);

f.state.activeStudySession = { ...session, sessionId: nextId };
f.state.timerPhase = 'running';
await f.handlers.stopStudyTimer();
assert.equal(f.state.studyRecords[0].studyTime, 3600, 'alreadyCompleted recovery must not add minutes a second time.');
assert.equal(f.state.studyRecovery.pending.length, 2);
f.state.claimCompletedStudyReward = async id => ({ ok: true, data: { sessionId: id, profile: { ticketBalance: 1 } } });
await f.handlers.retryStudyReward();
assert.deepEqual(f.state.studyRecovery.pending.map(row => row.sessionId), [nextId], 'Retry must remove only the acknowledged receipt.');

const failed = fixture({ completeStudySession: async () => ({ ok: false }) });
await failed.handlers.stopStudyTimer();
assert.equal(failed.state.activeStudySession.sessionId, session.sessionId);
assert.equal(failed.state.studySummaryRefreshTick, 0);
assert.deepEqual(failed.state.studyRecords, []);
assert.equal(await failed.handlers.confirmStudyStart(), false);

const full = fixture({ activeStudySession: null, timerPhase: 'idle', studyRecovery: { pending: Array.from({ length: 100 }, (_, i) => ({ sessionId: `session-full-${i}`, status: 'pending' })), applied: [], records: null, subjects: null } });
assert.equal(await full.handlers.confirmStudyStart(), false);
assert.match(full.state.rewardRecoveryError, /복구/);
assert.equal(full.state.studyRecovery.pending.length, 100);

const disk = fixture();
disk.state.studyStorage.setItem = () => { throw new Error('quota'); };
await disk.handlers.stopStudyTimer();
assert.equal(disk.state.activeStudySession.sessionId, session.sessionId);
assert.deepEqual(disk.state.studyRecords, []);
assert.match(disk.state.rewardRecoveryError, /저장/);
assert.equal(disk.state.timerPhase, 'recoverable-error');
assert.equal(disk.state.studySummaryRefreshTick, 1, 'Confirmed server time must refresh even if local recovery storage fails.');

const terminal = fixture({ studyRecovery: { pending: [{ sessionId: 'session-terminal', status: 'terminal' }, { sessionId: 'session-retryable', status: 'pending' }], applied: [], records: null, subjects: null } });
terminal.handlers.dismissRewardResult({ actionEl: { getAttribute: key => key === 'data-dismiss-terminal' ? 'true' : null } });
assert.deepEqual(terminal.state.studyRecovery.pending.map(row => row.sessionId), ['session-retryable']);
assert.equal(terminal.state.activeStudySession.sessionId, session.sessionId);
assert.equal(terminal.state.timerPhase, 'running');

const previousBrowser = globalThis.window;
globalThis.window = { boundedClientRequest: async () => { throw new Error('module deadline'); } };
try {
  let completions = 0;
  const missingModule = fixture({ completeStudySession: async () => { completions += 1; } });
  await missingModule.handlers.stopStudyTimer();
  assert.equal(completions, 0);
  assert.equal(missingModule.state.activeStudySession.sessionId, session.sessionId);
  assert.equal(missingModule.state.studyTimerRunning, true);
  assert.equal(missingModule.state.timerPhase, 'recoverable-error');
} finally { if (previousBrowser === undefined) delete globalThis.window; else globalThis.window = previousBrowser; }

const malformed = storage();
malformed.setItem(STORAGE_KEYS.studyRecovery, '{bad');
assert.match(hydrateStudyRecovery({}, malformed).rewardRecoveryError, /읽지/);
assert.equal(malformed.getItem(STORAGE_KEYS.studyRecovery), '{bad', 'Corrupt evidence must never be overwritten during hydration.');
const corruptPending = fixture({ studyStorage: malformed, ...hydrateStudyRecovery({ rewardPendingSessionId: session.sessionId }, malformed) });
await corruptPending.handlers.retryStudyReward();
assert.equal(malformed.getItem(STORAGE_KEYS.studyRecovery), '{bad', 'Retry must not overwrite an unreadable recovery journal.');
const legacy = storage();
legacy.setItem(STORAGE_KEYS.rewardPendingSessionId, JSON.stringify(session.sessionId));
const legacyState = hydrateStudyStorage(legacy);
assert.equal(hydrateStudyRecovery(legacyState, legacy).studyRecovery.pending[0].sessionId, session.sessionId);

let completeLater;
const oldOwner = fixture({ completeStudySession: () => new Promise(resolve => { completeLater = resolve; }) });
const oldRequest = oldOwner.handlers.stopStudyTimer();
await waitFor(() => typeof completeLater === 'function');
oldOwner.state.isCurrentProfile = () => false;
completeLater({ ok: true, data: completed });
await oldRequest;
assert.deepEqual(oldOwner.state.studyRecords, []);
assert.equal(oldOwner.state.studyStorage.getItem(STORAGE_KEYS.studyRecovery), null);

let rewardLater;
const lateReward = fixture({ claimCompletedStudyReward: () => new Promise(resolve => { rewardLater = resolve; }) });
const lateRequest = lateReward.handlers.stopStudyTimer();
await waitFor(() => typeof rewardLater === 'function');
await lateReward.handlers.confirmStudyStart();
rewardLater({ ok: true, data: { sessionId: session.sessionId, profile: { ticketBalance: 2 }, reward: {} } });
await lateRequest;
assert.equal(lateReward.state.gameProfile.ticketBalance, 2);
assert.equal(lateReward.state.studyRecovery.pending.length, 0);
assert.equal(lateReward.state.rewardResult, null, 'A late old reward must not be presented as the new study result.');
assert.equal(lateReward.state.timerPhase, 'running');

const batching = fixture();
const beforeCompletion = { ...batching.state };
batching.state.getStudyState = () => beforeCompletion;
await batching.handlers.stopStudyTimer();
assert.equal(batching.state.rewardResult.sessionId, session.sessionId, 'A confirmed matching receipt must remain visible before React flushes the cleared active session.');

const mismatched = fixture({ claimCompletedStudyReward: async () => ({ ok: true, data: { sessionId: 'session-not-requested', profile: {} } }) });
await mismatched.handlers.stopStudyTimer();
assert.deepEqual(mismatched.state.studyRecovery.pending.map(row => row.sessionId), [session.sessionId], 'A mismatched server receipt cannot acknowledge or remove the requested recovery right.');
assert.equal(mismatched.state.rewardResult, undefined);

const dateState = { todayDate: '2026-10-03', studyKoreaDate: '2026-10-03', selectedDate: '2026-11-10', calendarSelectedDate: '2026-11-10', calendarMonthAnchor: '2026-11-01' };
const patch = studyDayPatch(dateState, new Date('2026-10-03T15:00:00Z'));
assert.equal(patch.studyKoreaDate, '2026-10-04');
assert.equal(patch.selectedDate, undefined);
assert.equal(patch.calendarMonthAnchor, undefined);
assert.equal(studyDayPatch({ ...dateState, ...patch }, new Date('2026-10-03T15:00:00Z')), null);

for (const invalid of [{ ...completed, sessionId: 'session-other-owner' }, { ...session }, { ...completed, endedAt: null }, { ...completed, durationSeconds: 0 }]) {
  const result = await completeServerStudySession({ sessionId: session.sessionId, userApiUrl: '/user', apiFetch: async () => ({ ok: true, json: async () => invalid }) });
  assert.equal(result.ok, false, 'Only an owned matching, fully completed response may update study time.');
}
const summary = { available: true, today: { date: '2026-10-04', totalSeconds: 1800 }, week: { startDate: '2026-09-28', endDate: '2026-10-04', totalSeconds: 1800 } };
for (const status of ['loading', 'error', 'unavailable']) {
  const view = buildStudyOverview({ studySummary: summary, studySummaryStatus: status });
  assert.equal(view.confirmed.seconds, 1800);
  assert.equal(view.confirmed.fresh, false);
}
console.log('M2 completion recovery passed: immediate completion/summary, parallel next study, durable multi-receipt migration, dedupe, storage/capacity guards, late-owner fences, date boundaries and strict responses.');

import assert from 'node:assert/strict';
import { buildStreakPresentation } from '../src/features/gamification/streak-presentation.js';
import { hasSeenIntro, markIntroSeen } from '../src/features/session/intro-storage.js';
import { createNavigationHandlers } from '../src/handlers/navigation-handlers.js';
import { createUserDataResetPatch } from '../src/features/session/user-state.js';

const now = new Date('2026-09-06T15:00:00Z');
const base = { habitatStatus: 'ready', gameProfileStatus: 'ready', gameProfile: { streakDays: 12 }, habitatDays: [
  { date: '2026-09-07', studySeconds: 1200, validStudyDay: true },
  { date: '2026-09-06', studySeconds: 300, validStudyDay: false },
  { date: '2026-09-05', studySeconds: 0, validStudyDay: false }
] };
const model = buildStreakPresentation(base, now);
assert.equal(model.endDate, '2026-09-07');
assert.equal(model.startDate, '2026-08-09');
assert.equal(model.days.length, 30);
assert.equal(model.leadingDays, 0);
assert.equal(model.streakDays, 12, 'streak must not be recalculated from partial day records');
assert.equal(model.unknownDays, 27);
assert.deepEqual(model.days.slice(-3).map(day => day.status), ['empty', 'recorded', 'valid']);
assert.equal(model.days.at(-1).today, true);
assert.equal(model.days.at(-1).minutes, 20);
const failed = buildStreakPresentation({ habitatStatus: 'error', gameProfileStatus: 'error' }, now);
assert.equal(failed.streakDays, null);
assert.ok(failed.days.every(day => day.status === 'unknown'));
const stale = buildStreakPresentation({ ...base, habitatStatus: 'error', gameProfileStatus: 'loading' }, now);
assert.equal(stale.stale, true);
assert.equal(stale.streakStale, true);
assert.equal(stale.days.at(-1).status, 'valid');
assert.equal(buildStreakPresentation({ ...base, gameProfile: { streakDays: 0 } }, now).streakDays, 0);
assert.ok(buildStreakPresentation({ ...base, habitatStatus: 'unavailable' }, now).days.every(day => day.status === 'unknown'));
const invalidRows = [...base.habitatDays, { ...base.habitatDays[0] }, { date: '2026-02-30', studySeconds: 9999, validStudyDay: true }, { date: '2026-09-08', studySeconds: 1000, validStudyDay: true }];
assert.equal(buildStreakPresentation({ ...base, habitatDays: invalidRows }, now).days.at(-1).status, 'unknown');
for (const row of [{ studySeconds: -1, validStudyDay: false }, { studySeconds: 1200 }, { studySeconds: 0, validStudyDay: true }]) {
  assert.equal(buildStreakPresentation({ ...base, habitatDays: [{ date: '2026-09-07', ...row }] }, now).days.at(-1).status, 'unknown');
}
const memory = new Map();
const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
assert.equal(hasSeenIntro(storage), false);
assert.equal(markIntroSeen(storage), true);
assert.equal(hasSeenIntro(storage), true);
assert.deepEqual([...memory.entries()], [['studycrackIntroSeen_v1', '1']]);
assert.equal(markIntroSeen({ setItem() { throw new Error(); } }), false);
assert.equal(hasSeenIntro({ getItem() { throw new Error(); } }), false);
let navigated = false;
assert.equal(createNavigationHandlers({ screen: 'ob1', goto: () => { navigated = true; } }).finishIntro(), false);
assert.equal(navigated, false, 'intro completion must not replace profile setup');
const reset = createUserDataResetPatch();
assert.equal(reset.gameProfile, null);
assert.deepEqual(reset.habitatDays, []);
assert.equal(reset.streakSummary.open, false);
console.log('Streak/intro contracts passed: unknown/zero/stale, KST dates, partial records, device-only intro and account reset.');

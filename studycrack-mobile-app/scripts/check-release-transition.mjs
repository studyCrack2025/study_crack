import assert from 'node:assert/strict';
import { withOperationLock } from '../src/shared/async/operation-lock.js';
import { createTimerOps } from '../src/shared/browser/timer-ops.js';
import { hydrateNavigationStorage } from '../src/runtime/navigation-storage.js';

const deferred = {};
deferred.promise = new Promise((resolve) => { deferred.resolve = resolve; });
const lockRef = { current: new Set() };
let executions = 0;
const first = withOperationLock(lockRef, 'reward:session-1', async () => {
  executions += 1;
  await deferred.promise;
  return 'granted';
});
const duplicate = await withOperationLock(lockRef, 'reward:session-1', async () => {
  executions += 1;
  return 'duplicated';
});
assert.equal(duplicate, false, '같은 작업의 동시 요청은 프론트에서 한 번만 통과해야 합니다.');
deferred.resolve();
assert.equal(await first, 'granted');
assert.equal(executions, 1);
assert.equal(lockRef.current.size, 0, '완료된 작업 잠금은 반드시 해제해야 합니다.');

let now = 100_000;
let scheduled = null;
const ticks = [];
const timer = createTimerOps({
  now: () => now,
  setInterval: (callback) => { scheduled = callback; return 1; },
  clearInterval: () => { scheduled = null; },
  document: { querySelectorAll: () => [] }
});
timer.startLiveStudyTimer(now - 5_000, (seconds) => ticks.push(seconds));
assert.equal(timer.studyTimerSecondsRef.current, 5);
now += 65_000;
assert.equal(timer.syncLiveStudyTimer(), 70, '백그라운드 복귀 시 시작 시각 기준으로 경과시간을 복원해야 합니다.');
scheduled?.();
assert.equal(ticks.at(-1), 70);
timer.stopLiveStudyTimer();
assert.equal(scheduled, null);

function memoryStorage(tab) {
  return { getItem: () => tab };
}
assert.equal(hydrateNavigationStorage(memoryStorage('home')).tab, 'analysis');
assert.equal(hydrateNavigationStorage(memoryStorage('my')).tab, 'timer');
assert.equal(hydrateNavigationStorage(memoryStorage('aquarium')).tab, 'aquarium');

console.log('release transition contracts passed');

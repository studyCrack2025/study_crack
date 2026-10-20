import assert from 'node:assert/strict';
import test from 'node:test';
import { runBoundedTasks } from '../bounded-tasks.mjs';

test('bounded tasks run every item once without exceeding the concurrency', async () => {
  let active = 0, peak = 0;
  const seen = [];
  await runBoundedTasks(Array.from({ length: 12 }, (_, i) => i), 4, async item => {
    active++; peak = Math.max(peak, active); seen.push(item);
    await new Promise(resolve => setImmediate(resolve));
    active--;
  });
  assert.equal(peak, 4); assert.equal(active, 0);
  assert.deepEqual(seen.sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i));
});

test('failure stops new work, drains started tasks and preserves the original error', async () => {
  const original = new Error('verification failed');
  const seen = [], settled = [];
  await assert.rejects(runBoundedTasks([0, 1, 2, 3, 4, 5], 2, async item => {
    seen.push(item);
    if (item === 0) throw original;
    await new Promise(resolve => setImmediate(resolve)); settled.push(item);
  }), error => error === original);
  assert.deepEqual(seen, [0, 1]); assert.deepEqual(settled, [1]);
});

test('empty input is valid and unbounded concurrency is rejected', async () => {
  await runBoundedTasks([], 4, () => { throw new Error('unexpected'); });
  for (const limit of [0, -1, 1.5, 9]) await assert.rejects(runBoundedTasks([], limit, () => {}));
});

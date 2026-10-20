import assert from 'node:assert/strict';

export async function runBoundedTasks(items, limit, task) {
  assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 8, 'Invalid task concurrency');
  let cursor = 0, failed = false, firstError;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try { await task(items[index], index); }
      catch (error) { if (!failed) firstError = error; failed = true; }
    }
  }));
  if (failed) throw firstError;
}

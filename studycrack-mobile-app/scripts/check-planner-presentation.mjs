import assert from 'node:assert/strict';
import { buildPlannerPresentation, formatPlannerDuration } from '../src/screens/planner/presentation.js';

const progress = buildPlannerPresentation([
  { minutes: 60, done: true },
  { minutes: 30, done: true },
  { minutes: 90, done: false }
]);
assert.equal(progress.totalCount, 3);
assert.equal(progress.completedCount, 2);
assert.equal(progress.totalMinutes, 180);
assert.equal(progress.completedMinutes, 90);
assert.equal(progress.progress, 50);
assert.equal(progress.totalDurationLabel, '3시간');
assert.equal(progress.completedDurationLabel, '1시간 30분');

const countFallback = buildPlannerPresentation([
  { minutes: 0, done: true },
  { minutes: 0, done: false }
]);
assert.equal(countFallback.progress, 50);
assert.equal(formatPlannerDuration(125), '2시간 5분');
assert.equal(buildPlannerPresentation([]).progress, 0);

console.log('planner-presentation contracts passed');

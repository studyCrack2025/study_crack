import assert from 'node:assert/strict';
import { buildMissionSubjectRows, getHomeScorePresentation } from '../src/screens/home/presentation.js';

const pending = getHomeScorePresentation({ score: 0, scoreStatus: 'pending' });
assert.equal(pending.scoreValue, '—');
assert.equal(pending.neededLabel, '—');

const belowCut = getHomeScorePresentation({ score: 44.5, scoreStatus: 'confirmed' });
assert.equal(belowCut.scoreValue, '44.5점');
assert.equal(belowCut.neededLabel, '+55.5점');

const atCut = getHomeScorePresentation({ score: 100, scoreStatus: 'confirmed' });
assert.equal(atCut.neededLabel, '도달');

const subjects = buildMissionSubjectRows(
  [
    { subject: '수학', minutes: 60 },
    { subject: '수학', minutes: 30 },
    { subject: '영어', minutes: 60 }
  ],
  { 수학: 2700, 영어: 3600 }
);
assert.deepEqual(subjects.map(({ subject, plannedMinutes, progress }) => ({ subject, plannedMinutes, progress })), [
  { subject: '수학', plannedMinutes: 90, progress: 50 },
  { subject: '영어', plannedMinutes: 60, progress: 100 }
]);

console.log('home-presentation contracts passed');

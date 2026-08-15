import assert from 'node:assert/strict';
import { buildCoachingPresentation, COACHING_PROCESS_STEPS, formatCoachingWeekLabel } from '../src/screens/coaching/presentation.js';

const presentation = buildCoachingPresentation([
  { weekId: '260704', date: '2026-07-27T09:00:00.000Z', tutorName: '김튜터', tutorFeedback: { submitted: true, tutorComment: '수학 복습 시간을 먼저 확보하세요.' } },
  { weekId: '260703', date: '2026-07-20T09:00:00.000Z' }
], 'ready');

assert.equal(presentation.sessions.length, 2);
assert.equal(presentation.feedback.length, 1);
assert.equal(presentation.feedbackReady, true);
assert.equal(presentation.submitted, true);
assert.equal(presentation.sessions[0].statusLabel, '피드백 도착');
assert.equal(presentation.feedback[0].summary, '수학 복습 시간을 먼저 확보하세요.');
assert.equal(presentation.statusSummary.title, '피드백 도착');
assert.equal(presentation.statusSummary.tone, 'ready');
assert.equal(formatCoachingWeekLabel('260704'), '2026년 7월 4주차');
assert.equal(buildCoachingPresentation([], 'loading').isLoading, true);
assert.equal(buildCoachingPresentation([], 'loading').statusSummary.tone, 'loading');
assert.deepEqual(COACHING_PROCESS_STEPS.map((step) => step.title), ['학습 성향 분석', '목표 대학 분석', '합격 설계']);
assert.equal(COACHING_PROCESS_STEPS[1].description, '대학별 환산점수');

console.log('coaching-presentation contracts passed');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCoachingPresentation, buildCoachingWeek, COACHING_PROCESS_STEPS, formatCoachingWeekLabel } from '../src/screens/coaching/presentation.js';

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

const plans = [{ date: '2026-09-07', minutes: 30 }, { date: '2026-09-13', minutes: 45 }, { date: '2026-09-14', minutes: 300 }, { date: '2026-09-08', minutes: Infinity }];
const week = buildCoachingWeek(plans, '2026-09-08');
assert.equal(week.start, '2026-09-07');
assert.equal(week.end, '2026-09-13');
assert.equal(week.total, 3);
assert.equal(week.minutes, 75);
assert.equal(week.days.length, 7);
assert.equal(buildCoachingWeek([], '2026-01-01').start, '2025-12-29');
assert.equal(buildCoachingWeek([], 'invalid').days.length, 0);
assert.equal(buildCoachingWeek([], '2026-02-30').days.length, 0);
assert.equal(buildCoachingWeek(null, '2026-09-08').total, 0);
assert.equal(buildCoachingPresentation([{ weekId: '260701' }, { weekId: '260702' }], 'ready').latest.weekId, '260702');
assert.equal(buildCoachingPresentation([{ weekId: '260901', weeklyGoal: '학생이 쓴 목표', tutorFeedback: { submitted: true } }], 'ready').feedback[0].summary, '튜터 피드백 내용을 확인해 보세요.');
const source = await readFile(new URL('../src/screens/coaching/CoachingScreen.jsx', import.meta.url), 'utf8');
assert.match(source, /<details className="coaching-process">/, '진행 설명은 기본 접힘 상태로 시작해야 합니다.');
const screen = source.slice(source.indexOf('export function CoachingScreen'));
const order = ['<CoachingHero', 'coaching-request-cta', 'className="coaching-history"', '<WeeklyPlanPreview', '<CoachingProcess', '<PlanComparison'].map(marker => screen.indexOf(marker));
assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])), '현재 상태와 신청이 설명보다 먼저 보여야 합니다.');
assert.match(screen, /presentation\.feedbackReady \? <button[^>]+data-target="weekly">받은 피드백 확인하기/);
assert.doesNotMatch(screen, /coaching-new-request/, '같은 신청 행동을 내역 아래에 반복하지 않습니다.');
const css = await readFile(new URL('../src/styles/screens/coaching.css', import.meta.url), 'utf8');
assert.match(css, /\.coaching-process-step small\{[^}]*font-size:var\(--sc-type-caption\)/);
assert.match(css, /\.coaching-process-list\{[^}]*grid-template-columns:minmax\(0,1fr\)/, '모바일의 진행 단계는 세로로 읽을 수 있어야 합니다.');
console.log('coaching-presentation contracts passed');

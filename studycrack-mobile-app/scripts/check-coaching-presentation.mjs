import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
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
assert.deepEqual(COACHING_PROCESS_STEPS.map((step) => step.title), ['나의 학습 상태 확인', '목표 대학과 현재 성적 비교', '실행하고 피드백 받기']);
assert.ok(COACHING_PROCESS_STEPS.every(step => step.visual.length === 2 && step.example));
assert.match(COACHING_PROCESS_STEPS[1].description, /합격을 보장하지/);

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
assert.match(source, /<button type="button" className="coaching-process" disabled=\{!onOpen\}/, '진행 안내는 별도 모달로 열립니다.');
assert.match(source, /event\.currentTarget\.focus\(\); onOpen\?\.\(\)/, '터치 브라우저에서도 모달 복귀 위치를 보존합니다.');
const screen = source.slice(source.indexOf('export function CoachingScreen'));
const order = ['<CoachingHero', 'coaching-request-cta', 'className="coaching-history"', '<WeeklyPlanPreview', '<CoachingProcess onOpen', '<PlanComparison'].map(marker => screen.indexOf(marker));
assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])), '현재 상태와 신청이 설명보다 먼저 보여야 합니다.');
assert.match(screen, /presentation\.feedbackReady \? <button[^>]+data-target="weekly">받은 피드백 확인하기/);
assert.doesNotMatch(screen, /coaching-new-request/, '같은 신청 행동을 내역 아래에 반복하지 않습니다.');
const css = await readFile(new URL('../src/styles/screens/coaching.css', import.meta.url), 'utf8');
assert.match(css, /\.coaching-guide-body\{[^}]*min-height:0;overflow-y:auto/);
assert.match(css, /\.coaching-guide-footer\{[^}]*flex:0 0 auto/);
console.log('coaching-presentation contracts passed');

const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
try {
  const { WeeklyPlanPreview } = await vite.ssrLoadModule('/src/screens/coaching/WeeklyPlanPreview.jsx');
  const { PlannerStorageContext } = await vite.ssrLoadModule('/src/features/planner/PlannerStorageContext.js');
  const render = (view, items = []) => renderToStaticMarkup(createElement(PlannerStorageContext.Provider, { value: { controller: { account: { getView: () => view, getItems: () => items } } } }, createElement(WeeklyPlanPreview, { detailed: true, plannerItems: [] })));
  const missing = render({ mode: 'account', verified: false, snapshot: null });
  assert.match(missing, /계정 계획 확인 필요/);
  assert.doesNotMatch(missing, /등록 0개|계획 0분|등록한 계획 없음/);
  const confirmed = render({ mode: 'account', verified: true, snapshot: { available: true } });
  assert.match(confirmed, /계정 계획/);
  assert.match(confirmed, /등록 0개 · 계획 0분/);
  assert.doesNotMatch(confirmed, /최신 확인 필요/);
  const device = render({ mode: 'device' });
  assert.match(device, /기기 계획/);
  assert.match(device, /등록 0개 · 계획 0분/);
  const stale = render({ mode: 'account', verified: false, snapshot: { available: true } });
  assert.match(stale, /최신 확인 필요/);
  console.log('weekly preview source and unavailable-state contracts passed');
} finally { await vite.close(); }

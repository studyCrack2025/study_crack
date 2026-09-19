import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildPlannerOverview, buildStudyOverview } from '../src/features/study/overview-presentation.js';
import { buildAppPresentations } from '../src/app/presentation-context.js';
import { TODAY_DATE } from '../src/constants/runtime-defaults.js';

const plans = Object.freeze([{ date: '2026-09-07', minutes: 30, done: true }, { date: '2026-09-07', minutes: 90, done: false }]);
const summary = Object.freeze({ available: true, today: { date: '2026-09-07', totalSeconds: 3600 }, week: { startDate: '2026-09-07', endDate: '2026-09-13', totalSeconds: 7200 } });
const input = { localDate: '2026-09-07', plannerItems: plans, studySummary: summary, studySummaryStatus: 'ready', liveSeconds: 120, studyTimerRunning: true, activeStudySession: { sessionId: 'session-123', status: 'running', startedAt: '2026-09-07T03:00:00Z' } };
const view = buildStudyOverview(input);
assert.equal(view.planner.percent, 50);
assert.equal(view.planner.completedMinutes, 30);
assert.equal(view.confirmed.seconds, 3600);
assert.equal(view.live.seconds, 120);
assert.equal(view.timeGoal.percent, 50);
assert.equal(view.week.seconds, 7200);
assert.ok(Object.isFrozen(view) && Object.isFrozen(view.planner) && Object.isFrozen(view.confirmed));
assert.equal(buildStudyOverview({ ...input, liveSeconds: 600 }).confirmed.seconds, 3600);
assert.equal(buildStudyOverview({ ...input, liveSeconds: 600 }).timeGoal.percent, 50);
assert.equal(buildStudyOverview({ ...input, studySummary: { ...summary, today: { ...summary.today, date: '2026-09-08' } } }).timeGoal.percent, null);
assert.equal(buildStudyOverview({ ...input, localDate: '2026-02-30' }).planner.status, 'unknown');
assert.equal(buildPlannerOverview([{ date: '2026-09-06' }, ...plans], '2026-09-07').status, 'date-mismatch');
assert.equal(buildPlannerOverview([], '2026-09-07').percent, null);
assert.equal(buildPlannerOverview([{ minutes: null }]).minutes, null);
for (const status of ['idle', 'loading', 'error', 'unavailable']) {
  const empty = buildStudyOverview({ ...input, studySummary: null, studySummaryStatus: status });
  assert.equal(empty.confirmed.seconds, null);
  assert.equal(empty.confirmed.status, status);
  assert.equal(empty.timeGoal.percent, null);
}
for (const status of ['loading', 'error']) {
  const stale = buildStudyOverview({ ...input, studySummaryStatus: status });
  assert.equal(stale.confirmed.seconds, 3600);
  assert.equal(stale.confirmed.fresh, false);
  assert.equal(stale.timeGoal.percent, null);
}
for (const seconds of [null, '', false, -1, Infinity, NaN]) {
  assert.equal(buildStudyOverview({ ...input, studySummary: { ...summary, today: { ...summary.today, totalSeconds: seconds } } }).confirmed.seconds, null);
}
const zero = buildStudyOverview({ ...input, studySummary: { ...summary, today: { ...summary.today, totalSeconds: 0 } } });
assert.equal(zero.confirmed.seconds, 0);
assert.equal(zero.timeGoal.percent, 0);
assert.equal(buildStudyOverview({ ...input, studySummary: { ...summary, available: false } }).confirmed.seconds, null);
assert.equal(buildStudyOverview({ ...input, studyTimerRunning: false }).live.seconds, null);
assert.equal(buildStudyOverview({ ...input, activeStudySession: null }).live.status, 'idle');
const context = buildAppPresentations({ state: input, derived: { todayPlannerItems: plans }, liveSeconds: 120 });
assert.equal(context.studyOverview.planner, context.aquariumPresentation.planner);
assert.equal(context.studyOverview.planner.date, TODAY_DATE);
assert.equal(buildAppPresentations({ state: {}, derived: {} }).studyOverview.planner.total, null);

const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
try {
  const { StudyOverviewCard } = await vite.ssrLoadModule('/src/components/StudyOverviewCard.jsx');
  const render = (overview, variant) => renderToStaticMarkup(createElement(StudyOverviewCard, { overview, variant }));
  for (const variant of ['card', 'inline']) {
    const markup = render(view, variant);
    assert.match(markup, /과제 50% 완료/);
    assert.match(markup, /01:00:00/);
    assert.match(markup, /00:02:00/);
    assert.match(markup, /진행 중 · 아직 미확정/);
    assert.equal((markup.match(/data-study-base-seconds="0"/g) || []).length, 1);
    assert.doesNotMatch(markup, /01:02:00/);
  }
  const error = buildStudyOverview({ ...input, studySummary: null, studySummaryStatus: 'error', activeStudySession: null });
  assert.match(render(error), /retryStudySummary/);
  assert.doesNotMatch(render(error), /00:00:00/);
  const empty = buildStudyOverview({ ...input, plannerItems: [] });
  const compactMarkup = overview => renderToStaticMarkup(createElement(StudyOverviewCard, { overview, compact: true }));
  const idle = buildStudyOverview({ ...input, activeStudySession: null, studyTimerRunning: false });
  assert.match(compactMarkup(idle), /<details class="sc-study-details"><summary>확정 공부 01:00:00 · 상세 기록<\/summary>/);
  assert.doesNotMatch(compactMarkup(idle), /<details[^>]*open/);
  assert.ok(compactMarkup(idle).indexOf('role="progressbar"') < compactMarkup(idle).indexOf('<details'));
  for (const attention of [view, error, { ...idle, confirmed: { ...idle.confirmed, fresh: false } }, { ...idle, timeGoal: { ...idle.timeGoal, datesMatch: false } }, { ...idle, planner: { ...idle.planner, status: 'date-mismatch' } }]) {
    assert.doesNotMatch(compactMarkup(attention), /<details|<summary/);
    assert.match(compactMarkup(attention), /sc-study-metrics/);
  }
  assert.doesNotMatch(render(idle), /<details/);
  assert.match(render(empty), /등록한 계획 없음/);
  assert.doesNotMatch(render(empty), /aria-valuenow/);
  assert.equal(render(undefined), '');
} finally {
  await vite.close();
}
console.log('Study overview: task counts, confirmed/live separation, local/server dates, empty/unknown/stale, shared context and card/inline SSR passed.');

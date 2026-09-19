import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
assert.equal(progress.progress, 67);
assert.equal(progress.totalDurationLabel, '3시간');
assert.equal(progress.completedDurationLabel, '1시간 30분');

const countFallback = buildPlannerPresentation([
  { minutes: 0, done: true },
  { minutes: 0, done: false }
]);
assert.equal(countFallback.progress, 50);
assert.equal(formatPlannerDuration(125), '2시간 5분');
assert.equal(buildPlannerPresentation([]).progress, 0);

const plannerScreenSource = await readFile(new URL('../src/screens/planner/PlannerScreen.jsx', import.meta.url), 'utf8');
const progressIndex = plannerScreenSource.indexOf('<PlannerProgress');
const tasksIndex = plannerScreenSource.indexOf('<section className="planner-tasks-section">');
const calendarIndex = plannerScreenSource.indexOf('<section className="planner-calendar-section">');
assert.ok(progressIndex >= 0 && tasksIndex > progressIndex, '플래너 진행률 뒤에 오늘 계획이 배치되어야 합니다.');
assert.ok(calendarIndex > tasksIndex, '다른 날짜 달력은 오늘 계획 뒤의 보조 탐색 영역이어야 합니다.');
assert.match(plannerScreenSource, /setPlannerCalendarMode/, '기존 주·월 달력 전환을 유지해야 합니다.');
assert.match(plannerScreenSource, /openPlannerAddPage/, '기존 단계형 계획 추가 진입을 유지해야 합니다.');
assert.match(plannerScreenSource, /overlayOpen=\{plannerOverlayOpen\}/, '플래너 overlay가 실제 열린 상태에서만 스크롤을 잠가야 합니다.');
assert.match(plannerScreenSource, /className="planner-add-icon"/, '계획 추가 icon command는 전용 class를 사용해야 합니다.');
assert.match(plannerScreenSource, /className="planner-admission-trigger"/, '수험 일정 text CTA는 icon command와 selector를 공유하면 안 됩니다.');

console.log('planner-presentation contracts passed');

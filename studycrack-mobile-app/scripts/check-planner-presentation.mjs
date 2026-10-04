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
const calendarIndex = plannerScreenSource.indexOf('<AdmissionCalendar');
const calendarScreenSource = await readFile(new URL('../src/screens/planner/AdmissionCalendar.jsx', import.meta.url), 'utf8');
assert.ok(progressIndex >= 0 && tasksIndex > progressIndex, '플래너 진행률 뒤에 오늘 계획이 배치되어야 합니다.');
assert.ok(calendarIndex >= 0 && calendarIndex < progressIndex, '일정 달력은 진행률과 계획보다 먼저 표시합니다.');
assert.match(calendarScreenSource, /setPlannerCalendarMode/, '기존 주·월 달력 전환을 유지해야 합니다.');
assert.match(plannerScreenSource, /openPlannerAddPage/, '기존 단계형 계획 추가 진입을 유지해야 합니다.');
assert.match(plannerScreenSource, /overlayOpen=\{plannerOverlayOpen\}/, '플래너 overlay가 실제 열린 상태에서만 스크롤을 잠가야 합니다.');
assert.match(plannerScreenSource, /className="planner-add-icon"/, '계획 추가 icon command는 전용 class를 사용해야 합니다.');
assert.match(calendarScreenSource, /planner-admission-trigger/, '수험 일정 text CTA는 icon command와 selector를 공유하면 안 됩니다.');
assert.match(plannerScreenSource, /canAccessStandard \? 'weekly' : 'proIntro'/, '무료 개인 플래너와 유료 튜터 피드백 진입을 구분해야 합니다.');
assert.match(plannerScreenSource, /개인 플래너는 무료로 이용해요/, '무료 개인 작성 기능을 명확히 안내해야 합니다.');
assert.doesNotMatch(plannerScreenSource, /const detailLabel|<span>\{item\.minutes\}분<\/span>/, '목록에서는 상세 활동과 중복 시간을 반복하지 않습니다.');
assert.match(plannerScreenSource, /item\.accountPending \? <span className="planner-item-detail">서버 반영 대기/, '서버 반영 대기 상태는 목록에서도 보여야 합니다.');
const plannerCss = await readFile(new URL('../src/styles/screens/planner.css', import.meta.url), 'utf8');
assert.match(plannerCss, /\.planner-item-main b\{[^}]*font-size:var\(--sc-type-body\)[^}]*white-space:pre-wrap;overflow-wrap:anywhere;/);
assert.doesNotMatch(plannerCss, /planner-feedback-copy p\{display:none/, '작은 화면에서도 피드백 설명을 숨기지 않습니다.');

console.log('planner-presentation contracts passed');

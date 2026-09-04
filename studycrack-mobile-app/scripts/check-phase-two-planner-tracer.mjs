import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { APP_STATE_FIELD_KINDS } from '../src/runtime/app-state.js';
import { createCalendarHandlers } from '../src/handlers/calendar-handlers.js';
import { createFormHandlers } from '../src/handlers/form-handlers.js';
import { createPlannerHandlers } from '../src/handlers/planner-handlers.js';
import { nextPlannerCalendarMode } from '../src/screens/planner/presentation.js';

assert.equal(
  APP_STATE_FIELD_KINDS.plannerItems,
  'localDraft',
  'device-only planner items must remain local drafts, not server resources'
);
assert.equal(nextPlannerCalendarMode('week', 'ArrowRight'), 'month');
assert.equal(nextPlannerCalendarMode('month', 'ArrowLeft'), 'week');
assert.equal(nextPlannerCalendarMode('week', 'End'), 'month');
assert.equal(nextPlannerCalendarMode('month', 'Home'), 'week');
assert.equal(
  APP_STATE_FIELD_KINDS.activeStudySession,
  'localDraft',
  'the resumable client copy of a server-confirmed study session must remain distinct from planner drafts'
);
assert.equal(APP_STATE_FIELD_KINDS.calendarRefreshTick, undefined, 'calendar retry must not add persisted or server state');

const persistenceSource = await readFile(new URL('../src/app/use-app-state-persistence.js', import.meta.url), 'utf8');
const plannerScreenSource = await readFile(new URL('../src/screens/planner/PlannerScreen.jsx', import.meta.url), 'utf8');
const [plannerCss, plannerAddCss, plannerCalendarCss, sheetsCss] = await Promise.all([
  readFile(new URL('../src/styles/screens/planner.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/planner-add.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/planner-calendar.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/components/sheets.css', import.meta.url), 'utf8')
]);
assert.match(
  persistenceSource,
  /plannerSlice\.selectors\.localDraft\(rootState\)/,
  'planner persistence must read the local-draft partition'
);
assert.match(
  plannerScreenSource,
  /const currentMode = event\.target\.getAttribute\('data-planner-calendar-mode'\) \|\| activeMode;\s+const nextMode = nextPlannerCalendarMode\(currentMode, event\.key\);\s+if \(nextMode === currentMode\) return;/,
  'planner tab keyboard navigation must move from the focused tab, not the previously selected tab'
);
assert.match(plannerCss, /\.planner-add-icon\{[^}]*width:var\(--sc-touch-target\);[^}]*height:var\(--sc-touch-target\)/, 'planner add must have a 44px target');
assert.match(plannerCss, /\.planner-item-done,\.planner-item-remove\{[^}]*width:var\(--sc-touch-target\);[^}]*height:var\(--sc-touch-target\)/, 'planner row actions must have 44px targets');
assert.match(plannerAddCss, /\.planner-choice-chip span\{[^}]*min-height:var\(--sc-touch-target\)/, 'planner choice chips must have 44px targets');
assert.match(plannerCalendarCss, /\.planner-inline-segment button\{[^}]*height:var\(--sc-touch-target\)/, 'planner tabs must have 44px targets');
assert.match(plannerCalendarCss, /\.calendar-sheet-head \.qna-modal-close,\.calendar-form-head \.qna-modal-close\{[^}]*width:var\(--sc-touch-target\);[^}]*height:var\(--sc-touch-target\)/, 'planner calendar close controls must have 44px targets');
assert.match(plannerCalendarCss, /\.calendar-nav-btn\{[^}]*width:var\(--sc-touch-target\);[^}]*height:var\(--sc-touch-target\)/, 'planner calendar navigation must have 44px targets');
assert.match(plannerCalendarCss, /\.calendar-selected-head \.btn\{[^}]*min-height:var\(--sc-touch-target\)/, 'planner calendar add must have a 44px target');
assert.match(sheetsCss, /\.planner-sheet-close\{[^}]*width:var\(--sc-touch-target\);[^}]*height:var\(--sc-touch-target\)/, 'planner edit close must have a 44px target');

const plannerItem = {
  id: 'planner-local-1',
  date: '2026-09-04',
  subject: '국어',
  content: '독서 지문 분석',
  minutes: 30,
  start: '09:00',
  end: '09:30'
};

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true }
});
try {
  const [{ AdmissionCalendarSheet }, { PlannerScreen }, { TimerScreen }] = await Promise.all([
    vite.ssrLoadModule('/src/screens/planner/AdmissionCalendarSheet.jsx'),
    vite.ssrLoadModule('/src/screens/planner/PlannerScreen.jsx'),
    vite.ssrLoadModule('/src/screens/timer/TimerScreen.jsx')
  ]);
  const plannerMarkup = renderToStaticMarkup(PlannerScreen({
    plannerViewItems: [plannerItem],
    plannerWeekDates: [{ date: plannerItem.date, day: 4, weekday: '금' }],
    selectedPlannerDate: '4',
    selectedPlannerDateKey: plannerItem.date,
    selectedPlannerWeekday: '금',
    tab: 'planner'
  }));
  assert.doesNotMatch(plannerMarkup, /app-content modal-lock/, 'planner defaults must remain interactive when no overlay is open');
  assert.match(
    plannerMarkup,
    /계획은 이 기기에 저장되고, 공부 기록은 완료 확인 뒤 반영돼요\./,
    'planner must explain local plan storage separately from confirmed study records'
  );
  assert.match(plannerMarkup, /data-action="openPlannerAddPage"/, 'planner must keep the add route');
  assert.match(plannerMarkup, /data-action="openPlannerEdit"/, 'planner rows must keep edit entry');
  assert.match(plannerMarkup, /data-action="togglePlannerDone"/, 'planner rows must keep local completion');
  assert.match(plannerMarkup, /data-action="removePlannerItem"/, 'planner rows must keep delete');
  assert.match(plannerMarkup, /data-action="openCalendarSheet"/, 'planner must keep calendar entry');
  assert.match(plannerMarkup, /role="group" aria-label="달력 보기 방식"/, 'week/month mode must expose a labelled button group');
  assert.match(plannerMarkup, /<button(?=[^>]*data-planner-calendar-mode="week")(?=[^>]*aria-pressed="true")[^>]*>주</, 'active calendar mode must expose pressed state');
  assert.doesNotMatch(plannerMarkup, /role="(?:tablist|tab)"/, 'week/month buttons must not expose an incomplete tabs pattern');
  assert.match(plannerMarkup, /data-planner-date="2026-09-04"[^>]*aria-pressed="true"/, 'selected planner date must expose selection');

  const timerMarkup = renderToStaticMarkup(TimerScreen({
    canAccessBasic: true,
    tab: 'timer',
    todayPlannerItems: [plannerItem],
    todayPlannerTotalMinutes: 30
  }));
  assert.match(timerMarkup, /data-target="planner"/, 'timer preview must link to the full planner');
  assert.match(timerMarkup, /data-study-item-id="planner-local-1"/, 'timer planned start must carry the local planner identity');
  assert.match(timerMarkup, /data-action="selectStudySubject"/, 'timer planned start must enter the server study-session flow');

  const plannerEmptyMarkup = renderToStaticMarkup(PlannerScreen({ plannerEditIndex: null, tab: 'planner' }));
  assert.match(plannerEmptyMarkup, /아직 등록한 계획이 없어요/, 'an empty local planner must remain distinct from a load failure');

  const calendarLoadingMarkup = renderToStaticMarkup(AdmissionCalendarSheet({
    calendarSheetOpen: true,
    calendarSyncStatus: 'loading'
  }));
  assert.match(calendarLoadingMarkup, /role="dialog"/, 'calendar loading must remain in the accessible sheet');
  assert.match(calendarLoadingMarkup, /내 일정을 동기화하고 있어요\./, 'calendar loading must be explicit');

  const calendarErrorMarkup = renderToStaticMarkup(AdmissionCalendarSheet({
    calendarSheetOpen: true,
    calendarSyncStatus: 'error'
  }));
  assert.match(calendarErrorMarkup, /data-action="openCalendarSheet"[^>]*data-calendar-retry="true"[^>]*>다시 불러오기</, 'calendar errors must expose a retry-specific control');
} finally {
  await vite.close();
}

function input(value = '') {
  return { value, focus() {} };
}

const addFields = new Map([
  ['[data-field="plannerStartTime"]', input('09:00')],
  ['[data-field="plannerEndTime"]', input('09:30')],
  ['input[name="plannerCategory"]:checked', input('국어')],
  ['input[name="plannerDetailSubject"]:checked', input('독서')],
  ['input[name="plannerActivityType"]:checked', input('문제 풀이')],
  ['[data-field="plannerMemo"]', input('한글 메모')],
  ['[data-field="plannerContent"]', input('한글 조합 중')]
]);
const composedContentRef = { current: '' };
let composedSubmitDisabled = true;
const composedFormHandlers = createFormHandlers({
  document: {
    querySelector: (selector) => selector === '.planner-sheet-submit'
      ? { classList: { toggle() {} }, get disabled() { return composedSubmitDisabled; }, set disabled(value) { composedSubmitDisabled = value; } }
      : addFields.get(selector) || null
  },
  plannerContentRef: composedContentRef
});
const composedInput = addFields.get('[data-field="plannerContent"]');
composedInput.getAttribute = (name) => name === 'data-field' ? 'plannerContent' : null;
composedInput.hasAttribute = () => false;
assert.deepEqual(
  composedFormHandlers.handleInput({ nativeEvent: { isComposing: true }, target: composedInput }),
  { handled: true, field: 'plannerContent' }
);
assert.equal(composedContentRef.current, '한글 조합 중');
assert.equal(composedSubmitDisabled, true, 'Korean composition must not validate or submit a planner item');

let addedItems = [];
let addDestination = '';
const contentRef = { current: 'stale' };
const normalAddHandlers = createPlannerHandlers({
  document: { querySelector: (selector) => addFields.get(selector) || null },
  goto(target) { addDestination = target; },
  plannerContentRef: contentRef,
  plannerCustomMinutesRef: { current: '' },
  selectedPlannerDateKey: '2026-09-04',
  setPlannerDraft() {},
  setPlannerItems(updater) { addedItems = updater(addedItems); }
});
assert.equal(normalAddHandlers.addPlannerFromSheet(), true);
assert.equal(addedItems.length, 1, 'a valid planner draft must be added once');
assert.equal(addedItems[0].content, '한글 조합 중');
assert.equal(addedItems[0].date, '2026-09-04');
assert.equal(contentRef.current, '', 'the uncontrolled content draft must clear only after a successful add');
assert.equal(addDestination, 'planner');

const editFields = new Map([
  ['[data-field="plannerEditStart"]', input('10:00')],
  ['[data-field="plannerEditEnd"]', input('10:40')],
  ['[data-field="plannerEditSubject"]', input('수학')],
  ['[data-field="plannerEditDetailSubject"]', input('미적분')],
  ['[data-field="plannerEditActivityType"]', input('오답 정리')],
  ['[data-field="plannerEditContent"]', input('한글 수정 중')],
  ['[data-field="plannerEditMemo"]', input('복습')]
]);
let editedItems = [plannerItem];
let closedEditId = 'planner-local-1';
const normalEditHandlers = createPlannerHandlers({
  document: { querySelector: (selector) => editFields.get(selector) || null },
  plannerEditIndex: 'planner-local-1',
  plannerEditItem: plannerItem,
  setPlannerEditIndex(value) { closedEditId = value; },
  setPlannerItems(updater) { editedItems = updater(editedItems); }
});
assert.equal(normalEditHandlers.savePlannerEdit(), true);
assert.equal(editedItems[0].content, '한글 수정 중');
assert.equal(editedItems[0].minutes, 40);
assert.equal(closedEditId, null);

const itemAction = (id) => ({ getAttribute: (name) => name === 'data-planner-id' ? id : null });
assert.equal(normalEditHandlers.togglePlannerDone({ actionEl: itemAction('planner-local-1') }), true);
assert.equal(editedItems[0].done, true);
assert.equal(normalEditHandlers.removePlannerItem({ actionEl: itemAction('planner-local-1') }), true);
assert.deepEqual(editedItems, []);

let calendarStatus = 'error';
const calendarRetryHandlers = createCalendarHandlers({
  calendarSyncStatus: 'error',
  setCalendarSheetOpen() {},
  setCalendarSyncStatus(value) { calendarStatus = value; }
});
assert.equal(calendarRetryHandlers.openCalendarSheet(), true);
assert.equal(calendarStatus, 'error', 'opening the calendar must preserve a visible load error');
assert.equal(calendarRetryHandlers.openCalendarSheet({
  actionEl: { getAttribute: (name) => name === 'data-calendar-retry' ? 'true' : null }
}), true);
assert.equal(calendarStatus, 'idle', 'calendar retry must re-enable the existing resource without changing data');

const calendarFields = new Map([
  ['title', input('모의고사 준비')],
  ['date', input('2026-09-05')],
  ['endDate', input('')],
  ['category', input('personal')],
  ['note', input('준비물 확인')]
]);
let calendarRollbackMutations = 0;
const failedCalendarHandlers = createCalendarHandlers({
  apiFetch: async () => new Response(JSON.stringify({ error: 'temporary failure' }), { status: 500, headers: { 'Content-Type': 'application/json' } }),
  calendarEventEditId: null,
  calendarSaving: false,
  calendarSyncStatus: 'ready',
  confirm: () => true,
  document: { querySelector: (selector) => calendarFields.get(selector.match(/data-calendar-field="([^"]+)"/)?.[1]) || null },
  hasClientSession: () => true,
  personalEvents: [{ id: 'event-existing', title: '기존 일정', date: '2026-09-06', category: 'personal' }],
  setCalendarEventDraft() {},
  setCalendarEventEditId() {},
  setCalendarEventFormOpen() {},
  setCalendarSaving() {},
  setCalendarSelectedDate() {},
  setPersonalEvents() { calendarRollbackMutations += 1; },
  userApiUrl: '/api/user'
});
assert.equal(await failedCalendarHandlers.saveCalendarEvent(), true);
assert.equal(calendarRollbackMutations, 0, 'failed server calendar save must preserve the previous items');
assert.equal(await failedCalendarHandlers.deleteCalendarEvent({ actionEl: { getAttribute: (name) => name === 'data-event-id' ? 'event-existing' : null } }), true);
assert.equal(calendarRollbackMutations, 0, 'failed server calendar delete must preserve the previous items');

console.log('phase-two planner tracer contracts passed');

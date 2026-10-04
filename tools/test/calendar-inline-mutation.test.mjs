import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateCalendar } from '../../studycrack-mobile-app/src/features/account/calendar-mutation.js';
import { createCalendarHandlers } from '../../studycrack-mobile-app/src/handlers/calendar-handlers.js';
import { createPlannerHandlers } from '../../studycrack-mobile-app/src/handlers/planner-handlers.js';
import { buildCalendarDerived, buildPlannerDerived } from '../../studycrack-mobile-app/src/runtime/derived.js';
import { calendarSwipeDirection } from '../../studycrack-mobile-app/src/screens/planner/calendar-gesture.js';
import { createUserDataResetPatch } from '../../studycrack-mobile-app/src/features/session/user-state.js';
import { studyDayPatch } from '../../studycrack-mobile-app/src/features/study/use-study-day-clock.js';

const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function fixture(apiFetch) {
  const ctx = { calendarSupportsIdempotency: true, calendarSyncStatus: 'ready', calendarEventDraft: { title: '면접 준비', date: '2026-10-02', category: 'personal', note: '준비물' }, personalEvents: [], apiFetch, userApiUrl: '/api/user', hasClientSession: () => true, isCurrentProfile: () => true, confirm: () => true, operationLocksRef: { current: new Set() } };
  for (const field of ['calendarEventDraft', 'calendarEventEditId', 'calendarEventFormOpen', 'calendarMutationError', 'calendarMutationRecovery', 'calendarSaving', 'calendarSyncStatus', 'personalEvents', 'selectedDate']) ctx[`set${field[0].toUpperCase()}${field.slice(1)}`] = value => { ctx[field] = typeof value === 'function' ? value(ctx[field]) : value; };
  return ctx;
}

test('calendar and plans share one date including year, leap month and long events', () => {
  for (const selectedDate of ['2026-12-31', '2027-01-01', '2028-02-29']) {
    const state = { todayDate: '2026-10-01', selectedDate, personalEvents: [{ id: 'event', title: '일정', date: selectedDate, category: 'personal' }] };
    assert.equal(buildPlannerDerived(state).selectedPlannerDateKey, selectedDate);
    const calendar = buildCalendarDerived(state);
    assert.equal(calendar.calendarMonthCells.find(cell => cell.isSelected)?.ymd, selectedDate);
    assert.equal(calendar.calendarSelectedEvents[0].id, 'event');
    assert.equal(calendar.calendarMonthLabel, `${Number(selectedDate.slice(0, 4))}년 ${Number(selectedDate.slice(5, 7))}월`);
  }
  for (const [date, mode, next] of [['2027-01-31', 'month', '2027-02-28'], ['2028-01-31', 'month', '2028-02-29'], ['2026-12-28', 'week', '2027-01-04']]) {
    let selected;
    createPlannerHandlers({ selectedPlannerDateKey: date, plannerCalendarMode: mode, setSelectedDate: value => { selected = value; } }).plannerCalendarNextWeek();
    assert.equal(selected, next);
  }
  const patch = studyDayPatch({ todayDate: '2026-10-01', studyKoreaDate: '2026-10-01', selectedDate: '2026-11-10' }, new Date('2026-10-01T15:00:00Z'));
  assert.equal(patch.selectedDate, undefined);
  assert.equal(patch.calendarSelectedDate, undefined);
  assert.equal(patch.calendarMonthAnchor, undefined);
});

test('swipe direction rejects short, diagonal, vertical and different-pointer gestures', () => {
  const start = { x: 100, y: 100, pointerId: 1 };
  for (const end of [{ x: 70, y: 100, pointerId: 1 }, { x: 30, y: 180, pointerId: 1 }, { x: 100, y: 160, pointerId: 1 }, { x: 10, y: 100, pointerId: 2 }]) assert.equal(calendarSwipeDirection(start, end), 0);
  assert.equal(calendarSwipeDirection(start, { x: 10, y: 120, pointerId: 1 }), 1);
  assert.equal(calendarSwipeDirection(start, { x: 190, y: 120, pointerId: 1 }), -1);
  assert.equal(calendarSwipeDirection(null, start), 0);
});

test('home entry uses the planner date and fold/reopen preserves a draft', () => {
  const ctx = fixture();
  let route;
  ctx.goto = value => { route = value; };
  const handlers = createCalendarHandlers(ctx);
  handlers.openPlannerCalendar({ actionEl: { getAttribute: name => name === 'data-date' ? '2026-10-02' : '' } });
  assert.equal(route, 'planner');
  assert.equal(ctx.selectedDate, '2026-10-02');
  handlers.closeCalendarEventForm();
  handlers.openCalendarEventForm();
  assert.equal(ctx.calendarEventDraft.title, '면접 준비');
  assert.equal(ctx.calendarEventFormOpen, true);
  ctx.calendarSyncStatus = 'error';
  handlers.retryCalendar();
  assert.equal(ctx.calendarSyncStatus, 'idle');
  const reset = createUserDataResetPatch();
  assert.equal(reset.calendarEventDraft, null);
  assert.deepEqual(reset.personalEvents, []);
  assert.equal(reset.calendarMutationRecovery, null);
});

test('missing API or unsupported server never fakes local success', async () => {
  let writes = 0;
  for (const patch of [{ apiFetch: null }, { calendarSupportsIdempotency: false }, { hasClientSession: () => false }]) {
    const ctx = Object.assign(fixture(async () => { writes++; return response({}); }), patch);
    await mutateCalendar(ctx, 'save');
    assert.ok(ctx.calendarMutationError);
    assert.equal(ctx.calendarEventDraft.title, '면접 준비');
    assert.deepEqual(ctx.personalEvents, []);
  }
  assert.equal(writes, 0);
});

test('definite failure keeps draft and events, and pending mutation is single-flight', async () => {
  let resolve;
  let writes = 0;
  const ctx = fixture(() => { writes++; return new Promise(done => { resolve = done; }); });
  const first = mutateCalendar(ctx, 'save');
  await mutateCalendar({ ...ctx }, 'save');
  assert.equal(writes, 1);
  resolve(response({ error: 'invalid' }, 400));
  await first;
  assert.equal(ctx.calendarSaving, false);
  assert.equal(ctx.calendarEventDraft.title, '면접 준비');
  assert.deepEqual(ctx.personalEvents, []);
  assert.ok(ctx.calendarMutationError);
});

test('interrupted successful save recovers by exact identity without a second write', async () => {
  let writes = 0;
  let saved;
  const ctx = fixture(async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.type === 'get_admission_calendar') return response({ events: [saved] });
    writes++;
    saved = { ...body.data, id: body.data.clientRequestId };
    return response({}, 500);
  });
  await mutateCalendar(ctx, 'save');
  assert.equal(writes, 1);
  assert.equal(ctx.personalEvents[0].id, saved.id);
  assert.equal(ctx.calendarEventDraft, null);
  assert.equal(ctx.calendarMutationRecovery, null);
  assert.equal(ctx.selectedDate, '2026-10-02');
});

test('unavailable recovery preserves operation identity and checks before replay', async () => {
  let writes = 0;
  let ready = false;
  let saved;
  const ctx = fixture(async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.type === 'get_admission_calendar') return ready ? response({ events: [saved] }) : response({}, 500);
    writes++;
    saved = { ...body.data, id: body.data.clientRequestId };
    return response({}, 500);
  });
  await mutateCalendar(ctx, 'save');
  const recoveryId = ctx.calendarMutationRecovery.id;
  assert.equal(recoveryId, saved.id);
  assert.equal(ctx.calendarEventDraft.clientRequestId, recoveryId);
  ready = true;
  await mutateCalendar(ctx, 'save');
  assert.equal(writes, 1);
  assert.equal(ctx.calendarMutationRecovery, null);
});

test('delete recovers missing identity and edit conflict preserves input', async () => {
  const ctx = fixture(async (_url, options) => JSON.parse(options.body).type === 'get_admission_calendar' ? response({ events: [] }) : response({}, 500));
  ctx.calendarEventEditId = 'mine';
  await mutateCalendar(ctx, 'delete');
  assert.equal(ctx.calendarEventDraft, null);
  assert.equal(ctx.calendarMutationRecovery, null);
  const edit = fixture(async () => response({}, 409));
  edit.calendarEventEditId = 'mine';
  await mutateCalendar(edit, 'save');
  assert.equal(edit.calendarSyncStatus, 'error');
  assert.equal(edit.calendarEventDraft.title, '면접 준비');
});

test('late response cannot populate a different owner or clear their draft', async () => {
  let resolve;
  let current = true;
  const ctx = fixture(() => new Promise(done => { resolve = done; }));
  ctx.isCurrentProfile = () => current;
  const pending = mutateCalendar(ctx, 'save');
  current = false;
  ctx.calendarEventDraft = { title: '다른 계정 초안' };
  resolve(response({ events: [], event: null }));
  await pending;
  assert.equal(ctx.calendarEventDraft.title, '다른 계정 초안');
  assert.deepEqual(ctx.personalEvents, []);
});

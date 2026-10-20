import test from 'node:test';
import assert from 'node:assert/strict';
import { getNearestUpcomingEvent, getOfficialAdmissionEvents, normalizePersonalEvent, formatDdayLabel, eventMarksDateInGrid } from '../../studycrack-mobile-app/src/constants/admission-calendar.js';

test('home skips started long periods and selects the closest upcoming date', () => {
  const official = getOfficialAdmissionEvents(2026);
  const next = getNearestUpcomingEvent(official, '2026-10-01');
  assert.equal(next.date, '2026-10-20');
  assert.equal(formatDdayLabel(next.date, '2026-10-01'), 'D-19');
  const personal = { id: 'mine', date: '2026-10-02', title: '개인 면접' };
  assert.equal(getNearestUpcomingEvent([...official, personal], '2026-10-01').id, 'mine');
});

test('today is D-DAY, passed dates are not selected, empty lists stay empty', () => {
  const entries = [{ date: '2026-09-12', endDate: '2026-12-17' }, { date: '2026-10-01' }, { date: '2026-10-02' }];
  assert.equal(getNearestUpcomingEvent(entries, '2026-10-01').date, '2026-10-01');
  assert.equal(formatDdayLabel('2026-10-01', '2026-10-01'), 'D-DAY');
  assert.equal(getNearestUpcomingEvent(entries, '2026-10-03'), null);
  assert.equal(getNearestUpcomingEvent([], '2026-10-01'), null);
  assert.equal(getNearestUpcomingEvent([{ date: '2026-13-01' }], '2026-10-01'), null);
});

test('year rollover selects the next year and does not mutate the input', () => {
  const entries = [{ date: '2027-01-03' }, { date: '2027-01-01' }, { date: '2026-12-01' }];
  const original = structuredClone(entries);
  assert.equal(getNearestUpcomingEvent(entries, '2026-12-31').date, '2027-01-01');
  assert.deepEqual(entries, original);
});

test('invalid end dates are rejected consistently with the server instead of silently removed', () => {
  const entry = { title: '면접', date: '2026-10-02', category: 'personal' };
  assert.equal(normalizePersonalEvent({ ...entry, endDate: '2026-10-01' }), null);
  assert.equal(normalizePersonalEvent({ ...entry, endDate: '2026-02-30' }), null);
  assert.equal(normalizePersonalEvent({ ...entry, endDate: '' }).endDate, undefined);
});

test('calendar marks short periods and only endpoints of long periods', () => {
  assert.equal(eventMarksDateInGrid({ date: '2026-10-01', endDate: '2026-10-03' }, '2026-10-02'), true);
  assert.equal(eventMarksDateInGrid({ date: '2026-09-12', endDate: '2026-12-17' }, '2026-10-01'), false);
});

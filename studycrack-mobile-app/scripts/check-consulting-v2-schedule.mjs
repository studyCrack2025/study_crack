import assert from 'node:assert/strict';
import { listWrittenSlots } from '../src/features/consulting-v2/schedule-api.js';
import { formatWrittenSession, groupWrittenSlots, validateWrittenSelection } from '../src/features/consulting-v2/schedule-model.js';
import { actionPathForState } from '../src/features/consulting-v2/progress-model.js';

const ids = ['WST_20261009_1000', 'WST_20261009_1030', 'WST_20261010_1000', 'WST_20261010_1030', 'WST_20261011_1000', 'WST_20261011_1030'];
const valid = validateWrittenSelection(Object.fromEntries(ids.map((id, index) => [id, index < 2 ? 1 : 2])));
assert.equal(valid.valid, true);
assert.equal(valid.selectedSlots.length, 6);
assert.equal(validateWrittenSelection(Object.fromEntries(ids.slice(0, 5).map(id => [id, 1]))).valid, false);

const slots = ids.map((slotId, index) => ({ slotId, localDate: slotId.slice(4, 8) + '-' + slotId.slice(8, 10) + '-' + slotId.slice(10, 12), localTime: index % 2 ? '10:30' : '10:00', startAt: `2026-10-${String(9 + Math.floor(index / 2)).padStart(2, '0')}T01:${index % 2 ? '30' : '00'}:00.000Z` }));
assert.equal(groupWrittenSlots(slots).length, 3);

const session = { startAt: '2026-10-09T01:00:00.000Z', endAt: '2026-10-09T01:30:00.000Z', status: 'booked' };
assert.ok(formatWrittenSession(session));
assert.equal(formatWrittenSession({ ...session, status: 'cancelled' }), null);
assert.equal(actionPathForState('WRITTEN_SESSION_BOOKED'), '/2027-jungsi-consulting/written-session');

let requestBody;
const result = await listWrittenSlots({
  consultingApiUrl: 'https://api.example.test/consulting',
  apiFetch: async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ success: true, data: { slots: [] } }) };
  }
});
assert.equal(result.ok, true);
assert.deepEqual(requestBody, { type: 'student_list_v2_written_slots', data: {} });

console.log('consulting v2 schedule contracts passed');

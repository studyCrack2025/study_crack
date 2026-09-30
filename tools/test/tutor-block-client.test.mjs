import test from 'node:test';
import assert from 'node:assert/strict';
import { blockAssignedTutor } from '../../studycrack-mobile-app/src/features/account/tutor-block.js';

function fixture() {
  const f = { current: true, calls: [], alerts: [], updates: [], accepted: true };
  f.ctx = { userApiUrl: '/api/user', isCurrentProfile: () => f.current, confirm: () => f.accepted,
    alert: text => f.alerts.push(text), setUser: update => f.updates.push(update({ tutorName: 'Old', tutorInfo: {} })),
    apiFetch: async (url, options) => {
      const payload = JSON.parse(options.body); f.calls.push(payload);
      if (f.switchAccount) f.current = false;
      return { ok: !f.failure, json: async () => payload.type === 'get_tutor_contact_state'
        ? { assignedTutorId: f.noTutor ? '' : 'tutor', revision: 3 } : { success: true, blocked: true } };
    } };
  return f;
}
test('block requires fresh assignment and explicit confirmation, clears stale local tutor only on success', async () => {
  const f = fixture(); assert.equal(await blockAssignedTutor(f.ctx), true);
  assert.deepEqual(f.calls[1], { type: 'block_assigned_tutor', data: { tutorId: 'tutor', expectedRevision: 3 } });
  assert.deepEqual(f.updates, [{ tutorName: '', tutorInfo: null }]);
});
for (const mode of ['accepted', 'switchAccount', 'noTutor', 'failure']) test(`no mutation after ${mode}`, async () => {
  const f = fixture(); f[mode] = mode === 'accepted' ? false : true;
  assert.equal(await blockAssignedTutor(f.ctx), false);
  assert.equal(f.calls.length, 1); assert.equal(f.updates.length, 0);
  if (mode === 'switchAccount') assert.equal(f.alerts.length, 0);
});

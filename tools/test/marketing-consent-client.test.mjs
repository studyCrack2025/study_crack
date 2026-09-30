import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileHandlers } from '../../studycrack-mobile-app/src/handlers/profile-handlers.js';

for (const outcome of ['success', 'failure', 'offline', 'stale', 'legacy']) test(`marketing setting preserves server evidence: ${outcome}`, async () => {
    const original = { marketingAgreed: true, marketingAgreedAt: '2026-01-01T00:00:00.000Z' };
    let user = { ...original }, calls = 0, finish;
    const serverDate = '2026-09-29T00:00:00.000Z';
    const handlers = createProfileHandlers({ user, localStorage: {}, userApiUrl: '/api/user', alert: () => {},
        operationLocksRef: { current: new Set() }, isCurrentProfile: () => outcome !== 'stale', setUser: updater => { user = updater(user); },
        apiFetch: async () => {
            calls++;
            await new Promise(resolve => { finish = resolve; });
            if (outcome === 'offline') throw new Error('offline');
            return { ok: outcome !== 'failure', json: async () => outcome === 'legacy' ? {} : { consent: {
                marketingAgreed: false, marketingAgreedAt: original.marketingAgreedAt,
                marketingRevokedAt: serverDate, marketingConsentUpdatedAt: serverDate, email: 'not-allowed'
            } } };
        } });
    const pending = handlers.saveMarketingConsent({ isAgreed: false });
    assert.deepEqual(user, original, 'no optimistic date or flag mutation');
    assert.equal(await handlers.saveMarketingConsent({ isAgreed: false }), false);
    assert.equal(calls, 1);
    finish();
    assert.equal(await pending, ['success', 'legacy'].includes(outcome));
    if (outcome === 'success') {
        assert.equal(user.marketingAgreed, false); assert.equal(user.marketingAgreedAt, original.marketingAgreedAt);
        assert.equal(user.marketingRevokedAt, serverDate); assert.equal(user.email, undefined);
    } else if (outcome === 'legacy') {
        assert.deepEqual(user, { ...original, marketingAgreed: false });
    } else assert.deepEqual(user, original);
});

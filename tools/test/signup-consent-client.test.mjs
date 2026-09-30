import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignupConsent } from '../../studycrack-mobile-app/src/domain/signup-consent.js';
import { readFileSync } from 'node:fs';

const registry = JSON.parse(readFileSync(new URL('../../content/legal/legacy.json', import.meta.url)));
const now = Date.parse('2026-09-27T15:00:00Z');
test('mobile signup sends the five displayed versions without an invented consent timestamp', () => {
    const result = buildSignupConsent('2012-09-28', false, now);
    assert.equal(result.recordedAt, undefined);
    for (const [id, doc] of Object.entries(registry.documents)) {
        assert.deepEqual(result.documents[id], { revision: doc.revision, accepted: id !== 'marketing' });
    }
});
test('mobile signup rejects underage, future and invalid dates before account creation', () => {
    for (const birthday of ['2012-09-29', '2027-01-01', '2013-02-29', '', '2012-2-1']) {
        assert.throws(() => buildSignupConsent(birthday, false, now), /만 14세/);
    }
    assert.equal(buildSignupConsent('2012-09-28', true, now).documents.marketing.accepted, true);
});

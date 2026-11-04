import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../../js/admin/navigation.js', import.meta.url), 'utf8');
function harness() {
    const events = {}, writes = [], calls = [];
    const window = { location: { hash: '', pathname: '/admin', search: '' }, history: {}, addEventListener: (name, listener) => { events[name] = listener; }, showQnaSection: sub => calls.push(['qna', sub]), showNotiMenu: sub => calls.push(['notifications', sub]) };
    for (const method of ['pushState', 'replaceState']) window.history[method] = (_s, _t, url) => { writes.push([method, url]); window.location.hash = url.slice(url.indexOf('#')); };
    const ctx = vm.createContext({ window, URLSearchParams, document: { addEventListener() {} }, showSection: value => calls.push(['section', value]) });
    vm.runInContext(source + '\nthis.parse = readAdminLocation; this.write = writeAdminLocation; this.restore = restoreAdminNavigation;', ctx);
    return { ctx, window, calls, writes, events, json: value => JSON.parse(JSON.stringify(value)) };
}
test('allowlisted sections and submenu states survive refresh and direct entry', () => {
    const h = harness();
    for (const hash of ['#students', '#tutors', '#advanced-stats', '#matching', '#qna?sub=read', '#notifications?sub=sent']) {
        h.window.location.hash = hash; vm.runInContext('adminNavigationReady = true', h.ctx); h.ctx.restore();
        const route = h.ctx.parse(hash); assert.equal(h.calls.at(-1)[1], route.sub || route.section);
    }
    assert.equal(h.writes.length, 0);
});
test('unsafe or duplicate route parameters do not become selectors or persisted personal data', () => {
    const h = harness();
    for (const hash of ['#__proto__', '#students?name=private', '#consulting?phase=report&phase=final', '#x\"]']) assert.equal(h.ctx.parse(hash).section, 'dashboard');
    h.ctx.write({ section: 'consulting', phase: 'private@example.invalid', applicationId: '01000000000', sourceResponseId: 'private' });
    assert.equal(h.window.location.hash, '#consulting?phase=all');
    assert.ok(!JSON.stringify(h.writes).includes('private'));
});
test('student selection keeps only opaque references and restores the selected detail tab', () => {
    const h = harness(), route = { section: 'consulting', phase: 'report', applicationId: 'APP_11111111-1111-4111-8111-111111111111', sourceResponseId: 'RESPONSE_SYNTHETIC', tab: 'report', email: 'synthetic@example.invalid' };
    h.ctx.write(route); const restored = h.json(h.ctx.parse()); delete route.email;
    assert.deepEqual(restored, route); assert.equal(h.writes.length, 1);
    h.ctx.write(route); assert.equal(h.writes.length, 1);
    vm.runInContext('adminNavigationReady = true', h.ctx); h.events.hashchange(); assert.deepEqual(h.calls.at(-1), ['section', 'consulting']);
    h.events['studycrack:session-ended'](); h.events.hashchange(); assert.equal(h.calls.length, 1);
});

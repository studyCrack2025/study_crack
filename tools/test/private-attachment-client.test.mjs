import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('async function resolvePrivateAttachment('), source.indexOf("if (typeof document !== 'undefined'", source.indexOf('async function resolvePrivateAttachment(')));
const base = 'https://files.example.invalid/planner/owner/file.pdf';
const marked = `${base}?X-Amz-Signature=old#scFile=${encodeURIComponent(JSON.stringify({ subjectUserId: 'owner', reportKind: 'weekly', reportId: '2026-W40' }))}`;
function fixture() {
    const f = { owner: 'owner', calls: [], tabs: [], alerts: [] };
    const context = { URL, FILE_API_URL: '/api/file', localStorage: { getItem: () => f.owner }, window: { location: { origin: 'https://dev.studycrack.co.kr', assign: href => { f.location = href; } }, open: () => {
        const tab = { opener: {}, location: { replace: href => { tab.href = href; } }, close: () => { tab.closed = true; } }; f.tabs.push(tab); return tab;
    }, alert: text => f.alerts.push(text) }, apiFetch: async (_url, options) => {
        f.calls.push(JSON.parse(options.body)); f.onFetch?.(); if (f.failed) throw new Error('denied');
        return { json: async () => ({ downloadUrl: f.response || `${base}?X-Amz-Signature=fresh` }) };
    } };
    f.resolve = vm.runInNewContext(helper + '; resolvePrivateAttachment', context);
    f.open = vm.runInNewContext('openPrivateAttachment', context);
    return f;
}
test('marked attachment always rechecks access instead of trusting stale signed URL', async () => {
    const f = fixture(); assert.equal(await f.resolve(marked), `${base}?X-Amz-Signature=fresh`);
    assert.deepEqual(f.calls[0], { type: 'get_study_file_download', data: { fileUrl: marked, subjectUserId: 'owner', reportKind: 'weekly', reportId: '2026-W40' } });
    assert.equal(await f.resolve('https://example.invalid/ordinary.pdf'), 'https://example.invalid/ordinary.pdf'); assert.equal(f.calls.length, 1);
});
for (const mode of ['failed', 'switched', 'logout', 'foreign', 'credentials', 'http', 'changed-path', 'missing-signature']) test(`no stale-address fallback or popup navigation on ${mode}`, async () => {
    const f = fixture(); if (mode === 'failed') f.failed = true;
    if (mode === 'switched' || mode === 'logout') f.onFetch = () => { f.owner = mode === 'logout' ? '' : 'other'; };
    f.response = ({ foreign: 'https://evil.test/a.pdf?X-Amz-Signature=fresh', credentials: `${base.replace('https://', 'https://user:pass@')}?X-Amz-Signature=fresh`, http: `${base.replace('https:', 'http:')}?X-Amz-Signature=fresh`, 'changed-path': `${base.replace('file.pdf', 'other.pdf')}?X-Amz-Signature=fresh`, 'missing-signature': base })[mode];
    assert.equal(await f.open(marked), false); assert.equal(f.tabs[0].opener, null); assert.equal(f.tabs[0].href, undefined); assert.equal(f.tabs[0].closed, true); assert.equal(f.location, undefined);
});
test('malformed marker or absent login never sends a file request', async () => {
    const f = fixture(); await assert.rejects(f.resolve(`${base}#scFile=%ZZ`)); f.owner = ''; await assert.rejects(f.resolve(marked)); assert.equal(f.calls.length, 0);
});
test('successful popup has no opener and only receives the reauthorized capability', async () => {
    const f = fixture(); assert.equal(await f.open(marked), true); assert.equal(f.tabs[0].opener, null); assert.equal(f.tabs[0].href, `${base}?X-Amz-Signature=fresh`);
});

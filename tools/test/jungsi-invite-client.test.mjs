import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../jungsi-consulting-start.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../../js/jungsi-consulting-start.js', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const auth = await readFile(new URL('../../js/auth.js', import.meta.url), 'utf8');
const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));

test('the invite fragment is captured before assets load and removed from the visible URL', () => {
    const capture = html.indexOf("window.location.hash.slice(1)");
    const firstAsset = html.indexOf('<link rel="stylesheet"');
    assert.ok(capture > 0 && capture < firstAsset);
    assert.match(html, /history\.replaceState\(null, '', window\.location\.pathname \+ window\.location\.search\)/);
    assert.doesNotMatch(html.slice(0, firstAsset), /googletagmanager|analytics|dataLayer/i);
});

test('the invite secret stays out of local storage and public preflight omits credentials', () => {
    assert.doesNotMatch(client, /localStorage/);
    assert.match(client, /credentials: 'omit'/);
    assert.match(client, /referrerPolicy: 'no-referrer'/);
    assert.match(client, /public_preflight_v2_consulting_invite/);
    assert.match(client, /student_claim_v2_consulting_invite/);
});

test('login and signup preserve only the allowlisted consulting return path', () => {
    assert.match(shared, /'\/2027-jungsi-consulting\/start'/);
    assert.match(shared, /sc_jungsi_invite_v1/);
    assert.match(auth, /isSafeAuthReturnPath\(value\)/);
    assert.match(auth, /createSocialLoginUrl\(\{ provider, returnUrl:/);
});

test('the deployment policy includes the page, assets, and clean URL alias', () => {
    for (const file of ['jungsi-consulting-start.html', 'css/jungsi-consulting-start.css', 'js/jungsi-consulting-start.js']) assert.ok(policy.files.includes(file));
    assert.equal(policy.aliases['2027-jungsi-consulting/start'], 'jungsi-consulting-start.html');
});

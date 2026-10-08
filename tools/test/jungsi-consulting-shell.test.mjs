import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const landing = await readFile(new URL('../../jungsi-consulting-2027.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../../jungsi-consulting-app.html', import.meta.url), 'utf8');
const campaignClient = await readFile(new URL('../../js/jungsi-consulting.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../../studycrack-mobile-app/src/runtime/main.js', import.meta.url), 'utf8');
const contracts = await readFile(new URL('../../studycrack-mobile-app/src/features/consulting-v2/contracts.js', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));

const shellPaths = ['start', 'login', 'home', 'survey', 'materials', 'schedule', 'written-session', 'report', 'final-call'];

test('the public landing is indexable and exposes no unverified review or outcome claims', () => {
    assert.match(landing, /<meta name="robots" content="index,follow">/);
    assert.match(landing, /<link rel="canonical" href="https:\/\/studycrack\.co\.kr\/2027-jungsi-consulting">/);
    assert.doesNotMatch(landing, /후기|합격자 수|합격률|만족도/);
    assert.match(campaignClient, /get_v2_consulting_campaign/);
    assert.match(campaignClient, /credentials: 'omit'/);
    assert.match(campaignClient, /docs\\\.google\\\.com\\\/forms/);
});

test('the consulting shell is private to search engines and uses its isolated app surface', () => {
    assert.match(app, /<meta name="robots" content="noindex,nofollow">/);
    assert.match(app, /data-app-surface="consulting-2027"/);
    assert.match(runtime, /appSurface === 'consulting-2027'/);
    assert.match(runtime, /ConsultingApp\.jsx/);
    assert.match(shared, /'\/jungsi-consulting-app\.html'/);
});

test('all consulting app paths resolve to the same shell', () => {
    assert.equal(policy.aliases['2027-jungsi-consulting'], 'jungsi-consulting-2027.html');
    assert.ok(policy.files.includes('css/jungsi-consulting-app-shell.css'));
    for (const path of shellPaths) assert.equal(policy.aliases[`2027-jungsi-consulting/${path}`], 'jungsi-consulting-app.html');
});

test('student home contract selects only presentation fields', () => {
    for (const field of ['available', 'workflowState', 'nextAction', 'nextDueAt', 'progress', 'session', 'report', 'alerts']) assert.match(contracts, new RegExp(field));
    assert.doesNotMatch(contracts, /surveyAnswers|studentName|phone|email|rawScore/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../admin_index.html', import.meta.url), 'utf8');
const config = await readFile(new URL('../../js/config.js', import.meta.url), 'utf8');
const helpers = await readFile(new URL('../../js/admin/consulting.js', import.meta.url), 'utf8');
const intake = await readFile(new URL('../../js/admin/consulting-intake.js', import.meta.url), 'utf8');
const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));

test('admin consulting screen and its deployment files are wired', () => {
    assert.match(html, /showSection\('consulting'\)/);
    assert.match(html, /id="section-consulting"/);
    assert.match(html, /\/js\/admin\/consulting\.js/);
    assert.match(html, /\/js\/admin\/consulting-intake\.js/);
    assert.match(html, /\/css\/admin_consulting\.css/);
    for (const file of ['js/admin/consulting.js', 'js/admin/consulting-intake.js', 'css/admin_consulting.css']) assert.ok(policy.files.includes(file));
    assert.match(config, /consulting:\s+`\$\{API_BASE\}\/api\/consulting`/);
});

test('payment approval sends server-validated fields and requires an explicit payer check', () => {
    for (const field of ['applicationId', 'expectedRevision', 'idempotencyKey', 'paidAmount', 'paidAt', 'payerNameConfirmed', 'reasonCode']) assert.match(intake, new RegExp(`\\b${field}\\b`));
    assert.match(intake, /MANUAL_BANK_MATCH/);
    assert.match(intake, /consultingPayerConfirmed/);
    assert.match(helpers, /window\.crypto\.randomUUID/);
});

test('PII is rendered as text and is not interpolated into HTML', () => {
    assert.match(intake, /content\.textContent = String\(value/);
    assert.doesNotMatch(intake, /innerHTML\s*=\s*`[^`]*\$\{/);
    assert.doesNotMatch(intake, /onclick\s*=/i);
});

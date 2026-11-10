import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../admin_index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../../js/admin/consulting-materials.js', import.meta.url), 'utf8');
const helpers = await readFile(new URL('../../js/admin/consulting.js', import.meta.url), 'utf8');
const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));

test('student detail links material read and review actions without a second list', () => {
    for (const type of ['admin_get_v2_material_detail', 'admin_request_v2_supplement', 'admin_verify_v2_materials']) assert.match(client, new RegExp(type));
    assert.match(html, /consultingWorkspaceMaterials/);
    assert.doesNotMatch(html, /consultingMaterialReviewBody/);
    assert.match(html, /\/js\/admin\/consulting-materials\.js/);
    assert.ok(policy.files.includes('js/admin/consulting-materials.js'));
});

test('material PII uses text nodes and download URLs are restricted to https', () => {
    assert.match(helpers, /description\.textContent = /);
    assert.match(client, /info\.textContent = /);
    assert.match(client, /url\.startsWith\('https:\/\/'\)/);
    assert.doesNotMatch(client, /innerHTML\s*=\s*`[^`]*\$\{/);
});

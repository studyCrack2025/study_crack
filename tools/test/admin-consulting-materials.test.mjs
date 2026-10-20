import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../admin_index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../../js/admin/consulting-materials.js', import.meta.url), 'utf8');
const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));

test('admin material review is wired to all four v2 review APIs', () => {
    for (const type of ['admin_list_v2_material_review', 'admin_get_v2_material_detail', 'admin_request_v2_supplement', 'admin_verify_v2_materials']) assert.match(client, new RegExp(type));
    assert.match(html, /consultingMaterialReviewBody/);
    assert.match(html, /\/js\/admin\/consulting-materials\.js/);
    assert.ok(policy.files.includes('js/admin/consulting-materials.js'));
});

test('material PII uses text nodes and download URLs are restricted to https', () => {
    assert.match(client, /content\.textContent = String/);
    assert.match(client, /document\.createTextNode/);
    assert.match(client, /url\.startsWith\('https:\/\/'\)/);
    assert.doesNotMatch(client, /innerHTML\s*=\s*`[^`]*\$\{/);
});

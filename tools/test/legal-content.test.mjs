import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LEGAL_IDS, LEGAL_SOURCE, LEGAL_TARGETS, escapeLegalText, legacyRevision, renderMobileTerms, renderPolicyPage, renderSignupTerms, renderSocialTerms, replaceLegalRegion, synchronizeLegalContent, validateLegalRegistry } from '../legal-content.mjs';

const registry = JSON.parse(await readFile(new URL('../../content/legal/legacy.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(registry);
const signupShell = LEGAL_IDS.map(id => `<div><!-- legal:${id}:start -->old<!-- legal:${id}:end --></div>`).join('\n');
const socialShell = 'before\n// legal-content:start\nold\n// legal-content:end\nafter';

test('all generated surfaces match the current legal source', async () => {
  assert.deepEqual(await synchronizeLegalContent(), { documents: 5, surfaces: 7, changed: [] });
});

test('mobile and social texts match while existing display titles remain intact', () => {
  const mobile = vm.runInNewContext(renderMobileTerms(registry).replace('export const TERMS_CONTENT =', '(').replace(/;\n$/, ')'));
  const socialCode = renderSocialTerms(socialShell, registry).split('// legal-content:start')[1].split('// legal-content:end')[0];
  const social = vm.runInNewContext(`${socialCode}\nSOCIAL_TERM_DETAILS`);
  for (const id of LEGAL_IDS) {
    assert.equal(mobile[id].body, registry.documents[id].body);
    assert.equal(social[id].body, mobile[id].body);
  }
  assert.equal(social.service.title, '스터디크랙 서비스 이용약관');
  assert.equal(mobile.service.title, '서비스 이용약관');
  assert.ok(!('effectiveDate' in mobile.standard));
});

test('legacy snapshots do not invent effective dates or accept unpublished drafts', () => {
  for (const change of [doc => { doc.status = 'draft'; }, doc => { doc.effectiveDate = '2026-09-27'; }, doc => { doc.body += ' changed'; }, doc => { doc.id = 'other'; }, doc => { doc.title = ''; }]) {
    const input = clone(); change(input.documents.privacy);
    assert.throws(() => validateLegalRegistry(input));
  }
  const extra = clone(); extra.documents.newPolicy = extra.documents.privacy;
  assert.throws(() => validateLegalRegistry(extra));
  const missing = clone(); delete missing.documents.refund;
  assert.throws(() => validateLegalRegistry(missing));
});

test('unfinished placeholders are rejected even with a matching fingerprint', () => {
  const input = clone(); input.documents.privacy.body = '[TBD]';
  input.documents.privacy.revision = legacyRevision('[TBD]');
  assert.throws(() => validateLegalRegistry(input));
});

test('HTML and JavaScript output treat markup as text without script breakouts', () => {
  const input = clone(); const value = '</div><script>alert("x")</script>&\u2028';
  input.documents.privacy.body = value; input.documents.privacy.revision = legacyRevision(value);
  const html = renderSignupTerms(signupShell, input);
  assert.ok(html.includes(escapeLegalText(value)));
  assert.ok(!html.includes('<script>'));
  assert.ok(!renderMobileTerms(input).includes('</script>'));
  assert.ok(!renderSocialTerms(socialShell, input).includes('</script>'));
  const page = renderPolicyPage('privacy', input);
  assert.ok(page.includes(escapeLegalText(value)));
  assert.ok(!page.includes('<script>'));
});

test('generation preserves non-legal content and is idempotent', () => {
  const html = `prefix<input id="agree">${signupShell}<script src="auth.js"></script>suffix`;
  const generated = renderSignupTerms(html, registry);
  assert.ok(generated.startsWith('prefix<input id="agree">'));
  assert.ok(generated.endsWith('<script src="auth.js"></script>suffix'));
  assert.equal(renderSignupTerms(generated, registry), generated);
  const social = renderSocialTerms(socialShell, registry);
  assert.ok(social.startsWith('before\n')); assert.ok(social.endsWith('\nafter'));
  assert.equal(renderSocialTerms(social, registry), social);
});

test('missing, repeated and reversed markers fail closed', () => {
  for (const source of ['', 'START END START', 'START END END', 'END START']) {
    assert.throws(() => replaceLegalRegion(source, 'START', 'END', 'new'));
  }
});

test('check mode detects stale artifacts without writing; generate only repairs managed regions', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'studycrack-legal-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [file, value] of [[LEGAL_SOURCE, JSON.stringify(registry)], [LEGAL_TARGETS.mobile, 'old'], [LEGAL_TARGETS.social, socialShell], [LEGAL_TARGETS.signup, signupShell]]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), value);
  }
  await assert.rejects(synchronizeLegalContent({ root }), /Legal content drift/);
  assert.equal(await readFile(path.join(root, LEGAL_TARGETS.mobile), 'utf8'), 'old');
  assert.equal((await synchronizeLegalContent({ root, write: true })).changed.length, 7);
  assert.equal((await synchronizeLegalContent({ root })).changed.length, 0);
});

test('public pages embed the canonical text without scripts, forms or invented effective dates', () => {
  for (const [kind, ids] of Object.entries({ terms: ['standard', 'service', 'marketing'], privacy: ['privacy'], refund: ['refund'] })) {
    const html = renderPolicyPage(kind, registry);
    for (const id of ids) {
      assert.ok(html.includes(escapeLegalText(registry.documents[id].body)));
      assert.ok(html.includes(`data-legal-revision="${registry.documents[id].revision}"`));
    }
    assert.doesNotMatch(html, /<script|<form|시행일:/);
    assert.match(html, /lang="ko"/);
    assert.match(html, /본문 바로가기/);
  }
  const deletion = renderPolicyPage('deletion', registry);
  assert.match(deletion, /mailto:contact@studycrack.co.kr/);
  assert.match(deletion, /tel:07081281126/);
  assert.match(deletion, /모든 연관 자료가 일괄 정리되지는/);
  assert.doesNotMatch(deletion, /<script|<form|execute-api|인증번호를 입력/);
  assert.throws(() => renderPolicyPage('unknown', registry));
});

test('homepage and analysis link to canonical policies instead of retaining divergent copies', async () => {
  for (const file of ['index.html', 'analysis.html']) {
    const html = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    for (const route of ['terms', 'privacy', 'refund', 'delete-account']) assert.ok(html.includes(`href="/${route}"`));
    assert.doesNotMatch(html, /외부에 위탁하지|서비스 종료 후 5년|070-8028-1126/);
    assert.match(html, /070-8128-1126/);
  }
});

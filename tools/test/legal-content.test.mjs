import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LEGAL_IDS, LEGAL_SOURCE, LEGAL_TARGETS, escapeLegalText, legacyRevision, legalRevision, renderMobileTerms, renderPolicyPage, renderSignupTerms, renderSocialTerms, replaceLegalRegion, synchronizeLegalContent, validateLegalRegistry } from '../legal-content.mjs';

const registry = JSON.parse(await readFile(new URL('../../content/legal/legacy.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(registry);
const signupShell = LEGAL_IDS.map(id => `<div><!-- legal:${id}:start -->old<!-- legal:${id}:end --></div>`).join('\n');
const socialShell = 'before\n// legal-content:start\nold\n// legal-content:end\nafter';

test('all generated surfaces match the current legal source', async () => {
  assert.deepEqual(await synchronizeLegalContent(), { documents: 5, surfaces: 7, changed: [] });
});

test('public business footers use the approved representative without changing registration details', async () => {
  for (const file of ['index.html', 'analysis.html']) {
    const html = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.match(html, /대표자: 김태윤 \| 사업자등록번호: 201-61-00623/);
    assert.doesNotMatch(html, /대표자:\s*임태룽/);
  }
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
    const input = clone(); change(input.documents.standard);
    assert.throws(() => validateLegalRegistry(input));
  }
  const extra = clone(); extra.documents.newPolicy = extra.documents.privacy;
  assert.throws(() => validateLegalRegistry(extra));
  const missing = clone(); delete missing.documents.refund;
  assert.throws(() => validateLegalRegistry(missing));
});

test('unfinished placeholders are rejected even with a matching fingerprint', () => {
  const input = clone(); input.documents.privacy.body = '[TBD]';
  input.documents.privacy.revision = legalRevision('[TBD]', input.documents.privacy.status);
  assert.throws(() => validateLegalRegistry(input));
});

test('HTML and JavaScript output treat markup as text without script breakouts', () => {
  const input = clone(); const value = '</div><script>alert("x")</script>&\u2028';
  input.documents.privacy.body = value; input.documents.privacy.revision = legalRevision(value, input.documents.privacy.status);
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

test('clarified wording is distinguished from legacy snapshots without claiming effective dates or consent', () => {
  for (const id of ['service', 'refund', 'privacy']) {
    const doc = registry.documents[id];
    assert.equal(doc.status, 'clarified');
    assert.equal(doc.revisedAt, '2026-09-27');
    assert.equal(doc.effectiveDate, null);
    assert.equal(doc.revision, legalRevision(doc.body, 'clarified'));
  }
  for (const change of [doc => { delete doc.revisedAt; }, doc => { doc.revisedAt = '2026-02-30'; }, doc => { doc.effectiveDate = '2026-09-27'; }, doc => { doc.revision = legacyRevision(doc.body); }, doc => { doc.status = 'draft'; }]) {
    const input = clone(); change(input.documents.refund);
    assert.throws(() => validateLegalRegistry(input));
  }
});

test('privacy reflects confirmed processing and retention scope without claiming complete deletion or no external processing', () => {
  const body = registry.documents.privacy.body;
  assert.match(body, /개인정보 보호책임자: 김태윤/);
  assert.match(body, /contact@studycrack.co.kr/);
  assert.match(body, /070-8128-1126/);
  for (const service of ['AWS', 'NICEPAY', 'Solapi', 'Google', 'Naver']) assert.ok(body.includes(service));
  assert.match(body, /일반 회원·학습·상담 자료는 회원 탈퇴 또는 해당 처리 목적 달성 시 삭제/);
  assert.match(body, /계약 또는 청약철회 등에 관한 기록 5년/);
  assert.match(body, /불만 또는 분쟁처리에 관한 기록 3년/);
  assert.match(body, /표시·광고에 관한 기록 6개월/);
  assert.match(body, /모든 연관 자료가 자동 정리되지는 않습니다/);
  assert.match(body, /기기 저장 정보 삭제는 서버 계정 삭제와 다릅니다/);
  assert.match(body, /마케팅.*동의 철회 시까지/);
  assert.doesNotMatch(body, /임태룽|서비스 종료 후 5년간 보관|외부에 위탁하지 않습니다|제3자에게 제공하지 않습니다|전부 국내|국외 이전 없음/);
});

test('service and refund preserve pre-analysis refunds and exceptions without conflicting blanket restrictions', () => {
  const service = registry.documents.service.body;
  const refund = registry.documents.refund.body;
  assert.match(service, /STANDARD와 PRO는 4주 이용권/);
  assert.match(service, /단건 결제이며 자동 갱신되지 않습니다/);
  for (const body of [service, refund]) {
    assert.match(body, /분석 착수 전/);
    assert.match(body, /전액 환불/);
    assert.match(body, /결제 완료 자체를 분석 착수로 간주하지/);
    assert.match(body, /관계 법령에 따른 청약철회·환불 권리/);
    assert.match(body, /구매 당시 약정/);
    assert.match(body, /contact@studycrack.co.kr/);
    assert.doesNotMatch(body, /이미 결제된 이용 요금은 환불되지|월 단위 또는 연 단위|다음 결제일|체험 종료 후 자동 결제/);
  }
  assert.match(refund, /착수 전 요청은 단순 변심을 포함/);
  assert.match(refund, /분석 착수 후 적용되는 환불 제한 사유/);
  assert.match(refund, /서비스 제공이 불가능하거나 중대한 하자/);
  assert.match(refund, /가분적 서비스의 미제공 부분/);
});

test('web/mobile FAQ and support reply use analysis commencement, not a different deadline or trigger', async () => {
  const web = await readFile(new URL('../../qna.html', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../../js/admin/qna.js', import.meta.url), 'utf8');
  const mobile = await readFile(new URL('../../studycrack-mobile-app/src/screens/mypage/MyPageSecondaryScreens.jsx', import.meta.url), 'utf8');
  const macro = vm.runInNewContext(`(${admin.match(/const QNA_MACROS = (\{[\s\S]*?\n\});/)[1]})`).refund;
  for (const text of [web, macro, mobile]) {
    assert.match(text, /분석 착수 전 요청은 전액 환불/);
    assert.match(text, /회사 귀책 사유 및 관계 법령에 따른 환불 권리는 유지/);
    assert.doesNotMatch(text, /결제 후 7일 이내|목표 대학 설정 전까지는 전액 환불|튜터 매칭 및 상담.*한해/);
  }
  assert.match(web, /href="\/refund"/);
  assert.match(macro, /https:\/\/studycrack.co.kr\/refund/);
});

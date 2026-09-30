import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
export const LEGAL_IDS = Object.freeze(['standard', 'privacy', 'service', 'refund', 'marketing']);
export const LEGAL_SOURCE = 'content/legal/legacy.json';
export const LEGAL_TARGETS = Object.freeze({
  mobile: 'studycrack-mobile-app/src/constants/terms.js',
  revisions: 'studycrack-mobile-app/src/constants/terms-revisions.js',
  social: 'js/social-callback.js',
  signup: 'signup.html',
  terms: 'terms.html',
  privacy: 'privacy.html',
  refund: 'refund.html',
  deletion: 'delete-account.html'
});
const socialTitles = Object.freeze({
  standard: '스터디크랙 이용약관',
  service: '스터디크랙 서비스 이용약관',
  privacy: '스터디크랙 개인정보 처리방침',
  refund: '스터디크랙 환불 규정',
  marketing: '마케팅 정보 수신 동의'
});

export function legacyRevision(body) {
  return `legacy-${createHash('sha256').update(body).digest('hex').slice(0, 12)}`;
}

export function legalRevision(body, status) {
  return status === 'legacy' ? legacyRevision(body) : `clarified-${createHash('sha256').update(body).digest('hex').slice(0, 12)}`;
}

export function validateLegalRegistry(registry) {
  assert.equal(registry?.schema, 2, 'Unknown legal registry schema');
  assert.ok(registry.documents && !Array.isArray(registry.documents), 'Missing legal documents');
  assert.deepEqual(Object.keys(registry.documents).sort(), [...LEGAL_IDS].sort(), 'Unexpected legal document IDs');
  for (const id of LEGAL_IDS) {
    const doc = registry.documents[id];
    assert.equal(doc?.id, id, `Legal ID mismatch: ${id}`);
    assert.ok(['legacy', 'clarified'].includes(doc.status), `Unreleased legal document: ${id}`);
    // Content clarification is not evidence of an effective date or user consent.
    assert.equal(doc.effectiveDate, null, `Effective date must remain unassigned: ${id}`);
    if (doc.status === 'clarified') {
      assert.match(doc.revisedAt || '', /^\d{4}-\d{2}-\d{2}$/, `Missing clarification date: ${id}`);
      assert.equal(new Date(`${doc.revisedAt}T00:00:00Z`).toISOString().slice(0, 10), doc.revisedAt, `Invalid clarification date: ${id}`);
    } else assert.equal(doc.revisedAt, undefined, `Unexpected legacy revision date: ${id}`);
    assert.ok(typeof doc.title === 'string' && doc.title.trim(), `Missing legal title: ${id}`);
    assert.ok(typeof doc.body === 'string' && doc.body.trim(), `Missing legal body: ${id}`);
    assert.doesNotMatch(doc.body, /\[(?:TODO|TBD|미정|입력 필요)\]/i, `Unfinished legal body: ${id}`);
    assert.equal(doc.revision, legalRevision(doc.body, doc.status), `Stale legal revision: ${id}`);
  }
  return registry;
}

const serialize = value => JSON.stringify(value, null, 2).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export const escapeLegalText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function documentsFor(registry, titles, includeRevision = false) {
  validateLegalRegistry(registry);
  return Object.fromEntries(LEGAL_IDS.map(id => [id, { title: titles?.[id] || registry.documents[id].title, body: registry.documents[id].body, ...(includeRevision ? { revision: registry.documents[id].revision } : {}) }]));
}

export function renderMobileTerms(registry) {
  return `export const TERMS_CONTENT = ${serialize(documentsFor(registry))};\n`;
}

export function renderTermsRevisions(registry) {
  validateLegalRegistry(registry);
  return `export const TERMS_REVISIONS = ${serialize(Object.fromEntries(LEGAL_IDS.map(id => [id, registry.documents[id].revision])))};\n`;
}

export function replaceLegalRegion(source, start, end, body) {
  assert.equal(source.split(start).length, 2, `Expected one legal start marker: ${start}`);
  assert.equal(source.split(end).length, 2, `Expected one legal end marker: ${end}`);
  const from = source.indexOf(start) + start.length;
  const to = source.indexOf(end);
  assert.ok(to >= from, 'Reversed legal markers');
  return source.slice(0, from) + body + source.slice(to);
}

export function renderSocialTerms(source, registry) {
  const body = `\n    const SOCIAL_TERM_DETAILS = ${serialize(documentsFor(registry, socialTitles, true))};\n    `;
  return replaceLegalRegion(source, '// legal-content:start', '// legal-content:end', body);
}

export function renderSignupTerms(source, registry) {
  validateLegalRegistry(registry);
  return LEGAL_IDS.reduce((html, id) => replaceLegalRegion(html, `<!-- legal:${id}:start -->`, `<!-- legal:${id}:end -->`, `<span data-signup-document="${id}" data-revision="${registry.documents[id].revision}"></span>${escapeLegalText(registry.documents[id].body)}`), source);
}

export function renderPolicyPage(kind, registry) {
  validateLegalRegistry(registry);
  const pages = {
    terms: { title: '이용약관', ids: ['standard', 'service', 'marketing'] },
    privacy: { title: '개인정보 처리방침', ids: ['privacy'] },
    refund: { title: '환불 규정', ids: ['refund'] },
    deletion: { title: '계정 삭제 요청 안내', ids: [] }
  };
  assert.ok(Object.hasOwn(pages, kind), 'Unknown public policy page');
  const page = pages[kind];
  const slug = kind === 'deletion' ? 'delete-account' : kind;
  const documents = page.ids.map(id => {
    const doc = registry.documents[id];
    return `<section class="legal-page-card" id="${id}" aria-labelledby="title-${id}"><h2 id="title-${id}">${escapeLegalText(doc.title)}</h2><div class="legal-page-copy" data-legal-document="${id}" data-legal-revision="${doc.revision}">${escapeLegalText(doc.body)}</div></section>`;
  }).join('\n');
  const deletion = `<section class="legal-page-card"><h2>앱 없이도 문의할 수 있어요</h2><p>스터디크랙 계정 삭제를 원하거나 로그인할 수 없다면 아래 고객센터 이메일로 계정 삭제를 요청해주세요. 앱을 다시 설치할 필요는 없습니다.</p><p><a href="mailto:contact@studycrack.co.kr?subject=${encodeURIComponent('[스터디크랙] 계정 삭제 요청')}">contact@studycrack.co.kr로 요청하기</a> · <a href="tel:07081281126">070-8128-1126</a></p><p>메일 제목에 ‘계정 삭제 요청’을 적고 가입 이메일과 로그인 방식(이메일·Google·Naver)을 알려주세요. 비밀번호, 인증번호, 신분증 원본이나 성적표는 보내지 마세요.</p></section>
<section class="legal-page-card"><h2>요청과 삭제 완료는 달라요</h2><ol><li>이메일로 요청을 보냅니다. 이 페이지를 열거나 이메일 버튼을 누르는 것만으로 계정이 삭제되지는 않습니다.</li><li>계정 소유자 확인 후 처리 범위와 일정을 확인해야 합니다. 이메일 주소만 알고 있다는 이유로 다른 사람의 계정을 삭제할 수는 없습니다.</li><li>처리 결과를 확인해주세요. 문의 접수 또는 앱의 탈퇴 성공 표시만으로 모든 연관 자료의 삭제가 완료됐다고 판단하지 마세요.</li></ol><p>처리 기간은 본인 확인과 요청 범위에 따라 확인이 필요합니다. 이 페이지는 즉시 삭제나 특정 완료 기한을 보장하지 않습니다.</p></section>
<section class="legal-page-card"><h2>어떤 자료를 확인하나요?</h2><p>회원 정보 외에도 학습 기록·수조 기록·문의·파일·보고서·알림 등 계정과 연결된 자료를 함께 확인하도록 요청할 수 있습니다. 현재 앱의 탈퇴 기능만으로 모든 연관 자료가 일괄 정리되지는 않으므로 연관 자료의 삭제 여부도 고객센터로 문의해주세요.</p><p>결제·환불 등 보존이 필요한 기록은 일반 서비스 자료와 구분해 적용 근거와 기간을 확인해야 합니다. 계정 삭제 요청은 결제 취소·환불 신청과 별개입니다. 유료 이용 중이라면 환불 문의도 함께 남겨주세요.</p><a href="/refund">환불 규정 확인</a></section>`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,follow"><meta name="description" content="스터디크랙 ${page.title}. 로그인 없이 안내를 확인할 수 있습니다."><title>${page.title} | StudyCrack</title><link rel="canonical" href="https://studycrack.co.kr/${slug}"><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/css/legal-page.css"></head>
<body class="legal-page-body"><a class="legal-page-skip" href="#legal-main">본문 바로가기</a><div class="legal-page-wrap"><header class="legal-page-header"><a class="legal-page-brand" href="/"><img src="/assets/images/studycrack_logo_wo_bg.png" alt="" width="40" height="40">STUDY CRACK</a><a href="/studycrack-mobile">앱으로 이동</a></header><nav class="legal-page-nav" aria-label="정책 안내">${Object.entries(pages).map(([key, item]) => `<a href="/${key === 'deletion' ? 'delete-account' : key}"${kind === key ? ' aria-current="page"' : ''}>${item.title}</a>`).join('')}</nav><main id="legal-main" tabindex="-1"><h1>${page.title}</h1><p class="legal-page-intro">${kind === 'deletion' ? '계정 삭제 방법과 요청 시 유의사항을 확인해주세요.' : '현재 게시된 약관 본문입니다. 문서 열람만으로 동의가 처리되지는 않습니다.'}</p>${kind === 'deletion' ? deletion : documents}</main><footer class="legal-page-footer"><a href="mailto:contact@studycrack.co.kr">고객센터 contact@studycrack.co.kr</a><a href="tel:07081281126">고객센터 070-8128-1126</a></footer></div></body></html>\n`;
}

export async function synchronizeLegalContent({ root = defaultRoot, write = false } = {}) {
  const registry = validateLegalRegistry(JSON.parse(await readFile(path.join(root, LEGAL_SOURCE), 'utf8')));
  const originals = Object.fromEntries(await Promise.all(Object.entries(LEGAL_TARGETS).map(async ([id, file]) => {
    try { return [id, await readFile(path.join(root, file), 'utf8')]; }
    catch (error) { if (error.code === 'ENOENT' && ['terms', 'privacy', 'refund', 'deletion', 'revisions'].includes(id)) return [id, '']; throw error; }
  })));
  const rendered = {
    mobile: renderMobileTerms(registry),
    revisions: renderTermsRevisions(registry),
    social: renderSocialTerms(originals.social, registry),
    signup: renderSignupTerms(originals.signup, registry),
    ...Object.fromEntries(['terms', 'privacy', 'refund', 'deletion'].map(kind => [kind, renderPolicyPage(kind, registry)]))
  };
  const changed = Object.keys(rendered).filter(id => originals[id] !== rendered[id]);
  if (!write) assert.equal(changed.length, 0, `Legal content drift: ${changed.map(id => LEGAL_TARGETS[id]).join(', ')}. Run node tools/legal-content.mjs generate.`);
  else for (const id of changed) await writeFile(path.join(root, LEGAL_TARGETS[id]), rendered[id]);
  return { documents: LEGAL_IDS.length, surfaces: Object.keys(LEGAL_TARGETS).length, changed: changed.map(id => LEGAL_TARGETS[id]) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2] || 'check';
    assert.ok(['check', 'generate'].includes(mode), 'Usage: node tools/legal-content.mjs [check|generate]');
    const result = await synchronizeLegalContent({ write: mode === 'generate' });
    console.log(`Legal content ${mode}: ${result.documents} documents / ${result.surfaces} surfaces; ${result.changed.length} updated.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

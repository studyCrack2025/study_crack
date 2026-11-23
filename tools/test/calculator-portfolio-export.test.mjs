import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutCalculatorPortfolio, renderCalculatorPortfolioPng } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-portfolio-image.js';
import { deliverCalculatorPortfolioPng } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-portfolio-export.js';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function model() {
  return { title: '나의 정시 포트폴리오', name: '기본 조합', applicationId: 'APP_DO_NOT_EXPORT', email: 'private@example.invalid',
    scoreSummary: { basis: '2027학년도 수능 가채점 기준 · 표준점수·백분위·등급은 추정치입니다.', items: ['국어', '수학', '탐구 1', '탐구 2'].map(label => ({ label, subject: '선택과목', value: '원점수 0', detail: '예상 표점 120 · 백분위 90 · 2등급' })), grades: '영어 2등급 · 한국사 1등급' },
    cards: ['가군', '나군', '다군'].map((label, index) => ({ label, status: index === 2 ? 'empty' : 'ready', identity: index === 2 ? null : { university: '예시대학교', campus: '서울캠퍼스', unit: '융합학과', track: '일반전형' },
      score: index === 2 ? null : { label: '예상 환산점수', value: '730.12점', maximum: '학생부·면접·실기는 별도입니다.' }, indicator: index === 2 ? null : { band: index === 0 ? 'stable' : null, label: index === 0 ? '안정' : '판단 대기', caption: '지원 단계', points: null },
      reference: index === 2 ? null : { label: '입결 기준', lines: index === 0 ? [{ label: '예상 합격 컷', value: '650.00점' }]
        : [{ label: '예상 합격 컷', value: '산출 보류' }, { label: '2026학년도 최종등록자 70% 컷', value: '700.2점' }], note: index === 1 ? '과거 입결은 해당 학년도 반영 기준으로 대학이 공개한 점수입니다.' : null }, notes: index === 2 ? ['이 군의 지원 후보를 선택하지 않았습니다.'] : ['개인별 지원 자격을 확인해주세요.'] })),
    disclaimer: '참고 지수와 지원 단계는 실제 합격 확률이 아닙니다.', probability: '예상 합격률은 검증된 자료가 준비된 뒤 제공합니다.' };
}
function context() {
  return { font: '400 20px Paperlogy', drawn: [], measureText(text) { const size = Number(/ (\d+)px/.exec(' ' + this.font)[1]); return { width: [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].reduce((sum, item) => sum + size * (/^[\x00-\x7F]$/.test(item.segment) ? 0.55 : 1), 0) }; },
    fillRect() {}, strokeRect() {}, fillText(text, x, y) { this.drawn.push({ text, x, y }); } };
}
function documentFixture() {
  const ctx = context(), calls = [], canvas = { width: 0, height: 0, getContext: () => ctx, toBlob(done, type) { calls.push({ width: this.width, height: this.height, type }); done(new Blob(['synthetic-png'], { type })); } };
  const doc = { documentElement: {}, fonts: { ready: Promise.resolve(), load: async (font, sample) => { calls.push({ font, sample }); return [{}]; } }, defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }) }, createElement: kind => { assert.equal(kind, 'canvas'); calls.push({ created: kind }); return canvas; } };
  return { ctx, calls, canvas, doc };
}
function browserFixture() {
  const calls = [], pending = deferred();
  const link = { click() { calls.push({ click: this.download }); }, remove() { calls.push({ removed: true }); } };
  const browser = { isSecureContext: true, ClipboardItem: class { constructor(value) { this.value = value; } }, navigator: { clipboard: { write(items) { calls.push({ copied: items }); return pending.promise; } } },
    document: { createElement: () => link, body: { append: node => calls.push({ append: node }) } }, URL: { createObjectURL: blob => { calls.push({ urlBlob: blob }); return 'blob:synthetic'; }, revokeObjectURL: url => calls.push({ revoked: url }) }, setTimeout: (fn, ms) => { calls.push({ scheduled: ms }); browser.cleanup = fn; } };
  return { browser, calls, pending, link };
}

test('1080px export keeps every source value, fixed group order, non-overlapping card bounds and no incidental identifiers', () => {
  const scene = layoutCalculatorPortfolio(model(), context()); assert.equal(scene.width, 1080); assert.ok(scene.height > 1000 && scene.height < 8192);
  const text = scene.commands.filter(item => item.type === 'text').map(item => item.text).join('');
  for (const required of ['원점수 0', '730.12점', '2026학년도 최종등록자 70% 컷', '650.00점', '700.2점', '산출 보류', '예시대학교 · 안정', '예시대학교 · 판단 대기', '다군 · 미선택', '실제 합격 확률이 아닙니다']) assert.ok(text.includes(required), required);
  assert.ok(text.indexOf('가군') < text.indexOf('나군') && text.indexOf('나군') < text.indexOf('다군')); assert.doesNotMatch(text, /APP_DO_NOT_EXPORT|private@example/);
  const cards = scene.commands.filter(item => item.type === 'rect' && item.stroke === 'line'); assert.equal(cards.length, 3);
  for (let i = 1; i < cards.length; i++) assert.ok(cards[i - 1].y + cards[i - 1].height < cards[i].y);
  for (const command of scene.commands) { assert.ok(command.x >= 0 && command.y >= 0); assert.ok(command.y + (command.height || command.size * 1.55) <= scene.height); if (command.type === 'rect') assert.ok(command.x + command.width <= scene.width); }
});

test('long Korean, English and emoji identities wrap without clipping or splitting graphemes; extreme height fails clearly', () => {
  const value = model(), small = layoutCalculatorPortfolio(value, context()); value.name = '긴 조합 이름 '.repeat(7);
  value.cards[0].identity.unit = '융합'.repeat(100) + '👨‍👩‍👧‍👦'; value.cards[0].identity.track = 'LongAdmissionTrack'.repeat(10);
  const ctx = context(), scene = layoutCalculatorPortfolio(value, ctx); assert.ok(scene.height > small.height);
  const texts = scene.commands.filter(item => item.type === 'text'); assert.ok(texts.map(row => row.text).join('').includes(value.cards[0].identity.unit));
  assert.ok(texts.some(row => row.text.includes('👨‍👩‍👧‍👦')));
  for (const row of texts) { ctx.font = `${row.weight} ${row.size}px Paperlogy`; assert.ok(ctx.measureText(row.text).width <= row.width + 0.001, row.text); }
  value.cards[0].notes = ['긴 문장'.repeat(6000)]; assert.throws(() => layoutCalculatorPortfolio(value, ctx), /이미지가 너무 깁니다/);
});

test('the image waits for required fonts, uses PNG and releases the large canvas after encoding', async () => {
  const { doc, canvas, calls, ctx } = documentFixture(), fonts = deferred(); doc.fonts.ready = fonts.promise;
  const pending = renderCalculatorPortfolioPng(model(), { document: doc }); await Promise.resolve(); await Promise.resolve(); assert.ok(!calls.some(row => row.created));
  fonts.resolve(); const blob = await pending; assert.equal(blob.type, 'image/png'); assert.ok(blob.size); assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
  assert.deepEqual(calls.filter(row => row.font).map(row => row.font.split(' ')[0]), ['400', '700', '800']); assert.equal(calls.find(row => row.type === 'image/png').width, 1080); assert.ok(ctx.drawn.some(row => row.text.includes('STUDYCRACK')));
});

test('missing fonts, failed encoding and cancelled preparation cannot produce a usable image', async () => {
  const missing = documentFixture(); missing.doc.fonts.load = async () => []; await assert.rejects(renderCalculatorPortfolioPng(model(), { document: missing.doc }), /글꼴/); assert.ok(!missing.calls.some(row => row.created));
  const failure = documentFixture(); failure.canvas.toBlob = done => done(null); await assert.rejects(renderCalculatorPortfolioPng(model(), { document: failure.doc }), /PNG/); assert.equal(failure.canvas.width, 1);
  const late = documentFixture(), fonts = deferred(), abort = new AbortController(); late.doc.fonts.ready = fonts.promise;
  const pending = renderCalculatorPortfolioPng(model(), { document: late.doc, signal: abort.signal }); abort.abort(); await assert.rejects(pending, { code: 'EXPORT_CANCELLED' }); fonts.resolve(); await Promise.resolve(); assert.ok(!late.calls.some(row => row.created));
});

test('font and encoding stalls have a bounded failure without increasing test or product timeouts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const fixture = documentFixture(); fixture.doc.fonts.load = () => new Promise(() => {});
  const pending = renderCalculatorPortfolioPng(model(), { document: fixture.doc }), rejected = assert.rejects(pending, /시간이 초과/); t.mock.timers.tick(10000); await rejected;
  const encoding = documentFixture(); let started = false; encoding.canvas.toBlob = () => { started = true; };
  const second = renderCalculatorPortfolioPng(model(), { document: encoding.doc });
  for (let step = 0; step < 50 && !started; step++) await Promise.resolve(); assert.ok(started);
  const failed = assert.rejects(second, /시간이 초과/); t.mock.timers.tick(10000); await failed; assert.equal(encoding.canvas.height, 1);
});

test('copy starts during the click call and reports success only after the real write resolves', async () => {
  const { browser, calls, pending } = browserFixture(), blob = new Blob(['png'], { type: 'image/png' });
  let settled = false; const delivery = deliverCalculatorPortfolioPng({ blob, copy: true, browser }).then(result => { settled = true; return result; });
  assert.equal(calls.length, 1); assert.equal(calls[0].copied[0].value['image/png'], blob); assert.equal(settled, false); pending.resolve(); assert.equal(await delivery, 'copied'); assert.equal(calls.length, 1);
});

test('denied or unsupported copy downloads the same PNG once and eventually revokes its URL', async () => {
  for (const unsupported of [false, true]) {
    const { browser, calls, pending } = browserFixture(), blob = new Blob(['png'], { type: 'image/png' }); if (unsupported) browser.isSecureContext = false;
    const delivery = deliverCalculatorPortfolioPng({ blob, copy: true, browser }); if (!unsupported) pending.reject(Error('NotAllowedError'));
    assert.equal(await delivery, 'downloaded-fallback'); assert.equal(calls.find(row => row.urlBlob).urlBlob, blob); assert.equal(calls.filter(row => row.click).length, 1); assert.equal(calls.find(row => row.scheduled).scheduled, 30000);
    assert.equal(calls.some(row => row.revoked), false); browser.cleanup(); assert.equal(calls.find(row => row.revoked).revoked, 'blob:synthetic');
  }
});

test('a changed model or departed account cancels pending copy fallback and late success', async () => {
  for (const denied of [false, true]) {
    const { browser, calls, pending } = browserFixture(); let current = true;
    const delivery = deliverCalculatorPortfolioPng({ blob: new Blob(['png'], { type: 'image/png' }), copy: true, browser, current: () => current });
    current = false; if (denied) pending.reject(Error('NotAllowedError')); else pending.resolve();
    await assert.rejects(delivery, { code: 'EXPORT_CANCELLED' }); assert.equal(calls.some(row => row.urlBlob), false);
  }
});

test('direct download never touches clipboard; a download error removes its link and immediately releases its URL', async () => {
  const { browser, calls, link } = browserFixture(), blob = new Blob(['png'], { type: 'image/png' });
  link.click = () => { throw Error('synthetic download failure'); }; await assert.rejects(deliverCalculatorPortfolioPng({ blob, browser }), /download failure/);
  assert.equal(calls.some(row => row.copied), false); assert.equal(calls.some(row => row.removed), true); assert.equal(calls.some(row => row.revoked), true); assert.equal(calls.some(row => row.scheduled), false);
});

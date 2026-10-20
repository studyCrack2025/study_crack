import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { getScoreFieldError, getScoreStepErrors } from '../src/features/analysis/score-edit-validation.js';
import { createProfileHandlers } from '../src/handlers/profile-handlers.js';

for (const [field, max] of [['v2e-korean-common', 76], ['v2e-korean-elective', 24], ['v2e-math-common', 74], ['v2e-math-elective', 26], ['v2e-inq1-score', 50], ['v2e-inq2-score', 50]]) {
  for (const value of [0, '0', 2, max - 2, max]) assert.equal(getScoreFieldError(field, value), '', `${field}: ${value}`);
  for (const value of ['', undefined, null, 1, max - 1, max + 1, -1, 2.5]) assert.ok(getScoreFieldError(field, value), `${field}: ${value}`);
}
for (const field of ['v2e-english', 'v2e-history']) {
  for (const value of [1, '5', 9]) assert.equal(getScoreFieldError(field, value), '');
  for (const value of ['', 0, 10, '2.5']) assert.ok(getScoreFieldError(field, value));
}
assert.deepEqual(Object.keys(getScoreStepErrors(5, { inquiry1Subject: '', inquiry1Score: '' })), ['v2e-inq1-subject', 'v2e-inq1-score']);

const draft = () => ({
  korean: { type: '언어와매체', common: 0, elective: '24' },
  math: { type: '미적분', common: '58', elective: '20' }, english: '2', history: '1',
  inquiry1: { subject: '생활과 윤리', score: '0' }, inquiry2: { subject: '사회·문화', score: '43' }
});
function harness(patch = {}) {
  const converted = [];
  const writes = [];
  const saved = [];
  const otherExam = { kor: { raw: 90, std: 138 } };
  const ctx = {
    document: { querySelector: () => null }, scoreExamType: '3월 모의고사', scoreEditStep: 1,
    scoreEditOpen: true, scoreEditErrors: {}, scoreEditSaveError: '', scoreSubjectSaving: false,
    scoreEditState: draft(), user: { quantitative: { jun: otherExam } },
    localStorage: { setItem: () => {} }, operationLocksRef: { current: new Set() },
    alert: () => assert.fail('score entry errors must stay in the form'),
    analysisApiUrl: '/analysis', apiFetch: async (_url, options) => {
      converted.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ std: 120, pct: 90, grd: 2 }) };
    },
    persistQuantitative: async data => { writes.push(data); return { ok: true }; },
    isCurrentProfile: () => true,
    setUser: callback => { ctx.user = callback(ctx.user); saved.push(ctx.user); },
    setScores: () => {}, saveExamScoresMap: () => {}, getExamScoresMap: () => ({}),
    setScoreExamKey: () => {}, ...patch
  };
  for (const field of ['scoreEditState', 'scoreEditStep', 'scoreEditOpen', 'scoreEditErrors', 'scoreEditSaveError', 'scoreSubjectSaving']) {
    ctx[`set${field[0].toUpperCase()}${field.slice(1)}`] = value => { ctx[field] = typeof value === 'function' ? value(ctx[field]) : value; };
  }
  return { ctx, converted, writes, saved, otherExam, handlers: () => createProfileHandlers(ctx) };
}

{
  const h = harness();
  h.ctx.user.quantitative.mar = {
    kor: { opt: '언어와매체', common: 0, elective: 24 },
    math: { opt: '미적분', common: 58, elective: 20 },
    eng: { grade: 2 }, history: { grade: 1 },
    inq1: { name: '생활과 윤리', raw: 0 }, inq2: { name: '사회·문화', raw: 43 }
  };
  h.handlers().openScoreEdit();
  assert.equal(h.ctx.scoreEditState.korean.common, '0');
  assert.equal(h.ctx.scoreEditState.english, '2');
  assert.equal(h.ctx.scoreEditState.history, '1');
}
{
  const h = harness();
  for (let step = 1; step < 6; step++) {
    assert.equal(await h.handlers().saveScoreSubject(), true);
    assert.equal(h.ctx.scoreEditStep, step + 1);
    assert.equal(h.writes.length, 0);
  }
  assert.equal(await h.handlers().saveScoreSubject(), true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.ctx.scoreEditOpen, false);
  assert.deepEqual(h.writes[0].jun, h.otherExam);
  assert.equal(h.writes[0].mar.kor.common, 0);
  assert.equal(h.writes[0].mar.inq1.raw, 0);
  assert.equal(h.converted.length, 4);
  assert.equal(h.converted[0].month, 'mar');
}
{
  const h = harness({ scoreEditStep: 6 });
  h.ctx.scoreEditState.korean.common = '';
  assert.equal(await h.handlers().saveScoreSubject(), false);
  assert.equal(h.ctx.scoreEditStep, 1);
  assert.ok(h.ctx.scoreEditErrors['v2e-korean-common']);
  assert.equal(h.converted.length, 0);
  h.ctx.scoreEditState.korean.common = '1';
  assert.equal(await h.handlers().saveScoreSubject(), false);
  assert.match(h.ctx.scoreEditErrors['v2e-korean-common'], /문항 배점/);
}
for (const outcome of ['failure', 'throw', 'missing', 'conversion', 'stale']) {
  let calls = 0;
  const h = harness({ scoreEditStep: 6,
    persistQuantitative: async () => { calls++; if (outcome === 'throw') throw new Error('offline'); return outcome === 'missing' ? undefined : { ok: false }; },
    isCurrentProfile: () => outcome !== 'stale'
  });
  if (outcome === 'conversion') h.ctx.apiFetch = async () => ({ ok: false, json: async () => ({ error: '환산 확인 실패' }) });
  const initial = structuredClone(h.ctx.scoreEditState);
  assert.equal(await h.handlers().saveScoreSubject(), false);
  assert.equal(h.ctx.scoreEditOpen, true);
  assert.equal(h.ctx.scoreSubjectSaving, false);
  assert.equal(h.saved.length, 0);
  assert.deepEqual(h.ctx.scoreEditState, initial);
  assert.equal(calls, ['conversion', 'stale'].includes(outcome) ? 0 : 1);
  if (outcome !== 'stale') assert.ok(h.ctx.scoreEditSaveError);
  h.ctx.persistQuantitative = async () => ({ ok: true });
  h.ctx.isCurrentProfile = () => true;
  h.ctx.apiFetch = async () => ({ ok: true, json: async () => ({ std: 120, pct: 90, grd: 2 }) });
  assert.equal(await h.handlers().saveScoreSubject(), true);
  assert.equal(h.saved.length, 1);
}
{
  let finish;
  let calls = 0;
  const h = harness({ scoreEditStep: 6, persistQuantitative: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  h.ctx.setScoreSubjectSaving = () => {};
  const action = h.handlers().saveScoreSubject;
  const pending = action();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  assert.equal(await action(), false);
  assert.equal(calls, 1);
  finish({ ok: true });
  assert.equal(await pending, true);
}
{
  let current = true;
  let finish;
  const h = harness({ scoreEditStep: 6, isCurrentProfile: () => current,
    persistQuantitative: () => new Promise(resolve => { finish = resolve; }) });
  const pending = h.handlers().saveScoreSubject();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  current = false;
  finish({ ok: true });
  assert.equal(await pending, false);
  assert.equal(h.saved.length, 0);
  assert.equal(h.ctx.scoreEditOpen, true);
}

const vite = await createServer({ appType: 'custom', logLevel: 'silent', root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true, hmr: false } });
try {
  const { ScoreEditModal } = await vite.ssrLoadModule('/src/screens/profile/ScoreEditModal.jsx');
  const render = patch => renderToStaticMarkup(createElement(ScoreEditModal, { scoreEditOpen: true, scoreEditState: draft(), scoreEditStep: 1, scoreExamType: '3월 모의고사', ...patch }));
  let html = render();
  assert.match(html, /aria-valuenow="1"/);
  assert.match(html, /value="0"/);
  assert.doesNotMatch(html, /score-onepage-metric|score-step-rail|score-step-confirm|score-step-warn|score-direct-help|표준점수 저장 후 계산|입력됨/);
  html = render({ scoreEditErrors: { 'v2e-korean-common': '원점수를 확인해 주세요.' } });
  assert.match(html, /aria-invalid="true" aria-describedby="v2e-korean-common-error"/);
  assert.match(html, /id="v2e-korean-common-error" role="alert"/);
  assert.match(render({ scoreExamKey: 'sep' }), /실제 성적표/);
  assert.doesNotMatch(render({ scoreExamKey: 'mar' }), /score-edit-estimate-notice/);
  assert.match(render({ scoreEditStep: 6, scoreEditSaveError: '저장에 실패했어요.' }), /score-save-error" role="alert"/);
  console.log('Score input presentation passed: six steps, zero/missing, bounds, inline errors, conversion, retries, duplicates and stale-account protection.');
} finally { await vite.close(); }

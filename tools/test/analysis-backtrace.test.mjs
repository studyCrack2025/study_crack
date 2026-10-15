import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../js/analysis/backtrace.js', import.meta.url), 'utf8');
const plan = { reachable: true, minTotalRaw: 4, bySubject: { kor: 4 }, expected: { uiScore: 105 } };

function setup({ tier = 'basic', width = 1440, score = 60, cached = false, ok = true } = {}) {
  const card = { style: {}, innerHTML: '' };
  const calls = [], alerts = [];
  const items = [0, 1].map(index => ({ originalIdx: index, univ: `대학${index}`, major: '학과', base_ui_score: score,
    sim_data: Object.fromEntries(['kor', 'math', 'inq1', 'inq2'].map(key => [key, { uiDiff: 2, name: key }])),
    ...(cached ? { backtrace_plan: plan } : {}) }));
  const context = vm.createContext({
    window: { innerWidth: width },
    document: { getElementById: id => id === 'simDetailCard' ? card : {} },
    currentUserTier: tier, simDisplayList: items, selectedSimIndex: 0, currentExamMode: 'jun',
    userQuantData: { jun: { kor: { raw: 70 } } }, UNIV_DATA_API_URL: '/analysis',
    localStorage: { getItem: () => 'synthetic-user' },
    escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    triggerSubjScrollHintOnce() {}, setTimeout: fn => fn(),
    alert: message => alerts.push(message), console,
    apiFetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok, json: async () => ({ result: plan }) }; }
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  return { run, card, calls, alerts, items };
}

for (const width of [390, 1440]) {
  test(`web ${width}px exposes every target at low, middle and already-passing scores`, () => {
    for (const score of [0, 9, 44, 99, 100, 150, 250]) {
      const { run, card } = setup({ width, score });
      for (const selected of [0, 1]) {
        run(`selectedSimIndex = ${selected}; renderDetailedSimCard()`);
        assert.ok(card.innerHTML.includes(`requestBacktrace(${selected})`), `${score}: target ${selected}`);
        assert.match(card.innerHTML, /필요한 최소 원점수/);
        assert.doesNotMatch(card.innerHTML, /현재 점수로는 합격권 도달이 어렵습니다/);
      }
    }
  });
}

for (const tier of ['basic', 'starter', 'standard', 'pro']) {
  test(`${tier} requests each selected university and reuses its result`, async () => {
    const { run, calls, items, card } = setup({ tier });
    for (const index of [0, 1]) {
      await run(`selectedSimIndex = ${index}; requestBacktrace(${index})`);
      assert.equal(items[index]._uiMode, 'backtrace');
      assert.match(card.innerHTML, /원점수 \+4점/);
      assert.equal(calls[index].targetUniv.univ, `대학${index}`);
      assert.equal(calls[index].examMode, 'jun');
      await run(`goBackFromBacktrace(${index}); requestBacktrace(${index})`);
      assert.equal(calls.length, index + 1);
    }
  });
}

test('unpaid tiers cannot display even a cached plan', async () => {
  for (const tier of ['free', 'trial']) {
    const { run, items, calls } = setup({ tier, cached: true });
    await run('requestBacktrace(0)');
    assert.equal(items[0]._uiMode, 'upsell');
    assert.equal(calls.length, 0);
  }
});

test('already-passing, unreachable, failed and ineligible results stay distinct', async () => {
  const { run, items, card } = setup({ cached: true, score: 150 });
  items[0].backtrace_plan = { ...plan, minTotalRaw: 0, bySubject: {}, expected: { uiScore: 150 } };
  await run('requestBacktrace(0)');
  assert.match(card.innerHTML, /이미 합격 기준에 도달/);
  assert.match(card.innerHTML, /<strong>0점<\/strong>/);
  items[0].backtrace_plan = { reachable: false, error: '<조건 부족>' };
  await run('requestBacktrace(0)');
  assert.match(card.innerHTML, /합격권 도달 어려움/);
  assert.match(card.innerHTML, /&lt;조건 부족&gt;/);
  const failed = setup({ ok: false });
  await failed.run('requestBacktrace(0)');
  assert.equal(failed.items[0]._uiMode, 'default');
  assert.equal(failed.alerts.length, 1);
  failed.items[0].ineligible = true;
  failed.run('renderDetailedSimCard()');
  assert.doesNotMatch(failed.card.innerHTML, /requestBacktrace/);
});

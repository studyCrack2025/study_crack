import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildRulesGrowthPresentation, buildRulesGuidePresentation, buildRulesGuideSteps } from '../src/features/gamification/rules-guide-presentation.js';

const rules = {
  ticketPolicy: { version: 'study-ticket-v1', intervalSeconds: 18000, drawCost: 1 },
  starterPolicy: { version: 'starter-study-v1', minimumSessionSeconds: 600, choiceCount: 3 },
  drawPolicy: {
    version: 'draw-ticket-v1', randomSelection: true, duplicateEffect: 'growth', duplicateExp: { common: 30, rare: 80, epic: 180, legendary: 400 },
    protectedDrawCount: 3, maxLevelRefund: { tickets: 1 }, specialAcquisition: 'achievement_or_event'
  },
  habitatStages: [{ minimumMinutes: 180, label: '풍성한 서식지' }]
};
const growth = { supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-01-01', revision: 12,
  asOf: '2026-10-03T03:00:00.000Z', historyStatus: 'not_available', validDayCount: 12, highestUnlockedStage: 'day7', nextStageDays: 3 };
assert.equal(buildRulesGuidePresentation(rules).ready, true);
for (const value of [null, {}, { ...rules, ticketPolicy: { ...rules.ticketPolicy, version: 'future' } }, { ...rules, ticketPolicy: { ...rules.ticketPolicy, intervalSeconds: 0 } }]) {
  assert.equal(buildRulesGuidePresentation(value).ready, false);
}
for (const status of ['idle', 'loading', 'error', 'unavailable', 'off', 'future']) assert.equal(buildRulesGuidePresentation(rules, status).ready, false);
assert.equal(buildRulesGuidePresentation({ ...rules, starterPolicy: undefined }).starter, null);
assert.equal(buildRulesGuidePresentation({ ...rules, drawPolicy: { ...rules.drawPolicy, randomSelection: false } }).draw, null);
assert.deepEqual(buildRulesGrowthPresentation({ status: 'ready', growth }), { growth, current: 7, next: 15 });
for (const status of ['stale', 'error', 'unavailable', 'account-changed', 'loading']) assert.equal(buildRulesGrowthPresentation({ status, growth }), null);
for (const corrupt of [{ policyVersion: 'future' }, { highestUnlockedStage: 'day100' }, { nextStageDays: 1 }, { validDayCount: -1 }, { revision: 0 }]) {
  assert.equal(buildRulesGrowthPresentation({ status: 'ready', growth: { ...growth, ...corrupt } }), null);
}
const zero = { ...growth, revision: 0, validDayCount: 0, highestUnlockedStage: null, nextStageDays: 1 };
assert.equal(buildRulesGrowthPresentation({ status: 'ready', growth: zero }).current, null, 'a fallback DAY1 image is not proof of a growth unlock');

const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
try {
  const { GameRulesGuide } = await vite.ssrLoadModule('/src/components/aquarium/GameRulesGuide.jsx');
  const { AquariumGrowthContext } = await vite.ssrLoadModule('/src/features/gamification/AquariumGrowthContext.js');
  const render = (props = {}, view = { status: 'ready', growth }) => renderToStaticMarkup(createElement(AquariumGrowthContext.Provider, { value: view }, createElement(GameRulesGuide, { open: true, gameRules: rules, gameProfileStatus: 'ready', ...props })));
  const markup = render();
  assert.match(markup, /확정 공부 5시간마다 1장/);
  assert.match(markup, /1\/4/);
  assert.equal((markup.match(/class="game-rules-step"/g) || []).length, 1);
  assert.match(markup, /alt="보유 뽑기권과 다음 뽑기권까지 남은 시간 예시"/);
  assert.match(markup, /loading="lazy" decoding="async"/);
  assert.match(markup, /화면 예시 · 실제 수량·결과와 달라요/);
  assert.doesNotMatch(markup, /game-rules-illustration|game-rules-ticket/);
  assert.doesNotMatch(markup, /하루 최대 1일|DAY 7|첫 3회|Lv.10/);
  const legacySteps = buildRulesGuideSteps(buildRulesGuidePresentation(rules));
  assert.equal(legacySteps.length, 4);
  assert.match(legacySteps[2].title, /뽑기권 1장/);
  assert.match(legacySteps[3].body, /성장 경험치/);
  const planRules = { ...rules, ticketPolicy: { version: 'planner-ticket-v1', minimumPlanMinutes: 30, boostPlanMinutes: [120, 240], drawCost: 1, completionMode: 'server_check', grantPerPlan: 1 },
    drawPolicy: { version: 'draw-plan-v1', randomSelection: true, duplicateEffect: 'none', specialAcquisition: 'achievement_or_event' } };
  const planMarkup = render({ gameRules: planRules });
  assert.match(planMarkup, /alt="국어 30분 예시 계획의 완료 체크 버튼"/);
  const { rulesGuideExample } = await vite.ssrLoadModule('/src/components/aquarium/game-rules-examples.js');
  const bytes = [];
  const seen = new Set();
  for (const policy of [rules, planRules]) for (let index = 0; index < 4; index++) {
    const asset = rulesGuideExample(buildRulesGuidePresentation(policy), index);
    assert.ok(asset.alt && asset.focus && asset.width > 0 && asset.height > 0);
    assert.match(asset.src, /\/src\/assets\/game-rules\/[a-z-]+\.webp$/);
    if (seen.has(asset.src)) continue;
    seen.add(asset.src);
    const buffer = await readFile(new URL(`../src/assets/game-rules/${asset.src.split('/').at(-1)}`, import.meta.url));
    assert.equal(buffer.toString('ascii', 0, 4), 'RIFF'); assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
    assert.ok(buffer.length < 20 * 1024, 'each compressed example stays below 20 KiB'); bytes.push(buffer.length);
    let size;
    for (let offset = 12; offset + 8 < buffer.length;) {
      const type = buffer.toString('ascii', offset, offset + 4), length = buffer.readUInt32LE(offset + 4), data = offset + 8;
      if (type === 'VP8 ') size = [buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff];
      offset = data + length + (length % 2);
    }
    assert.deepEqual(size, [asset.width, asset.height], 'intrinsic dimensions match the captured WebP');
  }
  assert.equal(seen.size, 7); assert.ok(bytes.reduce((a, b) => a + b, 0) < 64 * 1024);
  assert.equal(rulesGuideExample({ ready: false }, 0), null);
  assert.equal(rulesGuideExample(buildRulesGuidePresentation(planRules), 1.5), null);
  const altered = render({ gameRules: { ...rules, ticketPolicy: { ...rules.ticketPolicy, intervalSeconds: 7200 } } });
  assert.match(altered, /확정 공부 2시간마다 1장/); assert.doesNotMatch(altered, /확정 공부 5시간/);
  const planSteps = buildRulesGuideSteps(buildRulesGuidePresentation(planRules));
  assert.equal(planSteps.length, 4);
  assert.match(planMarkup, /30분 이상 계획을 세워요/);
  assert.match(planSteps[1].body, /완료 취소·재완료로는 다시 지급되지/);
  assert.match(planSteps[3].body, /경험치·배치는 그대로/);
  assert.doesNotMatch(JSON.stringify(planSteps), /확정 공부 5시간|돌려받아요|성장 경험치/);
  assert.doesNotMatch(planMarkup, /\d+%|풍성한 서식지|180분|플랑크톤|조개/);
  for (const status of ['idle', 'loading', 'error', 'unavailable', 'off', 'ready']) {
    const unknown = render({ gameRules: null, gameProfileStatus: status });
    assert.doesNotMatch(unknown, /30분 이상|5시간|10분 이상|경험치|무작위|game-rules-step"/);
    assert.equal(buildRulesGuideSteps(buildRulesGuidePresentation(null, status)).length, 0);
  }
  assert.match(render({ gameRules: null }), /공부 보상 규칙 확인 필요/);
  assert.match(render({ gameProfileStatus: 'loading' }), /규칙을 불러오는 중/);
  assert.match(render({ gameProfileStatus: 'unavailable' }), /수조 기능을 준비/);
  const partial = buildRulesGuidePresentation({ ...planRules, drawPolicy: rules.drawPolicy });
  assert.equal(partial.draw, null);
  for (const index of [2, 3]) assert.equal(rulesGuideExample(partial, index), null);
  assert.match(buildRulesGuideSteps(partial)[2].title, /확인/);
  assert.doesNotMatch(buildRulesGuideSteps(partial)[3].body, /그대로|경험치/);
  for (const ticketPolicy of [{ ...planRules.ticketPolicy, boostPlanMinutes: [120] }, { ...planRules.ticketPolicy, grantPerPlan: 2 }, { ...planRules.ticketPolicy, completionMode: 'timer' }]) {
    assert.equal(buildRulesGuidePresentation({ ...planRules, ticketPolicy }).ready, false);
  }
  assert.equal(render({ open: false }), '');
} finally { await vite.close(); }
const source = await readFile(new URL('../src/components/aquarium/GameRulesGuide.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(source, /habitatStages|Math\.random|localStorage|sessionStorage|fetch\(/);
assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
assert.match(source, /key=\{example\?\.src \|\| 'unavailable'\}/);
console.log('Aquarium rules guide contracts passed: separate reward and planner growth axes, server values, policy guards, image fallback and unknown states.');

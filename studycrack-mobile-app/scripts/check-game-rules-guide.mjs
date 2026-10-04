import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildRulesGrowthPresentation, buildRulesGuidePresentation } from '../src/features/gamification/rules-guide-presentation.js';

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
for (const status of ['idle', 'loading', 'error', 'unavailable']) assert.equal(buildRulesGuidePresentation(rules, status).ready, false);
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
  assert.match(markup, /10분 이상 공부 완료/);
  assert.match(markup, /확정 공부 5시간마다 1장/);
  assert.match(markup, /뽑기권 1장으로 만나기/);
  assert.match(markup, /하루 최대 1일/);
  assert.match(markup, /성장 인정 <b>12일<\/b> · 다음 배경까지 3일/);
  assert.match(markup, /DAY 7 수조 배경/);
  assert.match(markup, /DAY 15 수조 배경/);
  assert.match(markup, /무작위로 만나는 친구/);
  assert.doesNotMatch(markup, /\d+%|\d+회 안에는/);
  assert.match(markup, /첫 3회는 뽑힌 등급/);
  assert.match(markup, /뽑기권 1장을 돌려받아요/);
  const planRules = { ...rules, ticketPolicy: { version: 'planner-ticket-v1', minimumPlanMinutes: 30, boostPlanMinutes: [120, 240], drawCost: 1, completionMode: 'server_check', grantPerPlan: 1 },
    drawPolicy: { version: 'draw-plan-v1', randomSelection: true, duplicateEffect: 'none', specialAcquisition: 'achievement_or_event' } };
  const planMarkup = render({ gameRules: planRules });
  assert.match(planMarkup, /30분 이상 계획 첫 완료마다 1장/);
  assert.match(planMarkup, /완료 취소·재완료로는 다시 지급되지/);
  assert.match(planMarkup, /2시간·4시간 이상 계획/);
  assert.match(planMarkup, /경험치·배치는 그대로/);
  assert.doesNotMatch(planMarkup, /\d+%|확정 공부 5시간|돌려받아요|경험치로 반영/);
  assert.doesNotMatch(markup, /풍성한 서식지|180분|플랑크톤|조개/);
  assert.match(render({ gameRules: null }), /공부 보상 규칙 확인 필요/);
  assert.doesNotMatch(render({ gameRules: null }), /확정 공부 5시간|10분 이상|70%/);
  assert.doesNotMatch(render({}, { status: 'stale', growth }), /성장 인정|DAY 7 수조 배경/);
  assert.match(render({}, { status: 'stale', growth }), /성장 기록 확인 필요/);
  assert.equal(render({ open: false }), '');
} finally { await vite.close(); }
const source = await readFile(new URL('../src/components/aquarium/GameRulesGuide.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(source, /habitatStages|Math\.random|localStorage|sessionStorage|fetch\(/);
assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
console.log('Aquarium rules guide contracts passed: separate reward and planner growth axes, server values, policy guards, image fallback and unknown states.');

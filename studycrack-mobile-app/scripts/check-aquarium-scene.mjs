import assert from 'node:assert/strict';
import './check-aquarium-growth.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createScreenContext } from '../src/app/screen-context.js';
import { aquariumCollectionLabel, aquariumShareText, buildAquariumPresentation, normalizeAquariumSlots } from '../src/features/gamification/aquarium-presentation.js';

const first = Object.freeze({ fishId: 'fish-1', speciesId: 'clownfish', name: '친구', growthStage: 'growing' });
const second = Object.freeze({ ...first, fishId: 'fish-2' });
const third = Object.freeze({ ...first, fishId: 'fish-3', speciesId: 'retired' });
const input = Object.freeze({
  activeFish: Object.freeze([first, second, third, { ...first, fishId: 'fish-4' }]),
  fishInventory: Object.freeze([first, second, third]), fishCount: 3,
  gameProfile: Object.freeze({ streakDays: 12, updatedAt: '2026-09-06T03:00:00Z' }), gameProfileStatus: 'ready',
  fishCatalog: Object.freeze([{ speciesId: 'clownfish' }, { speciesId: 'blue_damsel' }, { speciesId: 'blue_damsel' }, { speciesId: 'retired', status: 'legacy' }]), fishCatalogStatus: 'ready',
  todayPlannerItems: Object.freeze([{ date: '2026-09-06', done: true }, { date: '2026-09-06', done: false }])
});
const snapshot = buildAquariumPresentation(input);
assert.equal(snapshot.ownedCount, 3);
assert.equal(snapshot.activeCount, 3);
assert.deepEqual(snapshot.collection, { status: 'ready', collected: 1, total: 2, percent: 50 });
assert.equal(snapshot.planner.percent, 50);
assert.equal(snapshot.planner.date, '2026-09-06');
assert.equal(snapshot.streakDays, 12);
assert.equal(snapshot.asOf, input.gameProfile.updatedAt);
assert.equal(aquariumCollectionLabel(snapshot), '1 / 2종');
assert.match(aquariumShareText(snapshot), /물고기 1\/2종 · 연속 학습 12일/);
for (const total of [12, 85]) {
  const catalog = Array.from({ length: total }, (_, index) => ({ speciesId: `species-${index}`, owned: index === 0 }));
  const result = buildAquariumPresentation({ ...input, fishCatalog: catalog });
  assert.equal(aquariumCollectionLabel(result), `1 / ${total}종`);
  assert.equal(aquariumShareText(result), `공부로 키운 나의 수조: 물고기 1/${total}종 · 연속 학습 12일`);
}
assert.equal(snapshot.backgroundKey, 'day1');
for (const streakDays of [0, 7, 15, 30, 50, 100, 200]) assert.equal(buildAquariumPresentation({ ...input, gameProfile: { streakDays, backgroundKey: 'day100' } }).backgroundKey, 'day1');
assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.slots) && Object.isFrozen(snapshot.slots[0]) && Object.isFrozen(snapshot.collection));
assert.notEqual(snapshot.slots[0], first);
assert.deepEqual(normalizeAquariumSlots([first, first, second, third]).map(fish => fish?.fishId || null), ['fish-1', null, 'fish-2']);
assert.deepEqual(normalizeAquariumSlots(null), [null, null, null]);
assert.deepEqual(normalizeAquariumSlots([{}, { fishId: '', speciesId: 'a' }, { fishId: 'a' }]), [null, null, null]);
for (const status of ['idle', 'loading', 'error', 'unavailable']) {
  const unknown = buildAquariumPresentation({ ...input, gameProfileStatus: status, fishCatalogStatus: status });
  assert.equal(unknown.status, status);
  assert.equal(unknown.streakDays, null);
  assert.equal(unknown.activeCount, null);
  assert.equal(unknown.ownedCount, null);
  assert.equal(unknown.collection.total, null);
  assert.doesNotMatch(aquariumShareText(unknown), /0일|\/12종|0마리/);
}
for (const value of [null, undefined, '', false, -1, NaN, Infinity]) {
  assert.equal(buildAquariumPresentation({ ...input, gameProfile: { streakDays: value } }).streakDays, null);
}
const empty = buildAquariumPresentation({ ...input, activeFish: [], fishInventory: [], fishCatalog: [], fishCount: 0, gameProfile: { streakDays: 0 }, todayPlannerItems: [] });
assert.equal(empty.streakDays, 0);
assert.equal(empty.ownedCount, 0);
assert.equal(empty.collection.total, 0);
assert.equal(empty.collection.percent, null);
assert.equal(empty.planner.percent, null);
assert.match(aquariumShareText(empty), /물고기 0\/0종 · 연속 학습 0일/);
assert.equal(buildAquariumPresentation({ ...input, fishCatalog: undefined }).collection.total, null);
assert.equal(buildAquariumPresentation({ ...input, todayPlannerItems: undefined }).planner.status, 'unknown');
assert.equal(buildAquariumPresentation({ ...input, todayPlannerItems: [{ date: '2026-09-05' }, { date: '2026-09-06' }] }).planner.status, 'date-mismatch');

const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
try {
  const { AquariumNextStudy } = await vite.ssrLoadModule('/src/screens/aquarium/AquariumNextStudy.jsx');
  const nextProps = { canAccessBasic: true, planner: { status: 'ready' }, items: [{ content: '완료한 공부', done: true }, { content: '다음 수학', subject: '수학', minutes: 90, done: false }] };
  const renderNext = props => renderToStaticMarkup(createElement(AquariumNextStudy, props));
  const nextMarkup = renderNext(nextProps);
  const screenContext = createScreenContext('aquarium', { canAccessBasic: true, todayPlannerItems: nextProps.items, studyOverview: { planner: nextProps.planner } });
  assert.equal(screenContext.canAccessBasic, true);
  assert.match(renderNext({ canAccessBasic: screenContext.canAccessBasic, items: screenContext.todayPlannerItems, planner: screenContext.studyOverview.planner }), /다음 수학/);
  assert.match(nextMarkup, /NEXT ACTION · 수학/);
  assert.match(nextMarkup, /다음 수학/);
  assert.match(nextMarkup, /<b>90<\/b>/);
  assert.match(nextMarkup, /data-action="goto" data-target="planner"/);
  assert.doesNotMatch(nextMarkup, /완료한 공부|selectStudySubject|자동 급식|55\.5/);
  assert.match(renderNext({ ...nextProps, items: [] }), /첫 공부 계획/);
  assert.match(renderNext({ ...nextProps, items: [{ done: true }] }), /모두 체크/);
  for (const props of [{ ...nextProps, canAccessBasic: false }, { ...nextProps, planner: { status: 'date-mismatch' } }, { ...nextProps, planner: null }]) {
    assert.doesNotMatch(renderNext(props), /다음 수학|<b>90<\/b>|모두 체크/);
  }
  for (const minutes of [0, -1, 'unknown', Infinity, null]) assert.doesNotMatch(renderNext({ ...nextProps, items: [{ content: '시간 미정', minutes }] }), /<b>/);
  assert.match(renderNext({ ...nextProps, items: [null, { content: '<img onerror=alert(1)>', minutes: 10 }] }), /&lt;img onerror=alert\(1\)&gt;/);
  const { AquariumScene } = await vite.ssrLoadModule('/src/components/aquarium/AquariumScene.jsx');
  const { AquariumGrowthContext } = await vite.ssrLoadModule('/src/features/gamification/AquariumGrowthContext.js');
  for (const backgroundKey of ['day1', 'day7', 'day15', 'day30', 'day50', 'day100']) {
    for (const variant of ['full', 'home', 'guide', 'share']) {
      const markup = renderToStaticMarkup(createElement(AquariumGrowthContext.Provider, { value: { status: 'ready', backgroundKey, growth: { validDayCount: Number(backgroundKey.slice(3)), highestUnlockedStage: backgroundKey, countingSince: '2026-01-01', nextStageDays: null } } }, createElement(AquariumScene, { variant, backgroundKey: 'day1' })));
      assert.match(markup, new RegExp(`data-background-key="${backgroundKey}"`));
      assert.match(markup, /성장 인정/);
      if (variant !== 'full') assert.doesNotMatch(markup, /<button/);
    }
  }
  const { AquariumScreen } = await vite.ssrLoadModule('/src/screens/aquarium/AquariumScreen.jsx');
  for (const gameProfileStatus of ['idle', 'loading']) {
    const screen = renderToStaticMarkup(createElement(AquariumScreen, { gameProfileStatus }));
    assert.doesNotMatch(screen, /class="aquarium-scene-background"/, 'do not mount a transient image before the profile is ready');
    assert.match(screen, /수조를 채우고 있어요/);
  }
  const { aquariumBackground } = await vite.ssrLoadModule('/src/components/aquarium/aquarium-backgrounds.js');
  for (const key of ['day1', 'day7', 'day15', 'day30', 'day50', 'day100']) {
    const asset = aquariumBackground(key);
    assert.equal(asset.key, key);
    assert.equal(asset.height, 502);
    assert.equal(asset.width, key === 'day100' ? 376 : 377);
    assert.ok(Object.isFrozen(asset));
    assert.match(asset.src, /day-\d+\.png/);
  }
  for (const key of ['day200', 'https://invalid.example/background.png', '__proto__', null, {}, 100]) assert.equal(aquariumBackground(key).key, 'day1');
  const render = props => renderToStaticMarkup(createElement(AquariumScene, props));
  const props = { slots: snapshot.slots, catalog: input.fishCatalog, stats: snapshot, selectedFishId: 'fish-1' };
  const full = render(props);
  assert.equal((full.match(/<button /g) || []).length, 3);
  assert.equal((full.match(/data-action="selectAquariumFish"/g) || []).length, 3);
  assert.match(full, /12일/);
  assert.match(full, /1\/2/);
  assert.match(full, /is-selected/);
  assert.match(full, /data-background-key="day1"/);
  assert.equal((full.match(/class="aquarium-scene-background"/g) || []).length, 1);
  assert.doesNotMatch(full, /aquarium-(plants|ground|bubbles|rays|water-line)/);
  for (const variant of ['home', 'guide', 'share', 'untrusted']) {
    const markup = render({ ...props, variant });
    assert.doesNotMatch(markup, /<button|data-action|aquarium-fish-name|is-selected/);
    assert.equal((markup.match(/role="img"/g) || []).length, 3);
    assert.match(markup, new RegExp(`data-scene-variant="${variant === 'untrusted' ? 'home' : variant}"`));
    if (variant === 'share') assert.match(markup, /12일/);
    else assert.doesNotMatch(markup, /aquarium-scene-hud/);
  }
  assert.doesNotMatch(render({ slots: [], variant: 'share' }), /0日|0일|0\/0/);
  const injected = [];
  render({ slots: [{ ...first, assetKey: 'fishdex-045-percula-clownfish' }], catalog: [{ speciesId: first.speciesId, motionProfile: 'bad', colors: ['url(https://invalid.example)', '#FFF'] }], renderFish: props => { injected.push(props); return null; } });
  assert.equal(injected.length, 1);
  assert.equal(injected[0].assetKey, 'fishdex-045-percula-clownfish');
  assert.equal(injected[0].colors, undefined);
  assert.match(render({ slots: [first], catalog: [{ speciesId: first.speciesId, motionProfile: 'bad' }] }), /data-motion="short-loop"/);
} finally {
  await vite.close();
}

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [sceneSource, screenSource, sceneCss, screenCss, tokenCss] = await Promise.all([
  read('../src/components/aquarium/AquariumScene.jsx'), read('../src/screens/aquarium/AquariumScreen.jsx'),
  read('../src/styles/components/aquarium-scene.css'), read('../src/styles/screens/aquarium.css'), read('../src/styles/foundation/tokens.css')
]);
assert.doesNotMatch(sceneSource, /\bfetch\(|localStorage|sessionStorage|Math\.random|Date\.now|backgroundImage|url\(/);
assert.doesNotMatch(screenSource, /function AquariumScene\(/);
for (const selector of ['.aquarium-scene{', '.aquarium-fish-path{', '@keyframes aquariumFishPath']) {
  assert.ok(sceneCss.includes(selector));
  assert.ok(!screenCss.includes(selector));
}
assert.match(tokenCss, /--sc-radius-card:16px;--sc-radius-scene:24px;/);
assert.match(sceneCss, /prefers-reduced-motion:reduce/);
assert.match(sceneCss, /animation:none !important;transition:none !important/);
const rgb = token => tokenCss.match(new RegExp(`${token}:#([0-9a-f]{6})`, 'i'))[1].match(/../g).map(value => parseInt(value, 16));
const mix = (foreground, background, alpha) => foreground.map((value, index) => value * alpha + background[index] * (1 - alpha));
const luminance = color => color.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const background = rgb('--sc-brand-navy-deep'), foreground = rgb('--sc-on-brand');
const surfaceAlpha = Number(tokenCss.match(/--sc-on-brand-surface:rgba\(255,255,255,([\d.]+)\)/)[1]);
const secondaryAlpha = Number(sceneCss.match(/\.aquarium-scene-hud small\{color:color-mix\(in srgb,var\(--sc-surface-card\) (\d+)%/)[1]) / 100;
const buttonBackground = mix(foreground, background, surfaceAlpha);
for (const [label, text, surface] of [['caption', foreground, background], ['HUD secondary', mix(rgb('--sc-surface-card'), background, secondaryAlpha), background], ['retry button', foreground, buttonBackground], ['unlock nested button', foreground, mix(foreground, buttonBackground, surfaceAlpha)]]) {
  const ratio = (Math.max(luminance(text), luminance(surface)) + .05) / (Math.min(luminance(text), luminance(surface)) + .05);
  assert.ok(ratio >= 4.5, `${label} contrast must meet AA: ${ratio.toFixed(2)}`);
}
console.log('Aquarium scene contracts passed: three slots, read-only previews, shared known/unknown statistics, collection sets, local dates, artwork guards and deferred CSS ownership.');

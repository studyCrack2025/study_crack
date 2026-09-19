import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createGamificationHandlers } from '../src/handlers/gamification-handlers.js';
import { createTimerHandlers } from '../src/handlers/timer-handlers.js';
import { buildAquariumJourneyPresentation, nextFishDexFilter } from '../src/screens/aquarium/presentation.js';

assert.equal(nextFishDexFilter('all', 'ArrowRight'), 'owned');
assert.equal(nextFishDexFilter('all', 'ArrowLeft'), 'locked');
assert.equal(nextFishDexFilter('owned', 'End'), 'locked');
assert.equal(nextFishDexFilter('locked', 'Home'), 'all');

const rewarded = buildAquariumJourneyPresentation({
  fishCount: 0,
  profile: {
    shellBalance: 2,
    foodBalance: 2,
    starterFishUnlocked: true,
    starterState: 'selectable'
  }
});

assert.equal(rewarded.rewardState, 'complete');
assert.equal(rewarded.aquariumState, 'active');
assert.equal(rewarded.fishDexState, 'pending');

const terminalProfile = {
  activeFishIds: [null, null, null],
  dailyReward: { date: '2026-09-04', food: 2, shells: 2, studySeconds: 1500 },
  foodBalance: 2,
  shellBalance: 2,
  starterFishUnlocked: true,
  starterState: 'selectable'
};
const timerContext = {
  activePlannerItemId: '',
  activeStudySession: { sessionId: 'session-aquarium-1234', startedAt: '2026-09-04T01:00:00.000Z', status: 'running', subject: '국어', activity: '독서 지문 분석' },
  activeStudySubject: '국어',
  gameRefreshTick: 0,
  operationLocksRef: { current: new Set() },
  plannerItems: [],
  rewardPendingSessionId: '',
  studyRecords: [],
  studySubjectRecords: [],
  studySummaryRefreshTick: 0,
  studyTimerSecondsRef: { current: 1500 },
  timerPhase: 'running',
  async completeStudySession(sessionId, setPhase) {
    setPhase('settling-session');
    return {
      completion: { ok: true, data: { ...this.activeStudySession, sessionId, status: 'completed', endedAt: '2026-09-04T01:25:00.000Z', durationSeconds: 1500 } },
      reward: { ok: true, data: { sessionId, durationSeconds: 1500, reward: { shells: 2, food: 2 }, profile: terminalProfile } }
    };
  },
  setActivePlannerItemId(value) { this.activePlannerItemId = value; },
  setActiveStudySession(value) { this.activeStudySession = value; },
  setActiveStudySubject(value) { this.activeStudySubject = value; },
  setCompletionError(value) { this.completionError = value; },
  setGameProfile(value) { this.gameProfile = value; },
  setGameProfileError(value) { this.gameProfileError = value; },
  setGameProfileStatus(value) { this.gameProfileStatus = value; },
  setGameRefreshTick(updater) { this.gameRefreshTick = updater(this.gameRefreshTick); },
  setLastCompletedSession(value) { this.lastCompletedSession = value; },
  setPlannerItems(updater) { this.plannerItems = updater(this.plannerItems); },
  setRewardPendingSessionId(value) { this.rewardPendingSessionId = value; },
  setRewardResult(value) { this.rewardResult = value; },
  setStudyRecords(updater) { this.studyRecords = updater(this.studyRecords); },
  setStudySubjectRecords(updater) { this.studySubjectRecords = updater(this.studySubjectRecords); },
  setStudySummaryRefreshTick(updater) { this.studySummaryRefreshTick = updater(this.studySummaryRefreshTick); },
  setStudyTimerRunning(value) { this.studyTimerRunning = value; },
  setStudyTimerTick(value) { this.studyTimerTick = value; },
  setTimerPhase(value) { this.timerPhase = value; },
  stopLiveStudyTimer() {},
  syncLiveStudyTimerUi() {}
};
assert.equal(await createTimerHandlers(timerContext).stopStudyTimer(), true);
assert.equal(timerContext.timerPhase, 'rewarded');
assert.equal(timerContext.gameProfile, terminalProfile, 'timer reward must apply the authoritative profile without reconstructing it');
assert.deepEqual(timerContext.rewardResult, { sessionId: 'session-aquarium-1234', durationSeconds: 1500, shells: 2, food: 2, alreadyClaimed: false });
assert.equal(timerContext.gameRefreshTick, 1, 'reward success must trigger the existing aquarium resource refresh');

const starterFish = { fishId: 'fish-owned-1', speciesId: 'blue_damsel', name: '마루', level: 1, exp: 0, progressPct: 0, growthStage: 'baby' };
const claimedProfile = { ...terminalProfile, activeFishIds: [null, starterFish.fishId, null], starterState: 'claimed' };
const aquariumContext = {
  activeFish: [],
  aquariumActionStatus: 'idle',
  aquariumStarterSpeciesId: 'blue_damsel',
  fishCount: 0,
  fishInventory: [],
  gameRefreshTick: timerContext.gameRefreshTick,
  operationLocksRef: { current: new Set() },
  async claimAquariumStarter() { return { ok: true, data: { fish: starterFish, profile: claimedProfile } }; },
  setActiveFish(value) { this.activeFish = typeof value === 'function' ? value(this.activeFish) : value; },
  setAquariumActionError(value) { this.aquariumActionError = value; },
  setAquariumActionStatus(value) { this.aquariumActionStatus = value; },
  setAquariumResult(value) { this.aquariumResult = value; },
  setAquariumSelectedFishId(value) { this.aquariumSelectedFishId = value; },
  setFishCount(updater) { this.fishCount = updater(this.fishCount); },
  setFishInventory(updater) { this.fishInventory = updater(this.fishInventory); },
  setGameProfile(value) { this.gameProfile = value; },
  setGameRefreshTick(updater) { this.gameRefreshTick = updater(this.gameRefreshTick); }
};
assert.equal(await createGamificationHandlers(aquariumContext).claimStarterFish(), true);
assert.equal(aquariumContext.gameProfile, claimedProfile);
assert.equal(aquariumContext.fishCount, 1);
assert.equal(aquariumContext.fishInventory[0], starterFish);
assert.equal(buildAquariumJourneyPresentation({ fishCount: aquariumContext.fishCount, profile: aquariumContext.gameProfile }).fishDexState, 'complete');

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true }
});
try {
  const [{ AquariumScreen }, { StudyJourneyPanel }] = await Promise.all([
    vite.ssrLoadModule('/src/screens/aquarium/AquariumScreen.jsx'),
    vite.ssrLoadModule('/src/screens/timer/StudyGamificationPanels.jsx')
  ]);
  const rewardedMarkup = renderToStaticMarkup(AquariumScreen({
    fishCatalog: [],
    fishCatalogStatus: 'ready',
    fishCount: 0,
    gameProfile: {
      activeFishIds: [null, null, null],
      dailyReward: {},
      foodBalance: 2,
      shellBalance: 2,
      starterFishUnlocked: true,
      starterState: 'selectable'
    },
    gameProfileStatus: 'ready',
    pendingDrawStatus: 'ready',
    tab: 'aquarium'
  }));
  assert.match(rewardedMarkup, /<section[^>]*class="aquarium-journey"[^>]*aria-label="공부 보상 여정"/, 'The non-interactive journey must use a labelled section instead of a navigation landmark.');
  assert.doesNotMatch(rewardedMarkup, /<nav[^>]*class="aquarium-journey"/, 'The non-interactive journey must not create a navigation landmark.');
  assert.match(rewardedMarkup, /data-step="reward" data-state="complete"/);
  assert.match(rewardedMarkup, /data-step="aquarium" data-state="active"/);
  assert.match(rewardedMarkup, /data-step="fishdex" data-state="pending"/);
  assert.match(rewardedMarkup, /class="aquarium-wallet" role="group" aria-label="수조 재화"[\s\S]*조개 <b>2<\/b>[\s\S]*먹이 <b>2<\/b>/);
  assert.match(rewardedMarkup, /class="sc-empty is-offline aquarium-offline-state"/);
  assert.match(rewardedMarkup, /data-action="retryGameResources"[^>]*>연결 후 다시 불러오기<\/button>/);

  const aquariumLoadingMarkup = renderToStaticMarkup(AquariumScreen({
    gameProfileStatus: 'loading',
    tab: 'aquarium'
  }));
  assert.match(aquariumLoadingMarkup, /role="status" aria-live="polite" aria-busy="true"><h3>수조를 채우고 있어요<\/h3>/);
  assert.doesNotMatch(aquariumLoadingMarkup, /class="aquarium-journey"/, 'Authoritative aquarium journey progress must stay hidden until the game profile is ready.');

  const missingProfileMarkup = renderToStaticMarkup(AquariumScreen({
    gameProfileStatus: 'ready',
    tab: 'aquarium'
  }));
  assert.doesNotMatch(missingProfileMarkup, /class="aquarium-journey"/, 'Authoritative aquarium journey progress must stay hidden when a ready response has no profile.');

  const timerRewardMarkup = renderToStaticMarkup(StudyJourneyPanel({
    lastCompletedSession: {
      activity: '독서 지문 분석',
      durationSeconds: 1500,
      sessionId: 'session-aquarium-1234',
      subject: '국어'
    },
    rewardResult: {
      food: 2,
      sessionId: 'session-aquarium-1234',
      shells: 2
    },
    timerPhase: 'rewarded'
  }));
  assert.match(timerRewardMarkup, /data-action="goto" data-target="aquarium"[^>]*>수조에서 확인<\/button>/);

  const catalogLoadingMarkup = renderToStaticMarkup(AquariumScreen({
    aquariumMode: 'catalog',
    fishCatalogStatus: 'loading',
    gameProfile: rewarded.profile,
    gameProfileStatus: 'ready',
    pendingDrawStatus: 'ready',
    tab: 'aquarium'
  }));
  assert.match(catalogLoadingMarkup, /role="status" aria-live="polite" aria-busy="true"><h3>FishDex를 불러오고 있어요<\/h3>/);

  const catalogErrorMarkup = renderToStaticMarkup(AquariumScreen({
    aquariumMode: 'catalog',
    fishCatalogError: '물고기 목록을 불러오지 못했습니다.',
    fishCatalogStatus: 'error',
    gameProfileStatus: 'ready',
    pendingDrawStatus: 'ready',
    tab: 'aquarium'
  }));
  assert.match(catalogErrorMarkup, /role="alert"><h3>FishDex를 불러오지 못했어요<\/h3>/);
  assert.match(catalogErrorMarkup, /data-action="retryGameResources"[^>]*>다시 불러오기<\/button>/);

  const catalogEmptyMarkup = renderToStaticMarkup(AquariumScreen({
    aquariumMode: 'catalog',
    fishCatalog: [],
    fishCatalogStatus: 'ready',
    gameProfileStatus: 'ready',
    pendingDrawStatus: 'ready',
    tab: 'aquarium'
  }));
  assert.match(catalogEmptyMarkup, /class="sc-empty is-empty aquarium-catalog-status"[^>]*>[\s\S]*<h3>FishDex가 아직 비어 있어요<\/h3>/);

  const catalogMarkup = renderToStaticMarkup(AquariumScreen({
    aquariumMode: 'catalog',
    fishCatalog: [
      { speciesId: 'blue_damsel', displayName: '파랑돔', defaultName: '마루', rarity: 'common', category: 'marine_fish', colors: ['#315de6'], owned: true },
      { speciesId: 'butterflyfish', displayName: '나비고기', defaultName: '나비', rarity: 'rare', category: 'marine_fish', colors: ['#f3d44a'], owned: false }
    ],
    fishCatalogStatus: 'ready',
    fishCount: 1,
    fishInventory: [{ fishId: 'fish-owned-1', speciesId: 'blue_damsel', name: '마루', level: 1, exp: 0, progressPct: 0, growthStage: 'baby' }],
    gameProfile: { starterState: 'claimed', shellBalance: 2, foodBalance: 2 },
    gameProfileStatus: 'ready',
    pendingDrawStatus: 'ready',
    tab: 'aquarium'
  }));
  assert.match(catalogMarkup, /role="group" aria-label="FishDex 획득 상태"/, 'FishDex status filters must expose a labelled button group.');
  assert.match(catalogMarkup, /<button(?=[^>]*data-fishdex-filter="all")(?=[^>]*aria-pressed="true")[^>]*>전체<\/button>/, 'The selected FishDex status filter must expose pressed state.');
  assert.doesNotMatch(catalogMarkup, /role="(?:tablist|tab)"/, 'FishDex status filters must not expose an incomplete tabs pattern.');
  assert.match(catalogMarkup, /<article class="is-locked" data-state="locked"[^>]*aria-label="미획득 물고기"/);
  assert.doesNotMatch(catalogMarkup.match(/<article class="is-locked"[\s\S]*?<\/article>/)?.[0] || '', /나비고기/);
} finally {
  await vite.close();
}

const aquariumCss = await readFile(new URL('../src/styles/screens/aquarium.css', import.meta.url), 'utf8');
const packageSource = await readFile(new URL('../package.json', import.meta.url), 'utf8');
assert.match(aquariumCss, /\.aquarium-offline-state\{[^}]*display:none/);
assert.match(aquariumCss, /html\[data-network-status="offline"\] \.aquarium-offline-state\{[^}]*display:grid/);
assert.match(aquariumCss, /\.aquarium-mode-header > button\{[^}]*width:var\(--sc-touch-target\);[^}]*height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /\.aquarium-catalog-filter button\{[^}]*min-height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /\.aquarium-catalog-categories button\{[^}]*min-height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /\.aquarium-slot-control button\{[^}]*min-height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /\.aquarium-care-result button\{[^}]*min-width:var\(--sc-touch-target\);[^}]*min-height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /\.aquarium-manage-result button\{[^}]*min-width:var\(--sc-touch-target\);[^}]*min-height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /\.aquarium-sound-toggle\{[^}]*width:var\(--sc-touch-target\);[^}]*height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /\.aquarium-resource-notice button\{[^}]*min-height:var\(--sc-touch-target\)/);
assert.match(aquariumCss, /@media \(prefers-reduced-motion:reduce\)\{\.aquarium-screen \*,\.aquarium-draw-result,\.aquarium-draw-result \*\{animation:none !important;transition:none !important;/);
assert.match(packageSource, /check-phase-two-planner-tracer\.mjs && node scripts\/check-phase-two-aquarium-tracer\.mjs && node scripts\/check-phase-three-auth-onboarding-tracer\.mjs/);

console.log('Phase 2 aquarium tracer presentation contract passed.');

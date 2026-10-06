import { AnimatedDetails } from '../../components/AnimatedDetails.jsx';
import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { AquariumGrowthContext } from '../../features/gamification/AquariumGrowthContext.js';
import { PrimaryScreenHeader } from '../../components/PrimaryScreenHeader.jsx';
import { catalogMeta } from './aquarium-panel-shared.jsx';
import { buildRulesGuidePresentation } from '../../features/gamification/rules-guide-presentation.js';
import { FishCarePanel } from './FishCarePanel.jsx';
import { FishInventoryPanel } from './FishInventoryPanel.jsx';
import { FishDexPanel } from './FishDexPanel.jsx';
import { DiscoveryPanel, DiscoveryResult } from './DiscoveryPanel.jsx';
import { AquariumSharePanel } from './AquariumSharePanel.jsx';
import { AquariumScene } from '../../components/aquarium/AquariumScene.jsx';

import { AQUARIUM_SLOTS, aquariumCollectionLabel, buildAquariumPresentation } from '../../features/gamification/aquarium-presentation.js';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { Icon } from '../../components/Icon.jsx';
import { StatusState } from '../../components/StatusState.js';
import { FishArtwork } from './FishArtwork.jsx';
import { buildAquariumJourneyPresentation, buildAquariumWalletPresentation } from './presentation.js';
import { useCareEffect } from './use-care-effect.js';
import { AquariumNextStudy } from './AquariumNextStudy.jsx';
import { GameRulesGuide } from '../../components/aquarium/GameRulesGuide.jsx';

function AquariumHabitatHeader() {
  return <PrimaryScreenHeader title="Fish Tank" eyebrow="나의 수조" action={<button type="button" className="aquarium-rules-button" data-action="openGameRules">수조 이용법</button>} />;
}

function AquariumGrowthSummary({ fishCount }) {
  const view = useContext(AquariumGrowthContext);
  const growth = view?.growth;
  return <section className="sc-study-banner" aria-label="수조 성장 요약"><div className="sc-study-headline"><small>{view?.status === 'ready' ? '함께 키운 수조' : '성장 기록 · 최신 확인 필요'}</small><b>{growth ? `DAY ${growth.validDayCount}` : '확인 중'}</b><small>{growth ? growth.nextStageDays === null ? '마지막 수조까지 성장했어요' : `다음 수조까지 ${growth.nextStageDays}일` : '성장 기록을 확인해주세요'}</small></div><div className="sc-study-headline"><small>함께하는 친구</small><b>{fishCount === null ? '확인 필요' : `${fishCount}마리`}</b></div></section>;
}

function AquariumWallet({ profile }) {
  const wallet = buildAquariumWalletPresentation(profile);
  return <div className="aquarium-wallet" role="group" aria-label="뽑기권"><div className="aquarium-wallet-metric"><small>뽑기권 </small><b>{wallet.balance}</b></div><div className="aquarium-wallet-metric"><small>{wallet.label}</small><b>{wallet.value}</b></div>{wallet.note ? <p className="aquarium-wallet-note">{wallet.note}</p> : null}{wallet.progress ? <progress aria-label="다음 뽑기권 진행" max={wallet.progress.max} value={wallet.progress.value} /> : null}</div>;
}

function AquariumOfflineState() {
  return <StatusState action={<button type="button" className="btn btn-secondary" data-action="retryGameResources">연결 후 다시 불러오기</button>} className="aquarium-offline-state" kind="offline" title="오프라인에서도 수조를 볼 수 있어요" description="표시 중인 내용은 마지막 상태이며, 연결 후 다시 불러오면 최신 보상과 FishDex를 확인합니다." />;
}

function AquariumJourney({ fishCount = 0, profile }) {
  const journey = buildAquariumJourneyPresentation({ fishCount, profile });
  const steps = [
    ['reward', '공부 보상', journey.rewardState],
    ['aquarium', '수조 시작', journey.aquariumState],
    ['fishdex', 'FishDex 발견', journey.fishDexState]
  ];
  return <section className="aquarium-journey" aria-label="공부 보상 여정"><ol>{steps.map(([step, label, state]) => <li data-step={step} data-state={state} aria-current={state === 'active' ? 'step' : undefined} key={step}><i aria-hidden="true" /><span>{label}</span><small>{state === 'complete' ? '완료' : state === 'active' ? '진행 중' : '다음 단계'}</small></li>)}</ol></section>;
}

function StarterPanel({ actionError = '', actionStatus = 'idle', catalog = [], selectedSpeciesId = '' }) {
  const starters = catalog.filter((item) => item.starter).slice(0, 3);
  return (
    <section className="aquarium-starter sc-card">
      <div className="aquarium-section-head"><div><span>첫 번째 친구</span><h2>함께 성장할 물고기를 골라주세요</h2></div></div>
      <div className="aquarium-starter-grid">{starters.map((fish) => <button type="button" className={selectedSpeciesId === fish.speciesId ? 'is-selected' : ''} data-action="selectStarterCandidate" data-species-id={fish.speciesId} key={fish.speciesId}><FishArtwork assetKey={fish.assetKey} colors={fish.colors} speciesId={fish.speciesId} variant="grid" /><b>{fish.displayName}</b><small>{fish.defaultName}</small></button>)}</div>
      {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
      <button type="button" className="btn btn-primary" data-action="claimStarterFish" disabled={!selectedSpeciesId || actionStatus === 'claiming-starter'}>{actionStatus === 'claiming-starter' ? '수조에 데려오는 중...' : '이 물고기와 시작하기'}</button>
    </section>
  );
}

function LockedStarterPanel() {
  return <section className="aquarium-locked sc-card"><span><Icon name="timer" /></span><div><b>첫 공부 보상이 필요해요</b><p>타이머로 유효한 공부를 완료하면 첫 물고기 선택이 열립니다.</p></div><button type="button" className="btn btn-primary" data-action="goto" data-target="timer">공부 시작하기</button></section>;
}

export function AquariumScreen(ctx) {
  return <AquariumWorkspace {...ctx} />;
}

function AquariumWorkspace(ctx) {
  const {
    activeFish = [],
    aquariumActionError = '',
    aquariumActionStatus = 'idle',
    aquariumMode = 'view',
    aquariumResult = null,
    aquariumSelectedFishId = '',
    aquariumStarterSpeciesId = '',
    dimmed = false,
    fishCatalog = [],
    fishCatalogError = '',
    fishCatalogStatus = 'idle',
    fishCount = 0,
    fishInventory = [],
    gameProfile = null,
    gameProfileError = '',
    gameProfileStatus = 'idle',
    pendingDraw = null,
    pendingDrawError = '',
    pendingDrawStatus = 'idle',
    todayPlannerItems = [],
    tab = 'aquarium'
  } = ctx;
  const [dexSelection, setDexSelection] = useState({ filter: 'all', category: 'all', expanded: false });
  const [managementOpen, setManagementOpen] = useState(false);
  const [nameDrafts, setNameDrafts] = useState({});
  const careEffect = useCareEffect(aquariumResult, aquariumMode === 'view' && gameProfileStatus === 'ready');
  const careBusy = ['feeding', 'renaming', 'updating-slot', 'uncertain', 'checking-care'].includes(aquariumActionStatus);
  const careUncertain = aquariumResult?.type === 'care-uncertain';
  useLayoutEffect(() => {
    if (aquariumResult?.type !== 'rename') return;
    setNameDrafts(drafts => {
      const next = { ...drafts };
      delete next[aquariumResult.fish.fishId];
      return next;
    });
  }, [aquariumResult]);
  const rootRef = useRef(null);
  const positions = useRef({});
  const previousMode = useRef(aquariumMode);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const content = root?.closest('.app-content');
    if (!content) return;
    const previous = previousMode.current;
    if (previous !== aquariumMode) {
      const trigger = previous === 'catalog' ? 'openAquariumCatalog' : previous === 'draw' ? 'openAquariumDraw' : 'openAquariumShare';
      const focusTarget = aquariumMode === 'view' ? root.querySelector(`[data-action="${trigger}"]`) : root.querySelector('h1');
      focusTarget?.focus({ preventScroll: true });
      content.scrollTop = positions.current[aquariumMode] || 0;
    }
    previousMode.current = aquariumMode;
    const remember = () => { positions.current[aquariumMode] = content.scrollTop; };
    content.addEventListener('scroll', remember, { passive: true });
    root.addEventListener('click', remember, true);
    return () => {
      content.removeEventListener('scroll', remember);
      root.removeEventListener('click', remember, true);
    };
  }, [aquariumMode]);
  useLayoutEffect(() => {
    if (aquariumSelectedFishId) setManagementOpen(true);
  }, [aquariumSelectedFishId]);
  const selectedFish = fishInventory.find((fish) => fish?.fishId === aquariumSelectedFishId) || activeFish.find((fish) => fish?.fishId === aquariumSelectedFishId) || activeFish.find(Boolean) || fishInventory[0] || null;
  const selectedMeta = catalogMeta(fishCatalog, selectedFish?.speciesId);
  const activeSlot = AQUARIUM_SLOTS.find((slot, index) => activeFish[index]?.fishId === selectedFish?.fishId)?.id || '';
  const loading = gameProfileStatus === 'loading' || gameProfileStatus === 'idle';
  const unavailable = gameProfileStatus === 'unavailable';
  const fatalError = gameProfileStatus === 'error' ? gameProfileError : '';
  const resourceWarnings = [fishCatalogStatus === 'error' ? fishCatalogError : '', pendingDrawStatus === 'error' ? pendingDrawError : ''].filter(Boolean);
  const snapshot = ctx.aquariumPresentation || buildAquariumPresentation({ activeFish, fishCatalog, fishCatalogStatus, fishInventory, fishCount, gameProfile, gameProfileStatus, todayPlannerItems });

  if (!unavailable && aquariumMode === 'catalog') return <AppScreenShell screen="aquarium" dimmed={dimmed}><main ref={rootRef} className="aquarium-screen aquarium-catalog-page"><AquariumOfflineState /><FishDexPanel selection={dexSelection} setSelection={setDexSelection} catalog={fishCatalog} error={fishCatalogError} inventory={fishInventory} profile={gameProfile} status={fishCatalogStatus} /></main></AppScreenShell>;
  if (!unavailable && aquariumMode === 'draw') return <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed} overlayOpen={Boolean(pendingDraw)} overlays={pendingDraw ? <DiscoveryResult key={pendingDraw.result.requestId} actionError={aquariumActionError} actionStatus={aquariumActionStatus} catalog={fishCatalog} pendingDraw={pendingDraw} /> : null}><main ref={rootRef} className="aquarium-screen"><AquariumOfflineState /><DiscoveryPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} pendingDrawError={pendingDrawError} pendingDrawStatus={pendingDrawStatus} profile={gameProfile} /></main></AppScreenShell>;
  if (!unavailable && aquariumMode === 'share') return <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed}><main ref={rootRef} className="aquarium-screen"><AquariumOfflineState /><AquariumSharePanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} catalog={fishCatalog} snapshot={snapshot} result={aquariumResult} /></main></AppScreenShell>;

  return (
    <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed} overlayOpen={Boolean(ctx.gameRulesOpen)} overlays={ctx.gameRulesOpen ? <GameRulesGuide gameRules={ctx.gameRules} gameProfileStatus={gameProfileStatus} open /> : null}>
      <main ref={rootRef} className="aquarium-screen">
        <AquariumOfflineState />
        <AquariumHabitatHeader />
        {loading ? <StatusState className="aquarium-main-status" kind="loading" title="수조를 채우고 있어요" description="보상과 물고기 상태를 확인하고 있습니다." /> : unavailable ? <div className="aquarium-error sc-card" role="status"><b>수조를 순차적으로 열고 있어요</b><p>{gameProfileError || '계정별 적용이 완료되면 이곳에서 바로 확인할 수 있습니다.'}</p><button type="button" className="btn btn-primary" data-action="goto" data-target="timer">타이머로 돌아가기</button></div> : fatalError ? <div className="aquarium-error sc-card" role="alert"><b>수조를 불러오지 못했어요</b><p>{fatalError}</p><button type="button" className="btn btn-primary" data-action="retryGameResources">다시 불러오기</button></div> : <>
          <AquariumGrowthSummary fishCount={snapshot.ownedCount} />
          <AquariumNextStudy items={todayPlannerItems} planner={ctx.studyOverview?.planner} canUsePersonalPlanner={ctx.canUsePersonalPlanner} />
          <div className="aquarium-scene-wrap" onClick={event => { if (event.target.closest('[data-action="selectAquariumFish"]:not(:disabled)')) setManagementOpen(true); }}><AquariumScene backgroundKey={snapshot.backgroundKey} slots={snapshot.slots} catalog={fishCatalog} stats={snapshot} selectedFishId={aquariumSelectedFishId} careEffect={careEffect} controlsDisabled={careBusy} /></div>
          <section className="aquarium-discovery-card sc-card" aria-label="물고기 만나기">
          <div className="aquarium-section-head"><h2>물고기 만나기</h2></div>
          <AquariumWallet profile={gameProfile} />
          {gameProfileStatus === 'ready' && gameProfile && gameProfile.starterState !== 'claimed' ? <AquariumJourney fishCount={fishCount} profile={gameProfile} /> : null}
          {gameProfile?.starterState === 'selectable' ? <StarterPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} catalog={fishCatalog} selectedSpeciesId={aquariumStarterSpeciesId} /> : gameProfile?.starterState === 'locked' ? <LockedStarterPanel /> : <button type="button" className="btn btn-primary" data-action={pendingDraw || gameProfile?.ticketBalance > 0 || !['study-ticket-v1', 'planner-ticket-v1'].includes(gameProfile?.ticketPolicyVersion) ? 'openAquariumDraw' : 'goto'} data-target={gameProfile?.ticketPolicyVersion === 'planner-ticket-v1' ? 'planner' : 'timer'} disabled={careBusy}>{pendingDraw ? '뽑기 결과 확인' : !['study-ticket-v1', 'planner-ticket-v1'].includes(gameProfile?.ticketPolicyVersion) ? '뽑기권 상태 확인' : gameProfile.ticketBalance > 0 ? '새 물고기 만나기' : gameProfile?.ticketPolicyVersion === 'planner-ticket-v1' ? '계획 완료하고 뽑기권 받기' : '공부해서 뽑기권 받기'}</button>}
          </section>
          <section className="aquarium-care-area sc-card" aria-label="내 수조 관리">
          <div className="aquarium-section-head"><h2>내 수조 관리</h2><button type="button" className="btn btn-secondary" data-action="openAquariumShare" disabled={careBusy || !fishInventory.length}>공유</button></div>
          <section className="aquarium-next-actions"><button type="button" data-action="openAquariumCatalog" disabled={careBusy}><Icon name="report" /><span><b>물고기 도감</b><small>{aquariumCollectionLabel(snapshot)}</small></span><i aria-hidden="true">›</i></button></section>
          {careUncertain ? <section className="aquarium-care-recovery" role="status"><b>처리 결과 확인이 필요해요</b><p>{aquariumActionError}</p><button type="button" className="btn btn-secondary" data-action="retryGameResources" disabled={aquariumActionStatus === 'checking-care'}>{aquariumActionStatus === 'checking-care' ? '상태 확인 중...' : '현재 상태 확인'}</button><small>이 버튼은 뽑기권을 사용하거나 배치를 변경하지 않아요.</small></section> : aquariumResult?.type === 'care-checked' ? <section className="aquarium-care-recovery" role="status"><b>현재 물고기 상태를 불러왔어요</b><p>이전 요청의 성공 여부를 확정한 것은 아니에요. 표시된 상태를 확인한 뒤 다음 동작을 선택해주세요.</p><button type="button" className="btn btn-secondary" data-action="dismissAquariumResult">확인</button></section> : null}
          {resourceWarnings.length ? <div className="aquarium-resource-notice" role="status"><span><b>일부 정보를 불러오지 못했어요</b><small>{resourceWarnings[0]}</small></span><button type="button" data-action="retryGameResources">다시 시도</button></div> : null}
          {gameProfile?.starterState === 'claimed' ? <AnimatedDetails className="aquarium-management" open={managementOpen} onToggle={event => setManagementOpen(event.currentTarget.open)}><summary>이름·배치 관리 <span>{managementOpen ? '접기' : '펼치기'}</span></summary><FishCarePanel duplicateEffect={buildRulesGuidePresentation(ctx.gameRules, gameProfileStatus).draw?.duplicateEffect} actionError={careUncertain ? '' : aquariumActionError} actionStatus={aquariumActionStatus} activeSlot={activeSlot} fish={selectedFish} meta={selectedMeta} result={aquariumResult} /><FishInventoryPanel actionStatus={aquariumActionStatus} activeFish={activeFish} catalog={fishCatalog} inventory={fishInventory} result={aquariumResult} selectedFish={selectedFish} nameDraft={nameDrafts[selectedFish?.fishId]} onNameChange={(fishId, value) => setNameDrafts(drafts => ({ ...drafts, [fishId]: value }))} /></AnimatedDetails> : null}
          </section>
        </>}
      </main>
    </AppScreenShell>
  );
}

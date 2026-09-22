import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { AquariumGrowthContext } from '../../features/gamification/AquariumGrowthContext.js';
import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { catalogMeta } from './aquarium-panel-shared.jsx';
import { FishCarePanel } from './FishCarePanel.jsx';
import { FishInventoryPanel } from './FishInventoryPanel.jsx';
import { FishDexPanel } from './FishDexPanel.jsx';
import { DiscoveryPanel, DiscoveryResult } from './DiscoveryPanel.jsx';
import { AquariumSharePanel } from './AquariumSharePanel.jsx';
import { AquariumScene } from '../../components/aquarium/AquariumScene.jsx';
import { StudyOverviewCard } from '../../components/StudyOverviewCard.jsx';
import { AQUARIUM_SLOTS, aquariumCollectionLabel, buildAquariumPresentation } from '../../features/gamification/aquarium-presentation.js';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { Icon } from '../../components/Icon.jsx';
import { StatusState } from '../../components/StatusState.js';
import { FishArtwork } from './FishArtwork.jsx';
import { buildAquariumJourneyPresentation } from './presentation.js';
import { useCareEffect } from './use-care-effect.js';
import { AquariumNextStudy } from './AquariumNextStudy.jsx';

function AquariumHabitatHeader() {
  const view = useContext(AquariumGrowthContext);
  const days = view?.growth?.validDayCount;
  const known = Number.isInteger(days) && days >= 0;
  return <header className="aquarium-habitat-header"><img src={STUDYCRACK_LOGO_SRC} alt="StudyCrack" /><div><span>STUDYCRACK / LIVE</span><h1>합격 페이스메이커</h1></div><div className="aquarium-day-badge" aria-label="수조 성장 인정 일수"><small>AQUARIUM</small><b>{known ? `DAY ${days}` : '확인 중'}</b>{view?.status !== 'ready' ? <small>{known ? '마지막 확인' : '기록 확인 필요'}</small> : null}</div></header>;
}

function AquariumWallet({ fishCount = 0, profile }) {
  return <div className="aquarium-wallet" role="group" aria-label="수조 재화"><span>조개 <b>{Number(profile?.shellBalance) || 0}</b></span><span>먹이 <b>{Number(profile?.foodBalance) || 0}</b></span><small>{fishCount}마리와 함께하는 중</small></div>;
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
      <div className="aquarium-section-head"><div><span>첫 번째 친구</span><h2>함께 성장할 물고기를 골라주세요</h2><p>선택한 물고기는 수조 가운데에서 공부 보상을 기다려요.</p></div></div>
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
    return () => content.removeEventListener('scroll', remember);
  }, [aquariumMode]);
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
    <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed}>
      <main ref={rootRef} className="aquarium-screen">
        <AquariumOfflineState />
        <AquariumHabitatHeader />
        {loading ? <StatusState className="aquarium-main-status" kind="loading" title="수조를 채우고 있어요" description="보상과 물고기 상태를 확인하고 있습니다." /> : unavailable ? <div className="aquarium-error sc-card" role="status"><b>수조를 순차적으로 열고 있어요</b><p>{gameProfileError || '계정별 적용이 완료되면 이곳에서 바로 확인할 수 있습니다.'}</p><button type="button" className="btn btn-primary" data-action="goto" data-target="timer">타이머로 돌아가기</button></div> : fatalError ? <div className="aquarium-error sc-card" role="alert"><b>수조를 불러오지 못했어요</b><p>{fatalError}</p><button type="button" className="btn btn-primary" data-action="retryGameResources">다시 불러오기</button></div> : <>
          <StudyOverviewCard overview={ctx.studyOverview} scoreView={ctx.analysisScoreView} variant="banner" compact />
          <AquariumNextStudy items={todayPlannerItems} planner={ctx.studyOverview?.planner} canAccessBasic={ctx.canAccessBasic} />
          <div className="aquarium-scene-wrap"><AquariumScene backgroundKey={snapshot.backgroundKey} slots={snapshot.slots} catalog={fishCatalog} stats={snapshot} selectedFishId={aquariumSelectedFishId} careEffect={careEffect} controlsDisabled={careBusy} /></div>
          <section className="aquarium-next-actions"><button type="button" data-action="goto" data-target="timer"><Icon name="timer" /><span><b>공부해서 먹이 모으기</b><small>타이머로 이동</small></span><i aria-hidden="true">›</i></button><button type="button" data-action="openAquariumCatalog" disabled={careBusy}><Icon name="report" /><span><b>물고기 도감</b><small>{aquariumCollectionLabel(snapshot)}</small></span><i aria-hidden="true">›</i></button><button type="button" data-action="openAquariumDraw" disabled={careBusy || gameProfile?.starterState !== 'claimed'}><Icon name="plus" /><span><b>{pendingDraw ? '뽑기 결과 확인' : '새 물고기 만나기'}</b><small>{pendingDraw ? '확인하지 않은 결과가 있어요' : '조개 30개 사용'}</small></span><i aria-hidden="true">›</i></button><button type="button" data-action="openAquariumShare" disabled={careBusy || !fishInventory.length}><Icon name="share" /><span><b>수조 공유하기</b><small>성적 없이 공부 기록만</small></span><i aria-hidden="true">›</i></button></section>
          <section className="aquarium-care-area" aria-label="수조 돌봄과 재화">
          <AquariumWallet fishCount={fishCount || fishInventory.length} profile={gameProfile} />
          {gameProfileStatus === 'ready' && gameProfile ? <AquariumJourney fishCount={fishCount || fishInventory.length} profile={gameProfile} /> : null}
          {careUncertain ? <section className="aquarium-care-recovery" role="status"><b>처리 결과 확인이 필요해요</b><p>{aquariumActionError}</p><button type="button" className="btn btn-secondary" data-action="retryGameResources" disabled={aquariumActionStatus === 'checking-care'}>{aquariumActionStatus === 'checking-care' ? '상태 확인 중...' : '현재 상태 확인'}</button><small>이 버튼은 먹이를 주거나 배치를 변경하지 않아요.</small></section> : aquariumResult?.type === 'care-checked' ? <section className="aquarium-care-recovery" role="status"><b>현재 먹이와 물고기 상태를 불러왔어요</b><p>이전 요청의 성공 여부를 확정한 것은 아니에요. 표시된 상태를 확인한 뒤 다음 동작을 선택해주세요.</p><button type="button" className="btn btn-secondary" data-action="dismissAquariumResult">확인</button></section> : null}
          {resourceWarnings.length ? <div className="aquarium-resource-notice" role="status"><span><b>일부 정보를 불러오지 못했어요</b><small>{resourceWarnings[0]}</small></span><button type="button" data-action="retryGameResources">다시 시도</button></div> : null}
          {gameProfile?.starterState === 'selectable' ? <StarterPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} catalog={fishCatalog} selectedSpeciesId={aquariumStarterSpeciesId} /> : null}
          {gameProfile?.starterState === 'locked' ? <LockedStarterPanel /> : null}
          {gameProfile?.starterState === 'claimed' ? <FishCarePanel actionError={careUncertain ? '' : aquariumActionError} actionStatus={aquariumActionStatus} activeSlot={activeSlot} fish={selectedFish} foodBalance={Number(gameProfile?.foodBalance) || 0} meta={selectedMeta} result={aquariumResult} /> : null}
          {gameProfile?.starterState === 'claimed' ? <details className="aquarium-management" open={managementOpen} onToggle={event => setManagementOpen(event.currentTarget.open)}><summary>이름·배치 관리 <span>{managementOpen ? '접기' : '펼치기'}</span></summary><FishInventoryPanel actionStatus={aquariumActionStatus} activeFish={activeFish} catalog={fishCatalog} inventory={fishInventory} result={aquariumResult} selectedFish={selectedFish} nameDraft={nameDrafts[selectedFish?.fishId]} onNameChange={(fishId, value) => setNameDrafts(drafts => ({ ...drafts, [fishId]: value }))} /></details> : null}
          </section>
        </>}
      </main>
    </AppScreenShell>
  );
}

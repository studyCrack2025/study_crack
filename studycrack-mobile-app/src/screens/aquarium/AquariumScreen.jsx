import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { Icon } from '../../components/Icon.jsx';
import { FishSprite } from './FishSprite.jsx';

const AQUARIUM_SLOTS = [
  { className: 'slot-left', id: 'left', label: '왼쪽' },
  { className: 'slot-center', id: 'center', label: '가운데' },
  { className: 'slot-right', id: 'right', label: '오른쪽' }
];

const RARITY_LABELS = { common: '일반', rare: '희귀', epic: '영웅' };

function catalogMeta(catalog, speciesId) {
  return catalog.find((item) => item.speciesId === speciesId) || { colors: ['#3F6FD9', '#9DD9F2'], displayName: '물고기', rarity: 'common' };
}

function AquariumScene({ activeFish = [], catalog = [], selectedFishId = '' }) {
  return (
    <section className="aquarium-scene" aria-label="나의 공부 수조">
      <div className="aquarium-water-line" />
      <div className="aquarium-rays"><i /><i /></div>
      <div className="aquarium-bubbles"><i /><i /><i /><i /></div>
      <div className="aquarium-plants"><i /><i /><i /><i /></div>
      <div className="aquarium-ground"><i /><i /><i /></div>
      {AQUARIUM_SLOTS.map((slot, index) => {
        const fish = activeFish[index];
        if (!fish) return <span className={`aquarium-empty-slot ${slot.className}`} key={slot.id} />;
        const meta = catalogMeta(catalog, fish.speciesId);
        return (
          <button type="button" className={`aquarium-fish ${slot.className} ${selectedFishId === fish.fishId ? 'is-selected' : ''}`} data-action="selectAquariumFish" data-fish-id={fish.fishId} aria-label={`${fish.name} 선택`} key={fish.fishId}>
            <FishSprite colors={meta.colors} fishId={fish.fishId} growthStage={fish.growthStage} speciesId={fish.speciesId} />
            <span>{fish.name}</span>
          </button>
        );
      })}
    </section>
  );
}

function StarterPanel({ actionError = '', actionStatus = 'idle', catalog = [], selectedSpeciesId = '' }) {
  const starters = catalog.filter((item) => item.starter).slice(0, 3);
  return (
    <section className="aquarium-starter sc-card">
      <div className="aquarium-section-head"><div><span>첫 번째 친구</span><h2>함께 성장할 물고기를 골라주세요</h2><p>선택한 물고기는 수조 가운데에서 공부 보상을 기다려요.</p></div></div>
      <div className="aquarium-starter-grid">{starters.map((fish) => <button type="button" className={selectedSpeciesId === fish.speciesId ? 'is-selected' : ''} data-action="selectStarterCandidate" data-species-id={fish.speciesId} key={fish.speciesId}><FishSprite colors={fish.colors} speciesId={fish.speciesId} /><b>{fish.displayName}</b><small>{fish.defaultName}</small></button>)}</div>
      {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
      <button type="button" className="btn btn-primary" data-action="claimStarterFish" disabled={!selectedSpeciesId || actionStatus === 'claiming-starter'}>{actionStatus === 'claiming-starter' ? '수조에 데려오는 중...' : '이 물고기와 시작하기'}</button>
    </section>
  );
}

function LockedStarterPanel() {
  return <section className="aquarium-locked sc-card"><span><Icon name="timer" /></span><div><b>첫 공부 보상이 필요해요</b><p>타이머로 유효한 공부를 완료하면 첫 물고기 선택이 열립니다.</p></div><button type="button" className="btn btn-primary" data-action="goto" data-target="timer">공부 시작하기</button></section>;
}

function FishCarePanel({ actionError = '', actionStatus = 'idle', activeSlot = '', fish, foodBalance = 0, meta, result = null }) {
  if (!fish) return <section className="aquarium-care-empty sc-card"><b>수조가 아직 비어 있어요</b><p>첫 물고기를 선택하면 성장 정보와 먹이 주기가 이곳에 나타납니다.</p></section>;
  const maxLevel = Number(fish.level) >= 10;
  const busy = ['feeding', 'renaming', 'updating-slot'].includes(actionStatus);
  return (
    <section className="aquarium-care sc-card">
      <div className="aquarium-section-head"><div><span>{String(meta.rarity || 'common').toUpperCase()}</span><h2>{fish.name}</h2><p>{meta.displayName} · 성장 단계 {fish.growthStage}</p></div><b>Lv.{fish.level}</b></div>
      <div className="aquarium-exp"><div><span>성장 경험치</span><b>{maxLevel ? 'MAX' : `${fish.currentLevelExp} / ${fish.nextLevelExp - (fish.exp - fish.currentLevelExp)}`}</b></div><span><i style={{ width: `${fish.progressPct}%` }} /></span></div>
      <div className="aquarium-feed-row"><div><span>{activeSlot ? `${AQUARIUM_SLOTS.find((slot) => slot.id === activeSlot)?.label} 배치` : '수조 밖 보관 중'}</span><b>{foodBalance}개</b><small>보유 먹이</small></div><button type="button" className="btn btn-primary" data-action="feedAquariumFish" disabled={!activeSlot || foodBalance < 1 || maxLevel || busy}>{actionStatus === 'feeding' ? '먹이를 주는 중...' : !activeSlot ? '배치 후 먹이 주기' : maxLevel ? '최대 레벨' : '먹이 주기'}</button></div>
      {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
      {result?.type === 'feed' ? <div className={`aquarium-care-result ${result.levelUp ? 'is-level-up' : ''}`}><b>{result.levelUp ? `레벨 업! Lv.${result.fish.level}` : `EXP +${result.expGranted}`}</b><span>{result.waterGain ? '수질도 1만큼 좋아졌어요.' : '오늘의 수질 보너스는 모두 받았어요.'}</span><button type="button" data-action="dismissAquariumResult">확인</button></div> : null}
    </section>
  );
}

function FishInventoryPanel({ actionError = '', actionStatus = 'idle', activeFish = [], catalog = [], inventory = [], result = null, selectedFish }) {
  if (!inventory.length) return null;
  const activeSlot = AQUARIUM_SLOTS.find((slot, index) => activeFish[index]?.fishId === selectedFish?.fishId)?.id || '';
  const busy = ['feeding', 'renaming', 'updating-slot'].includes(actionStatus);
  const selectedMeta = catalogMeta(catalog, selectedFish?.speciesId);
  return (
    <section className="aquarium-inventory sc-card">
      <div className="aquarium-section-head"><div><span>MY FISH</span><h2>내 물고기</h2><p>친구를 선택해 수조 위치와 이름을 관리하세요.</p></div><b>{inventory.length}마리</b></div>
      <div className="aquarium-inventory-grid">{inventory.map((fish) => {
        const meta = catalogMeta(catalog, fish.speciesId);
        const slot = AQUARIUM_SLOTS.find((item, index) => activeFish[index]?.fishId === fish.fishId);
        return <button type="button" className={selectedFish?.fishId === fish.fishId ? 'is-selected' : ''} data-action="selectAquariumFish" data-fish-id={fish.fishId} aria-label={`${fish.name} 관리`} key={fish.fishId}><FishSprite colors={meta.colors} fishId={fish.fishId} growthStage={fish.growthStage} speciesId={fish.speciesId} /><span><b>{fish.name}</b><small>Lv.{fish.level} · {RARITY_LABELS[meta.rarity] || '일반'}</small></span>{slot ? <em>{slot.label}</em> : null}</button>;
      })}</div>
      {selectedFish ? <div className="aquarium-manage-detail">
        <div className="aquarium-manage-summary"><FishSprite colors={selectedMeta.colors} fishId={selectedFish.fishId} growthStage={selectedFish.growthStage} speciesId={selectedFish.speciesId} /><div><span>{selectedMeta.displayName}</span><b>{selectedFish.name}</b><small>{activeSlot ? `${AQUARIUM_SLOTS.find((slot) => slot.id === activeSlot)?.label}에 배치 중` : '현재 수조 밖에 있어요'}</small></div></div>
        <div className="aquarium-slot-control"><span>수조 위치</span><div>{AQUARIUM_SLOTS.map((slot) => <button type="button" className={activeSlot === slot.id ? 'is-active' : ''} data-action="setAquariumFishSlot" data-slot={slot.id} disabled={busy} key={slot.id}><b>{slot.label}</b><small>{activeSlot === slot.id ? '해제' : '배치'}</small></button>)}</div></div>
        <div className="aquarium-rename-control"><label htmlFor="aquarium-fish-name">이름 변경</label><div><input id="aquarium-fish-name" className="planner-input" data-field="aquariumFishName" defaultValue={selectedFish.name} key={selectedFish.fishId} maxLength="20" autoComplete="off" placeholder="물고기 이름" /><button type="button" className="btn btn-secondary" data-action="saveAquariumFishName" disabled={busy}>{actionStatus === 'renaming' ? '저장 중...' : '저장'}</button></div><small>한글, 영문, 숫자로 공백 제외 10자까지 입력할 수 있어요.</small></div>
      </div> : null}
      {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
      {result?.type === 'slot' ? <div className="aquarium-manage-result"><span>{result.remove ? '수조에서 잠시 쉬도록 했어요.' : '선택한 위치로 배치했어요.'}</span><button type="button" data-action="dismissAquariumResult">확인</button></div> : null}
      {result?.type === 'rename' ? <div className="aquarium-manage-result"><span>{result.fish.name}(으)로 이름을 저장했어요.</span><button type="button" data-action="dismissAquariumResult">확인</button></div> : null}
    </section>
  );
}

export function AquariumScreen(ctx) {
  const {
    activeFish = [],
    aquariumActionError = '',
    aquariumActionStatus = 'idle',
    aquariumResult = null,
    aquariumSelectedFishId = '',
    aquariumStarterSpeciesId = '',
    dimmed = false,
    fishCatalog = [],
    fishCatalogError = '',
    fishCatalogStatus = 'idle',
    fishInventory = [],
    gameProfile = null,
    gameProfileError = '',
    gameProfileStatus = 'idle',
    tab = 'aquarium'
  } = ctx;
  const selectedFish = fishInventory.find((fish) => fish?.fishId === aquariumSelectedFishId) || activeFish.find((fish) => fish?.fishId === aquariumSelectedFishId) || activeFish.find(Boolean) || fishInventory[0] || null;
  const selectedMeta = catalogMeta(fishCatalog, selectedFish?.speciesId);
  const activeSlot = AQUARIUM_SLOTS.find((slot, index) => activeFish[index]?.fishId === selectedFish?.fishId)?.id || '';
  const loading = gameProfileStatus === 'loading' || (fishCatalogStatus === 'loading' && !fishCatalog.length);
  const fatalError = gameProfileStatus === 'error' ? gameProfileError : fishCatalogStatus === 'error' ? fishCatalogError : '';
  const waterQuality = Math.max(40, Math.min(100, Number(gameProfile?.waterQuality) || 40));

  return (
    <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed}>
      <main className="aquarium-screen">
        <header className="aquarium-header"><div><span>공부가 자라는 곳</span><h1>나의 수조</h1><p>집중한 시간으로 물고기와 수조를 함께 키워보세요.</p></div><div className="aquarium-wallet"><span>조개 <b>{Number(gameProfile?.shellBalance) || 0}</b></span><span>먹이 <b>{Number(gameProfile?.foodBalance) || 0}</b></span></div></header>
        {loading ? <div className="aquarium-loading" role="status"><i /><b>수조를 채우고 있어요</b></div> : fatalError ? <div className="aquarium-error sc-card" role="alert"><b>수조를 불러오지 못했어요</b><p>{fatalError}</p><button type="button" className="btn btn-primary" data-action="retryGameResources">다시 불러오기</button></div> : <>
          <div className="aquarium-scene-wrap"><AquariumScene activeFish={activeFish} catalog={fishCatalog} selectedFishId={selectedFish?.fishId || ''} /><div className="aquarium-quality"><div><span>수질</span><b>{waterQuality}</b></div><span><i style={{ width: `${waterQuality}%` }} /></span><small>{waterQuality >= 85 ? '맑음' : waterQuality >= 65 ? '안정' : '돌봄 필요'}</small></div></div>
          {gameProfile?.starterState === 'selectable' ? <StarterPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} catalog={fishCatalog} selectedSpeciesId={aquariumStarterSpeciesId} /> : null}
          {gameProfile?.starterState === 'locked' ? <LockedStarterPanel /> : null}
          {gameProfile?.starterState === 'claimed' ? <FishCarePanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} activeSlot={activeSlot} fish={selectedFish} foodBalance={Number(gameProfile?.foodBalance) || 0} meta={selectedMeta} result={aquariumResult} /> : null}
          {gameProfile?.starterState === 'claimed' ? <FishInventoryPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} activeFish={activeFish} catalog={fishCatalog} inventory={fishInventory} result={aquariumResult} selectedFish={selectedFish} /> : null}
          <section className="aquarium-next-actions"><button type="button" data-action="goto" data-target="timer"><Icon name="timer" /><span><b>공부해서 먹이 모으기</b><small>타이머로 이동</small></span><i aria-hidden="true">›</i></button><button type="button" disabled><Icon name="report" /><span><b>물고기 도감</b><small>다음 단계에서 열려요</small></span></button></section>
        </>}
      </main>
    </AppScreenShell>
  );
}

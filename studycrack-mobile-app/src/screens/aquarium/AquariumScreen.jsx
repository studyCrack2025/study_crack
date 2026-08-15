import { useState } from 'react';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { Icon } from '../../components/Icon.jsx';
import { FishSprite } from './FishSprite.jsx';

const AQUARIUM_SLOTS = [
  { className: 'slot-left', id: 'left', label: '왼쪽' },
  { className: 'slot-center', id: 'center', label: '가운데' },
  { className: 'slot-right', id: 'right', label: '오른쪽' }
];

const RARITY_LABELS = { common: '일반', rare: '희귀', epic: '영웅' };
const RARITY_CLASSES = { common: 'rarity-common', rare: 'rarity-rare', epic: 'rarity-epic' };
const DRAW_STEP_CLASSES = ['step-0', 'step-1', 'step-2', 'step-3'];
const CATALOG_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'owned', label: '획득' },
  { id: 'locked', label: '미획득' }
];

function catalogMeta(catalog, speciesId) {
  return catalog.find((item) => item.speciesId === speciesId) || { colors: ['#3F6FD9', '#9DD9F2'], displayName: '물고기', rarity: 'common' };
}

function playAquariumRevealSound(rarity = 'common') {
  try {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const notes = rarity === 'epic' ? [523, 659, 784, 1046] : rarity === 'rare' ? [523, 659, 784] : [523, 659];
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.065, context.currentTime + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.35);
    master.connect(context.destination);
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.11;
      oscillator.type = index % 2 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.7, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.46);
    });
    void context.resume();
    globalThis.setTimeout(() => void context.close(), 1500);
  } catch {
    // Audio is enhancement-only; browser restrictions must not interrupt the reward flow.
  }
}

function AquariumScene({ activeFish = [], catalog = [], selectedFishId = '', streakDays = null, waterQuality = null }) {
  return (
    <section className="aquarium-scene" aria-label="나의 공부 수조">
      {waterQuality !== null ? <div className="aquarium-scene-hud"><span><small>연속 학습</small><b>{Math.max(0, Number(streakDays) || 0)}일</b></span><span><small>수질</small><b>{waterQuality}%</b></span></div> : null}
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

function AquariumHabitatHeader({ fishCount = 0, profile }) {
  return <header className="aquarium-habitat-header"><div><span>STUDYCRACK AQUARIUM</span><h1>나의 공부 수조</h1><p>집중한 시간이 물고기의 성장으로 남아요.</p></div><div className="aquarium-wallet"><span>조개 <b>{Number(profile?.shellBalance) || 0}</b></span><span>먹이 <b>{Number(profile?.foodBalance) || 0}</b></span><small>{fishCount}마리와 함께하는 중</small></div></header>;
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

function AquariumModeHeader({ eyebrow, title, description }) {
  return <header className="aquarium-mode-header"><button type="button" data-action="closeAquariumMode" aria-label="수조로 돌아가기">‹</button><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></header>;
}

function FishCatalogPanel({ catalog = [], inventory = [], profile }) {
  const [filter, setFilter] = useState('all');
  const ownedSpecies = new Set(inventory.map((fish) => fish.speciesId));
  const ownedCount = catalog.filter((fish) => fish.owned || ownedSpecies.has(fish.speciesId)).length;
  const total = catalog.length || 12;
  const collectionPct = Math.round((ownedCount / total) * 100);
  return <div className="aquarium-mode-shell aquarium-catalog-view">
    <div className="aquarium-catalog-hero"><AquariumModeHeader eyebrow="FISH DEX" title="물고기 도감" description="완료한 공부가 새로운 친구의 기록으로 남아요." /><section className="aquarium-collection-summary"><div><span>발견한 친구</span><b>{ownedCount}<small> / {total}</small></b></div><div><span>수집률</span><b>{collectionPct}%</b></div><i><span style={{ width: `${collectionPct}%` }} /></i></section></div>
    <button type="button" className="aquarium-draw-entry" data-action="openAquariumDraw" disabled={profile?.starterState !== 'claimed'}><span>조개 {Number(profile?.shellBalance) || 0}개</span><b>새 물고기 만나기</b><small>{profile?.starterState === 'claimed' ? '한 번에 조개 30개' : '첫 물고기를 먼저 선택해주세요'}</small><i aria-hidden="true">›</i></button>
    <div className="aquarium-catalog-filter" role="group" aria-label="도감 필터">{CATALOG_FILTERS.map((item) => <button type="button" className={filter === item.id ? 'is-active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} key={item.id}>{item.label}</button>)}</div>
    <div className="aquarium-catalog-groups">{['common', 'rare', 'epic'].map((rarity) => {
      const rows = catalog.filter((fish) => fish.rarity === rarity).filter((fish) => filter === 'all' || (filter === 'owned' ? fish.owned || ownedSpecies.has(fish.speciesId) : !(fish.owned || ownedSpecies.has(fish.speciesId))));
      if (!rows.length) return null;
      return <section className={`aquarium-catalog-group ${RARITY_CLASSES[rarity]}`} key={rarity}><header><div><span>{rarity.toUpperCase()}</span><b>{RARITY_LABELS[rarity]}</b></div><small>{rows.filter((fish) => fish.owned || ownedSpecies.has(fish.speciesId)).length} / {rows.length}</small></header><div>{rows.map((fish) => {
        const owned = fish.owned || ownedSpecies.has(fish.speciesId);
        const ownedFish = inventory.find((item) => item.speciesId === fish.speciesId);
        return <article className={owned ? 'is-owned' : 'is-locked'} key={fish.speciesId}><div className="aquarium-catalog-sprite"><FishSprite colors={fish.colors} fishId={ownedFish?.fishId} growthStage={ownedFish?.growthStage} speciesId={fish.speciesId} /></div><b>{owned ? fish.displayName : '???'}</b><small>{owned ? `Lv.${ownedFish?.level || 1} · ${fish.defaultName}` : '아직 만나지 못했어요'}</small></article>;
      })}</div></section>;
    })}</div>
  </div>;
}

function DrawPity({ profile }) {
  const rareIn = Math.max(0, Number(profile?.drawPity?.rareIn) || 0);
  const epicIn = Math.max(0, Number(profile?.drawPity?.epicIn) || 0);
  return <div className="aquarium-pity"><div><span>희귀 확정까지</span><b>{rareIn ? `${rareIn}회` : '이번 뽑기'}</b></div><div><span>영웅 확정까지</span><b>{epicIn ? `${epicIn}회` : '이번 뽑기'}</b></div></div>;
}

function DrawResult({ actionError, actionStatus, catalog, pendingDraw }) {
  const { fish, result } = pendingDraw;
  const meta = catalogMeta(catalog, fish.speciesId);
  const duplicate = Boolean(result.duplicate);
  const rarity = result.rarity || 'common';
  return <section className={`aquarium-draw-result ${RARITY_CLASSES[rarity] || RARITY_CLASSES.common}`} aria-live="polite"><div className="aquarium-result-burst" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i style={{ '--particle-index': index }} key={index} />)}</div><span>{duplicate ? '다시 만난 친구' : `${RARITY_LABELS[rarity] || '일반'} 물고기 발견`}</span><div className="aquarium-result-halo"><i className="aquarium-result-ring" aria-hidden="true" /><FishSprite colors={meta.colors} fishId={fish.fishId} growthStage={fish.growthStage} speciesId={fish.speciesId} /></div><h2>{meta.displayName}</h2><p>{fish.name} · {RARITY_LABELS[rarity] || '일반'}</p><div className="aquarium-result-reward">{duplicate ? <><span>중복 성장 보상</span><b>EXP +{Number(result.expGranted) || 0}</b>{Number(result.shellsRefunded) > 0 ? <small>최대 레벨 보상으로 조개 {result.shellsRefunded}개를 돌려받았어요.</small> : <small>기존 물고기의 성장 경험치로 합쳐졌어요.</small>}</> : <><span>도감 등록 완료</span><b>{rarity === 'epic' ? '특별한 친구가 수조에 합류했어요' : '새 물고기가 수조에 합류했어요'}</b><small>도감에서 생김새와 성장 상태를 다시 확인할 수 있어요.</small></>}</div>{actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}<button type="button" className="btn btn-primary" data-action="acknowledgeAquariumDraw" data-target="catalog" disabled={actionStatus === 'acknowledging-draw'}>{actionStatus === 'acknowledging-draw' ? '결과를 저장하는 중...' : '도감에서 확인하기'}</button></section>;
}

function FishDrawPanel({ actionError = '', actionStatus = 'idle', catalog = [], pendingDraw = null, pendingDrawError = '', pendingDrawStatus = 'idle', profile, revealStep = 0 }) {
  const [soundOn, setSoundOn] = useState(true);
  const drawing = actionStatus === 'drawing';
  const rarity = pendingDraw?.result?.rarity || 'common';
  if (pendingDraw && revealStep >= 3) return <div className="aquarium-mode-shell aquarium-draw-view"><AquariumModeHeader eyebrow="DISCOVERY" title="새로운 만남" description="오늘의 공부가 데려온 친구를 확인해보세요." /><DrawResult actionError={actionError} actionStatus={actionStatus} catalog={catalog} pendingDraw={pendingDraw} /></div>;
  return <div className="aquarium-mode-shell aquarium-draw-view">
    <AquariumModeHeader eyebrow="DISCOVERY" title="새로운 친구 만나기" description="공부로 모은 조개를 열어 수조의 다음 친구를 발견해보세요." />
    <DrawPity profile={profile} />
    {pendingDraw ? <section className={`aquarium-draw-box ${DRAW_STEP_CLASSES[revealStep] || DRAW_STEP_CLASSES[0]}`}><div className="aquarium-draw-light" /><button type="button" className="aquarium-sound-toggle" aria-label={soundOn ? '축하 효과음 끄기' : '축하 효과음 켜기'} onClick={() => setSoundOn((enabled) => !enabled)}><Icon name={soundOn ? 'bell' : 'alert'} /></button><button type="button" data-action="advanceAquariumDrawReveal" aria-label={`상자 열기 ${revealStep + 1}단계`} onClick={() => { if (soundOn && revealStep === 2) playAquariumRevealSound(rarity); }}><span className="aquarium-chest"><i /><b /></span></button><span>오늘의 공부 보상</span><h2>{revealStep === 0 ? '상자를 세 번 눌러주세요' : revealStep === 1 ? '안에서 움직임이 느껴져요' : '마지막으로 한 번 더!'}</h2><p>{3 - revealStep}번 더 누르면 새로운 친구가 나타나요.</p></section> : <section className="aquarium-draw-ready"><div className="aquarium-sealed-chest"><i /><b /></div><span>DISCOVERY</span><h2>어떤 친구가 기다리고 있을까요?</h2><p>결과는 서버에서 먼저 확정돼요. 중간에 나가도 같은 결과를 이어서 확인할 수 있습니다.</p><div className="aquarium-draw-cost"><span>보유 조개</span><b>{Number(profile?.shellBalance) || 0}</b><i /><span>필요 조개</span><b>30</b></div>{pendingDrawError ? <p className="aquarium-action-error" role="alert">{pendingDrawError}</p> : null}{actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}<button type="button" className="btn btn-primary" data-action="startAquariumDraw" disabled={drawing || pendingDrawStatus !== 'ready' || Number(profile?.shellBalance) < 30}>{drawing ? '결과를 확정하는 중...' : Number(profile?.shellBalance) < 30 ? '조개가 더 필요해요' : '조개 30개로 만나기'}</button></section>}
  </div>;
}

function AquariumSharePanel({ actionError = '', actionStatus = 'idle', activeFish = [], catalog = [], fishCount = 0, profile, result }) {
  const streakDays = Math.max(0, Number(profile?.streakDays) || 0);
  const waterQuality = Math.max(40, Math.min(100, Number(profile?.waterQuality) || 40));
  const shared = result?.type === 'share';
  return <div className="aquarium-mode-shell aquarium-share-view">
    <AquariumModeHeader eyebrow="SHARE" title="나의 공부 수조" description="성적이나 계정 정보 없이 공부로 만든 기록만 공유해요." />
    <section className="aquarium-share-card">
      <div className="aquarium-share-brand"><Icon name="fish" /><span><b>StudyCrack Aquarium</b><small>공부가 쌓일수록 수조도 자라요</small></span></div>
      <AquariumScene activeFish={activeFish} catalog={catalog} />
      <div className="aquarium-share-stats"><div><span>발견한 물고기</span><b>{fishCount} / {catalog.length || 12}종</b></div><div><span>연속 학습</span><b>{streakDays}일</b></div><div><span>수질</span><b>{waterQuality}%</b></div></div>
      <p>개인정보와 입시 성적은 공유 카드에 포함되지 않습니다.</p>
    </section>
    {shared ? <div className="aquarium-share-result" role="status"><Icon name="check" /><span>{result.method === 'clipboard' ? '공유 문구와 링크를 복사했어요.' : '수조 공유를 완료했어요.'}</span></div> : null}
    {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
    <button type="button" className="btn btn-primary aquarium-share-submit" data-action="shareAquarium" disabled={actionStatus === 'sharing'}><Icon name="share" />{actionStatus === 'sharing' ? '공유 화면을 여는 중...' : shared ? '다시 공유하기' : '수조 공유하기'}</button>
  </div>;
}

export function AquariumScreen(ctx) {
  const {
    activeFish = [],
    aquariumActionError = '',
    aquariumActionStatus = 'idle',
    aquariumDrawRevealStep = 0,
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
    tab = 'aquarium'
  } = ctx;
  const selectedFish = fishInventory.find((fish) => fish?.fishId === aquariumSelectedFishId) || activeFish.find((fish) => fish?.fishId === aquariumSelectedFishId) || activeFish.find(Boolean) || fishInventory[0] || null;
  const selectedMeta = catalogMeta(fishCatalog, selectedFish?.speciesId);
  const activeSlot = AQUARIUM_SLOTS.find((slot, index) => activeFish[index]?.fishId === selectedFish?.fishId)?.id || '';
  const loading = gameProfileStatus === 'loading' || (fishCatalogStatus === 'loading' && !fishCatalog.length);
  const unavailable = gameProfileStatus === 'unavailable';
  const fatalError = gameProfileStatus === 'error' ? gameProfileError : fishCatalogStatus === 'error' ? fishCatalogError : '';
  const waterQuality = Math.max(40, Math.min(100, Number(gameProfile?.waterQuality) || 40));

  if (!unavailable && aquariumMode === 'catalog') return <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed}><main className="aquarium-screen"><FishCatalogPanel catalog={fishCatalog} inventory={fishInventory} profile={gameProfile} /></main></AppScreenShell>;
  if (!unavailable && aquariumMode === 'draw') return <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed}><main className="aquarium-screen"><FishDrawPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} catalog={fishCatalog} pendingDraw={pendingDraw} pendingDrawError={pendingDrawError} pendingDrawStatus={pendingDrawStatus} profile={gameProfile} revealStep={aquariumDrawRevealStep} /></main></AppScreenShell>;
  if (!unavailable && aquariumMode === 'share') return <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed}><main className="aquarium-screen"><AquariumSharePanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} activeFish={activeFish} catalog={fishCatalog} fishCount={fishCount || fishInventory.length} profile={gameProfile} result={aquariumResult} /></main></AppScreenShell>;

  return (
    <AppScreenShell screen="aquarium" tab={tab} dimmed={dimmed}>
      <main className="aquarium-screen">
        <AquariumHabitatHeader fishCount={fishCount || fishInventory.length} profile={gameProfile} />
        {loading ? <div className="aquarium-loading" role="status"><i /><b>수조를 채우고 있어요</b></div> : unavailable ? <div className="aquarium-error sc-card" role="status"><b>수조를 순차적으로 열고 있어요</b><p>{gameProfileError || '계정별 적용이 완료되면 이곳에서 바로 확인할 수 있습니다.'}</p><button type="button" className="btn btn-primary" data-action="goto" data-target="timer">타이머로 돌아가기</button></div> : fatalError ? <div className="aquarium-error sc-card" role="alert"><b>수조를 불러오지 못했어요</b><p>{fatalError}</p><button type="button" className="btn btn-primary" data-action="retryGameResources">다시 불러오기</button></div> : <>
          <div className="aquarium-scene-wrap"><AquariumScene activeFish={activeFish} catalog={fishCatalog} selectedFishId={selectedFish?.fishId || ''} streakDays={gameProfile?.streakDays} waterQuality={waterQuality} /><div className="aquarium-quality"><div><span>수질</span><b>{waterQuality}</b></div><span><i style={{ width: `${waterQuality}%` }} /></span><small>{waterQuality >= 85 ? '맑음' : waterQuality >= 65 ? '안정' : '돌봄 필요'}</small></div></div>
          {gameProfile?.starterState === 'selectable' ? <StarterPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} catalog={fishCatalog} selectedSpeciesId={aquariumStarterSpeciesId} /> : null}
          {gameProfile?.starterState === 'locked' ? <LockedStarterPanel /> : null}
          {gameProfile?.starterState === 'claimed' ? <FishCarePanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} activeSlot={activeSlot} fish={selectedFish} foodBalance={Number(gameProfile?.foodBalance) || 0} meta={selectedMeta} result={aquariumResult} /> : null}
          {gameProfile?.starterState === 'claimed' ? <FishInventoryPanel actionError={aquariumActionError} actionStatus={aquariumActionStatus} activeFish={activeFish} catalog={fishCatalog} inventory={fishInventory} result={aquariumResult} selectedFish={selectedFish} /> : null}
          <section className="aquarium-next-actions"><button type="button" data-action="goto" data-target="timer"><Icon name="timer" /><span><b>공부해서 먹이 모으기</b><small>타이머로 이동</small></span><i aria-hidden="true">›</i></button><button type="button" data-action="openAquariumCatalog"><Icon name="report" /><span><b>물고기 도감</b><small>{fishCount || fishInventory.length} / {fishCatalog.length || 12}종 수집</small></span><i aria-hidden="true">›</i></button><button type="button" data-action="openAquariumDraw" disabled={gameProfile?.starterState !== 'claimed'}><Icon name="plus" /><span><b>{pendingDraw ? '뽑기 결과 확인' : '새 물고기 만나기'}</b><small>{pendingDraw ? '확인하지 않은 결과가 있어요' : '조개 30개 사용'}</small></span><i aria-hidden="true">›</i></button><button type="button" data-action="openAquariumShare" disabled={!fishInventory.length}><Icon name="share" /><span><b>수조 공유하기</b><small>성적 없이 공부 기록만</small></span><i aria-hidden="true">›</i></button></section>
        </>}
      </main>
    </AppScreenShell>
  );
}

import { Icon } from '../../components/Icon.jsx';
import { FishArtwork } from './FishArtwork.jsx';
import { StatusState } from '../../components/StatusState.js';
import { nextFishDexFilter } from './presentation.js';
import { AquariumModeHeader, RARITY_ORDER, RARITY_LABELS, RARITY_CLASSES, CATALOG_FILTERS, CATEGORY_ORDER, CATEGORY_LABELS } from './aquarium-panel-shared.jsx';

function acquisitionLabel(fish) {
  if (typeof fish?.acquiredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(fish.acquiredAt)) return '획득일 확인 필요';
  const date = new Date(fish.acquiredAt);
  if (!Number.isFinite(date.getTime())) return '획득일 확인 필요';
  return `획득일 · ${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)}`;
}

export function FishDexPanel({ selection, setSelection, catalog = [], error = '', inventory = [], profile, status = 'idle' }) {
  const { filter, category, expanded } = selection;
  const setFilter = (value) => setSelection(current => ({ ...current, filter: value }));
  const setCategory = (value) => setSelection(current => ({ ...current, category: value }));
  const handleFilterKeyDown = (event) => {
    const current = event.currentTarget.getAttribute('data-fishdex-filter') || filter;
    const next = nextFishDexFilter(current, event.key);
    if (next === current) return;
    event.preventDefault();
    setFilter(next);
    event.currentTarget.parentElement?.querySelector?.(`[data-fishdex-filter="${next}"]`)?.focus?.();
  };
  const ownedSpecies = new Set(inventory.map((fish) => fish.speciesId));
  const ownedCount = catalog.filter((fish) => fish.owned || ownedSpecies.has(fish.speciesId)).length;
  const total = catalog.length;
  const collectionPct = total ? Math.round((ownedCount / total) * 100) : 0;
  const availableCategories = CATEGORY_ORDER.filter((item) => item === 'all' || catalog.some((fish) => fish.category === item));
  const categoryCatalog = catalog.filter((fish) => category === 'all' || fish.category === category);
  const visibleCatalog = categoryCatalog.filter((fish) => filter === 'all' || (filter === 'owned' ? fish.owned || ownedSpecies.has(fish.speciesId) : !(fish.owned || ownedSpecies.has(fish.speciesId))));
  if (status === 'loading') return <div className="aquarium-mode-shell aquarium-catalog-view"><div className="aquarium-catalog-hero"><AquariumModeHeader eyebrow="FISH DEX" title="물고기 도감" description="완료한 공부가 새로운 친구의 기록으로 남아요." /></div><StatusState className="aquarium-catalog-status" kind="loading" title="FishDex를 불러오고 있어요" description="획득한 친구와 잠긴 도감을 확인하고 있습니다." /></div>;
  if (status === 'error') return <div className="aquarium-mode-shell aquarium-catalog-view"><div className="aquarium-catalog-hero"><AquariumModeHeader eyebrow="FISH DEX" title="물고기 도감" description="완료한 공부가 새로운 친구의 기록으로 남아요." /></div><StatusState action={<button type="button" className="btn btn-primary" data-action="retryGameResources">다시 불러오기</button>} className="aquarium-catalog-status" kind="error" title="FishDex를 불러오지 못했어요" description={error || '물고기 목록을 다시 확인해주세요.'} /></div>;
  if (status === 'ready' && !catalog.length) return <div className="aquarium-mode-shell aquarium-catalog-view"><div className="aquarium-catalog-hero"><AquariumModeHeader eyebrow="FISH DEX" title="물고기 도감" description="완료한 공부가 새로운 친구의 기록으로 남아요." /></div><StatusState className="aquarium-catalog-status" kind="empty" title="FishDex가 아직 비어 있어요" description="첫 물고기 목록이 준비되면 이곳에서 만날 수 있어요." /></div>;
  return <div className="aquarium-mode-shell aquarium-catalog-view">
    <div className="aquarium-catalog-hero"><AquariumModeHeader eyebrow="FISH DEX" title="물고기 도감" description="완료한 공부가 새로운 친구의 기록으로 남아요." /><section className="aquarium-collection-summary"><div><span>발견한 친구</span><b>{ownedCount}<small> / {total}</small></b></div><div><span>수집률</span><b>{collectionPct}%</b></div><i><span style={{ width: `${collectionPct}%` }} /></i></section></div>
    <button type="button" className="aquarium-draw-entry" data-action="openAquariumDraw" disabled={profile?.starterState !== 'claimed'}><span>조개 {Number(profile?.shellBalance) || 0}개</span><b>새 물고기 만나기</b><small>{profile?.starterState === 'claimed' ? '한 번에 조개 30개' : '첫 물고기를 먼저 선택해주세요'}</small><i aria-hidden="true">›</i></button>
    <div className="aquarium-catalog-filter" role="group" aria-label="FishDex 획득 상태">{CATALOG_FILTERS.map((item) => <button type="button" className={filter === item.id ? 'is-active' : ''} data-fishdex-filter={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} onKeyDown={handleFilterKeyDown} key={item.id}>{item.label}</button>)}</div>
    {availableCategories.length > 2 ? <div className="aquarium-category-disclosure"><button type="button" aria-expanded={expanded} aria-controls="fishdex-categories" onClick={() => setSelection(current => ({ ...current, expanded: !current.expanded }))}>생태 분류 · {CATEGORY_LABELS[category]}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button><div id="fishdex-categories" hidden={!expanded}><div className="aquarium-catalog-categories" role="group" aria-label="생태 분류">{availableCategories.map((item) => <button type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)} key={item}>{CATEGORY_LABELS[item] || item}</button>)}</div></div></div> : null}
    <div className="aquarium-catalog-selection"><span>{CATEGORY_LABELS[category] || '모든 생태'}</span><b>{visibleCatalog.length}종</b></div>
    <div className="aquarium-catalog-groups">{RARITY_ORDER.map((rarity) => {
      const rarityCatalog = categoryCatalog.filter((fish) => fish.rarity === rarity);
      const rows = rarityCatalog.filter((fish) => filter === 'all' || (filter === 'owned' ? fish.owned || ownedSpecies.has(fish.speciesId) : !(fish.owned || ownedSpecies.has(fish.speciesId))));
      if (!rows.length) return null;
      return <section className={`aquarium-catalog-group ${RARITY_CLASSES[rarity]}`} key={rarity}><header><div><span>{rarity.toUpperCase()}</span><b>{RARITY_LABELS[rarity]}</b></div><small>{rarityCatalog.filter((fish) => fish.owned || ownedSpecies.has(fish.speciesId)).length} / {rarityCatalog.length}</small></header><div>{rows.map((fish) => {
        const owned = fish.owned || ownedSpecies.has(fish.speciesId);
        const ownedFish = inventory.find((item) => item.speciesId === fish.speciesId);
        return <article className={owned ? 'is-owned' : 'is-locked'} data-state={owned ? 'owned' : 'locked'} data-category={fish.category || 'unknown'} data-rarity={rarity} aria-label={owned ? `${fish.displayName} 획득` : '미획득 물고기'} key={fish.speciesId}><div className="aquarium-catalog-card-meta"><span>{RARITY_LABELS[rarity]}</span><span aria-hidden="true">{owned ? <Icon name="check" /> : <svg className="icon" viewBox="0 0 24 24" focusable="false"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></svg>}</span></div><div className="aquarium-catalog-sprite"><FishArtwork assetKey={fish.assetKey} colors={fish.colors} fishId={ownedFish?.fishId} growthStage={ownedFish?.growthStage} speciesId={fish.speciesId} variant="grid" /></div><b>{owned ? fish.displayName : '???'}</b><small>{owned ? acquisitionLabel(ownedFish) : '공부로 모은 조개로 새로운 친구를 만나보세요.'}</small></article>;
      })}</div></section>;
    })}{visibleCatalog.length ? null : <div className="aquarium-catalog-empty"><b>조건에 맞는 물고기가 없어요</b><p>획득 상태나 생태 분류를 바꿔 다시 확인해주세요.</p></div>}</div>
  </div>;
}

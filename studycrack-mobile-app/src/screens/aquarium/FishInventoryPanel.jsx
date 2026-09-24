import { AQUARIUM_SLOTS } from '../../features/gamification/aquarium-presentation.js';
import { FishArtwork } from './FishArtwork.jsx';
import { catalogMeta, RARITY_LABELS } from './aquarium-panel-shared.jsx';

export function FishInventoryPanel({ actionError = '', actionStatus = 'idle', activeFish = [], catalog = [], inventory = [], result = null, selectedFish, nameDraft, onNameChange }) {
  if (!inventory.length) return null;
  const activeSlot = AQUARIUM_SLOTS.find((slot, index) => activeFish[index]?.fishId === selectedFish?.fishId)?.id || '';
  const busy = ['feeding', 'renaming', 'updating-slot', 'uncertain', 'checking-care'].includes(actionStatus);
  const selectedMeta = catalogMeta(catalog, selectedFish?.speciesId);
  return (
    <section className="aquarium-inventory sc-card">
      <div className="aquarium-section-head"><div><span>MY FISH</span><h2>내 물고기</h2><p>친구를 선택해 수조 위치와 이름을 관리하세요.</p></div><b>{inventory.length}마리</b></div>
      <div className="aquarium-inventory-grid">{inventory.map((fish) => {
        const meta = catalogMeta(catalog, fish.speciesId);
        const slot = AQUARIUM_SLOTS.find((item, index) => activeFish[index]?.fishId === fish.fishId);
        return <button type="button" disabled={busy} className={selectedFish?.fishId === fish.fishId ? 'is-selected' : ''} data-action="selectAquariumFish" data-fish-id={fish.fishId} aria-label={`${fish.name} 관리`} key={fish.fishId}><FishArtwork assetKey={meta.assetKey} colors={meta.colors} fishId={fish.fishId} growthStage={fish.growthStage} speciesId={fish.speciesId} variant="grid" /><span><b>{fish.name}</b><small>Lv.{fish.level} · {RARITY_LABELS[meta.rarity] || '일반'}</small></span>{slot ? <em>{slot.label}</em> : null}</button>;
      })}</div>
      {selectedFish ? <div className="aquarium-manage-detail">
        <div className="aquarium-manage-summary"><FishArtwork assetKey={selectedMeta.assetKey} colors={selectedMeta.colors} fishId={selectedFish.fishId} growthStage={selectedFish.growthStage} speciesId={selectedFish.speciesId} variant="detail" /><div><span>{selectedMeta.displayName}</span><b>{selectedFish.name}</b><small>{activeSlot ? `${AQUARIUM_SLOTS.find((slot) => slot.id === activeSlot)?.label}에 배치 중` : '현재 수조 밖에 있어요'}</small></div></div>
        <div className="aquarium-slot-control"><span>수조 위치</span><div>{AQUARIUM_SLOTS.map((slot) => <button type="button" className={activeSlot === slot.id ? 'is-active' : ''} data-action="setAquariumFishSlot" data-slot={slot.id} disabled={busy} key={slot.id}><b>{slot.label}</b><small>{activeSlot === slot.id ? '해제' : '배치'}</small></button>)}</div></div>
        <div className="aquarium-rename-control"><label htmlFor="aquarium-fish-name">이름 변경</label><div><input id="aquarium-fish-name" className="planner-input" data-field="aquariumFishName" value={nameDraft ?? selectedFish.name} onChange={event => onNameChange?.(selectedFish.fishId, event.target.value)} disabled={busy} key={selectedFish.fishId} maxLength="20" autoComplete="off" placeholder="물고기 이름" /><button type="button" className="btn btn-secondary" data-action="saveAquariumFishName" disabled={busy}>{actionStatus === 'renaming' ? '저장 중...' : '저장'}</button></div><small>한글, 영문, 숫자로 공백 제외 10자까지 입력할 수 있어요. 접거나 다른 물고기를 선택해도 작성 중인 이름은 이 화면에 남아요.</small></div>
      </div> : null}
      {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
      {result?.type === 'slot' ? <div className="aquarium-manage-result" role="status"><span>{result.remove ? '수조에서 잠시 쉬도록 했어요.' : result.arriving ? '물고기가 수조에 합류했어요.' : '선택한 위치로 배치했어요.'}</span><button type="button" data-action="dismissAquariumResult">확인</button></div> : null}
      {result?.type === 'rename' ? <div className="aquarium-manage-result"><span>{result.fish.name}(으)로 이름을 저장했어요.</span><button type="button" data-action="dismissAquariumResult">확인</button></div> : null}
    </section>
  );
}

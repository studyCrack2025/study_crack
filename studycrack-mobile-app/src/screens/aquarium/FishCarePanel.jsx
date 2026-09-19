import { AQUARIUM_SLOTS } from '../../features/gamification/aquarium-presentation.js';

export function FishCarePanel({ actionError = '', actionStatus = 'idle', activeSlot = '', fish, foodBalance = 0, meta, result = null }) {
  if (!fish) return <section className="aquarium-care-empty sc-card"><b>수조가 아직 비어 있어요</b><p>첫 물고기를 선택하면 성장 정보와 먹이 주기가 이곳에 나타납니다.</p></section>;
  const maxLevel = Number(fish.level) >= 10;
  const growthLabel = { young: '어린 물고기', growing: '자라는 중', adult: '성체', master: '성장 완료' }[fish.growthStage] || '성장 정보 확인 필요';
  const busy = ['feeding', 'renaming', 'updating-slot', 'uncertain', 'checking-care'].includes(actionStatus);
  return (
    <section className="aquarium-care sc-card">
      <div className="aquarium-section-head"><div><span>{String(meta.rarity || 'common').toUpperCase()}</span><h2>{fish.name}</h2><p>{meta.displayName} · {growthLabel}</p></div><b>Lv.{fish.level}</b></div>
      <div className="aquarium-exp"><div><span>성장 경험치</span><b>{maxLevel ? 'MAX' : `${fish.currentLevelExp} / ${fish.nextLevelExp - (fish.exp - fish.currentLevelExp)}`}</b></div><span><i style={{ width: `${fish.progressPct}%` }} /></span></div>
      <div className="aquarium-feed-row"><div><span>{activeSlot ? `${AQUARIUM_SLOTS.find((slot) => slot.id === activeSlot)?.label} 배치` : '수조 밖 보관 중'}</span><b>{foodBalance}개</b><small>보유 먹이</small></div><button type="button" className="btn btn-primary" data-action="feedAquariumFish" disabled={!activeSlot || foodBalance < 1 || maxLevel || busy}>{actionStatus === 'feeding' ? '먹이를 주는 중...' : !activeSlot ? '배치 후 먹이 주기' : maxLevel ? '최대 레벨' : '먹이 주기'}</button></div>
      {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
      {result?.type === 'feed' && result.fish.fishId === fish.fishId ? <div role="status" className={`aquarium-care-result ${result.levelUp ? 'is-level-up' : ''}`}><b>{result.levelUp ? `레벨 업! Lv.${result.fish.level}` : `EXP +${result.expGranted}`}</b><span>{fish.name}에게 먹이를 주었어요.</span><button type="button" data-action="dismissAquariumResult">확인</button></div> : null}
    </section>
  );
}

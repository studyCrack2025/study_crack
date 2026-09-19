import { AquariumScene } from '../../components/aquarium/AquariumScene.jsx';

export function HomeAquariumPreview({ presentation }) {
  const ready = presentation?.status === 'ready' && presentation.ownedCount !== null;
  const status = presentation?.status || 'idle';
  return <section className="home-aquarium-preview sc-card" aria-label="내 물고기">
    <div className="timer-section-head"><div><h2>내 물고기</h2><p>오늘 공부가 수조에 남아요</p></div><button type="button" data-action="goto" data-target="aquarium">전체 보기 <b aria-hidden="true">›</b></button></div>
    {ready ? <><div className="home-aquarium-link"><AquariumScene backgroundKey={presentation.backgroundKey} slots={presentation.slots} variant="home" /><button type="button" className="home-aquarium-open" data-action="goto" data-target="aquarium" aria-label={`수조 전체 보기 · 보유 물고기 ${presentation.ownedCount}마리`}><span className="home-aquarium-count">물고기 {presentation.ownedCount}마리</span></button></div>{presentation.ownedCount === 0 ? <p className="home-aquarium-notice">공부 완료 후 보상을 확인하고 수조에서 첫 친구를 만나보세요.</p> : presentation.activeCount === 0 ? <p className="home-aquarium-notice">수조에서 보유 물고기를 배치해주세요.</p> : null}</> : <div className="home-aquarium-state" role="status"><p>{status === 'error' ? '수조를 불러오지 못했어요.' : status === 'unavailable' ? '수조 기능을 준비하고 있어요.' : status === 'ready' ? '물고기 정보를 확인해주세요.' : '수조를 불러오고 있어요.'}</p>{status === 'error' ? <button type="button" data-action="retryGameResources">수조 다시 확인</button> : null}</div>}
  </section>;
}

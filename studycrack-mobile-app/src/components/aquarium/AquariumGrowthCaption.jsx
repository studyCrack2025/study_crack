import { AquariumUnlockNotice } from './AquariumUnlockNotice.jsx';

export function AquariumGrowthCaption({ view, interactive }) {
  if (!view) return null;
  const growth = view.growth;
  const pending = ['idle', 'loading'].includes(view.status);
  return <div className="aquarium-growth-caption" data-growth-status={view.status}>
    <span>{growth ? `성장 인정 ${growth.validDayCount}일${growth.highestUnlockedStage ? ` · DAY ${growth.highestUnlockedStage.slice(3)}` : ' · 첫 성장 준비'}` : pending ? '성장 기록 확인 중' : '성장 기록 확인 필요'}</span>
    {interactive ? <>
      <AquariumUnlockNotice view={view} />
      <small>{growth ? `${growth.countingSince}부터 집계 · 이전 이력 미확인${view.status !== 'ready' ? ' · 최신 확인 필요' : growth.nextStageDays === null ? ' · 최종 배경 달성' : ` · 다음 배경까지 ${growth.nextStageDays}일`}` : view.status === 'unavailable' ? '성장 기능을 준비하고 있어요.' : '기기 체크나 연속 학습으로 성장 일수를 추정하지 않아요.'}</small>
      {view.status === 'account-changed' ? <small>계정이 변경되었어요. 화면을 새로 열어주세요.</small> : !pending && view.refresh ? <button type="button" onClick={view.refresh}>성장 기록 다시 확인</button> : null}
    </> : view.status === 'stale' ? <small>마지막 확인 기록</small> : null}
  </div>;
}

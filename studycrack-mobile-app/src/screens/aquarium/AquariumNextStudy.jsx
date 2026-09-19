import { Icon } from '../../components/Icon.jsx';

export function AquariumNextStudy({ items = [], planner, canAccessBasic = false }) {
  const ready = canAccessBasic && planner?.status === 'ready';
  const rows = ready && Array.isArray(items) ? items.filter(item => item && typeof item === 'object') : [];
  const next = rows.find(item => !item.done);
  const minutes = Number(next?.minutes);
  const title = next ? next.content || next.subject || '다음 공부 계획' : !canAccessBasic ? '오늘의 공부 계획을 확인해요' : !ready ? '오늘 계획을 확인해주세요' : rows.length ? '오늘 계획을 모두 체크했어요' : '첫 공부 계획을 만들어볼까요?';
  return <section className="aquarium-next-study" aria-label="다음 공부 계획">
    <span className="aquarium-next-study-time">{next && Number.isFinite(minutes) && minutes > 0 ? <><b>{minutes}</b><small>분</small></> : <Icon name="calendar" />}</span>
    <div><small>{next ? `NEXT ACTION · ${next.subject || '공부'}` : 'TODAY PLAN'}</small><h2>{title}</h2><p>{next ? '플래너에서 계획을 확인하고 공부를 이어가요.' : '계획 체크와 확정된 공부 보상은 따로 관리해요.'}</p></div>
    <button type="button" data-action="goto" data-target="planner" aria-label="플래너에서 다음 공부 확인">계획 보기</button>
  </section>;
}

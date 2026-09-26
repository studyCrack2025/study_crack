export function TargetAllowance({ policy, showPlanAction = true }) {
  if (!policy) return null;
  return <div className="analysis-target-allowance" role="status">
    <div><span>{policy.plan} · 등록 {policy.count}/6</span><b>{policy.label}</b></div>
    <p>{policy.reason || (policy.unlimited ? '등록은 최대 6개, 대학 변경 횟수에는 제한이 없어요.' : policy.remaining === null ? '추가 시 서버에서 남은 횟수를 확인해요.' : '대학·학과를 새로 등록하면 1회 사용해요. 삭제는 차감하지 않아요.')}</p>
    {showPlanAction && !policy.unlimited && policy.remaining === 0 ? <button type="button" className="btn btn-secondary mini" data-action="goto" data-target="proIntro">요금제 확인하기</button> : null}
  </div>;
}

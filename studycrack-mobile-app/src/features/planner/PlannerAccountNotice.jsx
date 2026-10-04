import { useContext } from 'react';
import { PlannerStorageContext } from './PlannerStorageContext.js';
import { plannerAccountMessage } from './PlannerAccountPanel.jsx';
import { Icon } from '../../components/Icon.jsx';

export function PlannerAccountNotice() {
  const workspace = useContext(PlannerStorageContext)?.controller?.account;
  const view = workspace?.getView();
  const account = view?.mode === 'account';
  const pending = view?.snapshot?.queue?.length || 0;
  const failed = account && view.result?.ok === false;
  const label = !account ? '이 기기에 보관 중' : view.busy ? '저장 중' : view.result?.status === 409 || view.result?.error === 'conflict' ? '다른 기기의 변경이 있어요' : failed || pending ? '저장을 다시 확인해요' : !view.verified ? '계정 연결 확인 필요' : '저장된 계획';
  return <section className="planner-storage-notice" aria-label="계정 저장 상태" aria-busy={Boolean(view?.busy)}>
    <div className="planner-storage-status"><Icon name={failed || pending ? 'alert' : account ? 'check' : 'shield'} /><p role={failed ? 'alert' : 'status'}>{label}{account && pending ? ` · 서버 반영 대기 ${pending}건` : ''}{account && view.result?.ok && ['issued', 'ineligible'].includes(view.result.completionStatus) ? ` · ${plannerAccountMessage(view.result)}` : ''}</p></div>
    {failed || (account && pending) ? <p className="planner-storage-warning">{plannerAccountMessage(view.result)}{pending ? ' 완료·보상은 확인 전이에요. 초안은 유지돼요.' : ''}</p> : null}
    <details><summary>저장 안내</summary><p>{!account ? '이 계획은 이 기기에만 저장돼요. 계정으로 가져오기는 계획 저장 관리에서 할 수 있어요.' : view.snapshot?.version === 2 ? '계획 시간은 계정에 저장돼요. 메모는 이 기기에 보관해요.' : '계획은 계정에, 시간과 메모는 이 기기에 저장돼요.'}</p></details>
    {account && pending ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.run('retry')}>서버 반영 다시 확인</button> : null}
    {account && !view.verified && !pending ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.run('check')}>계정 연결 다시 확인</button> : null}
  </section>;
}

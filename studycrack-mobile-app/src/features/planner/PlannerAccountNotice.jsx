import { useContext, useEffect, useState } from 'react';
import { PlannerStorageContext } from './PlannerStorageContext.js';
import { plannerAccountMessage } from './PlannerAccountPanel.jsx';
import { Icon } from '../../components/Icon.jsx';

export function PlannerAccountNotice({ onManage } = {}) {
  const workspace = useContext(PlannerStorageContext)?.controller?.account;
  const view = workspace?.getView();
  const account = view?.mode === 'account';
  const pending = view?.snapshot?.queue?.length || 0;
  const result = view?.result;
  const failed = result?.ok === false;
  const [expired, setExpired] = useState(null);
  const completion = account && result?.ok && ['issued', 'ineligible'].includes(result.completionStatus) && expired !== result && Date.now() < (view.resultAt || 0) + 4500;
  useEffect(() => {
    if (!completion) return undefined;
    const timeout = setTimeout(() => setExpired(result), Math.max(0, view.resultAt + 4500 - Date.now()));
    return () => clearTimeout(timeout);
  }, [completion, result, view?.resultAt]);
  if (!failed && !pending && !(account && (view.busy || !view.verified)) && !completion) return null;
  const label = completion ? plannerAccountMessage(result) : view?.busy ? '저장 중' : result?.status === 409 || result?.error === 'conflict' ? '다른 기기의 변경이 있어요' : failed || pending ? '저장을 다시 확인해요' : '계정 연결 확인 필요';
  return <section className="planner-storage-notice" aria-label="계정 저장 상태" aria-busy={Boolean(view?.busy)}>
    <div className="planner-storage-status"><Icon name={failed || pending ? 'alert' : 'check'} /><p role={failed ? 'alert' : 'status'}>{label}{pending ? ` · 서버 반영 대기 ${pending}건` : ''}</p></div>
    {pending ? <p className="planner-storage-warning">완료·보상은 확인 전이에요. 초안은 유지돼요.</p> : failed ? <p className="planner-storage-warning">{plannerAccountMessage(result)}</p> : null}
    {account && pending ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.run('retry')}>서버 반영 다시 확인</button> : null}
    {onManage && (failed || pending || (account && !view.verified)) ? <button type="button" className="btn" disabled={view.busy} onClick={onManage}>계획 보관 설정</button> : !view?.verified && !pending ? <button type="button" className="btn" disabled={view?.busy} onClick={() => workspace?.run('check')}>계정 연결 다시 확인</button> : null}
  </section>;
}

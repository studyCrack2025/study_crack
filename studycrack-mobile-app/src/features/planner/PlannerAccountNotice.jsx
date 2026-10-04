import { useContext } from 'react';
import { PlannerStorageContext } from './PlannerStorageContext.js';
import { plannerAccountMessage } from './PlannerAccountPanel.jsx';

export function PlannerAccountNotice() {
  const workspace = useContext(PlannerStorageContext)?.controller?.account;
  const view = workspace?.getView();
  if (view?.mode !== 'account') return null;
  const pending = view.snapshot?.queue?.length || 0;
  return <section className="card planner-account-body" aria-label="계정 저장 상태">
    <p>{view.snapshot?.version === 2 ? '계획 시간은 계정에 저장돼요. 메모는 이 기기에 보관해요.' : '계획은 계정에, 시간과 메모는 이 기기에 저장돼요.'}</p>
    <p role={view.result?.ok === false ? 'alert' : 'status'}>{view.busy ? '서버 반영을 확인하고 있어요…' : plannerAccountMessage(view.result)}{pending ? ` 서버 반영 대기 ${pending}건 · 완료·성장은 아직 확정되지 않았어요.` : ''}</p>
    {pending ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.run('retry')}>서버 반영 다시 확인</button> : null}
    {!view.verified && !pending ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.run('check')}>계정 연결 다시 확인</button> : null}
  </section>;
}

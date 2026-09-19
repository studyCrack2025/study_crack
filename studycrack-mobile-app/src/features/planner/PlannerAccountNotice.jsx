import { useContext } from 'react';
import { PlannerStorageContext } from './PlannerStorageContext.js';
import { plannerAccountMessage } from './PlannerAccountPanel.jsx';

export function PlannerAccountNotice() {
  const workspace = useContext(PlannerStorageContext)?.controller?.account;
  const view = workspace?.getView();
  if (view?.mode !== 'account') return null;
  const pending = view.snapshot?.queue?.length || 0;
  return <section className="card planner-account-body" aria-label="계정 저장 상태">
    <p>계정 계획 · 시간·메모는 이 계정의 현재 기기에만 보관해요. 타이머는 기존 기기 계획을 사용해요.</p>
    <p role={view.result?.ok === false ? 'alert' : 'status'}>{view.busy ? '서버 반영을 확인하고 있어요…' : plannerAccountMessage(view.result)}{pending ? ` 서버 반영 대기 ${pending}건 · 완료·성장은 아직 확정되지 않았어요.` : ''}</p>
    {pending ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.run('retry')}>서버 반영 다시 확인</button> : null}
    {!view.verified && !pending ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.run('check')}>계정 연결 다시 확인</button> : null}
  </section>;
}

import { useContext } from 'react';
import { PlannerStorageContext } from './PlannerStorageContext.js';

export function plannerAccountMessage(result) {
  if (!result) return '';
  if (result.ok) return '계정 기록을 확인했어요.';
  if (result.status === 503 || result.status === 400) return '계정 동기화를 준비하고 있어요. 기존 기기 계획은 그대로 사용할 수 있어요.';
  if (result.status === 403) return '현재 계정의 플래너 이용 권한을 확인해주세요.';
  if (result.status === 409 || result.error === 'conflict') return '다른 변경과 충돌했어요. 대기 기록은 보존되며, 자동으로 덮어쓰지 않아요.';
  return ({ session: '로그인 계정이 바뀌었어요. 계정 기록 확인을 다시 눌러주세요.', locking: '이 환경에서는 안전한 동기화를 지원하지 않아요. 기존 기기 계획은 유지돼요.',
    pending: '전송 대기 기록이 있어요. 대기 기록 전송 후 목록을 다시 확인해주세요.', storage: '계정 기록을 기기에 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해주세요.',
    response: '계정 기록을 확인하지 못했어요. 기록을 변경하지 않았으니 다시 확인해주세요.', 'already-imported': '이미 가져온 계획이에요.',
    invalid: '계획 제목은 200자, 과목은 40자 이내로 입력해주세요. 날짜와 입력 내용을 확인해주세요.',
    'completed-edit': '완료된 계획은 완료 취소 후 수정해주세요. 이전 성장 기록은 유지돼요.',
    'completed-legacy': '완료했거나 공부 시간이 있는 기기 기록은 가져오지 않아요.' })[result.error] || '연결을 확인한 뒤 다시 시도해주세요. 전송 대기 기록은 그대로 남아 있어요.';
}

export function PlannerAccountPanel() {
  const controller = useContext(PlannerStorageContext)?.controller;
  if (!controller) return null;
  const workspace = controller.account, view = workspace.getView();
  const run = (kind, input) => workspace.run(kind, input);
  const snapshot = view.snapshot, pending = snapshot?.queue?.length || 0;
  const candidates = view.verified ? controller.getItems().filter(item => !item.done && !(Number(item.doneMinutes) > 0) && !snapshot?.imports?.some(row => row.sourceId === item.id)) : [];
  const items = view.verified ? (snapshot?.items || []).filter(item => !item.deleted) : [];
  return <details className="card planner-account-panel">
    <summary>계정에 저장한 계획</summary>
    <div className="planner-account-body" aria-busy={view.busy}>
      <p>기기 계획과 별도로 보관해요. 선택한 미완료 계획만 가져오며 원본은 그대로 남아요. 시간·메모는 해당 계정의 이 기기에만 보관하며 다른 기기로 전송하지 않아요.</p>
      <div className="planner-account-actions">
        <button type="button" className="btn" disabled={view.busy} onClick={() => run('check')}>계정 기록 확인</button>
        {pending > 0 ? <button type="button" className="btn" disabled={view.busy} onClick={() => run('retry')}>대기 기록 1건 전송</button> : null}
        {view.verified ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.setMode(view.mode === 'account' ? 'device' : 'account')}>{view.mode === 'account' ? '기기 계획으로 전환' : '계정 계획으로 전환'}</button> : null}
      </div>
      <p role="status">{view.busy ? '계정 기록을 확인하고 있어요…' : plannerAccountMessage(view.result)}{pending > 0 ? ` 전송 대기 ${pending}건` : ''}</p>
      {view.result?.status === 409 && pending === 1 ? <div><p>서버에 더 최신인 원본이 있을 때만 그 기록을 사용해요. 대기 변경 내용은 보관되며 자동으로 덮어쓰지 않아요.</p><button type="button" className="btn" disabled={view.busy} onClick={() => run('resolve', snapshot.queue[0].data.requestId)}>서버 기록 사용 · 대기 변경 보관</button></div> : null}
      {snapshot?.resolved?.length ? <details><summary>보관한 대기 변경 {snapshot.resolved.length}건</summary>{snapshot.resolved.map(row => <p key={row.data.requestId}>{row.data.title || (row.type === 'complete_server_planner' ? '완료 요청' : '삭제 요청')} · {row.data.date || '기존 계획'} · 서버에는 다시 보내지 않아요.</p>)}</details> : null}
      {view.verified ? <>
        <p>마지막 서버 확인 기준 · 성장 인정 {snapshot?.growth?.validDayCount ?? 0}일</p>
        <p>{snapshot?.growth?.countingSince}부터 집계 · 이전 성장 이력은 확인되지 않았어요.</p>
        {items.length ? <ul className="planner-account-list">{items.map(item => <li key={item.id}><small>{item.date} · {item.subject} · {item.completed ? '완료' : '미완료'}</small><b>{item.title}</b></li>)}</ul> : <p>계정에 저장된 계획이 없어요.</p>}
        <h4>기기 계획 선택해서 가져오기</h4>
        <p>완료·공부 기록은 가져오지 않아요. 가져오기만으로 성장 일수가 늘어나지는 않아요.</p>
        {candidates.length ? <ul className="planner-account-list">{candidates.map(item => <li key={item.id}><small>{item.date} · {item.subject}</small><b>{item.content}</b><button type="button" className="btn" disabled={view.busy || pending > 0} onClick={() => run('copy', item.id)} aria-label={`${item.content} 계정으로 가져오기`}>계정으로 가져오기</button></li>)}</ul> : <p>가져올 미완료 기기 계획이 없어요.</p>}
      </> : null}
    </div>
  </details>;
}

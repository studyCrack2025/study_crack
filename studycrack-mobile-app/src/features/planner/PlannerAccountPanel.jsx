import { AnimatedDetails } from '../../components/AnimatedDetails.jsx';
import { useContext } from 'react';
import { PlannerStorageContext } from './PlannerStorageContext.js';
import { PlannerStorageDestination } from './PlannerStorageDestination.jsx';

export function plannerAccountMessage(result) {
  if (!result) return '';
  if (result.ok) return result.completionStatus === 'issued' ? result.replayed ? '이 완료의 뽑기권 지급 내역을 복원했어요. 추가 지급은 아니에요.' : '완료 확인 · 이 계획의 뽑기권 1장이 지급됐어요.' : result.completionStatus === 'ineligible' ? '완료 확인 · 30분 미만 계획은 뽑기권이 지급되지 않아요.' : '계정 기록을 확인했어요.';
  if (result.status === 503 || result.status === 400) return '계정 동기화를 준비하고 있어요. 기존 기기 계획은 그대로 사용할 수 있어요.';
  if (result.status === 403) return '현재 계정의 플래너 이용 권한을 확인해주세요.';
  if (result.status === 409 || result.error === 'conflict') return '다른 변경과 충돌했어요. 대기 기록은 보존되며, 자동으로 덮어쓰지 않아요.';
  return ({ session: '로그인 계정이 바뀌었어요. 계정 기록 확인을 다시 눌러주세요.', locking: '이 환경에서는 안전한 동기화를 지원하지 않아요. 기존 기기 계획은 유지돼요.',
    pending: '전송 대기 기록이 있어요. 대기 기록 전송 후 목록을 다시 확인해주세요.', storage: '계정 기록을 기기에 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해주세요.',
    response: '계정 기록을 확인하지 못했어요. 기록을 변경하지 않았으니 다시 확인해주세요.', 'already-imported': '이미 가져온 계획이에요.',
    invalid: '날짜와 계획 시간을 확인해주세요. 제목은 200자, 과목은 40자 이내로 입력해주세요.',
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
  return <div className="planner-account-panel planner-account-body" aria-busy={view.busy}>
    <section className="planner-account-group" aria-label="보관 위치">
      <h4>보관 위치</h4><PlannerStorageDestination />
      <p>{snapshot?.version === 2 ? '계정 모드에서는 계획과 시간은 계정에 저장돼요. 메모는 이 기기에만 보관해요.' : '계정 모드에서는 계획은 계정에, 시간과 메모는 이 기기에 저장돼요.'}</p>
      {view.verified ? <button type="button" className="btn" disabled={view.busy} onClick={() => workspace.setMode(view.mode === 'account' ? 'device' : 'account')}>{view.mode === 'account' ? '기기 계획으로 전환' : '계정 계획으로 전환'}</button> : null}
      {view.verified && view.supportsV2 && snapshot?.version === 1 ? <button type="button" className="btn" disabled={view.busy || pending > 0} onClick={() => run('upgrade')}>계획 시간도 계정에 저장</button> : null}
    </section>
    <section className="planner-account-group" aria-label="연결·복구">
      <h4>연결·복구</h4>
      <div className="planner-account-actions"><button type="button" className="btn" disabled={view.busy} onClick={() => run('check')}>계정 기록 확인</button>{pending > 0 ? <button type="button" className="btn" disabled={view.busy} onClick={() => run('retry')}>대기 기록 1건 전송</button> : null}</div>
      <p role="status">{view.busy ? '계정 기록을 확인하고 있어요…' : plannerAccountMessage(view.result)}{pending > 0 ? ` 전송 대기 ${pending}건` : ''}</p>
      {view.result?.status === 409 && pending === 1 ? <div><p>대기 변경을 보관하고 서버의 최신 기록을 사용해요. 자동으로 덮어쓰지 않아요.</p><button type="button" className="btn" disabled={view.busy} onClick={() => run('resolve', snapshot.queue[0].data.requestId)}>서버 기록 사용 · 대기 변경 보관</button></div> : null}
      {snapshot?.resolved?.length ? <AnimatedDetails><summary>보관한 대기 변경 {snapshot.resolved.length}건</summary>{snapshot.resolved.map(row => <p key={row.data.requestId}>{row.data.title || (row.type === 'complete_server_planner' ? '완료 요청' : '삭제 요청')} · {row.data.date || '기존 계획'} · 서버에는 다시 보내지 않아요.</p>)}</AnimatedDetails> : null}
      {view.verified ? <AnimatedDetails><summary>계정 계획 {items.length}건</summary>{items.length ? <ul className="planner-account-list">{items.map(item => <li key={item.id}><small>{item.date} · {item.subject} · {item.completed ? '완료' : '미완료'}</small><b>{item.title}</b></li>)}</ul> : <p>계정에 저장된 계획이 없어요.</p>}</AnimatedDetails> : null}
    </section>
    {view.verified ? <section className="planner-account-group" aria-label="기존 계획 가져오기">
      <h4>기존 계획 가져오기</h4><p>이 기기의 미완료 계획만 계정에 가져와요. 원본은 유지하며 완료·공부 기록은 제외해요.</p>
      <p>가져올 위치: 계정{snapshot?.version === 2 ? ' · 계획과 시간' : ' · 계획 (시간은 이 기기)'} · 메모는 이 기기</p>
      {candidates.length ? <ul className="planner-account-list">{candidates.map(item => <li key={item.id}><small>{item.date} · {item.subject}</small><b>{item.content}</b><button type="button" className="btn" disabled={view.busy || pending > 0} onClick={() => run('copy', item.id)} aria-label={`${item.content} 계정으로 가져오기`}>계정으로 가져오기</button></li>)}</ul> : <p>가져올 미완료 기기 계획이 없어요.</p>}
    </section> : null}
  </div>;
}

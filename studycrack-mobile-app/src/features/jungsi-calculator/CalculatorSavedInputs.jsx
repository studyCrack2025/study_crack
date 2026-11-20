import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { CALCULATOR_STORAGE_CONSENT, normalizeStoredCalculatorInput, requestCalculatorStorage } from './calculator-storage-api.js';

export default function CalculatorSavedInputs({ home, input, changed, onRestore, readOnly = false }) {
  const binding = React.useMemo(() => getMobileApiBinding('consulting', 'consultingApiUrl'), []);
  const applications = (home?.items || []).filter(item => readOnly || item.accessActive), [selection, setSelection] = React.useState('');
  const applicationId = applications.some(item => item.applicationId === selection) ? selection : applications[0]?.applicationId || '';
  const [resource, setResource] = React.useState({ status: 'idle', data: null }), [consented, setConsented] = React.useState(false), [message, setMessage] = React.useState(''), [busy, setBusy] = React.useState(false);
  const generation = React.useRef(0), pending = React.useRef(null), failed = React.useRef(false);
  const normalized = normalizeStoredCalculatorInput(input);
  const dirty = !normalized || JSON.stringify(normalized) !== JSON.stringify(resource.data?.input);
  const load = React.useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(), current = ++generation.current; pending.current = controller;
    failed.current = false; setResource({ status: 'loading', data: null }); setMessage(''); setConsented(false); setBusy(false);
    const result = await requestCalculatorStorage(binding, { applicationId, signal: controller.signal });
    if (controller.signal.aborted || current !== generation.current) return;
    setResource(result.ok ? { status: 'ready', data: result.data } : { status: 'error', data: null }); pending.current = null;
  }, [applicationId, binding]);
  React.useEffect(() => {
    if (applicationId) load();
    else { generation.current++; pending.current?.abort(); setResource({ status: 'idle', data: null }); setMessage(''); setConsented(false); }
    return () => { generation.current++; pending.current?.abort(); };
  }, [applicationId, load]);
  const mutate = async action => {
    if (busy || failed.current || resource.status !== 'ready' || !applicationId) return;
    if (action === 'save' && (readOnly || !consented || changed || !normalized || !dirty || !resource.data.canSave)) return;
    if (action === 'delete' && !['saved', 'restricted'].includes(resource.data.status)) return;
    if (action === 'delete' && !globalThis.confirm('이 신청의 서버 저장 성적·지원 후보를 삭제할까요? 현재 탭의 입력 초안은 유지됩니다.')) return;
    if (typeof globalThis.crypto?.randomUUID !== 'function') { setMessage('안전한 저장 요청을 만들지 못했습니다. 새로고침해주세요.'); return; }
    const controller = new AbortController(), current = ++generation.current; pending.current = controller; setBusy(true); setMessage('');
    const result = await requestCalculatorStorage(binding, { applicationId, type: action === 'save' ? 'student_save_calculator_input' : 'student_delete_calculator_input', signal: controller.signal,
      data: { expectedRevision: resource.data.revision, requestId: 'input_' + globalThis.crypto.randomUUID(), ...(action === 'save' ? { input: normalized, consentRevision: CALCULATOR_STORAGE_CONSENT, consented: true } : { confirmed: true }) } });
    if (controller.signal.aborted || current !== generation.current) return;
    setBusy(false); pending.current = null;
    if (result.ok) { setResource({ status: 'ready', data: result.data }); setMessage(action === 'save' ? '서버 저장을 완료했습니다. 이 학생 계정으로 다른 기기에서 불러올 수 있습니다.' : '서버 저장 자료를 삭제했습니다. 현재 탭 초안은 유지됩니다.'); if (action === 'delete') setConsented(false); }
    else { failed.current = true; setMessage(result.code === 'REVISION_CONFLICT' ? '다른 화면에서 저장 내용이 변경됐습니다. 서버 저장 상태를 다시 확인해 최신본을 불러오거나 현재 입력으로 다시 저장해주세요.' : '저장 결과를 확인하지 못했습니다. 자동 재전송하지 않습니다. 서버 저장 상태를 다시 확인해주세요.'); }
  };
  const restore = () => {
    if (busy || resource.status !== 'ready' || resource.data.status !== 'saved' || !resource.data.input) return;
    if (!globalThis.confirm('서버 저장본을 이 화면에 불러올까요? 현재 탭에서 수정한 성적·지원 후보는 저장본으로 바뀝니다.')) return;
    onRestore(resource.data.input); setMessage('서버 저장본을 불러왔습니다. 성적과 지원 후보를 확인해주세요.');
  };
  if (readOnly && resource.status === 'ready' && !['saved', 'restricted'].includes(resource.data.status)) return null;
  return <section className="jcalc-panel jcalc-storage" aria-label="계산기 자료 서버 저장" aria-busy={busy || resource.status === 'loading'}>
    <div className="jcalc-access-head"><div><p className="jcalc-eyebrow">{readOnly ? '기존 자료 관리' : '다른 기기에서도 이어보기'}</p><h2>{readOnly ? '이전에 저장한 자료' : '성적·지원 후보 서버 저장'}</h2></div>{applicationId && <button className="jcalc-secondary" type="button" disabled={busy || resource.status === 'loading'} onClick={load}>서버 저장 상태 다시 확인</button>}</div>
    {!home ? <p className="jcalc-note">신청 상태를 확인한 뒤 저장할 수 있습니다. 입력 초안은 현재 탭에서 계속 사용할 수 있습니다.</p> : !applicationId ? <p className="jcalc-note">서버 저장은 입금 승인과 계산기 이용 인증을 완료한 신청에서 이용할 수 있습니다.</p> : <>
      <label className="jcalc-storage-select">저장할 계산기 신청<select value={applicationId} disabled={busy} onChange={event => setSelection(event.target.value)}>{applications.map((item, index) => <option key={item.applicationId} value={item.applicationId}>합격 계산기 · {item.submittedAt ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date(item.submittedAt)) : '신청'}{applications.length > 1 ? ` (${index + 1})` : ''}</option>)}</select></label>
      <p className="jcalc-note" role="status">{resource.status === 'loading' ? '서버 저장 자료를 확인하고 있습니다. 현재 입력은 바꾸지 않습니다.' : resource.status === 'error' ? '서버 저장 상태를 불러오지 못했습니다. 저장 여부를 확인한 뒤 다시 시도해주세요.' : resource.data?.status === 'restricted' ? '이전에 저장한 자료가 있습니다. 입금 승인과 이용 인증을 완료한 뒤 불러올 수 있으며, 지금 삭제할 수도 있습니다.' : resource.data?.status === 'saved' ? `서버 저장 ${resource.data.revision}판 · ${dirty || changed ? '현재 입력은 수정 후 미저장' : '현재 입력과 저장본이 같습니다.'}` : '서버에 저장한 자료가 없습니다. 현재 입력은 탭 초안입니다.'}</p>
      {resource.status === 'ready' && <>
        {resource.data.updatedAt && <p className="jcalc-note">마지막 변경 · {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(resource.data.updatedAt))} (한국시간)</p>}
        {!resource.data.canSave && <p className="jcalc-note">현재 신청 상태나 이용 기간에는 새로 저장할 수 없습니다. 저장 자료 확인·삭제는 아래에서 진행해주세요.</p>}
        <p className="jcalc-note">입력한 자기신고 성적·선택 과목·지원 후보를 이 신청에 저장하고 운영팀이 신청 관리와 계산기 제공을 위해 확인합니다. 컨설팅 검수 성적에는 반영하지 않습니다. 직접 삭제할 수 있으며 보유·삭제 기준은 <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a>을 따릅니다.</p>
        {!readOnly && <label className="jcalc-storage-consent"><input type="checkbox" checked={consented} disabled={busy} onChange={event => setConsented(event.target.checked)} /><span>성적·지원 후보 저장과 운영팀 열람에 동의합니다</span></label>}
        <div className="jcalc-storage-actions">{!readOnly && <><button className="jcalc-primary" type="button" disabled={busy || failed.current || !consented || changed || !normalized || !dirty || !resource.data.canSave} onClick={() => mutate('save')}>성적·지원 후보 서버에 저장</button><button className="jcalc-secondary" type="button" disabled={busy || resource.data.status !== 'saved'} onClick={restore}>서버 저장본 불러오기</button></>}<button className="jcalc-text-button" type="button" disabled={busy || failed.current || !['saved', 'restricted'].includes(resource.data.status)} onClick={() => mutate('delete')}>서버 저장 자료 삭제</button></div>
      </>}
    </>}
    {message && <p className="jcalc-note" role="status">{message}</p>}
  </section>;
}

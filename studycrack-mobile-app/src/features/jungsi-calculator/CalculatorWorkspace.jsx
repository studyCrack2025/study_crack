import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { fetchUniversityCatalog } from '../analysis/api.js';
import CalculatorScoreForm from './CalculatorScoreForm.jsx';
import CalculatorCatalog from './CalculatorCatalog.jsx';
import CalculatorResult from './CalculatorResult.jsx';
import CalculatorPlanBoard from './CalculatorPlanBoard.jsx';
import { addPlanTarget, emptyRepresentatives, planTargetKey, removePlanTarget } from './calculator-plan-model.js';
import { requestCalculatorConversion } from './calculator-api.js';
import { candidateKey, editableScores, emptyScores, MAX_CANDIDATES, prepareCalculatorScores, scoresChanged } from './calculator-model.js';
import { CALCULATOR_STORAGE_CONSENT } from './calculator-storage-api.js';
import useCalculatorScoreConversion from './useCalculatorScoreConversion.js';
import useCalculatorWorkspace from './useCalculatorWorkspace.js';
import './calculator-workspace.css';

function ScoreSummary({ profile, estimates, onEdit, disabled }) {
  const scores = profile.scores;
  return <section className="jcalc-panel jcalc-profile" aria-label="저장한 내 성적"><div className="jcalc-section-head"><div><p className="jcalc-eyebrow">01 · 내 성적</p><h2>내 성적</h2></div><button type="button" className="jcalc-secondary" disabled={disabled} onClick={onEdit}>성적 수정</button></div>
    <p className="jcalc-note">{scores.basis === 'raw' ? '2027학년도 수능 가채점 기준 · 표준점수·백분위·등급은 추정치입니다.' : '이전에 저장한 성적표 기준 성적입니다.'}</p>
    <dl className="jcalc-profile-scores">{[['kor', '국어'], ['math', '수학'], ['inq1', '탐구 1'], ['inq2', '탐구 2']].map(([key, label]) => <div key={key}><dt>{label} · {scores.exam[key].opt || scores.exam[key].name}</dt><dd>{scores.basis === 'raw' ? `원점수 ${scores.exam[key].raw}` : `표준점수 ${scores.exam[key].std}`}<small>{scores.basis === 'raw' ? estimates.results[key]?.status === 'converted' ? `예상 표점 ${estimates.results[key].metrics.standardScore} · 백분위 ${estimates.results[key].metrics.percentile} · ${estimates.results[key].metrics.grade}등급` : ['error', 'unavailable'].includes(estimates.results[key]?.status) ? '예상 성적을 확인하지 못했습니다' : '예상 성적 확인 중' : `백분위 ${scores.exam[key].pct} · ${scores.exam[key].grd}등급`}</small></dd></div>)}</dl>
    {Object.values(estimates.results).some(row => ['error', 'unavailable'].includes(row.status)) && <button className="jcalc-secondary" type="button" disabled={disabled} onClick={estimates.retry}>예상 성적 다시 계산</button>}
    <p className="jcalc-note">영어 {scores.exam.eng.grd}등급 · 한국사 {scores.exam.hist.grd}등급{scores.exam.foreign ? ` · ${scores.exam.foreign.name} ${scores.exam.foreign.grd}등급` : ''}</p>
  </section>;
}

function WorkspaceEditor({ store, enabled, calculationEnabled, denyAccess, grouped }) {
  const data = store.resource.data, binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const initialPlan = data.plans.find(plan => plan.planId === data.lastSavedPlanId) || null;
  const [scores, setScores] = React.useState(() => data.profile ? editableScores(data.profile.scores) : emptyScores()), [editing, setEditing] = React.useState(!data.profile);
  const [baseline, setBaseline] = React.useState(initialPlan), [name, setName] = React.useState(initialPlan?.name || '기본 조합'), [targets, setTargets] = React.useState(initialPlan?.targets || []);
  const [representatives, setRepresentatives] = React.useState(initialPlan?.representatives || emptyRepresentatives());
  const [errors, setErrors] = React.useState({}), [consented, setConsented] = React.useState(data.consentAccepted), [message, setMessage] = React.useState('');
  const [catalog, setCatalog] = React.useState({ status: 'idle', data: [], error: '' }), [catalogAttempt, setCatalogAttempt] = React.useState(0);
  const [conversion, setConversion] = React.useState({ key: '', status: 'idle', data: null, error: '' }), [queryAttempt, setQueryAttempt] = React.useState(0);
  const locked = !enabled || store.busy || store.resource.status !== 'ready' || !data.canSave;
  const profile = data.profile, changed = scoresChanged(scores, profile?.scores);
  const estimates = useCalculatorScoreConversion(scores, enabled && scores.basis === 'raw', denyAccess);
  const planDirty = name.trim() !== (baseline?.name || '기본 조합') || JSON.stringify(targets) !== JSON.stringify(baseline?.targets || []) || JSON.stringify(representatives) !== JSON.stringify(baseline?.representatives || emptyRepresentatives());
  const dirty = planDirty || editing && (changed || !profile);
  const queryKey = JSON.stringify({ scores: profile?.scores, profileRevision: profile?.revision, targets });
  const currentResult = !editing && conversion.key === queryKey && conversion.status === 'ready';
  const openPlan = React.useCallback(plan => { setBaseline(plan); setName(plan?.name || '기본 조합'); setTargets(plan?.targets || []); setRepresentatives(plan?.representatives || emptyRepresentatives()); setMessage(''); }, []);
  React.useEffect(() => {
    if (!data.profile) { setScores(emptyScores()); setEditing(true); setConsented(false); setErrors({}); openPlan(null); }
    if (!editing && data.profile) setScores(editableScores(data.profile.scores));
    if (!planDirty) {
      const next = data.plans.find(plan => plan.planId === baseline?.planId) || data.plans.find(plan => plan.planId === data.lastSavedPlanId) || null;
      if (next?.planId !== baseline?.planId || next?.revision !== baseline?.revision) openPlan(next);
    }
  }, [data.revision, data.profile?.revision]);
  React.useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    globalThis.addEventListener('beforeunload', warn); return () => globalThis.removeEventListener('beforeunload', warn);
  }, [dirty]);
  React.useEffect(() => {
    if (!enabled || !profile || editing || grouped) return;
    const controller = new AbortController();
    setCatalog(previous => ({ ...previous, status: 'loading', error: '' }));
    fetchUniversityCatalog({ ...binding, catalogView: 'reviewed_calculator', signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setCatalog(result.ok ? { status: 'ready', data: result.data, error: '' } : { status: 'error', data: [], error: result.error });
    });
    return () => controller.abort();
  }, [enabled, Boolean(profile), editing, catalogAttempt, binding, grouped]);
  React.useEffect(() => {
    if (!enabled || !calculationEnabled || !profile || editing || !targets.length) return;
    const controller = new AbortController(); let active = true;
    setConversion({ key: queryKey, status: 'loading', data: null, error: '' });
    const timer = setTimeout(async () => {
      const result = await requestCalculatorConversion({ ...binding, scores: profile.scores, targets, signal: controller.signal });
      if (!active || controller.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED') denyAccess();
      setConversion(result.ok ? { key: queryKey, status: 'ready', data: result.data, error: '' } : { key: queryKey, status: 'error', data: null, error: result.error });
    }, 200);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [enabled, calculationEnabled, editing, queryKey, queryAttempt, binding]);
  const confirmProfile = async () => {
    if (locked || scores.basis === 'raw' && !estimates.ready) return;
    const prepared = prepareCalculatorScores(scores); setErrors(prepared.errors);
    if (!prepared.ok || !consented && !data.consentAccepted) return;
    const result = await store.mutate('student_save_calculator_profile', { scores: prepared.data, consented, consentRevision: CALCULATOR_STORAGE_CONSENT });
    if (result.ok) { setScores(editableScores(result.data.profile.scores)); setEditing(false); setMessage('성적을 저장했습니다.'); }
  };
  const savePlan = async duplicate => {
    if (locked || !profile || !name.trim() || !targets.length && !baseline) return;
    const result = await store.mutate('student_save_calculator_plan', { planId: duplicate ? null : baseline?.planId || null, expectedPlanRevision: duplicate ? 0 : baseline?.revision || 0, name: name.trim(), targets, ...(grouped ? { representatives } : {}) });
    if (result.ok) { openPlan(result.data.plans.find(plan => plan.planId === result.data.lastSavedPlanId)); setMessage(duplicate ? '새 조합으로 저장했습니다.' : '지원 조합을 저장했습니다.'); }
  };
  const deletePlan = async () => {
    if (locked || !baseline || !globalThis.confirm('이 지원 조합을 삭제할까요? 저장한 성적과 다른 조합은 유지됩니다.')) return;
    const result = await store.mutate('student_delete_calculator_plan', { planId: baseline.planId, expectedPlanRevision: baseline.revision, confirmed: true });
    if (result.ok) { openPlan(result.data.plans.find(plan => plan.planId === result.data.lastSavedPlanId) || null); setMessage('지원 조합을 삭제했습니다.'); }
  };
  if (data.status === 'restricted') return <section className="jcalc-panel" aria-label="저장 자료 관리"><h2>현재 이용 상태를 확인해주세요.</h2><p className="jcalc-note">이용 정보를 다시 확인한 뒤 저장 자료를 열 수 있습니다.</p><button className="jcalc-secondary" type="button" disabled={store.busy} onClick={store.load}>저장 상태 다시 확인</button><button className="jcalc-text-button" type="button" disabled={store.busy} onClick={async () => { if (globalThis.confirm('이전에 저장한 성적과 지원 조합을 모두 삭제할까요?')) await store.mutate('student_delete_calculator_workspace', { confirmed: true }); }}>저장 자료 전체 삭제</button></section>;
  return <div className="jcalc-workspace" aria-busy={store.busy}>
    <ol className="jcalc-steps" aria-label="계산기 이용 단계"><li aria-current={editing ? 'step' : undefined}>01 내 성적</li><li aria-current={!editing ? 'step' : undefined}>02 지원 조합</li><li>03 포트폴리오</li></ol>
    {store.resource.error && <div className="jcalc-state" role="alert"><p>{store.resource.error}</p>{store.resource.status === 'error' && <button className="jcalc-secondary" type="button" onClick={store.load}>최신 저장 상태 확인</button>}</div>}
    <p className="jcalc-note" role="status">{store.busy ? '저장하고 있습니다…' : message || (dirty ? '수정한 내용이 아직 저장되지 않았습니다.' : profile ? '저장한 성적과 조합을 불러왔습니다.' : '')}</p>
    {editing ? <fieldset className="jcalc-workspace-fields" disabled={locked}><CalculatorScoreForm scores={scores} errors={errors} changed={changed} confirmed={profile?.scores} conversion={estimates}
      onChange={value => { setScores(value); setErrors({}); setMessage(''); }} onConfirm={confirmProfile} confirmLabel={profile ? '성적 수정 저장' : '이 성적으로 시작하기'} confirmDisabled={!consented && !data.consentAccepted || Boolean(profile) && !changed}
      onCancel={profile ? () => { setScores(editableScores(profile.scores)); setErrors({}); setEditing(false); } : undefined}>
      {!data.consentAccepted && <div className="jcalc-profile-consent"><p className="jcalc-note">입력한 성적과 지원 후보를 계정에 저장하고 운영팀이 계산기 제공·신청 관리를 위해 확인합니다. 컨설팅 검수 성적에는 반영되지 않습니다. <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a></p><label className="jcalc-storage-consent"><input type="checkbox" checked={consented} onChange={event => setConsented(event.currentTarget.checked)} /><span>성적·지원 후보 저장과 운영팀 열람에 동의합니다</span></label>{!consented && <p className="jcalc-note">처음 저장할 때 동의가 필요합니다.</p>}</div>}
    </CalculatorScoreForm></fieldset> : profile && <>
      <ScoreSummary profile={profile} estimates={estimates} disabled={locked} onEdit={() => { if (planDirty && !globalThis.confirm('저장하지 않은 조합 변경을 취소하고 성적을 수정할까요?')) return; if (planDirty) openPlan(baseline); setScores(editableScores(profile.scores)); setEditing(true); }} />
      <section className="jcalc-panel" aria-label="지원 조합 관리"><div className="jcalc-section-head"><div><p className="jcalc-eyebrow">02 · 지원 조합</p><h2>나의 지원 조합</h2></div><span className="jcalc-badge">{data.plans.length} / 10 저장</span></div>
        <fieldset className="jcalc-workspace-fields jcalc-plan-toolbar" disabled={locked}><label className="jcalc-field"><span>저장한 조합</span><select value={baseline?.planId || ''} onChange={event => { if (planDirty && !globalThis.confirm('저장하지 않은 변경을 취소하고 조합을 바꿀까요?')) return; openPlan(data.plans.find(plan => plan.planId === event.currentTarget.value) || null); }}><option value="">새 조합 만들기</option>{data.plans.map(plan => <option key={plan.planId} value={plan.planId}>{plan.name}</option>)}</select></label>
          <label className="jcalc-field"><span>조합 이름</span><input type="text" maxLength="60" value={name} onChange={event => { setName(event.currentTarget.value); setMessage(''); }} /></label>
          <div className="jcalc-workspace-actions"><button className="jcalc-primary" type="button" disabled={!name.trim() || !planDirty || !targets.length && !baseline} onClick={() => savePlan(false)}>조합 저장</button><button className="jcalc-secondary" type="button" disabled={!name.trim() || !targets.length || data.plans.length >= 10} onClick={() => savePlan(true)}>다른 조합으로 저장</button>{baseline && <button className="jcalc-text-button" type="button" onClick={deletePlan}>조합 삭제</button>}</div>
        </fieldset>
      </section>
      {grouped ? <section className="jcalc-group-area" aria-label="군별 지원 조합">
        {targets.length > 0 && !calculationEnabled && <p className="jcalc-note">정식 공개 전입니다. 성적과 지원 조합은 저장할 수 있습니다.</p>}
        {conversion.key === queryKey && conversion.status === 'loading' && <p className="jcalc-note" role="status">지원 후보를 계산하고 있습니다…</p>}
        {conversion.key === queryKey && conversion.status === 'error' && <div role="alert"><p className="jcalc-error">{conversion.error}</p><button className="jcalc-secondary" type="button" disabled={locked} onClick={() => setQueryAttempt(value => value + 1)}>지원 후보 다시 계산</button></div>}
        <CalculatorPlanBoard targets={targets} representatives={representatives} locked={locked} current={currentResult} denyAccess={denyAccess}
          results={conversion.key === queryKey ? new Map(targets.map((target, index) => [planTargetKey(target), conversion.data?.results[index]])) : null}
          onAdd={target => { const next = addPlanTarget(targets, representatives, target); setTargets(next.targets); setRepresentatives(next.representatives); }}
          onRemove={key => { const next = removePlanTarget(targets, representatives, key); setTargets(next.targets); setRepresentatives(next.representatives); }}
          onRepresentative={(group, key) => setRepresentatives(previous => ({ ...previous, [group]: key }))}
          onLegacyUnit={(key, id) => setTargets(previous => previous.map(target => planTargetKey(target) === key ? { ...target, admissionUnitId: id } : target))} />
      </section> : <>
      <fieldset className="jcalc-workspace-fields" disabled={locked}><CalculatorCatalog resource={catalog} candidates={targets} onRetry={() => setCatalogAttempt(value => value + 1)} onAdd={target => { if (targets.length < MAX_CANDIDATES) setTargets(previous => [...previous, target]); }} /></fieldset>
      <section className="jcalc-panel" aria-label="현재 지원 조합"><div className="jcalc-section-head"><h2>지원 후보 {targets.length} / {MAX_CANDIDATES}</h2>{targets.length > 0 && <button className="jcalc-secondary" type="button" disabled={locked || !calculationEnabled || conversion.status === 'loading'} onClick={() => setQueryAttempt(value => value + 1)}>다시 계산</button>}</div>
        {!targets.length && <p className="jcalc-note">대학과 학과를 검색해 지원 후보를 담아주세요.</p>}
        {targets.length > 0 && !calculationEnabled && <p className="jcalc-note">정식 공개 전입니다. 성적과 지원 조합은 저장할 수 있습니다.</p>}
        {conversion.key === queryKey && conversion.status === 'loading' && <p className="jcalc-note" role="status">지원 후보를 계산하고 있습니다…</p>}
        {conversion.key === queryKey && conversion.status === 'error' && <p className="jcalc-error" role="alert">{conversion.error}</p>}
        <fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-candidates">{targets.map(target => <li key={candidateKey(target)}><strong>{target.university}</strong><span>{target.major}</span><CalculatorResult current={currentResult} result={conversion.data?.results.find(row => candidateKey(row) === candidateKey(target))} selectedId={target.admissionUnitId} onSelect={id => setTargets(previous => previous.map(row => candidateKey(row) === candidateKey(target) ? { ...row, admissionUnitId: id } : row))} /><button className="jcalc-text-button" type="button" aria-label={`${target.university} ${target.major} 후보 삭제`} onClick={() => setTargets(previous => previous.filter(row => candidateKey(row) !== candidateKey(target)))}>후보 삭제</button></li>)}</ul></fieldset>
      </section>
      </>}
    </>}
    {data.canDelete && <details className="jcalc-data-settings"><summary>저장 자료 관리</summary><p className="jcalc-note">저장한 성적과 모든 지원 조합을 삭제할 수 있습니다.</p><button className="jcalc-text-button" type="button" disabled={!enabled || store.busy} onClick={async () => { if (!globalThis.confirm('저장한 성적과 모든 지원 조합을 삭제할까요?')) return; await store.mutate('student_delete_calculator_workspace', { confirmed: true }); }}>저장 자료 전체 삭제</button></details>}
  </div>;
}

export default function CalculatorWorkspace({ entitlement, enabled, calculationEnabled, denyAccess, grouped = false }) {
  const store = useCalculatorWorkspace(entitlement.applicationId, enabled);
  if (!store.resource.data) return <section className="jcalc-panel" aria-label="계산기 저장 자료"><p className="jcalc-note" role={store.resource.status === 'error' ? 'alert' : 'status'}>{store.resource.status === 'error' ? store.resource.error : '저장한 성적과 조합을 불러오고 있습니다…'}</p>{store.resource.status === 'error' && <button className="jcalc-secondary" type="button" onClick={store.load}>저장 자료 다시 불러오기</button>}</section>;
  return <div hidden={!enabled}><WorkspaceEditor key={store.resource.data.workspaceId} store={store} enabled={enabled} calculationEnabled={calculationEnabled} denyAccess={denyAccess} grouped={grouped} /></div>;
}

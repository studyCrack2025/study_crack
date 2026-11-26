import React from 'react';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { fetchUniversityCatalog } from '../analysis/api.js';
import CalculatorScoreForm from './CalculatorScoreForm.jsx';
import CalculatorCatalog from './CalculatorCatalog.jsx';
import CalculatorResult from './CalculatorResult.jsx';
import CalculatorPlanBoard from './CalculatorPlanBoard.jsx';
import CalculatorPortfolio from './CalculatorPortfolio.jsx';
import { createCalculatorPortfolio } from './calculator-portfolio-model.js';
import { emptyRepresentatives, groupPlanTargets, planTargetKey, setPlanTarget } from './calculator-plan-model.js';
import { requestCalculatorConversion } from './calculator-api.js';
import { candidateKey, editableScores, emptyScores, MAX_CANDIDATES, SUBJECTS, prepareCalculatorScores, scoresChanged } from './calculator-model.js';
import { CALCULATOR_STORAGE_CONSENT } from './calculator-storage-api.js';
import useCalculatorScoreConversion from './useCalculatorScoreConversion.js';
import useCalculatorGroupConversion from './useCalculatorGroupConversion.js';
import useCalculatorWorkspace from './useCalculatorWorkspace.js';
import './calculator-workspace.css';

function ScoreSummary({ profile, estimates, onEdit, disabled }) {
  const scores = profile.scores, raw = scores.basis === 'raw';
  return <section className="jcalc-panel jcalc-profile" aria-label="저장한 내 성적">
    <div className="jcalc-section-head"><h2>내 성적 <small>{raw ? '가채점 · 추정' : '성적표 기준'}</small></h2><CalculatorButton disabled={disabled} onClick={onEdit}>성적 수정</CalculatorButton></div>
    <dl className="jcalc-profile-overview">{SUBJECTS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{raw ? '원점수' : '표점'} {scores.exam[key][raw ? 'raw' : 'std']}</dd></div>)}</dl>
    <CalculatorNote>영어 {scores.exam.eng.grd}등급 · 한국사 {scores.exam.hist.grd}등급{scores.exam.foreign ? ` · ${scores.exam.foreign.name} ${scores.exam.foreign.grd}등급` : ''}</CalculatorNote>
    <details className="jcalc-score-details"><summary>성적 상세</summary><div className="jcalc-score-table"><table><caption>{raw ? '2027학년도 수능 추정 성적' : '저장한 성적표 성적'}</caption><thead><tr>{['과목', '선택과목', ...(raw ? ['원점수'] : []), '표점', '백분위', '등급'].map((text, index) => <th key={index} scope="col">{text}</th>)}</tr></thead><tbody>{SUBJECTS.map(([key, label]) => {
      const row = scores.exam[key], estimate = estimates.results[key], metrics = raw ? estimate?.metrics : { standardScore: row.std, percentile: row.pct, grade: row.grd };
      return <tr key={key}><th scope="row">{label}</th><td>{row.opt || row.name}</td>{raw && <td>{row.raw}</td>}{['standardScore', 'percentile', 'grade'].map(metric => <td key={metric}>{metrics?.[metric] ?? '—'}</td>)}</tr>;
    })}</tbody></table></div>{raw && <CalculatorNote>표준점수·백분위·등급은 추정치입니다.</CalculatorNote>}</details>
    {Object.values(estimates.results).some(row => ['error', 'unavailable'].includes(row.status)) && <CalculatorButton disabled={disabled} onClick={estimates.retry}>예상 성적 다시 계산</CalculatorButton>}
  </section>;
}

function WorkspaceEditor({ store, enabled, calculationEnabled, calculationMode, denyAccess, grouped }) {
  const data = store.resource.data, binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const initialPlan = data.plans.find(plan => plan.planId === data.lastSavedPlanId) || null;
  const [scores, setScores] = React.useState(() => data.profile ? editableScores(data.profile.scores) : emptyScores()), [editing, setEditing] = React.useState(!data.profile);
  const [baseline, setBaseline] = React.useState(initialPlan), [name, setName] = React.useState(initialPlan?.name || '기본 조합');
  const [nameEdit, setNameEdit] = React.useState(null);
  const nameTrigger = React.useRef(null);
  const [targets, setTargets] = React.useState(() => grouped ? groupPlanTargets(initialPlan?.targets || [], initialPlan?.representatives) : initialPlan?.targets || []);
  const [portfolioOpen, setPortfolioOpen] = React.useState(false);
  const [errors, setErrors] = React.useState({}), [consented, setConsented] = React.useState(data.consentAccepted), [message, setMessage] = React.useState('');
  const [catalog, setCatalog] = React.useState({ status: 'idle', data: [], error: '' }), [catalogAttempt, setCatalogAttempt] = React.useState(0);
  const [conversion, setConversion] = React.useState({ key: '', status: 'idle', data: null, error: '' }), [queryAttempt, setQueryAttempt] = React.useState(0);
  const locked = !enabled || store.busy || store.resource.status !== 'ready' || !data.canSave;
  const profile = data.profile, changed = scoresChanged(scores, profile?.scores);
  const estimates = useCalculatorScoreConversion(scores, enabled && scores.basis === 'raw', denyAccess);
  const baselineTargets = grouped ? groupPlanTargets(baseline?.targets || [], baseline?.representatives) : baseline?.targets || [];
  const overflow = (baseline?.targets || []).filter(target => !baselineTargets.includes(target));
  const archived = new Map([...overflow, ...(baseline?.previousTargets || [])].map(target => [planTargetKey(target), target]));
  for (const target of targets) archived.delete(planTargetKey(target));
  const representatives = Object.assign(emptyRepresentatives(), Object.fromEntries(targets.filter(target => target.selection).map(target => [target.selection.admissionGroup, target.selection.key])));
  const planDirty = name.trim() !== (baseline?.name || '기본 조합') || JSON.stringify(targets) !== JSON.stringify(baselineTargets);
  const dirty = planDirty || Boolean(nameEdit && nameEdit.value.trim() !== name.trim()) || editing && (changed || !profile);
  const queryKey = JSON.stringify({ scores: profile?.scores, profileRevision: profile?.revision, targets });
  const currentResult = enabled && calculationEnabled && !editing && conversion.key === queryKey && conversion.status === 'ready';
  const groupConversion = useCalculatorGroupConversion({ active: grouped && enabled && calculationEnabled && !editing, mode: calculationMode,
    profile, targets: grouped ? targets : [], binding, denyAccess });
  const portfolio = grouped && baseline && !locked && !planDirty && groupConversion.conversion
    ? createCalculatorPortfolio({ profile, plan: { ...baseline, targets, representatives }, conversion: groupConversion.conversion,
      input: { scores: profile.scores, targets, profileRevision: profile.revision } }) : null;
  const showPortfolio = portfolioOpen && Boolean(portfolio);
  const openPlan = React.useCallback(plan => { setBaseline(plan); setName(plan?.name || '기본 조합'); setNameEdit(null); setTargets(grouped ? groupPlanTargets(plan?.targets || [], plan?.representatives) : plan?.targets || []); setPortfolioOpen(false); setMessage(''); }, [grouped]);
  React.useEffect(() => {
    if (!data.profile) { setScores(emptyScores()); setEditing(true); setConsented(false); setErrors({}); openPlan(null); }
    if (!editing && data.profile) setScores(editableScores(data.profile.scores));
    if (!planDirty && !nameEdit) {
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
    if (grouped || !enabled || !calculationEnabled || !profile || editing || !targets.length) return;
    const controller = new AbortController(); let active = true;
    setConversion({ key: queryKey, status: 'loading', data: null, error: '' });
    const timer = setTimeout(async () => {
      const result = await requestCalculatorConversion({ ...binding, scores: profile.scores, targets, signal: controller.signal });
      if (!active || controller.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED') denyAccess();
      setConversion(result.ok ? { key: queryKey, status: 'ready', data: result.data, error: '' } : { key: queryKey, status: 'error', data: null, error: result.error });
    }, 200);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [grouped, enabled, calculationEnabled, editing, queryKey, queryAttempt, binding]);
  const confirmProfile = async () => {
    if (locked || scores.basis === 'raw' && !estimates.ready) return;
    const prepared = prepareCalculatorScores(scores); setErrors(prepared.errors);
    if (!prepared.ok || !consented && !data.consentAccepted) return;
    const result = await store.mutate('student_save_calculator_profile', { scores: prepared.data, consented, consentRevision: CALCULATOR_STORAGE_CONSENT });
    if (result.ok) { setScores(editableScores(result.data.profile.scores)); setEditing(false); setMessage('성적을 저장했습니다.'); }
  };
  const savePlan = async (mode = 'save', planName = name.trim()) => {
    if (locked || !profile || !planName || !targets.length && !baseline) return;
    const copy = mode === 'copy', rename = mode === 'rename';
    const current = copy ? null : baseline;
    const savedRepresentatives = rename ? current.representatives : grouped ? representatives : undefined;
    const result = await store.mutate('student_save_calculator_plan', { planId: current?.planId || null, expectedPlanRevision: current?.revision || 0,
      name: planName, targets: rename ? current.targets : targets, ...(savedRepresentatives ? { representatives: savedRepresentatives } : {}) });
    if (!result.ok) return;
    const saved = result.data.plans.find(plan => plan.planId === result.data.lastSavedPlanId);
    if (rename) { setBaseline(saved); setName(saved.name); closeNameEdit(); }
    else openPlan(saved);
    setMessage(rename ? '조합 이름을 변경했습니다.' : copy ? '새 조합으로 저장했습니다.' : '지원 조합을 저장했습니다.');
  };
  const closeNameEdit = () => {
    setNameEdit(null);
    requestAnimationFrame(() => nameTrigger.current?.focus());
  };
  const confirmName = event => {
    event.preventDefault();
    const next = nameEdit.value.trim();
    if (locked || !next || /[\u0000-\u001f\u007f]/.test(next)) return;
    if (nameEdit.mode === 'copy' || baseline && next !== name) savePlan(nameEdit.mode, next);
    else { setName(next); closeNameEdit(); }
  };
  const deletePlan = async () => {
    if (locked || !baseline || !globalThis.confirm('이 지원 조합을 삭제할까요? 저장한 성적과 다른 조합은 유지됩니다.')) return;
    const result = await store.mutate('student_delete_calculator_plan', { planId: baseline.planId, expectedPlanRevision: baseline.revision, confirmed: true });
    if (result.ok) { openPlan(result.data.plans.find(plan => plan.planId === result.data.lastSavedPlanId) || null); setMessage('지원 조합을 삭제했습니다.'); }
  };
  if (data.status === 'restricted') return <section className="jcalc-panel" aria-label="저장 자료 관리"><h2>현재 이용 상태를 확인해주세요.</h2><CalculatorNote>이용 정보를 다시 확인한 뒤 저장 자료를 열 수 있습니다.</CalculatorNote><CalculatorButton disabled={store.busy} onClick={store.load}>저장 상태 다시 확인</CalculatorButton><CalculatorButton text disabled={store.busy} onClick={async () => { if (globalThis.confirm('이전에 저장한 성적과 지원 조합을 모두 삭제할까요?')) await store.mutate('student_delete_calculator_workspace', { confirmed: true }); }}>저장 자료 전체 삭제</CalculatorButton></section>;
  const calculationStatus = <>
    {targets.length > 0 && !calculationEnabled && <CalculatorNote>정식 공개 전입니다. 성적과 지원 조합은 저장할 수 있습니다.</CalculatorNote>}
    {!grouped && conversion.key === queryKey && conversion.status === 'loading' && <CalculatorNote role="status">지원 후보를 계산하고 있습니다…</CalculatorNote>}
  </>;
  return <div className="jcalc-workspace" aria-busy={store.busy}>
    <ol className="jcalc-steps" aria-label="계산기 이용 단계"><li aria-current={editing ? 'step' : undefined}>01 내 성적</li><li aria-current={!editing && !showPortfolio ? 'step' : undefined}>02 지원 조합</li><li aria-current={showPortfolio ? 'step' : undefined}>03 포트폴리오</li></ol>
    {store.resource.error && <div className="jcalc-state" role="alert"><p>{store.resource.error}</p>{store.resource.status === 'error' && <CalculatorButton onClick={store.load}>최신 저장 상태 확인</CalculatorButton>}</div>}
    <CalculatorNote role="status">{store.busy ? '저장하고 있습니다…' : message || (dirty ? '수정한 내용이 아직 저장되지 않았습니다.' : profile ? '저장한 성적과 조합을 불러왔습니다.' : '')}</CalculatorNote>
    {showPortfolio ? <CalculatorPortfolio model={portfolio} onBack={() => setPortfolioOpen(false)} /> : editing ? <fieldset className="jcalc-workspace-fields" disabled={locked}><CalculatorScoreForm scores={scores} errors={errors} changed={changed} confirmed={profile?.scores} conversion={estimates}
      onChange={value => { setScores(value); setErrors({}); setMessage(''); }} onConfirm={confirmProfile} confirmLabel={profile ? '성적 수정 저장' : '이 성적으로 시작하기'} confirmDisabled={!consented && !data.consentAccepted || Boolean(profile) && !changed}
      onCancel={profile ? () => { setScores(editableScores(profile.scores)); setErrors({}); setEditing(false); } : undefined}>
      {!data.consentAccepted && <div className="jcalc-profile-consent"><CalculatorNote>입력한 성적과 지원 후보를 계정에 저장하고 운영팀이 계산기 제공·신청 관리를 위해 확인합니다. 컨설팅 검수 성적에는 반영되지 않습니다. <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a></CalculatorNote><label className="jcalc-storage-consent"><input type="checkbox" checked={consented} onChange={event => setConsented(event.currentTarget.checked)} /><span>성적·지원 후보 저장과 운영팀 열람에 동의합니다</span></label>{!consented && <CalculatorNote>처음 저장할 때 동의가 필요합니다.</CalculatorNote>}</div>}
    </CalculatorScoreForm></fieldset> : profile && <>
      <ScoreSummary profile={profile} estimates={estimates} disabled={locked || Boolean(nameEdit)} onEdit={() => { if (planDirty && !globalThis.confirm('저장하지 않은 조합 변경을 취소하고 성적을 수정할까요?')) return; if (planDirty) openPlan(baseline); setScores(editableScores(profile.scores)); setEditing(true); }} />
      <section className="jcalc-panel jcalc-plan-manager" aria-label="지원 조합 관리">
        <div className="jcalc-section-head"><div className="jcalc-plan-title"><h2>{name}</h2><button ref={nameTrigger} type="button" className="jcalc-text-button" disabled={locked || Boolean(nameEdit)} onClick={() => { setNameEdit({ mode: 'rename', value: name }); setMessage(''); }}>이름 변경</button></div><span className="jcalc-note">{data.plans.length}/10 저장</span></div>
        {nameEdit && <form className="jcalc-plan-name-form" onSubmit={confirmName} onKeyDown={event => { if (event.key === 'Escape' && !store.busy) closeNameEdit(); }}>
          <label className="jcalc-field"><span>{nameEdit.mode === 'copy' ? '새 조합 이름' : '조합 이름'}</span><input autoFocus type="text" maxLength={60} value={nameEdit.value} disabled={locked} onChange={event => setNameEdit({ ...nameEdit, value: event.currentTarget.value })} /></label>
          <div className="jcalc-workspace-actions"><CalculatorButton primary type="submit" disabled={locked || !nameEdit.value.trim()}>{nameEdit.mode === 'copy' ? '새 조합 저장' : baseline ? '이름 저장' : '이름 적용'}</CalculatorButton><CalculatorButton disabled={store.busy} onClick={closeNameEdit}>취소</CalculatorButton></div>
        </form>}
        <fieldset className="jcalc-workspace-fields jcalc-plan-toolbar" disabled={locked}>
          <div className="jcalc-plan-selection"><label className="jcalc-field"><span>저장한 조합</span><select disabled={Boolean(nameEdit)} value={baseline?.planId || ''} onChange={event => { if (planDirty && !globalThis.confirm('저장하지 않은 변경을 취소하고 조합을 바꿀까요?')) return; openPlan(data.plans.find(plan => plan.planId === event.currentTarget.value) || null); }}><option value="">새 조합</option>{data.plans.map(plan => <option key={plan.planId} value={plan.planId}>{plan.name}</option>)}</select></label><CalculatorButton disabled={Boolean(nameEdit) || data.plans.length >= 10} onClick={() => { if (!planDirty || globalThis.confirm('저장하지 않은 변경을 취소하고 새 조합을 만들까요?')) openPlan(null); }}>＋ 새 조합</CalculatorButton></div>
          <div className="jcalc-workspace-actions"><CalculatorButton primary disabled={Boolean(nameEdit) || !planDirty || !targets.length && !baseline} onClick={() => savePlan()}>변경사항 저장</CalculatorButton>{grouped && <CalculatorButton disabled={Boolean(nameEdit) || !portfolio} onClick={() => setPortfolioOpen(true)}>포트폴리오 보기</CalculatorButton>}
            <details className="jcalc-plan-options"><summary>조합 관리</summary><div className="jcalc-workspace-actions"><CalculatorButton disabled={Boolean(nameEdit) || !targets.length || data.plans.length >= 10} onClick={() => { setNameEdit({ mode: 'copy', value: name }); setMessage(''); }}>다른 조합으로 저장</CalculatorButton>{baseline && <CalculatorButton text disabled={Boolean(nameEdit)} onClick={deletePlan}>조합 삭제</CalculatorButton>}</div></details>
          </div>
        </fieldset>
        {grouped && !portfolio && <CalculatorNote>{planDirty ? '변경사항을 저장하면 포트폴리오를 볼 수 있습니다.' : !targets.length ? '지원할 대학·학과를 선택해주세요.' : '현재 성적의 계산이 끝나면 포트폴리오를 볼 수 있습니다.'}</CalculatorNote>}
      </section>
      {grouped ? <section className="jcalc-group-area" aria-label="군별 지원 조합">
        {calculationStatus}
        <CalculatorPlanBoard targets={targets} archivedTargets={[...archived.values()]} locked={locked} denyAccess={denyAccess}
          conversions={groupConversion.byGroup} onRetry={groupConversion.retry}
          onAdd={target => setTargets(previous => setPlanTarget(previous, target))}
          onRemove={key => setTargets(previous => previous.filter(target => planTargetKey(target) !== key))} />
      </section> : <>
      <fieldset className="jcalc-workspace-fields" disabled={locked}><CalculatorCatalog resource={catalog} candidates={targets} onRetry={() => setCatalogAttempt(value => value + 1)} onAdd={target => { if (targets.length < MAX_CANDIDATES) setTargets(previous => [...previous, target]); }} /></fieldset>
      <section className="jcalc-panel" aria-label="현재 지원 조합"><div className="jcalc-section-head"><h2>지원 후보 {targets.length} / {MAX_CANDIDATES}</h2>{targets.length > 0 && <CalculatorButton disabled={locked || !calculationEnabled || conversion.status === 'loading'} onClick={() => setQueryAttempt(value => value + 1)}>다시 계산</CalculatorButton>}</div>
        {!targets.length && <CalculatorNote>대학과 학과를 검색해 지원 후보를 담아주세요.</CalculatorNote>}
        {calculationStatus}
        {conversion.key === queryKey && conversion.status === 'error' && <p className="jcalc-error" role="alert">{conversion.error}</p>}
        <fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-candidates">{targets.map(target => <li key={candidateKey(target)}><strong>{target.university}</strong><span>{target.major}</span><CalculatorResult current={currentResult} result={conversion.data?.results.find(row => candidateKey(row) === candidateKey(target))} selectedId={target.admissionUnitId} onSelect={id => setTargets(previous => previous.map(row => candidateKey(row) === candidateKey(target) ? { ...row, admissionUnitId: id } : row))} /><CalculatorButton text aria-label={`${target.university} ${target.major} 후보 삭제`} onClick={() => setTargets(previous => previous.filter(row => candidateKey(row) !== candidateKey(target)))}>후보 삭제</CalculatorButton></li>)}</ul></fieldset>
      </section>
      </>}
    </>}
    {data.canDelete && <details className="jcalc-data-settings"><summary>저장 자료 관리</summary><CalculatorNote>저장한 성적과 모든 지원 조합을 삭제할 수 있습니다.</CalculatorNote><CalculatorButton text disabled={!enabled || store.busy} onClick={async () => { if (!globalThis.confirm('저장한 성적과 모든 지원 조합을 삭제할까요?')) return; await store.mutate('student_delete_calculator_workspace', { confirmed: true }); }}>저장 자료 전체 삭제</CalculatorButton></details>}
  </div>;
}

export default function CalculatorWorkspace({ entitlement, enabled, calculationEnabled, calculationMode, denyAccess, grouped = false }) {
  const store = useCalculatorWorkspace(entitlement.applicationId, enabled);
  if (!store.resource.data) return enabled && <section className="jcalc-panel" aria-label="계산기 저장 자료"><CalculatorNote role={store.resource.status === 'error' ? 'alert' : 'status'}>{store.resource.status === 'error' ? store.resource.error : '저장한 성적과 조합을 불러오고 있습니다…'}</CalculatorNote>{store.resource.status === 'error' && <CalculatorButton onClick={store.load}>저장 자료 다시 불러오기</CalculatorButton>}</section>;
  return <div hidden={!enabled}><WorkspaceEditor key={store.resource.data.workspaceId} store={store} enabled={enabled} calculationEnabled={calculationEnabled} calculationMode={calculationMode} denyAccess={denyAccess} grouped={grouped} /></div>;
}

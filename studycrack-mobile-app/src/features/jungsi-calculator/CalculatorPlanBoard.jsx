import React from 'react';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import CalculatorResult from './CalculatorResult.jsx';
import CalculatorCandidate from './CalculatorCandidate.jsx';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';
import { requestCalculatorCatalog } from './calculator-catalog-api.js';
import { calculatorIndicator } from './calculator-indicators.js';
import { CALCULATOR_GROUPS, planTargetKey, samePlanSelection } from './calculator-plan-model.js';
import { MAX_CANDIDATES } from './calculator-model.js';
import './calculator-plan-board.css';

const CalculatorRecommendationPanel = React.lazy(() => import('./CalculatorRecommendationPanel.jsx'));

function PickerDialog({ title, trigger, onClose, dialog, initialFocus, children }) {
  const titleId = React.useId();
  React.useEffect(() => {
    const node = dialog.current, overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = 'hidden';
    initialFocus?.current?.focus({ preventScroll: true });
    return () => {
      if (node.open) node.close();
      document.body.style.overflow = overflow;
      if (trigger.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
    };
  }, [dialog, initialFocus, trigger]);
  return <dialog className="jcalc-unit-picker" ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="jcalc-picker-heading"><h2 id={titleId}>{title}</h2><CalculatorButton onClick={onClose} aria-label="모집단위 선택 닫기">닫기</CalculatorButton></div>
    {children}
  </dialog>;
}

function CatalogList({ group, school, binding, denyAccess, label, renderRow }) {
  const [cursor, setCursor] = React.useState(0), [attempt, setAttempt] = React.useState(0);
  const [page, setPage] = React.useState({ items: [], nextCursor: null, status: 'loading' });
  React.useEffect(() => {
    const controller = new AbortController();
    setPage(previous => ({ ...previous, status: 'loading' }));
    requestCalculatorCatalog({ ...binding, admissionGroup: group, universities: !school, universityKey: school?.universityKey,
      universityName: school?.name, cursor, signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED' || [401, 403].includes(result.status)) { denyAccess(); return; }
      if (!result.ok) { setPage(previous => ({ ...previous, status: 'error', error: result.error })); return; }
      const { items, nextCursor, catalogDigest } = result.data;
      setPage(previous => {
        if (cursor && previous.catalogDigest !== catalogDigest) return { items: [], nextCursor: null, status: 'error', error: '목록이 갱신되었습니다. 처음부터 다시 불러와 주세요.' };
        return { items: cursor ? [...previous.items, ...items] : items, nextCursor, catalogDigest, status: 'ready' };
      });
    });
    return () => controller.abort();
  }, [group, school, binding, denyAccess, cursor, attempt]);
  return <>
    {page.items.length > 0 && <ul aria-label={label}>{page.items.map(row => renderRow(row, page.items))}</ul>}
    {page.status === 'loading' && <CalculatorNote role="status">불러오는 중…</CalculatorNote>}
    {page.status === 'error' && <><CalculatorNote role="alert">{page.error}</CalculatorNote><CalculatorButton text onClick={() => { if (!page.items.length) setCursor(0); setAttempt(value => value + 1); }}>다시 불러오기</CalculatorButton></>}
    {page.status === 'ready' && (page.items.length ? page.nextCursor !== null && <CalculatorButton text onClick={() => setCursor(page.nextCursor)}>{label} 더 보기</CalculatorButton> : <CalculatorNote>표시할 항목이 없습니다.</CalculatorNote>)}
  </>;
}

function CalculatorCatalogDialog({ group, trigger, onClose, denyAccess }) {
  const dialog = React.useRef(null);
  const binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const [school, selectSchool] = React.useState(null);
  return <PickerDialog title={`${CALCULATOR_GROUPS.find(([key]) => key === group)[1]} 분석 가능한 대학`} dialog={dialog} trigger={trigger} onClose={onClose}>
    <div className="jcalc-catalog-columns">
      <section aria-label="대학 목록" tabIndex={0}><h3>대학</h3><CatalogList group={group} binding={binding} denyAccess={denyAccess} label="대학"
        renderRow={row => <li key={row.universityKey}><button type="button" aria-pressed={school?.universityKey === row.universityKey} onClick={() => selectSchool(row)}>{row.name}</button></li>} /></section>
      <section aria-label="학과 목록" tabIndex={0}><h3>{school?.name ?? '학과'}</h3>{school ? <CatalogList key={school.universityKey} group={group} school={school} binding={binding} denyAccess={denyAccess} label="학과"
        renderRow={({ selection: unit }, rows) => <li key={unit.key}>{unit.unitName}{rows.some(({ selection }) => selection.key !== unit.key && selection.unitName === unit.unitName)
          && <small>{unit.campusName} · {unit.trackName}</small>}</li>} /> : <CalculatorNote>대학을 선택해주세요.</CalculatorNote>}</section>
    </div>
  </PickerDialog>;
}

function UnitPicker({ group, trigger, currentTarget, onClose, onAdd, denyAccess, locked, recommendation, savedRecommendation, onRecommendation,
  inline = false, active = true, onActivate, onDeactivate, onBrowse, targets = [] }) {
  const dialog = React.useRef(null), currentDigest = React.useRef(null), previous = React.useRef(null), restoring = React.useRef(false), binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const searchInput = React.useRef(null);
  const [university, setUniversity] = React.useState(null), [query, setQuery] = React.useState(''), [cursor, setCursor] = React.useState(0), [attempt, setAttempt] = React.useState(0);
  const [composing, setComposing] = React.useState(false);
  const [lastAdded, setLastAdded] = React.useState('');
  const [resource, setResource] = React.useState({ status: 'loading', items: [], nextCursor: null, total: 0, digest: null, error: '' });
  const term = query.trim();
  const showResults = active && !composing && Boolean(university || term);
  const full = inline && targets.length >= MAX_CANDIDATES;
  const alreadyAdded = target => targets.some(row => samePlanSelection(row, target));
  React.useEffect(() => {
    if (restoring.current) { restoring.current = false; return; }
    if (!showResults || locked) return;
    const controller = new AbortController(); let active = true;
    setResource(previous => ({ ...previous, status: 'loading', ...(cursor === 0 ? { items: [], nextCursor: null } : {}), error: '' }));
    const timer = setTimeout(async () => {
      const result = await requestCalculatorCatalog({ ...binding, admissionGroup: group, query: term, cursor, universityKey: university?.universityKey, universityName: university?.name, universities: !university, signal: controller.signal });
      if (!active || controller.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED' || [401, 403].includes(result.status)) { denyAccess(); return; }
      if (!result.ok) { setResource(previous => ({ ...previous, status: 'error', error: result.error })); return; }
      if (cursor && currentDigest.current !== result.data.catalogDigest) { setCursor(0); setResource(previous => ({ ...previous, status: 'loading', items: [], error: '' })); return; }
      currentDigest.current = result.data.catalogDigest;
      setResource(previous => ({ status: 'ready', items: cursor ? [...previous.items, ...result.data.items] : result.data.items, nextCursor: result.data.nextCursor, total: result.data.total, digest: result.data.catalogDigest, error: '' }));
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [group, university, term, showResults, cursor, attempt, binding, locked, denyAccess]);
  const selectUniversity = school => {
    previous.current = { query, cursor, resource, scroll: dialog.current.scrollTop, key: school.universityKey };
    setResource(previous => ({ ...previous, status: 'loading', items: [], nextCursor: null })); setUniversity(school); setQuery(''); setCursor(0);
    if (!inline) dialog.current.scrollTop = 0;
    requestAnimationFrame(() => searchInput.current?.focus());
  };
  const back = () => {
    const saved = previous.current, same = saved.resource.digest === currentDigest.current;
    restoring.current = same; setUniversity(null); setQuery(saved.query); setCursor(same ? saved.cursor : 0);
    setResource(same ? saved.resource : { status: 'loading', items: [], nextCursor: null, total: 0, digest: null, error: '' });
    requestAnimationFrame(() => { if (dialog.current) { if (!inline) dialog.current.scrollTop = saved.scroll; dialog.current.querySelector(`[data-university="${saved.key}"]`)?.focus({ preventScroll: true }); } });
  };
  const changeQuery = event => {
    const next = event.currentTarget.value;
    if (next.trim() !== term) {
      setResource(previous => ({ ...previous, status: 'loading', items: [], nextCursor: null, error: '' }));
      setCursor(0);
    }
    setQuery(next);
  };
  const title = currentTarget ? '후보 바꾸기' : '후보 찾기';
  const add = target => {
    onAdd(target);
    if (inline) setLastAdded(`${target.selection.universityName} ${target.selection.unitName} ${target.selection.trackName} 후보를 담았습니다.`);
    else onClose();
  };
  const content = <>
    {active && university && <div className="jcalc-picker-path"><CalculatorButton disabled={locked} text onClick={back}>대학 목록으로</CalculatorButton><strong>{university.name}</strong></div>}
    <label className="jcalc-field"><span>{active && university ? '학과명 검색' : '대학명 검색'}</span><input ref={searchInput} type="search" maxLength="80" value={active || !university ? query : ''} disabled={locked}
      placeholder={active && university ? '학과명 또는 전형' : '대학명 또는 캠퍼스'} onFocus={onActivate} onChange={changeQuery}
      onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} /></label>
    {inline && <CalculatorButton text disabled={locked} onClick={onBrowse}>분석 가능한 대학 보기</CalculatorButton>}
    {inline && active && <CalculatorButton text onClick={onDeactivate}>검색 접기</CalculatorButton>}
    {inline && <CalculatorNote role="status">{lastAdded}</CalculatorNote>}
    {full && <CalculatorNote>한 조합에는 후보를 최대 {MAX_CANDIDATES}개 담을 수 있습니다.</CalculatorNote>}
    {active && !university && !term && !composing && recommendation && <React.Suspense fallback={<CalculatorNote role="status">추천 화면을 준비하고 있습니다…</CalculatorNote>}><CalculatorRecommendationPanel group={group} binding={binding}
      recommendation={{ ...recommendation, onEditPreferences: () => { if (recommendation.onEditPreferences() && !inline) onClose(); } }} disabled={locked} saved={savedRecommendation} onResults={onRecommendation} currentTarget={currentTarget} denyAccess={denyAccess}
      canAdd={!full} alreadyAdded={inline ? alreadyAdded : undefined}
      onPick={target => { if (currentTarget && !globalThis.confirm('현재 군의 지원 후보를 바꿀까요?')) return; add(target); }} /></React.Suspense>}
    {!showResults ? !inline && <CalculatorNote>대학명을 입력하면 검색 결과가 표시됩니다.</CalculatorNote> : <>
    {resource.status === 'loading' && <CalculatorNote role="status">목록을 불러오고 있습니다…</CalculatorNote>}
    {resource.status === 'error' && <div role="alert"><p className="jcalc-error">{resource.error}</p><CalculatorButton onClick={() => setAttempt(value => value + 1)}>목록 다시 불러오기</CalculatorButton></div>}
    {resource.status === 'ready' && !resource.items.length && <CalculatorNote>이 군에 일치하는 항목이 없습니다.</CalculatorNote>}
    <ul className="jcalc-picker-results">{resource.items.map(target => {
      if (!university) return <li key={target.universityKey}><button className="jcalc-university-choice" type="button" data-university={target.universityKey} onClick={() => selectUniversity(target)}><strong>{target.name}</strong><small>{target.unitCount}개 모집단위·전형 · {target.campuses.join(' · ')}</small><span aria-hidden="true">학과 보기 →</span></button></li>;
      const selected = inline ? alreadyAdded(target) : currentTarget?.selection.key === target.selection.key && currentTarget.selection.catalogDigest === target.selection.catalogDigest;
      const action = currentTarget ? '후보로 바꾸기' : '후보에 추가';
      const { recommendationEligibility, ...candidate } = target;
      const eligibilityNote = recommendationEligibility === 'review' ? '지원 자격 확인 필요'
        : recommendationEligibility === 'female' && recommendation?.applicantGender !== 'female' ? '여성 지원 자격 확인 필요' : '';
      return <li key={target.selection.key}><div><span>{target.selection.unitName}</span><small>{target.selection.campusName} · {target.selection.trackName}</small>{eligibilityNote && <small>{eligibilityNote}</small>}</div><CalculatorButton disabled={selected || locked || full} aria-label={`${target.selection.universityName} ${target.selection.unitName} ${target.selection.trackName} ${action}`} onClick={() => add(candidate)}>{selected ? inline ? '담은 후보' : '선택됨' : currentTarget ? '이 후보로 바꾸기' : '후보 추가'}</CalculatorButton></li>;
    })}</ul>
    {resource.nextCursor !== null && <CalculatorButton disabled={resource.status !== 'ready'} onClick={() => setCursor(resource.nextCursor)}>{university ? '학과 더 보기' : '대학 더 보기'}</CalculatorButton>}
    </>}
  </>;
  if (inline) return <div className="jcalc-inline-picker" ref={dialog} onKeyDown={event => {
    if (active && event.key === 'Escape' && !event.nativeEvent.isComposing) onDeactivate();
  }}>{content}</div>;
  return <PickerDialog title={`${CALCULATOR_GROUPS.find(([key]) => key === group)[1]} ${title}`} dialog={dialog} initialFocus={searchInput} trigger={trigger} onClose={onClose}>
    {content}
  </PickerDialog>;
}

function CalculatorRepresentativeSummary({ targets, representatives, toolbar }) {
  return <section className="jcalc-panel jcalc-representative-summary" aria-label="대표 조합">
    <header><h2>대표 조합</h2>{toolbar}</header>
    <ul>{CALCULATOR_GROUPS.map(([group, label]) => {
      const selection = targets.find(target => target.selection.key === representatives[group])?.selection;
      return <li key={group}><button type="button" aria-controls={`jcalc-group-${group}`} onClick={() => document.getElementById(`jcalc-group-title-${group}`)?.focus()}>
        <span>{label}</span><div>{selection ? <><strong>{selection.universityName}</strong><small>{selection.unitName}</small></> : <small>대표 미선택</small>}</div>
      </button></li>;
    })}</ul>
  </section>;
}

export default function CalculatorPlanBoard({ targets, archivedTargets, conversions, locked, saving, onAdd, onRemove, onRetry, denyAccess, recommendation,
  multiCandidate, representatives, onRepresentative, representativeToolbar }) {
  const [group, setGroup] = React.useState('ga'), [picker, setPicker] = React.useState(null);
  const [activeSearch, setActiveSearch] = React.useState(null);
  const [recommendations, setRecommendations] = React.useState({});
  const openPicker = (group, mode, event) => setPicker({ group, mode, trigger: event.currentTarget });
  const targetFor = groupKey => targets.find(target => target.selection.admissionGroup === groupKey);
  return <div className="jcalc-group-workspace" data-multi={multiCandidate || undefined}>
    {multiCandidate ? <CalculatorRepresentativeSummary targets={targets} representatives={representatives} toolbar={representativeToolbar} />
      : <nav className="jcalc-group-tabs" aria-label="모집군 선택">{CALCULATOR_GROUPS.map(([key, label]) =>
        <button key={key} type="button" aria-controls={`jcalc-group-${key}`} aria-pressed={group === key} onClick={() => setGroup(key)}>{label}<small>{targetFor(key) ? '선택 완료' : '미선택'}</small></button>)}</nav>}
    <div className="jcalc-group-board">{CALCULATOR_GROUPS.map(([key, label]) => {
      if (multiCandidate) {
        const candidates = targets.filter(target => target.selection.admissionGroup === key);
        return <section key={key} id={`jcalc-group-${key}`} className="jcalc-panel jcalc-group-card" aria-label={`${label} 지원 후보`}>
          <div className="jcalc-group-heading"><h2 id={`jcalc-group-title-${key}`} tabIndex={-1}>{label}</h2></div>
          <UnitPicker group={key} inline active={activeSearch === key} onActivate={() => setActiveSearch(key)}
            onBrowse={event => openPicker(key, 'browse', event)}
            onDeactivate={() => { setActiveSearch(null); document.getElementById(`jcalc-group-title-${key}`)?.focus({ preventScroll: true }); }} targets={targets} onAdd={onAdd}
            locked={locked} denyAccess={denyAccess} recommendation={recommendation} savedRecommendation={recommendations[key]}
            onRecommendation={value => setRecommendations(previous => ({ ...previous, [key]: value }))} />
          {candidates.length ? <fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-group-candidates">{candidates.map(target =>
            <CalculatorCandidate key={target.selection.key} target={target} entry={conversions.get(target.selection.key)}
              representative={representatives[key] === target.selection.key} onRepresentative={onRepresentative} onRemove={onRemove} onRetry={onRetry} />)}</ul></fieldset>
            : <CalculatorNote>아직 담은 후보가 없습니다.</CalculatorNote>}
        </section>;
      }
      const target = targetFor(key);
      const conversion = target && conversions.get(target.selection.key), result = conversion?.result;
      const indicator = result && calculatorIndicator(result);
      const remove = target && <CalculatorButton text aria-label={`${label} ${target.selection.universityName} ${target.selection.unitName} 후보 삭제`} onClick={() => onRemove(target.selection.key)}>후보 삭제</CalculatorButton>;
      return <section key={key} id={`jcalc-group-${key}`} className="jcalc-panel jcalc-group-card" data-current={group === key} aria-label={`${label} 지원 후보`}><div className="jcalc-group-heading"><h2>{label}</h2></div>
        <CalculatorButton text disabled={locked} onClick={event => openPicker(key, 'browse', event)}>분석 가능한 대학 보기</CalculatorButton>
        <button className="jcalc-secondary jcalc-group-add" type="button" disabled={locked} onClick={event => openPicker(key, 'search', event)}>{label} 후보 {target ? '바꾸기' : '찾기'}</button>
        {!target && <CalculatorNote>{label}에서 지원할 대학·학과를 찾아보세요.</CalculatorNote>}
        {target && <fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-group-candidates"><li key={target.selection.key} data-risk={indicator?.band || undefined}>
          <div className="jcalc-group-identity"><div className="jcalc-school-heading"><strong>{target.selection.universityName}</strong>{indicator && <CalculatorRiskScale {...indicator} />}</div><h3>{target.selection.unitName}</h3><p>{result?.selectionCampusName ?? target.selection.campusName} · {target.selection.trackName}</p></div>
          {conversion?.status === 'loading' && <div className="jcalc-group-result-state"><CalculatorNote role="status">{label} 후보를 계산하고 있습니다…</CalculatorNote></div>}
          {conversion?.status === 'error' && <div className="jcalc-group-result-state" role="alert"><p className="jcalc-error">{conversion.error}</p><CalculatorButton onClick={() => onRetry(target)}>{label} 후보 다시 계산</CalculatorButton></div>}
          {result ? <CalculatorResult exactSelection current result={result} actions={remove} /> : remove}
        </li></ul></fieldset>}
      </section>;
    })}</div>
    <CalculatorNote>{multiCandidate ? `담은 후보 ${targets.length} / ${MAX_CANDIDATES}개` : `가·나·다군에서 한 곳씩 선택할 수 있습니다. 현재 ${targets.length} / 3개`}</CalculatorNote>
    {archivedTargets.length > 0 && <details className="jcalc-panel"><summary>이전에 저장한 후보 ({archivedTargets.length})</summary><fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-candidates">{archivedTargets.map(target => <li key={planTargetKey(target)}><strong>{target.selection?.universityName || target.university}</strong><span>{target.selection?.unitName || target.major}</span>{target.selection
      ? <><small>{target.selection.campusName} · {target.selection.trackName}</small><CalculatorButton text disabled={multiCandidate && targets.length >= MAX_CANDIDATES} onClick={() => { setGroup(target.selection.admissionGroup); onAdd(target); }}>{CALCULATOR_GROUPS.find(([key]) => key === target.selection.admissionGroup)[1]} 후보로 선택</CalculatorButton></>
      : <small>모집군을 확인하려면 군별 검색에서 다시 찾아보세요.</small>}</li>)}</ul></fieldset></details>}
    {picker && (!locked || saving) && (picker.mode === 'browse' ? <CalculatorCatalogDialog {...picker} onClose={() => setPicker(null)} denyAccess={denyAccess} />
      : <UnitPicker {...picker} locked={locked} recommendation={recommendation} savedRecommendation={recommendations[picker.group]}
      onRecommendation={value => setRecommendations(previous => ({ ...previous, [picker.group]: value }))}
      currentTarget={targetFor(picker.group)} onClose={() => setPicker(null)} denyAccess={denyAccess}
      onAdd={target => { setGroup(target.selection.admissionGroup); onAdd(target); }} />)}
  </div>;
}

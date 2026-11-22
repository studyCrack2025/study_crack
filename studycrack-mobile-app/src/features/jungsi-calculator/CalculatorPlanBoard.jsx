import React from 'react';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import CalculatorResult from './CalculatorResult.jsx';
import CalculatorForecast from './CalculatorForecast.jsx';
import { requestCalculatorCatalog } from './calculator-catalog-api.js';
import { CALCULATOR_GROUPS, planTargetKey } from './calculator-plan-model.js';
import './calculator-plan-board.css';

function UnitPicker({ group, mode, trigger, currentTarget, onClose, onAdd, denyAccess }) {
  const dialog = React.useRef(null), currentDigest = React.useRef(null), previous = React.useRef(null), restoring = React.useRef(false), binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const [university, setUniversity] = React.useState(null), [query, setQuery] = React.useState(''), [cursor, setCursor] = React.useState(0), [attempt, setAttempt] = React.useState(0);
  const [resource, setResource] = React.useState({ status: 'loading', items: [], nextCursor: null, total: 0, digest: null, error: '' });
  const term = query.trim();
  const showResults = Boolean(university || mode === 'browse' || term);
  React.useEffect(() => {
    const node = dialog.current, overflow = document.body.style.overflow;
    node.showModal(); document.body.style.overflow = 'hidden';
    return () => {
      if (node.open) node.close();
      document.body.style.overflow = overflow;
      if (trigger.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
    };
  }, [trigger]);
  React.useEffect(() => {
    if (restoring.current) { restoring.current = false; return; }
    if (!showResults) return;
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
  }, [group, university, term, showResults, cursor, attempt, binding]);
  const selectUniversity = school => {
    previous.current = { query, cursor, resource, scroll: dialog.current.scrollTop, key: school.universityKey };
    setResource(previous => ({ ...previous, status: 'loading', items: [], nextCursor: null })); setUniversity(school); setQuery(''); setCursor(0); dialog.current.scrollTop = 0; requestAnimationFrame(() => dialog.current?.querySelector('input[type=search]')?.focus());
  };
  const back = () => {
    const saved = previous.current, same = saved.resource.digest === currentDigest.current;
    restoring.current = same; setUniversity(null); setQuery(saved.query); setCursor(same ? saved.cursor : 0);
    setResource(same ? saved.resource : { status: 'loading', items: [], nextCursor: null, total: 0, digest: null, error: '' });
    requestAnimationFrame(() => { if (dialog.current) { dialog.current.scrollTop = saved.scroll; dialog.current.querySelector(`[data-university="${saved.key}"]`)?.focus({ preventScroll: true }); } });
  };
  const changeQuery = event => {
    const next = event.currentTarget.value;
    if (next.trim() !== term) {
      setResource(previous => ({ ...previous, status: 'loading', items: [], nextCursor: null, error: '' }));
      setCursor(0);
    }
    setQuery(next);
  };
  const title = mode === 'browse' ? '분석 가능한 대학' : currentTarget ? '후보 바꾸기' : '후보 찾기';
  return <dialog className="jcalc-unit-picker" ref={dialog} aria-labelledby="jcalc-unit-picker-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="jcalc-picker-heading"><h2 id="jcalc-unit-picker-title">{CALCULATOR_GROUPS.find(([key]) => key === group)[1]} {title}</h2><CalculatorButton onClick={onClose} aria-label="모집단위 선택 닫기">닫기</CalculatorButton></div>
    {university && <div className="jcalc-picker-path"><CalculatorButton text onClick={back}>대학 목록으로</CalculatorButton><strong>{university.name}</strong></div>}
    <label className="jcalc-field"><span>{university ? '학과명 검색' : '대학명 검색'}</span><input type="search" maxLength="80" autoFocus={mode === 'search'} value={query} placeholder={university ? '학과명 또는 전형' : '대학명 또는 캠퍼스'} onChange={changeQuery} /></label>
    {!showResults ? <CalculatorNote>대학명을 입력하면 검색 결과가 표시됩니다.</CalculatorNote> : <>
    {resource.status === 'loading' && <CalculatorNote role="status">목록을 불러오고 있습니다…</CalculatorNote>}
    {resource.status === 'error' && <div role="alert"><p className="jcalc-error">{resource.error}</p><CalculatorButton onClick={() => setAttempt(value => value + 1)}>목록 다시 불러오기</CalculatorButton></div>}
    {resource.status === 'ready' && !resource.items.length && <CalculatorNote>이 군에 일치하는 항목이 없습니다.</CalculatorNote>}
    <ul className="jcalc-picker-results">{resource.items.map(target => {
      if (!university) return <li key={target.universityKey}><button className="jcalc-university-choice" type="button" data-university={target.universityKey} onClick={() => selectUniversity(target)}><strong>{target.name}</strong><small>{target.unitCount}개 모집단위·전형 · {target.campuses.join(' · ')}</small><span aria-hidden="true">학과 보기 →</span></button></li>;
      const selected = currentTarget?.selection.key === target.selection.key && currentTarget.selection.catalogDigest === target.selection.catalogDigest;
      const action = currentTarget ? '후보로 바꾸기' : '후보에 추가';
      return <li key={target.selection.key}><div><span>{target.selection.unitName}</span><small>{target.selection.campusName} · {target.selection.trackName}</small></div><CalculatorButton disabled={selected} aria-label={`${target.selection.universityName} ${target.selection.unitName} ${target.selection.trackName} ${action}`} onClick={() => { onAdd(target); onClose(); }}>{selected ? '선택됨' : currentTarget ? '이 후보로 바꾸기' : '후보 추가'}</CalculatorButton></li>;
    })}</ul>
    {resource.nextCursor !== null && <CalculatorButton disabled={resource.status !== 'ready'} onClick={() => setCursor(resource.nextCursor)}>{university ? '학과 더 보기' : '대학 더 보기'}</CalculatorButton>}
    </>}
  </dialog>;
}

export default function CalculatorPlanBoard({ targets, archivedTargets, results, current, locked, onAdd, onRemove, denyAccess }) {
  const [group, setGroup] = React.useState('ga'), [picker, setPicker] = React.useState(null);
  const openPicker = (group, mode, event) => setPicker({ group, mode, trigger: event.currentTarget });
  const targetFor = groupKey => targets.find(target => target.selection.admissionGroup === groupKey);
  const resultFor = target => results?.get(planTargetKey(target));
  return <div className="jcalc-group-workspace">
    <nav className="jcalc-group-tabs" aria-label="모집군 선택">{CALCULATOR_GROUPS.map(([key, label]) => <button key={key} type="button" aria-controls={`jcalc-group-${key}`} aria-pressed={group === key} onClick={() => setGroup(key)}>{label}<small>{targetFor(key) ? '선택 완료' : '미선택'}</small></button>)}</nav>
    <div className="jcalc-group-board">{CALCULATOR_GROUPS.map(([key, label]) => {
      const target = targetFor(key);
      return <section key={key} id={`jcalc-group-${key}`} className="jcalc-panel jcalc-group-card" data-current={group === key} aria-label={`${label} 지원 후보`}><div className="jcalc-group-heading"><h2>{label}</h2></div>
        <CalculatorButton text disabled={locked} onClick={event => openPicker(key, 'browse', event)}>분석 가능한 대학 보기</CalculatorButton>
        <button className="jcalc-secondary jcalc-group-add" type="button" disabled={locked} onClick={event => openPicker(key, 'search', event)}>{label} 후보 {target ? '바꾸기' : '찾기'}</button>
        {!target && <CalculatorNote>{label}에서 지원할 대학·학과를 찾아보세요.</CalculatorNote>}
        {target && <fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-group-candidates"><li key={target.selection.key}>
          <div className="jcalc-group-identity"><div className="jcalc-school-heading"><strong>{target.selection.universityName}</strong><CalculatorForecast result={resultFor(target)} current={current} /></div><h3>{target.selection.unitName}</h3><p>{target.selection.campusName} · {target.selection.trackName}</p></div>
          <CalculatorResult exactSelection current={current} result={resultFor(target)} selectedId={target.admissionUnitId} />
          <CalculatorButton text aria-label={`${label} ${target.selection.universityName} ${target.selection.unitName} 후보 삭제`} onClick={() => onRemove(target.selection.key)}>후보 삭제</CalculatorButton>
        </li></ul></fieldset>}
      </section>;
    })}</div>
    <CalculatorNote>가·나·다군에서 한 곳씩 선택할 수 있습니다. 현재 {targets.length} / 3개</CalculatorNote>
    {archivedTargets.length > 0 && <details className="jcalc-panel"><summary>이전에 저장한 후보 ({archivedTargets.length})</summary><fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-candidates">{archivedTargets.map(target => <li key={planTargetKey(target)}><strong>{target.selection?.universityName || target.university}</strong><span>{target.selection?.unitName || target.major}</span>{target.selection
      ? <><small>{target.selection.campusName} · {target.selection.trackName}</small><CalculatorButton text onClick={() => { setGroup(target.selection.admissionGroup); onAdd(target); }}>{CALCULATOR_GROUPS.find(([key]) => key === target.selection.admissionGroup)[1]} 후보로 선택</CalculatorButton></>
      : <small>모집군을 확인하려면 군별 검색에서 다시 찾아보세요.</small>}</li>)}</ul></fieldset></details>}
    {picker && !locked && <UnitPicker {...picker} currentTarget={targetFor(picker.group)} onClose={() => setPicker(null)} denyAccess={denyAccess} onAdd={target => { setGroup(target.selection.admissionGroup); onAdd(target); }} />}
  </div>;
}

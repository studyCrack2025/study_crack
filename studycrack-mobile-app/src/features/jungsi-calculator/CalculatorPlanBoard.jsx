import React from 'react';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import CalculatorResult from './CalculatorResult.jsx';
import CalculatorForecast from './CalculatorForecast.jsx';
import { requestCalculatorCatalog } from './calculator-catalog-api.js';
import { addPlanTarget, CALCULATOR_GROUPS, planTargetKey } from './calculator-plan-model.js';
import './calculator-plan-board.css';

function UnitPicker({ group, trigger, targets, representatives, onClose, onAdd, denyAccess }) {
  const dialog = React.useRef(null), currentDigest = React.useRef(null), previous = React.useRef(null), restoring = React.useRef(false), binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const [university, setUniversity] = React.useState(null), [query, setQuery] = React.useState(''), [cursor, setCursor] = React.useState(0), [attempt, setAttempt] = React.useState(0);
  const [resource, setResource] = React.useState({ status: 'loading', items: [], nextCursor: null, total: 0, digest: null, error: '' });
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
    const controller = new AbortController(); let active = true;
    setResource(previous => ({ ...previous, status: 'loading', ...(cursor === 0 ? { items: [], nextCursor: null } : {}), error: '' }));
    const timer = setTimeout(async () => {
      const result = await requestCalculatorCatalog({ ...binding, admissionGroup: group, query, cursor, universityKey: university?.universityKey, universityName: university?.name, universities: !university, signal: controller.signal });
      if (!active || controller.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED' || [401, 403].includes(result.status)) { denyAccess(); return; }
      if (!result.ok) { setResource(previous => ({ ...previous, status: 'error', error: result.error })); return; }
      if (cursor && currentDigest.current !== result.data.catalogDigest) { setCursor(0); setResource(previous => ({ ...previous, status: 'loading', items: [], error: '' })); return; }
      currentDigest.current = result.data.catalogDigest;
      setResource(previous => ({ status: 'ready', items: cursor ? [...previous.items, ...result.data.items] : result.data.items, nextCursor: result.data.nextCursor, total: result.data.total, digest: result.data.catalogDigest, error: '' }));
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [group, university, query, cursor, attempt, binding]);
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
  return <dialog className="jcalc-unit-picker" ref={dialog} aria-labelledby="jcalc-unit-picker-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="jcalc-picker-heading"><h2 id="jcalc-unit-picker-title">{CALCULATOR_GROUPS.find(([key]) => key === group)[1]} 후보 찾기</h2><CalculatorButton onClick={onClose} aria-label="모집단위 선택 닫기">닫기</CalculatorButton></div>
    {university && <div className="jcalc-picker-path"><CalculatorButton text onClick={back}>대학 목록으로</CalculatorButton><strong>{university.name}</strong></div>}
    <label className="jcalc-field"><span>{university ? '학과명 검색' : '대학명 검색'}</span><input type="search" maxLength="80" autoFocus value={query} placeholder={university ? '학과명 또는 전형' : '대학명 또는 캠퍼스'} onChange={event => { setCursor(0); setQuery(event.currentTarget.value); }} /></label>
    <CalculatorNote>{university ? '학과·캠퍼스·전형을 확인하고 추가해주세요.' : '자료가 있는 모집단위를 제공하는 대학입니다. 학과별 계산 범위와 지원 조건은 다를 수 있습니다.'}</CalculatorNote>
    {resource.status === 'loading' && <CalculatorNote role="status">목록을 불러오고 있습니다…</CalculatorNote>}
    {resource.status === 'error' && <div role="alert"><p className="jcalc-error">{resource.error}</p><CalculatorButton onClick={() => setAttempt(value => value + 1)}>목록 다시 불러오기</CalculatorButton></div>}
    {resource.status === 'ready' && !resource.items.length && <CalculatorNote>이 군에 일치하는 항목이 없습니다.</CalculatorNote>}
    <ul className="jcalc-picker-results">{resource.items.map(target => {
      if (!university) return <li key={target.universityKey}><button className="jcalc-university-choice" type="button" data-university={target.universityKey} onClick={() => selectUniversity(target)}><strong>{target.name}</strong><small>{target.unitCount}개 모집단위·전형 · {target.campuses.join(' · ')}</small><span aria-hidden="true">학과 보기 →</span></button></li>;
      const canAdd = addPlanTarget(targets, representatives, target).targets !== targets;
      return <li key={target.selection.key}><div><span>{target.selection.unitName}</span><small>{target.selection.campusName} · {target.selection.trackName}</small></div><CalculatorButton disabled={!canAdd} aria-label={`${target.selection.universityName} ${target.selection.unitName} ${target.selection.trackName} 후보에 추가`} onClick={() => { onAdd(target); onClose(); }}>{canAdd ? '후보 추가' : targets.some(row => planTargetKey(row) === target.selection.key) ? '추가됨' : '최대 6개'}</CalculatorButton></li>;
    })}</ul>
    {resource.nextCursor !== null && <CalculatorButton disabled={resource.status !== 'ready'} onClick={() => setCursor(resource.nextCursor)}>{university ? '학과 더 보기' : '대학 더 보기'}</CalculatorButton>}
  </dialog>;
}

export default function CalculatorPlanBoard({ targets, representatives, results, current, locked, onAdd, onRemove, onRepresentative, onLegacyUnit, denyAccess }) {
  const [group, setGroup] = React.useState('ga'), [picker, setPicker] = React.useState(null);
  const openPicker = (group, event) => setPicker({ group, trigger: event.currentTarget });
  const legacy = targets.filter(target => !target.selection);
  const resultFor = target => results?.get(planTargetKey(target));
  return <div className="jcalc-group-workspace">
    <nav className="jcalc-group-tabs" aria-label="모집군 선택">{CALCULATOR_GROUPS.map(([key, label]) => <button key={key} type="button" aria-controls={`jcalc-group-${key}`} aria-pressed={group === key} onClick={() => setGroup(key)}>{label}<small>{targets.filter(target => target.selection?.admissionGroup === key).length}개 후보{representatives[key] ? ' · 대표 선택' : ''}</small></button>)}</nav>
    <div className="jcalc-group-board">{CALCULATOR_GROUPS.map(([key, label]) => {
      const rows = targets.filter(target => target.selection?.admissionGroup === key);
      return <section key={key} id={`jcalc-group-${key}`} className="jcalc-panel jcalc-group-card" data-current={group === key} aria-label={`${label} 지원 후보`}><div className="jcalc-group-heading"><h2>{label}</h2><span className="jcalc-badge">{rows.length}개 후보</span></div>
        <CalculatorButton text disabled={locked} onClick={event => openPicker(key, event)}>분석 가능한 대학 보기</CalculatorButton>
        <button className="jcalc-secondary jcalc-group-add" type="button" disabled={locked} onClick={event => openPicker(key, event)}>{label} 후보 찾기</button>
        {!rows.length && <CalculatorNote>{label}에서 비교할 대학·학과를 찾아보세요.</CalculatorNote>}
        <fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-group-candidates">{rows.map(target => <li key={target.selection.key} data-representative={representatives[key] === target.selection.key}>
          <div className="jcalc-group-identity"><div className="jcalc-school-heading"><strong>{target.selection.universityName}</strong><CalculatorForecast result={resultFor(target)} current={current} /></div><h3>{target.selection.unitName}</h3><p>{target.selection.campusName} · {target.selection.trackName}</p></div>
          <button className="jcalc-representative" type="button" aria-label={`${label} ${target.selection.universityName} ${target.selection.unitName} 대표 선택`} aria-pressed={representatives[key] === target.selection.key} onClick={() => onRepresentative(key, target.selection.key)}>{representatives[key] === target.selection.key ? '대표 지원안' : '대표로 선택'}</button>
          <CalculatorResult exactSelection current={current} result={resultFor(target)} selectedId={target.admissionUnitId} />
          <CalculatorButton text aria-label={`${label} ${target.selection.universityName} ${target.selection.unitName} 후보 삭제`} onClick={() => onRemove(target.selection.key)}>후보 삭제</CalculatorButton>
        </li>)}</ul></fieldset>
      </section>;
    })}</div>
    <CalculatorNote>조합당 최대 6개 후보를 비교하고 가·나·다군마다 대표 지원안 하나를 선택할 수 있습니다. 현재 {targets.length} / 6개</CalculatorNote>
    {legacy.length > 0 && <section className="jcalc-panel" aria-label="미분류 기존 후보"><h2>이전에 저장한 후보</h2><CalculatorNote>모집군을 확인하기 전까지 기존 입력을 보관합니다. 군별 후보 찾기에서 같은 모집단위를 선택하면 확인한 후보로 교체됩니다.</CalculatorNote><fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-candidates">{legacy.map(target => <li key={planTargetKey(target)}><strong>{target.university}</strong><span>{target.major}</span><CalculatorResult current={current} result={resultFor(target)} selectedId={target.admissionUnitId} onSelect={id => onLegacyUnit(planTargetKey(target), id)} /><CalculatorButton text onClick={() => onRemove(planTargetKey(target))}>기존 후보 삭제</CalculatorButton></li>)}</ul></fieldset></section>}
    {picker && !locked && <UnitPicker {...picker} targets={targets} representatives={representatives} onClose={() => setPicker(null)} denyAccess={denyAccess} onAdd={target => { setGroup(target.selection.admissionGroup); onAdd(target); }} />}
  </div>;
}

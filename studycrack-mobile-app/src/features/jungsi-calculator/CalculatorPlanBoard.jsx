import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import CalculatorResult from './CalculatorResult.jsx';
import { requestCalculatorCatalog } from './calculator-catalog-api.js';
import { addPlanTarget, CALCULATOR_GROUPS, planTargetKey } from './calculator-plan-model.js';
import './calculator-plan-board.css';

function UnitPicker({ group, targets, representatives, onClose, onAdd, denyAccess }) {
  const dialog = React.useRef(null), currentDigest = React.useRef(null), binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const [query, setQuery] = React.useState(''), [cursor, setCursor] = React.useState(0), [attempt, setAttempt] = React.useState(0);
  const [resource, setResource] = React.useState({ status: 'loading', items: [], nextCursor: null, total: 0, digest: null, error: '' });
  React.useEffect(() => { const node = dialog.current; node.showModal(); return () => { if (node.open) node.close(); }; }, []);
  React.useEffect(() => {
    const controller = new AbortController(); let active = true;
    setResource(previous => ({ ...previous, status: 'loading', ...(cursor === 0 ? { items: [], nextCursor: null } : {}), error: '' }));
    const timer = setTimeout(async () => {
      const result = await requestCalculatorCatalog({ ...binding, admissionGroup: group, query, cursor, signal: controller.signal });
      if (!active || controller.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED') { denyAccess(); return; }
      if (!result.ok) { setResource(previous => ({ ...previous, status: 'error', error: result.error })); return; }
      if (cursor && currentDigest.current !== result.data.catalogDigest) { setCursor(0); setResource(previous => ({ ...previous, status: 'loading', items: [], error: '' })); return; }
      currentDigest.current = result.data.catalogDigest;
      setResource(previous => ({ status: 'ready', items: cursor ? [...previous.items, ...result.data.items] : result.data.items, nextCursor: result.data.nextCursor, total: result.data.total, digest: result.data.catalogDigest, error: '' }));
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [group, query, cursor, attempt, binding]);
  return <dialog className="jcalc-unit-picker" ref={dialog} aria-labelledby="jcalc-unit-picker-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="jcalc-picker-heading"><h2 id="jcalc-unit-picker-title">{CALCULATOR_GROUPS.find(([key]) => key === group)[1]} 후보 찾기</h2><button className="jcalc-secondary" type="button" onClick={onClose} aria-label="모집단위 선택 닫기">닫기</button></div>
    <label className="jcalc-field"><span>대학·학과 검색</span><input type="search" maxLength="80" autoFocus value={query} placeholder="대학명, 학과명 또는 캠퍼스" onChange={event => { setCursor(0); setQuery(event.currentTarget.value); }} /></label>
    <p className="jcalc-note">2027학년도 모집군·캠퍼스·전형을 확인한 후보입니다.</p>
    {resource.status === 'loading' && <p className="jcalc-note" role="status">모집단위를 불러오고 있습니다…</p>}
    {resource.status === 'error' && <div role="alert"><p className="jcalc-error">{resource.error}</p><button className="jcalc-secondary" type="button" onClick={() => setAttempt(value => value + 1)}>모집단위 다시 불러오기</button></div>}
    {resource.status === 'ready' && !resource.items.length && <p className="jcalc-note">이 군에서 일치하는 모집단위가 없습니다. 검색어를 바꿔보세요.</p>}
    <ul className="jcalc-picker-results">{resource.items.map(target => {
      const canAdd = addPlanTarget(targets, representatives, target).targets !== targets;
      return <li key={target.selection.key}><div><strong>{target.selection.universityName}</strong><span>{target.selection.unitName}</span><small>{target.selection.campusName} · {target.selection.trackName}</small></div><button className="jcalc-secondary" type="button" disabled={!canAdd} aria-label={`${target.selection.universityName} ${target.selection.unitName} ${target.selection.trackName} 후보에 추가`} onClick={() => { onAdd(target); onClose(); }}>{canAdd ? '후보 추가' : targets.some(row => planTargetKey(row) === target.selection.key) ? '추가됨' : '최대 6개'}</button></li>;
    })}</ul>
    {resource.nextCursor !== null && <button className="jcalc-secondary" type="button" disabled={resource.status === 'loading'} onClick={() => setCursor(resource.nextCursor)}>모집단위 더 보기</button>}
  </dialog>;
}

export default function CalculatorPlanBoard({ targets, representatives, results, current, locked, onAdd, onRemove, onRepresentative, onLegacyUnit, denyAccess }) {
  const [group, setGroup] = React.useState('ga'), [picker, setPicker] = React.useState(null);
  const legacy = targets.filter(target => !target.selection);
  const resultFor = target => results?.get(planTargetKey(target));
  return <div className="jcalc-group-workspace">
    <nav className="jcalc-group-tabs" aria-label="모집군 선택">{CALCULATOR_GROUPS.map(([key, label]) => <button key={key} type="button" aria-controls={`jcalc-group-${key}`} aria-pressed={group === key} onClick={() => setGroup(key)}>{label}<small>{targets.filter(target => target.selection?.admissionGroup === key).length}개 후보{representatives[key] ? ' · 대표 선택' : ''}</small></button>)}</nav>
    <div className="jcalc-group-board">{CALCULATOR_GROUPS.map(([key, label]) => {
      const rows = targets.filter(target => target.selection?.admissionGroup === key);
      return <section key={key} id={`jcalc-group-${key}`} className="jcalc-panel jcalc-group-card" data-current={group === key} aria-label={`${label} 지원 후보`}><div className="jcalc-group-heading"><h2>{label}</h2><span className="jcalc-badge">{rows.length}개 후보</span></div>
        <button className="jcalc-secondary jcalc-group-add" type="button" disabled={locked} onClick={() => setPicker(key)}>{label} 후보 찾기</button>
        {!rows.length && <p className="jcalc-note">{label}에서 비교할 대학·학과를 찾아보세요.</p>}
        <fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-group-candidates">{rows.map(target => <li key={target.selection.key} data-representative={representatives[key] === target.selection.key}>
          <div className="jcalc-group-identity"><strong>{target.selection.universityName}</strong><h3>{target.selection.unitName}</h3><p>{target.selection.campusName} · {target.selection.trackName}</p></div>
          <button className="jcalc-representative" type="button" aria-label={`${label} ${target.selection.universityName} ${target.selection.unitName} 대표 선택`} aria-pressed={representatives[key] === target.selection.key} onClick={() => onRepresentative(key, target.selection.key)}>{representatives[key] === target.selection.key ? '대표 지원안' : '대표로 선택'}</button>
          <CalculatorResult exactSelection current={current} result={resultFor(target)} selectedId={target.admissionUnitId} />
          <button className="jcalc-text-button" type="button" aria-label={`${label} ${target.selection.universityName} ${target.selection.unitName} 후보 삭제`} onClick={() => onRemove(target.selection.key)}>후보 삭제</button>
        </li>)}</ul></fieldset>
      </section>;
    })}</div>
    <p className="jcalc-note">조합당 최대 6개 후보를 비교하고 가·나·다군마다 대표 지원안 하나를 선택할 수 있습니다. 현재 {targets.length} / 6개</p>
    {legacy.length > 0 && <section className="jcalc-panel" aria-label="미분류 기존 후보"><h2>이전에 저장한 후보</h2><p className="jcalc-note">모집군을 확인하기 전까지 기존 입력을 보관합니다. 군별 후보 찾기에서 같은 모집단위를 선택하면 확인한 후보로 교체됩니다.</p><fieldset className="jcalc-workspace-fields" disabled={locked}><ul className="jcalc-candidates">{legacy.map(target => <li key={planTargetKey(target)}><strong>{target.university}</strong><span>{target.major}</span><CalculatorResult current={current} result={resultFor(target)} selectedId={target.admissionUnitId} onSelect={id => onLegacyUnit(planTargetKey(target), id)} /><button className="jcalc-text-button" type="button" onClick={() => onRemove(planTargetKey(target))}>기존 후보 삭제</button></li>)}</ul></fieldset></section>}
    {picker && !locked && <UnitPicker group={picker} targets={targets} representatives={representatives} onClose={() => setPicker(null)} denyAccess={denyAccess} onAdd={target => { setGroup(target.selection.admissionGroup); onAdd(target); }} />}
  </div>;
}

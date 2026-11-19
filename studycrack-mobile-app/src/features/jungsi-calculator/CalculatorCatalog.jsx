import React from 'react';
import { candidateKey, majorMatches, MAX_CANDIDATES, universityMatches } from './calculator-model.js';

export default function CalculatorCatalog({ resource, candidates, onAdd, onRetry }) {
  const [query, setQuery] = React.useState('');
  const [majorQuery, setMajorQuery] = React.useState('');
  const [selected, setSelected] = React.useState('');
  const [limit, setLimit] = React.useState(12);
  const [majorLimit, setMajorLimit] = React.useState(12);
  const [notice, setNotice] = React.useState('');
  const input = React.useRef(null);
  const selectedTitle = React.useRef(null);
  const matches = resource.data.filter(item => universityMatches(item.univName, query));
  const university = resource.data.find(item => item.univName === selected);
  const majors = (university?.majors || []).filter(name => majorMatches(name, majorQuery));
  React.useEffect(() => { if (selected) selectedTitle.current?.focus(); }, [selected]);
  return <section className="jcalc-panel" aria-labelledby="jcalc-search-title">
    <div className="jcalc-section-head"><div><p className="jcalc-eyebrow">02 · 지원 후보</p><h2 id="jcalc-search-title">대학·학과 찾아보기</h2></div></div>
    <p className="jcalc-note">지역 선택 없이 대학명부터 검색하세요. 검색 목록과 2027학년도 모집 조건의 검증 여부는 다를 수 있습니다.</p>
    {resource.status === 'loading' && <p className="jcalc-state" role="status">대학·학과 목록을 불러오고 있습니다.</p>}
    {resource.status === 'error' && <div className="jcalc-state" role="alert"><p>{resource.error}</p><button type="button" className="jcalc-secondary" onClick={onRetry}>목록 다시 불러오기</button></div>}
    {resource.status === 'ready' && (!resource.data.length ? <p className="jcalc-state" role="status">현재 조회할 수 있는 대학·학과가 없습니다.</p> : <>
      {!university ? <>
        <label className="jcalc-field"><span>대학명 검색</span><input ref={input} type="search" maxLength="80" autoComplete="off" value={query} placeholder="예: 연세대, 한국외대 글로벌" onChange={event => { setQuery(event.currentTarget.value); setLimit(12); }} /></label>
        <p className="jcalc-count" role="status">{query ? `대학 검색 결과 ${matches.length}곳` : `검색 가능한 대학 ${matches.length}곳`}</p>
        {!matches.length && <p className="jcalc-state">일치하는 대학이 없습니다. 대학명이나 캠퍼스명을 다시 확인해주세요.</p>}
        <ul className="jcalc-results" aria-label="대학 검색 결과">{matches.slice(0, limit).map(item => <li key={item.univName}><button type="button" onClick={() => { setSelected(item.univName); setMajorQuery(''); setMajorLimit(12); setNotice(''); }}><strong>{item.univName}</strong><span>학과 {item.majors.length}개 <span aria-hidden="true">→</span></span></button></li>)}</ul>
        {matches.length > limit && <button className="jcalc-secondary jcalc-more" type="button" onClick={() => setLimit(value => value + 12)}>대학 더 보기</button>}
      </> : <>
        <div className="jcalc-selected"><div><span>선택한 대학</span><h3 ref={selectedTitle} tabIndex={-1}>{university.univName}</h3></div><button type="button" className="jcalc-secondary" onClick={() => { setSelected(''); setNotice(''); requestAnimationFrame(() => input.current?.focus()); }}>대학 변경</button></div>
        <label className="jcalc-field"><span>학과명 검색</span><input type="search" maxLength="100" autoComplete="off" value={majorQuery} placeholder="예: 경영, 컴퓨터" onChange={event => { setMajorQuery(event.currentTarget.value); setMajorLimit(12); }} /></label>
        <p className="jcalc-count" role="status">학과 검색 결과 {majors.length}개</p>
        {!majors.length && <p className="jcalc-state">일치하는 학과가 없습니다. 검색어를 바꿔보세요.</p>}
        <ul className="jcalc-results" aria-label="학과 검색 결과">{majors.slice(0, majorLimit).map(major => {
          const candidate = { university: university.univName, major };
          const added = candidates.some(item => candidateKey(item) === candidateKey(candidate));
          return <li key={major}><div className="jcalc-major"><div><strong>{major}</strong><span>2027 전형·모집군 확인 대기</span></div><button type="button" className="jcalc-secondary" disabled={added || candidates.length >= MAX_CANDIDATES} aria-label={`${major} ${added ? '추가됨' : '후보에 추가'}`} onClick={() => { onAdd(candidate); setNotice(`${major}을 비교 후보에 추가했습니다.`); }}>{added ? '추가됨' : '후보에 추가'}</button></div></li>;
        })}</ul>
        {majors.length > majorLimit && <button className="jcalc-secondary jcalc-more" type="button" onClick={() => setMajorLimit(value => value + 12)}>학과 더 보기</button>}
      </>}
    </>)}
    <p className="jcalc-note" role="status">{candidates.length >= MAX_CANDIDATES ? '최대 6개까지 담을 수 있습니다. 기존 후보를 삭제하면 다시 추가할 수 있어요.' : notice}</p>
  </section>;
}

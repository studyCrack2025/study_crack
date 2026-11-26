import React from 'react';
import { getWrittenAdmissionComparison } from '../written-session-api.js';
import { evidenceGroup } from '../written-reply-evidence.js';

const basisLabels = {
  official_reviewed: '검수 성적 기준',
  student_reported: '학생 입력 성적 기준',
  estimated: '학생 입력 가채점 환산 기준',
  unavailable: '비교할 성적 확인 필요'
};
const reasons = {
  university_required: '대학을 확인하면 계열별 컷을 비교할 수 있어요.',
  university_unresolved: '선택한 대학을 기준 자료에서 찾지 못했어요.',
  university_ambiguous: '일치하는 대학이 여러 곳이에요. 대학명과 캠퍼스를 확인해주세요.',
  track_unresolved: '선택한 계열을 기준 자료에서 확인해주세요.',
  no_matching_units: '해당 대학·계열에서 비교할 수능위주 전형이 없어요.',
  score_unavailable: '선택 과목과 영어·한국사 등급 등 비교에 필요한 수능 성적을 확인해주세요.',
  ineligible: '지원 자격 또는 반영 과목 조건 미충족',
  cut_unavailable: '같은 환산 기준의 컷 확인 필요',
  carryover: '수시 이월이 있을 때 모집'
};
const comparisons = [['atOrAbove70', '70% 컷 이상'], ['between', '합격 컷 이상 · 70% 컷 미만'], ['belowPass', '합격 컷 미만']];
const points = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });
const formatScore = value => points.format(value) + '점';
const formatDifference = value => (value > 0 ? '+' : '') + formatScore(value);

function ComparisonUnit({ unit }) {
  const title = [unit.campusName, unit.unitName].filter(Boolean).join(' · ');
  return <article className="consulting-written-comparison-unit"><strong>{title}</strong><small>{unit.trackName} · {evidenceGroup(unit.admissionGroup)}</small>
    {unit.status === 'comparable' ? <>
      <dl>
        <div><dt>{unit.scoreScope === 'csat_component' ? '학생 수능 반영분' : '학생 환산점수'}</dt><dd><strong>{formatScore(unit.score)}</strong></dd></div>
        <div><dt>{unit.passStatistic === 'final_admission_minimum' ? '최종 합격 최저선' : '예상 합격 컷'}</dt><dd>{formatScore(unit.pass)} ({formatDifference(unit.passDelta)})</dd></div>
        <div><dt>{unit.registered70Statistic === 'registered_70pct' ? '등록자 70% 컷' : '예상 등록자 70% 컷'}</dt><dd>{formatScore(unit.registered70)} ({formatDifference(unit.registered70Delta)})</dd></div>
      </dl>
      <small>{unit.sourceYear}학년도 입결 기준 · 2027학년도 환산{unit.projectedInputs ? ' · 일부 환산 입력 추정' : ''}{unit.peerEstimate ? ' · 유사 모집단위 참고' : ''}</small>
    </> : <small>{reasons[unit.status] || '비교 자료 확인 필요'}</small>}
  </article>;
}

function RankComparison({ rank }) {
  const [expanded, setExpanded] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(8);
  const rows = [...rank.rows].sort((a, b) => Number(b.status === 'comparable') - Number(a.status === 'comparable'));
  const label = [rank.university, rank.track, rank.region].filter(Boolean).join(' · ');
  const representative = rows.find(row => row.status === 'comparable');
  return <article className="consulting-written-comparison-rank">
    <h4>{rank.rank}지망 · {label || '미정'}</h4>
    {rank.status !== 'available' ? <p>{reasons[rank.status] || '비교할 수 있는 전형을 확인해주세요.'}</p> : <>
      <p>{rank.rows.length}개 전형 중 {rank.counts.evaluated}개 비교{rank.counts.unavailable ? ' · 확인 필요 ' + rank.counts.unavailable + '개' : ''}</p>
      <dl className="consulting-written-comparison-counts">{comparisons.map(([key, text]) => <div key={key}><dt>{text}</dt><dd>{rank.counts[key]}개</dd></div>)}</dl>
      {representative && <p>{representative.unitName} · {evidenceGroup(representative.admissionGroup)} · 학생 {formatScore(representative.score)} / 합격 컷 {formatScore(representative.pass)}</p>}
      {rows.length > 0 && <details onToggle={event => setExpanded(event.currentTarget.open)}><summary>모집단위별 점수 보기</summary>{expanded && <>
        {rank.ranges.map((range, index) => <p key={index}>동일 환산 기준 {range.count}개 전형의 합격 컷 {formatScore(range.minimum)}~{formatScore(range.maximum)} · 중앙값 {formatScore(range.median)}</p>)}
        <div className="consulting-written-comparison-rows">{rows.slice(0, visibleCount).map(row => <ComparisonUnit key={row.key} unit={row} />)}</div>
        {rows.length > visibleCount && <button type="button" className="consulting-written-comparison-refresh" onClick={() => setVisibleCount(value => value + 20)}>전형 더 보기</button>}
      </>}</details>}
    </>}
  </article>;
}

export function WrittenAdmissionComparison({ binding, caseId }) {
  const view = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState(null);
  React.useEffect(() => {
    if (!globalThis.IntersectionObserver) { setVisible(true); return undefined; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(view.current);
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    getWrittenAdmissionComparison(binding, caseId, controller.signal).then(response => {
      if (!controller.signal.aborted) setResult(response.ok ? response.data.comparison || { status: 'unavailable' } : { status: 'unavailable' });
    }).catch(() => { if (!controller.signal.aborted) setResult({ status: 'unavailable' }); });
    return () => controller.abort();
  }, [binding, caseId, visible, attempt]);
  const message = result?.status === 'changed' ? '상담 자료가 갱신됐어요. 비교를 다시 불러와주세요.' : '지망별 컷 비교를 불러오지 못했어요.';
  return <section className="consulting-written-comparison" ref={view} aria-label="수능 성적과 1~3지망 비교">
    <h3>수능 성적과 1~3지망 비교</h3>
    {!result ? <p role="status">지망별 컷 비교를 불러오는 중…</p> : <>
      {result.ranks?.length ? <><p>{basisLabels[result.scoreBasis]} · 모집단위별 환산점수 비교</p>
        {result.ranks.map(rank => <RankComparison key={rank.rank} rank={rank} />)}
      </> : <p role="status">{message}</p>}
      <button type="button" className="consulting-written-comparison-refresh" onClick={() => { setResult(null); setAttempt(value => value + 1); }}>컷 비교 다시 불러오기</button>
    </>}
  </section>;
}

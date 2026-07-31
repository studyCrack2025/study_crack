import { EXAM_OPTIONS } from '../../constants/options.js';
import { Sheet } from '../../components/Sheet.jsx';
import {
  buildAnalysisPresentation,
  clampAnalysisScore
} from './presentation.js';

function defaultScoreTierClass(score) {
  const value = Number(score) || 0;
  if (value <= 100) return 'score-tier-low';
  if (value <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

function formatPoint(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  if (Math.abs(number - Math.round(number)) < 0.05) return String(Math.round(number));
  return number.toFixed(digits);
}

function rawNeededText(row = {}) {
  return row.rawNeeded > 1 ? `원점수 +${row.rawNeeded}점부터 변화` : '';
}

function simulationStatusText(row = {}, isBest = false) {
  if (isBest && Number(row.gainNum || 0) > 0) return '가장 크게 반영';
  if (Number(row.gainNum || 0) > 0) return '반영 있음';
  return rawNeededText(row) || '변동 대기';
}

function SimulationTable({ rows = [], selectedSubject = '' }) {
  if (!rows.length) {
    return <div className="analysis-boost-empty">시뮬레이션 결과를 불러오면 과목별 상승 효율이 표시됩니다.</div>;
  }
  const activeSubject = selectedSubject || rows[0]?.subject || '';
  return (
    <div className="analysis-sim-table" role="table" aria-label="과목별 원점수 1점 상승의 환산점수 효과">
      <div className="analysis-sim-table-head" role="row"><span>과목</span><span>환산 효과</span><span>+1점 적용 후</span></div>
      {rows.map((row) => {
        const active = activeSubject === row.subject;
        const before = clampAnalysisScore(row.baseUiScore);
        const after = clampAnalysisScore(row.afterUiScore);
        const className = ['analysis-sim-row', row.isBest ? 'best' : '', active ? 'active' : '', row.isEvaporation ? 'is-flat' : ''].filter(Boolean).join(' ');
        return (
          <button type="button" className={className} data-action="highlightSimSubject" data-sim-subject={row.subject} role="row" key={row.subject}>
            <span className="analysis-sim-subject" role="cell"><b>{row.subject}</b>{row.isBest ? <em>최고 반영</em> : null}</span>
            <span className="analysis-sim-effect" role="cell">{row.gain}</span>
            <span className="analysis-sim-status" role="cell"><b>{simulationStatusText(row, row.isBest)}</b><small>{formatPoint(before)} → {formatPoint(after)}점</small></span>
          </button>
        );
      })}
    </div>
  );
}

function CurrentScoreSummary({ scores = {} }) {
  const inquiryScores = [scores.inquiry1, scores.inquiry2]
    .filter((value) => value !== '' && value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  const items = [
    ['국어', scores.korean],
    ['수학', scores.math],
    ['영어', scores.english],
    ['탐구', inquiryScores.length ? inquiryScores.reduce((sum, value) => sum + value, 0) / inquiryScores.length : null]
  ].filter(([, value]) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!items.length) return null;
  return (
    <div className="card analysis-score-summary">
      <div className="analysis-score-summary-head"><h4>현재 성적</h4><span>원점수 기준</span></div>
      <div className="analysis-score-summary-grid">
        {items.map(([label, value]) => <div key={label}><span>{label}</span><b>{formatPoint(value)}점</b></div>)}
      </div>
    </div>
  );
}

function subjectDeltaLabel(key = '', value = 0) {
  const names = { kor: '국어', math: '수학', inq1: '탐구1', inq2: '탐구2' };
  const number = Number(value) || 0;
  return number > 0 ? `${names[key] || key} +${number}점` : '';
}

function summarizeBacktracePlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const bySubject = plan.bySubject || plan.bestEffort?.bySubject || {};
  const expected = plan.expected || plan.bestEffort?.expected || {};
  return {
    reachable: plan.reachable === true,
    items: ['kor', 'math', 'inq1', 'inq2'].map((key) => subjectDeltaLabel(key, bySubject[key])).filter(Boolean),
    minTotalRaw: Number(plan.minTotalRaw ?? plan.bestEffort?.minTotalRaw ?? 0) || 0,
    expectedUiScore: Number(expected.uiScore),
    error: plan.error || ''
  };
}

function ReverseProjectionCard({
  analysisSimRows = [],
  canUseReverseProjection = false,
  currentScore = 0,
  backtraceStatus = 'idle',
  backtracePlan = null,
  backtraceError = ''
}) {
  const backtrace = summarizeBacktracePlan(backtracePlan);
  if (!canUseReverseProjection) {
    return (
      <div className="card analysis-reverse-card locked">
        <div><span className="analysis-card-eyebrow">Standard Exclusive</span><h4>안정권까지 도달하려면 최소 몇점?</h4><p>최소 노력 대비 도달 성적은 Standard 이상에서 확인할 수 있어요.</p></div>
        <button type="button" className="btn btn-secondary mini" data-action="goto" data-target="proIntro">Standard 기능 보기</button>
      </div>
    );
  }
  if (!analysisSimRows.length || backtraceStatus === 'loading' || backtraceStatus === 'idle') {
    return <div className="card analysis-reverse-card"><span className="analysis-card-eyebrow">역산 대기</span><h4>시뮬레이션 결과를 불러오는 중</h4><p>과목별 상승 효율이 준비되면 최소 조합을 계산합니다.</p></div>;
  }
  if (backtraceStatus === 'error' || backtraceStatus === 'empty' || !backtrace) {
    return <div className="card analysis-reverse-card"><span className="analysis-card-eyebrow">역산 결과</span><h4>조합을 계산하지 못했습니다</h4><p>{backtraceError || '현재 성적과 목표 대학 조건에서 도달 가능한 조합이 없습니다.'}</p></div>;
  }
  const expectedText = backtrace.reachable && Number.isFinite(backtrace.expectedUiScore)
    ? `${Math.round(backtrace.expectedUiScore)}점 도달`
    : backtrace.error ? '추가 성적 입력 필요' : '계산 대기';
  const totalRawText = backtrace.reachable ? `총 +${backtrace.minTotalRaw}점` : currentScore >= 100 ? '이미 합격권' : '도달 조합 없음';
  const lead = backtrace.reachable
    ? '가장 적은 원점수 상승으로 합격권에 닿는 조합입니다.'
    : backtrace.error || '단일 과목 +1점으로 변화가 작을 때는 여러 과목 조합을 함께 봅니다.';
  return (
    <div className="card analysis-reverse-card">
      <div className="analysis-reverse-head"><span className="analysis-card-eyebrow">Standard Exclusive</span><h4>안정권까지 도달하려면 최소 몇점?</h4><p>{lead}</p></div>
      <div className="analysis-reverse-plan">
        <div><span>추천 조합</span><b>{backtrace.items.join(' / ') || '계산 대기'}</b></div>
        <div><span>필요 원점수</span><b>{totalRawText}</b></div>
        <div><span>예상 도달</span><b>{expectedText}</b></div>
      </div>
    </div>
  );
}

export function AnalysisContent(ctx) {
  const {
    analysisHighlightedSubject = '',
    analysisMajorOptions = [],
    analysisStatus = '',
    analysisSelected = {},
    analysisSimRecommendedIndex = -1,
    analysisSimRows = [],
    analysisScoreView = null,
    analysisBacktraceStatus = 'idle',
    analysisBacktracePlan = null,
    analysisBacktraceError = '',
    canAccessStandard = false,
    canUseReverseProjection = canAccessStandard,
    normalizedTargetMajor = '',
    scoreExamType = '',
    scoreTierClass = defaultScoreTierClass,
    scores = {}
  } = ctx;
  const scoreView = analysisScoreView || { pending: false, hasScore: true, score: Number(analysisSelected.score || 0) };
  const presentation = buildAnalysisPresentation({
    rows: analysisSimRows,
    selectedSubject: analysisHighlightedSubject,
    recommendedIndex: analysisSimRecommendedIndex,
    scoreView,
    fallbackScore: analysisSelected.score
  });
  const { sortedRows, selectedRow, bestRow, currentScore, afterScore, currentPct, afterPct, previewLeftPct, previewWidthPct, hasPreview, gapToPass } = presentation;
  const targetOptions = Array.from(new Set([normalizedTargetMajor, ...analysisMajorOptions].filter(Boolean)));
  const activeSubject = selectedRow?.subject || '';
  const currentScoreText = scoreView.pending ? '계산 중' : scoreView.hasScore ? `${formatPoint(currentScore)}점` : '성적 필요';
  const selectedEffectText = selectedRow && scoreView.hasScore
    ? `${selectedRow.subject} 원점수 +1 적용 시 ${formatPoint(currentScore)}점 → ${formatPoint(afterScore)}점`
    : '과목을 선택하면 상승 후 환산점수를 함께 보여드려요.';
  const passPct = 40;
  const safePct = 60;
  return (
    <div className="analysis-unified">
      <div className="card analysis-result-card">
        <div className="analysis-result-head">
          <label><span>희망 대학</span><select className="analysis-target-select planner-input" data-field="analysisTargetMajor" value={normalizedTargetMajor} onChange={() => {}}>{targetOptions.length ? targetOptions.map((label) => <option value={label} key={label}>{label}</option>) : <option value="">목표 대학을 추가해주세요</option>}<option value="__add_university__">+ 희망 대학 추가</option></select></label>
          <label><span>시험 기준</span><select className="analysis-exam-select planner-input" data-field="scoreExamType" value={scoreExamType} onChange={() => {}}>{EXAM_OPTIONS.map((label) => <option value={label} key={label}>{label}</option>)}</select></label>
        </div>
        <div className="analysis-result-overview"><div><span>현재 환산점수</span><strong>{currentScoreText}</strong></div><em className={`analysis-status-pill ${scoreTierClass(currentScore)}`}>{analysisStatus || '분석 결과'}</em></div>
        <div className="analysis-gap-grid"><div><span>합격컷까지</span><b>{gapToPass ? `+${formatPoint(gapToPass)}점` : '도달'}</b></div><div><span>+원점수 1점 최대 효과</span><b>{bestRow && scoreView.hasScore ? bestRow.gain : '—'}</b></div></div>
        <div className={`analysis-main-gauge-wrap ${scoreTierClass(currentScore)}`}>
          <div className="analysis-main-gauge-top"><span>{currentScoreText}</span></div>
          <div className="analysis-main-gauge" aria-label="환산점수 게이지">
            <i className="analysis-main-gauge-fill" style={{ width: `${currentPct}%` }} />
            {hasPreview ? <><i className="analysis-main-gauge-preview-fill" style={{ left: `${previewLeftPct}%`, width: `${previewWidthPct}%` }}><em /><em /></i><span className="analysis-main-gauge-preview-label" style={{ left: `${afterPct}%` }}>+1 후 {formatPoint(afterScore)}점</span></> : null}
            <span className="analysis-main-gauge-pin" style={{ left: `${currentPct}%` }}><i /></span>
            <span className="analysis-main-gauge-marker pass" style={{ left: `${passPct}%` }} />
            <span className="analysis-main-gauge-marker safe" style={{ left: `${safePct}%` }} />
          </div>
          <div className="analysis-main-gauge-scale"><span className="zero">0</span><span className="pass" style={{ left: `${passPct}%` }}>합격 100</span><span className="safe" style={{ left: `${safePct}%` }}>안정 150</span><span className="max">250</span></div>
          <p className="analysis-main-gauge-caption">{selectedEffectText}</p>
        </div>
      </div>
      <div className="card analysis-boost-card">
        <div className="analysis-section-head"><div><span className="analysis-card-eyebrow">원점수 +1 효율</span><h4>한 점을 어디에 투자할까요?</h4><p>{bestRow ? `${bestRow.subject} 1점이 환산점수에 가장 크게 반영돼요.` : '성적 분석이 끝나면 과목별 효율을 비교해드려요.'}</p></div><b>{bestRow && scoreView.hasScore ? `${bestRow.subject} ${bestRow.gain}` : '효과 대기'}</b></div>
        <SimulationTable rows={sortedRows} selectedSubject={activeSubject} />
      </div>
      <ReverseProjectionCard analysisSimRows={analysisSimRows} canUseReverseProjection={canUseReverseProjection} currentScore={currentScore} backtraceStatus={analysisBacktraceStatus} backtracePlan={analysisBacktracePlan} backtraceError={analysisBacktraceError} />
      <CurrentScoreSummary scores={scores} />
    </div>
  );
}

export function AnalysisSearchSheet({
  analysisRecommended = [],
  analysisSearchList = [],
  analysisSearchOpen = false,
  analysisSearchTerm = '',
  analysisTargetList = []
}) {
  return (
    <Sheet open={analysisSearchOpen} overlayClass="analysis-search-overlay" panelClass="analysis-search-modal" dismissAction="closeAnalysisSearch">
      <div className="sc-sheet-head analysis-search-head"><h4>희망 대학 선택</h4><button className="sc-overlay-close" data-action="closeAnalysisSearch" aria-label="닫기">✕</button></div>
      <div className="sc-sheet-body analysis-search-body">
        <div className="analysis-search-sticky analysis-search-inline"><input className="planner-input" data-field="analysisSearchTerm" defaultValue={analysisSearchTerm} placeholder="대학명 또는 학과명을 검색하세요" /><button type="button" className="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
        <div className="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div className="analysis-search-rec-grid">{analysisRecommended.map((name) => <button className="analysis-rec-card" data-action="addAnalysisTarget" data-target-major={name} key={name}><div><strong>{name}</strong><span className="badge">추천</span></div><em>{analysisTargetList.includes(name) ? '추가됨' : '선택'}</em></button>)}</div></div>
        <div className="analysis-search-section"><p>검색 결과</p>{analysisSearchList.map((name) => <button className="analysis-search-row" data-action="addAnalysisTarget" data-target-major={name} key={name}>{name}<span>{analysisTargetList.includes(name) ? '추가됨' : '추가'}</span></button>)}</div>
      </div>
    </Sheet>
  );
}

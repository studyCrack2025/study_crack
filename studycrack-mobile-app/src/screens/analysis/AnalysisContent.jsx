import { EXAM_OPTIONS } from '../../constants/options.js';
import { Sheet } from '../../components/Sheet.jsx';
import { TargetAllowance } from './TargetAllowance.jsx';
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
  return row.rawNeeded > 1 ? `원점수 +${row.rawNeeded}점에서 처음 상승해요.` : '';
}

function simulationStatusText(row = {}, isBest = false) {
  if (row.unavailable) return '환산 데이터 확인 필요';
  if (row.atMaximum) return '이미 원점수 만점';
  if (isBest && Number(row.displayGainNum || 0) > 0) return '가장 크게 반영';
  if (Number(row.displayGainNum || 0) > 0) return '반영 있음';
  return '+1점에서는 변화 없음';
}

function SimulationGrid({ rows = [], selectedSubject = '' }) {
  if (!rows.length) {
    return <div className="analysis-boost-empty">시뮬레이션 결과를 불러오면 과목별 상승 효율이 표시됩니다.</div>;
  }
  const activeSubject = selectedSubject || rows[0]?.subject || '';
  return (
    <ul className="analysis-sim-table" aria-label="과목별 원점수 1점 상승의 환산점수 효과">
      {rows.map((row) => {
        const active = !row.unavailable && !row.atMaximum && activeSubject === row.subject;
        const before = clampAnalysisScore(row.baseUiScore);
        const after = clampAnalysisScore(row.afterUiScore);
        const className = ['analysis-sim-row', row.isBest ? 'best' : '', active ? 'active' : '', row.isEvaporation ? 'is-flat' : ''].filter(Boolean).join(' ');
        return (
          <li key={row.key || row.subject}><button type="button" className={className} data-action="highlightSimSubject" data-sim-subject={row.subject} aria-pressed={active && !row.unavailable && !row.atMaximum} disabled={row.unavailable || row.atMaximum}>
            <span className="analysis-sim-subject"><b>{row.subject}</b>{row.isBest ? <em>최고 반영</em> : null}</span>
            <span className="analysis-sim-effect">{row.unavailable ? '확인 필요' : row.atMaximum ? '만점' : row.displayGain}</span>
            <span className="analysis-sim-status"><b>{simulationStatusText(row, row.isBest)}</b><small>{row.unavailable ? '현재 시험·과목 데이터를 확인해주세요.' : row.atMaximum ? '더 올릴 원점수가 없어요.' : rawNeededText(row) || `${formatPoint(before)} → ${formatPoint(after)}점`}</small></span>
          </button></li>
        );
      })}
    </ul>
  );
}

function SimulationPreview({ rows, selectedRow, currentScore, afterScore, canSimulate, status = 'idle' }) {
  return <section className="card analysis-boost-card" aria-label="원점수 1점 비교">
    <div className="analysis-section-head"><div><span className="analysis-card-eyebrow">한 점의 효과</span><h4>점수 상승 시뮬레이션</h4><p>과목을 선택해 원점수 +1점의 실제 환산 효과를 비교하세요.</p></div></div>
    {rows.length ? <>{selectedRow && !selectedRow.atMaximum ? <div className="analysis-preview-values" aria-live="polite"><span><small>{selectedRow.subject} 원점수</small><b>+1점</b></span><span><small>적용 후 환산점수</small><b>{formatPoint(afterScore)}점</b><small>현재 {formatPoint(currentScore)}점</small></span></div> : <p className="analysis-boost-empty">원점수를 올려 비교할 수 있는 과목 결과가 없어요.</p>}<SimulationGrid rows={rows} selectedSubject={selectedRow?.subject} /><p className="analysis-simulation-note">0점은 원점수 +1점을 적용해도 환산점수가 같다는 뜻이에요. 더 올려야 상승하는 과목은 확인된 최초 상승 폭을 따로 표시해요.</p></> : <p className="analysis-boost-empty">{!canSimulate ? '과목별 +1점 비교는 Basic 이상에서 제공해요.' : status === 'loading' ? '과목별 +1점 결과를 불러오는 중이에요.' : status === 'error' ? '과목별 결과를 불러오지 못했어요.' : status === 'empty' ? '현재 조건의 과목별 결과가 없어요.' : '점수를 계산하면 확인된 과목별 결과를 표시해요.'}</p>}
    {canSimulate && ['error', 'empty'].includes(status) ? <button type="button" className="btn btn-secondary" data-action="calculateAnalysisScore">과목 결과 다시 확인</button> : null}
  </section>;
}

function CurrentScoreSummary({ scores = {}, confirmedItems = null }) {
  const inquiryScores = [scores.inquiry1, scores.inquiry2]
    .filter((value) => value !== '' && value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  const items = confirmedItems || [
    ['국어', scores.korean],
    ['수학', scores.math],
    ['영어', scores.english],
    ['탐구', inquiryScores.length ? inquiryScores.reduce((sum, value) => sum + value, 0) / inquiryScores.length : null]
  ].filter(([, value]) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!items.length) return null;
  return (
    <div className="analysis-score-summary">
      <div className="analysis-score-summary-head"><h4>현재 성적</h4><span>{confirmedItems ? '원점수 · 영어 등급' : '원점수 기준'}</span></div>
      <div className="analysis-score-summary-grid">
        {items.map(([label, value, unit = '점'], index) => <div key={`${label}-${index}`}><span>{label}</span><b>{formatPoint(value)}{unit}</b></div>)}
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
    return null;
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
      <div className="analysis-reverse-head"><span className="analysis-card-eyebrow">Standard Exclusive</span><h4>합격권까지 필요한 최소 원점수</h4><p>{lead}</p></div>
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
    analysisPresentation = null,
    analysisHighlightedSubject = '',
    analysisCalculationRequested = false,
    analysisApiStatus = 'idle',
    isAnalyzing = false,
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
  const cachedScoreView = analysisScoreView || { pending: false, hasScore: true, score: Number(analysisSelected.score || 0) };
  const scoreView = analysisPresentation?.ready ? { ...cachedScoreView, pending: false, hasScore: analysisPresentation.score !== null, score: analysisPresentation.score ?? 0 } : cachedScoreView;
  const scopedRows = analysisPresentation?.rows || analysisSimRows;
  const presentation = buildAnalysisPresentation({
    rows: scopedRows,
    selectedSubject: analysisHighlightedSubject,
    recommendedIndex: analysisSimRecommendedIndex,
    scoreView,
    fallbackScore: analysisSelected.score
  });
  const { sortedRows, selectedRow, bestRow, currentScore, afterScore, currentPct, afterPct, previewLeftPct, previewWidthPct, hasPreview, gapToPass } = presentation;
  const targetOptions = Array.from(new Set([normalizedTargetMajor, ...analysisMajorOptions].filter(Boolean)));
  const isScoreLoading = analysisCalculationRequested
    && (isAnalyzing || scoreView.pending || analysisApiStatus === 'loading');
  const currentScoreText = isScoreLoading ? '계산 중' : scoreView.hasScore ? `${formatPoint(currentScore)}점` : '성적 필요';
  const showCalculationPrompt = !isScoreLoading && !scoreView.hasScore
    && (!analysisCalculationRequested || analysisPresentation?.ready || ['empty', 'error'].includes(analysisApiStatus));
  const needsRecalculation = analysisPresentation?.needsCalculation && scoreView.hasScore;
  const unavailableReason = analysisPresentation?.ready && !scoreView.hasScore ? analysisPresentation.comparison?.find(row => row.major === normalizedTargetMajor)?.reason : '';
  const showScoreDetails = !isScoreLoading && scoreView.hasScore && (!analysisPresentation || analysisPresentation.ready);
  const selectedEffectText = selectedRow && scoreView.hasScore
    ? `${selectedRow.subject} 원점수 +1 적용 시 ${formatPoint(currentScore)}점 → ${formatPoint(afterScore)}점`
    : '과목을 선택하면 상승 후 환산점수를 함께 보여드려요.';
  const passPct = 40;
  const safePct = 60;
  return (
    <div className="analysis-unified">
      <section className="analysis-input-entry" aria-label="분석 전 성적 확인">
        <div><span className="analysis-card-eyebrow">01 · 성적 확인</span><b>내 성적부터 확인해요</b><p>저장한 시험 성적이 분석 기준이에요. 성적을 확인하고 대학별 점수를 계산해보세요.</p></div>
        <div className="analysis-result-head">
          <label><span>시험 기준</span><select className="analysis-exam-select planner-input" data-field="scoreExamType" value={scoreExamType} onChange={() => {}}>{!EXAM_OPTIONS.includes(scoreExamType) && scoreExamType ? <option value={scoreExamType}>{scoreExamType}</option> : null}{EXAM_OPTIONS.map((label) => <option value={label} key={label}>{label}</option>)}</select></label>
        </div>
        <CurrentScoreSummary scores={scores} confirmedItems={analysisPresentation?.currentScores} />
        <button type="button" className="btn btn-secondary" data-action="goto" data-target="scoreInfo">성적 입력·수정</button>
      </section>
      <div className={`card analysis-score-card ${isScoreLoading ? 'is-loading' : ''}`} aria-busy={isScoreLoading}>
        <span className="analysis-card-eyebrow">02 · 대학별 환산</span>
        <TargetAllowance policy={ctx.targetPolicy} />
        <div className="analysis-result-head"><label><span>희망 대학</span><select className="analysis-target-select planner-input" data-field="analysisTargetMajor" value={normalizedTargetMajor} onChange={() => {}}>{targetOptions.length ? targetOptions.map((label) => <option value={label} key={label}>{label}</option>) : <option value="">목표 대학을 추가해주세요</option>}<option value="__add_university__">+ 희망 대학 추가</option></select></label></div>
        {isScoreLoading ? <div className="analysis-score-local-loading" role="status" aria-live="polite">
          <div className="analysis-loading-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div><span>환산 분석 진행 중</span><b>목표 대학 기준 점수를 계산하고 있어요</b><p>계산이 끝나면 이 카드만 결과로 전환됩니다.</p></div>
        </div> : <>
        <div className="analysis-score-card-head">
          <div><span>내 환산점수</span><strong>{showCalculationPrompt ? '—' : scoreView.hasScore ? <>{formatPoint(currentScore)}<span>점</span></> : currentScoreText}</strong><small>250점 만점</small></div>
          <div><em className={`analysis-status-pill ${scoreTierClass(currentScore)}`}>{showCalculationPrompt ? (unavailableReason ? '확인 필요' : '계산 전') : needsRecalculation ? '마지막 확인' : analysisStatus || '분석 결과'}</em><b>{normalizedTargetMajor || '희망 대학을 선택해주세요'}</b><span>{scoreExamType || '시험 기준 선택'}</span></div>
        </div>
        {showCalculationPrompt || needsRecalculation ? <div className="analysis-score-prompt"><p>{unavailableReason || (needsRecalculation ? '마지막 확인 점수예요. 현재 성적과 대학 기준으로 다시 계산해주세요.' : '저장된 성적과 희망 대학 기준으로 환산점수를 계산합니다.')}</p><button type="button" className="analysis-calculate-btn" data-action="calculateAnalysisScore">{analysisCalculationRequested ? '다시 계산하기' : '점수 계산하기'}</button></div> : null}
        </>}
      {showScoreDetails ? <div className="analysis-score-detail-card">
        <div className={`analysis-main-gauge-wrap ${scoreTierClass(currentScore)}`}>
          <div className="analysis-main-gauge-top"><span>현재 {currentScoreText}</span>{hasPreview ? <span className="analysis-main-gauge-preview-label">적용 후 {formatPoint(afterScore)}점</span> : null}</div>
          <div className="analysis-main-gauge" aria-label="환산점수 게이지">
            <i className="analysis-main-gauge-fill" style={{ width: `${currentPct}%` }} />
            {hasPreview ? <><i className="analysis-main-gauge-preview-fill" style={{ left: `${previewLeftPct}%`, width: `${previewWidthPct}%` }} /><span className="analysis-main-gauge-after-pin" style={{ left: `${afterPct}%` }} /></> : null}
            <span className="analysis-main-gauge-pin" style={{ left: `${currentPct}%` }}><i /></span>
            <span className="analysis-main-gauge-marker pass" style={{ left: `${passPct}%` }} />
            <span className="analysis-main-gauge-marker safe" style={{ left: `${safePct}%` }} />
          </div>
          <div className="analysis-main-gauge-scale"><span className="zero">0</span><span className="pass" style={{ left: `${passPct}%` }}>합격 100</span><span className="safe" style={{ left: `${safePct}%` }}>안정 150</span><span className="max">250</span></div>
          <p className="analysis-main-gauge-caption">{selectedEffectText}</p>
        </div>
        <div className="analysis-score-facts"><span><small>합격컷까지</small><b>{scoreView.hasScore ? (gapToPass ? `+${formatPoint(gapToPass)}점` : '도달') : '—'}</b></span><span><small>원점수 1점 최대 효과</small><b>{bestRow && scoreView.hasScore ? bestRow.displayGain : '—'}</b></span></div>
        {bestRow?.displayGainNum > 0 ? <div className="analysis-study-insight"><p>{bestRow.subject} 원점수 1점의 환산 효과는 {bestRow.displayGain}이에요.</p><button type="button" className="btn btn-primary" data-action="goto" data-target="planner">오늘 플래너 확인하기 →</button></div> : null}
      </div> : null}
      </div>
      <SimulationPreview rows={sortedRows} selectedRow={selectedRow} currentScore={currentScore} afterScore={afterScore} canSimulate={analysisPresentation?.canSimulate !== false} status={analysisPresentation?.simulationStatus} />
      <ReverseProjectionCard analysisSimRows={scopedRows} canUseReverseProjection={canUseReverseProjection} currentScore={currentScore} backtraceStatus={analysisPresentation && !analysisPresentation.backtraceReady ? 'idle' : analysisBacktraceStatus} backtracePlan={analysisBacktracePlan} backtraceError={analysisBacktraceError} />
      <button type="button" className="btn btn-secondary" data-action="goto" data-target="proIntro">플랜별 기능 보기 →</button>
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
    <Sheet open={analysisSearchOpen} variant="planner" overlayClass="analysis-search-overlay" panelClass="analysis-search-modal" dismissAction="closeAnalysisSearch" ariaLabel="대학 검색">
      <div className="sc-sheet-head analysis-search-head"><h4>희망 대학 선택</h4><button className="sc-overlay-close" data-action="closeAnalysisSearch" aria-label="닫기">✕</button></div>
      <div className="sc-sheet-body analysis-search-body">
        <div className="analysis-search-sticky analysis-search-inline"><input className="planner-input" data-field="analysisSearchTerm" defaultValue={analysisSearchTerm} placeholder="대학명 또는 학과명을 검색하세요" /><button type="button" className="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
        <div className="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div className="analysis-search-rec-grid">{analysisRecommended.map((name) => <button className="analysis-rec-card" data-action="addAnalysisTarget" data-target-major={name} key={name}><div><strong>{name}</strong><span className="badge">추천</span></div><em>{analysisTargetList.includes(name) ? '추가됨' : '선택'}</em></button>)}</div></div>
        <div className="analysis-search-section"><p>검색 결과</p>{analysisSearchList.map((name) => <button className="analysis-search-row" data-action="addAnalysisTarget" data-target-major={name} key={name}>{name}<span>{analysisTargetList.includes(name) ? '추가됨' : '추가'}</span></button>)}</div>
      </div>
    </Sheet>
  );
}

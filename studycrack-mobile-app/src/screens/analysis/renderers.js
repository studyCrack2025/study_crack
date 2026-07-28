import { EXAM_OPTIONS } from '../../constants/options.js';
import {
  buildAnalysisPresentation,
  clampAnalysisScore
} from './presentation.js';

function defaultScoreTierClass(score) {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderExamOptions(scoreExamType = '') {
  return EXAM_OPTIONS.map((label) => `<option value="${escapeHtml(label)}" ${scoreExamType === label ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function renderTargetOptions(options = [], selected = '') {
  const normalized = Array.from(new Set(options.filter(Boolean)));
  const optionHtml = normalized.length
    ? normalized.map((label) => `<option value="${escapeHtml(label)}" ${selected === label ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')
    : '<option value="" selected>목표 대학을 추가해주세요</option>';
  return `${optionHtml}<option value="__add_university__">+ 희망 대학 추가</option>`;
}

function formatPoint(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n.toFixed(digits);
}

function renderAddUniversityCard({ analysisTargetList = [], name }) {
  const added = analysisTargetList.includes(name);
  return `<div class="add-univ-card">
              <div class="add-univ-card-top"><div class="add-univ-item-text"><b>${name}</b><p>현재 성적 기준 우선 검토 대학</p><span class="add-univ-item-badge">검토</span></div><span class="badge">추천</span></div>
              <button class="btn ${added ? 'btn-secondary' : 'btn-primary'}" data-action="addAnalysisTarget" data-target-major="${name}" ${added ? 'disabled' : ''}>${added ? '추가됨' : '추가'}</button>
            </div>`;
}

function renderSearchRow({ analysisTargetList = [], name }) {
  const added = analysisTargetList.includes(name);
  return `<div class="add-univ-row"><div class="add-univ-item-text"><span>${name}</span><span class="add-univ-item-badge">검색</span></div><button class="btn ${added ? 'btn-secondary' : 'btn-primary'} mini" data-action="addAnalysisTarget" data-target-major="${name}" ${added ? 'disabled' : ''}>${added ? '추가됨' : '추가'}</button></div>`;
}

export function renderAnalysisSearchModal(ctx) {
  const {
    analysisRecommended = [],
    analysisSearchList = [],
    analysisSearchOpen = false,
    analysisSearchTerm = '',
    analysisTargetList = []
  } = ctx;

  if (!analysisSearchOpen) return '';

  return `<div class="analysis-search-overlay" data-action="closeAnalysisSearch"><div class="analysis-search-modal" data-action="noopModal"><div class="analysis-search-head"><h4>희망 대학 선택</h4><button data-action="closeAnalysisSearch">✕</button></div><div class="analysis-search-sticky analysis-search-inline"><input class="planner-input" data-field="analysisSearchTerm" value="${analysisSearchTerm}" placeholder="대학명 또는 학과명을 검색하세요"/><button type="button" class="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div><div class="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div class="analysis-search-rec-grid">${analysisRecommended.map((name) => `<button class="analysis-rec-card" data-action="addAnalysisTarget" data-target-major="${name}"><div><strong>${name}</strong><span class="badge">추천</span></div><em>${analysisTargetList.includes(name) ? '추가됨' : '선택'}</em></button>`).join('')}</div></div><div class="analysis-search-section"><p>검색 결과</p>${analysisSearchList.map((name) => `<button class="analysis-search-row" data-action="addAnalysisTarget" data-target-major="${name}">${name}<span>${analysisTargetList.includes(name) ? '추가됨' : '추가'}</span></button>`).join('')}</div></div></div>`;
}

function rawNeededText(row = {}) {
  if (row.rawNeeded && row.rawNeeded > 1) return `원점수 +${row.rawNeeded}점부터 변화`;
  return '';
}

function simulationStatusText(row = {}, isBest = false) {
  if (isBest && Number(row.gainNum || 0) > 0) return '가장 크게 반영';
  if (Number(row.gainNum || 0) > 0) return '반영 있음';
  return rawNeededText(row) || '변동 대기';
}

function renderSimulationTable({ rows = [], selectedSubject = '' }) {
  if (!rows.length) {
    return '<div class="analysis-boost-empty">시뮬레이션 결과를 불러오면 과목별 상승 효율이 표시됩니다.</div>';
  }
  const activeSubject = selectedSubject || rows[0]?.subject || '';
  return `<div class="analysis-sim-table" role="table" aria-label="과목별 원점수 1점 상승의 환산점수 효과">
    <div class="analysis-sim-table-head" role="row"><span>과목</span><span>환산 효과</span><span>+1점 적용 후</span></div>
    ${rows.map((row) => {
    const active = activeSubject === row.subject;
    const status = simulationStatusText(row, row.isBest);
    const before = clampAnalysisScore(row.baseUiScore);
    const after = clampAnalysisScore(row.afterUiScore);
    return `<button type="button" class="analysis-sim-row ${row.isBest ? 'best' : ''} ${active ? 'active' : ''} ${row.isEvaporation ? 'is-flat' : ''}" data-action="highlightSimSubject" data-sim-subject="${escapeHtml(row.subject)}" role="row">
      <span class="analysis-sim-subject" role="cell"><b>${escapeHtml(row.subject)}</b>${row.isBest ? '<em>최고 반영</em>' : ''}</span>
      <span class="analysis-sim-effect" role="cell">${escapeHtml(row.gain)}</span>
      <span class="analysis-sim-status" role="cell"><b>${escapeHtml(status)}</b><small>${formatPoint(before)} → ${formatPoint(after)}점</small></span>
    </button>`;
  }).join('')}</div>`;
}

function renderCurrentScoreSummary(scores = {}) {
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
  if (!items.length) return '';
  return `<div class="card analysis-score-summary"><div class="analysis-score-summary-head"><h4>현재 성적</h4><span>원점수 기준</span></div><div class="analysis-score-summary-grid">${items.map(([label, value]) => `<div><span>${label}</span><b>${formatPoint(value)}점</b></div>`).join('')}</div></div>`;
}

function subjectDeltaLabel(key = '', value = 0) {
  const names = { kor: '국어', math: '수학', inq1: '탐구1', inq2: '탐구2' };
  const n = Number(value) || 0;
  return n > 0 ? `${names[key] || key} +${n}점` : '';
}

function summarizeBacktracePlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const bySubject = plan.bySubject || plan.bestEffort?.bySubject || {};
  const expected = plan.expected || plan.bestEffort?.expected || {};
  const items = ['kor', 'math', 'inq1', 'inq2'].map((key) => subjectDeltaLabel(key, bySubject[key])).filter(Boolean);
  return {
    reachable: plan.reachable === true,
    items,
    minTotalRaw: Number(plan.minTotalRaw ?? plan.bestEffort?.minTotalRaw ?? 0) || 0,
    expectedUiScore: Number(expected.uiScore),
    error: plan.error || ''
  };
}

function renderReverseProjectionCard({
  analysisSimRows = [],
  canUseReverseProjection = false,
  currentScore = 0,
  backtraceStatus = 'idle',
  backtracePlan = null,
  backtraceError = ''
}) {
  const backtrace = summarizeBacktracePlan(backtracePlan);
  if (!canUseReverseProjection) {
    return `<div class="card analysis-reverse-card locked">
      <div><span class="analysis-card-eyebrow">Standard Exclusive</span><h4>안정권까지 도달하려면 최소 몇점?</h4><p>최소 노력 대비 도달 성적은 Standard 이상에서 확인할 수 있어요.</p></div>
      <button type="button" class="btn btn-secondary mini" data-action="goto" data-target="proIntro">Standard 기능 보기</button>
    </div>`;
  }
  if (!analysisSimRows.length || backtraceStatus === 'loading' || backtraceStatus === 'idle') {
    return `<div class="card analysis-reverse-card"><span class="analysis-card-eyebrow">역산 대기</span><h4>시뮬레이션 결과를 불러오는 중</h4><p>과목별 상승 효율이 준비되면 최소 조합을 계산합니다.</p></div>`;
  }
  if (backtraceStatus === 'error' || backtraceStatus === 'empty' || !backtrace) {
    return `<div class="card analysis-reverse-card"><span class="analysis-card-eyebrow">역산 결과</span><h4>조합을 계산하지 못했습니다</h4><p>${escapeHtml(backtraceError || '현재 성적과 목표 대학 조건에서 도달 가능한 조합이 없습니다.')}</p></div>`;
  }
  const planItems = backtrace.items.map(escapeHtml);
  const expectedText = backtrace?.reachable && Number.isFinite(backtrace.expectedUiScore)
    ? `${Math.round(backtrace.expectedUiScore)}점 도달`
    : backtrace?.error
      ? '추가 성적 입력 필요'
      : '계산 대기';
  const totalRawText = backtrace?.reachable
    ? `총 +${backtrace.minTotalRaw}점`
    : currentScore >= 100
      ? '이미 합격권'
      : '도달 조합 없음';
  const lead = backtrace?.reachable
    ? `가장 적은 원점수 상승으로 합격권에 닿는 조합입니다.`
    : backtrace?.error || '단일 과목 +1점으로 변화가 작을 때는 여러 과목 조합을 함께 봅니다.';
  return `<div class="card analysis-reverse-card">
    <div class="analysis-reverse-head"><span class="analysis-card-eyebrow">Standard Exclusive</span><h4>안정권까지 도달하려면 최소 몇점?</h4><p>${lead}</p></div>
    <div class="analysis-reverse-plan">
      <div><span>추천 조합</span><b>${planItems.join(' / ') || '계산 대기'}</b></div>
      <div><span>필요 원점수</span><b>${totalRawText}</b></div>
      <div><span>예상 도달</span><b>${expectedText}</b></div>
    </div>
  </div>`;
}

export function renderUnifiedAnalysis(ctx) {
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
    scores = {},
  } = ctx;
  const scoreView = analysisScoreView || { pending: false, hasScore: true, score: Number(analysisSelected.score || 0) };
  const presentation = buildAnalysisPresentation({
    rows: analysisSimRows,
    selectedSubject: analysisHighlightedSubject,
    recommendedIndex: analysisSimRecommendedIndex,
    scoreView,
    fallbackScore: analysisSelected.score
  });
  const {
    sortedRows,
    selectedRow,
    bestRow,
    currentScore,
    afterScore,
    currentPct,
    afterPct,
    previewLeftPct,
    previewWidthPct,
    hasPreview,
    gapToPass
  } = presentation;
  const activeSubject = selectedRow?.subject || '';
  const gapToPassText = gapToPass ? `+${formatPoint(gapToPass)}점` : '도달';
  const currentScoreText = scoreView.pending ? '계산 중' : scoreView.hasScore ? `${formatPoint(currentScore)}점` : '성적 필요';
  const maxEffectText = bestRow && scoreView.hasScore ? bestRow.gain : '—';
  const bestSubjectChip = bestRow && scoreView.hasScore ? `${escapeHtml(bestRow.subject)} ${escapeHtml(bestRow.gain)}` : '효과 대기';
  const selectedEffectText = selectedRow && scoreView.hasScore
    ? `${escapeHtml(selectedRow.subject)} 원점수 +1 적용 시 ${formatPoint(currentScore)}점 → ${formatPoint(afterScore)}점`
    : '과목을 선택하면 상승 후 환산점수를 함께 보여드려요.';
  const passPct = 40;
  const safePct = 60;
  return `
    <div class="analysis-unified">
      <div class="card analysis-result-card">
        <div class="analysis-result-head">
          <label><span>희망 대학</span><select class="analysis-target-select planner-input" data-field="analysisTargetMajor">${renderTargetOptions(analysisMajorOptions, normalizedTargetMajor)}</select></label>
          <label><span>시험 기준</span><select class="analysis-exam-select planner-input" data-field="scoreExamType">${renderExamOptions(scoreExamType)}</select></label>
        </div>
        <div class="analysis-result-overview">
          <div><span>현재 환산점수</span><strong>${escapeHtml(currentScoreText)}</strong></div>
          <em class="analysis-status-pill ${scoreTierClass(currentScore)}">${escapeHtml(analysisStatus || '분석 결과')}</em>
        </div>
        <div class="analysis-gap-grid">
          <div><span>합격컷까지</span><b>${gapToPassText}</b></div>
          <div><span>+원점수 1점 최대 효과</span><b>${maxEffectText}</b></div>
        </div>
        <div class="analysis-main-gauge-wrap ${scoreTierClass(currentScore)}">
          <div class="analysis-main-gauge-top"><span>${escapeHtml(currentScoreText)}</span></div>
          <div class="analysis-main-gauge" aria-label="환산점수 게이지">
            <i class="analysis-main-gauge-fill" style="width:${currentPct}%"></i>
            ${hasPreview ? `<i class="analysis-main-gauge-preview-fill" style="left:${previewLeftPct}%;width:${previewWidthPct}%"><em></em><em></em></i><span class="analysis-main-gauge-preview-label" style="left:${afterPct}%">+1 후 ${formatPoint(afterScore)}점</span>` : ''}
            <span class="analysis-main-gauge-pin" style="left:${currentPct}%"><i></i></span>
            <span class="analysis-main-gauge-marker pass" style="left:${passPct}%"></span>
            <span class="analysis-main-gauge-marker safe" style="left:${safePct}%"></span>
          </div>
          <div class="analysis-main-gauge-scale"><span class="zero">0</span><span class="pass" style="left:${passPct}%">합격 100</span><span class="safe" style="left:${safePct}%">안정 150</span><span class="max">250</span></div>
          <p class="analysis-main-gauge-caption">${selectedEffectText}</p>
        </div>
      </div>

      <div class="card analysis-boost-card">
        <div class="analysis-section-head"><div><span class="analysis-card-eyebrow">원점수 +1 효율</span><h4>한 점을 어디에 투자할까요?</h4><p>${bestRow ? `${escapeHtml(bestRow.subject)} 1점이 환산점수에 가장 크게 반영돼요.` : '성적 분석이 끝나면 과목별 효율을 비교해드려요.'}</p></div><b>${bestSubjectChip}</b></div>
        ${renderSimulationTable({ rows: sortedRows, selectedSubject: activeSubject })}
      </div>

      ${renderReverseProjectionCard({ analysisSimRows, canUseReverseProjection, currentScore, backtraceStatus: analysisBacktraceStatus, backtracePlan: analysisBacktracePlan, backtraceError: analysisBacktraceError })}
      ${renderCurrentScoreSummary(scores)}
    </div>
  `;
}

export function renderAddUniversityScreen(ctx) {
  const {
    analysisRecommended = [],
    analysisSearchList = [],
    analysisSearchTerm = '',
    analysisTargetList = [],
    universitySelectedName = '',
    universityRecommendationStatus = 'idle',
    universityRecommendationError = '',
    appbar,
    layout
  } = ctx;

  return layout(
    appbar('대학 추가', true) + `<div class="add-univ-page">
        <div class="card add-univ-hero">
          <p class="analysis-title">희망 대학을 추가해보세요</p>
          <p class="sub">현재 성적과 목표를 기준으로 대학을 추천하거나 직접 검색할 수 있어요.</p>
        </div>
        <div class="card add-univ-section">
          <div class="add-univ-head"><div><h4>현재 성적 기준 추천</h4><p class="sub">웹과 동일한 분석 로직으로 다시 계산합니다.</p></div><button type="button" class="btn btn-secondary mini" data-action="refreshUniversityRecommendations" ${universityRecommendationStatus === 'loading' ? 'disabled' : ''}>${universityRecommendationStatus === 'loading' ? '추천 중' : '다시 추천'}</button></div>
          <div class="add-univ-grid">
            ${analysisRecommended.map((name) => renderAddUniversityCard({ analysisTargetList, name })).join('') || `<p class="add-univ-empty">${escapeHtml(universityRecommendationError || '추천 결과를 준비하고 있어요.')}</p>`}
          </div>
        </div>
        <div class="card add-univ-section">
          <div class="add-univ-head"><div>${universitySelectedName ? `<button type="button" class="add-univ-back" data-action="backToUniversityList">대학 다시 선택</button><h4>${escapeHtml(universitySelectedName)} 학과 선택</h4>` : '<h4>대학 선택</h4><p class="sub">대학을 먼저 고르면 해당 학과만 보여드려요.</p>'}</div><span class="badge">${universitySelectedName ? '2 / 2' : '1 / 2'}</span></div>
          <div class="analysis-search-inline"><input class="planner-input add-univ-search" data-field="analysisSearchTerm" value="${escapeHtml(analysisSearchTerm)}" placeholder="${universitySelectedName ? '학과명 검색' : '대학명 검색'}"/><button type="button" class="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
          <div class="add-univ-results">
            ${analysisSearchList.map((name) => universitySelectedName
              ? renderSearchRow({ analysisTargetList, name })
              : `<button type="button" class="add-univ-university-row" data-action="selectUniversityForMajor" data-university-name="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><em>학과 보기</em></button>`).join('') || '<p class="add-univ-empty">검색 결과가 없습니다.</p>'}
          </div>
        </div>
      </div>`,
    true
  );
}

export function renderAnalysisScreen(ctx) {
  const {
    analysisApiStatus = 'idle',
    analysisApiError = '',
    isAnalyzing = false,
    layout
  } = ctx;
  const loadingPanel = isAnalyzing
    ? '<div class="analysis-loading-stage"><div class="analysis-loading-panel"><span class="analysis-loading-orbit"><i></i><i></i><i></i></span><div><span>AI 분석 진행 중</span><b>목표 대학 기준 환산점수를 계산하고 있어요</b><p>현재 점수와 과목별 원점수 1점 효과를 확인합니다.</p></div></div></div>'
    : '';
  const stalePanel = analysisApiStatus === 'stale'
    ? `<div class="analysis-stale-note"><i aria-hidden="true"></i><div><b>이전 분석 결과를 먼저 보여드리고 있어요</b><span>${escapeHtml(analysisApiError || '새 기준으로 계산이 끝나면 결과가 자동으로 갱신됩니다.')}</span></div></div>`
    : '';
  const errorPanel = analysisApiError && ['error', 'empty'].includes(analysisApiStatus)
    ? `<div class="analysis-stale-note error"><i aria-hidden="true"></i><div><b>분석 결과를 불러오지 못했습니다</b><span>${escapeHtml(analysisApiError)}</span></div></div>`
    : '';
  const contentStage = `<div class="analysis-content-stage">
      <header class="analysis-context-head"><div><span>AI 성적 분석</span><h3>분석</h3><p>환산점수와 과목별 효율을 한눈에 확인하세요.</p></div><i aria-hidden="true"><b></b><b></b><b></b></i></header>
      ${stalePanel}
      ${errorPanel}
      ${renderUnifiedAnalysis(ctx)}
    </div>`;

  return layout(
    `<section class="analysis-v2 ${isAnalyzing ? 'loading' : 'ready'}">
        ${loadingPanel}
        ${isAnalyzing ? '' : contentStage}
        ${renderAnalysisSearchModal(ctx)}
      </section>`,
    true
  );
}

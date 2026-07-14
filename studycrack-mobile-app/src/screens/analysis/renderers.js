import { EXAM_OPTIONS } from '../../constants/options.js';

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

function clampScore(value, max = 250) {
  return Math.max(0, Math.min(max, Number(value) || 0));
}

function selectedBoostRow(rows = [], selectedSubject = '', recommendedIndex = -1) {
  if (!rows.length) return null;
  const bySubject = rows.find((row) => row.subject === selectedSubject);
  if (bySubject) return bySubject;
  const best = [...rows].sort((a, b) => Number(b.gainNum || 0) - Number(a.gainNum || 0))[0];
  if (best) return best;
  if (recommendedIndex >= 0 && rows[recommendedIndex]) return rows[recommendedIndex];
  return rows[0];
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

function sortedSimulationRows(rows = []) {
  const maxGain = Math.max(...rows.map((row) => Number(row.gainNum || 0)), 0);
  return [...rows]
    .map((row) => ({ ...row, isBest: maxGain > 0 && Number(row.gainNum || 0) === maxGain }))
    .sort((a, b) => {
      const gainDelta = Number(b.gainNum || 0) - Number(a.gainNum || 0);
      if (gainDelta !== 0) return gainDelta;
      return Number(a.idx || 0) - Number(b.idx || 0);
    });
}

function renderSimulationTable({ rows = [], selectedSubject = '', canUseScoreSimulation = false }) {
  if (!canUseScoreSimulation) {
    return `<div class="analysis-boost-locked"><b>Basic 이상에서 과목별 +1점 시뮬레이션이 열려요</b><button type="button" class="btn btn-primary mini" data-action="goto" data-target="proIntro">플랜 보기</button></div>`;
  }
  if (!rows.length) {
    return '<div class="analysis-boost-empty">시뮬레이션 결과를 불러오면 과목별 상승 효율이 표시됩니다.</div>';
  }
  const sortedRows = sortedSimulationRows(rows);
  const defaultSubject = sortedRows[0]?.subject || '';
  const activeSubject = selectedSubject || defaultSubject;
  return `<div class="analysis-sim-table" role="table" aria-label="과목별 1점 상승 효과">
    <div class="analysis-sim-table-head" role="row"><span>과목</span><span>+1점 효과</span><span>판정</span></div>
    ${sortedRows.map((row) => {
    const active = activeSubject === row.subject;
    const status = simulationStatusText(row, row.isBest);
    return `<button type="button" class="analysis-sim-row ${row.isBest ? 'best' : ''} ${active ? 'active' : ''} ${row.isEvaporation ? 'is-flat' : ''}" data-action="highlightSimSubject" data-sim-subject="${escapeHtml(row.subject)}" role="row">
      <span class="analysis-sim-subject" role="cell"><b>${escapeHtml(row.subject)}</b>${row.isBest ? '<em>최고 반영</em>' : ''}</span>
      <span class="analysis-sim-effect" role="cell">${escapeHtml(row.gain)}</span>
      <span class="analysis-sim-status" role="cell"><b>${escapeHtml(status)}</b><small>${escapeHtml(row.isEvaporation ? rawNeededText(row) || '현재 +1점으로는 변화 없음' : row.desc)}</small></span>
    </button>`;
  }).join('')}</div>`;
}

function firstSimulationMeta(rows = []) {
  return rows.find((row) => row.backtracePlan || row.needsBacktrace) || rows[0] || null;
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
  simMeta = null
}) {
  const backtrace = summarizeBacktracePlan(simMeta?.backtracePlan);
  if (!canUseReverseProjection) {
    return `<div class="card analysis-reverse-card locked">
      <div><span class="analysis-card-eyebrow">Standard Exclusive</span><h4>안정권까지 도달하려면 최소 몇점?</h4><p>최소 노력 대비 도달 성적은 Standard 이상에서 확인할 수 있어요.</p></div>
      <button type="button" class="btn btn-secondary mini" data-action="goto" data-target="proIntro">Standard 기능 보기</button>
    </div>`;
  }
  if (!analysisSimRows.length) {
    return `<div class="card analysis-reverse-card"><span class="analysis-card-eyebrow">역산 대기</span><h4>시뮬레이션 결과를 불러오는 중</h4><p>과목별 상승 효율이 준비되면 최소 조합을 계산합니다.</p></div>`;
  }
  const ranked = [...analysisSimRows].sort((a, b) => Number(b.gainNum || 0) - Number(a.gainNum || 0)).slice(0, 3);
  const fallbackItems = ranked.map((row, index) => `${escapeHtml(row.subject)} +${index === 0 ? 4 : index === 1 ? 3 : 1}`);
  const planItems = backtrace?.items?.length ? backtrace.items.map(escapeHtml) : fallbackItems;
  const expectedText = backtrace?.reachable && Number.isFinite(backtrace.expectedUiScore)
    ? `${Math.round(backtrace.expectedUiScore)}점 도달`
    : backtrace?.error
      ? '추가 성적 입력 필요'
      : '계산 대기';
  const totalRawText = backtrace?.reachable
    ? `총 +${backtrace.minTotalRaw}점`
    : currentScore >= 100
      ? '이미 합격권'
      : '최소 조합 계산 중';
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
    analysisGaugeColor = '#4c79ee',
    analysisHighlightedSubject = '',
    analysisSelected = {},
    analysisSimRecommendedIndex = -1,
    analysisSimRows = [],
    analysisScoreView = null,
    canAccessStandard = false,
    canUseReverseProjection = canAccessStandard,
    canUseScoreSimulation = canAccessStandard,
    scoreExamType = '',
    scoreTierClass = defaultScoreTierClass,
  } = ctx;
  const scoreView = analysisScoreView || { pending: false, hasScore: true, score: Number(analysisSelected.score || 0) };
  const simMeta = firstSimulationMeta(analysisSimRows);
  const serverBaseScore = Number(simMeta?.baseUiScore);
  const rawBaseScore = Number.isFinite(serverBaseScore) ? serverBaseScore : Number(scoreView.score ?? analysisSelected.score ?? 0);
  const currentScore = clampScore(rawBaseScore);
  const bestBoost = canUseScoreSimulation ? selectedBoostRow(analysisSimRows, '', analysisSimRecommendedIndex) : null;
  const currentPct = Math.min((currentScore / 250) * 100, 100);
  const gapToPass = Math.max(0, 100 - currentScore);
  const gapToPassText = gapToPass ? `+${formatPoint(gapToPass)}점` : '도달';
  const currentScoreText = scoreView.pending ? '계산 중' : scoreView.hasScore ? `${formatPoint(currentScore)}점` : '현재 위치';
  const maxEffectText = bestBoost && scoreView.hasScore ? bestBoost.gain : '—';
  const bestSubjectChip = bestBoost && scoreView.hasScore ? `${escapeHtml(bestBoost.subject)} ${escapeHtml(bestBoost.gain)}` : '효과 대기';
  const passPct = 40;
  const safePct = 60;
  return `
    <div class="analysis-unified">
      <div class="card analysis-result-card">
        <div class="analysis-result-head">
          <div>
            <h4>희망대학 분석</h4>
            <p>대학 분석 결과가 같은 시험 기준으로 계산됩니다.</p>
          </div>
          <select class="analysis-exam-select planner-input" data-field="scoreExamType">${renderExamOptions(scoreExamType)}</select>
        </div>
        <div class="analysis-gap-grid">
          <div><span>합격컷까지</span><b>${gapToPassText}</b></div>
          <div><span>+원점수 1점 최대 효과</span><b>${maxEffectText}</b></div>
        </div>
        <div class="analysis-main-gauge-wrap ${scoreTierClass(currentScore)}">
          <div class="analysis-main-gauge-top"><span>${escapeHtml(currentScoreText)}</span></div>
          <div class="analysis-main-gauge" aria-label="환산점수 게이지">
            <i class="analysis-main-gauge-fill" style="width:${currentPct}%;background:${analysisGaugeColor}"></i>
            <span class="analysis-main-gauge-pin" style="left:${currentPct}%"><i></i></span>
            <span class="analysis-main-gauge-marker pass" style="left:${passPct}%"><i></i></span>
            <span class="analysis-main-gauge-marker safe" style="left:${safePct}%"><i></i></span>
          </div>
          <div class="analysis-main-gauge-scale"><span class="zero">0</span><span class="fifty" style="left:20%">50</span><span class="pass" style="left:${passPct}%">합격 100</span><span class="safe" style="left:${safePct}%">안정 150</span><span class="max">250</span></div>
        </div>
      </div>

      <div class="card analysis-boost-card">
        <div class="analysis-section-head"><div><span class="analysis-card-eyebrow">점수 상승 시뮬레이션</span><h4>과목 1점이 어디에 가장 크게 반영될까요?</h4></div><b>${bestSubjectChip}</b></div>
        ${renderSimulationTable({ rows: analysisSimRows, selectedSubject: analysisHighlightedSubject, canUseScoreSimulation })}
      </div>

      ${renderReverseProjectionCard({ analysisSimRows, canUseReverseProjection, currentScore, simMeta })}
    </div>
  `;
}

export function renderAddUniversityScreen(ctx) {
  const {
    analysisRecommended = [],
    analysisSearchList = [],
    analysisSearchTerm = '',
    analysisTargetList = [],
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
          <div class="add-univ-head"><h4>추천 대학</h4><span class="badge">추천</span></div>
          <div class="add-univ-grid">
            ${analysisRecommended.map((name) => renderAddUniversityCard({ analysisTargetList, name })).join('')}
          </div>
        </div>
        <div class="card add-univ-section">
          <div class="add-univ-head"><h4>대학 검색</h4></div>
          <div class="analysis-search-inline"><input class="planner-input add-univ-search" data-field="analysisSearchTerm" value="${analysisSearchTerm}" placeholder="대학명 또는 학과명을 검색하세요"/><button type="button" class="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
          <div class="add-univ-results">
            ${analysisSearchList.map((name) => renderSearchRow({ analysisTargetList, name })).join('') || '<p class="sub">검색 결과가 없습니다.</p>'}
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
    ? '<div class="analysis-loading-stage"><div class="analysis-loading-panel"><span class="analysis-loading-orbit"><i></i><i></i><i></i></span><div><span>분석 중</span><b>선택한 성적과 목표대학을 다시 계산하고 있어요</b><p>잠시 뒤 지원 가능성과 추천 전략이 갱신됩니다.</p></div></div></div>'
    : '';
  const stalePanel = analysisApiStatus === 'stale'
    ? `<div class="analysis-stale-note"><i aria-hidden="true"></i><div><b>이전 분석 결과를 먼저 보여드리고 있어요</b><span>${escapeHtml(analysisApiError || '새 기준으로 계산이 끝나면 결과가 자동으로 갱신됩니다.')}</span></div></div>`
    : '';
  const errorPanel = analysisApiError && ['error', 'empty'].includes(analysisApiStatus)
    ? `<div class="analysis-stale-note error"><i aria-hidden="true"></i><div><b>분석 결과를 불러오지 못했습니다</b><span>${escapeHtml(analysisApiError)}</span></div></div>`
    : '';

  return layout(
    `<section class="analysis-v2 ${isAnalyzing ? 'loading' : ''}">
        <div class="card analysis-v2-head">
          <div class="top-card-head">
            <div><h3>분석</h3><p>결과를 보고, 전략을 이해하고, 바로 실행으로 연결하세요.</p></div>
            <span class="top-infographic top-infographic-analysis" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
        </div>

        ${loadingPanel}
        ${stalePanel}
        ${errorPanel}

        ${isAnalyzing ? '' : renderUnifiedAnalysis(ctx)}

        ${renderAnalysisSearchModal(ctx)}
      </section>`,
    true
  );
}

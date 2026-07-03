function defaultScoreTierClass(score) {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

function examBasisLabel(scoreExamType = '') {
  const label = String(scoreExamType || '').trim();
  return label ? `${label} 기준` : '선택 시험 기준';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  if (recommendedIndex >= 0 && rows[recommendedIndex]) return rows[recommendedIndex];
  return rows[0];
}

function renderBoostChips({ rows = [], selectedSubject = '', recommendedIndex = -1, canUseScoreSimulation = false }) {
  if (!canUseScoreSimulation) {
    return `<div class="analysis-boost-locked"><b>Basic 이상에서 과목별 +1점 시뮬레이션이 열려요</b><button type="button" class="btn btn-primary mini" data-action="goto" data-target="proIntro">플랜 보기</button></div>`;
  }
  if (!rows.length) {
    return '<div class="analysis-boost-empty">시뮬레이션 결과를 불러오면 과목별 상승 효율이 표시됩니다.</div>';
  }
  const activeRecommendedIndex = recommendedIndex >= 0 ? recommendedIndex : 0;
  return `<div class="analysis-boost-chips" role="list">${rows.map((row, index) => {
    const active = (selectedSubject && selectedSubject === row.subject) || (!selectedSubject && index === activeRecommendedIndex);
    return `<button type="button" class="analysis-boost-chip ${active ? 'active' : ''}" data-action="highlightSimSubject" data-sim-subject="${escapeHtml(row.subject)}"><span>${escapeHtml(row.subject)}</span><b>${escapeHtml(row.gain)}</b>${index === activeRecommendedIndex ? '<em>추천</em>' : ''}</button>`;
  }).join('')}</div>`;
}

function renderReverseProjectionCard({
  analysisSimRows = [],
  canUseReverseProjection = false,
  currentScore = 0,
  projectedScore = 0,
  selectedBoost = null
}) {
  const safeGap = Math.max(0, 150 - currentScore);
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
  const weeks = safeGap <= 0 ? '이미 안정권' : `약 ${Math.max(4, Math.ceil(safeGap / 2))}~${Math.max(6, Math.ceil(safeGap / 2) + 2)}주`;
  const lead = safeGap <= 0
    ? '현재 점수로도 안정권 기준을 넘고 있어요.'
    : `안정권까지 ${safeGap}점 남았습니다.`;
  return `<div class="card analysis-reverse-card">
    <div class="analysis-reverse-head"><span class="analysis-card-eyebrow">Standard Exclusive</span><h4>안정권까지 도달하려면 최소 몇점?</h4><p>${lead}</p></div>
    <div class="analysis-reverse-plan">
      <div><span>추천 조합</span><b>${ranked.map((row, index) => `${escapeHtml(row.subject)} +${index === 0 ? 4 : index === 1 ? 3 : 1}`).join(' / ')}</b></div>
      <div><span>예상 도달</span><b>${weeks}</b></div>
      <div><span>현재 선택 반영</span><b>${selectedBoost ? `${escapeHtml(selectedBoost.subject)} 반영 시 ${projectedScore}점` : `${projectedScore}점`}</b></div>
    </div>
  </div>`;
}

export function renderUnifiedAnalysis(ctx) {
  const {
    analysisGaugeColor = '#4c79ee',
    analysisHighlightedSubject = '',
    analysisMajorOptions = [],
    analysisSelected = {},
    analysisSimRecommendedIndex = -1,
    analysisSimRows = [],
    analysisScoreView = null,
    analysisStatus = '',
    analysisStatusColor = '#4c79ee',
    canAccessStandard = false,
    canUseReverseProjection = canAccessStandard,
    canUseScoreSimulation = canAccessStandard,
    normalizedTargetMajor = '',
    scoreExamType = '',
    scoreTierClass = defaultScoreTierClass,
    targetMajor = ''
  } = ctx;
  const scoreView = analysisScoreView || { pending: false, hasScore: true, score: Number(analysisSelected.score || 0) };
  const currentScore = clampScore(scoreView.score ?? analysisSelected.score);
  const selectedBoost = canUseScoreSimulation ? selectedBoostRow(analysisSimRows, analysisHighlightedSubject, analysisSimRecommendedIndex) : null;
  const boostGain = selectedBoost ? Math.max(0, Number(selectedBoost.gainNum || 0)) : 0;
  const projectedScore = clampScore(currentScore + boostGain);
  const currentPct = Math.min((currentScore / 250) * 100, 100);
  const projectedPct = Math.min((projectedScore / 250) * 100, 100);
  const projectedWidth = Math.max(0, projectedPct - currentPct);
  const gapToPass = Math.max(0, 100 - currentScore);
  const targetLabel = normalizedTargetMajor || targetMajor || '희망 대학';
  const basisLabel = examBasisLabel(scoreExamType);
  const statusText = scoreView.pending ? '분석 중' : scoreView.hasScore ? analysisStatus : '성적 필요';
  const scoreText = scoreView.pending ? '<strong class="home-score-skeleton" aria-label="분석 중"></strong>' : scoreView.hasScore ? `<strong>${currentScore}점</strong>` : '<strong>—</strong>';
  const projectedText = selectedBoost && scoreView.hasScore
    ? `${escapeHtml(selectedBoost.subject)} +1점 반영 시 ${projectedScore}점`
    : '과목을 선택하면 예상 점수가 바로 반영됩니다.';
  const statusStyle = scoreView.hasScore ? `style="color:${analysisStatusColor};border-color:${analysisStatusColor}"` : '';
  return `
    <div class="analysis-unified">
      <div class="card analysis-control-card">
        <div>
          <span class="analysis-card-eyebrow">${basisLabel}</span>
          <h4>희망대학 분석</h4>
          <p>대학을 고르면 현재 위치와 과목별 +1점 효과를 한 화면에서 봅니다.</p>
        </div>
        <button type="button" class="analysis-add-link-btn" data-action="openAnalysisSearchFromHome">대학 추가</button>
        <select class="analysis-dropdown analysis-v2-target-select" data-field="analysisTargetMajor" value="${escapeHtml(targetLabel)}">
          ${analysisMajorOptions.map((name) => `<option value="${escapeHtml(name)}" ${targetLabel === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
          <option value="__add_university__">+ 대학 추가하기</option>
        </select>
      </div>

      <div class="card analysis-result-card">
        <div class="analysis-result-main">
          <div>
            <span class="analysis-target-label">${escapeHtml(targetLabel)}</span>
            <div class="analysis-score-line">${scoreText}<em>AI 환산점수</em></div>
          </div>
          <span class="analysis-status-pill ${scoreTierClass(currentScore)}" ${statusStyle}>${escapeHtml(statusText)}</span>
        </div>
        <div class="analysis-gap-grid">
          <div><span>합격컷까지</span><b>${gapToPass ? `+${gapToPass}점` : '도달'}</b></div>
          <div><span>예상 변화</span><b>${scoreView.hasScore ? `${projectedScore}점` : '—'}</b></div>
        </div>
        <div class="analysis-range-chart" aria-label="환산점수 그래프">
          <i class="analysis-range-fill" style="width:${currentPct}%;background:${analysisGaugeColor}"></i>
          ${projectedWidth ? `<i class="analysis-range-projected" style="left:${currentPct}%;width:${projectedWidth}%"></i>` : ''}
          <span class="analysis-range-cut pass" style="left:40%"><b>합격</b></span>
          <span class="analysis-range-cut safe" style="left:60%"><b>안정</b></span>
        </div>
        <div class="analysis-range-caption"><span>0</span><span>${projectedText}</span><span>250</span></div>
      </div>

      <div class="card analysis-boost-card">
        <div class="analysis-section-head"><div><span class="analysis-card-eyebrow">점수 상승 시뮬레이션</span><h4>과목 1점이 어디에 가장 크게 반영될까요?</h4></div>${selectedBoost ? `<b>${escapeHtml(selectedBoost.subject)} ${escapeHtml(selectedBoost.gain)}</b>` : ''}</div>
        ${renderBoostChips({ rows: analysisSimRows, selectedSubject: analysisHighlightedSubject, recommendedIndex: analysisSimRecommendedIndex, canUseScoreSimulation })}
      </div>

      ${renderReverseProjectionCard({ analysisSimRows, canUseReverseProjection, currentScore, projectedScore, selectedBoost })}
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
    ? '<div class="analysis-loading-panel"><span class="analysis-loading-orbit"><i></i><i></i><i></i></span><div><span>분석 중</span><b>선택한 성적과 목표대학을 다시 계산하고 있어요</b><p>잠시 뒤 지원 가능성과 추천 전략이 갱신됩니다.</p></div></div>'
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

        ${renderUnifiedAnalysis(ctx)}

        ${renderAnalysisSearchModal(ctx)}
      </section>`,
    true
  );
}

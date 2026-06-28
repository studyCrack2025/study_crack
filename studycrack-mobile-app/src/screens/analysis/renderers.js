function defaultScoreTierClass(score) {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

function defaultScoreJourneyCard(title) {
  return `<p class="analysis-title">${title}</p>`;
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

function renderPossibleUniversityCards(ctx) {
  const {
    analysisSimulationTargets = [],
    gaugeCurrent = 0,
    gaugePassPct = 40,
    gaugeSafePct = 60,
    gaugeTarget = 0,
    scoreTierClass = defaultScoreTierClass
  } = ctx;
  const possibleUniversities = analysisSimulationTargets
    .map((item) => [item.major, Math.max(Number(item.score || 0), gaugeTarget)])
    .filter(([name]) => name)
    .slice(0, 3);

  if (!possibleUniversities.length) return '';

  return `<div class="card ob-card">
            <p class="analysis-title">성적 변화 시 가능한 대학</p>
            <div class="possible-univ-slider" data-slider-group="possible"><div class="possible-univ-track">
            ${possibleUniversities.map(([name, target]) => `<div class="possible-univ-card"><button type="button" class="card ob-card" style="margin:10px 0 0; width:100%; text-align:left;" data-action="addPossibleUniversity" data-target-major="${name}">
              <p class="analysis-title">${name}</p>
              <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${target}점</b></div></div>
              <div class="ob-gauge">
                <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${Math.min(100, (gaugeCurrent / 250) * 100)}%"></div>
                <div class="ob-gauge-target ${scoreTierClass(target)}" style="width:${Math.min(100, (target / 250) * 100)}%"></div>
                <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
                <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
              </div>
              <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
              <p class="sub"><b>현재 → 합격권 진입 구간</b></p>
            </button></div>`).join('')}</div></div><div class="possible-univ-nav"><button type="button" data-action="slidePrev">‹</button><div class="possible-univ-dots slider-indicator possible-univ-indicator possible-slider-indicator"><button data-action="slideTo" data-slide-index="0" class="active slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="1" class="slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="2" class="slider-dot possible-univ-dot possible-slider-dot"></button></div><button type="button" data-action="slideNext">›</button></div>
          </div>`;
}

export function renderSummaryMode(ctx) {
  const {
    analysisEtaStage = 3,
    analysisGaugeColor = '#4c79ee',
    analysisGaugeFill = 0,
    analysisSimRows = [],
    analysisMajorOptions = [],
    analysisSelected = {},
    canAccessStandard = false,
    canUseScoreSimulation = canAccessStandard,
    canUseReverseProjection = canAccessStandard,
    analysisStatus = '',
    analysisStatusColor = '#4c79ee',
    analysisScoreView = null,
    gaugeCurrent = 0,
    gaugeCurrentPct = 0,
    gaugePassPct = 40,
    gaugeSafePct = 60,
    gaugeTarget = 0,
    gaugeTargetPct = 0,
    normalizedTargetMajor = '',
    scoreJourneyCard = defaultScoreJourneyCard,
    scoreTierClass = defaultScoreTierClass,
    targetMajor = ''
  } = ctx;
  const score = Number(analysisSelected.score || 0);
  // 점수 출처 상태(서버 캐시). pending이면 스켈레톤, 결과없음이면 안내(홈과 동일 정책).
  const scoreView = analysisScoreView || { pending: false, hasScore: true, score };
  const remaining = Math.max(0, 150 - score);
  const location = score >= 150 ? '현재 위치: 합격 안정권 진입' : (score >= 100 ? '현재 위치: 합격권 진입 전' : '현재 위치: 합격권까지 거리 있음');
  const hasSimulation = canUseScoreSimulation && analysisSimRows.length > 0;
  const eta = !canUseReverseProjection
    ? '<div class="analysis-eta-locked"><span class="eyebrow">Standard 이상</span><b>역산 기반 도달 성적은 상위 플랜에서 열려요</b><p>Basic에서는 점수 상승 시뮬레이션까지 확인할 수 있습니다.</p><button type="button" class="btn btn-secondary mini" data-action="goto" data-target="proIntro">Standard 기능 보기</button></div>'
    : analysisEtaStage === 1
    ? '<div class="analysis-eta-loading"><span class="skeleton"></span><p>도달 성적 계산 중입니다...</p></div>'
    : analysisEtaStage === 2
      ? '<div class="analysis-eta-loading"><span class="skeleton thin"></span><p>도달 시간을 예상 중입니다...</p></div>'
      : '<button class="analysis-v2-eta-card" data-action="startStandard"><span class="eyebrow">현재 학습분석 기반</span><b>Standard 이용 시 평균 2개월 내 도달 예상</b><p>매주 플래너 피드백과 학습 방향 관리를 기준으로 계산했어요</p></button>';

  return `
          <div class="card analysis-v2-summary">
            <div class="analysis-v2-summary-control">
              <div><p class="analysis-title">희망 대학 분석</p><span>선택한 대학 기준으로 핵심 결과를 계산합니다.</span></div>
              <button class="analysis-add-link-btn" data-action="openAnalysisSearchFromHome">대학 추가</button>
            </div>
            <select class="analysis-dropdown analysis-v2-target-select" data-field="analysisTargetMajor" value="${normalizedTargetMajor}">
              ${analysisMajorOptions.map((name) => `<option value="${name}" ${normalizedTargetMajor === name ? 'selected' : ''}>${name}</option>`).join('')}
              <option value="__add_university__">+ 대학 추가하기</option>
            </select>
            <div class="analysis-v2-summary-top">
              <div>
                <p class="analysis-v2-univ">${normalizedTargetMajor || targetMajor}</p>
                <p class="analysis-v2-label">합격 가능성 진단</p>
              </div>
              <div class="analysis-v2-score-wrap">
                ${scoreView.pending
                  ? '<strong class="home-score-skeleton" aria-label="분석 중"></strong><small>분석 중</small>'
                  : scoreView.hasScore
                    ? `<span class="analysis-v2-verdict ${scoreTierClass(score)}" style="color:${analysisStatusColor};border-color:${analysisStatusColor}">${analysisStatus}</span><strong>${score}점</strong><small>AI 점수</small>`
                    : '<strong>—</strong><small>성적 입력 필요</small>'}
              </div>
            </div>
            <div class="analysis-v2-infographic"><span class="icon">📍</span><div><b>${location}</b><p>목표까지 ${remaining > 0 ? `-${remaining}점` : '달성 완료'}</p></div></div>
            <div class="analysis-v2-gauge"><i class="${scoreTierClass(score)}" style="width:${analysisGaugeFill}%;background:${analysisGaugeColor}"></i></div>
            <div class="analysis-v2-gauge-meta"><span>0</span><span>합격컷 100점</span><span>안정컷 150점</span><span>MAX 250점</span></div>
          </div>

          <div class="card analysis-v2-before-after">
            ${scoreJourneyCard('최소 노력 대비 합격 도달 성적')}
            <div class="analysis-v2-eta ${analysisEtaStage < 3 ? 'loading' : ''}">
              ${eta}
            </div>
          </div>
          ${hasSimulation ? `<div class="card analysis-v2-gauge-change">
            <p class="analysis-title">합격 가능성 변화</p>
            <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${gaugeTarget}점</b></div></div>
            <div class="ob-gauge">
              <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${gaugeCurrentPct}%"></div>
              <div class="ob-gauge-target ${scoreTierClass(gaugeTarget)}" style="width:${gaugeTargetPct}%"></div>
              <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
              <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
            </div>
            <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
            <p class="analysis-sub"><b>현재 → 합격권 진입 구간</b></p><p class="analysis-conv-line">이 속도라면 목표까지 약 2~3개월이 필요합니다</p><p class="analysis-conv-line">방향이 틀리면 점수 상승 효율이 크게 떨어질 수 있습니다</p>
          </div>
          ${renderPossibleUniversityCards(ctx)}` : ''}

          <div class="card analysis-v2-cta sticky"><p class="analysis-cta-lead">지금 시작하면 평균 2개월 단축됩니다</p><button class="btn analysis-convert-btn" data-action="startStandard">합격까지 필요한 전략 보기</button><p class="analysis-cta-sub">MBTI 결과는 앱 안에서 확인할 수 있어요</p></div>
        `;
}

// 대학별 합격가능성 세로 게이지 행. 절대배치 막대 차트(가로 잘림·줄바꿈 문제)를 대체.
// 0~250 가로 게이지에 현재 점수 채움 + 합격컷(100)/안정컷(150) 마커 + (선택 시) +상승분 델타.
function renderSimulationGauge(ctx, item) {
  const {
    analysisBarProjectionTarget = '',
    analysisRecommendedRow = null,
    analysisSimMax = 0,
    targetMajor = ''
  } = ctx;
  const { label, score, major: full } = item;
  const maxScore = 250;
  const pct = Math.max(0, Math.min((score / maxScore) * 100, 100));
  const tier = score <= 100 ? 'low' : score <= 150 ? 'mid' : 'high';
  const statusLabel = score >= 150 ? '안정권' : score >= 100 ? '합격권' : '도전';
  const isActive = analysisBarProjectionTarget === full || targetMajor === full;
  const projectionGain = analysisBarProjectionTarget === full ? Math.max(0, Math.min(analysisSimMax, maxScore - score)) : 0;
  const projPct = projectionGain > 0 ? Math.max(0, Math.min(((score + projectionGain) / maxScore) * 100, 100)) : pct;
  const projWidth = Math.max(0, projPct - pct);
  const recommendedText = projectionGain > 0 && analysisRecommendedRow
    ? `${analysisRecommendedRow.subject} +1점 시 +${Math.round(analysisRecommendedRow.gainNum)}점`
    : '';
  const projFill = projWidth > 0 ? `<i class="analysis-sim-gauge-proj" style="left:${pct}%;width:${projWidth}%"></i>` : '';
  const deltaPill = projectionGain > 0
    ? `<span class="analysis-sim-gauge-delta">+${Math.round(projectionGain)}점${recommendedText ? ` · ${recommendedText}` : ''}</span>`
    : '';
  return `<button type="button" class="analysis-sim-gauge-row tier-${tier} ${isActive ? 'active' : ''}" data-action="simulateBarGain" data-target-major="${full}" data-base-score="${score}">
    <div class="analysis-sim-gauge-top"><b class="analysis-sim-gauge-univ">${label}</b><span class="analysis-sim-gauge-score">${score}<small>점</small></span></div>
    <div class="analysis-sim-gauge-track">
      <i class="analysis-sim-gauge-fill" style="width:${pct}%"></i>
      ${projFill}
      <span class="analysis-sim-gauge-cut pass" style="left:40%"></span>
      <span class="analysis-sim-gauge-cut safe" style="left:60%"></span>
    </div>
    <div class="analysis-sim-gauge-meta"><span class="analysis-sim-gauge-status tier-${tier}">${statusLabel}</span>${deltaPill}</div>
  </button>`;
}

export function renderSimulationMode(ctx) {
  const {
    analysisHighlightedSubject = '',
    analysisSimMax = 0,
    analysisSimRecommendedIndex = -1,
    analysisSimRows = [],
    analysisSimulationTargets = [],
    canAccessStandard = false,
    canUseScoreSimulation = canAccessStandard
  } = ctx;
  const basisLabel = examBasisLabel(ctx.scoreExamType);

  if (!canUseScoreSimulation) {
    return `
          <div class="card analysis-v2-locked">
            <p class="analysis-title">점수 상승 시뮬레이션</p>
            <p class="sub">Basic 이상 플랜에서 과목별 상승 효율과 점수 변화를 확인할 수 있어요.</p>
            <button type="button" class="btn btn-primary" data-action="goto" data-target="proIntro">플랜 보기</button>
          </div>
        `;
  }

  if (!analysisSimRows.length) {
    return `
          <div class="card analysis-v2-locked">
            <p class="analysis-title">점수 상승 시뮬레이션</p>
            <p class="sub">선택한 시험과 목표 대학 기준의 시뮬레이션 결과를 불러오면 표시됩니다.</p>
          </div>
        `;
  }

  return `
          <div class="card analysis-sim-chart">
            <div class="analysis-chart-head"><h3>합격 가능성 위치 (0~250점)</h3><span class="analysis-chart-badge">${basisLabel}</span></div>
            <div class="analysis-sim-legend"><span class="pass">합격컷 100</span><span class="safe">안정컷 150</span><span class="max">만점 250</span></div>
            <div class="analysis-sim-gauge-list">
              ${analysisSimulationTargets.map((item) => renderSimulationGauge(ctx, item)).join('')}
            </div>
            <p class="analysis-sim-chart-foot">대학을 탭하면 추천 과목 1점 상승 시 예상 위치를 보여줘요.</p>
          </div>

          <div class="card analysis-v2-sim">
            <p class="analysis-title">+1점 상승 시 기대 효율</p>
            ${analysisSimRows.map(({ subject, gain, desc, gainNum }, index) => {
              const ratio = Math.max((gainNum / Math.max(analysisSimMax, 1)) * 100, 8);
              const recommended = index === analysisSimRecommendedIndex;
              const selected = analysisHighlightedSubject === subject;
              return `<button class="analysis-v2-sim-item ${recommended ? 'recommended' : ''} ${selected ? 'focus' : ''}" data-action="highlightSimSubject" data-sim-subject="${subject}"><div class="left"><p><strong>${subject} (+1점)</strong>${recommended ? '<span class="badge">추천</span>' : ''}</p><small>${desc}</small><span class="mini-track"><i style="width:${ratio}%"></i></span>${selected ? `<span class="sim-detail">+1점 상승 시 AI 점수 ${gain} / 합격 가능성 상승 기대</span>` : ''}</div><b>${gain}</b></button>`;
            }).join('')}
            <p class="analysis-v2-sim-foot">탭해서 과목별 상승 효율을 빠르게 비교해보세요.</p>
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
    analysisMode = 'summary',
    canAccessStandard = false,
    canUseScoreSimulation = canAccessStandard,
    analysisApiStatus = 'idle',
    analysisApiError = '',
    isAnalyzing = false,
    layout
  } = ctx;
  const effectiveMode = canUseScoreSimulation ? analysisMode : 'summary';
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

        <div class="analysis-v2-tabs">
          <button class="analysis-v2-tab ${effectiveMode === 'summary' ? 'active' : ''}" data-action="setAnalysisMode" data-analysis-mode="summary">전략 요약</button>
          <button class="analysis-v2-tab ${effectiveMode === 'simulation' ? 'active' : ''} ${canUseScoreSimulation ? '' : 'locked'}" data-action="${canUseScoreSimulation ? 'setAnalysisMode' : 'goto'}" ${canUseScoreSimulation ? '' : 'data-target="proIntro"'} data-analysis-mode="simulation">점수 상승 시뮬레이션</button>
        </div>

        ${effectiveMode === 'summary' ? renderSummaryMode(ctx) : renderSimulationMode(ctx)}

        ${renderAnalysisSearchModal(ctx)}
      </section>`,
    true
  );
}

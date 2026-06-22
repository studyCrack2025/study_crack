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
    analysisStatus = '',
    analysisStatusColor = '#4c79ee',
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
  const remaining = Math.max(0, 150 - score);
  const location = score >= 150 ? '현재 위치: 합격 안정권 진입' : (score >= 100 ? '현재 위치: 합격권 진입 전' : '현재 위치: 합격권까지 거리 있음');
  const hasSimulation = canAccessStandard && analysisSimRows.length > 0;
  const eta = analysisEtaStage === 1
    ? '<div class="analysis-eta-loading"><span class="skeleton"></span><p>도달 성적 계산 중입니다...</p></div>'
    : analysisEtaStage === 2
      ? '<div class="analysis-eta-loading"><span class="skeleton thin"></span><p>도달 시간을 예상 중입니다...</p></div>'
      : '<button class="analysis-v2-eta-card" data-action="startStandard"><span class="eyebrow">현재 학습분석 기반</span><b>Standard 이용 시 평균 2개월 내 도달 예상</b><p>매주 플래너 피드백과 학습 방향 관리를 기준으로 계산했어요</p></button>';

  return `
          <div class="card analysis-v2-targets">
            <p class="analysis-title">희망 대학 선택</p>
            <select class="analysis-dropdown" data-field="analysisTargetMajor" value="${normalizedTargetMajor}">
              ${analysisMajorOptions.map((name) => `<option value="${name}" ${normalizedTargetMajor === name ? 'selected' : ''}>${name}</option>`).join('')}
              <option value="__add_university__">+ 대학 추가하기</option>
            </select>
            <button class="analysis-add-link-btn" data-action="openAnalysisSearchFromHome">+ 대학 추가하기</button>
          </div>

          <div class="card analysis-v2-summary">
            <p class="analysis-title">핵심 결과 카드</p>
            <div class="analysis-v2-summary-top">
              <div>
                <p class="analysis-v2-univ">${targetMajor}</p>
                <p class="analysis-v2-label">합격 가능성 진단</p>
              </div>
              <div class="analysis-v2-score-wrap">
                <span class="analysis-v2-verdict ${scoreTierClass(score)}" style="color:${analysisStatusColor};border-color:${analysisStatusColor}">${analysisStatus}</span>
                <strong>${score}점</strong><small>AI 점수</small>
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

function renderSimulationBar(ctx, item) {
  const {
    analysisBarProjectionTarget = '',
    analysisRecommendedRow = null,
    analysisRecommendedSubjectScore = 0,
    analysisSimMax = 0,
    scoreTierClass = defaultScoreTierClass,
    targetMajor = ''
  } = ctx;
  const { label, score, major: full } = item;
  const maxScore = 250;
  const scoreRatio = Math.max(0, Math.min(score / maxScore, 1));
  const heightPercent = scoreRatio * 100;
  const color = score <= 100 ? '#fa8072' : score <= 150 ? '#2563eb' : '#8b5cf6';
  const shouldProject = analysisBarProjectionTarget === full;
  const projectionGain = shouldProject ? Math.max(0, Math.min(analysisSimMax, maxScore - score)) : null;
  const projectionScore = projectionGain !== null ? Math.min(maxScore, score + projectionGain) : null;
  const projectedPercent = projectionScore ? Math.max(0, Math.min(100, (projectionScore / maxScore) * 100)) : heightPercent;
  const projectionHeight = projectionScore ? Math.max(0, projectedPercent - heightPercent) : 0;
  const recommendedText = analysisRecommendedRow ? `${Math.round(analysisRecommendedSubjectScore + analysisRecommendedRow.gainNum)}점 (${analysisRecommendedRow.subject} 1점 상승 시 +${Math.round(analysisRecommendedRow.gainNum)}점)` : '';
  const projection = projectionScore ? `<span class="analysis-v2-bar-proj analysis-efficiency-pill ${shouldProject ? 'pop' : ''}" style="bottom:${Math.max(0, (100 - projectionScore / maxScore * 100))}%">${recommendedText}</span>` : '';
  const projectionBox = projectionScore && projectionHeight > 0 ? `<span class="analysis-v2-bar-proj-box" style="bottom:${heightPercent}%;height:${projectionHeight}%"></span>` : '';
  const tier = scoreTierClass(score);
  return `<button class="analysis-v2-bar-item ${targetMajor === full ? 'active' : ''}" data-action="simulateBarGain" data-target-major="${full}" data-base-score="${score}"><b class="score ${tier}">${score}</b><div class="analysis-v2-bar-wrap"><i class="analysis-v2-bar ${tier}" style="height:${heightPercent}%;background:${color}"></i>${projectionBox}${projection}</div><p>${label}</p></button>`;
}

export function renderSimulationMode(ctx) {
  const {
    analysisHighlightedSubject = '',
    analysisSimMax = 0,
    analysisSimRecommendedIndex = -1,
    analysisSimRows = [],
    analysisSimulationTargets = [],
    canAccessStandard = false
  } = ctx;
  const basisLabel = examBasisLabel(ctx.scoreExamType);

  if (!canAccessStandard) {
    return `
          <div class="card analysis-v2-locked">
            <p class="analysis-title">점수 상승 시뮬레이션</p>
            <p class="sub">Standard 이상 플랜에서 과목별 상승 효율과 도달 성적을 확인할 수 있어요.</p>
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
          <div class="analysis-v2-compare-card">
            <div class="analysis-chart-head"><h3>합격 가능성 위치 (0~250점)</h3><span class="analysis-chart-badge">${basisLabel}</span></div>
            <p class="score-simulation-chart-hint">옆으로 밀어 더 많은 대학 보기 →</p>
            <div class="score-simulation-chart-wrap"><div class="analysis-v2-chart-area">
              <div class="analysis-v2-guide-line pass"><span class="label">합격선 100</span></div>
              <div class="analysis-v2-guide-line safe"><span class="label">안정선 150</span></div>
              <div class="analysis-v2-bars">
                ${analysisSimulationTargets.map((item) => renderSimulationBar(ctx, item)).join('')}
              </div>
            </div></div>
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
    isAnalyzing = false,
    layout
  } = ctx;
  const effectiveMode = canAccessStandard ? analysisMode : 'summary';
  const loadingPanel = isAnalyzing
    ? '<div class="analysis-loading-panel"><span class="analysis-loading-orbit"><i></i><i></i><i></i></span><div><span>분석 중</span><b>선택한 성적과 목표대학을 다시 계산하고 있어요</b><p>잠시 뒤 지원 가능성과 추천 전략이 갱신됩니다.</p></div></div>'
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

        <div class="analysis-v2-tabs">
          <button class="analysis-v2-tab ${effectiveMode === 'summary' ? 'active' : ''}" data-action="setAnalysisMode" data-analysis-mode="summary">전략 요약</button>
          <button class="analysis-v2-tab ${effectiveMode === 'simulation' ? 'active' : ''} ${canAccessStandard ? '' : 'locked'}" data-action="${canAccessStandard ? 'setAnalysisMode' : 'goto'}" data-target="proIntro" data-analysis-mode="simulation">점수 상승 시뮬레이션</button>
        </div>

        ${effectiveMode === 'summary' ? renderSummaryMode(ctx) : renderSimulationMode(ctx)}

        ${renderAnalysisSearchModal(ctx)}
      </section>`,
    true
  );
}

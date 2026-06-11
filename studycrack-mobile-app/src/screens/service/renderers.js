import { CRACKY_SRC, PRO_ELITE_REPORT_PDF_PATH } from '../../constants/assets.js';
import { COACHING_MONTHLY_REPORTS, PLAN_META } from '../../constants/plans.js';

function defaultIcon() {
  return '';
}

function renderCoachingSheet(ctx) {
  const {
    coachingSheetOpen = false,
    coachingStep = 1,
    coachingStepBody = () => ''
  } = ctx;

  if (!coachingSheetOpen) return '';

  return `<div class="coach-sheet-overlay" data-action="closeCoachingSheet">
          <section class="coach-sheet" data-action="noopModal">
            <div class="coach-sheet-head"><div><h3>26년 4월 4주차 학습점검</h3><p>${coachingStep} / 8 단계</p></div><button class="coach-close" data-action="closeCoachingSheet">✕</button></div>
            <div class="coach-sheet-body">${coachingStepBody()}</div>
            <div class="coach-sheet-footer"><button class="btn btn-secondary" data-action="coachingPrev" ${coachingStep === 1 ? 'disabled' : ''}>이전</button><button class="btn btn-primary" data-action="coachingNext">${coachingStep === 8 ? '작성 완료 및 제출' : '다음 단계'}</button></div>
          </section>
        </div>`;
}

function renderReportRows({ icon = defaultIcon }) {
  return `<button class="report-row" data-action="goto" data-target="reportDetail"><div><b>5월 11일 (토)</b><p>종합 분석 리포트</p></div><span>${icon('chevron', false)}</span></button>
         <button class="report-row"><div><b>4월 27일 (토)</b><p>중간 분석 리포트</p></div><span>${icon('chevron', false)}</span></button>`;
}

function renderProRequestModal(ctx) {
  const {
    proRequestModalOpen = false,
    proRequestText = ''
  } = ctx;

  if (!proRequestModalOpen) return '';

  return `<div class="home-modal-overlay" data-action="closeProRequestModal"><div class="home-modal pro-request-modal" data-action="noopModal"><div class="pro-request-head"><h4>✈ 전략 보고서 요청</h4><button class="pro-request-close" data-action="closeProRequestModal">✕</button></div><div class="pro-request-body"><p>현재 학습 상황이나 고민, 특별히 분석받고 싶은 내용을 적어주세요.</p><p>담당 컨설턴트가 이를 반영하여 <b>최적의 전략</b>을 수립합니다.</p><label>요청 사항 (500자 이내)</label><textarea data-field="proRequestText" maxlength="500" placeholder="예: 6월 모평 대비 수학 기하 과목 집중 전략이 필요합니다. 최근 실전 문제 풀이에서 시간이 부족해 고민입니다.">${proRequestText}</textarea><div class="pro-request-count">${proRequestText.length}/500</div><div class="pro-request-actions"><button class="cancel" data-action="closeProRequestModal">취소</button><button class="submit" data-action="submitProRequest">요청서 제출하기</button></div></div></div></div>`;
}

function renderPlanCard({ meta, plan, selectedPlan, variant }) {
  const active = selectedPlan === plan;
  const badge = plan === 'Standard' ? '<span class="badge">추천</span>' : plan === 'Pro' ? '<span class="badge">최고 효율</span>' : '';
  const features = variant === 'intro'
    ? plan === 'Basic'
      ? ['합격 가능성 분석', '대학별 전략 확인']
      : plan === 'Standard'
        ? ['플래너 피드백', '학습 방향 코칭']
        : ['모든 기능 무제한 이용', '프로 보고서 2주 1회', 'Sky튜터 1:1 피드백']
    : meta.features;

  return `<button class="plan-card ${plan.toLowerCase()} ${active ? 'active' : ''}" data-action="selectPlan" data-plan="${plan}"><div class="plan-head"><h4>${plan}</h4>${badge}</div><p class="plan-price">${meta.introPrice}</p><ul>${features.map((item) => `<li>${item}</li>`).join('')}</ul></button>`;
}

export function renderStrategyScreen(ctx) {
  const {
    coachingMonth = '26년 4월',
    coachingSubmitted = false,
    layout,
    selectedCoachingReports = COACHING_MONTHLY_REPORTS[coachingMonth] || []
  } = ctx;

  return layout(
    `<div class="coach-page">
        <div class="card coach-title-card"><div class="top-card-head"><div><h3>학습 코칭</h3><p>주간 학습 계획을 점검하고, 튜터의 피드백을 받아보세요.</p></div><span class="top-infographic top-infographic-coach" aria-hidden="true"><i></i><i></i><i></i></span></div></div>
        <div class="card coach-status-card">
          <div class="coach-row"><h4>이번 주 학습 점검 & 코칭 요청</h4><span class="badge ${coachingSubmitted ? 'coach-submitted' : ''}">${coachingSubmitted ? '제출 완료' : '미제출'}</span></div>
          <p>이번 주 학습 달성률과 고민을 작성하면 튜터가 피드백을 제공해요.</p>
          <small>매주 일요일 20:00 마감</small>
          <button class="btn btn-primary" data-action="openCoachingSheet">${coachingSubmitted ? '다시 작성하기' : '코칭 요청하기'}</button>
        </div>
        <div class="card coach-feedback-card">
          <div class="coach-row"><h4>주간학습 피드백</h4><select class="coach-month-select" data-field="coachingMonth"><option value="26년 4월" ${coachingMonth === '26년 4월' ? 'selected' : ''}>26년 4월</option><option value="26년 3월" ${coachingMonth === '26년 3월' ? 'selected' : ''}>26년 3월</option></select></div>
          <p>월별 피드백 리포트를 PDF로 다운로드할 수 있어요.</p>
          ${selectedCoachingReports.length ? `<div class="coach-report-list">${selectedCoachingReports.map((report) => `<button class="coach-report-card" data-action="downloadCoachingPdf" data-pdf-path="${report.pdfPath}"><div><b>${report.title}</b><p>${report.date}</p></div><div class="coach-report-side"><span class="badge coach-pdf-badge">PDF</span><span class="coach-report-arrow">›</span></div></button>`).join('')}</div>` : '<div class="coach-empty">아직 도착한 피드백 리포트가 없습니다.</div>'}
        </div>
        ${renderCoachingSheet(ctx)}
      </div>`,
    true
  );
}

export function renderWeeklyScreen(ctx) {
  const {
    crackySrc = CRACKY_SRC,
    icon = defaultIcon,
    layout
  } = ctx;

  return layout(
    `<div class="weekly-head"><button class="weekly-back" data-action="back">←</button><h3>주간 점검</h3><span></span></div>
       <p class="weekly-range">이번 주 점검 (5.6 ~ 5.12)</p>
       <div class="card weekly-rate"><div><p class="sub">플래너 수행률</p><h2>82%</h2></div><span class="badge">목표 90%</span></div>
       <div class="card weekly-feedback">
         <p class="sub" style="margin:0 0 10px;">주간 요약 피드백</p>
         <div class="feedback-item">${icon('check', true)}수학 공부 시간이 부족해요. 개념 학습 시간을 늘려보세요.</div>
         <div class="feedback-item">${icon('check', true)}탐구 문제 풀이 시간이 좋아요! 유지하면 더 좋은 결과가 기대돼요.</div>
         <div class="feedback-item">${icon('check', true)}영어는 꾸준히 잘하고 있어요. 계속 유지해요!</div>
         <img loading="lazy" decoding="async" src="${crackySrc}" class="weekly-char crackie" alt="크랙이"/>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary weekly-next cta-btn" data-action="goto" data-target="planner">다음 주 계획 세우기</button></div>`,
    true
  );
}

export function renderReportScreen(ctx) {
  const {
    icon = defaultIcon,
    layout
  } = ctx;

  return layout(
    `<span class="badge">프로 플랜 전용</span>
       <p class="report-desc">2주에 한 번, 내 맞춤 분석 리포트 제공</p>
       <div class="card report-main"><p class="sub">다음 보고서 이용 가능일</p><p class="report-date">5월 25일 (토)</p><h2>D-11</h2></div>
       <div class="card report-list"><p class="sub">이전 보고서</p>
         ${renderReportRows({ icon })}
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary report-sample cta-btn">프로 보고서 샘플 보기</button></div>`,
    true
  );
}

export function renderReportDetailScreen({ appbar, layout }) {
  return layout(appbar('종합 분석 리포트', true) + `<div class="report-tabs"><span class="active">종합 분석</span><span>과목 분석</span><span>학습 전략</span><span>현재 위치</span></div><div class="report-detail-stack"><div class="card report-detail-card"><p class="sub">핵심 요약</p><p class="report-detail-text">수학에서 점수 상승 여지가 가장 큽니다. 개념 학습 시간을 늘리고, 문제 풀이 비중을 높이면 단기간 점수 개선이 가능합니다.</p></div><div class="card report-detail-card"><p class="sub">과목별 성과</p><div class="subject-result"><span>수학</span><div class="track"><i style="width:82%"></i></div><em><span class="score">68점</span><span class="delta">▲12</span></em></div><div class="subject-result"><span>국어</span><div class="track"><i style="width:74%"></i></div><em><span class="score">82점</span><span class="delta">▲3</span></em></div><div class="subject-result"><span>영어</span><div class="track"><i style="width:70%"></i></div><em><span class="score">77점</span><span class="delta">-</span></em></div><div class="subject-result"><span>탐구</span><div class="track"><i style="width:62%"></i></div><em><span class="score">66점</span><span class="delta">▲5</span></em></div></div></div><div class="cta-wrapper report-detail-cta"><button class="btn btn-primary cta-btn">PDF 다운로드</button></div>`, false);
}

export function renderProEliteScreen(ctx) {
  const {
    appbar,
    layout,
    proEliteFilteredReports = [],
    proEliteMonth = '',
    proEliteMonths = [],
    proEliteReportPdfPath = PRO_ELITE_REPORT_PDF_PATH
  } = ctx;

  return layout(appbar('PRO EXCLUSIVE', true) + `<div class="pro-elite-page"><div class="pro-elite-hero"><span class="pro-elite-badge">TOP 1%</span><h3>상위 1%를 위한<br/>중장기 집중 맞춤 솔루션</h3><p>주차별 프리미엄 전략 리포트를 다운로드하세요.</p></div><div class="pro-elite-filter"><select class="pro-elite-month-select" data-field="proEliteMonth">${proEliteMonths.map((month) => `<option value="${month}" ${proEliteMonth === month ? 'selected' : ''}>${month}</option>`).join('')}</select></div><div class="pro-elite-list">${proEliteFilteredReports.map((report) => `<button class="pro-elite-item" data-action="downloadProReport" data-pdf-path="${proEliteReportPdfPath}" data-pdf-name="${report.fileName}"><div><b>${report.week} PRO 리포트</b><p>${report.desc}</p></div><span class="pro-elite-download">PDF 다운로드</span></button>`).join('') || '<div class="coach-empty">해당 월 리포트가 없습니다.</div>'}</div><div class="pro-elite-request-bottom"><button class="pro-request-btn" data-action="openProRequestModal"><i class="spark">✦</i><span>전략 리포트 요청하기</span></button></div>${renderProRequestModal(ctx)}</div>`, false);
}

export function renderTutorScreen({ appbar, layout }) {
  return layout(appbar('SKY튜터 1:1 피드백', true) + '<div class="card"><p class="sub">텍스트 기반 질의응답</p><ul class="list"><li>Q. 수학 개념 이해가 잘 안돼요</li><li>A. 유형별 복습 루틴을 추가하세요</li></ul></div><button class="btn btn-primary">새 질문 작성</button>', false);
}

export function renderProIntroScreen(ctx) {
  const {
    appbar,
    layout,
    planMeta = PLAN_META,
    selectedPlan = 'Pro'
  } = ctx;

  return layout(appbar('StudyCrack 요금제', true) + `<p class="sub pricing-sub">합격 전략, 단계별로 선택하세요</p>
      <div class="plan-stack">
        ${renderPlanCard({ meta: planMeta.Basic, plan: 'Basic', selectedPlan, variant: 'intro' })}
        ${renderPlanCard({ meta: planMeta.Standard, plan: 'Standard', selectedPlan, variant: 'intro' })}
        ${renderPlanCard({ meta: planMeta.Pro, plan: 'Pro', selectedPlan, variant: 'intro' })}
      </div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="payment">결제하기</button></div>`, false);
}

export function renderPaymentScreen(ctx) {
  const {
    appbar,
    currentPlan,
    duration = '4주',
    layout,
    planMeta = PLAN_META,
    selectedPlan = 'Pro'
  } = ctx;
  const activePlan = currentPlan || planMeta[selectedPlan] || planMeta.Pro;

  return layout(appbar('플랜 선택', true) + `<div class="payment-tabs full">
      <button class="${selectedPlan === 'Basic' ? 'active' : ''}" data-action="selectPlan" data-plan="Basic">Basic</button>
      <button class="${selectedPlan === 'Standard' ? 'active' : ''}" data-action="selectPlan" data-plan="Standard">Standard</button>
      <button class="${selectedPlan === 'Pro' ? 'active' : ''}" data-action="selectPlan" data-plan="Pro">Pro</button>
    </div>
      <div class="card payment-focus-card"><div class="payment-focus-head"><div><h3>${selectedPlan}</h3><p>${activePlan.payPrice}</p></div></div><p class="payment-desc">${activePlan.desc}</p><ul class="payment-check-list">${activePlan.features.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      <div class="duration-row payment-duration-row">
        <button class="${duration === '4주' ? 'active' : ''}" data-action="selectDuration" data-duration="4주">4주</button>
        <button class="${duration === '8주' ? 'active' : ''}" data-action="selectDuration" data-duration="8주">8주</button>
        <button class="${duration === '12주' ? 'active' : ''}" data-action="selectDuration" data-duration="12주">12주</button>
      </div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="paymentComplete">결제하기</button></div>`, false);
}

export function renderPaymentCompleteScreen(ctx) {
  const {
    icon = defaultIcon,
    layout,
    selectedPlan = 'Pro'
  } = ctx;

  return layout(`<div class="payment-done-screen"><div class="payment-complete-wrap"><div class="payment-check">${icon('check', true)}</div><p class="title payment-complete-title">결제가 완료되었습니다!</p><p class="sub payment-complete-sub">${selectedPlan.toUpperCase()} 플랜이 활성화되었습니다.</p><div class="card payment-complete-note"><b>프로 보고서 이용 안내</b><p>2주에 한 번 새로운 리포트를 제공해 드려요.<br/>다음 리포트는 5월 25일에 이용 가능해요.</p></div></div><div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="home">홈으로 이동</button></div></div>`, false);
}

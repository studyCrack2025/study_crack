import { renderModal } from '../../components/modal.js';
import { renderSecondaryIntro, renderSecondaryState } from '../../components/secondary-page.js';
import { CRACKY_SRC } from '../../constants/assets.js';
import { TODAY_DATE } from '../../constants/runtime-defaults.js';
import { PLAN_META } from '../../constants/plans.js';

// 잠금 프리뷰(블러 처리되는 데모 표면)용 현재 월/일 라벨.
function lockedPreviewDateLabel() {
  const [, month, day] = TODAY_DATE.split('-').map(Number);
  return `${month}월 ${day}일`;
}

function defaultIcon() {
  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeExternalUrl(value) {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) ? text : '';
}

function formatReportKeyLabel(key = '') {
  const value = String(key || '').trim();
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return value || 'PRO 리포트';
  return `20${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}주차`;
}

function reportStatusLabel(report = {}) {
  const status = String(report.status || '').toLowerCase();
  if ((status === 'published' || status === 'sent') && report.reportLink) return '다운로드 가능';
  if (status === 'tutor_review') return '튜터 검수 중';
  if (status === 'drafting') return '작성 중';
  return '준비 중';
}

function formatWeekIdLabel(weekId = '') {
  const value = String(weekId || '').trim();
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return value || '주간 점검';
  return `20${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}주차`;
}

function hasSubmittedFeedback(report = {}) {
  return report?.tutorFeedback?.submitted === true;
}

function renderReportRows({ icon = defaultIcon, reports = [] }) {
  if (!reports.length) return renderSecondaryState({ title: '아직 발행된 PRO 리포트가 없어요', description: '새 리포트가 준비되면 이곳에 표시됩니다.' });
  return reports.map((report) => {
    const reportLink = safeExternalUrl(report.reportLink);
    const ready = !!reportLink && ['published', 'sent'].includes(String(report.status || '').toLowerCase());
    return `<button class="sc-secondary-row report-row" data-action="downloadProReport" data-pdf-path="${ready ? escapeHtml(reportLink) : ''}" data-pdf-name="studycrack-pro-report-${escapeHtml(report.key || 'latest')}.pdf"><span class="sc-secondary-row-main"><b>${escapeHtml(formatReportKeyLabel(report.key))}</b><p>${reportStatusLabel(report)}</p></span><span class="sc-secondary-row-meta">${ready ? '<b>PDF</b><em>다운로드</em>' : icon('chevron', false)}</span></button>`;
  }).join('');
}

function renderProRequestModal(ctx) {
  const {
    proRequestModalOpen = false,
    proRequestSubmitting = false,
    proRequestText = ''
  } = ctx;

  if (!proRequestModalOpen) return '';

  const body = `<div class="pro-request-head"><h4>✈ 전략 보고서 요청</h4><button class="pro-request-close" data-action="closeProRequestModal">✕</button></div><div class="pro-request-body"><p>현재 학습 상황이나 고민, 특별히 분석받고 싶은 내용을 적어주세요.</p><p>담당 컨설턴트가 이를 반영하여 <b>최적의 전략</b>을 수립합니다.</p><label>요청 사항 (500자 이내)</label><textarea data-field="proRequestText" maxlength="500" placeholder="예: 6월 모평 대비 수학 기하 과목 집중 전략이 필요합니다. 최근 실전 문제 풀이에서 시간이 부족해 고민입니다.">${escapeHtml(proRequestText)}</textarea><div class="pro-request-count">${proRequestText.length}/500</div><div class="pro-request-actions"><button class="cancel" data-action="closeProRequestModal">취소</button><button class="submit" data-action="submitProRequest" ${proRequestSubmitting ? 'disabled' : ''}>${proRequestSubmitting ? '제출 중' : '요청서 제출하기'}</button></div>`;
  return renderModal({ panelClass: 'pro-request-modal', dismissAction: 'closeProRequestModal', body });
}

function formatQnaDate(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function qnaStatusLabel(status = '') {
  if (String(status).toLowerCase() === 'done') return '답변 완료';
  if (String(status).toLowerCase() === 'read') return '확인 중';
  return '답변 대기';
}

function renderQnaComposerModal(ctx) {
  const {
    qnaComposerOpen = false,
    qnaDraftContent = '',
    qnaDraftTitle = '',
    qnaSubmitting = false
  } = ctx;

  if (!qnaComposerOpen) return '';

  const body = `<div class="qna-modal-head"><h4>새 질문 작성</h4><button class="qna-modal-close" data-action="closeQnaComposer">✕</button></div><div class="qna-modal-body"><label>질문 제목</label><input class="planner-input" data-field="qnaDraftTitle" value="${escapeHtml(qnaDraftTitle)}" maxlength="80" placeholder="예: 수학 기출 복습 순서가 고민이에요"/><label>질문 내용</label><textarea class="planner-input qna-textarea" data-field="qnaDraftContent" maxlength="1000" placeholder="현재 상황과 궁금한 점을 구체적으로 적어주세요.">${escapeHtml(qnaDraftContent)}</textarea><div class="qna-modal-actions"><button class="btn btn-secondary" data-action="closeQnaComposer">취소</button><button class="btn btn-primary" data-action="submitMobileQna" ${qnaSubmitting ? 'disabled' : ''}>${qnaSubmitting ? '등록 중' : '질문 등록'}</button></div></div>`;
  return renderModal({ panelClass: 'qna-modal', dismissAction: 'closeQnaComposer', body });
}

function planDisplayName(plan = '') {
  return plan === 'Pro' ? 'PRO' : String(plan || '').toUpperCase();
}

function requiredTierLabel(tier = '') {
  const normalized = String(tier).toLowerCase();
  if (normalized === 'pro') return 'PRO';
  if (normalized === 'basic') return 'BASIC';
  return 'STANDARD';
}

const PLAN_ORDER = ['Basic', 'Starter', 'Standard', 'Pro'];

function planBadgeText(plan = '') {
  if (plan === 'Basic') return '분석 입문';
  if (plan === 'Starter') return '1회 진단';
  if (plan === 'Standard') return '주간 관리';
  return '프리미엄';
}

function renderPlanSelector({ checkoutPlan = 'Standard', planMeta = PLAN_META }) {
  return `<div class="plan-console-selector">${PLAN_ORDER.map((plan) => {
    const meta = planMeta[plan] || {};
    return `<button class="${checkoutPlan === plan ? 'active' : ''}" data-action="selectPlan" data-plan="${plan}"><span>${planDisplayName(plan)}</span><b>${escapeHtml(meta.payPrice || meta.introPrice || '')}</b></button>`;
  }).join('')}</div>`;
}

function renderSelectedPlanDetail({ checkoutPlan = 'Standard', ctaLabel = '', ctaAction = 'goto', ctaTarget = 'payment', icon = defaultIcon, planMeta = PLAN_META, showCta = true }) {
  const activePlan = planMeta[checkoutPlan] || planMeta.Standard;
  const original = activePlan.originalPrice ? `<span class="plan-console-original">${escapeHtml(activePlan.originalPrice)}</span>` : '';
  const ctaAttrs = ctaAction === 'goto' ? `data-action="goto" data-target="${ctaTarget}"` : `data-action="${ctaAction}"`;
  const features = activePlan.features || [];
  const audience = activePlan.audience || [];
  const benefitIcons = ['chat', 'target', 'chart', 'calendar', 'check'];
  const buttonLabel = ctaLabel || `${escapeHtml(activePlan.payPrice || activePlan.introPrice || '')}로 시작하기`;
  return `<section class="card plan-console-detail ${String(activePlan.theme || '').toLowerCase()}">
    <div class="plan-console-head">
      <div class="plan-console-title"><span class="plan-console-badge">${planBadgeText(checkoutPlan)}</span><h3>${planDisplayName(checkoutPlan)}</h3><p>${escapeHtml(activePlan.complete || activePlan.desc || '')}</p></div>
      <span class="plan-console-visual">${icon('calendar', false)}</span>
    </div>
    <div class="plan-console-price">${original}<div><b>${escapeHtml(activePlan.payPrice || activePlan.introPrice || '')}</b><em>${escapeHtml(activePlan.weeklyPrice || activePlan.billingNote || '')}</em></div></div>
    <div class="plan-console-benefits">${features.slice(0, 5).map((item, index) => `<div class="plan-benefit-row"><span>${icon(benefitIcons[index] || 'check', false)}</span><div><b>${escapeHtml(item)}</b><p>${index === 0 ? escapeHtml(activePlan.desc || '') : '선택한 플랜에서 바로 이용할 수 있어요.'}</p></div></div>`).join('')}</div>
    ${showCta ? `<button class="btn btn-primary plan-console-cta" ${ctaAttrs}>${buttonLabel}<span>${icon('chevron', false)}</span></button><p class="plan-secure-note">${icon('shield', false)} 안전한 결제 · 언제든 해지 가능</p>` : ''}
    ${audience.length ? `<div class="plan-audience"><b>이런 학생에게 추천해요</b>${audience.map((item) => `<p>${icon('check', false)}<span>${escapeHtml(item)}</span></p>`).join('')}</div>` : ''}
  </section>`;
}

function renderLockedFeaturePreview(target = '') {
  if (['planner', 'plannerAdd'].includes(target)) {
    return `<div class="locked-preview planner-preview"><div class="planner-head preview-head"><h3>${lockedPreviewDateLabel()}</h3><span class="preview-icon">일정</span></div><div class="planner-section-title"><div><h4>오늘의 합격 플래너</h4><p>총 6시간 30분</p></div><div class="planner-donut-wrap"><div class="planner-donut" style="--donut:conic-gradient(#4c79ee 0 46%,#10B981 46% 72%,#F59E0B 72% 100%)"></div></div></div><div class="planner-plan-list preview-list"><div class="planner-item"><i class="dot blue"></i><div class="planner-item-main"><b>수학</b><p>약점 단원 3문항 재풀이</p></div><strong>90분</strong></div><div class="planner-item"><i class="dot green"></i><div class="planner-item-main"><b>국어</b><p>비문학 지문 분석 루틴</p></div><strong>70분</strong></div></div></div>`;
  }
  if (['report', 'reportDetail', 'proElite', 'tutor'].includes(target)) {
    return `<div class="locked-preview pro-preview"><div class="pro-elite-hero"><span class="pro-elite-badge">PRO EXCLUSIVE</span><h3>상위권 전략 리포트</h3><p>2주 단위로 목표 대학 도달 전략을 정리합니다.</p></div><div class="pro-elite-list"><div class="pro-elite-item"><div><b>6월 2주차 PRO 리포트</b><p>정밀 역추적 · 지원 전략 · 학부모 공유 요약</p></div><span class="pro-elite-download">PDF</span></div><div class="qna-card"><div class="qna-card-head"><div><b>SKY튜터 1:1 피드백</b><span>답변 대기</span></div><em>PRO</em></div><p class="qna-question">주간 학습 흐름과 질문을 남기면 튜터 답변이 연결됩니다.</p></div></div></div>`;
  }
  return `<div class="locked-preview coach-preview"><header class="coaching-context"><div><span>학습 코칭</span><h2>선배와 함께 다음 주를 설계해요</h2><p>주간 기록을 점검하고, 바로 실행할 피드백을 받아보세요.</p></div><span class="coaching-mark" aria-hidden="true"><i></i><i></i><i></i></span></header><section class="coaching-hero"><div class="coaching-hero-copy"><span>SKY 선배 1:1 멘토링</span><h3>이번 주 공부, 혼자 고민하지 마세요</h3><p>학습 기록과 고민을 보내면 다음 주 방향을 구체적인 피드백으로 정리해 드려요.</p></div><span class="coaching-mark" aria-hidden="true"><i></i><i></i><i></i></span><button type="button">이번 주 코칭 신청하기 <b>›</b></button></section><section class="coaching-history"><div class="coaching-history-head"><div><span>코칭 내역</span><h3>이번 주 점검</h3></div></div><div class="coaching-segment"><button class="active">이번 주 점검</button><button>받은 피드백</button></div><div class="coaching-history-list"><div class="coaching-history-row coaching-session-row"><span class="coaching-session-status"><i></i></span><span class="coaching-session-copy"><small>이번 주 · SKY 튜터</small><b>주간 학습 점검</b><em>검토 대기</em></span><strong>›</strong></div></div></section></div>`;
}

export function renderLockedFeatureScreen(ctx) {
  const {
    appbar,
    layout,
    lockedFeatureLabel = '',
    lockedFeatureTarget = '',
    lockedFeatureTier = '',
    upgradePromptTarget = '',
    upgradePromptTier = ''
  } = ctx;
  const label = lockedFeatureLabel || upgradePromptTarget || '선택한 기능';
  const tier = requiredTierLabel(lockedFeatureTier || upgradePromptTier || 'standard');
  if (lockedFeatureTarget === 'strategy') {
    return layout(`<div class="locked-feature-center-shell"><div class="locked-coach-preview-wrap">${renderLockedFeaturePreview(lockedFeatureTarget)}</div><section class="locked-feature-panel locked-feature-panel-inline"><span class="badge">잠긴 기능</span><h3>${escapeHtml(label)} 기능은 ${tier} 플랜에서 열려요</h3><p>아래 화면처럼 주간 점검과 튜터 피드백이 연결되며, 업그레이드 후 바로 이어서 사용할 수 있어요.</p><div class="locked-feature-actions"><button class="btn btn-primary" data-action="goto" data-target="proIntro">${tier} 플랜 보기</button></div></section></div>`, true);
  }
  return layout(appbar(label, true) + `<div class="locked-feature-page"><div class="locked-feature-preview-wrap">${renderLockedFeaturePreview(lockedFeatureTarget)}<div class="locked-feature-fade" aria-hidden="true"></div><section class="locked-feature-panel"><span class="badge">잠긴 기능</span><h3>${escapeHtml(label)} 기능은 ${tier} 플랜에서 열려요</h3><p>아래 화면처럼 플래너와 피드백이 연결되며, 업그레이드 후 바로 이어서 사용할 수 있어요.</p><div class="locked-feature-actions"><button class="btn btn-primary" data-action="goto" data-target="proIntro">${tier} 플랜 보기</button><button class="btn btn-secondary" data-action="back">돌아가기</button></div></section></div></div>`, true);
}

export function renderWeeklyScreen(ctx) {
  const {
    crackySrc = CRACKY_SRC,
    icon = defaultIcon,
    layout,
    weeklyReports = []
  } = ctx;
  const latest = weeklyReports[0] || null;
  const fb = latest?.tutorFeedback || {};
  if (!latest) {
    return layout(
      `<div class="weekly-page mobile-card-stack"><div class="weekly-head"><button class="weekly-back" data-action="back">←</button><h3>주간 점검</h3><span></span></div>
       <div class="card weekly-feedback"><p class="sub" style="margin:0 0 10px;">주간 점검 기록이 없습니다.</p><div class="weekly-feedback-body"><div class="weekly-feedback-list"><div class="feedback-item">${icon('check', true)}학습 코칭 화면에서 이번 주 점검을 제출하면 이곳에 피드백이 표시됩니다.</div></div><img loading="lazy" decoding="async" src="${escapeHtml(crackySrc)}" class="weekly-char crackie" alt="크랙이"/></div></div>
       <div class="cta-wrapper"><button class="btn btn-primary weekly-next cta-btn" data-action="goto" data-target="strategy">학습 코칭으로 이동</button></div></div>`,
      true
    );
  }

  const done = hasSubmittedFeedback(latest);
  const feedbackItems = done
    ? [
      fb.weeklyPlanner ? `이번 주 플래너: ${fb.weeklyPlanner}` : '',
      fb.planReason ? `계획 이유: ${fb.planReason}` : '',
      fb.questionAnswer ? `질문 답변: ${fb.questionAnswer}` : '',
      fb.tutorComment ? `튜터 총평: ${fb.tutorComment}` : '',
      fb.nextWeekTop3 ? `다음 주 TOP3: ${fb.nextWeekTop3}` : '',
      fb.planEvaluation ? `플랜 평가: ${fb.planEvaluation}` : ''
    ].filter(Boolean)
    : ['튜터가 피드백을 최종 제출하면 이곳에 표시됩니다.'];

  return layout(
    `<div class="weekly-page mobile-card-stack"><div class="weekly-head"><button class="weekly-back" data-action="back">←</button><h3>주간 점검</h3><span></span></div>
       <p class="weekly-range">${escapeHtml(formatWeekIdLabel(latest.weekId))}</p>
       <div class="card weekly-rate"><div><p class="sub">피드백 상태</p><h2>${done ? '도착' : '대기'}</h2></div><span class="badge">${escapeHtml(latest.tutorName || '튜터 확인 중')}</span></div>
       <div class="card weekly-feedback">
         <p class="sub" style="margin:0 0 10px;">주간 요약 피드백</p>
         <div class="weekly-feedback-body"><div class="weekly-feedback-list">${feedbackItems.map((item) => `<div class="feedback-item">${icon('check', true)}${escapeHtml(item)}</div>`).join('')}</div><img loading="lazy" decoding="async" src="${escapeHtml(crackySrc)}" class="weekly-char crackie" alt="크랙이"/></div>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary weekly-next cta-btn" data-action="goto" data-target="planner">다음 주 계획 세우기</button></div></div>`,
    true
  );
}

export function renderReportScreen(ctx) {
  const {
    appbar,
    icon = defaultIcon,
    layout,
    proReports = [],
    proReportsStatus = 'idle'
  } = ctx;
  const statusText = proReportsStatus === 'loading'
    ? renderSecondaryState({ kind: 'loading', title: 'PRO 리포트를 불러오는 중이에요' })
    : renderReportRows({ icon, reports: proReports });

  return layout(
    appbar('학습 리포트', true) + `<div class="sc-secondary-page report-page">${renderSecondaryIntro({ eyebrow: 'PRO REPORT', title: '맞춤 전략 리포트', description: '발행된 전략 리포트를 확인하고 새 분석을 요청할 수 있어요.', aside: '<span class="sc-chip">PRO</span>' })}<section class="sc-secondary-section report-summary"><div class="report-summary-main"><span>발행 리포트</span><b>${proReports.length}개</b><p>${proReports.length ? '최근 발행 이력을 확인해보세요.' : '첫 리포트 발행을 기다리고 있어요.'}</p></div><button class="btn btn-primary report-sample" data-action="openProRequestModal">새 리포트 요청</button></section><section class="sc-secondary-section report-list"><div class="sc-secondary-section-head"><div><h3>리포트 목록</h3><p>다운로드 가능한 PDF만 바로 열립니다.</p></div></div><div class="sc-secondary-list">${statusText}</div></section></div>`,
    true,
    renderProRequestModal(ctx)
  );
}

export function renderReportDetailScreen({ appbar, layout }) {
  return layout(appbar('종합 분석 리포트', true) + `<div class="sc-secondary-page report-detail-page">${renderSecondaryIntro({ eyebrow: 'REPORT DETAIL', title: '리포트 상세', description: '실제로 발행된 PDF 리포트만 안전하게 제공합니다.' })}<section class="sc-secondary-section report-detail-card"><div class="sc-secondary-section-head"><div><h3>발행 리포트 선택</h3><p>리포트 목록에서 다운로드 가능한 항목을 선택해주세요.</p></div></div>${renderSecondaryState({ title: '선택된 리포트가 없어요', description: '목록으로 돌아가 확인할 리포트를 선택해주세요.' })}</section></div>`, false);
}

export function renderProEliteScreen(ctx) {
  const {
    appbar,
    layout,
    proReports = [],
    proReportsStatus = 'idle'
  } = ctx;
  const reportList = proReportsStatus === 'loading'
    ? '<div class="coach-empty">PRO 리포트를 불러오는 중입니다.</div>'
    : (proReports.length
      ? proReports.map((report) => {
        const reportLink = safeExternalUrl(report.reportLink);
        const ready = !!reportLink && ['published', 'sent'].includes(String(report.status || '').toLowerCase());
        return `<button class="pro-elite-item" data-action="downloadProReport" data-pdf-path="${ready ? escapeHtml(reportLink) : ''}" data-pdf-name="studycrack-pro-report-${escapeHtml(report.key || 'latest')}.pdf"><div><b>${escapeHtml(formatReportKeyLabel(report.key))} PRO 리포트</b><p>${reportStatusLabel(report)}</p></div><span class="pro-elite-download">${ready ? 'PDF 다운로드' : '준비 중'}</span></button>`;
      }).join('')
      : '<div class="coach-empty">아직 발행된 PRO 리포트가 없습니다.</div>');

  return layout(appbar('PRO EXCLUSIVE', true) + `<div class="pro-elite-page"><div class="pro-elite-hero"><span class="pro-elite-badge">TOP 1%</span><h3>상위 1%를 위한<br/>중장기 집중 맞춤 솔루션</h3><p>발행된 프리미엄 전략 리포트를 확인하세요.</p></div><div class="pro-elite-list">${reportList}</div><div class="pro-elite-request-bottom"><button class="pro-request-btn" data-action="openProRequestModal"><i class="spark">✦</i><span>전략 리포트 요청하기</span></button></div></div>`, false, renderProRequestModal(ctx));
}

export function renderTutorScreen(ctx) {
  const {
    appbar,
    layout,
    qnaHistory = [],
    qnaStatus = 'idle'
  } = ctx;
  const statusNode = qnaStatus === 'loading'
    ? '<div class="coach-empty">질문 내역을 불러오는 중입니다.</div>'
    : qnaStatus === 'error'
      ? '<div class="coach-empty">질문 내역을 불러오지 못했습니다.</div>'
      : qnaHistory.length
        ? qnaHistory.map((item) => {
          const done = String(item.status || '').toLowerCase() === 'done';
          const created = formatQnaDate(item.createdAt);
          return `<article class="qna-list-row"><div class="qna-row-main"><b>${escapeHtml(item.title || '제목 없는 질문')}</b><p>${escapeHtml(item.content || '질문 내용 없음')}</p>${done && item.answer ? `<small>답변: ${escapeHtml(item.answer)}</small>` : ''}</div><div class="qna-row-side"><em class="${done ? 'done' : ''}">${qnaStatusLabel(item.status)}</em>${created ? `<span>${escapeHtml(created)}</span>` : ''}</div></article>`;
        }).join('')
        : '<div class="coach-empty">아직 남긴 질문이 없습니다.</div>';

  return layout(appbar('SKY튜터 1:1 피드백', true) + `<div class="tutor-qna-page"><div class="card qna-intro-card"><p class="sub">텍스트 기반 질의응답</p><h3>학습 고민을 남기면 튜터가 답변해요</h3><button class="btn btn-primary" data-action="openQnaComposer">새 질문 작성</button></div><div class="qna-list compact">${statusNode}</div></div>`, false, renderQnaComposerModal(ctx));
}

export function renderProIntroScreen(ctx) {
  const {
    appbar,
    checkoutPlan = 'Standard',
    icon = defaultIcon,
    layout,
    planMeta = PLAN_META,
    upgradePromptTarget = '',
    upgradePromptTier = ''
  } = ctx;
  const requiredPlan = upgradePromptTier ? requiredTierLabel(upgradePromptTier) : '';
  const upgradeNotice = requiredPlan
    ? `<div class="card locked-upgrade-card"><span class="badge">잠긴 기능</span><h3>${escapeHtml(upgradePromptTarget || '선택한 기능')}은 ${requiredPlan} 이상에서 이용할 수 있어요.</h3><p>요금제를 업그레이드하면 하단 탭은 그대로 유지하면서 해당 기능이 바로 열립니다.</p></div>`
    : '';

  return layout(appbar('플랜 선택', true) + `<section class="sc-secondary-page plan-console-page">${renderSecondaryIntro({ eyebrow: 'MEMBERSHIP', title: '나에게 맞는 플랜', description: '플랜을 선택하면 가격과 이용 기능이 같은 기준으로 바뀝니다.', aside: `<span class="sc-chip">${planDisplayName(checkoutPlan)}</span>` })}${upgradeNotice}${renderPlanSelector({ checkoutPlan, planMeta })}${renderSelectedPlanDetail({ checkoutPlan, icon, planMeta })}</section>`, false);
}

export function renderPaymentScreen(ctx) {
  const {
    appbar,
    checkoutPlan = 'Standard',
    duration = '4주',
    icon = defaultIcon,
    layout,
    planMeta = PLAN_META
  } = ctx;
  const durationControl = ['Standard', 'Pro'].includes(checkoutPlan)
    ? `<div class="payment-option-block"><b>결제 기간</b><div class="duration-row payment-duration-row"><button class="${duration === '4주' ? 'active' : ''}" data-action="selectDuration" data-duration="4주">4주</button><button class="${duration === '8주' ? 'active' : ''}" data-action="selectDuration" data-duration="8주">8주</button><button class="${duration === '12주' ? 'active' : ''}" data-action="selectDuration" data-duration="12주">12주</button></div></div>`
    : `<div class="payment-fixed-term"><span>결제 단위</span><b>${checkoutPlan === 'Starter' ? '1회 진단' : '4주 이용'}</b></div>`;
  return layout(appbar('결제 플랜 확인', true) + `<section class="sc-secondary-page payment-console-page">${renderSecondaryIntro({ eyebrow: 'CHECKOUT', title: '결제 전 확인', description: '선택한 플랜과 기간을 확인한 뒤 안전한 웹 결제로 이동합니다.', aside: `<span class="sc-chip">${planDisplayName(checkoutPlan)}</span>` })}${renderPlanSelector({ checkoutPlan, planMeta })}${durationControl}${renderSelectedPlanDetail({ checkoutPlan, icon, planMeta, ctaLabel: '웹 결제로 계속하기', ctaAction: 'openWebPayment' })}</section>`, false);
}

export function renderPaymentCompleteScreen(ctx) {
  const {
    icon = defaultIcon,
    layout
  } = ctx;

  return layout(`<div class="sc-secondary-page payment-done-screen">${renderSecondaryIntro({ eyebrow: 'SECURE PAYMENT', title: '웹 결제에서 계속할게요', description: '전화번호 확인과 결제 인증은 기존 웹 결제 페이지에서 안전하게 진행됩니다.' })}<section class="sc-secondary-section payment-complete-wrap"><div class="payment-check">${icon('check', true)}</div><div><p class="payment-complete-title">결제 상태는 서버 확인 후 반영됩니다</p><p class="payment-complete-sub">모바일 앱이 결제 완료 상태를 임의로 만들지 않습니다.</p></div><div class="payment-complete-note"><b>안전한 결제 안내</b><p>NICEPAY 인증이 끝나면 구독 정보가 계정에 반영됩니다.</p></div><button class="btn btn-primary payment-cta" data-action="openWebPayment">웹 결제 페이지로 이동</button></section></div>`, false);
}

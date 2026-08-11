import { SecondaryIntro, SecondaryScreenShell } from '../../components/SecondaryScreen.jsx';
import { PLAN_META } from '../../constants/plans.js';
import { TODAY_DATE } from '../../constants/runtime-defaults.js';
import { CoachingProcess } from '../coaching/CoachingScreen.jsx';

const PLAN_ORDER = ['Basic', 'Starter', 'Standard', 'Pro'];
const BENEFIT_ICONS = ['chat', 'target', 'chart', 'calendar', 'check'];

function planDisplayName(plan = '') {
  return plan === 'Pro' ? 'PRO' : String(plan || '').toUpperCase();
}

function requiredTierLabel(tier = '') {
  const normalized = String(tier).toLowerCase();
  if (normalized === 'pro') return 'PRO';
  if (normalized === 'basic') return 'BASIC';
  return 'STANDARD';
}

function planBadgeText(plan = '') {
  if (plan === 'Basic') return '분석 입문';
  if (plan === 'Starter') return '1회 진단';
  if (plan === 'Standard') return '주간 관리';
  return '프리미엄';
}

function ServiceIcon({ name = 'check', primary = false }) {
  const paths = {
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 4-6" /></>,
    chat: <path d="M4 5h16v11H8l-4 4z" />,
    check: <path d="M20 6L9 17l-5-5" />,
    chevron: <path d="M9 6l6 6-6 6" />,
    shield: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></>
  };
  return <svg viewBox="0 0 24 24" className={primary ? 'icon primary' : 'icon'} aria-hidden="true">{paths[name] || paths.check}</svg>;
}

function PlanSelector({ checkoutPlan = 'Standard' }) {
  return <div className="plan-console-selector">{PLAN_ORDER.map((plan) => { const meta = PLAN_META[plan] || {}; return <button type="button" className={checkoutPlan === plan ? 'active' : ''} data-action="selectPlan" data-plan={plan} key={plan}><span>{planDisplayName(plan)}</span><b>{meta.payPrice || meta.introPrice || ''}</b></button>; })}</div>;
}

function SelectedPlanDetail({ checkoutPlan = 'Standard', ctaAction = 'goto', ctaLabel = '', ctaTarget = 'payment', showCta = true }) {
  const activePlan = PLAN_META[checkoutPlan] || PLAN_META.Standard;
  const features = activePlan.features || [];
  const audience = activePlan.audience || [];
  const buttonLabel = ctaLabel || `${activePlan.payPrice || activePlan.introPrice || ''}로 시작하기`;
  const ctaProps = ctaAction === 'goto' ? { 'data-action': 'goto', 'data-target': ctaTarget } : { 'data-action': ctaAction };
  return (
    <section className={`card plan-console-detail ${String(activePlan.theme || '').toLowerCase()}`}>
      <div className="plan-console-head"><div className="plan-console-title"><span className="plan-console-badge">{planBadgeText(checkoutPlan)}</span><h3>{planDisplayName(checkoutPlan)}</h3><p>{activePlan.complete || activePlan.desc || ''}</p></div><span className="plan-console-visual"><ServiceIcon name="calendar" /></span></div>
      <div className="plan-console-price">{activePlan.originalPrice ? <span className="plan-console-original">{activePlan.originalPrice}</span> : null}<div><b>{activePlan.payPrice || activePlan.introPrice || ''}</b><em>{activePlan.weeklyPrice || activePlan.billingNote || ''}</em></div></div>
      <div className="plan-console-benefits">{features.slice(0, 5).map((item, index) => <div className="plan-benefit-row" key={item}><span><ServiceIcon name={BENEFIT_ICONS[index] || 'check'} /></span><div><b>{item}</b><p>{index === 0 ? activePlan.desc || '' : '선택한 플랜에서 바로 이용할 수 있어요.'}</p></div></div>)}</div>
      {showCta ? <><button type="button" className="btn btn-primary plan-console-cta" {...ctaProps}>{buttonLabel}<span><ServiceIcon name="chevron" /></span></button><p className="plan-secure-note"><ServiceIcon name="shield" /> 안전한 결제 · 언제든 해지 가능</p></> : null}
      {audience.length ? <div className="plan-audience"><b>이런 학생에게 추천해요</b>{audience.map((item) => <p key={item}><ServiceIcon name="check" /><span>{item}</span></p>)}</div> : null}
    </section>
  );
}

function PlannerLockedPreview() {
  const [, month, day] = TODAY_DATE.split('-').map(Number);
  return <div className="locked-preview planner-preview"><div className="planner-head preview-head"><h3>{month}월 {day}일</h3><span className="preview-icon">일정</span></div><div className="planner-section-title"><div><h4>오늘의 합격 플래너</h4><p>총 6시간 30분</p></div><div className="planner-donut-wrap"><div className="planner-donut" style={{ '--donut': 'conic-gradient(#4c79ee 0 46%,#10B981 46% 72%,#F59E0B 72% 100%)' }} /></div></div><div className="planner-plan-list preview-list"><div className="planner-item"><i className="dot blue" /><div className="planner-item-main"><b>수학</b><p>약점 단원 3문항 재풀이</p></div><strong>90분</strong></div><div className="planner-item"><i className="dot green" /><div className="planner-item-main"><b>국어</b><p>비문학 지문 분석 루틴</p></div><strong>70분</strong></div></div></div>;
}

function ProLockedPreview() {
  return <div className="locked-preview pro-preview"><div className="pro-elite-hero"><span className="pro-elite-badge">PRO EXCLUSIVE</span><h3>상위권 전략 리포트</h3><p>2주 단위로 목표 대학 도달 전략을 정리합니다.</p></div><div className="pro-elite-list"><div className="pro-elite-item"><div><b>6월 2주차 PRO 리포트</b><p>정밀 역추적 · 지원 전략 · 학부모 공유 요약</p></div><span className="pro-elite-download">PDF</span></div><div className="qna-card"><div className="qna-card-head"><div><b>SKY튜터 1:1 피드백</b><span>답변 대기</span></div><em>PRO</em></div><p className="qna-question">주간 학습 흐름과 질문을 남기면 튜터 답변이 연결됩니다.</p></div></div></div>;
}

function CoachingMark() {
  return <span className="coaching-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function CoachingLockedPreview() {
  return <div className="locked-preview coach-preview"><header className="coaching-context"><div><span>학습 코칭</span><h2>선배와 함께 다음 주를 설계해요</h2><p>주간 기록을 점검하고, 바로 실행할 피드백을 받아보세요.</p></div><CoachingMark /></header><CoachingProcess /><section className="coaching-hero"><div className="coaching-hero-copy"><span>SKY 선배 1:1 멘토링</span><h3>이번 주 공부, 혼자 고민하지 마세요</h3><p>학습 기록과 고민을 보내면 다음 주 방향을 구체적인 피드백으로 정리해 드려요.</p></div><CoachingMark /><button type="button">이번 주 코칭 신청하기 <b>›</b></button></section><section className="coaching-history"><div className="coaching-history-head"><div><span>코칭 내역</span><h3>이번 주 점검</h3></div></div><div className="coaching-segment"><button type="button" className="active">이번 주 점검</button><button type="button">받은 피드백</button></div><div className="coaching-history-list"><div className="coaching-history-row coaching-session-row"><span className="coaching-session-status"><i /></span><span className="coaching-session-copy"><small>이번 주 · SKY 튜터</small><b>주간 학습 점검</b><em>검토 대기</em></span><strong>›</strong></div></div></section></div>;
}

function LockedFeaturePreview({ target = '' }) {
  if (['planner', 'plannerAdd'].includes(target)) return <PlannerLockedPreview />;
  if (['report', 'reportDetail', 'proElite', 'tutor'].includes(target)) return <ProLockedPreview />;
  return <CoachingLockedPreview />;
}

export function LockedFeatureScreen(ctx) {
  const { lockedFeatureLabel = '', lockedFeatureTarget = '', lockedFeatureTier = '', tab = 'home', upgradePromptTarget = '', upgradePromptTier = '' } = ctx;
  const label = lockedFeatureLabel || upgradePromptTarget || '선택한 기능';
  const tier = requiredTierLabel(lockedFeatureTier || upgradePromptTier || 'standard');
  const panel = <section className={`locked-feature-panel ${lockedFeatureTarget === 'strategy' ? 'locked-feature-panel-inline' : ''}`}><span className="badge">잠긴 기능</span><h3>{label} 기능은 {tier} 플랜에서 열려요</h3><p>{lockedFeatureTarget === 'strategy' ? '아래 화면처럼 주간 점검과 튜터 피드백이 연결되며, 업그레이드 후 바로 이어서 사용할 수 있어요.' : '아래 화면처럼 플래너와 피드백이 연결되며, 업그레이드 후 바로 이어서 사용할 수 있어요.'}</p><div className="locked-feature-actions"><button type="button" className="btn btn-primary" data-action="goto" data-target="proIntro">{tier} 플랜 보기</button>{lockedFeatureTarget === 'strategy' ? null : <button type="button" className="btn btn-secondary" data-action="back">돌아가기</button>}</div></section>;
  if (lockedFeatureTarget === 'strategy') return <SecondaryScreenShell screen="lockedFeature" tab={tab}><div className="locked-feature-center-shell"><div className="locked-coach-preview-wrap"><LockedFeaturePreview target={lockedFeatureTarget} /></div>{panel}</div></SecondaryScreenShell>;
  return <SecondaryScreenShell screen="lockedFeature" title={label} tab={tab}><div className="locked-feature-page"><div className="locked-feature-preview-wrap"><LockedFeaturePreview target={lockedFeatureTarget} /><div className="locked-feature-fade" aria-hidden="true" />{panel}</div></div></SecondaryScreenShell>;
}

export function ProIntroScreen({ checkoutPlan = 'Standard', upgradePromptTarget = '', upgradePromptTier = '' }) {
  const requiredPlan = upgradePromptTier ? requiredTierLabel(upgradePromptTier) : '';
  return <SecondaryScreenShell screen="proIntro" title="플랜 선택"><section className="sc-secondary-page plan-console-page"><SecondaryIntro eyebrow="MEMBERSHIP" title="나에게 맞는 플랜" description="플랜을 선택하면 가격과 이용 기능이 같은 기준으로 바뀝니다." aside={<span className="sc-chip">{planDisplayName(checkoutPlan)}</span>} />{requiredPlan ? <div className="card locked-upgrade-card"><span className="badge">잠긴 기능</span><h3>{upgradePromptTarget || '선택한 기능'}은 {requiredPlan} 이상에서 이용할 수 있어요.</h3><p>요금제를 업그레이드하면 하단 탭은 그대로 유지하면서 해당 기능이 바로 열립니다.</p></div> : null}<PlanSelector checkoutPlan={checkoutPlan} /><SelectedPlanDetail checkoutPlan={checkoutPlan} /></section></SecondaryScreenShell>;
}

export function PaymentScreen({ checkoutPlan = 'Standard', duration = '4주' }) {
  const hasDurationChoice = ['Standard', 'Pro'].includes(checkoutPlan);
  return <SecondaryScreenShell screen="payment" title="결제 플랜 확인"><section className="sc-secondary-page payment-console-page"><SecondaryIntro eyebrow="CHECKOUT" title="결제 전 확인" description="선택한 플랜과 기간을 확인한 뒤 안전한 웹 결제로 이동합니다." aside={<span className="sc-chip">{planDisplayName(checkoutPlan)}</span>} /><PlanSelector checkoutPlan={checkoutPlan} />{hasDurationChoice ? <div className="payment-option-block"><b>결제 기간</b><div className="duration-row payment-duration-row">{['4주', '8주', '12주'].map((option) => <button type="button" className={duration === option ? 'active' : ''} data-action="selectDuration" data-duration={option} key={option}>{option}</button>)}</div></div> : <div className="payment-fixed-term"><span>결제 단위</span><b>{checkoutPlan === 'Starter' ? '1회 진단' : '4주 이용'}</b></div>}<SelectedPlanDetail checkoutPlan={checkoutPlan} ctaLabel="웹 결제로 계속하기" ctaAction="openWebPayment" /></section></SecondaryScreenShell>;
}

export function PaymentCompleteScreen() {
  return <SecondaryScreenShell screen="paymentComplete"><div className="sc-secondary-page payment-done-screen"><SecondaryIntro eyebrow="SECURE PAYMENT" title="웹 결제에서 계속할게요" description="전화번호 확인과 결제 인증은 기존 웹 결제 페이지에서 안전하게 진행됩니다." /><section className="sc-secondary-section payment-complete-wrap"><div className="payment-check"><ServiceIcon name="check" primary /></div><div><p className="payment-complete-title">결제 상태는 서버 확인 후 반영됩니다</p><p className="payment-complete-sub">모바일 앱이 결제 완료 상태를 임의로 만들지 않습니다.</p></div><div className="payment-complete-note"><b>안전한 결제 안내</b><p>NICEPAY 인증이 끝나면 구독 정보가 계정에 반영됩니다.</p></div><button type="button" className="btn btn-primary payment-cta" data-action="openWebPayment">웹 결제 페이지로 이동</button></section></div></SecondaryScreenShell>;
}

import { renderTermsModal } from '../../components/terms-modal.js';
import { DEFAULT_USER } from '../../constants/mock-data.js';
import { TERMS_CONTENT } from '../../constants/terms.js';

function defaultIcon() {
  return '';
}

function renderProfileEditModal(ctx) {
  const {
    analysisTargetList = [],
    myProfileEditOpen = false,
    myProfileNameDraft = '',
    myProfileTargetDraft = ''
  } = ctx;

  if (!myProfileEditOpen) return '';

  return `<div class="home-modal-overlay" data-action="closeMyProfileEdit"><div class="home-modal my-profile-edit-modal" data-action="noopModal"><p class="home-modal-title">프로필 수정</p><div class="my-profile-edit-fields"><label>이름</label><input class="planner-input" data-field="myProfileNameDraft" value="${myProfileNameDraft}" placeholder="이름"/></div><div class="my-profile-edit-fields"><label>목표 대학</label><select class="planner-input" data-field="myProfileTargetDraft">${analysisTargetList.map((major) => `<option value="${major}" ${myProfileTargetDraft === major ? 'selected' : ''}>${major}</option>`).join('')}</select></div><div class="support-btns my-profile-edit-actions"><button class="btn btn-secondary" data-action="closeMyProfileEdit">취소</button><button class="btn btn-primary" data-action="saveMyProfileEdit">저장</button></div></div></div>`;
}

function renderLogoutModal(logoutModalOpen = false) {
  if (!logoutModalOpen) return '';
  return `<div class="home-modal-overlay" data-action="closeLogoutModal"><div class="home-modal" data-action="noopModal"><p class="home-modal-title">로그아웃하시겠어요?</p><div class="support-btns"><button class="btn btn-secondary" data-action="closeLogoutModal">취소</button><button class="btn btn-primary" data-action="confirmLogout">로그아웃</button></div></div></div>`;
}

function renderWithdrawModal({ withdrawModalOpen = false, withdrawPassword = '' }) {
  if (!withdrawModalOpen) return '';
  return `<div class="home-modal-overlay" data-action="closeWithdrawModal"><div class="home-modal" data-action="noopModal"><p class="home-modal-title">회원탈퇴</p><p class="sub" style="margin:8px 0 12px;">현재 비밀번호를 입력하면 탈퇴할 수 있습니다.</p><input class="planner-input" type="password" data-field="withdrawPassword" value="${withdrawPassword}" placeholder="현재 비밀번호"/><div class="support-btns" style="margin-top:12px"><button class="btn btn-secondary" data-action="closeWithdrawModal">취소</button><button class="btn btn-primary" data-action="confirmWithdraw">탈퇴하기</button></div></div></div>`;
}

export function renderMyPageScreen(ctx) {
  const {
    analysisTargetList = [],
    appbar,
    icon = defaultIcon,
    layout,
    mbtiResult,
    selectedPlan,
    targetMajor,
    user
  } = ctx;

  return layout(appbar('마이페이지', false) + `<div class="my-stack">
      <button type="button" class="card my-profile-card" data-action="openMyProfileEdit"><div class="my-profile-left"><div class="my-avatar">${icon('user', false)}</div><div><p class="my-name">${user?.name || DEFAULT_USER.name}</p><p class="sub">목표 대학: ${targetMajor || DEFAULT_USER.targetUniversity}</p></div></div><div class="my-profile-right"><span class="top-infographic top-infographic-my" aria-hidden="true"><i></i><i></i><i></i></span><span class="badge">${selectedPlan || DEFAULT_USER.plan} 이용 중</span></div></button>
      ${renderProfileEditModal({ ...ctx, analysisTargetList })}
      ${mbtiResult ? `<div class="card" style="border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-secondary" disabled>맞춤 공부법 PDF 준비 중</button></div>` : ''}
      <div class="card my-subscription-card"><div class="my-sub-icon">${icon('report', false)}</div><div><p class="my-sub-title">Pro 플랜 이용 중</p><p class="my-sub-date">다음 결제일 2024.06.14</p></div></div>
      <div class="card my-menu-card">
        <button class="my-row" data-action="goto" data-target="qualInfo">정성조사서 <span>${icon('chevron', false)}</span></button><button class="my-row" data-action="goto" data-target="scoreInfo">성적 정보 <span>${icon('chevron', false)}</span></button>

        <button class="my-row" data-action="goto" data-target="proIntro">구독 관리 <span>${icon('chevron', false)}</span></button>
      </div>
      <div class="card my-menu-card my-service-card">
        <p class="my-section-title">서비스</p>
        <button class="my-row" data-action="goto" data-target="notificationSettings">알림 설정 <span>${icon('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="customerSupport">고객센터 <span>${icon('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="settingsMain">설정 <span>${icon('chevron', false)}</span></button>
      </div>
    </div>`, true);
}

export function renderNotificationSettingsScreen(ctx) {
  const {
    appbar,
    layout,
    notifications = {}
  } = ctx;

  const rows = [
    ['planner', '플래너 알림', '오늘 계획을 잊지 않도록 알려드려요'],
    ['weekly', '주간 점검 알림', '매주 점검 시점을 알려드려요'],
    ['report', '프로 보고서 알림', '새 리포트 이용 가능일을 알려드려요'],
    ['billing', '결제/구독 알림', '다음 결제일을 미리 알려드려요']
  ];

  return layout(appbar('알림 설정', true) + `<div class="card notify-card">${rows.map(([key, title, desc]) => `<button class="notify-row" data-action="toggleNotification" data-notify-key="${key}"><div><b>${title}</b><p>${desc}</p></div><span class="notify-switch ${notifications[key] ? 'on' : ''}"><i></i></span></button>`).join('')}</div>`, false);
}

export function renderCustomerSupportScreen(ctx) {
  const {
    appbar,
    icon = defaultIcon,
    layout,
    openFaq
  } = ctx;

  const faqs = [
    ['faq1', '분석 결과는 얼마나 정확한가요?', '스터디크랙의 분석 엔진은 최근 3개년의 합격자 표본과 대학별 환산식을 기반으로 계산됩니다. 단순 등급이 아닌 대학별 실질 환산 점수를 사용하여 높은 정확도를 제공합니다.'],
    ['faq2', '목표 대학을 중간에 변경할 수 있나요?', '네, 가능합니다. 목표 대학을 수정하면 즉시 새로운 분석 결과가 반영됩니다.'],
    ['faq3', '환불 규정이 궁금합니다.', '결제 후 목표 대학 설정 전까지는 전액 환불이 가능합니다. 목표 대학 설정 이후에는 콘텐츠 이용으로 간주되어 환불이 제한될 수 있습니다.'],
    ['faq4', '다른 서비스랑 뭐가 다른가요?', '스터디크랙은 실제 합격 데이터를 기반으로 개인 전략을 설계해주는 서비스입니다. 막연한 가능성이 아니라 어디를, 왜, 어떻게 써야 하는지까지 제시합니다.'],
    ['faq5', '지금 시작해도 늦지 않았나요?', '오히려 지금이 가장 중요합니다. 입시는 얼마나 많이가 아니라 얼마나 정확하게 하느냐가 결과를 좌우합니다.'],
    ['faq6', '성적이 애매한데 효과가 있을까요?', '성적이 애매할수록 전략이 더 중요합니다. 상위권은 유지가 핵심이지만, 중위권은 전략에 따라 결과가 크게 갈립니다.'],
    ['faq7', '혼자 해도 되는 거 아닌가요?', '가능합니다. 하지만 잘못된 방향으로 공부하면 시간은 쓰고 결과는 안 나옵니다. 스터디크랙은 시행착오를 줄여줍니다.'],
    ['faq8', '어떤 플랜을 선택해야 할지 모르겠어요.', '빠르게 방향만 잡고 싶다면 Basic, 루틴 관리까지 원하면 Standard, 확실한 결과를 원하면 Pro를 추천합니다.']
  ];

  return layout(appbar('고객센터', true) + `<div class="card"><p class="analysis-title">궁금한 점이 있으면 언제든 문의해주세요.</p><p class="sub" style="margin:0">운영 시간: 평일 10:00 - 18:00</p><div class="support-btns"><button class="btn btn-secondary" data-action="openKakaoSupport">카카오톡 문의하기</button><button class="btn btn-secondary" data-action="openEmailSupport">이메일 문의하기</button></div></div><div class="card faq-card">${faqs.map(([id, q, a]) => `<button class="faq-row" data-action="toggleFaq" data-faq-id="${id}"><div><b>${q}</b>${openFaq === id ? `<p>${a}</p>` : ''}</div><span>${icon('chevron', false)}</span></button>`).join('')}</div>`, false);
}

export function renderSettingsMainScreen(ctx) {
  const {
    appbar,
    icon = defaultIcon,
    layout,
    logoutModalOpen,
    openTermsType,
    termsContent = TERMS_CONTENT
  } = ctx;

  return layout(appbar('설정', true) + `<div class="card settings-list"><button data-action="goto" data-target="accountInfo">계정 정보 <span>${icon('chevron', false)}</span></button><button data-action="goto" data-target="settingsTermsPicker">약관 보기 <span>${icon('chevron', false)}</span></button><button data-action="openLogoutModal">로그아웃 <span>${icon('chevron', false)}</span></button></div>${renderLogoutModal(logoutModalOpen)}${renderTermsModal(openTermsType, termsContent)}`, false);
}

export function renderSettingsTermsPickerScreen(ctx) {
  const {
    appbar,
    icon = defaultIcon,
    layout,
    openTermsType,
    termsContent = TERMS_CONTENT
  } = ctx;

  return layout(appbar('약관 보기', true) + `<div class="card settings-list"><button type="button" data-action="openTermsModal" data-terms-type="standard">표준 이용약관 <span>${icon('chevron', false)}</span></button><button type="button" data-action="openTermsModal" data-terms-type="privacy">개인정보 처리방침 <span>${icon('chevron', false)}</span></button><button type="button" data-action="openTermsModal" data-terms-type="service">서비스 이용약관 <span>${icon('chevron', false)}</span></button><button type="button" data-action="openTermsModal" data-terms-type="refund">환불규정 <span>${icon('chevron', false)}</span></button><button type="button" data-action="openTermsModal" data-terms-type="marketing">마케팅 수신 정보 동의 <span>${icon('chevron', false)}</span></button></div>${renderTermsModal(openTermsType, termsContent)}`, false);
}

export function renderAccountInfoScreen(ctx) {
  const {
    appbar,
    layout,
    selectedPlan,
    targetMajor,
    user,
    withdrawModalOpen,
    withdrawPassword
  } = ctx;

  return layout(appbar('계정 정보', true) + `<div class="card"><div class="score-info-row"><span>이름</span><strong>${user?.name || DEFAULT_USER.name}</strong></div><div class="score-info-row"><span>목표 대학</span><strong>${targetMajor || DEFAULT_USER.targetUniversity}</strong></div><div class="score-info-row"><span>현재 플랜</span><strong>${selectedPlan || DEFAULT_USER.plan}</strong></div><button class="btn btn-secondary" style="margin-top:14px" data-action="openWithdrawModal">회원탈퇴</button></div>${renderWithdrawModal({ withdrawModalOpen, withdrawPassword })}`, false);
}

export function renderPrivacyPolicyScreen({ appbar, layout }) {
  return layout(appbar('개인정보 처리방침', true) + `<div class="card"><p class="sub" style="margin:0">스터디크랙은 서비스 제공을 위해 필요한 최소한의 개인정보를 처리합니다.</p></div>`, false);
}

export function renderTermsScreen({ appbar, layout }) {
  return layout(appbar('서비스 이용약관', true) + `<div class="card"><p class="sub" style="margin:0">본 약관은 스터디크랙 서비스 이용과 관련한 기본 사항을 안내합니다.</p></div>`, false);
}

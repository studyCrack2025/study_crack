import { renderModal } from '../../components/modal.js';
import { renderMbtiModal } from '../../components/mbti-modal.js';
import { renderTermsModal } from '../../components/terms-modal.js';
import { TERMS_CONTENT } from '../../constants/terms.js';

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

function formatQnaDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatMarketingConsentDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function displayEmail(user = {}) {
  const raw = user.socialEmail || user.email || '';
  return raw.includes('@social.studycrack.co.kr') ? '소셜 계정 이메일 미제공' : raw || '등록된 이메일 없음';
}

function providerLabel(provider = '') {
  if (provider === 'google') return 'Google';
  if (provider === 'naver') return 'Naver';
  return provider || '';
}

function displayName(user = {}) {
  return String(user?.name || '').trim() || '회원';
}

function displayPlan(plan = '') {
  return String(plan || '').trim() || '미구독';
}

function displayPlanStatus(plan = '') {
  const label = displayPlan(plan);
  return label === '미구독' ? '이용권 없음' : `${label} 이용 중`;
}

// 기간 제한 없는 상품(Basic/Starter)은 endDate가 있어도 평생 이용으로 표시한다. (구독 표시 규칙: 계획 §구독 정보 통합)
function isLifetimePlan(tier = '') {
  const raw = String(tier || '').toLowerCase();
  return raw.includes('basic') || raw.includes('starter');
}

function formatSubDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

// 상단 카드/상세 모달 공용 구독 요약. 정기결제 스키마 미확정이라 '다음 결제일' 대신 '이용 종료 예정일' 사용.
function buildSubscriptionSummary(user = {}, selectedPlan = '') {
  const sub = user?.currentSubscription && typeof user.currentSubscription === 'object' ? user.currentSubscription : null;
  const pending = user?.pendingSubscription && typeof user.pendingSubscription === 'object' ? user.pendingSubscription : null;
  const planLabel = displayPlan(selectedPlan);
  const tier = (sub && sub.tier) || selectedPlan;
  const hasPlan = planLabel !== '미구독';
  const lifetime = hasPlan && isLifetimePlan(tier);
  const startDate = sub ? formatSubDate(sub.startDate) : '';
  const endDate = sub ? formatSubDate(sub.endDate) : '';
  let periodLine = '';
  if (!hasPlan) periodLine = '이용권 없음';
  else if (lifetime) periodLine = '평생 이용';
  else if (endDate) periodLine = `${endDate}까지`;
  else periodLine = '이용 기간 정보 없음';
  const pendingLine = pending && pending.tier
    ? `다음 플랜 ${displayPlan(pending.tier)}${pending.startDate ? ` · ${formatSubDate(pending.startDate)} 시작` : ''}`
    : '';
  return { planLabel, hasPlan, lifetime, startDate, endDate, periodLine, pendingLine };
}

function canViewTutorInfo(plan = '', user = {}) {
  const raw = String(user?.computedTier || user?.tier || plan || '').toLowerCase();
  return raw.includes('standard') || raw.includes('pro');
}

function renderProfileAvatar(user = {}, icon = defaultIcon, className = '') {
  const image = String(user?.profileImage || '').trim();
  if (image) return `<img class="${escapeHtml(className)}" src="${escapeHtml(image)}" alt="프로필 사진" loading="lazy"/>`;
  return icon('user', false);
}

function renderTutorInfo(user = {}, selectedPlan = '') {
  if (!canViewTutorInfo(selectedPlan, user)) return '';
  const tutor = user?.tutorInfo && typeof user.tutorInfo === 'object' ? user.tutorInfo : {};
  const name = tutor.nickname || user?.tutorName || '배정 튜터 확인 중';
  const schoolMajor = [tutor.school, tutor.major].filter(Boolean).join(' · ');
  const strengths = Array.isArray(tutor.strengths) ? tutor.strengths.join(' · ') : (tutor.strengths || '');
  const tutorImage = tutor.profileImage ? `<img src="${escapeHtml(tutor.profileImage)}" alt="튜터 프로필" loading="lazy"/>` : '<span>T</span>';

  return `<section class="profile-detail-section profile-tutor-card"><div class="profile-tutor-photo">${tutorImage}</div><div><p class="profile-detail-kicker">담당 튜터</p><h4>${escapeHtml(name)}</h4>${schoolMajor ? `<p>${escapeHtml(schoolMajor)}</p>` : ''}${strengths ? `<small>${escapeHtml(strengths)}</small>` : ''}${tutor.message ? `<em>${escapeHtml(tutor.message)}</em>` : ''}</div></section>`;
}

function renderProfileDetailModal(ctx) {
  const {
    icon = defaultIcon,
    profileDetailModalOpen = false,
    profilePhotoUploading = false,
    selectedPlan,
    user = {}
  } = ctx;

  if (!profileDetailModalOpen) return '';

  const sub = buildSubscriptionSummary(user, selectedPlan);
  const subRows = `<div class="profile-detail-row"><span>현재 플랜</span><strong>${escapeHtml(sub.planLabel)}</strong></div>
      ${sub.hasPlan && sub.startDate ? `<div class="profile-detail-row"><span>이용 시작일</span><strong>${escapeHtml(sub.startDate)}</strong></div>` : ''}
      <div class="profile-detail-row"><span>${sub.lifetime ? '이용 기간' : '이용 종료 예정일'}</span><strong>${escapeHtml(sub.lifetime ? '평생 이용' : (sub.endDate || (sub.hasPlan ? '정보 없음' : '이용권 없음')))}</strong></div>
      ${sub.pendingLine ? `<div class="profile-detail-row"><span>예약 플랜</span><strong>${escapeHtml(sub.pendingLine)}</strong></div>` : ''}`;
  const body = `<div class="profile-detail-modal-head"><p class="home-modal-title">계정 및 구독 정보</p><button type="button" class="qna-modal-close" data-action="closeProfileDetailModal">✕</button></div>
    <div class="profile-detail-hero">
      <div class="profile-photo-large">${renderProfileAvatar(user, icon, 'profile-photo-img')}</div>
      <div class="profile-photo-copy"><strong>${escapeHtml(displayName(user))}</strong><span>${escapeHtml(displayPlanStatus(selectedPlan))}</span></div>
    </div>
    <div class="profile-photo-actions">
      <label class="profile-photo-pick">
        <input class="profile-photo-input" type="file" accept="image/*" data-profile-photo-input/>
        <svg class="profile-photo-pick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <span class="profile-photo-pick-text">사진 선택</span>
      </label>
      <button type="button" class="btn btn-primary profile-photo-save" data-action="saveProfilePhoto" ${profilePhotoUploading ? 'disabled' : ''}>${profilePhotoUploading ? '업로드 중…' : '사진 저장'}</button>
    </div>
    <section class="profile-detail-section">
      <div class="profile-detail-row"><span>이름</span><strong>${escapeHtml(displayName(user))}</strong></div>
      <div class="profile-detail-row"><span>이메일</span><strong>${escapeHtml(displayEmail(user))}</strong></div>
      <div class="profile-detail-row"><span>전화번호</span><strong>${escapeHtml(user?.phone || '등록된 번호 없음')}</strong></div>
    </section>
    <section class="profile-detail-section">
      ${subRows}
    </section>
    ${renderTutorInfo(user, selectedPlan)}
    <section class="profile-detail-section profile-detail-actions-section">
      <div class="profile-detail-actions">
        <button type="button" class="profile-action-row" data-action="openMyProfileEdit"><span>이름 변경</span><i aria-hidden="true">${icon('chevron', false)}</i></button>
        <button type="button" class="profile-action-row" data-action="openPhoneChangeModal"><span>${user?.phone ? '전화번호 변경' : '전화번호 등록'}</span><i aria-hidden="true">${icon('chevron', false)}</i></button>
        <button type="button" class="profile-action-row" data-action="goto" data-target="accountInfo"><span>소셜 로그인 관리</span><i aria-hidden="true">${icon('chevron', false)}</i></button>
      </div>
    </section>`;
  return renderModal({ panelClass: 'profile-detail-modal', dismissAction: 'closeProfileDetailModal', body });
}

function qnaStatusLabel(status = '') {
  if (String(status).toLowerCase() === 'done') return '답변 완료';
  if (String(status).toLowerCase() === 'read') return '확인 중';
  return '답변 대기';
}

function renderProfileEditModal(ctx) {
  const {
    myProfileEditOpen = false,
    myProfileNameDraft = ''
  } = ctx;

  if (!myProfileEditOpen) return '';

  const body = `<p class="home-modal-title">프로필 수정</p><div class="my-profile-edit-fields"><label>이름</label><input class="planner-input" data-field="myProfileNameDraft" value="${escapeHtml(myProfileNameDraft)}" placeholder="이름"/></div><p class="sub" style="margin:8px 0 0;">목표 대학은 분석 탭에서 관리합니다.</p><div class="support-btns my-profile-edit-actions"><button class="btn btn-secondary" data-action="closeMyProfileEdit">취소</button><button class="btn btn-primary" data-action="saveMyProfileEdit">저장</button></div>`;
  return renderModal({ panelClass: 'my-profile-edit-modal', dismissAction: 'closeMyProfileEdit', body });
}

function renderLogoutModal(logoutModalOpen = false) {
  if (!logoutModalOpen) return '';
  const body = `<p class="home-modal-title">로그아웃하시겠어요?</p><div class="support-btns"><button class="btn btn-secondary" data-action="closeLogoutModal">취소</button><button class="btn btn-primary" data-action="confirmLogout">로그아웃</button></div>`;
  return renderModal({ dismissAction: 'closeLogoutModal', body });
}

function renderWithdrawModal({ withdrawModalOpen = false, withdrawPassword = '' }) {
  if (!withdrawModalOpen) return '';
  const body = `<p class="home-modal-title">회원탈퇴</p><p class="sub" style="margin:8px 0 12px;">현재 비밀번호를 입력하면 탈퇴할 수 있습니다.</p><input class="planner-input" type="password" data-field="withdrawPassword" value="${withdrawPassword}" placeholder="현재 비밀번호"/><div class="support-btns" style="margin-top:12px"><button class="btn btn-secondary" data-action="closeWithdrawModal">취소</button><button class="btn btn-primary" data-action="confirmWithdraw">탈퇴하기</button></div>`;
  return renderModal({ dismissAction: 'closeWithdrawModal', body });
}

function renderPhoneChangeModal(ctx) {
  const {
    myProfilePhoneCodeDraft = '',
    myProfilePhoneDraft = '',
    phoneChangeModalOpen = false,
    phoneChangeSending = false,
    phoneChangeStep = 'input'
  } = ctx;
  if (!phoneChangeModalOpen) return '';
  const body = phoneChangeStep === 'verify'
    ? `<p class="home-modal-title">전화번호 인증</p><p class="sub" style="margin:8px 0 12px;">${escapeHtml(myProfilePhoneDraft || '입력한 번호')}로 받은 인증번호를 입력해주세요.</p><input class="planner-input" data-field="myProfilePhoneCodeDraft" inputmode="numeric" value="${escapeHtml(myProfilePhoneCodeDraft)}" placeholder="인증번호 6자리"/><div class="support-btns" style="margin-top:12px"><button class="btn btn-secondary" data-action="requestPhoneChange" ${phoneChangeSending ? 'disabled' : ''}>재전송</button><button class="btn btn-primary" data-action="verifyPhoneChange">인증 후 변경</button></div><button class="text-link-btn phone-change-cancel" data-action="closePhoneChangeModal">취소</button>`
    : `<p class="home-modal-title">전화번호 변경</p><p class="sub" style="margin:8px 0 12px;">결제 확인, 알림톡, 중요 공지 수신에 사용할 휴대폰 번호를 인증합니다.</p><input class="planner-input" data-field="myProfilePhoneDraft" inputmode="tel" value="${escapeHtml(myProfilePhoneDraft)}" placeholder="01012345678"/><p class="phone-change-hint">숫자만 입력해도 자동으로 인증 형식에 맞춰 전송됩니다.</p><div class="support-btns" style="margin-top:12px"><button class="btn btn-secondary" data-action="closePhoneChangeModal">취소</button><button class="btn btn-primary" data-action="requestPhoneChange" ${phoneChangeSending ? 'disabled' : ''}>${phoneChangeSending ? '전송 중' : '인증번호 전송'}</button></div>`;
  return renderModal({ panelClass: 'phone-change-modal', dismissAction: 'closePhoneChangeModal', body });
}

function renderSocialAccountRows(user = {}) {
  const primaryProvider = user.authProvider || 'local';
  const linked = Array.isArray(user.linkedProviders) ? user.linkedProviders : [];
  const linkedSet = new Set(linked.map((item) => item.provider));
  if (primaryProvider !== 'local') linkedSet.add(primaryProvider);
  const providers = [
    { key: 'google', label: 'Google', mark: 'G' },
    { key: 'naver', label: 'Naver', mark: 'N' }
  ];
  return providers.map((provider) => {
    const isLinked = linkedSet.has(provider.key);
    const isPrimary = primaryProvider === provider.key;
    return `<div class="mobile-social-row"><div class="mobile-social-info"><span class="mobile-social-mark ${provider.key}">${provider.mark}</span><div><b>${provider.label}</b><small>${isPrimary ? '기본 로그인 계정' : isLinked ? '연동된 계정' : '미연동'}</small></div></div><div class="mobile-social-action">${isLinked ? `<span class="social-badge linked">연동됨</span>${isPrimary ? '' : `<button type="button" class="social-action-btn unlink-btn" data-action="unlinkSocial" data-provider="${provider.key}">해제</button>`}` : `<span class="social-badge unlinked">미연동</span><button type="button" class="social-action-btn link-btn" data-action="linkSocial" data-provider="${provider.key}">연동</button>`}</div></div>`;
  }).join('');
}

function renderSupportQnaComposerModal(ctx) {
  const {
    qnaComposerOpen = false,
    qnaDraftContent = '',
    qnaDraftTitle = '',
    qnaSubmitting = false
  } = ctx;

  if (!qnaComposerOpen) return '';

  const body = `<div class="qna-modal-head"><h4>1:1 문의 작성</h4><button class="qna-modal-close" data-action="closeQnaComposer">✕</button></div><div class="qna-modal-body"><label>문의 제목</label><input class="planner-input" data-field="qnaDraftTitle" value="${escapeHtml(qnaDraftTitle)}" maxlength="80" placeholder="예: 결제 후 이용 권한이 궁금해요"/><label>문의 내용</label><textarea class="planner-input qna-textarea" data-field="qnaDraftContent" maxlength="1000" placeholder="현재 상황과 궁금한 점을 구체적으로 적어주세요.">${escapeHtml(qnaDraftContent)}</textarea><div class="qna-modal-actions"><button class="btn btn-secondary" data-action="closeQnaComposer">취소</button><button class="btn btn-primary" data-action="submitMobileQna" ${qnaSubmitting ? 'disabled' : ''}>${qnaSubmitting ? '접수 중' : '문의 접수'}</button></div></div>`;
  return renderModal({ panelClass: 'qna-modal', dismissAction: 'closeQnaComposer', body });
}

function renderSupportQnaList({ qnaHistory = [], qnaStatus = 'idle' }) {
  if (qnaStatus === 'loading') return '<div class="coach-empty">문의 내역을 불러오는 중입니다.</div>';
  if (qnaStatus === 'error') return '<div class="coach-empty">문의 내역을 불러오지 못했습니다.</div>';
  if (!qnaHistory.length) return '<div class="coach-empty">아직 남긴 문의가 없습니다.</div>';

  return qnaHistory.map((item) => {
    const done = String(item.status || '').toLowerCase() === 'done';
    const created = formatQnaDate(item.createdAt);
    return `<article class="qna-list-row"><div class="qna-row-main"><b>${escapeHtml(item.title || '제목 없는 문의')}</b><p>${escapeHtml(item.content || '문의 내용 없음')}</p>${done && item.answer ? `<small>답변: ${escapeHtml(item.answer)}</small>` : ''}</div><div class="qna-row-side"><em class="${done ? 'done' : ''}">${qnaStatusLabel(item.status)}</em>${created ? `<span>${escapeHtml(created)}</span>` : ''}</div></article>`;
  }).join('');
}

export function renderMyPageScreen(ctx) {
  const {
    appbar,
    icon = defaultIcon,
    layout,
    mbtiResult,
    selectedPlan,
    user
  } = ctx;
  const planStatus = displayPlanStatus(selectedPlan);
  const sub = buildSubscriptionSummary(user, selectedPlan);
  const cardSummary = sub.hasPlan ? `${sub.planLabel} · ${sub.periodLine}` : '계정 및 구독 정보';

  return layout(appbar('마이페이지', false) + `<div class="my-stack">
      <button type="button" class="card my-profile-card" data-action="openProfileDetailModal"><div class="my-profile-left"><div class="my-avatar">${renderProfileAvatar(user, icon, 'my-avatar-img')}</div><div><p class="my-name">${escapeHtml(displayName(user))}</p><p class="sub">${escapeHtml(cardSummary)}</p></div></div><div class="my-profile-right"><span class="top-infographic top-infographic-my" aria-hidden="true"><i></i><i></i><i></i></span><span class="badge">${escapeHtml(planStatus)}</span></div></button>
      ${renderProfileDetailModal(ctx)}
      ${renderProfileEditModal(ctx)}
      ${mbtiResult ? `<div class="card" style="border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-secondary" disabled>맞춤 공부법 PDF 준비 중</button></div>` : ''}
      <div class="card my-menu-card">
        <button class="my-row" data-action="goto" data-target="qualInfo">정성조사서 <span>${icon('chevron', false)}</span></button><button class="my-row" data-action="goto" data-target="scoreInfo">성적 정보 <span>${icon('chevron', false)}</span></button>

        <button class="my-row" data-action="goto" data-target="proIntro">구독 관리 <span>${icon('chevron', false)}</span></button>
      </div>
      <div class="card my-menu-card my-service-card">
        <p class="my-section-title">서비스</p>
        <button class="my-row" data-action="goto" data-target="notificationSettings">알림 설정 <span>${icon('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="customerSupport">고객센터 <span>${icon('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="notificationList">알림 <span>${icon('chevron', false)}</span></button>
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

// 알림 목록 화면(전체): 홈 알림 팝오버의 '전체 보기'/마이페이지 진입 대상.
const NOTI_PAGE_SIZE = 8;

export function renderNotificationListScreen(ctx) {
  const {
    appbar,
    layout,
    notiList = [],
    notiStatus = 'idle',
    notiPage = 0,
    notiExpandedId = ''
  } = ctx;

  const list = Array.isArray(notiList) ? notiList : [];
  if (!list.length) {
    const emptyText = notiStatus === 'loading'
      ? '알림을 불러오는 중...'
      : notiStatus === 'error'
        ? '알림을 불러오지 못했습니다.'
        : '받은 알림이 없습니다.';
    return layout(appbar('알림', true) + `<div class="card noti-list-card"><div class="noti-list-empty"><p>${emptyText}</p></div></div>`, false);
  }

  const totalPages = Math.max(1, Math.ceil(list.length / NOTI_PAGE_SIZE));
  const page = Math.min(Math.max(0, notiPage), totalPages - 1);
  const start = page * NOTI_PAGE_SIZE;
  const pageItems = list.slice(start, start + NOTI_PAGE_SIZE);

  const itemsHtml = pageItems
    .map((n, idx) => {
      const id = String(n.id || n.notificationId || `${start + idx}`);
      const expanded = notiExpandedId === id;
      const date = formatQnaDate(n.createdAt);
      const fullBody = escapeHtml(n.body || n.message || '');
      return `<button type="button" class="noti-list-row ${n.isRead ? '' : 'is-unread'} ${expanded ? 'is-open' : ''}" data-action="toggleNotiDetail" data-noti-id="${escapeHtml(id)}">
        <span class="noti-list-dot" aria-hidden="true"></span>
        <span class="noti-list-main">
          <b>${escapeHtml(n.title || '알림')}</b>
          <p class="noti-list-body ${expanded ? 'is-full' : ''}">${fullBody || '내용이 없습니다.'}</p>
          ${date ? `<span class="noti-list-date">${escapeHtml(date)}</span>` : ''}
        </span>
        <span class="noti-list-chev" aria-hidden="true">${expanded ? '▴' : '▾'}</span>
      </button>`;
    })
    .join('');

  const pager = totalPages > 1
    ? `<div class="noti-pager">
        <button type="button" class="noti-pager-btn" data-action="notiPrevPage" ${page === 0 ? 'disabled' : ''}>이전</button>
        <span class="noti-pager-count">${page + 1} / ${totalPages}</span>
        <button type="button" class="noti-pager-btn" data-action="notiNextPage" ${page >= totalPages - 1 ? 'disabled' : ''}>다음</button>
      </div>`
    : '';

  return layout(appbar('알림', true) + `<div class="card noti-list-card">${itemsHtml}</div>${pager}`, false);
}

export function renderCustomerSupportScreen(ctx) {
  const {
    appbar,
    icon = defaultIcon,
    layout,
    openFaq,
    qnaHistory = [],
    qnaStatus = 'idle'
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

  return layout(appbar('고객센터', true) + `<div class="card support-direct-card"><p class="analysis-title">궁금한 점을 바로 남겨주세요.</p><p class="sub" style="margin:0">운영 시간: 평일 10:00 - 18:00</p><div class="support-btns"><button class="btn btn-primary" data-action="openQnaComposer">1:1 문의 작성</button><button class="btn btn-secondary" data-action="openKakaoSupport">카카오톡 문의하기</button></div></div><div class="card support-qna-card"><div class="support-section-head"><p class="analysis-title">내 문의 내역</p>${qnaHistory.length ? `<span>${qnaHistory.length}건</span>` : ''}</div><div class="qna-list compact">${renderSupportQnaList({ qnaHistory, qnaStatus })}</div></div><div class="card faq-card">${faqs.map(([id, q, a]) => `<button class="faq-row" data-action="toggleFaq" data-faq-id="${id}"><div><b>${q}</b>${openFaq === id ? `<p>${a}</p>` : ''}</div><span>${icon('chevron', false)}</span></button>`).join('')}</div>${renderSupportQnaComposerModal(ctx)}`, false);
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
    user,
    withdrawModalOpen,
    withdrawPassword
  } = ctx;
  const marketingAgreed = user?.marketingAgreed === true;
  const marketingDate = formatMarketingConsentDate(user?.marketingAgreedAt);
  const authProvider = user?.authProvider || 'local';
  const hasPhone = Boolean(String(user?.phone || '').trim());

  return layout(appbar('계정 정보', true) + `<div class="account-info-page">
    <section class="card mobile-account-card">
      <div class="account-section-head"><h3>기본 인적사항</h3><span>프로필</span></div>
      <div class="account-info-row"><span>이름</span><strong>${escapeHtml(displayName(user))}</strong></div>
      <div class="account-info-row"><span>탐구 MBTI</span><strong>${escapeHtml(user?.mbti || user?.qualitative?.mbti || '-')}</strong></div>
      <div class="account-action-grid"><button type="button" class="btn btn-secondary account-full-btn" data-action="openMyProfileEdit">이름 변경</button><button type="button" class="btn btn-secondary account-full-btn" data-action="openMbtiModal">탐구 MBTI 수정</button></div>
    </section>
    <section class="card mobile-account-card">
      <div class="account-section-head"><h3>계정 정보 변경</h3><span>${escapeHtml(providerLabel(authProvider) || 'Local')}</span></div>
      <div class="account-info-row"><span>이메일</span><strong>${escapeHtml(displayEmail(user))}</strong></div>
      <div class="account-info-row action phone-row ${hasPhone ? '' : 'missing'}"><span>전화번호</span><strong>${escapeHtml(user?.phone || '등록된 번호 없음')}</strong><button type="button" class="text-link-btn" data-action="openPhoneChangeModal">${hasPhone ? '변경' : '등록'}</button></div>
      ${hasPhone ? '' : '<p class="account-inline-warning">결제와 중요 알림을 위해 전화번호 인증 등록이 필요합니다.</p>'}
      ${authProvider === 'local' ? `<div class="account-info-row action"><span>비밀번호</span><strong>********</strong><button type="button" class="text-link-btn" data-action="openChangePassword">변경</button></div>` : ''}
      <div class="account-marketing-row">
        <div><b>마케팅 수신 동의</b><p>${marketingAgreed ? `${marketingDate || '동의일 확인 중'} 동의` : '미동의 상태입니다.'}</p></div>
        <button type="button" class="notify-switch ${marketingAgreed ? 'on' : ''}" data-action="saveMarketingConsent" data-marketing-agreed="${marketingAgreed ? 'false' : 'true'}"><i></i></button>
      </div>
    </section>
    <section class="card mobile-account-card">
      <div class="account-section-head"><h3>소셜 계정 연동</h3><span>Google · Naver</span></div>
      <div class="mobile-social-list">${renderSocialAccountRows(user)}</div>
    </section>
    <section class="card mobile-account-card danger-zone">
      <div class="account-info-row"><span>현재 플랜</span><strong>${escapeHtml(displayPlan(selectedPlan))}</strong></div>
      <button class="btn btn-secondary account-full-btn" data-action="openWithdrawModal">회원탈퇴</button>
    </section>
  </div>${renderProfileEditModal(ctx)}${renderPhoneChangeModal(ctx)}${renderWithdrawModal({ withdrawModalOpen, withdrawPassword })}${renderMbtiModal(ctx)}`, false);
}

export function renderPrivacyPolicyScreen({ appbar, layout }) {
  return layout(appbar('개인정보 처리방침', true) + `<div class="card"><p class="sub" style="margin:0">스터디크랙은 서비스 제공을 위해 필요한 최소한의 개인정보를 처리합니다.</p></div>`, false);
}

export function renderTermsScreen({ appbar, layout }) {
  return layout(appbar('서비스 이용약관', true) + `<div class="card"><p class="sub" style="margin:0">본 약관은 스터디크랙 서비스 이용과 관련한 기본 사항을 안내합니다.</p></div>`, false);
}

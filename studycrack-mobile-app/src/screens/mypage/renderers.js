import { renderModal } from '../../components/modal.js';
import { renderSecondaryIntro, renderSecondaryState } from '../../components/secondary-page.js';

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

function qnaStatusLabel(status = '') {
  if (String(status).toLowerCase() === 'done') return '답변 완료';
  if (String(status).toLowerCase() === 'read') return '확인 중';
  return '답변 대기';
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
  if (qnaStatus === 'loading') return renderSecondaryState({ kind: 'loading', title: '문의 내역을 불러오는 중이에요' });
  if (qnaStatus === 'error') return renderSecondaryState({ kind: 'error', title: '문의 내역을 불러오지 못했어요', description: '잠시 후 다시 확인해주세요.' });
  if (!qnaHistory.length) return renderSecondaryState({ title: '아직 남긴 문의가 없어요', description: '궁금한 점이 생기면 1:1 문의를 남겨주세요.' });

  return qnaHistory.map((item) => {
    const done = String(item.status || '').toLowerCase() === 'done';
    const created = formatQnaDate(item.createdAt);
    return `<article class="sc-secondary-row qna-list-row"><div class="sc-secondary-row-main qna-row-main"><b>${escapeHtml(item.title || '제목 없는 문의')}</b><p>${escapeHtml(item.content || '문의 내용 없음')}</p>${done && item.answer ? `<small>답변: ${escapeHtml(item.answer)}</small>` : ''}</div><div class="sc-secondary-row-meta qna-row-side"><em class="${done ? 'done' : ''}">${qnaStatusLabel(item.status)}</em>${created ? `<span>${escapeHtml(created)}</span>` : ''}</div></article>`;
  }).join('');
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

  return layout(appbar('알림 설정', true) + `<div class="sc-secondary-page notification-settings-page">${renderSecondaryIntro({ eyebrow: 'NOTIFICATIONS', title: '알림 설정', description: '필요한 학습·리포트·결제 안내만 골라 받을 수 있어요.' })}<section class="sc-secondary-section"><div class="sc-secondary-section-head"><div><h3>수신 항목</h3><p>변경 내용은 계정에 바로 저장됩니다.</p></div></div><div class="sc-secondary-list notify-card">${rows.map(([key, title, desc]) => `<button class="sc-secondary-row notify-row" data-action="toggleNotification" data-notify-key="${key}"><div class="sc-secondary-row-main"><b>${title}</b><p>${desc}</p></div><span class="notify-switch ${notifications[key] ? 'on' : ''}" role="switch" aria-checked="${notifications[key] ? 'true' : 'false'}"><i></i></span></button>`).join('')}</div></section></div>`, false);
}

// 알림 목록 화면(전체): 홈 알림 팝오버의 '전체 보기'/마이페이지 진입 대상.
const NOTI_PAGE_SIZE = 7;

export function renderNotificationListScreen(ctx) {
  const {
    appbar,
    layout,
    notiList = [],
    notiStatus = 'idle',
    notiPage = 0,
    notiDetailId = ''
  } = ctx;

  const list = Array.isArray(notiList) ? notiList : [];
  if (!list.length) {
    const emptyText = notiStatus === 'loading'
      ? '알림을 불러오는 중...'
      : notiStatus === 'error'
        ? '알림을 불러오지 못했습니다.'
        : '받은 알림이 없습니다.';
    return layout(appbar('알림', true) + `<div class="sc-secondary-page notification-list-page">${renderSecondaryIntro({ eyebrow: 'INBOX', title: '알림', description: '학습과 서비스 이용에 필요한 소식을 모아봤어요.' })}${renderSecondaryState({ kind: notiStatus === 'loading' ? 'loading' : notiStatus === 'error' ? 'error' : 'empty', title: emptyText, description: notiStatus === 'error' ? '잠시 후 다시 확인해주세요.' : '' })}</div>`, false);
  }

  const totalPages = Math.max(1, Math.ceil(list.length / NOTI_PAGE_SIZE));
  const page = Math.min(Math.max(0, notiPage), totalPages - 1);
  const start = page * NOTI_PAGE_SIZE;
  const pageItems = list.slice(start, start + NOTI_PAGE_SIZE);

  const itemsHtml = pageItems
    .map((n, idx) => {
      const id = String(n.notiId || n.id || n.notificationId || `${start + idx}`);
      const date = formatQnaDate(n.createdAt);
      const fullBody = escapeHtml(n.body || n.message || '');
      return `<button type="button" class="sc-secondary-row noti-list-row ${n.isRead ? '' : 'is-unread'}" data-action="openNotiDetail" data-noti-id="${escapeHtml(id)}">
        <span class="noti-list-dot" aria-hidden="true"></span>
        <span class="sc-secondary-row-main noti-list-main">
          <b>${escapeHtml(n.title || '알림')}</b>
          <p class="noti-list-body">${fullBody || '내용이 없습니다.'}</p>
          ${date ? `<span class="noti-list-date">${escapeHtml(date)}</span>` : ''}
        </span>
        <span class="sc-secondary-row-meta noti-list-chev" aria-hidden="true">보기</span>
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

  const selected = notiDetailId ? list.find((n, idx) => String(n.notiId || n.id || n.notificationId || idx) === String(notiDetailId)) : null;
  const selectedDate = selected ? formatQnaDate(selected.createdAt) : '';
  const detailModal = selected
    ? `<div class="sc-overlay sc-overlay--modal noti-detail-overlay" data-action="closeNotiDetail"><article class="sc-modal noti-detail-modal" data-action="noopModal" role="dialog" aria-modal="true">
        <div class="sc-modal-head noti-detail-head"><div><span>알림 상세</span><h4>${escapeHtml(selected.title || '알림')}</h4>${selectedDate ? `<p>${escapeHtml(selectedDate)}</p>` : ''}</div><button type="button" class="sc-overlay-close qna-modal-close" data-action="closeNotiDetail" aria-label="닫기">✕</button></div>
        <div class="sc-modal-body noti-detail-body">${escapeHtml(selected.body || selected.message || '내용이 없습니다.')}</div>
      </article></div>`
    : '';

  return layout(appbar('알림', true) + `<div class="sc-secondary-page notification-list-page">${renderSecondaryIntro({ eyebrow: 'INBOX', title: '알림', description: '읽지 않은 항목은 파란 점으로 표시됩니다.', aside: `<span class="sc-badge">${list.length}개</span>` })}<div class="sc-secondary-list noti-list-card">${itemsHtml}</div>${pager}</div>`, false, detailModal);
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

  return layout(appbar('고객센터', true) + `<div class="sc-secondary-page support-page">${renderSecondaryIntro({ eyebrow: 'HELP CENTER', title: '무엇을 도와드릴까요?', description: '문의 내역을 확인하거나 새로운 질문을 바로 남겨보세요.', aside: '<span class="sc-badge">평일 10:00–18:00</span>' })}<section class="sc-secondary-section support-direct-card"><div class="sc-secondary-section-head"><div><h3>1:1 문의</h3><p>현재 상황을 구체적으로 적으면 더 빠르게 확인할 수 있어요.</p></div></div><div class="support-btns"><button class="btn btn-primary" data-action="openQnaComposer">문의 작성</button><button class="btn btn-secondary" data-action="openKakaoSupport">카카오톡</button></div></section><section class="sc-secondary-section support-qna-card"><div class="sc-secondary-section-head support-section-head"><div><h3>내 문의 내역</h3><p>최근 문의와 답변 상태입니다.</p></div>${qnaHistory.length ? `<span class="sc-badge">${qnaHistory.length}건</span>` : ''}</div><div class="sc-secondary-list qna-list compact">${renderSupportQnaList({ qnaHistory, qnaStatus })}</div></section><section class="sc-secondary-section faq-card"><div class="sc-secondary-section-head"><div><h3>자주 묻는 질문</h3><p>많이 찾는 내용을 먼저 확인해보세요.</p></div></div><div class="sc-secondary-list">${faqs.map(([id, q, a]) => `<button class="sc-secondary-row faq-row" data-action="toggleFaq" data-faq-id="${id}"><div class="sc-secondary-row-main"><b>${q}</b>${openFaq === id ? `<p>${a}</p>` : ''}</div><span>${icon('chevron', false)}</span></button>`).join('')}</div></section></div>`, false, renderSupportQnaComposerModal(ctx));
}

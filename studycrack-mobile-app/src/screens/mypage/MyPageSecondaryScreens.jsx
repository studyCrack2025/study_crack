import { Modal } from '../../components/Modal.jsx';
import { SecondaryIntro, SecondaryScreenShell, SecondaryState } from '../../components/SecondaryScreen.jsx';

const NOTIFICATION_ROWS = [
  ['planner', '플래너 알림', '오늘 계획을 잊지 않도록 알려드려요'],
  ['report', '리포트 알림', '새 주간·PRO 리포트가 준비되면 알려드려요']
];
const NOTI_PAGE_SIZE = 7;
const FAQS = [
  ['faq1', '분석 결과는 어떻게 계산되나요?', '저장한 시험 성적과 목표 대학의 반영 기준으로 환산 결과를 계산합니다. 분석 결과는 참고 자료이며 합격을 보장하지 않습니다.'],
  ['faq2', '목표 대학을 중간에 변경할 수 있나요?', '네, 가능합니다. 목표 대학을 수정하면 즉시 새로운 분석 결과가 반영됩니다.'],
  ['faq3', '환불 규정이 궁금합니다.', '결제와 이용 상태에 따라 적용 기준이 달라질 수 있습니다. 약관의 환불규정을 확인하거나 1:1 문의로 계정 상태를 알려주세요.'],
  ['faq4', '어떤 정보를 확인할 수 있나요?', '대학별 환산 결과와 저장한 학습 계획, 공부 기록, 이용 중인 플랜에서 제공하는 리포트를 한곳에서 확인할 수 있습니다.'],
  ['faq5', '지금부터 기록해도 되나요?', '네. 오늘 계획과 공부 시간을 기록하면 이후 학습 점검에서 실제 기록을 확인할 수 있습니다.'],
  ['faq6', '성적이 아직 완성되지 않았어요.', '입력할 수 있는 시험부터 저장하고 목표 대학을 선택해 현재 계산 가능한 결과를 확인해보세요.'],
  ['faq7', '혼자 이용할 수도 있나요?', '네. 플래너와 분석 기능은 직접 이용할 수 있고, 코칭과 리포트는 이용 중인 플랜의 제공 범위에서 확인할 수 있습니다.'],
  ['faq8', '어떤 플랜을 선택해야 할지 모르겠어요.', '플랜 선택 화면에서 가격과 제공 기능을 비교한 뒤 필요한 기능이 포함된 플랜을 선택해주세요.']
];

function formatDate(value) {
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

function QnaComposerModal({ open, qnaDraftContent = '', qnaDraftTitle = '', qnaSubmitting = false }) {
  return (
    <Modal open={open} dismissAction="closeQnaComposer" panelClass="qna-modal">
      <div className="qna-modal-head"><h4>1:1 문의 작성</h4><button type="button" className="qna-modal-close" data-action="closeQnaComposer" aria-label="닫기">✕</button></div>
      <div className="qna-modal-body"><label>문의 제목</label><input className="planner-input" data-field="qnaDraftTitle" defaultValue={qnaDraftTitle} maxLength="80" placeholder="예: 결제 후 이용 권한이 궁금해요" /><label>문의 내용</label><textarea className="planner-input qna-textarea" data-field="qnaDraftContent" defaultValue={qnaDraftContent} maxLength="1000" placeholder="현재 상황과 궁금한 점을 구체적으로 적어주세요." /><div className="qna-modal-actions"><button type="button" className="btn btn-secondary" data-action="closeQnaComposer">취소</button><button type="button" className="btn btn-primary" data-action="submitMobileQna" disabled={qnaSubmitting}>{qnaSubmitting ? '접수 중' : '문의 접수'}</button></div></div>
    </Modal>
  );
}

function QnaHistory({ qnaHistory = [], qnaStatus = 'idle' }) {
  if (qnaStatus === 'idle' || qnaStatus === 'loading') return <SecondaryState kind="loading" title="문의 내역을 불러오는 중이에요" />;
  if (qnaStatus === 'error') return <SecondaryState kind="error" title="문의 내역을 불러오지 못했어요" description="잠시 후 다시 확인해주세요." />;
  if (!qnaHistory.length) return <SecondaryState title="아직 남긴 문의가 없어요" description="궁금한 점이 생기면 1:1 문의를 남겨주세요." />;
  return qnaHistory.map((item, index) => {
    const done = String(item.status || '').toLowerCase() === 'done';
    const created = formatDate(item.createdAt);
    return <article className="sc-secondary-row qna-list-row" key={item.qnaId || item.id || `${created}-${index}`}><div className="sc-secondary-row-main qna-row-main"><b>{item.title || '제목 없는 문의'}</b><p>{item.content || '문의 내용 없음'}</p>{done && item.answer ? <small>답변: {item.answer}</small> : null}</div><div className="sc-secondary-row-meta qna-row-side"><em className={done ? 'done' : ''}>{qnaStatusLabel(item.status)}</em>{created ? <span>{created}</span> : null}</div></article>;
  });
}

export function NotificationSettingsScreen({ notifications = {} }) {
  return (
    <SecondaryScreenShell screen="notificationSettings" title="알림 설정">
      <div className="sc-secondary-page notification-settings-page"><SecondaryIntro eyebrow="NOTIFICATIONS" title="알림 설정" description="실제로 발송되는 학습 알림만 선택할 수 있어요." /><section className="sc-secondary-section"><div className="sc-secondary-section-head"><div><h3>선택 알림</h3><p>변경 내용은 계정에 바로 저장됩니다.</p></div></div><div className="sc-secondary-list notify-card">{NOTIFICATION_ROWS.map(([key, title, description]) => <button type="button" className="sc-secondary-row notify-row" data-action="toggleNotification" data-notify-key={key} key={key}><div className="sc-secondary-row-main"><b>{title}</b><p>{description}</p></div><span className={`notify-switch ${notifications[key] ? 'on' : ''}`} role="switch" aria-checked={notifications[key] ? 'true' : 'false'}><i /></span></button>)}</div><p className="notification-required-note">결제·계정 보안처럼 서비스 이용에 꼭 필요한 안내는 이 설정과 별도로 발송될 수 있습니다.</p></section></div>
    </SecondaryScreenShell>
  );
}

function NotificationDetail({ item }) {
  if (!item) return null;
  const date = formatDate(item.createdAt);
  return (
    <Modal dismissAction="closeNotiDetail" overlayClass="noti-detail-overlay" panelClass="noti-detail-modal">
      <div className="sc-modal-head noti-detail-head"><div><span>알림 상세</span><h4>{item.title || '알림'}</h4>{date ? <p>{date}</p> : null}</div><button type="button" className="sc-overlay-close qna-modal-close" data-action="closeNotiDetail" aria-label="닫기">✕</button></div>
      <div className="sc-modal-body noti-detail-body">{item.body || item.message || '내용이 없습니다.'}</div>
    </Modal>
  );
}

export function NotificationListScreen({ notiDetailId = '', notiList = [], notiPage = 0, notiStatus = 'idle' }) {
  const list = Array.isArray(notiList) ? notiList : [];
  const totalPages = Math.max(1, Math.ceil(list.length / NOTI_PAGE_SIZE));
  const page = Math.min(Math.max(0, notiPage), totalPages - 1);
  const start = page * NOTI_PAGE_SIZE;
  const pageItems = list.slice(start, start + NOTI_PAGE_SIZE);
  const selected = notiDetailId ? list.find((item, index) => String(item.notiId || item.id || item.notificationId || index) === String(notiDetailId)) : null;
  const unreadCount = list.filter((item) => item?.isRead !== true).length;
  let content = null;
  if (!list.length) {
    const kind = notiStatus === 'idle' || notiStatus === 'loading' ? 'loading' : notiStatus === 'error' ? 'error' : 'empty';
    const title = kind === 'loading' ? '알림을 불러오는 중...' : kind === 'error' ? '알림을 불러오지 못했습니다.' : '받은 알림이 없습니다.';
    content = <SecondaryState kind={kind} title={title} description={kind === 'error' ? '잠시 후 다시 확인해주세요.' : ''} />;
  } else {
    content = <><div className="sc-secondary-list noti-list-card">{pageItems.map((item, index) => { const id = String(item.notiId || item.id || item.notificationId || `${start + index}`); const date = formatDate(item.createdAt); return <button type="button" className={`sc-secondary-row noti-list-row ${item.isRead ? '' : 'is-unread'}`} data-action="openNotiDetail" data-noti-id={id} key={id}><span className="noti-list-dot" aria-hidden="true" /><span className="sc-secondary-row-main noti-list-main"><b>{item.title || '알림'}</b><p className="noti-list-body">{item.body || item.message || '내용이 없습니다.'}</p>{date ? <span className="noti-list-date">{date}</span> : null}</span><span className="sc-secondary-row-meta noti-list-chev" aria-hidden="true">보기</span></button>; })}</div>{totalPages > 1 ? <div className="noti-pager"><button type="button" className="noti-pager-btn" data-action="notiPrevPage" disabled={page === 0}>이전</button><span className="noti-pager-count">{page + 1} / {totalPages}</span><button type="button" className="noti-pager-btn" data-action="notiNextPage" disabled={page >= totalPages - 1}>다음</button></div> : null}</>;
  }
  const overlays = <NotificationDetail item={selected} />;
  return (
    <SecondaryScreenShell screen="notificationList" title="알림" overlays={selected ? overlays : null}>
      <div className="sc-secondary-page notification-list-page"><SecondaryIntro eyebrow="INBOX" title="알림" description={list.length ? '읽지 않은 항목은 파란 점으로 표시됩니다.' : '학습과 서비스 이용에 필요한 소식을 모아봤어요.'} aside={<div className="notification-intro-tools">{unreadCount ? <span>안 읽음 {unreadCount}</span> : null}<button type="button" className="notification-settings-link" data-action="goto" data-target="notificationSettings">설정</button></div>} />{content}</div>
    </SecondaryScreenShell>
  );
}

export function CustomerSupportScreen(ctx) {
  const { openFaq = '', qnaComposerOpen = false, qnaDraftContent = '', qnaDraftTitle = '', qnaHistory = [], qnaStatus = 'idle', qnaSubmitting = false } = ctx;
  const overlays = <QnaComposerModal open={qnaComposerOpen} qnaDraftContent={qnaDraftContent} qnaDraftTitle={qnaDraftTitle} qnaSubmitting={qnaSubmitting} />;
  return (
    <SecondaryScreenShell screen="customerSupport" title="고객센터" overlays={qnaComposerOpen ? overlays : null}>
      <div className="sc-secondary-page support-page">
        <SecondaryIntro eyebrow="HELP CENTER" title="무엇을 도와드릴까요?" description="문의 내역을 확인하거나 새로운 질문을 바로 남겨보세요." aside={<span className="sc-badge">평일 10:00–18:00</span>} />
        <section className="sc-secondary-section support-direct-card"><div className="sc-secondary-section-head"><div><h3>1:1 문의</h3><p>현재 상황을 구체적으로 적으면 더 빠르게 확인할 수 있어요.</p></div></div><div className="support-action-grid"><button type="button" className="support-action-card primary" data-action="openQnaComposer"><b>일반 문의</b><span>결제·계정·서비스 이용 질문</span></button><button type="button" className="support-action-card" data-action="openQnaComposer" data-qna-title="[데이터 오류 신고] " data-qna-content="오류가 발생한 화면:\n기준 시험:\n선택한 대학·학과:\n확인한 문제:\n"><b>데이터 오류 신고</b><span>성적·대학·환산 결과 문제</span></button></div><button type="button" className="support-kakao-link" data-action="openKakaoSupport">카카오톡으로 문의하기</button></section>
        <section className="sc-secondary-section support-qna-card"><div className="sc-secondary-section-head support-section-head"><div><h3>내 문의 내역</h3><p>최근 문의와 답변 상태입니다.</p></div>{qnaHistory.length ? <span className="sc-badge">{qnaHistory.length}건</span> : null}</div><div className="sc-secondary-list qna-list compact"><QnaHistory qnaHistory={qnaHistory} qnaStatus={qnaStatus} /></div></section>
        <section className="sc-secondary-section faq-card"><div className="sc-secondary-section-head"><div><h3>자주 묻는 질문</h3><p>많이 찾는 내용을 먼저 확인해보세요.</p></div></div><div className="sc-secondary-list">{FAQS.map(([id, question, answer]) => <button type="button" className={`sc-secondary-row faq-row ${openFaq === id ? 'active open' : ''}`} data-action="toggleFaq" data-faq-id={id} aria-expanded={openFaq === id ? 'true' : 'false'} key={id}><div className="sc-secondary-row-main"><b>{question}</b>{openFaq === id ? <p>{answer}</p> : null}</div><span aria-hidden="true">›</span></button>)}</div></section>
      </div>
    </SecondaryScreenShell>
  );
}

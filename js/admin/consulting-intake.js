let currentConsultingApplication = null;
let currentConsultingMutationKeys = null;
let consultingPaymentReviewRequest = 0;
let consultingApplicationRequest = 0;
let consultingMutationBusy = false;

function createConsultingCell(text) {
    const cell = document.createElement('td');
    cell.textContent = String(text ?? '-');
    return cell;
}

function showConsultingReviewMessage(message) {
    const body = document.getElementById('consultingPaymentReviewBody');
    if (!body) return;
    const row = document.createElement('tr');
    const cell = createConsultingCell(message);
    cell.colSpan = 6;
    cell.className = 'empty-msg';
    row.appendChild(cell);
    body.replaceChildren(row);
}

function setConsultingActionStatus(message, state = '') {
    const target = document.getElementById('consultingActionStatus');
    if (!target) return;
    target.textContent = message;
    target.dataset.state = state;
}

function setConsultingIntakeBusy(busy) {
    consultingMutationBusy = busy;
    const panel = document.getElementById('consultingIntakePanel');
    panel?.setAttribute('aria-busy', String(busy));
    panel?.querySelectorAll('button, input, select').forEach(control => { control.disabled = busy; });
}

function renderConsultingPaymentReview(items) {
    const body = document.getElementById('consultingPaymentReviewBody');
    if (!body) return;
    body.replaceChildren();
    if (!items.length) return showConsultingReviewMessage('현재 입금 확인 대기·보류 건이 없습니다. 처리 완료 건은 신청 ID로 조회하세요.');
    items.forEach(item => {
        const row = document.createElement('tr');
        row.appendChild(createConsultingCell(formatConsultingDate(item.submittedAt || item.createdAt)));
        row.appendChild(createConsultingCell(`${item.studentNameMask || '-'} / ${item.phoneMask || '-'}`));
        row.appendChild(createConsultingCell(item.payerNameMask || '-'));
        row.appendChild(createConsultingCell(formatConsultingMoney(item.expectedAmount)));
        const reviewState = item.paymentReviewStatus === 'hold' ? '보류' : '입금 확인 대기';
        row.appendChild(createConsultingCell(`${reviewState}${item.duplicateSuspected ? ' · 중복 가능성 확인 필요' : ''}`));
        const action = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'consulting-btn consulting-btn-secondary';
        button.textContent = '상세 확인';
        button.addEventListener('click', () => openConsultingApplication(item.applicationId));
        action.appendChild(button);
        row.appendChild(action);
        body.appendChild(row);
    });
}

async function loadConsultingPaymentReview() {
    if (consultingMutationBusy) return false;
    const requestId = ++consultingPaymentReviewRequest;
    closeConsultingDetail();
    const detailRequestId = consultingApplicationRequest;
    showConsultingReviewMessage('입금 확인 대기 건을 불러오는 중입니다.');
    setConsultingStatus('입금 확인 대기 건을 불러오는 중입니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_list_payment_review', { limit: 100 });
        if (requestId !== consultingPaymentReviewRequest) return false;
        if (!Array.isArray(data.items)) throw new Error('대기 목록 형식이 올바르지 않습니다.');
        renderConsultingPaymentReview(data.items);
        if (detailRequestId === consultingApplicationRequest) setConsultingStatus(`입금 확인 대기·보류 ${data.items.length}건${data.items.length === 100 ? ' (최대 100건 표시)' : ''}`, 'success');
        return true;
    } catch (error) {
        if (requestId !== consultingPaymentReviewRequest) return false;
        showConsultingReviewMessage('목록을 불러오지 못했습니다. 새로고침으로 다시 시도하세요.');
        if (detailRequestId === consultingApplicationRequest) setConsultingStatus(error.message || '검수 목록을 불러오지 못했습니다.', 'error');
        return false;
    }
}

async function lookupConsultingApplication() {
    await openConsultingApplication(document.getElementById('consultingApplicationLookup')?.value.trim() || '');
}

function consultingIntakeLabel(value, labels) {
    return Object.hasOwn(labels, value) ? labels[value] : (value || '-');
}

async function openConsultingApplication(applicationId) {
    if (consultingMutationBusy) return;
    closeConsultingDetail();
    if (!/^APP_[0-9a-f-]{36}$/i.test(applicationId)) return setConsultingStatus('APP_로 시작하는 올바른 신청 ID를 입력해주세요.', 'error');
    const requestId = consultingApplicationRequest;
    setConsultingStatus('신청 상세를 불러오는 중입니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_get_application_detail', { applicationId });
        if (requestId !== consultingApplicationRequest) return;
        const application = data.application;
        if (application?.applicationId !== applicationId || !Number.isSafeInteger(application.revision) || !data.contact || typeof data.contact !== 'object') throw new Error('신청 상세 형식이 올바르지 않습니다.');
        const mutationKeys = {
            payment: consultingRequestKey('payment'), hold: consultingRequestKey('hold'),
            reject: consultingRequestKey('reject'), reissue: consultingRequestKey('reissue')
        };
        const summary = document.getElementById('consultingDetailSummary');
        summary.replaceChildren();
        const values = [
            ['신청 ID', application.applicationId], ['학생', data.contact.studentName], ['전화번호', data.contact.phone],
            ['이메일', data.contact.email], ['입금자', data.contact.payerName],
            ['입금자 관계', consultingIntakeLabel(data.payerRelationship, { self: '본인', parent: '부모님', other: '기타' })],
            ['연락 방법', consultingIntakeLabel(data.contactMethod, { kakao: '카카오톡', sms: '문자', phone: '전화', email: '이메일', other: '기타' })],
            ['학생 상태', consultingIntakeLabel(data.studentStatus, { senior: '고3', graduate: '재수 이상', ged: '검정고시' })],
            ['접수 시각', formatConsultingDate(application.submittedAt || application.createdAt)],
            ['예정 금액', formatConsultingMoney(application.expectedAmount)],
            ['신청 상태', consultingIntakeLabel(application.applicationState, { PAYMENT_REVIEW: '입금 검수', INVITED: '초대 발급', REJECTED: '거절', CLAIMED: '가입 연결 완료' })],
            ['검수 상태', consultingIntakeLabel(application.paymentReviewStatus, { pending: '대기', hold: '보류', verified: '승인', rejected: '거절' })],
            ['수정 버전', application.revision], ['중복 가능성', application.duplicateSuspected ? '확인 필요' : '없음']
        ];
        if (data.payerRelationshipDetail) values.push(['입금자 관계 기타 내용', data.payerRelationshipDetail]);
        if (data.contactMethodDetail) values.push(['연락 방법 기타 내용', data.contactMethodDetail]);
        if (data.inviteRevoked) values.push(['초대 상태', '취소됨 · 필요하면 재발급']);
        if (data.invitedAt) values.push(['초대 발급 시각', formatConsultingDate(data.invitedAt)]);
        values.forEach(([label, value]) => {
            const block = document.createElement('div');
            const term = document.createElement('strong');
            const content = document.createElement('span');
            term.textContent = label;
            content.textContent = String(value ?? '-');
            block.append(term, content);
            summary.appendChild(block);
        });
        currentConsultingApplication = data;
        currentConsultingMutationKeys = mutationKeys;
        document.getElementById('consultingApplicationLookup').value = applicationId;
        document.getElementById('consultingHoldReason').value = application.duplicateSuspected ? 'DUPLICATE_CANDIDATE' : 'PAYMENT_NOT_FOUND';
        document.getElementById('consultingRejectReason').value = application.duplicateSuspected ? 'DUPLICATE_APPLICATION' : 'PAYMENT_NOT_FOUND';
        document.getElementById('consultingPaymentActions').hidden = application.applicationState !== 'PAYMENT_REVIEW' || !['pending', 'hold'].includes(application.paymentReviewStatus);
        const revokeButton = document.getElementById('consultingRevokeBtn'); if (revokeButton) revokeButton.hidden = data.stageVerified !== true || data.inviteRevoked === true || application.applicationState !== 'INVITED';
        document.getElementById('consultingInviteActions').hidden = application.applicationState !== 'INVITED' || !data.activeInviteId;
        document.getElementById('consultingApplicationDetail').hidden = false;
        setConsultingStatus('신청 상세를 불러왔습니다. 실제 수신할 전화번호와 이메일을 확인하세요.', 'success');
    } catch (error) {
        if (requestId !== consultingApplicationRequest) return;
        closeConsultingDetail();
        setConsultingStatus(error.message || '신청 상세를 불러오지 못했습니다.', 'error');
    }
}

function closeConsultingDetail(force = false) {
    if (consultingMutationBusy && !force) return;
    ++consultingApplicationRequest;
    currentConsultingApplication = null;
    currentConsultingMutationKeys = null;
    // 상세를 닫으면 개인정보를 DOM에서도 제거한다.
    document.getElementById('consultingDetailSummary')?.replaceChildren();
    for (const id of ['consultingPaidAmount', 'consultingPaidAt']) {
        const field = document.getElementById(id);
        if (field) field.value = '';
    }
    const confirmed = document.getElementById('consultingPayerConfirmed');
    if (confirmed) confirmed.checked = false;
    for (const id of ['consultingApplicationDetail', 'consultingPaymentActions', 'consultingInviteActions']) {
        const element = document.getElementById(id);
        if (element) element.hidden = true;
    }
}

function resetConsultingIntake() {
    ++consultingPaymentReviewRequest;
    closeConsultingDetail(true);
    showConsultingReviewMessage('메뉴를 열면 입금 확인 대기 건을 불러옵니다.');
    setConsultingStatus('');
    setConsultingActionStatus('');
}

async function runConsultingMutation(type, data, successMessage) {
    if (consultingMutationBusy || currentConsultingApplication?.application.applicationId !== data.applicationId) return null;
    const requestId = consultingApplicationRequest;
    ++consultingPaymentReviewRequest;
    setConsultingIntakeBusy(true);
    setConsultingActionStatus('처리 중입니다. 중복 요청하지 말고 결과를 기다려주세요.', 'loading');
    let result;
    try {
        result = await requestConsultingAdmin(type, data);
    } catch (error) {
        if (requestId === consultingApplicationRequest) {
            closeConsultingDetail(true);
            const message = error?.status === 409 ? '신청 상태가 변경됐거나 결과 확인이 필요합니다.' : '처리를 완료했는지 확인하지 못했습니다.';
            setConsultingActionStatus(`${message} 신청 ID로 다시 조회한 뒤 판단해주세요. 자동으로 재전송하지 않습니다.`, 'error');
        }
        return null;
    } finally {
        setConsultingIntakeBusy(false);
    }
    if (requestId !== consultingApplicationRequest) return result;
    closeConsultingDetail();
    const refresh = loadConsultingPaymentReview();
    const refreshRequestId = consultingApplicationRequest;
    await refresh;
    if (refreshRequestId !== consultingApplicationRequest) return result;
    setConsultingActionStatus(`${data.applicationId}: ${successMessage} 처리된 건은 신청 ID로 다시 조회할 수 있습니다.`, 'success');
    return result;
}

async function approveConsultingPayment() {
    const application = currentConsultingApplication?.application;
    if (consultingMutationBusy || !application || application.applicationState !== 'PAYMENT_REVIEW' || !['pending', 'hold'].includes(application.paymentReviewStatus)) return;
    const payerNameConfirmed = document.getElementById('consultingPayerConfirmed').checked;
    const paidAtValue = document.getElementById('consultingPaidAt').value;
    const paidAt = new Date(paidAtValue);
    const paidAmount = Number(document.getElementById('consultingPaidAmount').value);
    if (!Number.isSafeInteger(paidAmount) || paidAmount <= 0 || !payerNameConfirmed || !paidAtValue || Number.isNaN(paidAt.getTime())) return setConsultingStatus('실제 입금액·입금 시각을 입력하고 입금자명 대조를 확인해주세요.', 'error');
    if (!confirm(`신청 ${application.applicationId}\n실제 입금액 ${formatConsultingMoney(paidAmount)}\n입금 시각 ${formatConsultingDate(paidAt.toISOString())}\n\n계좌 내역을 대조했고 수신 연락처도 확인했습니까? 승인하면 실제 초대 링크·인증코드 발송이 예약됩니다.`)) return;
    await runConsultingMutation('admin_verify_manual_payment', {
        applicationId: application.applicationId, expectedRevision: application.revision,
        idempotencyKey: currentConsultingMutationKeys.payment, paidAmount,
        paidAt: paidAt.toISOString(), payerNameConfirmed: true, reasonCode: 'MANUAL_BANK_MATCH'
    }, '입금 승인 및 초대 발송 예약 완료. 실제 발송·수신 성공은 별도 확인이 필요합니다.');
}

async function holdConsultingPayment() {
    const application = currentConsultingApplication?.application;
    if (consultingMutationBusy || !application || application.applicationState !== 'PAYMENT_REVIEW') return;
    const reasonCode = document.getElementById('consultingHoldReason').value;
    const reasonText = prompt('보류 사유를 입력해주세요. 개인정보는 적지 마세요. 취소하면 처리하지 않습니다.', '');
    if (reasonText === null) return;
    if (reasonText.length > 500 || (reasonCode === 'OTHER' && !reasonText.trim())) return setConsultingStatus('기타 사유는 필수이며, 메모는 500자 이내로 입력해주세요.', 'error');
    await runConsultingMutation('admin_hold_payment_review', { applicationId: application.applicationId, expectedRevision: application.revision, idempotencyKey: currentConsultingMutationKeys.hold, reasonCode, reasonText }, '보류 처리 완료. 대기·보류 목록에서 다시 검수할 수 있습니다.');
}

async function rejectConsultingApplication() {
    const application = currentConsultingApplication?.application;
    if (consultingMutationBusy || !application || application.applicationState !== 'PAYMENT_REVIEW') return;
    const reasonCode = document.getElementById('consultingRejectReason').value;
    const reasonText = prompt('거절 사유를 입력해주세요. 개인정보는 적지 마세요. 취소하면 처리하지 않습니다.', '');
    if (reasonText === null) return;
    if (reasonText.length > 500 || (reasonCode === 'OTHER' && !reasonText.trim())) return setConsultingStatus('기타 사유는 필수이며, 메모는 500자 이내로 입력해주세요.', 'error');
    if (!confirm(`신청 ${application.applicationId}을 거절하시겠습니까? 이 화면에서 되돌릴 수 없습니다.`)) return;
    await runConsultingMutation('admin_reject_application', { applicationId: application.applicationId, expectedRevision: application.revision, idempotencyKey: currentConsultingMutationKeys.reject, reasonCode, reasonText }, '신청 거절 완료.');
}

async function reissueConsultingInvite() {
    const application = currentConsultingApplication?.application;
    if (consultingMutationBusy || !application || application.applicationState !== 'INVITED' || !currentConsultingApplication.activeInviteId) return;
    if (!confirm(`신청 ${application.applicationId}\n연락처를 확인했습니까? 기존 초대를 폐기하고 새 링크와 인증코드를 실제 발송 예약합니다.`)) return;
    await runConsultingMutation('admin_reissue_invite', { applicationId: application.applicationId, expectedRevision: application.revision, idempotencyKey: currentConsultingMutationKeys.reissue, reasonCode: 'DELIVERY_RETRY' }, '새 초대 발송 예약 완료. 실제 발송·수신 성공은 별도 확인이 필요합니다.');
}

window.addEventListener('studycrack:session-ended', resetConsultingIntake);
window.addEventListener('pagehide', resetConsultingIntake);

async function revokeConsultingInvite() {
    const current = currentConsultingApplication, application = current?.application;
    if (consultingMutationBusy || !application || application.applicationState !== 'INVITED' || !current.activeInviteId || !current.stageVerified || current.inviteRevoked) return;
    const reason = prompt('초대 취소 사유를 10자 이상 입력해주세요. 개인정보는 제외하세요.', ''); if (reason === null) return;
    const normalized = reason.replace(/\s+/g, ' ').trim(); if (normalized.length < 10 || normalized.length > 1000) return setConsultingStatus('사유는 10~1000자로 입력해주세요.', 'error');
    if (!confirm('미사용 초대를 취소할까요? 기존 링크·코드는 사용할 수 없게 됩니다. 이미 발송 중인 메시지는 회수되지 않으며 입금·이용권 환불은 별도입니다.')) return;
    await runConsultingMutation('admin_revoke_consulting_invite', { applicationId: application.applicationId, expectedRevision: application.revision, reason: normalized, idempotencyKey: crypto.randomUUID() }, '미사용 초대 취소 완료. 환불은 별도 처리이며 필요하면 새 초대를 재발급할 수 있습니다.');
}

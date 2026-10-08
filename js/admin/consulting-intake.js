let currentConsultingApplication = null;
let currentConsultingMutationKeys = null;
let consultingPaymentReviewRequest = 0;

function createConsultingCell(text) {
    const cell = document.createElement('td');
    cell.textContent = String(text ?? '-');
    return cell;
}

function renderConsultingPaymentReview(items) {
    const body = document.getElementById('consultingPaymentReviewBody');
    if (!body) return;
    body.innerHTML = '';
    if (!items.length) {
        const row = document.createElement('tr');
        const cell = createConsultingCell('현재 입금 검수 대기 건이 없습니다.');
        cell.colSpan = 6;
        cell.className = 'empty-msg';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    items.forEach(item => {
        const row = document.createElement('tr');
        row.appendChild(createConsultingCell(formatConsultingDate(item.submittedAt || item.createdAt)));
        row.appendChild(createConsultingCell(`${item.studentNameMask || '-'} / ${item.phoneMask || '-'}`));
        row.appendChild(createConsultingCell(item.payerNameMask || '-'));
        row.appendChild(createConsultingCell(formatConsultingMoney(item.expectedAmount)));
        row.appendChild(createConsultingCell(item.duplicateSuspected ? '중복 가능성 확인 필요' : (item.paymentReviewStatus === 'hold' ? '보류' : '대기')));
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
    const requestId = ++consultingPaymentReviewRequest;
    setConsultingStatus('입금 검수 대기 건을 불러오는 중입니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_list_payment_review', { limit: 100 });
        if (requestId !== consultingPaymentReviewRequest) return;
        if (!Array.isArray(data.items)) throw new Error('대기 목록 형식이 올바르지 않습니다.');
        renderConsultingPaymentReview(data.items);
        setConsultingStatus(`검수 대기 ${data.items.length}건`, 'success');
    } catch (error) {
        if (requestId !== consultingPaymentReviewRequest) return;
        renderConsultingPaymentReview([]);
        setConsultingStatus(error.message || '검수 목록을 불러오지 못했습니다.', 'error');
    }
}

async function lookupConsultingApplication() {
    const value = document.getElementById('consultingApplicationLookup')?.value.trim();
    if (!value) return setConsultingStatus('신청 ID를 입력해주세요.', 'error');
    await openConsultingApplication(value);
}

async function openConsultingApplication(applicationId) {
    setConsultingStatus('신청 상세를 불러오는 중입니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_get_application_detail', { applicationId });
        currentConsultingApplication = data;
        currentConsultingMutationKeys = {
            payment: consultingRequestKey('payment'), hold: consultingRequestKey('hold'),
            reject: consultingRequestKey('reject'), reissue: consultingRequestKey('reissue')
        };
        const application = data.application;
        const summary = document.getElementById('consultingDetailSummary');
        summary.innerHTML = '';
        const values = [
            ['신청 ID', application.applicationId], ['학생', data.contact.studentName], ['전화번호', data.contact.phone],
            ['이메일', data.contact.email], ['입금자', data.contact.payerName], ['입금자 관계', data.payerRelationship],
            ['연락 방법', data.contactMethod], ['학생 상태', data.studentStatus], ['접수 시각', formatConsultingDate(application.submittedAt || application.createdAt)],
            ['예정 금액', formatConsultingMoney(application.expectedAmount)], ['검수 상태', application.paymentReviewStatus], ['중복 가능성', application.duplicateSuspected ? '확인 필요' : '없음']
        ];
        values.forEach(([label, value]) => {
            const block = document.createElement('div');
            const term = document.createElement('strong');
            const content = document.createElement('span');
            term.textContent = label;
            content.textContent = String(value ?? '-');
            block.append(term, content);
            summary.appendChild(block);
        });
        document.getElementById('consultingPaidAmount').value = application.expectedAmount;
        const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('consultingPaidAt').value = localNow;
        document.getElementById('consultingPayerConfirmed').checked = false;
        document.getElementById('consultingHoldReason').value = application.duplicateSuspected ? 'DUPLICATE_CANDIDATE' : 'PAYMENT_NOT_FOUND';
        document.getElementById('consultingRejectReason').value = application.duplicateSuspected ? 'DUPLICATE_APPLICATION' : 'PAYMENT_NOT_FOUND';
        document.getElementById('consultingPaymentActions').hidden = application.applicationState !== 'PAYMENT_REVIEW';
        document.getElementById('consultingInviteActions').hidden = application.applicationState !== 'INVITED' || !data.activeInviteId;
        document.getElementById('consultingApplicationDetail').hidden = false;
        setConsultingStatus('신청 상세를 불러왔습니다.', 'success');
    } catch (error) {
        setConsultingStatus(error.message || '신청 상세를 불러오지 못했습니다.', 'error');
    }
}

function closeConsultingDetail() {
    currentConsultingApplication = null;
    currentConsultingMutationKeys = null;
    document.getElementById('consultingApplicationDetail').hidden = true;
}

async function runConsultingMutation(type, data, successMessage, buttonId) {
    const button = buttonId ? document.getElementById(buttonId) : null;
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
        const result = await requestConsultingAdmin(type, data);
        setConsultingStatus(successMessage, 'success');
        closeConsultingDetail();
        await loadConsultingPaymentReview();
        return result;
    } catch (error) {
        setConsultingStatus(error.message || '처리하지 못했습니다. 새로고침 후 다시 확인해주세요.', 'error');
        return null;
    } finally {
        if (button) button.disabled = false;
    }
}

async function approveConsultingPayment() {
    const application = currentConsultingApplication?.application;
    if (!application) return;
    const payerNameConfirmed = document.getElementById('consultingPayerConfirmed').checked;
    const paidAtValue = document.getElementById('consultingPaidAt').value;
    const paidAt = new Date(paidAtValue);
    if (!payerNameConfirmed || !paidAtValue || Number.isNaN(paidAt.getTime())) return setConsultingStatus('입금자명 확인과 입금 시각을 모두 확인해주세요.', 'error');
    if (!confirm('입금액과 입금자명이 실제 계좌 내역과 일치합니까? 승인 즉시 초대 발송이 예약됩니다.')) return;
    await runConsultingMutation('admin_verify_manual_payment', {
        applicationId: application.applicationId, expectedRevision: application.revision,
        idempotencyKey: currentConsultingMutationKeys.payment, paidAmount: Number(document.getElementById('consultingPaidAmount').value),
        paidAt: paidAt.toISOString(), payerNameConfirmed: true, reasonCode: 'MANUAL_BANK_MATCH'
    }, '입금을 승인했고 초대 발송을 예약했습니다.', 'consultingApproveBtn');
}

async function holdConsultingPayment() {
    const application = currentConsultingApplication?.application;
    if (!application) return;
    const reasonCode = document.getElementById('consultingHoldReason').value;
    const reasonText = prompt('보류 메모를 입력해주세요. 취소하면 처리하지 않습니다.', '');
    if (reasonText === null) return;
    await runConsultingMutation('admin_hold_payment_review', { applicationId: application.applicationId, expectedRevision: application.revision, idempotencyKey: currentConsultingMutationKeys.hold, reasonCode, reasonText }, '신청을 보류 처리했습니다.');
}

async function rejectConsultingApplication() {
    const application = currentConsultingApplication?.application;
    if (!application) return;
    const reasonCode = document.getElementById('consultingRejectReason').value;
    const reasonText = prompt('거절 메모를 입력해주세요. 취소하면 처리하지 않습니다.', '');
    if (reasonText === null || (reasonCode === 'OTHER' && !reasonText.trim()) || !confirm('이 신청을 거절하시겠습니까?')) return;
    await runConsultingMutation('admin_reject_application', { applicationId: application.applicationId, expectedRevision: application.revision, idempotencyKey: currentConsultingMutationKeys.reject, reasonCode, reasonText }, '신청을 거절 처리했습니다.');
}

async function reissueConsultingInvite() {
    const application = currentConsultingApplication?.application;
    if (!application || !confirm('기존 초대를 폐기하고 새 링크와 인증코드를 발급하시겠습니까?')) return;
    await runConsultingMutation('admin_reissue_invite', { applicationId: application.applicationId, expectedRevision: application.revision, idempotencyKey: currentConsultingMutationKeys.reissue, reasonCode: 'DELIVERY_RETRY' }, '새 초대 발송을 예약했습니다.', 'consultingReissueBtn');
}

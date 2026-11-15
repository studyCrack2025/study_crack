let currentConsultingApplication = null;
let currentConsultingMutationKeys = null;
let consultingApplicationRequest = 0;
let consultingMutationBusy = false;
let consultingApplicationDeletion = null;
let consultingApplicationDeletionGeneration = 0;
const consultingInputFields = { studentName: 'consultingContactStudentName', phone: 'consultingContactPhone', email: 'consultingContactEmail', payerName: 'consultingContactPayerName', payerRelationship: 'consultingContactRelationship', contactMethod: 'consultingContactMethod', studentStatus: 'consultingContactStudentStatus' };
const consultingInputLabels = { studentName: '학생 이름', phone: '전화번호', email: '이메일', payerName: '입금자명', payerRelationship: '입금자와의 관계', contactMethod: '연락 방법', studentStatus: '학생 상태', payerRelationshipDetail: '입금자 관계 기타 내용', contactMethodDetail: '연락 방법 기타 내용' };

function consultingInputNeedsReview(application) {
    return application?.inputReviewRequired === true || application?.paymentReviewStatus === 'input_review' || Array.isArray(application?.intakeIssues) && application.intakeIssues.length > 0;
}

function consultingPaymentIsEditable(application) {
    return application?.applicationState === 'PAYMENT_REVIEW' && ['pending', 'hold', 'input_review'].includes(application.paymentReviewStatus);
}

function consultingCampaignNeedsRecovery(data) {
    return data?.campaignReady === false || !Number.isSafeInteger(data?.application?.expectedAmount) || data.application.expectedAmount <= 0;
}

function renderConsultingInputReview(data) {
    const original = document.getElementById('consultingOriginalSubmission');
    const entries = [];
    for (const [field, label] of Object.entries(consultingInputLabels)) {
        if (!data.originalSubmission || !Object.prototype.hasOwnProperty.call(data.originalSubmission, field)) continue;
        const raw = data.originalSubmission[field];
        entries.push([label, raw === null || raw === '' ? '미입력' : typeof raw === 'string' ? raw : JSON.stringify(raw)]);
    }
    original.replaceChildren();
    if (entries.length) original.appendChild(createConsultingFacts(entries));
    document.getElementById('consultingOriginalDetails').hidden = !entries.length;
    const editable = consultingPaymentIsEditable(data.application);
    const edit = document.getElementById('consultingInputEdit');
    edit.hidden = !editable;
    edit.open = editable && consultingInputNeedsReview(data.application);
    document.getElementById('consultingInputEditor').hidden = !editable;
    if (!editable) return;
    for (const [field, id] of Object.entries(consultingInputFields)) document.getElementById(id).value = String(data.contact[field] ?? data[field] ?? '');
    document.getElementById('consultingInputConfirmed').checked = false;
    const fields = [...new Set((Array.isArray(data.application.intakeIssues) ? data.application.intakeIssues : []).map(issue => Object.prototype.hasOwnProperty.call(consultingInputLabels, issue?.field) ? consultingInputLabels[issue.field] : null).filter(Boolean))];
    document.getElementById('consultingInputIssues').textContent = consultingInputNeedsReview(data.application)
        ? `접수는 저장됐습니다. ${fields.join(' · ') || '신청 정보'} 항목을 원본과 대조하고 아래에서 수정·확인해주세요.`
        : '접수 정보에 오타가 있으면 아래에서 수정·확인해주세요.';
    document.getElementById('consultingApproveBtn').disabled = consultingInputNeedsReview(data.application) || consultingCampaignNeedsRecovery(data);
}

function createConsultingCell(text) {
    const cell = document.createElement('td');
    cell.textContent = String(text ?? '-');
    return cell;
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
    panel?.querySelectorAll('button, input, select, textarea').forEach(control => { control.disabled = busy; });
    const approve = document.getElementById('consultingApproveBtn');
    if (approve) approve.disabled = busy || consultingInputNeedsReview(currentConsultingApplication?.application) || consultingCampaignNeedsRecovery(currentConsultingApplication);
}

function renderConsultingApplication(applicationId, data) {
    closeConsultingDetail();
    const { application, contact } = data;
    if (application?.applicationId !== applicationId || !Number.isSafeInteger(application.revision) || !contact || typeof contact !== 'object') throw new Error('신청 상세 형식이 올바르지 않습니다.');
    const summary = document.getElementById('consultingDetailSummary');
    appendConsultingRecord(summary, '학생·연락처', createConsultingFacts([
        ['학생 이름', contact.studentName], ['전화번호', contact.phone], ['이메일', contact.email],
        ['연락 방법', [consultingOptionLabel(data.contactMethod, { kakao: '카카오톡', sms: '문자', phone: '전화', email: '이메일', other: '기타' }), data.contactMethodDetail].filter(Boolean).join(' · ')],
        ['학생 상태', consultingOptionLabel(data.studentStatus, { senior: '고3', graduate: '재수 이상', ged: '검정고시', other: '기타' })]
    ]));
    appendConsultingRecord(summary, '입금 정보', createConsultingFacts([
        ['입금자명', contact.payerName],
        ['입금자와의 관계', [consultingOptionLabel(data.payerRelationship, { self: '본인', parent: '부모님', other: '기타' }), data.payerRelationshipDetail].filter(Boolean).join(' · ')],
        ['예정 금액', formatConsultingMoney(application.expectedAmount)],
        ['입금 확인', consultingOptionLabel(application.paymentReviewStatus, { pending: '대기', hold: '보류', input_review: '신청 정보 확인 대기', verified: '승인', rejected: '거절' })]
    ]));
    if (data.campaignReady === false) appendConsultingRecord(summary, '캠페인 설정 확인 필요', createConsultingFacts([
        ['조회 상태', '신청 내용은 정상적으로 조회했습니다.'],
        ['입금 승인', '캠페인 기본 설정과 금액을 복구한 뒤 상세를 새로고침해주세요. 복구 전에는 승인할 수 없습니다.']
    ]));
    const history = [
        ['접수 시각', formatConsultingDate(application.submittedAt || application.createdAt)],
        ['신청 상태', consultingOptionLabel(application.applicationState, { PAYMENT_REVIEW: '입금 검수', INVITED: '초대 발급', REJECTED: '거절', CLAIMED: '가입 연결 완료', CASE_ACTIVE: '상담 진행' })],
        ['중복 가능성', application.duplicateSuspected ? '확인 필요' : '없음'],
        ['신청 정보 확인', consultingInputNeedsReview(application) ? '보완·확인 필요' : '보완 대기 없음']
    ];
    if (data.inviteRevoked) history.push(['초대 상태', '취소됨 · 필요하면 재발급']);
    if (data.invitedAt) history.push(['초대 발급 시각', formatConsultingDate(data.invitedAt)]);
    appendConsultingRecord(summary, '접수 이력', createConsultingFacts(history));
    if (Array.isArray(data.reviewNotices) && data.reviewNotices.length) {
        const states = { pending: '발송 예약', processing: '발송 요청 중', sent: '문자 접수 확인', superseded: '이전 상태 안내 생략', dead_letter: '실패 확인' };
        appendConsultingRecord(summary, '신청 안내 이력', createConsultingFacts(data.reviewNotices.map(notice => [
            notice.decision === 'hold' ? '보류 문자' : '거절 문자',
            [
                notice.errorCode === 'NOTIFICATION_DELIVERY_UNCERTAIN' ? '발송 결과 확인 필요' : consultingOptionLabel(notice.status, states),
                formatConsultingDate(notice.status === 'sent' ? notice.acceptedAt : notice.createdAt),
                notice.status === 'dead_letter' ? notice.errorCode : ''
            ].filter(Boolean).join(' · ')
        ])));
    }

    currentConsultingApplication = data;
    currentConsultingMutationKeys = {
        payment: consultingRequestKey('payment'), hold: consultingRequestKey('hold'),
        reject: consultingRequestKey('reject'), reissue: consultingRequestKey('reissue'), input: consultingRequestKey('input')
    };
    renderConsultingInputReview(data);
    document.getElementById('consultingHoldReason').value = application.duplicateSuspected ? 'DUPLICATE_CANDIDATE' : 'PAYMENT_NOT_FOUND';
    document.getElementById('consultingRejectReason').value = application.duplicateSuspected ? 'DUPLICATE_APPLICATION' : 'PAYMENT_NOT_FOUND';
    document.getElementById('consultingPaymentActions').hidden = !consultingPaymentIsEditable(application);
    document.getElementById('consultingRevokeBtn').hidden = data.stageVerified !== true || data.inviteRevoked === true || application.applicationState !== 'INVITED';
    document.getElementById('consultingInviteActions').hidden = application.applicationState !== 'INVITED' || !data.activeInviteId;
    document.getElementById('consultingApplicationDetail').hidden = false;
    document.getElementById('consultingDeleteApplicationBtn').hidden = data.deletion?.available !== true;
    setConsultingStatus('', 'success');
}

function closeConsultingDetail() {
    resetConsultingApplicationDeletion();
    ++consultingApplicationRequest;
    currentConsultingApplication = null;
    currentConsultingMutationKeys = null;
    // 상세를 닫으면 개인정보를 DOM에서도 제거한다.
    document.getElementById('consultingDetailSummary')?.replaceChildren();
    document.getElementById('consultingOriginalSubmission')?.replaceChildren();
    const original = document.getElementById('consultingOriginalDetails');
    if (original) { original.open = false; original.hidden = true; }
    const edit = document.getElementById('consultingInputEdit');
    if (edit) { edit.open = false; edit.hidden = true; }
    for (const id of Object.values(consultingInputFields)) { const field = document.getElementById(id); if (field) field.value = ''; }
    const inputConfirmed = document.getElementById('consultingInputConfirmed');
    if (inputConfirmed) inputConfirmed.checked = false;
    const inputIssues = document.getElementById('consultingInputIssues');
    if (inputIssues) inputIssues.textContent = '';
    const alternatives = document.getElementById('consultingPaymentAlternatives');
    if (alternatives) alternatives.open = false;
    for (const id of ['consultingPaidAmount', 'consultingPaidAt', 'consultingHoldNote', 'consultingRejectNote']) {
        const field = document.getElementById(id);
        if (field) field.value = '';
    }
    const confirmed = document.getElementById('consultingPayerConfirmed');
    if (confirmed) confirmed.checked = false;
    for (const id of ['consultingApplicationDetail', 'consultingPaymentActions', 'consultingInviteActions', 'consultingInputEditor']) {
        const element = document.getElementById(id);
        if (element) element.hidden = true;
    }
}

function resetConsultingApplicationDeletion() {
    consultingApplicationDeletionGeneration++;
    consultingApplicationDeletion?.waitController?.abort();
    consultingApplicationDeletion = null;
    document.getElementById('consultingDeleteApplicationDialog')?.close();
    const input = document.getElementById('consultingDeleteApplicationConfirmation'); if (input) input.value = '';
    for (const id of ['consultingDeleteApplicationTarget', 'consultingDeleteApplicationStatus']) document.getElementById(id)?.replaceChildren();
    const button = document.getElementById('consultingDeleteApplicationBtn'); if (button) button.hidden = true;
}
function closeConsultingApplicationDeletion() {
    if (consultingApplicationDeletion?.busy && !consultingApplicationDeletion.waiting) return;
    resetConsultingApplicationDeletion();
    const button = document.getElementById('consultingDeleteApplicationBtn');
    if (button && currentConsultingApplication?.deletion?.available === true) { button.hidden = false; button.focus(); }
}
function updateConsultingApplicationDeletion() {
    const state = consultingApplicationDeletion;
    document.getElementById('consultingDeleteApplicationConfirm').disabled = !state?.preview || state.busy || document.getElementById('consultingDeleteApplicationConfirmation').value !== '신청 영구 삭제';
}
async function openConsultingApplicationDeletion() {
    if (consultingMutationBusy || consultingApplicationDeletion?.busy || currentConsultingApplication?.deletion?.available !== true || !consultingWorkspaceReference?.sourceResponseId) return;
    resetConsultingApplicationDeletion();
    const generation = consultingApplicationDeletionGeneration, reference = { applicationId: currentConsultingApplication.application.applicationId, sourceResponseId: consultingWorkspaceReference.sourceResponseId };
    consultingApplicationDeletion = { reference, preview: null, busy: false };
    const dialog = document.getElementById('consultingDeleteApplicationDialog'), status = document.getElementById('consultingDeleteApplicationStatus');
    document.getElementById('consultingDeleteApplicationBtn').hidden = false;
    document.getElementById('consultingDeleteApplicationTarget').textContent = `${currentConsultingApplication.contact.studentName || '선택한 학생'} · ${currentConsultingApplication.contact.phone || ''}`;
    document.getElementById('consultingDeleteApplicationRetry').hidden = true;
    document.getElementById('consultingDeleteApplicationCancel').disabled = false;
    document.getElementById('consultingDeleteApplicationConfirmation').disabled = false;
    updateConsultingApplicationDeletion(); dialog.showModal(); status.textContent = '삭제 대상과 현재 상태를 확인하고 있습니다.'; status.dataset.state = 'loading';
    try {
        const preview = await requestConsultingAdmin('admin_preview_consulting_application_delete', reference);
        if (generation !== consultingApplicationDeletionGeneration) return;
        if (preview.storageIncluded !== true || preview.applicationId !== reference.applicationId || preview.confirmation !== '신청 영구 삭제' || typeof preview.previewToken !== 'string' || !preview.previewToken || preview.previewToken.length > 2400 || typeof preview.resume !== 'boolean' || typeof preview.includesCase !== 'boolean'
            || !Number.isSafeInteger(preview.deletedCount) || preview.deletedCount < 0 || preview.recordCount !== null && (!Number.isSafeInteger(preview.recordCount) || preview.recordCount < 1)) throw new Error('삭제 범위를 확인하지 못했습니다.');
        consultingApplicationDeletion.preview = preview;
        status.textContent = preview.resume ? `삭제가 진행 중인 신청입니다. 이미 정리한 ${preview.deletedCount}개 기록에 이어 남은 파일과 기록을 삭제합니다.` : `약 ${preview.recordCount}개 DB 기록과 이 신청에 연결된 첨부·PDF 원본이 대상입니다.${preview.includesCase ? ' 조사서와 상담·보고서도 포함됩니다.' : ' 아직 연결된 컨설팅 케이스는 없습니다.'}`;
        status.dataset.state = ''; document.getElementById('consultingDeleteApplicationConfirmation').focus();
    } catch (_error) {
        if (generation !== consultingApplicationDeletionGeneration) return;
        status.textContent = '삭제 대상 확인에 실패했습니다. 서버 적용·권한·현재 신청 상태를 확인한 뒤 다시 시도해주세요. 삭제 요청은 보내지 않았습니다.'; status.dataset.state = 'error';
        document.getElementById('consultingDeleteApplicationRetry').hidden = false;
    }
    if (generation === consultingApplicationDeletionGeneration) updateConsultingApplicationDeletion();
}
async function deleteConsultingApplication() {
    const state = consultingApplicationDeletion, generation = consultingApplicationDeletionGeneration;
    if (!state?.preview || state.busy || document.getElementById('consultingDeleteApplicationConfirmation').value !== '신청 영구 삭제') return;
    state.busy = true; updateConsultingApplicationDeletion();
    for (const id of ['consultingDeleteApplicationConfirmation', 'consultingDeleteApplicationCancel']) document.getElementById(id).disabled = true;
    const status = document.getElementById('consultingDeleteApplicationStatus'); status.dataset.state = 'loading';
    try {
        let deletedCount = state.preview.deletedCount;
        for (let step = 0; step < 1000; step++) {
            status.textContent = `신청의 원본 파일과 기록을 정리하고 있습니다. 현재 ${deletedCount}개 DB 기록을 정리했습니다.`;
            const result = await requestConsultingAdmin('admin_delete_consulting_application', { ...state.reference, previewToken: state.preview.previewToken, confirmation: '신청 영구 삭제' });
            if (generation !== consultingApplicationDeletionGeneration) return;
            if (result.applicationId !== state.reference.applicationId || typeof result.complete !== 'boolean' || !Number.isSafeInteger(result.deletedCount) || result.deletedCount < 0 || result.complete && result.storageComplete !== true) throw new Error('삭제 결과를 확인하지 못했습니다.');
            if (!result.complete) {
                if (typeof result.previewToken !== 'string' || !result.previewToken || result.previewToken.length > 2400) throw new Error('삭제 확인을 갱신하지 못했습니다.');
                state.preview.previewToken = result.previewToken;
            }
            if (result.complete) {
                consultingExportStudents.delete(state.reference.applicationId);
                resetConsultingApplicationDeletion();
                const navigation = consultingWorkspaceNavigate({}, true), workspaceGeneration = consultingWorkspaceGeneration;
                await navigation;
                if (workspaceGeneration !== consultingWorkspaceGeneration || readAdminLocation().section !== 'consulting') return;
                const listFailed = document.getElementById('consultingDirectoryStatus').dataset.state === 'error';
                consultingWorkspaceStatus('consultingDirectoryStatus', listFailed ? '신청·원본 영구 삭제는 완료했습니다. 학생 목록을 불러오지 못했으니 목록을 새로고침해주세요.' : '선택한 신청의 DB 기록과 첨부·PDF 원본을 영구 삭제했습니다.', listFailed ? 'error' : 'success');
                return;
            }
            deletedCount = result.deletedCount;
            if (result.retryAfterSeconds !== undefined) {
                if (!Number.isSafeInteger(result.retryAfterSeconds) || result.retryAfterSeconds < 1 || result.retryAfterSeconds > 1200) throw new Error('삭제 대기 시간을 확인하지 못했습니다.');
                const until = new Date(Date.now() + result.retryAfterSeconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                status.textContent = `진행 중이던 파일 작업이 끝나기를 기다리고 있습니다. ${until} 이후 자동으로 이어서 정리합니다. 지금 창을 닫아도 나중에 같은 신청에서 다시 시작할 수 있습니다.`;
                state.waiting = true; state.waitController = new AbortController();
                document.getElementById('consultingDeleteApplicationCancel').disabled = false;
                const continued = await new Promise(resolve => {
                    const timer = setTimeout(() => resolve(true), result.retryAfterSeconds * 1000);
                    state.waitController.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(false); }, { once: true });
                });
                if (!continued || generation !== consultingApplicationDeletionGeneration) return;
                state.waiting = false; document.getElementById('consultingDeleteApplicationCancel').disabled = true;
                const renewed = await requestConsultingAdmin('admin_preview_consulting_application_delete', state.reference);
                if (generation !== consultingApplicationDeletionGeneration) return;
                if (renewed.applicationId !== state.reference.applicationId || renewed.storageIncluded !== true || renewed.resume !== true || typeof renewed.previewToken !== 'string' || !renewed.previewToken || renewed.previewToken.length > 2400) throw new Error('삭제 대상이 변경되었습니다.');
                state.preview = renewed;
            }
        }
        throw new Error('남은 삭제 기록을 확인해주세요.');
    } catch (_error) {
        if (generation !== consultingApplicationDeletionGeneration) return;
        state.busy = false; state.waiting = false; state.preview = null;
        status.textContent = '삭제 완료를 확인하지 못했습니다. 일부 파일·기록은 이미 삭제되었을 수 있습니다. ‘삭제 상태 다시 확인’으로 남은 원본과 기록을 확인한 뒤 이어서 처리해주세요.'; status.dataset.state = 'error';
        document.getElementById('consultingDeleteApplicationRetry').hidden = false;
        document.getElementById('consultingDeleteApplicationCancel').disabled = false;
        document.getElementById('consultingDeleteApplicationConfirmation').disabled = false;
        updateConsultingApplicationDeletion();
    }
}

function resetConsultingIntake() {
    setConsultingIntakeBusy(false);
    closeConsultingDetail();
    setConsultingStatus('');
    setConsultingActionStatus('');
}

async function runConsultingMutation(type, data, successMessage) {
    if (consultingMutationBusy || currentConsultingApplication?.application.applicationId !== data.applicationId) return null;
    const requestId = consultingApplicationRequest;
    setConsultingIntakeBusy(true);
    setConsultingActionStatus('처리 중입니다. 중복 요청하지 말고 결과를 기다려주세요.', 'loading');
    let result;
    try {
        result = await requestConsultingAdmin(type, data);
        if (type === 'admin_review_application_input' && (result.applicationId !== data.applicationId || result.inputReviewRequired !== false || result.revision !== data.expectedRevision + 1)) throw new Error('신청 정보 저장 결과를 확인하지 못했습니다.');
    } catch (error) {
        if (requestId === consultingApplicationRequest) {
            invalidateConsultingWorkspaceStudent();
            const message = error?.status === 409 ? '신청 상태가 변경됐거나 결과 확인이 필요합니다.' : '처리를 완료했는지 확인하지 못했습니다.';
            setConsultingActionStatus(`${message} 학생 상세를 다시 조회한 뒤 판단해주세요. 자동으로 재전송하지 않습니다.`, 'error');
        }
        return null;
    } finally {
        if (requestId === consultingApplicationRequest || !currentConsultingApplication) setConsultingIntakeBusy(false);
    }
    if (requestId !== consultingApplicationRequest) return result;
    if (await refreshConsultingWorkspaceStudent()) setConsultingActionStatus(typeof successMessage === 'function' ? successMessage(result) : successMessage, 'success');
    return result;
}

async function approveConsultingPayment() {
    const application = currentConsultingApplication?.application;
    if (consultingMutationBusy || !consultingPaymentIsEditable(application)) return;
    if (consultingInputNeedsReview(application)) return setConsultingStatus('신청 정보 보완·확인을 먼저 저장해주세요.', 'error');
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

async function saveConsultingApplicationInput() {
    const current = currentConsultingApplication, application = current?.application;
    if (consultingMutationBusy || !consultingPaymentIsEditable(application)) return;
    if (!document.getElementById('consultingInputConfirmed').checked) return setConsultingStatus('신청 정보와 연락처의 수신 대상을 직접 확인해주세요.', 'error');
    const input = Object.fromEntries(Object.entries(consultingInputFields).map(([field, id]) => [field, document.getElementById(id).value]));
    for (const [field, choice] of [['payerRelationshipDetail', 'payerRelationship'], ['contactMethodDetail', 'contactMethod']]) if (input[choice] === 'other' && current[field]) input[field] = current[field];
    await runConsultingMutation('admin_review_application_input', { applicationId: application.applicationId, expectedRevision: application.revision, idempotencyKey: currentConsultingMutationKeys.input, inputReviewConfirmed: true, input }, '신청 정보 확인·저장 완료. 계좌 내역을 대조한 뒤 입금 승인을 진행하세요.');
}

async function reviewConsultingPayment(decision) {
    const detail = currentConsultingApplication;
    const application = detail?.application;
    if (consultingMutationBusy || !consultingPaymentIsEditable(application)) return;
    const hold = decision === 'hold';
    const form = hold ? 'Hold' : 'Reject';
    const reasonCode = document.getElementById(`consulting${form}Reason`).value;
    const reasonText = document.getElementById(`consulting${form}Note`).value.trim();
    if (reasonText.length > 500 || (reasonCode === 'OTHER' && !reasonText)) return setConsultingStatus('기타 사유는 필수이며, 메모는 500자 이내로 입력해주세요.', 'error');
    const sourceResponseId = detail.student?.sourceResponseId;
    if (!sourceResponseId) return setConsultingActionStatus('신청 목록에서 이 학생을 다시 선택해 주세요.', 'error');
    const data = { applicationId: application.applicationId, sourceResponseId, expectedRevision: application.revision,
        idempotencyKey: currentConsultingMutationKeys[decision], reasonCode, reasonText };
    const requestId = consultingApplicationRequest;
    setConsultingIntakeBusy(true);
    setConsultingActionStatus('학생에게 전달될 안내를 확인하고 있습니다.', 'loading');
    let preview;
    try {
        preview = await requestConsultingAdmin('admin_preview_application_review_notice', { ...data, decision });
        if (preview?.applicationId !== data.applicationId || preview.revision !== data.expectedRevision || typeof preview.previewToken !== 'string'
            || typeof preview.willQueue !== 'boolean' || (preview.willQueue && typeof preview.message !== 'string')) throw new Error('안내 응답을 확인할 수 없습니다.');
    } catch (error) {
        if (requestId === consultingApplicationRequest) setConsultingActionStatus(error?.message || '안내 문구를 불러오지 못했습니다.', 'error');
        return;
    } finally {
        if (requestId === consultingApplicationRequest || !currentConsultingApplication) setConsultingIntakeBusy(false);
    }
    if (requestId !== consultingApplicationRequest) return;
    setConsultingActionStatus('');
    const title = hold ? '신청을 보류할까요?' : '신청을 거절할까요?';
    const message = preview.willQueue ? `${title}\n\n문자 수신처 · ${preview.recipient || '전화번호 확인 필요'}\n\n${preview.message}`
        : `${title}\n\n이미 보류 중인 신청입니다. 기존 안내 이력을 확인할 수 있습니다.`;
    if (!confirm(message)) return;
    await runConsultingMutation(hold ? 'admin_hold_payment_review' : 'admin_reject_application', { ...data, previewToken: preview.previewToken }, result => {
        if (!result.notificationQueued) return '이미 보류 중인 신청입니다. 신청 안내 이력을 확인해 주세요.';
        return `${hold ? '보류 처리' : '신청 거절'} 완료. 문자 안내를 예약했습니다. 접수 상태는 신청 안내 이력에서 확인해 주세요.`;
    });
}

async function holdConsultingPayment() { return reviewConsultingPayment('hold'); }
async function rejectConsultingApplication() { return reviewConsultingPayment('reject'); }

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
    const reason = prompt('취소하려면 초대 취소를 정확히 입력해주세요.', ''); if (reason === null) return;
    const normalized = reason; if (normalized !== '초대 취소') return setConsultingStatus('초대 취소를 정확히 입력해주세요.', 'error');
    if (!confirm('미사용 초대를 취소할까요? 기존 링크·코드는 사용할 수 없게 됩니다. 이미 발송 중인 메시지는 회수되지 않으며 입금·이용권 환불은 별도입니다.')) return;
    await runConsultingMutation('admin_revoke_consulting_invite', { applicationId: application.applicationId, expectedRevision: application.revision, reason: normalized, idempotencyKey: crypto.randomUUID() }, '미사용 초대 취소 완료. 환불은 별도 처리이며 필요하면 새 초대를 재발급할 수 있습니다.');
}

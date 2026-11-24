const calculatorAdminPhaseLabels = Object.freeze({ all: '전체 신청', intake: '입금 대기', onboarding: '이용 인증 대기', completed: '이용권 활성', expired: '기간 종료', attention: '보류·거절·확인 필요' });
let calculatorAdminState = { generation: 0, phase: 'all', cursor: null, nextCursor: null, previous: [], reference: null, detail: null, keys: {}, request: null, busy: false };
const calculatorAdminNode = id => document.getElementById(id);
let calculatorAdminDeletion = null;

function calculatorAdminStatus(id, message, state = '') {
    const node = calculatorAdminNode(id);
    if (node) { node.textContent = message; node.dataset.state = state; }
}
function resetCalculatorAdminDeletion() {
    calculatorAdminDeletion?.controller.abort();
    calculatorAdminDeletion = null;
    calculatorAdminNode('calculatorAdminDeleteDialog')?.close();
    const input = calculatorAdminNode('calculatorAdminDeleteConfirmation'); if (input) input.value = '';
    calculatorAdminNode('calculatorAdminDeleteTarget')?.replaceChildren();
    calculatorAdminStatus('calculatorAdminDeleteStatus', '');
    const section = calculatorAdminNode('calculatorAdminDeleteSection'); if (section) section.hidden = true;
}
function closeCalculatorAdminDeletion() {
    if (calculatorAdminDeletion?.busy) return;
    resetCalculatorAdminDeletion(); updateCalculatorAdminActions();
    calculatorAdminNode('calculatorAdminDelete')?.focus();
}
function updateCalculatorAdminDeletion() {
    const state = calculatorAdminDeletion;
    calculatorAdminNode('calculatorAdminDeleteConfirm').disabled = !state?.preview || state.busy || calculatorAdminNode('calculatorAdminDeleteConfirmation').value !== '신청 영구 삭제';
}
async function openCalculatorAdminDeletion() {
    const owner = calculatorAdminState;
    if (owner.busy || calculatorAdminDeletion?.busy || owner.detail?.deletion?.available !== true || !owner.reference) return;
    resetCalculatorAdminDeletion();
    owner.request?.abort(); owner.request = null; ++owner.generation;
    const state = { owner, generation: owner.generation, reference: { ...owner.reference }, controller: new AbortController(), preview: null, busy: false };
    calculatorAdminDeletion = state; updateCalculatorAdminActions();
    const current = () => calculatorAdminDeletion === state && owner === calculatorAdminState && owner.generation === state.generation;
    calculatorAdminNode('calculatorAdminDeleteTarget').textContent = owner.detail.contact.studentName + ' · ' + owner.detail.contact.phone;
    calculatorAdminNode('calculatorAdminDeleteRetry').hidden = true;
    calculatorAdminNode('calculatorAdminDeleteCancel').disabled = false;
    calculatorAdminNode('calculatorAdminDeleteConfirmation').disabled = false;
    updateCalculatorAdminDeletion(); calculatorAdminNode('calculatorAdminDeleteDialog').showModal();
    calculatorAdminStatus('calculatorAdminDeleteStatus', '삭제 대상과 현재 상태를 확인하고 있습니다.');
    try {
        const preview = await requestConsultingAdmin('admin_preview_consulting_application_delete', state.reference, state.controller.signal);
        if (!current()) return;
        if (preview.applicationId !== state.reference.applicationId || preview.confirmation !== '신청 영구 삭제'
            || preview.backgroundSupported !== true || preview.storageIncluded !== true || preview.includesCase !== false
            || typeof preview.previewToken !== 'string' || !preview.previewToken || preview.previewToken.length > 2400
            || typeof preview.resume !== 'boolean' || !Number.isSafeInteger(preview.deletedCount) || preview.deletedCount < 0
            || preview.recordCount !== null && (!Number.isSafeInteger(preview.recordCount) || preview.recordCount < 1)) throw new Error('삭제 범위를 확인하지 못했습니다.');
        state.preview = preview;
        calculatorAdminStatus('calculatorAdminDeleteStatus', preview.resume ? '이미 접수된 삭제의 남은 자료를 정리합니다. 확인 문구를 입력해주세요.' : '신청에 연결된 기록과 이용권이 삭제 대상입니다. 아래 확인 문구를 입력해주세요.');
        calculatorAdminNode('calculatorAdminDeleteConfirmation').focus();
    } catch (_) {
        if (!current()) return;
        calculatorAdminStatus('calculatorAdminDeleteStatus', '삭제 대상 확인에 실패했습니다. 권한과 현재 신청 상태를 확인한 뒤 다시 확인해주세요. 삭제 요청은 보내지 않았습니다.', 'error');
        calculatorAdminNode('calculatorAdminDeleteRetry').hidden = false;
    }
    if (current()) updateCalculatorAdminDeletion();
}
async function deleteCalculatorAdminApplication() {
    const state = calculatorAdminDeletion, owner = calculatorAdminState;
    if (!state?.preview || state.busy || state.owner !== owner || state.generation !== owner.generation
        || owner.busy || calculatorAdminNode('calculatorAdminDeleteConfirmation').value !== '신청 영구 삭제') return;
    state.busy = true; owner.busy = true; updateCalculatorAdminActions(); updateCalculatorAdminDeletion();
    calculatorAdminNode('calculatorAdminDeleteRetry').hidden = true;
    for (const id of ['calculatorAdminDeleteConfirmation', 'calculatorAdminDeleteCancel']) calculatorAdminNode(id).disabled = true;
    calculatorAdminStatus('calculatorAdminDeleteStatus', '신청 삭제를 요청하고 있습니다.');
    const current = () => calculatorAdminDeletion === state && owner === calculatorAdminState && owner.generation === state.generation;
    try {
        const result = await requestConsultingAdmin('admin_delete_consulting_application', { ...state.reference, previewToken: state.preview.previewToken, confirmation: '신청 영구 삭제', backgroundCleanup: true }, state.controller.signal);
        if (!current()) return;
        if (result.applicationId !== state.reference.applicationId || result.accepted !== true || result.backgroundCleanup !== true || result.complete !== false) throw new Error('삭제 접수 결과를 확인하지 못했습니다.');
        owner.busy = false; resetCalculatorAdminDeletion();
        const generation = owner.generation + 1;
        await calculatorAdminNavigate({});
        if (owner !== calculatorAdminState || generation !== owner.generation || readAdminLocation().section !== 'calculator') return;
        const failed = calculatorAdminNode('calculatorAdminListStatus').dataset.state === 'error';
        calculatorAdminStatus('calculatorAdminListStatus', failed ? '삭제는 접수했습니다. 목록을 불러오지 못했으니 새로고침해주세요. 남은 자료는 자동 정리됩니다.' : '신청을 목록에서 제거했습니다. 연결된 이용권과 남은 자료는 서버에서 자동 정리합니다.', failed ? 'error' : 'success');
        calculatorAdminNode('calculatorAdminListStatus').focus({ preventScroll: true });
    } catch (_) {
        if (!current()) return;
        state.busy = false; owner.busy = false; state.preview = null;
        updateCalculatorAdminActions(); updateCalculatorAdminDeletion();
        calculatorAdminStatus('calculatorAdminDeleteStatus', '삭제 접수 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다. 창을 닫고 목록을 새로고침해 실제 상태를 확인해주세요. 접수된 삭제는 서버에서 계속 처리됩니다.', 'error');
        for (const id of ['calculatorAdminDeleteConfirmation', 'calculatorAdminDeleteCancel']) calculatorAdminNode(id).disabled = false;
        // 요청 결과가 불확실하면 목록에서 다시 선택해야 한다.
    }
}
function clearCalculatorAdminDetail() {
    resetCalculatorAdminDeletion();
    calculatorAdminState.detail = null; calculatorAdminState.keys = {};
    calculatorAdminNode('calculatorAdminState')?.replaceChildren();
    calculatorAdminNode('calculatorAdminFacts')?.replaceChildren();
    calculatorAdminNode('calculatorAdminSavedInput')?.replaceChildren();
    calculatorAdminStatus('calculatorAdminSavedStatus', '');
    for (const id of ['calculatorAdminName', 'calculatorAdminPhone', 'calculatorAdminEmail', 'calculatorAdminPayer', 'calculatorAdminPaidAmount', 'calculatorAdminPaidAt', 'calculatorAdminReason']) {
        const node = calculatorAdminNode(id); if (node) node.value = '';
    }
    for (const id of ['calculatorAdminInputConfirmed', 'calculatorAdminPayerConfirmed']) {
        const node = calculatorAdminNode(id); if (node) node.checked = false;
    }
    const title = calculatorAdminNode('calculatorAdminDetailTitle'); if (title) title.textContent = '계산기 신청 상세';
    const content = calculatorAdminNode('calculatorAdminDetailContent'); if (content) content.hidden = true;
    const input = calculatorAdminNode('calculatorAdminInput'); if (input) input.open = false;
    const review = calculatorAdminNode('calculatorAdminReview'); if (review) review.open = false;
}
function resetCalculatorAdmin() {
    calculatorAdminState.request?.abort();
    const generation = calculatorAdminState.generation + 1;
    clearCalculatorAdminDetail();
    calculatorAdminState = { generation, phase: 'all', cursor: null, nextCursor: null, previous: [], reference: null, detail: null, keys: {}, request: null, busy: false };
    calculatorAdminNode('calculatorAdminListBody')?.replaceChildren();
    const detail = calculatorAdminNode('calculatorAdminDetail'); if (detail) detail.hidden = true;
    const list = calculatorAdminNode('calculatorAdminList'); if (list) list.hidden = false;
    calculatorAdminStatus('calculatorAdminListStatus', ''); calculatorAdminStatus('calculatorAdminDetailStatus', '');
    const page = calculatorAdminNode('calculatorAdminPage'); if (page) page.textContent = '';
}
function calculatorAdminNavigate(route) {
    if (calculatorAdminState.busy) return;
    writeAdminLocation({ section: 'calculator', phase: calculatorAdminState.phase, ...route });
    return activateCalculatorAdmin(readAdminLocation());
}
function selectCalculatorAdminPhase(phase) {
    if (ADMIN_CALCULATOR_PHASES.includes(phase)) return calculatorAdminNavigate({ phase });
}
function closeCalculatorAdminDetail() { return calculatorAdminNavigate({}); }
function refreshCalculatorAdmin() {
    if (calculatorAdminState.busy) return;
    return calculatorAdminState.reference ? loadCalculatorAdminDetail(calculatorAdminState.reference) : loadCalculatorAdminList();
}
function activateCalculatorAdmin(route) {
    const state = calculatorAdminState, phase = ADMIN_CALCULATOR_PHASES.includes(route.phase) ? route.phase : 'all';
    if (state.phase !== phase) { state.cursor = null; state.nextCursor = null; state.previous = []; }
    state.phase = phase;
    document.querySelectorAll('[data-calculator-phase]').forEach(button => button.setAttribute('aria-current', button.dataset.calculatorPhase === phase ? 'page' : 'false'));
    const notice = calculatorAdminNode('calculatorAdminOpeningNotice'); if (notice) notice.hidden = Date.now() >= Date.parse('2026-11-28T00:00:00+09:00');
    if (route.applicationId && route.sourceResponseId) return loadCalculatorAdminDetail({ applicationId: route.applicationId, sourceResponseId: route.sourceResponseId });
    return loadCalculatorAdminList();
}
function nextCalculatorAdminPage() {
    const state = calculatorAdminState;
    if (state.busy || !state.nextCursor) return;
    state.previous.push(state.cursor); state.cursor = state.nextCursor;
    return loadCalculatorAdminList();
}
function previousCalculatorAdminPage() {
    const state = calculatorAdminState;
    if (state.busy || !state.previous.length) return;
    state.cursor = state.previous.pop(); return loadCalculatorAdminList();
}
async function loadCalculatorAdminList() {
    const state = calculatorAdminState;
    state.request?.abort(); const controller = new AbortController(); state.request = controller;
    const generation = ++state.generation; state.reference = null; clearCalculatorAdminDetail();
    calculatorAdminNode('calculatorAdminList').hidden = false; calculatorAdminNode('calculatorAdminDetail').hidden = true;
    const body = calculatorAdminNode('calculatorAdminListBody'); body.replaceChildren();
    for (const id of ['calculatorAdminPrevious', 'calculatorAdminNext']) calculatorAdminNode(id).disabled = true;
    calculatorAdminStatus('calculatorAdminListStatus', '계산기 신청을 불러오고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_list_calculator_applications', { phase: state.phase, cursor: state.cursor }, controller.signal);
        if (state !== calculatorAdminState || generation !== state.generation) return;
        if (data.scope !== 'calculator' || data.productType !== 'calculator' || !Array.isArray(data.items) || data.items.length > 20
            || data.items.some(item => item.productType !== 'calculator' || !/^APP_[0-9a-f-]{36}$/i.test(item.applicationId || '') || !/^[A-Za-z0-9_-]{8,200}$/.test(item.sourceResponseId || ''))
            || data.nextCursor != null && (typeof data.nextCursor !== 'string' || data.nextCursor.length > 1600)) throw new Error('계산기 신청 목록 형식을 확인할 수 없습니다.');
        const issues = consultingDirectoryIssueRows(data);
        state.nextCursor = data.nextCursor || null;
        for (const item of data.items) {
            const row = document.createElement('tr'), person = createConsultingCell(''), name = document.createElement('strong'), contact = document.createElement('span');
            const personContent = document.createElement('div');
            name.textContent = item.studentNameMask || '이름 확인 필요'; contact.textContent = item.phoneMask || '연락처 확인 필요'; personContent.append(name, contact); person.append(personContent);
            const status = createConsultingCell(''), badge = document.createElement('span');
            badge.className = 'calculator-admin-badge'; badge.textContent = item.stateLabel;
            badge.dataset.phase = ADMIN_CALCULATOR_PHASES.includes(item.phase) ? item.phase : ''; status.append(badge);
            row.append(person, status, createConsultingCell(item.nextAction + (item.inputSummary?.status === 'saved' ? ' · 자료 저장 ' + item.inputSummary.candidateCount + '개 후보' : '')), createConsultingCell(formatConsultingDate(item.accessEndsAt)));
            const action = createConsultingCell(''), button = document.createElement('button');
            action.className = 'calculator-admin-row-action';
            button.type = 'button'; button.className = 'consulting-btn consulting-btn-primary'; button.textContent = '계산기 신청 상세';
            button.addEventListener('click', () => calculatorAdminNavigate({ applicationId: item.applicationId, sourceResponseId: item.sourceResponseId }));
            action.append(button); row.append(action);
            [...row.children].forEach((cell, index) => { cell.dataset.label = ['이용자', '신청 상태', '다음 할 일', '이용 기간', '상세'][index]; });
            body.append(row);
        }
        appendConsultingDirectoryIssues(body, issues);
        for (const row of body.querySelectorAll('[data-directory-issue]')) {
            const content = document.createElement('div'); content.append(...row.firstElementChild.childNodes); row.firstElementChild.append(content);
            row.lastElementChild.classList.add('calculator-admin-row-action');
        }
        if (!data.items.length && !issues.length) {
            const row = document.createElement('tr'), cell = createConsultingCell('이 페이지에 해당 상태의 계산기 신청이 없습니다. 다음 페이지가 있으면 계속 확인해주세요.');
            cell.colSpan = 5; cell.className = 'empty-msg'; row.append(cell); body.append(row);
        }
        calculatorAdminNode('calculatorAdminPage').textContent = (state.previous.length + 1) + '페이지 · ' + data.items.length + '명';
        calculatorAdminStatus('calculatorAdminListStatus', calculatorAdminPhaseLabels[state.phase] + ' · 현재 페이지 ' + data.items.length + '명'
            + (data.unavailableCount ? ' · 확인 필요 ' + data.unavailableCount + '건' : '') + (state.nextCursor ? ' · 다음 페이지가 있습니다.' : ''), data.unavailableCount ? 'error' : 'success');
    } catch (_) {
        if (state !== calculatorAdminState || generation !== state.generation) return;
        body.replaceChildren(); state.nextCursor = null;
        calculatorAdminStatus('calculatorAdminListStatus', '계산기 신청 목록을 불러오지 못했습니다. 서버 적용 상태와 권한을 확인한 뒤 다시 불러와주세요.', 'error');
    } finally {
        if (state === calculatorAdminState && generation === state.generation) {
            state.request = null;
            calculatorAdminNode('calculatorAdminPrevious').disabled = !state.previous.length;
            calculatorAdminNode('calculatorAdminNext').disabled = !state.nextCursor;
        }
    }
}
function updateCalculatorAdminActions() {
    const state = calculatorAdminState, data = state.detail, status = data?.calculator;
    calculatorAdminNode('calculatorAdminDetailContent')?.querySelectorAll('button, input, select, textarea').forEach(control => { control.disabled = state.busy; });
    for (const [id, show] of [['calculatorAdminInput', status?.canReviewInput], ['calculatorAdminPayment', status?.canApprove],
        ['calculatorAdminReview', status?.canReviewPayment], ['calculatorAdminReissue', status?.canReissue && data?.activeInviteId],
        ['calculatorAdminDeleteSection', data?.deletion?.available === true]]) {
        const node = calculatorAdminNode(id); if (node) node.hidden = !show;
    }
    const approve = calculatorAdminNode('calculatorAdminApprove');
    if (approve) approve.disabled = state.busy || status?.canApprove !== true || data?.campaignReady === false;
}
function renderCalculatorAdminDetail(data) {
    const application = data.application, status = data.calculator;
    const facts = calculatorAdminNode('calculatorAdminFacts'); facts.replaceChildren();
    calculatorAdminNode('calculatorAdminDetailTitle').textContent = data.contact.studentName + ' · 합격 계산기';
    calculatorAdminNode('calculatorAdminState').textContent = status.stateLabel;
    calculatorAdminNode('calculatorAdminState').dataset.phase = ADMIN_CALCULATOR_PHASES.includes(status.phase) ? status.phase : '';
    appendConsultingRecord(facts, '신청·이용 상태', createConsultingFacts([
        ['접수번호', application.applicationId], ['현재 상태', status.stateLabel], ['다음 할 일', status.nextAction],
        ['신청 금액', formatConsultingMoney(application.expectedAmount)], ['이용권 연결', status.accountLinked ? '인증된 계정 연결 확인' : '연결 확인 전'],
        ['이용 기한', formatConsultingDate(status.expiresAt)], ['이용 안내 발급', formatConsultingDate(data.invitedAt)]
    ]));
    appendConsultingRecord(facts, '이용자·입금 정보', createConsultingFacts([
        ['이용자 이름', data.contact.studentName], ['전화번호', data.contact.phone], ['이메일', data.contact.email], ['입금자명', data.contact.payerName],
        ['입금 확인', ({ pending: '대기', hold: '보류', input_review: '신청 정보 확인 필요', verified: '승인', rejected: '거절' })[application.paymentReviewStatus] || '확인 필요']
    ]));
    if (Array.isArray(data.reviewNotices) && data.reviewNotices.length) {
        const states = { pending: '발송 대기', processing: '발송 요청 중', sent: '발송 접수', failed: '발송 실패', dead_letter: '발송 실패', superseded: '이전 안내' };
        appendConsultingRecord(facts, '보류·거절 안내 이력', createConsultingFacts(data.reviewNotices.map(item => {
            const status = item.errorCode === 'NOTIFICATION_DELIVERY_UNCERTAIN' ? '발송 결과 확인 필요' : (states[item.status] || '상태 확인 필요');
            return [formatConsultingDate(item.createdAt), `${item.decision === 'hold' ? '보류' : '거절'} · ${status} · ${item.channel === 'kakao' ? '알림톡' : '문자'}`];
        })));
    }
    for (const card of facts.children) card.className = 'calculator-admin-card';
    for (const [field, id] of Object.entries({ studentName: 'calculatorAdminName', phone: 'calculatorAdminPhone', email: 'calculatorAdminEmail', payerName: 'calculatorAdminPayer' })) calculatorAdminNode(id).value = data.contact[field];
    calculatorAdminNode('calculatorAdminInput').open = application.inputReviewRequired === true || application.paymentReviewStatus === 'input_review';
    calculatorAdminNode('calculatorAdminDetailContent').hidden = false;
    updateCalculatorAdminActions();
}
async function loadCalculatorAdminDetail(reference) {
    const state = calculatorAdminState;
    state.request?.abort(); const controller = new AbortController(); state.request = controller;
    const generation = ++state.generation; clearCalculatorAdminDetail(); state.reference = { ...reference };
    calculatorAdminNode('calculatorAdminList').hidden = true; calculatorAdminNode('calculatorAdminDetail').hidden = false;
    calculatorAdminStatus('calculatorAdminDetailStatus', '계산기 신청 정보를 불러오고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_get_calculator_application', reference, controller.signal);
        if (state !== calculatorAdminState || generation !== state.generation) return false;
        if (data.scope !== 'calculator' || data.sourceResponseId !== reference.sourceResponseId || data.application?.applicationId !== reference.applicationId
            || data.application.productType !== 'calculator' || !Number.isSafeInteger(data.application.revision) || data.application.revision < 0
            || !data.calculator || typeof data.calculator.stateLabel !== 'string'
            || !data.contact || ['studentName', 'phone', 'email', 'payerName'].some(key => typeof data.contact[key] !== 'string' || data.contact[key].length > 320)) throw new Error('계산기 신청 상세 형식을 확인할 수 없습니다.');
        state.detail = data;
        state.keys = Object.fromEntries(['payment', 'input', 'hold', 'reject', 'reissue'].map(key => [key, consultingRequestKey('calculator-' + key)]));
        renderCalculatorAdminDetail(data);
        calculatorAdminStatus('calculatorAdminDetailStatus', '', 'success');
        calculatorAdminNode('calculatorAdminDetailTitle').focus({ preventScroll: true });
        return true;
    } catch (_) {
        if (state !== calculatorAdminState || generation !== state.generation) return false;
        clearCalculatorAdminDetail();
        calculatorAdminStatus('calculatorAdminDetailStatus', '계산기 신청 상세를 불러오지 못했습니다. 목록에서 다시 선택하거나 정보를 새로고침해주세요.', 'error');
        return false;
    } finally { if (state === calculatorAdminState && generation === state.generation) state.request = null; }
}
async function runCalculatorAdminMutation(type, data, successMessage) {
    const state = calculatorAdminState, generation = state.generation;
    if (state.busy || calculatorAdminDeletion || !state.detail || !state.reference) return;
    state.busy = true; updateCalculatorAdminActions();
    calculatorAdminStatus('calculatorAdminDetailStatus', '계산기 신청을 처리하고 있습니다.');
    try {
        const result = await requestConsultingAdmin(type, { ...state.reference, expectedRevision: state.detail.application.revision, ...data });
        if (state !== calculatorAdminState || generation !== state.generation) return;
        state.busy = false;
        const refreshedGeneration = state.generation + 1;
        if (await loadCalculatorAdminDetail(state.reference) && state === calculatorAdminState && state.generation === refreshedGeneration) {
            calculatorAdminStatus('calculatorAdminDetailStatus', typeof successMessage === 'function' ? successMessage(result) : successMessage, 'success');
        }
    } catch (_) {
        if (state !== calculatorAdminState || generation !== state.generation) return;
        clearCalculatorAdminDetail();
        calculatorAdminStatus('calculatorAdminDetailStatus', '처리 결과를 확인하지 못했습니다. 자동으로 재전송하지 않습니다. 정보를 새로고침하고 실제 상태를 확인해주세요.', 'error');
    } finally { if (state === calculatorAdminState && generation === state.generation) { state.busy = false; updateCalculatorAdminActions(); } }
}
async function approveCalculatorAdminPayment() {
    const state = calculatorAdminState, data = state.detail;
    if (state.busy || data?.calculator?.canApprove !== true || data.campaignReady === false) return;
    const paidAmount = Number(calculatorAdminNode('calculatorAdminPaidAmount').value), value = calculatorAdminNode('calculatorAdminPaidAt').value, paidAt = new Date(value);
    if (!Number.isSafeInteger(paidAmount) || paidAmount <= 0 || !value || !Number.isFinite(paidAt.getTime()) || !calculatorAdminNode('calculatorAdminPayerConfirmed').checked) {
        return calculatorAdminStatus('calculatorAdminDetailStatus', '실제 입금액·입금 시각을 입력하고 입금자명을 대조해주세요.', 'error');
    }
    if (!confirm('계산기 신청 ' + data.application.applicationId + '\n입금액 ' + formatConsultingMoney(paidAmount) + '\n입금 시각 ' + formatConsultingDate(paidAt.toISOString()) + '\n\n계좌 내역과 연락처를 확인했습니까? 승인하면 이용 링크·인증코드 발송을 예약합니다.')) return;
    return runCalculatorAdminMutation('admin_verify_calculator_payment', { idempotencyKey: state.keys.payment, paidAmount, paidAt: paidAt.toISOString(), payerNameConfirmed: true, reasonCode: 'MANUAL_BANK_MATCH' }, '계산기 입금 승인 및 이용 안내를 예약했습니다. 실제 발송·수신 결과는 별도로 확인해주세요.');
}
async function saveCalculatorAdminInput() {
    const state = calculatorAdminState;
    if (state.busy || state.detail?.calculator?.canReviewInput !== true) return;
    if (!calculatorAdminNode('calculatorAdminInputConfirmed').checked) return calculatorAdminStatus('calculatorAdminDetailStatus', '신청 정보와 수신 연락처를 직접 대조해주세요.', 'error');
    const input = Object.fromEntries(Object.entries({ studentName: 'calculatorAdminName', phone: 'calculatorAdminPhone', email: 'calculatorAdminEmail', payerName: 'calculatorAdminPayer' }).map(([field, id]) => [field, calculatorAdminNode(id).value]));
    return runCalculatorAdminMutation('admin_review_calculator_input', { idempotencyKey: state.keys.input, inputReviewConfirmed: true, input }, '신청 정보를 확인·저장했습니다. 입금 승인은 별도로 진행해주세요.');
}
async function reviewCalculatorAdminPayment() {
    const state = calculatorAdminState, generation = state.generation;
    if (state.busy || state.detail?.calculator?.canReviewPayment !== true || !state.reference) return;
    const option = calculatorAdminNode('calculatorAdminDecision').value;
    const unpaid = option === 'hold', decision = option === 'hold_other' ? 'hold' : option;
    const reasonText = calculatorAdminNode('calculatorAdminReason').value.trim();
    if (!['hold', 'reject'].includes(decision) || (!unpaid && !reasonText) || reasonText.length > 500) return calculatorAdminStatus('calculatorAdminDetailStatus', '기타 보류·거절은 사유가 필수이며, 메모는 500자 이내로 입력해주세요.', 'error');
    const data = { ...state.reference, expectedRevision: state.detail.application.revision, idempotencyKey: state.keys[decision], reasonCode: unpaid ? 'PAYMENT_NOT_FOUND' : 'OTHER', reasonText, decision };
    state.busy = true; updateCalculatorAdminActions();
    try {
        const preview = await requestConsultingAdmin('admin_preview_calculator_review_notice', data);
        if (state !== calculatorAdminState || generation !== state.generation) return;
        if (preview?.applicationId !== data.applicationId || preview.revision !== data.expectedRevision || typeof preview.previewToken !== 'string' || typeof preview.willQueue !== 'boolean'
            || preview.willQueue && (typeof preview.message !== 'string' || preview.message.length > 2000)) throw new Error('안내를 확인할 수 없습니다.');
        if (unpaid && preview.willQueue && preview.channel !== 'kakao') {
            return calculatorAdminStatus('calculatorAdminDetailStatus', '미입금 알림톡 설정을 확인해주세요.', 'error');
        }
        const title = decision === 'hold' ? '계산기 신청을 보류할까요?' : '계산기 신청을 거절할까요?';
        const channel = preview.channel === 'kakao' ? '알림톡' : '문자';
        const message = preview.willQueue ? `${title}\n\n${channel} 수신처 · ${preview.recipient || '전화번호 확인 필요'}\n\n${preview.message}`
            : `${title}\n\n이미 처리된 안내는 중복 발송하지 않습니다.`;
        if (!confirm(message)) return;
        state.busy = false;
        const { decision: _decision, ...request } = data;
        return await runCalculatorAdminMutation(decision === 'hold' ? 'admin_hold_calculator_payment' : 'admin_reject_calculator_application',
            { ...request, previewToken: preview.previewToken }, result => result.notificationQueued
                ? `계산기 신청을 처리했습니다. ${channel} 안내를 예약했습니다.`
                : '이미 보류 중인 신청입니다. 기존 안내 이력을 확인해주세요.');
    } catch (_) {
        if (state === calculatorAdminState && generation === state.generation) calculatorAdminStatus('calculatorAdminDetailStatus', '처리 안내를 확인하지 못했습니다. 다시 확인해주세요.', 'error');
    } finally { if (state === calculatorAdminState && generation === state.generation) { state.busy = false; updateCalculatorAdminActions(); } }
}
async function reissueCalculatorAdminInvite() {
    const state = calculatorAdminState;
    if (state.busy || state.detail?.calculator?.canReissue !== true || !state.detail.activeInviteId) return;
    if (!confirm('계산기 이용 안내를 재발급할까요?\n연락처를 확인해주세요. 기존 초대를 폐기하고 새 링크·인증코드 발송을 예약합니다.')) return;
    return runCalculatorAdminMutation('admin_reissue_calculator_invite', { idempotencyKey: state.keys.reissue, reasonCode: 'DELIVERY_RETRY' }, '계산기 이용 안내 재발급을 예약했습니다. 실제 발송·수신 결과는 별도로 확인해주세요.');
}
window.addEventListener('studycrack:session-ended', resetCalculatorAdmin);
window.addEventListener('pagehide', resetCalculatorAdmin);

async function loadCalculatorAdminSavedInput() {
    const state = calculatorAdminState, generation = state.generation, reference = state.reference;
    if (!state.detail || !reference || state.busy) return;
    state.request?.abort(); const controller = new AbortController(); state.request = controller;
    const body = calculatorAdminNode('calculatorAdminSavedInput'); body.replaceChildren();
    calculatorAdminStatus('calculatorAdminSavedStatus', '학생이 저장한 자료를 확인하고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_get_calculator_input', reference, controller.signal);
        if (state !== calculatorAdminState || state.generation !== generation || controller.signal.aborted) return;
        if (data?.contractVersion !== 'calculator-input-v1' || data.applicationId !== reference.applicationId || data.source !== 'self_reported' || data.reviewed !== false
            || !Number.isSafeInteger(data.revision) || !['saved', 'empty'].includes(data.status)) throw new Error('Invalid calculator input');
        if (data.status === 'empty') { calculatorAdminStatus('calculatorAdminSavedStatus', '학생이 서버에 저장한 계산기 자료가 없습니다. 현재 탭 초안은 관리자에게 전송되지 않습니다.', 'success'); return; }
        if (!data.input?.scores || data.input.scores.admissionYear !== 2027 || !['official', 'raw'].includes(data.input.scores.basis) || !Array.isArray(data.input.targets) || data.input.targets.length > 6) throw new Error('Invalid calculator input');
        const official = data.input.scores.basis === 'official', exam = data.input.scores.exam;
        const entries = [['저장본', data.revision + '판 · ' + formatConsultingDate(data.updatedAt)], ['입력 근거', official ? '성적표 기준 (학생 직접 입력)' : '가채점 원점수 (학생 직접 입력)']];
        for (const [key, label] of [['kor', '국어'], ['math', '수학'], ['inq1', '탐구 1'], ['inq2', '탐구 2'], ['eng', '영어'], ['hist', '한국사'], ['foreign', '제2외국어·한문']]) {
            const row = exam?.[key]; if (key === 'foreign' && !row) continue;
            if (!row || typeof row !== 'object') throw new Error('Invalid calculator input');
            const pieces = [];
            if (row.opt || row.name) { if (typeof (row.opt || row.name) !== 'string' || (row.opt || row.name).length > 80) throw new Error('Invalid subject'); pieces.push(row.opt || row.name); }
            for (const [metric, title] of [['std', '표준점수'], ['pct', '백분위'], ['grd', '등급'], ['common', '공통 원점수'], ['elective', '선택 원점수'], ['raw', '원점수']]) {
                if (row[metric] !== undefined) { if (!Number.isSafeInteger(row[metric]) || row[metric] < 0 || row[metric] > 200) throw new Error('Invalid score'); pieces.push(title + ' ' + row[metric]); }
            }
            entries.push([label, pieces.join(' · ')]);
        }
        for (const [index, target] of data.input.targets.entries()) {
            if (typeof target.university !== 'string' || target.university.length > 160 || typeof target.major !== 'string' || target.major.length > 200 || target.admissionUnitId !== undefined && !/^UNIT_[A-Z0-9][A-Z0-9_-]{2,71}$/.test(target.admissionUnitId)) throw new Error('Invalid target');
            entries.push(['지원 후보 ' + (index + 1), target.university + ' · ' + target.major + (target.admissionUnitId ? ' · ' + target.admissionUnitId : '')]);
        }
        appendConsultingRecord(body, '학생이 직접 저장한 최신본', createConsultingFacts(entries));
        calculatorAdminStatus('calculatorAdminSavedStatus', '학생 자기신고 자료 · 검수 완료 성적으로 반영되지 않습니다.', 'success');
    } catch (_) {
        if (state !== calculatorAdminState || state.generation !== generation || controller.signal.aborted) return;
        body.replaceChildren(); calculatorAdminStatus('calculatorAdminSavedStatus', '저장 자료를 불러오지 못했습니다. 신청·계정 연결과 서버 적용 상태를 확인한 뒤 다시 시도해주세요.', 'error');
    } finally { if (state === calculatorAdminState && state.request === controller) state.request = null; }
}

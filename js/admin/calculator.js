const calculatorAdminPhaseLabels = Object.freeze({ all: '전체 신청', intake: '입금 대기', onboarding: '이용 인증 대기', completed: '이용권 활성', expired: '기간 종료', attention: '보류·거절·확인 필요' });
let calculatorAdminState = { generation: 0, phase: 'all', cursor: null, nextCursor: null, previous: [], reference: null, detail: null, keys: {}, request: null, busy: false };
const calculatorAdminNode = id => document.getElementById(id);

function calculatorAdminStatus(id, message, state = '') {
    const node = calculatorAdminNode(id);
    if (node) { node.textContent = message; node.dataset.state = state; }
}
function clearCalculatorAdminDetail() {
    calculatorAdminState.detail = null; calculatorAdminState.keys = {};
    calculatorAdminNode('calculatorAdminFacts')?.replaceChildren();
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
            name.textContent = item.studentNameMask || '이름 확인 필요'; contact.textContent = item.phoneMask || '연락처 확인 필요'; person.append(name, contact);
            row.append(person, createConsultingCell(item.stateLabel), createConsultingCell(item.nextAction), createConsultingCell(formatConsultingDate(item.accessEndsAt)));
            const action = createConsultingCell(''), button = document.createElement('button');
            button.type = 'button'; button.className = 'consulting-btn consulting-btn-primary'; button.textContent = '계산기 신청 상세';
            button.addEventListener('click', () => calculatorAdminNavigate({ applicationId: item.applicationId, sourceResponseId: item.sourceResponseId }));
            action.append(button); row.append(action);
            [...row.children].forEach((cell, index) => { cell.dataset.label = ['이용자', '신청 상태', '다음 할 일', '이용 기간', '상세'][index]; });
            body.append(row);
        }
        appendConsultingDirectoryIssues(body, issues);
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
        ['calculatorAdminReview', status?.canReviewPayment], ['calculatorAdminReissue', status?.canReissue && data?.activeInviteId]]) {
        const node = calculatorAdminNode(id); if (node) node.hidden = !show;
    }
    const approve = calculatorAdminNode('calculatorAdminApprove');
    if (approve) approve.disabled = state.busy || status?.canApprove !== true || data?.campaignReady === false;
}
function renderCalculatorAdminDetail(data) {
    const application = data.application, status = data.calculator;
    const facts = calculatorAdminNode('calculatorAdminFacts'); facts.replaceChildren();
    calculatorAdminNode('calculatorAdminDetailTitle').textContent = data.contact.studentName + ' · 합격 계산기';
    appendConsultingRecord(facts, '신청·이용 상태', createConsultingFacts([
        ['접수번호', application.applicationId], ['현재 상태', status.stateLabel], ['다음 할 일', status.nextAction],
        ['신청 금액', formatConsultingMoney(application.expectedAmount)], ['이용권 연결', status.accountLinked ? '인증된 계정 연결 확인' : '연결 확인 전'],
        ['이용 기한', formatConsultingDate(status.expiresAt)], ['이용 안내 발급', formatConsultingDate(data.invitedAt)]
    ]));
    appendConsultingRecord(facts, '이용자·입금 정보', createConsultingFacts([
        ['이용자 이름', data.contact.studentName], ['전화번호', data.contact.phone], ['이메일', data.contact.email], ['입금자명', data.contact.payerName],
        ['입금 확인', ({ pending: '대기', hold: '보류', input_review: '신청 정보 확인 필요', verified: '승인', rejected: '거절' })[application.paymentReviewStatus] || '확인 필요']
    ]));
    if (Array.isArray(data.reviewNotices) && data.reviewNotices.length) appendConsultingRecord(facts, '보류·거절 안내 이력', createConsultingFacts(data.reviewNotices.map(item => [formatConsultingDate(item.createdAt), (item.decision === 'hold' ? '보류' : '거절') + ' · ' + ({ pending: '발송 대기', sent: '발송 접수', failed: '발송 실패', superseded: '이전 안내' }[item.status] || '상태 확인 필요')])));
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
    if (state.busy || !state.detail || !state.reference) return;
    state.busy = true; updateCalculatorAdminActions();
    calculatorAdminStatus('calculatorAdminDetailStatus', '계산기 신청을 처리하고 있습니다.');
    try {
        await requestConsultingAdmin(type, { ...state.reference, expectedRevision: state.detail.application.revision, ...data });
        if (state !== calculatorAdminState || generation !== state.generation) return;
        state.busy = false;
        const refreshedGeneration = state.generation + 1;
        if (await loadCalculatorAdminDetail(state.reference) && state === calculatorAdminState && state.generation === refreshedGeneration) calculatorAdminStatus('calculatorAdminDetailStatus', successMessage, 'success');
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
    const decision = calculatorAdminNode('calculatorAdminDecision').value, reasonText = calculatorAdminNode('calculatorAdminReason').value.trim();
    if (!['hold', 'reject'].includes(decision) || !reasonText || reasonText.length > 500) return calculatorAdminStatus('calculatorAdminDetailStatus', '처리 사유를 500자 이내로 입력해주세요.', 'error');
    const data = { ...state.reference, expectedRevision: state.detail.application.revision, idempotencyKey: state.keys[decision], reasonCode: 'OTHER', reasonText, decision };
    state.busy = true; updateCalculatorAdminActions();
    try {
        const preview = await requestConsultingAdmin('admin_preview_calculator_review_notice', data);
        if (state !== calculatorAdminState || generation !== state.generation) return;
        if (preview?.applicationId !== data.applicationId || preview.revision !== data.expectedRevision || typeof preview.previewToken !== 'string' || typeof preview.willQueue !== 'boolean'
            || preview.willQueue && (typeof preview.message !== 'string' || preview.message.length > 2000)) throw new Error('안내를 확인할 수 없습니다.');
        if (!confirm((decision === 'hold' ? '계산기 신청을 보류할까요?' : '계산기 신청을 거절할까요?') + (preview.willQueue ? '\n\n수신처 · ' + (preview.recipient || '확인 필요') + '\n' + preview.message : '\n이미 처리된 안내는 중복 발송하지 않습니다.'))) return;
        state.busy = false;
        const { decision: _decision, ...request } = data;
        return await runCalculatorAdminMutation(decision === 'hold' ? 'admin_hold_calculator_payment' : 'admin_reject_calculator_application',
            { ...request, previewToken: preview.previewToken }, '계산기 신청을 처리했습니다. 안내 이력과 실제 발송 결과를 확인해주세요.');
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

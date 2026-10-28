let consultingOperationsCurrent = null;
let consultingOperationsNext = null;
let consultingOperationsBusy = false;
let consultingOperationsGeneration = 0;
let consultingOperationsKeys = {};

function consultingOperationStatus(message, state = '') {
    const node = document.getElementById('consultingOperationsStatus');
    if (node) { node.textContent = message; node.dataset.state = state; }
}
function consultingOperationsLock(value) {
    consultingOperationsBusy = value;
    const panel = document.getElementById('consultingOperationsPanel');
    panel?.setAttribute('aria-busy', String(value));
    panel?.querySelectorAll('button, select, textarea').forEach(control => { control.disabled = value; });
    const next = document.getElementById('consultingOperationsNext');
    if (next) next.disabled = value || !consultingOperationsNext;
}
function closeConsultingOperation() {
    consultingOperationsCurrent = null;
    consultingOperationsKeys = {};
    const detail = document.getElementById('consultingOperationsDetail');
    if (detail) detail.hidden = true;
    document.getElementById('consultingOperationsSummary')?.replaceChildren();
    const reason = document.getElementById('consultingOperationsReason');
    if (reason) reason.value = '';
}
function resetConsultingOperations() {
    consultingOperationsGeneration++;
    consultingOperationsNext = null;
    closeConsultingOperation();
    consultingOperationStatus('');
    renderConsultingOperations([]);
    consultingOperationsLock(false);
}
function renderConsultingOperations(items) {
    const body = document.getElementById('consultingOperationsBody');
    if (!body) return;
    body.replaceChildren();
    if (!items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 5; cell.textContent = '표시할 항목이 없습니다. 다음 페이지가 있으면 계속 확인해주세요.'; cell.className = 'empty-msg'; row.appendChild(cell); body.appendChild(row); return; }
    const states = { open: '확인 대기', pending_review: '검수 대기', pending: '자동 처리 대기', processing: '자동 처리 중', held: '재검수 필요', completed: '완료', retry_requested: '재처리 요청됨', dead_letter: '실패 확인' };
    for (const item of items) {
        const row = document.createElement('tr');
        for (const value of [formatConsultingDate(item.createdAt), String(item.caseId || '').slice(-8), item.label, states[item.status] || '상태 확인']) { const cell = document.createElement('td'); cell.textContent = String(value || '-'); row.appendChild(cell); }
        const cell = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'consulting-btn consulting-btn-secondary'; button.textContent = '내용 확인'; button.addEventListener('click', () => loadConsultingOperation(item)); cell.appendChild(button); row.appendChild(cell); body.appendChild(row);
    }
}
async function loadConsultingOperations(next = false) {
    if (consultingOperationsBusy) return;
    const group = document.getElementById('consultingOperationsGroup')?.value || 'review';
    const cursor = next ? consultingOperationsNext : null;
    if (next && !cursor) return;
    closeConsultingOperation();
    const generation = ++consultingOperationsGeneration;
    consultingOperationsLock(true); consultingOperationStatus('운영 상태를 불러오고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_list_consulting_operations', { group, cursor });
        if (generation !== consultingOperationsGeneration) return;
        consultingOperationsNext = data.nextCursor || null; renderConsultingOperations(data.items || []);
        consultingOperationStatus(`현재 페이지 ${(data.items || []).length}건${consultingOperationsNext ? ' · 다음 페이지가 있습니다.' : ''}`);
    } catch (_error) { if (generation === consultingOperationsGeneration) { consultingOperationsNext = null; renderConsultingOperations([]); consultingOperationStatus('목록을 불러오지 못했습니다. 권한과 배포 상태를 확인한 뒤 다시 조회해주세요.', 'error'); } }
    finally { if (generation === consultingOperationsGeneration) consultingOperationsLock(false); }
}
async function loadConsultingOperation(item) {
    if (consultingOperationsBusy || !/^CASE_[a-f0-9-]{36}$/i.test(item?.caseId || '')) return;
    closeConsultingOperation();
    const generation = consultingOperationsGeneration;
    consultingOperationsLock(true);
    try {
        const data = await requestConsultingAdmin('admin_get_consulting_operation', { caseId: item.caseId, reference: item.reference });
        if (generation !== consultingOperationsGeneration) return;
        consultingOperationsCurrent = data;
        const target = document.getElementById('consultingOperationsSummary');
        target?.replaceChildren();
        const status = document.createElement('p'); status.textContent = `${data.label} · 관리번호 ${data.caseId.slice(-8)}`; target?.appendChild(status);
        for (const message of [data.retryOutbox?.reason, data.retryReport?.reason, data.outbox ? `자동 시도 ${data.outbox.attempts}/${data.outbox.maxAttempts}회 · 수동 재처리 ${data.outbox.recoveryCount}/3회` : '', data.outbox?.leaseExpired ? '처리 확인 시간이 지났습니다. 자동 처리 일정과 오류 로그를 함께 확인해주세요.' : '']) { if (!message) continue; const p = document.createElement('p'); p.textContent = message; target?.appendChild(p); }
        document.getElementById('consultingRetryOutboxBtn').hidden = data.retryOutbox?.allowed !== true;
        document.getElementById('consultingRetryReportBtn').hidden = data.retryReport?.allowed !== true;
        document.getElementById('consultingOperationsDetail').hidden = false;
        consultingOperationStatus('상세 내용을 확인했습니다. 업무 화면에서 처리하거나 사유와 함께 재시도할 수 있습니다.');
    } catch (_error) { if (generation === consultingOperationsGeneration) consultingOperationStatus('상세 상태를 확인하지 못했습니다. 목록을 다시 불러와주세요.', 'error'); }
    finally { if (generation === consultingOperationsGeneration) consultingOperationsLock(false); }
}
async function recoverConsultingOperation(kind) {
    const current = consultingOperationsCurrent;
    if (consultingOperationsBusy || !current || !['report', 'outbox'].includes(kind) || (kind === 'report' ? current.retryReport?.allowed : current.retryOutbox?.allowed) !== true) return;
    const reason = document.getElementById('consultingOperationsReason')?.value.replace(/\s+/g, ' ').trim() || '';
    if (reason.length < 10) return consultingOperationStatus('처리 사유를 10자 이상 입력해주세요.', 'error');
    if (!confirm(kind === 'report' ? '현재 원자료를 다시 검증해 보고서 공개를 재시도할까요?' : '같은 사이트 알림을 기존 식별자로 다시 처리하도록 요청할까요?')) return;
    const data = { caseId: current.caseId, reference: current.reference, expectedSnapshot: current.snapshot, reason };
    const fingerprint = JSON.stringify(data), prior = consultingOperationsKeys[kind];
    if (!prior || prior.fingerprint !== fingerprint) consultingOperationsKeys[kind] = { fingerprint, key: crypto.randomUUID() };
    data.idempotencyKey = consultingOperationsKeys[kind].key;
    const generation = consultingOperationsGeneration;
    consultingOperationsLock(true);
    try {
        const result = await requestConsultingAdmin(kind === 'report' ? 'admin_retry_consulting_report_publication' : 'admin_retry_consulting_outbox', data);
        if (generation !== consultingOperationsGeneration) return;
        const messages = { queued: '사이트 알림 재처리를 요청했습니다. 실제 알림 생성은 다음 처리 주기에서 확인해주세요.', published: '검증을 통과해 보고서를 공개했습니다.', held: '기준 변경으로 공개가 보류됐습니다. 보고서 검수 화면에서 처리해주세요.', not_due: '아직 공개 시각이 아닙니다.', skipped: '대상이 변경됐습니다. 최신 업무 상태를 확인해주세요.' };
        closeConsultingOperation(); consultingOperationStatus(messages[result.result] || '처리 결과를 최신 목록에서 확인해주세요.', 'success');
    } catch (_error) { if (generation === consultingOperationsGeneration) consultingOperationStatus('처리 결과를 확인하지 못했습니다. 같은 요청으로 재확인하거나 목록·상세를 다시 조회해주세요.', 'error'); }
    finally { if (generation === consultingOperationsGeneration) consultingOperationsLock(false); }
}
function openConsultingOperationWorkspace() {
    const item = consultingOperationsCurrent;
    if (consultingOperationsBusy || !item || !/^CASE_[a-f0-9-]{36}$/i.test(item.caseId)) return;
    if (item.destination === 'schedule') { document.getElementById('consultingScheduleCaseId').value = item.caseId; document.getElementById('consultingScheduleCaseId').scrollIntoView({ block: 'center' }); return; }
    const path = item.destination === 'finalCall' ? 'final-call' : 'report';
    window.location.assign(`/2027-jungsi-consulting/${path}?caseId=${encodeURIComponent(item.caseId)}`);
}
window.addEventListener('studycrack:session-ended', resetConsultingOperations);

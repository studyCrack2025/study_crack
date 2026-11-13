let consultingSupplementAlerts = { request: null, timer: null, items: [], cursor: null, started: false, paused: false };

function resetConsultingSupplementAlerts() {
    const state = consultingSupplementAlerts;
    state.request?.abort();
    clearInterval(state.timer);
    consultingSupplementAlerts = { request: null, timer: null, items: [], cursor: null, started: false, paused: false };
    document.getElementById('consultingSupplementAlerts').hidden = true;
    document.getElementById('consultingSupplementAlertBadge').hidden = true;
    document.getElementById('consultingSupplementAlertList').replaceChildren();
    document.getElementById('consultingSupplementAlertStatus').textContent = '';
}

function openConsultingSupplementCase(caseId) {
    if (!/^CASE_[0-9a-f-]{36}$/i.test(caseId || '')) return;
    writeAdminLocation({ section: 'consulting', phase: 'onboarding', caseId, tab: 'materials' });
    restoreAdminNavigation();
}

function renderConsultingSupplementAlerts() {
    const state = consultingSupplementAlerts, list = document.getElementById('consultingSupplementAlertList');
    list.replaceChildren();
    for (const item of state.items) {
        const row = document.createElement('li'), description = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('span'), button = document.createElement('button');
        name.textContent = `${item.studentNameMask} · ${item.attempt}차 보완 답변`;
        detail.textContent = `${formatConsultingDate(item.submittedAt)} 접수${item.changedCount == null ? '' : ` · 변경 ${item.changedCount}개`}`;
        description.append(name, detail);
        button.type = 'button'; button.className = 'consulting-btn consulting-btn-secondary'; button.textContent = '수정 내역 확인';
        button.setAttribute('aria-label', `${item.studentNameMask} 보완 수정 내역 확인`);
        button.addEventListener('click', () => openConsultingSupplementCase(item.caseId));
        row.append(description, button); list.appendChild(row);
    }
    const visible = state.items.length > 0 || Boolean(state.cursor);
    document.getElementById('consultingSupplementAlerts').hidden = !visible;
    document.getElementById('consultingSupplementAlertTitle').textContent = state.items.length ? `확인할 보완 답변 ${state.items.length}건` : '보완 검토 목록을 확인해 주세요';
    const badge = document.getElementById('consultingSupplementAlertBadge');
    badge.hidden = !visible; badge.textContent = state.items.length ? String(state.items.length) : '확인';
    badge.setAttribute('aria-label', state.items.length ? `현재 표시한 보완 검토 대기 ${state.items.length}건` : '보완 검토 목록 확인');
    document.getElementById('consultingSupplementAlertMore').hidden = !state.cursor;
    document.getElementById('consultingSupplementAlertStatus').textContent = state.cursor ? '다음 목록이 있습니다. 검수를 완료하면 대기 안내에서 해소됩니다.' : '검수를 완료하면 대기 안내에서 해소됩니다.';
}

async function loadConsultingSupplementAlerts(more = false) {
    const state = consultingSupplementAlerts;
    if (!state.started || state.request || more && !state.cursor || document.visibilityState === 'hidden') return;
    const controller = new AbortController(); state.request = controller;
    document.getElementById('consultingSupplementAlertRefresh').disabled = true;
    document.getElementById('consultingSupplementAlertMore').disabled = true;
    try {
        const data = await requestConsultingAdmin('admin_list_v2_material_review', { onlySupplements: true, ...(more ? { cursor: state.cursor } : {}) }, controller.signal);
        if (state !== consultingSupplementAlerts || controller.signal.aborted) return;
        if (!Array.isArray(data.items) || data.items.length > 20 || data.items.some(item => !/^CASE_[0-9a-f-]{36}$/i.test(item?.caseId || '') || typeof item.studentNameMask !== 'string' || item.studentNameMask.length > 100 || !Number.isSafeInteger(item.attempt) || item.attempt < 1)
            || data.nextCursor != null && (typeof data.nextCursor !== 'string' || data.nextCursor.length > 100)) throw new Error('보완 알림 목록을 확인할 수 없습니다.');
        state.items = [...new Map([...(more ? state.items : []), ...data.items].map(item => [item.caseId, item])).values()];
        state.cursor = data.nextCursor || null; state.paused = false;
        renderConsultingSupplementAlerts();
    } catch (_error) {
        if (state !== consultingSupplementAlerts || controller.signal.aborted) return;
        state.paused = true;
        document.getElementById('consultingSupplementAlerts').hidden = false;
        if (!state.items.length) document.getElementById('consultingSupplementAlertTitle').textContent = '보완 답변 알림을 확인하지 못했습니다';
        document.getElementById('consultingSupplementAlertStatus').textContent = '알림을 갱신하지 못했습니다. 목록 새로고침으로 다시 확인해 주세요.';
    } finally {
        if (state === consultingSupplementAlerts && state.request === controller) {
            state.request = null;
            document.getElementById('consultingSupplementAlertRefresh').disabled = false;
            document.getElementById('consultingSupplementAlertMore').disabled = false;
        }
    }
}

function refreshConsultingSupplementAlerts() {
    consultingSupplementAlerts.request?.abort();
    consultingSupplementAlerts.request = null;
    return loadConsultingSupplementAlerts();
}

function startConsultingSupplementAlerts() {
    const state = consultingSupplementAlerts;
    if (state.started) return;
    state.started = true;
    loadConsultingSupplementAlerts();
    state.timer = setInterval(() => { if (!state.paused) loadConsultingSupplementAlerts(); }, 45000);
}
document.addEventListener('visibilitychange', () => {
    if (consultingSupplementAlerts.started && !consultingSupplementAlerts.paused && document.visibilityState === 'visible') loadConsultingSupplementAlerts();
});
window.addEventListener('pagehide', resetConsultingSupplementAlerts);
window.addEventListener('studycrack:session-ended', resetConsultingSupplementAlerts);

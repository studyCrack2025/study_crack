let currentConsultingSchedule = null;

function setConsultingScheduleStatus(message, state = '') {
    const target = document.getElementById('consultingScheduleStatus');
    if (!target) return;
    target.textContent = message;
    target.dataset.state = state;
}

function renderConsultingCurrentSession(session) {
    const section = document.getElementById('consultingCurrentSession');
    const copy = document.getElementById('consultingCurrentSessionCopy');
    if (!section || !copy) return;
    section.hidden = !session;
    copy.textContent = session ? `현재 일정: ${formatConsultingDate(session.startAt)} · ${session.counselorId} · revision ${session.revision}` : '';
}

function renderConsultingScheduleCandidates(data) {
    const body = document.getElementById('consultingScheduleCandidatesBody');
    if (!body) return;
    body.innerHTML = '';
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    if (!candidates.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.className = 'empty-msg';
        cell.textContent = '선택 가능한 배정 후보가 없습니다.';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    candidates.forEach((candidate, index) => {
        const row = document.createElement('tr');
        [index + 1, formatConsultingDate(candidate.startAt), candidate.counselorId, `${candidate.priority}순위`, candidate.score].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            row.appendChild(cell);
        });
        const action = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'consulting-btn consulting-btn-primary';
        button.textContent = data.session ? '이 일정으로 재배정' : '이 일정으로 확정';
        button.addEventListener('click', () => confirmConsultingScheduleCandidate(candidate));
        action.appendChild(button);
        row.appendChild(action);
        body.appendChild(row);
    });
}

async function generateConsultingSlots() {
    const counselorId = document.getElementById('consultingScheduleCounselorId')?.value.trim();
    if (!counselorId) return setConsultingScheduleStatus('상담사 ID를 입력해주세요.', 'error');
    const button = document.getElementById('consultingGenerateSlotsBtn');
    button.disabled = true;
    try {
        const data = await requestConsultingAdmin('admin_generate_consulting_slots', { counselorId });
        setConsultingScheduleStatus(`${data.counselorId}: ${data.createdCount}개의 새 slot을 생성했습니다.`, 'success');
    } catch (error) {
        setConsultingScheduleStatus(error.message || 'slot을 생성하지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

async function loadConsultingScheduleCandidates() {
    const caseId = document.getElementById('consultingScheduleCaseId')?.value.trim();
    if (!caseId) return setConsultingScheduleStatus('케이스 ID를 입력해주세요.', 'error');
    const button = document.getElementById('consultingLoadCandidatesBtn');
    button.disabled = true;
    setConsultingScheduleStatus('배정 후보를 계산하고 있습니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_list_schedule_candidates', { caseId });
        currentConsultingSchedule = data;
        renderConsultingCurrentSession(data.session);
        renderConsultingScheduleCandidates(data);
        setConsultingScheduleStatus(`배정 후보 ${data.candidates.length}건을 점수 순으로 불러왔습니다.`, 'success');
    } catch (error) {
        currentConsultingSchedule = null;
        renderConsultingCurrentSession(null);
        renderConsultingScheduleCandidates({ candidates: [] });
        setConsultingScheduleStatus(error.message || '배정 후보를 불러오지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

async function confirmConsultingScheduleCandidate(candidate) {
    const current = currentConsultingSchedule;
    if (!current || !confirm(current.session ? '현재 일정을 이 후보로 변경하시겠습니까?' : '이 후보로 서면상담 일정을 확정하시겠습니까?')) return;
    const type = current.session ? 'admin_reschedule_written_session' : 'admin_confirm_written_assignment';
    const data = { caseId: current.caseId, counselorId: candidate.counselorId, slotId: candidate.slotId, ...(current.session ? { expectedSessionRevision: current.session.revision } : {}) };
    setConsultingScheduleStatus('일정을 저장하고 있습니다.', 'loading');
    try {
        await requestConsultingAdmin(type, data);
        await loadConsultingScheduleCandidates();
        setConsultingScheduleStatus(current.session ? '서면상담 일정을 재배정했습니다.' : '서면상담 일정을 확정했습니다.', 'success');
    } catch (error) {
        setConsultingScheduleStatus(error.message || '일정을 저장하지 못했습니다.', 'error');
    }
}

async function cancelConsultingWrittenSession() {
    const current = currentConsultingSchedule;
    if (!current?.session || !confirm('현재 서면상담 일정을 취소하고 다시 배정 대기 상태로 돌리시겠습니까?')) return;
    const button = document.getElementById('consultingCancelSessionBtn');
    button.disabled = true;
    try {
        await requestConsultingAdmin('admin_cancel_written_session', { caseId: current.caseId, expectedSessionRevision: current.session.revision, reasonCode: 'OPERATOR_CANCELLED' });
        await loadConsultingScheduleCandidates();
        setConsultingScheduleStatus('일정을 취소하고 재배정 대기 상태로 변경했습니다.', 'success');
    } catch (error) {
        setConsultingScheduleStatus(error.message || '일정을 취소하지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

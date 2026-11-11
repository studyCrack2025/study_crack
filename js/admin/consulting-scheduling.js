let consultingScheduleGeneration = 0;
let currentConsultingSchedule = null;
let consultingScheduleBoardGeneration = 0;
let consultingScheduleBoardTimer;
let consultingScheduleBoardLoading = false;
let consultingScheduleBoardFingerprint = '';
let consultingScheduleSettingsRevision = null;
let consultingScheduleChoiceGeneration = 0;
let consultingScheduleChoice = null;
let consultingScheduleSaving = false;

const consultingTimeKst = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const consultingDateKst = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long' });
const consultingScheduleNode = id => document.getElementById(id);
const consultingWrittenTime = at => consultingTimeKst.format(new Date(at));
const consultingWrittenDate = at => consultingDateKst.format(new Date(at));
const consultingWrittenDateTime = at => `${consultingWrittenDate(at)} ${consultingWrittenTime(at)}`;

function setConsultingScheduleStatus(message, state = '', id = 'consultingScheduleStatus') {
    const target = consultingScheduleNode(id);
    if (!target) return;
    target.textContent = message;
    target.dataset.state = state;
}

function consultingScheduleButton(label, action, primary = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'consulting-btn ' + (primary ? 'consulting-btn-primary' : 'consulting-btn-secondary');
    button.textContent = label;
    button.addEventListener('click', () => action(button));
    return button;
}

function consultingScheduleRow(values) {
    const row = document.createElement('tr');
    for (const value of values) {
        const cell = document.createElement('td');
        if (value instanceof Node) cell.append(value);
        else cell.textContent = value;
        row.append(cell);
    }
    return row;
}

function consultingScheduleGroup(title, columns) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.colSpan = columns;
    heading.textContent = title;
    row.className = 'consulting-schedule-day';
    row.append(heading);
    return row;
}

function renderConsultingCurrentSession(data) {
    const section = consultingScheduleNode('consultingCurrentSession');
    if (!section) return;
    const session = data?.session;
    section.hidden = !session;
    consultingScheduleNode('consultingManualSessionBtn').hidden = !data?.canChange;
    consultingScheduleNode('consultingCancelSessionBtn').hidden = !data?.canChange;
    const copy = consultingScheduleNode('consultingCurrentSessionCopy');
    if (!session) { copy.textContent = ''; return; }
    copy.textContent = `확정 일정 · ${consultingWrittenDateTime(session.startAt)} · ${session.counselorId}`;
    if (data.change) {
        const detail = document.createElement('p');
        detail.textContent = data.change.kind === 'admin'
            ? `학생 응답 대기 · 새 시간 ${consultingWrittenDateTime(data.change.offer.startAt)}`
            : '학생이 다른 가능 시간을 제출했습니다.';
        copy.append(detail);
    }
}

function consultingCandidateLabel(data) {
    if (!data.session && !data.changeKind) return '이 시간 확정';
    return (data.change?.kind || data.changeKind) === 'student' ? '이 시간으로 변경 확정' : '이 시간 학생에게 제안';
}

function renderConsultingScheduleCandidates(data) {
    const body = consultingScheduleNode('consultingScheduleCandidatesBody');
    if (!body) return;
    body.replaceChildren();
    if (!data.candidates?.length) {
        body.append(consultingScheduleGroup(data.change?.kind === 'admin' ? '학생이 제안에 답하면 새 일정을 확인할 수 있습니다.' : '현재 가능한 배정 후보가 없습니다.', 4));
        return;
    }
    for (const candidate of data.candidates) {
        const action = consultingScheduleButton(consultingCandidateLabel(data), button => saveConsultingScheduleCandidate(data, candidate, button, 'detail'), true);
        body.append(consultingScheduleRow([consultingWrittenDateTime(candidate.startAt), candidate.counselorId, candidate.lunch ? '점심 시간' : '학생 선택 시간', action]));
    }
}

async function loadConsultingScheduleCandidates() {
    const caseId = consultingScheduleNode('consultingScheduleCaseId')?.value.trim();
    if (!caseId) return setConsultingScheduleStatus('학생을 먼저 선택해주세요.', 'error');
    const generation = ++consultingScheduleGeneration;
    const button = consultingScheduleNode('consultingLoadCandidatesBtn');
    button.disabled = true;
    setConsultingScheduleStatus('배정 후보를 확인하고 있습니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_list_schedule_candidates', { caseId });
        if (generation !== consultingScheduleGeneration) return;
        currentConsultingSchedule = data;
        renderConsultingCurrentSession(data);
        renderConsultingScheduleCandidates(data);
        setConsultingScheduleStatus(`선택할 수 있는 후보 ${data.candidates.length}건을 확인했습니다.`, 'success');
    } catch (error) {
        if (generation !== consultingScheduleGeneration) return;
        currentConsultingSchedule = null;
        renderConsultingCurrentSession(null);
        renderConsultingScheduleCandidates({ candidates: [] });
        setConsultingScheduleStatus(error.message || '배정 후보를 불러오지 못했습니다.', 'error');
    } finally {
        if (generation === consultingScheduleGeneration) button.disabled = false;
    }
}

function scheduleBoardIsOpen() {
    return consultingScheduleNode('consultingScheduleBoard')?.open
        && !consultingScheduleNode('consultingDirectoryPanel')?.hidden
        && consultingScheduleNode('section-consulting')?.classList.contains('active');
}

function toggleConsultingScheduleBoard() {
    clearTimeout(consultingScheduleBoardTimer);
    if (scheduleBoardIsOpen()) return loadConsultingScheduleBoard();
    consultingScheduleBoardGeneration++;
    consultingScheduleBoardLoading = false;
}

function renderConsultingScheduleBoard(data) {
    const body = consultingScheduleNode('consultingScheduleBoardBody');
    const rows = [...data.confirmed.map(row => ({ ...row, confirmed: true })), ...data.placements]
        .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.caseId.localeCompare(b.caseId));
    const fragment = document.createDocumentFragment();
    let day = '';
    const studentLabel = row => `${row.studentName} · ${row.caseId.slice(-6)}`;
    for (const row of rows) {
        const date = consultingWrittenDate(row.startAt);
        if (date !== day) { fragment.append(consultingScheduleGroup(date, 5)); day = date; }
        const actions = document.createElement('div');
        actions.className = 'consulting-actions';
        if (!row.confirmed) actions.append(consultingScheduleButton(consultingCandidateLabel(row), button => saveConsultingScheduleCandidate(row, row, button, 'board'), true));
        actions.append(consultingScheduleButton(row.confirmed ? '일정 변경' : '다른 시간 보기', () => openConsultingScheduleChoice(row.caseId)));
        const label = row.confirmed
            ? row.proposed ? `확정 · 새 시간 응답 대기 (${consultingWrittenDateTime(row.proposed.startAt)})` : row.changeKind === 'student' ? '확정 · 학생 변경 요청' : '확정'
            : row.changeKind === 'student' ? '변경 추천' : '추천';
        fragment.append(consultingScheduleRow([consultingWrittenTime(row.startAt), studentLabel(row), row.counselorId, label, actions]));
    }
    if (data.unassigned.length) fragment.append(consultingScheduleGroup('배정 대기', 5));
    for (const row of data.unassigned) {
        const reason = row.candidateCount ? '다른 추천과 시간이 겹침' : '현재 비어 있는 선택 시간 없음';
        fragment.append(consultingScheduleRow(['—', studentLabel(row), '—', reason, consultingScheduleButton('학생 가능 시간 보기', () => openConsultingScheduleChoice(row.caseId))]));
    }
    if (!rows.length && !data.unassigned.length) fragment.append(consultingScheduleGroup('가능 시간을 제출한 학생이 아직 없습니다.', 5));
    body.replaceChildren(fragment);
}

function populateConsultingScheduleSettings(settings) {
    const form = consultingScheduleNode('consultingScheduleSettings');
    if (form.dataset.dirty === 'true') return;
    for (const key of ['startDate', 'endDate', 'lunchStart', 'lunchEnd', 'lunchMode']) form.elements[key].value = settings[key];
    form.elements.compactDays.checked = settings.compactDays;
    consultingScheduleSettingsRevision = settings.revision;
    form.querySelector('[type="submit"]').disabled = false;
}

async function loadConsultingScheduleBoard(feedback = '', refresh = false) {
    if (!scheduleBoardIsOpen() || consultingScheduleBoardLoading && !refresh) return;
    const generation = ++consultingScheduleBoardGeneration;
    clearTimeout(consultingScheduleBoardTimer);
    consultingScheduleBoardLoading = true;
    const status = (message, state) => setConsultingScheduleStatus(message, state, 'consultingScheduleBoardStatus');
    if (!consultingScheduleBoardFingerprint) status('전체 학생의 일정을 확인하고 있습니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_get_written_schedule_board');
        if (generation !== consultingScheduleBoardGeneration || !scheduleBoardIsOpen()) return;
        const fingerprint = JSON.stringify([data.placements, data.unassigned, data.confirmed]);
        if (fingerprint !== consultingScheduleBoardFingerprint) {
            renderConsultingScheduleBoard(data);
            consultingScheduleBoardFingerprint = fingerprint;
        }
        populateConsultingScheduleSettings(data.settings);
        const counts = `추천 ${data.placements.length}건 · 확정 ${data.confirmed.length}건 · 배정 대기 ${data.unassigned.length}건`;
        const notes = [feedback, counts, data.limited ? '후보가 많아 계산 범위 안에서 찾은 조합을 표시합니다.' : '',
            data.hasOpenTimes ? '' : '선택 가능한 시간이 없습니다. 아래에서 상담사 시간을 열거나 수용량을 확인하세요.'].filter(Boolean);
        status(notes.join(' '), 'success');
    } catch (error) {
        if (generation === consultingScheduleBoardGeneration) status(error.message || '전체 시간표를 불러오지 못했습니다.', 'error');
    } finally {
        if (generation === consultingScheduleBoardGeneration) {
            consultingScheduleBoardLoading = false;
            if (scheduleBoardIsOpen()) consultingScheduleBoardTimer = setTimeout(() => loadConsultingScheduleBoard(), 20000);
        }
    }
}

async function reloadConsultingScheduleSettings() {
    consultingScheduleNode('consultingScheduleSettings').dataset.dirty = 'false';
    await loadConsultingScheduleBoard('', true);
}

async function saveConsultingScheduleSettings() {
    if (consultingScheduleSettingsRevision == null) return;
    const form = consultingScheduleNode('consultingScheduleSettings');
    const submit = form.querySelector('[type="submit"]');
    const fields = Object.fromEntries(new FormData(form));
    const status = (message, state) => setConsultingScheduleStatus(message, state, 'consultingScheduleSettingsStatus');
    submit.disabled = true;
    try {
        await requestConsultingAdmin('admin_save_written_schedule_settings', { ...fields, compactDays: form.elements.compactDays.checked, expectedRevision: consultingScheduleSettingsRevision });
        status('배정 옵션을 저장했습니다.', 'success');
        await reloadConsultingScheduleSettings();
    } catch (error) { status(error.message || '옵션을 저장하지 못했습니다.', 'error'); }
    finally { submit.disabled = false; }
}

async function generateConsultingSlots() {
    const counselorId = consultingScheduleNode('consultingScheduleCounselorId')?.value.trim();
    const status = (message, state) => setConsultingScheduleStatus(message, state, 'consultingScheduleSettingsStatus');
    if (!counselorId) return status('상담사 ID를 입력해주세요.', 'error');
    const button = consultingScheduleNode('consultingGenerateSlotsBtn');
    button.disabled = true;
    try {
        const data = await requestConsultingAdmin('admin_generate_consulting_slots', { counselorId });
        status(`운영 시간 ${data.generatedCount}개 중 ${data.createdCount}개를 새로 열었습니다.`, 'success');
        await loadConsultingScheduleBoard('', true);
    } catch (error) { status(error.message || '상담사 시간을 열지 못했습니다.', 'error'); }
    finally { button.disabled = false; }
}

async function openConsultingScheduleChoice(caseId, manual = false) {
    const dialog = consultingScheduleNode('consultingScheduleChoice');
    const form = consultingScheduleNode('consultingScheduleChoiceForm');
    const manualFields = consultingScheduleNode('consultingScheduleManualFields');
    const status = (message, state) => setConsultingScheduleStatus(message, state, 'consultingScheduleChoiceStatus');
    const generation = ++consultingScheduleChoiceGeneration;
    consultingScheduleChoice = null;
    form.reset();
    form.hidden = true;
    manualFields.hidden = !manual;
    form.elements.contactConfirmed.required = manual;
    form.elements.reason.required = manual;
    consultingScheduleNode('consultingScheduleChoiceTitle').textContent = manual ? '학생과 합의한 시간으로 변경' : '학생별 일정 선택';
    status('가능한 시간을 확인하고 있습니다.', 'loading');
    if (!dialog.open) dialog.showModal();
    try {
        const data = await requestConsultingAdmin('admin_list_schedule_candidates', { caseId, ...(manual ? { includeManual: true } : {}) });
        if (generation !== consultingScheduleChoiceGeneration || !dialog.open) return;
        const choices = manual ? data.manualCandidates : data.candidates;
        consultingScheduleChoice = { data, choices, manual };
        const prompt = new Option('가능 시간 선택', '');
        const options = choices.map((choice, index) => new Option(`${consultingWrittenDateTime(choice.startAt)} · ${choice.counselorId}${choice.lunch ? ' · 점심' : ''}`, String(index)));
        form.elements.slot.replaceChildren(prompt, ...options);
        form.hidden = !choices.length;
        consultingScheduleNode('consultingScheduleChoiceSubmit').textContent = manual ? '합의한 일정으로 변경 확정' : consultingCandidateLabel(data);
        status(data.change?.kind === 'admin' && !manual ? '학생이 현재 제안에 답하기를 기다리고 있습니다.' : choices.length
            ? manual ? '학생과 직접 합의한 경우에만 확정하세요. 처리하면 진행 중인 변경 요청은 종료됩니다.'
                : data.session && !data.change ? '학생이 처음 선택한 시간입니다. 제안 후에도 기존 예약은 유지됩니다.' : '학생이 선택한 가능 시간입니다.'
            : '현재 비어 있는 선택 시간이 없습니다. 학생과 직접 조율한 경우 학생 상세의 수동 변경에서 확정할 수 있습니다.', '');
    } catch (error) {
        if (generation === consultingScheduleChoiceGeneration) status(error.message || '후보를 불러오지 못했습니다.', 'error');
    }
}

async function submitConsultingScheduleChoice() {
    const form = consultingScheduleNode('consultingScheduleChoiceForm');
    const selected = form.elements.slot.value;
    const choice = consultingScheduleChoice;
    const slot = selected && choice?.choices[Number(selected)];
    if (!slot || !form.reportValidity()) return;
    await saveConsultingScheduleCandidate(choice.data, slot, consultingScheduleNode('consultingScheduleChoiceSubmit'), 'choice',
        choice.manual ? { mode: 'manual', contactConfirmed: form.elements.contactConfirmed.checked, reason: form.elements.reason.value } : null);
}

async function saveConsultingScheduleCandidate(data, candidate, button, source, manual = null) {
    if (consultingScheduleSaving) return;
    const sessionRevision = data.session?.revision ?? data.sessionRevision;
    const changeKind = data.change?.kind ?? data.changeKind;
    const booked = Number.isInteger(sessionRevision);
    const confirmed = !booked || manual || changeKind === 'student';
    const label = manual ? '학생과 합의한 이 시간으로 변경 확정' : consultingCandidateLabel(data);
    if (!window.confirm(`${consultingWrittenDateTime(candidate.startAt)}에 ${label}할까요?`)) return;
    const type = !booked ? 'admin_confirm_written_assignment' : confirmed ? 'admin_reschedule_written_session' : 'admin_request_written_reschedule';
    const payload = { caseId: data.caseId, counselorId: candidate.counselorId, slotId: candidate.slotId,
        ...(booked ? { expectedSessionRevision: sessionRevision, expectedChangeRevision: data.changeRevision || 0 } : { expectedAvailabilityRevision: data.availabilityRevision }),
        ...manual };
    const statusId = source === 'choice' ? 'consultingScheduleChoiceStatus' : source === 'board' ? 'consultingScheduleBoardStatus' : 'consultingScheduleStatus';
    const generation = consultingScheduleGeneration;
    consultingScheduleSaving = true;
    button.disabled = true;
    setConsultingScheduleStatus('일정을 저장하고 있습니다.', 'loading', statusId);
    try {
        await requestConsultingAdmin(type, payload);
        if (source === 'choice') consultingScheduleNode('consultingScheduleChoice').close();
        const feedback = !confirmed ? '학생에게 새 시간을 제안했습니다.' : booked ? '변경 일정을 확정했습니다.' : '서면상담 일정을 확정했습니다.';
        if (scheduleBoardIsOpen()) {
            await loadConsultingScheduleBoard(feedback, true);
        } else if (generation === consultingScheduleGeneration && consultingWorkspaceHasStudent()) {
            await refreshConsultingWorkspaceStudent();
            setConsultingScheduleStatus(feedback, 'success');
        }
    } catch (error) {
        if (source === 'board') await loadConsultingScheduleBoard('', true);
        setConsultingScheduleStatus(error.message || '일정을 저장하지 못했습니다.', 'error', statusId);
    } finally {
        consultingScheduleSaving = false;
        button.disabled = false;
    }
}

async function cancelConsultingWrittenSession() {
    const generation = consultingScheduleGeneration;
    const current = currentConsultingSchedule;
    if (!current?.session || !confirm('현재 서면상담 일정을 취소하고 다시 배정 대기 상태로 돌리시겠습니까?')) return;
    const button = consultingScheduleNode('consultingCancelSessionBtn');
    button.disabled = true;
    try {
        await requestConsultingAdmin('admin_cancel_written_session', { caseId: current.caseId, expectedSessionRevision: current.session.revision, reasonCode: 'OPERATOR_CANCELLED' });
        if (generation !== consultingScheduleGeneration) return;
        if (consultingWorkspaceHasStudent()) await refreshConsultingWorkspaceStudent();
        else await loadConsultingScheduleCandidates();
        setConsultingScheduleStatus('일정을 취소하고 배정 대기 상태로 변경했습니다.', 'success');
    } catch (error) {
        if (generation === consultingScheduleGeneration) setConsultingScheduleStatus(error.message || '일정을 취소하지 못했습니다.', 'error');
    } finally { button.disabled = false; }
}

function openConsultingReportReview() {
    const caseId = consultingScheduleNode('consultingReportCaseId')?.value.trim() || '';
    if (!/^CASE_[0-9a-f-]{36}$/i.test(caseId)) return setConsultingScheduleStatus('올바른 케이스 ID를 입력해주세요.', 'error');
    window.location.assign(`/2027-jungsi-consulting/report?caseId=${encodeURIComponent(caseId)}`);
}

function openConsultingFinalCall() {
    const caseId = consultingScheduleNode('consultingReportCaseId')?.value.trim() || '';
    if (!/^CASE_[0-9a-f-]{36}$/i.test(caseId)) return setConsultingScheduleStatus('올바른 케이스 ID를 입력해주세요.', 'error');
    window.location.assign(`/2027-jungsi-consulting/final-call?caseId=${encodeURIComponent(caseId)}`);
}

function resetConsultingSchedule() {
    consultingScheduleGeneration++;
    currentConsultingSchedule = null;
    renderConsultingCurrentSession(null);
    consultingScheduleNode('consultingScheduleCandidatesBody')?.replaceChildren();
    const input = consultingScheduleNode('consultingScheduleCaseId'); if (input) input.value = '';
    const button = consultingScheduleNode('consultingLoadCandidatesBtn'); if (button) button.disabled = false;
    setConsultingScheduleStatus('');
}

function resetConsultingScheduleBoard() {
    clearTimeout(consultingScheduleBoardTimer);
    consultingScheduleBoardGeneration++;
    consultingScheduleBoardLoading = false;
    consultingScheduleBoardFingerprint = '';
    consultingScheduleSettingsRevision = null;
    consultingScheduleNode('consultingScheduleBoard').open = false;
    consultingScheduleNode('consultingScheduleBoardBody').replaceChildren();
    const form = consultingScheduleNode('consultingScheduleSettings');
    form.reset();
    form.dataset.dirty = 'false';
    form.querySelector('[type="submit"]').disabled = true;
    consultingScheduleNode('consultingScheduleCounselorId').value = '';
    consultingScheduleNode('consultingScheduleChoice').close();
    setConsultingScheduleStatus('', '', 'consultingScheduleBoardStatus');
    setConsultingScheduleStatus('', '', 'consultingScheduleSettingsStatus');
}

consultingScheduleNode('consultingScheduleSettings').addEventListener('input', event => { event.currentTarget.dataset.dirty = 'true'; });
consultingScheduleNode('consultingScheduleChoice').addEventListener('close', () => {
    consultingScheduleChoiceGeneration++;
    consultingScheduleChoice = null;
    const form = consultingScheduleNode('consultingScheduleChoiceForm');
    form.reset();
    form.elements.slot.replaceChildren();
});
for (const event of ['pagehide', 'studycrack:session-ended']) {
    window.addEventListener(event, resetConsultingSchedule);
    window.addEventListener(event, resetConsultingScheduleBoard);
}

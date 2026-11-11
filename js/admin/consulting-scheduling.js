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
let consultingScheduleBoardFailures = 0;
let consultingScheduleCanManage = false;
let consultingTeamAvailability = null;
const consultingTeamNames = new Map();
const consultingCounselorLabel = row => row.teamRole || consultingTeamNames.get(row.counselorId) || '기존 상담 담당자';

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
    consultingScheduleNode('consultingManualSessionBtn').hidden = data?.canManage === false || !data?.canChange;
    consultingScheduleNode('consultingProposeSessionBtn').hidden = data?.canManage === false || !data?.canChange || Boolean(data?.change);
    consultingScheduleNode('consultingCancelSessionBtn').hidden = data?.canManage === false || !data?.canChange;
    const copy = consultingScheduleNode('consultingCurrentSessionCopy');
    if (!session) { copy.textContent = ''; return; }
    copy.textContent = `확정 일정 · ${consultingWrittenDateTime(session.startAt)} · ${consultingCounselorLabel(session)}`;
    if (data.change) {
        const detail = document.createElement('p');
        const offers = data.change.offers || (data.change.offer ? [data.change.offer] : []);
        detail.textContent = data.change.kind === 'admin'
            ? `학생 응답 대기 · ${offers.map(offer => consultingWrittenDateTime(offer.startAt)).join(' / ')}`
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
        const proposing = data.session && !data.change;
        const action = consultingScheduleButton(proposing ? '변경 후보 선택' : consultingCandidateLabel(data),
            button => proposing ? openConsultingScheduleChoice(data.caseId, false, candidate) : saveConsultingScheduleCandidate(data, candidate, button, 'detail'), true);
        action.disabled = data.canManage === false;
        body.append(consultingScheduleRow([consultingWrittenDateTime(candidate.startAt), consultingCounselorLabel(candidate), candidate.lunch ? '점심 시간' : '학생 선택 시간', action]));
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
        if (row.confirmed && row.counselorId === localStorage.getItem('userId')) actions.append(consultingScheduleButton('상담 열기',
            () => window.location.assign(`/2027-jungsi-consulting/written-session?caseId=${encodeURIComponent(row.caseId)}`)));
        const label = row.confirmed
            ? row.proposed ? `확정 · 변경 제안 ${row.proposedOptions?.length || 1}개 응답 대기` : row.changeKind === 'student' ? '확정 · 학생 변경 요청' : '확정'
            : row.changeKind === 'student' ? '변경 추천' : '추천';
        for (const button of actions.querySelectorAll('button')) button.disabled = !consultingScheduleCanManage;
        fragment.append(consultingScheduleRow([consultingWrittenTime(row.startAt), studentLabel(row), consultingCounselorLabel(row), label, actions]));
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
    form.querySelector('[type="submit"]').disabled = !consultingScheduleCanManage;
}

function populateConsultingTeamAvailability(team) {
    const form = consultingScheduleNode('consultingTeamAvailability');
    if (!form || form.dataset.dirty === 'true') return;
    consultingTeamAvailability = team || null;
    consultingTeamNames.clear();
    for (const member of team?.members || []) consultingTeamNames.set(member.counselorId, member.role);
    consultingScheduleNode('consultingTeamIdentity').textContent = !team?.configured
        ? '운영팀 역할 등록이 필요합니다. CEO·CTO·CMO 계정 설정 후 이용할 수 있습니다.'
        : team.self ? `현재 계정: ${team.self.role} · 선택한 시간에는 상담을 추천하지 않습니다.` : '운영팀의 전체 시간표를 조회 중입니다. 불가 시간은 본인 운영팀 계정에서 설정하세요.';
    const body = consultingScheduleNode('consultingTeamBlockedSlots');
    body.replaceChildren();
    const blocked = new Set(team?.self?.blockedSlots || []);
    let group, date;
    for (const slot of team?.slots || []) {
        if (slot.localDate !== date) {
            date = slot.localDate;
            group = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = consultingWrittenDate(slot.startAt);
            group.append(legend); body.append(group);
        }
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox'; input.value = slot.slotId; input.checked = blocked.has(slot.slotId);
        input.disabled = !team.self?.editable || team.self.lockedSlots?.includes(slot.slotId);
        if (team.self.lockedSlots?.includes(slot.slotId)) label.title = '확정된 상담이 있는 시간입니다.';
        input.addEventListener('change', () => { form.dataset.dirty = 'true'; });
        label.append(input, document.createTextNode(slot.localTime)); group.append(label);
    }
    consultingScheduleNode('consultingTeamSave').disabled = !team?.self?.editable;
}

async function reloadConsultingTeamAvailability() {
    const form = consultingScheduleNode('consultingTeamAvailability');
    if (form.dataset.dirty === 'true' && !confirm('저장하지 않은 불가 시간 선택을 버리고 다시 불러올까요?')) return;
    form.dataset.dirty = 'false';
    await loadConsultingScheduleBoard('', true);
}

async function saveConsultingTeamAvailability() {
    const team = consultingTeamAvailability;
    if (!team?.self?.editable || consultingScheduleSaving) return;
    const button = consultingScheduleNode('consultingTeamSave');
    button.disabled = true; consultingScheduleSaving = true;
    try {
        const blockedSlots = [...consultingScheduleNode('consultingTeamBlockedSlots').querySelectorAll('input:checked')].map(input => input.value);
        await requestConsultingAdmin('admin_save_own_written_unavailability', { expectedRevision: team.revision, blockedSlots });
        consultingScheduleNode('consultingTeamAvailability').dataset.dirty = 'false';
        await loadConsultingScheduleBoard('나의 불가 시간을 저장했습니다. 최신 추천 시간표를 확인하세요.', true);
    } catch (error) {
        setConsultingScheduleStatus(error.status === 409 ? '일정이 변경됐습니다. 저장된 시간 다시 보기로 확인한 뒤 선택해 주세요.' : error.message, 'error', 'consultingScheduleSettingsStatus');
    } finally { button.disabled = false; consultingScheduleSaving = false; }
}

async function loadConsultingScheduleBoard(feedback = '', refresh = false) {
    if (!scheduleBoardIsOpen() || consultingScheduleBoardLoading && !refresh) return;
    const generation = ++consultingScheduleBoardGeneration;
    clearTimeout(consultingScheduleBoardTimer);
    consultingScheduleBoardLoading = true;
    let nextPoll = 20000;
    const status = (message, state) => setConsultingScheduleStatus(message, state, 'consultingScheduleBoardStatus');
    if (!consultingScheduleBoardFingerprint) status('전체 학생의 일정을 확인하고 있습니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_get_written_schedule_board');
        if (generation !== consultingScheduleBoardGeneration || !scheduleBoardIsOpen()) return;
        consultingScheduleBoardFailures = 0;
        consultingScheduleCanManage = data.canManage !== false;
        populateConsultingTeamAvailability(data.team);
        const fingerprint = JSON.stringify([data.placements, data.unassigned, data.confirmed, data.team?.members, consultingScheduleCanManage]);
        if (fingerprint !== consultingScheduleBoardFingerprint) {
            renderConsultingScheduleBoard(data);
            consultingScheduleBoardFingerprint = fingerprint;
        }
        populateConsultingScheduleSettings(data.settings);
        const counts = `추천 ${data.placements.length}건 · 확정 ${data.confirmed.length}건 · 배정 대기 ${data.unassigned.length}건`;
        const notes = [feedback, counts, data.limited ? '후보가 많아 계산 범위 안에서 찾은 조합을 표시합니다.' : '',
            data.hasOpenTimes ? '' : '선택 가능한 시간이 없습니다. 운영팀 계정과 불가 시간 설정을 확인하세요.'].filter(Boolean);
        status(notes.join(' '), 'success');
    } catch (error) {
        consultingScheduleBoardFailures++;
        nextPoll = [401, 403].includes(error.status) ? null : Math.min(120000, 20000 * 2 ** consultingScheduleBoardFailures);
        if (generation === consultingScheduleBoardGeneration) {
            for (const button of consultingScheduleNode('consultingScheduleBoardBody').querySelectorAll('button')) button.disabled = true;
            status(nextPoll === null ? '현재 계정의 시간표 조회 권한을 확인해주세요. 자동 재조회를 중지했습니다. 설정 적용 후 지금 갱신을 눌러주세요.' : `${error.message || '전체 시간표를 불러오지 못했습니다.'} 잠시 뒤 다시 확인합니다.`, 'error');
        }
    } finally {
        if (generation === consultingScheduleBoardGeneration) {
            consultingScheduleBoardLoading = false;
            if (scheduleBoardIsOpen() && nextPoll !== null) consultingScheduleBoardTimer = setTimeout(() => loadConsultingScheduleBoard(), nextPoll);
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

async function openConsultingScheduleChoice(caseId, manual = false, preselected) {
    const dialog = consultingScheduleNode('consultingScheduleChoice');
    const form = consultingScheduleNode('consultingScheduleChoiceForm');
    const manualFields = consultingScheduleNode('consultingScheduleManualFields');
    const proposalFields = consultingScheduleNode('consultingScheduleProposalChoices');
    const status = (message, state) => setConsultingScheduleStatus(message, state, 'consultingScheduleChoiceStatus');
    const generation = ++consultingScheduleChoiceGeneration;
    consultingScheduleChoice = null;
    form.reset();
    form.hidden = true;
    manualFields.hidden = !manual;
    proposalFields.hidden = true;
    proposalFields.disabled = true;
    form.elements.contactConfirmed.required = manual;
    form.elements.reason.required = manual;
    consultingScheduleNode('consultingScheduleChoiceTitle').textContent = manual ? '학생과 합의한 시간으로 변경' : '학생별 일정 선택';
    status('가능한 시간을 확인하고 있습니다.', 'loading');
    if (!dialog.open) dialog.showModal();
    try {
        const data = await requestConsultingAdmin('admin_list_schedule_candidates', { caseId, ...(manual ? { includeManual: true } : {}) });
        if (generation !== consultingScheduleChoiceGeneration || !dialog.open) return;
        const choices = manual ? data.manualCandidates : data.candidates;
        const proposalMode = Boolean(data.session && !data.change && !manual);
        consultingScheduleChoice = { data, choices, manual, proposalMode };
        consultingScheduleNode('consultingScheduleSingleChoice').hidden = proposalMode;
        form.elements.slot.disabled = proposalMode;
        proposalFields.hidden = !proposalMode;
        proposalFields.disabled = !proposalMode;
        const proposals = consultingScheduleNode('consultingScheduleProposalOptions');
        proposals.replaceChildren();
        if (proposalMode) choices.forEach((choice, index) => {
            const label = document.createElement('label');
            label.className = 'consulting-schedule-check';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = String(index);
            input.checked = choice.slotId === preselected?.slotId && choice.counselorId === preselected?.counselorId;
            input.addEventListener('change', () => {
                const checked = [...proposals.querySelectorAll('input:checked')];
                const duplicate = checked.some(other => other !== input && choices[Number(other.value)].slotId === choice.slotId);
                if (checked.length > 5 || input.checked && duplicate) {
                    input.checked = false;
                    status(duplicate ? '같은 시각은 상담사 한 명만 선택해주세요.' : '변경 후보는 최대 5개까지 선택해주세요.', 'error');
                } else status(`${checked.length}개 선택 · 학생이 수락하면 새 일정으로 변경됩니다.`, '');
            });
            label.append(input, document.createTextNode(`${consultingWrittenDateTime(choice.startAt)} · ${consultingCounselorLabel(choice)}`));
            proposals.append(label);
        });
        const prompt = new Option('가능 시간 선택', '');
        const options = choices.map((choice, index) => new Option(`${consultingWrittenDateTime(choice.startAt)} · ${consultingCounselorLabel(choice)}${choice.lunch ? ' · 점심' : ''}`, String(index)));
        form.elements.slot.replaceChildren(prompt, ...options);
        form.hidden = !choices.length;
        consultingScheduleNode('consultingScheduleChoiceSubmit').textContent = manual ? '합의한 일정으로 변경 확정'
            : proposalMode ? '선택한 시간들 제안 보내기' : consultingCandidateLabel(data);
        status(data.change?.kind === 'admin' && !manual ? '학생이 현재 제안에 답하기를 기다리고 있습니다.' : choices.length
            ? manual ? '학생과 직접 합의한 경우에만 확정하세요. 처리하면 진행 중인 변경 요청은 종료됩니다.'
                : proposalMode ? '학생이 처음 선택한 시간입니다. 최대 5개를 제안할 수 있고, 학생이 다른 가능 시간을 다시 알려줄 수도 있습니다.' : '학생이 선택한 가능 시간입니다.'
            : '현재 비어 있는 선택 시간이 없습니다. 학생과 직접 조율한 경우 학생 상세의 수동 변경에서 확정할 수 있습니다.', '');
    } catch (error) {
        if (generation === consultingScheduleChoiceGeneration) status(error.message || '후보를 불러오지 못했습니다.', 'error');
    }
}

async function submitConsultingScheduleChoice() {
    const form = consultingScheduleNode('consultingScheduleChoiceForm');
    const selected = form.elements.slot.value;
    const choice = consultingScheduleChoice;
    if (choice?.proposalMode) {
        const offers = [...consultingScheduleNode('consultingScheduleProposalOptions').querySelectorAll('input:checked')]
            .map(input => choice.choices[Number(input.value)]);
        if (!offers.length) return setConsultingScheduleStatus('제안할 시간을 한 개 이상 선택해주세요.', 'error', 'consultingScheduleChoiceStatus');
        return saveConsultingScheduleCandidate(choice.data, offers[0], consultingScheduleNode('consultingScheduleChoiceSubmit'), 'choice', null, offers);
    }
    const slot = selected && choice?.choices[Number(selected)];
    if (!slot || !form.reportValidity()) return;
    await saveConsultingScheduleCandidate(choice.data, slot, consultingScheduleNode('consultingScheduleChoiceSubmit'), 'choice',
        choice.manual ? { mode: 'manual', contactConfirmed: form.elements.contactConfirmed.checked, reason: form.elements.reason.value } : null);
}

async function saveConsultingScheduleCandidate(data, candidate, button, source, manual = null, offers) {
    if (consultingScheduleSaving) return;
    const sessionRevision = data.session?.revision ?? data.sessionRevision;
    const changeKind = data.change?.kind ?? data.changeKind;
    const booked = Number.isInteger(sessionRevision);
    const confirmed = !booked || manual || changeKind === 'student';
    const label = manual ? '학생과 합의한 이 시간으로 변경 확정' : consultingCandidateLabel(data);
    const prompt = offers ? `선택한 ${offers.length}개 시간을 학생에게 제안할까요?` : `${consultingWrittenDateTime(candidate.startAt)}에 ${label}할까요?`;
    if (!window.confirm(prompt)) return;
    const type = !booked ? 'admin_confirm_written_assignment' : confirmed ? 'admin_reschedule_written_session' : 'admin_request_written_reschedule';
    const payload = { caseId: data.caseId,
        ...(offers ? { offers: offers.map(({ counselorId, slotId }) => ({ counselorId, slotId })) } : { counselorId: candidate.counselorId, slotId: candidate.slotId }),
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
    consultingScheduleBoardFailures = 0;
    consultingScheduleCanManage = false;
    consultingTeamAvailability = null;
    consultingTeamNames.clear();
    const teamForm = consultingScheduleNode('consultingTeamAvailability');
    teamForm.reset(); teamForm.dataset.dirty = 'false';
    consultingScheduleNode('consultingTeamBlockedSlots').replaceChildren();
    consultingScheduleNode('consultingTeamSave').disabled = true;
    consultingScheduleNode('consultingTeamIdentity').textContent = '로그인한 운영자 정보를 확인합니다.';
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
    consultingScheduleNode('consultingScheduleProposalOptions').replaceChildren();
});
for (const event of ['pagehide', 'studycrack:session-ended']) {
    window.addEventListener(event, resetConsultingSchedule);
    window.addEventListener(event, resetConsultingScheduleBoard);
}

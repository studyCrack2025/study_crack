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
let consultingScheduleBoardData = null;
let consultingSchedulePolicy = 'operator_first';
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

const consultingSchedulePolicyLabels = { operator_first: '담당 우선', earliest_first: '빠른 일정 우선' };
const consultingRecommendationMessages = {
    no_submission: '학생이 제출한 상담 가능 시간이 없습니다.',
    team_missing: '운영팀 연결 설정이 필요합니다. 제출된 학생 시간은 보존되어 있습니다.',
    no_eligible_operator: '배정 가능한 운영팀 계정이 없습니다. 계정 활성 상태와 배정 권한을 확인해주세요.',
    period_changed: '학생이 선택한 시간이 현재 운영 기간에 포함되지 않습니다. 가능 시간을 다시 확인해주세요.',
    no_open_slot: '학생이 선택한 시간에 배정 가능한 담당자가 없습니다. 확정 일정과 불가 시간을 확인해주세요.',
    shared_schedule: '다른 학생의 선택 시간과 함께 조정이 필요합니다. 직접 선택에서 가능한 시간을 확인할 수 있습니다.',
    waiting_student: '학생이 현재 변경 제안에 답하기를 기다리고 있습니다.'
};
function renderConsultingScheduleCandidates(data) {
    const body = consultingScheduleNode('consultingScheduleCandidatesBody');
    if (!body) return;
    body.replaceChildren();
    const recommendations = data.recommendations || (data.candidates || []).slice(0, 2);
    if (!recommendations.length) {
        const note = document.createElement('p');
        note.textContent = consultingRecommendationMessages[data.recommendationStatus] || (data.change?.kind === 'admin' ? consultingRecommendationMessages.waiting_student : '현재 가능한 배정 후보가 없습니다.');
        body.append(note); return;
    }
    for (const candidate of recommendations.slice(0, 2)) {
        const card = document.createElement('article'); card.className = 'consulting-schedule-card';
        const title = document.createElement('h3'), time = document.createElement('strong'), person = document.createElement('p'), reason = document.createElement('p');
        const strategies = candidate.strategies || [];
        title.textContent = strategies.length > 1 ? '두 기준 공통 추천' : consultingSchedulePolicyLabels[strategies[0]] || '배정 가능 일정';
        time.textContent = consultingWrittenDateTime(candidate.startAt);
        person.textContent = `담당 · ${consultingCounselorLabel(candidate)}`;
        reason.className = 'consulting-caption';
        reason.textContent = strategies.length > 1 ? '담당과 시간을 우선한 두 결과가 같습니다.' : strategies[0] === 'operator_first' ? '운영팀 담당 순서를 우선해 선택했습니다.' : strategies[0] === 'earliest_first' ? '전체 학생의 빠른 배정을 우선해 선택했습니다.' : '학생이 선택한 가능 시간입니다.';
        const proposing = data.session && !data.change;
        const action = consultingScheduleButton(proposing ? '이 시간 변경 제안' : consultingCandidateLabel(data),
            button => proposing ? openConsultingScheduleChoice(data.caseId, false, candidate) : saveConsultingScheduleCandidate(data, candidate, button, 'detail'), true);
        action.disabled = data.canManage === false;
        card.append(title, time, person, reason, action); body.append(card);
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
        const count = (data.recommendations || data.candidates || []).length;
        consultingScheduleNode('consultingScheduleManual').open = false;
        setConsultingScheduleStatus(count ? `추천 일정 ${Math.min(count, 2)}개 · 전체 학생의 가능 시간과 확정 일정을 함께 반영했습니다.${data.limited ? ' 계산 범위 안에서 찾은 조합입니다.' : ''}` : consultingRecommendationMessages[data.recommendationStatus] || '추천 가능한 일정이 없습니다.', count ? 'success' : '');
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

function selectConsultingSchedulePolicy(policy) {
    if (!Object.hasOwn(consultingSchedulePolicyLabels, policy)) return;
    consultingSchedulePolicy = policy;
    document.querySelectorAll('[data-schedule-policy]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.schedulePolicy === policy)));
    if (consultingScheduleBoardData) {
        const data = consultingScheduleBoardData, plan = data.plans?.find(item => item.policy === policy) || data;
        renderConsultingScheduleBoard({ ...data, ...plan });
        setConsultingScheduleStatus(`${consultingSchedulePolicyLabels[policy]} · 추천 ${plan.placements.length}건 · 확정 ${data.confirmed.length}건 · 배정 대기 ${plan.unassigned.length}건${plan.limited ? ' · 계산 범위 안에서 찾은 조합입니다.' : ''}`, 'success', 'consultingScheduleBoardStatus');
    }
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
        if (row.confirmed && (row.counselorId === localStorage.getItem('userId') || localStorage.getItem('userRole') === 'admin')) {
            const chat = consultingScheduleButton(row.counselorId === localStorage.getItem('userId') ? '상담 열기' : '대화 기록 보기',
                () => window.location.assign(`/2027-jungsi-consulting/written-session?caseId=${encodeURIComponent(row.caseId)}`));
            chat.dataset.consultingReadLink = 'true'; actions.append(chat);
        }
        const label = row.confirmed
            ? row.proposed ? `확정 · 변경 제안 ${row.proposedOptions?.length || 1}개 응답 대기` : row.changeKind === 'student' ? '확정 · 학생 변경 요청' : '확정'
            : row.changeKind === 'student' ? '변경 추천' : '추천';
        for (const button of actions.querySelectorAll('button')) button.disabled = button.dataset.consultingReadLink !== 'true' && !consultingScheduleCanManage;
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
        consultingScheduleBoardData = data;
        const plan = data.plans?.find(item => item.policy === consultingSchedulePolicy) || data;
        const fingerprint = JSON.stringify([data.plans, data.placements, data.unassigned, data.confirmed, data.team?.members, consultingScheduleCanManage]);
        if (fingerprint !== consultingScheduleBoardFingerprint) {
            renderConsultingScheduleBoard({ ...data, ...plan });
            consultingScheduleBoardFingerprint = fingerprint;
        }
        populateConsultingScheduleSettings(data.settings);
        const counts = `${consultingSchedulePolicyLabels[consultingSchedulePolicy]} · 추천 ${plan.placements.length}건 · 확정 ${data.confirmed.length}건 · 배정 대기 ${plan.unassigned.length}건`;
        const notes = [feedback, counts, data.limited ? '후보가 많아 계산 범위 안에서 찾은 조합을 표시합니다.' : '',
            data.hasOpenTimes ? '' : '현재 배정 가능한 담당자가 없습니다. 운영팀 계정과 불가 시간을 확인해주세요. 학생은 가능한 시간을 먼저 제출할 수 있습니다.'].filter(Boolean);
        status(notes.join(' '), 'success');
    } catch (error) {
        consultingScheduleBoardFailures++;
        nextPoll = [401, 403].includes(error.status) ? null : Math.min(120000, 20000 * 2 ** consultingScheduleBoardFailures);
        if (generation === consultingScheduleBoardGeneration) {
            consultingScheduleCanManage = false;
            consultingScheduleBoardData = null;
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
    const dialog = consultingScheduleNode('consultingScheduleChoice'), form = consultingScheduleNode('consultingScheduleChoiceForm');
    consultingScheduleChoiceGeneration++;
    form.reset(); form.hidden = true;
    consultingScheduleChoice = { caseId, manual, offers: new Map() };
    consultingScheduleNode('consultingScheduleChoiceTitle').textContent = manual ? '학생과 합의한 시간으로 변경' : '학생별 일정 선택';
    if (!dialog.open) dialog.showModal();
    await loadConsultingScheduleChoiceDate(preselected?.startAt ? new Date(Date.parse(preselected.startAt) + 9 * 3600000).toISOString().slice(0, 10) : undefined, preselected);
}
async function loadConsultingScheduleChoiceDate(date, preselected) {
    const dialog = consultingScheduleNode('consultingScheduleChoice'), form = consultingScheduleNode('consultingScheduleChoiceForm'), prior = consultingScheduleChoice;
    if (!prior || !dialog.open) return;
    const generation = ++consultingScheduleChoiceGeneration;
    prior.loading = true;
    const status = (message, state = '') => setConsultingScheduleStatus(message, state, 'consultingScheduleChoiceStatus');
    for (const field of ['date', 'slot', 'counselor']) form.elements[field].disabled = true;
    consultingScheduleNode('consultingScheduleChoiceSubmit').disabled = true;
    consultingScheduleNode('consultingScheduleProposalAdd').disabled = true;
    status('선택한 날짜의 가능 시간을 확인하고 있습니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_list_schedule_candidates', { caseId: prior.caseId, view: 'manual', ...(date ? { date } : {}), ...(prior.manual ? { includeManual: true } : {}) });
        if (generation !== consultingScheduleChoiceGeneration || !dialog.open) return;
        const all = (prior.manual ? data.manualCandidates : data.candidates) || [];
        const day = slot => slot.localDate || new Date(Date.parse(slot.startAt) + 9 * 3600000).toISOString().slice(0, 10);
        const dates = data.choiceDates || [...new Set(all.map(day))].sort().map(value => ({ date: value }));
        const selectedDate = data.selectedDate || date || dates[0]?.date;
        const choices = all.filter(slot => day(slot) === selectedDate).sort((a, b) => a.startAt.localeCompare(b.startAt) || ({ CMO: 0, CEO: 1, CTO: 2 }[a.teamRole] ?? 3) - ({ CMO: 0, CEO: 1, CTO: 2 }[b.teamRole] ?? 3) || a.counselorId.localeCompare(b.counselorId));
        const changed = prior.data && ['availabilityRevision', 'changeRevision'].some(key => prior.data[key] !== data[key]) || prior.data && prior.data.session?.revision !== data.session?.revision;
        const offers = changed ? new Map() : prior.offers;
        const proposalMode = Boolean(data.session && !data.change && !prior.manual);
        consultingScheduleChoice = { ...prior, data, choices, offers, proposalMode, loading: false };
        form.elements.date.replaceChildren(...dates.map(item => new Option(consultingWrittenDate(`${item.date}T00:00:00+09:00`), item.date)));
        form.elements.date.value = selectedDate || ''; form.elements.date.disabled = !dates.length;
        const times = [...new Map(choices.map(slot => [slot.slotId, slot])).values()];
        form.elements.slot.replaceChildren(new Option('시간 선택', ''), ...times.map(slot => new Option(`${consultingWrittenTime(slot.startAt)}${slot.lunch ? ' · 점심' : ''}`, slot.slotId)));
        form.elements.slot.disabled = !choices.length;
        form.elements.slot.value = choices.some(slot => slot.slotId === preselected?.slotId) ? preselected.slotId : '';
        consultingScheduleNode('consultingScheduleManualFields').hidden = !prior.manual;
        for (const field of ['contactConfirmed', 'reason']) { form.elements[field].required = prior.manual; form.elements[field].disabled = !prior.manual; }
        const proposals = consultingScheduleNode('consultingScheduleProposalChoices'); proposals.hidden = !proposalMode; proposals.disabled = !proposalMode;
        form.elements.slot.required = !proposalMode; form.elements.counselor.required = !proposalMode;
        consultingScheduleNode('consultingScheduleProposalAdd').disabled = !choices.length;
        form.hidden = false;
        renderConsultingScheduleChoiceCounselors(preselected?.counselorId);
        renderConsultingScheduleProposals();
        consultingScheduleNode('consultingScheduleChoiceSubmit').textContent = prior.manual ? '합의한 일정으로 변경 확정' : proposalMode ? '선택한 시간들 제안 보내기' : consultingCandidateLabel(data);
        status(changed ? '시간 정보가 변경되어 선택한 변경 후보를 비웠습니다. 최신 시간에서 다시 선택해주세요.' : data.change?.kind === 'admin' && !prior.manual ? '학생의 변경 제안 응답을 기다리고 있습니다.' : choices.length ? prior.manual ? '직접 합의한 시간만 확정하세요. 기존 변경 요청은 종료됩니다.' : proposalMode ? '날짜와 시간을 골라 최대 5개를 후보에 추가하세요.' : '날짜·시간·담당자를 선택한 뒤 확정하세요.' : '이 날짜에 배정 가능한 시간이 없습니다. 다른 날짜를 확인해주세요.');
    } catch (error) {
        if (generation !== consultingScheduleChoiceGeneration) return;
        form.hidden = true; status(error.message || '가능 시간을 불러오지 못했습니다. 창을 닫고 다시 확인해주세요.', 'error');
    }
}
function renderConsultingScheduleChoiceCounselors(preselected) {
    const choice = consultingScheduleChoice, form = consultingScheduleNode('consultingScheduleChoiceForm');
    const rows = choice?.choices?.filter(row => row.slotId === form.elements.slot.value) || [];
    form.elements.counselor.replaceChildren(...rows.map(row => new Option(consultingCounselorLabel(row), row.counselorId)));
    if (rows.some(row => row.counselorId === preselected)) form.elements.counselor.value = preselected;
    form.elements.counselor.disabled = !rows.length;
    consultingScheduleNode('consultingScheduleChoiceSubmit').disabled = choice?.data?.canManage === false || (choice?.proposalMode ? !choice.offers.size : !rows.length);
    consultingScheduleNode('consultingScheduleProposalAdd').disabled = choice?.data?.canManage === false || !rows.length;
}
function renderConsultingScheduleProposals() {
    const choice = consultingScheduleChoice, body = consultingScheduleNode('consultingScheduleProposalOptions'); body.replaceChildren();
    for (const [id, slot] of choice?.offers || []) {
        const row = document.createElement('div'); row.className = 'consulting-heading-row';
        const label = document.createElement('span'); label.textContent = `${consultingWrittenDateTime(slot.startAt)} · ${consultingCounselorLabel(slot)}`;
        row.append(label, consultingScheduleButton('삭제', () => { choice.offers.delete(id); renderConsultingScheduleProposals(); renderConsultingScheduleChoiceCounselors(); })); body.append(row);
    }
    if (choice?.proposalMode) consultingScheduleNode('consultingScheduleChoiceSubmit').disabled = choice.data.canManage === false || !choice.offers.size;
}
function addConsultingScheduleProposal() {
    const choice = consultingScheduleChoice, form = consultingScheduleNode('consultingScheduleChoiceForm');
    const slot = choice?.choices?.find(row => row.slotId === form.elements.slot.value && row.counselorId === form.elements.counselor.value);
    if (!choice?.proposalMode || choice.loading || !slot || choice.data.canManage === false) return;
    if (choice.offers.has(slot.slotId) || choice.offers.size >= 5) return setConsultingScheduleStatus(choice.offers.has(slot.slotId) ? '같은 시각은 한 번만 선택해주세요.' : '변경 후보는 최대 5개까지 선택해주세요.', 'error', 'consultingScheduleChoiceStatus');
    choice.offers.set(slot.slotId, slot); renderConsultingScheduleProposals();
    setConsultingScheduleStatus(`${choice.offers.size}개 선택 · 학생이 수락하면 새 일정으로 변경됩니다.`, '', 'consultingScheduleChoiceStatus');
}
async function submitConsultingScheduleChoice() {
    const form = consultingScheduleNode('consultingScheduleChoiceForm'), choice = consultingScheduleChoice;
    if (!choice || choice.loading || choice.data?.canManage === false) return;
    if (choice.proposalMode) {
        const offers = [...choice.offers.values()];
        if (!offers.length) return;
        return saveConsultingScheduleCandidate(choice.data, offers[0], consultingScheduleNode('consultingScheduleChoiceSubmit'), 'choice', null, offers);
    }
    const slot = choice.choices.find(row => row.slotId === form.elements.slot.value && row.counselorId === form.elements.counselor.value);
    if (!slot || !form.reportValidity()) return;
    await saveConsultingScheduleCandidate(choice.data, slot, consultingScheduleNode('consultingScheduleChoiceSubmit'), 'choice', choice.manual ? { mode: 'manual', contactConfirmed: form.elements.contactConfirmed.checked, reason: form.elements.reason.value } : null);
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
    consultingScheduleChoiceGeneration++;
    consultingScheduleChoice = null;
    consultingScheduleNode('consultingScheduleChoice')?.close();
    currentConsultingSchedule = null;
    const manualPanel = consultingScheduleNode('consultingScheduleManual'); if (manualPanel) manualPanel.open = false;
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
    consultingScheduleBoardData = null;
    consultingSchedulePolicy = 'operator_first';
    document.querySelectorAll('[data-schedule-policy]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.schedulePolicy === consultingSchedulePolicy)));
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

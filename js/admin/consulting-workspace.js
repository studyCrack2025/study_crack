let consultingWorkspaceGeneration = 0;
let consultingWorkspaceStudent = null;
let consultingWorkspaceReference = null;
let consultingWorkspacePhase = 'all';
let consultingDirectoryCursor = null;
let consultingDirectoryNextCursor = null;
let consultingDirectoryPreviousCursors = [];
let consultingWorkspaceLoadedTabs = new Set();
let consultingExportLimit = 0;
let consultingExportPage = [];
let consultingExportColumns = [];
let consultingExportRequest = null;
let consultingExportBusy = false;
const consultingExportStudents = new Map();
const consultingExportColumnIds = new Set();
const consultingPhaseTitles = { intake: '접수·입금', onboarding: '가입·조사서', written: '서면상담', report: '분석·보고서', final: '파이널 콜', completed: '완료' };

function consultingWorkspaceStatus(id, message, state = '') {
    const node = document.getElementById(id);
    if (node) { node.textContent = message; node.dataset.state = state; }
}
function clearConsultingWorkspaceStudent() {
    consultingWorkspaceStudent = null;
    consultingWorkspaceReference = null;
    consultingWorkspaceLoadedTabs.clear();
    resetConsultingIntake();
    if (typeof resetConsultingMaterial === 'function') resetConsultingMaterial();
    if (typeof resetConsultingSchedule === 'function') resetConsultingSchedule();
    if (typeof resetConsultingServiceControl === 'function') resetConsultingServiceControl();
    if (typeof resetConsultingReportSource === 'function') resetConsultingReportSource();
    for (const id of ['consultingStudentState', 'consultingStudentProgress', 'consultingStudentNextAction', 'consultingStudentIdentifiers']) document.getElementById(id)?.replaceChildren();
    document.getElementById('consultingMaterialAccess').hidden = true;
    document.getElementById('consultingStudentTitle').textContent = '학생 상세';
    document.getElementById('consultingStudentPanel').hidden = true;
    document.getElementById('consultingStudentPanel').setAttribute('aria-busy', 'false');
    document.getElementById('consultingReportCaseId').value = '';
    document.querySelectorAll('[data-workspace-pane]').forEach(pane => { pane.hidden = pane.dataset.workspacePane !== 'overview'; });
    document.querySelectorAll('[data-student-tab]').forEach(button => { button.disabled = true; });
    consultingWorkspaceStatus('consultingStudentStatus', '');
}
function resetConsultingWorkspace() {
    consultingWorkspaceGeneration++;
    resetConsultingExport();
    clearConsultingWorkspaceStudent();
    document.getElementById('consultingDirectoryBody')?.replaceChildren();
    consultingWorkspaceStatus('consultingDirectoryStatus', '');
    document.getElementById('consultingAdminTools').open = false;
    document.getElementById('consultingDirectoryPanel').setAttribute('aria-busy', 'false');
}
function consultingWorkspaceNavigate(route, replace = false) {
    writeAdminLocation({ section: 'consulting', phase: consultingWorkspacePhase, ...route }, replace);
    return activateConsultingWorkspace(readAdminLocation());
}
function selectConsultingPhase(phase) {
    if (!ADMIN_CONSULTING_PHASES.includes(phase)) return;
    return consultingWorkspaceNavigate({ phase });
}
function selectConsultingStudentTab(tab) {
    if (!consultingWorkspaceReference || !ADMIN_CONSULTING_TABS.includes(tab)) return;
    consultingWorkspaceNavigate({ ...consultingWorkspaceReference, tab });
}
function closeConsultingStudent() { consultingWorkspaceNavigate({}); }
function openConsultingStudent(item) {
    if (!/^APP_[0-9a-f-]{36}$/i.test(item?.applicationId || '') || !/^[A-Za-z0-9_-]{8,200}$/.test(item?.sourceResponseId || '')) return;
    return consultingWorkspaceNavigate({ applicationId: item.applicationId, sourceResponseId: item.sourceResponseId });
}
function invalidateConsultingWorkspaceStudent() {
    const reference = consultingWorkspaceReference; consultingWorkspaceGeneration++; clearConsultingWorkspaceStudent();
    consultingWorkspaceReference = reference; document.getElementById('consultingStudentPanel').hidden = false;
}
function consultingWorkspaceHasStudent() { return Boolean(consultingWorkspaceReference); }
async function refreshConsultingWorkspaceStudent() {
    if (!consultingWorkspaceReference) return false;
    const route = { ...readAdminLocation(), ...consultingWorkspaceReference };
    const refresh = loadConsultingWorkspaceStudent(route);
    const generation = consultingWorkspaceGeneration;
    await refresh;
    return generation === consultingWorkspaceGeneration;
}
function activateConsultingWorkspace(route) {
    const phase = ADMIN_CONSULTING_PHASES.includes(route.phase) ? route.phase : 'all';
    if (phase !== consultingWorkspacePhase) { consultingDirectoryCursor = null; consultingDirectoryNextCursor = null; consultingDirectoryPreviousCursors = []; }
    consultingWorkspacePhase = phase;
    document.querySelectorAll('[data-phase]').forEach(button => { button.setAttribute('aria-current', button.dataset.phase === phase ? 'page' : 'false'); });
    if (route.caseId || route.applicationId && route.sourceResponseId) {
        closeConsultingExportDialog();
        document.getElementById('consultingDirectoryPanel').hidden = true;
        document.getElementById('consultingAdminTools').open = false;
        document.getElementById('consultingScheduleBoard').open = false;
        if (consultingWorkspaceStudent && (route.caseId ? consultingWorkspaceReference?.caseId === route.caseId
            : consultingWorkspaceReference?.applicationId === route.applicationId && consultingWorkspaceReference.sourceResponseId === route.sourceResponseId)) return showConsultingStudentTab(route.tab);
        return loadConsultingWorkspaceStudent(route);
    }
    consultingWorkspaceGeneration++;
    clearConsultingWorkspaceStudent();
    document.getElementById('consultingDirectoryPanel').hidden = false;
    if (document.getElementById('consultingScheduleBoard').open) loadConsultingScheduleBoard();
    document.getElementById('consultingDirectoryTitle').scrollIntoView({ block: 'start' });
    return loadConsultingDirectory();
}
function renderConsultingDirectory(items, empty = '이 페이지에 해당 단계의 학생이 없습니다. 다음 페이지가 있으면 계속 확인해주세요.') {
    const body = document.getElementById('consultingDirectoryBody'); body.replaceChildren();
    consultingExportPage = items;
    updateConsultingExportSelection();
    if (!items.length) { const row = document.createElement('tr'), cell = createConsultingCell(empty); cell.colSpan = 5; cell.className = 'empty-msg'; row.appendChild(cell); body.appendChild(row); return; }
    for (const item of items) {
        const row = document.createElement('tr');
        const student = createConsultingCell(''), name = document.createElement('strong'), contact = document.createElement('span');
        name.textContent = item.studentNameMask; contact.textContent = item.phoneMask;
        if (consultingExportLimit) {
            const label = document.createElement('label'), checkbox = document.createElement('input'), identity = document.createElement('div');
            label.className = 'consulting-export-person';
            checkbox.type = 'checkbox';
            checkbox.dataset.exportStudent = item.applicationId;
            checkbox.setAttribute('aria-label', `${consultingExportStudentLabel(item)} 선택`);
            checkbox.checked = consultingExportStudents.has(item.applicationId);
            checkbox.addEventListener('change', () => selectConsultingExportStudent(item, checkbox.checked));
            identity.append(name, contact); label.append(checkbox, identity); student.appendChild(label);
        } else student.append(name, contact);
        row.append(student, createConsultingCell(`${item.stateLabel}${item.held ? ' · 보류' : ''}`), createConsultingCell(item.nextAction), createConsultingCell(formatConsultingDate(item.updatedAt)));
        const cell = createConsultingCell(''), button = document.createElement('button'); button.type = 'button'; button.className = 'consulting-btn consulting-btn-primary'; button.textContent = '학생 상세'; button.addEventListener('click', () => openConsultingStudent(item)); cell.appendChild(button); row.appendChild(cell);
        [...row.children].forEach((node, index) => { node.dataset.label = ['학생', '현재 상태', '다음 할 일', '최근 변경', '관리 액션'][index]; });
        body.appendChild(row);
    }
}
async function loadConsultingDirectory() {
    const generation = ++consultingWorkspaceGeneration, phase = consultingWorkspacePhase;
    const panel = document.getElementById('consultingDirectoryPanel'); panel.setAttribute('aria-busy', 'true');
    document.getElementById('consultingDirectoryPrevious').disabled = true;
    document.getElementById('consultingDirectoryNext').disabled = true;
    document.getElementById('consultingDirectoryPage').textContent = '';
    renderConsultingDirectory([], '학생 목록을 불러오고 있습니다.');
    consultingWorkspaceStatus('consultingDirectoryStatus', '학생 목록을 불러오고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_list_consulting_students', { phase, cursor: consultingDirectoryCursor });
        if (generation !== consultingWorkspaceGeneration) return;
        if (!Array.isArray(data.items) || data.items.length > 20 || data.items.some(item => !/^APP_[0-9a-f-]{36}$/i.test(item?.applicationId || '') || !/^[A-Za-z0-9_-]{8,200}$/.test(item?.sourceResponseId || '')) || data.nextCursor && (typeof data.nextCursor !== 'string' || data.nextCursor.length > 1600)) throw new Error('목록 형식을 확인할 수 없습니다.');
        consultingExportLimit = Number.isSafeInteger(data.exportLimit) && data.exportLimit > 0 ? data.exportLimit : 0;
        if (!consultingExportLimit) resetConsultingExport();
        consultingDirectoryNextCursor = data.nextCursor || null;
        renderConsultingDirectory(data.items);
        document.getElementById('consultingDirectoryPage').textContent = `${consultingDirectoryPreviousCursors.length + 1}페이지 · ${data.items.length}명`;
        consultingWorkspaceStatus('consultingDirectoryStatus', `${phase === 'all' ? '전체 신청' : phase === 'attention' ? '보류·거절·초대 취소' : consultingPhaseTitles[phase]} · 현재 페이지 ${data.items.length}명${data.unavailableCount ? ' · 연결 정보 확인이 필요한 신청이 있습니다.' : ''}${consultingDirectoryNextCursor ? ' · 다음 페이지가 있습니다.' : ''}`, data.unavailableCount ? 'error' : 'success');
    } catch (_error) {
        if (generation !== consultingWorkspaceGeneration) return;
        resetConsultingExport();
        consultingDirectoryNextCursor = null; renderConsultingDirectory([], '학생 목록을 불러오지 못했습니다.');
        consultingWorkspaceStatus('consultingDirectoryStatus', '학생 목록을 불러오지 못했습니다. 최신 서버 적용·권한·접수 설정을 확인한 뒤 목록을 새로고침해주세요.', 'error');
    } finally {
        if (generation === consultingWorkspaceGeneration) { panel.setAttribute('aria-busy', 'false'); document.getElementById('consultingDirectoryPrevious').disabled = !consultingDirectoryPreviousCursors.length; document.getElementById('consultingDirectoryNext').disabled = !consultingDirectoryNextCursor; }
    }
}
function nextConsultingDirectoryPage() {
    if (!consultingDirectoryNextCursor) return;
    consultingDirectoryPreviousCursors.push(consultingDirectoryCursor); consultingDirectoryCursor = consultingDirectoryNextCursor; return loadConsultingDirectory();
}
function previousConsultingDirectoryPage() {
    if (!consultingDirectoryPreviousCursors.length) return;
    consultingDirectoryCursor = consultingDirectoryPreviousCursors.pop(); return loadConsultingDirectory();
}

function consultingExportStudentLabel(item) {
    return `${item.studentNameMask || '이름 확인 필요'} · ${item.phoneMask || '연락처 확인 필요'}`;
}

function updateConsultingExportSelection() {
    document.getElementById('consultingDirectoryExportTools').hidden = !consultingExportLimit;
    const count = consultingExportStudents.size;
    document.getElementById('consultingExportCount').textContent = consultingExportLimit ? `${count}명 선택 · 최대 ${consultingExportLimit}명` : '';
    document.getElementById('consultingExportOpen').disabled = !count;
    document.getElementById('consultingExportClear').disabled = !count;
    const pageButton = document.getElementById('consultingExportPageSelect');
    pageButton.disabled = !consultingExportPage.length;
    pageButton.textContent = consultingExportPage.length && consultingExportPage.every(item => consultingExportStudents.has(item.applicationId)) ? '현재 페이지 선택 해제' : '현재 페이지 선택';
    document.querySelectorAll('#consultingDirectoryBody [data-export-student]').forEach(input => {
        input.checked = consultingExportStudents.has(input.dataset.exportStudent);
    });
}

function selectConsultingExportStudents(items, checked) {
    if (!consultingExportLimit) return;
    const additional = items.filter(item => !consultingExportStudents.has(item.applicationId)).length;
    if (checked && consultingExportStudents.size + additional > consultingExportLimit) {
        consultingWorkspaceStatus('consultingExportListStatus', `한 번에 ${consultingExportLimit}명까지 내보낼 수 있습니다. 선택을 줄여주세요.`, 'error');
    } else {
        for (const item of items) {
            if (checked) consultingExportStudents.set(item.applicationId, {
                applicationId: item.applicationId, sourceResponseId: item.sourceResponseId, label: consultingExportStudentLabel(item)
            });
            else consultingExportStudents.delete(item.applicationId);
        }
        consultingWorkspaceStatus('consultingExportListStatus', '');
    }
    updateConsultingExportSelection();
}

function selectConsultingExportStudent(item, checked) { selectConsultingExportStudents([item], checked); }

function toggleConsultingExportPage() {
    selectConsultingExportStudents(consultingExportPage, consultingExportPage.some(item => !consultingExportStudents.has(item.applicationId)));
}

function clearConsultingExportStudents() {
    consultingExportStudents.clear();
    consultingWorkspaceStatus('consultingExportListStatus', '');
    updateConsultingExportSelection();
}

function closeConsultingExportDialog() {
    consultingExportRequest?.abort();
    consultingExportRequest = null;
    consultingExportBusy = false;
    consultingExportColumns = [];
    consultingExportColumnIds.clear();
    const dialog = document.getElementById('consultingExportDialog');
    if (dialog.open) dialog.close();
    document.getElementById('consultingExportStudentSummary').textContent = '선택 학생';
    document.getElementById('consultingExportStudentList').replaceChildren();
    document.getElementById('consultingExportColumns').replaceChildren();
    document.getElementById('consultingExportSearch').value = '';
    document.getElementById('consultingExportSearch').disabled = true;
    updateConsultingExportColumns();
    consultingWorkspaceStatus('consultingExportStatus', '');
}

function resetConsultingExport() {
    closeConsultingExportDialog();
    consultingExportLimit = 0;
    consultingExportPage = [];
    clearConsultingExportStudents();
}

function updateConsultingExportColumns() {
    document.getElementById('consultingExportFields').disabled = consultingExportBusy;
    document.getElementById('consultingExportColumnCount').textContent = `${consultingExportColumnIds.size}개 항목 선택`;
    document.getElementById('consultingExportSubmit').disabled = consultingExportBusy || !consultingExportColumnIds.size;
}

function consultingExportOption(title, change) {
    const label = document.createElement('label'), input = document.createElement('input');
    label.className = 'consulting-export-option';
    input.type = 'checkbox';
    input.addEventListener('change', () => change(input.checked));
    label.append(input, document.createTextNode(title));
    return { label, input };
}

function renderConsultingExportColumns() {
    const target = document.getElementById('consultingExportColumns');
    const search = document.getElementById('consultingExportSearch').value.trim().toLowerCase();
    const groups = new Map();
    for (const column of consultingExportColumns) {
        if (!`${column.group} ${column.label}`.toLowerCase().includes(search)) continue;
        if (!groups.has(column.group)) groups.set(column.group, []);
        groups.get(column.group).push(column);
    }
    target.replaceChildren();
    if (!groups.size) target.textContent = '검색에 맞는 항목이 없습니다.';
    for (const [group, columns] of groups) {
        const details = document.createElement('details'), summary = document.createElement('summary'), options = document.createElement('div');
        details.className = 'consulting-export-group';
        details.open = !!search || group === consultingExportColumns[0]?.group;
        options.className = 'consulting-export-options';
        summary.textContent = group;
        const selectGroup = consultingExportOption(search ? '이 묶음의 검색 결과 전체' : '이 묶음 전체', checked => {
            for (const { column, input } of inputs) { selectColumn(column.id, checked); input.checked = checked; }
            updateGroup();
        });
        const selectColumn = (id, checked) => checked ? consultingExportColumnIds.add(id) : consultingExportColumnIds.delete(id);
        const inputs = columns.map(column => {
            const option = consultingExportOption(column.label, checked => { selectColumn(column.id, checked); updateGroup(); });
            option.input.checked = consultingExportColumnIds.has(column.id);
            return { column, ...option };
        });
        function updateGroup() {
            const count = inputs.filter(({ input }) => input.checked).length;
            selectGroup.input.checked = count === inputs.length;
            selectGroup.input.indeterminate = count > 0 && count < inputs.length;
            updateConsultingExportColumns();
        }
        selectGroup.input.setAttribute('aria-label', `${group} ${search ? '검색 결과 전체 선택' : '전체 선택'}`);
        options.append(...inputs.map(({ label }) => label));
        details.append(summary, selectGroup.label, options);
        target.appendChild(details);
        updateGroup();
    }
}

async function openConsultingExportDialog() {
    const dialog = document.getElementById('consultingExportDialog');
    if (!consultingExportLimit || !consultingExportStudents.size || dialog.open) return;
    consultingWorkspaceStatus('consultingExportListStatus', '');
    const request = new AbortController();
    consultingExportRequest = request;
    document.getElementById('consultingExportStudentSummary').textContent = `선택 학생 ${consultingExportStudents.size}명`;
    document.getElementById('consultingExportStudentList').replaceChildren(...[...consultingExportStudents.values()].map(student => {
        const li = document.createElement('li'); li.textContent = `${student.label} · ${student.applicationId.slice(-8)}`; return li;
    }));
    dialog.showModal();
    consultingWorkspaceStatus('consultingExportStatus', '내보낼 수 있는 항목을 불러오고 있습니다.');
    try {
        const { columns } = await requestConsultingAdmin('admin_get_consulting_export_columns', {}, request.signal);
        if (request !== consultingExportRequest) return;
        if (!Array.isArray(columns) || !columns.length || columns.some(column => typeof column?.id !== 'string' || typeof column.label !== 'string' || typeof column.group !== 'string')) throw new Error('항목 형식 오류');
        consultingExportColumns = columns;
        document.getElementById('consultingExportSearch').disabled = false;
        renderConsultingExportColumns();
        consultingWorkspaceStatus('consultingExportStatus', '');
    } catch (error) {
        if (request === consultingExportRequest) consultingWorkspaceStatus('consultingExportStatus', consultingExportError(error), 'error');
    } finally {
        if (request === consultingExportRequest) consultingExportRequest = null;
    }
}

function consultingExportError(error) {
    if (error.status === 403) return '선택한 자료를 내보낼 권한을 확인해주세요.';
    if (error.status === 409 || error.status === 404) return '선택한 신청이나 자료가 변경됐습니다. 목록을 새로고침한 뒤 다시 선택해주세요.';
    if (error.status === 413) return '선택한 자료가 큽니다. 학생이나 항목 수를 줄여주세요.';
    return 'CSV 내보내기를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

async function downloadConsultingExport() {
    if (!document.getElementById('consultingExportDialog').open || consultingExportBusy || !consultingExportColumnIds.size) return;
    const students = [...consultingExportStudents.values()].map(({ applicationId, sourceResponseId }) => ({ applicationId, sourceResponseId }));
    const columnIds = consultingExportColumns.filter(column => consultingExportColumnIds.has(column.id)).map(column => column.id);
    const request = new AbortController();
    consultingExportRequest = request;
    consultingExportBusy = true;
    updateConsultingExportColumns();
    consultingWorkspaceStatus('consultingExportStatus', '선택한 학생의 CSV를 만들고 있습니다.');
    try {
        const { csv, rowCount, fileName } = await requestConsultingAdmin('admin_export_consulting_students', { students, columnIds }, request.signal);
        if (request !== consultingExportRequest) return;
        if (rowCount !== students.length || typeof csv !== 'string' || !csv.startsWith('\uFEFF') || !/^jungsi-consulting-\d{8}T\d{6}Z\.csv$/.test(fileName)) throw new Error('CSV 형식 오류');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        closeConsultingExportDialog();
        consultingWorkspaceStatus('consultingExportListStatus', `${rowCount}명 CSV 다운로드를 시작했습니다.`, 'success');
    } catch (error) {
        if (request === consultingExportRequest) consultingWorkspaceStatus('consultingExportStatus', consultingExportError(error), 'error');
    } finally {
        if (request === consultingExportRequest) { consultingExportRequest = null; consultingExportBusy = false; updateConsultingExportColumns(); }
    }
}

async function loadConsultingWorkspaceStudent(route) {
    const generation = ++consultingWorkspaceGeneration;
    clearConsultingWorkspaceStudent();
    consultingWorkspaceReference = route.caseId ? { caseId: route.caseId } : { applicationId: route.applicationId, sourceResponseId: route.sourceResponseId };
    const panel = document.getElementById('consultingStudentPanel'); panel.hidden = false; panel.setAttribute('aria-busy', 'true');
    panel.scrollIntoView({ block: 'start' });
    consultingWorkspaceStatus('consultingStudentStatus', '학생 정보를 불러오고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_get_consulting_student', consultingWorkspaceReference);
        if (generation !== consultingWorkspaceGeneration) return;
        if ((route.caseId ? data.case?.caseId !== route.caseId || !/^APP_[0-9a-f-]{36}$/i.test(data.application?.applicationId || '') || data.student?.applicationId !== data.application.applicationId
            : data.student?.applicationId !== route.applicationId || data.student?.sourceResponseId !== route.sourceResponseId || data.application?.applicationId !== route.applicationId)
            || !data.contact || data.case && !/^CASE_[0-9a-f-]{36}$/i.test(data.case.caseId || '')) throw new Error('학생 상세를 확인할 수 없습니다.');
        consultingWorkspaceStudent = data;
        document.getElementById('consultingStudentTitle').textContent = `${data.contact.studentName || data.student.studentNameMask} · 학생 상세`;
        document.getElementById('consultingStudentState').textContent = `${data.student.stateLabel}${data.student.held ? ' · 보류 중' : ''} · 최근 변경 ${formatConsultingDate(data.student.updatedAt)}`;
        const progress = document.getElementById('consultingStudentProgress'), phaseIndex = Object.keys(consultingPhaseTitles).indexOf(data.student.phase); progress.replaceChildren();
        Object.entries(consultingPhaseTitles).forEach(([phase, title], index) => { const item = document.createElement('li'); item.textContent = title; item.dataset.progress = index < phaseIndex ? 'complete' : index === phaseIndex ? 'current' : 'upcoming'; if (index === phaseIndex) item.setAttribute('aria-current', 'step'); progress.appendChild(item); });
        const next = document.getElementById('consultingStudentNextAction'); next.textContent = `다음 할 일 · ${data.student.nextAction}`;
        document.getElementById('consultingStudentIdentifiers').textContent = `신청 ${data.application.applicationId}${data.case ? `\n케이스 ${data.case.caseId}` : ''}\n신청 수정 버전 ${data.application.revision}`;
        for (const id of ['consultingScheduleCaseId', 'consultingReportCaseId', 'consultingServiceCaseId']) document.getElementById(id).value = data.case?.caseId || '';
        renderConsultingApplication(data.application.applicationId, data);
        await showConsultingStudentTab(route.tab);
        if (generation !== consultingWorkspaceGeneration) return;
        consultingWorkspaceStatus('consultingStudentStatus', '', 'success');
        document.getElementById('consultingStudentTitle').focus({ preventScroll: true });
    } catch (_error) {
        if (generation !== consultingWorkspaceGeneration) return;
        clearConsultingWorkspaceStudent(); panel.hidden = false;
        consultingWorkspaceStatus('consultingStudentStatus', '학생 상세를 불러오지 못했습니다. 목록으로 돌아가 학생을 다시 선택하거나 정보를 새로고침해주세요.', 'error');
        consultingWorkspaceReference = route.caseId ? { caseId: route.caseId } : { applicationId: route.applicationId, sourceResponseId: route.sourceResponseId };
    } finally { if (generation === consultingWorkspaceGeneration) panel.setAttribute('aria-busy', 'false'); }
}
async function showConsultingStudentTab(requested) {
    const data = consultingWorkspaceStudent;
    if (!data) return;
    const allowed = { overview: true, materials: Boolean(data.case && data.permissions?.materials), written: Boolean(data.case && data.permissions?.schedule), report: Boolean(data.case && data.permissions?.report), final: Boolean(data.case && data.permissions?.finalCall), service: Boolean(data.case) };
    const submitted = Boolean(data.case?.workflowState && !['ONBOARDING', 'SURVEY_DRAFT'].includes(data.case.workflowState));
    const tab = requested ? (allowed[requested] === true ? requested : 'overview') : (submitted && allowed.materials ? 'materials' : 'overview');
    document.getElementById('consultingMaterialAccess').hidden = !data.case || allowed.materials;
    document.querySelectorAll('[data-student-tab]').forEach(button => { button.disabled = !allowed[button.dataset.studentTab]; button.setAttribute('aria-current', button.dataset.studentTab === tab ? 'page' : 'false'); });
    document.querySelectorAll('[data-workspace-pane]').forEach(pane => { pane.hidden = pane.dataset.workspacePane !== tab; });
    if (consultingWorkspaceLoadedTabs.has(tab)) return;
    if (tab === 'report' && typeof loadConsultingReportSource === 'function') {
        const loaded = await loadConsultingReportSource(data.case.caseId);
        if (loaded && consultingWorkspaceStudent?.case?.caseId === data.case.caseId) consultingWorkspaceLoadedTabs.add(tab);
        return;
    }
    if (tab === 'materials') {
        const generation = consultingWorkspaceGeneration;
        const loaded = await openConsultingMaterial(data.case.caseId, data.case.serviceHold === true);
        if (loaded && generation === consultingWorkspaceGeneration) consultingWorkspaceLoadedTabs.add(tab);
        return;
    }
    consultingWorkspaceLoadedTabs.add(tab);
    if (tab === 'written' && ['SCHEDULING', 'WRITTEN_SESSION_BOOKED'].includes(data.case.workflowState)) await loadConsultingScheduleCandidates();
    else if (tab === 'written') setConsultingScheduleStatus(data.case.workflowState === 'AVAILABILITY_REQUIRED' ? '학생이 상담 가능 시간을 제출하면 일정 후보를 확인할 수 있습니다.' : '이 단계에서는 서면상담 신규 배정이 필요하지 않습니다.');
    else if (tab === 'service') await loadConsultingServiceControl();
}
async function openConsultingWorkspaceCase(item) {
    const tab = { serviceControl: 'service', schedule: 'written', finalCall: 'final', materials: 'materials' }[item.destination] || 'report';
    if (consultingWorkspaceStudent?.case?.caseId === item.caseId) return selectConsultingStudentTab(tab);
    if (tab === 'report' || tab === 'final') { window.location.assign(`/2027-jungsi-consulting/${tab === 'final' ? 'final-call' : 'report'}?caseId=${encodeURIComponent(item.caseId)}`); return; }
    await selectConsultingPhase(tab === 'service' ? 'attention' : tab === 'materials' ? 'all' : 'written');
    const status = document.getElementById('consultingDirectoryStatus');
    status.textContent += tab === 'service' ? ' 학생을 선택한 뒤 서비스 관리에서 보류·재개를 확인하세요.'
        : tab === 'materials' ? ' 학생을 선택한 뒤 조사서·성적표에서 보완과 검수 상태를 확인하세요.'
            : ' 학생을 선택한 뒤 서면상담에서 일정을 확인하세요.';
}
window.addEventListener('pagehide', resetConsultingWorkspace);
window.addEventListener('studycrack:session-ended', resetConsultingWorkspace);

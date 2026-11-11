let consultingReportSourceGeneration = 0;
let consultingReportSourceRequest = null;
let consultingReportSource = null;
let consultingReportSourceBusy = false;
let consultingReportSourceDirty = false;
const consultingReportNode = id => document.getElementById(id);
const consultingReportLabels = { safe: '보수적 지원', balanced: '균형 지원', challenge: '도전적 지원', region: '지역', major: '전공', brand: '대학 인지도', employment: '취업', commute: '통학', over_120: '2시간 이상' };
const reportFieldValue = (source, path) => path.split('.').reduce((value, key) => value?.[key], source) ?? null;
const reportTextValue = value => value === true ? '가능' : value === false ? '불가' : value == null || value === '' ? '미입력'
    : Array.isArray(value) ? value.map(reportTextValue).join(' → ') : typeof value === 'object' ? Object.values(value).map(reportTextValue).join(' · ') : consultingReportLabels[value] || String(value);
const reportKstInput = value => value && Number.isFinite(Date.parse(value)) ? new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16) : '';

function reportSourceMessage(message, state = '') { consultingWorkspaceStatus('consultingReportSourceStatus', message, state); }
function reportSourceElement(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}
function reportSourceSelect(options, selected) {
    const node = document.createElement('select');
    for (const [value, label] of options) node.append(new Option(label, value));
    node.value = String(selected ?? options[0]?.[0] ?? '');
    return node;
}
function reportSourceInput(value, max, textarea = false) {
    const node = document.createElement(textarea ? 'textarea' : 'input');
    node.value = value ?? ''; node.maxLength = max;
    if (textarea) node.rows = 2;
    return node;
}
function reportSourceLabel(text, control) {
    if (!control.matches('input,select,textarea')) {
        const group = reportSourceElement('div'); group.setAttribute('role', 'group'); group.setAttribute('aria-label', text);
        group.append(reportSourceElement('p', text), control); return group;
    }
    control.setAttribute('aria-label', text);
    const node = reportSourceElement('label', text); node.append(control); return node;
}
function reportSourceRemove(row) {
    const button = reportSourceElement('button', '항목 삭제', 'consulting-btn consulting-btn-secondary'); button.type = 'button';
    button.addEventListener('click', () => { row.remove(); markConsultingReportSourceDirty(); }); row.append(button);
}
function updateConsultingReportSourceButtons() {
    const editable = consultingReportSource?.canEdit === true && !consultingReportSourceBusy;
    consultingReportNode('consultingReportSummaryFields').disabled = !editable;
    consultingReportNode('consultingReportSaveSummary').disabled = !editable;
    consultingReportNode('consultingReportSummaryVersion').disabled = consultingReportSourceBusy;
    consultingReportNode('consultingReportFreezeSource').disabled = !editable || consultingReportSourceDirty || !consultingReportSource?.readiness?.canFreeze || !consultingReportSource?.currentSummaryRevision;
    consultingReportNode('consultingReportDirty').textContent = consultingReportSourceDirty ? '저장하지 않은 변경사항이 있습니다.' : '';
}
function markConsultingReportSourceDirty() {
    if (!consultingReportSource?.canEdit || consultingReportSourceBusy) return;
    consultingReportSourceDirty = true; updateConsultingReportSourceButtons();
}
function resetConsultingReportSource() {
    consultingReportSourceGeneration++;
    consultingReportSourceRequest?.abort(); consultingReportSourceRequest = null;
    consultingReportSource = null; consultingReportSourceBusy = false; consultingReportSourceDirty = false;
    consultingReportNode('consultingReportSummaryForm').reset();
    for (const id of ['consultingReportReadiness', 'consultingReportQuestions', 'consultingReportClarifications', 'consultingReportComparisons', 'consultingReportEvidence', 'consultingReportAppliedValues', 'consultingReportSurveyChangesBody']) consultingReportNode(id).replaceChildren();
    consultingReportNode('consultingReportSourceBody').hidden = true;
    consultingReportNode('consultingWorkspaceReport').setAttribute('aria-busy', 'false');
    consultingReportNode('consultingReportSourceNotice').textContent = '';
    consultingReportNode('consultingReportSummaryMeta').textContent = '';
    consultingReportNode('consultingReportSessionMeta').textContent = '';
    consultingReportNode('consultingReportSurveyChanges').hidden = true;
    consultingReportNode('consultingReportSummaryVersion').replaceChildren(new Option('현재 정리', ''));
    consultingReportNode('consultingStudentReport').disabled = false;
    updateConsultingReportSourceButtons(); reportSourceMessage('');
}

function renderReportSourceQuestions(data, content) {
    const body = consultingReportNode('consultingReportQuestions'); body.replaceChildren();
    for (const q of data.questions) {
        const saved = content.questions.find(row => row.id === q.id);
        const row = reportSourceElement('div', undefined, 'consulting-report-source-entry'); row.dataset.questionId = q.id;
        const answer = reportSourceInput(saved?.answer, 2500, true); answer.dataset.answer = '';
        const status = reportSourceSelect([['answered', '상담에서 답변함'], ['open', '추가 확인 필요']], saved?.status); status.dataset.answerStatus = '';
        row.append(reportSourceElement('p', q.question), reportSourceLabel('질문에 대한 답변·확인 내용', answer), reportSourceLabel('답변 상태', status)); body.append(row);
    }
    if (!data.questions.length) body.textContent = '별도로 제출한 질문이 없습니다. 상담 결론과 미해결 여부를 확인해주세요.';
}

function reportClarificationEditor(descriptor, value) {
    if (descriptor.type === 'boolean') { const node = reportSourceSelect([['false', '불가'], ['true', '가능']], String(value ?? false)); return { node, read: () => node.value === 'true' }; }
    if (descriptor.type === 'commute') { const node = reportSourceSelect([['30', '30분'], ['60', '1시간'], ['90', '1시간 30분'], ['120', '2시간'], ['over_120', '2시간 이상']], value || '90'); return { node, read: () => node.value }; }
    if (descriptor.type === 'priority') {
        const node = reportSourceElement('div', undefined, 'consulting-report-source-grid');
        const axes = ['region', 'major', 'brand', 'employment', 'commute'];
        for (let i = 0; i < axes.length; i++) {
            const select = reportSourceSelect(axes.map(axis => [axis, consultingReportLabels[axis]]), value?.[i] || axes[i]);
            select.dataset.previous = select.value;
            select.addEventListener('change', () => {
                const other = [...node.querySelectorAll('select')].find(candidate => candidate !== select && candidate.value === select.value);
                if (other) { other.value = select.dataset.previous; other.dataset.previous = other.value; }
                select.dataset.previous = select.value;
            });
            node.append(reportSourceLabel(`${i + 1}순위`, select));
        }
        return { node, read: () => [...node.querySelectorAll('select')].map(select => select.value) };
    }
    const node = reportSourceInput(value || '', descriptor.type === 'short' ? 80 : 3500, descriptor.type !== 'short'); return { node, read: () => node.value };
}

function addConsultingReportClarification(saved) {
    const data = consultingReportSource; if (!data) return;
    const body = consultingReportNode('consultingReportClarifications');
    if (body.children.length >= data.fields.length) return reportSourceMessage('추가할 수 있는 항목을 모두 확인했습니다.');
    const row = reportSourceElement('div', undefined, 'consulting-report-source-entry'); row.dataset.clarification = '';
    const field = reportSourceSelect(data.fields.map(f => [f.field, f.label]), saved?.field || data.fields.find(f => ![...body.children].some(r => r.querySelector('[data-change-field]')?.value === f.field))?.field);
    field.dataset.changeField = '';
    const original = reportSourceElement('p');
    const editor = reportSourceElement('div');
    const resolution = reportSourceSelect([['unresolved', '확인 필요'], ['survey', '조사서 답변 유지'], ['consultation', '상담에서 확인한 값 적용']], saved?.resolution); resolution.dataset.resolution = '';
    const reason = reportSourceInput(saved?.reason, 1500, true); reason.dataset.changeReason = '';
    const populate = value => {
        const descriptor = data.fields.find(f => f.field === field.value);
        original.textContent = `학생의 현재 답변 · ${reportTextValue(reportFieldValue(data.survey, field.value))}`;
        const control = reportClarificationEditor(descriptor, value ?? reportFieldValue(data.survey, field.value));
        editor.replaceChildren(reportSourceLabel('상담에서 확인한 값', control.node)); row.readValue = control.read;
    };
    field.addEventListener('change', () => { populate(); resolution.value = 'unresolved'; });
    row.append(reportSourceLabel('확인할 항목', field), original, editor, reportSourceLabel('보고서에 적용할 기준', resolution), reportSourceLabel('확인 근거·변경 이유', reason));
    reportSourceRemove(row); body.append(row); populate(saved?.value);
    if (!saved) markConsultingReportSourceDirty();
}

function addConsultingReportComparison(saved) {
    const data = consultingReportSource; if (!data) return;
    const body = consultingReportNode('consultingReportComparisons');
    if (body.children.length >= 6) return reportSourceMessage('비교 후보는 최대 6개까지 정리할 수 있습니다.');
    const row = reportSourceElement('div', undefined, 'consulting-report-source-entry'); row.dataset.comparison = '';
    const unit = reportSourceSelect([['', '직접 비교 메모'], ...data.candidates.map(c => [c.unitId, c.label])], saved?.unitId); unit.dataset.unit = '';
    const label = reportSourceInput(saved?.label, 160); label.dataset.comparisonLabel = '';
    const reason = reportSourceInput(saved?.reason, 1500, true); reason.dataset.comparisonReason = '';
    const update = () => { label.readOnly = Boolean(unit.value); if (unit.value) label.value = data.candidates.find(c => c.unitId === unit.value)?.label || ''; };
    unit.addEventListener('change', update); update();
    row.append(reportSourceLabel('분석 후보 선택', unit), reportSourceLabel('비교할 대학·학과 또는 선택', label), reportSourceLabel('비교 이유', reason));
    reportSourceRemove(row); body.append(row); if (!saved) markConsultingReportSourceDirty();
}

function renderReportSourceValues(data, content) {
    const body = consultingReportNode('consultingReportAppliedValues'); body.replaceChildren();
    const rows = content.clarifications.map(c => ({ label: data.fields.find(f => f.field === c.field)?.label || c.field, before: reportFieldValue(data.survey, c.field),
        after: c.resolution === 'consultation' ? c.value : reportFieldValue(data.survey, c.field), reason: c.resolution === 'unresolved' ? '확인 필요 · ' + c.reason : c.reason }));
    if (content.riskTolerance !== 'unconfirmed') rows.unshift({ label: '지원 성향', before: data.survey?.strategy?.riskTolerance, after: content.riskTolerance, reason: content.riskReason });
    for (const row of rows) body.append(reportSourceElement('p', `${row.label}\n조사서: ${reportTextValue(row.before)}\n보고서 적용: ${reportTextValue(row.after)}\n확인 근거: ${row.reason}`));
    if (!rows.length) body.textContent = '지원 조건·희망 지원은 현재 조사서 답변을 유지합니다. 저장한 상담 결론과 질문별 답변을 함께 참고합니다.';
}

function renderConsultingReportSource(data, revision) {
    consultingReportSource = data; consultingReportSourceDirty = false;
    const form = consultingReportNode('consultingReportSummaryForm'), content = data.summary?.content || data.emptySummary;
    form.reset();
    const values = { channel: content.meeting.channel, completedAt: reportKstInput(content.meeting.completedAt), meetingEvidence: content.meeting.evidence,
        conclusion: content.conclusion, requiredConditions: content.requiredConditions, flexibleConditions: content.flexibleConditions, riskTolerance: content.riskTolerance, riskReason: content.riskReason,
        unresolvedStatus: content.unresolved.status, unresolvedDetail: content.unresolved.detail, rationale: content.rationale, furtherChecks: content.furtherChecks, internalMemo: content.internalMemo,
        manualEvidence: content.evidenceRefs.find(ref => ref.kind === 'manual')?.reference || '' };
    for (const [name, value] of Object.entries(values)) form.elements[name].value = value;
    for (const [key, value] of Object.entries(content.planC)) form.elements['planC_' + key].value = value;
    form.elements.meetingConfirmed.checked = content.meeting.confirmed;
    if (!form.dataset.reportSourceBound) {
        form.dataset.reportSourceBound = 'true'; form.addEventListener('input', markConsultingReportSourceDirty); form.addEventListener('change', markConsultingReportSourceDirty);
    }
    const versions = consultingReportNode('consultingReportSummaryVersion'); versions.replaceChildren(new Option('현재 정리', ''));
    for (const item of data.history) versions.append(new Option(`상담 정리 ${item.revision} · ${formatConsultingDate(item.savedAt)}`, String(item.revision)));
    versions.value = revision === undefined ? '' : String(revision);
    consultingReportNode('consultingReportSummaryMeta').textContent = data.summary ? `${revision === undefined ? '저장된 현재 버전' : '이전 버전 · 읽기 전용'} ${data.summary.revision} · ${formatConsultingDate(data.summary.savedAt)}` : '아직 저장한 상담 정리가 없습니다.';
    consultingReportNode('consultingReportSessionMeta').textContent = data.consultation ? `사이트 상담 · ${data.consultation.status === 'completed' ? '완료' : '완료 확인 전'} · ${formatConsultingDate(data.consultation.endAt)}` : '연결된 사이트 상담 기록이 없습니다. 외부 상담은 실제 완료 정보와 근거가 필요합니다.';
    const readiness = consultingReportNode('consultingReportReadiness'); readiness.replaceChildren();
    for (const item of data.readiness.items) { const row = document.createElement('li'); row.dataset.ready = String(item.ready); row.append(reportSourceElement('strong', `${item.ready ? '확인됨' : '확인 필요'} · ${item.label}`), reportSourceElement('span', item.detail)); readiness.append(row); }
    const notice = consultingReportNode('consultingReportSourceNotice'); notice.dataset.state = data.sourceStatus.status;
    notice.textContent = data.sourceStatus.status === 'stale' ? `기준 고정 후 변경된 자료: ${data.sourceStatus.reasons.join(', ')}. 변경 내용을 확인하고 작성 기준을 다시 고정해주세요.`
        : data.sourceStatus.status === 'unverified' ? '입시자료의 현재 상태를 확인하지 못했습니다. 이전에 고정한 기준을 최신 자료로 간주하지 않습니다.'
            : data.frozen ? `작성 기준 ${data.frozen.revision} · ${formatConsultingDate(data.frozen.frozenAt)}에 고정했습니다. 보고서 본문 작성이나 학생 전송은 아직 시작되지 않았습니다.`
                : '상담 정리와 필수 자료를 확인한 뒤 작성 기준을 고정할 수 있습니다. 점수·컷·확률의 검수는 별도로 필요합니다.';
    const changes = consultingReportNode('consultingReportSurveyChangesBody'); changes.replaceChildren();
    for (const item of data.differences) changes.append(reportSourceElement('p', `${item.field.join(' · ')}\n상담 정리 당시: ${reportTextValue(item.before)}\n현재 답변: ${reportTextValue(item.after)}`));
    consultingReportNode('consultingReportSurveyChanges').hidden = !data.differences.length;
    renderReportSourceQuestions(data, content);
    consultingReportNode('consultingReportClarifications').replaceChildren(); for (const item of content.clarifications) addConsultingReportClarification(item);
    consultingReportNode('consultingReportComparisons').replaceChildren(); for (const item of content.comparisons) addConsultingReportComparison(item);
    const evidence = consultingReportNode('consultingReportEvidence'); evidence.replaceChildren();
    const refs = content.evidenceRefs.filter(ref => ref.kind === 'message').map(ref => ref.reference);
    const options = new Map((data.evidenceOptions || []).map(item => [item.id, item.label]));
    for (const id of refs) if (!options.has(id)) options.set(id, '이전에 연결한 상담 근거');
    for (const [id, text] of options) {
        const label = reportSourceElement('label', undefined, 'consulting-report-source-evidence'), input = document.createElement('input'); input.type = 'checkbox'; input.value = id; input.checked = refs.includes(id); input.dataset.evidenceRef = '';
        label.append(input, document.createTextNode(text)); evidence.append(label);
    }
    renderReportSourceValues(data, content);
    consultingReportNode('consultingStudentReport').disabled = Boolean(data.pipelineVersion);
    consultingReportNode('consultingReportSourceBody').hidden = false;
    updateConsultingReportSourceButtons();
}

function collectConsultingReportSummary() {
    const f = consultingReportNode('consultingReportSummaryForm'), value = name => f.elements[name].value;
    return { meeting: { channel: value('channel'), completedAt: value('completedAt') ? new Date(value('completedAt') + ':00+09:00').toISOString() : '', evidence: value('meetingEvidence'), confirmed: f.elements.meetingConfirmed.checked },
        conclusion: value('conclusion'), requiredConditions: value('requiredConditions'), flexibleConditions: value('flexibleConditions'), riskTolerance: value('riskTolerance'), riskReason: value('riskReason'),
        unresolved: { status: value('unresolvedStatus'), detail: value('unresolvedDetail') },
        questions: [...consultingReportNode('consultingReportQuestions').querySelectorAll('[data-question-id]')].map(row => ({ id: row.dataset.questionId, answer: row.querySelector('[data-answer]').value, status: row.querySelector('[data-answer-status]').value })),
        clarifications: [...consultingReportNode('consultingReportClarifications').children].map(row => ({ field: row.querySelector('[data-change-field]').value, resolution: row.querySelector('[data-resolution]').value, value: row.readValue(), reason: row.querySelector('[data-change-reason]').value })),
        comparisons: [...consultingReportNode('consultingReportComparisons').children].map(row => ({ unitId: row.querySelector('[data-unit]').value, label: row.querySelector('[data-comparison-label]').value, reason: row.querySelector('[data-comparison-reason]').value })),
        planC: Object.fromEntries(['vocational', 'medical', 'differentTrack', 'differentRegion'].map(key => [key, value('planC_' + key)])),
        rationale: value('rationale'), furtherChecks: value('furtherChecks'), internalMemo: value('internalMemo'), evidenceRefs: [
            ...(value('manualEvidence').trim() ? [{ kind: 'manual', reference: value('manualEvidence') }] : []),
            ...(consultingReportSource.summary?.content.evidenceRefs.filter(ref => ref.kind === 'manual').slice(1) || []),
            ...[...consultingReportNode('consultingReportEvidence').querySelectorAll('input:checked')].map(input => ({ kind: 'message', reference: input.value }))] };
}

async function loadConsultingReportSource(caseId, revision, successMessage = '', preserve = false) {
    const generation = ++consultingReportSourceGeneration;
    consultingReportSourceRequest?.abort(); consultingReportSourceRequest = new AbortController();
    const request = consultingReportSourceRequest;
    const panel = consultingReportNode('consultingWorkspaceReport'); panel.setAttribute('aria-busy', 'true');
    consultingReportSourceBusy = true; updateConsultingReportSourceButtons(); reportSourceMessage('보고서 작성 자료를 확인하고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_get_report_source_workspace', { caseId, ...(revision === undefined ? {} : { summaryRevision: revision }) }, request.signal);
        if (generation !== consultingReportSourceGeneration) return false;
        if (data.caseId !== caseId || !Array.isArray(data.readiness?.items) || !Array.isArray(data.questions) || !Array.isArray(data.fields) || !Array.isArray(data.history) || !data.emptySummary || !/^sha256:[a-f0-9]{64}$/.test(data.surveyDigest || '')) throw new Error('작성 자료의 응답 형식을 확인할 수 없습니다.');
        renderConsultingReportSource(data, revision); reportSourceMessage(successMessage || (data.canEdit ? '현재 자료를 확인했습니다. 상담 정리는 저장 버튼으로 반영됩니다.' : '현재 자료를 읽기 전용으로 확인하고 있습니다.'), 'success');
        return true;
    } catch (error) {
        if (generation !== consultingReportSourceGeneration) return false;
        if (!preserve) { consultingReportSource = null; consultingReportNode('consultingReportSourceBody').hidden = true; }
        else if (consultingReportSource) consultingReportSource.canEdit = false;
        reportSourceMessage((successMessage ? successMessage + ' 최신 자료를 다시 불러오지는 못했습니다. ' : '') + (error.message || '작성 자료를 불러오지 못했습니다. 최신 서버와 조회 권한을 확인한 뒤 다시 시도해주세요.'), 'error');
        return false;
    } finally {
        if (generation === consultingReportSourceGeneration) { consultingReportSourceBusy = false; panel.setAttribute('aria-busy', 'false'); updateConsultingReportSourceButtons(); }
    }
}

async function reloadConsultingReportSource() {
    const id = consultingReportNode('consultingReportCaseId').value;
    if (!id || consultingReportSourceBusy || consultingReportSourceDirty && !confirm('저장하지 않은 변경사항을 버리고 최신 자료를 불러올까요?')) return;
    return loadConsultingReportSource(id);
}
async function changeConsultingReportSummaryVersion() {
    if (consultingReportSourceBusy) return;
    const version = consultingReportNode('consultingReportSummaryVersion'), selected = version.value;
    if (consultingReportSourceDirty && !confirm('저장하지 않은 변경사항을 버리고 다른 버전을 볼까요?')) { version.value = ''; return; }
    return loadConsultingReportSource(consultingReportNode('consultingReportCaseId').value, selected ? Number(selected) : undefined);
}
async function saveConsultingReportSummary() {
    const current = consultingReportSource; if (!current?.canEdit || consultingReportSourceBusy) return;
    const generation = consultingReportSourceGeneration, summary = collectConsultingReportSummary();
    consultingReportSourceBusy = true; updateConsultingReportSourceButtons(); reportSourceMessage('상담 정리를 저장하고 있습니다.');
    try {
        const result = await requestConsultingAdmin('admin_save_report_consultation_summary', { caseId: current.caseId, expectedCaseRevision: current.caseRevision,
            expectedSummaryRevision: current.currentSummaryRevision, expectedSurveyDigest: current.surveyDigest, summary });
        if (generation !== consultingReportSourceGeneration) return;
        consultingReportSourceDirty = false;
        const message = result.unchanged ? `내용이 같아 기존 상담 정리를 유지했습니다. (버전 ${result.revision})` : `상담 정리를 저장했습니다. (버전 ${result.revision})`;
        await loadConsultingReportSource(current.caseId, undefined, message, true);
    } catch (error) { if (generation === consultingReportSourceGeneration) reportSourceMessage((error.status === 409 ? '다른 화면이나 원자료가 변경되었습니다. 입력은 보존했습니다. 최신 자료를 확인해주세요. ' : '') + (error.message || '저장하지 못했습니다. 입력을 확인해주세요.'), 'error'); }
    finally { if (generation === consultingReportSourceGeneration) { consultingReportSourceBusy = false; updateConsultingReportSourceButtons(); } }
}
async function freezeConsultingReportSource() {
    const current = consultingReportSource; if (!current?.canEdit || consultingReportSourceBusy || consultingReportSourceDirty || !current.readiness.canFreeze) return;
    if (!confirm('저장한 상담 정리와 현재 자료를 새 보고서의 작성 기준으로 고정할까요? 이후에는 기존 1인 승인 방식으로 공개할 수 없습니다. 보고서 작성·학생 전송은 아직 시작되지 않습니다.')) return;
    const generation = consultingReportSourceGeneration; consultingReportSourceBusy = true; updateConsultingReportSourceButtons(); reportSourceMessage('작성 기준을 고정하고 있습니다.');
    try {
        const result = await requestConsultingAdmin('admin_freeze_report_source', { caseId: current.caseId, expectedCaseRevision: current.caseRevision,
            expectedSummaryRevision: current.currentSummaryRevision, expectedSourceDigest: current.sourceDigest, confirmed: true });
        if (generation !== consultingReportSourceGeneration) return;
        consultingReportNode('consultingStudentReport').disabled = true;
        await loadConsultingReportSource(current.caseId, undefined, `작성 기준 ${result.frozen.revision}을 확인했습니다.`, true);
    } catch (error) { if (generation === consultingReportSourceGeneration) reportSourceMessage(error.message || '작성 기준을 고정하지 못했습니다. 최신 자료를 확인해주세요.', 'error'); }
    finally { if (generation === consultingReportSourceGeneration) { consultingReportSourceBusy = false; updateConsultingReportSourceButtons(); } }
}
window.addEventListener('studycrack:session-ended', resetConsultingReportSource);
window.addEventListener('pagehide', resetConsultingReportSource);

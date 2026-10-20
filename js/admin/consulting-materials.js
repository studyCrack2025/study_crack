let currentConsultingMaterial = null;
let consultingMaterialRequest = 0;

function setConsultingMaterialStatus(message, state = '') {
    const target = document.getElementById('consultingMaterialStatus');
    if (!target) return;
    target.textContent = message;
    target.dataset.state = state;
}

function renderConsultingMaterialReview(items) {
    const body = document.getElementById('consultingMaterialReviewBody');
    if (!body) return;
    body.innerHTML = '';
    if (!items.length) {
        const row = document.createElement('tr');
        const cell = createConsultingCell('현재 자료 검수 대기 건이 없습니다.');
        cell.colSpan = 5;
        cell.className = 'empty-msg';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    items.forEach(item => {
        const row = document.createElement('tr');
        row.appendChild(createConsultingCell(formatConsultingDate(item.updatedAt)));
        row.appendChild(createConsultingCell(item.caseId));
        row.appendChild(createConsultingCell(item.workflowState === 'SUPPLEMENT_REQUIRED' ? '보완 요청' : '자료 검수'));
        row.appendChild(createConsultingCell(item.scoreVerificationStatus));
        const action = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'consulting-btn consulting-btn-secondary';
        button.textContent = '자료 확인';
        button.addEventListener('click', () => openConsultingMaterial(item.caseId));
        action.appendChild(button);
        row.appendChild(action);
        body.appendChild(row);
    });
}

async function loadConsultingMaterialReview() {
    const requestId = ++consultingMaterialRequest;
    setConsultingMaterialStatus('자료 검수 대기 건을 불러오는 중입니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_list_v2_material_review', { limit: 100 });
        if (requestId !== consultingMaterialRequest) return;
        if (!Array.isArray(data.items)) throw new Error('자료 검수 목록 형식이 올바르지 않습니다.');
        renderConsultingMaterialReview(data.items);
        setConsultingMaterialStatus(`자료 검수 대기 ${data.items.length}건`, 'success');
    } catch (error) {
        if (requestId !== consultingMaterialRequest) return;
        renderConsultingMaterialReview([]);
        setConsultingMaterialStatus(error.message || '자료 검수 목록을 불러오지 못했습니다.', 'error');
    }
}

function appendConsultingMaterialValue(container, label, value) {
    const block = document.createElement('div');
    const term = document.createElement('strong');
    const content = document.createElement('span');
    term.textContent = label;
    content.textContent = String(value ?? '-');
    block.append(term, content);
    container.appendChild(block);
}

function renderConsultingVerifiedScores(scores) {
    const target = document.getElementById('consultingVerifiedScores');
    target.innerHTML = '';
    const meta = document.createElement('div');
    meta.className = 'consulting-score-editor-row';
    meta.dataset.examYear = String(scores?.examYear || '');
    meta.dataset.examType = String(scores?.examType || '');
    (scores?.records || []).forEach(record => {
        const row = document.createElement('div');
        row.className = 'consulting-score-editor-row';
        row.dataset.area = String(record.area || '');
        ['subject', 'selection', 'standardScore', 'percentile', 'grade'].forEach(field => {
            const input = document.createElement('input');
            input.dataset.field = field;
            input.type = ['standardScore', 'percentile', 'grade'].includes(field) ? 'number' : 'text';
            input.value = record[field] ?? '';
            input.placeholder = ({ subject: '과목', selection: '선택과목', standardScore: '표준', percentile: '백분위', grade: '등급' })[field];
            row.appendChild(input);
        });
        target.appendChild(row);
    });
    target.dataset.examYear = meta.dataset.examYear;
    target.dataset.examType = meta.dataset.examType;
}

function renderConsultingMaterialFiles(caseId, files) {
    const target = document.getElementById('consultingMaterialFiles');
    target.innerHTML = '';
    files.forEach(file => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${file.displayName || file.fileId} (${file.status})`;
        button.disabled = !['ready', 'linked'].includes(file.status);
        button.addEventListener('click', () => openConsultingMaterialFile(caseId, file.fileId));
        target.appendChild(button);
    });
    if (!files.length) target.textContent = '등록된 파일이 없습니다.';
}

async function openConsultingMaterial(caseId) {
    setConsultingMaterialStatus('제출 자료를 불러오는 중입니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_get_v2_material_detail', { caseId });
        currentConsultingMaterial = data;
        const summary = document.getElementById('consultingMaterialSummary');
        summary.innerHTML = '';
        appendConsultingMaterialValue(summary, '케이스', data.case.caseId);
        appendConsultingMaterialValue(summary, '단계', data.case.workflowState);
        appendConsultingMaterialValue(summary, '검수 상태', data.case.scoreVerificationStatus);
        appendConsultingMaterialValue(summary, '보완 횟수', data.case.supplementAttempt);
        const snapshot = data.submission?.snapshot || data.originalSubmission?.snapshot || {};
        const survey = document.getElementById('consultingMaterialSurvey');
        survey.innerHTML = '';
        [
            ['희망 지역', (snapshot.preferences?.desiredRegions || []).join(', ')],
            ['희망 대학', (snapshot.preferences?.desiredUniversities || []).join(', ')],
            ['희망 학과·계열', [...(snapshot.preferences?.desiredMajors || []), ...(snapshot.preferences?.desiredTracks || [])].join(', ')],
            ['필수 후보', (snapshot.preferences?.requiredCandidates || []).join(', ')],
            ['제외 후보', (snapshot.preferences?.excludedCandidates || []).join(', ')],
            ['고민', snapshot.qualitative?.concerns],
            ['상담 질문', (snapshot.qualitative?.consultationQuestions || []).join('\n')]
        ].forEach(([label, value]) => {
            const item = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = `${label}: `;
            item.append(strong, document.createTextNode(String(value || '-')));
            survey.appendChild(item);
        });
        renderConsultingMaterialFiles(caseId, data.files || []);
        renderConsultingVerifiedScores(data.verification?.studentInput || snapshot.scores);
        document.getElementById('consultingMaterialReason').value = '';
        document.getElementById('consultingMaterialDifferences').value = '';
        document.getElementById('consultingSupplementText').value = '';
        document.getElementById('consultingMaterialDetail').hidden = false;
        setConsultingMaterialStatus('제출 자료를 불러왔습니다.', 'success');
    } catch (error) {
        setConsultingMaterialStatus(error.message || '제출 자료를 불러오지 못했습니다.', 'error');
    }
}

function closeConsultingMaterialDetail() {
    currentConsultingMaterial = null;
    document.getElementById('consultingMaterialDetail').hidden = true;
}

async function openConsultingMaterialFile(caseId, fileId) {
    try {
        const response = await apiFetch(CONFIG.api.file, { method: 'POST', body: JSON.stringify({ type: 'consulting_get_score_download_url', data: { caseId, fileId } }) });
        const payload = await response.json();
        const url = payload?.success === true ? payload.data?.downloadUrl : '';
        if (!response.ok || typeof url !== 'string' || !url.startsWith('https://')) throw new Error('파일을 열 수 없습니다.');
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
    } catch (error) {
        setConsultingMaterialStatus(error.message || '파일을 열지 못했습니다.', 'error');
    }
}

function readConsultingVerifiedScores() {
    const target = document.getElementById('consultingVerifiedScores');
    const number = input => input.value === '' ? null : Number(input.value);
    return {
        examYear: Number(target.dataset.examYear),
        examType: target.dataset.examType,
        records: [...target.querySelectorAll('.consulting-score-editor-row')].map(row => ({
            area: row.dataset.area,
            subject: row.querySelector('[data-field="subject"]').value,
            selection: row.querySelector('[data-field="selection"]').value,
            standardScore: number(row.querySelector('[data-field="standardScore"]')),
            percentile: number(row.querySelector('[data-field="percentile"]')),
            grade: number(row.querySelector('[data-field="grade"]'))
        }))
    };
}

async function verifyConsultingMaterials() {
    const current = currentConsultingMaterial?.case;
    const reason = document.getElementById('consultingMaterialReason').value.trim();
    if (!current || !reason || !confirm('자료 검수를 완료하고 학생에게 상담 가능 시간 입력 단계를 여시겠습니까?')) return;
    const button = document.getElementById('consultingMaterialVerifyBtn');
    button.disabled = true;
    try {
        await requestConsultingAdmin('admin_verify_v2_materials', { caseId: current.caseId, result: document.getElementById('consultingMaterialResult').value, reason, differences: document.getElementById('consultingMaterialDifferences').value.split('\n').map(value => value.trim()).filter(Boolean), verifiedInput: readConsultingVerifiedScores() });
        closeConsultingMaterialDetail();
        await loadConsultingMaterialReview();
        setConsultingMaterialStatus('자료 검수를 완료했습니다.', 'success');
    } catch (error) {
        setConsultingMaterialStatus(error.message || '자료 검수를 완료하지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

async function requestConsultingSupplement() {
    const current = currentConsultingMaterial?.case;
    const reasonText = document.getElementById('consultingSupplementText').value.trim();
    if (!current || !reasonText || !confirm('학생에게 보완 요청을 보내시겠습니까?')) return;
    const button = document.getElementById('consultingSupplementBtn');
    button.disabled = true;
    try {
        await requestConsultingAdmin('admin_request_v2_supplement', { caseId: current.caseId, reasonCode: document.getElementById('consultingSupplementReason').value, reasonText });
        closeConsultingMaterialDetail();
        await loadConsultingMaterialReview();
        setConsultingMaterialStatus('학생에게 자료 보완을 요청했습니다.', 'success');
    } catch (error) {
        setConsultingMaterialStatus(error.message || '보완 요청을 처리하지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

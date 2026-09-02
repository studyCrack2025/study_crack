let currentConsultingCaseId = '';
let currentConsultingReview = null;

function consultingEscape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function consultingAdminRequest(type, data = {}, url = CONFIG.api.consulting) {
    const response = await apiFetch(url, { method: 'POST', body: JSON.stringify({ type, data }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new Error(body.error || body.message || '요청을 처리하지 못했습니다.');
    return body.data || body;
}

function consultingWorkflowLabel(state) {
    const labels = { MATERIAL_REVIEW: '검수 대기', SUPPLEMENT_REQUIRED: '보완 요청', ROUND1_EDIT_OPEN: '1차안 작성' };
    return labels[state] || state || '-';
}

async function loadConsultingMaterialQueue() {
    const container = document.getElementById('consultingCaseQueue');
    if (!container) return;
    container.innerHTML = '<p class="empty-msg">검수 목록을 불러오는 중...</p>';
    try {
        const data = await consultingAdminRequest('admin_list_consulting_cases', { limit: 100 });
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
            container.innerHTML = '<p class="empty-msg">검수 대기 케이스가 없습니다.</p>';
            return;
        }
        container.innerHTML = items.map((item) => `<button type="button" class="consulting-case-button ${item.caseId === currentConsultingCaseId ? 'active' : ''}" data-case-id="${consultingEscape(item.caseId)}" onclick="openConsultingMaterialCase(this.dataset.caseId)"><b>${consultingEscape(item.caseId)}</b><span>${consultingEscape(consultingWorkflowLabel(item.workflowState))} · ${consultingEscape(item.updatedAt || '-')}</span></button>`).join('');
    } catch (error) {
        container.innerHTML = `<p class="empty-msg">${consultingEscape(error.message)}</p>`;
    }
}

function renderConsultingMaterialCase(data) {
    const container = document.getElementById('consultingCaseDetail');
    const profile = data.profile || data.originalProfile || {};
    const snapshot = profile.snapshot || {};
    const scores = snapshot.scores || {};
    const records = Array.isArray(scores.records) ? scores.records : [];
    const targets = Array.isArray(snapshot.preferences?.targets) ? snapshot.preferences.targets : [];
    const files = Array.isArray(data.files) ? data.files : [];
    const scoreRows = records.map((record, index) => `<tr data-score-index="${index}" data-area="${consultingEscape(record.area)}"><td><input class="consulting-verified-subject" value="${consultingEscape(record.subject)}" aria-label="과목"></td><td><input class="consulting-verified-standard" type="number" value="${consultingEscape(record.standardScore ?? '')}" aria-label="표준점수"></td><td><input class="consulting-verified-percentile" type="number" value="${consultingEscape(record.percentile ?? '')}" aria-label="백분위"></td><td><input class="consulting-verified-grade" type="number" min="1" max="9" value="${consultingEscape(record.grade ?? '')}" aria-label="등급"></td></tr>`).join('');
    const fileRows = files.length ? files.map((file) => `<div class="consulting-admin-file"><div><b>${consultingEscape(file.displayName)}</b><span>${consultingEscape(file.status)} · ${Number(file.size || 0).toLocaleString()} bytes</span></div>${['ready', 'linked'].includes(file.status) ? `<button type="button" data-file-id="${consultingEscape(file.fileId)}" onclick="downloadConsultingScoreFile(this.dataset.fileId)">열기</button>` : '<span>다운로드 불가</span>'}</div>`).join('') : '<p class="empty-msg">첨부 파일이 없습니다.</p>';
    container.innerHTML = `<div class="consulting-detail-head"><div><h2>${consultingEscape(data.case?.caseId)}</h2><p>조사서 ${consultingEscape(profile.versionId || '-')} · ${consultingEscape(profile.submittedAt || '-')}</p></div><span class="consulting-status-badge">${consultingEscape(consultingWorkflowLabel(data.case?.workflowState))}</span></div><section class="consulting-review-block"><h3>지원자 및 지원 희망</h3><table class="consulting-review-table"><tbody><tr><th>지원자 구분</th><td>${consultingEscape(snapshot.identity?.applicantType || '-')}</td><th>거주 지역</th><td>${consultingEscape(snapshot.identity?.residenceRegion || '-')}</td></tr><tr><th>희망 지원</th><td colspan="3">${targets.length ? targets.map((target) => `${consultingEscape(target.university)} ${consultingEscape(target.major)}`).join(', ') : '-'}</td></tr></tbody></table></section><section class="consulting-review-block"><h3>입력 성적과 검수 성적</h3><div class="consulting-field-grid"><label>시험 연도<input id="consultingVerifiedExamYear" type="number" value="${consultingEscape(scores.examYear ?? '')}"></label><label>시험 종류<input id="consultingVerifiedExamType" value="${consultingEscape(scores.examType || '')}"></label></div><table class="consulting-review-table"><thead><tr><th>과목</th><th>표준점수</th><th>백분위</th><th>등급</th></tr></thead><tbody id="consultingVerifiedScoreRows">${scoreRows}</tbody></table></section><section class="consulting-review-block"><h3>성적표 파일</h3><div class="consulting-admin-files">${fileRows}</div></section><section class="consulting-review-block"><h3>검수 처리</h3><div class="consulting-review-form"><select id="consultingSupplementCode"><option value="SCORE_INPUT_MISMATCH">입력 성적 불일치</option><option value="SCORE_DOCUMENT_UNREADABLE">성적표 식별 불가</option><option value="MISSING_SCORE_PAGE">필수 페이지 누락</option><option value="OTHER">기타</option></select><input id="consultingReviewReason" maxlength="500" placeholder="처리 사유를 입력하세요"><textarea id="consultingReviewDifferences" maxlength="1000" placeholder="수정 또는 불일치 항목을 줄 단위로 입력하세요"></textarea><div class="consulting-review-actions"><button type="button" onclick="verifyConsultingScores('matched')">일치 확인</button><button type="button" class="warning" onclick="verifyConsultingScores('corrected')">수정 후 확인</button><button type="button" class="danger" onclick="verifyConsultingScores('mismatch')">불일치 기록</button><button type="button" class="warning" onclick="requestConsultingSupplement()">학생에게 보완 요청</button></div></div></section>`;
}

async function openConsultingMaterialCase(caseId) {
    currentConsultingCaseId = String(caseId || '');
    const container = document.getElementById('consultingCaseDetail');
    container.innerHTML = '<p class="empty-msg">케이스 자료를 불러오는 중...</p>';
    try {
        currentConsultingReview = await consultingAdminRequest('admin_get_case_tab', { caseId: currentConsultingCaseId });
        renderConsultingMaterialCase(currentConsultingReview);
        document.querySelectorAll('.consulting-case-button').forEach((button) => button.classList.toggle('active', button.dataset.caseId === currentConsultingCaseId));
    } catch (error) {
        container.innerHTML = `<p class="empty-msg">${consultingEscape(error.message)}</p>`;
    }
}

function collectConsultingVerifiedInput() {
    const records = Array.from(document.querySelectorAll('#consultingVerifiedScoreRows tr')).map((row) => ({
        area: row.dataset.area,
        subject: row.querySelector('.consulting-verified-subject').value.trim(),
        standardScore: row.querySelector('.consulting-verified-standard').value,
        percentile: row.querySelector('.consulting-verified-percentile').value,
        grade: row.querySelector('.consulting-verified-grade').value
    }));
    return { examYear: document.getElementById('consultingVerifiedExamYear').value, examType: document.getElementById('consultingVerifiedExamType').value.trim(), records };
}

async function verifyConsultingScores(result) {
    if (!currentConsultingCaseId) return;
    const reason = document.getElementById('consultingReviewReason').value.trim();
    const differences = document.getElementById('consultingReviewDifferences').value.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!reason) return alert('처리 사유를 입력해주세요.');
    try {
        await consultingAdminRequest('admin_verify_score', { caseId: currentConsultingCaseId, result, reason, differences, verifiedInput: result === 'mismatch' ? null : collectConsultingVerifiedInput() });
        alert(result === 'mismatch' ? '불일치 상태로 기록했습니다.' : '성적 검수를 완료했습니다.');
        currentConsultingCaseId = '';
        currentConsultingReview = null;
        document.getElementById('consultingCaseDetail').innerHTML = '<p class="empty-msg">검수 처리가 완료되었습니다.</p>';
        await loadConsultingMaterialQueue();
    } catch (error) {
        alert(error.message);
    }
}

async function requestConsultingSupplement() {
    if (!currentConsultingCaseId) return;
    const reasonCode = document.getElementById('consultingSupplementCode').value;
    const reasonText = document.getElementById('consultingReviewReason').value.trim();
    if (!reasonText) return alert('학생에게 전달할 보완 사유를 입력해주세요.');
    try {
        await consultingAdminRequest('admin_request_supplement', { caseId: currentConsultingCaseId, reasonCode, reasonText });
        alert('보완 요청을 등록했습니다.');
        await openConsultingMaterialCase(currentConsultingCaseId);
        await loadConsultingMaterialQueue();
    } catch (error) {
        alert(error.message);
    }
}

async function downloadConsultingScoreFile(fileId) {
    if (!currentConsultingCaseId || !fileId) return;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
        const data = await consultingAdminRequest('consulting_get_score_download_url', { caseId: currentConsultingCaseId, fileId }, CONFIG.api.file);
        const url = new URL(data.downloadUrl);
        if (url.protocol !== 'https:') throw new Error('안전한 다운로드 주소가 아닙니다.');
        if (popup) popup.location.replace(url.href);
        else window.location.assign(url.href);
    } catch (error) {
        if (popup) popup.close();
        alert(error.message);
    }
}

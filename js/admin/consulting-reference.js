let consultingReferenceState = null;
let consultingReferenceGeneration = 0;
let consultingReferenceRequest = null;

function resetConsultingReference() {
    consultingReferenceGeneration++;
    consultingReferenceRequest?.abort(); consultingReferenceRequest = null;
    consultingReferenceState = null;
    const panel = document.getElementById('consultingReferenceExperiment');
    if (!panel) return;
    panel.hidden = true; panel.open = false;
    for (const id of ['consultingReferenceForm', 'consultingReferenceResults']) document.getElementById(id).hidden = true;
    for (const id of ['consultingReferenceScores', 'consultingReferencePlans', 'consultingReferenceCandidates', 'consultingReferenceOverrides', 'consultingReferenceExcluded']) document.getElementById(id).replaceChildren();
    consultingWorkspaceStatus('consultingReferenceStatus', '');
}
function prepareConsultingReference(caseId) {
    resetConsultingReference();
    consultingReferenceState = { caseId, catalog: null, groups: new Map(), result: null, page: 0 };
    document.getElementById('consultingReferenceExperiment').hidden = false;
}
function referenceNode(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
}
function referenceSelect(options, label, value = '') {
    const select = document.createElement('select'); select.setAttribute('aria-label', label);
    for (const [key, text] of options) { const option = document.createElement('option'); option.value = key; option.textContent = text; select.appendChild(option); }
    select.value = value;
    return select;
}
function invalidateConsultingReference() {
    if (!consultingReferenceState) return;
    const previous = Boolean(consultingReferenceState.result || consultingReferenceRequest);
    consultingReferenceGeneration++; consultingReferenceRequest?.abort(); consultingReferenceRequest = null;
    consultingReferenceState.result = null; consultingReferenceState.page = 0;
    document.getElementById('consultingReferenceResults').hidden = true;
    document.getElementById('consultingReferenceRun').disabled = !consultingReferenceState.catalog;
    document.getElementById('consultingReferenceForm').setAttribute('aria-busy', 'false');
    if (previous) consultingWorkspaceStatus('consultingReferenceStatus', '입력값이 변경되었습니다. 추천 실험을 다시 실행해주세요.');
}
function referenceGradeOptions() { return [['', '등급 선택'], ...Array.from({ length: 9 }, (_, index) => [String(index + 1), `${index + 1}등급`])]; }
function referenceFillMetrics(key) {
    const state = consultingReferenceState, row = document.querySelector(`[data-reference-score="${key}"]`);
    if (!state?.catalog || !row) return;
    const standard = row.querySelector('[data-metric="std"]');
    const name = row.querySelector('[data-option]').value;
    const subject = key === 'kor' ? '국어' : key === 'math' ? `수학(${name === '미적' ? '미적분' : name})` : name;
    const board = state.catalog.scoreRows.find(area => area.subject === subject);
    const values = standard.value === '' ? null : board?.rows.find(item => item[0] === Number(standard.value));
    row.querySelector('[data-metric="pct"]').value = values ? values[1] : '';
    row.querySelector('[data-metric="grd"]').value = values ? String(values[2]) : '';
}
function renderReferenceScoreInputs(catalog) {
    const container = document.getElementById('consultingReferenceScores'); container.replaceChildren();
    const initial = catalog.initialRecords || [];
    for (const [key, title, area] of [['kor', '국어', 'korean'], ['math', '수학', 'math'], ['inq1', '탐구 1', 'inquiry'], ['inq2', '탐구 2', 'inquiry'], ['eng', '영어', 'english'], ['hist', '한국사', 'korean_history'], ['foreign', '제2외국어·한문', 'foreign_language']]) {
        const fieldset = referenceNode('fieldset', null, 'consulting-reference-score'); fieldset.dataset.referenceScore = key;
        fieldset.appendChild(referenceNode('legend', title));
        const records = initial.filter(row => row.area === area), prior = records[key === 'inq2' ? 1 : 0];
        if (['kor', 'math', 'inq1', 'inq2', 'foreign'].includes(key)) {
            const values = key === 'kor' ? [['화작', '화법과 작문'], ['언매', '언어와 매체']] : key === 'math' ? [['확통', '확률과 통계'], ['미적', '미적분'], ['기하', '기하']] : key === 'foreign' ? [['', '응시하지 않음'], ...['독일어Ⅰ', '프랑스어Ⅰ', '스페인어Ⅰ', '중국어Ⅰ', '일본어Ⅰ', '러시아어Ⅰ', '아랍어Ⅰ', '베트남어Ⅰ', '한문Ⅰ'].map(x => [x, x])] : [['', '과목 선택'], ...catalog.inquiries.map(x => [x, x])];
            const selection = (prior?.selection || '').normalize('NFKC').replace(/\s/g, '');
            const subject = (prior?.subject || '').replace(/\s/g, '');
            const normalized = key === 'kor' ? { 화법과작문: '화작', 언어와매체: '언매', 화작: '화작', 언매: '언매' }[selection] : key === 'math' ? { 확률과통계: '확통', 미적분: '미적', 기하: '기하', 확통: '확통', 미적: '미적' }[selection] : key === 'foreign' ? subject : subject.normalize('NFKC').replace(/II/g, '2').replace(/I/g, '1');
            const select = referenceSelect(values, `${title} 선택과목`, normalized || (key === 'kor' ? '화작' : key === 'math' ? '확통' : ''));
            select.dataset.option = ''; select.required = key !== 'foreign';
            select.addEventListener('change', () => { invalidateConsultingReference(); if (key !== 'foreign') referenceFillMetrics(key); else fieldset.querySelector('[data-metric="grd"]').required = Boolean(select.value); }); fieldset.appendChild(select);
        }
        const grid = referenceNode('div', null, 'consulting-reference-metrics');
        const metrics = ['kor', 'math', 'inq1', 'inq2'].includes(key) ? [['std', '표준점수', 0, key.startsWith('inq') ? 100 : 200], ['pct', '백분위', 0, 100], ['grd', '등급', 1, 9]] : [['grd', '등급', 1, 9]];
        for (const [metric, title, min, max] of metrics) {
            const label = referenceNode('label', title);
            const input = metric === 'grd' ? referenceSelect(referenceGradeOptions(), `${fieldset.querySelector('legend').textContent} ${title}`, prior?.grade ? String(prior.grade) : '') : document.createElement('input');
            if (metric !== 'grd') { input.type = 'number'; input.min = min; input.max = max; input.step = '1'; input.inputMode = 'numeric'; input.setAttribute('aria-label', `${fieldset.querySelector('legend').textContent} ${title}`); const value = prior?.[metric === 'std' ? 'standardScore' : 'percentile']; if (value != null) input.value = value; }
            input.required = key !== 'foreign'; input.dataset.metric = metric;
            input.addEventListener(metric === 'grd' ? 'change' : 'input', () => { invalidateConsultingReference(); if (metric === 'std') referenceFillMetrics(key); });
            label.appendChild(input); grid.appendChild(label);
        }
        fieldset.appendChild(grid); container.appendChild(fieldset);
    }
    const streams = document.getElementById('consultingReferenceStream'); streams.replaceChildren();
    for (const [value, label] of [['', '전체 계열'], ...catalog.streams.map(x => [x, x])]) { const option = referenceNode('option', label); option.value = value; streams.appendChild(option); }
    streams.value = catalog.initialStream || '';
    const choices = document.getElementById('consultingReferenceUniversities'); choices.replaceChildren();
    for (let index = 0; index < 3; index++) {
        const label = referenceNode('label', `${index + 1}지망 대학`);
        const select = referenceSelect([['', '지정하지 않음'], ...catalog.universities.map(x => [x, x])], `${index + 1}지망 대학`, catalog.initialUniversities?.[index] || '');
        select.dataset.referenceUniversity = ''; select.addEventListener('change', invalidateConsultingReference); label.appendChild(select); choices.appendChild(label);
    }
    document.getElementById('consultingReferenceRisk').value = catalog.risk || 'balanced';
}
async function openConsultingReference(open, reload = false) {
    const state = consultingReferenceState;
    if (!open || !state || state.catalog && !reload) return;
    const generation = ++consultingReferenceGeneration;
    consultingReferenceRequest?.abort(); const request = new AbortController(); consultingReferenceRequest = request;
    document.getElementById('consultingReferenceForm').hidden = true;
    document.getElementById('consultingReferenceResults').hidden = true;
    consultingWorkspaceStatus('consultingReferenceStatus', '보유 참고자료와 학생의 조사서 기준을 불러오고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_get_reference_experiment', { caseId: state.caseId }, request.signal);
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        if (data.caseId !== state.caseId || data.contractVersion !== 'consulting-local-reference-v1' || !Array.isArray(data.scoreRows) || !Array.isArray(data.inquiries)) throw new Error('Invalid reference catalog');
        state.catalog = data; state.groups.clear(); state.result = null; state.page = 0;
        renderReferenceScoreInputs(data); renderReferenceOverrides();
        document.getElementById('consultingReferenceForm').hidden = false;
        document.getElementById('consultingReferenceRun').disabled = false;
        document.getElementById('consultingReferenceQuery').value = '';
        document.getElementById('consultingReferenceNotice').textContent = data.warning;
        document.getElementById('consultingReferenceBasis').textContent = `${data.totalPrograms.toLocaleString('ko-KR')}개 학과 · ${data.automaticGroupReferences.toLocaleString('ko-KR')}개 모집군 참고 연결 · ${data.hasSubmittedSurvey ? `조사서 수정 ${data.surveyRevision}회` : '제출 전 수동 실험'}`;
        consultingWorkspaceStatus('consultingReferenceStatus', '표준점수를 입력하면 2026 참고표의 백분위·등급을 채웁니다. 직접 수정할 수 있으며 원점수는 사용하지 않습니다.');
    } catch (error) {
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        state.catalog = null;
        consultingWorkspaceStatus('consultingReferenceStatus', error.status === 403 ? '추천 실험은 개발 환경의 관리자 계정에서 이용할 수 있습니다.' : '참고자료를 불러오지 못했습니다. 자료 다시 불러오기를 눌러 재시도해주세요.', 'error');
    } finally { if (generation === consultingReferenceGeneration) consultingReferenceRequest = null; }
}
function referenceInput(state, page = 0) {
    const scores = {};
    for (const key of ['kor', 'math', 'inq1', 'inq2', 'eng', 'hist', 'foreign']) {
        const row = document.querySelector(`[data-reference-score="${key}"]`), option = row.querySelector('[data-option]')?.value;
        if (key === 'foreign' && !option) { scores.foreign = null; continue; }
        scores[key] = {};
        if (option) scores[key][key.startsWith('inq') || key === 'foreign' ? 'name' : 'opt'] = option;
        for (const input of row.querySelectorAll('[data-metric]')) scores[key][input.dataset.metric] = input.value === '' ? null : Number(input.value);
    }
    return { scores, stream: document.getElementById('consultingReferenceStream').value, risk: document.getElementById('consultingReferenceRisk').value,
        universities: [...document.querySelectorAll('[data-reference-university]')].map(x => x.value).filter(Boolean), groupOverrides: [...state.groups].map(([candidateId, value]) => ({ candidateId, group: value.group })), query: document.getElementById('consultingReferenceQuery').value, page };
}
function referenceNumber(value) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value) : '—'; }
function referenceGroupLabel(item) { return item.groupBasis === 'admin_experiment' ? `${item.group}군 · 관리자 실험 지정` : item.group ? `${item.group}군 · 2026 참고${item.groupEvidence?.[0]?.page ? ` ${item.groupEvidence[0].page}쪽` : ''}` : '군 확인 필요'; }
function renderReferenceOverrides() {
    const state = consultingReferenceState, node = document.getElementById('consultingReferenceOverrides'); node.replaceChildren();
    if (!state?.groups.size) return;
    node.appendChild(referenceNode('p', '직접 지정한 군은 실험에만 적용됩니다.'));
    for (const [id, value] of state.groups) {
        const button = referenceNode('button', `${value.label} · ${value.group}군 지정 해제`, 'consulting-btn consulting-btn-secondary'); button.type = 'button';
        button.addEventListener('click', () => { state.groups.delete(id); invalidateConsultingReference(); renderReferenceOverrides(); }); node.appendChild(button);
    }
}
function renderReferenceResults(data) {
    const target = document.getElementById('consultingReferencePlans'); target.replaceChildren();
    for (const key of ['A', 'B']) {
        const section = referenceNode('section', null, 'consulting-reference-plan'); section.setAttribute('aria-label', `${key}안 추천`);
        section.append(referenceNode('h4', `${key}안 · ${key === 'A' ? '희망·지원 성향 우선' : '다른 후보와 여유 비교'}`));
        const grid = referenceNode('div', null, 'consulting-reference-cards');
        for (const slot of data.plans[key]) {
            const card = referenceNode('article', null, 'consulting-reference-card'), candidate = slot.candidate;
            card.append(referenceNode('p', `${slot.group}군`, 'consulting-reference-eyebrow'));
            if (candidate) {
                card.append(referenceNode('h5', candidate.university), referenceNode('p', candidate.program, 'consulting-reference-program'), referenceNode('strong', `${candidate.band} · 컷 대비 참고 분류`, 'consulting-reference-band'));
                card.appendChild(createConsultingFacts([['실험 환산점수', referenceNumber(candidate.score)], ['기존 합격권 추정컷', referenceNumber(candidate.passCut)], ['기존 70% 추정컷', referenceNumber(candidate.top70Cut)], ['합격권컷과 차이', referenceNumber(candidate.margin)]]));
                card.appendChild(referenceNode('p', referenceGroupLabel(candidate), 'consulting-caption'));
            } else card.appendChild(referenceNode('h5', '조건에 맞는 후보 없음'));
            card.appendChild(referenceNode('p', slot.reason, 'consulting-caption')); grid.appendChild(card);
        }
        section.appendChild(grid); target.appendChild(section);
    }
    const stats = data.stats;
    document.getElementById('consultingReferenceStats').textContent = `전체 ${stats.total.toLocaleString('ko-KR')}개 평가 · 계산 ${stats.calculated.toLocaleString('ko-KR')}개 · 제외 ${stats.excluded.toLocaleString('ko-KR')}개 · 군 확인 필요 ${stats.groupPending.toLocaleString('ko-KR')}개 · A/B가 다른 군 ${data.plans.distinctGroups}개`;
    const excluded = document.getElementById('consultingReferenceExcluded'); excluded.replaceChildren();
    const titles = { ADMISSION_FORMULA_REVIEW_REQUIRED: '환산식 검수 대기', SUBJECT_REQUIREMENTS_NOT_MET: '선택과목 조건 불충족', STREAM_NOT_CONFIRMED: '선택 계열과 일치 확인 안 됨', CUT_SCALE_UNAVAILABLE: '추정컷 비교 기준 확인 필요', FORMULA_REQUIREMENTS_UNSUPPORTED: '지원 조건 해석 확인 필요', ELIGIBILITY_RULE_UNSUPPORTED: '지원 조건 해석 확인 필요', EXACT_FORMULA_UNAVAILABLE: '정확한 환산식 연결 없음' };
    for (const [code, count] of Object.entries(stats.excludedByReason)) excluded.appendChild(referenceNode('li', `${titles[code] || '환산·응시 기준 자료 확인 필요'} · ${count.toLocaleString('ko-KR')}개`));
    const body = document.getElementById('consultingReferenceCandidates'); body.replaceChildren();
    for (const item of data.candidates) {
        const row = document.createElement('tr'), name = document.createElement('td'); name.append(referenceNode('strong', item.university), referenceNode('span', item.program)); row.appendChild(name);
        for (const value of [referenceNumber(item.score), `${referenceNumber(item.passCut)} / ${referenceNumber(item.top70Cut)}`, item.band, referenceGroupLabel(item)]) row.appendChild(referenceNode('td', value));
        const cell = document.createElement('td'), select = referenceSelect([['', '변경하지 않음'], ['가', '가군 실험 지정'], ['나', '나군 실험 지정'], ['다', '다군 실험 지정']], `${item.university} ${item.program} 실험용 모집군`, consultingReferenceState.groups.get(item.id)?.group || '');
        select.addEventListener('change', () => {
            if (select.value) {
                if (!consultingReferenceState.groups.has(item.id) && consultingReferenceState.groups.size >= 24) { select.value = ''; consultingWorkspaceStatus('consultingReferenceStatus', '실험용 군은 최대 24개까지 지정할 수 있습니다.', 'error'); return; }
                consultingReferenceState.groups.set(item.id, { group: select.value, label: `${item.university} ${item.program}` });
            } else consultingReferenceState.groups.delete(item.id);
            invalidateConsultingReference(); renderReferenceOverrides();
        }); cell.appendChild(select); row.appendChild(cell); body.appendChild(row);
    }
    if (!data.candidates.length) { const row = document.createElement('tr'), cell = referenceNode('td', '계산 가능한 검색 결과가 없습니다. 계열·검색어 또는 제외 사유를 확인해주세요.'); cell.colSpan = 6; row.appendChild(cell); body.appendChild(row); }
    document.getElementById('consultingReferencePage').textContent = `${data.page + 1}페이지 · 검색 결과 ${data.matchingCandidates.toLocaleString('ko-KR')}개`;
    document.getElementById('consultingReferencePrevious').disabled = data.page === 0;
    document.getElementById('consultingReferenceNext').disabled = !data.hasNextPage;
    document.getElementById('consultingReferenceResults').hidden = false;
}
async function runConsultingReference(event, page = 0) {
    event?.preventDefault();
    const state = consultingReferenceState, form = document.getElementById('consultingReferenceForm');
    if (!state?.catalog || !form.reportValidity()) return;
    const input = referenceInput(state, page), generation = ++consultingReferenceGeneration;
    consultingReferenceRequest?.abort(); const request = new AbortController(); consultingReferenceRequest = request;
    state.result = null; document.getElementById('consultingReferenceResults').hidden = true;
    document.getElementById('consultingReferenceRun').disabled = true; form.setAttribute('aria-busy', 'true');
    consultingWorkspaceStatus('consultingReferenceStatus', '전체 후보를 평가하고 군별 A/B안을 비교하고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_run_reference_experiment', { caseId: state.caseId, sourceToken: state.catalog.sourceToken, dataVersion: state.catalog.dataVersion, input }, request.signal);
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        if (data.caseId !== state.caseId || data.sourceToken !== state.catalog.sourceToken || data.dataVersion !== state.catalog.dataVersion || !Array.isArray(data.plans?.A) || !Array.isArray(data.plans?.B) || !Array.isArray(data.candidates)) throw new Error('Invalid reference result');
        state.result = data; state.page = data.page; renderReferenceResults(data);
        consultingWorkspaceStatus('consultingReferenceStatus', '추천 실험을 마쳤습니다. 학생 원본·검수 성적·보고서에는 반영하지 않았습니다.', 'success');
    } catch (error) {
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        if (error.status === 409) { state.catalog = null; consultingWorkspaceStatus('consultingReferenceStatus', '학생 자료나 참고자료가 바뀌었습니다. 자료 다시 불러오기로 기준을 갱신해주세요.', 'error'); }
        else consultingWorkspaceStatus('consultingReferenceStatus', error.status === 400 ? error.message || '표준점수·백분위·등급과 과목을 확인해주세요.' : error.status === 403 ? '개발 환경의 관리자 권한을 확인해주세요.' : '추천 실험을 완료하지 못했습니다. 입력을 유지한 상태로 다시 시도할 수 있습니다.', 'error');
    } finally { if (generation === consultingReferenceGeneration) { consultingReferenceRequest = null; document.getElementById('consultingReferenceRun').disabled = !state.catalog; form.setAttribute('aria-busy', 'false'); } }
}
function pageConsultingReference(delta) { if (consultingReferenceState?.result) return runConsultingReference(null, Math.max(0, consultingReferenceState.page + delta)); }
window.addEventListener('pagehide', resetConsultingReference);
window.addEventListener('studycrack:session-ended', resetConsultingReference);

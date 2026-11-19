let consultingReferenceState = null;
let consultingReferenceGeneration = 0;
let consultingReferenceRequest = null;
let consultingReferenceTimer = null;

function resetConsultingReference() {
    consultingReferenceGeneration++;
    clearTimeout(consultingReferenceTimer); consultingReferenceTimer = null;
    consultingReferenceRequest?.abort(); consultingReferenceRequest = null;
    consultingReferenceState = null;
    const panel = document.getElementById('consultingReferenceExperiment');
    if (!panel) return;
    panel.hidden = true; panel.open = false;
    for (const id of ['consultingReferenceForm', 'consultingReferenceResults', 'consultingReferenceStandard']) document.getElementById(id).hidden = true;
    for (const id of ['consultingReferenceScores', 'consultingReferenceStandardInputs', 'consultingReferencePlans', 'consultingReferenceCandidates', 'consultingReferenceOverrides', 'consultingReferenceExcluded']) document.getElementById(id).replaceChildren();
    consultingWorkspaceStatus('consultingReferenceStatus', '');
}
function prepareConsultingReference(caseId) {
    resetConsultingReference();
    consultingReferenceState = { caseId, catalog: null, groups: new Map(), result: null, page: 0, referenceScores: {}, standardKeys: [] };
    document.getElementById('consultingReferenceExperiment').hidden = false;
}
function referenceNode(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
}
function renderReviewedReference(candidate) {
    const value = candidate.reviewedReference;
    if (!value || value.contractVersion !== 'reviewed-admission-reference-v1' || value.school !== candidate.university || value.originalMajor !== candidate.program
        || value.probability !== null || value.empiricallyCalibrated !== false || value.personalEligibilityApproved !== false || value.publicationReady !== false) return null;
    const labels = { current_two_references: '현행식 참고 비교', prior_data_two_estimates: '기존자료 참고 비교', historical70_only: '70% 단독 참고', academic_score_without_cut: '수능 점수만', held: '비교 보류', explicitly_excluded: '서강대 대기' };
    if (!Object.hasOwn(labels, value.status)) return null;
    const section = referenceNode('section', null, 'consulting-caption');
    section.appendChild(referenceNode('strong', labels[value.status]));
    if (Number.isFinite(value.convertedScore)) {
        const facts = [['참고 환산점수', referenceNumber(value.convertedScore)]];
        if (Number.isFinite(value.passReference)) facts.push(['참고 예상컷', referenceNumber(value.passReference)]);
        if (Number.isFinite(value.registered70Reference)) facts.push(['참고 70%선', referenceNumber(value.registered70Reference)]);
        if (Number.isInteger(value.referenceIndex) && value.referenceIndex >= 1 && value.referenceIndex <= 99) facts.push(['참고 지수', `${value.referenceIndex} / 100`]);
        section.appendChild(createConsultingFacts(facts));
        if (value.referenceBounds?.kind === 'cut_assumption_range' && Number.isFinite(value.referenceBounds.pass?.low) && Number.isFinite(value.referenceBounds.pass?.high)
            && value.referenceBounds.pass.low !== value.referenceBounds.pass.high) section.appendChild(referenceNode('p', `예상컷 가정 범위 ${referenceNumber(value.referenceBounds.pass.low)}~${referenceNumber(value.referenceBounds.pass.high)}`));
        if (value.referenceBounds?.kind === 'cut_assumption_range' && Number.isFinite(value.referenceBounds.registered70?.low) && Number.isFinite(value.referenceBounds.registered70?.high)
            && value.referenceBounds.registered70.low !== value.referenceBounds.registered70.high) section.appendChild(referenceNode('p', `70%선 가정 범위 ${referenceNumber(value.referenceBounds.registered70.low)}~${referenceNumber(value.referenceBounds.registered70.high)}`));
        if (value.indexRange?.kind === 'cut_assumption_range' && Number.isFinite(value.indexRange.low) && Number.isFinite(value.indexRange.high)
            && value.indexRange.low !== value.indexRange.high) section.appendChild(referenceNode('p', `지수 가정 범위 ${referenceNumber(value.indexRange.low)}~${referenceNumber(value.indexRange.high)}`));
    }
    section.appendChild(referenceNode('p', `${Number.isInteger(value.referenceYear) ? `${value.referenceYear}학년도${value.referenceYear === 2025 ? ' 보완자료' : ' 입결 참고'}` : value.status === 'prior_data_two_estimates' ? '기존 추정값 생성연도 미확인' : '커트라인 비교 보류'} · 실제 합격 확률 아님 · 지원 자격 별도 확인`));
    section.appendChild(referenceNode('p', '참고 비교를 추가로 표시하며 기존 실험 추천의 순위는 유지합니다.'));
    return section;
}
function referenceSelect(options, label, value = '') {
    const select = document.createElement('select'); select.setAttribute('aria-label', label);
    for (const [key, text] of options) { const option = document.createElement('option'); option.value = key; option.textContent = text; select.appendChild(option); }
    select.value = value;
    return select;
}
function invalidateConsultingReference() {
    const state = consultingReferenceState;
    if (!state) return;
    clearTimeout(consultingReferenceTimer);
    consultingReferenceGeneration++; consultingReferenceRequest?.abort(); consultingReferenceRequest = null;
    state.result = null; state.page = 0;
    document.getElementById('consultingReferenceResults').hidden = true;
    document.getElementById('consultingReferenceForm').setAttribute('aria-busy', 'false');
    if (!state.catalog?.automaticSurvey?.available) return;
    document.getElementById('consultingReferenceRun').disabled = referenceStandardIncomplete(state);
    if (referenceStandardIncomplete(state)) { consultingWorkspaceStatus('consultingReferenceStatus', '표준점수를 모두 선택하면 2026 수능표의 백분위·등급으로 추천을 계산합니다.'); return; }
    consultingWorkspaceStatus('consultingReferenceStatus', '지원 조건을 반영하고 있습니다.');
    consultingReferenceTimer = setTimeout(() => { consultingReferenceTimer = null; if (state === consultingReferenceState) runConsultingReference(); }, 350);
}
function renderReferenceScoreSummary(records) {
    const container = document.getElementById('consultingReferenceScores'); container.replaceChildren();
    const labels = { korean: '국어', math: '수학', inquiry: '탐구', english: '영어', korean_history: '한국사', foreign_language: '제2외국어·한문' };
    for (const row of records || []) {
        const fieldset = referenceNode('fieldset', null, 'consulting-reference-score');
        fieldset.appendChild(referenceNode('legend', row.label || labels[row.area] || '성적'));
        const facts = [['과목', row.selection || row.subject || '미입력']];
        for (const [field, label] of [['commonRawScore', '공통 원점수'], ['electiveRawScore', '선택 원점수'], ['rawScore', '원점수 합계'], ['standardScore', '2026 참고 표준점수'], ['percentile', '2026 참고 백분위'], ['grade', '등급']]) {
            if (row[field] != null) facts.push([label, String(row[field])]);
        }
        fieldset.appendChild(createConsultingFacts(facts)); container.appendChild(fieldset);
        if (row.scoreBasis === 'reference_standard') fieldset.appendChild(referenceNode('p', '실험용 표준점수 · 2026 수능 참고표', 'consulting-caption'));
    }
}
function referenceStandardIncomplete(state) { return state.standardKeys.some(key => !Object.hasOwn(state.referenceScores, key)); }
function referenceScoreFields(records) {
    let inquiry = 0;
    return records.flatMap(row => {
        const key = row.area === 'korean' ? 'kor' : row.area === 'math' ? 'math' : row.area === 'inquiry' ? `inq${++inquiry}` : null;
        return key && ['kor', 'math', 'inq1', 'inq2'].includes(key) ? [{ ...row, scoreKey: key }] : [];
    });
}
function referenceStandardRows(catalog, row) {
    const compact = value => String(value || '').normalize('NFKC').replace(/\s/g, '');
    const choice = compact(row.selection), subject = compact(row.subject);
    const math = ['확통', '확률과통계'].includes(choice) ? '수학(확통)' : ['미적', '미적분'].includes(choice) ? '수학(미적분)' : choice === '기하' ? '수학(기하)' : '';
    const matches = (catalog.scoreRows || []).filter(area => compact(area.subject) === (row.scoreKey === 'kor' ? '국어' : row.scoreKey === 'math' ? math : subject.replace(/ii/gi, '2').replace(/i/gi, '1')));
    if (matches.length !== 1) return [];
    const rows = matches[0].rows || [], max = row.scoreKey.startsWith('inq') ? 100 : 200;
    return rows.filter(value => Array.isArray(value) && value.length === 3 && value.every(Number.isInteger) && value[0] >= 0 && value[0] <= max && value[1] >= 0 && value[1] <= 100 && value[2] >= 1 && value[2] <= 9 && rows.filter(other => other[0] === value[0]).length === 1);
}
function renderReferenceStandardInputs(missing) {
    const state = consultingReferenceState;
    if (!state.catalog.standardReferenceSupported) return false;
    const records = referenceScoreFields(state.catalog.automaticSurvey.records);
    const available = records.filter(row => missing.some(item => item.scoreKey === row.scoreKey && ['REFERENCE_RAW_MAPPING_UNAVAILABLE', 'RAW_SCORE_REQUIRED', 'REFERENCE_STANDARD_MAPPING_UNAVAILABLE'].includes(item.code)) && referenceStandardRows(state.catalog, row).length);
    if (!available.length) return false;
    const container = document.getElementById('consultingReferenceStandardInputs'); container.replaceChildren();
    state.standardKeys = available.map(row => row.scoreKey);
    for (const row of available) {
        const title = `${{ kor: '국어', math: '수학', inq1: '탐구 1', inq2: '탐구 2' }[row.scoreKey]} · ${row.selection || row.subject}`;
        const label = referenceNode('label', `${title} 표준점수`), rows = referenceStandardRows(state.catalog, row);
        const select = referenceSelect([['', '표준점수 선택'], ...rows.map(value => [String(value[0]), String(value[0])])], `${title} 표준점수`, Object.hasOwn(state.referenceScores, row.scoreKey) ? String(state.referenceScores[row.scoreKey]) : '');
        select.dataset.referenceStandard = row.scoreKey; select.required = true;
        const output = referenceNode('output');
        const preview = () => { const selected = rows.find(value => String(value[0]) === select.value); output.textContent = selected ? `2026 참고 백분위 ${selected[1]} · ${selected[2]}등급` : '선택하면 백분위·등급이 표시됩니다.'; };
        select.addEventListener('change', () => {
            if (state !== consultingReferenceState) return;
            if (select.value === '') delete state.referenceScores[row.scoreKey]; else state.referenceScores[row.scoreKey] = Number(select.value);
            preview(); invalidateConsultingReference();
        });
        preview(); label.append(select, output); container.appendChild(label);
    }
    document.getElementById('consultingReferenceStandard').hidden = false;
    document.getElementById('consultingReferenceRun').disabled = referenceStandardIncomplete(state);
    return true;
}
function renderReferenceScoreInputs(catalog) {
    renderReferenceScoreSummary(catalog.automaticSurvey.records);
    const streams = document.getElementById('consultingReferenceStream'); streams.replaceChildren();
    for (const [value, label] of [['', '전체 계열'], ...catalog.streams.map(x => [x, x])]) { const option = referenceNode('option', label); option.value = value; streams.appendChild(option); }
    streams.value = catalog.initialStream || '';
    const choices = document.getElementById('consultingReferenceUniversities'); choices.replaceChildren();
    for (let index = 0; index < 3; index++) {
        const label = referenceNode('label', `${index + 1}지망 대학`);
        const select = referenceSelect([['', '지정하지 않음'], ...catalog.universities.map(x => [x, x])], `${index + 1}지망 대학`, catalog.initialUniversities?.[index] || '');
        select.dataset.referenceUniversity = ''; select.addEventListener('change', invalidateConsultingReference); label.appendChild(select); choices.appendChild(label);
    }
    document.getElementById('consultingReferenceRisk').value = catalog.automaticSurvey.risk || 'balanced';
}
async function openConsultingReference(open, reload = false) {
    const state = consultingReferenceState;
    if (!open || !state || state.catalog && !reload) return;
    clearTimeout(consultingReferenceTimer); consultingReferenceTimer = null;
    const generation = ++consultingReferenceGeneration;
    consultingReferenceRequest?.abort(); const request = new AbortController(); consultingReferenceRequest = request;
    state.result = null; state.referenceScores = {}; state.standardKeys = [];
    document.getElementById('consultingReferenceStandard').hidden = true;
    document.getElementById('consultingReferenceStandardInputs').replaceChildren();
    document.getElementById('consultingReferenceForm').hidden = true;
    document.getElementById('consultingReferenceResults').hidden = true;
    consultingWorkspaceStatus('consultingReferenceStatus', '확정 조사서 성적과 지원 전략을 불러오고 있습니다.');
    try {
        const data = await requestConsultingAdmin('admin_get_reference_experiment', { caseId: state.caseId }, request.signal);
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        if (data.caseId !== state.caseId || data.contractVersion !== 'consulting-local-reference-v1' || !data.automaticSurveySupported || !data.automaticSurvey || !/^sha256:[a-f0-9]{64}$/.test(data.rawDataVersion || '')) throw new Error('자동 추천을 지원하는 백엔드 버전이 필요합니다.');
        state.catalog = data; state.groups.clear(); state.result = null; state.page = 0;
        document.getElementById('consultingReferenceNotice').textContent = data.warning;
        document.getElementById('consultingReferenceBasis').textContent = `${data.totalPrograms.toLocaleString('ko-KR')}개 학과 · ${data.automaticGroupReferences.toLocaleString('ko-KR')}개 모집군 참고 연결 · ${data.automaticSurvey.available ? `확정 조사서 ${data.automaticSurvey.revision + 1}차` : '조사서 확정 필요'}`;
        if (!data.automaticSurvey.available) { consultingWorkspaceStatus('consultingReferenceStatus', data.automaticSurvey.message); return; }
        renderReferenceScoreInputs(data); renderReferenceOverrides();
        document.getElementById('consultingReferenceForm').hidden = false;
        document.getElementById('consultingReferenceRun').disabled = false;
        document.getElementById('consultingReferenceQuery').value = '';
        await runConsultingReference();
    } catch (error) {
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        state.catalog = null;
        consultingWorkspaceStatus('consultingReferenceStatus', error.status === 403 ? '추천 실험은 개발 환경의 관리자 계정에서 이용할 수 있습니다.' : error.message === '자동 추천을 지원하는 백엔드 버전이 필요합니다.' ? error.message : '확정 조사서와 참고자료를 불러오지 못했습니다. 자료 다시 불러오기로 재시도해주세요.', 'error');
    } finally { if (generation === consultingReferenceGeneration) consultingReferenceRequest = null; }
}
function referenceInput(state, page = 0) {
    return { stream: document.getElementById('consultingReferenceStream').value, risk: document.getElementById('consultingReferenceRisk').value,
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
    for (const key of ['A', 'B', 'C']) {
        const section = referenceNode('section', null, 'consulting-reference-plan'); section.setAttribute('aria-label', `${key}안 추천`);
        section.append(referenceNode('h4', `${key}안 · ${{ A: '희망·지원 성향 우선', B: '안정성 보강', C: '조건 안의 다른 대안' }[key]}`));
        const grid = referenceNode('div', null, 'consulting-reference-cards');
        for (const slot of data.plans[key]) {
            const card = referenceNode('article', null, 'consulting-reference-card'), candidate = slot.candidate;
            card.append(referenceNode('p', `${slot.group}군`, 'consulting-reference-eyebrow'));
            if (candidate) {
                card.append(referenceNode('h5', candidate.university), referenceNode('p', candidate.program, 'consulting-reference-program'), referenceNode('strong', `${candidate.band} · 컷 대비 참고 분류`, 'consulting-reference-band'));
                card.appendChild(createConsultingFacts([['실험 환산점수', referenceNumber(candidate.score)], ['기존 합격권 추정컷', referenceNumber(candidate.passCut)], ['기존 70% 추정컷', referenceNumber(candidate.top70Cut)], ['합격권컷과 차이', referenceNumber(candidate.margin)]]));
                const reviewed = renderReviewedReference(candidate); if (reviewed) card.appendChild(reviewed);
                card.appendChild(referenceNode('p', referenceGroupLabel(candidate), 'consulting-caption'));
            } else card.appendChild(referenceNode('h5', '조건에 맞는 후보 없음'));
            card.appendChild(referenceNode('p', slot.reason, 'consulting-caption')); grid.appendChild(card);
        }
        section.appendChild(grid); target.appendChild(section);
    }
    const stats = data.stats;
    document.getElementById('consultingReferenceStats').textContent = `전체 ${stats.total.toLocaleString('ko-KR')}개 평가 · 계산 ${stats.calculated.toLocaleString('ko-KR')}개 · 제외 ${stats.excluded.toLocaleString('ko-KR')}개 · 군 확인 필요 ${stats.groupPending.toLocaleString('ko-KR')}개 · A/B가 다른 군 ${data.plans.distinctGroups}개 · 지역·통학·실기 등 추가 조건은 별도 확인`;
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
    clearTimeout(consultingReferenceTimer); consultingReferenceTimer = null;
    const state = consultingReferenceState, form = document.getElementById('consultingReferenceForm');
    if (!state?.catalog?.automaticSurvey?.available) return;
    if (referenceStandardIncomplete(state)) { consultingWorkspaceStatus('consultingReferenceStatus', '실험용 표준점수를 모두 선택해주세요.'); return; }
    const generation = ++consultingReferenceGeneration;
    consultingReferenceRequest?.abort(); const request = new AbortController(); consultingReferenceRequest = request;
    document.getElementById('consultingReferenceResults').hidden = true;
    form.setAttribute('aria-busy', 'true'); document.getElementById('consultingReferenceRun').disabled = true;
    consultingWorkspaceStatus('consultingReferenceStatus', '2026 참고 성적으로 A/B/C안을 계산하고 있습니다.');
    try {
        const catalog = state.catalog;
        const data = await requestConsultingAdmin('admin_run_reference_experiment', { caseId: state.caseId, scoreSource: 'approved_survey', sourceToken: catalog.automaticSurvey.sourceToken, dataVersion: catalog.dataVersion, rawDataVersion: catalog.rawDataVersion, input: referenceInput(state, page), ...(Object.keys(state.referenceScores).length ? { referenceScores: { ...state.referenceScores } } : {}) }, request.signal);
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        if (data.caseId !== state.caseId || data.sourceToken !== catalog.automaticSurvey.sourceToken || data.dataVersion !== catalog.dataVersion || data.rawDataVersion !== catalog.rawDataVersion || !Array.isArray(data.scoreSummary)) throw new Error('Invalid automatic result');
        renderReferenceScoreSummary(data.scoreSummary);
        if (data.status === 'blocked') {
            state.result = null;
            const fallback = renderReferenceStandardInputs(data.missing || []);
            const otherMissing = (data.missing || []).filter(item => !state.standardKeys.includes(item.scoreKey));
            consultingWorkspaceStatus('consultingReferenceStatus', fallback ? `원점수 대응자료가 없는 과목은 아래에서 실험용 표준점수를 선택해주세요.${otherMissing.length ? ` ${otherMissing.map(x => x.message).join(' ')}` : ''}` : `자동 추천 준비 필요: ${(data.missing || []).map(x => x.message).join(' ')}`, fallback && !otherMissing.length ? '' : 'error');
            return;
        }
        if (data.status !== 'ready' || ['A', 'B', 'C'].some(key => !Array.isArray(data.plans?.[key]) || data.plans[key].length !== 3)) throw new Error('Invalid automatic plans');
        state.result = data; state.page = data.page; renderReferenceResults(data);
        document.getElementById('consultingReferenceResults').hidden = false;
        consultingWorkspaceStatus('consultingReferenceStatus', data.scoreBasis === 'reference_standard' ? '실험용 표준점수와 2026 수능표 기준 A/B/C 추천입니다. 학생이 제출한 원점수는 변경하지 않았습니다.' : '확정 조사서 기준 A/B/C 추천을 불러왔습니다. 조건을 바꾸면 자동으로 다시 비교합니다.');
    } catch (error) {
        if (state !== consultingReferenceState || generation !== consultingReferenceGeneration) return;
        state.result = null;
        if (error.status === 409) { state.catalog = null; state.referenceScores = {}; state.standardKeys = []; document.getElementById('consultingReferenceStandard').hidden = true; document.getElementById('consultingReferenceStandardInputs').replaceChildren(); consultingWorkspaceStatus('consultingReferenceStatus', '조사서 확정 상태나 참고자료가 바뀌었습니다. 자료 다시 불러오기로 기준을 갱신해주세요.', 'error'); }
        else consultingWorkspaceStatus('consultingReferenceStatus', error.status === 400 ? error.message || '조사서 성적과 지원 조건을 확인해주세요.' : error.status === 403 ? '개발 환경의 관리자 권한을 확인해주세요.' : '자동 추천을 완료하지 못했습니다. 다시 계산으로 재시도해주세요.', 'error');
    } finally {
        if (generation === consultingReferenceGeneration) { consultingReferenceRequest = null; document.getElementById('consultingReferenceRun').disabled = !state.catalog || referenceStandardIncomplete(state); form.setAttribute('aria-busy', 'false'); }
    }
}
function pageConsultingReference(delta) { if (consultingReferenceState?.result) return runConsultingReference(null, Math.max(0, consultingReferenceState.page + delta)); }
window.addEventListener('pagehide', resetConsultingReference);
window.addEventListener('studycrack:session-ended', resetConsultingReference);

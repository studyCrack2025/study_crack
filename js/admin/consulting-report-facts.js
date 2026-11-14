let consultingReportFacts = null;
let consultingReportFactsBusy = false;
let consultingReportFactsGeneration = 0;
const reportFactsNode = id => document.getElementById(id);
const reportFactNumber = n => typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('ko-KR', { maximumFractionDigits: 6 }) : '미확인';
const reportFactBandLabels = { stable: '안정', appropriate: '적정', neutral: '중립', challenge: '도전', risky: '위험' };
function reportFactIndexReady(fact) {
    const p = fact.possibility, lines = fact.referenceLines;
    return p?.contractVersion === 'cut-reference-public-v1' && p.policyVersion === 'cut-reference-possibility-1.0.0'
        && p.status === 'available' && p.validationState === 'passed' && p.basis === 'cut_reference_heuristic'
        && p.empiricallyCalibrated === false && p.probability === null && p.reasonCodes?.length === 0
        && p.admissionUnitId === fact.admissionUnitId && Number.isInteger(p.index?.points) && p.index.points >= 1 && p.index.points <= 99
        && Number.isFinite(fact.possibilityPoint) && p.index.points === Math.floor(fact.possibilityPoint)
        && reportFactBandLabels[p.riskBand] && p.riskBand === fact.reportRisk?.band
        && /^sha256:[a-f0-9]{64}$/.test(p.publicationDigest || '') && /^sha256:[a-f0-9]{64}$/.test(p.referenceDigest || '')
        && Number.isFinite(lines?.passLine) && Number.isFinite(lines?.registered70Line) && lines.passLine < lines.registered70Line
        && lines.sourceYear === p.sourceYear && lines.targetYear === p.targetYear && p.targetYear === 2027
        && Number.isInteger(p.sourceYear) && p.sourceYear >= 2000 && p.sourceYear <= p.targetYear;
}
function reportFactPossibility(fact) {
    return reportFactIndexReady(fact) ? `약 ${fact.possibility.index.points}점 / 100` : '판단 보류';
}
function reportFactProbability(fact) {
    if (!Object.hasOwn(fact, 'forecast')) return fact.probability ? reportFactNumber(fact.probability.point) + '%' : '판단 보류';
    const f = fact.forecast, p = f?.probability;
    if (!fact.probability || f?.status !== 'available' || f.validationState !== 'passed' || f.riskBand !== fact.reportRisk?.band || !p || !Number.isInteger(p.percent) || p.percent < 1 || p.percent > 99) return '판단 보류';
    return p.qualifier === 'less_than' && p.percent === 1 ? '1% 미만' : p.qualifier === 'more_than' && p.percent === 99 ? '99% 초과' : p.qualifier === 'approximate' ? `약 ${p.percent}%` : '판단 보류';
}
const reportFactGroups = { ga: '가군', na: '나군', da: '다군', other: '별도 지원 제도' };
const reportFactsDataMessages = {
    REPORT_ADMISSION_STATUS_UNAVAILABLE: '입시자료 상태를 확인하지 못했습니다. 운영 도구에서 준비 상태를 확인한 뒤 작성 자료를 새로고침해주세요.',
    REPORT_DATA_RELEASE_NOT_READY: '승인된 입시자료가 아직 연결되지 않아 계산을 기다리고 있습니다. 상담 정리는 계속 저장할 수 있습니다.',
    REPORT_NUMERICAL_BACKEND_UPDATE_REQUIRED: '보고서 공통 계산 기준을 확인하지 못했습니다. 기능 적용 상태를 확인해주세요.'
};
const reportFactsWaitingCodes = workspace => Array.isArray(workspace?.calculationBlockers) ? workspace.calculationBlockers.filter(code => Object.hasOwn(reportFactsDataMessages, code)) : [];
const reportFactReasons = {
    ADMISSION_DATA_NOT_CONFIGURED: '활성 입시자료 연결이 필요합니다.', ACTIVE_DATA_RELEASE_NOT_FOUND: '해당 학년도의 승인된 입시자료가 없습니다.',
    KOREAN_HISTORY_GRADE_REQUIRED: '한국사 등급 검수가 필요합니다.', OFFICIAL_GRADE_MISSING: '영어·한국사·선택 외국어 등급을 확인해주세요.',
    ELIGIBILITY_UNCONFIRMED_OR_NOT_MET: '응시 자격이 맞지 않거나 추가 검수가 필요한 후보', CONVERSION_OR_IDENTITY_UNAVAILABLE: '환산식·공식 점수·대학 정보를 확인해야 하는 후보',
    EXCLUDED_BY_CONFIRMED_CONDITION: '확인된 지원 제외 조건에 해당하는 후보', EDUCATION_REGIME_UNCONFIRMED: '4년제·전문대 지원 제도 구분이 필요한 후보',
    MEDICAL_PATH_REQUIRES_CONSENT: '의료계열 검토 의향이 미확인되어 A/B에서 제외한 후보',
    HARD_EXCLUSION_UNRESOLVED: '필수 제외 후보를 자료와 정확히 연결하지 못했습니다. 조건을 먼저 확인해주세요.',
    PREFERRED_UNIVERSITY_UNRESOLVED: '희망 대학을 현재 자료와 정확히 연결하지 못한 항목이 있습니다.', PREFERRED_TRACK_UNRESOLVED: '희망 계열을 현재 자료와 연결하지 못한 항목이 있습니다.',
    COMMUTE_AND_HOUSING_REVIEW_REQUIRED: '실제 통학 시간과 기숙사 이용 가능 여부는 별도로 확인해야 합니다.',
    ADDITIONAL_HARD_CONDITIONS_REVIEW_REQUIRED: '자유롭게 적은 추가 필수 조건과 상담 내용을 각 후보에 대조해주세요.',
    PRESTIGE_EMPLOYMENT_DATA_NOT_INFERRED: '검수 자료가 없는 대학 평판·취업률은 순위 점수로 추정하지 않았습니다.',
    CUTOFF_OR_PROBABILITY_NOT_AVAILABLE: '일부 후보의 입결 기준선·가능성 판단은 자료 검수가 필요합니다.',
    CUT_REFERENCE_INDEX_NOT_EMPIRICAL_PROBABILITY: '가능성 지수는 입결 기준선에 따른 100점 척도입니다. 실제 합격률이 아니며 합격을 보장하지 않습니다.',
    RISK_ALLOCATION_NOT_SATISFIED: '현재 후보만으로는 확인된 위험 배분을 충족하지 못했습니다.', ADMISSION_GROUP_CANDIDATE_MISSING: '일부 모집군에 유효한 후보가 없습니다.',
    TWO_DIFFERENT_ALTERNATIVES_UNAVAILABLE: '조건을 유지하면서 A와 두 곳 이상 다른 대안을 확보하지 못해 일부 후보가 겹칩니다.',
    PLAN_C_RATIONALE_REQUIRED: '다른 진학 경로를 제안할 상담 근거를 먼저 정리해주세요.'
};
const reportFactReason = code => reportFactReasons[code] || (code.endsWith('_VERIFIED_ALTERNATIVE_UNAVAILABLE') ? '해당 대안 유형의 검수된 후보를 확보하지 못했습니다.' : '자료와 지원 조건의 추가 확인이 필요합니다.');
function reportFactElement(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
function reportFactStatus(text, state = '') { consultingWorkspaceStatus('consultingReportFactsStatus', text, state); }
function resetConsultingReportFacts() {
    consultingReportFactsGeneration++; consultingReportFacts = null; consultingReportFactsBusy = false;
    reportFactsNode('consultingReportFactsResult').replaceChildren(); reportFactsNode('consultingReportFactsPanel').setAttribute('aria-busy', 'false');
    reportFactStatus(''); updateConsultingReportFactsButton();
}
function updateConsultingReportFactsButton() {
    reportFactsNode('consultingReportCalculateFacts').disabled = (typeof consultingReportApprovalBusy !== 'undefined' && consultingReportApprovalBusy) || consultingReportFactsBusy || consultingReportSourceBusy || consultingReportSourceDirty || consultingReportFacts?.canCalculate !== true || reportFactsWaitingCodes(consultingReportFacts).length > 0;
}
function reportFactCard(fact, prefix) {
    const card = reportFactElement('article', undefined, 'consulting-report-fact-card');
    card.append(reportFactElement('p', prefix || reportFactGroups[fact.admissionGroup], 'consulting-eyebrow'), reportFactElement('h4', `${fact.universityName} · ${fact.admissionUnitName}`), reportFactElement('p', fact.campusName, 'consulting-caption'));
    const indexMode = Object.hasOwn(fact, 'possibility'), indexReady = indexMode && reportFactIndexReady(fact);
    const riskLabel = indexMode ? indexReady ? reportFactBandLabels[fact.possibility.riskBand] : '판단 보류' : fact.reportRisk?.label || '판단 보류';
    const risk = reportFactElement('p', `${riskLabel}${!indexMode && fact.reportRisk?.wide ? ' · 변동 폭 큼' : ''}`, 'consulting-report-fact-risk'); risk.dataset.band = indexMode ? indexReady ? fact.possibility.riskBand : 'unknown' : fact.reportRisk?.band || 'unknown'; card.append(risk);
    const dl = reportFactElement('dl', undefined, 'consulting-report-fact-metrics');
    const rows = [['예상 환산점수', reportFactNumber(fact.convertedScore) + ' / ' + reportFactNumber(fact.maximumScore)],
        ...(indexMode ? [['합격권 기준선', indexReady ? reportFactNumber(fact.referenceLines.passLine) : '판단 보류'],
            ['등록자 70% 기준선', indexReady ? reportFactNumber(fact.referenceLines.registered70Line) : '판단 보류'], ['가능성 지수', reportFactPossibility(fact)]] : [
            [fact.cutoffStatistic === 'registered_70pct' ? '등록자 70% 컷 추정' : fact.cutoffStatistic === 'final_admitted' ? '최종 합격선 추정' : '예상컷 · 종류 미확인', reportFactNumber(fact.expectedCutoff?.point)],
            ['예상 합격률', reportFactProbability(fact)]])];
    for (const [label, value] of rows) { const cell = document.createElement('div'); cell.append(reportFactElement('dt', label), reportFactElement('dd', value)); dl.append(cell); }
    card.append(dl);
    if (indexReady) card.append(reportFactElement('p', `${fact.possibility.sourceYear}학년도 입결 · ${fact.possibility.targetYear}학년도 반영 기준 · 실제 합격률이 아닌 가능성 지수`, 'consulting-caption'));
    if (!indexMode && fact.expectedCutoff) card.append(reportFactElement('p', `예상컷 범위 ${reportFactNumber(fact.expectedCutoff.low)}~${reportFactNumber(fact.expectedCutoff.high)} · 같은 환산 척도 차이 ${reportFactNumber(fact.scoreDelta)}`, 'consulting-caption'));
    if (!indexMode && fact.probability) card.append(reportFactElement('p', `컷 시나리오별 추정 범위 ${reportFactNumber(fact.probability.low)}~${reportFactNumber(fact.probability.high)}% · 합격 확률의 신뢰구간이 아닙니다.`, 'consulting-caption'));
    return card;
}
function reportFactsWarnings(parent, codes) {
    if (!codes?.length) return;
    const list = reportFactElement('ul', undefined, 'consulting-report-facts-notes');
    for (const code of [...new Set(codes)]) list.append(reportFactElement('li', reportFactReason(code))); parent.append(list);
}
function reportFactsPlan(parent, plan, title, description, facts) {
    const section = reportFactElement('section', undefined, 'consulting-report-source-section'); section.append(reportFactElement('h3', title), reportFactElement('p', description, 'consulting-caption'));
    reportFactsWarnings(section, plan.reasonCodes);
    const cards = reportFactElement('div', undefined, 'consulting-report-facts-grid');
    for (const group of ['ga', 'na', 'da']) {
        const slot = plan.slots.find(s => s.group === group), fact = facts.get(slot?.factId);
        cards.append(fact ? reportFactCard(fact, reportFactGroups[group]) : reportFactElement('p', `${reportFactGroups[group]} · 조건에 맞는 후보 미확보`, 'consulting-report-fact-card'));
    }
    section.append(cards); parent.append(section);
}
function renderConsultingReportFacts(workspace) {
    consultingReportFacts = workspace || null; const root = reportFactsNode('consultingReportFactsResult'); root.replaceChildren();
    if (!workspace) { reportFactStatus('작성 기준을 고정하고 최신 계산 기능이 적용됐는지 확인해주세요.'); updateConsultingReportFactsButton(); return; }
    const waiting = reportFactsWaitingCodes(workspace), waitingText = waiting.map(code => reportFactsDataMessages[code]).join(' ');
    const stateText = workspace.status === 'running' ? '계산이 진행 중입니다. 잠시 후 작성 자료를 새로고침해주세요.' : workspace.status === 'stale' ? '이전 기준의 계산 결과입니다. 현재 자료로 작성 기준을 다시 고정하고 계산해주세요.'
        : workspace.record ? `계산 결과 ${workspace.revision} · 기준 ${workspace.record.sourceRevision} · ${formatConsultingDate(workspace.record.calculatedAt)}` : waitingText ? '' : workspace.canCalculate ? '고정한 기준으로 계산할 수 있습니다. 계산은 학생에게 전송되지 않습니다.' : '현재 작성 기준과 계산 실행 권한을 확인해주세요.';
    reportFactStatus([stateText, waitingText].filter(Boolean).join(' '), workspace.status === 'stale' || waiting.includes('REPORT_ADMISSION_STATUS_UNAVAILABLE') || waiting.includes('REPORT_NUMERICAL_BACKEND_UPDATE_REQUIRED') ? 'error' : '');
    updateConsultingReportFactsButton(); const result = workspace.record?.result; if (!result) return;
    const facts = new Map(result.facts.map(f => [f.admissionUnitId, f]));
    root.append(reportFactElement('p', `전체 평가 ${reportFactNumber(result.coverage.evaluated)}개 · 자격·환산 확인 ${reportFactNumber(result.coverage.eligibleConverted)}개 · 정규 3군 검토 ${reportFactNumber(result.coverage.regularPlanPool)}개`, 'consulting-caption'));
    root.append(reportFactElement('p', result.numericalReady ? 'A/B의 핵심 수치가 계산됐습니다. 추가 조건 검수와 내용 승인 절차가 남아 있습니다.' : '자료·과목·위험 배분이 미확인인 부분이 있어 수치 검수가 필요합니다.', 'consulting-report-source-notice'));
    reportFactsWarnings(root, result.warnings);
    for (const e of result.coverage.exclusions) root.append(reportFactElement('p', `${reportFactReason(e.code)} · ${reportFactNumber(e.count)}개`, 'consulting-caption'));
    const scores = reportFactElement('section', undefined, 'consulting-report-source-section'); scores.append(reportFactElement('h3', '검수 성적과 반영 기준'));
    const wrap = reportFactElement('div', undefined, 'consulting-report-facts-table-wrap'), table = reportFactElement('table', undefined, 'consulting-report-facts-table');
    const head = document.createElement('thead'), hr = document.createElement('tr');
    for (const label of ['과목·선택', '원점수', '공통 / 선택', '표준점수', '백분위', '등급']) { const th = reportFactElement('th', label); th.scope = 'col'; hr.append(th); }
    head.append(hr); table.append(head); const body = document.createElement('tbody');
    for (const s of result.scoreAnalysis?.records || []) {
        const gradeOnly = ['english', 'korean_history', 'second_foreign'].includes(s.area), tr = document.createElement('tr');
        const values = [`${s.subject}${s.selection ? ' · ' + s.selection : ''}`, gradeOnly ? '—' : reportFactNumber(s.rawScore), s.commonRawScore != null || s.electiveRawScore != null ? `${reportFactNumber(s.commonRawScore)} / ${reportFactNumber(s.electiveRawScore)}` : '—', gradeOnly ? '—' : reportFactNumber(s.standardScore), gradeOnly ? '—' : reportFactNumber(s.percentile), reportFactNumber(s.grade)];
        for (const value of values) tr.append(reportFactElement('td', value)); body.append(tr);
    }
    table.append(body); wrap.append(table); scores.append(wrap, reportFactElement('p', '다른 학년도의 변환표로 빈 점수를 채우지 않습니다. 후보별 반영 계산은 고정한 공식과 검수 성적을 사용합니다.', 'consulting-caption')); root.append(scores);
    const baseline = reportFactElement('section', undefined, 'consulting-report-source-section'); baseline.append(reportFactElement('h3', '성적 기준 지원 범위'), reportFactElement('p', '희망 대학·계열에 따른 가중치를 제외하고 성적·자격·필수 제외 조건으로 비교한 모집단위 사례입니다. 실제 합격생의 진학 분포나 대학 전체의 난이도를 뜻하지 않습니다.', 'consulting-caption'));
    const baselineCards = reportFactElement('div', undefined, 'consulting-report-facts-grid'); for (const id of result.baseline.factIds) if (facts.has(id)) baselineCards.append(reportFactCard(facts.get(id))); baseline.append(baselineCards); root.append(baseline);
    for (const gap of result.preferenceGaps || []) if (!gap.matchingEligibleCount) root.append(reportFactElement('p', `${gap.priority}지망 · 현재 자료에서 자격·환산 조건이 맞는 후보를 확보하지 못했습니다. 희망과 계산 결과를 상담에서 다시 비교해주세요.`, 'consulting-report-source-notice'));
    reportFactsPlan(root, result.planA, '플랜 A · 학생이 원하는 방향', '확인된 희망과 우선순위를 중심으로 구성하고, 재수 가능성·지원 성향에 따른 위험 배분을 함께 검사합니다.', facts);
    reportFactsPlan(root, result.planB, '플랜 B · 추가 비교 제안', '필수 조건을 유지하면서 A와 다른 선택과 위험 배분을 비교합니다. 세 군을 합친 합격 확률은 계산하지 않습니다.', facts);
    const c = reportFactElement('section', undefined, 'consulting-report-source-section'); c.append(reportFactElement('h3', '플랜 C · 조건부 다른 경로'), reportFactElement('p', '학생의 진학 동의로 간주하지 않습니다. 별도 지원 제도·교육 과정·상담 근거를 확인한 뒤 논의할 대안입니다.', 'consulting-caption'));
    for (const option of result.planC.alternatives) { const fact = facts.get(option.factId); if (fact) c.append(reportFactCard(fact, option.status === 'discussion_required' ? '학생 의향 추가 확인 필요' : '허용 범위 안의 조건부 검토')); }
    if (!result.planC.alternatives.length) c.append(reportFactElement('p', '현재 기준에서 제안할 검수된 대안이 없습니다.')); reportFactsWarnings(c, result.planC.reasonCodes); root.append(c);
}
async function calculateConsultingReportFacts() {
    if ((typeof consultingReportApprovalBusy !== 'undefined' && consultingReportApprovalBusy) || consultingReportFactsBusy || consultingReportSourceBusy || consultingReportSourceDirty || consultingReportFacts?.canCalculate !== true || reportFactsWaitingCodes(consultingReportFacts).length) return;
    const generation = consultingReportFactsGeneration, source = consultingReportSource;
    consultingReportFactsBusy = true; updateConsultingReportSourceButtons(); reportFactsNode('consultingReportFactsPanel').setAttribute('aria-busy', 'true'); reportFactStatus('전체 후보를 평가하고 점수·지원 플랜을 계산하고 있습니다.');
    try {
        const result = await requestConsultingAdmin('admin_calculate_report_facts', { caseId: source.caseId, expectedCaseRevision: source.caseRevision, expectedSourceRevision: consultingReportFacts.sourceRevision, expectedSourceDigest: consultingReportFacts.sourceDigest });
        if (generation !== consultingReportFactsGeneration) return;
        const loaded = await loadConsultingReportSource(source.caseId, undefined, result.unchanged ? '같은 기준의 기존 계산 결과를 확인했습니다.' : '점수 분석과 지원 플랜을 저장했습니다.', true);
        if (!loaded && generation === consultingReportFactsGeneration) { consultingReportFacts.canCalculate = false; reportFactStatus('계산 응답은 받았지만 최신 자료를 다시 읽지 못했습니다. 작성 자료를 새로고침해주세요.', 'error'); }
    } catch (error) { if (generation === consultingReportFactsGeneration) reportFactStatus(error.message || '계산하지 못했습니다. 최신 작성 기준과 자료 연결을 확인해주세요.', 'error'); }
    finally { if (generation === consultingReportFactsGeneration) { consultingReportFactsBusy = false; reportFactsNode('consultingReportFactsPanel').setAttribute('aria-busy', 'false'); updateConsultingReportSourceButtons(); } }
}

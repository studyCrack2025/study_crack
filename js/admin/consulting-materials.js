let currentConsultingMaterial = null;
let consultingMaterialRequest = 0;
let consultingSurveyHistory = null;
const consultingForeignLanguageSubjects = ['독일어Ⅰ', '프랑스어Ⅰ', '스페인어Ⅰ', '중국어Ⅰ', '일본어Ⅰ', '러시아어Ⅰ', '아랍어Ⅰ', '베트남어Ⅰ', '한문Ⅰ'];
const consultingScoreAreas = { korean: '국어', math: '수학', english: '영어', korean_history: '한국사', foreign_language: '제2외국어·한문' };
const consultingReviewLabels = { pending: '검수 대기', matched: '확인 완료', corrected: '정정 후 확인 완료', supplement_required: '보완 요청' };
const consultingSurveyTopicLabels = {
    group_plan: '가·나·다군 조합', risk_mix: '상향·적정·안정 배분', university_or_major: '대학과 학과 사이 선택', retake_decision: '올해 진학과 재수 결정', other: '기타'
};

function setConsultingMaterialStatus(message, state = '') {
    const target = document.getElementById('consultingMaterialStatus');
    if (!target) return;
    target.textContent = message;
    target.dataset.state = state;
}

function consultingScoreRows(records) {
    let inquiryNumber = 0;
    return records.map(record => ({
        record,
        area: record.area === 'inquiry' ? `탐구 ${++inquiryNumber}` : consultingOptionLabel(record.area, consultingScoreAreas),
        field: `scores.${record.area === 'inquiry' ? `inquiry${inquiryNumber}` : record.area}`
    }));
}

function renderConsultingScoreTable(scores, decorate) {
    const content = document.createElement('div');
    if (!Array.isArray(scores?.records) || !scores.records.length) {
        content.textContent = '기록된 성적이 없습니다.';
        return content;
    }
    const exams = { csat: '수능', june_mock: '6월 모의평가', september_mock: '9월 모의평가', other: '기타 시험' };
    const caption = document.createElement('p');
    caption.className = 'consulting-caption';
    const year = scores.examYear;
    caption.textContent = [Number.isInteger(year) && (scores.examType === 'csat' ? `${year + 1}학년도` : `${year}년`), consultingOptionLabel(scores.examType, exams)].filter(Boolean).join(' ');
    const table = document.createElement('table');
    table.className = 'consulting-score-table';
    const header = table.createTHead().insertRow();
    for (const text of ['영역', '과목·선택', '성적']) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = text;
        header.appendChild(th);
    }
    const body = table.createTBody();
    for (const { record, area, field } of consultingScoreRows(scores.records)) {
        const row = body.insertRow();
        const subject = [record.subject, record.selection].filter(Boolean).join(' · ');
        const values = [
            ['공통', record.commonRawScore], ['선택', record.electiveRawScore], ['원점수', record.rawScore],
            ['표준점수', record.standardScore], ['백분위', record.percentile], ['등급', record.grade]
        ].filter(([, value]) => value != null).map(([label, value]) => `${label} ${value}`);
        const score = createConsultingCell(values.join(' · ') || '—');
        decorate?.(score, field, `${area} 성적`);
        row.append(createConsultingCell(area), createConsultingCell(subject || '—'), score);
    }
    content.append(caption, table);
    return content;
}

function renderConsultingSurvey(target, snapshot, decorate) {
    const { studentStatus = {}, conditions = {}, preferences = {}, strategy = {}, qualitative = {}, consent = {} } = snapshot;
    const group = (title, entries) => appendConsultingRecord(target, title, createConsultingFacts(entries, decorate));
    const list = (items, separator = ', ') => Array.isArray(items) ? items.join(separator) : '';
    const yesNo = (value, yes, no) => typeof value === 'boolean' ? (value ? yes : no) : null;
    group('학생 상태', [
        ['지원자 구분', consultingOptionLabel(studentStatus.applicantType, { high_school_senior: '고3 재학생', graduate: '졸업생', qualification_exam: '검정고시' }), 'studentStatus.applicantType'],
        ['졸업 연도', studentStatus.graduationYear, 'studentStatus.graduationYear'],
        ['학교 유형', consultingOptionLabel(studentStatus.schoolType, { general: '일반고', specialized: '특목·특성화고', autonomous: '자율고', other: '기타' }), 'studentStatus.schoolType'],
        ['학교명', studentStatus.schoolName, 'studentStatus.schoolName'], ['거주 지역', studentStatus.residenceRegion, 'studentStatus.residenceRegion']
    ]);
    appendConsultingRecord(target, '학생 입력 성적', renderConsultingScoreTable(snapshot.scores, decorate));
    const commute = conditions.commuteLimit === 'over_120' ? '2시간 이상도 가능'
        : Number.isFinite(conditions.commuteMaxMinutes) ? `${conditions.commuteMaxMinutes}분 이내` : '';
    const conditionsList = [
        ['최대 편도 통학 시간', commute, 'conditions.commuteLimit'],
        ['기숙사 생활', yesNo(conditions.dormitoryAllowed, '가능', '어려움'), 'conditions.dormitoryAllowed'],
        ['재수 가능성', yesNo(conditions.repeatStudyAllowed, '고려 가능', '고려하지 않음'), 'conditions.repeatStudyAllowed']
    ];
    if (conditions.tuitionBudgetAnnual != null) conditionsList.push(['연간 등록금 상한', formatConsultingMoney(conditions.tuitionBudgetAnnual)]);
    group('지원 조건', conditionsList);
    group('희망 지원', Array.isArray(preferences.rankedChoices) ? [
        ...Array.from({ length: 3 }, (_, index) => {
            const { region, university, track } = preferences.rankedChoices[index] || {};
            const fields = index === 0 || preferences.rankedChoices[index]
                ? [[`preferences.rankedChoices.${index}.university`, `${index + 1}지망 대학`], [`preferences.rankedChoices.${index}.track`, `${index + 1}지망 계열`]]
                : [];
            return [`${index + 1}지망`, [region, university, track].filter(Boolean).join(' · '), fields];
        }), ['추가 희망', preferences.additionalPreference, 'preferences.additionalPreference']
    ] : [
        ['희망 지역', list(preferences.desiredRegions)], ['희망 대학', list(preferences.desiredUniversities)],
        ['희망 학과', list(preferences.desiredMajors)], ['희망 계열', list(preferences.desiredTracks)],
        ['필수 후보', list(preferences.requiredCandidates)], ['제외 후보', list(preferences.excludedCandidates)]
    ]);
    const priorityLabels = { region: '지역', major: '전공', brand: '대학 인지도', employment: '취업', commute: '통학' };
    group('지원 전략', [
        ['지원 위험 선호', consultingOptionLabel(strategy.riskTolerance, { safe: '안정 중심', balanced: '균형', challenge: '도전 중심' }), 'strategy.riskTolerance'],
        ['대학 선택 우선순위', Array.isArray(strategy.priorityOrder) ? strategy.priorityOrder.map((key, index) => `${index + 1}. ${consultingOptionLabel(key, priorityLabels)}`).join('\n') : '', 'strategy.priorityOrder']
    ]);
    group('상담 질문', [
        ['상담 주제', formatConsultingSurveyTopics(qualitative.consultationTopics), 'qualitative.consultationTopics'],
        ['비교 중인 선택지와 기준', qualitative.decisionOptions, 'qualitative.decisionOptions'],
        ['상담에서 답을 받고 싶은 질문', list(qualitative.consultationQuestions, '\n'), 'qualitative.consultationQuestions'],
        ['함께 알아야 할 사항', qualitative.specialCircumstances, 'qualitative.specialCircumstances']
    ]);
    group('최종 확인', [
        ['입력 내용 확인', yesNo(consent.accurateInformation, '확인', '미확인'), 'consent.accurateInformation'],
        ['분석 이용 동의', yesNo(consent.analysisUse, '동의', '미동의'), 'consent.analysisUse']
    ]);
}

function renderConsultingVerifiedScores(scores, rawEntry, gradeEntry) {
    const target = document.getElementById('consultingVerifiedScores');
    target.innerHTML = '';
    const records = [...(scores?.records || [])];
    if (gradeEntry && !records.some(record => record.area === 'foreign_language')) records.push({ area: 'foreign_language' });
    consultingScoreRows(records).forEach(({ record, area }) => {
        const row = document.createElement('div');
        row.className = 'consulting-score-editor-row';
        row.dataset.area = String(record.area || '');
        const absolute = ['english', 'korean_history', 'foreign_language'].includes(record.area);
        const parts = [
            record.rawScore != null ? `원점수 ${record.rawScore}점` : '',
            record.commonRawScore != null ? `공통 ${record.commonRawScore}점` : '',
            record.electiveRawScore != null ? `선택 ${record.electiveRawScore}점` : '',
            gradeEntry && absolute && record.grade != null ? `학생 입력 ${record.area === 'foreign_language' ? record.subject + ' ' : ''}${record.grade}등급` : ''
        ].filter(Boolean);
        const label = document.createElement('p');
        label.className = 'consulting-score-editor-source';
        label.textContent = [area, ...parts].join(' · ');
        row.appendChild(label);
        ['subject', 'selection', 'standardScore', 'percentile', 'grade'].forEach(field => {
            const subjectSelect = record.area === 'foreign_language' && field === 'subject';
            const input = document.createElement(subjectSelect ? 'select' : 'input');
            input.dataset.field = field;
            if (subjectSelect) {
                input.add(new Option('응시한 과목만 선택', ''));
                consultingForeignLanguageSubjects.forEach(subject => input.add(new Option(subject, subject)));
            } else input.type = ['standardScore', 'percentile', 'grade'].includes(field) ? 'number' : 'text';
            const placeholder = ({ subject: '과목명', selection: '선택과목', standardScore: '표준점수', percentile: '백분위', grade: '등급' })[field];
            const emptyInquiry = rawEntry && field === 'subject' && record.area === 'inquiry' && /^탐구\s*[12]$/u.test(record.subject);
            input.disabled = rawEntry && (absolute && field !== 'subject' && field !== 'grade' || record.area === 'inquiry' && field === 'selection');
            input.value = input.disabled || emptyInquiry || (gradeEntry && absolute && (field === 'grade' || subjectSelect)) ? '' : record[field] ?? '';
            input.placeholder = placeholder;
            input.setAttribute('aria-label', `${area} ${placeholder}`);
            row.appendChild(input);
        });
        target.appendChild(row);
    });
    target.dataset.examYear = String(scores?.examYear || '');
    target.dataset.examType = String(scores?.examType || '');
}

function renderConsultingMaterialFiles(caseId, files) {
    const target = document.getElementById('consultingMaterialFiles');
    if (!files.length) {
        target.textContent = '등록된 파일이 없습니다.';
        return;
    }
    const list = document.createElement('ul');
    list.className = 'consulting-material-files';
    const labels = { upload_pending: '업로드 대기', quarantined: '보안 검사 중', ready: '검사 완료', linked: '제출됨', rejected: '반려됨' };
    for (const file of files) {
        const row = document.createElement('li');
        const name = file.displayName || '성적표';
        const info = document.createElement('span');
        info.textContent = `${name} · ${consultingOptionLabel(file.status, labels) || '상태 확인 필요'}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'consulting-btn consulting-btn-secondary';
        button.textContent = '열기';
        button.setAttribute('aria-label', `${name} 열기`);
        button.disabled = !['ready', 'linked'].includes(file.status);
        button.addEventListener('click', () => openConsultingMaterialFile(caseId, file.fileId));
        row.append(info, button);
        list.appendChild(row);
    }
    target.replaceChildren(list);
}

const consultingSurveySections = { studentStatus: '학생 상태', scores: '학생 입력 성적', conditions: '지원 조건', preferences: '희망 지원', strategy: '지원 전략', qualitative: '상담 질문', consent: '최종 확인' };
const consultingSurveyFieldNames = {
    applicantType: '지원자 구분', graduationYear: '졸업 연도', schoolType: '학교 유형', schoolName: '학교명', residenceRegion: '거주 지역',
    examYear: '시험 연도', examType: '시험 종류', area: '영역', subject: '과목명', selection: '선택과목', commonRawScore: '공통 원점수',
    electiveRawScore: '선택 원점수', rawScore: '원점수', standardScore: '표준점수', percentile: '백분위', grade: '등급', confirmed: '입력 확인',
    convertedFromRaw: '원점수 환산', commuteLimit: '최대 편도 통학 시간', commuteMaxMinutes: '편도 통학(분)', dormitoryAllowed: '기숙사 생활',
    repeatStudyAllowed: '재수 가능성', tuitionBudgetAnnual: '연간 등록금 상한', region: '지역', university: '대학', track: '계열',
    additionalPreference: '추가 희망', desiredRegions: '희망 지역', desiredUniversities: '희망 대학', desiredMajors: '희망 학과',
    desiredTracks: '희망 계열', requiredCandidates: '필수 후보', excludedCandidates: '제외 후보', riskTolerance: '지원 위험 선호',
    priorityOrder: '대학 선택 우선순위', specialCircumstances: '함께 알아야 할 사항',
    consultationTopics: '상담 주제', decisionOptions: '비교 중인 선택지와 기준', consultationQuestions: '상담에서 답을 받고 싶은 질문',
    accurateInformation: '입력 내용 확인', analysisUse: '분석 이용 동의', formVersion: '양식 버전'
};
const consultingSurveyAnswerLabels = {
    high_school_senior: '고3 재학생', graduate: '졸업생', qualification_exam: '검정고시', general: '일반고', specialized: '특목·특성화고',
    autonomous: '자율고', other: '기타', safe: '안정 중심', balanced: '균형', challenge: '도전 중심', over_120: '2시간 이상도 가능',
    region: '지역', major: '전공', brand: '대학 인지도', employment: '취업', commute: '통학', ...consultingScoreAreas
};
function formatConsultingSurveyTopics(value) {
    return Array.isArray(value) ? value.map(item => consultingOptionLabel(item, consultingSurveyTopicLabels)).join(' · ') : '';
}
function formatConsultingSurveyChange(value, field) {
    if (field === 'consultationTopics') return formatConsultingSurveyTopics(value) || '—';
    if (Array.isArray(value)) return value.map(item => field === 'priorityOrder' ? consultingOptionLabel(item, consultingSurveyAnswerLabels) : item).join(' · ') || '—';
    if (typeof value === 'boolean') return value ? '예' : '아니요';
    if (value == null || value === '') return '—';
    return ['applicantType', 'schoolType', 'riskTolerance', 'area', 'commuteLimit'].includes(field) ? consultingOptionLabel(value, consultingSurveyAnswerLabels) : value;
}
const retiredConsultingAnswerFields = new Set(['strengths', 'concerns', 'guardianOpinion']);
function visibleConsultingSurveyChanges(changes) {
    return (changes || []).filter(({ field }) => field[0] !== 'qualitative' || !retiredConsultingAnswerFields.has(field[1]));
}
function consultingSurveyChangeFacts(changes) {
    return createConsultingFacts(changes.map(({ field, before, after }) => {
        const [section, group, index] = field;
        if (section === 'files') return ['첨부 성적표 변경', `이전 ${before}개 · 변경 후 ${after}개`];
        const slot = group === 'rankedChoices' ? `${Number(index) + 1}지망` : group === 'records' ? `과목 ${Number(index) + 1}` : '';
        const label = [consultingSurveySections[section], slot, consultingSurveyFieldNames[field.at(-1)] || '답변'].filter(Boolean).join(' · ');
        return [label, `이전  ${formatConsultingSurveyChange(before, field.at(-1))}\n변경  ${formatConsultingSurveyChange(after, field.at(-1))}`];
    }));
}

function appendConsultingSupplementEditor(target, field, label, data) {
    if (!data.supplementFields?.includes(field)) return;
    const details = document.createElement('details');
    details.className = 'consulting-supplement-field';
    const summary = document.createElement('summary');
    const note = document.createElement('textarea');
    note.maxLength = 500;
    note.setAttribute('aria-label', `${label} 보완 메모`);
    note.value = data.supplementDraft.get(field)?.note || '';
    details.open = Boolean(note.value);
    const refreshLabel = () => { summary.textContent = note.value.trim() ? `${label} 보완 메모 수정` : `${label} 보완 메모 추가`; };
    refreshLabel();
    note.addEventListener('input', () => {
        if (note.value.trim()) data.supplementDraft.set(field, { label, note: note.value });
        else data.supplementDraft.delete(field);
        refreshLabel();
        document.getElementById('consultingSupplementStatus').textContent = `보완 메모 ${data.supplementDraft.size}개 작성 중`;
    });
    details.append(summary, note);
    target.appendChild(details);
}

function showConsultingSurveyVersion(version) {
    const data = currentConsultingMaterial;
    if (!data) return;
    const original = version === 'original', reviewed = version === 'reviewed';
    const submission = original ? data.originalSubmission : reviewed ? data.reviewedSubmission : data.submission;
    if (!submission?.snapshot) return;
    const current = !original && !reviewed;
    const target = document.getElementById('consultingMaterialSurvey');
    const decorate = current && data.canReview ? (node, fields, label) => {
        for (const [field, fieldLabel] of Array.isArray(fields) ? fields : [[fields, label]]) {
            appendConsultingSupplementEditor(node, field, fieldLabel, data);
        }
    } : undefined;
    target.replaceChildren();
    renderConsultingSurvey(target, submission.snapshot, decorate);
    const files = Array.isArray(submission.fileIds) ? data.files.filter(file => submission.fileIds.includes(file.fileId)) : data.files;
    renderConsultingMaterialFiles(data.case.caseId, files);
    const fileNote = document.getElementById('consultingMaterialFileNote');
    fileNote.replaceChildren();
    decorate?.(fileNote, 'files', '성적표 첨부');
    document.getElementById('consultingMaterialSupplementNotice').hidden = !current || !data.supplement;
    document.getElementById('consultingMaterialSummary').replaceChildren(createConsultingFacts([
        ['제출 시각', formatConsultingDate(submission.submittedAt)],
        ['성적 검수', consultingOptionLabel(data.verification?.status || data.case.scoreVerificationStatus, consultingReviewLabels)],
        ...(current && submission.revision > 0 ? [['변경 저장', `${submission.revision}회`]] : []),
        ...(reviewed && data.surveyReview?.reviewedAt ? [['검수 시각', formatConsultingDate(data.surveyReview.reviewedAt)]] : []),
        ...(submission.supplementAttempt > 0 ? [['보완 제출', `${submission.supplementAttempt}회차`]] : [])
    ]));
    document.getElementById('consultingSurveyConfirmBtn').hidden = !current || !data.canConfirm || data.surveyReview.scoreChanged;
    document.getElementById('consultingMaterialReviewActions').hidden = !current || !(data.canReview || (data.canConfirm && data.surveyReview.scoreChanged));
    document.getElementById('consultingMaterialSupplementActions').hidden = !current || !data.canReview;
}

async function loadConsultingSurveyHistory() {
    const state = consultingSurveyHistory;
    if (!state || state.loading || (state.loaded && !state.before)) return;
    const target = document.getElementById('consultingSurveyHistoryEntries');
    const status = document.getElementById('consultingSurveyHistoryStatus');
    const next = document.getElementById('consultingSurveyHistoryNext');
    state.loading = true;
    next.disabled = true;
    status.textContent = '수정 이력을 불러오는 중입니다.';
    try {
        const data = await requestConsultingAdmin('admin_list_v2_survey_changes', { caseId: state.caseId, ...(state.before ? { before: state.before } : {}) });
        if (consultingSurveyHistory !== state) return;
        if (data.caseId !== state.caseId || !Array.isArray(data.entries)) throw new Error('수정 이력 응답을 확인할 수 없습니다.');
        for (const entry of data.entries) {
            const changes = visibleConsultingSurveyChanges(entry.changes);
            if (changes.length) appendConsultingRecord(target, `${formatConsultingDate(entry.changedAt)} · 학생 저장 ${entry.revision}회차`, consultingSurveyChangeFacts(changes));
        }
        state.loaded = true;
        state.before = data.nextBefore;
        next.hidden = !state.before;
        next.textContent = '이전 수정 더 보기';
        status.textContent = target.children.length ? '' : '표시할 수정 이력이 없습니다.';
    } catch (_error) {
        if (consultingSurveyHistory !== state) return;
        status.textContent = '수정 이력을 불러오지 못했습니다.';
        next.textContent = '수정 이력 다시 불러오기';
        next.hidden = false;
    } finally {
        if (consultingSurveyHistory === state) { state.loading = false; next.disabled = false; }
    }
}
function openConsultingSurveyHistory(open) {
    if (open && !consultingSurveyHistory?.loaded) loadConsultingSurveyHistory();
}

async function openConsultingMaterial(caseId, held) {
    const requestId = ++consultingMaterialRequest;
    closeConsultingMaterialDetail(false);
    const panel = document.getElementById('consultingWorkspaceMaterials');
    const retry = document.getElementById('consultingMaterialRetry');
    panel.setAttribute('aria-busy', 'true');
    setConsultingMaterialStatus('제출 자료를 불러오는 중입니다.', 'loading');
    try {
        const data = await requestConsultingAdmin('admin_get_v2_material_detail', { caseId });
        if (requestId !== consultingMaterialRequest) return false;
        if (data.case?.caseId !== caseId || !Array.isArray(data.files)) throw new Error('자료 응답을 확인할 수 없습니다.');
        const submission = data.submission?.snapshot ? data.submission : data.originalSubmission;
        const snapshot = submission?.snapshot;
        if (!snapshot) {
            if (!['ONBOARDING', 'SURVEY_DRAFT'].includes(data.case.workflowState)) throw new Error('제출본을 확인할 수 없습니다.');
            setConsultingMaterialStatus('아직 제출한 기초조사서가 없습니다.', 'empty');
            return true;
        }
        const review = data.verification;
        const canReview = data.canVerify !== false && !held && data.case.workflowState === 'MATERIAL_REVIEW' && review?.status === 'pending';
        const canConfirm = data.canVerify !== false && !held && data.surveyReview?.needsReview === true;
        currentConsultingMaterial = { ...data, submission, canReview, canConfirm, supplementDraft: new Map() };
        const versionSelect = document.getElementById('consultingSurveyVersion');
        versionSelect.value = 'current';
        versionSelect.options[1].disabled = !data.originalSubmission?.snapshot;
        versionSelect.options[2].disabled = !data.reviewedSubmission?.snapshot;
        document.getElementById('consultingSurveyVersions').hidden = !Number.isSafeInteger(submission.revision);
        document.getElementById('consultingSurveyHistory').hidden = !Number.isSafeInteger(submission.revision);
        consultingSurveyHistory = Number.isSafeInteger(submission.revision) ? { caseId, loading: false, loaded: false, before: null } : null;
        document.getElementById('consultingSurveyReviewNotice').textContent = data.surveyReview?.needsReview
            ? data.surveyReview.scoreChanged ? '학생이 성적 입력을 변경했습니다. 첨부 성적표와 대조한 뒤 최신 답변을 확인해 주세요.'
                : '검수 이후 수정된 답변이 있습니다. 최신 답변을 확인해 주세요.'
            : data.reviewedSubmission ? '현재 답변을 확인했습니다.' : '';
        const reviewChanges = visibleConsultingSurveyChanges(data.surveyReview?.changes);
        if (reviewChanges.length) {
            document.getElementById('consultingSurveyReviewChanges').appendChild(consultingSurveyChangeFacts(reviewChanges));
            document.getElementById('consultingSurveyChangesSinceReview').hidden = false;
        }
        const supplementNotice = document.getElementById('consultingMaterialSupplementNotice');
        if (data.supplement) {
            const title = document.createElement('h3');
            title.textContent = '학생에게 요청한 보완';
            supplementNotice.append(title, createConsultingFacts([
                ['요청 시각', formatConsultingDate(data.supplement.requestedAt)],
                ...(data.supplement.reasonText ? [['공통 안내', data.supplement.reasonText]] : []),
                ...(data.supplement.fields || []).map(({ label, note }) => [label, note])
            ]));
        }
        showConsultingSurveyVersion('current');

        const verification = document.getElementById('consultingMaterialVerification');
        if (review?.verifiedInput) appendConsultingRecord(verification, '관리자 검수 성적', renderConsultingScoreTable(review.verifiedInput));
        if (review?.reason || review?.differences?.length) appendConsultingRecord(verification, '검수 기록', createConsultingFacts([
            ['처리 사유', review.reason], ['차이점', (review.differences || []).join('\n')]
        ]));
        verification.hidden = !verification.children.length;

        const rawEntry = snapshot.formVersion >= 3;
        if (canReview || (canConfirm && data.surveyReview.scoreChanged)) {
            renderConsultingVerifiedScores(snapshot.scores, rawEntry, snapshot.formVersion === 4);
            document.getElementById('consultingMaterialScoreGuide').hidden = !rawEntry;
            document.getElementById('consultingMaterialReviewTitle').textContent = canReview ? '검수 성적 입력' : '변경 성적 다시 검수';
            document.getElementById('consultingMaterialVerifyBtn').textContent = canReview ? '확인 완료 · 일정 선택 열기' : '성적 및 최신 답변 확인';
            const resultSelect = document.getElementById('consultingMaterialResult');
            resultSelect.value = 'matched';
            resultSelect.options[0].textContent = rawEntry ? '성적표 확인 완료' : '입력과 일치';
        }
        document.getElementById('consultingMaterialDetail').hidden = false;
        setConsultingMaterialStatus('', 'success');
        return true;
    } catch (error) {
        if (requestId !== consultingMaterialRequest) return false;
        closeConsultingMaterialDetail(false);
        retry.hidden = false;
        setConsultingMaterialStatus(error?.status === 403 ? '제출 자료 조회 권한을 확인해 주세요.' : '제출 자료를 불러오지 못했습니다.', 'error');
        return false;
    } finally {
        if (requestId === consultingMaterialRequest) panel.setAttribute('aria-busy', 'false');
    }
}

function closeConsultingMaterialDetail(invalidate = true) {
    if (invalidate) consultingMaterialRequest++;
    currentConsultingMaterial = null;
    consultingSurveyHistory = null;
    document.getElementById('consultingWorkspaceMaterials').setAttribute('aria-busy', 'false');
    document.getElementById('consultingMaterialDetail').hidden = true;
    document.getElementById('consultingMaterialRetry').hidden = true;
    document.getElementById('consultingMaterialReviewActions').hidden = true;
    document.getElementById('consultingMaterialSupplementActions').hidden = true;
    const preview = document.getElementById('consultingSupplementPreview');
    if (preview.open) preview.close();
    document.getElementById('consultingSupplementReason').value = 'OTHER';
    document.getElementById('consultingSupplementStatus').textContent = '위 답변 옆에서 보완 메모를 작성하세요.';
    document.getElementById('consultingMaterialVerification').hidden = true;
    for (const id of ['consultingSurveyVersions', 'consultingSurveyChangesSinceReview', 'consultingSurveyHistory', 'consultingSurveyHistoryNext']) document.getElementById(id).hidden = true;
    for (const id of ['consultingSurveyChangesSinceReview', 'consultingSurveyHistory']) document.getElementById(id).open = false;
    for (const id of ['consultingMaterialSummary', 'consultingMaterialSurvey', 'consultingMaterialFiles', 'consultingMaterialVerification', 'consultingVerifiedScores',
        'consultingMaterialSupplementNotice', 'consultingMaterialFileNote', 'consultingSupplementPreviewContent',
        'consultingSurveyReviewChanges', 'consultingSurveyReviewNotice', 'consultingSurveyHistoryStatus', 'consultingSurveyHistoryEntries']) document.getElementById(id)?.replaceChildren();
    for (const id of ['consultingMaterialReason', 'consultingMaterialDifferences', 'consultingSupplementText']) { const node = document.getElementById(id); if (node) node.value = ''; }
}
function resetConsultingMaterial() { closeConsultingMaterialDetail(); setConsultingMaterialStatus(''); }

async function openConsultingMaterialFile(caseId, fileId) {
    const requestId = consultingMaterialRequest;
    try {
        const response = await apiFetch(CONFIG.api.file, { method: 'POST', body: JSON.stringify({ type: 'consulting_get_score_download_url', data: { caseId, fileId } }) });
        const payload = await response.json();
        if (requestId !== consultingMaterialRequest) return;
        const url = payload?.success === true ? payload.data?.downloadUrl : '';
        if (!response.ok || typeof url !== 'string' || !url.startsWith('https://')) throw new Error('파일을 열 수 없습니다.');
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
    } catch (error) {
        if (requestId === consultingMaterialRequest) setConsultingMaterialStatus(error.message || '파일을 열지 못했습니다.', 'error');
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
        })).filter(row => row.area !== 'foreign_language' || row.subject || row.grade != null)
    };
}

async function verifyConsultingMaterials() {
    const requestId = consultingMaterialRequest;
    const data = currentConsultingMaterial;
    const current = data?.case;
    const reason = document.getElementById('consultingMaterialReason').value.trim();
    if (!current || (!data.canReview && !data.canConfirm) || !reason
        || !confirm(data.canReview ? '자료 검수를 완료하고 학생에게 상담 가능 시간 입력 단계를 여시겠습니까?' : '성적표와 대조한 결과를 최신 답변에 반영할까요?')) return;
    const button = document.getElementById('consultingMaterialVerifyBtn');
    button.disabled = true;
    try {
        const result = await requestConsultingAdmin(data.canReview ? 'admin_verify_v2_materials' : 'admin_confirm_v2_survey_revision', {
            caseId: current.caseId, expectedSurveyRevision: data.submission.revision,
            result: document.getElementById('consultingMaterialResult').value, reason,
            differences: document.getElementById('consultingMaterialDifferences').value.split('\n').map(value => value.trim()).filter(Boolean),
            verifiedInput: readConsultingVerifiedScores()
        });
        if (requestId !== consultingMaterialRequest) return;
        closeConsultingMaterialDetail();
        if (await refreshConsultingWorkspaceStudent()) setConsultingMaterialStatus(data.canReview
            ? `학생의 상담 가능 시간 선택을 열었습니다.${result.notificationQueued ? ' 알림톡 발송을 요청했습니다.' : ''}`
            : '성적과 최신 답변을 확인했습니다.', 'success');
    } catch (error) {
        if (requestId !== consultingMaterialRequest) return;
        setConsultingMaterialStatus(error.message || '자료 검수를 완료하지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

async function confirmConsultingSurveyRevision() {
    const requestId = consultingMaterialRequest;
    const data = currentConsultingMaterial;
    if (!data?.canConfirm || data.surveyReview.scoreChanged) return;
    const button = document.getElementById('consultingSurveyConfirmBtn');
    button.disabled = true;
    try {
        await requestConsultingAdmin('admin_confirm_v2_survey_revision', { caseId: data.case.caseId, expectedSurveyRevision: data.submission.revision });
        if (requestId !== consultingMaterialRequest) return;
        closeConsultingMaterialDetail();
        if (await refreshConsultingWorkspaceStudent()) setConsultingMaterialStatus('최신 답변을 확인했습니다.', 'success');
    } catch (error) {
        if (requestId === consultingMaterialRequest) setConsultingMaterialStatus(error.message || '최신 답변을 확인하지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

function readConsultingSupplement(data) {
    const reasonText = document.getElementById('consultingSupplementText').value.trim();
    const notes = Array.from(data.supplementDraft, ([field, { label, note }]) => ({ field, label, note: note.trim() }));
    return { reasonText, notes };
}

function previewConsultingSupplement() {
    const data = currentConsultingMaterial;
    if (!data?.canReview || document.getElementById('consultingMaterialSupplementActions').hidden) return;
    const { reasonText, notes } = readConsultingSupplement(data);
    const status = document.getElementById('consultingSupplementStatus');
    if (!reasonText && !notes.length) { status.textContent = '보완 메모 또는 공통 안내를 작성해 주세요.'; return; }
    if (notes.length > 20) { status.textContent = '보완 메모는 최대 20개 항목에 작성할 수 있습니다.'; return; }
    const content = document.getElementById('consultingSupplementPreviewContent');
    content.replaceChildren(createConsultingFacts([
        ...(reasonText ? [['공통 안내', reasonText]] : []),
        ...notes.map(({ label, note }) => [label, note])
    ]));
    document.getElementById('consultingSupplementPreview').showModal();
}

async function requestConsultingSupplement() {
    const requestId = consultingMaterialRequest;
    const data = currentConsultingMaterial;
    const current = data?.case;
    const preview = document.getElementById('consultingSupplementPreview');
    if (!current || !data.canReview || !preview.open) return;
    const { reasonText, notes } = readConsultingSupplement(data);
    const button = document.getElementById('consultingSupplementBtn');
    if (button.disabled) return;
    button.disabled = true;
    try {
        const result = await requestConsultingAdmin('admin_request_v2_supplement', {
            caseId: current.caseId, expectedSurveyRevision: data.submission.revision,
            reasonCode: document.getElementById('consultingSupplementReason').value, reasonText,
            ...(notes.length ? { fieldNotes: notes.map(({ field, note }) => ({ field, note })) } : {})
        });
        if (requestId !== consultingMaterialRequest) return;
        closeConsultingMaterialDetail();
        if (await refreshConsultingWorkspaceStudent()) setConsultingMaterialStatus(`학생에게 조사서 보완을 요청했습니다.${result.notificationQueued ? ' 알림톡 발송을 요청했습니다.' : ''}`, 'success');
    } catch (error) {
        if (requestId !== consultingMaterialRequest) return;
        preview.close();
        setConsultingMaterialStatus(error.message || '보완 요청을 처리하지 못했습니다.', 'error');
    } finally {
        button.disabled = false;
    }
}

window.addEventListener('pagehide', resetConsultingMaterial);
window.addEventListener('studycrack:session-ended', resetConsultingMaterial);

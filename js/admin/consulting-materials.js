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
        const score = createConsultingCell(values.join(' · ') || '미입력');
        decorate?.(score, field, `${area} 성적`);
        row.append(createConsultingCell(area), createConsultingCell(subject || '—'), score);
    }
    content.append(caption, table);
    return content;
}

function renderConsultingSurvey(target, snapshot, decorate) {
    const { studentStatus = {}, conditions = {}, preferences = {}, strategy = {}, qualitative = {}, consent = {} } = snapshot;
    const section = (key, content) => {
        const panel = document.createElement('section');
        panel.id = `consultingSurveyPanel-${key}`;
        panel.className = 'consulting-survey-section';
        panel.dataset.surveySection = key;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', `consultingSurveyTab-${key}`);
        panel.tabIndex = 0;
        panel.appendChild(content);
        target.appendChild(panel);
    };
    const group = (key, entries) => section(key, createConsultingFacts(entries, decorate));
    const list = (items, separator = ', ') => Array.isArray(items) ? items.join(separator) : '';
    const yesNo = (value, yes, no) => typeof value === 'boolean' ? (value ? yes : no) : null;
    group('studentStatus', [
        ['지원자 구분', consultingOptionLabel(studentStatus.applicantType, { high_school_senior: '고3 재학생', graduate: '졸업생', qualification_exam: '검정고시' }), 'studentStatus.applicantType'],
        ...(studentStatus.applicantType === 'qualification_exam'
            ? [['검정고시 합격 연도 (선택)', studentStatus.qualificationExamYear ?? '입력하지 않음', 'studentStatus.qualificationExamYear']]
            : [[studentStatus.applicantType === 'high_school_senior' ? '졸업 예정 연도' : '졸업 연도', studentStatus.graduationYear, 'studentStatus.graduationYear'],
                ['학교 유형', consultingOptionLabel(studentStatus.schoolType, { general: '일반고', specialized: '특목·특성화고', autonomous: '자율고', other: '기타' }), 'studentStatus.schoolType'],
                ['학교명', studentStatus.schoolName, 'studentStatus.schoolName']]),
        ['거주 지역', studentStatus.residenceRegion, 'studentStatus.residenceRegion']
    ]);
    section('scores', renderConsultingScoreTable(snapshot.scores, decorate));
    const commute = conditions.commuteLimit === 'over_120' ? '2시간 이상도 가능'
        : Number.isFinite(conditions.commuteMaxMinutes) ? `${conditions.commuteMaxMinutes}분 이내` : '';
    const conditionsList = [
        ['최대 편도 통학 시간', commute, 'conditions.commuteLimit'],
        ['기숙사 생활', yesNo(conditions.dormitoryAllowed, '가능', '어려움'), 'conditions.dormitoryAllowed'],
        ['재수 가능성', yesNo(conditions.repeatStudyAllowed, '고려 가능', '고려하지 않음'), 'conditions.repeatStudyAllowed']
    ];
    if (conditions.tuitionBudgetAnnual != null) conditionsList.push(['연간 등록금 상한', formatConsultingMoney(conditions.tuitionBudgetAnnual)]);
    group('conditions', conditionsList);
    group('preferences', Array.isArray(preferences.rankedChoices) ? [
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
    group('strategy', [
        ['지원 위험 선호', consultingOptionLabel(strategy.riskTolerance, { safe: '안정 중심', balanced: '균형', challenge: '도전 중심' }), 'strategy.riskTolerance'],
        ['대학 선택 우선순위', Array.isArray(strategy.priorityOrder) ? strategy.priorityOrder.map((key, index) => `${index + 1}. ${consultingOptionLabel(key, priorityLabels)}`).join('\n') : '', 'strategy.priorityOrder']
    ]);
    group('qualitative', [
        ['상담 주제', formatConsultingSurveyTopics(qualitative.consultationTopics), 'qualitative.consultationTopics'],
        ['비교 중인 선택지와 기준', qualitative.decisionOptions, 'qualitative.decisionOptions'],
        ['상담에서 답을 받고 싶은 질문', list(qualitative.consultationQuestions, '\n'), 'qualitative.consultationQuestions'],
        ['함께 알아야 할 사항', qualitative.specialCircumstances, 'qualitative.specialCircumstances']
    ]);
    group('consent', [
        ['입력 내용 확인', yesNo(consent.accurateInformation, '확인', '미확인'), 'consent.accurateInformation'],
        ['분석 이용 동의', yesNo(consent.analysisUse, '동의', '미동의'), 'consent.analysisUse']
    ]);
}

function renderConsultingVerifiedScores(scores, rawEntry, gradeEntry) {
    const target = document.getElementById('consultingVerifiedScores');
    target.innerHTML = '';
    const records = [...(scores?.records || [])];
    document.getElementById('consultingAddForeignScoreBtn').hidden = !gradeEntry || records.some(record => record.area === 'foreign_language');
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
            input.value = input.disabled || emptyInquiry ? '' : record[field] ?? '';
            input.placeholder = placeholder;
            input.setAttribute('aria-label', `${area} ${placeholder}`);
            const fieldLabel = document.createElement('label');
            fieldLabel.className = 'consulting-score-editor-field';
            const title = document.createElement('span');
            title.textContent = placeholder;
            fieldLabel.hidden = input.disabled;
            fieldLabel.append(title, input);
            row.appendChild(fieldLabel);
        });
        target.appendChild(row);
    });
    target.dataset.examYear = String(scores?.examYear || '');
    target.dataset.examType = String(scores?.examType || '');
    refreshConsultingScoreChanges();
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
    applicantType: '지원자 구분', graduationYear: '졸업 연도', qualificationExamYear: '검정고시 합격 연도', schoolType: '학교 유형', schoolName: '학교명', residenceRegion: '거주 지역',
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

const consultingSurveyReviewItems = [
    { key: 'studentStatus', label: '학생 상태', guide: '지원 자격과 학교·거주 정보를 확인하세요.' },
    { key: 'scores', label: '성적', guide: '학생 입력과 성적표를 대조하고 검수 성적을 확인하세요.' },
    { key: 'conditions', label: '지원 조건', guide: '통학·기숙사·재수 가능성을 확인하세요.' },
    { key: 'preferences', label: '희망 지원', guide: '1~3지망 대학·계열과 추가 희망을 확인하세요.' },
    { key: 'strategy', label: '지원 전략', guide: '위험 선호와 대학 선택 우선순위를 확인하세요.' },
    { key: 'qualitative', label: '상담 질문', guide: '학생이 비교 중인 선택지와 상담 질문을 확인하세요.' },
    { key: 'consent', label: '최종 확인', guide: '동의 내용과 첨부한 성적표를 확인하세요.' }
];
const consultingSurveyNoteSection = field => field === 'files' ? 'consent' : String(field || '').split('.')[0];

function refreshConsultingSurveyComments() {
    const data = currentConsultingMaterial;
    if (!data) return;
    const current = data.surveyVersion === 'current';
    const requested = current ? data.supplement?.fields || [] : [];
    const responses = current ? data.supplementReview?.fields || [] : [];
    const drafts = current ? [...data.supplementDraft] : [];
    for (const item of consultingSurveyReviewItems) {
        const badge = document.getElementById(`consultingSurveyBadge-${item.key}`);
        if (!badge) continue;
        const count = drafts.filter(([field]) => consultingSurveyNoteSection(field) === item.key).length;
        const sent = requested.filter(({ field }) => consultingSurveyNoteSection(field) === item.key).length;
        const replies = responses.filter(({ field }) => consultingSurveyNoteSection(field) === item.key);
        badge.textContent = [count ? `작성 ${count}` : '', sent ? `보완 요청 ${sent}` : '', replies.length ? `보완 답변 ${replies.length}` : '',
            replies.some(reply => !reply.changed) ? `변경 없음 ${replies.filter(reply => !reply.changed).length}` : ''].filter(Boolean).join(' · ');
        badge.hidden = !count && !sent && !replies.length;
    }
    document.getElementById('consultingSurveyCommentDrafts').hidden = !drafts.length;
    document.getElementById('consultingSurveyCommentCount').textContent = String(drafts.length);
    const list = document.getElementById('consultingSurveyCommentList');
    list.replaceChildren();
    for (const [field, { label, note }] of drafts) {
        const row = document.createElement('li');
        const link = document.createElement('button');
        link.type = 'button';
        link.textContent = `${label} · ${note.trim()}`;
        link.addEventListener('click', () => {
            selectConsultingSurveySection(consultingSurveyNoteSection(field));
            const editor = [...document.querySelectorAll('[data-supplement-field]')].find(node => node.dataset.supplementField === field);
            if (editor) { editor.open = true; editor.querySelector('textarea').focus(); }
        });
        row.appendChild(link);
        list.appendChild(row);
    }
    refreshConsultingSurveyDecision();
}

function selectConsultingSurveySection(key, focusTab = false) {
    const data = currentConsultingMaterial;
    const index = consultingSurveyReviewItems.findIndex(item => item.key === key);
    if (!data || index < 0) return;
    data.surveySection = key;
    document.querySelectorAll('#consultingSurveyIndex [role="tab"]').forEach(button => {
        const selected = button.dataset.surveySection === key;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) button.focus();
    });
    document.querySelectorAll('#consultingMaterialSurvey [data-survey-section]').forEach(panel => { panel.hidden = panel.dataset.surveySection !== key; });
    const item = consultingSurveyReviewItems[index];
    document.getElementById('consultingSurveyPosition').textContent = `항목 ${String(index + 1).padStart(2, '0')} / 07`;
    document.getElementById('consultingSurveySectionTitle').textContent = item.label;
    document.getElementById('consultingSurveySectionGuide').textContent = item.guide;
    document.getElementById('consultingMaterialAttachments').hidden = key !== 'consent';
    const current = data.surveyVersion === 'current';
    const verification = document.getElementById('consultingMaterialVerification');
    verification.hidden = key !== 'scores' || !current || !verification.children.length;
    document.getElementById('consultingMaterialReviewActions').hidden = key !== 'scores' || !current || !data.canScoreReview;
    const previous = document.getElementById('consultingSurveyPrevious');
    const next = document.getElementById('consultingSurveyNext');
    previous.disabled = index === 0;
    next.disabled = index === consultingSurveyReviewItems.length - 1;
    previous.textContent = index ? `이전 항목 · ${consultingSurveyReviewItems[index - 1].label}` : '이전 항목';
    next.textContent = index < consultingSurveyReviewItems.length - 1 ? `다음 항목 · ${consultingSurveyReviewItems[index + 1].label}` : '마지막 항목';
}

function moveConsultingSurveySection(delta) {
    if (!currentConsultingMaterial) return;
    const index = consultingSurveyReviewItems.findIndex(item => item.key === currentConsultingMaterial.surveySection);
    const item = consultingSurveyReviewItems[index + delta];
    if (!item) return;
    selectConsultingSurveySection(item.key);
    document.getElementById('consultingSurveySectionTitle').focus();
}

function renderConsultingSurveyIndex() {
    const index = document.getElementById('consultingSurveyIndex');
    index.replaceChildren();
    consultingSurveyReviewItems.forEach((item, position) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'consulting-survey-index-button';
        button.id = `consultingSurveyTab-${item.key}`;
        button.dataset.surveySection = item.key;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-label', item.label);
        button.setAttribute('aria-controls', `consultingSurveyPanel-${item.key}`);
        const number = document.createElement('span');
        number.className = 'consulting-survey-index-number';
        number.setAttribute('aria-hidden', 'true');
        number.textContent = String(position + 1).padStart(2, '0');
        const text = document.createElement('span');
        text.className = 'consulting-survey-index-label';
        const label = document.createElement('span');
        label.textContent = item.label;
        const badge = document.createElement('span');
        badge.id = `consultingSurveyBadge-${item.key}`;
        badge.className = 'consulting-survey-index-badge';
        badge.hidden = true;
        text.append(label, badge);
        button.append(number, text);
        button.addEventListener('click', () => selectConsultingSurveySection(item.key));
        button.addEventListener('keydown', event => {
            let target;
            if (['ArrowDown', 'ArrowRight'].includes(event.key)) target = (position + 1) % consultingSurveyReviewItems.length;
            else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) target = (position + consultingSurveyReviewItems.length - 1) % consultingSurveyReviewItems.length;
            else if (event.key === 'Home') target = 0;
            else if (event.key === 'End') target = consultingSurveyReviewItems.length - 1;
            if (target === undefined) return;
            event.preventDefault();
            selectConsultingSurveySection(consultingSurveyReviewItems[target].key, true);
        });
        index.appendChild(button);
    });
    refreshConsultingSurveyComments();
}

function appendConsultingSupplementEditor(target, field, label, data) {
    appendConsultingSupplementComparison(target, field, data);
    const requested = data.supplement?.fields?.find(item => item.field === field);
    if (requested) {
        const notice = document.createElement('aside');
        notice.className = 'consulting-survey-requested-note';
        const heading = document.createElement('strong');
        heading.textContent = '학생에게 요청한 보완';
        const copy = document.createElement('p');
        copy.textContent = requested.note;
        notice.append(heading, copy);
        target.appendChild(notice);
    }
    if (!data.canReview || !data.supplementFields?.includes(field)) return;
    const details = document.createElement('details');
    details.className = 'consulting-supplement-field';
    details.dataset.supplementField = field;
    const summary = document.createElement('summary');
    const note = document.createElement('textarea');
    note.maxLength = 500;
    note.setAttribute('aria-label', `${label} 보완 메모`);
    note.placeholder = '학생이 어느 부분을 어떻게 보완하면 좋을지 적어주세요.';
    note.value = data.supplementDraft.get(field)?.note || '';
    details.open = Boolean(note.value);
    const refreshLabel = () => {
        summary.textContent = note.value.trim() ? '보완 코멘트 수정' : '보완 코멘트 추가';
        summary.setAttribute('aria-label', `${label} 보완 메모 ${note.value.trim() ? '수정' : '추가'}`);
        details.dataset.filled = String(Boolean(note.value.trim()));
    };
    refreshLabel();
    note.addEventListener('input', () => {
        if (note.value.trim()) data.supplementDraft.set(field, { label, note: note.value });
        else data.supplementDraft.delete(field);
        refreshLabel();
        refreshConsultingSurveyComments();
        const status = document.getElementById('consultingSupplementStatus');
        const message = `보완 코멘트 ${data.supplementDraft.size}개 작성 중 · 미리보기에서 확인 후 전송하세요.`;
        if (status.textContent !== message) status.textContent = message;
    });
    details.append(summary, note);
    target.appendChild(details);
}

function formatConsultingSupplementValue(value, field, data) {
    if (field === 'files') return (value || []).map(id => data.files.find(file => file.fileId === id)?.displayName || '이전 첨부 성적표').join('\n') || '첨부 없음';
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return [value.subject, value.selection, ...[['commonRawScore', '공통'], ['electiveRawScore', '선택'], ['rawScore', '원점수'], ['standardScore', '표준점수'], ['percentile', '백분위'], ['grade', '등급']]
            .filter(([key]) => value[key] != null).map(([key, label]) => `${label} ${value[key]}`)].filter(Boolean).join(' · ') || '—';
    }
    return formatConsultingSurveyChange(value, field.split('.').at(-1));
}

function appendConsultingSupplementComparison(target, field, data) {
    const response = data.supplementReview?.fields?.find(item => item.field === field);
    if (!response) return;
    const details = document.createElement('details'), title = document.createElement('summary');
    details.className = 'consulting-supplement-comparison'; details.open = response.changed;
    title.textContent = response.changed ? '보완 답변 · 수정됨' : '보완 답변 · 변경 없음';
    details.appendChild(title);
    if (response.note) { const note = document.createElement('p'); note.textContent = `보완 요청: ${response.note}`; details.appendChild(note); }
    details.appendChild(createConsultingFacts([
        [data.supplementReview.comparisonBasis === 'initial' ? '최초 답변' : '요청 전 답변', formatConsultingSupplementValue(response.before, field, data)],
        ['재제출 답변', formatConsultingSupplementValue(response.after, field, data)]
    ]));
    target.appendChild(details);
}

function renderConsultingSupplementResponse(data) {
    const response = data.supplementReview;
    const panel = document.getElementById('consultingSupplementResponse');
    panel.hidden = !response;
    if (!response) return;
    document.getElementById('consultingSupplementResponseTitle').textContent = `${response.attempt}차 보완 답변 ${data.case.workflowState === 'MATERIAL_REVIEW' ? '재접수 · 검토 대기' : '접수 내역'}`;
    const unchanged = response.fields.filter(item => !item.changed).length;
    document.getElementById('consultingSupplementResponseSummary').textContent = `${formatConsultingDate(response.submittedAt)} 접수 · 요청 ${response.fields.length}개 · 수정 ${response.fields.length - unchanged}개${unchanged ? ` · 변경 없음 ${unchanged}개` : ''}. 항목을 누르면 요청 내용과 답변 전후를 확인할 수 있습니다.${response.comparisonBasis === 'initial' ? ' 이전 보완 제출은 최초 제출과 비교합니다.' : ''}`;
    const list = document.getElementById('consultingSupplementResponseItems'); list.replaceChildren();
    for (const item of response.fields) {
        const row = document.createElement('li'), button = document.createElement('button');
        button.type = 'button'; button.className = 'consulting-btn consulting-btn-secondary';
        button.textContent = `${item.label} · ${item.changed ? '수정됨' : '변경 없음'}`;
        button.addEventListener('click', () => {
            selectConsultingSurveySection(consultingSurveyNoteSection(item.field), true);
            document.getElementById(`consultingSurveyPanel-${consultingSurveyNoteSection(item.field)}`)?.scrollIntoView({ block: 'start' });
        });
        row.appendChild(button); list.appendChild(row);
    }
}

function showConsultingSurveyVersion(version) {
    const data = currentConsultingMaterial;
    if (!data) return;
    const original = version === 'original', reviewed = version === 'reviewed';
    const submission = original ? data.originalSubmission : reviewed ? data.reviewedSubmission : data.submission;
    if (!submission?.snapshot) return;
    const current = !original && !reviewed;
    data.surveyVersion = current ? 'current' : version;
    const target = document.getElementById('consultingMaterialSurvey');
    const decorate = current ? (node, fields, label) => {
        for (const [field, fieldLabel] of Array.isArray(fields) ? fields : [[fields, label]]) {
            appendConsultingSupplementEditor(node, field, fieldLabel, data);
        }
    } : undefined;
    target.replaceChildren();
    renderConsultingSurvey(target, submission.snapshot, decorate);
    renderConsultingSurveyIndex();
    const files = Array.isArray(submission.fileIds) ? data.files.filter(file => submission.fileIds.includes(file.fileId)) : data.files;
    renderConsultingMaterialFiles(data.case.caseId, files);
    const fileNote = document.getElementById('consultingMaterialFileNote');
    fileNote.replaceChildren();
    decorate?.(fileNote, 'files', '성적표 첨부');
    document.getElementById('consultingMaterialSupplementNotice').hidden = !current || !data.supplement;
    document.getElementById('consultingSupplementResponse').hidden = !current || !data.supplementReview;
    document.getElementById('consultingMaterialSummary').replaceChildren(createConsultingFacts([
        ['제출 시각', formatConsultingDate(submission.submittedAt)],
        ['성적 검수', consultingOptionLabel(data.verification?.status || data.case.scoreVerificationStatus, consultingReviewLabels)],
        ...(current && submission.revision > 0 ? [['변경 저장', `${submission.revision}회`]] : []),
        ...(reviewed && data.surveyReview?.reviewedAt ? [['검수 시각', formatConsultingDate(data.surveyReview.reviewedAt)]] : []),
        ...(submission.supplementAttempt > 0 ? [['보완 제출', `${submission.supplementAttempt}회차`]] : [])
    ]));
    refreshConsultingSurveyDecision();
    selectConsultingSurveySection(data.surveySection || consultingSurveyNoteSection(data.supplementReview?.fields?.find(item => item.changed)?.field || 'studentStatus'));
    refreshConsultingSurveyDecision();
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
            if (changes.length) appendConsultingRecord(target, `${formatConsultingDate(entry.changedAt)} · ${entry.kind === 'supplement' ? '보완 재제출' : '학생 저장'} ${entry.revision}회차`, consultingSurveyChangeFacts(changes));
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
        if (typeof prepareConsultingReference === 'function') prepareConsultingReference(caseId);
        const submission = data.submission?.snapshot ? data.submission : data.originalSubmission;
        const snapshot = submission?.snapshot;
        if (!snapshot) {
            if (!['ONBOARDING', 'SURVEY_DRAFT'].includes(data.case.workflowState)) throw new Error('제출본을 확인할 수 없습니다.');
            setConsultingMaterialStatus('아직 제출한 기초조사서가 없습니다.', 'empty');
            return true;
        }
        const review = data.verification;
        const canReview = data.canVerify !== false && !held && data.case.workflowState === 'MATERIAL_REVIEW';
        const canConfirm = data.canVerify !== false && !held && data.surveyReview?.needsReview === true;
        const canScoreReview = data.canVerify !== false && !held && (data.canReviewScores === true || Boolean(data.correctionScoreDigest) || data.canReviewScores === undefined && (canReview || canConfirm && data.surveyReview.scoreChanged));
        const canApproveSurvey = data.canVerify !== false && !held && !data.correctionScoreDigest && (data.surveyReview?.canApprove ?? (canReview || canConfirm));
        currentConsultingMaterial = { ...data, submission, canReview, canConfirm, canScoreReview, canApproveSurvey, supplementDraft: new Map(), mutating: false };
        renderConsultingSupplementResponse(data);
        const versionSelect = document.getElementById('consultingSurveyVersion');
        versionSelect.value = 'current';
        versionSelect.options[1].disabled = !data.originalSubmission?.snapshot;
        versionSelect.options[2].disabled = !data.reviewedSubmission?.snapshot;
        document.getElementById('consultingSurveyVersions').hidden = !Number.isSafeInteger(submission.revision);
        document.getElementById('consultingSurveyHistory').hidden = !Number.isSafeInteger(submission.revision);
        consultingSurveyHistory = Number.isSafeInteger(submission.revision) ? { caseId, loading: false, loaded: false, before: null } : null;
        document.getElementById('consultingSurveyReviewNotice').textContent = data.correctionScoreDigest
            ? '공개 후 정정 작업 중입니다. 검수 성적을 바꾸면 계산과 승인을 새로 진행하며, 기존 공개 보고서는 그대로 유지됩니다.'
            : data.surveyReview?.needsReview
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
            const ledger = document.createElement('details');
            const title = document.createElement('summary');
            title.textContent = `학생에게 요청한 보완 · ${data.supplement.fields?.length || 0}개 항목`;
            ledger.append(title, createConsultingFacts([
                ['요청 시각', formatConsultingDate(data.supplement.requestedAt)],
                ...(data.supplement.reasonText ? [['공통 안내', data.supplement.reasonText]] : []),
                ...(data.supplement.fields || []).map(({ label, note }) => [label, note])
            ]));
            supplementNotice.appendChild(ledger);
        }
        showConsultingSurveyVersion('current');

        const verification = document.getElementById('consultingMaterialVerification');
        if (review?.verifiedInput) appendConsultingRecord(verification, '관리자 검수 성적', renderConsultingScoreTable(review.verifiedInput));
        if (review?.reason || review?.differences?.length) appendConsultingRecord(verification, '검수 기록', createConsultingFacts([
            ['처리 사유', review.reason], ['차이점', (review.differences || []).join('\n')]
        ]));
        verification.hidden = !verification.children.length;

        const rawEntry = snapshot.formVersion >= 3;
        if (canScoreReview) {
            const verifiedScores = review?.verifiedInput && (data.correctionScoreDigest || !data.surveyReview?.scoreChanged) ? review.verifiedInput : null;
            renderConsultingVerifiedScores(verifiedScores || snapshot.scores, rawEntry, snapshot.formVersion === 4 && !data.correctionScoreDigest);
            document.getElementById('consultingMaterialReviewTitle').textContent = data.correctionScoreDigest ? '보고서 정정을 위한 성적 재검수' : '공식 성적 확인·정정';
            document.getElementById('consultingMaterialVerifyBtn').textContent = data.correctionScoreDigest ? '정정 성적 저장' : '공식 성적 확인·저장';
        }
        selectConsultingSurveySection(currentConsultingMaterial.surveySection || 'studentStatus');
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
    if (typeof resetConsultingReference === 'function') resetConsultingReference();
    currentConsultingMaterial = null;
    consultingSurveyHistory = null;
    document.getElementById('consultingWorkspaceMaterials').setAttribute('aria-busy', 'false');
    document.getElementById('consultingMaterialDetail').hidden = true;
    document.getElementById('consultingMaterialRetry').hidden = true;
    document.getElementById('consultingMaterialReviewActions').hidden = true;
    document.getElementById('consultingMaterialSupplementActions').hidden = true;
    const preview = document.getElementById('consultingSupplementPreview');
    if (preview.open) preview.close();
    document.getElementById('consultingScoreEditorDetails').open = false;
    document.getElementById('consultingSupplementStatus').textContent = '위 답변 옆에서 보완 메모를 작성하세요.';
    document.getElementById('consultingMaterialVerification').hidden = true;
    document.getElementById('consultingMaterialAttachments').hidden = true;
    document.getElementById('consultingSurveyCommentDrafts').hidden = true;
    document.getElementById('consultingSurveyCommentDrafts').open = false;
    for (const id of ['consultingSurveyPrevious', 'consultingSurveyNext']) document.getElementById(id).disabled = true;
    for (const id of ['consultingSurveyVersions', 'consultingSurveyChangesSinceReview', 'consultingSurveyHistory', 'consultingSurveyHistoryNext', 'consultingSupplementResponse']) document.getElementById(id).hidden = true;
    for (const id of ['consultingSurveyChangesSinceReview', 'consultingSurveyHistory']) document.getElementById(id).open = false;
    for (const id of ['consultingMaterialSummary', 'consultingMaterialSurvey', 'consultingSurveyIndex', 'consultingSurveyCommentList', 'consultingSurveyPosition', 'consultingSurveySectionTitle', 'consultingSurveySectionGuide', 'consultingMaterialFiles', 'consultingMaterialVerification', 'consultingVerifiedScores',
        'consultingMaterialSupplementNotice', 'consultingMaterialFileNote', 'consultingSupplementPreviewContent', 'consultingSurveyApprovalStatus', 'consultingScoreChanges', 'consultingScoreReviewStatus', 'consultingSupplementResponseSummary', 'consultingSupplementResponseItems',
        'consultingSurveyReviewChanges', 'consultingSurveyReviewNotice', 'consultingSurveyHistoryStatus', 'consultingSurveyHistoryEntries']) document.getElementById(id)?.replaceChildren();
    for (const id of ['consultingMaterialReason']) { const node = document.getElementById(id); if (node) node.value = ''; }
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

function refreshConsultingSurveyDecision() {
    const data = currentConsultingMaterial;
    if (!data) return;
    const current = data.surveyVersion === 'current';
    document.getElementById('consultingMaterialSupplementActions').hidden = !current;
    const approve = document.getElementById('consultingSurveyConfirmBtn');
    approve.hidden = !data.canApproveSurvey;
    approve.disabled = data.mutating || data.supplementDraft.size > 0;
    approve.textContent = data.canReview ? '조사서 승인 · 일정 선택 열기' : '최신 답변 확인';
    const supplement = document.getElementById('consultingSupplementPreviewBtn');
    supplement.hidden = !data.canReview || !data.supplementDraft.size;
    supplement.disabled = data.mutating;
    document.getElementById('consultingMaterialVerifyBtn').disabled = data.mutating;
    document.getElementById('consultingSupplementBtn').disabled = data.mutating;
    document.getElementById('consultingSurveyVersion').disabled = data.mutating;
    const approved = data.surveyReview?.approved ?? (!data.canReview && !data.canConfirm);
    const scores = ['matched', 'corrected'].includes(data.verification?.status) && !data.surveyReview?.scoreChanged;
    document.getElementById('consultingSurveyApprovalStatus').textContent = [
        approved ? '현재 조사서 확인 완료' : data.canApproveSurvey ? '현재 조사서 승인 대기' : '현재 단계에서는 조사서를 읽을 수 있습니다.',
        scores ? '공식 성적 확인 완료' : '공식 성적 미확인 · 성적 확인은 별도로 진행합니다.'
    ].join(' · ');
    document.getElementById('consultingSupplementStatus').textContent = data.supplementDraft.size
        ? `보완 메모 ${data.supplementDraft.size}개를 전송하거나 정리한 뒤 승인하세요.` : '';
}

function setConsultingMaterialBusy(data, busy) {
    if (currentConsultingMaterial !== data) return;
    data.mutating = busy;
    refreshConsultingSurveyDecision();
}

function addConsultingForeignScore() {
    const data = currentConsultingMaterial;
    if (!data?.canScoreReview || data.mutating) return;
    const scores = readConsultingVerifiedScores();
    if (!scores.records.some(record => record.area === 'foreign_language')) scores.records.push({ area: 'foreign_language' });
    renderConsultingVerifiedScores(scores, data.submission.snapshot.formVersion >= 3, true);
}

function validateConsultingScoreReview(scores) {
    for (const { record, area } of consultingScoreRows(scores.records)) {
        const missing = [];
        if (!record.subject) missing.push('과목명');
        if (!Number.isInteger(record.grade) || record.grade < 1 || record.grade > 9) missing.push('등급(1~9)');
        if (['korean', 'math', 'inquiry'].includes(record.area)) {
            if (record.area !== 'inquiry' && !record.selection) missing.push('선택과목');
            for (const [field, label, max] of [['standardScore', '표준점수', 200], ['percentile', '백분위', 100]]) {
                if (!Number.isInteger(record[field]) || record[field] < 0 || record[field] > max) missing.push(label);
            }
        }
        if (missing.length) return `${area} ${missing.join(' · ')}을 확인해 주세요. 조사서 승인은 아래에서 따로 진행할 수 있습니다.`;
    }
    return '';
}

function consultingScoreDifferences(scores) {
    const data = currentConsultingMaterial;
    const before = data?.verification?.verifiedInput?.records || data?.submission?.snapshot?.scores?.records || [];
    const differences = [], seen = new Map();
    for (const { record, area } of consultingScoreRows(scores.records)) {
        const index = seen.get(record.area) || 0;
        seen.set(record.area, index + 1);
        const original = before.filter(row => row.area === record.area)[index];
        if (!original) continue;
        for (const [field, label] of [['subject', '과목명'], ['selection', '선택과목'], ['standardScore', '표준점수'], ['percentile', '백분위'], ['grade', '등급']]) {
            if (original[field] == null || original[field] === '' || field === 'subject' && /^탐구\s*[12]$/u.test(original[field])) continue;
            if (String(original[field]).trim() !== String(record[field] ?? '').trim()) differences.push(`${area} ${label}: ${original[field]} → ${record[field] ?? '미입력'}`);
        }
    }
    if (before.some(row => row.area === 'foreign_language') && !scores.records.some(row => row.area === 'foreign_language')) differences.push('제2외국어·한문: 응시 성적을 미응시로 정정');
    return differences;
}

function refreshConsultingScoreChanges() {
    const differences = consultingScoreDifferences(readConsultingVerifiedScores());
    document.getElementById('consultingScoreChanges').textContent = differences.length ? `변경 항목 · ${differences.join(' / ')}` : '';
}

async function verifyConsultingMaterials() {
    const requestId = consultingMaterialRequest, data = currentConsultingMaterial;
    if (!data?.canScoreReview || data.mutating || data.surveyVersion !== 'current') return;
    const scores = readConsultingVerifiedScores(), reason = document.getElementById('consultingMaterialReason').value.trim();
    const status = document.getElementById('consultingScoreReviewStatus');
    const error = validateConsultingScoreReview(scores);
    if (error) { status.textContent = error; status.dataset.state = 'error'; return; }
    const differences = consultingScoreDifferences(scores);
    if (differences.length && !reason) { status.textContent = '값을 바꾼 이유를 정정 사유에 적어주세요.'; status.dataset.state = 'error'; return; }
    if (!confirm(data.correctionScoreDigest ? '정정 성적을 반영할까요? 계산과 승인을 다시 진행하며, 기존 공개 보고서는 그대로 유지됩니다.' : '성적표와 대조한 공식 성적을 저장할까요? 상담 일정은 그대로 유지됩니다.')) return;
    setConsultingMaterialBusy(data, true);
    try {
        const correction = Boolean(data.correctionScoreDigest);
        const result = await requestConsultingAdmin(correction ? 'admin_confirm_v2_survey_revision' : 'admin_review_v2_scores', {
            caseId: data.case.caseId, expectedSurveyRevision: data.submission.revision ?? 0,
            ...(correction ? { expectedCorrectionScoreDigest: data.correctionScoreDigest, result: differences.length ? 'corrected' : data.verification?.status || 'matched', differences } : { expectedScoreDigest: data.scoreReviewDigest }),
            reason, verifiedInput: scores
        });
        if (requestId !== consultingMaterialRequest) return;
        closeConsultingMaterialDetail();
        if (await refreshConsultingWorkspaceStudent()) setConsultingMaterialStatus(result.unchanged ? '저장된 성적과 같습니다.' : '성적을 확인했습니다. 조사서 승인과 상담 일정은 그대로 유지됩니다.', 'success');
    } catch (error) {
        if (requestId !== consultingMaterialRequest) return;
        status.textContent = error.message || '성적을 저장하지 못했습니다.';
        status.dataset.state = 'error';
    } finally { setConsultingMaterialBusy(data, false); }
}

async function approveConsultingSurvey() {
    const requestId = consultingMaterialRequest, data = currentConsultingMaterial;
    if (!data?.canApproveSurvey || data.mutating || data.surveyVersion !== 'current') return;
    if (data.supplementDraft.size) { refreshConsultingSurveyDecision(); return; }
    if (!confirm(data.canReview ? '현재 조사서를 승인하고 학생의 상담 가능 시간 선택을 열까요? 공식 성적 확인은 별도로 진행합니다.' : '현재 조사서를 확인한 답변으로 승인할까요? 상담 일정은 그대로 유지됩니다.')) return;
    setConsultingMaterialBusy(data, true);
    try {
        const result = await requestConsultingAdmin('admin_approve_v2_survey', { caseId: data.case.caseId, expectedSurveyRevision: data.submission.revision ?? 0 });
        if (requestId !== consultingMaterialRequest) return;
        closeConsultingMaterialDetail();
        if (await refreshConsultingWorkspaceStudent()) setConsultingMaterialStatus(result.unchanged ? '이미 승인한 조사서입니다. 현재 진행 상태를 확인해 주세요.'
            : result.workflowState === 'AVAILABILITY_REQUIRED' ? `학생의 상담 가능 시간 선택을 열었습니다.${result.notificationQueued ? ' 알림톡 발송을 요청했습니다.' : ''}`
            : '최신 답변을 확인했습니다.', 'success');
        if (typeof refreshConsultingSupplementAlerts === 'function') refreshConsultingSupplementAlerts();
    } catch (error) {
        if (requestId === consultingMaterialRequest) setConsultingMaterialStatus(error.message || '조사서를 승인하지 못했습니다.', 'error');
    } finally { setConsultingMaterialBusy(data, false); }
}

function readConsultingSupplement(data) {
    const reasonText = '';
    const notes = Array.from(data.supplementDraft, ([field, { label, note }]) => ({ field, label, note: note.trim() }));
    return { reasonText, notes };
}

function previewConsultingSupplement() {
    const data = currentConsultingMaterial;
    if (!data?.canReview || data.mutating || document.getElementById('consultingMaterialSupplementActions').hidden) return;
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
    if (!current || !data.canReview || data.mutating || !preview.open) return;
    const { reasonText, notes } = readConsultingSupplement(data);
    const button = document.getElementById('consultingSupplementBtn');
    if (button.disabled) return;
    setConsultingMaterialBusy(data, true);
    try {
        const result = await requestConsultingAdmin('admin_request_v2_supplement', {
            caseId: current.caseId, expectedSurveyRevision: data.submission.revision,
            reasonCode: 'OTHER', reasonText,
            ...(notes.length ? { fieldNotes: notes.map(({ field, note }) => ({ field, note })) } : {})
        });
        if (requestId !== consultingMaterialRequest) return;
        closeConsultingMaterialDetail();
        if (await refreshConsultingWorkspaceStudent()) setConsultingMaterialStatus(`학생에게 조사서 보완을 요청했습니다.${result.notificationQueued ? ' 알림톡 발송을 요청했습니다.' : ''}`, 'success');
        if (typeof refreshConsultingSupplementAlerts === 'function') refreshConsultingSupplementAlerts();
    } catch (error) {
        if (requestId !== consultingMaterialRequest) return;
        preview.close();
        setConsultingMaterialStatus(error.message || '보완 요청을 처리하지 못했습니다.', 'error');
    } finally {
        setConsultingMaterialBusy(data, false);
    }
}

window.addEventListener('pagehide', resetConsultingMaterial);
window.addEventListener('studycrack:session-ended', resetConsultingMaterial);

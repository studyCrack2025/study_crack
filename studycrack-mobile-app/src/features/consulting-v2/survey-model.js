export const SURVEY_STEPS = Object.freeze([
  { key: 'studentStatus', label: '학생 상태', guide: '지원자 구분과 거주 지역부터 알려주세요. 지원 자격과 통학 여건을 함께 살펴볼게요.' },
  { key: 'scores', label: '성적', guide: '2027학년도 수능 원점수나 성적표 수치를 입력해 주세요. 자동으로 채워진 수치는 제출 전에 확인할 수 있어요.' },
  { key: 'conditions', label: '지원 조건', guide: '편도 통학 시간과 진학할 때 고려할 조건을 알려주세요.' },
  { key: 'preferences', label: '희망 지원', guide: '가장 희망하는 지원 방향부터 최대 3지망까지 알려주세요.' },
  { key: 'strategy', label: '지원 전략', guide: '어떤 지원을 선호하는지, 그리고 대학을 선택할 때 무엇이 중요한지 알려주세요.' },
  { key: 'qualitative', label: '상담 질문', guide: '성적과 희망 조건만으로 알기 어려운 고민을 적어주세요. 서면 상담에서 함께 다룹니다.' },
  { key: 'consent', label: '최종 확인', guide: '성적표 검사와 두 가지 확인을 마친 뒤 제출해주세요. 상담 준비에 필요한 자료를 검토합니다.' }
]);

export const SCORE_ROWS = Object.freeze([
  ['korean', '국어'], ['math', '수학'], ['english', '영어'], ['inquiry', '탐구 1'], ['inquiry', '탐구 2'], ['korean_history', '한국사']
]);

export const PRIORITY_LABELS = Object.freeze({ region: '지역', major: '전공', brand: '대학 인지도', employment: '취업', commute: '통학' });
export const SURVEY_FORM_VERSION = 2;
export const CONSULTING_SURVEY_EXAM = Object.freeze({ examYear: 2026, examType: 'csat' });
export const COMMUTE_OPTIONS = Object.freeze([
  ['30', '30분 이내'], ['60', '1시간 이내'], ['90', '1시간 30분 이내'], ['120', '2시간 이내'], ['over_120', '2시간 이상도 가능']
]);
export const MAX_RANKED_CHOICES = 3;
export const ADDITIONAL_PREFERENCE_MAX = 3500;
export const EMPTY_RANKED_CHOICE = Object.freeze({ region: '', university: '', track: '' });

export function isConsultingSurveyExam(value) {
  return value?.examYear === CONSULTING_SURVEY_EXAM.examYear && value?.examType === CONSULTING_SURVEY_EXAM.examType;
}

const hasText = value => typeof value === 'string' && Boolean(value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim());
const integerInRange = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const choiceKey = ({ region, university, track }) => JSON.stringify([region, university, track]);

export const hasRankedChoice = ({ region, university, track }) => [region, university, track].some(hasText);
export const hasPreviousExamScores = scores => !isConsultingSurveyExam(scores) && Array.isArray(scores?.records) && scores.records.some(row => row.selection || row.confirmed
  || [row.rawScore, row.commonRawScore, row.electiveRawScore, row.standardScore, row.percentile, row.grade].some(value => value != null)
  || (row.area === 'inquiry' && row.subject && !['탐구 1', '탐구 2'].includes(row.subject)));

function normalizePreferences(preferences = {}) {
  if (Array.isArray(preferences.rankedChoices)) {
    return { rankedChoices: preferences.rankedChoices, additionalPreference: preferences.additionalPreference || '' };
  }
  const legacyFields = [
    ['지역', preferences.desiredRegions],
    ['대학', preferences.desiredUniversities],
    ['학과', preferences.desiredMajors],
    ['계열', preferences.desiredTracks],
    ['꼭 검토할 후보', preferences.requiredCandidates]
  ];
  const previous = legacyFields.filter(([, items]) => items?.length).map(([label, items]) => `${label} — ${items.join(', ')}`);
  return {
    rankedChoices: [],
    additionalPreference: previous.length ? ['이전 조사서에 적은 희망', ...previous].join('\n').slice(0, ADDITIONAL_PREFERENCE_MAX) : ''
  };
}

export function createEmptySurvey() {
  return {
    formVersion: SURVEY_FORM_VERSION,
    studentStatus: { graduationYear: 2027, applicantType: '', schoolType: '', schoolName: '', residenceRegion: '' },
    scores: { ...CONSULTING_SURVEY_EXAM, records: SCORE_ROWS.map(([area, label]) => ({ area, subject: label, selection: '', standardScore: null, percentile: null, grade: null, confirmed: false })) },
    conditions: { commuteLimit: '', commuteMaxMinutes: null, dormitoryAllowed: false, repeatStudyAllowed: false },
    preferences: { rankedChoices: [], additionalPreference: '' },
    strategy: { riskTolerance: '', priorityOrder: ['region', 'major', 'brand', 'employment', 'commute'] },
    qualitative: { strengths: '', concerns: '', guardianOpinion: '', specialCircumstances: '', consultationQuestions: [] },
    consent: { accurateInformation: false, analysisUse: false }
  };
}

export function normalizeSurveyDraft(snapshot) {
  const empty = createEmptySurvey();
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return empty;
  const { commuteLimit, commuteMaxMinutes, dormitoryAllowed, repeatStudyAllowed } = snapshot.conditions || {};
  const previousLimit = String(commuteMaxMinutes ?? '');
  const hasMatchingLimit = COMMUTE_OPTIONS.some(([key]) => key === previousLimit);
  const previousPriorities = Array.isArray(snapshot.strategy?.priorityOrder) ? snapshot.strategy.priorityOrder : [];
  const priorityOrder = [...new Set([...previousPriorities.filter(key => Object.hasOwn(PRIORITY_LABELS, key)), ...empty.strategy.priorityOrder])];
  return {
    ...empty,
    studentStatus: { ...empty.studentStatus, ...(snapshot.studentStatus || {}) },
    scores: isConsultingSurveyExam(snapshot.scores) && Array.isArray(snapshot.scores.records) && snapshot.scores.records.length ? snapshot.scores : empty.scores,
    conditions: {
      commuteLimit: commuteLimit ?? (hasMatchingLimit ? previousLimit : ''),
      commuteMaxMinutes: commuteMaxMinutes ?? null,
      dormitoryAllowed: dormitoryAllowed ?? false,
      repeatStudyAllowed: repeatStudyAllowed ?? false
    },
    preferences: normalizePreferences(snapshot.preferences || {}),
    strategy: { ...empty.strategy, ...snapshot.strategy, priorityOrder },
    qualitative: { ...empty.qualitative, ...(snapshot.qualitative || {}), consultationQuestions: Array.isArray(snapshot.qualitative?.consultationQuestions) ? snapshot.qualitative.consultationQuestions : [] },
    consent: { ...empty.consent, ...(snapshot.consent || {}) }
  };
}

export function surveySaveSnapshot(snapshot) {
  return {
    ...snapshot,
    qualitative: {
      ...snapshot.qualitative,
      consultationQuestions: snapshot.qualitative.consultationQuestions.filter(hasText)
    }
  };
}

export function clientSurveyError(snapshot, readyFiles) {
  const issue = (section, message) => ({ section, message });
  if (!snapshot.studentStatus.applicantType) return issue('studentStatus', '지원자 구분을 선택해주세요.');
  if (!integerInRange(snapshot.studentStatus.graduationYear, 2020, 2027)) return issue('studentStatus', '졸업 연도를 2020~2027 사이로 입력해주세요.');
  if (!hasText(snapshot.studentStatus.residenceRegion)) return issue('studentStatus', '거주 지역을 입력해주세요.');
  if (!isConsultingSurveyExam(snapshot.scores)) return issue('scores', '2027학년도 수능 성적을 입력해주세요.');
  const required = snapshot.scores.records.filter(row => ['korean', 'math', 'english', 'inquiry'].includes(row.area));
  const missingArea = ['korean', 'math', 'english', 'inquiry'].some(area => required.filter(row => row.area === area).length !== (area === 'inquiry' ? 2 : 1));
  if (missingArea || required.some(row => !hasText(row.subject) || !integerInRange(row.grade, 1, 9) || row.confirmed !== true)) {
    return issue('scores', '국어·수학·영어·탐구 2과목의 과목명, 등급, 확인 체크를 완료해주세요.');
  }
  if (snapshot.scores.records.some(row => row.area === 'korean_history' && (!hasText(row.subject) || (row.grade != null && row.confirmed !== true)))) {
    return issue('scores', '한국사 과목명을 확인하고, 등급을 입력했다면 성적표와 확인에 체크해주세요.');
  }
  if (!snapshot.conditions.commuteLimit) return issue('conditions', '최대 편도 통학 시간을 선택해주세요.');
  const { rankedChoices, additionalPreference } = snapshot.preferences;
  const filledChoices = rankedChoices.filter(hasRankedChoice);
  if (!filledChoices.length && !hasText(additionalPreference)) return issue('preferences', '희망 지원을 선택하거나 추가 희망을 적어주세요.');
  if (rankedChoices.slice(0, filledChoices.length).some(choice => !hasRankedChoice(choice))) return issue('preferences', '앞 지망부터 채우거나 빈 지망을 삭제해주세요.');
  if (new Set(filledChoices.map(choiceKey)).size !== filledChoices.length) return issue('preferences', '같은 희망 지원이 두 번 선택되었습니다. 지망을 확인해주세요.');
  if (!snapshot.strategy.riskTolerance || snapshot.strategy.priorityOrder.length !== 5) return issue('strategy', '지원 위험 선호와 5개 우선순위를 확인해주세요.');
  if (!snapshot.qualitative.consultationQuestions.some(hasText)) return issue('qualitative', '상담에서 확인할 질문을 한 가지 이상 입력해주세요.');
  if (!snapshot.consent.accurateInformation || !snapshot.consent.analysisUse) return issue('consent', '최종 확인과 분석 이용 동의가 필요합니다.');
  if (!readyFiles.length) return issue('consent', '검사가 완료된 성적표 파일이 필요합니다.');
  return null;
}

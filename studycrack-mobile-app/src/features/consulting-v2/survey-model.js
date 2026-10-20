export const SURVEY_STEPS = Object.freeze([
  { key: 'studentStatus', label: '학생 상태' },
  { key: 'scores', label: '성적' },
  { key: 'conditions', label: '지원 조건' },
  { key: 'preferences', label: '희망 지원' },
  { key: 'strategy', label: '지원 전략' },
  { key: 'qualitative', label: '상담 질문' },
  { key: 'consent', label: '최종 확인' }
]);

export const SCORE_ROWS = Object.freeze([
  ['korean', '국어'], ['math', '수학'], ['english', '영어'], ['inquiry', '탐구 1'], ['inquiry', '탐구 2'], ['korean_history', '한국사']
]);

export const PRIORITY_LABELS = Object.freeze({ region: '지역', major: '전공', brand: '대학 인지도', employment: '취업', commute: '통학' });

export function createEmptySurvey() {
  return {
    studentStatus: { graduationYear: 2027, applicantType: '', schoolType: '', schoolName: '', residenceRegion: '' },
    scores: { examYear: 2026, examType: '', records: SCORE_ROWS.map(([area, label]) => ({ area, subject: label, selection: '', standardScore: null, percentile: null, grade: null, confirmed: false })) },
    conditions: { tuitionBudgetAnnual: null, commuteMaxMinutes: 60, dormitoryAllowed: false, repeatStudyAllowed: false },
    preferences: { desiredRegions: [], desiredUniversities: [], desiredMajors: [], desiredTracks: [], requiredCandidates: [], excludedCandidates: [] },
    strategy: { riskTolerance: '', priorityOrder: ['region', 'major', 'brand', 'employment', 'commute'] },
    qualitative: { strengths: '', concerns: '', guardianOpinion: '', specialCircumstances: '', consultationQuestions: [''] },
    consent: { accurateInformation: false, analysisUse: false }
  };
}

export function normalizeSurveyDraft(snapshot) {
  const empty = createEmptySurvey();
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return empty;
  return {
    studentStatus: { ...empty.studentStatus, ...(snapshot.studentStatus || {}) },
    scores: { ...empty.scores, ...(snapshot.scores || {}), records: Array.isArray(snapshot.scores?.records) && snapshot.scores.records.length ? snapshot.scores.records : empty.scores.records },
    conditions: { ...empty.conditions, ...(snapshot.conditions || {}) },
    preferences: { ...empty.preferences, ...(snapshot.preferences || {}) },
    strategy: { ...empty.strategy, ...(snapshot.strategy || {}) },
    qualitative: { ...empty.qualitative, ...(snapshot.qualitative || {}), consultationQuestions: Array.isArray(snapshot.qualitative?.consultationQuestions) && snapshot.qualitative.consultationQuestions.length ? snapshot.qualitative.consultationQuestions : [''] },
    consent: { ...empty.consent, ...(snapshot.consent || {}) }
  };
}

export function splitList(value, maxItems) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean).filter((item, index, list) => list.indexOf(item) === index).slice(0, maxItems);
}

export function joinList(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

export function clientSurveyError(snapshot, readyFiles) {
  if (!snapshot.studentStatus.applicantType || !snapshot.studentStatus.residenceRegion) return '학생 상태의 필수 항목을 입력해주세요.';
  const required = snapshot.scores.records.filter(row => ['korean', 'math', 'english', 'inquiry'].includes(row.area));
  if (required.length < 5 || required.some(row => !row.subject || !row.grade || !row.confirmed)) return '국어·수학·영어·탐구 2과목의 등급과 확인 체크를 완료해주세요.';
  if (!snapshot.preferences.desiredRegions.length || !snapshot.preferences.desiredMajors.length || !snapshot.preferences.desiredTracks.length) return '희망 지역·학과·계열을 각각 하나 이상 입력해주세요.';
  if (!snapshot.strategy.riskTolerance || snapshot.strategy.priorityOrder.length !== 5) return '지원 위험 선호와 5개 우선순위를 확인해주세요.';
  if (!snapshot.qualitative.consultationQuestions.some(question => question.trim())) return '상담에서 확인할 질문을 한 가지 이상 입력해주세요.';
  if (!snapshot.consent.accurateInformation || !snapshot.consent.analysisUse) return '최종 확인과 분석 이용 동의가 필요합니다.';
  if (!readyFiles.length) return '검사가 완료된 성적표 파일이 필요합니다.';
  return '';
}

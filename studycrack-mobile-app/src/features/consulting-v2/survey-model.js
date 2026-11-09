export const SURVEY_STEPS = Object.freeze([
  { key: 'studentStatus', label: '학생 상태', guide: '지원자 구분과 거주 지역부터 알려주세요. 지원 자격과 통학 여건을 함께 살펴볼게요.' },
  { key: 'scores', label: '성적', guide: '시험을 선택한 뒤 원점수나 성적표로 입력해 주세요. 채워진 수치는 제출 전에 확인할 수 있어요.' },
  { key: 'conditions', label: '지원 조건', guide: '등록금과 통학처럼 실제 진학을 결정할 때 고려할 조건을 알려주세요.' },
  { key: 'preferences', label: '희망 지원', guide: '희망 지역과 전공을 알려주세요. 함께 살펴보고 싶은 대학도 적을 수 있어요.' },
  { key: 'strategy', label: '지원 전략', guide: '어떤 지원을 선호하는지, 그리고 대학을 선택할 때 무엇이 중요한지 알려주세요.' },
  { key: 'qualitative', label: '상담 질문', guide: '성적과 희망 조건만으로 알기 어려운 고민을 적어주세요. 서면 상담에서 함께 다룹니다.' },
  { key: 'consent', label: '최종 확인', guide: '성적표 검사와 두 가지 확인을 마친 뒤 제출해주세요. 상담 준비에 필요한 자료를 검토합니다.' }
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
    qualitative: { strengths: '', concerns: '', guardianOpinion: '', specialCircumstances: '', consultationQuestions: [] },
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
    qualitative: { ...empty.qualitative, ...(snapshot.qualitative || {}), consultationQuestions: Array.isArray(snapshot.qualitative?.consultationQuestions) ? snapshot.qualitative.consultationQuestions : [] },
    consent: { ...empty.consent, ...(snapshot.consent || {}) }
  };
}

export function splitList(value, maxItems) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean).filter((item, index, list) => list.indexOf(item) === index).slice(0, maxItems);
}

export function joinList(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

const hasText = value => typeof value === 'string' && Boolean(value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim());
const integerInRange = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

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
  if (!integerInRange(snapshot.scores.examYear, 2025, 2027)) return issue('scores', '시험 연도를 2025~2027 사이로 입력해주세요.');
  if (!snapshot.scores.examType) return issue('scores', '시험 종류를 선택해주세요.');
  const required = snapshot.scores.records.filter(row => ['korean', 'math', 'english', 'inquiry'].includes(row.area));
  const missingArea = ['korean', 'math', 'english', 'inquiry'].some(area => required.filter(row => row.area === area).length !== (area === 'inquiry' ? 2 : 1));
  if (missingArea || required.some(row => !hasText(row.subject) || !integerInRange(row.grade, 1, 9) || row.confirmed !== true)) {
    return issue('scores', '국어·수학·영어·탐구 2과목의 과목명, 등급, 확인 체크를 완료해주세요.');
  }
  if (snapshot.scores.records.some(row => row.area === 'korean_history' && (!hasText(row.subject) || (row.grade != null && row.confirmed !== true)))) {
    return issue('scores', '한국사 과목명을 확인하고, 등급을 입력했다면 성적표와 확인에 체크해주세요.');
  }
  if (!snapshot.preferences.desiredRegions.length || !snapshot.preferences.desiredMajors.length || !snapshot.preferences.desiredTracks.length) return issue('preferences', '희망 지역·학과·계열을 각각 하나 이상 입력해주세요.');
  if (!snapshot.strategy.riskTolerance || snapshot.strategy.priorityOrder.length !== 5) return issue('strategy', '지원 위험 선호와 5개 우선순위를 확인해주세요.');
  if (!snapshot.qualitative.consultationQuestions.some(hasText)) return issue('qualitative', '상담에서 확인할 질문을 한 가지 이상 입력해주세요.');
  if (!snapshot.consent.accurateInformation || !snapshot.consent.analysisUse) return issue('consent', '최종 확인과 분석 이용 동의가 필요합니다.');
  if (!readyFiles.length) return issue('consent', '검사가 완료된 성적표 파일이 필요합니다.');
  return null;
}

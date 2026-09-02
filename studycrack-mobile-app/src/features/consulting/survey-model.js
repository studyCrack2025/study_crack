const DEFAULT_SCORE_ROWS = [
  ['korean', '국어'],
  ['math', '수학'],
  ['english', '영어'],
  ['inquiry', '탐구 1'],
  ['inquiry', '탐구 2']
];

export function createBlankConsultingSurvey() {
  return {
    identity: { graduationYear: '', applicantType: '', schoolType: '', residenceRegion: '', commute: { maxMinutes: '' } },
    scores: { examYear: '', examType: '', records: DEFAULT_SCORE_ROWS.map(([area, subject]) => ({ area, subject, standardScore: '', percentile: '', grade: '', confirmed: false })) },
    preferences: { targets: [{ university: '', major: '', region: '' }], priorityOrder: ['university', 'major', 'region'], similarMajorAllowed: false },
    qualitative: { riskTolerance: '', retryWillingness: '', enrollmentIntent: '', guardianDifference: '', consultationQuestions: [''] }
  };
}

export function normalizeConsultingSurveyDraft(snapshot) {
  const blank = createBlankConsultingSurvey();
  if (!snapshot || typeof snapshot !== 'object') return blank;
  return {
    identity: { ...blank.identity, ...(snapshot.identity || {}), commute: { ...blank.identity.commute, ...(snapshot.identity?.commute || {}) } },
    scores: { ...blank.scores, ...(snapshot.scores || {}), records: Array.isArray(snapshot.scores?.records) && snapshot.scores.records.length ? snapshot.scores.records : blank.scores.records },
    preferences: { ...blank.preferences, ...(snapshot.preferences || {}), targets: Array.isArray(snapshot.preferences?.targets) && snapshot.preferences.targets.length ? snapshot.preferences.targets : blank.preferences.targets },
    qualitative: { ...blank.qualitative, ...(snapshot.qualitative || {}), consultationQuestions: Array.isArray(snapshot.qualitative?.consultationQuestions) && snapshot.qualitative.consultationQuestions.length ? snapshot.qualitative.consultationQuestions : blank.qualitative.consultationQuestions }
  };
}

export function createSurveyRequestKey(caseId) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `survey-${caseId}-${suffix}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
}

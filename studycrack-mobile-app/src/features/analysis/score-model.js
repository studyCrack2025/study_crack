export function scoreExamTypeToKey(label = '') {
  if (String(label).includes('3월')) return 'mar';
  if (String(label).includes('4월')) return 'apr';
  if (String(label).includes('5월')) return 'may';
  if (String(label).includes('6월')) return 'jun';
  if (String(label).includes('7월')) return 'jul';
  if (String(label).includes('9월')) return 'sep';
  if (String(label).includes('10월')) return 'oct';
  if (String(label).includes('수능')) return 'csat';
  return 'active';
}

export function scoreExamKeyToLabel(key = '') {
  const labels = {
    active: '최근 성적',
    mar: '3월 모의고사',
    apr: '4월 모의고사',
    may: '5월 모의고사',
    jun: '6월 모의고사',
    jul: '7월 모의고사',
    sep: '9월 모의고사',
    oct: '10월 모의고사',
    csat: '수능'
  };
  return labels[key] || '최근 성적';
}

function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function englishGradeToScore(grade) {
  const number = Number(grade || 0);
  return number ? Math.max(0, Math.round(100 - (number - 1) * 12.5)) : undefined;
}

export function createBlankScoreState() {
  return {
    korean: { type: '', common: '', elective: '' },
    math: { type: '', common: '', elective: '' },
    english: '',
    history: '',
    inquiry1: { subject: '', score: '' },
    inquiry2: { subject: '', score: '' }
  };
}

export function mapExamDataToScorePatch(examData, base = {}) {
  if (!examData || typeof examData !== 'object') return null;
  const englishGrade = Number(examData.eng?.grd || 0);
  const scores = {
    korean: optionalNumber(examData.kor?.raw),
    math: optionalNumber(examData.math?.raw),
    english: optionalNumber(examData.eng?.raw) ?? englishGradeToScore(englishGrade),
    inquiry1: optionalNumber(examData.inq1?.raw),
    inquiry2: optionalNumber(examData.inq2?.raw)
  };
  const filteredScores = Object.fromEntries(Object.entries(scores).filter(([, value]) => value !== undefined));
  if (!Object.keys(filteredScores).length) return null;
  const scoreState = {
    korean: { type: examData.kor?.opt || '', common: examData.kor?.common || '', elective: examData.kor?.elective || '' },
    math: { type: examData.math?.opt || '', common: examData.math?.common || '', elective: examData.math?.elective || '' },
    english: englishGrade || '',
    history: examData.hist?.grd || examData.history?.grd || '',
    inquiry1: { subject: examData.inq1?.name || '', score: examData.inq1?.raw || '' },
    inquiry2: { subject: examData.inq2?.name || '', score: examData.inq2?.raw || '' }
  };
  return {
    scores: { ...(base.scores || {}), ...filteredScores },
    scoreState: { ...(base.scoreState || {}), ...scoreState },
    scoreEditState: { ...(base.scoreEditState || {}), ...scoreState }
  };
}

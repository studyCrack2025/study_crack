import { INQUIRY_SUBJECTS } from '../../constants/options.js';

const choiceKey = value => String(value || '').normalize('NFKC').replace(/[\s·ㆍ・]/g, '').toLowerCase();
const choiceLabels = new Map([...INQUIRY_SUBJECTS, '화법과작문', '언어와매체', '확률과통계', '미적분', '기하'].map(label => [choiceKey(label), label]));
for (const [label, aliases] of [
  ['화법과작문', ['화작', 'hwajak']], ['언어와매체', ['언매', 'eonmae', 'unmae']],
  ['확률과통계', ['확통', 'hwak']], ['미적분', ['미적', 'mi']], ['기하', ['ki']],
  ['생활과 윤리', ['생윤']], ['윤리와 사상', ['윤사']], ['한국지리', ['한지']], ['세계지리', ['세지']],
  ['동아시아사', ['동사']], ['세계사', ['세사']], ['정치와 법', ['정법']], ['사회·문화', ['사문']]
]) for (const alias of aliases) choiceLabels.set(choiceKey(alias), label);
for (const [base, forms, short, first] of [['물리학', ['물리학', '물리'], '물', '물원'], ['화학', ['화학'], '화', '화원'],
  ['생명과학', ['생명과학', '생명'], '생', '생원'], ['지구과학', ['지구과학', '지구'], '지', '지원']]) {
  for (const level of [1, 2]) {
    const label = `${base}${level === 1 ? 'Ⅰ' : 'Ⅱ'}`;
    for (const alias of [...forms.flatMap(form => [`${form}${level}`, `${form}${level === 1 ? 'I' : 'II'}`]), `${short}${level}`, level === 1 ? first : `${short}투`]) choiceLabels.set(choiceKey(alias), label);
  }
}

export function scoreChoiceLabel(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const key = choiceKey(text);
  return choiceLabels.get(/^(?:국어|수학)\((.+)\)$/.exec(key)?.[1] || key) || text;
}

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

export function isOfficialScoreExam(value = '') {
  return ['csat', 'ksat'].includes(String(value).toLowerCase()) || String(value).includes('수능');
}

export function scoreExamKeyToLabel(key = '') {
  const labels = {
    active: '최근 성적',
    mar: '3월 모의고사',
    apr: '4월 모의고사',
    may: '5월 모의고사',
    jun: '6월 평가원',
    jul: '7월 모의고사',
    sep: '9월 평가원',
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
  const englishGrade = Number(examData.eng?.grd ?? examData.eng?.grade ?? 0);
  const scores = {
    korean: optionalNumber(examData.kor?.raw),
    math: optionalNumber(examData.math?.raw),
    english: optionalNumber(examData.eng?.raw) ?? englishGradeToScore(englishGrade),
    inquiry1: optionalNumber(examData.inq1?.raw),
    inquiry2: optionalNumber(examData.inq2?.raw)
  };
  const filteredScores = Object.fromEntries(Object.entries(scores).filter(([, value]) => value !== undefined));
  if (!Object.keys(filteredScores).length && !['kor', 'math', 'inq1', 'inq2'].some(key => optionalNumber(examData[key]?.std) !== undefined)) return null;
  const metrics = item => ({ std: item?.std ?? '', pct: item?.pct ?? '', grd: item?.grd ?? item?.grade ?? '' });
  const scoreState = {
    korean: { type: scoreChoiceLabel(examData.kor?.opt || examData.kor?.type), common: examData.kor?.common ?? '', elective: examData.kor?.elective ?? '', ...metrics(examData.kor) },
    math: { type: scoreChoiceLabel(examData.math?.opt || examData.math?.type), common: examData.math?.common ?? '', elective: examData.math?.elective ?? '', ...metrics(examData.math) },
    english: englishGrade || '',
    history: examData.hist?.grd ?? examData.hist?.grade ?? examData.history?.grd ?? examData.history?.grade ?? '',
    inquiry1: { subject: scoreChoiceLabel(examData.inq1?.name), score: examData.inq1?.raw ?? '', ...metrics(examData.inq1) },
    inquiry2: { subject: scoreChoiceLabel(examData.inq2?.name), score: examData.inq2?.raw ?? '', ...metrics(examData.inq2) }
  };
  return {
    scores: { ...(base.scores || {}), ...scores },
    scoreState: { ...(base.scoreState || {}), ...scoreState },
    scoreEditState: { ...(base.scoreEditState || {}), ...scoreState }
  };
}

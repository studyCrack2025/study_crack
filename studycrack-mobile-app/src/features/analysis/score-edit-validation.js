const RAW_FIELDS = {
  'v2e-korean-common': { key: 'koreanCommon', max: 76, label: '공통 원점수' },
  'v2e-korean-elective': { key: 'koreanElective', max: 24, label: '선택 원점수' },
  'v2e-math-common': { key: 'mathCommon', max: 74, label: '공통 원점수' },
  'v2e-math-elective': { key: 'mathElective', max: 26, label: '선택 원점수' },
  'v2e-inq1-score': { key: 'inquiry1Score', max: 50, label: '원점수' },
  'v2e-inq2-score': { key: 'inquiry2Score', max: 50, label: '원점수' }
};

const SELECT_FIELDS = {
  'v2e-korean-type': { key: 'koreanType', options: ['화법과작문', '언어와매체'] },
  'v2e-math-type': { key: 'mathType', options: ['확률과통계', '미적분', '기하'] },
  'v2e-inq1-subject': { key: 'inquiry1Subject' },
  'v2e-inq2-subject': { key: 'inquiry2Subject' }
};

const STEP_FIELDS = [
  ['v2e-korean-type', 'v2e-korean-common', 'v2e-korean-elective'],
  ['v2e-math-type', 'v2e-math-common', 'v2e-math-elective'],
  ['v2e-english'],
  ['v2e-history'],
  ['v2e-inq1-subject', 'v2e-inq1-score'],
  ['v2e-inq2-subject', 'v2e-inq2-score']
];

export function getScoreFieldError(field, value) {
  const text = String(value ?? '').trim();
  const raw = RAW_FIELDS[field];
  if (raw) {
    if (!text) return `${raw.label}를 입력해 주세요.`;
    const number = Number(text);
    if (!Number.isInteger(number) || number < 0 || number > raw.max) return `0~${raw.max}점 사이의 정수를 입력해 주세요.`;
    if (number === 1 || number === raw.max - 1) return `문항 배점상 ${number}점은 입력할 수 없어요. 성적표를 확인해 주세요.`;
    return '';
  }
  if (field === 'v2e-english' || field === 'v2e-history') return /^[1-9]$/.test(text) ? '' : '1~9등급 중 숫자 하나를 입력해 주세요.';
  const select = SELECT_FIELDS[field];
  if (select && (!text || ['선택', '과목 선택', '선택하세요', '미선택'].includes(text) || (select.options && !select.options.includes(text)))) return '응시한 과목을 선택해 주세요.';
  return '';
}

export function getScoreStepErrors(step, values = {}) {
  const errors = {};
  for (const field of STEP_FIELDS[Number(step) - 1] || []) {
    const key = RAW_FIELDS[field]?.key || SELECT_FIELDS[field]?.key || (field === 'v2e-english' ? 'english' : 'history');
    const error = getScoreFieldError(field, values[key]);
    if (error) errors[field] = error;
  }
  return errors;
}

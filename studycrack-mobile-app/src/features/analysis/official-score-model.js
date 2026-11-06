import { INQUIRY_SUBJECTS } from '../../constants/options.js';
import { scoreChoiceLabel } from './score-model.js';

export function officialMetricError(metric, value) {
  const min = metric === 'grd' ? 1 : 0;
  const max = metric === 'grd' ? 9 : metric === 'pct' ? 100 : 200;
  const validType = typeof value === 'number' || typeof value === 'string' && /^\d{1,3}$/.test(value.trim());
  return validType && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max
    ? '' : `${min}~${max} 사이의 정수를 입력해 주세요.`;
}

export function prepareOfficialScoreExam(exam = {}) {
  if (!exam || typeof exam !== 'object' || Array.isArray(exam)) return { error: '수능 성적표를 입력해 주세요.' };
  const data = { scoreBasis: 'official' };
  for (const [key, label] of [['kor', '국어'], ['math', '수학'], ['inq1', '탐구1'], ['inq2', '탐구2']]) {
    const item = exam[key] || {};
    const option = scoreChoiceLabel(item.opt || item.name || item.type || item.subject);
    const choices = key === 'kor' ? ['화법과작문', '언어와매체'] : key === 'math' ? ['확률과통계', '미적분', '기하'] : INQUIRY_SUBJECTS;
    if (!choices.includes(option)) return { error: `${label} 선택과목을 확인해 주세요.` };
    data[key] = { [key === 'kor' || key === 'math' ? 'opt' : 'name']: option };
    for (const metric of ['std', 'pct', 'grd']) {
      if (officialMetricError(metric, item[metric])) return { error: `${label} 성적표의 표준점수·백분위·등급을 확인해 주세요.` };
      data[key][metric] = Number(item[metric]);
    }
  }
  if (data.inq1.name === data.inq2.name) return { error: '탐구1과 탐구2는 서로 다른 과목을 선택해 주세요.' };
  for (const [key, label] of [['eng', '영어'], ['hist', '한국사']]) {
    const grade = exam[key]?.grd ?? exam[key]?.grade;
    if (officialMetricError('grd', grade)) return { error: `${label} 등급을 확인해 주세요.` };
    data[key] = { grd: Number(grade) };
  }
  return { data };
}

export function officialExamFromValues(values) {
  const metric = key => Object.fromEntries(['std', 'pct', 'grd'].map(name => [name, values[`${key}${name[0].toUpperCase()}${name.slice(1)}`]]));
  return {
    kor: { opt: values.koreanType, ...metric('korean') }, math: { opt: values.mathType, ...metric('math') },
    inq1: { name: values.inquiry1Subject, ...metric('inquiry1') }, inq2: { name: values.inquiry2Subject, ...metric('inquiry2') },
    eng: { grd: values.english }, hist: { grd: values.history }
  };
}

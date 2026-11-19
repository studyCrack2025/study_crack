import { INQUIRY_SUBJECTS } from '../../constants/options.js';
import { officialMetricError, prepareOfficialScoreExam } from '../analysis/official-score-model.js';
import { FOREIGN_LANGUAGE_SUBJECTS, SPLIT_SCORE_LIMITS } from '../consulting-v2/survey-model.js';

export const CALCULATOR_PATH = '/2027-jungsi-consulting/calculator';
export const CALCULATOR_YEAR = 2027;
export const MAX_CANDIDATES = 6;
export const DRAFT_PREFIX = 'sc_jungsi_calculator_v1:';
export { FOREIGN_LANGUAGE_SUBJECTS };
export const SUBJECTS = [
  ['kor', '국어', ['화법과작문', '언어와매체'], SPLIT_SCORE_LIMITS.korean],
  ['math', '수학', ['확률과통계', '미적분', '기하'], SPLIT_SCORE_LIMITS.math],
  ['inq1', '탐구 1', INQUIRY_SUBJECTS],
  ['inq2', '탐구 2', INQUIRY_SUBJECTS]
];

export function emptyScores(basis = 'official') {
  return { admissionYear: CALCULATOR_YEAR, basis, exam: {
    kor: { opt: '', std: '', pct: '', grd: '', common: '', elective: '' },
    math: { opt: '', std: '', pct: '', grd: '', common: '', elective: '' },
    inq1: { name: '', std: '', pct: '', grd: '', raw: '' },
    inq2: { name: '', std: '', pct: '', grd: '', raw: '' },
    eng: { grd: '' }, hist: { grd: '' }, foreign: { name: '', grd: '' }
  } };
}

function integerInRange(value, min, max) {
  return (typeof value === 'number' || typeof value === 'string' && /^\d{1,3}$/.test(value.trim()))
    && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
}

export function prepareCalculatorScores(value) {
  const errors = {};
  if (!value || value.admissionYear !== CALCULATOR_YEAR || !['official', 'raw'].includes(value.basis)) {
    return { ok: false, errors: { basis: '2027학년도 수능 입력 방식을 확인해주세요.' } };
  }
  const exam = value.exam || {};
  const sanitized = {};
  for (const [key, label, choices, limits] of SUBJECTS) {
    const row = exam[key] || {};
    const choice = limits ? 'opt' : 'name';
    if (!choices.includes(row[choice])) errors[`${key}.${choice}`] = `${label} 선택과목을 선택해주세요.`;
    sanitized[key] = { [choice]: row[choice] };
    const fields = value.basis === 'official' ? [['std', 200], ['pct', 100], ['grd', 9]]
      : limits ? [['common', limits[0]], ['elective', limits[1]]] : [['raw', 50]];
    for (const [metric, max] of fields) {
      const valid = value.basis === 'official' ? !officialMetricError(metric, row[metric]) : integerInRange(row[metric], 0, max);
      if (!valid) errors[`${key}.${metric}`] = `${metric === 'grd' ? 1 : 0}~${max} 사이의 정수를 입력해주세요.`;
      else sanitized[key][metric] = Number(row[metric]);
    }
    if (value.basis === 'raw' && limits && !errors[`${key}.common`] && !errors[`${key}.elective`]) {
      sanitized[key].raw = sanitized[key].common + sanitized[key].elective;
    }
  }
  if (exam.inq1?.name && exam.inq1.name === exam.inq2?.name) errors['inq2.name'] = '탐구 1과 다른 과목을 선택해주세요.';
  for (const [key, label] of [['eng', '영어'], ['hist', '한국사']]) {
    if (officialMetricError('grd', exam[key]?.grd)) errors[`${key}.grd`] = `${label} 등급을 선택해주세요.`;
    else sanitized[key] = { grd: Number(exam[key].grd) };
  }
  const foreign = exam.foreign || {};
  if (foreign.name) {
    if (!FOREIGN_LANGUAGE_SUBJECTS.includes(foreign.name)) errors['foreign.name'] = '응시 과목을 다시 선택해주세요.';
    if (officialMetricError('grd', foreign.grd)) errors['foreign.grd'] = '응시한 제2외국어·한문 등급을 선택해주세요.';
    sanitized.foreign = { name: foreign.name, grd: Number(foreign.grd) };
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  if (value.basis === 'official') {
    const official = prepareOfficialScoreExam(sanitized);
    if (official.error) return { ok: false, errors: { basis: official.error } };
    Object.assign(sanitized, official.data);
    delete sanitized.scoreBasis;
  }
  return { ok: true, errors: {}, data: { admissionYear: CALCULATOR_YEAR, basis: value.basis, exam: sanitized } };
}

export function editableScores(confirmed) {
  const empty = emptyScores(confirmed?.basis);
  if (!confirmed) return empty;
  for (const key of Object.keys(empty.exam)) {
    for (const metric of Object.keys(empty.exam[key])) {
      if (confirmed.exam?.[key]?.[metric] != null) empty.exam[key][metric] = String(confirmed.exam[key][metric]);
    }
  }
  return empty;
}

export function scoresChanged(input, confirmed) {
  if (!confirmed) return true;
  const result = prepareCalculatorScores(input);
  return !result.ok || JSON.stringify(result.data) !== JSON.stringify(confirmed);
}

const compact = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/[^\p{L}\p{N}]/gu, '');
export function universityMatches(name, query) {
  const short = name.replace('대학교', '대');
  const alias = short.replace('여자대', '여대').replace('교육대', '교대')
    .replace('한국외국어대', '한국외대').replace('서울과학기술대', '서울과기대');
  const words = String(query || '').trim().split(/\s+/u).map(compact).filter(Boolean);
  return [name, short, alias].some(label => compact(label).includes(compact(query)) || words.every(word => compact(label).includes(word)));
}

export const majorMatches = (name, query) => compact(name).includes(compact(query));
export const candidateKey = item => JSON.stringify([item.university, item.major]);

function validCandidate(item) {
  return item && typeof item.university === 'string' && item.university.trim().length > 0 && item.university.length <= 160
    && typeof item.major === 'string' && item.major.trim().length > 0 && item.major.length <= 200;
}

export function uniqueCandidates(items) {
  const unique = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (validCandidate(item)) {
      const candidate = { university: item.university.trim(), major: item.major.trim() };
      unique.set(candidateKey(candidate), candidate);
    }
  }
  return [...unique.values()].slice(0, MAX_CANDIDATES);
}

export function readCalculatorDraft(storage, owner) {
  try {
    if (!owner) return { confirmed: null, candidates: [] };
    const text = storage.getItem(DRAFT_PREFIX + encodeURIComponent(owner));
    if (!text || text.length > 24000) return { confirmed: null, candidates: [] };
    const data = JSON.parse(text);
    if (data.version !== 1 || data.owner !== owner || data.admissionYear !== CALCULATOR_YEAR) return { confirmed: null, candidates: [] };
    const score = prepareCalculatorScores(data.confirmed);
    return { confirmed: score.ok ? score.data : null, candidates: uniqueCandidates(data.candidates) };
  } catch (_) { return { confirmed: null, candidates: [] }; }
}

export function writeCalculatorDraft(storage, owner, draft) {
  try {
    if (!owner) return false;
    const scores = prepareCalculatorScores(draft.confirmed);
    storage.setItem(DRAFT_PREFIX + encodeURIComponent(owner), JSON.stringify({ version: 1, owner, admissionYear: CALCULATOR_YEAR,
      confirmed: scores.ok ? scores.data : null, candidates: uniqueCandidates(draft.candidates) }));
    return true;
  } catch (_) { return false; }
}

export function clearCalculatorDrafts(storage) {
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(DRAFT_PREFIX)) storage.removeItem(key);
    }
  } catch (_) {}
}

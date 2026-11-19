import test from 'node:test';
import assert from 'node:assert/strict';
import { CALCULATOR_PATH, candidateKey, clearCalculatorDrafts, editableScores, emptyScores, prepareCalculatorScores, readCalculatorDraft, scoresChanged, uniqueCandidates, universityMatches, writeCalculatorDraft } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-model.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key), key: index => [...map.keys()][index], get length() { return map.size; } };
}
function complete(basis = 'official') {
  const result = emptyScores(basis);
  Object.assign(result.exam.kor, { opt: '언어와매체', std: '130', pct: '95', grd: '2', common: '60', elective: '20' });
  Object.assign(result.exam.math, { opt: '미적분', std: '129', pct: '94', grd: '2', common: '62', elective: '20' });
  Object.assign(result.exam.inq1, { name: '사회·문화', std: '65', pct: '94', grd: '2', raw: '40' });
  Object.assign(result.exam.inq2, { name: '생활과 윤리', std: '64', pct: '92', grd: '2', raw: '41' });
  result.exam.eng.grd = '2'; result.exam.hist.grd = '1';
  return result;
}

test('calculator keeps 2027 official and raw inputs separate without inventing converted scores', () => {
  const official = prepareCalculatorScores(complete());
  const raw = prepareCalculatorScores(complete('raw'));
  assert.equal(official.ok, true); assert.equal(raw.ok, true);
  assert.equal(raw.data.exam.kor.raw, 80);
  assert.equal(raw.data.exam.math.raw, 82);
  assert.equal(raw.data.exam.kor.std, undefined);
  assert.equal(official.data.exam.kor.raw, undefined);
  assert.equal(prepareCalculatorScores({ ...complete(), admissionYear: 2026 }).ok, false);
  assert.equal(scoresChanged(editableScores(official.data), official.data), false);
  const edited = editableScores(official.data); edited.exam.math.std = '128';
  assert.equal(scoresChanged(edited, official.data), true);
});

test('blank, exponent, out-of-range and duplicate-subject scores cannot be confirmed', () => {
  for (const [subject, field, value] of [['kor', 'std', ''], ['math', 'std', '1e2'], ['inq1', 'pct', '101'], ['hist', 'grd', '0']]) {
    const input = complete(); input.exam[subject][field] = value;
    assert.ok(prepareCalculatorScores(input).errors[`${subject}.${field}`]);
  }
  const duplicate = complete(); duplicate.exam.inq2.name = duplicate.exam.inq1.name;
  assert.ok(prepareCalculatorScores(duplicate).errors['inq2.name']);
  const raw = complete('raw'); raw.exam.kor.common = '77'; raw.exam.math.elective = '27';
  assert.ok(prepareCalculatorScores(raw).errors['kor.common']);
  assert.ok(prepareCalculatorScores(raw).errors['math.elective']);
  raw.exam.kor.common = '0'; raw.exam.math.elective = '0';
  assert.equal(prepareCalculatorScores(raw).ok, true);
});

test('optional foreign language needs its own grade and preserves only allowed fields', () => {
  const input = complete(); input.exam.foreign = { name: '일본어Ⅰ', grd: '', phone: 'must-not-persist' };
  assert.ok(prepareCalculatorScores(input).errors['foreign.grd']);
  input.exam.foreign.grd = '3';
  const result = prepareCalculatorScores(input);
  assert.deepEqual(result.data.exam.foreign, { name: '일본어Ⅰ', grd: 3 });
});

test('search recognizes familiar names and campus words without merging distinct campuses', () => {
  assert.equal(CALCULATOR_PATH, '/2027-jungsi-consulting/calculator');
  assert.ok(universityMatches('한국외국어대학교(글로벌)', '한국외대 글로벌'));
  assert.ok(universityMatches('서울교육대학교', '서울교대'));
  assert.ok(!universityMatches('한국외국어대학교(서울)', '한국외대 글로벌'));
  const first = { university: '예시대학교(서울)', major: '경영학과' };
  const second = { university: '예시대학교(다른캠퍼스)', major: '경영학과' };
  assert.notEqual(candidateKey(first), candidateKey(second));
  assert.equal(uniqueCandidates([first, first, second]).length, 2);
  assert.equal(uniqueCandidates(Array.from({ length: 9 }, (_, index) => ({ university: '예시대', major: `학과${index}` }))).length, 6);
});

test('drafts are owner-bound, tolerate corrupt storage, and clear without touching invitations', () => {
  const store = memoryStorage(); const draft = { confirmed: prepareCalculatorScores(complete()).data, candidates: [{ university: '예시대', major: '경영학과' }] };
  assert.ok(writeCalculatorDraft(store, 'owner-A', draft));
  assert.deepEqual(readCalculatorDraft(store, 'owner-A'), draft);
  assert.equal(readCalculatorDraft(store, 'owner-B').confirmed, null);
  assert.equal(writeCalculatorDraft(store, '', draft), false);
  const key = store.key(0); const data = JSON.parse(store.getItem(key));
  data.owner = 'owner-B'; store.setItem(key, JSON.stringify(data));
  assert.equal(readCalculatorDraft(store, 'owner-A').confirmed, null);
  store.setItem(key, '{broken');
  assert.equal(readCalculatorDraft(store, 'owner-A').confirmed, null);
  store.setItem('sc_jungsi_invite_v1', 'preserve');
  clearCalculatorDrafts(store);
  assert.equal(store.length, 1); assert.equal(store.getItem('sc_jungsi_invite_v1'), 'preserve');
  assert.equal(writeCalculatorDraft({ setItem() { throw new Error('unavailable'); } }, 'owner-A', draft), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalculatorPortfolio } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-portfolio-model.js';
import { safeCalculatorReference } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-reference.js';
import { CALCULATOR_RISK_BANDS } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-indicators.js';
const scores = { admissionYear: 2027, basis: 'official', exam: { kor: { opt: '언어와매체', std: 130, pct: 95, grd: 2 }, math: { opt: '미적분', std: 131, pct: 95, grd: 2 }, inq1: { name: '물리학Ⅰ', std: 65, pct: 95, grd: 2 }, inq2: { name: '화학Ⅰ', std: 66, pct: 96, grd: 1 }, eng: { grd: 2 }, hist: { grd: 1 } } };
function fixture() {
  const target = { university: '예시대학교', major: '매우 긴 모집단위 이름을 갖는 융합전공', admissionUnitId: 'UNIT_TEST_1', selection: { key: 'PICK_' + '1'.repeat(32), recordId: 'U_' + '1'.repeat(16), admissionGroup: 'ga', universityName: '예시대학교', campusName: '서울캠퍼스', unitName: '매우 긴 모집단위 이름을 갖는 융합전공', trackName: '일반전형' } };
  const reference = { contractVersion: 'reviewed-admission-reference-v1', status: 'prior_data_two_estimates', recordId: target.selection.recordId, school: target.university, major: target.major, bundleDigest: 'sha256:' + 'a'.repeat(64), candidateAdmissionIdentity: { admissionUnitId: target.admissionUnitId }, targetYear: 2027, convertedScore: 730.1234567, passReference: 650, registered70Reference: 700, referenceIndex: 80, riskBand: 'stable', referenceYear: null, referenceBounds: null, indexRange: null, probability: null, empiricallyCalibrated: false, publicationReady: false, personalEligibilityApproved: false, sourceIds: [], reasonCodes: [] };
  const value = { profile: { revision: 1, scores }, plan: { name: '나의 조합', targets: [target], representatives: { ga: target.selection.key, na: null, da: null } }, conversion: { basis: 'official', results: [{ university: target.university, major: target.major, selectionKey: target.selection.key, status: 'unavailable', reasonCodes: ['DATA_RELEASE_NOT_READY'], convertedScore: null, maximumScore: null, referenceComparison: safeCalculatorReference(reference, target, scores) }] } };
  value.input = { scores, targets: value.plan.targets, profileRevision: 1 };
  return { value, reference, target };
}

test('a saved partial portfolio preserves source precision, long identity, group order, missing groups and withheld probabilities', () => {
  const { value, target } = fixture(), model = createCalculatorPortfolio(value);
  assert.ok(model); assert.equal(model.name, '나의 조합'); assert.deepEqual(model.cards.map(row => row.label), ['가군', '나군', '다군']);
  assert.equal(model.cards[0].identity.unit, target.selection.unitName); assert.equal(model.cards[0].score.value, '730.123457점');
  assert.equal(model.cards[0].indicator.band, 'stable'); assert.equal(model.cards[0].indicator.points, '80 / 100');
  assert.deepEqual(model.cards.slice(1).map(row => row.status), ['empty', 'empty']);
  assert.match(model.cards[0].reference.lines[0].label, /연도 미확인/); assert.doesNotMatch(model.cards[0].reference.lines[0].label, /2027/);
  assert.match(model.probability, /자료가 준비/); assert.equal(model.cards[0].probability, undefined);
});

test('a result from other scores, profile revision, selection or result order cannot become the current portfolio', () => {
  for (const mutate of [v => { v.profile = { ...v.profile, revision: 2 }; }, v => { v.profile = structuredClone(v.profile); v.profile.scores.exam.kor.std--; }, v => { v.conversion.results[0].selectionKey = 'PICK_' + '2'.repeat(32); }, v => { v.conversion.results[0].university = '다른대학교'; }, v => { v.input = null; }, v => { v.plan = { ...v.plan, targets: [] }; }, v => { v.plan = { ...v.plan, representatives: { ga: null, na: null, da: null } }; }]) {
    const { value } = fixture(); mutate(value); assert.equal(createCalculatorPortfolio(value), null);
  }
});

test('formal CSAT component points stay distinct from another reference scale and do not publish a forged probability', () => {
  const { value } = fixture(); Object.assign(value.conversion.results[0], { status: 'available', convertedScore: 51.1234567, maximumScore: 60, scoreScope: 'csat_component', forecast: { probability: { percent: 99 } }, possibility: { status: 'available', index: { points: 66 }, riskBand: 'appropriate', sourceYear: 2026, targetYear: 2027 } });
  const card = createCalculatorPortfolio(value).cards[0]; assert.equal(card.score.label, '내 수능 반영점수'); assert.equal(card.score.value, '51.123457점'); assert.match(card.score.maximum, /60점/);
  assert.equal(card.indicator.points, '66 / 100'); assert.equal(card.reference.lines[0].value, '730.123457점'); assert.ok(card.reference.lines.some(line => line.value === '80 / 100'));
  assert.match(card.notes.join(' '), /학생부·면접·실기/); assert.doesNotMatch(JSON.stringify(card), /99%/);
});

test('missing comparison data keeps a representative identity and a pending stage without an invented score', () => {
  const { value } = fixture(); value.conversion.results[0].referenceComparison = { status: 'held', convertedScore: null, reasonCodes: ['REFERENCE_DATA_UNAVAILABLE'] };
  const card = createCalculatorPortfolio(value).cards[0]; assert.equal(card.status, 'held'); assert.equal(card.score, null); assert.equal(card.indicator.band, null); assert.equal(card.indicator.points, null); assert.equal(card.indicator.label, '판단 대기');
});

test('zero raw scores remain visible when estimates are unavailable and incidental account fields never enter the display model', () => {
  const { value } = fixture(), raw = { admissionYear: 2027, basis: 'raw', exam: { kor: { opt: '언어와매체', common: 0, elective: 0, raw: 0 }, math: { opt: '미적분', common: 0, elective: 0, raw: 0 }, inq1: { name: '물리학Ⅰ', raw: 0 }, inq2: { name: '화학Ⅰ', raw: 0 }, eng: { grd: 9 }, hist: { grd: 9 } } };
  value.profile = { revision: 1, scores: raw, applicationId: 'APP_PRIVATE', email: 'private@example.invalid' }; value.input = { ...value.input, scores: raw };
  Object.assign(value.conversion, { basis: 'raw', scoreDigest: 'sha256:' + 'a'.repeat(64), execution: { contractVersion: 'calculator-execution-v1', mode: 'development_preview', inputBasis: 'raw', inputScoreDigest: 'sha256:' + 'a'.repeat(64), comparisonBasis: null, comparisonScores: null,
    scoreConversion: { status: 'unavailable', scoreboardId: null, scoreboardDigest: null, reasonCodes: ['RAW_SCORE_CONVERSION_NOT_AVAILABLE'] } } });
  value.conversion.results[0].referenceComparison = { status: 'held', convertedScore: null, reasonCodes: ['REFERENCE_DATA_UNAVAILABLE'] };
  const model = createCalculatorPortfolio(value); assert.ok(model); assert.ok(model.scoreSummary.items.every(row => row.value === '원점수 0' && row.detail === '예상 성적 계산 대기'));
  assert.match(model.scoreSummary.grades, /영어 9등급/); assert.doesNotMatch(JSON.stringify(model), /APP_PRIVATE|private@example/);
});

test('prior-year ranges, a single 70 percent reference and score-only data keep their distinct statistical meaning', () => {
  const { value, reference, target } = fixture();
  const display = patch => { value.conversion.results[0].referenceComparison = safeCalculatorReference({ ...reference, ...patch }, target, scores); return createCalculatorPortfolio(value).cards[0]; };
  const current = display({ status: 'current_two_references', referenceYear: 2025, referenceBounds: { kind: 'cut_assumption_range', pass: { low: 649, high: 651 }, registered70: { low: 699, high: 701 } }, indexRange: { kind: 'cut_assumption_range', low: 79, high: 81 } });
  assert.match(current.reference.lines[0].label, /2025학년도 합격권/); assert.equal(current.reference.lines[0].value, '649~651점'); assert.ok(current.reference.lines.some(line => line.value === '79~81'));
  const single = display({ status: 'historical70_only', referenceYear: 2026, passReference: null, referenceIndex: null, riskBand: null });
  assert.equal(single.indicator.band, null); assert.equal(single.indicator.points, null); assert.equal(single.reference.lines.length, 1); assert.match(single.reference.lines[0].label, /2026학년도 70%/);
  const scoreOnly = display({ status: 'academic_score_without_cut', passReference: null, registered70Reference: null, referenceIndex: null, riskBand: null });
  assert.ok(scoreOnly.score); assert.equal(scoreOnly.reference.lines.length, 0); assert.equal(scoreOnly.indicator.band, null); assert.match(scoreOnly.reference.note, /기준선이 없어/);
});

test('reference stages reject malformed or mismatched records and remain pending for an older server', () => {
  const { reference, target, value } = fixture(); assert.equal(safeCalculatorReference(reference, target, scores).riskBand, 'stable');
  for (const patch of [{ riskBand: 'unknown' }, { riskBand: null }, { probability: 0.99 }, { recordId: 'U_' + '2'.repeat(16) }]) assert.equal(safeCalculatorReference({ ...reference, ...patch }, target, scores).reasonCodes[0], 'REFERENCE_RESPONSE_INVALID');
  delete reference.riskBand; const older = safeCalculatorReference(reference, target, scores); assert.equal(older.riskBand, null); assert.equal(older.convertedScore, reference.convertedScore);
  value.conversion.results[0].referenceComparison = older; assert.equal(createCalculatorPortfolio(value).cards[0].indicator.band, null);
  assert.deepEqual(CALCULATOR_RISK_BANDS.map(row => row[1]), ['안정', '적정', '소신', '상향', '위험']);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyScoreConversions, clearConvertedScores, scoreConversionBatch, scoreConversionLabel } from '../../studycrack-mobile-app/src/features/consulting-v2/score-entry-model.js';
import { createEmptySurvey, normalizeSurveyDraft } from '../../studycrack-mobile-app/src/features/consulting-v2/survey-model.js';

test('raw-only lookup replaces old manual metrics and preserves the test basis through save and reload', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '화법과작문', rawScore: 36, commonRawScore: 32, electiveRawScore: 4, standardScore: 147, percentile: 100, grade: 1 });
  Object.assign(scores.records[3], { subject: '생명과학1', rawScore: 0 });
  const batch = scoreConversionBatch(scores);
  assert.deepEqual(batch.entries.map(({ input }) => [input.area, input.rawScore, input.standardScore]), [['korean', 36, undefined], ['inquiry', 0, undefined]]);
  assert.equal(batch.examYear, 2026);
  const records = applyScoreConversions(scores.records, batch.entries, [
    { status: 'converted', metrics: { standardScore: 81, percentile: 21, grade: 7 }, conversionAdmissionYear: 2027, conversionExamType: 'september_mock' },
    { status: 'board_unavailable' }
  ]);
  assert.equal(records[0].standardScore, 81);
  assert.equal(records[0].rawScore, 36);
  assert.equal(records[0].convertedFromRaw, true);
  assert.equal(records[0].confirmed, false);
  assert.equal(records[3], scores.records[3]);
  assert.deepEqual(scoreConversionBatch({ ...scores, records }).entries.map(({ index }) => index), [3]);
  const saved = normalizeSurveyDraft({ ...createEmptySurvey(), scores: { ...scores, records } });
  assert.equal(scoreConversionLabel(saved.scores.records[0]), '2026년 9월 평가원 참고');
  assert.equal(scoreConversionLabel({ conversionAdmissionYear: 2027 }), '2027학년도 수능 기준');
});

test('invalid lookup results cannot replace raw points or display unvalidated score numbers', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '화법과작문', commonRawScore: 32, electiveRawScore: 4 });
  const { entries } = scoreConversionBatch(scores);
  for (const metrics of [{ standardScore: 81, percentile: 101, grade: 7 }, { standardScore: 81, percentile: 21, grade: 0 }]) {
    assert.equal(applyScoreConversions(scores.records, entries, [{ status: 'converted', metrics }]), null);
  }
  assert.equal(applyScoreConversions(scores.records, entries, [{ status: 'converted', metrics: { standardScore: 81, percentile: 21, grade: 7 }, conversionExamType: 'unknown' }]), null);
});

test('estimated zero percentiles survive save and reload without replacing existing reference scores', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '화법과작문', commonRawScore: 0, electiveRawScore: 0 });
  const { entries } = scoreConversionBatch(scores);
  const result = { status: 'converted', metrics: { standardScore: 45, percentile: 0, grade: 9 }, conversionAdmissionYear: 2027, conversionExamType: 'csat_estimate' };
  const records = applyScoreConversions(scores.records, entries, [result]);
  const saved = normalizeSurveyDraft({ ...createEmptySurvey(), scores: { ...scores, records } });
  assert.equal(saved.scores.records[0].percentile, 0);
  assert.equal(saved.scores.records[0].confirmed, false);
  assert.equal(scoreConversionLabel(saved.scores.records[0]), '2027학년도 수능 추정치');
  assert.equal(scoreConversionBatch(saved.scores), null);
  assert.equal(applyScoreConversions(saved.scores.records, entries, [{ ...result, metrics: { standardScore: 90, percentile: 99, grade: 1 } }]), null);
  assert.equal(applyScoreConversions(scores.records, entries, [{ ...result, conversionAdmissionYear: 2026 }]), null);
  assert.equal(clearConvertedScores(saved.scores.records[0]).conversionExamType, undefined);
});

test('raw edits clear all derived metrics and revision lookup requires an explicitly edited row', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '화법과작문', commonRawScore: 32, electiveRawScore: 4 });
  assert.equal(scoreConversionBatch(scores, null, false), null);
  assert.deepEqual(scoreConversionBatch(scores, null, false, ['scores.korean']).entries.map(({ index }) => index), [0]);
  const patch = clearConvertedScores({ standardScore: 147, percentile: 100, grade: 1, conversionAdmissionYear: 2026 });
  for (const key of ['standardScore', 'percentile', 'grade']) assert.equal(patch[key], null);
  for (const key of ['conversionAdmissionYear', 'conversionExamType']) assert.equal(patch[key], undefined);
  const standardOnly = createEmptySurvey().scores;
  Object.assign(standardOnly.records[0], { selection: '언어와매체', standardScore: 147 });
  assert.equal(scoreConversionBatch(standardOnly), null);
});

test('supplement lookup uses only the allowed row and preserves inquiry numbering', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '화법과작문', commonRawScore: 32, electiveRawScore: 4 });
  Object.assign(scores.records[3], { subject: '생명과학1', rawScore: 30 });
  Object.assign(scores.records[4], { subject: '화학1', rawScore: 30 });
  assert.deepEqual(scoreConversionBatch(scores, ['scores.inquiry2']).entries.map(({ index }) => index), [4]);
  assert.equal(scoreConversionBatch(scores, ['qualitative.consultationQuestions']), null);
});

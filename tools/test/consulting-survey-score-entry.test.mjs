import assert from 'node:assert/strict';
import test from 'node:test';
import { applyScoreConversions, clearConvertedScores, scoreConversionBatch } from '../../studycrack-mobile-app/src/features/consulting-v2/score-entry-model.js';
import { createEmptySurvey, normalizeSurveyDraft } from '../../studycrack-mobile-app/src/features/consulting-v2/survey-model.js';

test('standard-only survey entries request lookup without treating standard points as raw points', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '언어와매체', standardScore: 147 });
  Object.assign(scores.records[3], { subject: '생명과학1', rawScore: 0 });
  const batch = scoreConversionBatch(scores);
  assert.deepEqual(batch.entries.map(({ input }) => [input.area, input.rawScore, input.standardScore]), [['korean', null, 147], ['inquiry', 0, undefined]]);
  assert.deepEqual(scoreConversionBatch(scores, null, false).entries.map(({ index }) => index), [0]);
  assert.equal(batch.examYear, 2026);
  const records = applyScoreConversions(scores.records, batch.entries, [
    { status: 'converted', metrics: { standardScore: 147, percentile: 100, grade: 1 }, conversionAdmissionYear: 2026 },
    { status: 'board_unavailable' }
  ]);
  assert.equal(records[0].standardScore, 147);
  assert.equal(records[0].conversionAdmissionYear, 2026);
  assert.equal(records[0].convertedFromRaw, undefined);
  assert.equal(records[0].confirmed, false);
  assert.equal(records[3], scores.records[3]);
  assert.deepEqual(scoreConversionBatch({ ...scores, records }).entries.map(({ index }) => index), [3]);
  const saved = normalizeSurveyDraft({ ...createEmptySurvey(), scores: { ...scores, records } });
  assert.equal(saved.scores.records[0].conversionAdmissionYear, 2026);
});

test('lookup never overwrites typed standard points or accepts invalid returned percentile and grade', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '언어와매체', standardScore: 147 });
  const { entries } = scoreConversionBatch(scores);
  for (const metrics of [{ standardScore: 146, percentile: 100, grade: 1 }, { standardScore: 147, percentile: 101, grade: 1 }, { standardScore: 147, percentile: 100, grade: 0 }]) {
    assert.equal(applyScoreConversions(scores.records, entries, [{ status: 'converted', metrics }]), null);
  }
});

test('editing raw points clears derived raw results and preserves manually typed standard points for a new lookup', () => {
  const manual = { standardScore: 147, percentile: 100, grade: 1, conversionAdmissionYear: 2026, confirmed: false };
  const patch = clearConvertedScores(manual);
  assert.equal(patch.standardScore, undefined);
  assert.equal(patch.percentile, null);
  assert.equal(patch.grade, null);
  assert.equal(patch.conversionAdmissionYear, undefined);
  const rawPatch = clearConvertedScores({ ...manual, convertedFromRaw: true });
  assert.equal(rawPatch.standardScore, null);
  assert.equal(rawPatch.convertedFromRaw, undefined);
});

test('supplement lookup is limited to the allowed score row and preserves inquiry numbering', () => {
  const { scores } = createEmptySurvey();
  Object.assign(scores.records[0], { selection: '화법과작문', standardScore: 147 });
  Object.assign(scores.records[3], { subject: '생명과학1', standardScore: 60 });
  Object.assign(scores.records[4], { subject: '화학1', standardScore: 60 });
  assert.deepEqual(scoreConversionBatch(scores, ['scores.inquiry2']).entries.map(({ index }) => index), [4]);
  assert.equal(scoreConversionBatch(scores, ['qualitative.consultationQuestions']), null);
});

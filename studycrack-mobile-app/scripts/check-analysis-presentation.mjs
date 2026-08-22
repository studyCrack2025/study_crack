import assert from 'node:assert/strict';
import { buildAnalysisPresentation } from '../src/screens/analysis/presentation.js';
import { buildServerSimRows } from '../src/runtime/derived.js';

const negativeRange = buildAnalysisPresentation({
  rows: [{ subject: '국어', gainNum: 10, baseUiScore: -50, afterUiScore: -40, idx: 0 }],
  selectedSubject: '국어',
  scoreView: { hasScore: true, pending: false, score: 0 }
});
assert.equal(negativeRange.currentScore, 0);
assert.equal(negativeRange.afterScore, 0);
assert.equal(negativeRange.previewWidthPct, 0);
assert.equal(negativeRange.hasPreview, false);
assert.equal(negativeRange.sortedRows[0].displayGain, '+0.0점');
assert.equal(negativeRange.sortedRows[0].isBest, false);

const visibleGain = buildAnalysisPresentation({
  rows: [{ subject: '수학', gainNum: 10, baseUiScore: 50, afterUiScore: 60, idx: 0 }],
  selectedSubject: '수학',
  scoreView: { hasScore: true, pending: false, score: 50 }
});
assert.equal(visibleGain.currentScore, 50);
assert.equal(visibleGain.afterScore, 60);
assert.equal(visibleGain.previewWidthPct, 4);
assert.equal(visibleGain.hasPreview, true);
assert.equal(visibleGain.sortedRows[0].displayGain, '+10점');

const selectedAbsolute = buildAnalysisPresentation({
  rows: [
    { subject: '국어', gainNum: 18, baseUiScore: 44.5, afterUiScore: 62.3, idx: 0 },
    { subject: '수학', gainNum: 6, baseUiScore: 44.5, afterUiScore: 50.5, idx: 1 }
  ],
  selectedSubject: '수학',
  scoreView: { hasScore: true, pending: false, score: 44.5 }
});
assert.equal(selectedAbsolute.afterScore, 50.5);
assert.equal(selectedAbsolute.bestRow.subject, '국어');

const cappedAtMax = buildAnalysisPresentation({
  rows: [{ subject: '국어', gainNum: 12, baseUiScore: 246, afterUiScore: 258, idx: 0 }],
  selectedSubject: '국어',
  scoreView: { hasScore: true, pending: false, score: 246 }
});
assert.equal(cappedAtMax.afterScore, 250);
assert.equal(cappedAtMax.afterPct, 100);
assert.equal(cappedAtMax.previewLabelAlign, 'end');

const nearStart = buildAnalysisPresentation({
  rows: [{ subject: '수학', gainNum: 3, baseUiScore: 1, afterUiScore: 4, idx: 0 }],
  selectedSubject: '수학',
  scoreView: { hasScore: true, pending: false, score: 1 }
});
assert.equal(nearStart.previewLabelAlign, 'start');

const partialServerRows = buildServerSimRows({
  base_ui_score: 42,
  sim_data: {
    kor: { name: '국어', uiDiff: 2.4, afterUiScore: 44.4 }
  }
});
assert.deepEqual(partialServerRows.map((row) => row.key), ['kor', 'math', 'inq1', 'inq2']);
assert.equal(partialServerRows[0].gainNum, 2.4);
assert.equal(partialServerRows[1].unavailable, true);
assert.equal(partialServerRows[1].afterUiScore, 42);
assert.deepEqual(buildServerSimRows({}), []);

console.log('analysis-presentation contracts passed');

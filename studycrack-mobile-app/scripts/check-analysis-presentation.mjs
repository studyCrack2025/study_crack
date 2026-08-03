import assert from 'node:assert/strict';
import { buildAnalysisPresentation } from '../src/screens/analysis/presentation.js';

const negativeRange = buildAnalysisPresentation({
  rows: [{ subject: '국어', gainNum: 10, baseUiScore: -50, afterUiScore: -40, idx: 0 }],
  selectedSubject: '국어',
  scoreView: { hasScore: true, pending: false, score: 0 }
});
assert.equal(negativeRange.currentScore, 0);
assert.equal(negativeRange.afterScore, 0);
assert.equal(negativeRange.previewWidthPct, 0);
assert.equal(negativeRange.hasPreview, false);

const visibleGain = buildAnalysisPresentation({
  rows: [{ subject: '수학', gainNum: 10, baseUiScore: 50, afterUiScore: 60, idx: 0 }],
  selectedSubject: '수학',
  scoreView: { hasScore: true, pending: false, score: 50 }
});
assert.equal(visibleGain.currentScore, 50);
assert.equal(visibleGain.afterScore, 60);
assert.equal(visibleGain.previewWidthPct, 4);
assert.equal(visibleGain.hasPreview, true);

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

console.log('analysis-presentation contracts passed');

const GAUGE_MAX = 250;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampAnalysisScore(value, max = GAUGE_MAX) {
  return Math.max(0, Math.min(max, finiteNumber(value)));
}

export function sortAnalysisSimulationRows(rows = []) {
  const maxGain = Math.max(...rows.map((row) => finiteNumber(row.gainNum)), 0);
  return [...rows]
    .map((row) => ({ ...row, isBest: maxGain > 0 && finiteNumber(row.gainNum) === maxGain }))
    .sort((a, b) => finiteNumber(b.gainNum) - finiteNumber(a.gainNum) || finiteNumber(a.idx) - finiteNumber(b.idx));
}

export function buildAnalysisPresentation({
  rows = [],
  selectedSubject = '',
  recommendedIndex = -1,
  scoreView = null,
  fallbackScore = 0
} = {}) {
  const sortedRows = sortAnalysisSimulationRows(rows);
  const selectedRow = sortedRows.find((row) => row.subject === selectedSubject)
    || rows[recommendedIndex]
    || sortedRows[0]
    || null;
  const metadataRow = rows.find((row) => Number.isFinite(Number(row.baseUiScore))) || null;
  const rawBaseScore = metadataRow
    ? finiteNumber(metadataRow.baseUiScore)
    : finiteNumber(scoreView?.score, fallbackScore);
  const hasScore = scoreView?.hasScore !== false && !scoreView?.pending;
  const currentScore = clampAnalysisScore(rawBaseScore);
  const rawAfterScore = selectedRow && Number.isFinite(Number(selectedRow.afterUiScore))
    ? Number(selectedRow.afterUiScore)
    : rawBaseScore;
  const afterScore = clampAnalysisScore(rawAfterScore);
  const currentPct = (currentScore / GAUGE_MAX) * 100;
  const afterPct = (afterScore / GAUGE_MAX) * 100;

  return {
    sortedRows,
    selectedRow,
    bestRow: sortedRows[0] || null,
    rawBaseScore,
    rawAfterScore,
    currentScore,
    afterScore,
    currentPct,
    afterPct,
    previewLeftPct: Math.min(currentPct, afterPct),
    previewWidthPct: Math.abs(afterPct - currentPct),
    hasPreview: Boolean(hasScore && selectedRow && afterScore !== currentScore),
    hasScore,
    pending: Boolean(scoreView?.pending),
    gapToPass: Math.max(0, 100 - currentScore)
  };
}

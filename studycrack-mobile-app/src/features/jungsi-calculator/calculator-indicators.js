export const CALCULATOR_RISK_BANDS = [['stable', '안정'], ['appropriate', '적정'], ['neutral', '소신'], ['challenge', '상향'], ['risky', '위험']];

export function calculatorIndicator(result) {
  const formal = result?.status === 'available' && !result.previewCutoff;
  const measured = formal ? result.possibility : result?.previewCutoff;
  if (measured?.status === 'available') {
    const stage = CALCULATOR_RISK_BANDS.find(([band]) => band === measured.riskBand);
    if (stage) return { band: stage[0], label: stage[1] };
  }
  const score = formal ? result.convertedScore : measured?.convertedScore;
  const pass = measured?.cutoffs?.pass;
  if (measured?.status === 'reference_only' && Number.isFinite(score) && Number.isFinite(pass)) {
    return { band: null, label: score >= pass ? '합격 컷 이상' : '합격 컷 미만' };
  }
  return { band: null, label: '판단 대기' };
}

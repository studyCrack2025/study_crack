export const CALCULATOR_RISK_BANDS = [['stable', '안정'], ['appropriate', '적정'], ['neutral', '소신'], ['challenge', '상향'], ['risky', '위험']];

const teacherRule = '학생부 100% 전형입니다. 수능 최저는 국어·수학·영어·탐구 중 상위 3개 영역 등급 합 6 이내입니다. 가채점은 예상 등급을 적용합니다.';
const selectionNotices = new Map([
  ['CSAT_MINIMUM_MET', { label: '수능 최저 충족', note: teacherRule }],
  ['CSAT_MINIMUM_NOT_MET', { label: '수능 최저 미충족', note: teacherRule }],
  ['SELECTION_CARRYOVER_ONLY', { label: '수시 이월 때 선발', note: '수시 이월 인원이 발생하면 선발합니다. 대학의 최종 정시 모집인원을 확인해주세요.' }]
]);

export function calculatorSelectionNotice(result) {
  if (result?.status === 'available' || result?.previewCutoff) return null;
  return selectionNotices.get(result?.reasonCodes?.[0]) ?? null;
}

export function calculatorIndicator(result) {
  const notice = calculatorSelectionNotice(result);
  if (notice) return { band: null, label: notice.label };
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

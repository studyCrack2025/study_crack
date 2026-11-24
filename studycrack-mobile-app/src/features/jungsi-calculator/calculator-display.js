export function formatCalculatorScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  const [mantissa, exponent = '0'] = String(value).split('e'), [whole, fraction = ''] = mantissa.split('.');
  const digits = whole + fraction, index = whole.length + Number(exponent);
  const integer = index > 0 ? digits.slice(0, index).padEnd(index, '0') : '0';
  const decimal = index < 0 ? '0'.repeat(-index) + digits : digits.slice(index);
  return Number(integer).toLocaleString('ko-KR') + '.' + decimal.padEnd(2, '0').slice(0, 2);
}
export const referenceScoreLabel = reference => reference.legacyScore ? '기존 산식 환산점수' : '예상 환산점수';

export function calculatorCutoffLines(reference, possibility) {
  const approved = ['available', 'reference_only'].includes(possibility?.status) ? possibility.cutoffs : null;
  const lines = [{ label: '예상 합격 컷', value: approved ? `${formatCalculatorScore(approved.pass)}점` : '산출 보류' }];
  if (approved) lines.push({ label: '70% 참고선', value: `${formatCalculatorScore(approved.registered70)}점` });
  if (reference?.historical70) {
    const { year, score } = reference.historical70;
    lines.push({ label: `${year}학년도 최종등록자 70% 컷`, value: `${score.toLocaleString('ko-KR', { maximumFractionDigits: 10 })}점` });
  }
  return lines;
}

export function referenceCaution(reference) {
  return reference?.legacyScore ? '기존 산식으로 계산한 참고 점수입니다. 적용 연도를 확인 중입니다.'
    : '예상 합격 컷과 지원 단계에는 검수를 마친 기준선을 사용합니다.';
}

export const HISTORICAL_CUTOFF_NOTE = '과거 입결은 해당 학년도 반영 기준으로 대학이 공개한 점수입니다.';
export const PREVIEW_SCORE_NOTE = '가채점으로 환산한 점수입니다. 지원 단계는 판단 대기입니다.';
export const CALCULATOR_STAGE_NOTE = '지원 단계는 실제 합격 확률이 아닙니다. 개인별 지원 자격과 학생부·면접·실기 반영은 별도 확인이 필요합니다.';

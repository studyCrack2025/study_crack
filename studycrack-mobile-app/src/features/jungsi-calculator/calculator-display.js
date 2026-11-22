export function formatCalculatorScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  const [mantissa, exponent = '0'] = String(value).split('e'), [whole, fraction = ''] = mantissa.split('.');
  const digits = whole + fraction, index = whole.length + Number(exponent);
  const integer = index > 0 ? digits.slice(0, index).padEnd(index, '0') : '0';
  const decimal = index < 0 ? '0'.repeat(-index) + digits : digits.slice(index);
  return Number(integer).toLocaleString('ko-KR') + '.' + decimal.padEnd(2, '0').slice(0, 2);
}
export const formatCalculatorRange = (value, bounds) => bounds && bounds.low !== bounds.high ? `${formatCalculatorScore(bounds.low)}~${formatCalculatorScore(bounds.high)}` : formatCalculatorScore(value);
export const referenceBasis = reference => reference.convertedScore == null ? '비교 자료 대기' : reference.referenceYear ? `${reference.referenceYear}학년도 입결 기준 추정` : '기존자료 기반 추정 · 연도 미확인';
export function referenceCaution(reference) {
  if (reference.convertedScore == null) return '산식·지원 조건·비교 자료를 확인하고 있습니다.';
  return reference.status === 'prior_data_two_estimates' ? '기존 산식·변환표·추정 커트라인으로 계산했습니다. 추정값의 생성연도는 확인되지 않았으며 현행 전형과의 동일성을 보장하지 않습니다.'
    : reference.status === 'academic_score_without_cut' ? '비교 기준선이 없어 지원 단계를 판단하지 않습니다.'
      : reference.status === 'historical70_only' ? `${reference.referenceYear}학년도 70% 참고선만 있어 예상 합격 컷과 지원 단계는 제공하지 않습니다.`
        : `${reference.referenceYear}학년도${reference.referenceYear === 2025 ? ' 보완자료' : ' 입결'} 기준입니다. 기준선 범위는 계산 가정에 따른 범위입니다.`;
}

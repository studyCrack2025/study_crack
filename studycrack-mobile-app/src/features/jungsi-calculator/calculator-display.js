export function formatCalculatorScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  const [mantissa, exponent = '0'] = String(value).split('e'), [whole, fraction = ''] = mantissa.split('.');
  const digits = whole + fraction, index = whole.length + Number(exponent);
  const integer = index > 0 ? digits.slice(0, index).padEnd(index, '0') : '0';
  const decimal = index < 0 ? '0'.repeat(-index) + digits : digits.slice(index);
  return Number(integer).toLocaleString('ko-KR') + '.' + decimal.padEnd(2, '0').slice(0, 2);
}
export const referenceScoreLabel = reference => reference.legacyScore ? '기존 산식 환산점수' : '예상 환산점수';

const isScore = value => Number.isFinite(value) && value >= 0;
const displayedCutoffs = possibility => ['available', 'reference_only'].includes(possibility?.status) ? possibility.cutoffs : null;

function comparableCutoffs(possibility) {
  const values = displayedCutoffs(possibility);
  const pass = isScore(values?.pass) ? values.pass : null;
  const registered70 = isScore(values?.registered70) ? values.registered70 : null;
  return pass !== null && registered70 !== null && pass > registered70 ? [null, null] : [pass, registered70];
}

export function calculatorOfferLine(possibility) {
  const estimate = displayedCutoffs(possibility) && possibility.offerEstimate;
  return estimate ? {
    label: estimate.scope === 'csat_component' ? '수능 반영분 추정 합격 가능성' : '추정 합격 가능성',
    value: `약 ${estimate.percent}% (${estimate.low}~${estimate.high}%)`
  } : null;
}

export function calculatorCutoffLines(reference, possibility, { showOffer = true } = {}) {
  const [pass, registered] = comparableCutoffs(possibility);
  const lines = [{ label: '예상 합격 컷', value: pass !== null ? `${formatCalculatorScore(pass)}점` : '산출 보류' }];
  if (registered !== null) lines.push({ label: possibility.modeled ? '예상 최종등록자 70% 컷' : '70% 참고선', value: `${formatCalculatorScore(registered)}점` });
  const offer = showOffer && calculatorOfferLine(possibility);
  if (offer) lines.push(offer);
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
export const OFFER_ESTIMATE_NOTE = '환산점수, 예상 컷, 확인된 모집인원과 입결을 반영한 추정치입니다.';
export const previewScoreLabel = cutoff => cutoff.inputBasis === 'official' ? '예상 환산점수' : '가채점 환산점수';
export function previewScoreNote(cutoff) {
  if (!cutoff.modeled) return '가채점 성적을 반영한 예상 환산점수입니다.';
  const source = cutoff.peerEstimate ? '과거 입결과 유사 모집단위로 추정한 컷입니다.' : '과거 입결로 추정한 2027학년도 컷입니다.';
  return cutoff.projectedInputs ? source + ' 올해 환산에 필요한 일부 값도 추정치를 사용했습니다.' : source;
}
export const CALCULATOR_STAGE_NOTE = '지원 단계는 실제 합격 확률이 아닙니다. 개인별 지원 자격과 학생부·면접·실기 반영은 별도 확인이 필요합니다.';

const differenceFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function cutoffDifference(score, cutoff) {
  if (cutoff === null) return null;
  const delta = score - cutoff;
  if (Math.abs(delta) < 0.005) return '0점';
  return `${delta > 0 ? '+' : '−'}${differenceFormat.format(Math.abs(delta))}점`;
}

export function calculatorScorePosition(score, possibility) {
  const [pass, registered] = comparableCutoffs(possibility);
  if (!isScore(score) || pass === null || registered === null) return null;
  const values = [score, pass, registered];
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * 0.12, 0.05);
  const position = value => 100 * (value - min + padding) / (max - min + 2 * padding);
  return { points: values.map(position), differences: [cutoffDifference(score, pass), cutoffDifference(score, registered)] };
}

export function calculatorCardScoreComparison(score, possibility) {
  const [pass, registered] = comparableCutoffs(possibility);
  const anchor = pass ?? registered;
  if (!isScore(score) || anchor === null) return null;
  const differences = [cutoffDifference(score, pass), cutoffDifference(score, registered)];
  if (pass === null || registered === null || pass === registered) {
    return { points: [score === anchor ? 50 : null, pass === null ? null : 50, registered === null ? null : 50], differences, offscale: null };
  }
  const ratio = (score - pass) / (registered - pass);
  const own = 36 + 28 * Math.max(-1, Math.min(2, ratio));
  const offscale = ratio < -1 ? 'left' : ratio > 2 ? 'right' : null;
  return { points: [own, 36, 64], differences, offscale };
}

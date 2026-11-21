import React from 'react';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';

const labels = { current_two_references: '현행식 기준 참고 비교', prior_data_two_estimates: '기존자료 기준 참고 비교', historical70_only: '70% 참고선 단독',
  academic_score_without_cut: '수능 점수만 계산', held: '비교 보류', explicitly_excluded: '서강대 자료 대기' };
const format = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
const cut = (value, bounds) => bounds && bounds.low !== bounds.high ? `${format(bounds.low)}~${format(bounds.high)}점` : `${format(value)}점`;

export default function CalculatorReference({ reference }) {
  if (!reference) return null;
  return <section className="jcalc-forecast" aria-label="자료 기준별 참고 비교">
    <div className="jcalc-forecast-head"><p>{labels[reference.status]}</p></div>
    {reference.convertedScore !== null ? <>
      <p className="jcalc-probability">환산점수 {format(reference.convertedScore)}점</p>
      {reference.passReference !== null && <p>{reference.referenceYear ? `${reference.referenceYear}학년도 ` : '기존자료 '}합격권 추정선 {cut(reference.passReference, reference.referenceBounds?.pass)}</p>}
      {reference.registered70Reference !== null && <p>70% 참고선 {cut(reference.registered70Reference, reference.referenceBounds?.registered70)}</p>}
      {reference.referenceIndex !== null && <p role="status">참고 지수 {reference.referenceIndex} / 100{reference.indexRange && reference.indexRange.low !== reference.indexRange.high && <><br />가정 범위 {format(reference.indexRange.low)}~{format(reference.indexRange.high)}</>}</p>}
      {reference.riskBand && <CalculatorRiskScale band={reference.riskBand} />}
      <p className="jcalc-forecast-note">{reference.status === 'prior_data_two_estimates' ? '기존 산식·변환표·추정 커트라인으로 계산했습니다. 추정값의 생성연도는 확인되지 않았으며 현행 전형과의 동일성을 보장하지 않습니다.'
        : reference.status === 'academic_score_without_cut' ? '수능 반영 점수만 계산했습니다. 비교할 커트라인이 없어 지수는 제공하지 않습니다.'
          : `${reference.referenceYear}학년도${reference.referenceYear === 2025 ? ' 보완자료' : ' 입결'}를 참고했습니다. ${reference.status === 'historical70_only' ? '70% 참고선만 있어 예상 커트라인과 지수는 제공하지 않습니다.' : '커트라인과 지수의 범위는 계산 가정에 따른 범위입니다.'}`}</p>
      <p className="jcalc-forecast-note">참고 지수는 실제 합격 확률이 아닙니다. 개인별 지원 자격과 학생부·면접·실기 반영은 별도 확인이 필요합니다.</p>
    </> : <p className="jcalc-forecast-note">{reference.status === 'explicitly_excluded' ? '서강대는 필요한 연도별 자료가 확보될 때까지 비교를 보류합니다.' : '이 입력과 전형에 맞는 산식·지원 조건·기준선을 확인해야 합니다.'}</p>}
    {reference.recordId && <details className="jcalc-result-version"><summary>참고 비교 근거</summary><p>연결 번호 {reference.recordId}<br />{reference.sourceIds.join(' · ')}</p></details>}
  </section>;
}

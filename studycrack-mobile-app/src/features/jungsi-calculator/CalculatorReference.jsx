import React from 'react';
import { calculatorCutoffLines, formatCalculatorScore as format, HISTORICAL_CUTOFF_NOTE, referenceCaution, referenceScoreLabel } from './calculator-display.js';

export function CalculatorCutoffLines({ reference, possibility }) {
  return <><dl className="jcalc-cut-lines">{calculatorCutoffLines(reference, possibility).map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {reference?.historical70 && <small className="jcalc-forecast-note">{HISTORICAL_CUTOFF_NOTE}</small>}</>;
}

export default function CalculatorReference({ reference, showCutoffs = true }) {
  if (!reference) return null;
  const available = reference.convertedScore != null;
  return <section className="jcalc-forecast" aria-label="자료 기준별 참고 비교">
    {available ? <><p className="jcalc-reference-score"><span>{referenceScoreLabel(reference)}</span><strong>{format(reference.convertedScore)}<small>점</small></strong></p>
      {showCutoffs && <CalculatorCutoffLines reference={reference} />}
    </> : <p className="jcalc-forecast-note">비교 보류 · 이 입력과 전형의 자료를 확인하고 있습니다.</p>}
    <details className="jcalc-cautions"><summary>주의사항</summary>
      <p className="jcalc-forecast-note">{available ? referenceCaution(reference) : '산식·지원 조건·기준선이 확인된 자료만 제공합니다.'}</p>
      <p className="jcalc-forecast-note">지원 단계는 실제 합격 확률이 아닙니다. 개인별 지원 자격과 학생부·면접·실기 반영은 별도 확인이 필요합니다.</p>
      {reference.recordId && <p className="jcalc-forecast-note">자료 출처 · {reference.recordId}<br />{reference.sourceIds.join(' · ')}</p>}
    </details>
  </section>;
}

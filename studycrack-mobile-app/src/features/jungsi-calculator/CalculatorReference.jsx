import React from 'react';
import { CALCULATOR_STAGE_NOTE, calculatorCutoffLines, formatCalculatorScore as format, HISTORICAL_CUTOFF_NOTE, previewScoreLabel, previewScoreNote, referenceCaution, referenceScoreLabel } from './calculator-display.js';

export function CalculatorCutoffLines({ reference, possibility }) {
  return <><dl className="jcalc-cut-lines">{calculatorCutoffLines(reference, possibility).map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {reference?.historical70 && <small className="jcalc-forecast-note">{HISTORICAL_CUTOFF_NOTE}</small>}</>;
}

export default function CalculatorReference({ reference, previewCutoff, showCutoffs = true }) {
  if (!reference && !previewCutoff) return null;
  const convertedScore = previewCutoff?.convertedScore ?? reference?.convertedScore;
  const available = convertedScore != null;
  return <section className="jcalc-forecast" aria-label="자료 기준별 참고 비교">
    {available ? <><p className="jcalc-reference-score"><span>{previewCutoff ? previewScoreLabel(previewCutoff) : referenceScoreLabel(reference)}</span><strong>{format(convertedScore)}<small>점</small></strong></p>
      {showCutoffs && <CalculatorCutoffLines reference={reference} possibility={previewCutoff} />}
    </> : <p className="jcalc-forecast-note">비교 보류 · 이 입력과 전형의 자료를 확인하고 있습니다.</p>}
    <details className="jcalc-cautions"><summary>주의사항</summary>
      <p className="jcalc-forecast-note">{previewCutoff ? previewScoreNote(previewCutoff) : available ? referenceCaution(reference) : '산식·지원 조건·기준선이 확인된 자료만 제공합니다.'}</p>
      {previewCutoff?.scoreScope === 'csat_component' && <p className="jcalc-forecast-note">환산점수와 예상 컷은 수능 반영분 기준입니다.</p>}
      <p className="jcalc-forecast-note">{CALCULATOR_STAGE_NOTE}</p>
      {reference?.recordId && <p className="jcalc-forecast-note">자료 출처 · {reference.recordId}<br />{reference.sourceIds.join(' · ')}</p>}
    </details>
  </section>;
}

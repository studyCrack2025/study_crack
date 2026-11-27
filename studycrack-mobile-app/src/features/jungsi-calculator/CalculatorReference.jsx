import React from 'react';
import { CALCULATOR_STAGE_NOTE, calculatorCutoffLines, calculatorScorePosition, formatCalculatorScore as format, HISTORICAL_CUTOFF_NOTE, OFFER_ESTIMATE_NOTE, previewScoreLabel, previewScoreNote, referenceCaution, referenceScoreLabel } from './calculator-display.js';

export function CalculatorCutoffLines({ reference, possibility, score }) {
  const position = calculatorScorePosition(score, possibility);
  const lines = calculatorCutoffLines(reference, possibility);
  return <>
    {position && <div className="jcalc-score-position" role="img" data-risk={possibility.riskBand}
      aria-label={`점수 위치 비교. 내 점수 ${format(score)}점. ${lines[0].label} ${lines[0].value}, 내 점수 차이 ${position.differences[0]}. ${lines[1].label} ${lines[1].value}, 내 점수 차이 ${position.differences[1]}.`}>
      <div aria-hidden="true" className="jcalc-score-track">
        {position.points.map((left, index) => <span key={index} data-marker={['own', 'pass', 'registered'][index]} style={{ left: left + '%' }} />)}
      </div>
      <span aria-hidden="true" className="jcalc-score-legend"><b>● 내 점수</b><span>│ 합격 컷</span><span>╎ 70% 컷</span></span>
    </div>}
    <dl className="jcalc-cut-lines">{lines.map(({ label, value }, index) => <div key={label}>
      <dt>{label}</dt><dd>{value}</dd>{position?.differences[index] && <dd className="jcalc-cut-difference"><span>내 점수 차이</span> {position.differences[index]}</dd>}
    </div>)}</dl>
    {possibility?.offerEstimate && <small className="jcalc-forecast-note">{OFFER_ESTIMATE_NOTE}</small>}
    {reference?.historical70 && <small className="jcalc-forecast-note">{HISTORICAL_CUTOFF_NOTE}</small>}</>;
}

export default function CalculatorReference({ reference, previewCutoff, showCutoffs = true }) {
  if (!reference && !previewCutoff) return null;
  const convertedScore = previewCutoff?.convertedScore ?? reference?.convertedScore;
  const available = convertedScore != null;
  return <section className="jcalc-forecast" aria-label="자료 기준별 참고 비교">
    {available ? <><p className="jcalc-reference-score"><span>{previewCutoff ? previewScoreLabel(previewCutoff) : referenceScoreLabel(reference)}</span><strong>{format(convertedScore)}<small>점</small></strong></p>
      {showCutoffs && <CalculatorCutoffLines reference={reference} possibility={previewCutoff} score={convertedScore} />}
    </> : <p className="jcalc-forecast-note">비교 보류 · 이 입력과 전형의 자료를 확인하고 있습니다.</p>}
    <details className="jcalc-cautions"><summary>주의사항</summary>
      <p className="jcalc-forecast-note">{previewCutoff ? previewScoreNote(previewCutoff) : available ? referenceCaution(reference) : '산식·지원 조건·기준선이 확인된 자료만 제공합니다.'}</p>
      {previewCutoff?.scoreScope === 'csat_component' && <p className="jcalc-forecast-note">환산점수와 예상 컷은 수능 반영분 기준입니다.</p>}
      <p className="jcalc-forecast-note">{CALCULATOR_STAGE_NOTE}</p>
      {reference?.recordId && <p className="jcalc-forecast-note">자료 출처 · {reference.recordId}<br />{reference.sourceIds.join(' · ')}</p>}
    </details>
  </section>;
}

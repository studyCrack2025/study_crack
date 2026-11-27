import React from 'react';
import { CALCULATOR_STAGE_NOTE, calculatorCutoffLines, calculatorOfferLine, calculatorScorePosition, formatCalculatorScore as format, HISTORICAL_CUTOFF_NOTE, OFFER_ESTIMATE_NOTE, previewScoreLabel, previewScoreNote, referenceCaution, referenceScoreLabel } from './calculator-display.js';

const curveHeight = x => 100 - 84 * Math.sin(Math.PI * x / 320) ** 4;
const scoreCurve = Array.from({ length: 41 }, (_, index) => {
  const x = index * 8;
  return `${index ? 'L' : 'M'}${x} ${curveHeight(x).toFixed(2)}`;
}).join(' ');

function CardScoreCurve({ points }) {
  const fillId = React.useId();
  const [own, pass, registered] = points.map(point => point * 3.2);
  return <svg className="jcalc-card-score-curve" viewBox="0 0 320 104" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={fillId} x2="0" y2="1">
      <stop stopColor="currentColor" stopOpacity=".22" />
      <stop offset="1" stopColor="currentColor" stopOpacity=".025" />
    </linearGradient></defs>
    <path d={`${scoreCurve} Z`} fill={`url(#${fillId})`} />
    <path d={scoreCurve} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    <line x1={pass} x2={pass} y1="10" y2="100" stroke="currentColor" strokeOpacity=".65" vectorEffect="non-scaling-stroke" />
    <line x1={registered} x2={registered} y1="10" y2="100" stroke="currentColor" strokeOpacity=".65" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
    <circle cx={own} cy={curveHeight(own)} r="5" fill="currentColor" />
  </svg>;
}

export function CalculatorCutoffLines({ reference, possibility, score, compact = false }) {
  const position = calculatorScorePosition(score, possibility);
  const lines = calculatorCutoffLines(compact ? null : reference, possibility, { showOffer: !compact });
  const offer = compact && calculatorOfferLine(possibility);
  return <>
    {position && <div className="jcalc-score-position" role="img" data-risk={possibility.riskBand}
      aria-label={`점수 위치 비교. 내 점수 ${format(score)}점. ${lines[0].label} ${lines[0].value}, 내 점수 차이 ${position.differences[0]}. ${lines[1].label} ${lines[1].value}, 내 점수 차이 ${position.differences[1]}.`}>
      {compact ? <CardScoreCurve points={position.points} /> : <div aria-hidden="true" className="jcalc-score-track">
        {position.points.map((left, index) => <span key={index} data-marker={['own', 'pass', 'registered'][index]} style={{ left: left + '%' }} />)}
      </div>}
      <span aria-hidden="true" className="jcalc-score-legend"><b>● 내 점수</b><span>│ 합격 컷</span><span>╎ 70% 컷</span></span>
    </div>}
    {offer && <p className="jcalc-card-offer"><span>{offer.label}</span> <strong>{offer.value}</strong></p>}
    <dl className="jcalc-cut-lines">{lines.map(({ label, value }, index) => <div key={label}>
      <dt>{label}</dt><dd>{compact ? <span>{value}</span> : value}{compact && position?.differences[index] && <small className="jcalc-card-cut-difference" aria-label={`내 점수 차이 ${position.differences[index]}`}>({position.differences[index]})</small>}</dd>
      {!compact && position?.differences[index] && <dd className="jcalc-cut-difference"><span>내 점수 차이</span> {position.differences[index]}</dd>}
    </div>)}</dl>
    {!compact && possibility?.offerEstimate && <small className="jcalc-forecast-note">{OFFER_ESTIMATE_NOTE}</small>}
    {!compact && reference?.historical70 && <small className="jcalc-forecast-note">{HISTORICAL_CUTOFF_NOTE}</small>}</>;
}

export function CalculatorCautions({ actions, children }) {
  const details = children && <details className="jcalc-cautions"><summary>주의사항</summary>{children}</details>;
  return actions ? <div className="jcalc-card-footer">{details}{actions}</div> : details;
}

export const CARD_SCORE_CURVE_NOTE = '그래프는 점수 위치를 비교하기 위한 그림입니다. 실제 지원자 점수 분포는 포함하지 않습니다.';

export default function CalculatorReference({ reference, previewCutoff, showCutoffs = true, compact = false, actions }) {
  if (!reference && !previewCutoff) return <CalculatorCautions actions={actions} />;
  const convertedScore = previewCutoff?.convertedScore ?? reference?.convertedScore;
  const available = convertedScore != null;
  return <section className="jcalc-forecast" aria-label="자료 기준별 참고 비교">
    {available ? <><p className="jcalc-reference-score"><span>{previewCutoff ? previewScoreLabel(previewCutoff) : referenceScoreLabel(reference)}</span><strong>{format(convertedScore)}<small>점</small></strong></p>
      {showCutoffs && <CalculatorCutoffLines reference={reference} possibility={previewCutoff} score={convertedScore} compact={compact} />}
    </> : <p className="jcalc-forecast-note">비교 보류 · 이 입력과 전형의 자료를 확인하고 있습니다.</p>}
    <CalculatorCautions actions={actions}>
      <p className="jcalc-forecast-note">{previewCutoff ? previewScoreNote(previewCutoff) : available ? referenceCaution(reference) : '산식·지원 조건·기준선이 확인된 자료만 제공합니다.'}</p>
      {compact && calculatorScorePosition(convertedScore, previewCutoff) && <p className="jcalc-forecast-note">{CARD_SCORE_CURVE_NOTE}</p>}
      {compact && calculatorOfferLine(previewCutoff) && <p className="jcalc-forecast-note">{OFFER_ESTIMATE_NOTE}</p>}
      {previewCutoff?.scoreScope === 'csat_component' && <p className="jcalc-forecast-note">환산점수와 예상 컷은 수능 반영분 기준입니다.</p>}
      <p className="jcalc-forecast-note">{CALCULATOR_STAGE_NOTE}</p>
      {reference?.recordId && <p className="jcalc-forecast-note">자료 출처 · {reference.recordId}<br />{reference.sourceIds.join(' · ')}</p>}
    </CalculatorCautions>
  </section>;
}

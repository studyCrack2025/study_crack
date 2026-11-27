import React from 'react';
import { CALCULATOR_STAGE_NOTE, calculatorCardScoreComparison, calculatorCutoffLines, calculatorOfferLine, calculatorScorePosition, formatCalculatorScore as format, HISTORICAL_CUTOFF_NOTE, OFFER_ESTIMATE_NOTE, previewScoreLabel, previewScoreNote, referenceCaution, referenceScoreLabel } from './calculator-display.js';

function CardScoreChart({ points: [own, pass, registered], offscale }) {
  const combined = pass !== null && pass === registered;
  return <>
    <div className="jcalc-card-score-chart" aria-hidden="true">
      <span className="jcalc-card-score-baseline" />
      {pass !== null && registered !== null && !combined && <span className="jcalc-card-score-band" style={{ left: `${pass}%`, width: `${registered - pass}%` }} />}
      {pass !== null && <span className="jcalc-card-score-cut" data-marker={combined ? 'combined' : 'pass'} style={{ left: `${pass}%` }} />}
      {registered !== null && !combined && <span className="jcalc-card-score-cut" data-marker="registered" style={{ left: `${registered}%` }} />}
      {own !== null && <span className="jcalc-card-own-score" data-marker="own" data-offscale={offscale} style={{ left: `${own}%` }}>
        {offscale && (offscale === 'left' ? '←' : '→')}
      </span>}
    </div>
    <span aria-hidden="true" className="jcalc-score-legend">
      {own !== null && <b>{offscale ? '↔' : '●'} 내 점수</b>}
      {combined ? <span>│ 두 컷 동일</span> : <>
        {pass !== null && <span>│ 합격 컷</span>}
        {registered !== null && <span>╎ 70% 컷</span>}
      </>}
    </span>
  </>;
}

export function CalculatorCutoffLines({ reference, possibility, score, compact = false }) {
  const position = compact ? calculatorCardScoreComparison(score, possibility) : calculatorScorePosition(score, possibility);
  const lines = calculatorCutoffLines(compact ? null : reference, possibility, { showOffer: !compact });
  const offer = compact && calculatorOfferLine(possibility);
  const chartDescription = position && lines.slice(0, 2).map(({ label, value }, index) => {
    const difference = position.differences[index];
    return difference ? `${label} ${value}, 내 점수 차이 ${difference}.` : '';
  }).filter(Boolean).join(' ');
  const offscaleNote = position?.offscale === 'left' ? ' 내 점수는 왼쪽 표시 범위 밖입니다.' : position?.offscale === 'right' ? ' 내 점수는 오른쪽 표시 범위 밖입니다.' : '';
  return <>
    {position && <div className="jcalc-score-position" role="img" data-risk={possibility.riskBand}
      aria-label={`점수 위치 비교. 내 점수 ${format(score)}점. ${chartDescription}${offscaleNote}`}>
      {compact ? <CardScoreChart {...position} /> : <>
        <div aria-hidden="true" className="jcalc-score-track">
          {position.points.map((left, index) => <span key={index} data-marker={['own', 'pass', 'registered'][index]} style={{ left: left + '%' }} />)}
        </div>
        <span aria-hidden="true" className="jcalc-score-legend"><b>● 내 점수</b><span>│ 합격 컷</span><span>╎ 70% 컷</span></span>
      </>}
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

export const CARD_SCORE_COMPARISON_NOTE = '그래프는 같은 환산 척도의 컷과 내 점수를 비교합니다. 화살표는 내 점수가 그래프의 표시 범위를 벗어났음을 뜻합니다.';

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
      {compact && calculatorCardScoreComparison(convertedScore, previewCutoff) && <p className="jcalc-forecast-note">{CARD_SCORE_COMPARISON_NOTE}</p>}
      {compact && calculatorOfferLine(previewCutoff) && <p className="jcalc-forecast-note">{OFFER_ESTIMATE_NOTE}</p>}
      {previewCutoff?.scoreScope === 'csat_component' && <p className="jcalc-forecast-note">환산점수와 예상 컷은 수능 반영분 기준입니다.</p>}
      <p className="jcalc-forecast-note">{CALCULATOR_STAGE_NOTE}</p>
      {reference?.recordId && <p className="jcalc-forecast-note">자료 출처 · {reference.recordId}<br />{reference.sourceIds.join(' · ')}</p>}
    </CalculatorCautions>
  </section>;
}

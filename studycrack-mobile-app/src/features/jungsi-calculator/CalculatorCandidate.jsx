import React from 'react';
import CalculatorResult from './CalculatorResult.jsx';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { calculatorIndicator } from './calculator-indicators.js';
import { calculatorOfferLine } from './calculator-display.js';

export function CalculatorCandidateDetails({ target, entry, indicator, representative, label, onRetry, portfolio = false }) {
  const { universityName, unitName, campusName, trackName } = target.selection;
  const result = entry?.result;
  const offer = result && calculatorOfferLine(result.previewCutoff ?? result.possibility);
  const description = [universityName, unitName, campusName, trackName].join(' ');
  const status = entry?.status === 'loading' ? '계산 중' : entry?.status === 'error' ? '조회 실패' : '계산 대기';
  return <>
    <header className="jcalc-candidate-summary">
      <div className="jcalc-candidate-title">{(label || representative) && <small>{label || '대표'}</small>}<strong>{universityName}</strong><span>{unitName}</span></div>
      <div className="jcalc-candidate-status">
        {indicator ? <CalculatorRiskScale band={indicator.band} label={indicator.label} /> : <small>{status}</small>}
        {offer && <strong className="jcalc-candidate-estimate" aria-label={offer.label + ' ' + offer.value}>{offer.value.split(' (')[0]}</strong>}
      </div>
    </header>
    <details className="jcalc-candidate-details" open={portfolio || undefined}>
      <summary><span className="jcalc-card-expand">펼쳐보기 <span aria-hidden="true">▾</span></span><span className="jcalc-card-collapse">접기 <span aria-hidden="true">▴</span></span><span className="jcalc-card-context"> {description}</span></summary>
      <p>{result?.selectionCampusName ?? campusName} · {trackName}</p>
      {result ? <CalculatorResult exactSelection current result={result} offerInDetails={portfolio} />
        : <div className="jcalc-group-result-state">
          {entry?.status === 'error' ? <><CalculatorNote role="alert">{entry.error}</CalculatorNote>{onRetry && <CalculatorButton onClick={() => onRetry(target)}>후보 다시 계산</CalculatorButton>}</>
            : <CalculatorNote role="status">{status}</CalculatorNote>}
        </div>}
    </details>
  </>;
}

export default function CalculatorCandidate({ target, entry, representative, onRepresentative, onRemove, onRetry }) {
  const { universityName, unitName, campusName, trackName } = target.selection;
  const indicator = entry?.result && calculatorIndicator(entry.result);
  const description = [universityName, unitName, campusName, trackName].join(' ');
  return <li className="jcalc-basic-result-card" data-risk={indicator?.band || undefined}>
    <CalculatorCandidateDetails target={target} entry={entry} indicator={indicator} representative={representative} onRetry={onRetry} />
    {(onRepresentative || onRemove) && <div className="jcalc-candidate-actions">
      {onRepresentative && !representative && <CalculatorButton text aria-label={description + ' 대표로 선택'} onClick={() => onRepresentative(target)}>대표로 선택</CalculatorButton>}
      {onRemove && <CalculatorButton text aria-label={description + ' 후보 삭제'} onClick={() => onRemove(target.selection.key)}>후보 삭제</CalculatorButton>}
    </div>}
  </li>;
}

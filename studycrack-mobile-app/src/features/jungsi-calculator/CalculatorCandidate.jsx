import React from 'react';
import CalculatorResult from './CalculatorResult.jsx';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { calculatorIndicator } from './calculator-indicators.js';
import { calculatorOfferLine } from './calculator-display.js';

export default function CalculatorCandidate({ target, entry, representative, onRepresentative, onRemove, onRetry }) {
  const { universityName, unitName, campusName, trackName } = target.selection;
  const result = entry?.result;
  const indicator = result && calculatorIndicator(result);
  const offer = result && calculatorOfferLine(result.previewCutoff ?? result.possibility);
  const description = [universityName, unitName, campusName, trackName].join(' ');
  const status = entry?.status === 'loading' ? '계산 중' : entry?.status === 'error' ? '조회 실패' : '계산 대기';
  return <li data-risk={indicator?.band || undefined}>
    <div className="jcalc-candidate-summary">
      <div><strong>{universityName}</strong><span>{unitName}</span>{representative && <small>대표</small>}</div>
      {offer ? <strong className="jcalc-candidate-estimate" aria-label={offer.label + ' ' + offer.value}>{offer.value.split(' (')[0]}</strong>
        : indicator ? <CalculatorRiskScale {...indicator} /> : <small>{status}</small>}
    </div>
    <details className="jcalc-candidate-details">
      <summary aria-label={description + ' 펼쳐보기'}>펼쳐보기</summary>
      <p>{result?.selectionCampusName ?? campusName} · {trackName}</p>
      {result ? <CalculatorResult exactSelection current result={result} />
        : <div className="jcalc-group-result-state">
          {entry?.status === 'error' ? <><CalculatorNote role="alert">{entry.error}</CalculatorNote>{onRetry && <CalculatorButton onClick={() => onRetry(target)}>후보 다시 계산</CalculatorButton>}</>
            : <CalculatorNote role="status">{status}</CalculatorNote>}
        </div>}
    </details>
    {(onRepresentative || onRemove) && <div className="jcalc-candidate-actions">
      {onRepresentative && !representative && <CalculatorButton text aria-label={description + ' 대표로 선택'} onClick={() => onRepresentative(target)}>대표로 선택</CalculatorButton>}
      {onRemove && <CalculatorButton text aria-label={description + ' 후보 삭제'} onClick={() => onRemove(target.selection.key)}>후보 삭제</CalculatorButton>}
    </div>}
  </li>;
}

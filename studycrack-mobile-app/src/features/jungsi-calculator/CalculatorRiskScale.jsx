import React from 'react';
import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';

export default function CalculatorRiskScale({ band }) {
  const label = CALCULATOR_RISK_BANDS.find(([key]) => key === band)?.[1];
  return <span className="jcalc-forecast-badge" role="status" data-risk={label ? band : 'unavailable'} aria-label={`지원 단계: ${label || '판단 대기'}`}>{label || '판단 대기'}</span>;
}

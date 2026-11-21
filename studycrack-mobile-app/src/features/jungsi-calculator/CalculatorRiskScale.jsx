import React from 'react';
import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';

export default function CalculatorRiskScale({ band }) {
  if (!CALCULATOR_RISK_BANDS.some(([key]) => key === band)) return <p className="jcalc-note">지원 단계 판단 대기</p>;
  return <ol className="jcalc-risk-scale" aria-label="지원 가능성 5단계">{CALCULATOR_RISK_BANDS.map(([key, title]) => <li key={key} aria-current={key === band ? 'true' : undefined}>{title}</li>)}</ol>;
}

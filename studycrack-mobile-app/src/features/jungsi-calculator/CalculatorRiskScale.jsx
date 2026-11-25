import React from 'react';

export default function CalculatorRiskScale({ band, label }) {
  return <span className="jcalc-forecast-badge" role="status" data-risk={band || 'unavailable'} aria-label={`지원 단계: ${label}`}>{label}</span>;
}

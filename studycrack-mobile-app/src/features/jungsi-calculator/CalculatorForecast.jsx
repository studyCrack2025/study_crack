import React from 'react';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';
import { calculatorIndicator } from './calculator-indicators.js';

const messages = {
  CUT_ANCHOR_SPREAD_UNRESOLVED: '두 컷이 가까워 환산점수를 예상 합격 컷과 비교했습니다.',
  CUT_REFERENCE_REVIEW_REQUIRED: '예상 컷의 입결 근거를 검수하고 있습니다.',
  CUT_REFERENCE_BACKEND_UPDATE_REQUIRED: '환산점수만 제공됩니다. 지원 단계 조회를 준비하고 있습니다.',
  CUT_REFERENCE_CONTEXT_MISMATCH: '환산점수와 컷의 반영 기준을 확인하고 있습니다.',
  CUT_REFERENCE_RESPONSE_INVALID: '결과를 확인하지 못했습니다. 다시 조회해주세요.',
  CUT_REFERENCE_TEMPORARILY_UNAVAILABLE: '입결 자료를 불러오지 못했습니다. 다시 조회해주세요.'
};

export function calculatorForecastNote(possibility) {
  return possibility?.status === 'available' ? `${possibility.sourceYear}학년도 입결 · 지원 단계는 실제 합격률이 아닙니다.` : messages[possibility?.reasonCodes?.[0]] || '예상 컷의 입결 근거를 확인하고 있습니다.';
}
export default function CalculatorForecast({ result, current = true }) {
  return <CalculatorRiskScale {...calculatorIndicator(current ? result : null)} />;
}

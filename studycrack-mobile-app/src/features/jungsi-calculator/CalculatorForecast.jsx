import React from 'react';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';

const messages = {
  CUT_ANCHOR_SPREAD_UNRESOLVED: '두 기준선이 같은 점수이거나 매우 가까워 지원 단계는 판단 대기입니다.',
  CUT_REFERENCE_CONVERSION_UNAVAILABLE: '환산점수를 확인한 뒤 검수된 입결 기준선으로 가능성을 안내합니다.',
  CUT_REFERENCE_BACKEND_UPDATE_REQUIRED: '가능성 지수 조회를 준비하고 있습니다. 현재는 검수된 환산점수만 확인할 수 있습니다.',
  CUT_REFERENCE_REVIEW_REQUIRED: '입결 기준선의 검수가 완료되지 않아 지수와 지원 단계의 판단을 보류합니다.',
  CUT_REFERENCE_UNIT_NOT_REVIEWED: '선택한 모집단위의 입결 기준선 검수가 아직 완료되지 않았습니다.',
  CUT_REFERENCE_CONTEXT_MISMATCH: '환산점수와 입결 기준선의 자료 버전·척도를 확인해야 합니다. 현재는 판단을 보류합니다.',
  CUT_REFERENCE_SOURCE_UNAVAILABLE: '검수된 입결 근거 자료를 확인하지 못해 판단을 보류합니다.',
  CUT_REFERENCE_RESPONSE_INVALID: '가능성 지수 결과를 확인하지 못했습니다. 다시 조회해주세요.',
  CUT_REFERENCE_TEMPORARILY_UNAVAILABLE: '입결 자료를 불러오지 못했습니다. 잠시 후 다시 조회해주세요.'
};

export function calculatorForecastNote(possibility) {
  return possibility?.status === 'available' ? `${possibility.sourceYear}학년도 입결 · 지원 단계는 실제 합격률이 아닙니다.` : messages[possibility?.reasonCodes?.[0]] || '입결 자료를 확인하고 있습니다. 지원 단계는 판단 대기입니다.';
}
export default function CalculatorForecast({ possibility, result, current = true }) {
  const formal = result?.status === 'available', value = result ? result.possibility : possibility;
  const band = current && (!result || formal) && value?.status === 'available' ? value.riskBand : null;
  return <CalculatorRiskScale band={band} />;
}

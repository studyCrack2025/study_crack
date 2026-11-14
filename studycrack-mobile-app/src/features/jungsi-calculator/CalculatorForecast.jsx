import React from 'react';

const bands = [['stable', '안정'], ['appropriate', '적정'], ['neutral', '중립'], ['challenge', '도전'], ['risky', '위험']];
const messages = {
  FORECAST_CONVERSION_NOT_AVAILABLE: '환산 자료가 준비되고 확률 검증이 완료되면 예상 합격 가능성을 안내합니다.',
  FORECAST_BACKEND_UPDATE_REQUIRED: '확률 조회 기능을 준비하고 있습니다. 현재는 검수된 환산점수만 확인할 수 있습니다.',
  FORECAST_PUBLICATION_NOT_APPROVED: '합불 자료와 확률 모델의 공개 검증이 완료되지 않아 수치를 제공하지 않습니다.',
  FORECAST_MODEL_NOT_CONFIGURED: '검증된 확률 모델이 아직 연결되지 않았습니다.',
  FORECAST_UNIT_NOT_VALIDATED: '선택한 모집단위의 합불 자료와 확률 검증이 아직 충분하지 않습니다.',
  FORECAST_UNIT_VALIDATION_NOT_PASSED: '이 모집단위의 표본·연도·보정 검증 기준을 충족하지 못해 수치를 제공하지 않습니다.',
  FORECAST_VALIDATION_NOT_PASSED: '표본·평가 연도·확률 보정의 검증 기준을 충족하지 못해 수치를 제공하지 않습니다.',
  FORECAST_CALIBRATION_NOT_PASSED: '이 대학·계열의 확률 모델 검증 기준을 충족하지 못해 수치를 제공하지 않습니다.',
  FORECAST_SCORE_OUTSIDE_VALIDATED_RANGE: '입력한 성적은 확률을 검증한 점수 범위를 벗어나 있어 수치를 제공하지 않습니다.',
  FORECAST_CUTOFF_NOT_VERIFIED: '동일한 모집단위·산식으로 확인된 합격선 자료가 부족합니다.',
  FORECAST_RESPONSE_INVALID: '확률 결과를 확인하지 못했습니다. 다시 조회해주세요.',
  FORECAST_TEMPORARILY_UNAVAILABLE: '확률 자료를 불러오지 못했습니다. 잠시 후 다시 조회해주세요.'
};

export default function CalculatorForecast({ forecast }) {
  const available = forecast?.status === 'available';
  const label = available ? bands.find(([key]) => key === forecast.riskBand)?.[1] : '판단 보류';
  const probability = forecast?.probability;
  return <section className="jcalc-forecast" aria-label="예상 합격 가능성" data-risk={available ? forecast.riskBand : 'unavailable'}>
    <div className="jcalc-forecast-head"><p>예상 합격 가능성</p><b className="jcalc-forecast-badge">{label}</b></div>
    {available ? <>
      <p className="jcalc-probability" role="status">{probability.qualifier === 'less_than' ? '1% 미만' : probability.qualifier === 'more_than' ? '99% 초과' : `약 ${probability.percent}%`}</p>
      <ol className="jcalc-risk-scale" aria-label="지원 가능성 5단계">{bands.map(([key, title]) => <li key={key} aria-current={key === forecast.riskBand ? 'true' : undefined}>{title}</li>)}</ol>
      <p className="jcalc-forecast-note">입력 성적과 검증된 모델에 따른 추정치입니다. 합격을 보장하지 않습니다.</p>
      <details className="jcalc-result-version"><summary>확률 자료 기준</summary><p>2027학년도 · {forecast.modelVersion}<br />{forecast.publicationId}<br />검증일 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul' }).format(new Date(forecast.validatedAt))}</p></details>
    </> : <p className="jcalc-forecast-note">{messages[forecast?.reasonCodes?.[0]] || '이 모집단위의 자료·모델 검증 상태를 확인해야 합니다. 현재는 확률과 지원 단계의 판단을 보류합니다.'}</p>}
  </section>;
}

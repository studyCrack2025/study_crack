import React from 'react';

const bands = [['stable', '안정'], ['appropriate', '적정'], ['neutral', '중립'], ['challenge', '도전'], ['risky', '위험']];
const messages = {
  CUT_REFERENCE_CONVERSION_UNAVAILABLE: '환산점수를 확인한 뒤 검수된 입결 기준선으로 가능성을 안내합니다.',
  CUT_REFERENCE_BACKEND_UPDATE_REQUIRED: '가능성 지수 조회를 준비하고 있습니다. 현재는 검수된 환산점수만 확인할 수 있습니다.',
  CUT_REFERENCE_REVIEW_REQUIRED: '입결 기준선의 검수가 완료되지 않아 지수와 지원 단계의 판단을 보류합니다.',
  CUT_REFERENCE_UNIT_NOT_REVIEWED: '선택한 모집단위의 입결 기준선 검수가 아직 완료되지 않았습니다.',
  CUT_REFERENCE_CONTEXT_MISMATCH: '환산점수와 입결 기준선의 자료 버전·척도를 확인해야 합니다. 현재는 판단을 보류합니다.',
  CUT_REFERENCE_SOURCE_UNAVAILABLE: '검수된 입결 근거 자료를 확인하지 못해 판단을 보류합니다.',
  CUT_REFERENCE_RESPONSE_INVALID: '가능성 지수 결과를 확인하지 못했습니다. 다시 조회해주세요.',
  CUT_REFERENCE_TEMPORARILY_UNAVAILABLE: '입결 자료를 불러오지 못했습니다. 잠시 후 다시 조회해주세요.'
};

export default function CalculatorForecast({ possibility }) {
  const available = possibility?.status === 'available';
  const label = available ? bands.find(([key]) => key === possibility.riskBand)?.[1] : '판단 보류';
  return <section className="jcalc-forecast" aria-label="합격 가능성 지수" data-risk={available ? possibility.riskBand : 'unavailable'}>
    <div className="jcalc-forecast-head"><p>합격 가능성 지수</p><b className="jcalc-forecast-badge">{label}</b></div>
    {available ? <>
      <p className="jcalc-probability" role="status">약 {possibility.index.points}점 / 100</p>
      <ol className="jcalc-risk-scale" aria-label="지원 가능성 5단계">{bands.map(([key, title]) => <li key={key} aria-current={key === possibility.riskBand ? 'true' : undefined}>{title}</li>)}</ol>
      <p className="jcalc-forecast-note">입결 기준선에 따른 100점 척도의 지수입니다. 실제 합격률이 아니며 합격을 보장하지 않습니다.</p>
      <details className="jcalc-result-version"><summary>가능성 지수 자료 기준</summary><p>{possibility.sourceYear}학년도 입결 · {possibility.targetYear}학년도 반영 기준<br />{possibility.policyVersion}<br />{possibility.publicationId}<br />검수일 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul' }).format(new Date(possibility.validatedAt))}</p></details>
    </> : <p className="jcalc-forecast-note">{messages[possibility?.reasonCodes?.[0]] || '이 모집단위의 입결 자료 검수 상태를 확인해야 합니다. 현재는 지수와 지원 단계의 판단을 보류합니다.'}</p>}
  </section>;
}

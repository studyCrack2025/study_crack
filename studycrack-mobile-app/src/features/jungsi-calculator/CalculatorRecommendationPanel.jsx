import React from 'react';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { CalculatorStrategySelect } from './CalculatorRecommendationPreferences.jsx';
import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';
import { requestCalculatorRecommendations } from './calculator-recommendation-api.js';

const labels = new Map(CALCULATOR_RISK_BANDS);
const relaxations = ['', '같은 권역까지 확대', '전국으로 확대', '유사 계열로 확대', '유사 계열 · 같은 권역까지 확대', '유사 계열 · 전국으로 확대'];
const points = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 });

export default function CalculatorRecommendationPanel({ group, binding, recommendation, saved, onResults, currentTarget, onPick, denyAccess, disabled }) {
  const { scores, preferences, saveStrategy } = recommendation;
  const [strategy, setStrategy] = React.useState(preferences.strategy);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const controller = React.useRef(null);
  const requestKey = JSON.stringify([scores, preferences.streams, preferences.regions, strategy]);
  const shown = saved?.key === requestKey ? saved.data : null;
  React.useEffect(() => () => controller.current?.abort(), []);

  async function recommend() {
    if (!strategy || disabled || controller.current) return;
    const request = new AbortController(); controller.current = request;
    setPending(true); setError('');
    try {
      const savedStrategy = await saveStrategy(strategy);
      if (request.signal.aborted) return;
      if (!savedStrategy.ok) { setError(savedStrategy.error || '지원 성향을 저장하지 못했습니다. 다시 시도해주세요.'); return; }
      const result = await requestCalculatorRecommendations(binding, { scores, admissionGroup: group,
        preferences: { ...preferences, strategy }, previousUniversities: saved?.data.items.map(item => item.universityKey) ?? [], signal: request.signal });
      if (request.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED' || [401, 403].includes(result.status)) { denyAccess(); return; }
      if (result.ok) onResults({ key: requestKey, data: result.data });
      else setError(result.error);
    } catch (_) {
      if (!request.signal.aborted) setError('추천을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      if (controller.current === request) controller.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }

  return <section className="jcalc-picker-recommendations" aria-label="군별 지원 추천">
    <div className="jcalc-workspace-actions">
      <CalculatorStrategySelect value={strategy} disabled={pending || disabled} onChange={value => { setStrategy(value); setError(''); }} />
      <CalculatorButton primary disabled={!strategy || pending || disabled} onClick={recommend}>{saved ? '다시 추천받기' : '지원 추천받기'}</CalculatorButton>
    </div>
    {pending && <CalculatorNote role="status">지원 후보를 찾고 있습니다…</CalculatorNote>}
    {error && <p className="jcalc-error" role="alert">{error}</p>}
    {shown && <div aria-live="polite">
      {shown.items.length === 0 ? <CalculatorNote>조건을 넓혀도 해당 지원 단계의 후보가 없습니다. 대학·학과를 직접 검색할 수 있습니다.</CalculatorNote> : <>
        {shown.scoreBasis === 'estimated' && <CalculatorNote>가채점 추정 성적 기준</CalculatorNote>}
        <ul className="jcalc-picker-results">{shown.items.map(item => {
          const { target, riskBand, tier, convertedScore, cutoffs, offerEstimate, scoreScope } = item;
          const { selection } = target, selected = currentTarget?.selection.key === selection.key;
          return <li key={selection.key}><div>
            <strong>{selection.universityName} · {labels.get(riskBand)}</strong>
            <span>{selection.unitName}</span>
            <small>{selection.campusName} · {selection.trackName}</small>
            <small>{scoreScope === 'csat_component' ? '수능 반영점수' : '내 환산점수'} {points.format(convertedScore)}점 · 예상 합격 컷 {points.format(cutoffs.pass)}점</small>
            {offerEstimate && <small>추정 합격 가능성 {offerEstimate.low}~{offerEstimate.high}%</small>}
            {tier > 0 ? <small>{relaxations[tier]}</small> : (preferences.streams.length > 0 || preferences.regions.length > 0) && <small>희망 조건 일치</small>}
          </div><CalculatorButton disabled={selected || pending || disabled} aria-label={selected ? undefined : `${selection.universityName} ${selection.unitName} 이 후보 담기`}
            onClick={() => onPick(target)}>{selected ? '선택됨' : '이 후보 담기'}</CalculatorButton></li>;
        })}</ul>
        {shown.items.length === 1 && <CalculatorNote>다른 대학에서 해당 지원 단계의 후보를 찾지 못했습니다.</CalculatorNote>}
        {shown.repeatedUniversities > 0 && <CalculatorNote>조건에 맞는 다른 대학이 부족해 직전 추천 대학 {shown.repeatedUniversities}곳이 포함됐습니다.</CalculatorNote>}
      </>}
    </div>}
  </section>;
}

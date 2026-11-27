import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';
import { requestCalculatorRecommendations } from './calculator-recommendation-api.js';

const labels = new Map(CALCULATOR_RISK_BANDS);
const historyLimit = 8;

export default function CalculatorRecommendationPanel({ group, binding, recommendation, saved, onResults, currentTarget, onPick, denyAccess, disabled, canAdd = true, alreadyAdded }) {
  const { scores, preferences, revision, eligibilityEnabled, applicationId, onEditPreferences } = recommendation;
  const consulting = React.useMemo(() => getMobileApiBinding('consulting', 'consultingApiUrl'), []);
  const strategy = preferences.strategy;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const controller = React.useRef(null);
  const requestKey = JSON.stringify([applicationId, group, revision, scores, preferences]);
  const current = saved?.key === requestKey ? saved : null;
  const shown = current?.data;

  React.useEffect(() => {
    let active = true;
    setPending(false);
    setError('');
    if (!shown) queueMicrotask(() => { if (active) void recommend(); });
    return () => {
      active = false;
      controller.current?.abort();
      controller.current = null;
    };
  }, [requestKey, disabled]);

  async function recommend(excludePrevious = false) {
    if (!strategy || disabled || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setError('');
    try {
      const previousUniversities = excludePrevious ? current?.history ?? [] : [];
      const result = await requestCalculatorRecommendations(eligibilityEnabled ? consulting : binding, { scores, admissionGroup: group, preferences,
        profile: eligibilityEnabled ? { applicationId, profileRevision: revision } : null,
        previousUniversities, signal: request.signal });
      if (request.signal.aborted) return;
      if (result.code === 'CALCULATOR_ACCESS_REQUIRED' || [401, 403].includes(result.status)) { denyAccess(); return; }
      if (!result.ok) { setError(result.error); return; }
      const keys = result.data.items.map(item => item.universityKey);
      const unchanged = excludePrevious && keys.length > 0 && keys.length === shown?.items.length
        && keys.every(key => shown.items.some(item => item.universityKey === key));
      onResults({ key: requestKey, data: result.data, unchanged,
        history: [...new Set([...keys, ...previousUniversities])].slice(0, historyLimit) });
    } catch (_) {
      if (!request.signal.aborted) setError('추천을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      if (controller.current === request) controller.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }

  return <section className="jcalc-picker-recommendations" aria-label="군별 지원 추천">
    <div className="jcalc-workspace-actions">
      {!strategy && <CalculatorButton disabled={disabled} onClick={onEditPreferences}>지원 성향 입력</CalculatorButton>}
      {(shown || error) && <CalculatorButton text disabled={disabled || pending} onClick={() => recommend(Boolean(shown))}>{error ? '추천 다시 시도' : '다시 추천받기'}</CalculatorButton>}
    </div>
    {pending && <CalculatorNote role="status">지원 후보를 찾고 있습니다…</CalculatorNote>}
    {error && <p className="jcalc-error" role="alert">{error}</p>}
    {shown && <div aria-live="polite">
      {shown.items.length === 0 ? <CalculatorNote>조건을 넓혀도 해당 지원 단계의 후보가 없습니다. 대학·학과를 직접 검색할 수 있습니다.</CalculatorNote> : <>
        <ul className="jcalc-recommendation-list">{shown.items.map(item => {
          const { target, riskBand, offerEstimate } = item;
          const { selection } = target, selected = alreadyAdded ? alreadyAdded(target) : currentTarget?.selection.key === selection.key;
          return <li key={selection.key}><div>
            <strong>{selection.universityName} · {labels.get(riskBand)}</strong>
            <span>{selection.unitName}</span>
            <small>{offerEstimate ? `추정 합격 가능성 ${offerEstimate.low}~${offerEstimate.high}%` : '추정치 없음'}</small>
          </div>{selected ? <small>담음</small> : <CalculatorButton text disabled={pending || disabled || !canAdd} aria-label={`${selection.universityName} ${selection.unitName} 이 후보 담기`}
            onClick={() => onPick(target)}>담기</CalculatorButton>}</li>;
        })}</ul>
        {current.unchanged && <CalculatorNote>현재 조건에서 다른 추천 조합을 찾지 못했어요.</CalculatorNote>}
      </>}
    </div>}
  </section>;
}

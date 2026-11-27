import React from 'react';
import { RECOMMENDATION_REGIONS, RECOMMENDATION_STRATEGIES, RECOMMENDATION_STREAMS } from './calculator-recommendation-preferences.js';

export function CalculatorStrategySelect({ value, onChange, disabled }) {
  return <label className="jcalc-field"><span>지원 성향</span>
    <select value={value ?? ''} disabled={disabled} onChange={event => onChange(event.currentTarget.value || null)}>
      <option value="">지원 성향 선택</option>
      {RECOMMENDATION_STRATEGIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
  </label>;
}

export default function CalculatorRecommendationPreferences({ value, onChange, gender, onGenderChange }) {
  return <fieldset className="jcalc-subject"><legend>지원 추천 조건</legend>
    {[['streams', '희망 계열', RECOMMENDATION_STREAMS, 3], ['regions', '희망 지역', RECOMMENDATION_REGIONS, 2]].map(([key, label, options, limit]) =>
      <fieldset className="jcalc-preference-options" key={key}>
        <legend>{label} <small>{value[key].length}/{limit} 선택</small></legend>
        <div>{options.map(([id, name]) => {
          const checked = value[key].includes(id);
          return <label key={id}><input type="checkbox" checked={checked} disabled={!checked && value[key].length >= limit}
            onChange={() => onChange({ ...value, [key]: checked ? value[key].filter(item => item !== id) : [...value[key], id].sort() })} />{name}</label>;
        })}</div>
      </fieldset>)}
    {onGenderChange && <label className="jcalc-field"><span>성별</span>
      <select value={gender} onChange={event => onGenderChange(event.currentTarget.value)}>
        <option value="" disabled>성별 선택</option><option value="male">남성</option><option value="female">여성</option>
      </select><small>지원 가능한 전형을 추천하는 데 사용합니다.</small>
    </label>}
    <CalculatorStrategySelect value={value.strategy} onChange={strategy => onChange({ ...value, strategy })} />
  </fieldset>;
}

import React from 'react';
import CalculatorForecast from './CalculatorForecast.jsx';

const groups = { ga: '가군', na: '나군', da: '다군' };
const explanations = {
  DATA_RELEASE_NOT_READY: '2027학년도 환산 자료의 운영 승인을 기다리고 있습니다.',
  CROSSWALK_NOT_APPROVED: '이 자료 버전의 학과·전형 연결 검수가 아직 완료되지 않았습니다.',
  UNIT_NOT_REVIEWED: '선택한 학과는 아직 환산 검수가 완료되지 않았습니다.',
  UNIT_SELECTION_REQUIRED: '캠퍼스·전형·모집군을 선택한 뒤 다시 조회해주세요.',
  UNIT_SELECTION_CHANGED: '자료가 바뀌었습니다. 전형을 다시 선택해주세요.',
  RAW_SCOREBOARD_NOT_RELEASED: '2027학년도 가채점 변환 자료가 아직 없습니다. 성적표 기준으로 입력하면 환산을 조회할 수 있습니다.',
  DATA_RELEASE_CHANGED: '조회 중 자료가 갱신되었습니다. 다시 조회해주세요.',
  MATH_SELECTION_NOT_ALLOWED: '선택한 수학 과목이 이 모집단위의 응시 조건에 맞지 않습니다.',
  INQUIRY_TRACK_NOT_ALLOWED: '선택한 탐구 과목이 이 모집단위의 응시 조건에 맞지 않습니다.',
  SPECIAL_REQUIREMENT_REVIEW_REQUIRED: '추가 지원 조건을 확인해야 하는 전형입니다.',
  SCORE_LOOKUP_NOT_FOUND: '환산에 필요한 등급표 또는 탐구 변환표가 아직 준비되지 않았습니다.',
  FORMULA_REQUIRES_MANUAL_REVIEW: '이 모집단위의 환산식 검수가 아직 완료되지 않았습니다.'
};
const formatted = score => score.toLocaleString('ko-KR', { maximumFractionDigits: 6 });

export default function CalculatorResult({ result, current, selectedId, onSelect }) {
  if (!result) return <small>환산점수 조회 후 자료 상태를 확인할 수 있습니다.</small>;
  const explanation = result.reasonCodes.map(code => explanations[code]).find(Boolean) || '이 모집단위의 산식·지원 조건을 더 확인해야 합니다. 현재는 점수를 제공하지 않습니다.';
  return <div className="jcalc-result">
    {result.choices.length > 1 && <label className="jcalc-field"><span>캠퍼스·전형·모집군</span><select aria-label={`${result.university} ${result.major} 전형 선택`} value={selectedId || ''} onChange={event => onSelect(event.target.value)}><option value="">선택해주세요</option>{result.choices.map(option => <option key={option.admissionUnitId} value={option.admissionUnitId}>{option.campusName} · {option.unitName} · {option.trackName} · {groups[option.admissionGroup]}</option>)}</select></label>}
    {current && result.selected && <p className="jcalc-result-context">{result.selected.campusName} · {result.selected.unitName}<br />{result.selected.trackName} · {groups[result.selected.admissionGroup]}</p>}
    {current ? result.status === 'available' ? <div className="jcalc-score"><span>내 환산점수</span><strong>{formatted(result.convertedScore)}<small>점</small></strong><small>기준 만점 {formatted(result.maximumScore)}점 · 가산점에 따라 초과할 수 있습니다.</small></div>
      : <p className="jcalc-result-message">{result.status === 'ineligible' && <b>응시 조건 확인 필요<br /></b>}{explanation}</p>
      : <p className="jcalc-result-message">입력 조건이 바뀌었습니다. 환산점수를 다시 조회해주세요.</p>}
    {current && <CalculatorForecast forecast={result.forecast} />}
  </div>;
}

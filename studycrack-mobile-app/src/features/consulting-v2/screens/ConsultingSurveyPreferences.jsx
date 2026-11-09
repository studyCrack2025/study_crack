import React from 'react';
import { getMobileApiBinding } from '../../../shared/browser/mobile-runtime.js';
import { fetchUniversityCatalog } from '../../analysis/api.js';
import { ADDITIONAL_PREFERENCE_MAX, EMPTY_RANKED_CHOICE, hasRankedChoice, MAX_RANKED_CHOICES } from '../survey-model.js';

const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충북', '충남', '광주', '전북', '전남', '대구', '경북', '부산', '울산', '경남', '제주'];
const TRACKS = [
  '인문·어문', '사회과학', '경영·경제', '자연과학·수학', '공학', '컴퓨터·소프트웨어', '농림·수산·생명',
  '교육·사범', '의학', '치의학', '한의학', '수의학', '약학', '간호', '보건', '디자인·미술', '음악·공연', '체육', '자유전공·융합', '기타 계열'
];

function ChoiceSelect({ label, value, options, onChange, disabled = false }) {
  const availableOptions = value && !options.includes(value) ? [value, ...options] : options;
  return <label className="consulting-survey-field">
    <span>{label}</span>
    <select value={value} disabled={disabled} onChange={event => onChange(event.currentTarget.value)}>
      <option value="">선택하지 않음</option>
      {availableOptions.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

export function ConsultingSurveyPreferences({ value, update }) {
  const [catalog, setCatalog] = React.useState({ status: 'loading', universities: [] });
  const [query, setQuery] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchUniversityCatalog({ ...getMobileApiBinding('analysis', 'analysisApiUrl'), signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (!result.ok) return setCatalog({ status: 'error', universities: [] });
      setCatalog({ status: 'ready', universities: result.data.map(item => item.univName) });
    });
    return () => controller.abort();
  }, [attempt]);

  const choices = value.rankedChoices.length ? value.rankedChoices : [EMPTY_RANKED_CHOICE];
  const search = query.trim().toLocaleLowerCase('ko');
  const universities = catalog.universities.filter(name => name.toLocaleLowerCase('ko').includes(search));
  const changeChoice = (index, key, selection) => update({
    rankedChoices: choices.map((choice, position) => position === index ? { ...choice, [key]: selection } : choice)
  });
  return <div className="consulting-survey-preferences">
    <p className="consulting-score-note">각 지망에서 지역·대학·계열 중 원하는 항목을 골라주세요. 대학명을 검색하면 아래 선택 목록이 좁혀집니다.</p>
    <label className="consulting-survey-field">
      <span>대학명 검색</span>
      <input type="search" placeholder="대학명 일부로 검색" maxLength="80" value={query} disabled={catalog.status !== 'ready'} onChange={event => setQuery(event.currentTarget.value)} />
    </label>
    {catalog.status === 'loading' && <p className="consulting-score-note" role="status">대학 목록을 불러오고 있어요.</p>}
    {catalog.status === 'error' && <div className="consulting-score-lookup">
      <p className="consulting-score-note" role="status">대학 목록을 불러오지 못했어요. 아래 추가 희망에 대학명을 적을 수 있어요.</p>
      <button type="button" className="consulting-v2-secondary" onClick={() => {
        setCatalog({ status: 'loading', universities: [] });
        setAttempt(count => count + 1);
      }}>대학 목록 다시 불러오기</button>
    </div>}
    {catalog.status === 'ready' && universities.length === 0 && <p className="consulting-score-note" role="status">검색과 일치하는 대학이 없어요. 아래 추가 희망에 직접 적을 수 있어요.</p>}
    {choices.map((choice, index) => <fieldset key={index} className="consulting-survey-preference-rank">
      <legend>{index + 1}지망</legend>
      <div className="consulting-survey-preference-selects">
        <ChoiceSelect label="희망 지역" options={REGIONS} value={choice.region} onChange={selection => changeChoice(index, 'region', selection)} />
        <ChoiceSelect label="희망 대학" options={universities} value={choice.university} disabled={catalog.status !== 'ready' && !choice.university} onChange={selection => changeChoice(index, 'university', selection)} />
        <ChoiceSelect label="희망 계열" options={TRACKS} value={choice.track} onChange={selection => changeChoice(index, 'track', selection)} />
      </div>
      {choices.length > 1 && <button className="consulting-v2-secondary" type="button" aria-label={`${index + 1}지망 삭제`} onClick={() => update({ rankedChoices: choices.filter((_, position) => position !== index) })}>지망 삭제</button>}
    </fieldset>)}
    {choices.length < MAX_RANKED_CHOICES && <button className="consulting-v2-secondary consulting-survey-add-rank" type="button" disabled={!choices.every(hasRankedChoice)} onClick={() => update({ rankedChoices: [...choices, EMPTY_RANKED_CHOICE] })}>＋ 지망 추가</button>}
    <label className="consulting-survey-field">
      <span>추가 희망 (선택)</span>
      <textarea maxLength={ADDITIONAL_PREFERENCE_MAX} placeholder="목록에 없는 희망이나 꼭 검토하고 싶은 대학·학과를 적어주세요." value={value.additionalPreference} onChange={event => update({ additionalPreference: event.currentTarget.value })} />
    </label>
  </div>;
}

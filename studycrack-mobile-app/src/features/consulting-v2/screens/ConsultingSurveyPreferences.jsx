import React from 'react';
import { getMobileApiBinding } from '../../../shared/browser/mobile-runtime.js';
import { fetchV2SurveyUniversities } from '../survey-api.js';
import { ADDITIONAL_PREFERENCE_MAX, EMPTY_RANKED_CHOICE, hasRankedChoice, MAX_RANKED_CHOICES } from '../survey-model.js';

const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충북', '충남', '광주', '전북', '전남', '대구', '경북', '부산', '울산', '경남', '제주'];
const TRACKS = [
  '인문·어문', '사회과학', '경영·경제', '자연과학·수학', '공학', '컴퓨터·소프트웨어', '농림·수산·생명',
  '교육·사범', '의학', '치의학', '한의학', '수의학', '약학', '간호', '보건', '디자인·미술', '음악·공연', '체육', '자유전공·융합', '기타 계열'
];
const EMPTY_PICKER = { query: '', notice: '' };
const SEARCH_RESULTS_LIMIT = 8;
const searchKey = value => value.normalize('NFKC').toLocaleLowerCase('ko').replace(/[^\p{L}\p{N}]/gu, '');

function universityMatches(name, compact, words) {
  const short = name.replace('대학교', '대');
  const familiar = short.replace('여자대', '여대').replace('교육대', '교대')
    .replace('한국외국어대', '한국외대').replace('서울과학기술대', '서울과기대');
  return [name, short, familiar].map(searchKey).some(key => key.includes(compact) || words.every(word => key.includes(word)));
}

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

function UniversityPicker({ choice, catalog, picker, onSearch, onChoose }) {
  const ready = catalog.status === 'ready';
  const available = catalog.universities.filter(item => !choice.region || item.regions?.includes(choice.region));
  const search = searchKey(picker.query);
  const terms = picker.query.trim().split(/\s+/u).map(searchKey).filter(Boolean);
  const matches = search ? available.filter(item => universityMatches(item.univName, search, terms)) : [];
  const outsideList = ready && choice.university && !available.some(item => item.univName === choice.university);
  const hasRegions = catalog.universities.some(item => item.regions?.length);
  let searchMessage = '';
  if (ready && choice.region && !hasRegions) {
    searchMessage = '지역별 목록을 불러오지 못했어요. 지역 선택을 비워 전체 대학을 검색하거나 아래에 직접 적어주세요.';
  } else if (ready && search) {
    searchMessage = matches.length ? `검색 결과 ${matches.length}곳` : '일치하는 대학이 없어요. 검색어를 바꾸거나 아래에 직접 적어주세요.';
    if (matches.length > SEARCH_RESULTS_LIMIT) searchMessage += ' · 검색어를 더 입력하면 목록이 좁혀져요.';
  } else if (ready && choice.region) {
    searchMessage = available.length ? `${choice.region} 소재 대학 ${available.length}곳` : '이 지역의 대학이 목록에 없어요. 아래 추가 희망에 직접 적어주세요.';
  }
  return <div className="consulting-university-picker">
    <label className="consulting-survey-field">
      <span>대학명 검색</span>
      <input type="search" placeholder="예: 연세대, 한국외대 글로벌" maxLength="80" value={picker.query} disabled={!ready} onChange={event => onSearch(event.currentTarget.value)} />
    </label>
    {!search && <ChoiceSelect label="희망 대학" options={available.map(item => item.univName)} value={outsideList ? '' : choice.university} disabled={!ready || !available.length} onChange={onChoose} />}
    {searchMessage && <p className="consulting-score-note" role="status">{searchMessage}</p>}
    {matches.length > 0 && <ul className="consulting-university-results" aria-label="대학 검색 결과">
      {matches.slice(0, SEARCH_RESULTS_LIMIT).map(({ univName, regions }) => <li key={univName}>
        <button type="button" onClick={() => onChoose(univName)}><strong>{univName}</strong>{regions?.length > 0 && <span>{regions.join(' · ')}</span>}</button>
      </li>)}
    </ul>}
    {outsideList ? <div className="consulting-score-lookup">
      <p className="consulting-score-note">이전에 저장한 대학 · {choice.university}. 현재 목록에서 다시 선택할 수 있어요.</p>
      <button className="consulting-v2-secondary" type="button" onClick={() => onChoose('')}>기존 대학 선택 지우기</button>
    </div> : search && choice.university && <p className="consulting-score-note">선택한 대학 · {choice.university}</p>}
    {picker.notice && <p className="consulting-score-note" role="status">{picker.notice}</p>}
  </div>;
}

export function ConsultingSurveyPreferences({ value, update }) {
  const [catalog, setCatalog] = React.useState({ status: 'loading', universities: [] });
  const [pickers, setPickers] = React.useState([]);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchV2SurveyUniversities({ ...getMobileApiBinding('analysis', 'analysisApiUrl'), signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (!result.ok) return setCatalog({ status: 'error', universities: [] });
      setCatalog({ status: 'ready', universities: result.data });
    });
    return () => controller.abort();
  }, [attempt]);

  const choices = value.rankedChoices.length ? value.rankedChoices : [EMPTY_RANKED_CHOICE];
  const changeChoice = (index, patch) => update({
    rankedChoices: choices.map((choice, position) => position === index ? { ...choice, ...patch } : choice)
  });
  const changePicker = (index, state) => setPickers(items => choices.map((_, position) => position === index ? state : items[position]));
  const changeRegion = (index, region) => {
    const { university } = choices[index];
    const regions = catalog.universities.find(item => item.univName === university)?.regions;
    const clear = region && regions?.length && !regions.includes(region);
    changeChoice(index, clear ? { region, university: '' } : { region });
    changePicker(index, clear ? { query: '', notice: '지역이 바뀌어 이전 희망 대학 선택을 비웠어요.' } : EMPTY_PICKER);
  };
  return <div className="consulting-survey-preferences">
    <p className="consulting-score-note"><strong>최대 {MAX_RANKED_CHOICES}지망</strong>까지 적을 수 있어요. 각 지망의 지역을 고르면 그 지역의 대학만 표시돼요.</p>
    {catalog.status === 'loading' && <p className="consulting-score-note" role="status">대학 목록을 불러오고 있어요.</p>}
    {catalog.status === 'error' && <div className="consulting-score-lookup">
      <p className="consulting-score-note" role="status">대학 목록을 불러오지 못했어요. 아래 추가 희망에 대학명을 적을 수 있어요.</p>
      <button type="button" className="consulting-v2-secondary" onClick={() => {
        setCatalog({ status: 'loading', universities: [] });
        setAttempt(count => count + 1);
      }}>대학 목록 다시 불러오기</button>
    </div>}
    {choices.map((choice, index) => <fieldset key={index} className="consulting-survey-preference-rank">
      <legend>{index + 1}지망</legend>
      <div className="consulting-survey-preference-selects">
        <ChoiceSelect label="희망 지역" options={REGIONS} value={choice.region} onChange={region => changeRegion(index, region)} />
        <ChoiceSelect label="희망 계열" options={TRACKS} value={choice.track} onChange={track => changeChoice(index, { track })} />
      </div>
      <UniversityPicker choice={choice} catalog={catalog} picker={pickers[index] || EMPTY_PICKER} onSearch={query => changePicker(index, { query, notice: '' })} onChoose={university => {
        changeChoice(index, { university });
        changePicker(index, EMPTY_PICKER);
      }} />
      {choices.length > 1 && <button className="consulting-v2-secondary" type="button" aria-label={`${index + 1}지망 삭제`} onClick={() => {
        update({ rankedChoices: choices.filter((_, position) => position !== index) });
        setPickers(items => items.filter((_, position) => position !== index));
      }}>지망 삭제</button>}
    </fieldset>)}
    {choices.length < MAX_RANKED_CHOICES && <button className="consulting-v2-secondary consulting-survey-add-rank" type="button" disabled={!choices.every(hasRankedChoice)} onClick={() => update({ rankedChoices: [...choices, EMPTY_RANKED_CHOICE] })}>＋ {choices.length + 1}지망 추가</button>}
    <label className="consulting-survey-field">
      <span>추가 희망 (선택)</span>
      <textarea maxLength={ADDITIONAL_PREFERENCE_MAX} placeholder="목록에 없는 희망이나 꼭 검토하고 싶은 대학·학과를 적어주세요." value={value.additionalPreference} onChange={event => update({ additionalPreference: event.currentTarget.value })} />
    </label>
  </div>;
}

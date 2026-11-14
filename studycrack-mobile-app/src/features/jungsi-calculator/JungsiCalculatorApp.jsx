import React from 'react';
import { getMobileAccountStorage, getMobileApiBinding, hasMobileClientSession } from '../../shared/browser/mobile-runtime.js';
import { fetchUniversityCatalog } from '../analysis/api.js';
import CalculatorScoreForm from './CalculatorScoreForm.jsx';
import CalculatorCatalog from './CalculatorCatalog.jsx';
import { CALCULATOR_PATH, candidateKey, clearCalculatorDrafts, editableScores, emptyScores, MAX_CANDIDATES, prepareCalculatorScores, readCalculatorDraft, scoresChanged, uniqueCandidates, writeCalculatorDraft } from './calculator-model.js';
import './calculator.css';

function storage() { try { return globalThis.sessionStorage; } catch (_) { return null; } }
function session() {
  let owner = '';
  try { owner = getMobileAccountStorage()?.getItem('userId') || ''; } catch (_) {}
  return { active: hasMobileClientSession(), owner };
}

function Header({ active }) {
  return <header className="jcalc-header"><a className="jcalc-brand" href="/" aria-label="StudyCrack 홈"><img src="/assets/figma/figma-asset-04.svg" width="30" height="30" alt="" /><span>StudyCrack</span></a><nav aria-label="합격 계산기 메뉴"><a href="/2027-jungsi-consulting">서비스 안내</a>{active && <a href="/mypage">내 계정</a>}</nav></header>;
}

function Workspace({ owner }) {
  const [restored] = React.useState(() => readCalculatorDraft(storage(), owner));
  const [scores, setScores] = React.useState(() => restored.confirmed ? editableScores(restored.confirmed) : emptyScores());
  const [confirmed, setConfirmed] = React.useState(restored.confirmed);
  const [candidates, setCandidates] = React.useState(restored.candidates);
  const [errors, setErrors] = React.useState({});
  const [saved, setSaved] = React.useState(true);
  const [resource, setResource] = React.useState({ status: 'loading', data: [], error: '' });
  const [attempt, setAttempt] = React.useState(0);
  const changed = scoresChanged(scores, confirmed);

  React.useEffect(() => {
    const controller = new AbortController();
    setResource({ status: 'loading', data: [], error: '' });
    fetchUniversityCatalog({ ...getMobileApiBinding('analysis', 'analysisApiUrl'), signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setResource(result.ok ? { status: 'ready', data: result.data, error: '' } : { status: 'error', data: [], error: [401, 403].includes(result.status) ? '로그인 상태를 다시 확인해주세요. 서비스 안내에서 로그인한 뒤 다시 이용할 수 있습니다.' : result.error });
    });
    return () => controller.abort();
  }, [attempt]);

  const persist = (nextConfirmed, nextCandidates) => setSaved(writeCalculatorDraft(storage(), owner, { confirmed: nextConfirmed, candidates: nextCandidates }));
  const confirm = () => {
    const result = prepareCalculatorScores(scores);
    setErrors(result.errors);
    if (!result.ok) {
      requestAnimationFrame(() => document.querySelector('.jcalc-field [aria-invalid="true"]')?.focus());
      return;
    }
    setConfirmed(result.data);
    persist(result.data, candidates);
  };
  const changeCandidates = next => { setCandidates(next); persist(confirmed, next); };
  return <div className="jcalc-layout">
    <div className="jcalc-inputs"><CalculatorScoreForm scores={scores} confirmed={confirmed} changed={changed} errors={errors} onConfirm={confirm} onChange={value => { setScores(value); setErrors({}); }} />
      <CalculatorCatalog resource={resource} candidates={candidates} onRetry={() => setAttempt(value => value + 1)} onAdd={candidate => { if (candidates.length < MAX_CANDIDATES) changeCandidates(uniqueCandidates([...candidates, candidate])); }} /></div>
    <aside className="jcalc-panel jcalc-summary" aria-labelledby="jcalc-summary-title"><p className="jcalc-eyebrow">나의 비교 후보</p><h2 id="jcalc-summary-title">지원 후보 {candidates.length}<small> / {MAX_CANDIDATES}</small></h2>
      <p className="jcalc-note" role="status">{confirmed ? changed ? '성적 수정 중 · 입력 성적을 다시 확인해주세요.' : `${confirmed.basis === 'official' ? '성적표' : '가채점 원점수'} 기준 · 성적 입력 확인 완료` : '성적을 확인하고 비교할 후보를 담아보세요.'}</p>
      {candidates.length ? <ul className="jcalc-candidates">{candidates.map(item => <li key={candidateKey(item)}><strong>{item.university}</strong><span>{item.major}</span><small>{resource.status === 'ready' && !resource.data.some(row => row.univName === item.university && row.majors.includes(item.major)) ? '현재 검색 목록에서 확인할 수 없는 후보입니다.' : '2027 전형·모집군 확인 대기'}</small><button className="jcalc-text-button" type="button" aria-label={`${item.university} ${item.major} 후보 삭제`} onClick={() => changeCandidates(candidates.filter(candidate => candidateKey(candidate) !== candidateKey(item)))}>후보 삭제</button></li>)}</ul> : <p className="jcalc-state">선택한 후보가 없습니다.<br />대학과 학과를 검색해 담아주세요.</p>}
      <div className="jcalc-release-note"><strong>분석 결과는 준비 중입니다.</strong><p>지금은 성적 입력과 대학·학과 검색을 이용할 수 있습니다. 2027 자료와 분석 기준의 검증이 끝나면 환산점수·합격 확률·5단계 지원 가능성을 안내합니다.</p></div>
      <p className="jcalc-note">{!owner || !saved ? '이 브라우저에서 초안을 보관할 수 없습니다. 현재 화면을 벗어나면 입력이 초기화될 수 있습니다.' : '확인한 성적과 선택 후보는 같은 계정·현재 탭에서만 이어집니다. 다른 화면의 저장 성적은 변경하지 않습니다.'}</p>
    </aside>
  </div>;
}

export default function JungsiCalculatorApp() {
  const [current, setCurrent] = React.useState(session);
  React.useEffect(() => {
    const update = () => setCurrent(previous => {
      const next = session();
      if (previous.active === next.active && previous.owner === next.owner) return previous;
      clearCalculatorDrafts(storage());
      return next;
    });
    for (const name of ['pageshow', 'storage', 'focus', 'studycrack:session-ended']) globalThis.addEventListener(name, update);
    return () => { for (const name of ['pageshow', 'storage', 'focus', 'studycrack:session-ended']) globalThis.removeEventListener(name, update); };
  }, []);
  return <><Header active={current.active} /><main className="jcalc-main"><section className="jcalc-intro"><p className="jcalc-eyebrow">2027 · 정시 합격 계산기</p><h1>내 성적에서,<br /><em>다음 지원 후보까지.</em></h1><p>성적을 입력하고 목표 대학·학과를 찾아보세요.<br />지원 가능성을 비교하기 위한 첫 준비를 시작합니다.</p><span className="jcalc-badge">성적 입력·검색 이용 가능 · 분석 결과 준비 중</span></section>
    {current.active ? <Workspace key={current.owner || 'current-session'} owner={current.owner} /> : <section className="jcalc-panel jcalc-login" aria-labelledby="jcalc-login-title"><h2 id="jcalc-login-title">내 계정으로 준비해주세요.</h2><p className="jcalc-note">성적과 선택 후보가 다른 학생의 입력과 섞이지 않도록 로그인 후 이용할 수 있습니다. 컨설팅 초대코드는 필요하지 않습니다.</p><div className="jcalc-login-actions"><a className="jcalc-primary" href={`/login?returnUrl=${encodeURIComponent(CALCULATOR_PATH)}`}>로그인하고 시작하기</a><a className="jcalc-secondary" href={`/signup?returnUrl=${encodeURIComponent(CALCULATOR_PATH)}`}>회원가입</a></div></section>}
  </main><footer className="jcalc-footer"><a href="/2027-jungsi-consulting">정시 서비스 안내</a><a href="/privacy">개인정보처리방침</a><a href="https://pf.kakao.com/_wxjxcgn" target="_blank" rel="noopener noreferrer">이용 문의</a></footer></>;
}

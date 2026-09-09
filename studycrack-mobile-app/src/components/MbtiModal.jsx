import { Modal } from './Modal.jsx';
import { MBTI_LETTER_LABELS, MBTI_QUESTIONS, MBTI_SECTIONS, getMbtiProfile } from '../constants/mbti.js';

const TOTAL = MBTI_QUESTIONS.length;

function MbtiIntro() {
  return (
    <div className="mbti-survey-intro">
      <span className="mbti-survey-eyebrow">학습 성향 진단</span>
      <p className="sc-modal-padded-title">나의 학습 유형 찾기</p>
      <p className="mbti-survey-lead">36개의 질문에 직관적으로 답하면 나만의 학습 유형 코드를 알려드려요.</p>
      <ul className="mbti-survey-points">
        <li>학습 접근법 · 변화 적응력 · 사고 방식 · 계획 스타일 4가지를 진단해요.</li>
        <li>정답은 없어요. 평소 모습에 가까운 쪽을 고르면 돼요.</li>
      </ul>
      <button type="button" className="btn btn-primary mbti-survey-start" data-action="startMbti">36문항 검사 시작</button>
      <button type="button" className="mbti-survey-close-link" data-action="closeMbtiModal">다음에 할게요</button>
    </div>
  );
}

function MbtiQuestion({ answers, step }) {
  const item = MBTI_QUESTIONS[step];
  const section = MBTI_SECTIONS[Math.floor(step / 9)] || MBTI_SECTIONS[0];
  const picked = answers[step];
  const completed = step + (picked ? 1 : 0);
  const percent = Math.round((completed / TOTAL) * 100);
  const isLast = step === TOTAL - 1;
  return (
    <div className="mbti-survey-q">
      <div className="mbti-survey-head">
        <span className="mbti-survey-section">{section.label}</span>
        <button type="button" className="sc-overlay-close" data-action="closeMbtiModal" aria-label="닫기">✕</button>
      </div>
      <div className="mbti-survey-progress"><div className="mbti-survey-bar" role="progressbar" aria-label="진단 진행" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={completed}><i style={{ width: `${percent}%` }} /></div><span>{step + 1} / {TOTAL}</span></div>
      <p className="mbti-survey-qtext">{item.q}</p>
      <div className="mbti-survey-choices">
        <button type="button" className={`mbti-survey-choice ${picked === 1 ? 'selected' : ''}`} aria-pressed={picked === 1} data-action="answerMbti" data-mbti-step={step} data-mbti-choice="1"><span className="mbti-survey-choice-mark">A</span><span>{item.a}</span></button>
        <button type="button" className={`mbti-survey-choice ${picked === 2 ? 'selected' : ''}`} aria-pressed={picked === 2} data-action="answerMbti" data-mbti-step={step} data-mbti-choice="2"><span className="mbti-survey-choice-mark">B</span><span>{item.b}</span></button>
      </div>
      <div className="mbti-survey-nav">
        <button type="button" className="btn btn-secondary mbti-survey-prev" data-action="mbtiPrev" disabled={step === 0}>이전</button>
        <button type="button" className="btn btn-primary mbti-survey-next" data-action="mbtiNext" disabled={!picked}>{isLast ? '결과 보기' : '다음'}</button>
      </div>
    </div>
  );
}

function MbtiResult({ code }) {
  const profile = getMbtiProfile(code);
  return (
    <div className="mbti-survey-result">
      <div className="mbti-survey-head">
        <span className="mbti-survey-section">학습 유형 결과</span>
        <button type="button" className="sc-overlay-close" data-action="closeMbtiModal" aria-label="닫기">✕</button>
      </div>
      <div className="mbti-result-hero"><div className="mbti-result-code">{profile.code}</div><div className="mbti-result-name">{profile.name}</div></div>
      <div className="mbti-result-tags">{profile.code.split('').map((letter) => <span className="mbti-result-tag" key={letter}>{letter} · {MBTI_LETTER_LABELS[letter] || ''}</span>)}</div>
      <p className="mbti-result-desc">{profile.desc}</p>
      <ul className="mbti-result-traits">{(profile.traits || []).map((trait) => <li key={trait}>{trait}</li>)}</ul>
      {(profile.subjects || []).length ? <div className="mbti-result-subjects"><p className="mbti-result-subjects-label">추천 탐구 과목</p><div className="mbti-result-subject-list">{profile.subjects.map((subject) => <span className="mbti-result-subject" key={subject}>{subject}</span>)}</div></div> : null}
      <div className="mbti-survey-nav">
        <button type="button" className="btn btn-secondary" data-action="retryMbti">다시 검사</button>
        <button type="button" className="btn btn-primary" data-action="closeMbtiModal">확인</button>
      </div>
    </div>
  );
}

export function MbtiModal({ mbtiAnswers = [], mbtiModalOpen = false, mbtiResult = '', mbtiStep = 'intro' }) {
  if (!mbtiModalOpen) return null;
  let content = <MbtiIntro />;
  if (mbtiStep === 'result') content = <MbtiResult code={mbtiResult} />;
  else if (typeof mbtiStep === 'number') {
    const step = Math.min(TOTAL - 1, Math.max(0, mbtiStep));
    content = <MbtiQuestion step={step} answers={Array.isArray(mbtiAnswers) ? mbtiAnswers : []} />;
  }
  return <Modal panelClass="mbti-survey-modal" ariaLabel="학습 성향 진단" dismissAction="closeMbtiModal">{content}</Modal>;
}

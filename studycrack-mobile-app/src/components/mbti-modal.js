import { renderModal } from './modal.js';
import {
  MBTI_QUESTIONS,
  MBTI_SECTIONS,
  MBTI_LETTER_LABELS,
  getMbtiProfile
} from '../constants/mbti.js';

const TOTAL = MBTI_QUESTIONS.length;

function renderIntro() {
  return `<div class="mbti-survey-intro">
    <span class="mbti-survey-eyebrow">학습 성향 진단</span>
    <p class="home-modal-title">나의 학습 유형 찾기</p>
    <p class="mbti-survey-lead">36개의 질문에 직관적으로 답하면 나만의 학습 유형 코드를 알려드려요.</p>
    <ul class="mbti-survey-points">
      <li>학습 접근법 · 변화 적응력 · 사고 방식 · 계획 스타일 4가지를 진단해요.</li>
      <li>정답은 없어요. 평소 모습에 가까운 쪽을 고르면 돼요.</li>
    </ul>
    <button type="button" class="btn btn-primary mbti-survey-start" data-action="startMbti">검사 시작 (약 2분)</button>
    <button type="button" class="mbti-survey-close-link" data-action="closeMbtiModal">다음에 할게요</button>
  </div>`;
}

function renderQuestion(step, answers) {
  const item = MBTI_QUESTIONS[step];
  const section = MBTI_SECTIONS[Math.floor(step / 9)] || MBTI_SECTIONS[0];
  const picked = answers[step];
  const pct = Math.round((step / TOTAL) * 100);
  const isLast = step === TOTAL - 1;
  return `<div class="mbti-survey-q">
    <div class="mbti-survey-head">
      <span class="mbti-survey-section">${section.label}</span>
      <button type="button" class="qna-modal-close" data-action="closeMbtiModal" aria-label="닫기">✕</button>
    </div>
    <div class="mbti-survey-progress"><div class="mbti-survey-bar"><i style="width:${pct}%"></i></div><span>${step + 1} / ${TOTAL}</span></div>
    <p class="mbti-survey-qtext">${item.q}</p>
    <div class="mbti-survey-choices">
      <button type="button" class="mbti-survey-choice ${picked === 1 ? 'selected' : ''}" data-action="answerMbti" data-mbti-step="${step}" data-mbti-choice="1"><span class="mbti-survey-choice-mark">A</span><span>${item.a}</span></button>
      <button type="button" class="mbti-survey-choice ${picked === 2 ? 'selected' : ''}" data-action="answerMbti" data-mbti-step="${step}" data-mbti-choice="2"><span class="mbti-survey-choice-mark">B</span><span>${item.b}</span></button>
    </div>
    <div class="mbti-survey-nav">
      <button type="button" class="btn btn-secondary mbti-survey-prev" data-action="mbtiPrev" ${step === 0 ? 'disabled' : ''}>이전</button>
      <button type="button" class="btn btn-primary mbti-survey-next" data-action="mbtiNext" ${picked ? '' : 'disabled'}>${isLast ? '결과 보기' : '다음'}</button>
    </div>
  </div>`;
}

function renderResult(code) {
  const profile = getMbtiProfile(code);
  const tags = profile.code.split('').map((letter) => `<span class="mbti-result-tag">${letter} · ${MBTI_LETTER_LABELS[letter] || ''}</span>`).join('');
  const traits = (profile.traits || []).map((t) => `<li>${t}</li>`).join('');
  const subjects = (profile.subjects || []).map((s) => `<span class="mbti-result-subject">${s}</span>`).join('');
  return `<div class="mbti-survey-result">
    <div class="mbti-survey-head">
      <span class="mbti-survey-section">학습 유형 결과</span>
      <button type="button" class="qna-modal-close" data-action="closeMbtiModal" aria-label="닫기">✕</button>
    </div>
    <div class="mbti-result-code">${profile.code}</div>
    <div class="mbti-result-name">${profile.name}</div>
    <div class="mbti-result-tags">${tags}</div>
    <p class="mbti-result-desc">${profile.desc}</p>
    <ul class="mbti-result-traits">${traits}</ul>
    ${subjects ? `<div class="mbti-result-subjects"><p class="mbti-result-subjects-label">추천 탐구 과목</p><div class="mbti-result-subject-list">${subjects}</div></div>` : ''}
    <div class="mbti-survey-nav">
      <button type="button" class="btn btn-secondary" data-action="retryMbti">다시 검사</button>
      <button type="button" class="btn btn-primary" data-action="closeMbtiModal">확인</button>
    </div>
  </div>`;
}

export function renderMbtiModal({ mbtiModalOpen = false, mbtiStep = 'intro', mbtiAnswers = [], mbtiResult = '' } = {}) {
  if (!mbtiModalOpen) return '';
  let body;
  if (mbtiStep === 'result') {
    body = renderResult(mbtiResult);
  } else if (typeof mbtiStep === 'number') {
    const step = Math.min(TOTAL - 1, Math.max(0, mbtiStep));
    body = renderQuestion(step, Array.isArray(mbtiAnswers) ? mbtiAnswers : []);
  } else {
    body = renderIntro();
  }
  return renderModal({ panelClass: 'mbti-survey-modal', dismissAction: 'closeMbtiModal', body });
}

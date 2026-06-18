import { renderModal } from './modal.js';

export const MBTI_QUESTIONS = [
  { q: 'q1', text: '1) 계획을 세우고 공부하는 편인가요?', yes: 'plan', no: 'flex' },
  { q: 'q2', text: '2) 혼자 공부할 때 집중이 잘 되나요?', yes: 'solo', no: 'group' },
  { q: 'q3', text: '3) 부족한 과목부터 먼저 하는 편인가요?', yes: 'weak_first', no: 'strong_first' },
  { q: 'q4', text: '4) 피드백이 있으면 공부가 더 잘 되나요?', yes: 'feedback', no: 'self' }
];

function active(value, candidate) {
  return value === candidate ? 'active' : '';
}

function renderMbtiQuestion({ q, text, yes, no }, answers = {}) {
  const current = answers[q];
  return `<div class="ob-mbti-q"><p>${text}</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="${q}" data-mbti-v="${yes}" class="${active(current, yes)}">네</button><button data-action="setMbti" data-mbti-q="${q}" data-mbti-v="${no}" class="${active(current, no)}">아니오</button></div></div>`;
}

export function renderMbtiModal({ mbtiModalOpen = false, mbtiAnswers = {}, mbtiDone = false } = {}) {
  if (!mbtiModalOpen) return '';
  const questions = MBTI_QUESTIONS.map((item) => renderMbtiQuestion(item, mbtiAnswers)).join('');
  const body = `<p class="home-modal-title">학습 MBTI 검사</p>${questions}<button class="btn btn-primary ${mbtiDone ? '' : 'disabled'}" data-action="completeMbti" ${mbtiDone ? '' : 'disabled'}>검사 완료</button>`;
  return renderModal({ panelClass: 'ob-mbti-modal', dismissAction: 'closeMbtiModal', body });
}

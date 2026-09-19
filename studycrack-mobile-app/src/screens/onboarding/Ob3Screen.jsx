import { MbtiModal } from '../../components/MbtiModal.jsx';
import { OnboardingScreenShell } from './OnboardingShell.jsx';
import { CRACKY_SRC } from '../../constants/assets.js';
import { MBTI_LETTER_LABELS, getMbtiProfile, normalizeMbtiCode } from '../../constants/mbti.js';

export function LearningTypeSummary({ mbtiResult }) {
  const code = normalizeMbtiCode(mbtiResult);
  if (!code) return null;
  const profile = getMbtiProfile(code);
  const keywords = profile.code.split('').map((letter) => MBTI_LETTER_LABELS[letter] || letter).join(', ');
  return <div className="card ob-card ob-mbti-result"><p className="analysis-title">진단 결과</p><p className="ob-mbti-code">{profile.code}</p><p className="ob-mbti-name">{profile.name}</p><p className="sub ob-mbti-desc">({keywords})</p></div>;
}

export function Ob3Screen(ctx) {
  const { crackySrc = CRACKY_SRC, mbtiModalOpen = false, mbtiResult = '' } = ctx;
  const cta = mbtiResult
    ? <button type="button" className="cta-button" data-action="goto" data-target="ob4">분석 결과 보기</button>
    : <><button type="button" className="cta-button" data-action="openMbtiModal">36문항 진단 시작하기</button><button type="button" className="auth-link-btn" data-action="goto" data-target="ob4">다음에 진단하기</button></>;
  return (
    <OnboardingScreenShell screen="ob3" step={3} title="나의 학습 유형 찾기" crackySrc={crackySrc} subcopy={<>마지막 단계예요.<br />평소 공부하는 모습에 가까운 답을 골라주세요.</>} bubble="36문항으로 학습 접근법·변화 적응력·사고 방식·계획 스타일을 확인해요." cta={cta} overlays={mbtiModalOpen ? <MbtiModal {...ctx} /> : null}>
      <div className="card ob-card"><p className="analysis-title">진단 후 확인할 수 있어요</p><p className="sub">나의 학습 유형과 특징, 추천 탐구 과목을 살펴보세요. 정답은 없고, 응답 시간은 사람마다 달라요.</p></div>
      <LearningTypeSummary mbtiResult={mbtiResult} />
    </OnboardingScreenShell>
  );
}

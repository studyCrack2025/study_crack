import { MbtiModal } from '../../components/MbtiModal.jsx';
import { AppContent, AppFrame, SecondaryScreenHeader } from '../../components/AppFrame.js';
import { CRACKY_SRC } from '../../constants/assets.js';
import { MBTI_LETTER_LABELS, getMbtiProfile, normalizeMbtiCode } from '../../constants/mbti.js';

function Progress() {
  return <div className="ob-progress"><span>3/3</span><div className="ob-dots"><i className="active" /><i className="active" /><i className="active" /></div></div>;
}

function ResultCard({ mbtiResult }) {
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
    <AppFrame>
      <AppContent inactive={mbtiModalOpen} lockScroll={mbtiModalOpen} screen="ob3">
          <div className="onboarding-container">
            <div className="content">
              <Progress />
              <SecondaryScreenHeader title="학습성향 진단 1-3" />
              <p className="sub ob-subcopy">마지막 단계예요.<br />학습 MBTI로 내 공부 성향을 진단해보세요.</p>
              <div className="card ob-bubble-card"><img loading="lazy" decoding="async" src={crackySrc} className="ob-cracky" alt="크랙이" /><p>36문항에 직관적으로 답하면 네 가지 학습 성향을 확인할 수 있어요.</p></div>
              <div className="card ob-card"><p className="analysis-title">학습 성향 진단</p><p className="sub">약 2분 동안 나의 학습 접근법과 계획 스타일을 진단해요.</p><ResultCard mbtiResult={mbtiResult} /></div>
            </div>
            <div className="cta-wrapper cta-container">{cta}</div>
          </div>
      </AppContent>
      {mbtiModalOpen ? <div className="app-screen-overlays"><MbtiModal {...ctx} /></div> : null}
    </AppFrame>
  );
}

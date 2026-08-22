import { MbtiModal } from '../../components/MbtiModal.jsx';
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
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${mbtiModalOpen ? 'modal-lock' : ''}`} data-screen="ob3">
          <div className="onboarding-container">
            <div className="content">
              <Progress />
              <div className="appbar"><button type="button" className="back-btn" data-action="back" aria-label="뒤로가기">←</button><div className="title">학습성향 진단 1-3</div></div>
              <p className="sub ob-subcopy">마지막 단계예요.<br />학습 MBTI로 내 공부 성향을 진단해보세요.</p>
              <div className="card ob-bubble-card"><img loading="lazy" decoding="async" src={crackySrc} className="ob-cracky" alt="크랙이" /><p>짧은 질문 4개로 학습 성향을 빠르게 확인할 수 있어요!</p></div>
              <div className="card ob-card"><p className="analysis-title">학습 성향 진단</p><p className="sub">36문항으로 나의 학습 유형을 진단해요.</p><button type="button" className="btn btn-secondary" data-action="openMbtiModal">진단 시작하기</button><ResultCard mbtiResult={mbtiResult} /></div>
            </div>
            <div className="cta-wrapper cta-container"><button type="button" className="cta-button" data-action="goto" data-target="ob4">분석 결과 보기</button></div>
          </div>
        </div>
        {mbtiModalOpen ? <div className="app-screen-overlays"><MbtiModal {...ctx} /></div> : null}
      </div>
    </div>
  );
}

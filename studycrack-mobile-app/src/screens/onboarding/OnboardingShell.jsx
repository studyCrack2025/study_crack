import { CRACKY_SRC } from '../../constants/assets.js';
import { AppContent, AppFrame, SecondaryScreenHeader } from '../../components/AppFrame.js';

export function OnboardingProgress({ step = 1 }) {
  return <div className="ob-progress"><span>{step}/3 · {['학습 상황', '성적 입력', '학습 성향'][step - 1]}</span><div className="ob-dots" aria-hidden="true">{[1, 2, 3].map((value) => <i className={step >= value ? 'active' : ''} key={value} />)}</div></div>;
}

export function OnboardingBubble({ children, crackySrc = CRACKY_SRC }) {
  return <div className="card ob-bubble-card"><img loading="lazy" decoding="async" src={crackySrc} className="ob-cracky" alt="크랙이" /><p>{children}</p></div>;
}

export function OnboardingScreenShell({ bubble, children, crackySrc = CRACKY_SRC, cta, overlays = null, screen, step, subcopy, title }) {
  return (
    <AppFrame>
      <AppContent screen={screen} inactive={Boolean(overlays)} lockScroll={Boolean(overlays)}>
          <div className="onboarding-container">
            <div className="content">
              <header className="ob-shell-head">
                {screen === 'ob4' || screen === 'ob5' ? <p className="ob-progress">분석 결과</p> : <OnboardingProgress step={step} />}
                <SecondaryScreenHeader title={title} />
                <p className="sub ob-subcopy">{subcopy}</p>
              </header>
              <OnboardingBubble crackySrc={crackySrc}>{bubble}</OnboardingBubble>
              {children}
            </div>
            <div className="cta-wrapper cta-container">{cta}</div>
          </div>
      </AppContent>
      {overlays ? <div className="app-screen-overlays">{overlays}</div> : null}
    </AppFrame>
  );
}

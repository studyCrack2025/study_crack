import { CRACKY_SRC } from '../../constants/assets.js';

export function OnboardingProgress({ step = 1 }) {
  return <div className="ob-progress"><span>{step}/3</span><div className="ob-dots">{[1, 2, 3].map((value) => <i className={step >= value ? 'active' : ''} key={value} />)}</div></div>;
}

export function OnboardingBubble({ children, crackySrc = CRACKY_SRC }) {
  return <div className="card ob-bubble-card"><img loading="lazy" decoding="async" src={crackySrc} className="ob-cracky" alt="크랙이" /><p>{children}</p></div>;
}

export function OnboardingScreenShell({ bubble, children, crackySrc = CRACKY_SRC, cta, screen, step, subcopy, title }) {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="screen app-screen app-content" data-screen={screen}>
          <div className="onboarding-container">
            <div className="content">
              <OnboardingProgress step={step} />
              <div className="appbar"><button type="button" className="back-btn" data-action="back" aria-label="뒤로가기">←</button><div className="title">{title}</div></div>
              <p className="sub ob-subcopy">{subcopy}</p>
              <OnboardingBubble crackySrc={crackySrc}>{bubble}</OnboardingBubble>
              {children}
            </div>
            <div className="cta-wrapper cta-container">{cta}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

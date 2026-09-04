import { CRACKY_SRC } from '../../constants/assets.js';
import { AppContent, AppFrame, SecondaryScreenHeader } from '../../components/AppFrame.js';

export function OnboardingProgress({ step = 1 }) {
  return <div className="ob-progress"><span>{step}/3</span><div className="ob-dots">{[1, 2, 3].map((value) => <i className={step >= value ? 'active' : ''} key={value} />)}</div></div>;
}

export function OnboardingBubble({ children, crackySrc = CRACKY_SRC }) {
  return <div className="card ob-bubble-card"><img loading="lazy" decoding="async" src={crackySrc} className="ob-cracky" alt="크랙이" /><p>{children}</p></div>;
}

export function OnboardingScreenShell({ bubble, children, crackySrc = CRACKY_SRC, cta, screen, step, subcopy, title }) {
  return (
    <AppFrame>
      <AppContent screen={screen}>
          <div className="onboarding-container">
            <div className="content">
              <header className="ob-shell-head">
                <OnboardingProgress step={step} />
                <SecondaryScreenHeader title={title} />
                <p className="sub ob-subcopy">{subcopy}</p>
              </header>
              <OnboardingBubble crackySrc={crackySrc}>{bubble}</OnboardingBubble>
              {children}
            </div>
            <div className="cta-wrapper cta-container">{cta}</div>
          </div>
      </AppContent>
    </AppFrame>
  );
}

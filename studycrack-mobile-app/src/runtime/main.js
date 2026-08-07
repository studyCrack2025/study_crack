import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/foundation/tokens.css';
import '../styles/foundation/base.css';
import '../styles/foundation/shell.css';
import '../styles/components/primitives.css';
import '../styles/components/secondary.css';
import '../styles/components/mbti-survey.css';
import '../styles/components/insights.css';
import '../styles/foundation/motion.css';
import '../styles/components/modals.css';
import '../styles/screens/auth-signup.css';
import '../styles/screens/auth-recovery.css';
import '../styles/screens/auth.css';
import '../styles/screens/onboarding.css';
import '../styles/screens/locked-splash.css';
import MobileApp from '../app/MobileApp.js';
import { CRACKY_SRC, ONBOARDING_LOGO_SRC } from '../constants/assets.js';
import { getMobileRootElement, markMobileAppBooted } from '../shared/browser/mobile-runtime.js';

markMobileAppBooted({ crackySrc: CRACKY_SRC, onboardingLogoSrc: ONBOARDING_LOGO_SRC });

const rootElement = getMobileRootElement();
if (rootElement) createRoot(rootElement).render(React.createElement(MobileApp));

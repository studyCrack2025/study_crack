import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [authSource, authHandlers, authCss, signupCss, recoveryCss, introSource, ob3Source, surveySource, onboardingCss, splashCss] = await Promise.all([
  readFile(new URL('../src/screens/auth/AuthScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/handlers/auth-handlers.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/auth.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/auth-signup.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/auth-recovery.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/IntroScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/Ob3Screen.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/SurveyScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/onboarding.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/locked-splash.css', import.meta.url), 'utf8')
]);

assert.match(authSource, /STUDYCRACK_SYMBOL_SRC/);
assert.match(authSource, /social-google\.svg/);
assert.match(authSource, /social-naver\.svg/);
assert.match(authSource, /data-action="toggleLoginPasswordVisibility"/);
assert.match(authHandlers, /toggleLoginPasswordVisibility/);
assert.match(authSource, /auth-recovery-eyebrow/);
assert.doesNotMatch(authSource, /auth-recovery-icon/);
assert.match(authSource, /마케팅 정보 수신 동의/);
assert.match(authSource, /<TermsModal openTermsType=\{openTermsType\}/);
assert.doesNotMatch(authSource, /dangerouslySetInnerHTML/);
assert.match(authSource, /export function AuthFindIdScreen/);
assert.match(authSource, /export function AuthFindPwScreen/);
assert.doesNotMatch(authSource, /소셜 계정으로 시작하기/);
assert.match(authCss, /\.auth-entry-layout\{/);
assert.match(authCss, /max-width:366px/);
assert.match(authCss, /\.auth-screen\{[^}]*display:flex;flex-direction:column/);
assert.match(authCss, /\.auth-entry-layout\{[^}]*flex:0 0 auto;[^}]*margin:auto/);
assert.doesNotMatch(authCss, /auth-screen\{align-content:start/);
assert.match(authSource, /auth-brand-name">StudyCrack/);
assert.match(authSource, /auth-brand-tagline">합격 전략을 시작해볼까요\?/);
assert.doesNotMatch(authSource, /ADMISSIONS PLATFORM/);
assert.doesNotMatch(authSource, /auth-brand-eyebrow|auth-wordmark|auth-title/);
assert.match(authSource, /className="signup-progress" aria-label="회원가입 진행 단계"/);
assert.match(authSource, /aria-current=\{step === index \+ 1 \? 'step' : undefined\}/);
assert.match(authSource, /auth-brand-centered/);
assert.match(authSource, /auth-service-note/);
assert.doesNotMatch(authSource, /55\.5|오늘 첫 과제 \+0\.1|prototype-session/);
assert.match(signupCss, /\.signup-stage\{/);
assert.match(signupCss, /\.signup-topbar\{/);
assert.match(signupCss, /\.signup-progress\{/);
assert.match(signupCss, /\.signup-page\{[^}]*display:flex;flex-direction:column/);
assert.match(signupCss, /\.signup-form-card\{[^}]*flex:0 0 auto;[^}]*margin:0 auto/);
assert.match(signupCss, /\.signup-stage-head h2\{[^}]*font-size:var\(--sc-type-title\)/);
assert.doesNotMatch(signupCss, /signup-form-card\{[^}]*min-height:calc\(100dvh/);
assert.match(recoveryCss, /width:min\(100%,360px\)/);
assert.match(introSource, /onboarding-kicker/);
assert.match(introSource, /지원학과 환산 점수/);
assert.match(introSource, /지원학과 환산점수를 분석해요/);
assert.match(introSource, /대학별 반영 방식으로 계산/);
assert.match(introSource, /내 성적으로 직접 비교/);
assert.doesNotMatch(introSource, /정확하게 예측|목표 도달 시간/);
assert.match(introSource, /원점수 변화가 환산점수에/);
assert.doesNotMatch(introSource, />128<|환산점수 \+18점/);
assert.doesNotMatch(introSource, /합격 가능성<\/div>/);
assert.match(surveySource, /defaultValue=\{obSchoolName\}/);
assert.match(surveySource, /defaultValue=\{obGoalText\}/);
assert.match(ob3Source, /<MbtiModal/);
assert.match(ob3Source, /data-action="openMbtiModal"/);
assert.match(onboardingCss, /\.onboarding-container\{height:100%/);
assert.match(onboardingCss, /\.onboarding-next\{/);
assert.match(splashCss, /background:var\(--sc-canvas\)/);

console.log('auth/onboarding presentation contract ok');

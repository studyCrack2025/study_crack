import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [authSource, authHandlers, authCss, signupCss, recoveryCss, onboardingSource, ob3Source, onboardingCss, splashCss] = await Promise.all([
  readFile(new URL('../src/screens/auth/AuthScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/handlers/auth-handlers.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/auth.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/auth-signup.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/auth-recovery.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/renderers.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/Ob3Screen.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/onboarding.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/locked-splash.css', import.meta.url), 'utf8')
]);

assert.match(authSource, /STUDYCRACK_LOGO_SRC/);
assert.match(authSource, /social-google\.svg/);
assert.match(authSource, /social-naver\.svg/);
assert.match(authSource, /data-action="toggleLoginPasswordVisibility"/);
assert.match(authHandlers, /toggleLoginPasswordVisibility/);
assert.match(authSource, /auth-recovery-eyebrow/);
assert.doesNotMatch(authSource, /auth-recovery-icon/);
assert.match(authSource, /const labels = \['약관', '본인 인증', '이메일', '계정 설정'\]/);
assert.match(authSource, /마케팅 정보 수신 동의/);
assert.match(authSource, /<TermsModal openTermsType=\{openTermsType\}/);
assert.doesNotMatch(authSource, /dangerouslySetInnerHTML/);
assert.match(authSource, /<SignupProgress step=\{step\}/);
assert.match(authSource, /export function AuthFindIdScreen/);
assert.match(authSource, /export function AuthFindPwScreen/);
assert.doesNotMatch(authSource, /소셜 계정으로 시작하기/);
assert.match(authCss, /\.auth-entry-layout\{/);
assert.match(authCss, /max-width:358px/);
assert.match(signupCss, /\.signup-stage\{/);
assert.match(recoveryCss, /width:min\(100%,360px\)/);
assert.match(onboardingSource, /지원학과 AI 점수/);
assert.match(onboardingSource, /환산점수 \+18점/);
assert.doesNotMatch(onboardingSource, /<div class="onboarding-label">합격 가능성<\/div>/);
assert.match(ob3Source, /<MbtiModal/);
assert.match(ob3Source, /data-action="openMbtiModal"/);
assert.match(onboardingCss, /\.onboarding-container\{height:100%/);
assert.match(onboardingCss, /\.onboarding-next\{/);
assert.match(splashCss, /background:var\(--sc-canvas\)/);

console.log('auth/onboarding presentation contract ok');

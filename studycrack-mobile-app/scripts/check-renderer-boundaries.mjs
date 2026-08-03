import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  registrySource,
  appRegistrySource,
  analysisSource,
  mypageSource,
  serviceSource,
  accountComponent,
  analysisComponent,
  analysisContentComponent,
  authComponent,
  homeComponent,
  homeOverlaysComponent,
  legalComponent,
  mypageComponent,
  ob3Component,
  profileOverlaysComponent,
  plannerComponent,
  plannerEditComponent,
  mbtiModalComponent,
  termsModalComponent
] = await Promise.all([
  read('../src/app/screen-registry.js'),
  read('../src/app/screen-registry-app.js'),
  read('../src/screens/analysis/renderers.js'),
  read('../src/screens/mypage/renderers.js'),
  read('../src/screens/service/renderers.js'),
  read('../src/screens/mypage/AccountInfoScreen.jsx'),
  read('../src/screens/analysis/AnalysisScreen.jsx'),
  read('../src/screens/analysis/AnalysisContent.jsx'),
  read('../src/screens/auth/AuthScreens.jsx'),
  read('../src/screens/home/HomeScreen.jsx'),
  read('../src/screens/home/HomeOverlays.jsx'),
  read('../src/screens/mypage/LegalScreens.jsx'),
  read('../src/screens/mypage/MyPageScreen.jsx'),
  read('../src/screens/onboarding/Ob3Screen.jsx'),
  read('../src/screens/mypage/ProfileOverlays.jsx'),
  read('../src/screens/planner/PlannerScreen.jsx'),
  read('../src/screens/planner/PlannerEditSheet.jsx'),
  read('../src/components/MbtiModal.jsx'),
  read('../src/components/TermsModal.jsx')
]);

const combinedRegistrySource = `${registrySource}\n${appRegistrySource}`;

const jsxScreenNames = [
  'accountInfo',
  'analysis',
  'authFindId',
  'authFindPw',
  'authLogin',
  'authSignup',
  'strategy',
  'home',
  'my',
  'ob3',
  'planner',
  'plannerAdd',
  'privacyPolicy',
  'settingsMain',
  'settingsTermsPicker',
  'termsScreen'
];
for (const screenName of jsxScreenNames) {
  assert.match(combinedRegistrySource, new RegExp(`\\b${screenName}:`), `${screenName} must remain JSX-owned`);
  assert.doesNotMatch(
    combinedRegistrySource,
    new RegExp(`\\n\\s{4}${screenName}: render`),
    `${screenName} must not be registered as a string renderer`
  );
}

assert.match(
  registrySource,
  /for \(const screenName of Object\.keys\(BOOTSTRAP_SCREEN_COMPONENTS\)\) delete merged\[screenName\]/,
  'custom string renderers must not override bootstrap JSX screens'
);
assert.match(
  registrySource,
  /for \(const screenName of Object\.keys\(appRegistry\?\.MOBILE_APP_SCREEN_COMPONENTS \|\| \{\}\)\) delete merged\[screenName\]/,
  'custom string renderers must not override deferred JSX screens'
);
assert.match(registrySource, /import\('\.\/screen-registry-app\.js'\)/, 'app screen registry must stay dynamically imported');
assert.match(appRegistrySource, /export const MOBILE_APP_SCREEN_COMPONENTS/, 'deferred JSX ownership must stay explicit');
assert.doesNotMatch(registrySource, /fallbackScreen/);

const fullScreenRenderers = [
  'renderAnalysisScreen',
  'renderAccountInfoScreen',
  'renderAuthFindIdScreen',
  'renderAuthFindPwScreen',
  'renderAuthLoginScreen',
  'renderAuthSignupScreen',
  'renderHomeScreen',
  'renderHomeView',
  'renderMyPageScreen',
  'renderOb3Screen',
  'renderPlannerScreen',
  'renderPlannerAddScreen',
  'renderPrivacyPolicyScreen',
  'renderSettingsMainScreen',
  'renderSettingsTermsPickerScreen',
  'renderTermsScreen',
  'renderStrategyScreen'
];
const legacyRendererSources = [analysisSource, mypageSource, serviceSource].join('\n');
for (const rendererName of fullScreenRenderers) {
  assert.doesNotMatch(legacyRendererSources, new RegExp(`\\b${rendererName}\\b`), `${rendererName} must stay removed`);
}

assert.match(analysisComponent, /<AnalysisContent/);
assert.match(analysisComponent, /<AnalysisSearchSheet/);
assert.match(analysisContentComponent, /export function AnalysisContent/);
assert.match(analysisContentComponent, /export function AnalysisSearchSheet/);
assert.match(analysisContentComponent, /defaultValue=\{analysisSearchTerm\}/);
assert.doesNotMatch(analysisContentComponent, /dangerouslySetInnerHTML/);
assert.match(authComponent, /export function AuthFindIdScreen/);
assert.match(authComponent, /export function AuthFindPwScreen/);
assert.match(homeComponent, /<HomeStudyBreakdown/);
assert.match(homeComponent, /<HomeOverlays/);
assert.match(homeComponent, /<NotificationPopover/);
assert.match(homeOverlaysComponent, /export function HomeOverlays/);
assert.match(homeOverlaysComponent, /export function HomeStudyBreakdown/);
assert.match(homeOverlaysComponent, /export function NotificationPopover/);
assert.match(homeOverlaysComponent, /defaultValue=\{analysisSearchTerm\}/);
assert.doesNotMatch(homeOverlaysComponent, /dangerouslySetInnerHTML/);
assert.match(legalComponent, /export function SettingsTermsPickerScreen/);
assert.match(legalComponent, /export function SettingsMainScreen/);
assert.match(legalComponent, /export function PrivacyPolicyScreen/);
assert.match(legalComponent, /export function TermsScreen/);
assert.match(accountComponent, /export function AccountInfoScreen/);
assert.match(accountComponent, /<AccountInfoOverlays/);
assert.doesNotMatch(accountComponent, /dangerouslySetInnerHTML/);
assert.match(mypageComponent, /<MyPageOverlays/);
assert.doesNotMatch(mypageComponent, /renderMyPageOverlays/);
assert.match(ob3Component, /<MbtiModal/);
assert.doesNotMatch(ob3Component, /dangerouslySetInnerHTML/);
assert.match(profileOverlaysComponent, /export function ProfileDetailModal/);
assert.match(profileOverlaysComponent, /export function ProfileEditModal/);
assert.match(profileOverlaysComponent, /export function PhoneChangeModal/);
assert.match(profileOverlaysComponent, /export function WithdrawModal/);
assert.match(profileOverlaysComponent, /defaultValue=\{myProfileNameDraft\}/);
assert.match(profileOverlaysComponent, /defaultValue=\{myProfilePhoneDraft\}/);
assert.doesNotMatch(profileOverlaysComponent, /dangerouslySetInnerHTML/);
assert.match(mbtiModalComponent, /<Modal panelClass="mbti-survey-modal"/);
assert.match(plannerComponent, /<PlannerEditSheet/);
assert.doesNotMatch(plannerComponent, /renderEditSheet|overlaysHtml/);
assert.match(plannerEditComponent, /<Sheet open=\{plannerEditIndex !== null\}/);
assert.match(termsModalComponent, /<Modal dismissAction="closeTermsModal"/);
assert.doesNotMatch(authComponent, /dangerouslySetInnerHTML/);
assert.doesNotMatch(legalComponent, /dangerouslySetInnerHTML/);

console.log('renderer ownership boundary ok: 16 JSX screens across bootstrap and deferred app registries');

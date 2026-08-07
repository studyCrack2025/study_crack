import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  registrySource,
  appRegistrySource,
  addUniversityComponent,
  serviceContentComponent,
  servicePlanComponent,
  accountComponent,
  analysisComponent,
  analysisContentComponent,
  authComponent,
  homeComponent,
  homeOverlaysComponent,
  legalComponent,
  mypageComponent,
  introComponent,
  ob3Component,
  onboardingResultsComponent,
  onboardingSurveyComponent,
  profileOverlaysComponent,
  plannerComponent,
  plannerEditComponent,
  mypageSecondaryComponent,
  profileComponent,
  scoreEditModalComponent,
  mbtiModalComponent,
  termsModalComponent
] = await Promise.all([
  read('../src/app/screen-registry.js'),
  read('../src/app/screen-registry-app.js'),
  read('../src/screens/analysis/AddUniversityScreen.jsx'),
  read('../src/screens/service/ServiceContentScreens.jsx'),
  read('../src/screens/service/ServicePlanScreens.jsx'),
  read('../src/screens/mypage/AccountInfoScreen.jsx'),
  read('../src/screens/analysis/AnalysisScreen.jsx'),
  read('../src/screens/analysis/AnalysisContent.jsx'),
  read('../src/screens/auth/AuthScreens.jsx'),
  read('../src/screens/home/HomeScreen.jsx'),
  read('../src/screens/home/HomeOverlays.jsx'),
  read('../src/screens/mypage/LegalScreens.jsx'),
  read('../src/screens/mypage/MyPageScreen.jsx'),
  read('../src/screens/onboarding/IntroScreens.jsx'),
  read('../src/screens/onboarding/Ob3Screen.jsx'),
  read('../src/screens/onboarding/ResultScreens.jsx'),
  read('../src/screens/onboarding/SurveyScreens.jsx'),
  read('../src/screens/mypage/ProfileOverlays.jsx'),
  read('../src/screens/planner/PlannerScreen.jsx'),
  read('../src/screens/planner/PlannerEditSheet.jsx'),
  read('../src/screens/mypage/MyPageSecondaryScreens.jsx'),
  read('../src/screens/profile/ProfileScreens.jsx'),
  read('../src/screens/profile/ScoreEditModal.jsx'),
  read('../src/components/MbtiModal.jsx'),
  read('../src/components/TermsModal.jsx')
]);

const combinedRegistrySource = `${registrySource}\n${appRegistrySource}`;

const jsxScreenNames = [
  'accountInfo',
  'addUniversity',
  'analysis',
  'authFindId',
  'authFindPw',
  'authLogin',
  'authSignup',
  'customerSupport',
  'strategy',
  'home',
  'lockedFeature',
  'my',
  'notificationList',
  'notificationSettings',
  'ob1',
  'ob2',
  'ob3',
  'ob4',
  'ob5',
  'on1',
  'on2',
  'on3',
  'planner',
  'plannerAdd',
  'payment',
  'paymentComplete',
  'proElite',
  'proIntro',
  'qualInfo',
  'ranking',
  'report',
  'reportDetail',
  'scoreInfo',
  'privacyPolicy',
  'settingsMain',
  'settingsTermsPicker',
  'splash',
  'tutor',
  'weekly',
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

assert.match(registrySource, /import\('\.\/screen-registry-app\.js'\)/, 'app screen registry must stay dynamically imported');
assert.match(appRegistrySource, /export const MOBILE_APP_SCREEN_COMPONENTS/, 'deferred JSX ownership must stay explicit');
assert.doesNotMatch(appRegistrySource, /createAppScreenRenderers|screens\/service\/renderers/);
assert.doesNotMatch(registrySource, /SCREEN_RENDERERS|renderMobileScreen|createMobileScreenRenderers|dangerouslySetInnerHTML/);

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
  'renderCustomerSupportScreen',
  'renderNotificationListScreen',
  'renderNotificationSettingsScreen',
  'renderOb3Screen',
  'renderPlannerScreen',
  'renderPlannerAddScreen',
  'renderQualInfoScreen',
  'renderRankingScreen',
  'renderScoreInfoScreen',
  'renderPrivacyPolicyScreen',
  'renderSettingsMainScreen',
  'renderSettingsTermsPickerScreen',
  'renderTermsScreen',
  'renderStrategyScreen',
  'renderReportScreen',
  'renderReportDetailScreen',
  'renderTutorScreen',
  'renderWeeklyScreen'
];
const legacyRendererSources = appRegistrySource;
for (const rendererName of fullScreenRenderers) {
  assert.doesNotMatch(legacyRendererSources, new RegExp(`\\b${rendererName}\\b`), `${rendererName} must stay removed`);
}

assert.match(analysisComponent, /<AnalysisContent/);
assert.match(analysisComponent, /<AnalysisSearchSheet/);
assert.match(analysisContentComponent, /export function AnalysisContent/);
assert.match(analysisContentComponent, /export function AnalysisSearchSheet/);
assert.match(analysisContentComponent, /defaultValue=\{analysisSearchTerm\}/);
assert.doesNotMatch(analysisContentComponent, /dangerouslySetInnerHTML/);
assert.match(addUniversityComponent, /export function AddUniversityScreen/);
assert.match(addUniversityComponent, /defaultValue=\{analysisSearchTerm\}/);
assert.doesNotMatch(addUniversityComponent, /renderUniversityResultsOnly|analysisSearchLiveTermRef/);
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
assert.match(introComponent, /export function SplashScreen/);
assert.match(introComponent, /export function On1Screen/);
assert.match(introComponent, /export function On2Screen/);
assert.match(introComponent, /export function On3Screen/);
assert.match(onboardingSurveyComponent, /export function Ob1Screen/);
assert.match(onboardingSurveyComponent, /export function Ob2Screen/);
assert.match(onboardingSurveyComponent, /defaultValue=\{obSchoolName\}/);
assert.match(onboardingResultsComponent, /export function Ob4Screen/);
assert.match(onboardingResultsComponent, /export function Ob5Screen/);
assert.doesNotMatch(`${introComponent}\n${onboardingSurveyComponent}\n${onboardingResultsComponent}`, /dangerouslySetInnerHTML/);
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
assert.match(profileComponent, /export function RankingScreen/);
assert.match(profileComponent, /export function QualInfoScreen/);
assert.match(profileComponent, /export function ScoreInfoScreen/);
assert.doesNotMatch(profileComponent, /dangerouslySetInnerHTML|scoreInfoDetailList/);
assert.match(scoreEditModalComponent, /export function ScoreEditModal/);
assert.match(scoreEditModalComponent, /<Modal dismissAction="closeScoreEdit"/);
assert.doesNotMatch(scoreEditModalComponent, /dangerouslySetInnerHTML/);
assert.match(mypageSecondaryComponent, /export function NotificationSettingsScreen/);
assert.match(mypageSecondaryComponent, /export function NotificationListScreen/);
assert.match(mypageSecondaryComponent, /export function CustomerSupportScreen/);
assert.match(mypageSecondaryComponent, /<QnaComposerModal/);
assert.match(mypageSecondaryComponent, /<NotificationDetail/);
assert.doesNotMatch(mypageSecondaryComponent, /dangerouslySetInnerHTML/);
assert.match(serviceContentComponent, /export function ReportScreen/);
assert.match(serviceContentComponent, /export function ReportDetailScreen/);
assert.match(serviceContentComponent, /export function ProEliteScreen/);
assert.match(serviceContentComponent, /export function TutorScreen/);
assert.match(serviceContentComponent, /export function WeeklyScreen/);
assert.match(serviceContentComponent, /<ProRequestModal/);
assert.match(serviceContentComponent, /<QnaComposerModal/);
assert.match(serviceContentComponent, /defaultValue=\{proRequestText\}/);
assert.match(serviceContentComponent, /defaultValue=\{qnaDraftTitle\}/);
assert.doesNotMatch(serviceContentComponent, /__mobileShell|renderModal|renderSecondaryState/);
assert.match(servicePlanComponent, /export function LockedFeatureScreen/);
assert.match(servicePlanComponent, /export function ProIntroScreen/);
assert.match(servicePlanComponent, /export function PaymentScreen/);
assert.match(servicePlanComponent, /export function PaymentCompleteScreen/);
assert.match(servicePlanComponent, /data-action="selectPlan"/);
assert.match(servicePlanComponent, /data-action="selectDuration"/);
assert.match(servicePlanComponent, /data-action="openWebPayment"/);
assert.doesNotMatch(servicePlanComponent, /dangerouslySetInnerHTML|renderSecondaryIntro|renderSelectedPlanDetail/);
assert.match(termsModalComponent, /<Modal dismissAction="closeTermsModal"/);
assert.doesNotMatch(authComponent, /dangerouslySetInnerHTML/);
assert.doesNotMatch(legalComponent, /dangerouslySetInnerHTML/);

console.log('renderer ownership boundary ok: all 40 screens are JSX-owned across bootstrap and deferred app registries');

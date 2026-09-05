import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const analysis = read('../src/screens/analysis/AddUniversityScreen.jsx');
const profile = read('../src/screens/profile/ProfileScreens.jsx');
const profileModal = read('../src/screens/profile/ScoreEditModal.jsx');
const mypage = read('../src/screens/mypage/MyPageSecondaryScreens.jsx');
const account = read('../src/screens/mypage/AccountInfoScreen.jsx');
const legal = read('../src/screens/mypage/LegalScreens.jsx');
const secondaryScreen = read('../src/components/SecondaryScreen.jsx');
const serviceContent = read('../src/screens/service/ServiceContentScreens.jsx');
const servicePlan = read('../src/screens/service/ServicePlanScreens.jsx');
const styles = read('../src/styles/components/secondary.css');
const accountStyles = read('../src/styles/screens/mypage-data.css');

assert.match(serviceContent, /sc-secondary-page/);
assert.match(serviceContent, /SecondaryIntro/);
assert.match(servicePlan, /sc-secondary-page/);
assert.match(servicePlan, /SecondaryIntro/);
assert.match(mypage, /sc-secondary-page/);
assert.match(mypage, /SecondaryIntro/);
assert.match(profile, /sc-secondary-page/);
assert.match(profile, /SecondaryIntro/);
assert.match(analysis, /sc-secondary-page/);
assert.match(analysis, /SecondaryIntro/);
assert.match(analysis, /defaultValue=\{analysisSearchTerm\}/);
assert.match(analysis, /data-action="retryUniversityCatalog"/);

for (const action of [
  'refreshUniversityRecommendations',
  'addAnalysisTarget',
  'selectUniversityForMajor'
]) assert.match(analysis, new RegExp(`data-action="${action}"`));

assert.match(profile, /data-action="setRankingPeriod"/);
assert.doesNotMatch(profile, /ranking-podium|podium-item/);
assert.match(profile, /data-action="saveQualInfo"/);
assert.match(profile, /data-action="openScoreEdit"/);
assert.match(profileModal, /className="score-grade-input"/);
assert.match(profileModal, /className="score-inquiry-grid"/);
assert.doesNotMatch(profileModal, /score-grade-grid|score-grade-card|setScoreEditGrade/);
assert.match(styles, /\.sc-secondary-page\{/);

const scoreStyles = read('../src/styles/screens/score-input.css');
assert.match(scoreStyles, /\.score-grade-input\{/);
assert.match(scoreStyles, /\.score-inquiry-grid\{/);
assert.doesNotMatch(scoreStyles, /\.score-grade-grid\{|\.score-grade-card\{/);

assert.match(mypage, /role="switch" aria-checked=/);
assert.match(mypage, /const NOTI_PAGE_SIZE = 7/);
assert.match(mypage, /\['planner', '플래너 알림'/);
assert.match(mypage, /\['report', '리포트 알림'/);
assert.doesNotMatch(mypage, /\['weekly', '주간 점검 알림'/);
assert.doesNotMatch(mypage, /\['billing', '결제\/구독 알림'/);
assert.match(mypage, /data-action="openNotiDetail"/);
assert.match(mypage, /data-action="openQnaComposer"/);
assert.match(mypage, /\[데이터 오류 신고\]/);
assert.match(mypage, /defaultValue=\{qnaDraftTitle\}/);
assert.match(mypage, /defaultValue=\{qnaDraftContent\}/);
assert.doesNotMatch(mypage, /dangerouslySetInnerHTML/);
assert.match(account, /data-action="openPhoneChangeModal"/);
assert.match(account, /data-action="saveMarketingConsent"/);
assert.match(account, /data-action="linkSocial"/);
assert.match(account, /role="switch"/);
assert.match(account, /className="account-danger-utility"/);
assert.match(account, /className="account-withdraw-link"/);
assert.doesNotMatch(account, /className="sc-secondary-section mobile-account-card danger-zone"/);
assert.match(accountStyles, /\.account-danger-utility\{/);
assert.match(accountStyles, /\.account-withdraw-link\{/);
assert.match(legal, /TERMS_CONTENT/);
assert.match(legal, /data-action="openTermsModal"/);
assert.match(legal, /export function SettingsMainScreen/);
assert.match(legal, /sc-reading-content/);
assert.doesNotMatch(legal, /dangerouslySetInnerHTML/);
assert.match(secondaryScreen, /export function SecondaryIntro/);
assert.match(secondaryScreen, /export function SecondaryScreenShell/);
assert.match(secondaryScreen, /<StatusState/);
assert.doesNotMatch(secondaryScreen, /sc-secondary-state/);

assert.match(serviceContent, /data-action="downloadProReport"/);
assert.match(serviceContent, /data-action="openProRequestModal"/);
assert.match(serviceContent, /data-action="openQnaComposer"/);
assert.match(serviceContent, /ResourceFeedback status=\{proReportsStatus\}/);
assert.match(serviceContent, /data-target=\{latest \? 'planner' : 'strategy'\}/);
assert.match(servicePlan, /data-action="openWebPayment"/);
assert.match(servicePlan, /data-action="selectPlan"/);
assert.match(servicePlan, /data-action="selectDuration"/);
assert.match(servicePlan, /aria-pressed=\{active\}/);
assert.match(servicePlan, /웹 결제는 4주 단위로 최종 확인됩니다/);

for (const selector of [
  '.sc-secondary-page',
  '.sc-secondary-intro',
  '.sc-secondary-section',
  '.sc-secondary-list',
  '.sc-secondary-row',
  '.sc-secondary-form'
]) assert.match(styles, new RegExp(selector.replace('.', '\\.') + '\\{'));
assert.doesNotMatch(styles, /\.sc-secondary-state/);

console.log('secondary-presentation contracts passed');

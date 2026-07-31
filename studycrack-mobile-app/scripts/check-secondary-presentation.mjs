import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const analysis = read('../src/screens/analysis/renderers.js');
const profile = read('../src/screens/profile/renderers.js');
const mypage = read('../src/screens/mypage/renderers.js');
const account = read('../src/screens/mypage/AccountInfoScreen.jsx');
const legal = read('../src/screens/mypage/LegalScreens.jsx');
const secondaryScreen = read('../src/components/SecondaryScreen.jsx');
const service = read('../src/screens/service/renderers.js');
const styles = read('../src/styles/components/secondary.css');

for (const source of [analysis, profile, mypage, service]) {
  assert.match(source, /sc-secondary-page/);
  assert.match(source, /renderSecondaryIntro/);
}

for (const action of [
  'refreshUniversityRecommendations',
  'addAnalysisTarget',
  'selectUniversityForMajor'
]) assert.match(analysis, new RegExp(`data-action="${action}"`));

assert.match(profile, /data-action="setRankingPeriod"/);
assert.doesNotMatch(profile, /ranking-podium|podium-item/);
assert.match(profile, /data-action="saveQualInfo"/);
assert.match(profile, /data-action="openScoreEdit"/);

assert.match(mypage, /role="switch" aria-checked=/);
assert.match(mypage, /const NOTI_PAGE_SIZE = 7/);
assert.match(mypage, /data-action="openNotiDetail"/);
assert.match(mypage, /data-action="openQnaComposer"/);
assert.match(account, /data-action="openPhoneChangeModal"/);
assert.match(account, /data-action="saveMarketingConsent"/);
assert.match(account, /data-action="linkSocial"/);
assert.match(account, /role="switch"/);
assert.match(legal, /TERMS_CONTENT/);
assert.match(legal, /data-action="openTermsModal"/);
assert.match(legal, /export function SettingsMainScreen/);
assert.match(legal, /sc-reading-content/);
assert.doesNotMatch(legal, /dangerouslySetInnerHTML/);
assert.match(secondaryScreen, /export function SecondaryIntro/);
assert.match(secondaryScreen, /export function SecondaryScreenShell/);

assert.match(service, /data-action="downloadProReport"/);
assert.match(service, /data-action="openWebPayment"/);
assert.match(service, /data-action="selectPlan"/);

for (const selector of [
  '.sc-secondary-page',
  '.sc-secondary-intro',
  '.sc-secondary-section',
  '.sc-secondary-list',
  '.sc-secondary-row',
  '.sc-secondary-form',
  '.sc-secondary-state'
]) assert.match(styles, new RegExp(selector.replace('.', '\\.') + '\\{'));

console.log('secondary-presentation contracts passed');

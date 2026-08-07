import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readViewportMetrics } from '../src/shared/browser/visual-viewport.js';
assert.deepEqual(readViewportMetrics({ height: 512.4, offsetTop: 17.7 }, 844), { height: 512, offsetTop: 18 });
assert.deepEqual(readViewportMetrics(null, 844), { height: 844, offsetTop: 0 });

const [modalCss, sheetCss, homeOverlayCss, authSource, analysisSource, appScreenShell, modalComponent, sheetComponent, termsComponent, mbtiComponent, profileOverlays, mypageSecondary, scoreEditModal, serviceContent] = await Promise.all([
  readFile(new URL('../src/styles/components/modals.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/components/sheets.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/home-overlays.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/auth/AuthScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/analysis/AnalysisScreen.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AppScreenShell.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Modal.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Sheet.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TermsModal.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/MbtiModal.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/mypage/ProfileOverlays.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/mypage/MyPageSecondaryScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/profile/ScoreEditModal.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/service/ServiceContentScreens.jsx', import.meta.url), 'utf8')
]);

assert.match(modalCss, /--sc-visual-height/);
assert.match(sheetCss, /--sc-sheet-max-height/);
const sheetLayer = Number(sheetCss.match(/\.sc-overlay--sheet\{[^}]*z-index:(\d+)/)?.[1]);
const calendarEventLayer = Number(homeOverlayCss.match(/\.calendar-event-overlay\{[^}]*z-index:(\d+)/)?.[1]);
assert.ok(calendarEventLayer > sheetLayer, 'Calendar event modal must render above the open calendar sheet');
assert.match(authSource, /app-screen-overlays/);
assert.match(analysisSource, /<AppScreenShell/);
assert.match(analysisSource, /overlays=\{<AnalysisSearchSheet/);
assert.match(appScreenShell, /app-screen-overlays/);
assert.match(modalComponent, /sc-overlay sc-overlay--modal home-modal-overlay/);
assert.match(modalComponent, /sc-modal home-modal/);
assert.match(sheetComponent, /sc-overlay sc-overlay--sheet planner-sheet-overlay/);
assert.match(sheetComponent, /sc-sheet planner-sheet/);
assert.match(sheetComponent, /role="dialog" aria-modal="true"/);
assert.match(termsComponent, /sc-modal-head terms-modal-head/);
assert.match(termsComponent, /sc-modal-body terms-modal-body/);
assert.match(mbtiComponent, /panelClass="mbti-survey-modal"/);
assert.match(profileOverlays, /panelClass="profile-detail-modal"/);
assert.match(profileOverlays, /panelClass="phone-change-modal account-edit-modal"/);
assert.match(mypageSecondary, /<Modal open=\{open\} dismissAction="closeQnaComposer"/);
assert.match(mypageSecondary, /<Modal dismissAction="closeNotiDetail"/);
assert.match(scoreEditModal, /<Modal dismissAction="closeScoreEdit"/);
assert.match(serviceContent, /<Modal open=\{open\} dismissAction="closeProRequestModal"/);
assert.match(serviceContent, /<Modal open=\{open\} dismissAction="closeQnaComposer"/);

console.log('overlay contracts passed');

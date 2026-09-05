import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readViewportMetrics } from '../src/shared/browser/visual-viewport.js';
assert.deepEqual(readViewportMetrics({ height: 512.4, offsetTop: 17.7 }, 844), { height: 512, offsetTop: 18 });
assert.deepEqual(readViewportMetrics(null, 844), { height: 844, offsetTop: 0 });

const [modalCss, sheetCss, plannerCalendarCss, authSource, analysisSource, appScreenShell, modalComponent, sheetComponent, overlayHook, overlayBrowser, profileDrawer, termsComponent, mbtiComponent, profileOverlays, mypageSecondary, scoreEditModal, serviceContent] = await Promise.all([
  readFile(new URL('../src/styles/components/modals.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/components/sheets.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/screens/planner-calendar.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/auth/AuthScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/analysis/AnalysisScreen.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AppScreenShell.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Modal.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Sheet.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/useOverlayDialog.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/browser/overlay-focus.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/mypage/ProfileDrawer.jsx', import.meta.url), 'utf8'),
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
assert.match(authSource, /app-screen-overlays/);
assert.match(analysisSource, /<AppScreenShell/);
assert.match(analysisSource, /overlayOpen=\{analysisSearchOpen\}/);
assert.match(analysisSource, /overlays=\{analysisSearchOpen \? <AnalysisSearchSheet/);
assert.match(appScreenShell, /app-screen-overlays/);
assert.match(appScreenShell, /overlayOpen = null/);
assert.match(appScreenShell, /lockScroll = null/);
assert.match(appScreenShell, /overlayOpen \?\? Boolean\(overlays\)/);
assert.match(modalComponent, /sc-overlay sc-overlay--modal sc-modal-padded-overlay/);
assert.match(modalComponent, /sc-modal sc-modal-padded/);
assert.match(modalComponent, /useOverlayDialog/);
assert.match(modalComponent, /aria-label=\{ariaLabel\}/);
assert.match(modalComponent, /tabIndex=\{-1\}/);
assert.match(sheetComponent, /role="dialog" aria-modal="true"/);
assert.match(sheetComponent, /sc-sheet-handle/);
assert.match(sheetComponent, /useOverlayDialog/);
assert.match(overlayHook, /event\.key === 'Escape'/);
assert.match(overlayHook, /trapOverlayFocus/);
assert.match(overlayHook, /restoreOverlayFocus/);
assert.match(overlayBrowser, /FOCUSABLE_SELECTOR/);
assert.match(overlayBrowser, /requestAnimationFrame/);
assert.match(profileDrawer, /useOverlayDialog/);
assert.match(profileDrawer, /aria-label="프로필 메뉴" tabIndex=\{-1\}/);
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

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

function assertSheetMarkup(markup, { dismissAction = '', overlayClasses = [], panelClasses = [], ariaLabel = '선택 메뉴' } = {}) {
  const overlayTag = markup.match(/^<div\b[^>]*>/)?.[0] || '';
  const panelTag = markup.slice(overlayTag.length).match(/^<div\b[^>]*>/)?.[0] || '';
  assert.deepEqual(new Set(attribute(overlayTag, 'class')?.split(/\s+/)), new Set(['sc-overlay', 'sc-overlay--sheet', ...overlayClasses]));
  assert.deepEqual(new Set(attribute(panelTag, 'class')?.split(/\s+/)), new Set(['sc-sheet', ...panelClasses]));
  assert.equal(attribute(overlayTag, 'data-action'), dismissAction);
  assert.equal(attribute(panelTag, 'data-action'), 'noopModal');
  assert.equal(attribute(panelTag, 'role'), 'dialog');
  assert.equal(attribute(panelTag, 'aria-modal'), 'true');
  assert.equal(attribute(panelTag, 'aria-label'), ariaLabel);
  assert.equal(attribute(panelTag, 'tabindex'), '-1');
  assert.match(markup, /<div class="sc-sheet-handle" aria-hidden="true"><\/div>/);
}

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true, hmr: false }
});
const failures = [];
let sheetChecks = 0;
try {
  const [{ Sheet }, { PlannerEditSheet }, { StudySubjectSheet }, { AnalysisSearchSheet }] = await Promise.all([
    vite.ssrLoadModule('/src/components/Sheet.jsx'),
    vite.ssrLoadModule('/src/screens/planner/PlannerEditSheet.jsx'),
    vite.ssrLoadModule('/src/screens/timer/TimerOverlays.jsx'),
    vite.ssrLoadModule('/src/screens/analysis/AnalysisContent.jsx')
  ]);
  const render = (component, props = {}) => renderToStaticMarkup(createElement(component, props));
  const check = (name, task) => {
    sheetChecks += 1;
    try { task(); } catch (error) { failures.push(`${name}: ${error.message}`); }
  };
  const plannerClasses = { overlayClasses: ['planner-sheet-overlay'], panelClasses: ['planner-sheet'] };

  check('default Sheet is neutral', () => assertSheetMarkup(render(Sheet)));
  check('explicit neutral Sheet', () => assertSheetMarkup(render(Sheet, { variant: 'neutral' })));
  check('unknown variant cannot activate planner styling', () => assertSheetMarkup(render(Sheet, { variant: 'unknown' })));
  check('explicit planner Sheet', () => assertSheetMarkup(render(Sheet, { variant: 'planner' }), plannerClasses));
  check('closed variants render no dialog', () => {
    for (const variant of [undefined, 'neutral', 'planner', 'unknown']) assert.equal(render(Sheet, { open: false, variant }), '');
  });
  check('custom classes, dismiss action and accessible name survive both variants', () => {
    for (const variant of ['neutral', 'planner']) {
      const extra = variant === 'planner' ? plannerClasses : { overlayClasses: [], panelClasses: [] };
      const props = { variant, overlayClass: 'custom-overlay', panelClass: 'custom-panel', dismissAction: 'closeTestSheet', ariaLabel: '도움말 선택' };
      assertSheetMarkup(render(Sheet, props), {
        dismissAction: props.dismissAction,
        ariaLabel: props.ariaLabel,
        overlayClasses: [...extra.overlayClasses, props.overlayClass],
        panelClasses: [...extra.panelClasses, props.panelClass]
      });
    }
  });
  check('planner edit preserves its dialog and fields', () => {
    const markup = render(PlannerEditSheet, { plannerEditIndex: 0, plannerEditItem: { subject: '수학', content: '기출 풀이' } });
    assertSheetMarkup(markup, { ...plannerClasses, dismissAction: 'closePlannerEdit' });
    assert.equal(attribute(markup.match(/<input\b[^>]*data-field="plannerEditContent"[^>]*>/)?.[0] || '', 'value'), '기출 풀이');
    assert.match(markup, /data-action="savePlannerEdit"/);
    assert.equal(render(PlannerEditSheet), '');
  });
  check('study selection preserves planner geometry and confirmation action', () => {
    const markup = render(StudySubjectSheet, { studySubjectSheetOpen: true, studyStartDraft: { subject: '국어', activity: '독서 지문 분석' } });
    assertSheetMarkup(markup, { ...plannerClasses, panelClasses: ['planner-sheet', 'study-subject-sheet'], dismissAction: 'closeStudySubjectSheet' });
    assert.match(markup, /data-field="studyStartActivity"/);
    assert.match(markup, /data-action="confirmStudyStart"/);
    assert.equal(render(StudySubjectSheet), '');
  });
  check('analysis search preserves its explicit compatibility composition', () => {
    const markup = render(AnalysisSearchSheet, { analysisSearchOpen: true, analysisSearchTerm: '대학' });
    assertSheetMarkup(markup, { overlayClasses: ['planner-sheet-overlay', 'analysis-search-overlay'], panelClasses: ['planner-sheet', 'analysis-search-modal'], dismissAction: 'closeAnalysisSearch' });
    assert.equal(attribute(markup.match(/<input\b[^>]*data-field="analysisSearchTerm"[^>]*>/)?.[0] || '', 'value'), '대학');
    assert.match(markup, /data-action="runUniversitySearch"/);
    assert.equal(render(AnalysisSearchSheet), '');
  });
} finally {
  await vite.close();
}
assert.equal(failures.length, 0, `Sheet render contracts failed (${failures.length}/${sheetChecks}):\n${failures.join('\n')}`);
console.log(`Sheet render contracts passed (${sheetChecks}/${sheetChecks})`);

console.log('overlay contracts passed');

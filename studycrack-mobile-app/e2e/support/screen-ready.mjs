import { expect } from '@playwright/test';

// Deferred loading and failure screens reuse data-screen; require actual content.
const SCREEN_CONTENT = Object.freeze({
  timer: '.timer-v2-brand-head',
  aquarium: '.aquarium-screen',
  analysis: '.analysis-v2',
  addUniversity: '.add-univ-page',
  ranking: '.ranking-page',
  qualInfo: '.qual-form-page',
  scoreInfo: '.score-info-page',
  authLogin: '.auth-screen',
  authFindId: '.auth-direct-recovery',
  authFindPw: '.auth-direct-recovery',
  authSignup: '.signup-page',
  splash: '.splash-brand',
  on1: '.onboarding-shot',
  on2: '.onboarding-shot',
  on3: '.onboarding-shot',
  planner: '.planner-screen',
  plannerAdd: '[data-planner-add-root]',
  ob1: '.onboarding-container',
  ob2: '.onboarding-container',
  ob3: '.onboarding-container',
  ob4: '.onboarding-container',
  ob5: '.onboarding-container',
  strategy: '.coaching-screen',
  weekly: '.weekly-page',
  report: '.report-page',
  reportDetail: '.report-detail-page',
  tutor: '.tutor-qna-page',
  lockedFeature: '.locked-feature-panel',
  proElite: '.pro-elite-page',
  proIntro: '.plan-console-page',
  payment: '.payment-console-page',
  paymentComplete: '.payment-done-screen',
  my: '.my-page',
  notificationSettings: '.notification-settings-page',
  notificationList: '.notification-list-page',
  customerSupport: '.support-page',
  settingsMain: '.settings-page',
  settingsTermsPicker: '.terms-picker-page',
  accountInfo: '.account-info-page',
  privacyPolicy: '.sc-reading-page',
  termsScreen: '.sc-reading-page'
});

function screenContract(screen) {
  if (!Object.hasOwn(SCREEN_CONTENT, screen)) throw new Error(`No real-screen readiness contract for ${screen}`);
  return {
    root: screen === 'splash' ? '.splash-v2' : `[data-screen="${screen}"]`,
    content: SCREEN_CONTENT[screen]
  };
}

export async function expectScreenReady(page, screen, { timeout = 5000 } = {}) {
  const contract = screenContract(screen);
  const root = page.locator(contract.root);
  await expect(root.locator(contract.content), `${screen} actual content must replace the deferred shell`).toBeVisible({ timeout });
  return root;
}

export async function expectScreenViewport(page, screen, viewport, { timeout = 5000 } = {}) {
  const contract = screenContract(screen);
  await expect(async () => {
    // Read readiness and geometry together, so a replaced element is never reused.
    const snapshot = await page.evaluate(({ root, content }) => {
      const visible = element => {
        if (!element?.checkVisibility({ visibilityProperty: true })) return false;
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      };
      const screenElement = [...document.querySelectorAll(root)].find(visible);
      const contentElement = screenElement?.querySelector(content);
      const frame = screenElement?.closest('.app-frame');
      return {
        ready: visible(contentElement) && visible(frame),
        frame: frame ? { width: frame.getBoundingClientRect().width, height: frame.getBoundingClientRect().height } : null,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    }, contract);
    expect(snapshot.ready, `${screen} actual content must replace the deferred shell`).toBe(true);
    expect(snapshot.frame, `${screen} visible app frame`).not.toBeNull();
    expect(snapshot.frame.width).toBeGreaterThan(0);
    expect(snapshot.frame.width).toBeLessThanOrEqual(viewport.width);
    expect(Math.abs(snapshot.frame.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(snapshot.overflow).toBeLessThanOrEqual(1);
  }).toPass({ timeout });
}

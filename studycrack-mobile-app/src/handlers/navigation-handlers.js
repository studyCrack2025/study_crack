import { getData } from './action-utils.js';
import { dismissTopOverlay } from '../shared/browser/overlay-focus.js';
import { markIntroSeen } from '../features/session/intro-storage.js';

export function createNavigationHandlers(ctx) {
  const {
    back,
    beforeGoto,
    closeDrawer,
    completeOnboarding,
    goto,
    initializeApp,
    markOnboardingComplete,
    preserveScroll,
    selectPlan
  } = ctx;

  const runGoto = async ({ actionEl, event }, target, options = {}) => {
    if (!target) return false;
    const allowed = await beforeGoto?.({ actionEl, event, target, ...options });
    if (allowed === false) return false;
    goto?.(target, options.replaceHistory);
    return true;
  };

  return {
    finishIntro() {
      if (!['on1', 'on2', 'on3'].includes(ctx.screen)) return false;
      markIntroSeen();
      goto?.(ctx.hasClientSession?.() ? 'timer' : 'authLogin', false);
      return true;
    },
    async goto(payload) {
      return runGoto(payload, getData(payload.actionEl, 'target'));
    },

    back() {
      if (dismissTopOverlay()) return true;
      back?.();
      return true;
    },

    goRanking(payload) {
      return runGoto(payload, 'ranking');
    },

    tab(payload) {
      return runGoto(payload, getData(payload.actionEl, 'tab'));
    },

    drawerGoto(payload) {
      closeDrawer?.();
      return runGoto(payload, getData(payload.actionEl, 'target'));
    },

    completeOnboarding(payload) {
      const task = () => {
        markOnboardingComplete?.();
        goto?.('timer', false);
      };
      preserveScroll ? preserveScroll(task, payload) : task();
      return true;
    },

    startStandard(payload) {
      const task = () => {
        markOnboardingComplete?.();
        selectPlan?.('Standard');
        goto?.('proIntro');
      };
      preserveScroll ? preserveScroll(task, payload) : task();
      return true;
    },

    retryInit() {
      initializeApp?.();
      return true;
    },

    noopModal() {
      return true;
    }
  };
}

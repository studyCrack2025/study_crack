import { getData } from './action-utils.js';

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
    async goto(payload) {
      return runGoto(payload, getData(payload.actionEl, 'target'));
    },

    back() {
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
        goto?.('home', false);
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

import { getData } from './action-utils.js';
import { removeTargetSlot, targetSlotsToList } from '../runtime/persistence.js';

function noop() {}

function getWindow(ctx) {
  return ctx.window || globalThis.window || {};
}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function getScrollY(ctx) {
  const win = getWindow(ctx);
  return win.scrollY || win.pageYOffset || 0;
}

function restoreScroll(ctx, y) {
  const win = getWindow(ctx);
  const raf = ctx.requestAnimationFrame || win.requestAnimationFrame || ((fn) => fn());
  raf(() => {
    raf(() => {
      win.scrollTo?.({ top: y, left: 0, behavior: 'auto' });
    });
  });
}

function findUniversitySearchInput(actionEl) {
  return actionEl
    ?.closest?.('.analysis-search-inline, .analysis-search-sticky, .home-modal, .add-univ-page')
    ?.querySelector?.('[data-field="analysisSearchTerm"]') || null;
}

function clampHomeSlide(index, homeTargets = []) {
  return Math.max(0, Math.min(index, homeTargets.length));
}

function getPossibleSlider(actionEl) {
  return actionEl?.closest?.('.card')?.querySelector?.('.possible-univ-slider')
    || actionEl?.closest?.('.possible-univ-nav')?.previousElementSibling
    || null;
}

export function createAnalysisHandlers(ctx) {
  const {
    addMajorToTargets = noop,
    afterSafariViewportStable = (fn) => fn?.(),
    alert = globalThis.alert || noop,
    confirm = globalThis.confirm || (() => false),
    goto,
    keepScrollPosition = noop,
    markStableScrollPosition = noop,
    preserveScrollAfterStateChange = (fn) => fn?.(),
    restoreIfUnexpectedTopJump = noop,
    setActiveScoreView = noop,
    setAddingUniversity = noop,
    setAnalysisBarProjectionTarget = noop,
    setAnalysisHighlightedSubject = noop,
    setAnalysisSearchOpen = noop,
    setAnalysisSearchTerm = noop,
    setAnalysisTargetList = noop,
    setHomeDragOffset = noop,
    setHomeSlideIndex = noop,
    setHomeSlideMotion = noop,
    setHomeTargetList = noop,
    setScoreDragOffset = noop,
    setScoreSlideMotion = noop,
    setTargetMajor = noop,
    setTargetDeleteCandidate = noop,
    setTargetDeleteError = noop,
    setTargetDeleteModalOpen = noop,
    setTargetDeleteSaving = noop,
    setTargetUnivSlots = noop,
    setTargetOpen = noop,
    setUniversityModalOpen = noop,
    setUniversityCatalogError = noop,
    setUniversityCatalogRetryTick = noop,
    setUniversityCatalogStatus = noop,
    setUniversitySelectedName = noop,
    setUniversityRecommendationRetryTick = noop,
    persistTargetUnivs = noop,
    timeout = setTimeout,
    updatePossibleUnivSlider = noop
  } = ctx;

  return {
    setScoreView({ actionEl, event }) {
      const nextView = getData(actionEl, 'score-view', 'current');
      if (ctx.isIOSSafari?.()) {
        ctx.setScoreCardDom?.(actionEl, nextView);
        return true;
      }
      if (ctx.screen === 'ob5') {
        const card = actionEl?.closest?.('.score-journey-card');
        if (!card) return false;
        card.querySelectorAll?.('.score-journey-segment button')?.forEach((btn) => {
          btn.classList?.toggle?.('active', btn.getAttribute?.('data-score-view') === nextView);
        });
        const track = card.querySelector?.('.score-journey-track');
        if (track) {
          track.style.setProperty('--score-slide-x', nextView === 'target' ? '-50%' : '0%');
          track.style.setProperty('--score-slide-transition', 'transform .56s cubic-bezier(.22,.61,.36,1)');
        }
        return true;
      }
      keepScrollPosition(700);
      event?.stopPropagation?.();
      setScoreDragOffset(0);
      markStableScrollPosition();
      setActiveScoreView((prev) => {
        if (prev === nextView) return prev;
        setScoreSlideMotion(nextView === 'target' ? 'motion-next' : 'motion-prev');
        return nextView;
      });
      return true;
    },

    setHomeSlide({ actionEl }) {
      const index = Number(getData(actionEl, 'slide-index'));
      if (Number.isNaN(index)) return false;
      // 인디케이터 점 클릭도 슬라이더와 동일하게 state 단일 출처로 커밋(DOM 역산 setHomeSlideDom 제거).
      setHomeDragOffset(0);
      markStableScrollPosition();
      setHomeSlideIndex((prev) => {
        const next = clampHomeSlide(index, ctx.homeTargets || []);
        if (next === prev) return prev;
        setHomeSlideMotion(next > prev ? 'motion-next' : 'motion-prev');
        return next;
      });
      restoreIfUnexpectedTopJump();
      return true;
    },

    slidePrev({ actionEl }) {
      const slider = getPossibleSlider(actionEl);
      if (!slider) return false;
      updatePossibleUnivSlider(slider, Number(slider.dataset.slideIndex || 0) - 1);
      return true;
    },

    slideNext({ actionEl }) {
      const slider = getPossibleSlider(actionEl);
      if (!slider) return false;
      updatePossibleUnivSlider(slider, Number(slider.dataset.slideIndex || 0) + 1);
      return true;
    },

    slideTo({ actionEl }) {
      const slider = getPossibleSlider(actionEl);
      if (!slider) return false;
      updatePossibleUnivSlider(slider, Number(getData(actionEl, 'slide-index', slider.dataset.slideIndex || 0)));
      return true;
    },

    openPossibleUnivAnalysis({ actionEl }) {
      const major = getData(actionEl, 'target-major');
      if (!major) return false;
      if (!confirm(`${major} 분석을 보시겠어요?`)) return false;
      setTargetMajor(major);
      goto?.('analysis');
      return true;
    },

    openAnalysisSearch() {
      goto?.('addUniversity');
      return true;
    },

    closeAnalysisSearch() {
      afterSafariViewportStable(() => setAnalysisSearchOpen(false));
      setAnalysisSearchTerm('');
      return true;
    },

    runUniversitySearch({ actionEl }) {
      const input = findUniversitySearchInput(actionEl);
      const value = input?.value || '';
      setAnalysisSearchTerm(value);
      const doc = getDocument(ctx);
      if (input && doc?.activeElement !== input) input.focus?.({ preventScroll: true });
      return true;
    },

    selectUniversityForMajor({ actionEl }) {
      const university = getData(actionEl, 'university-name');
      if (!university) return false;
      setUniversitySelectedName(university);
      setAnalysisSearchTerm('');
      return true;
    },

    backToUniversityList() {
      setUniversitySelectedName('');
      setAnalysisSearchTerm('');
      return true;
    },

    refreshUniversityRecommendations() {
      setUniversityRecommendationRetryTick((value) => Number(value || 0) + 1);
      return true;
    },

    retryUniversityCatalog() {
      setUniversityCatalogStatus('idle');
      setUniversityCatalogError('');
      setUniversityCatalogRetryTick((value) => Number(value || 0) + 1);
      return true;
    },

    highlightSimSubject({ actionEl }) {
      const subject = getData(actionEl, 'sim-subject');
      if (!subject) return false;
      setAnalysisHighlightedSubject(subject);
      return true;
    },

    simulateBarGain({ actionEl, event }) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const y = getScrollY(ctx);
      const major = getData(actionEl, 'target-major');
      if (!major) return false;
      setTargetMajor(major);
      setAnalysisBarProjectionTarget(major);
      restoreScroll(ctx, y);
      return true;
    },

    addAnalysisTarget({ actionEl }) {
      const major = getData(actionEl, 'target-major');
      if (!major) return false;
      afterSafariViewportStable(() => setUniversityModalOpen(false));
      afterSafariViewportStable(() => setAnalysisSearchOpen(false));
      setAnalysisSearchTerm('');
      setAddingUniversity(true);
      timeout(() => {
        addMajorToTargets(major);
        setAddingUniversity(false);
      }, 500);
      return true;
    },

    addPossibleUniversity({ actionEl }) {
      const major = getData(actionEl, 'target-major');
      if (!major) return false;
      addMajorToTargets(major);
      return true;
    },

    removeAnalysisTarget({ actionEl }) {
      const major = getData(actionEl, 'target-major');
      if (!major) return false;
      const homeTargetList = ctx.homeTargetList || [];
      if (homeTargetList.length <= 1) {
        alert('최소 1개 대학은 유지해야 합니다.');
        return false;
      }
      setTargetDeleteCandidate(major);
      setTargetDeleteError('');
      setTargetDeleteSaving(false);
      setTargetDeleteModalOpen(true);
      return true;
    },

    cancelTargetDelete() {
      if (ctx.targetDeleteSaving) return true;
      setTargetDeleteModalOpen(false);
      setTargetDeleteCandidate('');
      setTargetDeleteError('');
      return true;
    },

    async confirmTargetDelete() {
      if (ctx.targetDeleteSaving) return true;
      const major = ctx.targetDeleteCandidate;
      if (!major) return false;
      const homeTargetList = ctx.homeTargetList || [];
      if (homeTargetList.length <= 1) {
        alert('최소 1개 대학은 유지해야 합니다.');
        setTargetDeleteModalOpen(false);
        setTargetDeleteCandidate('');
        return false;
      }
      const nextSlots = removeTargetSlot(ctx.targetUnivSlots, major, homeTargetList);
      const nextHome = targetSlotsToList(nextSlots);
      const nextAnalysis = (ctx.analysisTargetList || []).filter((value) => value !== major);
      if (!nextHome.length) {
        alert('최소 1개 대학은 유지해야 합니다.');
        return false;
      }
      setTargetDeleteSaving(true);
      setTargetDeleteError('');
      const result = await persistTargetUnivs(nextHome, nextSlots);
      if (result && result.ok === false) {
        setTargetDeleteSaving(false);
        setTargetDeleteError(result.error || '목표 대학 저장에 실패했습니다.');
        return false;
      }
      setTargetUnivSlots(nextSlots);
      setAnalysisTargetList(nextAnalysis);
      setHomeTargetList(() => {
        setHomeSlideIndex((idx) => Math.max(0, Math.min(idx, Math.max(0, nextHome.length - 1))));
        return nextHome;
      });
      if (ctx.targetMajor === major) {
        setTargetMajor(nextAnalysis[0] || nextHome[0] || ctx.analysisRecommended?.[0] || '');
      }
      setTargetDeleteSaving(false);
      setTargetDeleteModalOpen(false);
      setTargetDeleteCandidate('');
      return true;
    },

    selectTarget({ actionEl }) {
      const major = getData(actionEl, 'target-major');
      preserveScrollAfterStateChange(() => {
        setTargetMajor(major);
        afterSafariViewportStable(() => setTargetOpen(false));
      });
      return true;
    }
  };
}

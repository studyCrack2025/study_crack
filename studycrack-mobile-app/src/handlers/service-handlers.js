import { getData } from './action-utils.js';

function noop() {}

function getWindow(ctx) {
  return ctx.window || globalThis.window || {};
}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function query(ctx, selector) {
  return getDocument(ctx)?.querySelector?.(selector) || null;
}

function queryAll(ctx, selector) {
  return Array.from(getDocument(ctx)?.querySelectorAll?.(selector) || []);
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

function clickDownload(ctx, href, fileName) {
  const doc = getDocument(ctx);
  if (!href || !doc?.createElement || !doc?.body) return false;
  const anchor = doc.createElement('a');
  anchor.href = href;
  anchor.download = fileName || href.split('/').pop() || 'download.pdf';
  doc.body.appendChild(anchor);
  anchor.click();
  doc.body.removeChild(anchor);
  return true;
}

function readCoachingRows(ctx) {
  return (ctx.coachingSubjectRows || []).map((row) => ({
    ...row,
    detail: query(ctx, `[data-coach-detail="${row.id}"]`)?.value || row.detail,
    planned: query(ctx, `[data-coach-plan="${row.id}"]`)?.value || row.planned,
    actual: query(ctx, `[data-coach-actual="${row.id}"]`)?.value || row.actual
  }));
}

function readCoachingExamScores(ctx) {
  if (!(ctx.isIOSSafari?.() && ctx.screen === 'strategy')) return ctx.coachingExamScores || {};
  return queryAll(ctx, '[data-coach-field]').reduce((values, input) => {
    const key = input.getAttribute?.('data-coach-field');
    if (key) values[key] = input.value || '';
    return values;
  }, {});
}

function hasInvalidCoachingRows(rows) {
  return rows.some((row) => !String(row.detail || '').trim() || !String(row.planned || '').trim() || !String(row.actual || '').trim());
}

function hasMissingExamScore(scores) {
  return !String(scores.koreanRaw || '').trim()
    || !String(scores.mathRaw || '').trim()
    || !String(scores.englishGrade || '').trim()
    || !String(scores.inq1Raw || '').trim()
    || !String(scores.inq2Raw || '').trim();
}

function togglePlanDom(ctx, plan) {
  const doc = getDocument(ctx);
  if (doc?.body?.dataset) doc.body.dataset.checkoutPlan = plan;
  queryAll(ctx, '.plan-card, .payment-plan-tabs button').forEach((card) => {
    const key = card.getAttribute?.('data-plan');
    if (key) card.classList?.toggle?.('active', key === plan);
  });
}

function toggleDurationDom(ctx, duration) {
  const doc = getDocument(ctx);
  if (doc?.body?.dataset) doc.body.dataset.selectedDuration = duration;
  queryAll(ctx, '.duration-row button').forEach((btn) => {
    btn.classList?.toggle?.('active', btn.getAttribute?.('data-duration') === duration);
  });
}

export function createServiceHandlers(ctx) {
  const {
    afterSafariViewportStable = (fn) => fn?.(),
    alert = globalThis.alert || noop,
    ensureCoachingSubjectRows = noop,
    goto,
    preserveScrollAfterStateChange = (fn) => fn?.(),
    preserveY = (fn) => fn?.(),
    prompt = globalThis.prompt,
    setAnalysisSearchOpen = noop,
    setCoachingDropReasons = noop,
    setCoachingExamFiles = noop,
    setCoachingExamScores = noop,
    setCoachingExamType = noop,
    setCheckoutPlan = noop,
    setCoachingPlannerFiles = noop,
    setCoachingSheetOpen = noop,
    setCoachingStep = noop,
    setCoachingSubjectRows = noop,
    setCoachingSubmitted = noop,
    setCoachingTrend = noop,
    setDrawerOpen = noop,
    setDuration = noop,
    setHistory = noop,
    setNotifModalOpen = noop,
    setProRequestModalOpen = noop,
    setProRequestText = noop,
    setQnaComposerOpen = noop,
    setQnaDraftContent = noop,
    setQnaDraftTitle = noop,
    setQnaHistory = noop,
    setQnaStatus = noop,
    setQnaSubmitting = noop,
    setTargetMajor = noop,
    setTargetOpen = noop,
    setUniversityModalOpen = noop,
    syncStep1FromDom,
    window = getWindow(ctx)
  } = ctx;
  const win = window || getWindow(ctx);

  return {
    selectPlan({ actionEl }) {
      const plan = getData(actionEl, 'plan');
      if (!plan) return false;
      if (ctx.isIOSSafari?.()) {
        togglePlanDom(ctx, plan);
        return true;
      }
      setCheckoutPlan(plan);
      return true;
    },

    selectDuration({ actionEl }) {
      const duration = getData(actionEl, 'duration');
      if (!duration) return false;
      if (ctx.isIOSSafari?.()) {
        toggleDurationDom(ctx, duration);
        return true;
      }
      setDuration(duration);
      return true;
    },

    openWebPayment() {
      const target = '/payment?source=mobile_app';
      if (win?.location?.assign) win.location.assign(target);
      else if (win?.location) win.location.href = target;
      return true;
    },

    toggleTarget() {
      preserveY(() => setTargetOpen((value) => !value));
      return true;
    },

    selectUniversity({ actionEl, event }) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const y = getScrollY(ctx);
      const major = getData(actionEl, 'target-major');
      if (!major) return false;
      setTargetMajor(major);
      setTargetOpen(false);
      goto?.('analysis');
      restoreScroll(ctx, y);
      return true;
    },

    openUniversityModal() {
      goto?.('addUniversity');
      return true;
    },

    openAnalysisSearchFromHome() {
      goto?.('addUniversity');
      return true;
    },

    closeUniversityModal({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('home-modal-overlay')) return false;
      preserveScrollAfterStateChange(() => {
        setUniversityModalOpen(false);
        setAnalysisSearchOpen(false);
      });
      return true;
    },

    openDrawer() {
      preserveScrollAfterStateChange(() => {
        setNotifModalOpen(false);
        setDrawerOpen(true);
      });
      return true;
    },

    closeDrawer({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('drawer-overlay')) return false;
      preserveScrollAfterStateChange(() => setDrawerOpen(false));
      return true;
    },

    openNotificationModal() {
      preserveScrollAfterStateChange(() => setNotifModalOpen(true));
      return true;
    },

    closeNotificationModal({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('home-modal-overlay')) return false;
      preserveScrollAfterStateChange(() => setNotifModalOpen(false));
      return true;
    },

    drawerGoto({ actionEl }) {
      setDrawerOpen(false);
      goto?.(getData(actionEl, 'target'));
      return true;
    },

    openProRequestModal() {
      setProRequestModalOpen(true);
      return true;
    },

    closeProRequestModal() {
      setProRequestModalOpen(false);
      return true;
    },

    submitProRequest() {
      if (!String(ctx.proRequestText || '').trim()) {
        alert('요청 사항을 입력해주세요.');
        return false;
      }
      alert('요청서가 제출되었습니다.');
      setProRequestModalOpen(false);
      setProRequestText('');
      return true;
    },

    openQnaComposer() {
      setQnaComposerOpen(true);
      return true;
    },

    closeQnaComposer() {
      setQnaComposerOpen(false);
      return true;
    },

    async submitMobileQna() {
      const title = String(ctx.qnaDraftTitle || '').trim();
      const content = String(ctx.qnaDraftContent || '').trim();
      if (!title || !content) {
        alert('질문 제목과 내용을 입력해주세요.');
        return false;
      }
      if (ctx.qnaSubmitting) return false;
      setQnaSubmitting(true);
      const result = await ctx.persistMobileQna?.({ title, content });
      setQnaSubmitting(false);
      if (!result?.ok || !result.item) {
        alert(result?.error || '질문 저장에 실패했습니다.');
        return false;
      }
      setQnaHistory((prev) => [result.item, ...(Array.isArray(prev) ? prev : [])]);
      setQnaStatus('ready');
      setQnaDraftTitle('');
      setQnaDraftContent('');
      setQnaComposerOpen(false);
      alert('질문이 등록되었습니다.');
      return true;
    },

    downloadProReport({ actionEl }) {
      const pdfPath = getData(actionEl, 'pdf-path');
      if (!pdfPath) {
        alert('리포트 파일이 준비되면 다운로드할 수 있습니다.');
        return false;
      }
      const fileName = getData(actionEl, 'pdf-name', 'studycrack-pro-report.pdf');
      return clickDownload(ctx, pdfPath, fileName);
    },

    openCoachingSheet() {
      ensureCoachingSubjectRows();
      setCoachingStep(1);
      setCoachingSheetOpen(true);
      return true;
    },

    closeCoachingSheet() {
      setCoachingSheetOpen(false);
      return true;
    },

    addCoachingSubject() {
      const customName = prompt?.('과목명을 입력하세요', '사회문화');
      if (!customName) return false;
      const id = `custom-${Date.now()}`;
      setCoachingSubjectRows((prev) => [
        ...prev,
        { id, subject: customName, detail: '', planned: '', actual: '', removable: true, placeholder: '세부과목 입력' }
      ]);
      return true;
    },

    removeCoachingSubject({ actionEl }) {
      const rowId = getData(actionEl, 'coach-row');
      if (!rowId) return false;
      setCoachingSubjectRows((prev) => prev.filter((row) => row.id !== rowId));
      return true;
    },

    openPlannerFilePicker() {
      query(ctx, '[data-field="coachPlannerFiles"]')?.click?.();
      return true;
    },

    removePlannerPhoto({ actionEl }) {
      const index = Number(getData(actionEl, 'photo-index'));
      setCoachingPlannerFiles((prev) => prev.filter((_, idx) => idx !== index));
      return true;
    },

    setCoachingExamType({ actionEl }) {
      setCoachingExamType(getData(actionEl, 'coach-exam'));
      return true;
    },

    openExamFilePicker() {
      query(ctx, '[data-field="coachExamFiles"]')?.click?.();
      return true;
    },

    removeExamPhoto({ actionEl }) {
      const index = Number(getData(actionEl, 'photo-index'));
      setCoachingExamFiles((prev) => prev.filter((_, idx) => idx !== index));
      return true;
    },

    setCoachingTrend({ actionEl }) {
      setCoachingTrend(getData(actionEl, 'coach-trend'));
      return true;
    },

    toggleDropReason({ actionEl }) {
      const reason = getData(actionEl, 'drop-reason');
      if (!reason) return false;
      setCoachingDropReasons((prev) => (
        prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason]
      ));
      return true;
    },

    coachingPrev() {
      if (ctx.coachingStep <= 1) return false;
      setCoachingStep((prev) => Math.max(1, prev - 1));
      return true;
    },

    coachingNext() {
      const step = Number(ctx.coachingStep || 1);
      if (step === 1) {
        const rows = readCoachingRows(ctx);
        if (typeof syncStep1FromDom === 'function') syncStep1FromDom();
        else setCoachingSubjectRows(rows);
        if (hasInvalidCoachingRows(rows)) {
          alert('필수 입력 사항을 모두 입력해주세요');
          return false;
        }
      }
      if (step === 2 && (ctx.coachingPlannerFiles || []).length === 0) {
        alert('필수 입력 사항을 모두 입력해주세요');
        return false;
      }
      if (step === 3) {
        const examScores = readCoachingExamScores(ctx);
        if (!ctx.coachingExamType) {
          alert('필수 입력 사항을 모두 입력해주세요');
          return false;
        }
        if (ctx.coachingExamType !== '미응시' && hasMissingExamScore(examScores)) {
          alert('필수 입력 사항을 모두 입력해주세요');
          return false;
        }
        if (ctx.isIOSSafari?.() && ctx.screen === 'strategy') {
          setCoachingExamScores((prev) => ({ ...prev, ...examScores }));
        }
      }
      if (step === 4 && !ctx.coachingTrend) {
        alert('필수 입력 사항을 모두 입력해주세요');
        return false;
      }
      if (step >= 8) {
        setCoachingSheetOpen(false);
        setCoachingSubmitted(true);
        alert('코칭 요청이 제출되었습니다.\n튜터 피드백이 도착하면 학습 코칭 페이지에서 확인할 수 있어요.');
        return true;
      }
      setCoachingStep((prev) => Math.min(8, prev + 1));
      return true;
    },

    resetServiceFlow() {
      setHistory([]);
      afterSafariViewportStable(() => {
        setUniversityModalOpen(false);
        setAnalysisSearchOpen(false);
      });
      win.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
      return true;
    }
  };
}

import { FIXED_TODAY_DATE } from '../constants/mock-data.js';
import { buildPlannerId } from '../state/planner-storage.js';
import { getData } from './action-utils.js';

function noop() {}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function query(ctx, selector) {
  return getDocument(ctx)?.querySelector?.(selector) || null;
}

function getInputValue(ctx, selector) {
  return query(ctx, selector)?.value || '';
}

function dotForSubject(subject = '') {
  const lowered = String(subject).toLowerCase();
  if (String(subject).includes('수') || lowered.includes('math')) return 'math';
  if (String(subject).includes('영') || lowered.includes('eng')) return 'eng';
  if (String(subject).includes('국') || lowered.includes('kor')) return 'kor';
  if (String(subject).includes('기타') || lowered.includes('etc')) return 'etc';
  return 'sci';
}

function setRefValue(ref, value) {
  if (ref && typeof ref === 'object') ref.current = value;
}

function getRefValue(ref, fallback = '') {
  return ref && typeof ref === 'object' ? ref.current ?? fallback : fallback;
}

function mutateStudyRecord(records, today, elapsed) {
  const idx = records.findIndex((row) => row.date === today);
  if (idx >= 0) {
    const clone = [...records];
    clone[idx] = { ...clone[idx], studyTime: (clone[idx].studyTime || 0) + elapsed };
    return clone;
  }
  return [...records, { date: today, studyTime: elapsed }];
}

function mutateSubjectRecord(records, today, subject, elapsed) {
  const idx = records.findIndex((row) => row.date === today);
  if (idx >= 0) {
    const clone = [...records];
    const oldSubjects = clone[idx].subjects || {};
    clone[idx] = {
      ...clone[idx],
      subjects: {
        ...oldSubjects,
        [subject]: (oldSubjects[subject] || 0) + elapsed
      }
    };
    return clone;
  }
  return [...records, { date: today, subjects: { [subject]: elapsed } }];
}

function startStudyTimer(ctx, subject, plannerItemId = '') {
  const {
    setActivePlannerItemId = noop,
    setActiveStudySubject = noop,
    setStudySubjectSheetOnlyPlanned = noop,
    setStudySubjectSheetOpen = noop,
    setStudyTimerRunning = noop,
    startLiveStudyTimer = noop,
    studyTimerSecondsRef,
    syncLiveStudyTimerUi = noop
  } = ctx;

  setActiveStudySubject(subject);
  setActivePlannerItemId(plannerItemId);
  setStudySubjectSheetOpen(false);
  setStudySubjectSheetOnlyPlanned(false);
  setStudyTimerRunning(true);
  setRefValue(studyTimerSecondsRef, 0);
  startLiveStudyTimer();
  syncLiveStudyTimerUi(0);
}

export function createPlannerHandlers(ctx) {
  const {
    afterSafariViewportStable = (fn) => fn?.(),
    centerPlannerDate = noop,
    goto,
    plannerContentRef,
    plannerCustomMinutesRef,
    plannerDraft = {},
    plannerEditIndex = null,
    plannerEditItem = null,
    plannerMonthDays = 31,
    preserveScrollAfterStateChange = (fn) => fn?.(),
    preserveY = (fn) => fn?.(),
    prompt = globalThis.prompt,
    requestAnimationFrame = globalThis.requestAnimationFrame || ((fn) => fn()),
    restoreIfUnexpectedTopJump = noop,
    selectedPlannerDate = '',
    setActivePlannerItemId = noop,
    setActiveStudySubject = noop,
    setExpandedBreakdownSubject = noop,
    setNotifModalOpen = noop,
    setPlannerCalendarOpen = noop,
    setPlannerCalendarMode = noop,
    setPlannerDraft = noop,
    setPlannerEditIndex = noop,
    setPlannerItems = noop,
    setSelectedDate = noop,
    setShowStudyBreakdown = noop,
    setStudyRecords = noop,
    setStudySubjectRecords = noop,
    setStudySubjectSheetOnlyPlanned = noop,
    setStudySubjectSheetOpen = noop,
    setStudyTimerRunning = noop,
    startLiveStudyTimer = noop,
    stopLiveStudyTimer = noop,
    studyTimerSecondsRef,
    syncLiveStudyTimerUi = noop,
    todayDate = FIXED_TODAY_DATE
  } = ctx;

  return {
    openPlannerAddPage() {
      goto?.('plannerAdd');
      return true;
    },

    openPlannerCalendar() {
      preserveY(() => setPlannerCalendarOpen(true));
      return true;
    },

    closePlannerCalendar() {
      afterSafariViewportStable(() => setPlannerCalendarOpen(false));
      return true;
    },

    plannerCalendarPrevWeek() {
      const current = Number(selectedPlannerDate) || Number(todayDate.split('-')[2]) || 1;
      preserveY(() => setSelectedDate(String(Math.max(1, current - 7))));
      return true;
    },

    plannerCalendarNextWeek() {
      const current = Number(selectedPlannerDate) || Number(todayDate.split('-')[2]) || 1;
      preserveY(() => setSelectedDate(String(Math.min(Number(plannerMonthDays) || 31, current + 7))));
      return true;
    },

    plannerCalendarToday() {
      preserveY(() => setSelectedDate(String(Number(todayDate.split('-')[2]) || 1)));
      return true;
    },

    setPlannerCalendarMode({ actionEl }) {
      const mode = getData(actionEl, 'planner-calendar-mode');
      if (!['week', 'month'].includes(mode)) return false;
      preserveY(() => setPlannerCalendarMode(mode));
      return true;
    },

    selectPlannerDate({ actionEl }) {
      const date = getData(actionEl, 'planner-date');
      if (!date) return false;
      const nextDate = String(date);
      setSelectedDate(nextDate);
      if (!actionEl?.closest?.('.planner-calendar-sheet')) {
        afterSafariViewportStable(() => setPlannerCalendarOpen(false));
      }
      requestAnimationFrame(() => centerPlannerDate(nextDate, 'smooth'));
      restoreIfUnexpectedTopJump();
      return true;
    },

    openPlannerEdit({ actionEl }) {
      setPlannerEditIndex(getData(actionEl, 'planner-id'));
      return true;
    },

    closePlannerEdit() {
      setPlannerEditIndex(null);
      return true;
    },

    setPlannerSubject({ actionEl }) {
      setPlannerDraft((prev) => ({ ...prev, subject: getData(actionEl, 'planner-subject') }));
      return true;
    },

    setPlannerDuration({ actionEl }) {
      setPlannerDraft((prev) => ({ ...prev, durationChoice: getData(actionEl, 'planner-duration') }));
      return true;
    },

    removePlannerItem({ actionEl }) {
      const plannerId = getData(actionEl, 'planner-id');
      if (!plannerId) return false;
      setPlannerItems((prev) => prev.filter((item) => item.id !== plannerId));
      return true;
    },

    togglePlannerDone({ actionEl }) {
      const plannerId = getData(actionEl, 'planner-id');
      if (!plannerId) return false;
      setPlannerItems((prev) => prev.map((item) => (item.id === plannerId ? { ...item, done: !item.done } : item)));
      return true;
    },

    addPlannerFromSheet() {
      const draft = typeof ctx.getPlannerDraft === 'function' ? ctx.getPlannerDraft() : plannerDraft;
      const content = String(getRefValue(plannerContentRef)).trim();
      const customMinutes = String(getRefValue(plannerCustomMinutesRef)).trim();
      const minutes = draft.durationChoice === 'custom' ? Number(customMinutes) : Number(draft.durationChoice);
      if (!draft.subject || !content || !minutes || Number.isNaN(minutes)) return false;
      setPlannerItems((prev) => [
        ...prev,
        {
          id: buildPlannerId(),
          date: selectedPlannerDate,
          subject: draft.subject,
          content,
          start: '--:--',
          end: '--:--',
          minutes,
          dot: dotForSubject(draft.subject)
        }
      ]);
      setRefValue(plannerContentRef, '');
      setRefValue(plannerCustomMinutesRef, '');
      setPlannerDraft({ subject: '', content: '', durationChoice: '', customMinutes: '' });
      goto?.('planner', false);
      return true;
    },

    savePlannerEdit() {
      if (plannerEditIndex === null) return false;
      const subject = getInputValue(ctx, '[data-field="plannerEditSubject"]').trim();
      const content = getInputValue(ctx, '[data-field="plannerEditContent"]').trim();
      const minutes = Number(getInputValue(ctx, '[data-field="plannerEditMinutes"]') || 0);
      if (!subject || !content || !minutes || !plannerEditItem) return false;
      setPlannerItems((prev) => prev.map((item) => (
        item.id === plannerEditIndex
          ? { ...item, subject, content, minutes, dot: dotForSubject(subject) }
          : item
      )));
      setPlannerEditIndex(null);
      return true;
    },

    openStudySubjectSheet() {
      preserveScrollAfterStateChange(() => {
        setNotifModalOpen(false);
        setStudySubjectSheetOnlyPlanned(true);
        setStudySubjectSheetOpen(true);
      });
      return true;
    },

    closeStudySubjectSheet({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('planner-sheet-overlay')) return false;
      preserveScrollAfterStateChange(() => {
        setStudySubjectSheetOnlyPlanned(false);
        setStudySubjectSheetOpen(false);
      });
      return true;
    },

    selectStudySubjectCustom() {
      const custom = prompt?.('과목명을 입력하세요', '기타');
      if (!custom) return false;
      startStudyTimer(ctx, custom, '');
      return true;
    },

    selectSelfStudy() {
      startStudyTimer(ctx, '기타', '');
      return true;
    },

    selectStudySubject({ actionEl }) {
      const subject = getData(actionEl, 'study-subject');
      const plannerItemId = getData(actionEl, 'study-item-id');
      if (!subject) return false;
      startStudyTimer(ctx, subject, plannerItemId);
      return true;
    },

    stopStudyTimer() {
      setStudyTimerRunning(false);
      stopLiveStudyTimer();
      const elapsed = Number(getRefValue(studyTimerSecondsRef, 0)) || 0;
      const activeSubject = typeof ctx.getActiveStudySubject === 'function' ? ctx.getActiveStudySubject() : ctx.activeStudySubject;
      const activePlannerItemId = typeof ctx.getActivePlannerItemId === 'function' ? ctx.getActivePlannerItemId() : ctx.activePlannerItemId;
      setStudyRecords((prev) => mutateStudyRecord(prev, todayDate, elapsed));
      if (activeSubject) {
        setStudySubjectRecords((prev) => mutateSubjectRecord(prev, todayDate, activeSubject, elapsed));
        if (activePlannerItemId) {
          setPlannerItems((prev) => prev.map((item) => (
            item.id === activePlannerItemId
              ? { ...item, doneMinutes: (item.doneMinutes || 0) + Math.round(elapsed / 60) }
              : item
          )));
        }
      }
      setRefValue(studyTimerSecondsRef, 0);
      syncLiveStudyTimerUi(0);
      setActiveStudySubject('');
      setActivePlannerItemId('');
      return true;
    },

    toggleStudyBreakdown({ event }) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      preserveScrollAfterStateChange(() => {
        setShowStudyBreakdown((prev) => !prev);
      });
      return true;
    },

    toggleBreakdownSubject({ actionEl, event }) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const subject = getData(actionEl, 'breakdown-subject');
      setExpandedBreakdownSubject((prev) => (prev === subject ? '' : subject));
      return true;
    }
  };
}

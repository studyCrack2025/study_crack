import { TODAY_DATE } from '../constants/runtime-defaults.js';
import { buildPlannerId } from '../state/planner-storage.js';
import { getData } from './action-utils.js';
import { dotForPlannerCategory, minutesBetween } from '../screens/planner/planner-options.js';

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

function getCheckedValue(ctx, name, fallback = '') {
  return query(ctx, `input[name="${name}"]:checked`)?.value || fallback;
}

const PLANNER_ADD_STEPS = ['time', 'subject', 'activity', 'content'];

function queryAll(ctx, selector) {
  return Array.from(getDocument(ctx)?.querySelectorAll?.(selector) || []);
}

function getPlannerAddRoot(ctx) {
  return query(ctx, '[data-planner-add-root]');
}

function getPlannerAddStepIndex(ctx) {
  const root = getPlannerAddRoot(ctx);
  const activeStep = root?.querySelector?.('[data-planner-add-step].active')?.getAttribute?.('data-planner-add-step') || PLANNER_ADD_STEPS[0];
  return Math.max(0, PLANNER_ADD_STEPS.indexOf(activeStep));
}

function setPlannerAddStep(ctx, nextIndex) {
  const clamped = Math.max(0, Math.min(PLANNER_ADD_STEPS.length - 1, Number(nextIndex) || 0));
  const activeKey = PLANNER_ADD_STEPS[clamped];
  queryAll(ctx, '[data-planner-add-step]').forEach((step) => {
    step.classList.toggle('active', step.getAttribute('data-planner-add-step') === activeKey);
  });
  queryAll(ctx, '[data-planner-step-dot]').forEach((dot, idx) => {
    dot.classList.toggle('active', idx === clamped);
    dot.classList.toggle('done', idx < clamped);
  });
  const prev = query(ctx, '[data-planner-step-prev]');
  const next = query(ctx, '[data-planner-step-next]');
  const submit = query(ctx, '[data-planner-step-submit]');
  if (prev) prev.disabled = clamped === 0;
  if (next) {
    next.hidden = clamped === PLANNER_ADD_STEPS.length - 1;
    next.disabled = !validatePlannerAddStep(ctx, activeKey);
  }
  if (submit) submit.hidden = clamped !== PLANNER_ADD_STEPS.length - 1;
}

function validatePlannerAddStep(ctx, stepKey, { focus = false } = {}) {
  if (stepKey === 'time') {
    const startInput = query(ctx, '[data-field="plannerStartTime"]');
    const endInput = query(ctx, '[data-field="plannerEndTime"]');
    const valid = Boolean(minutesBetween(startInput?.value || '', endInput?.value || ''));
    const error = query(ctx, '[data-planner-time-error]');
    if (error) error.classList.toggle('active', !valid);
    if (!valid && focus) (endInput || startInput)?.focus?.();
    return valid;
  }
  if (stepKey === 'subject') {
    const valid = Boolean(getCheckedValue(ctx, 'plannerCategory') && getCheckedValue(ctx, 'plannerDetailSubject'));
    if (!valid && focus) query(ctx, 'input[name="plannerCategory"]')?.focus?.();
    return valid;
  }
  if (stepKey === 'activity') {
    const valid = Boolean(getCheckedValue(ctx, 'plannerActivityType'));
    if (!valid && focus) query(ctx, 'input[name="plannerActivityType"]')?.focus?.();
    return valid;
  }
  if (stepKey === 'content') {
    const content = getInputValue(ctx, '[data-field="plannerContent"]').trim();
    if (!content && focus) query(ctx, '[data-field="plannerContent"]')?.focus?.();
    return Boolean(content);
  }
  return true;
}

function dotForSubject(subject = '') {
  const lowered = String(subject).toLowerCase();
  if (String(subject).includes('수') || lowered.includes('math')) return 'math';
  if (String(subject).includes('영') || lowered.includes('eng')) return 'eng';
  if (String(subject).includes('국') || lowered.includes('kor')) return 'kor';
  if (String(subject).includes('기타') || lowered.includes('etc')) return 'etc';
  return 'sci';
}

function getRefValue(ref, fallback = '') {
  return ref && typeof ref === 'object' ? ref.current ?? fallback : fallback;
}

function toPlannerDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePlannerDate(value = TODAY_DATE, fallback = TODAY_DATE) {
  const raw = String(value || '').trim();
  const fallbackDay = Number(String(fallback).split('-')[2]) || Number(String(TODAY_DATE).split('-')[2]) || 1;
  const source = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : `2026-07-${String(Math.max(1, Math.min(31, Number(raw) || fallbackDay))).padStart(2, '0')}`;
  const [year, month, day] = source.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addPlannerDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addPlannerMonths(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), maxDay));
}

export function createPlannerHandlers(ctx) {
  const {
    centerPlannerDate = noop,
    goto,
    plannerCalendarMode = 'week',
    plannerContentRef,
    plannerCustomMinutesRef,
    plannerDraft = {},
    plannerEditIndex = null,
    plannerEditItem = null,
    preserveScrollAfterStateChange = (fn) => fn?.(),
    preserveY = (fn) => fn?.(),
    requestAnimationFrame = globalThis.requestAnimationFrame || ((fn) => fn()),
    restoreIfUnexpectedTopJump = noop,
    selectedPlannerDate = '',
    selectedPlannerDateKey = '',
    setExpandedBreakdownSubject,
    setPlannerCalendarMode,
    setPlannerDraft,
    setPlannerEditIndex,
    setPlannerItems,
    setSelectedDate,
    setShowStudyBreakdown,
    todayDate = TODAY_DATE
  } = ctx;

  return {
    openPlannerAddPage() {
      goto?.('plannerAdd');
      return true;
    },

    plannerAddNextStep() {
      const currentIndex = getPlannerAddStepIndex(ctx);
      const currentStep = PLANNER_ADD_STEPS[currentIndex];
      if (!validatePlannerAddStep(ctx, currentStep, { focus: true })) return true;
      setPlannerAddStep(ctx, currentIndex + 1);
      return true;
    },

    plannerAddPrevStep() {
      setPlannerAddStep(ctx, getPlannerAddStepIndex(ctx) - 1);
      return true;
    },

    plannerCalendarPrevWeek() {
      const current = parsePlannerDate(selectedPlannerDateKey || selectedPlannerDate, todayDate);
      const next = plannerCalendarMode === 'month' ? addPlannerMonths(current, -1) : addPlannerDays(current, -7);
      preserveY(() => setSelectedDate(toPlannerDateKey(next)));
      return true;
    },

    plannerCalendarNextWeek() {
      const current = parsePlannerDate(selectedPlannerDateKey || selectedPlannerDate, todayDate);
      const next = plannerCalendarMode === 'month' ? addPlannerMonths(current, 1) : addPlannerDays(current, 7);
      preserveY(() => setSelectedDate(toPlannerDateKey(next)));
      return true;
    },

    plannerCalendarToday() {
      preserveY(() => setSelectedDate(todayDate));
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
      const start = getInputValue(ctx, '[data-field="plannerStartTime"]').trim();
      const end = getInputValue(ctx, '[data-field="plannerEndTime"]').trim();
      const category = getCheckedValue(ctx, 'plannerCategory', draft.subject || '기타');
      const detailSubject = getCheckedValue(ctx, 'plannerDetailSubject', '');
      const activityType = getCheckedValue(ctx, 'plannerActivityType', '');
      const memo = getInputValue(ctx, '[data-field="plannerMemo"]').trim();
      const content = String(getInputValue(ctx, '[data-field="plannerContent"]') || getRefValue(plannerContentRef)).trim();
      const customMinutes = String(getRefValue(plannerCustomMinutesRef)).trim();
      const minutesFromRange = minutesBetween(start, end);
      const minutes = minutesFromRange || (draft.durationChoice === 'custom' ? Number(customMinutes) : Number(draft.durationChoice));
      if (!category || !content || !minutes || Number.isNaN(minutes)) return false;
      if (start && end && !minutesFromRange) return false;
      setPlannerItems((prev) => [
        ...prev,
        {
          id: buildPlannerId(),
          date: selectedPlannerDateKey || selectedPlannerDate,
          subject: category,
          category,
          detailSubject,
          activityType,
          content,
          memo,
          start: start || '--:--',
          end: end || '--:--',
          minutes,
          dot: dotForPlannerCategory(category) || dotForSubject(category)
        }
      ]);
      setRefValue(plannerContentRef, '');
      setRefValue(plannerCustomMinutesRef, '');
      setPlannerDraft({ subject: '', content: '', durationChoice: '', customMinutes: '', start: '', end: '', detailSubject: '', activityType: '', memo: '' });
      goto?.('planner', false);
      return true;
    },

    savePlannerEdit() {
      if (plannerEditIndex === null) return false;
      const subject = getInputValue(ctx, '[data-field="plannerEditSubject"]').trim();
      const detailSubject = getInputValue(ctx, '[data-field="plannerEditDetailSubject"]').trim();
      const activityType = getInputValue(ctx, '[data-field="plannerEditActivityType"]').trim();
      const content = getInputValue(ctx, '[data-field="plannerEditContent"]').trim();
      const memo = getInputValue(ctx, '[data-field="plannerEditMemo"]').trim();
      const start = getInputValue(ctx, '[data-field="plannerEditStart"]').trim();
      const end = getInputValue(ctx, '[data-field="plannerEditEnd"]').trim();
      const rangeMinutes = minutesBetween(start, end);
      const minutes = rangeMinutes || Number(plannerEditItem.minutes || 0);
      if (!subject || !content || !minutes || !plannerEditItem) return false;
      if (start && end && !rangeMinutes) return false;
      setPlannerItems((prev) => prev.map((item) => (
        item.id === plannerEditIndex
          ? {
              ...item,
              subject,
              category: subject,
              detailSubject,
              activityType,
              content,
              memo,
              start: start || item.start || '--:--',
              end: end || item.end || '--:--',
              minutes,
              dot: dotForPlannerCategory(subject) || dotForSubject(subject)
            }
          : item
      )));
      setPlannerEditIndex(null);
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

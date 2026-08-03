import { sanitizeEmailInputElement } from '../utils/email-input.js';

function noop() {}

const SCORE_KEY_MAX = {
  korean_common: 76,
  korean_elective: 24,
  math_common: 74,
  math_elective: 26,
  inquiry1_raw: 50,
  inquiry2_raw: 50,
  english_grade: 9
};

const SCORE_FIELD_MAX = {
  'korean-common': 76,
  'korean-elective': 24,
  'math-common': 74,
  'math-elective': 26,
  'inq1-score': 50,
  'inq2-score': 50
};

const V2E_SELECT_FIELDS = new Set([
  'v2e-english',
  'v2e-history',
  'v2e-inq1-subject',
  'v2e-inq2-subject'
]);

const OB2_SCORE_SELECT_FIELDS = new Set([
  'obExamType',
  'obKoreanType',
  'obMathType',
  'obHistoryType',
  'obInquiry1Subject',
  'obInquiry2Subject'
]);

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function query(ctx, selector) {
  return getDocument(ctx)?.querySelector?.(selector) || null;
}

function queryAll(ctx, selector) {
  return Array.from(getDocument(ctx)?.querySelectorAll?.(selector) || []);
}

function timeToMinutes(value = '') {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutes(minutes = 0) {
  const safe = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safe / 60);
  const min = safe % 60;
  if (hour && min) return `${hour}시간 ${min}분`;
  if (hour) return `${hour}시간`;
  return `${min}분`;
}

const PLANNER_ADD_STEPS = ['time', 'subject', 'activity', 'content'];

function getPlannerAddStep(ctx) {
  return query(ctx, '[data-planner-add-step].active')?.getAttribute?.('data-planner-add-step') || PLANNER_ADD_STEPS[0];
}

function isPlannerStepValid(ctx, stepKey = getPlannerAddStep(ctx)) {
  if (stepKey === 'time') {
    const start = query(ctx, '[data-field="plannerStartTime"]')?.value || '';
    const end = query(ctx, '[data-field="plannerEndTime"]')?.value || '';
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    return Boolean(startMinutes !== null && endMinutes !== null && endMinutes > startMinutes);
  }
  if (stepKey === 'subject') {
    return Boolean(query(ctx, 'input[name="plannerCategory"]:checked')?.value && query(ctx, 'input[name="plannerDetailSubject"]:checked')?.value);
  }
  if (stepKey === 'activity') return Boolean(query(ctx, 'input[name="plannerActivityType"]:checked')?.value);
  if (stepKey === 'content') return Boolean(String(query(ctx, '[data-field="plannerContent"]')?.value || '').trim());
  return true;
}

function syncPlannerAddForm(ctx) {
  const start = query(ctx, '[data-field="plannerStartTime"]')?.value || '';
  const end = query(ctx, '[data-field="plannerEndTime"]')?.value || '';
  const content = String(query(ctx, '[data-field="plannerContent"]')?.value || '').trim();
  const category = query(ctx, 'input[name="plannerCategory"]:checked')?.value || '';
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const minutes = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes ? endMinutes - startMinutes : 0;
  const preview = query(ctx, '[data-planner-duration-preview]');
  const error = query(ctx, '[data-planner-time-error]');
  const submit = query(ctx, '.planner-sheet-submit');
  const next = query(ctx, '[data-planner-step-next]');
  if (preview) preview.textContent = minutes ? formatMinutes(minutes) : '시간 확인';
  if (error) error.classList.toggle('active', Boolean(start && end && !minutes));
  const canSubmit = Boolean(category && content && minutes);
  if (submit) {
    submit.disabled = !canSubmit;
    submit.classList?.toggle?.('disabled', !canSubmit);
  }
  if (next) next.disabled = !isPlannerStepValid(ctx);
  return canSubmit;
}

function syncPlannerDetailGroup(ctx, category) {
  queryAll(ctx, '[data-planner-detail-group]').forEach((group) => {
    const active = group.getAttribute('data-planner-detail-group') === category;
    group.classList.toggle('active', active);
    const firstRadio = group.querySelector('input[name="plannerDetailSubject"]');
    if (active && firstRadio && !group.querySelector('input[name="plannerDetailSubject"]:checked')) {
      firstRadio.checked = true;
    }
  });
}

function normalizeNumberInput(target, max, alert) {
  const raw = String(target.value || '');
  if (raw && !/^\d+$/.test(raw)) {
    alert('성적을 정확히 입력해주세요');
    target.value = '';
    return false;
  }
  const n = Number(raw || 0);
  if (max && n > max) {
    alert('성적을 정확히 입력해주세요');
    target.value = String(max);
  }
  return true;
}

function readCoachRow(ctx, rowId, row) {
  return {
    ...row,
    detail: query(ctx, `[data-coach-detail="${rowId}"]`)?.value || row.detail,
    planned: query(ctx, `[data-coach-plan="${rowId}"]`)?.value || row.planned,
    actual: query(ctx, `[data-coach-actual="${rowId}"]`)?.value || row.actual
  };
}

function updateV2eSelectState(setScoreEditState, field, value) {
  setScoreEditState((prev) => {
    if (field === 'v2e-english') return { ...prev, english: value };
    if (field === 'v2e-history') return { ...prev, history: value };
    if (field === 'v2e-inq1-subject') return { ...prev, inquiry1: { ...prev.inquiry1, subject: value } };
    if (field === 'v2e-inq2-subject') return { ...prev, inquiry2: { ...prev.inquiry2, subject: value } };
    return prev;
  });
}

function updateScoreStateFromField({ alert, field, setScoreState, target, value }) {
  const [, subject, key] = field.split('-');
  const normalizedValue = value;
  const max = SCORE_FIELD_MAX[`${subject}-${key}`];
  if (max && Number(value) > max) {
    target.setAttribute?.('aria-invalid', 'true');
    alert(`${max}점 이하의 점수를 입력해주세요.`);
  } else {
    target.removeAttribute?.('aria-invalid');
  }
  if (subject === 'english' || subject === 'history') {
    setScoreState((prev) => ({ ...prev, [subject]: normalizedValue }));
  }
  if (subject === 'korean' || subject === 'math') {
    const normalizedKey = key === 'type' ? 'type' : key === 'common' ? 'common' : 'elective';
    setScoreState((prev) => ({ ...prev, [subject]: { ...prev[subject], [normalizedKey]: normalizedValue } }));
  }
  if (subject === 'inq1' || subject === 'inq2') {
    const stateKey = subject === 'inq1' ? 'inquiry1' : 'inquiry2';
    setScoreState((prev) => ({
      ...prev,
      [stateKey]: { ...prev[stateKey], [key === 'subject' ? 'subject' : 'score']: normalizedValue }
    }));
  }
}

function syncV2eSelectsFromDom(ctx, setScoreEditState) {
  const english = query(ctx, '[data-field="v2e-english"]')?.value;
  const history = query(ctx, '[data-field="v2e-history"]')?.value;
  const inq1 = query(ctx, '[data-field="v2e-inq1-subject"]')?.value;
  const inq2 = query(ctx, '[data-field="v2e-inq2-subject"]')?.value;
  setScoreEditState((prev) => ({
    ...prev,
    english: english ?? prev.english,
    history: history ?? prev.history,
    inquiry1: { ...prev.inquiry1, subject: inq1 ?? prev.inquiry1.subject },
    inquiry2: { ...prev.inquiry2, subject: inq2 ?? prev.inquiry2.subject }
  }));
}

function setPendingOrState({ field, isPending, setter, target, value }) {
  if (isPending) target.dataset.pendingValue = value;
  else setter(value);
  return field;
}

export function createFormHandlers(ctx) {
  const {
    alert = globalThis.alert || noop,
    applyObExamSelection = noop,
    applyScoreExamSelection = noop,
    clearTimeout = globalThis.clearTimeout || noop,
    goto,
    markStableScrollPosition = noop,
    preserveScrollAfterStateChange = (fn) => fn?.(),
    preserveY = (fn) => fn?.(),
    restoreIfUnexpectedTopJump = noop,
    setAnalysisSearchTerm = noop,
    setCoachingAnswers = noop,
    setCoachingExamFiles = noop,
    setCoachingExamScores = noop,
    setCoachingMonth = noop,
    setCoachingPlannerFiles = noop,
    setCoachingSubjectRows = noop,
    setMyProfileNameDraft = noop,
    setObGoalText = noop,
    setObGradeStatus = noop,
    setObQuestionText = noop,
    setObSchoolName = noop,
    setObTrack = noop,
    setProEliteMonth = noop,
    setProRequestText = noop,
    setQnaDraftContent = noop,
    setQnaDraftTitle = noop,
    setScoreEditState = noop,
    setScores = noop,
    setScoreState = noop,
    setStudyDifficulty = noop,
    setStudyHours = noop,
    setStrongSubject = noop,
    setTargetMajor = noop,
    setTimeout = globalThis.setTimeout || ((fn) => fn()),
    setWeakSubject = noop,
    setMyProfilePhoneCodeDraft = noop,
    setMyProfilePhoneDraft = noop,
    setWithdrawPassword = noop
  } = ctx;

  function handleInput(event) {
    const target = event?.target;
    if (!target?.getAttribute) return { handled: false };
    if (target.hasAttribute('data-email-input')) {
      sanitizeEmailInputElement(target);
    }
    const scoreKey = target.getAttribute('data-score-key');
    if (scoreKey) {
      normalizeNumberInput(target, SCORE_KEY_MAX[scoreKey], alert);
      return { handled: true, field: scoreKey };
    }

    const field = target.getAttribute('data-field');
    if (['v2e-english', 'v2e-history'].includes(field) && target.classList?.contains('score-grade-input')) {
      const grade = String(target.value || '').replace(/[^1-9]+/g, '').slice(0, 1);
      if (target.value !== grade) target.value = grade;
      target.setAttribute('aria-invalid', grade ? 'false' : 'true');
      return { handled: true, field };
    }
    if (field?.startsWith('v2e-') && target.classList?.contains('score-direct-input')) {
      const numeric = String(target.value || '').replace(/\D+/g, '').slice(0, 3);
      if (target.value !== numeric) target.value = numeric;
      const max = Number(target.getAttribute('data-score-max') || 0);
      target.setAttribute('aria-invalid', max && Number(numeric) > max ? 'true' : 'false');
      return { handled: true, field };
    }
    if (field === 'coachPlannerFiles') {
      const files = Array.from(target.files || []);
      if (files.length) setCoachingPlannerFiles((prev) => [...prev, ...files].slice(0, 5));
      target.value = '';
      return { handled: true, field };
    }
    if (field === 'coachExamFiles') {
      const files = Array.from(target.files || []);
      if (files.length) setCoachingExamFiles((prev) => [...prev, ...files]);
      target.value = '';
      return { handled: true, field };
    }
    if (field === 'coachingMonth') setCoachingMonth(target.value);
    if (field === 'proEliteMonth') setProEliteMonth(target.value);
    if (field === 'qnaDraftTitle' || field === 'qnaDraftContent') {
      const key = field === 'qnaDraftTitle' ? 'title' : 'content';
      if (ctx.qnaDraftRef?.current) ctx.qnaDraftRef.current[key] = target.value;
      return { handled: true, field };
    }
    if (field === 'analysisSearchTerm') {
      setAnalysisSearchTerm(target.value);
    }
    if (field === 'myProfileNameDraft') setMyProfileNameDraft(target.value);
    if (field === 'myProfilePhoneDraft') {
      const numeric = String(target.value || '').replace(/\D+/g, '').slice(0, 11);
      if (target.value !== numeric) target.value = numeric;
      setMyProfilePhoneDraft(numeric);
    }
    if (field === 'myProfilePhoneCodeDraft') {
      const numeric = String(target.value || '').replace(/\D+/g, '').slice(0, 6);
      if (target.value !== numeric) target.value = numeric;
      setMyProfilePhoneCodeDraft(numeric);
    }
    if (field === 'marketingAgreed') {
      const checked = target.checked === true;
      ctx.setUser?.((prev) => ({ ...(prev || {}), marketingAgreed: checked }));
      ctx.actionHandlers?.saveMarketingConsent?.({ isAgreed: checked });
    }
    if (field === 'obTrack') {
      setPendingOrState({
        field,
        isPending: ctx.isIOSSafari?.() && ctx.isObSurveyScreen?.(),
        setter: setObTrack,
        target,
        value: target.value
      });
    }
    if (field === 'scoreExamType') applyScoreExamSelection(target.value);
    if (field === 'obExamType') applyObExamSelection(target.value);
    const coachAnswer = target.getAttribute('data-coach-answer');
    const coachPlan = target.getAttribute('data-coach-plan');
    const coachActual = target.getAttribute('data-coach-actual');
    if (!coachAnswer && !coachPlan && !coachActual) restoreIfUnexpectedTopJump();
    if (coachAnswer) {
      const countEl = query(ctx, `[data-coach-count="${coachAnswer}"]`);
      if (countEl) countEl.textContent = `${target.value.length}/200`;
    }
    if (coachPlan || coachActual) {
      const rowId = coachPlan || coachActual;
      const plan = Number(query(ctx, `[data-coach-plan="${rowId}"]`)?.value || 0);
      const actual = Number(query(ctx, `[data-coach-actual="${rowId}"]`)?.value || 0);
      const rate = plan > 0 ? Math.round((actual / plan) * 100) : 0;
      const rateEl = query(ctx, `[data-coach-rate="${rowId}"]`);
      if (rateEl) rateEl.textContent = `달성률 ${Number.isFinite(rate) ? rate : 0}%`;
    }
    if (!field) return { handled: Boolean(coachAnswer || coachPlan || coachActual) };
    if (field === 'plannerContent' && ctx.plannerContentRef) {
      ctx.plannerContentRef.current = target.value;
      syncPlannerAddForm(ctx);
      return { handled: true, field };
    }
    if (field === 'plannerStartTime' || field === 'plannerEndTime' || field === 'plannerMemo') {
      syncPlannerAddForm(ctx);
      return { handled: true, field };
    }
    if (field === 'plannerCustomMinutes' && ctx.plannerCustomMinutesRef) {
      ctx.plannerCustomMinutesRef.current = target.value;
      const draft = ctx.plannerDraft || {};
      const content = String(ctx.plannerContentRef?.current || '').trim();
      const submit = query(ctx, '.planner-sheet-submit');
      const canSubmit = Boolean(draft.subject && content && Number(target.value) > 0);
      if (submit) {
        submit.disabled = !canSubmit;
        submit.classList?.toggle?.('disabled', !canSubmit);
      }
      return { handled: true, field };
    }
    if (field === 'findEmailPhone') {
      const numeric = String(target.value || '').replace(/\D+/g, '');
      if (target.value !== numeric) target.value = numeric;
      return { handled: true, field };
    }
    return { handled: true, field };
  }

  function handleChange(event) {
    const target = event?.target;
    if (!target?.getAttribute) return { handled: false };
    markStableScrollPosition();
    const field = target.getAttribute('data-field');
    if (target.name === 'plannerCategory') {
      syncPlannerDetailGroup(ctx, target.value);
      syncPlannerAddForm(ctx);
      return { handled: true, field: 'plannerCategory' };
    }
    if (target.name === 'plannerDetailSubject' || target.name === 'plannerActivityType') {
      syncPlannerAddForm(ctx);
      return { handled: true, field: target.name };
    }
    const isOb2ScoreField = OB2_SCORE_SELECT_FIELDS.has(field) || target.getAttribute('data-score-key') === 'english_grade';
    if (ctx.isIOSSafari?.() && ctx.screen === 'ob2' && isOb2ScoreField) {
      if (ctx.ob2SelectSyncTimerRef?.current) clearTimeout(ctx.ob2SelectSyncTimerRef.current);
      if (ctx.ob2SelectSyncTimerRef) {
        ctx.ob2SelectSyncTimerRef.current = setTimeout(() => {
          const examType = String(query(ctx, '[data-field="obExamType"]')?.value || '').trim();
          if (examType) applyObExamSelection(examType);
        }, 300);
      }
      return { handled: true, field };
    }
    if (field === 'analysisSearchTerm') return { handled: true, field };
    if (ctx.isIOSSafari?.() && ctx.scoreEditOpen && V2E_SELECT_FIELDS.has(field)) {
      if (ctx.v2eSelectSyncTimerRef?.current) clearTimeout(ctx.v2eSelectSyncTimerRef.current);
      if (ctx.v2eSelectSyncTimerRef) {
        ctx.v2eSelectSyncTimerRef.current = setTimeout(() => syncV2eSelectsFromDom(ctx, setScoreEditState), 300);
      }
      return { handled: true, field };
    }
    if (field === 'coachPlannerFiles' || field === 'coachExamFiles') return handleInput(event);
    if (field === 'scoreExamType') preserveY(() => applyScoreExamSelection(target.value));
    if (field === 'obTrack') {
      if (ctx.isIOSSafari?.() && ctx.isObSurveyScreen?.()) target.dataset.pendingValue = target.value;
      else preserveY(() => setObTrack(target.value));
    }
    if (field === 'obExamType') preserveY(() => applyObExamSelection(target.value));
    if (field === 'analysisTargetMajor' || field === 'targetMajor') {
      if (target.value === '__add_university__') {
        goto?.('addUniversity');
        return { handled: true, field };
      }
      preserveScrollAfterStateChange(() => {
        if (target.value) setTargetMajor(target.value);
      });
      return { handled: true, field };
    }
    if (V2E_SELECT_FIELDS.has(field)) {
      preserveScrollAfterStateChange(() => updateV2eSelectState(setScoreEditState, field, target.value));
      return { handled: true, field };
    }
    restoreIfUnexpectedTopJump();
    return { handled: Boolean(field), field };
  }

  function handleBlur(event) {
    const target = event?.target;
    if (!target?.getAttribute) return { handled: false };
    markStableScrollPosition();
    const field = target.getAttribute('data-field');
    const coachAnswer = target.getAttribute('data-coach-answer');
    if (coachAnswer) {
      setCoachingAnswers((prev) => ({ ...prev, [coachAnswer]: target.value.slice(0, 200) }));
    }
    const coachDetail = target.getAttribute('data-coach-detail');
    const coachPlan = target.getAttribute('data-coach-plan');
    const coachActual = target.getAttribute('data-coach-actual');
    const dirtyId = coachDetail || coachPlan || coachActual;
    if (dirtyId && ctx.coachingDirtyRowsRef?.current) ctx.coachingDirtyRowsRef.current[dirtyId] = true;
    const coachField = target.getAttribute('data-coach-field');
    if (coachField) {
      if (ctx.isIOSSafari?.() && ctx.screen === 'strategy') target.dataset.pendingValue = target.value;
      else setCoachingExamScores((prev) => ({ ...prev, [coachField]: target.value }));
    }
    if (dirtyId) {
      setCoachingSubjectRows((prev) => prev.map((row) => (row.id === dirtyId ? readCoachRow(ctx, dirtyId, row) : row)));
    }
    if (!field) return { handled: Boolean(coachAnswer || dirtyId || coachField) };
    const value = target.value;
    if (field.startsWith('score-')) {
      const subject = field.replace('score-', '');
      setScores((prev) => ({ ...prev, [subject]: Number(value) || 0 }));
    }
    if (field === 'strongSubject') setStrongSubject(value);
    if (field === 'weakSubject') setWeakSubject(value);
    if (field === 'studyHours') setStudyHours(value);
    if (field === 'studyDifficulty') setStudyDifficulty(value);
    if (field === 'proRequestText') setProRequestText(value);
    if (field === 'myProfilePhoneDraft') setMyProfilePhoneDraft(value);
    if (field === 'myProfilePhoneCodeDraft') setMyProfilePhoneCodeDraft(value);
    if (field === 'withdrawPassword') setWithdrawPassword(value);
    if (field === 'analysisSearchTerm') setAnalysisSearchTerm(value);
    if (field === 'analysisTargetMajor') {
      if (value === '__add_university__') {
        goto?.('addUniversity');
        return { handled: true, field };
      }
      if (value) setTargetMajor(value);
    }
    const isPending = ctx.isIOSSafari?.() && ctx.isObSurveyScreen?.();
    if (field === 'obSchoolName') setPendingOrState({ field, isPending, setter: setObSchoolName, target, value });
    if (field === 'obGradeStatus') setPendingOrState({ field, isPending, setter: setObGradeStatus, target, value });
    if (field === 'obTrack') setPendingOrState({ field, isPending, setter: setObTrack, target, value });
    if (field === 'obGoalText') setPendingOrState({ field, isPending, setter: setObGoalText, target, value });
    if (field === 'obQuestionText') setPendingOrState({ field, isPending, setter: setObQuestionText, target, value });
    if (V2E_SELECT_FIELDS.has(field)) {
      preserveScrollAfterStateChange(() => updateV2eSelectState(setScoreEditState, field, value));
      return { handled: true, field };
    }
    if (target.tagName === 'SELECT') return { handled: true, field };
    if (field?.startsWith('v2-')) {
      updateScoreStateFromField({ alert, field, setScoreState, target, value });
    }
    if (field?.startsWith('v2e-')) {
      updateScoreStateFromField({ alert, field, setScoreState: setScoreEditState, target, value });
    }
    restoreIfUnexpectedTopJump();
    return { handled: true, field };
  }

  return { handleInput, handleChange, handleBlur };
}

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
  let normalizedValue = value;
  const max = SCORE_FIELD_MAX[`${subject}-${key}`];
  if (max && Number(value) > max) {
    alert('성적을 정확히 입력해주세요');
    normalizedValue = String(max);
    target.value = normalizedValue;
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
    preserveSignupScroll = (fn) => fn?.(),
    preserveY = (fn) => fn?.(),
    renderUniversityResultsOnly = noop,
    restoreIfUnexpectedTopJump = noop,
    setAnalysisSearchTerm = noop,
    setCoachingAnswers = noop,
    setCoachingExamFiles = noop,
    setCoachingExamScores = noop,
    setCoachingMonth = noop,
    setCoachingPlannerFiles = noop,
    setCoachingSubjectRows = noop,
    setLoginEmail = noop,
    setLoginPassword = noop,
    setMyProfileNameDraft = noop,
    setMyProfileTargetDraft = noop,
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
    setWithdrawPassword = noop,
    updateSignupButtonState = noop,
    updateSignupPasswordMatchUi = noop
  } = ctx;

  function handleInput(event) {
    const target = event?.target;
    if (!target?.getAttribute) return { handled: false };
    const scoreKey = target.getAttribute('data-score-key');
    if (scoreKey) {
      normalizeNumberInput(target, SCORE_KEY_MAX[scoreKey], alert);
      return { handled: true, field: scoreKey };
    }

    const field = target.getAttribute('data-field');
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
    if (field === 'qnaDraftTitle') setQnaDraftTitle(target.value);
    if (field === 'qnaDraftContent') setQnaDraftContent(target.value);
    if (field === 'analysisSearchTerm') {
      if (ctx.analysisSearchLiveTermRef) ctx.analysisSearchLiveTermRef.current = target.value;
      setAnalysisSearchTerm(target.value);
      renderUniversityResultsOnly(target.value, target);
    }
    if (field === 'myProfileNameDraft') setMyProfileNameDraft(target.value);
    if (field === 'myProfileTargetDraft') setMyProfileTargetDraft(target.value);
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
    restoreIfUnexpectedTopJump();

    const coachAnswer = target.getAttribute('data-coach-answer');
    const coachPlan = target.getAttribute('data-coach-plan');
    const coachActual = target.getAttribute('data-coach-actual');
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
      return { handled: true, field };
    }
    if (field === 'plannerCustomMinutes' && ctx.plannerCustomMinutesRef) {
      ctx.plannerCustomMinutesRef.current = target.value;
      return { handled: true, field };
    }
    if (field === 'findEmailPhone') {
      const numeric = String(target.value || '').replace(/\D+/g, '');
      if (target.value !== numeric) target.value = numeric;
      return { handled: true, field };
    }
    if (field === 'signupPassword' || field === 'signupPasswordConfirm') {
      updateSignupPasswordMatchUi();
      updateSignupButtonState();
      if (field === 'signupPassword' && event.inputType === 'insertLineBreak') {
        query(ctx, '[data-field="signupPasswordConfirm"]')?.focus?.();
      }
      return { handled: true, field };
    }
    if (field === 'signupEmailCode' || field === 'signupPhoneCode') {
      const numeric = String(target.value || '').replace(/\D+/g, '').slice(0, 6);
      if (target.value !== numeric) target.value = numeric;
      if (numeric.length === 6) {
        target.closest?.('.verify-row')?.querySelector?.('[data-action^="confirmSignup"]')?.classList?.add?.('active');
      }
      updateSignupButtonState();
      return { handled: true, field };
    }
    if (field === 'signupEmail' && event.inputType === 'insertLineBreak') {
      preserveSignupScroll(() => query(ctx, '[data-field="signupPassword"]')?.focus?.());
      return { handled: true, field };
    }
    if (field === 'signupName' && event.inputType === 'insertLineBreak') {
      preserveSignupScroll(() => query(ctx, '[data-field="signupPhone"]')?.focus?.());
      return { handled: true, field };
    }
    return { handled: true, field };
  }

  function handleChange(event) {
    const target = event?.target;
    if (!target?.getAttribute) return { handled: false };
    markStableScrollPosition();
    const field = target.getAttribute('data-field');
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
    if (field === 'myProfileTargetDraft') {
      setMyProfileTargetDraft(target.value);
      return { handled: true, field };
    }
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
    if (field?.startsWith('signup')) updateSignupButtonState();
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
    if (field === 'loginEmail') setLoginEmail(value);
    if (field === 'loginPassword') setLoginPassword(value);
    if (field === 'withdrawPassword') setWithdrawPassword(value);
    if (field?.startsWith('signup')) {
      updateSignupPasswordMatchUi();
      updateSignupButtonState();
      return { handled: true, field };
    }
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

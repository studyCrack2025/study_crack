import { DEFAULT_USER } from '../constants/mock-data.js';
import { getData } from './action-utils.js';

const MBTI_STRATEGY_VALUES = ['plan', 'solo', 'weak_first', 'feedback'];
const KAKAO_SUPPORT_URL = 'http://pf.kakao.com/_wxjxcgn';
const SUPPORT_EMAIL = 'contact@studycrack.co.kr';

function noop() {}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function query(ctx, selector) {
  return getDocument(ctx)?.querySelector?.(selector) || null;
}

function getInputValue(ctx, name, fallback = '') {
  return query(ctx, `[data-field="${name}"]`)?.value ?? fallback;
}

function getWindow(ctx) {
  return ctx.window || globalThis.window || {};
}

function isInvalidRequiredSelectValue(value) {
  const trimmed = String(value ?? '').trim();
  return !trimmed || ['선택', '과목 선택', '선택하세요', '미선택'].includes(trimmed);
}

function shouldReadOb1FromDom(ctx) {
  return Boolean(ctx.isIOSSafari?.() && ctx.isObSurveyScreen?.());
}

function readQualValues(ctx) {
  if (shouldReadOb1FromDom(ctx) && typeof ctx.readOb1FormValuesFromDom === 'function') {
    return ctx.readOb1FormValuesFromDom();
  }
  return {
    obSchoolName: ctx.obSchoolName,
    obGradeStatus: ctx.obGradeStatus,
    obTrack: ctx.obTrack,
    obGoalText: ctx.obGoalText,
    obQuestionText: ctx.obQuestionText
  };
}

function buildQualitative(values = {}) {
  return {
    status: values.obGradeStatus || '',
    school: values.obSchoolName || '',
    stream: values.obTrack || '',
    benefits: values.obGoalText || '',
    questions: values.obQuestionText || ''
  };
}

function isQualInfoMissing(values = {}) {
  return !String(values.obGradeStatus || '').trim()
    || !String(values.obSchoolName || '').trim()
    || !String(values.obTrack || '').trim()
    || !String(values.obGoalText || '').trim();
}

function readScoreEditValues(ctx) {
  const state = ctx.scoreEditState || {};
  return {
    koreanType: getInputValue(ctx, 'v2e-korean-type', state.korean?.type || ''),
    koreanCommon: getInputValue(ctx, 'v2e-korean-common', state.korean?.common || ''),
    koreanElective: getInputValue(ctx, 'v2e-korean-elective', state.korean?.elective || ''),
    mathType: getInputValue(ctx, 'v2e-math-type', state.math?.type || ''),
    mathCommon: getInputValue(ctx, 'v2e-math-common', state.math?.common || ''),
    mathElective: getInputValue(ctx, 'v2e-math-elective', state.math?.elective || ''),
    english: getInputValue(ctx, 'v2e-english', state.english || ''),
    history: getInputValue(ctx, 'v2e-history', state.history || ''),
    inquiry1Subject: getInputValue(ctx, 'v2e-inq1-subject', state.inquiry1?.subject || ''),
    inquiry2Subject: getInputValue(ctx, 'v2e-inq2-subject', state.inquiry2?.subject || ''),
    inquiry1Score: getInputValue(ctx, 'v2e-inq1-score', state.inquiry1?.score || ''),
    inquiry2Score: getInputValue(ctx, 'v2e-inq2-score', state.inquiry2?.score || '')
  };
}

function updateScoreEditState(ctx, values) {
  ctx.setScoreEditState?.((prev = {}) => ({
    ...prev,
    korean: { ...(prev.korean || {}), type: values.koreanType, common: values.koreanCommon, elective: values.koreanElective },
    math: { ...(prev.math || {}), type: values.mathType, common: values.mathCommon, elective: values.mathElective },
    english: values.english,
    history: values.history,
    inquiry1: { ...(prev.inquiry1 || {}), subject: values.inquiry1Subject, score: values.inquiry1Score },
    inquiry2: { ...(prev.inquiry2 || {}), subject: values.inquiry2Subject, score: values.inquiry2Score }
  }));
}

function patchCurrentScoreStep(ctx) {
  const step = Number(ctx.scoreEditStep || 1);
  const state = ctx.scoreEditState || {};
  const values = readScoreEditValues(ctx);
  if (step === 1) {
    ctx.setScoreEditState?.((prev = {}) => ({
      ...prev,
      korean: { ...(prev.korean || {}), type: values.koreanType, common: values.koreanCommon, elective: values.koreanElective }
    }));
    return { ...state, korean: { ...(state.korean || {}), type: values.koreanType, common: values.koreanCommon, elective: values.koreanElective } };
  }
  if (step === 2) {
    ctx.setScoreEditState?.((prev = {}) => ({
      ...prev,
      math: { ...(prev.math || {}), type: values.mathType, common: values.mathCommon, elective: values.mathElective }
    }));
    return { ...state, math: { ...(state.math || {}), type: values.mathType, common: values.mathCommon, elective: values.mathElective } };
  }
  if (step === 3) {
    ctx.setScoreEditState?.((prev = {}) => ({ ...prev, english: values.english }));
    return { ...state, english: values.english };
  }
  if (step === 5) {
    ctx.setScoreEditState?.((prev = {}) => ({
      ...prev,
      inquiry1: { ...(prev.inquiry1 || {}), score: values.inquiry1Score }
    }));
    return { ...state, inquiry1: { ...(state.inquiry1 || {}), score: values.inquiry1Score } };
  }
  if (step === 6) {
    ctx.setScoreEditState?.((prev = {}) => ({
      ...prev,
      inquiry2: { ...(prev.inquiry2 || {}), score: values.inquiry2Score }
    }));
    return { ...state, inquiry2: { ...(state.inquiry2 || {}), score: values.inquiry2Score } };
  }
  return state;
}

function isScoreStepOverLimit(step, state = {}) {
  return (step === 1 && (Number(state.korean?.common || 0) > 76 || Number(state.korean?.elective || 0) > 24))
    || (step === 2 && (Number(state.math?.common || 0) > 74 || Number(state.math?.elective || 0) > 26))
    || (step === 5 && Number(state.inquiry1?.score || 0) > 50)
    || (step === 6 && Number(state.inquiry2?.score || 0) > 50);
}

function hasRequiredScoreMissing(values) {
  return !String(values.koreanCommon).trim()
    || !String(values.koreanElective).trim()
    || !String(values.mathCommon).trim()
    || !String(values.mathElective).trim()
    || isInvalidRequiredSelectValue(values.english)
    || isInvalidRequiredSelectValue(values.history)
    || isInvalidRequiredSelectValue(values.inquiry1Subject)
    || isInvalidRequiredSelectValue(values.inquiry2Subject)
    || !String(values.inquiry1Score).trim()
    || !String(values.inquiry2Score).trim();
}

function englishGradeToScore(grade) {
  const n = Number(grade || 0);
  return n ? Math.max(0, Math.round(100 - (n - 1) * 12.5)) : 0;
}

function scoreExamTypeToKey(label = '') {
  if (String(label).includes('3월')) return 'mar';
  if (String(label).includes('4월')) return 'apr';
  if (String(label).includes('5월')) return 'may';
  if (String(label).includes('6월')) return 'jun';
  if (String(label).includes('7월')) return 'jul';
  if (String(label).includes('9월')) return 'sep';
  if (String(label).includes('10월')) return 'oct';
  if (String(label).includes('수능')) return 'csat';
  return 'active';
}

function buildQuantitative(values, examType) {
  const examKey = scoreExamTypeToKey(examType);
  return {
    [examKey]: {
      kor: {
        opt: values.koreanType || '',
        common: Number(values.koreanCommon || 0),
        elective: Number(values.koreanElective || 0),
        raw: Number(values.koreanCommon || 0) + Number(values.koreanElective || 0)
      },
      math: {
        opt: values.mathType || '',
        common: Number(values.mathCommon || 0),
        elective: Number(values.mathElective || 0),
        raw: Number(values.mathCommon || 0) + Number(values.mathElective || 0)
      },
      eng: { grd: Number(values.english || 0) },
      hist: { grd: Number(values.history || 0) },
      inq1: { name: values.inquiry1Subject || '', raw: Number(values.inquiry1Score || 0) },
      inq2: { name: values.inquiry2Subject || '', raw: Number(values.inquiry2Score || 0) }
    }
  };
}

function persistUser(ctx, patch) {
  const user = { ...(ctx.user || {}), ...patch };
  ctx.localStorage?.setItem?.('user', JSON.stringify(user));
  return user;
}

function syncIOSSafariQualDomState(ctx, values) {
  ctx.setObSchoolName?.(values.obSchoolName);
  ctx.setObGradeStatus?.(values.obGradeStatus);
  ctx.setObTrack?.(values.obTrack);
  ctx.setObGoalText?.(values.obGoalText);
  ctx.setObQuestionText?.(values.obQuestionText);
}

function cachePendingObFieldValues(ctx, nextGrade) {
  const fields = [
    ['obSchoolName', 'value'],
    ['obGoalText', 'value'],
    ['obQuestionText', 'value'],
    ['obGradeStatus', nextGrade]
  ];
  fields.forEach(([name, value]) => {
    const el = query(ctx, `[data-field="${name}"]`);
    if (el) el.dataset.pendingValue = value === 'value' ? el.value : value;
  });
}

export function createProfileHandlers(ctx) {
  const {
    alert = globalThis.alert || noop,
    confirm = globalThis.confirm || (() => false),
    getExamScoresMap = () => ({}),
    goto,
    localStorage = globalThis.localStorage,
    saveExamScoresMap = noop,
    setLoggedIn = noop,
    setHistory = noop,
    setLogoutModalOpen = noop,
    setMbtiAnswers = noop,
    setMbtiModalOpen = noop,
    setMbtiResult = noop,
    setMyProfileEditOpen = noop,
    setMyProfileNameDraft = noop,
    setMyProfileTargetDraft = noop,
    setNotifications = noop,
    setOb2SkippedNoScore = noop,
    setObGed = noop,
    setObGradeStatus = noop,
    setOpenFaq = noop,
    setScoreEditOpen = noop,
    setScoreEditStep = noop,
    setScores = noop,
    setTargetMajor = noop,
    setUser = noop,
    setWithdrawModalOpen = noop,
    persistQualitative = noop,
    persistQuantitative = noop,
    persistTargetUnivs = noop,
    setWithdrawPassword = noop
  } = ctx;
  const storage = ctx.localStorage || localStorage;

  return {
    openScoreEdit() {
      setScoreEditOpen(true);
      setScoreEditStep(1);
      return true;
    },

    closeScoreEdit() {
      setScoreEditOpen(false);
      setScoreEditStep(1);
      return true;
    },

    async saveQualInfo() {
      const values = readQualValues(ctx);
      if (isQualInfoMissing(values)) {
        alert('필수 입력 사항을 모두 입력해주세요');
        return false;
      }
      if (shouldReadOb1FromDom(ctx)) syncIOSSafariQualDomState(ctx, values);
      const qualitative = buildQualitative(values);
      setUser((prev) => ({ ...prev, qualitative }));
      persistUser({ ...ctx, localStorage: storage }, { qualitative });
      const result = await persistQualitative(qualitative);
      if (result && result.ok === false) {
        alert(result.error || '정성조사서 저장에 실패했습니다.');
        return false;
      }
      alert('정성조사서가 저장되었습니다.');
      return true;
    },

    skipOb2WithoutScore() {
      if (!confirm('정확한 분석이 어려울 수 있어요. 그래도 진행할까요?')) return false;
      setOb2SkippedNoScore(true);
      goto?.('ob3');
      return true;
    },

    downloadMbtiReport() {
      alert('맞춤 공부법 PDF는 준비 중입니다.');
      return true;
    },

    scoreStepPrev() {
      setScoreEditStep((value) => Math.max(1, value - 1));
      return true;
    },

    scoreStepNext() {
      const step = Number(ctx.scoreEditStep || 1);
      const nextState = patchCurrentScoreStep(ctx);
      if (isScoreStepOverLimit(step, nextState)) {
        alert('성적을 정확히 입력해주세요');
        return false;
      }
      setScoreEditStep((value) => Math.min(6, value + 1));
      return true;
    },

    async saveScoreEdit() {
      if (isInvalidRequiredSelectValue(ctx.scoreExamType)) {
        alert('필수 항목을 모두 선택해주세요');
        return false;
      }
      const values = readScoreEditValues(ctx);
      updateScoreEditState(ctx, values);
      if (hasRequiredScoreMissing(values)) {
        alert('필수 입력 사항을 모두 입력해주세요');
        return false;
      }
      const nextKo = Number(values.koreanCommon || 0) + Number(values.koreanElective || 0);
      const nextMa = Number(values.mathCommon || 0) + Number(values.mathElective || 0);
      const nextEnGrade = Number(values.english || 0);
      const nextEnScore = englishGradeToScore(nextEnGrade);
      const nextIq1 = Number(values.inquiry1Score || 0);
      const nextIq2 = Number(values.inquiry2Score || 0);
      setScores((prev) => ({
        ...prev,
        korean: nextKo || prev.korean,
        math: nextMa || prev.math,
        english: nextEnScore || prev.english,
        inquiry1: nextIq1 || prev.inquiry1,
        inquiry2: nextIq2 || prev.inquiry2
      }));
      const map = getExamScoresMap();
      map[ctx.scoreExamType] = {
        korean: nextKo,
        math: nextMa,
        englishGrade: nextEnGrade,
        english: nextEnScore,
        inquiry1: nextIq1,
        inquiry2: nextIq2
      };
      saveExamScoresMap(map);
      const quantitativePatch = buildQuantitative(values, ctx.scoreExamType);
      const nextQuantitative = {
        ...(ctx.user?.quantitative || {}),
        ...quantitativePatch
      };
      setUser((prevUser) => ({
        ...prevUser,
        quantitative: nextQuantitative
      }));
      const result = await persistQuantitative(nextQuantitative);
      if (result && result.ok === false) {
        alert(result.error || '성적 저장에 실패했습니다.');
        return false;
      }
      setScoreEditOpen(false);
      setScoreEditStep(1);
      return true;
    },

    applyScoreExam() {
      const values = readScoreEditValues(ctx);
      if (isInvalidRequiredSelectValue(values.english)
        || isInvalidRequiredSelectValue(values.history)
        || isInvalidRequiredSelectValue(values.inquiry1Subject)
        || isInvalidRequiredSelectValue(values.inquiry2Subject)
        || isInvalidRequiredSelectValue(ctx.scoreExamType)) {
        alert('필수 항목을 모두 선택해주세요');
        return false;
      }
      const picked = getExamScoresMap()[ctx.scoreExamType];
      if (!picked) {
        alert('선택한 시험의 저장된 성적이 없습니다.');
        return false;
      }
      setScores((prev) => ({
        ...prev,
        korean: Number(picked.korean || prev.korean),
        math: Number(picked.math || prev.math),
        english: Number(picked.english || prev.english),
        inquiry1: Number(picked.inquiry1 || prev.inquiry1),
        inquiry2: Number(picked.inquiry2 || prev.inquiry2)
      }));
      alert('선택한 시험 성적이 적용되었습니다.');
      return true;
    },

    toggleNotification({ actionEl }) {
      const key = getData(actionEl, 'notify-key');
      if (!key) return false;
      setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
      return true;
    },

    toggleFaq({ actionEl }) {
      if (ctx.isIOSSafari?.()) {
        const answerEl = actionEl?.querySelector?.('p');
        if (answerEl) {
          const nextOpen = !actionEl.classList.contains('active');
          actionEl.classList.toggle('active', nextOpen);
          actionEl.classList.toggle('open', nextOpen);
          actionEl.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
          answerEl.hidden = !nextOpen;
          answerEl.style.display = nextOpen ? '' : 'none';
          return true;
        }
      }
      const id = getData(actionEl, 'faq-id');
      setOpenFaq((prev) => (prev === id ? '' : id));
      return true;
    },

    openLogoutModal() {
      setLogoutModalOpen(true);
      return true;
    },

    closeLogoutModal() {
      setLogoutModalOpen(false);
      return true;
    },

    openMyProfileEdit() {
      setMyProfileNameDraft(ctx.user?.name || DEFAULT_USER.name);
      setMyProfileTargetDraft(ctx.targetMajor || ctx.analysisTargetList?.[0] || DEFAULT_USER.targetUniversity);
      setMyProfileEditOpen(true);
      return true;
    },

    closeMyProfileEdit() {
      setMyProfileEditOpen(false);
      return true;
    },

    async saveMyProfileEdit() {
      const nextName = String(ctx.myProfileNameDraft || '').trim() || DEFAULT_USER.name;
      const nextTarget = ctx.myProfileTargetDraft || ctx.targetMajor || DEFAULT_USER.targetUniversity;
      setUser((prev) => ({ ...(prev || {}), name: nextName, targetUniversity: nextTarget }));
      setTargetMajor(nextTarget);
      const nextTargets = Array.from(new Set([nextTarget, ...(ctx.homeTargetList || [])].filter(Boolean))).slice(0, 6);
      const result = await persistTargetUnivs(nextTargets);
      if (result && result.ok === false) {
        alert(result.error || '목표 대학 저장에 실패했습니다.');
        return false;
      }
      setMyProfileEditOpen(false);
      return true;
    },

    openWithdrawModal() {
      setWithdrawModalOpen(true);
      return true;
    },

    closeWithdrawModal() {
      setWithdrawModalOpen(false);
      setWithdrawPassword('');
      return true;
    },

    openMbtiModal() {
      setMbtiModalOpen(true);
      return true;
    },

    closeMbtiModal() {
      setMbtiModalOpen(false);
      return true;
    },

    setMbti({ actionEl }) {
      const question = getData(actionEl, 'mbti-q');
      const value = getData(actionEl, 'mbti-v');
      if (!question) return false;
      setMbtiAnswers((prev) => ({ ...prev, [question]: value }));
      return true;
    },

    completeMbti() {
      const yesCount = Object.values(ctx.mbtiAnswers || {}).filter((value) => MBTI_STRATEGY_VALUES.includes(value)).length;
      setMbtiResult(yesCount >= 3 ? '전략형 집중러' : '균형형 실행러');
      setMbtiModalOpen(false);
      return true;
    },

    confirmLogout() {
      setLogoutModalOpen(false);
      setLoggedIn(false);
      setHistory([]);
      goto?.('authLogin', false);
      alert('로그아웃되었습니다');
      return true;
    },

    confirmWithdraw() {
      if (!String(ctx.withdrawPassword || '').trim()) {
        alert('현재 비밀번호를 입력해주세요.');
        return false;
      }
      setWithdrawModalOpen(false);
      setWithdrawPassword('');
      setLoggedIn(false);
      setHistory([]);
      goto?.('authLogin', false);
      alert('회원탈퇴가 완료되었습니다.');
      return true;
    },

    setObGradeStatus({ actionEl }) {
      const nextGrade = getData(actionEl, 'ob-grade') || '고1/2 재학';
      if (shouldReadOb1FromDom(ctx)) cachePendingObFieldValues(ctx, nextGrade);
      setObGradeStatus(nextGrade);
      return true;
    },

    toggleObGed() {
      setObGed((value) => !value);
      return true;
    },

    openKakaoSupport() {
      const win = getWindow(ctx);
      if (typeof ctx.windowOpen === 'function') ctx.windowOpen(KAKAO_SUPPORT_URL, '_blank');
      else win.open?.(KAKAO_SUPPORT_URL, '_blank');
      return true;
    },

    openEmailSupport() {
      if (typeof ctx.setLocationHref === 'function') ctx.setLocationHref(`mailto:${SUPPORT_EMAIL}`);
      else {
        const win = getWindow(ctx);
        if (win.location) win.location.href = `mailto:${SUPPORT_EMAIL}`;
      }
      return true;
    }
  };
}

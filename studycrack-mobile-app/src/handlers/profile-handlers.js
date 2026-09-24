import { clearMobileAuthArtifacts, verifyPassword } from '../features/session/auth-service.js';
import { convertExamScores } from '../features/analysis/api.js';
import { scoreExamTypeToKey } from '../features/analysis/score-model.js';
import { MBTI_QUESTIONS, computeMbtiCode } from '../constants/mbti.js';
import { getData } from './action-utils.js';
import { withOperationLock } from '../shared/async/operation-lock.js';

const MBTI_QUESTION_COUNT = MBTI_QUESTIONS.length;
const KAKAO_SUPPORT_URL = 'https://pf.kakao.com/_wxjxcgn';

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

function getMobileReturnPath(ctx) {
  const location = getWindow(ctx).location || {};
  const path = location.pathname || '/studycrack-mobile.html';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/studycrack-mobile.html';
  return `${path}?screen=accountInfo`;
}

function getMobileLoginPath(ctx) {
  const location = getWindow(ctx).location || {};
  const path = location.pathname || '/studycrack-mobile.html';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/studycrack-mobile.html?screen=authLogin';
  return `${path}?screen=authLogin`;
}

function getSessionStorage(ctx) {
  return ctx.sessionStorage || getWindow(ctx).sessionStorage || globalThis.sessionStorage;
}

function normalizeKoreanPhone(phone = '') {
  let cleanPhone = String(phone || '').replace(/[^0-9+]/g, '').trim();
  if (cleanPhone.startsWith('010')) cleanPhone = `+82${cleanPhone.substring(1)}`;
  else if (cleanPhone.startsWith('10')) cleanPhone = `+82${cleanPhone}`;
  return cleanPhone;
}

function formatLocalPhone(phone = '') {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 11) return digits.replace(/(^01[0-9])([0-9]+)([0-9]{4})$/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(^0[0-9]{1,2})([0-9]+)([0-9]{4})$/, '$1-$2-$3');
  return phone;
}

async function postJson({ apiFetch, url, payload }) {
  if (typeof apiFetch !== 'function' || !url) return { ok: false, error: 'API 설정을 불러오지 못했습니다.' };
  try {
    const response = await apiFetch(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response?.ok) {
      const body = await response?.json?.().catch(() => null);
      return { ok: false, error: body?.error || body?.message || '요청을 처리하지 못했습니다.' };
    }
    const body = await response.json?.().catch(() => null);
    return { ok: true, data: body || null };
  } catch (_error) {
    return { ok: false, error: '네트워크 오류가 발생했습니다.' };
  }
}

async function clearMobileAuthSession(ctx, authApiUrl) {
  if (authApiUrl) {
    try {
      if (typeof ctx.apiFetch === 'function') {
        await ctx.apiFetch(authApiUrl, {
          method: 'POST',
          body: JSON.stringify({ type: 'logout' })
        });
      } else {
        await getWindow(ctx).fetch?.(authApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type: 'logout' })
        });
      }
    } catch (_error) {}
  }
  try {
    clearMobileAuthArtifacts(getWindow(ctx));
  } catch (_error) {}
}

function buildSocialAuthUrl(ctx, provider, purpose = 'mobile') {
  const win = getWindow(ctx);
  const social = win.CONFIG?.social;
  const clientId = social?.[provider]?.clientId;
  const callbackUrl = social?.callbackUrl;
  if (!clientId || !callbackUrl) return '';
  const bytes = new Uint8Array(16);
  const cryptoObj = win.crypto || globalThis.crypto;
  cryptoObj?.getRandomValues?.(bytes);
  const nonce = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('') || String(Date.now());
  const state = `${nonce}|${provider}|${purpose}`;
  getSessionStorage(ctx)?.setItem?.('socialState', state);
  if (purpose === 'mobile') getSessionStorage(ctx)?.setItem?.('socialLinkMode', 'true');
  else getSessionStorage(ctx)?.removeItem?.('socialLinkMode');
  const returnUrl = getMobileReturnPath(ctx);
  getSessionStorage(ctx)?.setItem?.('socialReturnUrl', returnUrl);
  getSessionStorage(ctx)?.setItem?.('socialEntry', 'mobile');
  try {
    getWindow(ctx).localStorage?.setItem?.('socialReturnUrl', returnUrl);
    getWindow(ctx).localStorage?.setItem?.('socialEntry', 'mobile');
  } catch (_) {}
  if (provider === 'google') {
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account'
    })}`;
  }
  if (provider === 'naver') {
    return `https://nid.naver.com/oauth2.0/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
      auth_type: 'reauthenticate'
    })}`;
  }
  return '';
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

function rawValidScores(max) {
  const out = new Set([0]);
  for (let v = 2; v <= max - 2; v += 1) out.add(v);
  if (max >= 2) out.add(max);
  return out;
}

function isValidRawScore(value, max) {
  if (!String(value ?? '').trim()) return false;
  const n = Number(value);
  return Number.isInteger(n) && rawValidScores(max).has(n);
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
  if (step === 4) {
    ctx.setScoreEditState?.((prev = {}) => ({ ...prev, history: values.history }));
    return { ...state, history: values.history };
  }
  if (step === 5) {
    ctx.setScoreEditState?.((prev = {}) => ({
      ...prev,
      inquiry1: { ...(prev.inquiry1 || {}), subject: values.inquiry1Subject, score: values.inquiry1Score }
    }));
    return { ...state, inquiry1: { ...(state.inquiry1 || {}), subject: values.inquiry1Subject, score: values.inquiry1Score } };
  }
  if (step === 6) {
    ctx.setScoreEditState?.((prev = {}) => ({
      ...prev,
      inquiry2: { ...(prev.inquiry2 || {}), subject: values.inquiry2Subject, score: values.inquiry2Score }
    }));
    return { ...state, inquiry2: { ...(state.inquiry2 || {}), subject: values.inquiry2Subject, score: values.inquiry2Score } };
  }
  return state;
}

function isScoreStepOverLimit(step, state = {}) {
  return (step === 1 && (!isValidRawScore(state.korean?.common, 76) || !isValidRawScore(state.korean?.elective, 24)))
    || (step === 2 && (!isValidRawScore(state.math?.common, 74) || !isValidRawScore(state.math?.elective, 26)))
    || (step === 5 && !isValidRawScore(state.inquiry1?.score, 50))
    || (step === 6 && !isValidRawScore(state.inquiry2?.score, 50));
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

// 현재 과목만 검증. 통과 시 '' 반환, 실패 시 안내 문구.
function validateScoreSubject(step, values) {
  if (step === 1) {
    if (!String(values.koreanCommon).trim() || !String(values.koreanElective).trim()) return '국어 공통/선택 원점수를 모두 입력해주세요.';
    if (!isValidRawScore(values.koreanCommon, 76) || !isValidRawScore(values.koreanElective, 24)) return '국어 점수를 정확히 입력해주세요.';
  }
  if (step === 2) {
    if (!String(values.mathCommon).trim() || !String(values.mathElective).trim()) return '수학 공통/선택 원점수를 모두 입력해주세요.';
    if (!isValidRawScore(values.mathCommon, 74) || !isValidRawScore(values.mathElective, 26)) return '수학 점수를 정확히 입력해주세요.';
  }
  if (step === 3 && !Number(values.english || 0)) return '영어 등급을 선택해주세요.';
  if (step === 4 && !Number(values.history || 0)) return '한국사 등급을 선택해주세요.';
  if (step === 5) {
    if (isInvalidRequiredSelectValue(values.inquiry1Subject) || !String(values.inquiry1Score).trim()) return '탐구 1 과목과 원점수를 입력해주세요.';
    if (!isValidRawScore(values.inquiry1Score, 50)) return '탐구 1 원점수를 정확히 입력해주세요.';
  }
  if (step === 6) {
    if (isInvalidRequiredSelectValue(values.inquiry2Subject) || !String(values.inquiry2Score).trim()) return '탐구 2 과목과 원점수를 입력해주세요.';
    if (!isValidRawScore(values.inquiry2Score, 50)) return '탐구 2 원점수를 정확히 입력해주세요.';
  }
  return '';
}

// 모달 진입 시 저장된 quantitative[examKey]로 입력 초안을 채운다(재진입 시 기존 값 보임).
function seedScoreEditFromQuant(quant) {
  const q = quant || {};
  const numStr = (v) => (v === 0 || v === '0' ? '0' : (Number(v) ? String(Number(v)) : ''));
  return {
    korean: { type: q.kor?.opt || '', common: numStr(q.kor?.common), elective: numStr(q.kor?.elective) },
    math: { type: q.math?.opt || '', common: numStr(q.math?.common), elective: numStr(q.math?.elective) },
    english: q.eng?.grd ? String(q.eng.grd) : '',
    history: q.hist?.grd ? String(q.hist.grd) : '',
    inquiry1: { subject: q.inq1?.name || '', score: numStr(q.inq1?.raw) },
    inquiry2: { subject: q.inq2?.name || '', score: numStr(q.inq2?.raw) }
  };
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
    applyScoreExamSelection = noop,
    localStorage = globalThis.localStorage,
    saveExamScoresMap = noop,
    setLoggedIn,
    setHistory,
    setLogoutModalOpen,
    setMbtiAnswers,
    setMbtiModalOpen,
    setMbtiResult,
    setMbtiStep,
    setMyProfileEditOpen,
    setMyProfileNameDraft,
    setMyProfilePhoneCodeDraft,
    setMyProfilePhoneDraft,
    setNotifications,
    setOb2SkippedNoScore,
    setObGed,
    setObGradeStatus,
    setOpenFaq,
    setOpenTermsType,
    setPhoneChangeModalOpen,
    setPhoneChangeSending,
    setPhoneChangeStep,
    setProfileDetailModalOpen,
    setProfilePhotoUploading,
    setScoreEditOpen,
    setScoreEditState,
    setScoreEditStep,
    setScoreSubjectSaving,
    setScoreExamKey,
    setRankingPeriod,
    setScores,
    setTargetMajor,
    setUser,
    setWithdrawModalOpen,
    setWithdrawSubmitting,
    persistQualitative = noop,
    persistQuantitative = noop,
    persistNotificationPreferences = noop,
    setWithdrawPassword
  } = ctx;
  const storage = ctx.localStorage || localStorage;
  const userApiUrl = ctx.userApiUrl || ctx.apiBase?.user || getWindow(ctx).CONFIG?.api?.user || '';
  const authApiUrl = ctx.authApiUrl || ctx.apiBase?.auth || getWindow(ctx).CONFIG?.api?.auth || '';
  const analysisApiUrl = ctx.analysisApiUrl || ctx.apiBase?.analysis || getWindow(ctx).CONFIG?.api?.analysis || '';

  async function updateMemberInfo(patch) {
    const result = await postJson({
      apiFetch: ctx.apiFetch,
      url: userApiUrl,
      payload: { type: 'update_member_info', data: patch }
    });
    return result;
  }

  async function saveConfirmedQualitative(qualitative, onSaved) {
    return withOperationLock(ctx.operationLocksRef, 'profile-qualitative', async () => {
      let result;
      try { result = await persistQualitative(qualitative); } catch { result = { ok: false }; }
      if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
      if (result?.ok !== true) {
        alert('학습 정보를 저장하지 못했어요. 입력은 유지되니 다시 시도해주세요.');
        return false;
      }
      setUser(prev => ({ ...prev, qualitative }));
      persistUser({ ...ctx, localStorage: storage }, { qualitative });
      onSaved?.();
      return true;
    });
  }

  return {
    setRankingPeriod({ actionEl }) {
      const period = getData(actionEl, 'ranking-period');
      if (!['daily', 'weekly', 'monthly'].includes(period)) return false;
      setRankingPeriod(period);
      return true;
    },
    retryRanking() {
      ctx.refreshStudyRanking?.();
      return true;
    },
    openScoreEdit() {
      const examKey = scoreExamTypeToKey(ctx.scoreExamType);
      const quant = ctx.user?.quantitative?.[examKey];
      if (quant) setScoreEditState(() => seedScoreEditFromQuant(quant));
      setScoreEditOpen(true);
      setScoreEditStep(1);
      return true;
    },

    // 레일 칩으로 과목 점프(현재 과목 초안은 보존).
    scoreStepGoto({ actionEl }) {
      const next = Number(getData(actionEl, 'step') || 1);
      if (!(next >= 1 && next <= 6)) return false;
      patchCurrentScoreStep(ctx);
      setScoreEditStep(Math.min(6, Math.max(1, next)));
      return true;
    },

    async saveScoreSubject() {
      if (ctx.scoreSubjectSaving) return false;
      const step = Number(ctx.scoreEditStep || 1);
      patchCurrentScoreStep(ctx);
      const values = readScoreEditValues(ctx);
      const error = validateScoreSubject(step, values);
      if (error) {
        alert(error);
        return false;
      }
      if (step < 6) {
        setScoreEditStep(step + 1);
        return true;
      }
      if (isInvalidRequiredSelectValue(ctx.scoreExamType)) {
        alert('시험을 먼저 선택해주세요.');
        return false;
      }
      for (let subjectStep = 1; subjectStep <= 6; subjectStep += 1) {
        const subjectError = validateScoreSubject(subjectStep, values);
        if (subjectError) {
          alert(subjectError);
          setScoreEditStep(subjectStep);
          return false;
        }
      }

      setScoreSubjectSaving(true);
      try {
        const examKey = scoreExamTypeToKey(ctx.scoreExamType);
        const quantitativePatch = buildQuantitative(values, ctx.scoreExamType);
        const converted = await convertExamScores({
          apiFetch: ctx.apiFetch,
          analysisApiUrl,
          examMode: examKey,
          examData: quantitativePatch[examKey]
        });
        if (!converted.ok) {
          alert(converted.error || '성적 환산에 실패했습니다.');
          return false;
        }
        const nextQuantitative = {
          ...(ctx.user?.quantitative || {}),
          [examKey]: converted.data
        };
        if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
        const result = await persistQuantitative(nextQuantitative);
        if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
        if (result?.ok !== true) {
          alert(result?.error || '성적 저장에 실패했습니다.');
          return false;
        }

        const nextKo = converted.data.kor.raw;
        const nextMa = converted.data.math.raw;
        const nextEnGrade = Number(values.english || 0);
        const nextEnScore = englishGradeToScore(nextEnGrade);
        const nextIq1 = converted.data.inq1.raw;
        const nextIq2 = converted.data.inq2.raw;
        setScores((prev) => ({ ...prev, korean: nextKo, math: nextMa, english: nextEnScore, inquiry1: nextIq1, inquiry2: nextIq2 }));
        const map = getExamScoresMap();
        map[ctx.scoreExamType] = { korean: nextKo, math: nextMa, englishGrade: nextEnGrade, english: nextEnScore, inquiry1: nextIq1, inquiry2: nextIq2 };
        saveExamScoresMap(map);
        setScoreExamKey(examKey);
        setUser((prevUser) => ({ ...prevUser, quantitative: nextQuantitative }));
        persistUser({ ...ctx, localStorage: storage }, { quantitative: nextQuantitative });
        setScoreEditOpen(false);
        setScoreEditStep(1);
        return true;
      } finally {
        setScoreSubjectSaving(false);
      }
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
      const qualitative = { ...(ctx.user?.qualitative || {}), ...buildQualitative(values) };
      if (!await saveConfirmedQualitative(qualitative)) return false;
      if (ctx.screen === 'ob1') {
        goto?.('ob2');
        return true;
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
      patchCurrentScoreStep(ctx);
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
      if (ctx.scoreSubjectSaving) return false;
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
      for (let step = 1; step <= 6; step += 1) {
        const subjectError = validateScoreSubject(step, values);
        if (subjectError) {
          alert(subjectError);
          return false;
        }
      }
      const quantitativePatch = buildQuantitative(values, ctx.scoreExamType);
      const examKey = scoreExamTypeToKey(ctx.scoreExamType);
      setScoreSubjectSaving(true);
      try {
        const converted = await convertExamScores({
          apiFetch: ctx.apiFetch,
          analysisApiUrl,
          examMode: examKey,
          examData: quantitativePatch[examKey]
        });
        if (!converted.ok) {
          alert(converted.error || '성적 환산에 실패했습니다.');
          return false;
        }
        const nextQuantitative = { ...(ctx.user?.quantitative || {}), [examKey]: converted.data };
        if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
        const result = await persistQuantitative(nextQuantitative);
        if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
        if (result?.ok !== true) {
          alert(result?.error || '성적 저장에 실패했습니다.');
          return false;
        }
        const nextKo = converted.data.kor.raw;
        const nextMa = converted.data.math.raw;
        const nextEnGrade = Number(values.english || 0);
        const nextEnScore = englishGradeToScore(nextEnGrade);
        const nextIq1 = converted.data.inq1.raw;
        const nextIq2 = converted.data.inq2.raw;
        setScores((prev) => ({ ...prev, korean: nextKo, math: nextMa, english: nextEnScore, inquiry1: nextIq1, inquiry2: nextIq2 }));
        const map = getExamScoresMap();
        map[ctx.scoreExamType] = { korean: nextKo, math: nextMa, englishGrade: nextEnGrade, english: nextEnScore, inquiry1: nextIq1, inquiry2: nextIq2 };
        saveExamScoresMap(map);
        setScoreExamKey(examKey);
        setUser((prevUser) => ({ ...prevUser, quantitative: nextQuantitative }));
        persistUser({ ...ctx, localStorage: storage }, { quantitative: nextQuantitative });
        setScoreEditOpen(false);
        setScoreEditStep(1);
        if (ctx.screen === 'ob2') goto?.('ob3');
        return true;
      } finally {
        setScoreSubjectSaving(false);
      }
    },

    applyScoreExam() {
      if (isInvalidRequiredSelectValue(ctx.scoreExamType)) {
        alert('시험을 선택해주세요');
        return false;
      }
      const examKey = scoreExamTypeToKey(ctx.scoreExamType);
      const hasServerScore = Boolean(ctx.user?.quantitative?.[examKey]);
      const picked = getExamScoresMap()[ctx.scoreExamType];
      if (hasServerScore) {
        applyScoreExamSelection(ctx.scoreExamType);
        alert('선택한 시험 성적이 적용되었습니다.');
        return true;
      }
      if (ctx.hasClientSession?.()) {
        applyScoreExamSelection(ctx.scoreExamType);
        alert('선택한 시험의 저장된 성적이 없습니다.');
        return false;
      }
      if (!picked) {
        applyScoreExamSelection(ctx.scoreExamType);
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
      setScoreExamKey(scoreExamTypeToKey(ctx.scoreExamType));
      alert('선택한 시험 성적이 적용되었습니다.');
      return true;
    },

    async toggleNotification({ actionEl }) {
      const key = getData(actionEl, 'notify-key');
      if (!['planner', 'weekly', 'report', 'billing'].includes(key)) return false;
      const previous = { ...(ctx.notifications || {}) };
      const next = { ...previous, [key]: !previous[key] };
      setNotifications(next);
      const result = await persistNotificationPreferences(next);
      if (result?.ok === false) {
        setNotifications(previous);
        alert(result.error || '알림 설정을 저장하지 못했습니다.');
      }
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

    async openProfileDetailModal() {
      setProfileDetailModalOpen(true);
      const tutorName = String(ctx.user?.tutorName || '').trim();
      if (tutorName && !ctx.user?.tutorInfo) {
        const result = await postJson({
          apiFetch: ctx.apiFetch,
          url: userApiUrl,
          payload: { type: 'get_tutor_info', data: { tutorName } }
        });
        if (result.ok && result.data) {
          setUser((prev) => ({ ...(prev || {}), tutorInfo: result.data }));
        }
      }
      return true;
    },

    closeProfileDetailModal() {
      setProfileDetailModalOpen(false);
      return true;
    },

    async saveProfilePhoto() {
      const file = query(ctx, '[data-profile-photo-input]')?.files?.[0] || null;
      if (!file) {
        alert('변경할 프로필 사진을 선택해주세요.');
        return false;
      }
      if (typeof ctx.uploadProfileImage !== 'function') {
        alert('프로필 사진 업로드 설정을 불러오지 못했습니다.');
        return false;
      }
      setProfilePhotoUploading(true);
      try {
        const uploadResult = await ctx.uploadProfileImage(file);
        if (!uploadResult?.ok || !uploadResult.data) {
          alert(uploadResult?.error || '프로필 사진 업로드에 실패했습니다.');
          return false;
        }
        const updateResult = await updateMemberInfo({ profileImage: uploadResult.data });
        if (!updateResult.ok) {
          alert(updateResult.error || '프로필 사진 저장에 실패했습니다.');
          return false;
        }
        setUser((prev) => ({ ...(prev || {}), profileImage: uploadResult.data }));
        alert('프로필 사진이 변경되었습니다.');
        return true;
      } finally {
        setProfilePhotoUploading(false);
      }
    },

    openMyProfileEdit() {
      if (ctx.screen !== 'accountInfo') {
        setProfileDetailModalOpen(false);
        goto?.('accountInfo');
        return true;
      }
      setMyProfileNameDraft(ctx.user?.name || '');
      setProfileDetailModalOpen(false);
      setMyProfileEditOpen(true);
      return true;
    },

    closeMyProfileEdit() {
      setMyProfileEditOpen(false);
      return true;
    },

    async saveMyProfileEdit() {
      const nextName = String(ctx.myProfileNameDraft || '').trim();
      if (!nextName) {
        alert('이름을 입력해주세요.');
        return false;
      }
      const result = await updateMemberInfo({ name: nextName });
      if (!result.ok) {
        alert(result.error || '이름 저장에 실패했습니다.');
        return false;
      }
      setUser((prev) => ({ ...(prev || {}), name: nextName }));
      setMyProfileEditOpen(false);
      return true;
    },

    openAccountManagement() {
      setProfileDetailModalOpen(false);
      setMyProfileEditOpen(false);
      setPhoneChangeModalOpen(false);
      setMyProfileNameDraft('');
      setMyProfilePhoneDraft('');
      setMyProfilePhoneCodeDraft('');
      setPhoneChangeStep('input');
      setPhoneChangeSending(false);
      goto?.('accountInfo');
      return true;
    },

    openTermsModal({ actionEl }) {
      setOpenTermsType(getData(actionEl, 'terms-type') || 'standard');
      return true;
    },

    closeTermsModal() {
      setOpenTermsType('');
      return true;
    },

    openPhoneChangeModal() {
      if (ctx.screen !== 'accountInfo') {
        setProfileDetailModalOpen(false);
        setPhoneChangeModalOpen(false);
        goto?.('accountInfo');
        return true;
      }
      setMyProfilePhoneDraft('');
      setMyProfilePhoneCodeDraft('');
      setPhoneChangeStep('input');
      setProfileDetailModalOpen(false);
      setPhoneChangeModalOpen(true);
      return true;
    },

    closePhoneChangeModal() {
      setPhoneChangeModalOpen(false);
      setMyProfilePhoneDraft('');
      setMyProfilePhoneCodeDraft('');
      setPhoneChangeStep('input');
      return true;
    },

    async requestPhoneChange() {
      const phone = normalizeKoreanPhone(ctx.myProfilePhoneDraft);
      if (!phone || !phone.startsWith('+')) {
        alert('휴대폰 번호 형식을 확인해주세요. 예: 01012345678');
        return false;
      }
      setPhoneChangeSending(true);
      const result = await postJson({
        apiFetch: ctx.apiFetch,
        url: authApiUrl,
        payload: { type: 'send_sms_auth', phone }
      });
      setPhoneChangeSending(false);
      if (!result.ok) {
        alert(result.error || '인증번호 발송에 실패했습니다.');
        return false;
      }
      setPhoneChangeStep('verify');
      alert('인증번호가 발송되었습니다.');
      return true;
    },

    async verifyPhoneChange() {
      const phone = normalizeKoreanPhone(ctx.myProfilePhoneDraft);
      const code = String(ctx.myProfilePhoneCodeDraft || '').trim();
      if (!phone || !code) {
        alert('전화번호와 인증번호를 입력해주세요.');
        return false;
      }
      const verifyResult = await postJson({
        apiFetch: ctx.apiFetch,
        url: authApiUrl,
        payload: { type: 'verify_code', phone, code }
      });
      if (!verifyResult.ok || verifyResult.data?.success === false) {
        alert(verifyResult.error || '인증번호가 일치하지 않거나 만료되었습니다.');
        return false;
      }
      const nextPhone = formatLocalPhone(ctx.myProfilePhoneDraft);
      const updateResult = await updateMemberInfo({ phone: nextPhone });
      if (!updateResult.ok) {
        alert(updateResult.error || '전화번호 저장에 실패했습니다.');
        return false;
      }
      setUser((prev) => ({ ...(prev || {}), phone: nextPhone }));
      setPhoneChangeModalOpen(false);
      setPhoneChangeStep('input');
      setMyProfilePhoneDraft('');
      setMyProfilePhoneCodeDraft('');
      alert('전화번호가 변경되었습니다.');
      return true;
    },

    async saveMarketingConsent({ actionEl, isAgreed } = {}) {
      const fromAttr = getData(actionEl, 'marketing-agreed', '');
      const nextValue = isAgreed === undefined
        ? (fromAttr ? fromAttr === 'true' : !(ctx.user?.marketingAgreed === true))
        : isAgreed === true;
      setUser((prev) => ({
        ...(prev || {}),
        marketingAgreed: nextValue,
        marketingAgreedAt: nextValue ? new Date().toISOString() : null
      }));
      const result = await updateMemberInfo({ marketingAgreed: nextValue });
      if (!result.ok) {
        setUser((prev) => ({ ...(prev || {}), marketingAgreed: !nextValue }));
        alert(result.error || '마케팅 수신 동의 저장에 실패했습니다.');
        return false;
      }
      alert(nextValue ? '마케팅 정보 수신에 동의했습니다.' : '마케팅 정보 수신 동의를 철회했습니다.');
      return true;
    },

    linkSocial({ actionEl }) {
      const provider = getData(actionEl, 'provider');
      const authUrl = buildSocialAuthUrl(ctx, provider);
      if (!authUrl) {
        alert('소셜 연동 설정을 불러오지 못했습니다.');
        return false;
      }
      getWindow(ctx).location.href = authUrl;
      return true;
    },

    async unlinkSocial({ actionEl }) {
      const provider = getData(actionEl, 'provider');
      if (!provider || !confirm(`${provider} 계정 연동을 해제하시겠습니까?`)) return false;
      const result = await postJson({
        apiFetch: ctx.apiFetch,
        url: authApiUrl,
        payload: { type: 'unlink_social', data: { provider } }
      });
      if (!result.ok) {
        alert(result.error || '연동 해제 중 오류가 발생했습니다.');
        return false;
      }
      setUser((prev) => ({
        ...(prev || {}),
        linkedProviders: (prev?.linkedProviders || []).filter((item) => item.provider !== provider)
      }));
      alert(`${provider} 연동이 해제되었습니다.`);
      return true;
    },

    openWithdrawModal() {
      setWithdrawModalOpen(true);
      return true;
    },

    closeWithdrawModal() {
      if (ctx.withdrawSubmitting) return false;
      setWithdrawModalOpen(false);
      setWithdrawPassword('');
      return true;
    },

    startWithdrawSocialReauth({ actionEl }) {
      const provider = getData(actionEl, 'provider') || String(ctx.user?.authProvider || '').toLowerCase();
      const authUrl = buildSocialAuthUrl(ctx, provider, 'delete_reauth');
      if (!authUrl) {
        alert('소셜 인증 설정을 불러오지 못했습니다.');
        return false;
      }
      getWindow(ctx).location.href = authUrl;
      return true;
    },

    // 결과가 이미 있으면 결과부터, 없으면 인트로부터 연다.
    openMbtiModal() {
      setMbtiStep(ctx.mbtiResult ? 'result' : 'intro');
      setMbtiModalOpen(true);
      return true;
    },

    closeMbtiModal() {
      setMbtiModalOpen(false);
      return true;
    },

    startMbti() {
      setMbtiAnswers(() => new Array(MBTI_QUESTION_COUNT).fill(0));
      setMbtiStep(0);
      return true;
    },

    retryMbti() {
      setMbtiAnswers(() => new Array(MBTI_QUESTION_COUNT).fill(0));
      setMbtiStep(0);
      return true;
    },

    answerMbti({ actionEl }) {
      const step = Number(getData(actionEl, 'mbti-step'));
      const choice = Number(getData(actionEl, 'mbti-choice'));
      if (!(step >= 0 && step < MBTI_QUESTION_COUNT) || ![1, 2].includes(choice)) return false;
      setMbtiAnswers((prev) => {
        const next = Array.isArray(prev) && prev.length === MBTI_QUESTION_COUNT ? [...prev] : new Array(MBTI_QUESTION_COUNT).fill(0);
        next[step] = choice;
        return next;
      });
      return true;
    },

    mbtiPrev() {
      const step = Number(ctx.mbtiStep);
      if (step > 0) setMbtiStep(step - 1);
      return true;
    },

    async mbtiNext() {
      const step = Number(ctx.mbtiStep);
      const answers = Array.isArray(ctx.mbtiAnswers) ? ctx.mbtiAnswers : [];
      if (!answers[step]) return false;
      if (step < MBTI_QUESTION_COUNT - 1) {
        setMbtiStep(step + 1);
        return true;
      }
      const code = computeMbtiCode(answers);
      const nextQualitative = { ...(ctx.user?.qualitative || {}), mbti: code };
      return saveConfirmedQualitative(nextQualitative, () => {
        setMbtiResult(code);
        setMbtiStep('result');
      });
    },

    async confirmLogout() {
      setLogoutModalOpen(false);
      await clearMobileAuthSession(ctx, authApiUrl);
      setLoggedIn(false);
      setHistory([]);
      if (typeof getWindow(ctx).location?.replace === 'function') {
        getWindow(ctx).location.replace(getMobileLoginPath(ctx));
        return true;
      }
      goto?.('authLogin', false);
      alert('로그아웃되었습니다');
      return true;
    },

    async confirmWithdraw() {
      if (ctx.withdrawSubmitting) return false;
      const authProvider = String(ctx.user?.authProvider || 'local').toLowerCase();
      const isSocial = ['google', 'naver'].includes(authProvider);
      const storage = getSessionStorage(ctx);
      const deleteConfirmToken = isSocial ? storage?.getItem?.('deleteConfirmToken') || '' : '';
      const password = String(ctx.withdrawPassword || '').trim();
      if (isSocial && !deleteConfirmToken) {
        alert('가입한 소셜 계정으로 먼저 본인 확인을 완료해주세요.');
        return false;
      }
      if (!isSocial && !password) {
        alert('현재 비밀번호를 입력해주세요.');
        return false;
      }
      setWithdrawSubmitting(true);
      if (!isSocial) {
        const verify = await (ctx.verifyPassword || verifyPassword)({ email: String(ctx.user?.email || ''), password });
        if (!verify?.ok) {
          setWithdrawSubmitting(false);
          alert(verify?.error || '비밀번호가 일치하지 않습니다.');
          return false;
        }
      }
      const result = await postJson({
        apiFetch: ctx.apiFetch,
        url: userApiUrl,
        payload: { type: 'delete_user', ...(deleteConfirmToken ? { deleteConfirmToken } : {}) }
      });
      if (!result.ok) {
        setWithdrawSubmitting(false);
        alert(result.error || '회원탈퇴를 처리하지 못했습니다.');
        return false;
      }
      storage?.removeItem?.('deleteConfirmToken');
      await clearMobileAuthSession(ctx, authApiUrl);
      setWithdrawSubmitting(false);
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

    openChangePassword() {
      getWindow(ctx).location.href = '/change-password';
      return true;
    }
  };
}

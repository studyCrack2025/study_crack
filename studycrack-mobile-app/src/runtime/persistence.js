import { normalizePersonalEvent } from '../constants/admission-calendar.js';

function noopResult(skipped = true) {
  return { ok: true, skipped };
}

async function postUserData({ apiFetch, userApiUrl, type, data } = {}) {
  if (typeof apiFetch !== 'function' || !userApiUrl) return noopResult();
  try {
    const response = await apiFetch(userApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type, data })
    });
    if (!response || !response.ok) {
      const body = await response?.json?.().catch(() => null);
      return { ok: false, error: body?.error || body?.message || '저장에 실패했습니다.' };
    }
    const body = await response.json?.().catch(() => null);
    return { ok: true, data: body || null };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || '네트워크 오류로 저장하지 못했습니다.',
      code: error?.code || '',
      status: error?.status || 0
    };
  }
}

export function scoreExamTypeToKey(label = '') {
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

export function scoreExamKeyToLabel(key = '') {
  const labels = {
    active: '최근 성적',
    mar: '3월 모의고사',
    apr: '4월 모의고사',
    may: '5월 모의고사',
    jun: '6월 모의고사',
    jul: '7월 모의고사',
    sep: '9월 모의고사',
    oct: '10월 모의고사',
    csat: '수능'
  };
  return labels[key] || '최근 성적';
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function optionalNumber(value) {
  if (!hasValue(value)) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function englishGradeToScore(grade) {
  const n = Number(grade || 0);
  return n ? Math.max(0, Math.round(100 - (n - 1) * 12.5)) : undefined;
}

export function createBlankScoreState() {
  return {
    korean: { type: '', common: '', elective: '' },
    math: { type: '', common: '', elective: '' },
    english: '',
    history: '',
    inquiry1: { subject: '', score: '' },
    inquiry2: { subject: '', score: '' }
  };
}

export function mapExamDataToScorePatch(examData, base = {}) {
  if (!examData || typeof examData !== 'object') return null;
  const englishGrade = Number(examData.eng?.grd || 0);
  const englishScore = optionalNumber(examData.eng?.raw) ?? englishGradeToScore(englishGrade);
  const scores = {
    korean: optionalNumber(examData.kor?.raw),
    math: optionalNumber(examData.math?.raw),
    english: englishScore,
    inquiry1: optionalNumber(examData.inq1?.raw),
    inquiry2: optionalNumber(examData.inq2?.raw)
  };
  const filteredScores = Object.fromEntries(Object.entries(scores).filter(([, value]) => value !== undefined));
  if (!Object.keys(filteredScores).length) return null;
  const scoreState = {
    korean: { type: examData.kor?.opt || '', common: examData.kor?.common || '', elective: examData.kor?.elective || '' },
    math: { type: examData.math?.opt || '', common: examData.math?.common || '', elective: examData.math?.elective || '' },
    english: englishGrade || '',
    history: examData.hist?.grd || examData.history?.grd || '',
    inquiry1: { subject: examData.inq1?.name || '', score: examData.inq1?.raw || '' },
    inquiry2: { subject: examData.inq2?.name || '', score: examData.inq2?.raw || '' }
  };
  return {
    scores: { ...(base.scores || {}), ...filteredScores },
    scoreState: { ...(base.scoreState || {}), ...scoreState },
    scoreEditState: { ...(base.scoreEditState || {}), ...scoreState }
  };
}

export function parseTargetMajor(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = text.match(/^(.+?(?:대학교|대학))\s+(.+)$/);
  if (match) return { univ: match[1].trim(), major: match[2].trim(), date: null };
  const [first, ...rest] = text.split(/\s+/);
  return { univ: first || text, major: rest.join(' ') || text, date: null };
}

export function formatTargetSlot(slot) {
  if (!slot || typeof slot !== 'object') return '';
  const univ = String(slot.univ || '').trim();
  const major = String(slot.major || '').trim();
  if (!univ && !major) return '';
  if (!univ) return major;
  if (!major) return univ;
  return major.includes(univ) ? major : `${univ} ${major}`.trim();
}

export function normalizeTargetSlot(input, nowIso = new Date().toISOString()) {
  if (!input) return null;
  if (typeof input === 'string') {
    const parsed = parseTargetMajor(input);
    return parsed ? { ...parsed, date: parsed.date || nowIso } : null;
  }
  if (typeof input !== 'object') return null;
  const univ = String(input.univ || '').trim();
  const major = String(input.major || '').trim();
  if (!univ && !major) return null;
  return { univ, major, date: input.date || nowIso };
}

export function normalizeTargetUnivSlots(slots = [], fallbackList = [], nowIso = new Date().toISOString()) {
  const source = Array.isArray(slots) && slots.length ? slots : fallbackList;
  const normalized = Array.from({ length: 6 }, (_, idx) => normalizeTargetSlot(source?.[idx], nowIso));
  return normalized;
}

export function targetSlotsToList(slots = []) {
  return (Array.isArray(slots) ? slots : []).map(formatTargetSlot).filter(Boolean);
}

export function upsertTargetSlot(slots = [], targetText = '', nowIso = new Date().toISOString()) {
  const normalized = normalizeTargetUnivSlots(slots, [], nowIso);
  const nextSlot = normalizeTargetSlot(targetText, nowIso);
  const nextLabel = formatTargetSlot(nextSlot);
  if (!nextSlot || !nextLabel) return normalized;
  if (normalized.some((slot) => formatTargetSlot(slot) === nextLabel)) return normalized;
  const emptyIndex = normalized.findIndex((slot) => !slot);
  if (emptyIndex < 0) return normalized;
  normalized[emptyIndex] = nextSlot;
  return normalized;
}

export function removeTargetSlot(slots = [], targetText = '', fallbackList = [], nowIso = new Date().toISOString()) {
  const normalized = normalizeTargetUnivSlots(slots, fallbackList, nowIso);
  const targetLabel = String(targetText || '').trim();
  return normalized.map((slot) => (formatTargetSlot(slot) === targetLabel ? null : slot));
}

export function buildTargetUnivsPayload(targetList = [], nowIso = new Date().toISOString(), targetSlots = null) {
  const slots = normalizeTargetUnivSlots(targetSlots || [], targetList, nowIso);
  return slots;
}

export function saveTargetUnivs({ apiFetch, userApiUrl, targetList, targetSlots } = {}) {
  return postUserData({
    apiFetch,
    userApiUrl,
    type: 'update_target_univs',
    data: buildTargetUnivsPayload(targetList, new Date().toISOString(), targetSlots)
  });
}

export function saveQuantitative({ apiFetch, userApiUrl, quantitative } = {}) {
  return postUserData({
    apiFetch,
    userApiUrl,
    type: 'update_quan',
    data: quantitative || {}
  });
}

function isConvertedMetric(metric) {
  return metric
    && Number.isFinite(Number(metric.std))
    && Number.isFinite(Number(metric.pct))
    && Number.isFinite(Number(metric.grd));
}

async function convertSubjectScore({ apiFetch, analysisApiUrl, payload }) {
  const response = await apiFetch(analysisApiUrl, {
    method: 'POST',
    body: JSON.stringify({ type: 'convert_score', ...payload })
  });
  if (!response?.ok) {
    const error = await response?.json?.().catch(() => null);
    throw new Error(error?.error || error?.message || '성적 환산에 실패했습니다.');
  }
  const metric = await response.json().catch(() => null);
  if (!isConvertedMetric(metric)) {
    throw new Error(metric?.error || '입력한 원점수 조합에 해당하는 성적표 데이터를 찾지 못했습니다.');
  }
  return { std: Number(metric.std), pct: Number(metric.pct), grd: Number(metric.grd) };
}

export async function convertExamScores({ apiFetch, analysisApiUrl, examMode, examData } = {}) {
  if (typeof apiFetch !== 'function' || !analysisApiUrl) {
    return { ok: false, error: '성적 환산 API 설정을 불러오지 못했습니다.' };
  }
  if (!examData?.kor || !examData?.math || !examData?.inq1 || !examData?.inq2) {
    return { ok: false, error: '환산할 성적 정보가 충분하지 않습니다.' };
  }
  try {
    const [kor, math, inq1, inq2] = await Promise.all([
      convertSubjectScore({
        apiFetch,
        analysisApiUrl,
        payload: { subject: 'kor', score: examData.kor.raw, opt: examData.kor.opt, common: examData.kor.common, elective: examData.kor.elective, month: examMode }
      }),
      convertSubjectScore({
        apiFetch,
        analysisApiUrl,
        payload: { subject: 'math', score: examData.math.raw, opt: examData.math.opt, common: examData.math.common, elective: examData.math.elective, month: examMode }
      }),
      convertSubjectScore({
        apiFetch,
        analysisApiUrl,
        payload: { subject: 'inq1', score: examData.inq1.raw, subName: examData.inq1.name, month: examMode }
      }),
      convertSubjectScore({
        apiFetch,
        analysisApiUrl,
        payload: { subject: 'inq2', score: examData.inq2.raw, subName: examData.inq2.name, month: examMode }
      })
    ]);
    return {
      ok: true,
      examData: {
        ...examData,
        kor: { ...examData.kor, ...kor },
        math: { ...examData.math, ...math },
        inq1: { ...examData.inq1, ...inq1 },
        inq2: { ...examData.inq2, ...inq2 }
      }
    };
  } catch (error) {
    return { ok: false, error: error?.message || '성적 환산에 실패했습니다.' };
  }
}

export function saveQualitative({ apiFetch, userApiUrl, qualitative } = {}) {
  return postUserData({
    apiFetch,
    userApiUrl,
    type: 'update_qual',
    data: qualitative || {}
  });
}

export function saveStudySession({ apiFetch, userApiUrl, session } = {}) {
  return postUserData({ apiFetch, userApiUrl, type: 'record_study_session', data: session || {} });
}

export function saveNotificationPreferences({ apiFetch, userApiUrl, preferences } = {}) {
  const notificationPreferences = Object.fromEntries(
    ['planner', 'weekly', 'report', 'billing'].map((key) => [key, preferences?.[key] !== false])
  );
  return postUserData({ apiFetch, userApiUrl, type: 'update_member_info', data: { notificationPreferences } });
}

export async function fetchStudyRanking({ apiFetch, userApiUrl, period = 'daily' } = {}) {
  if (typeof apiFetch !== 'function' || !userApiUrl) return { ok: false, rows: [], me: null, error: '랭킹 API 설정을 불러오지 못했습니다.' };
  try {
    const response = await apiFetch(userApiUrl, { method: 'POST', body: JSON.stringify({ type: 'get_study_ranking', data: { period } }) });
    if (!response?.ok) {
      const error = await response?.json?.().catch(() => null);
      return { ok: false, rows: [], me: null, error: error?.error || error?.message || '랭킹을 불러오지 못했습니다.' };
    }
    const data = await response.json().catch(() => null);
    return { ok: true, rows: Array.isArray(data?.rows) ? data.rows : [], me: data?.me || null, error: '' };
  } catch (error) {
    return { ok: false, rows: [], me: null, error: error?.message || '랭킹을 불러오지 못했습니다.' };
  }
}

export function normalizeUniversityCatalog(data) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.univs) ? data.univs : []);
  const map = new Map();
  list.forEach((item) => {
    const univName = String(item?.univName || item?.univ || '').trim();
    if (!univName) return;
    const majors = (Array.isArray(item?.majors) ? item.majors : [])
      .map((major) => String(typeof major === 'string' ? major : major?.name || '').trim())
      .filter(Boolean);
    const current = map.get(univName) || [];
    map.set(univName, Array.from(new Set([...current, ...majors])).sort((a, b) => a.localeCompare(b, 'ko')));
  });
  return Array.from(map, ([univName, majors]) => ({ univName, majors }))
    .sort((a, b) => a.univName.localeCompare(b.univName, 'ko'));
}

export async function fetchUniversityCatalog({ apiFetch, analysisApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !analysisApiUrl) return [];
  try {
    const response = await apiFetch(analysisApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'get_univ_list_only' })
    });
    if (!response || !response.ok) return [];
    const data = await response.json().catch(() => []);
    return normalizeUniversityCatalog(data);
  } catch (_error) {
    return [];
  }
}

function inferRecommendationStream(examData, savedStream = '') {
  const normalized = String(savedStream || '').toLowerCase();
  if (normalized === 'natural' || /자연|공학|의치|약수|간호/.test(normalized)) return 'natural';
  if (normalized === 'humanities' || /인문|사회|상경|사범|교대/.test(normalized)) return 'humanities';
  const mathOpt = String(examData?.math?.opt || '').replace(/\s+/g, '');
  const inquiries = [examData?.inq1?.name, examData?.inq2?.name].map((name) => String(name || '').replace(/\s+/g, ''));
  const hasScience = inquiries.some((name) => ['물리학', '화학', '생명과학', '지구과학'].some((subject) => name.includes(subject)));
  return /미적분|기하/.test(mathOpt) || hasScience ? 'natural' : 'humanities';
}

export async function fetchUniversityRecommendations({ apiFetch, analysisApiUrl, examData, examMode, savedStream = '', excludeTargets = [] } = {}) {
  if (typeof apiFetch !== 'function' || !analysisApiUrl || !examData) return { ok: false, recommendations: [], error: '추천에 필요한 성적 정보가 없습니다.' };
  const totalStdScore = ['kor', 'math', 'inq1', 'inq2'].reduce((sum, key) => sum + (Number(examData?.[key]?.std) || 0), 0);
  if (!totalStdScore) return { ok: false, recommendations: [], error: '표준점수가 포함된 성적을 먼저 저장해주세요.' };
  try {
    const response = await apiFetch(analysisApiUrl, {
      method: 'POST',
      body: JSON.stringify({
        type: 'get_tutorial_recommendations',
        userScores: examData,
        stream: inferRecommendationStream(examData, savedStream),
        totalStdScore,
        examMode,
        excludeUnivs: (excludeTargets || []).map(parseTargetMajor).filter(Boolean)
      })
    });
    if (!response?.ok) {
      const error = await response?.json?.().catch(() => null);
      return { ok: false, recommendations: [], error: error?.error || error?.message || '추천 대학을 불러오지 못했습니다.' };
    }
    const data = await response.json().catch(() => null);
    const recommendations = Array.from(new Set((Array.isArray(data?.selected) ? data.selected : [])
      .map((item) => `${String(item?.school || item?.univ || '').trim()} ${String(item?.major || '').trim()}`.trim())
      .filter((label) => label && label.includes(' '))))
      .slice(0, 3);
    return { ok: true, recommendations, error: recommendations.length ? '' : '현재 성적으로 추천할 수 있는 대학이 없습니다.' };
  } catch (error) {
    return { ok: false, recommendations: [], error: error?.message || '추천 대학을 불러오지 못했습니다.' };
  }
}

function toAnalysisTargetPayload(targetList = []) {
  return buildTargetUnivsPayload(targetList)
    .map((item) => item ? { univ: item.univ, major: item.major } : null)
    .filter((item) => item?.univ && item?.major);
}

function normalizeAnalysisResults(payload) {
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : (Array.isArray(payload?.data) ? payload.data : []));
  return list.filter((item) => item && item.univ && item.major);
}

function normalizeSimulationResults(payload) {
  return (Array.isArray(payload) ? payload : []).filter((item) => item && item.univ && item.major);
}

async function readApiError(responseOrError, fallback = '분석 결과를 불러오지 못했습니다.') {
  if (!responseOrError) return { message: fallback, status: 0, code: '' };
  if (responseOrError instanceof Error) {
    return {
      message: responseOrError.message || fallback,
      status: responseOrError.status || 0,
      code: responseOrError.code || ''
    };
  }
  const body = await responseOrError.json?.().catch(() => null);
  return {
    message: body?.error || body?.message || fallback,
    status: responseOrError.status || 0,
    code: body?.code || ''
  };
}

export async function fetchMobileTargetAnalysis({ apiFetch, analysisApiUrl, targetList, userScores, examMode } = {}) {
  if (typeof apiFetch !== 'function' || !analysisApiUrl || !userScores) return null;
  const targetUnivs = toAnalysisTargetPayload(targetList);
  if (!targetUnivs.length) return null;

  let analysisResults = [];
  let analysisError = null;

  try {
    const response = await apiFetch(analysisApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'analyze_my_targets', targetUnivs, userScores, examMode })
    });
    if (!response?.ok) {
      analysisError = await readApiError(response);
    } else {
      const data = await response.json().catch(() => null);
      analysisResults = normalizeAnalysisResults(data);
    }
  } catch (error) {
    analysisError = await readApiError(error);
  }

  return { analysisResults, simulationResults: [], analysisError, simulationError: null };
}

export async function fetchMobileScoreSimulation({ apiFetch, analysisApiUrl, targetList, userScores, examMode } = {}) {
  if (typeof apiFetch !== 'function' || !analysisApiUrl || !userScores) return null;
  const targetUnivs = toAnalysisTargetPayload(targetList);
  if (!targetUnivs.length) return null;

  try {
    const response = await apiFetch(analysisApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'simulate_score_rise', targetUnivs, userScores, examMode })
    });
    if (!response?.ok) {
      return {
        simulationResults: [],
        simulationError: await readApiError(response, '시뮬레이션 결과를 불러오지 못했습니다.')
      };
    }
    const data = await response.json().catch(() => null);
    return {
      simulationResults: normalizeSimulationResults(data),
      simulationError: null
    };
  } catch (error) {
    return {
      simulationResults: [],
      simulationError: await readApiError(error, '시뮬레이션 결과를 불러오지 못했습니다.')
    };
  }
}

export async function fetchMobileBacktrace({ apiFetch, analysisApiUrl, targetMajor, userScores, examMode } = {}) {
  if (typeof apiFetch !== 'function' || !analysisApiUrl || !userScores) {
    return { ok: false, plan: null, error: '역산에 필요한 성적 정보를 찾지 못했습니다.' };
  }
  const targetUniv = parseTargetMajor(targetMajor);
  if (!targetUniv?.univ || !targetUniv?.major) {
    return { ok: false, plan: null, error: '분석할 대학과 학과를 먼저 선택해주세요.' };
  }
  try {
    const response = await apiFetch(analysisApiUrl, {
      method: 'POST',
      body: JSON.stringify({
        type: 'backtrace_required_raw',
        targetUniv,
        userScores,
        examMode,
        targetUiMin: 100,
        targetUiMax: 150,
        maxTotalRaw: 20
      })
    });
    if (!response?.ok) {
      const error = await readApiError(response, '필요 원점수 조합을 계산하지 못했습니다.');
      return { ok: false, plan: null, error: error.message, status: error.status, code: error.code };
    }
    const body = await response.json().catch(() => null);
    const plan = body?.result || body?.backtrace_plan || null;
    return { ok: true, plan, error: plan ? '' : '현재 조건에서 도달 가능한 조합을 찾지 못했습니다.' };
  } catch (error) {
    const detail = await readApiError(error, '필요 원점수 조합을 계산하지 못했습니다.');
    return { ok: false, plan: null, error: detail.message, status: detail.status, code: detail.code };
  }
}

function normalizeProReports(payload) {
  const reports = Array.isArray(payload?.reports) ? payload.reports : [];
  return reports
    .filter((item) => item && item.key)
    .map((item) => ({
      key: String(item.key || ''),
      reportLink: item.reportLink || '',
      status: item.status || (item.reportLink ? 'sent' : 'pending'),
      updatedAt: item.updatedAt || '',
      request: item.request || ''
    }));
}

export async function fetchMobileProReports({ apiFetch, reportApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !reportApiUrl) return null;
  const response = await apiFetch(reportApiUrl, {
    method: 'POST',
    body: JSON.stringify({ type: 'get_pro_reports', data: { requesterRole: 'student' } })
  });
  if (!response?.ok) return [];
  const data = await response.json().catch(() => null);
  return normalizeProReports(data);
}

export async function requestMobileProReport({ apiFetch, reportApiUrl, requestText } = {}) {
  if (typeof apiFetch !== 'function' || !reportApiUrl) return { ok: false, error: '리포트 요청 경로를 찾지 못했습니다.' };
  const safeText = String(requestText || '').trim();
  if (!safeText) return { ok: false, error: '요청 사항을 입력해주세요.' };
  try {
    const response = await apiFetch(reportApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'request_pro_report', data: { requestText: safeText } })
    });
    const body = await response?.json?.().catch(() => null);
    if (!response?.ok) return { ok: false, error: body?.error || body?.message || '리포트 요청에 실패했습니다.' };
    return {
      ok: true,
      report: {
        key: String(body?.targetKey || ''),
        reportLink: '',
        status: 'pending',
        updatedAt: new Date().toISOString(),
        request: safeText
      }
    };
  } catch (_error) {
    return { ok: false, error: '네트워크 오류로 리포트 요청을 저장하지 못했습니다.' };
  }
}

function normalizeWeeklyReports(payload) {
  const reports = Array.isArray(payload?.weeklyReports) ? payload.weeklyReports : [];
  return reports
    .filter((item) => item && item.weekId)
    .map((item) => ({
      weekId: String(item.weekId || ''),
      title: item.title || '',
      date: item.date || '',
      updatedAt: item.updatedAt || '',
      tutorName: item.tutorName || '',
      tutorFeedback: item.tutorFeedback || null,
      weeklyGoal: item.weeklyGoal || '',
      questionToTutor: item.questionToTutor || ''
    }));
}

export async function fetchMobileWeeklyReports({ apiFetch, reportApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !reportApiUrl) return null;
  const response = await apiFetch(reportApiUrl, {
    method: 'POST',
    body: JSON.stringify({ type: 'get_weekly_reports' })
  });
  if (!response?.ok) return [];
  const data = await response.json().catch(() => null);
  return normalizeWeeklyReports(data);
}

function generateMobileReportKey(dateObj = new Date()) {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const baseDate = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const kstDate = new Date(baseDate.getTime() + kstOffsetMs);
  const yearNum = kstDate.getUTCFullYear();
  const monthIdx = kstDate.getUTCMonth();
  const dayOfMonth = kstDate.getUTCDate();
  const year = String(yearNum).slice(2);
  const month = String(monthIdx + 1).padStart(2, '0');
  const startOfMonth = new Date(Date.UTC(yearNum, monthIdx, 1));
  const dayOfWeek = startOfMonth.getUTCDay();
  const offsetDate = dayOfMonth + dayOfWeek - 1;
  const weekNum = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0');
  return `${year}${month}${weekNum}`;
}

function shortText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function fallbackMimeType(fileName = '') {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export async function uploadMobileFile({ apiFetch, fetchImpl = globalThis.fetch, file, fileApiUrl, folder } = {}) {
  if (typeof apiFetch !== 'function' || !fileApiUrl) return { ok: false, error: '파일 업로드 경로를 찾지 못했습니다.' };
  if (typeof fetchImpl !== 'function' || typeof FormData === 'undefined') return { ok: false, error: '현재 환경에서 파일 업로드를 사용할 수 없습니다.' };
  if (!file) return { ok: true, fileUrl: '' };

  const fileName = file.name || 'upload.jpg';
  const fileType = file.type || fallbackMimeType(fileName);
  try {
    const presignRes = await apiFetch(fileApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'get_presigned_url', data: { fileName: encodeURIComponent(fileName), fileType, folder } })
    });
    const presign = await presignRes?.json?.().catch(() => null);
    if (!presignRes?.ok) return { ok: false, error: presign?.error || '파일 업로드 URL 발급에 실패했습니다.' };
    const formData = new FormData();
    Object.entries(presign.fields || {}).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', file);
    const uploadRes = await fetchImpl(presign.uploadUrl, { method: 'POST', body: formData });
    if (!uploadRes?.ok) return { ok: false, error: 'S3 파일 업로드에 실패했습니다.' };
    return { ok: true, fileUrl: presign.fileUrl || '' };
  } catch (_error) {
    return { ok: false, error: '네트워크 오류로 파일을 업로드하지 못했습니다.' };
  }
}

export async function uploadMobileWeeklyFiles({
  apiFetch,
  examFiles = [],
  fetchImpl = globalThis.fetch,
  fileApiUrl,
  plannerFiles = []
} = {}) {
  const plannerFileUrls = [];
  const examFileUrls = [];
  for (const file of plannerFiles || []) {
    const result = await uploadMobileFile({ apiFetch, fetchImpl, file, fileApiUrl, folder: 'planner' });
    if (!result.ok) return result;
    if (result.fileUrl) plannerFileUrls.push(result.fileUrl);
  }
  for (const file of examFiles || []) {
    const result = await uploadMobileFile({ apiFetch, fetchImpl, file, fileApiUrl, folder: 'mock_exams' });
    if (!result.ok) return result;
    if (result.fileUrl) examFileUrls.push(result.fileUrl);
  }
  return { ok: true, plannerFileUrls, examFileUrls };
}

export function buildMobileWeeklyCheckPayload({
  answers = {},
  dropReasons = [],
  examScores = {},
  examType = '',
  examFileUrls = [],
  plannerFileUrls = [],
  rows = [],
  trend = '',
  now = new Date()
} = {}) {
  const weekId = generateMobileReportKey(now);
  const details = (rows || [])
    .map((row) => ({
      subject: `${row.subject || '기타'}${row.detail ? `(${row.detail})` : ''}`,
      plan: Number(row.planned || 0),
      act: Number(row.actual || 0)
    }))
    .filter((row) => row.subject && (row.plan > 0 || row.act > 0));
  const totalPlan = details.reduce((sum, row) => sum + row.plan, 0);
  const totalAct = details.reduce((sum, row) => sum + row.act, 0);
  const totalRate = totalPlan > 0 ? Math.round((totalAct / totalPlan) * 100) : 0;
  const deepAnswers = [
    trend ? `최근 2주 학업 추이: ${trend}` : '',
    dropReasons.length ? `하락 원인: ${dropReasons.join(', ')}` : '',
    answers.step4Reason ? `추이 상세: ${answers.step4Reason}` : '',
    answers.step5 ? `학습 계획 점검: ${answers.step5}` : '',
    answers.step6 ? `학습 방향성: ${answers.step6}` : '',
    answers.step7 ? `튜터 질문: ${answers.step7}` : '',
    answers.step8 ? `멘탈/기타: ${answers.step8}` : ''
  ].filter(Boolean);
  const mockExam = examType && examType !== '미응시'
    ? {
      type: examType,
      proofFile: examFileUrls[0] || '',
      proofFiles: examFileUrls,
      scores: {
        koreanType: shortText(examScores.koreanType, 50),
        koreanRaw: shortText(examScores.koreanRaw, 10),
        mathType: shortText(examScores.mathType, 50),
        mathRaw: shortText(examScores.mathRaw, 10),
        englishGrade: shortText(examScores.englishGrade, 10),
        inq1Name: shortText(examScores.inq1Name, 50),
        inq1Raw: shortText(examScores.inq1Raw, 10),
        inq2Name: shortText(examScores.inq2Name, 50),
        inq2Raw: shortText(examScores.inq2Raw, 10)
      }
    }
    : { type: 'none', scores: {} };

  return {
    weekId,
    date: now.toISOString(),
    title: `20${weekId.slice(0, 2)}년 ${Number(weekId.slice(2, 4))}월 ${Number(weekId.slice(4, 6))}주차 학습점검`,
    formVersion: 1,
    studyTime: {
      details,
      totalPlan: `${Number(totalPlan.toFixed(1))}H`,
      totalAct: `${Number(totalAct.toFixed(1))}H`,
      totalRate: `${totalRate}%`
    },
    mockExam,
    trend: {
      value: trend || '',
      dropReasons,
      reason: shortText(answers.step4Reason, 200)
    },
    deepAnswers,
    plannerFiles: plannerFileUrls
  };
}

export async function saveMobileWeeklyCheck({ apiFetch, reportApiUrl, payload } = {}) {
  if (typeof apiFetch !== 'function' || !reportApiUrl) return { ok: false, error: '주간 점검 저장 경로를 찾지 못했습니다.' };
  if (!payload?.title) return { ok: false, error: '주간 점검 데이터가 올바르지 않습니다.' };
  try {
    const response = await apiFetch(reportApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'save_weekly_check', data: payload })
    });
    const body = await response?.json?.().catch(() => null);
    if (!response?.ok) return { ok: false, error: body?.error || body?.message || '주간 점검 저장에 실패했습니다.' };
    return {
      ok: true,
      report: {
        weekId: payload.weekId,
        title: payload.title,
        date: payload.date,
        updatedAt: new Date().toISOString(),
        studyTime: payload.studyTime,
        mockExam: payload.mockExam,
        trend: payload.trend,
        deepAnswers: payload.deepAnswers
      }
    };
  } catch (_error) {
    return { ok: false, error: '네트워크 오류로 주간 점검을 저장하지 못했습니다.' };
  }
}

export function normalizeQnaHistory(payload) {
  const list = Array.isArray(payload?.qnaHistory) ? payload.qnaHistory : (Array.isArray(payload) ? payload : []);
  return list
    .filter((item) => item && item.qnaId)
    .map((item) => ({
      qnaId: String(item.qnaId || ''),
      title: item.title || '제목 없는 질문',
      content: item.content || '',
      status: item.status || 'waiting',
      answer: item.answer || '',
      createdAt: item.createdAt || '',
      answeredAt: item.answeredAt || ''
    }));
}

export async function fetchMobileQnaHistory({ apiFetch, qnaApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !qnaApiUrl) return null;
  const response = await apiFetch(qnaApiUrl, {
    method: 'POST',
    body: JSON.stringify({ type: 'get_qna_list' })
  });
  if (!response?.ok) return [];
  const data = await response.json().catch(() => null);
  return normalizeQnaHistory(data);
}

export async function saveMobileQna({ apiFetch, qnaApiUrl, title, content } = {}) {
  if (typeof apiFetch !== 'function' || !qnaApiUrl) return { ok: false, error: '질문 저장 경로를 찾지 못했습니다.' };
  const safeTitle = String(title || '').trim();
  const safeContent = String(content || '').trim();
  if (!safeTitle || !safeContent) return { ok: false, error: '질문 제목과 내용을 입력해주세요.' };
  try {
    const response = await apiFetch(qnaApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'save_qna', data: { title: safeTitle, content: safeContent } })
    });
    const body = await response?.json?.().catch(() => null);
    if (!response?.ok) return { ok: false, error: body?.error || body?.message || '질문 저장에 실패했습니다.' };
    const now = new Date().toISOString();
    return {
      ok: true,
      item: {
        qnaId: String(body?.qnaId || `local-${Date.now()}`),
        title: safeTitle,
        content: safeContent,
        status: 'waiting',
        answer: '',
        createdAt: now,
        answeredAt: ''
      }
    };
  } catch (_error) {
    return { ok: false, error: '네트워크 오류로 질문을 저장하지 못했습니다.' };
  }
}

// 알림 응답을 모바일 표시 모델로 정규화한다.
export function normalizeNotifications(payload) {
  const list = Array.isArray(payload?.notifications)
    ? payload.notifications
    : Array.isArray(payload)
      ? payload
      : [];
  return list
    .filter((item) => item && (item.notiId || item.id))
    .map((item) => ({
      notiId: String(item.notiId || item.id || ''),
      title: item.title || '알림',
      body: item.body || item.message || '',
      type: item.type || '',
      isRead: item.isRead === true,
      createdAt: item.createdAt || ''
    }));
}

export async function fetchMobileNotifications({ apiFetch, notiApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !notiApiUrl) return null;
  const response = await apiFetch(notiApiUrl, {
    method: 'POST',
    body: JSON.stringify({ type: 'student_get_notifications' })
  });
  if (!response?.ok) return [];
  const data = await response.json().catch(() => null);
  return normalizeNotifications(data);
}

// 알림 읽음 처리.
export async function markMobileNotificationsRead({ apiFetch, notiApiUrl, notiId = 'all' } = {}) {
  if (typeof apiFetch !== 'function' || !notiApiUrl) return { ok: false };
  try {
    const response = await apiFetch(notiApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'student_read_notification', data: { notiId } })
    });
    return { ok: !!response?.ok };
  } catch (_error) {
    return { ok: false };
  }
}

// ── 개인 수험 일정(admissionCalendar) ─────────────────────────────────────
// 로그인 사용자는 서버 응답을 단일 기준으로 삼고, localStorage는 미로그인 로컬 점검에서만 사용한다.
export async function fetchMobileAdmissionCalendar({ apiFetch, userApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !userApiUrl) return null;
  try {
    const response = await apiFetch(userApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'get_admission_calendar' })
    });
    if (!response?.ok) return null;
    const data = await response.json().catch(() => null);
    return Array.isArray(data?.events)
      ? data.events.map((event) => normalizePersonalEvent(event)).filter(Boolean)
      : [];
  } catch (error) {
    if (error?.code === 'AUTH_EXPIRED') throw error;
    return null;
  }
}

export async function upsertMobileAdmissionEvent({ apiFetch, userApiUrl, event } = {}) {
  const result = await postUserData({ apiFetch, userApiUrl, type: 'upsert_admission_calendar_event', data: event });
  if (!result.ok) return result;
  const events = Array.isArray(result.data?.events)
    ? result.data.events.map((item) => normalizePersonalEvent(item)).filter(Boolean)
    : [];
  const savedEvent = result.data?.event ? normalizePersonalEvent(result.data.event) : null;
  return { ...result, events, event: savedEvent };
}

export async function deleteMobileAdmissionEvent({ apiFetch, userApiUrl, eventId } = {}) {
  const result = await postUserData({ apiFetch, userApiUrl, type: 'delete_admission_calendar_event', data: { id: eventId } });
  if (!result.ok) return result;
  const events = Array.isArray(result.data?.events)
    ? result.data.events.map((item) => normalizePersonalEvent(item)).filter(Boolean)
    : [];
  return { ...result, events };
}

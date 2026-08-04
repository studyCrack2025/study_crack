import { apiFailure, apiSuccess, postJson } from '../../shared/api/client.js';
import { parseTargetMajor, toAnalysisTargetPayload } from './target-model.js';

function isConvertedMetric(metric) {
  return metric
    && Number.isFinite(Number(metric.std))
    && Number.isFinite(Number(metric.pct))
    && Number.isFinite(Number(metric.grd));
}

async function convertSubjectScore({ analysisApiUrl, apiFetch, payload }) {
  const result = await postJson({
    apiFetch,
    url: analysisApiUrl,
    payload: { type: 'convert_score', ...payload },
    fallbackError: '성적 환산에 실패했습니다.'
  });
  if (!result.ok) return result;
  if (!isConvertedMetric(result.data)) {
    return apiFailure(result.data?.error || '입력한 원점수 조합에 해당하는 성적표 데이터를 찾지 못했습니다.', { status: result.status });
  }
  return apiSuccess({
    std: Number(result.data.std),
    pct: Number(result.data.pct),
    grd: Number(result.data.grd)
  }, { status: result.status });
}

export async function convertExamScores({ analysisApiUrl, apiFetch, examData, examMode } = {}) {
  if (!examData?.kor || !examData?.math || !examData?.inq1 || !examData?.inq2) {
    return apiFailure('환산할 성적 정보가 충분하지 않습니다.');
  }
  const results = await Promise.all([
    convertSubjectScore({ apiFetch, analysisApiUrl, payload: { subject: 'kor', score: examData.kor.raw, opt: examData.kor.opt, common: examData.kor.common, elective: examData.kor.elective, month: examMode } }),
    convertSubjectScore({ apiFetch, analysisApiUrl, payload: { subject: 'math', score: examData.math.raw, opt: examData.math.opt, common: examData.math.common, elective: examData.math.elective, month: examMode } }),
    convertSubjectScore({ apiFetch, analysisApiUrl, payload: { subject: 'inq1', score: examData.inq1.raw, subName: examData.inq1.name, month: examMode } }),
    convertSubjectScore({ apiFetch, analysisApiUrl, payload: { subject: 'inq2', score: examData.inq2.raw, subName: examData.inq2.name, month: examMode } })
  ]);
  const failure = results.find((result) => !result.ok);
  if (failure) return failure;
  const [kor, math, inq1, inq2] = results.map((result) => result.data);
  return apiSuccess({
    ...examData,
    kor: { ...examData.kor, ...kor },
    math: { ...examData.math, ...math },
    inq1: { ...examData.inq1, ...inq1 },
    inq2: { ...examData.inq2, ...inq2 }
  });
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
    map.set(univName, Array.from(new Set([...(map.get(univName) || []), ...majors])).sort((a, b) => a.localeCompare(b, 'ko')));
  });
  return Array.from(map, ([univName, majors]) => ({ univName, majors }))
    .sort((a, b) => a.univName.localeCompare(b.univName, 'ko'));
}

export async function fetchUniversityCatalog({ analysisApiUrl, apiFetch, signal } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: analysisApiUrl,
    payload: { type: 'get_univ_list_only' },
    fallbackError: '대학·학과 목록을 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  const catalog = normalizeUniversityCatalog(result.data);
  return catalog.length
    ? apiSuccess(catalog, { status: result.status })
    : apiFailure('대학·학과 목록이 비어 있습니다.', { status: result.status });
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

export async function fetchUniversityRecommendations({ analysisApiUrl, apiFetch, examData, examMode, excludeTargets = [], savedStream = '', signal } = {}) {
  if (!examData) return apiFailure('추천에 필요한 성적 정보가 없습니다.');
  const totalStdScore = ['kor', 'math', 'inq1', 'inq2'].reduce((sum, key) => sum + (Number(examData?.[key]?.std) || 0), 0);
  if (!totalStdScore) return apiFailure('표준점수가 포함된 성적을 먼저 저장해주세요.');
  const result = await postJson({
    apiFetch,
    signal,
    url: analysisApiUrl,
    fallbackError: '추천 대학을 불러오지 못했습니다.',
    payload: {
      type: 'get_tutorial_recommendations',
      userScores: examData,
      stream: inferRecommendationStream(examData, savedStream),
      totalStdScore,
      examMode,
      excludeUnivs: (excludeTargets || []).map(parseTargetMajor).filter(Boolean)
    }
  });
  if (!result.ok) return result;
  const recommendations = Array.from(new Set((Array.isArray(result.data?.selected) ? result.data.selected : [])
    .map((item) => `${String(item?.school || item?.univ || '').trim()} ${String(item?.major || '').trim()}`.trim())
    .filter((label) => label && label.includes(' '))))
    .slice(0, 3);
  return apiSuccess(recommendations, { status: result.status });
}

function normalizeAnalysisResults(payload) {
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : (Array.isArray(payload?.data) ? payload.data : []));
  return list.filter((item) => item && item.univ && item.major);
}

function normalizeSimulationResults(payload) {
  return (Array.isArray(payload) ? payload : []).filter((item) => item && item.univ && item.major);
}

export async function fetchMobileTargetAnalysis({ analysisApiUrl, apiFetch, examMode, signal, targetList, userScores } = {}) {
  const targetUnivs = toAnalysisTargetPayload(targetList);
  if (!userScores || !targetUnivs.length) return apiFailure('분석할 성적과 지원 대학을 먼저 선택해주세요.');
  const result = await postJson({
    apiFetch,
    signal,
    url: analysisApiUrl,
    payload: { type: 'analyze_my_targets', targetUnivs, userScores, examMode },
    fallbackError: '분석 결과를 불러오지 못했습니다.'
  });
  if (!result.ok) return { ...result, data: { analysisResults: [], simulationResults: [] } };
  return apiSuccess({ analysisResults: normalizeAnalysisResults(result.data), simulationResults: [] }, { status: result.status });
}

export async function fetchMobileScoreSimulation({ analysisApiUrl, apiFetch, examMode, signal, targetList, userScores } = {}) {
  const targetUnivs = toAnalysisTargetPayload(targetList);
  if (!userScores || !targetUnivs.length) return apiFailure('시뮬레이션할 성적과 지원 대학을 먼저 선택해주세요.');
  const result = await postJson({
    apiFetch,
    signal,
    url: analysisApiUrl,
    payload: { type: 'simulate_score_rise', targetUnivs, userScores, examMode },
    fallbackError: '시뮬레이션 결과를 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  return apiSuccess(normalizeSimulationResults(result.data), { status: result.status });
}

export async function fetchMobileBacktrace({ analysisApiUrl, apiFetch, examMode, signal, targetMajor, userScores } = {}) {
  const targetUniv = parseTargetMajor(targetMajor);
  if (!userScores) return apiFailure('역산에 필요한 성적 정보를 찾지 못했습니다.');
  if (!targetUniv?.univ || !targetUniv?.major) return apiFailure('분석할 대학과 학과를 먼저 선택해주세요.');
  const result = await postJson({
    apiFetch,
    signal,
    url: analysisApiUrl,
    fallbackError: '필요 원점수 조합을 계산하지 못했습니다.',
    payload: { type: 'backtrace_required_raw', targetUniv, userScores, examMode, targetUiMin: 100, targetUiMax: 150, maxTotalRaw: 20 }
  });
  if (!result.ok) return result;
  return apiSuccess(result.data?.result || result.data?.backtrace_plan || null, { status: result.status });
}

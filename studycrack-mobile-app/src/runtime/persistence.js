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
  } catch (_error) {
    return { ok: false, error: '네트워크 오류로 저장하지 못했습니다.' };
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

export function buildTargetUnivsPayload(targetList = [], nowIso = new Date().toISOString()) {
  const unique = Array.from(new Set((targetList || []).map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 6);
  return unique.map((item) => {
    const parsed = parseTargetMajor(item);
    return parsed ? { ...parsed, date: nowIso } : null;
  });
}

export function saveTargetUnivs({ apiFetch, userApiUrl, targetList } = {}) {
  return postUserData({
    apiFetch,
    userApiUrl,
    type: 'update_target_univs',
    data: buildTargetUnivsPayload(targetList)
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

export function saveQualitative({ apiFetch, userApiUrl, qualitative } = {}) {
  return postUserData({
    apiFetch,
    userApiUrl,
    type: 'update_qual',
    data: qualitative || {}
  });
}

function normalizeUniversityCatalog(data) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.univs) ? data.univs : []);
  return Array.from(
    new Set(
      list.flatMap((item) => {
        const univName = String(item?.univName || item?.univ || '').trim();
        const majors = Array.isArray(item?.majors) ? item.majors : [];
        if (!univName) return [];
        if (!majors.length) return [univName];
        return majors
          .map((major) => {
            const name = typeof major === 'string' ? major : major?.name;
            const majorName = String(name || '').trim();
            return majorName ? `${univName} ${majorName}` : univName;
          })
          .filter(Boolean);
      })
    )
  );
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

export async function fetchMobileTargetAnalysis({ apiFetch, analysisApiUrl, targetList, userScores, examMode } = {}) {
  if (typeof apiFetch !== 'function' || !analysisApiUrl || !userScores) return null;
  const targetUnivs = toAnalysisTargetPayload(targetList);
  if (!targetUnivs.length) return null;

  const request = (type) =>
    apiFetch(analysisApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type, targetUnivs, userScores, examMode })
    });

  const [analysisRes, simulationRes] = await Promise.allSettled([
    request('analyze_my_targets'),
    request('simulate_score_rise')
  ]);

  let analysisResults = [];
  let simulationResults = [];

  if (analysisRes.status === 'fulfilled' && analysisRes.value?.ok) {
    const data = await analysisRes.value.json().catch(() => null);
    analysisResults = normalizeAnalysisResults(data);
  }
  if (simulationRes.status === 'fulfilled' && simulationRes.value?.ok) {
    const data = await simulationRes.value.json().catch(() => null);
    simulationResults = normalizeSimulationResults(data);
  }

  return { analysisResults, simulationResults };
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

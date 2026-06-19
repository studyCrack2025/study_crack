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

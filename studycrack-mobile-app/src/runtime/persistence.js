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

function parseTargetMajor(value) {
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

// 백엔드 결합 B3: 세션 인지 + 사용자 데이터 로드.
// 쿠키 세션이 있을 때만 get_user로 실데이터를 가져와 mock 위에 병합한다(미인증/실패 시 데모 유지 — 순수 가산).
// apiFetch는 웹 js/shared/api.js의 단일 출처(credentials:'include'+401 refresh). 여기선 호출만 한다.

// dev 진단 표면: get_user 결과를 window.__scGetUser에 기록(콘솔/주소창에서 한 줄로 원인 판별).
// 실데이터 흐름이 확정되면 제거.
function recordDebug(info) {
  if (typeof window !== 'undefined') {
    window.__scGetUser = { t: Date.now(), ...info };
  }
}

// get_user 호출. 성공 시 백엔드 userData(학생 레코드, 민감필드 제거됨) 반환, 그 외 null.
export async function fetchCurrentUser({ apiFetch, userApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !userApiUrl) {
    recordDebug({ ok: false, reason: 'no-apiFetch-or-url', hasFetch: typeof apiFetch === 'function', userApiUrl: userApiUrl || null });
    return null;
  }
  try {
    const res = await apiFetch(userApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'get_user' })
    });
    if (!res || !res.ok) {
      recordDebug({ ok: false, reason: 'non-ok', status: res ? res.status : null });
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      recordDebug({ ok: false, reason: 'bad-json', status: res.status });
      return null;
    }
    recordDebug({ ok: true, status: res.status, name: data.name || null, computedTier: data.computedTier || null, keys: Object.keys(data).slice(0, 20) });
    return data;
  } catch (error) {
    // 미인증/네트워크/CORS 실패 → 데모 유지(throw 안 함).
    recordDebug({ ok: false, reason: 'throw', error: String((error && error.message) || error) });
    return null;
  }
}

// 백엔드 computedTier(소문자 tier) → 마이/요금 UI가 읽는 표시 plan명.
// 등급 시스템: free/trial/basic/starter/standard/pro (ARCHITECTURE.md §6).
const TIER_TO_PLAN_DISPLAY = {
  free: 'Free',
  trial: 'Trial',
  basic: 'Basic',
  starter: 'Starter',
  standard: 'Standard',
  pro: 'Pro'
};

// 백엔드 userData → 모듈 state 병합 패치.
// R1: 웹 소비처와 동일 필드명(data.name/computedTier) 사용 + UI가 실제 읽는 state 필드로 매핑.
//   - name      → user.name      (마이 카드가 user?.name 사용)
//   - computedTier → selectedPlan(표시) + userTier(원시, 후속 게이팅용). 마이 등급 배지가 selectedPlan 사용.
// 성적(quantitative)·목표대학(targetUnivs) 전체 매핑은 R3에서 확장.
export function mapUserToStatePatch(userData, base = {}) {
  if (!userData || typeof userData !== 'object') return {};
  const patch = {};
  if (userData.name) patch.user = { ...(base.user || {}), name: userData.name };
  if (userData.computedTier) {
    const tier = String(userData.computedTier).toLowerCase();
    patch.userTier = tier;
    patch.selectedPlan = TIER_TO_PLAN_DISPLAY[tier] || (base.selectedPlan || '');
  }
  return patch;
}

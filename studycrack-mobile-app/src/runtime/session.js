// 백엔드 결합 B3: 세션 인지 + 사용자 데이터 로드.
// 쿠키 세션이 있을 때만 get_user로 실데이터를 가져와 mock 위에 병합한다(미인증/실패 시 데모 유지 — 순수 가산).
// apiFetch는 웹 js/shared/api.js의 단일 출처(credentials:'include'+401 refresh). 여기선 호출만 한다.

// get_user 호출. 성공 시 백엔드 userData(학생 레코드, 민감필드 제거됨) 반환, 그 외 null.
// 미인증/네트워크/CORS 실패는 throw 없이 null(데모 유지).
export async function fetchCurrentUser({ apiFetch, userApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !userApiUrl) return null;
  try {
    const res = await apiFetch(userApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'get_user' })
    });
    if (!res || !res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && typeof data === 'object' ? data : null;
  } catch (_error) {
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

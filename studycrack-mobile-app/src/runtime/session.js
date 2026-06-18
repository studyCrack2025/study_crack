// 백엔드 결합 B3: 세션 인지 + 사용자 데이터 로드.
// 쿠키 세션이 있을 때만 get_user로 실데이터를 가져와 mock 위에 병합한다(미인증/실패 시 데모 유지 — 순수 가산).
// apiFetch는 웹 js/shared/api.js의 단일 출처(credentials:'include'+401 refresh). 여기선 호출만 한다.

// get_user 호출. 성공 시 백엔드 userData(학생 레코드, 민감필드 제거됨) 반환, 그 외 null.
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
    // 미인증/네트워크/CORS 실패 → 데모 유지(throw 안 함).
    return null;
  }
}

// 백엔드 userData → 모듈 state 병합 패치(B3a 안전 최소 필드: name/tier).
// 성적(qual/quan)·목표대학 등 전체 매핑은 dev 세션 검증 후 후속 단계(B3b)에서 확장.
export function mapUserToStatePatch(userData, base = {}) {
  if (!userData || typeof userData !== 'object') return {};
  const patch = {};
  if (userData.name) patch.user = { ...(base.user || {}), name: userData.name };
  if (userData.computedTier) patch.userTier = String(userData.computedTier);
  return patch;
}

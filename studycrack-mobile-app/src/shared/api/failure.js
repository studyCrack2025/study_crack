export function describeFailure({ status = 0, code = '', name = '' } = {}, fallback = '요청을 처리하지 못했습니다.') {
  if (code === 'REQUEST_ABORTED' || name === 'AbortError') return { code: 'REQUEST_ABORTED', message: '요청이 취소됐어요.' };
  if (code === 'AUTH_EXPIRED' || status === 401) return { code: 'AUTH_EXPIRED', message: '로그인이 만료됐어요. 다시 로그인해주세요.' };
  if (code === 'OFFLINE') return { code, message: '오프라인 상태예요. 연결 후 다시 시도해주세요.' };
  if (code === 'TIMEOUT') return { code, message: '응답을 확인하지 못했어요. 연결 상태와 처리 결과를 확인한 뒤 다시 시도해주세요.' };
  if (status === 403) return { code: code || 'FORBIDDEN', message: '이 작업을 이용할 권한이 없어요. 계정과 이용 중인 플랜을 확인해주세요.' };
  if (status === 404) return { code: code || 'NOT_FOUND', message: '요청한 정보를 찾을 수 없어요. 최신 목록을 다시 확인해주세요.' };
  if (status === 409) return { code: code || 'CONFLICT', message: '현재 상태에서는 처리할 수 없어요. 최신 상태를 확인한 뒤 다시 시도해주세요.' };
  if (status === 429) return { code: code || 'RATE_LIMITED', message: '요청이 잠시 많아졌어요. 잠시 후 다시 시도해주세요.' };
  if (status >= 500) return { code: code || 'SERVER_ERROR', message: '서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해주세요.' };
  if (!status && !code) return { code: 'NETWORK_ERROR', message: '연결을 확인하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해주세요.' };
  return { code, message: fallback };
}

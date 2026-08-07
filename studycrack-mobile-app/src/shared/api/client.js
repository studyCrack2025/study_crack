let authExpiredHandler = null;

/**
 * @template T
 * @typedef {{ ok: true, data: T, error: '', status: number, code: string }|{ ok: false, data: T|null, error: string, status: number, code: string }} ApiResult
 */

export function setApiAuthExpiredHandler(handler) {
  authExpiredHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (authExpiredHandler === handler) authExpiredHandler = null;
  };
}

function notifyAuthExpired(result) {
  if (result?.code === 'AUTH_EXPIRED') authExpiredHandler?.(result);
  return result;
}

/** @template T @param {T} data @returns {ApiResult<T>} */
export function apiSuccess(data = null, { code = '', status = 200 } = {}) {
  return { ok: true, data, error: '', status, code };
}

/** @returns {ApiResult<unknown>} */
export function apiFailure(error, { code = '', data = null, status = 0 } = {}) {
  return { ok: false, data, error: String(error || '요청을 처리하지 못했습니다.'), status, code };
}

/** @returns {ApiResult<unknown>} */
export function apiInvalidResponse(result, error = '서버 응답 형식이 올바르지 않습니다.') {
  return apiFailure(error, {
    code: 'INVALID_RESPONSE',
    status: Number(result?.status || 0)
  });
}

async function readResponseBody(response) {
  return response?.json?.().catch(() => null) ?? null;
}

export async function requestJson({ apiFetch, fallbackError = '요청을 처리하지 못했습니다.', options = {}, url } = {}) {
  if (typeof apiFetch !== 'function' || !url) {
    return apiFailure('API 설정을 불러오지 못했습니다.');
  }
  try {
    const response = await apiFetch(url, options);
    const body = await readResponseBody(response);
    if (!response?.ok) {
      return notifyAuthExpired(apiFailure(body?.error || body?.message || fallbackError, {
        code: body?.code || '',
        data: body,
        status: response?.status || 0
      }));
    }
    return apiSuccess(body, { status: response?.status || 200 });
  } catch (error) {
    return notifyAuthExpired(apiFailure(error?.message || fallbackError, {
      code: error?.code || '',
      status: error?.status || 0
    }));
  }
}

export function postJson({ apiFetch, fallbackError, payload, signal, url } = {}) {
  return requestJson({
    apiFetch,
    fallbackError,
    url,
    options: { method: 'POST', body: JSON.stringify(payload || {}), ...(signal ? { signal } : {}) }
  });
}

export function postUserData({ apiFetch, data, fallbackError = '저장에 실패했습니다.', type, userApiUrl } = {}) {
  return postJson({ apiFetch, fallbackError, url: userApiUrl, payload: { type, data } });
}

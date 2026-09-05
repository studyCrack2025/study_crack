import { describeFailure } from './failure.js';

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

export async function requestJson({ apiFetch, fallbackError = '요청을 처리하지 못했습니다.', options = {}, timeoutMs = 45000, url } = {}) {
  if (typeof apiFetch !== 'function' || !url) {
    return apiFailure('API 설정을 불러오지 못했습니다.');
  }
  const failure = (error = {}) => {
    const description = describeFailure(error, fallbackError);
    return notifyAuthExpired(apiFailure(description.message, { code: description.code, status: Number(error.status || 0) }));
  };
  if (globalThis.navigator?.onLine === false) return failure({ code: 'OFFLINE' });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  let timer;
  try {
    const interrupted = new Promise((_, reject) => {
      const abort = () => reject(Object.assign(new Error(), { code: 'REQUEST_ABORTED' }));
      controller.signal.addEventListener('abort', abort, { once: true });
      if (controller.signal.aborted) abort();
      timer = setTimeout(() => {
        reject(Object.assign(new Error(), { code: 'TIMEOUT' }));
        controller.abort();
      }, timeoutMs);
    });
    const request = async () => {
      if (controller.signal.aborted) return failure({ code: 'REQUEST_ABORTED' });
      const response = await apiFetch(url, { ...options, signal: controller.signal });
      const body = await readResponseBody(response);
      if (controller.signal.aborted) return failure({ code: 'REQUEST_ABORTED' });
      if (!response?.ok) return failure({ code: body?.code || '', status: response?.status || 0 });
      return apiSuccess(body, { status: response?.status || 200 });
    };
    return await Promise.race([request(), interrupted]);
  } catch (error) {
    return failure(error);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
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

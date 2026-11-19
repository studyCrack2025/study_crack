import { getBrowser } from './mobile-runtime.js';

export function getConsultingRuntimeContext() {
  const browser = getBrowser();
  let userRole = '';
  try { userRole = browser?.localStorage?.getItem?.('userRole') || ''; } catch (_error) {}
  return {
    apiFetch: browser?.apiFetch || null,
    consultingApiUrl: browser?.CONFIG?.api?.consulting || '',
    pdfApiUrl: browser?.CONFIG?.api?.pdf || '',
    fileApiUrl: browser?.CONFIG?.api?.file || '',
    fetchImpl: browser?.fetch?.bind(browser) || globalThis.fetch,
    hasClientSession: browser?.hasClientSession || (() => false),
    publicApiUrl: browser?.CONFIG?.api?.consultingPublic || '',
    verifySession: browser?.tryRefreshToken,
    userRole
  };
}

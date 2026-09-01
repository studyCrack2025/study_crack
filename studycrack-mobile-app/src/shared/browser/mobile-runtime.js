function getBrowser() {
  return typeof window === 'undefined' ? null : window;
}

export function getMobileApiBinding(endpoint, urlProperty) {
  const browser = getBrowser();
  return {
    apiFetch: browser?.apiFetch || null,
    [urlProperty]: browser?.CONFIG?.api?.[endpoint] || ''
  };
}

export function getMobileFileApiBinding() {
  const browser = getBrowser();
  return {
    apiFetch: browser?.apiFetch || null,
    fetchImpl: browser?.fetch?.bind(browser) || globalThis.fetch,
    fileApiUrl: browser?.CONFIG?.api?.file || ''
  };
}

export function hasMobileClientSession() {
  const browser = getBrowser();
  return typeof browser?.hasClientSession === 'function' && browser.hasClientSession();
}

export function getMobileRuntimeContext() {
  const browser = getBrowser();
  return {
    authApiUrl: browser?.CONFIG?.api?.auth || '',
    analysisApiUrl: browser?.CONFIG?.api?.analysis || '',
    apiBase: browser?.CONFIG?.api || null,
    apiFetch: browser?.apiFetch || null,
    consultingApiUrl: browser?.CONFIG?.api?.consulting || '',
    consultingPublicApiUrl: browser?.CONFIG?.api?.consultingPublic || '',
    gameApiUrl: browser?.CONFIG?.api?.game || '',
    userApiUrl: browser?.CONFIG?.api?.user || '',
    notiApiUrl: browser?.CONFIG?.api?.noti || '',
    paymentApiUrl: browser?.CONFIG?.api?.payment || '',
    hasClientSession: browser?.hasClientSession || (() => false),
    redirectToLogin: browser?.redirectToLogin || (() => {})
  };
}

export function markMobileAppBooted({ crackySrc, onboardingLogoSrc } = {}) {
  const browser = getBrowser();
  if (!browser) return;
  browser.__studycrackAppBooted = true;
  browser.__studycrackAssetSrc = {
    ...(browser.__studycrackAssetSrc || {}),
    crackySrc,
    onboardingLogoSrc
  };
}

export function getMobileRootElement() {
  const browser = getBrowser();
  return browser?.document?.getElementById?.('root') || browser?.document?.body || null;
}

export function persistMobileUserRole(role) {
  try {
    getBrowser()?.localStorage?.setItem?.('userRole', String(role || ''));
  } catch (_error) {}
}

export function getMobileLocation() {
  return getBrowser()?.location || null;
}

export function replaceMobileLocation(path) {
  getBrowser()?.location?.replace?.(path);
}

export function reloadMobileLocation() {
  getBrowser()?.location?.reload?.();
}

export function replaceMobileScreenParam(screen) {
  const browser = getBrowser();
  if (!browser?.location || !browser?.history) return;
  try {
    const url = new URL(browser.location.href);
    url.searchParams.set('screen', screen);
    browser.history.replaceState(browser.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (_error) {}
}

export function isLocalMobilePreview() {
  const host = getBrowser()?.location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

export function getMobileBrowserServices() {
  const browser = getBrowser();
  return {
    alert: browser?.alert?.bind(browser) || (() => {}),
    api: browser?.CONFIG?.api || {},
    apiFetch: browser?.apiFetch || null,
    browser
  };
}

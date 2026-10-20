export const CONSULTING_BASE = '/2027-jungsi-consulting';

export const CONSULTING_ROUTES = Object.freeze({
  landing: CONSULTING_BASE,
  start: `${CONSULTING_BASE}/start`,
  login: `${CONSULTING_BASE}/login`,
  home: `${CONSULTING_BASE}/home`,
  survey: `${CONSULTING_BASE}/survey`,
  materials: `${CONSULTING_BASE}/materials`,
  schedule: `${CONSULTING_BASE}/schedule`,
  writtenSession: `${CONSULTING_BASE}/written-session`,
  report: `${CONSULTING_BASE}/report`,
  finalCall: `${CONSULTING_BASE}/final-call`
});

const ROUTE_SCREEN = Object.freeze(Object.fromEntries(Object.entries(CONSULTING_ROUTES).filter(([key]) => key !== 'landing').map(([key, path]) => [path, key])));

export function resolveConsultingRoute(pathname) {
  return Object.freeze({ path: pathname, screen: ROUTE_SCREEN[pathname] || 'unknown', protected: ![CONSULTING_ROUTES.start, CONSULTING_ROUTES.login].includes(pathname) });
}

export function navigateConsulting(path, { replace = false } = {}) {
  if (!Object.values(CONSULTING_ROUTES).includes(path) || path === CONSULTING_ROUTES.landing) return false;
  globalThis.history?.[replace ? 'replaceState' : 'pushState']?.(null, '', path);
  globalThis.dispatchEvent?.(new PopStateEvent('popstate'));
  return true;
}

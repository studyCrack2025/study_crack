import { clearMobileAuthArtifacts } from './auth-service.js';
import {
  getMobileBrowserServices,
  getMobileLocation,
  replaceMobileLocation
} from '../../shared/browser/mobile-runtime.js';

function getRoleLoginPath(role) {
  if (role === 'admin') return '/admin/login';
  if (role === 'tutor') return '/tutor/login';
  return '/login';
}

export async function blockNonStudentMobileSession(role) {
  const runtime = getMobileBrowserServices();
  try {
    await runtime.apiFetch?.(runtime.api.auth, {
      method: 'POST',
      body: JSON.stringify({ type: 'logout' })
    });
  } catch (_error) {}
  try {
    clearMobileAuthArtifacts(runtime.browser);
  } catch (_error) {}
  runtime.alert(role === 'tutor'
    ? '튜터 계정은 튜터 전용 페이지를 이용해주세요.'
    : '관리자 계정은 관리자 페이지를 이용해주세요.');
  replaceMobileLocation(getRoleLoginPath(role));
}

function getMobileExpiredLoginPath() {
  const path = getMobileLocation()?.pathname || '/studycrack-mobile.html';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/studycrack-mobile.html?screen=authLogin';
  }
  return `${path}?screen=authLogin`;
}

let mobileSessionExpiring = false;

export function expireMobileSessionSilently() {
  const runtime = getMobileBrowserServices();
  if (!runtime.browser || mobileSessionExpiring) return;
  mobileSessionExpiring = true;
  try {
    clearMobileAuthArtifacts(runtime.browser);
  } catch (_error) {}
  replaceMobileLocation(getMobileExpiredLoginPath());
}

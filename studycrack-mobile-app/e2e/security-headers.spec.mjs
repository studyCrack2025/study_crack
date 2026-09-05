import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { auditSecurityHeaders, inspectSecurityHeaders } from '../../tools/audit-security-headers.mjs';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test.skip(!process.env.STUDYCRACK_PREVIEW_ROOT, 'Requires the verified public artifact.');

test('실제 정적 응답 감사는 누락된 보호와 올바른 manifest MIME을 구분한다', async ({ baseURL }) => {
  const result = await auditSecurityHeaders({ origin: baseURL });
  expect(result.ok).toBe(false);
  expect(result.enforcementChanged).toBe(false);
  expect(result.results.find(({ path }) => path === '/studycrack-mobile').findings).toContain('csp_missing');
  const manifest = result.results.find(({ path }) => path.endsWith('.webmanifest'));
  expect(manifest.status).toBe(200);
  expect(manifest.findings).not.toContain('content_type_mismatch');
});

async function observeViolations(page) {
  await page.addInitScript(() => {
    window.__headerTestViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__headerTestViolations.push({ directive: event.effectiveDirective, disposition: event.disposition });
    });
  });
}

test('보고 전용 CSP는 앱 실행을 막지 않으며 적용 완료로 판정하지 않는다', async ({ page }) => {
  await installApiMock(page);
  await observeViolations(page);
  await page.route('**/studycrack-mobile.html?*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy-report-only': "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" } });
  });
  const response = await page.goto('/studycrack-mobile.html?screen=authLogin');
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__headerTestViolations.filter(({ directive, disposition }) => directive === 'script-src-elem' && disposition === 'report').length)).toBeGreaterThan(0);
  const inspected = inspectSecurityHeaders(new Headers(await response.allHeaders()), { document: true, https: false });
  expect(inspected.cspMode).toBe('report-only');
  expect(inspected.findings).toContain('csp_report_only_not_enforced');
});

test('로컬 hash CSP 실험은 기존 앱을 시작하고 승인하지 않은 인라인 실행은 차단한다', async ({ page }) => {
  const mockApiOrigin = 'https://api.example.test';
  await page.addInitScript((origin) => { window.STUDYCRACK_API_BASE_URL = origin; }, mockApiOrigin);
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await observeViolations(page);
  await page.route('**/studycrack-mobile.html?*', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
    expect(hashes.length).toBeGreaterThan(0);
    const csp = `default-src 'self'; script-src 'self' ${hashes.join(' ')}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${mockApiOrigin}; frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; manifest-src 'self'; worker-src 'none'`;
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()' } });
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '공부 시작', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__studycrackAppBooted)).toBe(true);
  expect(await page.evaluate(() => window.__headerTestViolations.filter(({ disposition }) => disposition === 'enforce'))).toEqual([]);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__unapprovedHeaderProbe = true;';
    document.body.append(script);
  });
  await expect.poll(() => page.evaluate(() => window.__headerTestViolations.filter(({ directive, disposition }) => directive === 'script-src-elem' && disposition === 'enforce').length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__unapprovedHeaderProbe)).toBeUndefined();
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
});

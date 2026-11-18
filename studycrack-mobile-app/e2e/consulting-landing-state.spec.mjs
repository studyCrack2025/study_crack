import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const { documents } = JSON.parse(await readFile(new URL('../../content/legal/legacy.json', import.meta.url), 'utf8'));

async function prepare(page, { signedIn = false, deferAuth = false, expired = false, unavailable = false, path = '/2027-jungsi-consulting#consulting' } = {}) {
  let releaseAuth;
  const gate = new Promise(resolve => { releaseAuth = resolve; });
  const authCalls = [];
  await page.addInitScript(signedIn => {
    if (signedIn) { localStorage.setItem('userId', 'student-synthetic'); localStorage.setItem('userRole', 'student'); }
  }, signedIn);
  await page.route('**/gtm.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.IS_LOCAL=false;
    window.CONFIG={api:{auth:'/__auth',consulting:'/__consulting',consultingPublic:'/__public'}};
  ` }));
  await page.route('**/__public', route => route.fulfill({ json: { success: false } }));
  await page.route('**/__auth', async route => {
    authCalls.push(route.request().postDataJSON());
    expect((await route.request().allHeaders()).authorization).toBeUndefined();
    if (deferAuth) await gate;
    await route.fulfill({ status: expired ? 401 : unavailable ? 503 : 200, json: expired ? { success: false, code: 'AUTH_SESSION_EXPIRED' } : { success: !unavailable } });
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  return { releaseAuth, authCalls };
}

test('실제 공통 세션 코드로 쿠키만 있는 초대 진입을 확인하고, 복구 뒤 조회만 한 번 재시도한다', async ({ page }) => {
  let statusCalls = 0;
  const claimCalls = [];
  await page.route('**/__consulting', async route => {
    const request = route.request().postDataJSON();
    if (request.type === 'student_claim_v2_consulting_invite') claimCalls.push(request);
    expect(request.type).toBe('student_get_v2_consulting_invite_status');
    expect((await route.request().allHeaders()).authorization).toBeUndefined();
    if (++statusCalls === 1) return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
    return route.fulfill({ json: { success: true, data: { linked: false, maskedEmail: 's***@example.invalid', maskedPhone: '010-****-0000', expiresAt: '2099-01-01T00:00:00Z' } } });
  });
  const { releaseAuth } = await prepare(page, { signedIn: true, deferAuth: true, path: `/2027-jungsi-consulting/start#app=APP_123e4567-e89b-12d3-a456-426614174000&invite=${'A'.repeat(43)}` });
  await expect(page.getByRole('status')).toHaveText('초대 정보를 확인하고 있습니다.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  expect(statusCalls).toBe(0);
  releaseAuth();
  await expect(page.getByLabel('이메일로 받은 10자리 인증코드')).toBeVisible();
  expect(statusCalls).toBe(2);
  expect(claimCalls).toEqual([]);
});

test('소개 페이지는 실제 로그인 확인 중 대기하고 확인된 세션에만 내 컨설팅을 표시한다', async ({ page }) => {
  const { releaseAuth, authCalls } = await prepare(page, { signedIn: true, deferAuth: true });
  const link = page.locator('#consultingAccountLink');
  await expect(link).toHaveText('로그인 확인 중…');
  await expect(link).toHaveAttribute('aria-busy', 'true');
  releaseAuth();
  await expect(link).toHaveText('나의 컨설팅 ↗');
  await expect(link).toHaveAttribute('href', '/2027-jungsi-consulting/home');
  expect(authCalls.map(call => call.type)).toEqual(['silent_refresh']);
  await page.evaluate(() => window.clearClientSession());
  await expect(link).toHaveText('이용자 로그인 ↗');
  await expect(link).toHaveAttribute('href', '/2027-jungsi-consulting/login');
});

test('로그아웃 후 늦게 도착한 확인 응답은 소개 페이지의 로그인 표시를 되살리지 않는다', async ({ page }) => {
  const { releaseAuth, authCalls } = await prepare(page, { signedIn: true, deferAuth: true });
  await expect.poll(() => authCalls.length).toBe(1);
  await page.evaluate(() => window.clearClientSession());
  releaseAuth();
  await expect(page.locator('#consultingAccountLink')).toHaveText('이용자 로그인 ↗');
  await expect(page.locator('#consultingAccountLink')).toHaveAttribute('aria-busy', 'false');
});

for (const mode of ['signedOut', 'expired', 'unavailable']) test(`소개 페이지 로그인 표시: ${mode}`, async ({ page }) => {
  const { authCalls } = await prepare(page, { signedIn: mode !== 'signedOut', expired: mode === 'expired', unavailable: mode === 'unavailable' });
  const link = page.locator('#consultingAccountLink');
  await expect(link).toHaveText(mode === 'unavailable' ? '컨설팅으로 이동 ↗' : '이용자 로그인 ↗');
  await expect(link).toHaveAttribute('aria-busy', 'false');
  expect(authCalls.length).toBe(mode === 'signedOut' ? 0 : 1);
});

for (const [path, title, ids] of [
  ['/terms', '이용약관', ['standard', 'service', 'marketing']],
  ['/refund', '환불 규정', ['refund']],
  ['/privacy', '개인정보처리방침', ['privacy']]
]) test(`${title}은 현재 소개 화면에서 공식 본문만 읽고 닫는다`, async ({ page }, testInfo) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 850 });
  const initial = page.url();
  const trigger = page.locator('footer nav').getByRole('link', { name: title, exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.jungsi-policy-body')).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.locator('#jungsiPolicyContent section')).toHaveCount(ids.length);
  for (const [index, id] of ids.entries()) {
    await expect(dialog.locator('#jungsiPolicyContent section').nth(index).locator('p')).toHaveText(documents[id].body);
  }
  await expect(dialog.getByRole('link', { name: '앱으로 이동' })).toHaveCount(0);
  expect(page.url()).toBe(initial);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('body').evaluate(node => getComputedStyle(node).overflow)).toBe('hidden');
  const close = dialog.getByRole('button', { name: '규정 닫기' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('.jungsi-policy-body')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  if (path === '/refund') await page.screenshot({ path: testInfo.outputPath('consulting-refund-overlay-320.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.locator('body').evaluate(node => getComputedStyle(node).overflow)).not.toBe('hidden');
  await trigger.click();
  await expect(dialog).toBeVisible();
  await close.click();
  await expect(trigger).toBeFocused();
});

test('규정 조회 실패도 현재 화면에서 재시도하고 FAQ의 환불 링크 역시 같은 창으로 연다', async ({ page }) => {
  await prepare(page);
  await page.route('**/refund', route => route.fulfill({ status: 503, body: '' }));
  await page.locator('footer nav a[href="/refund"]').click();
  const dialog = page.getByRole('dialog', { name: '환불 규정' });
  await expect(dialog.getByRole('status')).toContainText('규정을 불러오지 못했어요.');
  await page.unroute('**/refund');
  await dialog.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(dialog.locator('#jungsiPolicyContent section p')).toHaveText(documents.refund.body);
  await dialog.getByRole('button', { name: '규정 닫기' }).click();
  const faq = page.locator('#faq details').filter({ has: page.locator('a[href="/refund"]') });
  await faq.locator('summary').click();
  await faq.locator('a[href="/refund"]').click();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/2027-jungsi-consulting#consulting$/);
});

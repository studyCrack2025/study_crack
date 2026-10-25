import { expect, test } from '@playwright/test';
import { installApiMock } from './support/mock-api.mjs';

async function setup(page) {
  const api = await installApiMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('sc_session_ended', '1');
    localStorage.setItem('sc_session_epoch', 'logged-out-recovery');
    window.AmazonCognitoIdentity = { CognitoUserPool: class { getCurrentUser() { return null; } } };
  });
  await page.route('https://cdn.jsdelivr.net/npm/amazon-cognito-identity-js@*/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  const alerts = [];
  page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  return { api, alerts };
}

test('web recovery works after logout while protected requests remain blocked', async ({ page }) => {
  const { api, alerts } = await setup(page);
  await page.goto('/login');
  expect(await page.evaluate(async () => {
    try { await window.apiFetch(window.CONFIG.api.user, { method: 'POST', body: '{}' }); }
    catch (error) { return error.code; }
  })).toBe('AUTH_EXPIRED');
  await page.getByText('이메일 찾기', { exact: true }).first().click();
  await page.locator('#findEmailName').fill('테스트학생');
  await page.locator('#findEmailPhone').fill('01012345678');
  await page.locator('#findEmailModal .auth-btn').click();
  await expect(page.locator('#foundEmailResult')).toContainText('s***@example.com');
  expect(api.requests.find(({ payload }) => payload.type === 'find_email').payload.phone).toBe('010-1234-5678');
  await page.locator('#findEmailModal .close-btn').click();
  await page.getByText('비밀번호 찾기', { exact: true }).click();
  await page.locator('#forgotPwEmail').fill('student@example.com');
  await page.locator('#reqResetBtn').click();
  await expect(page.locator('#forgotPwStep2')).toBeVisible();
  await page.locator('#forgotPwCode').fill('123456');
  await page.locator('#forgotPwNew').fill('Synthetic1!');
  await page.locator('#forgotPwConfirm').fill('Synthetic1!');
  await page.locator('#forgotPwStep2 .auth-btn').click();
  await expect(page.locator('#forgotPwModal')).toBeHidden();
  expect(alerts.at(-1)).toContain('성공적으로 변경');
  expect(api.requests.map(({ payload }) => payload.type)).toEqual(['find_email', 'send_pw_reset_code', 'reset_password']);
  expect(await page.evaluate(() => localStorage.getItem('sc_session_ended'))).toBe('1');
});

test('web recovery distinguishes missing accounts and rate limits', async ({ page }) => {
  const { alerts } = await setup(page);
  let status = 404;
  await page.route('**/api/auth', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'private server detail' }) }));
  await page.goto('/login');
  await page.getByText('비밀번호 찾기', { exact: true }).click();
  await page.locator('#forgotPwEmail').fill('student@example.com');
  for (const [nextStatus, message] of [[404, '가입된 계정'], [429, '요청 횟수']]) {
    status = nextStatus;
    await page.locator('#reqResetBtn').click();
    await expect.poll(() => alerts.at(-1)).toContain(message);
    await expect(page.locator('#reqResetBtn')).toBeEnabled();
    await expect(page.locator('#forgotPwStep1')).toBeVisible();
  }
  expect(alerts.join(' ')).not.toContain('private');
});

test('mobile lookup after logout sends the signup phone format and reports server failure separately', async ({ page }) => {
  const { api, alerts } = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=authFindId');
  await page.locator('[data-find-email-name]').fill('테스트학생');
  await page.locator('[data-field="findEmailPhone"]').fill('01012345678');
  await page.getByRole('button', { name: '이메일 찾기', exact: true }).click();
  await expect(page.getByText('s***@example.com')).toBeVisible();
  expect(api.requests.find(({ payload }) => payload.type === 'find_email').payload.phone).toBe('010-1234-5678');
  await page.route('**/api/auth', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"private server detail"}' }));
  await page.goto('/studycrack-mobile.html?screen=authFindId');
  await page.locator('[data-find-email-name]').fill('테스트학생');
  await page.locator('[data-field="findEmailPhone"]').fill('01012345678');
  await page.getByRole('button', { name: '이메일 찾기', exact: true }).click();
  await expect.poll(() => alerts.at(-1)).toContain('서버에서 요청을 처리하지 못했습니다.');
  expect(alerts.at(-1)).not.toContain('일치하는 이메일');
  expect(alerts.at(-1)).not.toContain('private');
});

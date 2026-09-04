import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

const SURFACES = [
  ['my', 'my'],
  ['account', 'accountInfo'],
  ['notification-settings', 'notificationSettings'],
  ['notification-list', 'notificationList'],
  ['settings', 'settingsMain'],
  ['legal-picker', 'settingsTermsPicker'],
  ['support', 'customerSupport']
];

test('알림과 문의 오류는 빈 목록과 구분한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { failGameTypes: ['student_get_notifications', 'get_qna_list'] });
  await page.goto('/studycrack-mobile.html?screen=notificationList');
  await expect(page.getByText('알림을 불러오지 못했습니다.', { exact: true })).toBeVisible();
  await page.goto('/studycrack-mobile.html?screen=customerSupport');
  await expect(page.getByText('문의 내역을 불러오지 못했어요', { exact: true })).toBeVisible();
});

test('한글 조합 중 작성한 문의는 DOM의 최종 값으로 저장한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=customerSupport');
  await page.getByRole('button', { name: /일반 문의/ }).click();
  const dialog = page.getByRole('dialog');
  const title = dialog.locator('[data-field="qnaDraftTitle"]');
  const content = dialog.locator('[data-field="qnaDraftContent"]');
  await title.evaluate((element) => {
    element.focus();
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = '한글 조합 문의';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '한글 조합 문의', inputType: 'insertCompositionText', isComposing: true }));
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한글 조합 문의' }));
  });
  await content.evaluate((element) => {
    element.focus();
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = '조합이 끝난 문의 내용입니다.';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '조합이 끝난 문의 내용입니다.', inputType: 'insertCompositionText', isComposing: true }));
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '조합이 끝난 문의 내용입니다.' }));
  });
  page.once('dialog', (browserDialog) => browserDialog.accept());
  await dialog.getByRole('button', { name: '문의 접수' }).click();
  await expect.poll(() => api.requests.find(({ payload }) => payload.type === 'save_qna')?.payload.data).toEqual({
    title: '한글 조합 문의',
    content: '조합이 끝난 문의 내용입니다.'
  });
});

test('회원탈퇴는 소셜 본인 확인 토큰과 서버 삭제 성공 뒤에만 완료된다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { userOverrides: { authProvider: 'google' } });
  await page.goto('/studycrack-mobile.html?screen=accountInfo');
  await page.evaluate(() => sessionStorage.setItem('deleteConfirmToken', 'delete-confirm-e2e'));
  await page.locator('.account-withdraw-link').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('소셜 계정 본인 확인이 완료되었습니다.');
  page.once('dialog', (browserDialog) => browserDialog.accept());
  await dialog.getByRole('button', { name: '탈퇴하기' }).click();
  await expect.poll(() => api.requests.find(({ payload }) => payload.type === 'delete_user')?.payload.deleteConfirmToken).toBe('delete-confirm-e2e');
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
});

test('회원탈퇴 서버 요청이 실패하면 현재 세션과 확인 창을 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, {
    failOnceTypes: ['delete_user'],
    userOverrides: { authProvider: 'google' }
  });
  await page.goto('/studycrack-mobile.html?screen=accountInfo');
  await page.evaluate(() => sessionStorage.setItem('deleteConfirmToken', 'delete-confirm-failure'));
  await page.locator('.account-withdraw-link').click();
  const modal = page.getByRole('dialog');
  const alerts = [];
  page.on('dialog', async (browserDialog) => {
    alerts.push(browserDialog.message());
    await browserDialog.accept();
  });
  await modal.getByRole('button', { name: '탈퇴하기' }).click();
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'delete_user').length).toBe(1);
  await expect.poll(() => alerts.length).toBe(1);
  await expect(page.locator('[data-screen="accountInfo"]')).toBeVisible();
  await expect(modal).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(sessionStorage.getItem('accessToken')))).toBe(true);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('deleteConfirmToken'))).toBe('delete-confirm-failure');
});

test('소셜 본인 확인 전에는 탈퇴 성공 버튼을 노출하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { userOverrides: { authProvider: 'naver' } });
  await page.goto('/studycrack-mobile.html?screen=accountInfo');
  await page.locator('.account-withdraw-link').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Naver 계정으로 본인 확인' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '탈퇴하기' })).toHaveCount(0);
});

test('Phase 3 MY·설정·운영 화면은 네 viewport에서 경계를 지킨다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'standard' });
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const [name, screen] of SURFACES) {
      await page.goto(`/studycrack-mobile.html?screen=${screen}`);
      await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const frame = await page.locator('.app-frame').boundingBox();
      expect(frame).not.toBeNull();
      expect(frame.width).toBeLessThanOrEqual(viewport.width);
      expect(Math.abs(frame.height - viewport.height)).toBeLessThanOrEqual(1);
      const screenshotPath = testInfo.outputPath(`phase-three-${name}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach(`phase-three-${name}-${viewport.width}x${viewport.height}.png`, { path: screenshotPath, contentType: 'image/png' });
    }
  }
});

test('작은 화면의 긴 고객센터 내용도 마지막 FAQ까지 도달한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/studycrack-mobile.html?screen=customerSupport');
  const content = page.locator('.app-content');
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole('button', { name: /어떤 플랜을 선택해야 할지 모르겠어요/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

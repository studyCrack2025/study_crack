import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const target of ['ranking', 'weekly', 'report', 'proIntro', 'accountInfo', 'notificationList', 'settingsMain', 'customerSupport', 'my']) {
  test(`MY → ${target} → 뒤로는 메뉴 위치와 초점을 복원한다`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'pro' });
    await page.goto('/studycrack-mobile.html?screen=timer');
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    const drawer = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
    await expect(drawer.locator('.my-summary-notice')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    const button = drawer.locator(`[data-target="${target}"]`).first();
    await button.scrollIntoViewIfNeeded();
    await button.evaluate(el => el.addEventListener('click', () => {
      const body = el.closest('.my-summary-body');
      body.dataset.entryScroll = String(body.scrollTop);
    }, { capture: true, once: true }));
    await button.click();
    const scroll = await page.locator('.my-persistent-host .my-summary-body').evaluate(el => Number(el.dataset.entryScroll));
    await expect(page.locator(`[data-screen="${target}"]`)).toHaveAttribute('data-my-flow', 'true');
    await page.locator('[data-action="back"]').first().click();
    await expect(drawer).toBeVisible();
    await expect(button).toBeFocused();
    await testInfo.attach('restored-menu-geometry', { contentType: 'application/json', body: JSON.stringify(await drawer.locator('.my-summary-body').evaluate((el, saved) => ({ saved, scrollTop: el.scrollTop, maxScroll: el.scrollHeight - el.clientHeight }), scroll)) });
    await expect.poll(() => drawer.locator('.my-summary-body').evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0);
    await expect(drawer.locator('[data-action="openStudyRecords"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

test('MY 계정 하위 창은 우측 패널, 최종 로그아웃은 확인창을 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.locator('[data-target="accountInfo"]').click();
  await page.locator('[data-action="openMyProfileEdit"]').click();
  await expect(page.getByRole('dialog', { name: '이름 변경' })).toHaveClass(/sc-side-panel/);
  expect((await page.getByRole('dialog', { name: '이름 변경' }).getByRole('button', { name: '저장', exact: true }).boundingBox()).height).toBeLessThanOrEqual(56);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="accountInfo"]')).toBeVisible();
  await page.locator('[data-action="back"]').first().click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '로그아웃 확인', exact: true })).not.toHaveClass(/sc-side-panel/);
});

test('랭킹 직접 진입의 뒤로는 유령 MY를 만들지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=ranking');
  await page.locator('[data-action="back"]').first().click();
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '프로필 메뉴' })).toHaveCount(0);
});

for (const target of ['scoreInfo', 'qualInfo', 'accountInfo', 'customerSupport']) {
  test(`전체 MY → ${target} → 뒤로는 퇴장 중에도 drawer를 노출하지 않는다`, async ({ page }, testInfo) => {
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'pro' });
    await page.goto('/studycrack-mobile.html?screen=timer');
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    const drawer = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
    await drawer.getByRole('button', { name: '마이페이지 전체 보기' }).click();
    const full = page.locator('[data-screen="my"]');
    await expect(full).toBeVisible();
    await full.locator(`[data-target="${target}"]`).first().click();
    await expect(page.locator(`[data-screen="${target}"]`)).toBeVisible();
    await page.evaluate(() => {
      window.__myBackFrames = [];
      window.__myBackCapture = new Promise(resolve => {
        const start = performance.now();
        const sample = () => {
          const exiting = document.querySelector('.app-content[data-my-exit]');
          const host = document.querySelector('.my-persistent-host');
          if (exiting) window.__myBackFrames.push({
            shell: getComputedStyle(exiting.closest('.app-shell')).backgroundColor,
            frame: getComputedStyle(exiting.closest('.app-frame')).backgroundColor,
            suspended: host?.querySelector('.sc-overlay')?.hasAttribute('inert'),
            covered: host?.dataset.covered
          });
          if ((!exiting && document.querySelector('[data-screen="my"]')) || performance.now() - start > 2000) resolve(window.__myBackFrames);
          else requestAnimationFrame(sample);
        };
        document.querySelector('[data-action="back"]').click();
        sample();
      });
    });
    const frames = await page.evaluate(() => window.__myBackCapture);
    await testInfo.attach('full-my-back-frames', { contentType: 'application/json', body: JSON.stringify(frames) });
    expect(frames.length).toBeGreaterThan(1);
    for (const frame of frames) {
      expect(frame.shell).not.toBe('rgba(0, 0, 0, 0)');
      expect(frame.frame).not.toBe('rgba(0, 0, 0, 0)');
      expect(frame.suspended).toBe(true);
      expect(frame.covered).toBe('true');
    }
    await expect(full).toBeVisible();
    await expect(drawer).toBeHidden();
    await full.getByRole('button', { name: '뒤로가기', exact: true }).click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: '마이페이지 전체 보기' })).toBeFocused();
  });
}

test('전체 MY의 브라우저 뒤로는 전체보기, 그 다음은 원래 drawer로 돌아간다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  const drawer = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
  await drawer.getByRole('button', { name: '마이페이지 전체 보기' }).click();
  await page.locator('[data-screen="my"] [data-target="scoreInfo"]').click();
  await page.evaluate(() => history.back());
  await expect(page.locator('[data-screen="my"]')).toBeVisible();
  await expect(drawer).toBeHidden();
  await page.evaluate(() => history.back());
  await expect(drawer).toBeVisible();
});

test('직접 연 전체 MY에서 하위 화면 복귀는 drawer를 생성하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=my');
  await page.locator('[data-screen="my"] .my-menu-row[data-target="qualInfo"]').click();
  await page.getByRole('button', { name: '뒤로가기', exact: true }).click();
  await expect(page.locator('[data-screen="my"]')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '프로필 메뉴', exact: true })).toHaveCount(0);
});

test('전체 MY에서 정성 저장 실패는 입력을 유지하고 성공은 전체보기로 복귀한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failOnceTypes: ['update_qual'], userOverrides: { qualitative: { status: '고3', stream: 'natural' } } });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  const drawer = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
  await drawer.getByRole('button', { name: '마이페이지 전체 보기' }).click();
  await page.locator('[data-screen="my"] .my-menu-row[data-target="qualInfo"]').click();
  await page.locator('[data-ob-grade]').first().click();
  await page.locator('#qual-school').fill('검수 고등학교');
  await page.locator('#qual-track').selectOption({ index: 1 });
  await page.locator('#qual-goal').fill('입력 보존 확인');
  await page.getByRole('button', { name: '정성조사서 저장', exact: true }).click();
  await expect.poll(() => api.requests.filter(request => request.payload.type === 'update_qual').length).toBe(1);
  await expect(page.locator('#qual-goal')).toHaveValue('입력 보존 확인');
  await expect(page.locator('.qual-save-btn')).toBeEnabled();
  await page.getByRole('button', { name: '정성조사서 저장', exact: true }).click();
  await expect(page.locator('[data-screen="my"]')).toBeVisible();
  await expect(drawer).toBeHidden();
  await expect(page.locator('.profile-save-notice')).toContainText('저장했어요');
});

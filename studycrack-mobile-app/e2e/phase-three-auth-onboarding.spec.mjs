import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

const PUBLIC_SURFACES = [
  ['splash', '.splash-v2'],
  ['on1', '[data-screen="on1"]'],
  ['on2', '[data-screen="on2"]'],
  ['on3', '[data-screen="on3"]'],
  ['auth-login', '[data-screen="authLogin"]'],
  ['auth-signup', '[data-screen="authSignup"]'],
  ['auth-find-id', '[data-screen="authFindId"]'],
  ['auth-find-password', '[data-screen="authFindPw"]']
];

const MEMBER_SURFACES = [
  ['onboarding-1', '[data-screen="ob1"]'],
  ['onboarding-2', '[data-screen="ob2"]'],
  ['onboarding-3', '[data-screen="ob3"]'],
  ['onboarding-4', '[data-screen="ob4"]'],
  ['onboarding-5', '[data-screen="ob5"]'],
  ['legal-picker', '[data-screen="settingsTermsPicker"]'],
  ['privacy-policy', '[data-screen="privacyPolicy"]'],
  ['service-terms', '[data-screen="termsScreen"]']
];

function screenFromSelector(selector) {
  if (selector === '.splash-v2') return 'splash';
  return selector.match(/data-screen="([^"]+)/)?.[1] || '';
}

test('직접 계정 복구 화면은 이메일 확인과 비밀번호 코드 요청을 수행한다', async ({ page }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authFindId');
  await page.locator('[data-find-email-name]').fill('테스트학생');
  await page.locator('[data-field="findEmailPhone"]').fill('01012345678');
  await page.getByRole('button', { name: '이메일 찾기', exact: true }).click();
  await expect(page.getByText('s***@example.com')).toBeVisible();

  await page.goto('/studycrack-mobile.html?screen=authFindPw');
  await page.locator('[data-reset-email]').fill('student@example.com');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '인증 코드 받기' }).click();
  await expect(page.locator('[data-reset-code]')).toBeVisible();
  await expect(page.getByText('student@example.com로 받은 코드')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('온보딩 정보와 성적은 실제 저장·환산 요청 뒤 다음 단계로 이동한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=ob1');
  await page.getByRole('button', { name: '고3 재학' }).click();
  await page.locator('[data-field="obSchoolName"]').fill('테스트고등학교');
  await page.locator('[data-field="obGoalText"]').fill('목표 대학에 맞는 학습 전략을 알고 싶어요.');
  await page.getByRole('button', { name: '저장하고 성적 입력으로' }).click();
  await expect(page.locator('[data-screen="ob2"]')).toBeVisible();
  expect(api.requests.some(({ payload }) => payload.type === 'update_qual')).toBe(true);

  await page.locator('[data-field="v2e-korean-type"]').selectOption('언어와매체');
  await page.locator('[data-field="v2e-korean-common"]').fill('60');
  await page.locator('[data-field="v2e-korean-elective"]').fill('20');
  await page.locator('[data-field="v2e-math-type"]').selectOption('미적분');
  await page.locator('[data-field="v2e-math-common"]').fill('58');
  await page.locator('[data-field="v2e-math-elective"]').fill('20');
  await page.locator('[data-field="v2e-english"]').selectOption('2');
  await page.locator('[data-field="v2e-history"]').selectOption('2');
  await page.locator('[data-field="v2e-inq1-subject"]').selectOption('생명과학Ⅰ');
  await page.locator('[data-field="v2e-inq1-score"]').fill('42');
  await page.locator('[data-field="v2e-inq2-subject"]').selectOption('지구과학Ⅰ');
  await page.locator('[data-field="v2e-inq2-score"]').fill('41');
  await page.getByRole('button', { name: '저장하고 학습 MBTI로' }).click();
  await expect(page.locator('[data-screen="ob3"]')).toBeVisible();
  expect(api.requests.filter(({ payload }) => payload.type === 'convert_score')).toHaveLength(4);
  expect(api.requests.some(({ payload }) => payload.type === 'update_quan')).toBe(true);
});

test('온보딩 결과는 예시 값 대신 서버 추천과 계산 상태를 표시한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=ob4');
  await expect(page.getByText('목표 대학 선택')).toBeVisible();
  await expect(page.getByText('현재 성적 기준 추천')).toBeVisible();
  await expect(page.getByText('아직 계산된 환산점수가 없어요')).toBeVisible();
  await expect(page.getByText('환산 +18.0점')).toHaveCount(0);
  await expect(page.getByText('연세대학교 경영학과')).toHaveCount(0);
  await expect.poll(() => api.requests.some(({ payload }) => payload.type === 'get_tutorial_recommendations')).toBe(true);

  await page.goto('/studycrack-mobile.html?screen=ob5');
  await expect(page.getByText('표시할 환산 결과가 없어요')).toBeVisible();
  await expect(page.getByText(/평균 3개월/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('긴 개인정보 처리방침과 이용약관은 작은 화면에서도 끝까지 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const [screen, ending] of [
    ['privacyPolicy', 'contact@studycrack.co.kr'],
    ['termsScreen', '입시 결과 및 의사결정에 대한 책임은 이용자 본인에게 있습니다.']
  ]) {
    await page.goto(`/studycrack-mobile.html?screen=${screen}`);
    const appContent = page.locator('.app-content');
    await expect(appContent).toBeVisible();
    await appContent.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByText(ending, { exact: false })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('Phase 3 인증·온보딩·약관 화면은 네 viewport에서 경계를 지킨다', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    globalThis.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, delay === 900 ? 60_000 : delay, ...args);
  });
  await installApiMock(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const [name, selector] of PUBLIC_SURFACES) {
      const screen = screenFromSelector(selector);
      await page.goto(`/studycrack-mobile.html?screen=${screen}`);
      await expect(page.locator(selector)).toBeVisible();
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
  await installAuthenticatedSession(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const [name, selector] of MEMBER_SURFACES) {
      const screen = screenFromSelector(selector);
      await page.goto(`/studycrack-mobile.html?screen=${screen}`);
      await expect(page.locator(selector)).toBeVisible();
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

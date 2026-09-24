import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const guideState = student => ({ supported: true, version: 'ob_2026_09', status: 'unseen', lastStep: 0, revision: 0, ...student.productGuide });
test.use({ deviceScaleFactor: 1 });

const guideDialog = page => page.getByRole('dialog', { name: 'StudyCrack 사용법' });
const next = async page => {
  const button = guideDialog(page).locator('[data-action="nextProductGuide"]');
  await expect(button).toHaveAttribute('aria-disabled', 'false');
  await button.click();
};

async function setup(page, { saved, tier = 'basic', supported = true } = {}) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier, initialGameProfile: { streakDays: 7 } });
  const guide = { student: saved ? { productGuide: saved } : {}, requests: [], fail: false, conflict: false, delay: null };
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON() || {};
    if (!['get_product_guide', 'save_product_guide'].includes(payload.type)) return route.fallback();
    guide.requests.push(payload);
    if (!supported) return route.fulfill({ json: { success: true } });
    if (guide.delay) await guide.delay;
    if (payload.type === 'get_product_guide') return route.fulfill({ json: guideState(guide.student) });
    if (guide.fail) return route.fulfill({ status: 500, json: { error: 'failed' } });
    if (guide.conflict) {
      guide.conflict = false;
      guide.student.productGuide = { version: 'ob_2026_09', status: 'completed', lastStep: 5, revision: 20 };
      return route.fulfill({ status: 409, json: { error: 'conflict' } });
    }
    const current = guideState(guide.student);
    if (payload.data.revision !== current.revision) return route.fulfill({ status: 409, json: { error: 'conflict' } });
    guide.student.productGuide = { ...current, ...payload.data, revision: current.revision + 1, updatedAt: new Date().toISOString() };
    return route.fulfill({ json: guide.student.productGuide });
  });
  return { api, guide };
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`root 첫 안내 5단계·실제 데이터·키보드·완료 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { api, guide } = await setup(page);
    await page.goto('/studycrack-mobile.html');
    const dialog = guideDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('border-radius', '30px');
    await expect(dialog).toContainText('연세대학교 정치외교학과');
    await expect(page.locator('[data-screen="timer"]')).toHaveAttribute('inert', '');
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.locator('[data-action="nextProductGuide"]')).toBeFocused();
    for (let step = 1; step <= 5; step += 1) {
      await expect(dialog.locator('.product-guide-progress')).toHaveAttribute('aria-label', `${step} / 5단계`);
      await expect(dialog.locator('[data-action="nextProductGuide"]')).toHaveAttribute('aria-disabled', 'false');
      const box = await dialog.boundingBox();
      expect(box.width).toBeLessThanOrEqual(360);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      if (step === 2) await expect(dialog).toContainText('독서');
      if (step === 3) {
        const scene = dialog.getByRole('region', { name: '사용법 수조 미리보기' });
        await expect(scene).toBeVisible();
        await expect(scene).toHaveAttribute('data-background-key', 'day1');
        await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
        await expect(scene).toHaveCSS('height', '210px');
        await expect(scene.locator('button')).toHaveCount(0);
      }
      if (step === 4) await expect(dialog).toContainText('7일 연속 학습');
      await page.screenshot({ path: testInfo.outputPath(`guide-${width}-${step}.png`), animations: 'disabled' });
      await expectNoHorizontalOverflow(page);
      await next(page);
    }
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-screen="planner"]')).toBeVisible();
    expect(guide.student.productGuide.status).toBe('completed');
    expect(api.requests.some(({ payload }) => /tutorial|feed_fish|draw_fish|claim_study_reward/.test(payload.type))).toBe(false);
    await page.goto('/studycrack-mobile.html?screen=timer');
    await expect(page.getByRole('button', { name: '프로필 메뉴 열기' })).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });
}

test('저장된 진행 단계로 재개하며 이전 버튼은 저장 단계를 되돌리지 않는다', async ({ page }) => {
  const { guide } = await setup(page, { saved: { version: 'ob_2026_09', status: 'in_progress', lastStep: 3, revision: 2 } });
  await page.goto('/studycrack-mobile.html');
  await expect(guideDialog(page).locator('.product-guide-progress')).toHaveAttribute('aria-label', '3 / 5단계');
  await guideDialog(page).getByRole('button', { name: '← 이전' }).click();
  await expect(guideDialog(page).locator('.product-guide-progress')).toHaveAttribute('aria-label', '2 / 5단계');
  expect(guide.requests.filter(item => item.type === 'save_product_guide')).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(guideDialog(page)).not.toBeVisible();
  await expect.poll(() => guide.student.productGuide.status).toBe('skipped');
  expect(guide.student.productGuide.lastStep).toBe(3);
});

for (const status of ['skipped', 'completed']) {
  test(`${status} 회원은 MY에서 1단계 재보기·닫기 복귀가 가능하다`, async ({ page }) => {
    const { guide } = await setup(page, { saved: { version: 'ob_2026_09', status, lastStep: 5, revision: 4 } });
    await page.goto('/studycrack-mobile.html?screen=timer');
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    await page.getByRole('button', { name: /사용법 다시 보기/ }).click();
    await expect(guideDialog(page)).toBeVisible();
    await expect(guideDialog(page).locator('.product-guide-progress')).toHaveAttribute('aria-label', '1 / 5단계');
    await next(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '프로필 메뉴' })).toBeVisible();
    expect(guide.student.productGuide.status).toBe(status);
    expect(guide.requests.filter(item => item.type === 'save_product_guide')).toHaveLength(0);
    await page.getByRole('button', { name: /마이페이지 전체 보기/ }).click();
    await page.getByRole('button', { name: /사용법 다시 보기/ }).click();
    await guideDialog(page).getByRole('button', { name: '나중에 보기' }).click();
    await expect(page.locator('[data-screen="my"]')).toBeVisible();
  });
}

test('저장 실패 후 닫아도 앱을 사용할 수 있고 명시적으로 재시도한다', async ({ page }) => {
  const { guide } = await setup(page);
  await page.goto('/studycrack-mobile.html');
  await expect(guideDialog(page).locator('[data-action="nextProductGuide"]')).toHaveAttribute('aria-disabled', 'false');
  guide.fail = true;
  await guideDialog(page).getByRole('button', { name: '나중에 보기' }).click();
  await expect(guideDialog(page)).not.toBeVisible();
  await expect(page.locator('.product-guide-error')).toBeVisible();
  expect(guide.student.productGuide.status).toBe('in_progress');
  const writes = guide.requests.length;
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.getByRole('button', { name: '프로필 메뉴 닫기' }).click();
  expect(guide.requests).toHaveLength(writes);
  guide.fail = false;
  await page.getByRole('button', { name: '기록 다시 확인' }).click();
  await expect.poll(() => guide.student.productGuide.status).toBe('skipped');
  await expect(page.locator('.product-guide-error')).not.toBeVisible();
});

test('다른 탭에서 완료한 기록은 늦은 진행 저장으로 되돌리지 않는다', async ({ page }) => {
  const { guide } = await setup(page);
  await page.goto('/studycrack-mobile.html');
  await expect(guideDialog(page).locator('[data-action="nextProductGuide"]')).toHaveAttribute('aria-disabled', 'false');
  guide.conflict = true;
  await next(page);
  await expect(guideDialog(page).locator('[data-action="nextProductGuide"]')).toHaveAttribute('aria-disabled', 'false');
  expect(guide.student.productGuide.status).toBe('completed');
  await page.keyboard.press('Escape');
  await expect(guideDialog(page)).not.toBeVisible();
  expect(guide.student.productGuide.revision).toBe(20);
});

test('구버전 서버는 자동 안내를 띄우지 않고 MY의 수동 안내만 제공한다', async ({ page }) => {
  const { guide } = await setup(page, { supported: false });
  await page.goto('/studycrack-mobile.html?screen=my');
  await page.getByRole('button', { name: /사용법 다시 보기/ }).click();
  await expect(guideDialog(page)).toContainText('동기화를 아직 사용할 수 없어요');
  for (let step = 0; step < 5; step += 1) await next(page);
  await expect(guideDialog(page)).not.toBeVisible();
  expect(guide.requests.some(item => item.type === 'save_product_guide')).toBe(false);
});

test('Free 완료는 권한을 올리지 않고 홈으로 돌아간다', async ({ page }) => {
  const { guide } = await setup(page, { tier: 'free', saved: { version: 'ob_2026_09', status: 'in_progress', lastStep: 5, revision: 3 } });
  await page.goto('/studycrack-mobile.html');
  await next(page);
  await expect(guideDialog(page)).not.toBeVisible();
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  expect(guide.student.productGuide.status).toBe('completed');
});

test('기존 deep link를 안내가 가로채지 않는다', async ({ page }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  await expect(page.locator('[data-screen="planner"]')).toBeVisible();
  await expect(guideDialog(page)).toHaveCount(0);
});

test('기록 조회가 늦어도 시작한 공부 위에 안내가 열리지 않는다', async ({ page }) => {
  const { guide } = await setup(page);
  let release;
  guide.delay = new Promise(resolve => { release = resolve; });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('[data-action="openStudySubjectSheet"]').first().click();
  release();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(guideDialog(page)).toHaveCount(0);
});

test('로그아웃 후 도착한 조회 응답은 안내나 저장을 시작하지 않는다', async ({ page }) => {
  const { guide } = await setup(page);
  let release;
  guide.delay = new Promise(resolve => { release = resolve; });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect.poll(() => guide.requests.length).toBe(1);
  await page.evaluate(() => window.clearClientSession());
  release();
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await expect(guideDialog(page)).toHaveCount(0);
  expect(guide.requests.some(item => item.type === 'save_product_guide')).toBe(false);
});

test('완료 저장 도중 닫으면 늦은 응답이 화면을 이동시키지 않는다', async ({ page }) => {
  const { guide } = await setup(page, { saved: { version: 'ob_2026_09', status: 'in_progress', lastStep: 5, revision: 3 } });
  await page.goto('/studycrack-mobile.html');
  await expect(guideDialog(page).locator('[data-action="nextProductGuide"]')).toHaveAttribute('aria-disabled', 'false');
  let release;
  guide.delay = new Promise(resolve => { release = resolve; });
  await next(page);
  await expect(guideDialog(page).locator('[data-action="nextProductGuide"]')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await expect(guideDialog(page)).not.toBeVisible();
  release();
  await expect.poll(() => guide.student.productGuide.status).toBe('completed');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
});

test('비회원 root는 기존 소개를 유지하고 계정 안내를 조회하지 않는다', async ({ page }) => {
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html');
  await expect(page.locator('[data-screen="on1"]')).toBeVisible();
  await expect(guideDialog(page)).toHaveCount(0);
  expect(api.requests.some(item => /product_guide/.test(item.payload.type))).toBe(false);
});

test('높이가 작은 화면에서도 본문만 스크롤하고 닫기와 다음 버튼에 접근한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await setup(page);
  await page.goto('/studycrack-mobile.html');
  await expect(guideDialog(page)).toBeVisible();
  const body = guideDialog(page).locator('.product-guide-body');
  expect(await body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const button = await guideDialog(page).locator('[data-action="nextProductGuide"]').boundingBox();
  expect(button.y + button.height).toBeLessThanOrEqual(480);
  await next(page);
  await page.keyboard.press('Escape');
  await expect(guideDialog(page)).not.toBeVisible();
});

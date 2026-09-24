import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const original = [{ id: 'saved-plan', date: '2026-09-07', subject: '수학', content: '보존할 계획', minutes: 60, start: '09:00', end: '10:00' }];
async function setup(page, { corrupt = false, unreadable = false } = {}) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await installAuthenticatedSession(page);
  await page.addInitScript(({ original, corrupt, unreadable }) => {
    if (!sessionStorage.getItem('__storageSeed')) {
      localStorage.setItem('plannerItems', corrupt ? '{broken' : JSON.stringify(original));
      sessionStorage.setItem('__storageSeed', '1');
    }
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'plannerItems' && window.__failPlannerWrite) throw new DOMException('blocked', 'QuotaExceededError');
      return set.call(this, key, value);
    };
    window.__failPlannerRead = unreadable;
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === 'plannerItems' && window.__failPlannerRead) throw new DOMException('blocked', 'SecurityError');
      return get.call(this, key);
    };
  }, { original, corrupt, unreadable });
  return installApiMock(page, { tier: 'pro', studyDurationSeconds: 600 });
}
const blockWrites = (page, blocked) => page.evaluate(value => { window.__failPlannerWrite = value; }, blocked);
const stored = page => page.evaluate(() => localStorage.getItem('plannerItems'));

test('추가 저장 실패는 입력과 단계를 유지하고 재시도는 한 건만 저장한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  await page.getByRole('button', { name: '계획 추가', exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('계획 제목', { exact: true }).fill('실패해도 남아야 할 초안');
  await page.getByLabel('메모 (선택)', { exact: true }).fill('긴 메모도 보존');
  const before = await stored(page);
  await blockWrites(page, true);
  await page.getByRole('button', { name: '계획 저장하기' }).click();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요');
  await expect(page.getByLabel('계획 제목', { exact: true })).toHaveValue('실패해도 남아야 할 초안');
  await expect(page.getByLabel('메모 (선택)', { exact: true })).toHaveValue('긴 메모도 보존');
  expect(await stored(page)).toBe(before);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('alert').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('planner-storage-add-320.png') });
  await blockWrites(page, false);
  await page.getByRole('button', { name: '계획 저장하기' }).click();
  await expect(page.locator('article[data-planner-id]')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('article[data-planner-id]')).toHaveCount(2);
});

test('편집·완료·삭제 실패는 저장된 계획을 변경하지 않는다', async ({ page }, testInfo) => {
  const api = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  const row = page.locator('article[data-planner-id="saved-plan"]');
  await row.getByRole('button', { name: '계획 편집' }).click();
  const sheet = page.getByRole('dialog', { name: '플래너 항목 수정' });
  await sheet.getByLabel('세부 내용', { exact: true }).fill('수정 초안 보존');
  const before = await stored(page);
  await blockWrites(page, true);
  await sheet.getByRole('button', { name: '수정 저장' }).click();
  await expect(sheet.getByRole('alert')).toContainText('저장하지 못했어요');
  await expect(sheet.getByLabel('세부 내용', { exact: true })).toHaveValue('수정 초안 보존');
  expect(await stored(page)).toBe(before);
  await sheet.getByRole('alert').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('planner-storage-edit-390.png') });
  await blockWrites(page, false);
  await sheet.getByRole('button', { name: '수정 저장' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row).toContainText('수정 초안 보존');
  await blockWrites(page, true);
  await row.getByRole('button', { name: '계획 완료', exact: true }).click();
  await expect(row.locator('.planner-item-done')).toHaveAttribute('aria-pressed', 'false');
  await row.getByRole('button', { name: '계획 삭제' }).click();
  await expect(row).toHaveCount(1);
  await blockWrites(page, false);
  await row.getByRole('button', { name: '계획 완료', exact: true }).click();
  await expect(row.locator('.planner-item-done')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(row.locator('.planner-item-done')).toHaveAttribute('aria-pressed', 'true');
  expect(api.requests.filter(({ payload }) => /study_session|claim_study_reward/.test(payload.type))).toHaveLength(0);
});

test('손상된 저장 원본은 빈 배열로 덮어쓰지 않고 읽기 실패를 알린다', async ({ page }) => {
  await setup(page, { corrupt: true });
  await page.goto('/studycrack-mobile.html?screen=planner');
  await expect(page.getByRole('alert')).toContainText('불러오지 못했어요');
  expect(await stored(page)).toBe('{broken');
});

test('읽기 차단 해제 후 기존 계획을 복원하며 초기 빈 목록을 저장하지 않는다', async ({ page }) => {
  await setup(page, { unreadable: true });
  await page.goto('/studycrack-mobile.html?screen=planner');
  await expect(page.getByRole('alert')).toContainText('불러오지 못했어요');
  await page.evaluate(() => { window.__failPlannerRead = false; });
  expect(JSON.parse(await stored(page))).toEqual(original);
  await page.getByRole('button', { name: '기기 기록 다시 불러오기' }).click();
  await expect(page.locator('article[data-planner-id="saved-plan"]')).toContainText('보존할 계획');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('다른 화면의 수정 감지 후 입력을 보존하고 최신 기록 위에서 다시 저장한다', async ({ page }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  await page.getByRole('button', { name: '계획 편집' }).click();
  const sheet = page.getByRole('dialog', { name: '플래너 항목 수정' });
  await sheet.getByLabel('세부 내용', { exact: true }).fill('내 편집 초안');
  await page.evaluate(original => localStorage.setItem('plannerItems', JSON.stringify([...original, { ...original[0], id: 'other-plan', content: '다른 화면 새 계획' }])), original);
  await sheet.getByRole('button', { name: '수정 저장' }).click();
  await expect(sheet.getByRole('alert')).toContainText('다른 화면');
  await sheet.getByRole('button', { name: '기기 기록 다시 불러오기' }).click();
  await expect(sheet.getByLabel('세부 내용', { exact: true })).toHaveValue('내 편집 초안');
  await sheet.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.locator('article[data-planner-id]')).toHaveCount(2);
  await expect(page.locator('article[data-planner-id="other-plan"]')).toContainText('다른 화면 새 계획');
});

test('기기 저장 재시도는 공부 완료·보상을 재요청하지 않고 공부시간 사본만 복구한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const api = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('.timer-v2-plan-list button').click();
  await page.locator('[data-action="confirmStudyStart"]').click();
  await expect(page.getByRole('button', { name: '공부 완료', exact: true })).toBeEnabled();
  const before = await stored(page);
  await blockWrites(page, true);
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();
  await expect(page.locator('.timer-journey-panel [data-step="reward"]')).toHaveAttribute('data-state', 'complete');
  await page.getByRole('button', { name: '타이머 닫기' }).click();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요');
  expect(await stored(page)).toBe(before);
  await page.getByRole('button', { name: '기기 기록 다시 저장' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('planner-storage-pending-320.png') });
  await expectNoHorizontalOverflow(page);
  await blockWrites(page, false);
  await page.getByRole('button', { name: '기기 기록 다시 저장' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(JSON.parse(await stored(page))[0].doneMinutes).toBe(10);
  for (const type of ['complete_study_session', 'claim_study_reward']) {
    expect(api.requests.filter(({ payload }) => payload.type === type)).toHaveLength(1);
  }
  await page.reload();
  expect(JSON.parse(await stored(page))[0].doneMinutes).toBe(10);
});

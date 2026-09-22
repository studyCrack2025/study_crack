import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const original = [
  { id: 'pending-local', date: '2026-09-12', subject: '국어', content: '보존할 독서 계획', minutes: 30 },
  { id: 'done-local', date: '2026-09-12', subject: '수학', content: '이미 완료한 계획', done: true, minutes: 30 },
  { id: 'studied-local', date: '2026-09-12', subject: '영어', content: '공부 시간이 있는 계획', doneMinutes: 10, minutes: 30 }
];
const accountKey = 'studycrackPlannerAccount_v1:e2e-student';
async function setup(page, { disabled = false, loseOnce = false, oldProtocol = false } = {}) {
  await page.clock.setFixedTime(new Date('2026-09-12T03:00:00.000Z'));
  await installAuthenticatedSession(page);
  await page.addInitScript(original => {
    if (!sessionStorage.getItem('__accountPlannerSeed')) {
      localStorage.setItem('plannerItems', JSON.stringify(original));
      sessionStorage.setItem('__accountPlannerSeed', '1');
    }
  }, original);
  await installApiMock(page, { tier: 'pro' });
  const state = { requests: [], items: [], receipts: new Map(), growth: { supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-09-12', revision: 0,
    asOf: '2026-09-12T03:00:00.000Z', historyStatus: 'not_available', validDayCount: 0, highestUnlockedStage: null, nextStageDays: 1 }, lost: false, hold: null };
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type !== 'planner_sync_v1') return route.fallback();
    state.requests.push(payload);
    if (state.hold && (!state.holdType || state.holdType === payload.operation)) await state.hold;
    if (disabled) return route.fulfill({ status: 503, json: { code: 'PLANNER_DISABLED' } });
    expect(payload.owner).toBe('e2e-student');
    let data;
    if (payload.operation === 'get_server_planner') data = { items: state.items, cursor: null, growth: state.growth };
    else {
      expect(['save_server_planner', 'complete_server_planner', 'delete_server_planner']).toContain(payload.operation);
      const draft = payload.data;
      data = state.receipts.get(draft.requestId);
      if (!data) {
        const previous = state.items.find(item => item.id === draft.id);
        if ((previous?.revision || 0) !== draft.revision || previous?.deleted) return route.fulfill({ status: 409, json: { code: 'PLANNER_REVISION_CONFLICT' } });
        const item = { id: draft.id, date: draft.date, subject: draft.subject, title: draft.title, completed: false, deleted: false, firstCompletedAt: null, growthDate: null, ...previous, revision: draft.revision + 1, updatedAt: state.growth.asOf };
        if (payload.operation === 'save_server_planner') { expect(draft.completed).toBe(false); Object.assign(item, { date: draft.date, subject: draft.subject, title: draft.title, completed: false }); }
        if (payload.operation === 'delete_server_planner') item.deleted = true;
        let days = state.growth.validDayCount;
        if (payload.operation === 'complete_server_planner') {
          item.completed = true;
          if (!item.firstCompletedAt) { item.firstCompletedAt = state.growth.asOf; item.growthDate = item.date; days = 1; }
        }
        state.items = [...state.items.filter(row => row.id !== item.id), item];
        state.growth = { ...state.growth, revision: state.growth.revision + 1, validDayCount: days, highestUnlockedStage: days ? 'day1' : null, nextStageDays: days ? 6 : 1 };
        data = { item, growth: state.growth, replayed: false }; state.receipts.set(draft.requestId, data);
      } else data = { ...data, replayed: true };
      if (loseOnce && !state.lost) { state.lost = true; return route.abort('failed'); }
    }
    return route.fulfill({ json: { success: true, data, ...(!oldProtocol ? { plannerOwner: 'e2e-student', plannerProtocol: 1 } : {}) } });
  });
  return state;
}
async function open(page) {
  await page.goto('/studycrack-mobile.html?screen=planner');
  const panel = page.locator('.planner-account-panel');
  await panel.locator('summary').click();
  return panel;
}
const stored = page => page.evaluate(() => localStorage.getItem('plannerItems'));

test('계정 확인 전에는 자동 전송하지 않고 준비 중 서버에서도 기기 계획을 보존한다', async ({ page }) => {
  const state = await setup(page, { disabled: true }); const panel = await open(page); const before = await stored(page);
  expect(state.requests).toHaveLength(0);
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('준비하고 있어요');
  await expect(panel.getByRole('button', { name: /계정으로 가져오기/ })).toHaveCount(0);
  expect(await stored(page)).toBe(before); expect(state.items).toHaveLength(0);
});

async function accountMode(page) {
  const panel = await open(page);
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await panel.getByRole('button', { name: '계정 계획으로 전환' }).click();
  await expect(page.locator('.planner-context-head')).toContainText('계정 계획을 보고 있어요');
}
async function addAccountDraft(page, title = '새 계정 계획') {
  await page.getByRole('button', { name: '계획 추가', exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('계획 제목', { exact: true }).fill(title);
  await page.getByLabel('메모 (선택)', { exact: true }).fill('이 계정의 기기 메모');
  await page.getByRole('button', { name: '계획 저장하기' }).click();
}

test('기본 버튼으로 계정 계획 추가·완료·취소·편집·삭제하고 기기 원본은 그대로 보존한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await setup(page); await accountMode(page); const before = await stored(page);
  await addAccountDraft(page);
  const row = page.locator('article[data-planner-id]');
  await expect(row).toHaveCount(1); await expect(row).toContainText('계정 저장 확인');
  expect(state.requests.at(-1).data.memo).toBeUndefined();
  await row.getByRole('button', { name: '계획 완료', exact: true }).click();
  await expect(row).toContainText('서버 완료 확인'); expect(state.growth.validDayCount).toBe(1);
  await row.getByRole('button', { name: '완료 취소', exact: true }).click();
  await expect(row.locator('.planner-item-done')).toHaveAttribute('aria-pressed', 'false');
  await row.getByRole('button', { name: '계획 편집', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '플래너 항목 수정' });
  await expect(sheet.getByLabel('메모', { exact: true })).toHaveValue('이 계정의 기기 메모');
  await sheet.getByLabel('세부 내용', { exact: true }).fill('수정한 계정 계획');
  await sheet.getByRole('button', { name: '수정 저장' }).click();
  await expect(sheet).toHaveCount(0); await expect(row).toContainText('수정한 계정 계획');
  await expectNoHorizontalOverflow(page); await page.screenshot({ path: testInfo.outputPath('account-primary-320.png') });
  await row.getByRole('button', { name: '계획 삭제', exact: true }).click();
  await expect(row).toHaveCount(0); expect(state.growth.validDayCount).toBe(1); expect(await stored(page)).toBe(before);
  await page.getByRole('button', { name: '기기 계획 보기', exact: true }).click();
  await expect(page.locator('article[data-planner-id]')).toHaveCount(3);
});

test('서버 완료 확정 성장값은 추가 조회 없이 홈과 수조에 전달한다', async ({ page }) => {
  const state = await setup(page); await accountMode(page); await addAccountDraft(page);
  await page.locator('article[data-planner-id]').getByRole('button', { name: '계획 완료', exact: true }).click();
  await expect(page.locator('article[data-planner-id]')).toContainText('서버 완료 확인');
  await page.getByRole('navigation').getByRole('button', { name: '홈', exact: true }).click();
  await expect(page.locator('.home-aquarium-preview .aquarium-growth-caption')).toHaveCount(0);
  await expect(page.locator('.home-aquarium-preview .aquarium-scene')).toHaveAttribute('data-background-key', 'day1');
  await page.locator('.home-aquarium-preview [data-target="aquarium"]').first().click();
  await expect(page.locator('.aquarium-growth-caption')).toContainText('성장 인정 1일');
  expect(state.requests.some(row => row.operation === 'get_aquarium_growth')).toBe(false);
});

test('기기에 변조된 성장 캐시가 있어도 배경은 실제 조회 응답만 사용한다', async ({ page }) => {
  await setup(page);
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 1, owner: 'e2e-student', items: [], queue: [], imports: [], growth: {
    supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-09-12', revision: 999, asOf: '2026-09-12T03:00:00.000Z', historyStatus: 'not_available', validDayCount: 100, highestUnlockedStage: 'day100', nextStageDays: null
  } })), accountKey);
  await accountMode(page);
  await page.getByRole('navigation').getByRole('button', { name: '홈', exact: true }).click();
  await expect(page.locator('.home-aquarium-preview .aquarium-growth-caption')).toHaveCount(0);
  await expect(page.locator('.home-aquarium-preview .aquarium-scene')).toHaveAttribute('data-background-key', 'day1');
  await page.locator('.home-aquarium-preview [data-target="aquarium"]').first().click();
  await expect(page.locator('.aquarium-growth-caption')).toContainText('성장 인정 0일');
  await expect(page.locator('.aquarium-scene')).toHaveAttribute('data-background-key', 'day1');
});

test('기본 추가의 유실 응답은 초안·식별자를 보존하고 확인 뒤 다시 저장해도 중복되지 않는다', async ({ page }) => {
  const state = await setup(page, { loseOnce: true }); await accountMode(page); await addAccountDraft(page);
  await expect(page.getByRole('alert')).toContainText('서버 반영 대기 1건');
  await expect(page.getByLabel('계획 제목', { exact: true })).toHaveValue('새 계정 계획');
  await expect(page.getByLabel('메모 (선택)', { exact: true })).toHaveValue('이 계정의 기기 메모');
  await page.getByRole('button', { name: '서버 반영 다시 확인' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '계획 저장하기' }).click();
  await expect(page.locator('article[data-planner-id]')).toHaveCount(1);
  const sent = state.requests.filter(row => row.operation === 'save_server_planner'); expect(sent).toHaveLength(2); expect(sent[0].data).toEqual(sent[1].data); expect(state.items).toHaveLength(1);
});

test('완료 응답 대기 중에는 완료율·성장이 선반영되지 않고 중복 완료를 막는다', async ({ page }) => {
  const state = await setup(page); await accountMode(page); await addAccountDraft(page);
  const row = page.locator('article[data-planner-id]'); await expect(row).toHaveCount(1);
  let release; state.holdType = 'complete_server_planner'; state.hold = new Promise(resolve => { release = resolve; });
  await row.getByRole('button', { name: '계획 완료', exact: true }).click();
  await expect(row).toContainText('서버 반영 대기');
  await expect(row.locator('.planner-item-done')).toBeDisabled(); await expect(row.locator('.planner-item-done')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('progressbar', { name: '플래너 완료율' })).toHaveAttribute('aria-valuenow', '0');
  expect(state.growth.validDayCount).toBe(0); release();
  await expect(row).toContainText('서버 완료 확인'); expect(state.growth.validDayCount).toBe(1);
});

test('다른 기기와 충돌한 편집은 초안을 남기고 명시적으로 서버 기록을 선택할 수 있다', async ({ page }) => {
  const state = await setup(page); await accountMode(page); await addAccountDraft(page);
  const row = page.locator('article[data-planner-id]'); await expect(row).toHaveCount(1);
  state.items[0] = { ...state.items[0], title: '다른 기기의 최신 내용', revision: 2 }; state.growth = { ...state.growth, revision: 2 };
  await row.getByRole('button', { name: '계획 편집', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '플래너 항목 수정' });
  await sheet.getByLabel('세부 내용', { exact: true }).fill('보존할 충돌 초안'); await sheet.getByRole('button', { name: '수정 저장' }).click();
  await expect(sheet.getByRole('alert')).toContainText('충돌'); await expect(sheet.getByLabel('세부 내용', { exact: true })).toHaveValue('보존할 충돌 초안');
  await sheet.getByRole('button', { name: '닫기', exact: true }).click();
  const panel = page.locator('details.planner-account-panel');
  if (await panel.getAttribute('open') === null) await panel.locator('summary').first().click();
  await panel.getByRole('button', { name: '서버 기록 사용 · 대기 변경 보관' }).click();
  await expect(row).toContainText('다른 기기의 최신 내용');
  await panel.getByText('보관한 대기 변경 1건', { exact: true }).click();
  await expect(panel).toContainText('보존할 충돌 초안');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).queue.length, accountKey)).toBe(0);
});

test('선택한 미완료 계획만 가져오고 원본·성장값을 보존하며 재접속은 확인 후 표시한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await setup(page); let panel = await open(page); const before = await stored(page);
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await expect(panel.getByRole('button', { name: /계정으로 가져오기/ })).toHaveCount(1);
  await panel.getByRole('button', { name: '보존할 독서 계획 계정으로 가져오기' }).click();
  await expect(panel.getByText('가져올 미완료 기기 계획이 없어요.')).toBeVisible();
  await expect(panel.getByText('마지막 서버 확인 기준 · 성장 인정 0일')).toBeVisible();
  expect(await stored(page)).toBe(before); expect(state.items).toHaveLength(1);
  await expectNoHorizontalOverflow(page);
  await panel.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath('planner-account-320.png') });
  await page.reload(); panel = page.locator('.planner-account-panel'); await panel.locator('summary').click();
  await expect(panel.locator('.planner-account-list')).toHaveCount(0);
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await expect(panel.getByText('보존할 독서 계획', { exact: true })).toBeVisible();
  expect(state.requests.filter(request => request.operation === 'save_server_planner')).toHaveLength(1);
});

test('응답 유실 뒤 재접속해도 대기 요청 한 건을 동일 식별자로 복구한다', async ({ page }) => {
  const state = await setup(page, { loseOnce: true }); let panel = await open(page);
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await panel.getByRole('button', { name: '보존할 독서 계획 계정으로 가져오기' }).click();
  await expect(panel.getByRole('status')).toContainText('전송 대기 1건');
  const pending = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).queue[0], accountKey);
  await page.reload(); panel = page.locator('.planner-account-panel'); await panel.locator('summary').click();
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('전송 대기 1건');
  await panel.getByRole('button', { name: '대기 기록 1건 전송' }).click();
  await expect(panel.getByRole('status')).toHaveText('계정 기록을 확인했어요.');
  const sent = state.requests.filter(request => request.operation === 'save_server_planner');
  expect(sent).toHaveLength(2); expect(sent[0].data).toEqual(sent[1].data); expect(sent[1].data).toEqual(pending.data); expect(state.items).toHaveLength(1);
});

test('다른 탭 계정 전환은 기존 계정 화면을 숨기고 늦은 응답을 저장하지 않는다', async ({ page }) => {
  const state = await setup(page); const panel = await open(page);
  let release; state.hold = new Promise(resolve => { release = resolve; });
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await expect.poll(() => state.requests.length).toBe(1);
  await page.evaluate(() => {
    localStorage.setItem('userId', 'new-account');
    window.dispatchEvent(new StorageEvent('storage', { key: 'userId', oldValue: 'e2e-student', newValue: 'new-account' }));
  });
  release();
  await expect(panel.getByRole('status')).toContainText('로그인 계정이 바뀌었어요');
  await expect(panel.locator('.planner-account-list')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), accountKey)).toBeNull();
});

test('소유 계정 확인이 없는 응답은 성공 화면으로 표시하지 않는다', async ({ page }) => {
  await setup(page, { oldProtocol: true }); const panel = await open(page);
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('다시 시도');
  await expect(panel.locator('.planner-account-list')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), accountKey)).toBeNull();
});
test('같은 탭에서 세션이 바뀐 뒤 이전 가져오기 버튼으로 새 계정에 저장하지 않는다', async ({ page }) => {
  const state = await setup(page); const panel = await open(page);
  await panel.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await expect(panel.getByRole('button', { name: '보존할 독서 계획 계정으로 가져오기' })).toBeVisible();
  await page.evaluate(() => { localStorage.setItem('userId', 'new-account'); });
  await panel.getByRole('button', { name: '보존할 독서 계획 계정으로 가져오기' }).click();
  await expect(panel.getByRole('status')).toContainText('로그인 계정이 바뀌었어요');
  await expect(panel.locator('.planner-account-list')).toHaveCount(0);
  expect(state.requests.map(request => request.operation)).toEqual(['get_server_planner']);
});
test('계정 전환은 열린 계정 입력창의 이전 초안과 요청 식별자를 다음 계정에 넘기지 않는다', async ({ page }) => {
  const state = await setup(page); await accountMode(page);
  await page.getByRole('button', { name: '계획 추가', exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('계획 제목', { exact: true }).fill('이전 계정의 비공개 초안');
  await page.evaluate(() => {
    localStorage.setItem('userId', 'new-account');
    dispatchEvent(new StorageEvent('storage', { key: 'userId', oldValue: 'e2e-student', newValue: 'new-account' }));
  });
  await expect(page.getByRole('alert')).toContainText('로그인 계정이 바뀌었어요');
  await expect(page.locator('[data-field="plannerContent"]')).toHaveValue('');
  expect(state.requests.map(row => row.operation)).toEqual(['get_server_planner']);
});

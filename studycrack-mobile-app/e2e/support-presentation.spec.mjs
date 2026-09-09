import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
const longText = '학습 기록과 목표 대학을 함께 확인하고 싶은 문의입니다.\n' + '긴 한글 답변과 줄바꿈을 끝까지 읽을 수 있어야 합니다. '.repeat(12) + '마지막 확인 문장';
async function installLists(page, { unavailableRanking = false } = {}) {
  let rankingCalls = 0;
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON() || {};
    let body;
    if (payload.type === 'get_pro_reports') body = { reports: [
      { key: '260901', status: 'published', reportLink: 'https://example.com/report.pdf' },
      { key: '260902', status: 'tutor_review', reportLink: 'https://example.com/draft.pdf' },
      { key: '260903', status: 'published', reportLink: 'javascript:alert(1)' }
    ] };
    if (payload.type === 'get_qna_list') body = { qnaHistory: [{ qnaId: 'long-qna', title: '긴 질문 제목과 답변 전문 확인', content: longText, answer: longText, status: 'done', createdAt: '2026-09-01T00:00:00Z' }] };
    if (payload.type === 'student_get_notifications') body = { notifications: Array.from({ length: 8 }, (_, i) => ({ id: `notice-${i}`, title: `알림 ${i + 1}`, body: longText, createdAt: '2026-09-01T00:00:00Z', isRead: false })) };
    if (payload.type === 'get_study_ranking') {
      rankingCalls++;
      if (unavailableRanking && rankingCalls === 1) body = { available: false, rows: [], me: null };
      else body = { available: true, rows: [{ rank: 1, name: '이름이길게표시되는테스트학생', seconds: 7200, tier: 'GOLD', isMe: true }], me: { rank: 1, seconds: 7200, tier: 'GOLD', total: 10 } };
    }
    if (body) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    else await route.fallback();
  });
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`리포트·문의·알림·랭킹의 상세를 읽고 조작한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'pro' });
    await installLists(page);
    const capture = name => page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true, animations: 'disabled' });
    const checkVisibleHeight = async dialog => {
      await page.evaluate(() => {
        Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 400 });
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await expect.poll(async () => {
        const bounds = await dialog.boundingBox();
        return bounds.y >= 0 && bounds.y + bounds.height <= 401;
      }).toBe(true);
      await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
      await expect.poll(() => page.locator('html').evaluate(node => node.style.getPropertyValue('--sc-visual-height'))).toBe(`${height}px`);
    };
    await page.goto('/studycrack-mobile.html?screen=report');
    await expect(page.locator('.report-row')).toHaveCount(3);
    await expect(page.locator('.report-row').nth(0)).toBeEnabled();
    await expect(page.locator('.report-row').nth(1)).toBeDisabled();
    await expect(page.locator('.report-row').nth(2)).toBeDisabled();
    await expect(page.locator('.report-row').nth(2)).not.toContainText('다운로드 가능');
    await capture('reports');
    await page.getByRole('button', { name: '새 리포트 요청' }).click();
    const reportModal = page.getByRole('dialog', { name: '전략 보고서 요청' });
    await reportModal.getByLabel('요청 사항 (500자 이내)').fill('주간 학습 전략을 확인하고 싶어요.');
    await expect(reportModal.locator('.pro-request-count')).toHaveText(`${'주간 학습 전략을 확인하고 싶어요.'.length}/500`);
    await expect(reportModal.locator('textarea')).toHaveCSS('font-size', '16px');
    expect((await reportModal.getByRole('button', { name: '닫기' }).boundingBox()).height).toBeGreaterThanOrEqual(44);
    await capture('report-request');
    await checkVisibleHeight(reportModal);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '새 리포트 요청' })).toBeFocused();
    await page.goto('/studycrack-mobile.html?screen=reportDetail');
    await page.getByRole('button', { name: '리포트 목록 보기' }).click();
    await expect(page.locator('[data-screen="report"]')).toBeVisible();
    for (const screen of ['tutor', 'customerSupport']) {
      await page.goto(`/studycrack-mobile.html?screen=${screen}`);
      const thread = page.locator('.qna-list-row');
      await thread.locator('summary').click();
      await expect(thread.locator('small')).toContainText('마지막 확인 문장');
      await expect(thread.locator('small')).toHaveCSS('white-space', 'pre-wrap');
      await thread.scrollIntoViewIfNeeded();
      await capture(screen);
      await expectNoHorizontalOverflow(page);
    }
    await page.getByRole('button', { name: /일반 문의/ }).click();
    const qna = page.getByRole('dialog', { name: '1:1 문의 작성' });
    await qna.getByLabel('문의 제목').fill('문의 제목');
    await qna.getByLabel('문의 내용').fill(longText);
    await expect(qna.getByLabel('문의 제목')).toHaveCSS('font-size', '16px');
    await capture('qna-compose');
    await checkVisibleHeight(qna);
    await page.setViewportSize({ width, height: 400 });
    await qna.getByRole('button', { name: '문의 접수' }).scrollIntoViewIfNeeded();
    await expect(qna.getByRole('button', { name: '문의 접수' })).toBeInViewport();
    await page.setViewportSize({ width, height });
    await page.keyboard.press('Escape');
    const faq = page.getByRole('button', { name: /분석 결과는 어떻게/ });
    await faq.click();
    await expect(faq).toHaveAttribute('aria-expanded', 'true');
    await expect(faq.locator('.faq-answer')).toHaveCSS('display', 'block');
    await capture('faq');
    await page.goto('/studycrack-mobile.html?screen=notificationList');
    await expect(page.locator('.noti-list-row')).toHaveCount(7);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.locator('.noti-pager-count')).toHaveText('2 / 2');
    await capture('notifications');
    await page.locator('.noti-list-row').click();
    const notice = page.getByRole('dialog', { name: '알림 상세' });
    await expect(notice).toContainText('마지막 확인 문장');
    await capture('notification-detail');
    await checkVisibleHeight(notice);
    await page.keyboard.press('Escape');
    await expect(page.locator('.noti-list-row')).toBeFocused();
    await page.goto('/studycrack-mobile.html?screen=ranking');
    await expect(page.locator('.ranking-summary')).toContainText('10명');
    await expect(page.locator('.ranking-summary')).toContainText('10%');
    await page.getByRole('group', { name: '랭킹 기간' }).getByRole('button', { name: '월간' }).click();
    await expect(page.getByRole('button', { name: '월간' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ranking-board')).toBeVisible();
    await capture('ranking');
    await expectNoHorizontalOverflow(page);
  });
}

test('서버 랭킹 조회 불가는 빈 순위 대신 오류와 재시도를 표시한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await installLists(page, { unavailableRanking: true });
  await page.goto('/studycrack-mobile.html?screen=ranking');
  await expect(page.getByText('랭킹을 불러오지 못했어요')).toBeVisible();
  await expect(page.locator('.ranking-summary')).toContainText('확인 필요');
  await expect(page.locator('.ranking-summary')).not.toContainText('BRONZE');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.ranking-summary')).toContainText('1등');
  await expect(page.locator('.ranking-board')).toBeVisible();
});

test('한글 리포트 요청은 실패 뒤 내용을 보존하고 같은 내용으로 재시도한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  const submitted = [];
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON() || {};
    if (payload.type !== 'request_pro_report') return route.fallback();
    submitted.push(payload.data.requestText);
    await route.fulfill({ status: submitted.length === 1 ? 500 : 200, contentType: 'application/json', body: JSON.stringify(submitted.length === 1 ? { error: 'Temporary failure' } : { success: true, targetKey: '260901' }) });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studycrack-mobile.html?screen=report');
  await page.getByRole('button', { name: '새 리포트 요청' }).click();
  const modal = page.getByRole('dialog', { name: '전략 보고서 요청' });
  await modal.locator('textarea').evaluate(element => {
    element.focus();
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = '한글 조합 요청 내용';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한글 조합 요청 내용' }));
  });
  await expect(modal.locator('.pro-request-count')).toHaveText(`${'한글 조합 요청 내용'.length}/500`);
  await modal.getByRole('button', { name: '요청서 제출하기' }).click();
  await expect.poll(() => submitted.length).toBe(1);
  await expect(modal.locator('textarea')).toHaveValue('한글 조합 요청 내용');
  await modal.getByRole('button', { name: '요청서 제출하기' }).click();
  await expect(modal).toHaveCount(0);
  expect(submitted).toEqual(['한글 조합 요청 내용', '한글 조합 요청 내용']);
});

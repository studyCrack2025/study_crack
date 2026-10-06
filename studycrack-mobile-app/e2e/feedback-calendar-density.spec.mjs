import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const longText = '첫 문단은 그대로 보존합니다.\n반복 문장도 임의로 삭제하지 않아요. '.repeat(20) + '<img src=x onerror=alert(1)> LAST';
const fields = { tutorComment: longText, weeklyPlanner: '내 계획 원문', planReason: '계획 이유 원문', questionAnswer: '질문 답변 원문', priorityCheck: '우선순위 원문', nextWeekTop3: '자유 형식 TOP3 원문', weakSubject: '취약 과목 원문', planEvaluation: '플랜 평가 원문', extraQuestion: '추가 질문 원문' };

test('주간 구·신 양식과 제출 빈값을 구분하고 사설 첨부는 기존 열람으로 전달한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'standard' });
  const attachment = 'https://study-crack-uploads.s3.ap-northeast-2.amazonaws.com/test-feedback.pdf#scFile=test-marker';
  await page.route('**/api/**', route => route.request().postDataJSON()?.type === 'get_weekly_reports' ? route.fulfill({ json: { weeklyReports: [
    { weekId: '261001', tutorFeedback: { feedbackVersion: 2, submitted: true, tutorComment: '총평', weeklyPlanner: '계획', planReason: '이유', questionAnswer: '답변' } },
    { weekId: '260904', tutorFeedback: { feedbackVersion: 1, submitted: true, priorityCheck: '우선순위', nextWeekTop3: '자유문\n셋으로 나누지 않아요.', weakSubject: '내 취약 과목', planEvaluation: '평가', extraQuestion: '내 추가 질문', tutorImage: attachment } },
    { weekId: '260903', tutorFeedback: { submitted: true, tutorImage: 'https://example.test/unmarked.pdf' } },
    { weekId: '260902', tutorFeedback: { submitted: false, extraQuestion: 'SECRET', tutorImage: attachment } }
  ] } }) : route.fallback());
  await page.goto('/studycrack-mobile.html?screen=weekly');
  const cards = page.locator('.weekly-feedback');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).locator('.feedback-item')).toHaveCount(4);
  await cards.nth(1).locator('summary').click();
  await expect(cards.nth(1).locator('.feedback-item')).toHaveCount(5);
  await expect(cards.nth(1)).toContainText('내 취약 과목');
  await expect(cards.nth(1)).toContainText('내 추가 질문');
  await expect(cards.nth(1).getByRole('button', { name: /전체 보기/ })).toHaveCount(0);
  await page.evaluate(() => { window.__feedbackAttachments = []; window.openPrivateAttachment = href => { window.__feedbackAttachments.push(href); return true; }; });
  await cards.nth(1).getByRole('button', { name: '피드백 첨부 보기' }).click();
  await expect.poll(() => page.evaluate(() => window.__feedbackAttachments)).toEqual([attachment]);
  await expect(cards.nth(2).locator('.feedback-item')).toHaveCount(0);
  await expect(cards.nth(2)).toContainText('제출된 피드백 내용이 비어 있어요');
  await expect(cards.nth(2).getByRole('button', { name: '피드백 첨부 보기' })).toHaveCount(0);
  await expect(cards.nth(3)).not.toContainText('SECRET');
  await expect(cards.nth(3).getByRole('button', { name: '피드백 첨부 보기' })).toHaveCount(0);
});

for (const width of [320, 360, 390, 430]) test(`피드백 전폭·모든 양식·원문 펼침 (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 568 });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'standard' });
  await page.route('**/api/**', route => route.request().postDataJSON()?.type === 'get_weekly_reports' ? route.fulfill({ json: { weeklyReports: [
    { weekId: '261001', tutorName: '긴 이름의 담당 튜터', tutorFeedback: { submitted: true, ...fields } },
    { weekId: '260904', tutorFeedback: { submitted: false, tutorComment: 'SECRET DRAFT' } }
  ] } }) : route.fallback());
  await page.goto('/studycrack-mobile.html?screen=weekly');
  const card = page.locator('.weekly-feedback').first();
  await expect(card.locator('.feedback-item')).toHaveCount(9);
  await expect(page.getByText('SECRET DRAFT')).toHaveCount(0);
  for (const value of Object.values(fields)) await expect(card).toContainText(value);
  const text = card.locator('.feedback-item p').first();
  const previewHeight = await text.evaluate(el => el.getBoundingClientRect().height);
  await card.getByRole('button', { name: '튜터 총평 전체 보기', exact: true }).click();
  await expect.poll(() => text.evaluate(el => el.getAnimations().length)).toBe(0);
  await expect(text).toHaveText(longText);
  expect(await text.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(previewHeight * 2);
  await expect(card.locator('img')).toHaveCount(0);
  await card.getByRole('button', { name: '튜터 총평 접기', exact: true }).click();
  await expect(text).toHaveAttribute('data-expanded', 'false');
  await card.screenshot({ path: info.outputPath(`feedback-${width}.png`), animations: 'disabled' });
  await page.addStyleTag({ content: 'body{font-family:Arial,sans-serif}' });
  await card.evaluate(el => {
    const elements = [el, ...el.querySelectorAll('*')];
    const sizes = elements.map(node => parseFloat(getComputedStyle(node).fontSize));
    elements.forEach((node, index) => { node.style.fontSize = `${sizes[index] * 2}px`; });
  });
  await expect(text).toHaveCSS('font-size', '32px');
  await card.getByRole('button', { name: '튜터 총평 전체 보기', exact: true }).click();
  await expect(text).toHaveText(longText);
  await expectNoHorizontalOverflow(page);
});

test('일정 양방향 모션·닫힌 초점 차단·초안 이어쓰기', async ({ page }, info) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  const origin = page.getByRole('button', { name: '+ 내 일정 추가', exact: true });
  await origin.click();
  const reveal = page.locator('#calendar-event-form');
  await expect(reveal).toHaveAttribute('data-open', 'true');
  await expect(reveal).toHaveCSS('transition-duration', '0.32s, 0.32s, 0.32s');
  await page.getByLabel('일정 제목', { exact: true }).fill('초안 보존 일정');
  await page.getByRole('button', { name: '일정 입력 접기', exact: true }).click();
  await expect(reveal).toHaveAttribute('inert', '');
  await expect(reveal).toHaveAttribute('aria-hidden', 'true');
  await expect(origin).toBeFocused();
  await page.getByRole('button', { name: '작성하던 일정 이어쓰기', exact: true }).click();
  await expect(page.getByLabel('일정 제목', { exact: true })).toHaveValue('초안 보존 일정');
  await page.getByText('추가 정보 (선택)', { exact: true }).click();
  await page.getByLabel('메모', { exact: true }).fill('추가 정보를 열어도 잘리지 않습니다.');
  await reveal.screenshot({ path: info.outputPath('calendar-open.png'), animations: 'disabled' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '일정 입력 접기', exact: true }).click();
  await expect(reveal).not.toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('홈은 공식 일정만 짧게 표시하고 개인 제목은 원문으로 표시한다', async ({ page }) => {
  const now = new Date('2026-10-05T03:00:00Z');
  await page.clock.setFixedTime(now);
  await installAuthenticatedSession(page, { now: now.getTime() });
  await installApiMock(page);
  let events = [];
  await page.route('**/api/user', route => {
    const payload = route.request().postDataJSON();
    if (payload.type === 'get_admission_calendar') return route.fulfill({ json: { events, supportsClientRequestId: true } });
    if (payload.type === 'upsert_admission_calendar_event') {
      const event = { ...payload.data, id: payload.data.clientRequestId };
      events.push(event);
      return route.fulfill({ json: { events, event } });
    }
    return route.fallback();
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  const calendar = page.getByRole('button', { name: '다가오는 일정 확인 및 추가' });
  await expect(calendar).toContainText('10월 학력평가');
  await expect(calendar).not.toContainText('서울교육청');
  await expect(page.locator('.timer-v2-target-summary')).not.toContainText('오늘의 공부를 목표와 연결');
  await calendar.click();
  await expect(page.getByLabel('선택한 날의 일정')).toContainText('10월 학력평가 (서울교육청)');
  await page.getByRole('button', { name: '+ 내 일정 추가', exact: true }).click();
  await page.getByLabel('일정 제목', { exact: true }).fill('내 면접 (원문 유지)');
  await page.getByLabel('시작일', { exact: true }).fill('2026-10-06');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect(calendar).toContainText('내 면접 (원문 유지)');
});

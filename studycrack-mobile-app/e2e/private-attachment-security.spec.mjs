import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
const source = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const utilitySource = await readFile(new URL('../../js/shared/utils.js', import.meta.url), 'utf8');
const coachingSource = await readFile(new URL('../../js/analysis/coaching.js', import.meta.url), 'utf8');
const base = 'https://files.example.invalid/planner/owner/file.pdf';
const marked = `${base}?X-Amz-Signature=old#scFile=${encodeURIComponent(JSON.stringify({ subjectUserId: 'owner', reportKind: 'weekly', reportId: '261001' }))}`;
async function setup(page, mode = 'success') {
  await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><a id="attachment" target="_blank">첨부 보기</a>' }));
  await page.goto('https://dev.studycrack.co.kr/analysis');
  await page.evaluate(() => {
    window.IS_LOCAL = false;
    window.CONFIG = { api: { file: '/synthetic/file', auth: '/synthetic/auth' } };
    localStorage.setItem('userId', 'owner');
  });
  await page.addScriptTag({ content: source });
  await page.evaluate(({ mode, marked, base }) => {
    document.getElementById('attachment').href = marked;
    window.__tabs = []; window.__calls = []; window.__alerts = [];
    window.alert = text => window.__alerts.push(text);
    window.open = () => {
      const tab = { opener: {}, location: { replace: href => { tab.href = href; } }, close: () => { tab.closed = true; } }; window.__tabs.push(tab); return tab;
    };
    window.apiFetch = async (_url, options) => {
      window.__calls.push(JSON.parse(options.body));
      if (mode === 'late') await new Promise(resolve => { window.__finish = resolve; });
      if (mode === 'failure') throw new Error('Denied');
      return { json: async () => ({ downloadUrl: mode === 'foreign' ? 'https://evil.example.invalid/file.pdf?X-Amz-Signature=fresh' : `${base}?X-Amz-Signature=fresh` }) };
    };
  }, { mode, marked, base });
}
test('실제 첨부 링크 클릭은 권한 재확인 후 새 주소를 열고 opener를 제거한다', async ({ page }) => {
  await setup(page); await page.locator('#attachment').click();
  await expect.poll(() => page.evaluate(() => window.__tabs[0]?.href)).toBe(`${base}?X-Amz-Signature=fresh`);
  expect(await page.evaluate(() => window.__tabs[0].opener)).toBeNull();
  expect(await page.evaluate(() => window.__calls[0])).toEqual({ type: 'get_study_file_download', data: { fileUrl: marked, subjectUserId: 'owner', reportKind: 'weekly', reportId: '261001' } });
});
for (const mode of ['failure', 'foreign']) test(`첨부 ${mode}는 오래된 주소로 우회하지 않고 빈 창을 닫는다`, async ({ page }) => {
  await setup(page, mode); await page.locator('#attachment').click();
  await expect.poll(() => page.evaluate(() => window.__tabs[0]?.closed)).toBe(true);
  expect(await page.evaluate(() => window.__tabs[0].href)).toBeUndefined(); expect(await page.evaluate(() => window.__alerts.length)).toBe(1);
});
test('다운로드 대기 중 계정 전환이나 로그아웃 뒤에는 파일을 열지 않는다', async ({ page }) => {
  await setup(page, 'late'); await page.locator('#attachment').click();
  await expect.poll(() => page.evaluate(() => typeof window.__finish)).toBe('function');
  await page.evaluate(() => { localStorage.setItem('userId', 'other'); window.__finish(); });
  await expect.poll(() => page.evaluate(() => window.__tabs[0]?.closed)).toBe(true);
  expect(await page.evaluate(() => window.__tabs[0].href)).toBeUndefined();
});
test('만료된 첨부 이미지 주소는 한 번 재확인하며 재실패 시 반복 요청하지 않는다', async ({ page }) => {
  await setup(page);
  await page.evaluate(marked => {
    const img = document.createElement('img'); img.src = marked; document.body.appendChild(img);
    img.dispatchEvent(new Event('error')); img.dispatchEvent(new Event('error'));
  }, marked);
  await expect.poll(() => page.evaluate(() => document.querySelector('img').src)).toBe(`${base}?X-Amz-Signature=fresh`);
  expect(await page.evaluate(() => window.__calls.length)).toBe(1);
});
test('주간 피드백의 PDF 주소는 HTML 속성을 만들거나 스크립트를 주입하지 않는다', async ({ page }) => {
  await setup(page);
  await page.addScriptTag({ content: utilitySource });
  await page.addScriptTag({ content: coachingSource });
  const attachment = 'https://files.example.invalid/file.pdf" onmouseover="window.__unsafe=true';
  await page.evaluate(attachment => {
    const modal = document.createElement('div');
    modal.id = 'feedbackModal';
    const content = document.createElement('div');
    modal.appendChild(content); document.body.appendChild(modal);
    window.renderPdfToImages = () => {};
    openFeedbackModalV2({ weekId: '261001', date: '2026-10-01', tutorName: '테스트 튜터', tutorFeedback: { submitted: true, tutorImage: attachment } }, modal, content);
  }, attachment);
  await expect(page.locator('#attachedPdfData')).toHaveAttribute('data-pdf-url', attachment);
  await expect(page.locator('#feedbackModal [onmouseover]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__unsafe)).toBeUndefined();
});

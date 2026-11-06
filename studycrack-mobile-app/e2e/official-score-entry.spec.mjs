import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

const require = createRequire(import.meta.url);
const cognitoBrowserSdk = await readFile(require.resolve('amazon-cognito-identity-js/dist/amazon-cognito-identity.min.js'));
const official = () => ({ scoreBasis: 'official',
  kor: { opt: '언어와매체', std: 132, pct: 94, grd: 2 }, math: { opt: '미적분', std: 135, pct: 96, grd: 1 },
  eng: { grd: 2 }, hist: { grd: 1 },
  inq1: { name: '물리학Ⅰ', std: 40, pct: 0, grd: 9 }, inq2: { name: '화학Ⅱ', std: 65, pct: 90, grd: 2 }
});
const march = { ...mockUser.quantitative.jun, kor: { opt: '언매', common: 60, elective: 20, raw: 80, std: 130, pct: 90, grd: 2 } };

async function prepare(page, { saved = false, failOnce = false } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const stylesheet = await page.request.get('/studycrack-mobile-app/dist/studycrack-mobile.css');
  expect(stylesheet.ok(), 'The preview must serve the built font stylesheet').toBe(true);
  const faces = ((await stylesheet.text()).match(/@font-face\s*\{[^}]*\}/g) || []).filter(rule => /\bfont-family:\s*(["']?)Paperlogy\1\s*[;}]/.test(rule));
  expect(faces.length, 'The artifact must provide the actual Paperlogy font faces').toBeGreaterThan(0);
  await page.route('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css', route => route.fulfill({ contentType: 'text/css', body: faces.join('\n') }));
  await page.route('https://cdn.jsdelivr.net/npm/amazon-cognito-identity-js@6.3.3/dist/amazon-cognito-identity.min.js', route => route.fulfill({ contentType: 'application/javascript', body: cognitoBrowserSdk }));
  // Session/API fixtures cover score persistence; optional PDF, icon, placeholder and unused Google-font providers are offline.
  await page.route(/^https:\/\/(?:cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|placehold\.co)\//, route => route.abort());
  await installAuthenticatedSession(page);
  const user = { ...mockUser, tutorialRewardClaimed: true, quantitative: { mar: march, ...(saved ? { csat: official() } : {}) } };
  await installApiMock(page, { userOverrides: user });
  const requests = [], writes = [], dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.route('**/api/**', route => {
    const payload = route.request().postDataJSON();
    requests.push(payload);
    if (['get_user_analysis', 'get_login_profile', 'get_user'].includes(payload?.type)) return route.fulfill({ json: user });
    if (payload?.type === 'update_quan') {
      writes.push(payload.data);
      if (failOnce && writes.length === 1) return route.fulfill({ status: 500, json: { error: '저장 확인이 필요해요.' } });
      user.quantitative = structuredClone(payload.data);
      return route.fulfill({ json: { message: 'Saved', recommendationInputRevision: writes.length + 1 } });
    }
    if (payload?.type === 'get_tutorial_recommendations') return route.fulfill({ json: {
      selected: [{ school: '성적표대학교', major: '검증학과', currentScore: 108.7, simScore: 108.7,
        recommendation: { band: 'match', basis: 'display_score', convertedScore: 708.7, estimatedCut: 700, marginToCut: 8.7 },
        simulation: { status: 'unavailable', code: 'RAW_SCORE_DATA_UNAVAILABLE' } }],
      page: { hasMore: false, nextCursor: null }
    } });
    return route.fallback();
  });
  return { user, requests, writes, dialogs };
}

async function openModal(page) {
  await page.getByRole('button', { name: '입력·수정', exact: true }).click();
  return page.getByRole('dialog', { name: '성적 수정', exact: true });
}
async function next(dialog) { await dialog.getByRole('button', { name: '다음', exact: true }).click(); }
async function fillSubject(root, key, item) {
  await root.locator(`[data-field="v2e-${key}-${key.startsWith('inq') ? 'subject' : 'type'}"]`).selectOption(item.opt || item.name);
  for (const metric of ['std', 'pct', 'grd']) await root.locator(`[data-field="v2e-${key}-${metric}"]`).fill(String(item[metric]));
}

test('수능 최초 입력은 원점수 환산 없이 저장하고 실패·재시도·새로고침·추천에서 같은 성적표 값을 쓴다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 850 });
  const api = await prepare(page, { failOnce: true });
  await page.goto('/studycrack-mobile.html?screen=scoreInfo');
  await page.locator('[data-field="scoreExamType"]').selectOption('수능');
  const dialog = await openModal(page);
  await expect(dialog).toContainText('수능 성적표');
  await expect(dialog.locator('[data-field="v2e-korean-common"]')).toHaveCount(0);
  const exam = official();
  await fillSubject(dialog, 'korean', exam.kor);
  await dialog.screenshot({ path: info.outputPath('official-score-320.png') });
  await next(dialog); await fillSubject(dialog, 'math', exam.math);
  await next(dialog); await dialog.locator('[data-field="v2e-english"]').fill('2');
  await next(dialog); await dialog.locator('[data-field="v2e-history"]').fill('1');
  await next(dialog); await fillSubject(dialog, 'inq1', exam.inq1);
  await next(dialog); await fillSubject(dialog, 'inq2', exam.inq2);
  const save = dialog.getByRole('button', { name: '전체 성적 저장', exact: true });
  await save.click();
  await expect(dialog.locator('.score-save-error')).toBeVisible();
  await expect(dialog.locator('[data-field="v2e-inq2-std"]')).toHaveValue('65');
  await save.click(); await expect(dialog).toHaveCount(0);
  expect(api.writes).toHaveLength(2);
  expect(api.writes[1].csat).toEqual(exam);
  expect(api.writes[1].mar).toEqual(march);
  expect(api.requests.filter(request => request.type === 'convert_score')).toHaveLength(0);
  await page.reload();
  await expect(page.locator('[data-field="scoreExamType"]')).toHaveValue('수능');
  const reopened = await openModal(page);
  await expect(reopened.locator('[data-field="v2e-korean-std"]')).toHaveValue('132');
  await reopened.getByRole('button', { name: '닫기', exact: true }).click();
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await expect(page.locator('.analysis-score-summary')).toContainText('국어 표준');
  await expect(page.locator('.analysis-score-summary')).toContainText('132점');
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  await expect(page.locator('.add-univ-card')).toContainText('현재 점수 기준 추천');
  const recommendation = api.requests.findLast(request => request.type === 'get_tutorial_recommendations');
  expect(recommendation.examMode).toBe('csat');
  expect(recommendation.userScores.kor.std).toBe(132);
  expect(recommendation.userScores.inq1.pct).toBe(0);
  expect(recommendation.userScores.kor.raw).toBeUndefined();
  await expectNoHorizontalOverflow(page);
});

test('수능 빈칸·범위·탐구 중복은 입력을 보존하며 저장 전에 설명한다', async ({ page }) => {
  const api = await prepare(page, { saved: true });
  await page.goto('/studycrack-mobile.html?screen=scoreInfo');
  const dialog = await openModal(page);
  await dialog.locator('[data-field="v2e-korean-pct"]').fill('');
  await next(dialog);
  await expect(dialog.locator('#v2e-korean-pct-error')).toBeVisible();
  await dialog.locator('[data-field="v2e-korean-pct"]').fill('0');
  await dialog.locator('[data-field="v2e-korean-std"]').fill('132.5');
  await next(dialog);
  await expect(dialog.locator('[data-field="v2e-korean-std"]')).toHaveValue('132.5');
  await expect(dialog.locator('#v2e-korean-std-error')).toContainText('정수');
  await dialog.locator('[data-field="v2e-korean-std"]').fill('201');
  await next(dialog);
  await expect(dialog.locator('#v2e-korean-std-error')).toContainText('0~200');
  await dialog.locator('[data-field="v2e-korean-std"]').fill('132');
  for (let step = 1; step < 6; step++) await next(dialog);
  await dialog.locator('[data-field="v2e-inq2-subject"]').selectOption('물리학Ⅰ');
  await dialog.getByRole('button', { name: '전체 성적 저장', exact: true }).click();
  await expect(dialog.locator('#v2e-inq2-subject-error')).toContainText('다른 과목');
  expect(api.writes).toHaveLength(0);
});

test('수능과 모의고사 전환 시 각각의 저장 성적과 입력 방식을 복원한다', async ({ page }) => {
  await prepare(page, { saved: true });
  await page.goto('/studycrack-mobile.html?screen=scoreInfo');
  await expect(page.locator('[data-field="scoreExamType"]')).toHaveValue('수능');
  let dialog = await openModal(page);
  await expect(dialog.locator('[data-field="v2e-korean-std"]')).toHaveValue('132');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('[data-field="scoreExamType"]').selectOption('3월 모의고사');
  dialog = await openModal(page);
  await expect(dialog.locator('[data-field="v2e-korean-common"]')).toHaveValue('60');
  await expect(dialog.locator('[data-field="v2e-korean-std"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('[data-field="scoreExamType"]').selectOption('수능');
  dialog = await openModal(page);
  await expect(dialog.locator('[data-field="v2e-korean-std"]')).toHaveValue('132');
});

test('온보딩도 수능 성적표를 원점수 없이 저장한다', async ({ page }) => {
  const api = await prepare(page);
  await page.goto('/studycrack-mobile.html?screen=ob2');
  await page.locator('[data-field="scoreExamType"]').selectOption('수능');
  const root = page.locator('[data-screen="ob2"]');
  const exam = official();
  for (const [key, item] of [['korean', exam.kor], ['math', exam.math], ['inq1', exam.inq1], ['inq2', exam.inq2]]) await fillSubject(root, key, item);
  await root.locator('[data-field="v2e-english"]').selectOption('2');
  await root.locator('[data-field="v2e-history"]').selectOption('1');
  await root.getByRole('button', { name: '저장하고 학습 MBTI로' }).click();
  await expect(page.locator('[data-screen="ob3"]')).toBeVisible();
  expect(api.writes[0].csat).toEqual(exam);
  expect(api.requests.filter(request => request.type === 'convert_score')).toHaveLength(0);
});

for (const width of [390, 1440]) test(`웹 수능 입력은 성적표 값을 직접 저장하고 원점수 필드를 비활성화한다 (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const api = await prepare(page, { saved: true, failOnce: true });
  await page.goto('/survey.html');
  await expect(page.locator('#koreanOpt')).toHaveValue('언매');
  await page.getByRole('button', { name: '2. 성적 입력 (정량)', exact: true }).click();
  await page.locator('#examSelect').selectOption('csat');
  await expect(page.locator('#korStd')).toBeEditable();
  await expect(page.locator('#korCommon')).toBeDisabled();
  await expect(page.locator('#inq1Pct')).toHaveValue('0');
  await page.locator('#korStd').fill('133');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#korStd')).toHaveCSS('font-family', /Paperlogy/);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath(`web-official-${width}.png`), animations: 'disabled' });
  await page.locator('button[onclick="saveQuantitative()"]').click();
  await expect.poll(() => api.dialogs.length).toBe(1);
  await expect(page.locator('#korStd')).toHaveValue('133');
  await page.locator('button[onclick="saveQuantitative()"]').click();
  await expect(page).toHaveURL(/\/analysis(?:\.html)?$/);
  await expect(page.locator('#pageLoadingOverlay')).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  expect(api.writes[1].csat.kor).toEqual({ opt: '언매', std: 133, pct: 94, grd: 2 });
  expect(api.writes[1].csat.inq1.pct).toBe(0);
  expect(api.writes[1].csat.scoreBasis).toBe('official');
  expect(api.writes[1].mar).toEqual(march);
  expect(api.requests.filter(request => request.type === 'convert_score')).toHaveLength(0);
  await expectNoHorizontalOverflow(page);
});

test('늦게 도착한 모의고사 환산 응답은 수능 성적표 입력을 덮어쓰지 않는다', async ({ page }) => {
  await prepare(page, { saved: true });
  let finish;
  let resolveFinished;
  const responseFinished = new Promise(resolve => { resolveFinished = resolve; });
  await page.route('**/api/**', async route => {
      if (route.request().postDataJSON()?.type !== 'convert_score') return route.fallback();
      await new Promise(release => { finish = release; });
      await route.fulfill({ json: { std: 199, pct: 99, grd: 1 } });
      resolveFinished();
  });
  await page.goto('/survey.html');
  await expect(page.locator('#koreanOpt')).toHaveValue('언매');
  await page.getByRole('button', { name: '2. 성적 입력 (정량)', exact: true }).click();
  await page.locator('#korCommon').fill('62');
  await page.locator('#korCommon').blur();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await page.locator('#examSelect').selectOption('csat');
  await page.locator('#korStd').fill('133');
  finish(); await responseFinished;
  await expect(page.locator('#korStd')).toHaveValue('133');
  await expect(page.locator('#korPct')).toHaveValue('94');
});

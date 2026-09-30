import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const { documents } = JSON.parse(await readFile(new URL('../../content/legal/legacy.json', import.meta.url), 'utf8'));
const webOrder = ['standard', 'service', 'privacy', 'refund', 'marketing'];

test('소셜 신규 가입은 연령 확인을 별도 필수 선택으로 표시한다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/social-callback.html`);
    await expect(page.locator('#socialSignupAge14')).not.toBeChecked();
    await expect(page.locator('.social-required-term')).toHaveCount(5);
    await expect(page.locator('#socialSignupMarketingConsent')).not.toBeChecked();
    await expect(page.locator('#socialSignupAge14').locator('..')).toContainText('만 14세 이상');
  } finally { await context.close(); }
});

test('계정 정보는 가입 당시 동의와 현재 수신 상태를 구분하고 기존 회원 버전을 꾸미지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { userOverrides: { termsAgreed: true, marketingAgreed: false, tutorialRewardClaimed: true } });
  await page.goto('/studycrack-mobile.html?screen=accountInfo');
  await page.getByText('가입 약관 동의 기록', { exact: true }).click();
  await expect(page.getByText(/문서별 버전 기록은 남아 있지 않습니다/)).toBeVisible();
  await expect(page.getByRole('switch', { name: '마케팅 수신 동의' })).not.toBeChecked();
  await expectNoHorizontalOverflow(page);
});

test('가입 당시 선택 동의는 철회 후에도 당시 기록으로만 표시한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { userOverrides: { termsAgreed: true, marketingAgreed: false, tutorialRewardClaimed: true,
    signupConsent: { schema: 1, recordedAt: '2026-09-28T00:00:00Z', documents: Object.fromEntries(Object.entries(documents).map(([id, doc]) => [id, { revision: doc.revision, accepted: true }])) }
  } });
  await page.goto('/studycrack-mobile.html?screen=accountInfo');
  await page.getByText('가입 약관 동의 기록', { exact: true }).click();
  await expect(page.getByText(documents.privacy.revision, { exact: true })).toBeVisible();
  await expect(page.getByText(/현재 마케팅 수신 상태는 위 설정/)).toBeVisible();
  await expect(page.getByRole('switch', { name: '마케팅 수신 동의' })).not.toBeChecked();
  await expectNoHorizontalOverflow(page);
});

test('공개 홈페이지와 분석 소개의 대표자 정보는 승인된 이름으로 일치한다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
    for (const url of ['/', '/analysis.html']) {
      await page.goto(`${baseURL}${url}`);
      const representative = page.getByText('대표자: 김태윤 | 사업자등록번호: 201-61-00623', { exact: true });
      await representative.scrollIntoViewIfNeeded();
      await expect(representative).toBeVisible();
      await expect(page.getByText(/대표자:\s*임태룽/)).toHaveCount(0);
    }
  } finally { await context.close(); }
});

test('웹과 모바일 환불 FAQ는 동일한 착수 기준과 예외를 표시한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { userOverrides: { tutorialRewardClaimed: true } });
  await page.route('**/api/user', async route => {
    const { type } = route.request().postDataJSON() || {};
    if (['get_login_profile', 'get_user'].includes(type)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userid: 'e2e-student', name: '테스트', role: 'student', computedTier: 'basic', tutorialRewardClaimed: true }) });
    } else await route.fallback();
  });
  await page.goto('/qna.html');
  const webFaq = page.locator('.faq-item').filter({ hasText: '환불 규정이 궁금합니다.' });
  await webFaq.locator('.faq-question').click();
  await expect(webFaq.locator('.faq-answer')).toBeVisible();
  await expect(webFaq).toContainText('분석 착수 전 요청은 전액 환불');
  await webFaq.getByRole('link', { name: '환불 규정 전문 보기' }).click();
  await expect(page).toHaveURL(/\/refund$/);
  await expect(page.locator('#refund')).toContainText('가분적 서비스의 미제공 부분');
  await page.goto('/studycrack-mobile.html?screen=customerSupport');
  const mobileFaq = page.locator('[data-faq-id="faq3"]');
  await mobileFaq.click();
  await expect(mobileFaq).toHaveAttribute('aria-expanded', 'true');
  await expect(mobileFaq.locator('.faq-answer')).toContainText('분석 착수 전 요청은 전액 환불');
  await expect(mobileFaq.locator('.faq-answer')).toContainText('회사 귀책 사유 및 관계 법령');
  await expectNoHorizontalOverflow(page);
});

test('일반 가입 약관은 JavaScript 없이도 공통 원문을 포함하고 동의를 미리 선택하지 않는다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
    await page.goto(`${baseURL}/signup.html`);
    for (const [index, id] of webOrder.entries()) {
      expect((await page.locator(`#termModal${index + 1} .term-text-box`).textContent()).trim()).toBe(documents[id].body.trim());
    }
    for (const checkbox of await page.locator('.terms-container input[type="checkbox"]').all()) await expect(checkbox).not.toBeChecked();
  } finally {
    await context.close();
  }
});

test('모바일 가입의 다섯 약관 전문이 공통 원문과 같고 열람은 동의를 변경하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authSignup');
  for (const [id, document] of Object.entries(documents)) {
    await page.locator(`[data-action="openSignupTermsModal"][data-terms-type="${id}"]`).click();
    const dialog = page.getByRole('dialog', { name: document.title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.terms-modal-body')).toHaveText(document.body);
    await expectNoHorizontalOverflow(page);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  for (const checkbox of await page.locator('[data-signup-term]').all()) await expect(checkbox).not.toBeChecked();
});

test('기존 공개 개인정보·서비스 약관 화면은 비로그인 직접 진입에서도 공통 원문을 보여준다', async ({ page }) => {
  await installApiMock(page);
  for (const [screen, id] of [['privacyPolicy', 'privacy'], ['termsScreen', 'service']]) {
    await page.goto(`/studycrack-mobile.html?screen=${screen}`);
    await expect(page.locator(`[data-screen="${screen}"] .sc-reading-content`)).toHaveText(documents[id].body);
    await expectNoHorizontalOverflow(page);
  }
});

for (const width of [320, 390, 1024]) {
  test(`공개 정책 네 페이지는 JS·로그인 없이 읽고 이동할 수 있다 (${width}px)`, async ({ browser, baseURL }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 844 } });
    try {
      const page = await context.newPage();
      const foreign = [];
      page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL).origin) foreign.push(request.url()); });
      for (const [slug, ids] of [['terms', ['standard', 'service', 'marketing']], ['privacy', ['privacy']], ['refund', ['refund']], ['delete-account', []]]) {
        const response = await page.goto(`${baseURL}/${slug}`);
        expect(response.status()).toBe(200);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', `/${slug}`);
        for (const id of ids) {
          const text = page.locator(`[data-legal-document="${id}"]`);
          await expect(text).toHaveText(documents[id].body);
          await expect(text).toHaveAttribute('data-legal-revision', documents[id].revision);
        }
        await expectNoHorizontalOverflow(page);
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('#legal-main')).toBeFocused();
        await page.locator('.legal-page-footer').scrollIntoViewIfNeeded();
        await expect(page.getByRole('link', { name: '고객센터 070-8128-1126' })).toBeInViewport();
        if (width === 390 && ['privacy', 'delete-account'].includes(slug)) {
          await page.getByRole('heading', { level: 1 }).click();
          await page.screenshot({ path: testInfo.outputPath(`${slug}.png`), fullPage: true });
        }
      }
      await expect(page.locator('form, input')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'contact@studycrack.co.kr로 요청하기' })).toHaveAttribute('href', /^mailto:contact@studycrack.co.kr\?subject=/);
      expect(foreign).toEqual([]);
      await page.getByRole('link', { name: '환불 규정 확인', exact: true }).click();
      await expect(page).toHaveURL(/\/refund$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/delete-account/);
    } finally { await context.close(); }
  });
}

test('상품별 결제 동의 안내는 BASIC·STARTER에 4주 만료를 강요하지 않는다', async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/terms');
  for (const [tier, amount] of [['basic', 25000], ['starter', 39000], ['standard', 49000], ['pro', 149000]]) {
    await page.evaluate(data => localStorage.setItem('checkoutData', JSON.stringify(data)), {
      tier, amount, name: '테스트', productName: tier.toUpperCase(), paymentIntentId: 'PI_123e4567e89b12d3a456426614174000', orderId: 'PI_123e4567e89b12d3a456426614174000'
    });
    await page.goto('/checkout.html');
    await expect(page.locator('#checkoutAgreementText')).toContainText(tier.toUpperCase());
    if (['standard', 'pro'].includes(tier)) await expect(page.locator('#checkoutAgreementText')).toContainText('4주');
    else await expect(page.locator('#checkoutAgreementText')).not.toContainText('4주');
    await expect(page.locator('#agreeTerms')).not.toBeChecked();
    await expect(page.locator('#chkPrice')).toHaveText(`${amount.toLocaleString('ko-KR')}원`);
  }
});

import { expect, test } from '@playwright/test';

const applicationId = 'APP_123e4567-e89b-12d3-a456-426614174000';
const token = 'A'.repeat(43);
const startPath = '/2027-jungsi-consulting/start';
const inviteUrl = `${startPath}#app=${applicationId}&invite=${token}`;
const inviteKey = 'sc_jungsi_invite_v1';

async function prepare(page, { loggedIn = true, deferPreflight = false, preflightError = '' } = {}) {
  const state = { preflightCalls: 0, preflightError, releasePreflight: null };
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  state.releasePreflight = unblock;
  await page.addInitScript(loggedIn => {
    localStorage.setItem('userRole', 'student');
    window.__inviteFixture = { loggedIn, calls: [], claimError: '', deferClaim: false, releaseClaim: null };
  }, loggedIn);
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.CONFIG = { api: { consulting: 'https://api.example.invalid/consulting', consultingPublic: 'https://api.example.invalid/consulting-public' } };` }));
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.hasClientSession = () => window.__inviteFixture.loggedIn;
    window.apiFetch = async (_url, options) => {
      const request = JSON.parse(options.body), fixture = window.__inviteFixture;
      fixture.calls.push(request);
      if (request.type === 'student_claim_v2_consulting_invite') {
        const error = fixture.claimError;
        if (fixture.deferClaim) await new Promise(resolve => { fixture.releaseClaim = resolve; });
        return new Response(JSON.stringify(error ? { success: false, code: error } : { success: true, data: { caseId: 'CASE_synthetic' } }), { status: error ? 409 : 200 });
      }
      return new Response(JSON.stringify({ success: true, data: { available: false } }));
    };
  ` }));
  await page.route('https://api.example.invalid/consulting-public', async route => {
    state.preflightCalls++;
    expect(route.request().postDataJSON().type).toBe('public_preflight_v2_consulting_invite');
    if (deferPreflight) await gate;
    await route.fulfill({ status: state.preflightError ? (state.preflightError === 'INVITE_EXPIRED' ? 410 : 409) : 200, json: state.preflightError ? { success: false, code: state.preflightError } : { success: true, data: { maskedEmail: 's***@naver.com', maskedPhone: '010-****-0000', expiresAt: '2099-01-01T00:00:00.000Z' } } });
  });
  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
  return state;
}

const codeInput = page => page.getByLabel('이메일로 받은 10자리 인증코드');
const claimButton = page => page.getByRole('button', { name: '유료회원 인증하고 시작하기' });
const claimCalls = page => page.evaluate(() => window.__inviteFixture.calls.filter(call => call.type === 'student_claim_v2_consulting_invite'));

test('첫 초대 진입은 이메일 기준 로그인 안내만 보여주고 계정 불일치를 미리 표시하지 않는다', async ({ page }) => {
  await prepare(page, { loggedIn: false });
  await expect(page.getByRole('status')).toContainText('신청 이메일과 같은 이메일의 계정');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toHaveAttribute('href', /returnUrl=.*start/);
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
  await expect(page).toHaveURL(new RegExp(`${startPath}$`));
});

test('로그인해도 초대 확인이 끝나기 전에는 코드를 제출할 수 없다', async ({ page }) => {
  const state = await prepare(page, { deferPreflight: true });
  await expect(page.getByRole('status')).toHaveText('초대 정보를 확인하고 있습니다.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
  state.releasePreflight();
  await expect(codeInput(page)).toBeVisible();
});

test('다른 이메일 오류를 정확히 표시하고 재입력 뒤 같은 초대를 정상 인증한다', async ({ page }, testInfo) => {
  await prepare(page);
  await expect(codeInput(page)).toBeVisible();
  await page.evaluate(() => { window.__inviteFixture.claimError = 'IDENTITY_MISMATCH'; });
  await codeInput(page).fill('0123456789');
  await claimButton(page).click();
  await expect(page.getByRole('status')).toContainText('로그인한 계정의 이메일이 신청 이메일과 다릅니다.');
  await expect(page.getByRole('status')).not.toContainText('전화번호');
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
  const firstCall = (await claimCalls(page))[0];
  expect(firstCall.data.applicationId).toBe(applicationId);
  expect(firstCall.data).not.toHaveProperty('email');
  expect(firstCall.data).not.toHaveProperty('phone');
  await codeInput(page).fill('1234567890');
  await expect(page.getByRole('status')).toHaveText('이메일로 받은 인증코드를 입력해주세요.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`consulting-invite-${testInfo.project.name}-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => { window.__inviteFixture.claimError = ''; });
  await claimButton(page).click();
  await expect(page).toHaveURL(/\/2027-jungsi-consulting\/home$/);
  expect((await claimCalls(page))[1].data.idempotencyKey).toBe(firstCall.data.idempotencyKey);
  expect(await page.evaluate(key => sessionStorage.getItem(key), inviteKey)).toBeNull();
});

test('브라우저가 이전 화면을 복원하면 실패 문구와 코드가 지워지고 자동 재인증하지 않는다', async ({ page }) => {
  const state = await prepare(page);
  await page.evaluate(() => { window.__inviteFixture.claimError = 'IDENTITY_MISMATCH'; });
  await codeInput(page).fill('0123456789');
  await claimButton(page).click();
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
  const count = state.preflightCalls;
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.getByRole('status')).toHaveText('이메일로 받은 인증코드를 입력해주세요.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await expect(codeInput(page)).toHaveValue('');
  expect(state.preflightCalls).toBe(count + 1);
  expect(await claimCalls(page)).toHaveLength(1);
});

for (const exit of ['navigate', 'logout']) test(`${exit} 이후 도착한 인증 결과는 화면을 이동하거나 초대를 지우지 않는다`, async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => { window.__inviteFixture.deferClaim = true; });
  await codeInput(page).fill('0123456789');
  await claimButton(page).click();
  await expect.poll(() => page.evaluate(() => typeof window.__inviteFixture.releaseClaim)).toBe('function');
  await expect(codeInput(page)).toBeDisabled();
  await page.evaluate(exit => {
    if (exit === 'logout') {
      window.__inviteFixture.loggedIn = false;
      window.dispatchEvent(new Event('studycrack:session-ended'));
    } else {
      history.pushState(null, '', '/2027-jungsi-consulting/home');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, exit);
  if (exit === 'logout') await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  else await expect(page.getByRole('heading', { name: '등록된 컨설팅이 없습니다' })).toBeVisible();
  await page.evaluate(() => window.__inviteFixture.releaseClaim());
  expect(await page.evaluate(key => sessionStorage.getItem(key) !== null, inviteKey)).toBe(true);
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(1);
});

test('초대 확인 오류는 계정 불일치로 단정하지 않고 만료 초대는 제출을 차단한다', async ({ page }) => {
  const state = await prepare(page, { preflightError: 'IDENTITY_MISMATCH' });
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
  await expect(page.getByRole('status')).not.toContainText('계정의 이메일');
  await expect(codeInput(page)).toHaveCount(0);
  state.preflightError = 'INVITE_EXPIRED';
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.getByRole('status')).toContainText('초대 유효기간이 만료되었습니다.');
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
});

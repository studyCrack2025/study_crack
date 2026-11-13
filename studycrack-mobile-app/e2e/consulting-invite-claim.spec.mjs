import { expect, test } from '@playwright/test';

const applicationId = 'APP_123e4567-e89b-12d3-a456-426614174000';
const token = 'A'.repeat(43);
const startPath = '/2027-jungsi-consulting/start';
const homePath = '/2027-jungsi-consulting/home';
const inviteUrl = `${startPath}#app=${applicationId}&invite=${token}`;
const inviteKey = 'sc_jungsi_invite_v1';
const fixtureLoginKey = 'fixture-consulting-login';
const inviteSummary = { maskedEmail: 's***@naver.com', maskedPhone: '010-****-0000', expiresAt: '2099-01-01T00:00:00.000Z' };
const linkedHome = {
  available: true, workflowState: 'SURVEY_DRAFT', nextAction: 'COMPLETE_SURVEY', nextDueAt: null,
  progress: ['onboarding', 'survey', 'materials', 'written_consultation', 'report', 'final_call'].map((step, index) => ({ step, status: ['completed', 'current'][index] || 'upcoming' })),
  session: null, report: null, alerts: []
};

async function prepare(page, { loggedIn = true, role = 'student', deferStatus = false, deferPublic = false, inviteError = '', publicError = '', linked = false } = {}) {
  let releasePublic;
  const publicGate = new Promise(resolve => { releasePublic = resolve; });
  await page.addInitScript(({ loggedIn, role, deferStatus, inviteError, linked, fixtureLoginKey, inviteSummary, linkedHome }) => {
    loggedIn = loggedIn || sessionStorage.getItem(fixtureLoginKey) === '1';
    localStorage.setItem('userRole', role);
    if (loggedIn) localStorage.setItem('userEmail', 'student-account@example.invalid');
    window.__inviteFixture = { loggedIn, calls: [], inviteError, linked, deferStatus, inviteSummary, linkedHome, claimError: '', deferClaim: false };
  }, { loggedIn, role, deferStatus, inviteError, linked, fixtureLoginKey, inviteSummary, linkedHome });
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.CONFIG = { api: { consulting: 'https://api.example.invalid/consulting', consultingPublic: 'https://api.example.invalid/consulting-public' } };` }));
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.hasClientSession = () => window.__inviteFixture.loggedIn;
    window.apiFetch = async (_url, options) => {
      const request = JSON.parse(options.body), fixture = window.__inviteFixture;
      fixture.calls.push(request);
      const reply = (error, data) => {
        const status = { FORBIDDEN: 403, INVITE_INVALID: 400, INVITE_EXPIRED: 410 }[error] ?? (error ? 409 : 200);
        return new Response(JSON.stringify(error ? { success: false, code: error } : { success: true, data }), { status });
      };
      if (request.type === 'student_get_v2_consulting_invite_status') {
        if (fixture.deferStatus) await new Promise(resolve => { fixture.releaseStatus = resolve; });
        return reply(fixture.inviteError, fixture.linked ? { linked: true } : { linked: false, ...fixture.inviteSummary });
      }
      if (request.type === 'student_claim_v2_consulting_invite') {
        const error = fixture.claimError;
        if (fixture.deferClaim) await new Promise(resolve => { fixture.releaseClaim = resolve; });
        return reply(error, { caseId: 'CASE_synthetic' });
      }
      return reply('', fixture.linked ? fixture.linkedHome : { available: false });
    };
  ` }));
  await page.route('https://api.example.invalid/consulting-public', async route => {
    expect(route.request().postDataJSON().type).toBe('public_preflight_v2_consulting_invite');
    if (deferPublic) await publicGate;
    const status = publicError === 'SERVER_ERROR' ? 503 : publicError ? 409 : 200;
    await route.fulfill({ status, json: publicError ? { success: false, code: publicError } : { success: true, data: inviteSummary } });
  });
  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
  return { releasePublic };
}

const codeInput = page => page.getByLabel('이메일로 받은 10자리 인증코드');
const claimButton = page => page.getByRole('button', { name: '유료회원 인증하고 시작하기' });
const claimCalls = page => page.evaluate(() => window.__inviteFixture.calls.filter(call => call.type === 'student_claim_v2_consulting_invite'));
const statusCalls = page => page.evaluate(() => window.__inviteFixture.calls.filter(call => call.type === 'student_get_v2_consulting_invite_status'));

test('브라우저에 손상된 이전 초대가 있어도 새 링크를 열고, 잘못된 새 링크로 이전 신청을 대신 열지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('fixture-old-invite-seeded')) {
      sessionStorage.setItem('fixture-old-invite-seeded', '1');
      sessionStorage.setItem('sc_jungsi_invite_v1', '{malformed');
    }
  });
  await prepare(page);
  await expect(codeInput(page)).toBeVisible();
  expect((await statusCalls(page))[0].data.applicationId).toBe(applicationId);
  await codeInput(page).fill('0123456789');
  const secondApplicationId = 'APP_223e4567-e89b-12d3-a456-426614174000';
  await page.goto(`${startPath}#app=${secondApplicationId}&invite=${'B'.repeat(43)}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => (await statusCalls(page)).at(-1)?.data.applicationId).toBe(secondApplicationId);
  await expect(codeInput(page)).toHaveValue('');
  const checksBeforeInvalid = (await statusCalls(page)).length;
  await page.goto(`${startPath}#app=APP_another&invite=invalid`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status')).toContainText('유효한 초대 정보를 찾을 수 없습니다.');
  await expect(codeInput(page)).toHaveCount(0);
  expect(await statusCalls(page)).toHaveLength(checksBeforeInvalid);
  expect(await claimCalls(page)).toHaveLength(0);
});

test('알림톡 첫 진입의 공개 조회가 늦어도 오류 문구나 코드 입력을 미리 표시하지 않는다', async ({ page }) => {
  const { releasePublic } = await prepare(page, { loggedIn: false, deferPublic: true });
  await expect(page.getByRole('status')).toHaveText('초대 정보를 확인하고 있습니다.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await expect(page.getByRole('heading', { name: '컨설팅 이용 인증' }).locator('..')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByText(/인증 정보를 확인하지 못했습니다/)).toHaveCount(0);
  await expect(codeInput(page)).toHaveCount(0);
  releasePublic();
  await expect(page.getByRole('status')).toHaveText('컨설팅을 이용할 학생 계정으로 로그인하거나 회원가입해주세요.');
});

test('일시적인 조회 실패는 코드 오류로 표시하지 않고 직접 재확인 후 입력을 연다', async ({ page }) => {
  await prepare(page, { loggedIn: false, publicError: 'SERVER_ERROR' });
  await expect(page.getByRole('status')).toContainText('인증코드가 잘못된 것은 아닙니다.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await page.route('https://api.example.invalid/consulting-public', route => route.fulfill({ json: { success: true, data: inviteSummary } }));
  await page.getByRole('button', { name: '초대 정보 다시 확인' }).click();
  await expect(page.getByRole('status')).toHaveText('컨설팅을 이용할 학생 계정으로 로그인하거나 회원가입해주세요.');
  expect(await claimCalls(page)).toHaveLength(0);
});

for (const when of ['열 때', '인증할 때']) test(`다른 신청이 연결된 계정은 ${when} 차단하고 이전 조사서로 자동 이동하지 않는다`, async ({ page }) => {
  await prepare(page, { inviteError: when === '열 때' ? 'CONSULTING_ACCOUNT_ALREADY_LINKED' : '' });
  if (when === '인증할 때') {
    await page.evaluate(() => { window.__inviteFixture.claimError = 'CONSULTING_ACCOUNT_ALREADY_LINKED'; });
    await codeInput(page).fill('0123456789'); await claimButton(page).click();
  }
  await expect(page.getByRole('status')).toHaveText('이 학생 계정에는 다른 신청의 컨설팅이 이미 연결되어 있습니다. 이번 신청 학생의 별도 계정으로 로그인해주세요.');
  await expect(codeInput(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', /returnUrl=.*start/);
  expect(await page.evaluate(key => Boolean(sessionStorage.getItem(key)), inviteKey)).toBe(true);
  await page.evaluate(() => {
    window.__inviteFixture.inviteError = 'CONSULTING_ACCOUNT_ALREADY_LINKED';
    window.__inviteFixture.linked = true;
    history.pushState(null, '', '/2027-jungsi-consulting/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(new RegExp(`${startPath}$`));
  await expect(page.getByRole('button', { name: '이전에 연결한 내 컨설팅 보기' })).toBeVisible();
  expect(await page.evaluate(() => window.__inviteFixture.calls.filter(call => call.type === 'student_get_v2_consulting_home'))).toHaveLength(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '이전에 연결한 내 컨설팅 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`${homePath}$`));
  await expect(page.getByRole('heading', { name: '나의 정시 컨설팅' })).toBeVisible();
  expect(await page.evaluate(key => sessionStorage.getItem(key), inviteKey)).toBeNull();
});

test('첫 초대 진입은 사용할 학생 계정의 로그인이나 회원가입을 안내한다', async ({ page }) => {
  await prepare(page, { loggedIn: false });
  await expect(page.getByRole('status')).toHaveText('컨설팅을 이용할 학생 계정으로 로그인하거나 회원가입해주세요.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toHaveAttribute('href', /returnUrl=.*start/);
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
  await expect(page).toHaveURL(new RegExp(`${startPath}$`));
});

test('로그인해도 초대 확인이 끝나기 전에는 코드를 제출할 수 없다', async ({ page }) => {
  await prepare(page, { deferStatus: true });
  await expect(page.getByRole('status')).toHaveText('초대 정보를 확인하고 있습니다.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
  await expect.poll(() => page.evaluate(() => typeof window.__inviteFixture.releaseStatus)).toBe('function');
  await page.evaluate(() => window.__inviteFixture.releaseStatus());
  await expect(codeInput(page)).toBeVisible();
});

test('이미 연결한 초대는 처음 인증한 학생으로 로그인하면 코드 없이 기존 진행 현황으로 들어간다', async ({ page }) => {
  await prepare(page, { loggedIn: false, publicError: 'INVITE_ALREADY_CLAIMED', linked: true });
  await expect(page.getByRole('status')).toHaveText('이미 인증을 마친 초대입니다. 처음 인증한 학생 계정으로 로그인해주세요.');
  await expect(page.getByRole('link', { name: '회원가입' })).toHaveCount(0);
  await expect(codeInput(page)).toHaveCount(0);
  expect(await statusCalls(page)).toHaveLength(0);
  await page.route(/\/login\?returnUrl=/, route => {
    expect(new URL(route.request().url()).searchParams.get('returnUrl')).toBe(startPath);
    return route.fulfill({ contentType: 'text/html', body: `<script>sessionStorage.setItem('${fixtureLoginKey}', '1'); location.replace('${startPath}');</script>` });
  });
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${homePath}$`));
  await expect(page.getByRole('heading', { name: '나의 정시 컨설팅' })).toBeVisible();
  expect((await statusCalls(page)).map(call => call.data)).toEqual([{ applicationId, token }]);
  expect(await claimCalls(page)).toHaveLength(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), inviteKey)).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: '나의 정시 컨설팅' })).toBeVisible();
  expect(await statusCalls(page)).toHaveLength(0);
});

for (const when of ['열 때', '코드를 제출할 때']) test(`다른 학생 계정에 연결된 초대는 ${when} 처음 인증한 계정으로 안내한다`, async ({ page }) => {
  const alreadyLinked = when === '열 때';
  const error = 'INVITE_LINKED_TO_OTHER_ACCOUNT';
  await prepare(page, { inviteError: alreadyLinked ? error : '' });
  if (!alreadyLinked) {
    await page.evaluate(error => { window.__inviteFixture.claimError = error; }, error);
    await codeInput(page).fill('0123456789');
    await claimButton(page).click();
  }
  await expect(page.getByRole('status')).toHaveText('이 초대는 이미 다른 학생 계정에 연결되어 있습니다. 처음 인증한 학생 계정으로 로그인해주세요.');
  await expect(page.getByRole('link', { name: '다른 학생 계정으로 로그인' })).toHaveAttribute('href', /returnUrl=.*start/);
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(alreadyLinked ? 0 : 1);
  await expect(page).toHaveURL(new RegExp(`${startPath}$`));
});

test('로그아웃 뒤 도착한 연결 확인은 진행 화면을 열지 않는다', async ({ page }) => {
  await prepare(page, { linked: true, deferStatus: true, publicError: 'INVITE_ALREADY_CLAIMED' });
  await expect.poll(() => page.evaluate(() => typeof window.__inviteFixture.releaseStatus)).toBe('function');
  await page.evaluate(() => {
    window.__inviteFixture.loggedIn = false;
    window.dispatchEvent(new Event('studycrack:session-ended'));
  });
  await expect(page.getByRole('status')).toContainText('처음 인증한 학생 계정으로 로그인해주세요.');
  await page.evaluate(() => window.__inviteFixture.releaseStatus());
  await expect(page).toHaveURL(new RegExp(`${startPath}$`));
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key) !== null, inviteKey)).toBe(true);
});

for (const role of ['admin', 'tutor']) test(`${role} 세션은 학생용 인증코드 입력 대신 계정 전환 안내를 본다`, async ({ page }) => {
  await prepare(page, { role });
  await expect(page.getByRole('status')).toContainText('시크릿 창에서 받은 링크를 열고 컨설팅을 이용할 학생 계정으로 로그인해주세요.');
  await expect(codeInput(page)).toHaveCount(0);
  await expect(claimButton(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
});

for (const code of ['FORBIDDEN', 'AUTH_RETRY_REQUIRED']) test(`${code} 응답은 코드 오류 대신 학생 계정 확인을 안내한다`, async ({ page }) => {
  await prepare(page);
  await page.evaluate(code => { window.__inviteFixture.claimError = code; }, code);
  await codeInput(page).fill('0123456789');
  await claimButton(page).click();
  await expect(page.getByRole('status')).toHaveText('컨설팅을 이용할 학생 계정으로 로그인했는지 확인한 뒤 다시 시도해주세요.');
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
  expect(await claimCalls(page)).toHaveLength(1);
  await expect(page).toHaveURL(new RegExp(`${startPath}$`));
});

test('코드 오류 뒤 신청과 다른 이메일의 학생 계정으로 초대를 정상 인증한다', async ({ page }, testInfo) => {
  await prepare(page);
  await expect(codeInput(page)).toBeVisible();
  await expect(page.getByRole('status')).toContainText('현재 로그인한 학생 계정에 컨설팅이 연결됩니다.');
  await expect(page.getByText('신청 이메일', { exact: true })).toBeVisible();
  await expect(page.getByText('s***@naver.com', { exact: true })).toBeVisible();
  await page.evaluate(() => { window.__inviteFixture.claimError = 'INVITE_INVALID'; });
  await codeInput(page).fill('0123456789');
  await claimButton(page).click();
  await expect(page.getByRole('status')).toContainText('받은 링크와 인증코드를 다시 확인해주세요.');
  await expect(page.getByRole('status')).not.toContainText('전화번호');
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
  const firstCall = (await claimCalls(page))[0];
  expect(firstCall.data.applicationId).toBe(applicationId);
  expect(firstCall.data).not.toHaveProperty('email');
  expect(firstCall.data).not.toHaveProperty('phone');
  await codeInput(page).fill('1234567890');
  await expect(page.getByRole('status')).toHaveText('신청 이메일로 받은 인증코드를 입력해주세요. 현재 로그인한 학생 계정에 컨설팅이 연결됩니다.');
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
  await prepare(page);
  await page.evaluate(() => { window.__inviteFixture.claimError = 'INVITE_INVALID'; });
  await codeInput(page).fill('0123456789');
  await claimButton(page).click();
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
  const count = (await statusCalls(page)).length;
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.getByRole('status')).toHaveText('신청 이메일로 받은 인증코드를 입력해주세요. 현재 로그인한 학생 계정에 컨설팅이 연결됩니다.');
  await expect(page.getByRole('status')).not.toHaveAttribute('data-tone', 'error');
  await expect(codeInput(page)).toHaveValue('');
  expect(await statusCalls(page)).toHaveLength(count + 1);
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
  else {
    await expect(page).toHaveURL(new RegExp(`${startPath}$`));
    await expect(codeInput(page)).toHaveValue('');
    expect(await page.evaluate(() => window.__inviteFixture.calls.filter(call => call.type === 'student_get_v2_consulting_home'))).toHaveLength(0);
  }
  await page.evaluate(() => window.__inviteFixture.releaseClaim());
  expect(await page.evaluate(key => sessionStorage.getItem(key) !== null, inviteKey)).toBe(true);
  await expect(codeInput(page)).toHaveCount(exit === 'logout' ? 0 : 1);
  expect(await claimCalls(page)).toHaveLength(1);
});

test('잘못됐거나 만료된 초대는 코드 입력을 차단한다', async ({ page }) => {
  await prepare(page, { inviteError: 'INVITE_INVALID' });
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
  await expect(page.getByRole('status')).not.toContainText('계정의 이메일');
  await expect(codeInput(page)).toHaveCount(0);
  await page.evaluate(() => {
    window.__inviteFixture.inviteError = 'INVITE_EXPIRED';
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.getByRole('status')).toContainText('초대 유효기간이 만료되었습니다.');
  await expect(codeInput(page)).toHaveCount(0);
  expect(await claimCalls(page)).toHaveLength(0);
});

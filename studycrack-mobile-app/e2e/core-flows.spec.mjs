import { expect, test } from '@playwright/test';
import fishDexManifest from '../src/assets/fishdex/v2/manifest.generated.json' with { type: 'json' };
import {
  expectNoHorizontalOverflow,
  installApiMock,
  installAuthenticatedSession
} from './support/mock-api.mjs';

async function readLockedScreenAlignment(page) {
  return page.locator('[data-screen="lockedFeature"]').evaluate((screen) => {
    const back = screen.querySelector('.appbar .back-btn')?.getBoundingClientRect();
    const title = screen.querySelector('.appbar .title')?.getBoundingClientRect();
    const preview = screen.querySelector('.locked-feature-preview-wrap')?.getBoundingClientRect();
    return back && title && preview ? {
      centerDelta: Math.abs((back.top + back.height / 2) - (title.top + title.height / 2)),
      leftDelta: Math.abs(back.left - preview.left)
    } : null;
  });
}

async function readViewportCenterDelta(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      centerDelta: Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2),
      bottom: rect.bottom,
      top: rect.top,
      viewportHeight: window.innerHeight
    };
  });
}

test('로그인 입력과 계정 복구 모달이 모바일 화면에서 동작한다', async ({ page }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authLogin');

  await expect(page.getByRole('heading', { name: 'StudyCrack' })).toBeVisible();
  await expect(page.getByText('합격 전략을 시작해볼까요?')).toBeVisible();
  await expect(page.getByAltText('StudyCrack 심볼')).toBeVisible();

  const email = page.locator('[data-field="loginEmail"]');
  await email.fill('student@example.com');
  await expect(email).toHaveValue('student@example.com');

  const findEmailButton = page.getByRole('button', { name: '이메일 찾기' });
  await findEmailButton.click();
  const findDialog = page.getByRole('dialog', { name: '이메일 찾기' });
  await expect(findDialog).toBeVisible();
  await expect(findDialog.getByRole('button', { name: '닫기' })).toBeFocused();
  const box = await findDialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs((box.y + box.height / 2) - viewport.height / 2)).toBeLessThan(viewport.height * 0.2);
  await findDialog.press('Escape');
  await expect(findDialog).toBeHidden();
  await expect(findEmailButton).toBeFocused();

  await page.getByRole('button', { name: '비밀번호 찾기' }).click();
  await expect(page.getByRole('dialog', { name: '비밀번호 재설정' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('로그인과 회원가입 첫 화면은 설치형 모바일 화면 중앙에 안정적으로 배치된다', async ({ page }, testInfo) => {
  await installApiMock(page);
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/studycrack-mobile.html?screen=authLogin');
    const loginLayout = await readViewportCenterDelta(page, '.auth-entry-layout');
    expect(loginLayout.centerDelta).toBeLessThanOrEqual(24);
    expect(loginLayout.top).toBeGreaterThanOrEqual(0);
    expect(loginLayout.bottom).toBeLessThanOrEqual(loginLayout.viewportHeight);

    await page.goto('/studycrack-mobile.html?screen=authSignup');
    const signupCard = await readViewportCenterDelta(page, '.signup-form-card');
    expect(signupCard.top).toBeGreaterThanOrEqual(16);
    expect(signupCard.top).toBeLessThanOrEqual(64);
    expect(signupCard.bottom).toBeLessThanOrEqual(signupCard.viewportHeight);
    if (viewport.width === 360) {
      await page.goto('/studycrack-mobile.html?screen=authLogin');
      await page.screenshot({ path: testInfo.outputPath('auth-login-360x800.png'), fullPage: true });
      await page.goto('/studycrack-mobile.html?screen=authSignup');
      await page.screenshot({ path: testInfo.outputPath('auth-signup-360x800.png'), fullPage: true });
    }
  }

  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/studycrack-mobile.html?screen=authLogin');
  const compactLayout = await page.locator('.auth-entry-layout').boundingBox();
  expect(compactLayout).not.toBeNull();
  expect(compactLayout.y).toBeGreaterThanOrEqual(0);
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('회원가입은 약관부터 시작하고 전문 확인 뒤 다음 인증 단계로 이동한다', async ({ page }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authSignup');

  await expect(page.locator('.signup-topbar, .signup-progress')).toHaveCount(0);
  await expect(page.locator('.signup-stage-head > span')).toHaveText('1단계');
  await page.getByRole('button', { name: '전문보기' }).first().click();
  const termsDialog = page.getByRole('dialog', { name: '스터디크랙 이용약관' });
  await expect(termsDialog).toBeVisible();
  await expect(termsDialog.locator('.terms-modal-body')).toContainText('제 1 장 총 칙');
  await termsDialog.getByRole('button', { name: '닫기' }).click();

  await page.locator('.auth-terms-check-row.all input').check();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByRole('heading', { name: '기본 정보와 휴대폰을 확인할게요' })).toBeVisible();
  await expect(page.locator('.signup-stage-head > span')).toHaveText('2단계');
  await expectNoHorizontalOverflow(page);
});

test('스플래시·인트로·온보딩 입력과 결과 화면이 React 경로로 이어진다', async ({ page }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=splash');
  await expect(page.locator('[data-screen="on1"]')).toBeVisible({ timeout: 2500 });
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('[data-screen="on2"]')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('[data-screen="on3"]')).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();

  await installAuthenticatedSession(page);
  await page.goto('/studycrack-mobile.html?screen=ob1');
  await page.getByRole('button', { name: '고3 재학' }).click();
  const school = page.locator('[data-field="obSchoolName"]');
  await school.fill('테스트고등학교');
  await page.locator('[data-field="obGoalText"]').fill('목표 대학에 맞는 공부 순서를 알고 싶어요.');
  await expect(school).toHaveValue('테스트고등학교');
  await page.getByRole('button', { name: '저장하고 성적 입력으로' }).click();
  await expect(page.locator('[data-screen="ob2"]')).toBeVisible();
  await expect(page.locator('[data-field="scoreExamType"]')).toHaveValue('3월 모의고사');

  await page.goto('/studycrack-mobile.html?screen=ob4');
  await expect(page.getByText('지원학과 환산점수 분석')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('로그인 세션의 환산점수는 사용자가 계산을 요청한 뒤 로드된다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  const startedAt = Date.now();
  await page.goto('/studycrack-mobile.html?screen=analysis');

  await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '점수 계산하기' })).toBeVisible();
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets')).toBe(false);
  await page.getByRole('button', { name: '점수 계산하기' }).click();
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('142점');
  expect(api.requests.some(({ payload }) => payload.type === 'get_user_analysis')).toBe(true);
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'jun')).toBe(true);
  await page.waitForTimeout(100);
  const initialRequestTypes = api.requests.map(({ payload }) => payload.type || 'unknown');
  for (const deferredType of ['get_univ_list_only', 'get_tutorial_recommendations', 'get_pro_reports', 'get_weekly_reports', 'get_qna_list', 'student_get_notifications']) {
    expect(initialRequestTypes).not.toContain(deferredType);
  }
  await testInfo.attach('analysis-initial-load-baseline.json', {
    body: Buffer.from(JSON.stringify({
      readyMs: Date.now() - startedAt,
      requestCount: api.requests.length,
      requestTypes: initialRequestTypes
    }, null, 2)),
    contentType: 'application/json'
  });
  await expectNoHorizontalOverflow(page);
});

test('React 하단 탭은 화면 전환과 잠금 화면에서도 활성 상태를 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic' });
  await page.goto('/studycrack-mobile.html?screen=timer');

  const tabbar = page.locator('.tabbar');
  await expect(tabbar.locator('[data-tab="timer"]')).toHaveAttribute('aria-current', 'page');
  await expect(tabbar.locator('[data-tab="timer"]')).toHaveAttribute('aria-label', '홈');
  await expect(tabbar.locator('[data-tab="timer"] .tabbar-label')).toHaveText('홈');
  await expect(tabbar.locator('button')).toHaveCount(5);
  const normalTabOffsets = await tabbar.locator('button:not(.is-aquarium)').evaluateAll((buttons) => buttons.map((button) => {
    const icon = button.querySelector('.tabbar-icon').getBoundingClientRect();
    const label = button.querySelector('.tabbar-label').getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const groupCenter = (Math.min(icon.top, label.top) + Math.max(icon.bottom, label.bottom)) / 2;
    return Math.abs(groupCenter - (rect.top + rect.height / 2));
  }));
  expect(Math.max(...normalTabOffsets)).toBeLessThanOrEqual(1);
  await tabbar.locator('[data-tab="analysis"]').click();
  await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
  await expect(page.locator('.tabbar [data-tab="analysis"]')).toHaveAttribute('aria-current', 'page');

  await page.locator('.tabbar [data-tab="strategy"]').click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
  await expect(page.locator('.coach-preview .coaching-process-step')).toHaveCount(3);
  await expect(page.locator('.tabbar [data-tab="strategy"]')).toHaveAttribute('aria-current', 'page');
});

test('대학 검색은 한글 입력 후 대학과 학과를 순서대로 선택한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=addUniversity');

  const search = page.locator('[data-field="analysisSearchTerm"]');
  await expect(search).toBeVisible();
  await search.fill('연세');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: /연세대학교/ }).click();
  await expect(page.getByRole('heading', { name: '연세대학교 학과' })).toBeVisible();

  const majorSearch = page.locator('[data-field="analysisSearchTerm"]');
  await majorSearch.fill('경제');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const resultRow = page.locator('.add-univ-row').filter({ hasText: '연세대학교 경제학과' });
  await expect(resultRow).toBeVisible();
  await expect(resultRow.getByRole('button', { name: '추가', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('공부 타이머 완료 뒤 보상과 랭킹 데이터가 이어진다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  await expect(page.getByText('테스트학생님의 합격 루틴')).toBeVisible();
  await expect(page.locator('.timer-v2-profile > img')).toBeVisible();
  await expect(page.locator('.timer-v2-profile > img')).toHaveCSS('object-fit', 'cover');
  await expect(page.getByText('공부 서식지')).toHaveCount(0);

  await page.getByRole('button', { name: '공부 시작' }).click();
  await page.locator('.study-plan-options button').filter({ hasText: '독서' }).click();
  await expect(page.locator('[data-field="studyStartActivity"]')).toHaveValue('독서');
  await page.locator('.study-start-confirm').evaluate((button) => {
    button.click();
    button.click();
  });
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'start_study_session').length).toBe(1);
  await expect.poll(() => api.requests.find(({ payload }) => payload.type === 'start_study_session')?.payload?.data?.activity).toBe('독서');
  await page.waitForTimeout(1100);
  await page.reload();
  await expect(page.getByText('국어 공부를 이어서 기록 중이에요')).toBeVisible();
  await expect(page.getByText('앱을 벗어나도 시작 시각 기준으로 이어 기록돼요.')).toBeVisible();
  await page.getByRole('button', { name: '공부 완료', exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });

  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'start_study_session').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'complete_study_session').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'claim_study_reward').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_study_ranking').length).toBeGreaterThan(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_study_summary').length).toBeGreaterThan(1);
  const journey = page.locator('.timer-journey-panel');
  await expect(journey).toBeVisible();
  await expect(journey).toContainText('국어 공부를 완료했어요');
  await expect(journey).toContainText('독서');
  await expect(journey).toContainText('00:00:02');
  await expect(journey.locator('[data-step="completion"]')).toHaveAttribute('data-state', 'complete');
  await expect(journey.locator('[data-step="reward"]')).toHaveAttribute('data-state', 'complete');
  await expect(page.locator('.timer-week-summary')).toBeVisible();
  await page.locator('.timer-week-day.is-today').click();
  await expect(page.locator('.timer-day-subjects')).toContainText('00:00:02');
  await expect(page.locator('.timer-day-subjects [data-subject-tone="korean"]')).toContainText('국어');
  await expect(page.locator('.timer-week-day.is-today .timer-week-stack [data-subject-tone="korean"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('종료 보상이 수조 잔액과 첫 물고기 FishDex 여정으로 이어진다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, {
    initialGameProfile: { shellBalance: 0, foodBalance: 0, starterFishUnlocked: false, starterState: 'locked' },
    studyDurationSeconds: 1500,
    studyReward: { shells: 2, food: 2 }
  });
  await page.goto('/studycrack-mobile.html?screen=timer');

  await page.getByRole('button', { name: '공부 시작' }).click();
  await page.locator('.study-plan-options button').filter({ hasText: '독서' }).click();
  await page.locator('.study-start-confirm').click();
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();

  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'claim_study_reward').length).toBe(1);
  const rewardPanel = page.locator('.timer-journey-panel');
  await expect(rewardPanel.locator('.timer-reward-values')).toContainText('조개 +2');
  await expect(rewardPanel.locator('.timer-reward-values')).toContainText('먹이 +2');
  await rewardPanel.getByRole('button', { name: '수조에서 확인' }).click();

  const wallet = page.getByRole('group', { name: '수조 재화' });
  await expect(wallet).toContainText(/조개\s*2/);
  await expect(wallet).toContainText(/먹이\s*2/);
  const journey = page.locator('section.aquarium-journey[aria-label="공부 보상 여정"]');
  await expect(journey.locator('[data-step="reward"]')).toHaveAttribute('data-state', 'complete');
  await expect(journey.locator('[data-step="aquarium"]')).toHaveAttribute('data-state', 'active');
  await expect(journey.locator('[data-step="fishdex"]')).toHaveAttribute('data-state', 'pending');

  await page.locator('[data-action="selectStarterCandidate"][data-species-id="blue_damsel"]').click();
  await page.getByRole('button', { name: '이 물고기와 시작하기' }).click();
  await expect(journey.locator('[data-step="aquarium"]')).toHaveAttribute('data-state', 'complete');
  await expect(journey.locator('[data-step="fishdex"]')).toHaveAttribute('data-state', 'complete');
  await page.getByRole('button', { name: /물고기 도감/ }).click();

  await expect(page.locator('.aquarium-collection-summary')).toContainText('1 / 12');
  const lockedFish = page.locator('.aquarium-catalog-group article[data-state="locked"]');
  await expect(lockedFish).toHaveCount(11);
  await expect(lockedFish.first()).toHaveAttribute('aria-label', '미획득 물고기');
  await expect(lockedFish.first()).not.toContainText('흰동가리');
  const statusFilters = page.getByRole('group', { name: 'FishDex 획득 상태' });
  const allFilter = statusFilters.getByRole('button', { name: '전체' });
  const ownedFilter = statusFilters.getByRole('button', { name: '획득', exact: true });
  await allFilter.focus();
  await allFilter.press('ArrowRight');
  await expect(ownedFilter).toBeFocused();
  await expect(ownedFilter).toHaveAttribute('aria-pressed', 'true');

  for (const target of [page.getByRole('button', { name: '수조로 돌아가기' }), ownedFilter]) {
    const box = await target.boundingBox();
    expect(Math.round(box?.height || 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box?.width || 0)).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('.aquarium-offline-state')).toBeVisible();
  await expect(page.locator('.aquarium-offline-state').getByRole('button', { name: '연결 후 다시 불러오기' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.aquarium-mode-shell')).toHaveCSS('animation-name', 'none');
  const reducedTransitionDuration = await page.locator('.aquarium-collection-summary > i span').evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).transitionDuration)
  ));
  expect(reducedTransitionDuration).toBeLessThanOrEqual(0.001);
  await expectNoHorizontalOverflow(page);
});

test('인증된 사용자는 스플래시 뒤 전용 타이머를 기본 화면으로 사용한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=splash');

  await expect(page.locator('[data-screen="timer"]')).toBeVisible({ timeout: 2500 });
  await expect(page.locator('.tabbar [data-tab="timer"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: '공부 시작' })).toBeVisible();
  await expect(page.getByRole('button', { name: /환산 분석/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('타이머 프로필 서랍은 공부·수조 요약과 기존 마이 기능을 연결한다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');

  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  const drawer = page.getByRole('dialog', { name: '프로필 메뉴' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('테스트학생님');
  await expect(drawer).toContainText('Basic');
  await expect(drawer).toContainText('보유 조개');
  await expect(drawer).toContainText('62개');
  await expect(drawer).toContainText('연속 학습');
  await expect.poll(async () => {
    const drawerBox = await drawer.boundingBox();
    const frameBox = await page.locator('.app-frame').boundingBox();
    if (!drawerBox || !frameBox) return Number.POSITIVE_INFINITY;
    return Math.abs(drawerBox.x + drawerBox.width - (frameBox.x + frameBox.width));
  }).toBeLessThan(2);
  for (const viewport of [{ width: 320, height: 700 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`profile-drawer-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`profile-drawer-${viewport.width}.png`, { path: screenshotPath, contentType: 'image/png' });
  }
  await drawer.getByRole('button', { name: '계정정보 관리' }).click();
  await expect(page.locator('[data-screen="accountInfo"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('플래너는 오늘 할 일 뒤에서 기존 주·월 일정을 탐색한다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=planner');

  await expect(page.getByRole('heading', { name: '오늘 할 일' })).toBeVisible();
  const plannerContent = page.locator('.app-content');
  await expect(plannerContent).not.toHaveClass(/modal-lock/);
  expect(await plannerContent.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  await page.getByRole('button', { name: '수험 일정' }).click();
  await expect(plannerContent).toHaveClass(/modal-lock/);
  expect(await plannerContent.evaluate((element) => getComputedStyle(element).overflowY)).toBe('hidden');
  await page.locator('.calendar-sheet-overlay').getByRole('button', { name: '닫기' }).click();
  await expect(plannerContent).not.toHaveClass(/modal-lock/);
  expect(await plannerContent.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  const progressBox = await page.locator('.planner-progress-card').boundingBox();
  const tasksBox = await page.locator('.planner-tasks-section').boundingBox();
  const calendarBox = await page.locator('.planner-calendar-section').boundingBox();
  expect(progressBox).not.toBeNull();
  expect(tasksBox).not.toBeNull();
  expect(calendarBox).not.toBeNull();
  expect(tasksBox.y).toBeGreaterThan(progressBox.y);
  expect(calendarBox.y).toBeGreaterThan(tasksBox.y);
  await page.getByRole('button', { name: '계획 완료' }).click();
  await expect(page.locator('.planner-progress-head')).toContainText('1/1 완료');
  await page.getByRole('button', { name: '월', exact: true }).click();
  await expect(page.locator('.planner-calendar-month-panel')).toBeVisible();
  for (const viewport of [{ width: 320, height: 700 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`planner-month-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`planner-month-${viewport.width}.png`, { path: screenshotPath, contentType: 'image/png' });
  }
});

test('타이머 미리보기에서 로컬 플래너 CRUD와 캘린더 재시도까지 이어진다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failOnceTypes: ['get_admission_calendar'] });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/studycrack-mobile.html?screen=timer');

  const preview = page.locator('.timer-v2-plan');
  await expect(preview).toContainText('독서');
  await preview.getByRole('button', { name: /전체 보기/ }).click();
  await expect(page.locator('[data-screen="planner"]')).toBeVisible();
  await expect(page.getByText('계획은 이 기기에 저장되고, 공부 기록은 완료 확인 뒤 반영돼요.')).toBeVisible();
  const calendarModes = page.getByRole('group', { name: '달력 보기 방식' });
  await expect(calendarModes.getByRole('button', { name: '주', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await calendarModes.getByRole('button', { name: '월', exact: true }).press('ArrowLeft');
  await expect(calendarModes.getByRole('button', { name: '주', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '계획 추가', exact: true }).click();
  await expect(page.locator('[data-screen="plannerAdd"]')).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  const content = page.locator('[data-field="plannerContent"]');
  await content.focus();
  await content.dispatchEvent('compositionstart');
  await content.evaluate((element) => {
    element.value = '한글 조합 중';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '중', inputType: 'insertCompositionText', isComposing: true }));
  });
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="plannerAdd"]')).toBeVisible();
  await expect(content).toBeFocused();
  await content.dispatchEvent('compositionend');
  await content.fill('비문학 지문 3개 분석');
  await page.getByRole('button', { name: '계획 저장하기' }).click();

  const addedRow = page.locator('.planner-item-v2').filter({ hasText: '비문학 지문 3개 분석' });
  await expect(addedRow).toBeVisible();
  await addedRow.locator('.planner-item-main').click();
  const editDialog = page.getByRole('dialog', { name: '선택 메뉴' });
  await expect(editDialog).toBeVisible();
  const editContent = editDialog.locator('[data-field="plannerEditContent"]');
  await editContent.focus();
  await editContent.dispatchEvent('compositionstart');
  await editContent.fill('한글 수정 중');
  await page.keyboard.press('Enter');
  await expect(editDialog).toBeVisible();
  await editContent.dispatchEvent('compositionend');
  await editContent.fill('비문학 오답 정리');
  await editDialog.getByRole('button', { name: '수정 저장' }).click();
  const editedRow = page.locator('.planner-item-v2').filter({ hasText: '비문학 오답 정리' });
  await expect(editedRow).toBeVisible();
  await editedRow.getByRole('button', { name: '계획 완료' }).click();
  await expect(editedRow).toHaveClass(/done/);
  await editedRow.getByRole('button', { name: '계획 삭제' }).click();
  await expect(editedRow).toHaveCount(0);

  await page.getByRole('button', { name: '수험 일정' }).click();
  const calendar = page.locator('.calendar-sheet-overlay');
  await expect(calendar.getByRole('alert')).toContainText('내 일정을 불러오지 못했습니다.');
  await calendar.getByRole('button', { name: '다시 불러오기' }).click();
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_admission_calendar').length).toBe(2);
  await expect(calendar.getByRole('alert')).toHaveCount(0);
  await expect(calendar.getByText('이 날짜에 등록된 일정이 없어요.')).toBeVisible();
  await calendar.getByRole('button', { name: '닫기' }).click();

  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('.sc-network-status')).toHaveText('오프라인 상태예요');
  await expect(page.locator('.planner-item-v2').filter({ hasText: '독서' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Phase 2 핵심 화면은 네 viewport에서 프레임과 가로 경계를 지킨다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);

  const viewports = [
    { width: 320, height: 700 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ];
  const surfaces = [
    { name: 'timer', screen: 'timer', ready: '.timer-v2-plan', tabbar: true },
    { name: 'planner', screen: 'planner', ready: '.planner-progress-card', tabbar: true },
    { name: 'planner-add', screen: 'plannerAdd', ready: '[data-screen="plannerAdd"]', tabbar: false },
    { name: 'aquarium', screen: 'aquarium', ready: '.aquarium-wallet', tabbar: true }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const surface of surfaces) {
      await page.goto(`/studycrack-mobile.html?screen=${surface.screen}`);
      await expect(page.locator(surface.ready)).toBeVisible();
      await expect(page.locator('.app-screen[data-screen]')).toHaveCSS('opacity', '1');
      await expect(page.locator('.tabbar button')).toHaveCount(surface.tabbar ? 5 : 0);
      await expectNoHorizontalOverflow(page);
      const frame = await page.locator('.app-frame').boundingBox();
      expect(frame).not.toBeNull();
      expect(frame.width).toBeLessThanOrEqual(viewport.width);
      expect(Math.abs(frame.height - viewport.height)).toBeLessThanOrEqual(1);
      const screenshotPath = testInfo.outputPath(`phase-two-${surface.name}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
      await testInfo.attach(`phase-two-${surface.name}-${viewport.width}x${viewport.height}.png`, { path: screenshotPath, contentType: 'image/png' });
    }

    await page.getByRole('button', { name: /물고기 도감/ }).click();
    await expect(page.locator('.aquarium-collection-summary')).toBeVisible();
    await expect(page.locator('.aquarium-mode-shell')).toHaveCSS('opacity', '1');
    await page.locator('.app-content').evaluate((element) => element.scrollTo({ top: 0 }));
    await expectNoHorizontalOverflow(page);
    const fishDexScreenshotPath = testInfo.outputPath(`phase-two-fishdex-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: fishDexScreenshotPath, fullPage: true, animations: 'disabled' });
    await testInfo.attach(`phase-two-fishdex-${viewport.width}x${viewport.height}.png`, { path: fishDexScreenshotPath, contentType: 'image/png' });
  }
});

test('수조에서 첫 물고기의 성장·이름·배치 상태를 관리하고 복원한다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=aquarium');

  await expect(page.locator('[data-screen="aquarium"]')).toBeVisible();
  await page.locator('[data-action="selectStarterCandidate"][data-species-id="blue_damsel"]').click();
  await page.getByRole('button', { name: '이 물고기와 시작하기' }).click();

  await expect(page.getByRole('heading', { name: '마루', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '먹이 주기' }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.getByText('EXP +10')).toBeVisible();
  await page.locator('[data-field="aquariumFishName"]').fill('마루별');
  await page.locator('[data-action="saveAquariumFishName"]').click();
  await expect(page.getByRole('heading', { name: '마루별', exact: true })).toBeVisible();
  await page.locator('[data-action="setAquariumFishSlot"][data-slot="left"]').click();
  await expect(page.locator('.aquarium-fish.slot-left')).toHaveAttribute('aria-label', '마루별 선택');
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'claim_starter_fish').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'feed_fish').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'rename_fish').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'set_active_fish').length).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: '마루별', exact: true })).toBeVisible();
  await expect(page.locator('.aquarium-fish.slot-left')).toHaveAttribute('aria-label', '마루별 선택');
  await expect(page.locator('.aquarium-fish.slot-left .aquarium-fish-path')).toHaveCSS('animation-name', 'aquariumFishPath');
  await expect(page.locator('.aquarium-fish.slot-left .aquarium-fish-bob')).toHaveCSS('animation-name', 'aquariumFishBob');
  for (const viewport of [{ width: 320, height: 700 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`aquarium-main-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`aquarium-main-${viewport.width}.png`, { path: screenshotPath, contentType: 'image/png' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.aquarium-fish.slot-left')).toHaveCSS('animation-name', 'none');
});

test('수조 보조 정보 실패는 본체를 가리지 않고 해당 정보만 재시도한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failGameTypes: ['get_fish_catalog'] });
  await page.goto('/studycrack-mobile.html?screen=aquarium');

  await expect(page.locator('.aquarium-scene-wrap')).toBeVisible();
  await expect(page.locator('.aquarium-resource-notice')).toContainText('일부 정보를 불러오지 못했어요');
  await expect(page.getByText('Internal Server Error')).toHaveCount(0);
  await page.locator('.aquarium-resource-notice [data-action="retryGameResources"]').click();
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_fish_catalog').length).toBeGreaterThanOrEqual(2);
});

test('물고기 뽑기는 미확인 결과를 복구하고 세 번 공개한 뒤 도감에 반영한다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await page.addInitScript(() => {
    window.__aquariumSharePayloads = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => window.__aquariumSharePayloads.push(payload)
    });
  });
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=aquarium');

  await page.locator('[data-action="selectStarterCandidate"][data-species-id="blue_damsel"]').click();
  await page.getByRole('button', { name: '이 물고기와 시작하기' }).click();
  await page.locator('[data-action="openAquariumDraw"]').click();
  await page.getByRole('button', { name: '조개 30개로 만나기' }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole('button', { name: '상자 열기 1단계' })).toBeVisible();
  await page.getByRole('button', { name: '상자 열기 1단계' }).click();

  await page.reload();
  await expect(page.getByRole('button', { name: '상자 열기 1단계' })).toBeVisible();
  await page.getByRole('button', { name: '상자 열기 1단계' }).click();
  await page.getByRole('button', { name: '상자 열기 2단계' }).click();
  await page.getByRole('button', { name: '상자 열기 3단계' }).click();
  await expect(page.getByRole('heading', { name: '나비고기' })).toBeVisible();
  await expect(page.locator('.aquarium-result-ring')).toBeVisible();
  await expect(page.locator('.aquarium-result-burst i')).toHaveCount(10);
  await expect(page.locator('.aquarium-result-halo .fish-species-butterflyfish')).toBeVisible();
  const drawScreenshotPath = testInfo.outputPath('aquarium-draw-result-390.png');
  await page.screenshot({ path: drawScreenshotPath, fullPage: true });
  await testInfo.attach('aquarium-draw-result-390.png', { path: drawScreenshotPath, contentType: 'image/png' });
  await page.getByRole('button', { name: '도감에서 확인하기' }).click();

  await expect(page.getByRole('heading', { name: '물고기 도감' })).toBeVisible();
  await expect(page.locator('.aquarium-collection-summary')).toContainText('2 / 12');
  await expect(page.locator('.aquarium-catalog-group.rarity-rare')).toContainText('나비고기');
  await expect(page.locator('.aquarium-mode-header')).toHaveCSS('display', 'grid');
  await expect(page.locator('.aquarium-catalog-group article').first()).toHaveCSS('display', 'grid');
  await page.getByRole('button', { name: '획득', exact: true }).click();
  await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(2);
  await page.getByRole('button', { name: '미획득', exact: true }).click();
  await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(10);
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(12);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'draw_fish').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_pending_draw').length).toBeGreaterThan(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'acknowledge_fish_draw').length).toBe(1);
  for (const viewport of [{ width: 320, height: 700 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`aquarium-catalog-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`aquarium-catalog-${viewport.width}.png`, { path: screenshotPath, contentType: 'image/png' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '수조로 돌아가기' }).click();
  await page.locator('[data-action="openAquariumShare"]').click();
  await expect(page.getByRole('heading', { name: '나의 공부 수조' })).toBeVisible();
  await expect(page.locator('.aquarium-share-card')).toContainText('개인정보와 입시 성적은 공유 카드에 포함되지 않습니다.');
  await page.getByRole('button', { name: '수조 공유하기' }).click();
  await expect(page.getByText('수조 공유를 완료했어요.')).toBeVisible();
  const sharePayload = await page.evaluate(() => window.__aquariumSharePayloads.at(-1));
  expect(sharePayload.title).toBe('StudyCrack 공부 수조');
  expect(sharePayload.text).toContain('물고기 2/12종');
  expect(sharePayload.text).not.toContain('예시학생');
  expect(sharePayload.url).toMatch(/\/studycrack-mobile\.html$/);
  const shareScreenshotPath = testInfo.outputPath('aquarium-share-390.png');
  await page.screenshot({ path: shareScreenshotPath, fullPage: true });
  await testInfo.attach('aquarium-share-390.png', { path: shareScreenshotPath, contentType: 'image/png' });
  await expectNoHorizontalOverflow(page);
});

test('85종 도감은 다섯 등급과 생태 분류를 탐색하고 화면 밖 이미지를 지연 로드한다', async ({ page }, testInfo) => {
  const rarities = [...Array(21).fill('common'), ...Array(30).fill('rare'), ...Array(16).fill('epic'), ...Array(8).fill('legendary'), ...Array(10).fill('special')];
  const categories = ['freshwater', 'marine_fish', 'marine_invertebrate', 'marine_wildlife', 'mascot'];
  const catalog = fishDexManifest.entries.map((entry, index) => ({
    speciesId: entry.slug.replaceAll('-', '_'),
    dexId: entry.dexId,
    assetKey: entry.assetKey,
    displayName: `FishDex ${entry.dexId}`,
    defaultName: entry.slug,
    rarity: rarities[index],
    category: categories[index % categories.length],
    starter: index < 3,
    colors: ['#3F6FD9', '#9DD9F2']
  }));
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { fishCatalog: catalog });
  const starter = { fishId: 'fish_fd05_owned', speciesId: catalog[0].speciesId, speciesName: catalog[0].displayName, rarity: 'common', name: '첫 친구', customName: '', level: 2, exp: 30, currentLevelExp: 0, nextLevelExp: 90, progressPct: 0, growthStage: 'young', source: 'starter' };
  api.state.fishInventory = [starter];
  api.state.activeFish = [null, starter, null];
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: [null, starter.fishId, null], drawPity: { rareIn: 10, epicIn: 30, legendaryIn: 100 } };

  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: /물고기 도감/ }).click();
  await expect(page.locator('.aquarium-catalog-group')).toHaveCount(5);
  await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(85);
  await expect(page.locator('.aquarium-collection-summary')).toContainText('1 / 85');
  await expect(page.locator('.aquarium-catalog-group.rarity-common > header')).toContainText('1 / 21');
  await expect(page.locator('.aquarium-catalog-group.rarity-special > header')).toContainText('0 / 10');
  await expect(page.locator('.aquarium-catalog-group img[loading="lazy"]')).toHaveCount(85);

  const initiallyLoaded = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('fishdex-')).length);
  expect(initiallyLoaded).toBeGreaterThan(0);
  expect(initiallyLoaded).toBeLessThan(85);

  await page.getByRole('button', { name: '민물', exact: true }).click();
  await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(17);
  await expect(page.locator('.aquarium-catalog-selection')).toContainText('민물');
  await expect(page.locator('.aquarium-catalog-selection')).toContainText('17종');
  await page.getByRole('button', { name: '획득', exact: true }).click();
  await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(1);
  await expect(page.locator('.aquarium-catalog-group.rarity-common > header')).toContainText('1 / 5');

  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: '모든 생태', exact: true }).click();
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
  }
  const screenshotPath = testInfo.outputPath('fishdex-85-catalog-390.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach('fishdex-85-catalog-390.png', { path: screenshotPath, contentType: 'image/png' });
});

test('분석 시험과 대학 선택은 분리된 결과 카드에 즉시 반영된다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier: 'basic' });
  await page.goto('/studycrack-mobile.html?screen=analysis');

  const examSelect = page.locator('[data-field="scoreExamType"]');
  const targetSelect = page.locator('[data-field="analysisTargetMajor"]');
  const analysisContent = page.locator('[data-screen="analysis"]');
  await expect(analysisContent).not.toHaveClass(/modal-lock/);
  expect(await analysisContent.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  await expect(examSelect).toBeVisible();
  await expect(page.locator('.analysis-target-card')).toBeVisible();
  await expect(page.locator('.analysis-score-card')).toBeVisible();
  await expect(page.locator('.analysis-score-detail-card')).toHaveCount(0);
  await expect(page.locator('.analysis-result-card')).toHaveCount(0);
  await page.getByRole('button', { name: '점수 계산하기' }).click();
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('142점');
  await expect(page.locator('.analysis-score-detail-card')).toBeVisible();
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await expect(page.locator('.analysis-sim-subject > b')).toHaveText(['국어', '수학', '탐구1', '탐구2']);
  await expect(page.getByText('Standard Exclusive')).toBeVisible();
  await expect(page.locator('[data-screen="analysis"]')).not.toContainText('합격확률');

  await targetSelect.selectOption({ label: '고려대학교 경영학과' });
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('131점');
  await examSelect.selectOption({ label: '6월 평가원' });
  await examSelect.selectOption({ label: '3월 모의고사' });
  await page.getByRole('button', { name: '점수 계산하기' }).click();
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('118점');
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'mar')).toBe(true);
  expect(api.requests.some(({ payload }) => payload.type === 'backtrace_required_raw')).toBe(false);
  for (const viewport of [{ width: 320, height: 700 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`analysis-basic-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`analysis-basic-${viewport.width}.png`, { path: screenshotPath, contentType: 'image/png' });
  }
});

test('Standard 분석은 실제 +1 환산 효율과 역산 조합을 함께 보여준다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier: 'standard' });
  await page.goto('/studycrack-mobile.html?screen=analysis');

  await page.getByRole('button', { name: '점수 계산하기' }).click();
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('142점');
  await expect(page.locator('.analysis-sim-effect')).toHaveText(['+3.2점', '+2.4점', '+1.1점', '+0.8점']);
  await expect(page.locator('.analysis-sim-row.best')).toContainText('국어');
  await expect(page.locator('.analysis-reverse-plan')).toContainText('국어 +3점 / 수학 +2점 / 탐구1 +1점');
  await expect(page.locator('.analysis-reverse-plan')).toContainText('151점 도달');
  expect(api.requests.some(({ payload }) => payload.type === 'backtrace_required_raw')).toBe(true);
  await expectNoHorizontalOverflow(page);
});

test('알림 상세·문의 작성·성적 입력 보조 화면이 React 전환 후 동작한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);

  await page.goto('/studycrack-mobile.html?screen=notificationList');
  await page.getByRole('button', { name: /학습 알림/ }).click();
  await expect(page.getByRole('dialog')).toContainText('오늘 계획한 국어 학습을 확인해주세요.');
  await page.getByRole('button', { name: '닫기' }).click();

  await page.goto('/studycrack-mobile.html?screen=customerSupport');
  await expect(page.getByText('분석 결과 문의')).toBeVisible();
  await page.getByRole('button', { name: /일반 문의/ }).click();
  const qnaDialog = page.getByRole('dialog');
  await qnaDialog.locator('[data-field="qnaDraftTitle"]').fill('성적 입력 문의');
  await qnaDialog.locator('[data-field="qnaDraftContent"]').fill('국어 공통 점수 기준이 궁금합니다.');
  await expect(qnaDialog.locator('[data-field="qnaDraftTitle"]')).toHaveValue('성적 입력 문의');
  await page.getByRole('button', { name: '취소' }).click();

  await page.goto('/studycrack-mobile.html?screen=scoreInfo');
  await page.getByRole('button', { name: '입력·수정' }).click();
  const scoreDialog = page.getByRole('dialog');
  await scoreDialog.locator('[data-field="v2e-korean-common"]').fill('60');
  await scoreDialog.locator('[data-field="v2e-korean-elective"]').fill('24');
  await scoreDialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(scoreDialog.locator('.score-step-panel-head b')).toHaveText('수학');
  await scoreDialog.locator('[data-field="v2e-math-common"]').fill('50');
  await scoreDialog.locator('[data-field="v2e-math-elective"]').fill('20');
  await scoreDialog.getByRole('button', { name: '다음', exact: true }).click();
  await scoreDialog.locator('[data-field="v2e-english"]').fill('2');
  await scoreDialog.getByRole('button', { name: '다음', exact: true }).click();
  await scoreDialog.locator('[data-field="v2e-history"]').fill('1');
  await scoreDialog.getByRole('button', { name: '다음', exact: true }).click();
  await scoreDialog.locator('[data-field="v2e-inq1-subject"]').selectOption({ label: '생활과 윤리' });
  await scoreDialog.locator('[data-field="v2e-inq1-score"]').fill('45');
  await scoreDialog.getByRole('button', { name: '다음', exact: true }).click();
  await scoreDialog.locator('[data-field="v2e-inq2-subject"]').selectOption({ label: '사회·문화' });
  await scoreDialog.locator('[data-field="v2e-inq2-score"]').fill('43');
  await scoreDialog.getByRole('button', { name: '전체 성적 저장' }).click();
  await expect(scoreDialog).toBeHidden();
  await expect(page.locator('.score-info-subject-card').filter({ hasText: '생활과 윤리' })).toContainText('45점');
  await expect(page.locator('.score-info-subject-card').filter({ hasText: '사회·문화' })).toContainText('43점');
  await expectNoHorizontalOverflow(page);
});

test('MY 계정·알림·지원 흐름은 실제 구독과 수신 계약을 유지한다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier: 'standard' });

  await page.goto('/studycrack-mobile.html?screen=my');
  await expect(page.locator('.my-profile-hero')).toContainText('Standard');
  await expect(page.locator('.my-profile-subscription')).toContainText('까지 이용');
  await expectNoHorizontalOverflow(page);

  await page.locator('.my-profile-hero').click();
  const profileDialog = page.getByRole('dialog');
  await expect(profileDialog).toContainText('계정 및 구독 정보');
  await expect(profileDialog).toContainText('Standard');
  await profileDialog.getByRole('button', { name: '닫기' }).click();

  await page.goto('/studycrack-mobile.html?screen=accountInfo');
  expect(await page.locator('[data-screen="accountInfo"]').evaluate((element) => getComputedStyle(element).animationName)).toBe('mobileScreenEnter');
  await expect(page.locator('.account-subscription-card')).toContainText('다음 결제 안내');
  await expect(page.locator('.mobile-social-row')).toHaveCount(2);
  await expect(page.locator('.account-danger-utility')).toBeVisible();
  await expect(page.locator('.account-withdraw-link')).toHaveText('탈퇴하기');
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('전화번호 등록');
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/studycrack-mobile.html?screen=notificationSettings');
  await expect(page.getByRole('switch')).toHaveCount(2);
  await expect(page.getByText('주간 점검 알림')).toHaveCount(0);
  await expect(page.getByText('결제/구독 알림')).toHaveCount(0);
  await page.getByRole('switch').first().click();
  await expect.poll(() => api.requests.some(({ payload }) => payload.type === 'update_member_info' && payload.data?.notificationPreferences?.planner === false)).toBe(true);

  await page.goto('/studycrack-mobile.html?screen=notificationList');
  await page.getByRole('button', { name: /학습 알림/ }).click();
  await expect(page.getByRole('dialog')).toContainText('오늘 계획한 국어 학습을 확인해주세요.');
  await expect.poll(() => api.requests.some(({ payload }) => payload.type === 'student_read_notification' && payload.data?.notiId === 'noti-e2e')).toBe(true);
  await page.getByRole('button', { name: '닫기' }).click();

  await page.goto('/studycrack-mobile.html?screen=customerSupport');
  await page.getByRole('button', { name: /데이터 오류 신고/ }).click();
  const qnaDialog = page.getByRole('dialog');
  await expect(qnaDialog.locator('[data-field="qnaDraftTitle"]')).toHaveValue('[데이터 오류 신고] ');
  await expect(qnaDialog.locator('[data-field="qnaDraftContent"]')).toContainText('오류가 발생한 화면:');
  await qnaDialog.locator('[data-field="qnaDraftContent"]').fill('분석 화면에서 환산점수가 다르게 보여요.');
  await expect(qnaDialog.locator('[data-field="qnaDraftContent"]')).toHaveValue('분석 화면에서 환산점수가 다르게 보여요.');
  await qnaDialog.getByRole('button', { name: '취소' }).click();

  const screenshotPath = testInfo.outputPath('g7-account-support-390.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('g7-account-support-390.png', { path: screenshotPath, contentType: 'image/png' });
  await expectNoHorizontalOverflow(page);
});

test('리포트·튜터 질문·주간 피드백 화면이 React 전환 후 입력 계약을 유지한다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });

  await page.goto('/studycrack-mobile.html?screen=strategy');
  await expect(page.locator('.coaching-week-status')).toContainText('이번 주 코칭');
  await expect(page.locator('.coaching-hero')).toContainText('새 점검을 시작해 보세요');
  await expect(page.locator('.coaching-process-step')).toHaveCount(3);
  await expect(page.locator('.coaching-process-step b')).toHaveText(['학습 성향 분석', '목표 대학 분석', '합격 설계']);
  await expect(page.locator('.coach-step-progress')).toHaveCount(0);
  for (const viewport of [{ width: 320, height: 700 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`coaching-process-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`coaching-process-${viewport.width}.png`, { path: screenshotPath, contentType: 'image/png' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '이번 주 코칭 신청하기' }).click();
  const coachingDialog = page.getByRole('dialog');
  await expect(coachingDialog.locator('.coach-step-progress')).toContainText('1 / 8');
  await expect(coachingDialog.locator('.coach-sheet-footer')).toBeVisible();
  await coachingDialog.getByRole('button', { name: '닫기' }).click();

  await page.goto('/studycrack-mobile.html?screen=report');
  await expect(page.getByRole('heading', { name: '맞춤 전략 리포트' })).toBeVisible();
  await page.getByRole('button', { name: '새 리포트 요청' }).click();
  const reportDialog = page.getByRole('dialog');
  await reportDialog.locator('[data-field="proRequestText"]').fill('수학 실전 문제 풀이 전략을 분석해주세요.');
  await expect(reportDialog.locator('[data-field="proRequestText"]')).toHaveValue('수학 실전 문제 풀이 전략을 분석해주세요.');
  await page.getByRole('button', { name: '취소' }).click();

  await page.goto('/studycrack-mobile.html?screen=tutor');
  await expect(page.getByText('분석 결과 문의')).toBeVisible();
  await page.getByRole('button', { name: '새 질문 작성' }).click();
  const qnaDialog = page.getByRole('dialog');
  await qnaDialog.locator('[data-field="qnaDraftTitle"]').fill('학습 순서 문의');
  await qnaDialog.locator('[data-field="qnaDraftContent"]').fill('수학과 국어 중 어떤 과목을 먼저 공부할까요?');
  await expect(qnaDialog.locator('[data-field="qnaDraftTitle"]')).toHaveValue('학습 순서 문의');
  await page.getByRole('button', { name: '취소' }).click();

  await page.goto('/studycrack-mobile.html?screen=weekly');
  await expect(page.getByText('주간 점검 기록이 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '학습 코칭으로 이동' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('잠긴 PRO 기능에서 플랜 선택과 웹 결제 조건이 이어진다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic' });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await page.getByRole('button', { name: '점수 계산하기' }).click();
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('142점');

  await page.goto('/studycrack-mobile.html?screen=my');
  await page.getByRole('button', { name: /학습 리포트/ }).click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '주간 피드백 기능은 STANDARD 플랜에서 열려요' })).toBeVisible();
  const weeklyAlignment = await readLockedScreenAlignment(page);
  expect(weeklyAlignment).not.toBeNull();
  expect(weeklyAlignment.centerDelta).toBeLessThanOrEqual(1);
  expect(weeklyAlignment.leftDelta).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '뒤로가기' }).click();

  await page.getByRole('button', { name: /PRO 리포트/ }).click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PRO 리포트 기능은 PRO 플랜에서 열려요' })).toBeVisible();
  const lockedAlignment = await readLockedScreenAlignment(page);
  expect(lockedAlignment).not.toBeNull();
  expect(lockedAlignment.centerDelta).toBeLessThanOrEqual(1);
  expect(lockedAlignment.leftDelta).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'PRO 플랜 보기' }).click();

  await expect(page.locator('[data-screen="proIntro"]')).toBeVisible();
  await expect(page.locator('.plan-console-detail')).toContainText('합격권 최소 원점수 역산');
  await page.locator('[data-action="selectPlan"][data-plan="Basic"]').click();
  await expect(page.locator('.plan-console-detail')).toContainText('전 과목 원점수 +1 환산 효율');
  await expect(page.locator('.plan-console-detail')).toContainText('25,000원 / 4주');
  await page.locator('[data-action="selectPlan"][data-plan="Pro"]').click();
  await expect(page.locator('.plan-console-detail')).toContainText('149,000원 / 4주');
  await page.locator('.plan-console-cta[data-target="payment"]').click();

  await expect(page.locator('[data-screen="payment"]')).toBeVisible();
  await page.locator('[data-action="selectDuration"][data-duration="8주"]').click();
  await expect(page.locator('.plan-console-term')).toContainText('8주');
  await expect(page.locator('.plan-console-term')).toContainText('웹 결제는 4주 단위');
  await expect(page.locator('[data-action="selectDuration"][data-duration="8주"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '웹 결제로 계속하기' }).click();
  await page.waitForURL(/\/payment\?/);
  const paymentUrl = new URL(page.url());
  expect(paymentUrl.searchParams.get('source')).toBe('mobile_app');
  expect(paymentUrl.searchParams.get('plan')).toBe('pro');
  expect(paymentUrl.searchParams.get('duration')).toBe('8주');
});

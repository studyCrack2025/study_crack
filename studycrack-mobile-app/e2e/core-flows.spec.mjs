import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  installApiMock,
  installAuthenticatedSession
} from './support/mock-api.mjs';

test('로그인 입력과 계정 복구 모달이 모바일 화면에서 동작한다', async ({ page }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authLogin');

  const email = page.locator('[data-field="loginEmail"]');
  await email.fill('student@example.com');
  await expect(email).toHaveValue('student@example.com');

  await page.getByRole('button', { name: '이메일 찾기' }).click();
  const findDialog = page.getByRole('dialog', { name: '이메일 찾기' });
  await expect(findDialog).toBeVisible();
  const box = await findDialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs((box.y + box.height / 2) - viewport.height / 2)).toBeLessThan(viewport.height * 0.2);
  await findDialog.getByRole('button', { name: '닫기' }).click();

  await page.getByRole('button', { name: '비밀번호 찾기' }).click();
  await expect(page.getByRole('dialog', { name: '비밀번호 재설정' })).toBeVisible();
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
  const school = page.locator('[data-field="obSchoolName"]');
  await school.fill('테스트고등학교');
  await page.locator('[data-field="obGoalText"]').fill('목표 대학에 맞는 공부 순서를 알고 싶어요.');
  await expect(school).toHaveValue('테스트고등학교');
  await page.getByRole('button', { name: '1-2 성적 입력으로' }).click();
  await expect(page.locator('[data-screen="ob2"]')).toBeVisible();
  await expect(page.locator('[data-field="obExamType"]')).toHaveValue('3월 모의고사');

  await page.goto('/studycrack-mobile.html?screen=ob4');
  await expect(page.getByText('지원학과 환산점수 분석')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('로그인 세션의 사용자와 최초 환산점수가 홈에서 함께 로드된다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  const startedAt = Date.now();
  await page.goto('/studycrack-mobile.html?screen=home');

  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.getByText('안녕하세요, 테스트학생님')).toBeVisible();
  await expect(page.locator('.home-result-score strong').first()).toHaveText('142점');
  expect(api.requests.some(({ payload }) => payload.type === 'get_user_analysis')).toBe(true);
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'jun')).toBe(true);
  await page.waitForTimeout(100);
  const initialRequestTypes = api.requests.map(({ payload }) => payload.type || 'unknown');
  for (const deferredType of ['get_univ_list_only', 'get_tutorial_recommendations', 'get_pro_reports', 'get_weekly_reports', 'get_qna_list', 'student_get_notifications']) {
    expect(initialRequestTypes).not.toContain(deferredType);
  }
  await testInfo.attach('home-initial-load-baseline.json', {
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
  await expect(tabbar.locator('button')).toHaveCount(5);
  await tabbar.locator('[data-tab="analysis"]').click();
  await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
  await expect(page.locator('.tabbar [data-tab="analysis"]')).toHaveAttribute('aria-current', 'page');

  await page.locator('.tabbar [data-tab="strategy"]').click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
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
  await expect(page.getByText('테스트학생님의 공부를 기록해요.')).toBeVisible();

  await page.getByRole('button', { name: '공부 시작' }).click();
  await page.getByRole('button', { name: '국어 - 독서', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();

  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'start_study_session').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'complete_study_session').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'claim_study_reward').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_study_ranking').length).toBeGreaterThan(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_study_summary').length).toBeGreaterThan(1);
  await expect(page.locator('.timer-week-summary')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('인증된 사용자는 스플래시 뒤 전용 타이머를 기본 화면으로 사용한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=splash');

  await expect(page.locator('[data-screen="timer"]')).toBeVisible({ timeout: 2500 });
  await expect(page.locator('.tabbar [data-tab="timer"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: '공부 시작' })).toBeVisible();
  await expect(page.getByRole('button', { name: '학습 대시보드' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('수조에서 첫 물고기의 성장·이름·배치 상태를 관리하고 복원한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=aquarium');

  await expect(page.locator('[data-screen="aquarium"]')).toBeVisible();
  await page.locator('[data-action="selectStarterCandidate"][data-species-id="blue_damsel"]').click();
  await page.getByRole('button', { name: '이 물고기와 시작하기' }).click();

  await expect(page.getByRole('heading', { name: '마루', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '먹이 주기' }).click();
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
  await expectNoHorizontalOverflow(page);
});

test('분석 시험과 대학 선택은 같은 결과 카드에 즉시 반영된다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=analysis');

  const examSelect = page.locator('[data-field="scoreExamType"]');
  const targetSelect = page.locator('[data-field="analysisTargetMajor"]');
  await expect(examSelect).toBeVisible();
  await expect(page.locator('.analysis-result-overview strong')).toHaveText('142점');

  await targetSelect.selectOption({ label: '고려대학교 경영학과' });
  await expect(page.locator('.analysis-result-overview strong')).toHaveText('131점');
  await examSelect.selectOption({ label: '6월 평가원' });
  await examSelect.selectOption({ label: '3월 모의고사' });
  await expect(page.locator('.analysis-result-overview strong')).toHaveText('118점');
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'mar')).toBe(true);
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
  await page.getByRole('button', { name: '문의 작성' }).click();
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
  await scoreDialog.getByRole('button', { name: '저장하고 다음' }).click();
  await expect(scoreDialog.locator('.score-step-panel-head b')).toHaveText('수학');
  await expectNoHorizontalOverflow(page);
});

test('리포트·튜터 질문·주간 피드백 화면이 React 전환 후 입력 계약을 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });

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
  await page.goto('/studycrack-mobile.html?screen=home');
  await expect(page.getByText('안녕하세요, 테스트학생님')).toBeVisible();

  await page.locator('[data-action="goto"][data-target="report"]').click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PRO 리포트 기능은 PRO 플랜에서 열려요' })).toBeVisible();
  await page.getByRole('button', { name: 'PRO 플랜 보기' }).click();

  await expect(page.locator('[data-screen="proIntro"]')).toBeVisible();
  await page.locator('[data-action="selectPlan"][data-plan="Pro"]').click();
  await expect(page.locator('.plan-console-detail')).toContainText('149,000원 / 4주');
  await page.locator('.plan-console-cta[data-target="payment"]').click();

  await expect(page.locator('[data-screen="payment"]')).toBeVisible();
  await page.locator('[data-action="selectDuration"][data-duration="8주"]').click();
  await page.getByRole('button', { name: '웹 결제로 계속하기' }).click();
  await page.waitForURL(/\/payment\?/);
  const paymentUrl = new URL(page.url());
  expect(paymentUrl.searchParams.get('source')).toBe('mobile_app');
  expect(paymentUrl.searchParams.get('plan')).toBe('pro');
  expect(paymentUrl.searchParams.get('duration')).toBe('8주');
});

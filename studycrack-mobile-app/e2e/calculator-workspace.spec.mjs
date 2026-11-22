import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { calculatorAccessFixture, calculatorRawPreviewFixture, calculatorScoreFixture } from './support/calculator-fixture.mjs';
const path = '/2027-jungsi-consulting/calculator', appId = 'APP_11111111-1111-4111-8111-111111111111', at = '2026-11-21T00:00:00.000Z';
const raw = { admissionYear: 2027, basis: 'raw', exam: { kor: { opt: '언어와매체', common: 60, elective: 20, raw: 80 }, math: { opt: '미적분', common: 60, elective: 14, raw: 74 }, inq1: { name: '사회·문화', raw: 44 }, inq2: { name: '생활과 윤리', raw: 45 }, eng: { grd: 2 }, hist: { grd: 1 } } };
const catalogDigest = 'sha256:' + 'e'.repeat(64);
const groupedTargets = ['ga', 'na', 'da'].flatMap((group, index) => [1, 2].map(n => ({ university: '예시대학교', major: '예시학과', admissionUnitId: `UNIT_TEST_${group.toUpperCase()}_${n}`, selection: {
  key: 'PICK_' + (index * 2 + n).toString(16).padStart(32, '0'), recordId: 'U_' + (index * 2 + n).toString(16).padStart(16, '0'), trackId: `TRACK_TEST_${n}`, admissionGroup: group,
  universityName: '예시대학교', campusName: '서울캠퍼스', unitName: '예시학과', trackName: `일반전형${n}`, catalogDigest
} })));
const empty = () => ({ contractVersion: 'calculator-workspace-v2', applicationId: appId, workspaceId: 'WS_' + 'a'.repeat(32), revision: 0, legacyRevision: 0, updatedAt: null, status: 'empty', profile: null, plans: [], lastSavedPlanId: null,
  canSave: true, canDelete: false, consentAccepted: false, consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1', source: 'self_reported', reviewed: false });
async function setup(page, options = {}) {
  const state = { record: empty(), calls: [], catalogCalls: [], receipts: new Map(), committedPlans: 0, lostReply: false, deferRead: false, readRelease: null, failRead: false, ...options };
  const context = page.context();
  const token = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: 'workspace-student', exp: 4070908800 })).toString('base64url') + '.synthetic';
  await context.addInitScript(({ withoutOwner, token }) => { if (withoutOwner) sessionStorage.setItem('accessToken', token); else if (!localStorage.getItem('userId')) localStorage.setItem('userId', 'workspace-student'); localStorage.setItem('userRole', 'student'); }, { withoutOwner: options.withoutOwner === true, token });
  await context.route('https://www.googletagmanager.com/**', route => route.abort());
  await context.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL=false;window.CONFIG={api:{analysis:'/__workspace-analysis',consulting:'/__workspace-core',auth:'/__workspace-auth'}};` }));
  await context.route('**/__workspace-auth', route => route.fulfill({ json: { success: true } }));
  await context.route('**/__workspace-analysis', async route => {
    const body = route.request().postDataJSON();
    if (body.type === 'get_calculator_access') { const value = calculatorAccessFixture({ applicationId: appId }); value.service.workspaceVersion = 2; if (options.grouped) value.service.selectionVersion = 1; return route.fulfill({ json: value }); }
    if (body.type === 'get_calculator_score_conversion') return route.fulfill({ json: calculatorScoreFixture(body.data.records) });
    if (body.type === 'get_univ_list_only') return route.fulfill({ json: [{ univName: '예시대학교', majors: ['예시학과'] }] });
    if (body.type === 'get_calculator_catalog') {
      state.catalogCalls.push(body.data);
      expect(options.grouped).toBe(true); const { admissionGroup, query, cursor, view, universityKey } = body.data;
      const schoolKey = 'UNIV_' + '1'.repeat(32);
      if (view === 'universities') return route.fulfill({ json: { success: true, contractVersion: 'calculator-universities-v1', admissionYear: 2027, catalogDigest, admissionGroup, query, total: 1, items: [{ universityKey: schoolKey, name: '예시대학교', campuses: ['서울캠퍼스'], unitCount: 2 }], nextCursor: null } });
      expect(view).toBe('units'); expect(universityKey).toBe(schoolKey);
      const rows = groupedTargets.filter(row => row.selection.admissionGroup === admissionGroup && (!query || row.university.includes(query)));
      return route.fulfill({ json: { success: true, contractVersion: 'calculator-catalog-v1', admissionYear: 2027, catalogDigest, admissionGroup, query, universityKey, total: rows.length, items: rows.slice(cursor), nextCursor: null } });
    }
    expect(body.type).toBe('get_calculator_conversion'); const converted = calculatorRawPreviewFixture(body.data.scores, body.data.targets);
    converted.results.forEach((row, index) => {
      const target = body.data.targets[index];
      if (!target.selection) return;
      row.selectionKey = target.selection.key;
      Object.assign(row.referenceComparison, { recordId: target.selection.recordId, candidateAdmissionIdentity: { admissionUnitId: target.admissionUnitId }, riskBand: 'stable' });
      if (options.referenceMissingGroups?.includes(target.selection.admissionGroup)) Object.assign(row.referenceComparison, { status: 'held', recordId: null, convertedScore: null, passReference: null, registered70Reference: null, referenceIndex: null, riskBand: null, reasonCodes: ['REFERENCE_DATA_UNAVAILABLE'] });
    });
    if (state.deferConversion) await new Promise(resolve => { state.conversionRelease = resolve; });
    return route.fulfill({ json: converted });
  });
  await context.route('**/__workspace-core', async route => {
    const body = route.request().postDataJSON(); state.calls.push(body); const data = body.data;
    expect(data.applicationId).toBe(appId); expect(data.userId).toBeUndefined();
    if (body.type === 'student_get_calculator_workspace') {
      const snapshot = structuredClone(state.record);
      if (state.deferRead) await new Promise(resolve => { state.readRelease = resolve; });
      if (state.failRead) return route.fulfill({ status: 503, json: { success: false } });
      try { return await route.fulfill({ json: { success: true, data: snapshot } }); } catch (_) { return; }
    }
    const prior = state.receipts.get(data.requestId);
    if (prior) return route.fulfill({ json: { success: true, data: { ...prior, idempotent: true } } });
    if (data.expectedWorkspaceRevision !== state.record.revision) return route.fulfill({ status: 409, json: { success: false, code: 'REVISION_CONFLICT' } });
    expect(data.requestId).toMatch(/^workspace_[0-9a-f-]{36}$/i);
    if (body.type === 'student_save_calculator_profile') {
      if (!state.record.consentAccepted) expect(data.consented).toBe(true);
      state.record.profile = { revision: (state.record.profile?.revision || 0) + 1, scores: data.scores, updatedAt: at };
    } else if (body.type === 'student_save_calculator_plan') {
      const old = state.record.plans.find(plan => plan.planId === data.planId);
      const plan = { planId: old?.planId || 'PLAN_TEST_' + (state.record.plans.length + 1), revision: (old?.revision || 0) + 1, name: data.name, targets: data.targets, ...(data.representatives ? { representatives: data.representatives } : {}), updatedAt: at };
      state.record.plans = old ? state.record.plans.map(row => row.planId === old.planId ? plan : row) : [...state.record.plans, plan]; state.record.lastSavedPlanId = plan.planId; state.committedPlans++;
    } else if (body.type === 'student_delete_calculator_plan') {
      state.record.plans = state.record.plans.filter(plan => plan.planId !== data.planId); state.record.lastSavedPlanId = state.record.plans.at(-1)?.planId || null;
    } else throw Error('Unexpected workspace type ' + body.type);
    Object.assign(state.record, { status: 'saved', revision: state.record.revision + 1, consentAccepted: true, canDelete: true, updatedAt: at });
    state.receipts.set(data.requestId, structuredClone(state.record));
    if (state.lostReply) { state.lostReply = false; return route.fulfill({ status: 503, json: { success: false } }); }
    return route.fulfill({ json: { success: true, data: state.record } });
  });
  await page.goto(path); return state;
}
async function saveScores(page) {
  for (const [title, option] of [['국어', '언어와매체'], ['수학', '미적분'], ['탐구 1', '사회·문화'], ['탐구 2', '생활과 윤리']]) {
    await page.getByRole('combobox', { name: `${title} 선택과목`, exact: true }).selectOption(option);
    if (title.startsWith('탐구')) await page.getByRole('textbox', { name: `${title} 원점수`, exact: true }).fill(title === '탐구 1' ? '44' : '45');
    else { await page.getByRole('textbox', { name: `${title} 공통 원점수`, exact: true }).fill('60'); await page.getByRole('textbox', { name: `${title} 선택 원점수`, exact: true }).fill(title === '국어' ? '20' : '14'); }
  }
  await page.getByRole('combobox', { name: '영어 등급', exact: true }).selectOption('2'); await page.getByRole('combobox', { name: '한국사 등급', exact: true }).selectOption('1');
  await page.getByRole('checkbox', { name: '성적·지원 후보 저장과 운영팀 열람에 동의합니다', exact: true }).check();
  await page.getByRole('button', { name: '이 성적으로 시작하기', exact: true }).click();
  await expect(page.getByRole('region', { name: '저장한 내 성적', exact: true })).toBeVisible();
}
async function addTarget(page) {
  await page.getByRole('searchbox', { name: '대학명 검색', exact: true }).fill('예시대학교'); await page.getByRole('button', { name: /예시대학교/ }).click();
  await page.getByRole('button', { name: '예시학과 후보에 추가', exact: true }).click();
}

test('성적 저장 후 요약으로 이동하고 새 탭·재접속은 서버 자료를 자동으로 연다', async ({ page }, testInfo) => {
  const state = await setup(page, { withoutOwner: true });
  await expect(page.getByRole('heading', { name: '2027학년도 수능 가채점 성적', exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ owner: localStorage.getItem('userId'), persistentToken: localStorage.getItem('accessToken') }))).toEqual({ owner: null, persistentToken: null });
  await expect(page.getByRole('searchbox')).toHaveCount(0); await expect(page.getByText('다른 기기에서도 이어보기', { exact: true })).toHaveCount(0);
  await saveScores(page); expect(state.record.profile.scores).toEqual(raw);
  const summary = page.getByRole('region', { name: '저장한 내 성적', exact: true });
  await expect(summary.locator('table')).toBeHidden(); await summary.getByText('성적 상세', { exact: true }).click();
  await expect(summary.locator('table')).toContainText('언어와매체'); await expect(summary.locator('table')).toContainText('80');
  await summary.getByText('성적 상세', { exact: true }).click(); await expect(summary.locator('table')).toBeHidden();
  expect((await summary.boundingBox()).height).toBeLessThan(320);
  await expect(page.getByRole('textbox', { name: '국어 공통 원점수', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
  const other = await page.context().newPage(); await other.goto(path); await expect(other.getByRole('region', { name: '저장한 내 성적', exact: true })).toContainText('원점수 80'); await other.close();
  await page.reload(); await expect(page.getByRole('region', { name: '저장한 내 성적', exact: true })).toBeVisible();
  expect(state.calls.filter(row => row.type === 'student_save_calculator_profile')).toHaveLength(1);
  for (const width of [320, 375, 390, 430, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)).toBeLessThanOrEqual(1); }
  await page.screenshot({ path: testInfo.outputPath('workspace-saved-summary.png'), fullPage: true });
});

test('성적 수정 취소는 저장값을 보존하고 저장은 후보·조합을 유지하며 결과를 갱신한다', async ({ page }) => {
  const state = await setup(page); await saveScores(page); await addTarget(page); await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '지원 조합을 저장했습니다.' })).toBeVisible(); const planId = state.record.lastSavedPlanId;
  await page.getByRole('button', { name: '성적 수정', exact: true }).click(); await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('59');
  await page.getByRole('button', { name: '성적 수정 취소', exact: true }).click(); expect(state.record.profile.scores.exam.kor.common).toBe(60);
  await page.getByRole('button', { name: '성적 수정', exact: true }).click(); await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('59');
  await page.getByRole('button', { name: '성적 수정 저장', exact: true }).click();
  await expect(page.getByRole('region', { name: '저장한 내 성적', exact: true })).toContainText('원점수 79');
  expect(state.record.lastSavedPlanId).toBe(planId); expect(state.record.plans[0].targets).toHaveLength(1);
  await expect(page.getByRole('region', { name: '자료 기준별 참고 비교', exact: true })).toContainText('709.25');
});

test('이름별 조합을 복제·선택·삭제해도 다른 조합과 성적은 유지한다', async ({ page }) => {
  const state = await setup(page); await saveScores(page); await addTarget(page); await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible();
  await page.getByText('조합 관리', { exact: true }).click(); await page.getByRole('textbox', { name: '조합 이름', exact: true }).fill('두 번째 조합'); await page.getByRole('button', { name: '다른 조합으로 저장', exact: true }).click();
  await expect(page.getByText('새 조합으로 저장했습니다.', { exact: true })).toBeVisible(); expect(state.record.plans).toHaveLength(2);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '조합 삭제', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '조합 이름', exact: true })).toHaveValue('기본 조합'); expect(state.record.plans).toHaveLength(1); expect(state.record.profile.revision).toBe(1);
  await page.reload(); await expect(page.getByRole('combobox', { name: '저장한 조합', exact: true })).toHaveValue(state.record.plans[0].planId);
});

test('저장 응답이 끊겨도 같은 요청으로 재시도해 조합을 중복 생성하지 않는다', async ({ page }) => {
  const state = await setup(page); await saveScores(page); await addTarget(page); state.lostReply = true;
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible();
  const writes = state.calls.filter(row => row.type === 'student_save_calculator_plan'); expect(writes).toHaveLength(2); expect(writes[0].data.requestId).toBe(writes[1].data.requestId);
  expect(state.committedPlans).toBe(1); expect(state.record.plans).toHaveLength(1);
});

test('조회 중에는 빈 폼을 열지 않고 실패 후 재시도로 저장 자료를 읽는다', async ({ page }) => {
  const state = await setup(page, { deferRead: true }); await expect.poll(() => typeof state.readRelease).toBe('function');
  await expect(page.getByText('저장한 성적과 조합을 불러오고 있습니다…', { exact: true })).toBeVisible(); await expect(page.locator('form')).toHaveCount(0);
  state.deferRead = false; state.failRead = true; state.readRelease(); await expect(page.getByRole('button', { name: '저장 자료 다시 불러오기', exact: true })).toBeVisible();
  state.failRead = false; await page.getByRole('button', { name: '저장 자료 다시 불러오기', exact: true }).click(); await expect(page.getByRole('button', { name: '이 성적으로 시작하기', exact: true })).toBeDisabled();
  expect(state.calls.filter(row => row.type.startsWith('student_save_'))).toHaveLength(0);
});

async function addGroupTarget(page, label, track = 1) {
  await page.getByRole('navigation', { name: '모집군 선택', exact: true }).getByRole('button', { name: new RegExp(label) }).click();
  await page.getByRole('button', { name: `${label} 후보 찾기`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `${label} 후보 찾기`, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /예시대학교/ }).click();
  await dialog.getByRole('button', { name: `예시대학교 예시학과 일반전형${track} 후보에 추가`, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('군별로 같은 이름의 모집단위를 구별하고 대표 선택·저장·복원·삭제한다', async ({ page }, testInfo) => {
  const state = await setup(page, { grouped: true }); await saveScores(page);
  for (const label of ['가군', '나군', '다군']) await addGroupTarget(page, label);
  await addGroupTarget(page, '가군', 2);
  const ga = page.getByRole('region', { name: '가군 지원 후보', exact: true });
  await ga.getByRole('button', { name: '가군 예시대학교 예시학과 대표 선택', exact: true }).nth(1).click();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible();
  expect(state.record.plans[0].targets).toHaveLength(4); expect(state.record.plans[0].representatives).toEqual({ ga: groupedTargets[1].selection.key, na: groupedTargets[2].selection.key, da: groupedTargets[4].selection.key });
  await page.reload(); await expect(page.getByRole('region', { name: '군별 지원 조합', exact: true })).toBeVisible();
  await expect(ga.getByRole('button', { name: '가군 예시대학교 예시학과 대표 선택', exact: true }).nth(1)).toHaveAttribute('aria-pressed', 'true');
  for (const width of [320, 375, 430, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)).toBeLessThanOrEqual(1); }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('navigation', { name: '모집군 선택', exact: true }).getByRole('button', { name: /나군/ }).click();
  await expect(ga).toBeHidden(); await expect(page.getByRole('region', { name: '나군 지원 후보', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('grouped-mobile.png'), fullPage: true });
  await page.getByRole('navigation', { name: '모집군 선택', exact: true }).getByRole('button', { name: /가군/ }).click();
  await ga.getByRole('button', { name: '가군 예시대학교 예시학과 후보 삭제', exact: true }).nth(1).click();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible(); expect(state.record.plans[0].representatives.ga).toBeNull(); expect(state.record.plans[0].targets).toHaveLength(3);
});

test('기존 후보는 군 미분류로 보존하고 정확한 선택으로 교체한다', async ({ page }) => {
  const value = empty(); Object.assign(value, { revision: 1, updatedAt: at, status: 'saved', profile: { revision: 1, scores: raw, updatedAt: at }, consentAccepted: true, canDelete: true,
    plans: [{ planId: 'PLAN_LEGACY_1', revision: 1, name: '기존 조합', targets: [{ university: '예시대학교', major: '예시학과' }], updatedAt: at }], lastSavedPlanId: 'PLAN_LEGACY_1' });
  const state = await setup(page, { grouped: true, record: value });
  await expect(page.getByRole('region', { name: '미분류 기존 후보', exact: true })).toBeVisible();
  for (const label of ['가군', '나군', '다군']) await expect(page.getByRole('region', { name: `${label} 지원 후보`, exact: true }).getByRole('listitem')).toHaveCount(0);
  await addGroupTarget(page, '가군'); await expect(page.getByRole('region', { name: '미분류 기존 후보', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible();
  expect(state.record.plans[0].targets).toEqual([groupedTargets[0]]);
});

test('저장한 대표 지원안을 포트폴리오로 보고 돌아와도 성적·조합을 변경하지 않는다', async ({ page }, testInfo) => {
  const state = await setup(page, { grouped: true }); await saveScores(page);
  const open = page.getByRole('button', { name: '포트폴리오 보기', exact: true }); await expect(open).toBeDisabled();
  await addGroupTarget(page, '가군'); await expect(open).toBeDisabled();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(open).toBeEnabled();
  const saved = structuredClone(state.record), writes = state.calls.filter(row => row.type.startsWith('student_save_')).length;
  await open.click(); const portfolio = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true }); await expect(portfolio).toBeVisible();
  await expect(portfolio.getByRole('heading', { name: '나의 정시 포트폴리오', exact: true })).toBeFocused();
  const ga = portfolio.getByRole('article', { name: '가군 대표 지원안', exact: true });
  await expect(ga).toContainText('710.25점'); await expect(ga).not.toContainText('80 / 100'); await expect(ga.getByLabel('지원 단계: 안정', { exact: true })).toBeVisible();
  await expect(ga.locator('.jcalc-forecast-badge')).toHaveAttribute('data-risk', 'stable');
  await expect(portfolio.getByRole('article', { name: '나군 대표 지원안', exact: true })).toContainText('미선택');
  await expect(portfolio.getByRole('article', { name: '다군 대표 지원안', exact: true })).toContainText('미선택');
  await expect(portfolio).toContainText('연도 미확인'); await expect(portfolio).toContainText('실제 합격 확률이 아닙니다');
  for (const width of [320, 375, 430, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)).toBeLessThanOrEqual(1); }
  await page.screenshot({ path: testInfo.outputPath('portfolio-partial.png'), fullPage: true });
  await portfolio.getByRole('button', { name: '지원 조합으로 돌아가기', exact: true }).click(); await expect(portfolio).toHaveCount(0); await expect(open).toBeEnabled();
  expect(state.record).toEqual(saved); expect(state.calls.filter(row => row.type.startsWith('student_save_'))).toHaveLength(writes);
});

test('비교 보류인 군도 보존하며 성적 수정 후 이전 계산으로 포트폴리오를 열지 않는다', async ({ page }) => {
  const state = await setup(page, { grouped: true, referenceMissingGroups: ['na'] }); await saveScores(page);
  await addGroupTarget(page, '가군'); await addGroupTarget(page, '나군'); await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  const open = page.getByRole('button', { name: '포트폴리오 보기', exact: true }); await expect(open).toBeEnabled(); await open.click();
  const portfolio = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true }), na = portfolio.getByRole('article', { name: '나군 대표 지원안', exact: true });
  await expect(na).toContainText('판단 대기'); await expect(na.locator('[aria-current="true"]')).toHaveCount(0); await expect(na).not.toContainText('710.25');
  await portfolio.getByRole('button', { name: '지원 조합으로 돌아가기', exact: true }).click();
  await page.getByRole('button', { name: '성적 수정', exact: true }).click(); await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('59');
  state.deferConversion = true; await page.getByRole('button', { name: '성적 수정 저장', exact: true }).click();
  await expect(page.getByRole('region', { name: '저장한 내 성적', exact: true })).toContainText('원점수 79'); await expect(open).toBeDisabled();
  await expect.poll(() => typeof state.conversionRelease).toBe('function'); state.deferConversion = false; state.conversionRelease();
  await expect(open).toBeEnabled(); await open.click(); await expect(portfolio.getByRole('article', { name: '가군 대표 지원안', exact: true })).toContainText('709.25점');
  expect(state.record.plans[0].targets).toHaveLength(2); expect(state.record.profile.revision).toBe(2);
});

async function openExportPortfolio(page) {
  const state = await setup(page, { grouped: true }); await saveScores(page); await addGroupTarget(page, '가군');
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await page.getByRole('button', { name: '포트폴리오 보기', exact: true }).click();
  const region = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true }); await expect(region).toBeVisible(); return { state, region };
}
async function receivePng(download, testInfo, filename) {
  expect(download.suggestedFilename()).toBe('StudyCrack_2027_정시_포트폴리오.png');
  const path = testInfo.outputPath(filename); await download.saveAs(path); const bytes = await readFile(path);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(1000); expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(8192);
  return createHash('sha256').update(bytes).digest('hex');
}

test('실제 PNG는 모바일·데스크톱 화면 크기와 관계없이 같은1080px 이미지로 저장된다', async ({ page }, testInfo) => {
  const { state, region } = await openExportPortfolio(page), saved = structuredClone(state.record), save = region.getByRole('button', { name: 'PNG 저장', exact: true });
  await expect(save).toBeEnabled(); let digest;
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)).toBeLessThanOrEqual(1);
    const pending = page.waitForEvent('download'); await save.click(); const hash = await receivePng(await pending, testInfo, `portfolio-${width}.png`);
    if (digest) expect(hash).toBe(digest); digest = hash;
  }
  expect(state.record).toEqual(saved); await expect(region).toContainText('PNG 저장을 요청했습니다.');
});

async function mockImageClipboard(page) {
  await page.addInitScript(() => {
    const state = { calls: 0, mode: 'defer', blob: null }; window.__imageClipboard = state;
    window.ClipboardItem = class { constructor(values) { this.values = values; } static supports(type) { return type === 'image/png'; } };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write(items) {
      state.calls++; state.blob = items[0].values['image/png'];
      if (state.mode === 'reject') return Promise.reject(new Error('NotAllowedError'));
      return new Promise((resolve, reject) => { state.resolve = resolve; state.reject = reject; });
    } } });
  });
}

test('복사는 실제 PNG 쓰기 응답 뒤에만 성공하며 거절되면 동일 Blob을 저장한다', async ({ page }, testInfo) => {
  await mockImageClipboard(page); const { region } = await openExportPortfolio(page), copy = region.getByRole('button', { name: '이미지 복사', exact: true }); await expect(copy).toBeEnabled();
  await copy.click(); await expect(copy).toBeDisabled(); await expect(region).toContainText('이미지를 복사하고 있습니다…'); await expect(region).not.toContainText('포트폴리오 이미지를 복사했습니다.');
  expect(await page.evaluate(() => window.__imageClipboard.calls)).toBe(1);
  const digest = await page.evaluate(async () => { const state = window.__imageClipboard, bytes = await state.blob.arrayBuffer(), hash = await crypto.subtle.digest('SHA-256', bytes); state.resolve(); return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join(''); });
  await expect(region).toContainText('포트폴리오 이미지를 복사했습니다.'); await expect(copy).toBeEnabled();
  await page.evaluate(() => { window.__imageClipboard.mode = 'reject'; });
  const pending = page.waitForEvent('download'); await copy.click(); expect(await receivePng(await pending, testInfo, 'portfolio-copy-fallback.png')).toBe(digest);
  await expect(region).toContainText('이미지를 복사할 수 없어 PNG 저장을 요청했습니다.');
});

test('복사 대기 중 화면을 나가면 늦은 거절로 이전 이미지를 자동 저장하지 않는다', async ({ page }) => {
  await mockImageClipboard(page); const { region } = await openExportPortfolio(page), downloads = []; page.on('download', download => downloads.push(download));
  const copy = region.getByRole('button', { name: '이미지 복사', exact: true }); await expect(copy).toBeEnabled(); await copy.click();
  await region.getByRole('button', { name: '지원 조합으로 돌아가기', exact: true }).click();
  await page.evaluate(async () => { window.__imageClipboard.reject(new Error('NotAllowedError')); for (let n = 0; n < 10; n++) await Promise.resolve(); });
  await expect(region).toHaveCount(0); expect(downloads).toHaveLength(0); await expect(page.getByText('포트폴리오 이미지를 복사했습니다.', { exact: true })).toHaveCount(0);
});

test('필수 글꼴 준비 실패는 성공이나 빈 이미지로 숨기지 않고 재시도한다', async ({ page }) => {
  await page.addInitScript(() => { window.__originalFontLoad = document.fonts.load.bind(document.fonts); document.fonts.load = () => Promise.reject(new Error('필수 글꼴을 불러오지 못했습니다.')); });
  const { region } = await openExportPortfolio(page); await expect(region.getByRole('button', { name: '이미지 다시 준비', exact: true })).toBeVisible(); await expect(region.getByRole('button', { name: 'PNG 저장', exact: true })).toBeDisabled();
  await page.evaluate(() => { document.fonts.load = window.__originalFontLoad; }); await region.getByRole('button', { name: '이미지 다시 준비', exact: true }).click(); await expect(region.getByRole('button', { name: 'PNG 저장', exact: true })).toBeEnabled();
});


test('군별 대학 안내는 대학만 먼저 보여주고 학과 선택·뒤로·Esc는 검색과 저장 자료를 보존한다', async ({ page }) => {
  const state = await setup(page, { grouped: true }); await saveScores(page); const saved = structuredClone(state.record);
  const ga = page.getByRole('region', { name: '가군 지원 후보', exact: true }), trigger = ga.getByRole('button', { name: '분석 가능한 대학 보기', exact: true });
  await trigger.click(); const dialog = page.getByRole('dialog', { name: '가군 후보 찾기', exact: true });
  await expect(dialog.getByRole('button', { name: /예시대학교/ })).toBeVisible();
  expect(state.catalogCalls.every(call => call.view === 'universities')).toBe(true); await expect(dialog.getByRole('button', { name: /후보에 추가$/ })).toHaveCount(0);
  await dialog.getByRole('searchbox', { name: '대학명 검색', exact: true }).fill('예시');
  await dialog.getByRole('button', { name: /예시대학교/ }).click();
  await expect(dialog.getByRole('button', { name: '예시대학교 예시학과 일반전형1 후보에 추가', exact: true })).toBeVisible();
  expect(state.catalogCalls.at(-1)).toMatchObject({ admissionGroup: 'ga', view: 'units', universityKey: 'UNIV_' + '1'.repeat(32) });
  await dialog.getByRole('button', { name: '대학 목록으로', exact: true }).click(); await expect(dialog.getByRole('searchbox')).toHaveValue('예시');
  await expect(dialog.getByRole('button', { name: /예시대학교/ })).toBeFocused(); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); expect(state.record).toEqual(saved);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

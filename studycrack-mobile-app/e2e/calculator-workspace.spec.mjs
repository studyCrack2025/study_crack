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
  const state = { record: empty(), calls: [], catalogCalls: [], conversionCalls: [], receipts: new Map(), committedPlans: 0, lostReply: false, deferRead: false, readRelease: null, failRead: false, ...options };
  if (options.recommendations) state.record.recommendationPreferencesVersion = 1;
  if (options.eligibility) state.record.recommendationEligibilityVersion = 1;
  const context = page.context();
  const token = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: 'workspace-student', exp: 4070908800 })).toString('base64url') + '.synthetic';
  await context.addInitScript(({ withoutOwner, token }) => { if (withoutOwner) sessionStorage.setItem('accessToken', token); else if (!localStorage.getItem('userId')) localStorage.setItem('userId', 'workspace-student'); localStorage.setItem('userRole', 'student'); }, { withoutOwner: options.withoutOwner === true, token });
  await context.route('https://www.googletagmanager.com/**', route => route.abort());
  await context.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL=false;window.CONFIG={api:{analysis:'/__workspace-analysis',consulting:'/__workspace-core',auth:'/__workspace-auth'}};` }));
  await context.route('**/__workspace-auth', route => route.fulfill({ json: { success: true } }));
  const recommend = (route, recommendation) => {
    const { admissionGroup, preferences, previousUniversities } = recommendation;
    state.recommendationCalls ??= []; state.recommendationCalls.push(recommendation);
    const names = previousUniversities.length ? ['새서울대', '새경기대'] : ['예시서울대', '예시경기대'];
    return route.fulfill({ json: { success: true, contractVersion: 'calculator-recommendations-v1', admissionYear: 2027,
      admissionGroup, strategy: preferences.strategy, scoreBasis: 'estimated', repeatedUniversities: 0,
      items: groupedTargets.filter(row => row.selection.admissionGroup === admissionGroup).map((row, index) => ({
        target: { ...row, university: names[index], selection: { ...row.selection, universityName: names[index] } },
        universityKey: 'UNIV_' + String(index + (previousUniversities.length ? 3 : 1)).repeat(32),
        tier: index, riskBand: index ? 'appropriate' : preferences.strategy === 'safe' ? 'stable' : 'neutral',
        convertedScore: 725, cutoffs: { pass: 700, registered70: 735 },
        offerEstimate: { policy: 'consulting-offer-estimate-1.1.0', scope: 'converted_score', percent: 75, low: 72, high: 78 }
      })) } });
  };
  await context.route('**/__workspace-analysis', async route => {
    const body = route.request().postDataJSON();
    if (body.type === 'get_calculator_access') {
      if (state.failAccess) return route.fulfill({ status: 503, json: { success: false, code: 'CALCULATOR_ACCESS_UNAVAILABLE' } });
      const value = calculatorAccessFixture({ applicationId: appId }); value.service.workspaceVersion = 2;
      if (options.grouped) value.service.selectionVersion = 1;
      if (options.recommendations) value.service.recommendationVersion = 1;
      return route.fulfill({ json: value });
    }
    if (body.type === 'get_calculator_recommendations') return recommend(route, body.data);
    if (body.type === 'get_calculator_score_conversion') return route.fulfill({ json: calculatorScoreFixture(body.data.records) });
    if (body.type === 'get_univ_list_only') return route.fulfill({ json: [{ univName: '예시대학교', majors: ['예시학과'] }] });
    if (body.type === 'get_calculator_catalog') {
      state.catalogCalls.push(body.data);
      expect(options.grouped).toBe(true); const { admissionGroup, query, cursor, view, universityKey } = body.data;
      const schoolKey = 'UNIV_' + '1'.repeat(32);
      if (view === 'universities') {
        const items = '예시대학교'.includes(query) ? [{ universityKey: schoolKey, name: '예시대학교', campuses: ['서울캠퍼스'], unitCount: 2 }] : [];
        return route.fulfill({ json: { success: true, contractVersion: 'calculator-universities-v1', admissionYear: 2027, catalogDigest, admissionGroup, query, total: items.length, items, nextCursor: null } });
      }
      expect(view).toBe('units'); expect(universityKey).toBe(schoolKey);
      const rows = groupedTargets.filter(row => row.selection.admissionGroup === admissionGroup && (!query || row.university.includes(query)));
      return route.fulfill({ json: { success: true, contractVersion: 'calculator-catalog-v1', admissionYear: 2027, catalogDigest, admissionGroup, query, universityKey, total: rows.length, items: rows.slice(cursor), nextCursor: null } });
    }
    expect(body.type).toBe('get_calculator_conversion'); const converted = calculatorRawPreviewFixture(body.data.scores, body.data.targets);
    state.conversionCalls.push(body.data.targets);
    if (options.approvedRawCutoff) converted.release = { dataReleaseId: 'ADMISSION_RELEASE_2027_TEST', contentDigest: catalogDigest, formulaVersion: 'formula-1.0.0', eligibilityRuleVersion: 'eligibility-1.0.0' };
    converted.results.forEach((row, index) => {
      const target = body.data.targets[index];
      if (!target.selection) return;
      row.selectionKey = target.selection.key;
      Object.assign(row.referenceComparison, { recordId: target.selection.recordId, candidateAdmissionIdentity: { admissionUnitId: target.admissionUnitId }, riskBand: 'stable' });
      if (options.approvedRawCutoff && target.selection.admissionGroup === 'ga') {
        row.reasonCodes = ['RAW_SCOREBOARD_NOT_RELEASED'];
        row.referenceComparison.historical70 = { year: 2026, score: 704.2 };
        row.previewCutoff = { status: 'available', dataReleaseId: converted.release.dataReleaseId, admissionUnitId: target.admissionUnitId,
          convertedScore: 720.36, cutoffs: { pass: 700, registered70: 715 }, riskBand: 'stable', publicationId: 'CUT_RELEASE_TEST',
          publicationDigest: catalogDigest, referenceDigest: catalogDigest, sourceYear: 2026, targetYear: 2027,
          offerEstimate: { policy: 'consulting-offer-estimate-1.1.0', scope: 'converted_score', percent: 75, low: 72, high: 78 } };
      }
      const notice = options.selectionNotices?.[target.selection.admissionGroup];
      if (notice) row.reasonCodes = [notice];
      if (options.referenceMissingGroups?.includes(target.selection.admissionGroup)) Object.assign(row.referenceComparison, { status: 'held', recordId: null, convertedScore: null, passReference: null, registered70Reference: null, referenceIndex: null, riskBand: null, reasonCodes: ['REFERENCE_DATA_UNAVAILABLE'] });
    });
    if (state.deferConversion) await new Promise(resolve => { state.conversionRelease = resolve; });
    if (state.failConversion) return route.fulfill({ status: 503, json: { success: false, code: 'CALCULATOR_TEMPORARILY_UNAVAILABLE' } });
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
    if (body.type === 'student_get_calculator_profile_recommendations') {
      expect(Object.keys(data).sort()).toEqual(['admissionGroup', 'applicationId', 'previousUniversities', 'profileRevision']);
      expect(data.profileRevision).toBe(state.record.profile.revision);
      return recommend(route, { ...data, preferences: state.record.profile.recommendationPreferences });
    }
    const prior = state.receipts.get(data.requestId);
    if (prior) return route.fulfill({ json: { success: true, data: { ...prior, idempotent: true } } });
    if (data.expectedWorkspaceRevision !== state.record.revision) return route.fulfill({ status: 409, json: { success: false, code: 'REVISION_CONFLICT' } });
    expect(data.requestId).toMatch(/^workspace_[0-9a-f-]{36}$/i);
    if (body.type === 'student_save_calculator_profile') {
      if (!state.record.consentAccepted) expect(data.consented).toBe(true);
      const recommendationPreferences = data.recommendationPreferences ?? state.record.profile?.recommendationPreferences;
      const applicantGender = data.applicantGender ?? state.record.profile?.applicantGender;
      state.record.profile = { revision: (state.record.profile?.revision || 0) + 1, scores: data.scores, updatedAt: at,
        ...(recommendationPreferences ? { recommendationPreferences } : {}), ...(applicantGender ? { applicantGender } : {}) };
    } else if (body.type === 'student_save_calculator_plan') {
      const old = state.record.plans.find(plan => plan.planId === data.planId);
      const groups = data.targets.map(target => target.selection?.admissionGroup);
      if (options.grouped) { expect(groups.every(Boolean)).toBe(true); expect(new Set(groups).size).toBe(groups.length); }
      const oldGroups = old?.targets.map(target => target.selection?.admissionGroup);
      const legacy = oldGroups && (!oldGroups.every(Boolean) || new Set(oldGroups).size !== oldGroups.length);
      const displaced = options.grouped && old ? old.targets.filter(target => legacy || groups.includes(target.selection?.admissionGroup)) : [];
      const previousTargets = [...displaced, ...(old?.previousTargets || [])].filter(target => !data.targets.some(current => current.selection?.key === target.selection?.key));
      const plan = { planId: old?.planId || 'PLAN_TEST_' + (state.record.plans.length + 1), revision: (old?.revision || 0) + 1, name: data.name, targets: data.targets, ...(previousTargets.length ? { previousTargets } : {}), ...(data.representatives ? { representatives: data.representatives } : {}), updatedAt: at };
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
async function saveScores(page, applicantGender) {
  for (const [title, option] of [['국어', '언어와매체'], ['수학', '미적분'], ['탐구 1', '사회·문화'], ['탐구 2', '생활과 윤리']]) {
    await page.getByRole('combobox', { name: `${title} 선택과목`, exact: true }).selectOption(option);
    if (title.startsWith('탐구')) await page.getByRole('textbox', { name: `${title} 원점수`, exact: true }).fill(title === '탐구 1' ? '44' : '45');
    else { await page.getByRole('textbox', { name: `${title} 공통 원점수`, exact: true }).fill('60'); await page.getByRole('textbox', { name: `${title} 선택 원점수`, exact: true }).fill(title === '국어' ? '20' : '14'); }
  }
  await page.getByRole('combobox', { name: '영어 등급', exact: true }).selectOption('2'); await page.getByRole('combobox', { name: '한국사 등급', exact: true }).selectOption('1');
  if (applicantGender) await page.getByRole('combobox', { name: /^성별/ }).selectOption(applicantGender);
  await page.getByRole('checkbox', { name: '성적·지원 후보 저장과 운영팀 열람에 동의합니다', exact: true }).check();
  await page.getByRole('button', { name: '이 성적으로 시작하기', exact: true }).click();
  await expect(page.getByRole('region', { name: '저장한 내 성적', exact: true })).toBeVisible();
}
async function addTarget(page) {
  await page.getByRole('searchbox', { name: '대학명 검색', exact: true }).fill('예시대학교'); await page.getByRole('button', { name: /예시대학교/ }).click();
  await page.getByRole('button', { name: '예시학과 후보에 추가', exact: true }).click();
}

test('군별 추천은 저장한 조건을 사용하고 재추천 후 선택한 학과만 조합에 담는다', async ({ page }) => {
  const state = await setup(page, { grouped: true, recommendations: true, eligibility: true });
  await saveScores(page, 'male');
  expect(state.record.profile.applicantGender).toBe('male');
  await page.getByRole('button', { name: '성적 수정', exact: true }).click();
  const originalViewport = page.viewportSize();
  const gender = page.getByRole('combobox', { name: '성별', exact: true });
  const strategy = page.getByRole('combobox', { name: '지원 성향', exact: true });
  await expect(gender).toBeVisible();
  await expect(strategy).toBeVisible();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [left, right] of [
      [gender, strategy],
      [page.getByRole('button', { name: '성적 수정 저장', exact: true }), page.getByRole('button', { name: '성적 수정 취소', exact: true })]
    ]) {
      const [first, second] = await Promise.all([left.boundingBox(), right.boundingBox()]);
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
      expect(first.x + first.width).toBeLessThan(second.x);
      expect(second.x + second.width).toBeLessThanOrEqual(width + 1);
      expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
      expect(first.width).toBeLessThanOrEqual(180);
    }
  }
  const [firstRegion, lastRegion] = await Promise.all([
    page.getByRole('checkbox', { name: '서울', exact: true }).boundingBox(),
    page.getByRole('checkbox', { name: '제주', exact: true }).boundingBox()
  ]);
  expect(lastRegion.y).toBeGreaterThan(firstRegion.y);
  await page.setViewportSize(originalViewport);
  await page.getByRole('checkbox', { name: '인문사회', exact: true }).check();
  await page.getByRole('checkbox', { name: '상경', exact: true }).check();
  await page.getByRole('checkbox', { name: '자연·공학', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '의약학', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: '서울', exact: true }).check();
  await page.getByRole('checkbox', { name: '인천', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '경기', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: '지원 성향' }).selectOption('ambitious');
  await page.getByRole('button', { name: '추천 조건 저장', exact: true }).click();
  await expect(page.getByRole('region', { name: '저장한 내 성적', exact: true })).toBeVisible();
  expect(state.record.profile.scores).toEqual(raw);
  await page.getByRole('button', { name: '가군 후보 찾기', exact: true }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('combobox', { name: '지원 성향' })).toHaveCount(0);
  await expect(picker).toContainText('저장한 지원 성향 · 도전 우선');
  await expect(picker).toContainText('예시서울대 · 소신');
  await expect(picker).toContainText('예시경기대 · 적정');
  await expect(picker).toContainText('같은 권역까지 확대');
  await expect(picker).toContainText('추정 합격 가능성 72~78%');
  expect(state.record.profile.recommendationPreferences).toEqual({
    streams: ['business', 'humanities', 'natural'], regions: ['REGION_INCHEON', 'REGION_SEOUL'], strategy: 'ambitious'
  });
  await picker.getByRole('button', { name: '다시 추천받기' }).click();
  await expect(picker).toContainText('새서울대 · 소신');
  await expect(picker).toContainText('새경기대 · 적정');
  expect(state.recommendationCalls[1].previousUniversities).toEqual(['UNIV_' + '1'.repeat(32), 'UNIV_' + '2'.repeat(32)]);
  await picker.getByRole('button', { name: '새서울대 예시학과 이 후보 담기' }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole('region', { name: '가군 지원 후보', exact: true })).toContainText('새서울대');
  expect(state.record.plans).toHaveLength(0);
  const save = page.getByRole('button', { name: '변경사항 저장', exact: true });
  const candidate = page.getByRole('region', { name: '가군 지원 후보', exact: true });
  expect((await save.boundingBox()).y).toBeGreaterThan((await candidate.boundingBox()).y + (await candidate.boundingBox()).height);
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: '지원 조합을 저장했습니다.' })).toBeVisible();
  expect(state.record.plans[0].targets[0].selection.universityName).toBe('새서울대');
  await page.reload();
  await page.getByRole('button', { name: '가군 후보 바꾸기', exact: true }).click();
  await expect(picker).toContainText('저장한 지원 성향 · 도전 우선');
  expect(state.calls.filter(call => call.type === 'student_save_calculator_profile')).toHaveLength(2);
});

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
  await page.getByText('조합 관리', { exact: true }).click(); await page.getByRole('button', { name: '다른 조합으로 저장', exact: true }).click();
  await page.getByRole('textbox', { name: '새 조합 이름', exact: true }).fill('두 번째 조합'); await page.getByRole('button', { name: '새 조합 저장', exact: true }).click();
  await expect(page.getByText('새 조합으로 저장했습니다.', { exact: true })).toBeVisible(); expect(state.record.plans).toHaveLength(2);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '조합 삭제', exact: true }).click();
  await expect(page.getByRole('region', { name: '지원 조합 관리' }).getByRole('heading', { name: '기본 조합', exact: true })).toBeVisible(); expect(state.record.plans).toHaveLength(1); expect(state.record.profile.revision).toBe(1);
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

async function addGroupTarget(page, label, track = 1, replace = false) {
  await page.getByRole('navigation', { name: '모집군 선택', exact: true }).getByRole('button', { name: new RegExp(label) }).click();
  const title = `${label} 후보 ${replace ? '바꾸기' : '찾기'}`;
  await page.getByRole('button', { name: title, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox', { name: '대학명 검색', exact: true }).fill('예시');
  await dialog.getByRole('button', { name: /예시대학교/ }).click();
  await dialog.getByRole('button', { name: `예시대학교 예시학과 일반전형${track} ${replace ? '후보로 바꾸기' : '후보에 추가'}`, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('조합 선택과 새 조합의 높이가 일치하고 이름만 저장해도 후보 초안이 유지된다', async ({ page }) => {
  const state = await setup(page, { grouped: true });
  await saveScores(page);
  const emptyToolbar = page.getByRole('region', { name: '지원 조합 관리' });
  await expect(emptyToolbar.getByText('저장한 조합 없음')).toBeVisible();
  await expect(emptyToolbar.getByRole('combobox', { name: '저장한 조합' })).toHaveCount(0);
  await addGroupTarget(page, '가군');
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '포트폴리오 보기' })).toBeEnabled();
  const before = structuredClone(state.record.plans[0]);
  const toolbar = page.getByRole('region', { name: '지원 조합 관리' });
  const select = toolbar.getByRole('combobox', { name: '저장한 조합' }), create = toolbar.getByRole('button', { name: '＋ 새 조합' });
  for (const width of [320, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const [selection, button] = await Promise.all([select.boundingBox(), create.boundingBox()]);
    expect(Math.abs(selection.height - button.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(selection.y - button.y)).toBeLessThanOrEqual(1);
    expect(selection.height).toBeGreaterThanOrEqual(48);
  }
  await addGroupTarget(page, '가군', 2, true);
  const candidate = page.getByRole('region', { name: '가군 지원 후보', exact: true });
  await expect(candidate).toContainText('일반전형2');
  await expect(candidate).toContainText('710.25점');
  const count = state.conversionCalls.length;
  await toolbar.getByRole('button', { name: '이름 변경' }).click();
  const input = toolbar.getByRole('textbox', { name: '조합 이름' });
  await expect(input).toBeFocused(); await input.fill('내 지원안'); await input.press('Enter');
  await expect(toolbar.getByRole('heading', { name: '내 지원안' })).toBeVisible();
  await expect(select.locator('option:checked')).toHaveText('내 지원안');
  expect(state.record.plans[0]).toMatchObject({ planId: before.planId, targets: before.targets, representatives: before.representatives, name: '내 지원안' });
  expect(state.conversionCalls).toHaveLength(count);
  await expect(candidate).toContainText('일반전형2');
  await expect(toolbar.getByRole('button', { name: '변경사항 저장' })).toBeEnabled();
});

test('한 군 교체와 재시도는 다른 군의 점수와 요청에 영향을 주지 않는다', async ({ page }) => {
  const state = await setup(page, { grouped: true });
  await saveScores(page); await page.setViewportSize({ width: 1440, height: 900 });
  const [ga, na, da] = ['가군', '나군', '다군'].map(label => page.getByRole('region', { name: `${label} 지원 후보`, exact: true }));
  for (const [label, region] of [['가군', ga], ['나군', na], ['다군', da]]) {
    await addGroupTarget(page, label); await expect(region).toContainText('710.25점');
  }
  state.deferConversion = true;
  await addGroupTarget(page, '가군', 2, true);
  await expect.poll(() => typeof state.conversionRelease).toBe('function');
  expect(state.conversionCalls.at(-1)).toEqual([groupedTargets[1]]);
  await expect(ga).toContainText('가군 후보를 계산하고 있습니다');
  for (const region of [na, da]) {
    await expect(region).toContainText('710.25점'); await expect(region).not.toContainText('계산하고 있습니다');
  }
  state.failConversion = true; state.deferConversion = false; state.conversionRelease();
  const retry = ga.getByRole('button', { name: '가군 후보 다시 계산' });
  await expect(retry).toBeVisible(); state.failConversion = false; await retry.click();
  await expect(ga).toContainText('710.25점'); expect(state.conversionCalls.at(-1)).toEqual([groupedTargets[1]]);
});

test('군별로 같은 이름의 모집단위를 구별하고 한 자리씩 교체·저장·복원·삭제한다', async ({ page }, testInfo) => {
  const state = await setup(page, { grouped: true }); await saveScores(page);
  for (const label of ['가군', '나군', '다군']) await addGroupTarget(page, label);
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible();
  await addGroupTarget(page, '가군', 2, true);
  const ga = page.getByRole('region', { name: '가군 지원 후보', exact: true });
  await expect(ga.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible();
  expect(state.record.plans[0].targets).toHaveLength(3); expect(state.record.plans[0].representatives).toEqual({ ga: groupedTargets[1].selection.key, na: groupedTargets[2].selection.key, da: groupedTargets[4].selection.key });
  expect(state.record.plans[0].previousTargets).toEqual([groupedTargets[0]]);
  await page.reload(); await expect(page.getByRole('region', { name: '군별 지원 조합', exact: true })).toBeVisible();
  await expect(ga.getByRole('listitem')).toHaveCount(1); await expect(ga).toContainText('일반전형2');
  await expect(page.getByText('이전에 저장한 후보 (1)', { exact: true })).toBeVisible();
  for (const width of [320, 375, 430, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)).toBeLessThanOrEqual(1); }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('navigation', { name: '모집군 선택', exact: true }).getByRole('button', { name: /나군/ }).click();
  await expect(ga).toBeHidden(); await expect(page.getByRole('region', { name: '나군 지원 후보', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('grouped-mobile.png'), fullPage: true });
  await page.getByRole('navigation', { name: '모집군 선택', exact: true }).getByRole('button', { name: /가군/ }).click();
  await ga.getByRole('button', { name: '가군 예시대학교 예시학과 후보 삭제', exact: true }).click();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible(); expect(state.record.plans[0].representatives.ga).toBeNull(); expect(state.record.plans[0].targets).toHaveLength(2);
});

test('탭 복귀 이용권 조회가 일시 실패해도 재확인 후 저장 전 후보가 복원된다', async ({ page }) => {
  const state = await setup(page, { grouped: true }); await saveScores(page); await addGroupTarget(page, '가군');
  const ga = page.getByRole('region', { name: '가군 지원 후보', exact: true });
  await expect(ga).toContainText('일반전형1');
  state.failAccess = true;
  await page.clock.setFixedTime(new Date(await page.evaluate(() => Date.now()) + 31_000));
  await page.evaluate(() => dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: '이용 정보를 확인하지 못했습니다.', exact: true })).toBeVisible();
  await expect(ga).toBeHidden();
  state.failAccess = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(ga).toContainText('일반전형1');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled();
  expect(state.committedPlans).toBe(0);
});

test('기존 후보는 군 미분류로 보존하고 정확한 선택으로 교체한다', async ({ page }) => {
  const value = empty(); Object.assign(value, { revision: 1, updatedAt: at, status: 'saved', profile: { revision: 1, scores: raw, updatedAt: at }, consentAccepted: true, canDelete: true,
    plans: [{ planId: 'PLAN_LEGACY_1', revision: 1, name: '기존 조합', targets: [{ university: '예시대학교', major: '예시학과' }], updatedAt: at }], lastSavedPlanId: 'PLAN_LEGACY_1' });
  const state = await setup(page, { grouped: true, record: value });
  const archive = page.getByText('이전에 저장한 후보 (1)', { exact: true });
  await expect(archive).toBeVisible();
  for (const label of ['가군', '나군', '다군']) await expect(page.getByRole('region', { name: `${label} 지원 후보`, exact: true }).getByRole('listitem')).toHaveCount(0);
  await addGroupTarget(page, '가군'); await expect(archive).toBeVisible();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(page.getByText('지원 조합을 저장했습니다.', { exact: true })).toBeVisible();
  expect(state.record.plans[0].targets).toEqual([groupedTargets[0]]);
  expect(state.record.plans[0].previousTargets).toEqual([{ university: '예시대학교', major: '예시학과' }]);
  await page.reload(); await archive.click(); await expect(page.getByText('모집군을 확인하려면 군별 검색에서 다시 찾아보세요.')).toBeVisible();
});

test('저장한 지원 후보를 포트폴리오로 보고 돌아와도 성적·조합을 변경하지 않는다', async ({ page }, testInfo) => {
  const state = await setup(page, { grouped: true }); await saveScores(page);
  const open = page.getByRole('button', { name: '포트폴리오 보기', exact: true }); await expect(open).toBeDisabled();
  await addGroupTarget(page, '가군'); await expect(open).toBeDisabled();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(open).toBeEnabled();
  const saved = structuredClone(state.record), writes = state.calls.filter(row => row.type.startsWith('student_save_')).length;
  await open.click(); const portfolio = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true }); await expect(portfolio).toBeVisible();
  await expect(portfolio.getByRole('heading', { name: '나의 정시 포트폴리오', exact: true })).toBeFocused();
  const ga = portfolio.getByRole('article', { name: '가군 지원 후보', exact: true });
  await expect(ga).toContainText('710.25점'); await expect(ga).toContainText('산출 보류'); await expect(ga.getByLabel('지원 단계: 판단 대기', { exact: true })).toBeVisible();
  await expect(ga.locator('.jcalc-forecast-badge')).toHaveAttribute('data-risk', 'unavailable');
  await expect(portfolio.getByRole('article', { name: '나군 지원 후보', exact: true })).toContainText('미선택');
  await expect(portfolio.getByRole('article', { name: '다군 지원 후보', exact: true })).toContainText('미선택');
  await expect(portfolio).toContainText('기존 산식 환산점수'); await expect(portfolio).toContainText('실제 합격 확률이 아닙니다');
  for (const width of [320, 375, 430, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)).toBeLessThanOrEqual(1); }
  await page.screenshot({ path: testInfo.outputPath('portfolio-partial.png'), fullPage: true });
  await portfolio.getByRole('button', { name: '지원 조합으로 돌아가기', exact: true }).click(); await expect(portfolio).toHaveCount(0); await expect(open).toBeEnabled();
  expect(state.record).toEqual(saved); expect(state.calls.filter(row => row.type.startsWith('student_save_'))).toHaveLength(writes);
});

test('가채점의 승인된 두 컷과 지원 단계를 계산기와 포트폴리오에 표시한다', async ({ page }) => {
  await setup(page, { grouped: true, approvedRawCutoff: true }); await saveScores(page);
  await addGroupTarget(page, '가군'); await addGroupTarget(page, '나군');
  await page.getByRole('navigation', { name: '모집군 선택' }).getByRole('button', { name: /가군/ }).click();
  const gaCandidate = page.getByRole('region', { name: '가군 지원 후보', exact: true });
  await expect(gaCandidate.getByText('가채점 환산점수', { exact: true })).toBeVisible();
  for (const score of ['720.36점', '700.00점', '715.00점']) {
    await expect(gaCandidate.getByText(score, { exact: true })).toBeVisible();
  }
  await expect(gaCandidate.getByLabel('지원 단계: 안정', { exact: true })).toBeVisible();
  const graph = gaCandidate.getByRole('img', { name: /^점수 위치 비교/ });
  await expect(graph).toBeVisible();
  await expect(graph).toHaveAccessibleName(/내 점수 720\.36점.*\+20\.36점.*\+5\.36점/);
  await expect(graph).toHaveAttribute('data-risk', 'stable');
  await expect(gaCandidate.getByText('약 75% (72~78%)', { exact: true })).toBeVisible();
  await expect(gaCandidate.getByText('2026학년도 최종등록자 70% 컷', { exact: true })).toHaveCount(0);
  const notes = gaCandidate.getByText(/확인된 모집인원과 입결을 반영한 추정치/);
  await expect(notes).toHaveCount(1);
  await expect(notes).toBeHidden();
  const cautions = gaCandidate.getByText('주의사항', { exact: true });
  const remove = gaCandidate.getByRole('button', { name: /후보 삭제$/ });
  const initialViewport = page.viewportSize();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const [cautionBox, removeBox] = await Promise.all([cautions.boundingBox(), remove.boundingBox()]);
    expect(Math.abs(cautionBox.y - removeBox.y)).toBeLessThanOrEqual(1);
    expect(cautionBox.x + cautionBox.width).toBeLessThan(removeBox.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize(initialViewport);
  await cautions.click();
  await expect(notes).toBeVisible();
  await cautions.click();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await page.getByRole('button', { name: '포트폴리오 보기', exact: true }).click();
  const portfolio = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true });
  const ga = portfolio.getByRole('article', { name: '가군 지원 후보', exact: true });
  await expect(ga).toContainText('720.36점');
  await expect(ga).toContainText('700.00점');
  await expect(ga.getByText('715.00점', { exact: true })).toBeHidden();
  await ga.getByText('상세 보기', { exact: true }).click();
  await expect(ga.getByText('715.00점', { exact: true })).toBeVisible();
  await expect(ga.getByLabel('지원 단계: 안정', { exact: true })).toBeVisible();
  await expect(portfolio.getByRole('article', { name: '나군 지원 후보', exact: true })).toContainText('산출 보류');
});

test('수시 이월과 학생부 전형의 실제 수능 최저 결과를 지원 조합과 포트폴리오에 표시한다', async ({ page }) => {
  await setup(page, { grouped: true, referenceMissingGroups: ['ga', 'da'],
    selectionNotices: { ga: 'SELECTION_CARRYOVER_ONLY', da: 'CSAT_MINIMUM_MET' } });
  await saveScores(page);
  const outcomes = [
    ['가군', '수시 이월 때 선발', /최종 정시 모집인원/],
    ['다군', '수능 최저 충족', /학생부 100%/]
  ];
  for (const [group, label, note] of outcomes) {
    await addGroupTarget(page, group);
    const candidate = page.getByRole('region', { name: `${group} 지원 후보`, exact: true });
    await expect(candidate.getByLabel(`지원 단계: ${label}`, { exact: true })).toBeVisible();
    await expect(candidate).toContainText(note);
    await expect(candidate).not.toContainText(/판단 대기|산출 보류/);
  }
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await page.getByRole('button', { name: '포트폴리오 보기', exact: true }).click();
  const portfolio = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true });
  for (const [group, label, note] of outcomes) {
    const card = portfolio.getByRole('article', { name: `${group} 지원 후보`, exact: true });
    await expect(card.getByLabel(`지원 단계: ${label}`, { exact: true })).toBeVisible();
    await expect(card.getByText(note)).toBeHidden();
    await card.getByText('상세 보기', { exact: true }).click();
    await expect(card.getByText(note)).toBeVisible();
    await expect(card).not.toContainText(/판단 대기|산출 보류/);
  }
});

test('저장된 제외 전형은 재접속 후에도 계산 제외 사유를 표시한다', async ({ page }) => {
  const target = groupedTargets[0];
  const plan = { planId: 'PLAN_EXCLUDED_1', revision: 1, name: '기존 지원 조합', targets: [target],
    representatives: { ga: target.selection.key, na: null, da: null }, updatedAt: at };
  const record = { ...empty(), revision: 1, updatedAt: at, status: 'saved',
    profile: { revision: 1, scores: raw, updatedAt: at }, plans: [plan], lastSavedPlanId: plan.planId, consentAccepted: true, canDelete: true };
  const state = await setup(page, { record, grouped: true, referenceMissingGroups: ['ga'],
    selectionNotices: { ga: 'SELECTION_SCORE_POLICY_UNCONFIRMED' } });
  const candidate = page.getByRole('region', { name: '가군 지원 후보', exact: true });
  const label = '지원 단계: 현재 계산 대상 제외';
  const note = /대학의 환산 규정 확인이 남아 있습니다/;
  await expect(candidate.getByLabel(label, { exact: true })).toBeVisible();
  await expect(candidate).toContainText(note);
  await expect(candidate).not.toContainText(/판단 대기|산출 보류|예상 합격 컷/);

  await page.getByRole('button', { name: '포트폴리오 보기', exact: true }).click();
  const portfolio = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true });
  const card = portfolio.getByRole('article', { name: '가군 지원 후보', exact: true });
  await expect(card.getByLabel(label, { exact: true })).toBeVisible();
  await card.getByText('상세 보기', { exact: true }).click();
  await expect(card.getByText(note)).toBeVisible();
  await expect(card).not.toContainText(/판단 대기|산출 보류/);

  await page.reload();
  await expect(candidate.getByLabel(label, { exact: true })).toBeVisible();
  expect(state.record.plans[0].targets[0].selection.key).toBe(target.selection.key);
  expect(state.calls.filter(call => call.type.startsWith('student_save_'))).toHaveLength(0);
});

test('비교 보류인 군도 보존하며 성적 수정 후 이전 계산으로 포트폴리오를 열지 않는다', async ({ page }) => {
  const state = await setup(page, { grouped: true, referenceMissingGroups: ['na'] }); await saveScores(page);
  await addGroupTarget(page, '가군'); await addGroupTarget(page, '나군'); await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  const open = page.getByRole('button', { name: '포트폴리오 보기', exact: true }); await expect(open).toBeEnabled(); await open.click();
  const portfolio = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true }), na = portfolio.getByRole('article', { name: '나군 지원 후보', exact: true });
  await expect(na).toContainText('판단 대기'); await expect(na.locator('[aria-current="true"]')).toHaveCount(0); await expect(na).not.toContainText('710.25');
  await portfolio.getByRole('button', { name: '지원 조합으로 돌아가기', exact: true }).click();
  await page.getByRole('button', { name: '성적 수정', exact: true }).click(); await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('59');
  state.deferConversion = true; await page.getByRole('button', { name: '성적 수정 저장', exact: true }).click();
  await expect(page.getByRole('region', { name: '저장한 내 성적', exact: true })).toContainText('원점수 79'); await expect(open).toBeDisabled();
  await expect.poll(() => typeof state.conversionRelease).toBe('function'); state.deferConversion = false; state.conversionRelease();
  await expect(open).toBeEnabled(); await open.click(); await expect(portfolio.getByRole('article', { name: '가군 지원 후보', exact: true })).toContainText('709.25점');
  expect(state.record.plans[0].targets).toHaveLength(2); expect(state.record.profile.revision).toBe(2);
});

async function openExportPortfolio(page) {
  const state = await setup(page, { grouped: true }); await saveScores(page); await addGroupTarget(page, '가군');
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await page.getByRole('button', { name: '포트폴리오 보기', exact: true }).click();
  const region = page.getByRole('region', { name: '나의 정시 포트폴리오', exact: true }); await expect(region).toBeVisible(); return { state, region };
}
async function receivePng(download, testInfo, filename) {
  expect(download.suggestedFilename().normalize('NFC')).toBe('StudyCrack_2027_정시_포트폴리오.png');
  const path = testInfo.outputPath(filename); await download.saveAs(path); const bytes = await readFile(path);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(400); expect(bytes.readUInt32BE(20)).toBeLessThan(900);
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
  await trigger.click(); const dialog = page.getByRole('dialog', { name: '가군 분석 가능한 대학', exact: true });
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

test('직접 검색은 검색어가 있을 때만 대학 목록을 조회한다', async ({ page }) => {
  const state = await setup(page, { grouped: true }); await saveScores(page);
  await page.clock.install();
  await page.getByRole('button', { name: '가군 후보 찾기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '가군 후보 찾기', exact: true });
  const search = dialog.getByRole('searchbox', { name: '대학명 검색', exact: true });
  await expect(search).toBeFocused();
  await search.fill('  '); await page.clock.fastForward(350);
  await expect(dialog.getByText('대학명을 입력하면 검색 결과가 표시됩니다.')).toBeVisible();
  expect(state.catalogCalls).toHaveLength(0);
  await search.fill('예시'); await page.clock.fastForward(350);
  await expect(dialog.getByRole('button', { name: /예시대학교/ })).toBeVisible();
  await search.clear(); await page.clock.fastForward(350);
  await expect(dialog.getByRole('button', { name: /예시대학교/ })).toHaveCount(0);
  expect(state.catalogCalls).toMatchObject([{ admissionGroup: 'ga', view: 'universities', query: '예시' }]);
});

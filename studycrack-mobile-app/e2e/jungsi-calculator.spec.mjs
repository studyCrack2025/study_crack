import { calculatorAccessFixture, calculatorEmptyStorage, calculatorLegacyDraft, calculatorRawPreviewFixture, calculatorScoreFixture } from './support/calculator-fixture.mjs';
import { expect, test } from '@playwright/test';

const path = '/2027-jungsi-consulting/calculator';
async function refreshAccess(page) {
  await page.clock.setFixedTime(new Date(await page.evaluate(() => Date.now()) + 31_000));
  await page.evaluate(() => dispatchEvent(new Event('focus')));
}
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-11-28T00:00:00+09:00')); });
const catalog = [
  { univName: '한국외국어대학교(서울)', majors: ['경영학부', '경제학부'] },
  { univName: '한국외국어대학교(글로벌)', majors: ['경영학과', '컴퓨터공학부', ...Array.from({ length: 16 }, (_, index) => `가상학과${index + 1}`)] },
  ...Array.from({ length: 15 }, (_, index) => ({ univName: `가상대학교${index + 1}`, majors: ['예시학과'] }))
];

async function setup(page, { signedIn = true, fresh = false } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://www.googletagmanager.com/**', route => route.abort());
  const control = { calls: [], coreCalls: [], mode: 'ready', release: null, conversionMode: 'ready', conversionRelease: null, possibilityMode: 'pending', riskBand: 'stable', indexPoints: 82, accessMode: 'ready', accessAllowed: true, accessSource: 'purchase', accessRelease: null };
  await page.addInitScript(({ signedIn, draft }) => {
    if (signedIn && !localStorage.getItem('userId') && localStorage.getItem('sc_session_ended') !== '1') {
      localStorage.setItem('userId', 'calculator-student-A');
      localStorage.setItem('userRole', 'student');
    }
    const key = 'sc_jungsi_calculator_v1:calculator-student-A';
    if (signedIn && draft && localStorage.getItem('userId') === draft.owner && !sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(draft));
  }, { signedIn, draft: fresh ? null : calculatorLegacyDraft('calculator-student-A') });
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL=false;window.CONFIG={api:{analysis:'/__calculator-analysis',consulting:'/__calculator-core',consultingPublic:'/__calculator-public',auth:'/__calculator-auth'}};` }));
  await page.route('**/__calculator-public', route => route.fulfill({ json: { success: true, data: { campaignSlug: '2027-jungsi-consulting', admissionYear: 2027, enrollmentStatus: 'unavailable', price: null } } }));
  await page.route('**/__calculator-core', route => {
    const request = route.request().postDataJSON(); control.coreCalls.push(request);
    if (request.type === 'student_get_calculator_input') { expect(request.data.applicationId).toBe('APP_123e4567-e89b-12d3-a456-426614174000'); return route.fulfill({ json: calculatorEmptyStorage() }); }
    expect(request).toEqual({ type: 'student_get_calculator_applications', data: {} });
    return route.fulfill({ json: { success: true, data: { contractVersion: 'calculator-applications-v1', items: [], hasMore: false, needsReview: false, accountEmailMask: null } } });
  });
  await page.route('**/__calculator-auth', route => route.fulfill({ json: { success: true } }));
  await page.route('**/__calculator-analysis', async route => {
    const payload = route.request().postDataJSON();
    control.calls.push(payload);
    expect((await route.request().allHeaders()).authorization).toBeUndefined();
    if (payload.type === 'get_calculator_access') {
      expect(payload).toEqual({ type: 'get_calculator_access' });
      if (control.accessMode === 'defer') await new Promise(resolve => { control.accessRelease = resolve; });
      try {
        if (control.accessMode === 'error') return await route.fulfill({ status: 503, json: { code: 'CALCULATOR_ACCESS_UNAVAILABLE' } });
        const fixture = calculatorAccessFixture({ allowed: control.accessAllowed, source: control.accessSource, mode: control.calculationMode ?? 'development_preview', calculationEnabled: control.calculationEnabled ?? control.earlyAccess ?? true, earlyAccess: control.earlyAccess });
        fixture.service.purchaseAvailable = control.accessMode === 'invalid';
        return await route.fulfill({ json: fixture });
      } catch (_) { return; }
    }
    if (payload.type === 'get_calculator_score_conversion') return route.fulfill({ json: calculatorScoreFixture(payload.data.records) });
    if (payload.type === 'get_calculator_conversion') {
      expect(Object.keys(payload).sort()).toEqual(['data', 'type']);
      expect(Object.keys(payload.data).sort()).toEqual(['scores', 'targets']);
      if (control.conversionMode === 'raw-preview') return route.fulfill({ json: calculatorRawPreviewFixture(payload.data.scores, payload.data.targets) });
      if (control.conversionMode === 'defer') await new Promise(resolve => { control.conversionRelease = resolve; });
      try {
        if (control.conversionMode === 'error') return await route.fulfill({ status: 503, json: { code: 'CALCULATOR_TEMPORARILY_UNAVAILABLE' } });
        if (control.conversionMode === 'denied') return await route.fulfill({ status: 402, json: { code: 'CALCULATOR_ACCESS_REQUIRED' } });
        return await route.fulfill({ json: conversionResponse(payload, control) });
      } catch (_) { return; }
    }
    expect(payload).toEqual({ type: 'get_univ_list_only', catalogView: 'reviewed_calculator' });
    if (control.mode === 'defer') await new Promise(resolve => { control.release = resolve; });
    try {
      if (control.mode === 'error') return await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      if (control.mode === 'empty') return await route.fulfill({ json: [] });
      return await route.fulfill({ json: catalog });
    } catch (_) {}
  });
  return control;
}

function conversionResponse(payload, control) {
  const mode = control.conversionMode;
  const release = { dataReleaseId: 'ADMISSION_RELEASE_2027_BROWSER_TEST', contentDigest: `sha256:${'a'.repeat(64)}`, formulaVersion: 'formula-1.0.0', eligibilityRuleVersion: 'eligibility-1.0.0' };
  return { success: true, contractVersion: 'jungsi-calculator-conversion-v1', admissionYear: mode === 'invalid' ? 2026 : 2027, basis: payload.data.scores.basis, scoreSource: 'self_reported', scoreDigest: `sha256:${'b'.repeat(64)}`, release: mode === 'pending' ? null : release,
    results: payload.data.targets.map(target => {
      const option = { admissionUnitId: 'UNIT_BROWSER_EXAMPLE', campusName: '글로벌캠퍼스', unitName: target.major, trackName: '수능 일반전형', admissionGroup: 'na' };
      const row = { university: target.university, major: target.major, status: 'available', choices: [option], selected: option, reasonCodes: [], convertedScore: 743.1256, maximumScore: 1000 };
      if (['raw-points', 'missing-maximum', 'unknown-scale'].includes(mode)) Object.assign(row, { maximumScore: null,
        ...(mode !== 'missing-maximum' ? { scoreScale: mode === 'raw-points' ? 'raw_points' : 'unknown' } : {}) });
      if (['component', 'component-exact', 'component-unknown'].includes(mode)) Object.assign(row, { scoreScope: 'csat_component',
        precisionPolicy: mode === 'component-exact' ? 'exact_integer_domain' : mode === 'component' ? 'published' : 'unknown' });
      if (mode === 'choice') row.choices.push({ ...option, admissionUnitId: 'UNIT_BROWSER_SECOND', admissionGroup: 'da' });
      if (mode === 'choice' && !target.admissionUnitId) Object.assign(row, { status: 'choice_required', selected: null, reasonCodes: ['UNIT_SELECTION_REQUIRED'], convertedScore: null, maximumScore: null });
      if (target.admissionUnitId) row.selected = row.choices.find(choice => choice.admissionUnitId === target.admissionUnitId);
      const reason = payload.data.scores.basis === 'raw' ? 'RAW_SCOREBOARD_NOT_RELEASED' : mode === 'pending' ? 'DATA_RELEASE_NOT_READY' : mode === 'missing-table' ? 'SCORE_LOOKUP_NOT_FOUND' : null;
      if (reason) Object.assign(row, { status: 'unavailable', reasonCodes: [reason], convertedScore: null, maximumScore: null });
      if (control.possibilityMode !== 'legacy') {
        row.possibility = { contractVersion: 'cut-reference-public-v1', policyVersion: 'cut-reference-possibility-1.0.0', basis: 'cut_reference_heuristic',
          status: 'unavailable', validationState: 'not_available', index: null, riskBand: null, probability: null, empiricallyCalibrated: false,
          dataReleaseId: null, admissionUnitId: null, publicationId: null, publicationDigest: null, referenceDigest: null,
          sourceYear: null, targetYear: null, validatedAt: null,
          reasonCodes: [row.status !== 'available' ? 'CUT_REFERENCE_CONVERSION_UNAVAILABLE' : control.possibilityMode === 'range' ? 'CUT_REFERENCE_CONTEXT_MISMATCH' : 'CUT_REFERENCE_REVIEW_REQUIRED'] };
        if (row.status === 'available' && ['ready', 'invalid', 'mismatch'].includes(control.possibilityMode)) Object.assign(row.possibility, {
          status: 'available', index: { points: control.indexPoints }, riskBand: control.riskBand, reasonCodes: [],
          publicationId: 'CUT_RELEASE_BROWSER_TEST', publicationDigest: `sha256:${'c'.repeat(64)}`, referenceDigest: `sha256:${'d'.repeat(64)}`,
          sourceYear: 2026, targetYear: 2027, validatedAt: '2026-11-01T00:00:00.000Z',
          validationState: control.possibilityMode === 'invalid' ? 'failed' : 'passed', dataReleaseId: release.dataReleaseId,
          admissionUnitId: control.possibilityMode === 'mismatch' ? 'UNIT_OTHER_MAJOR' : row.selected.admissionUnitId
        });
      } else row.forecast = { status: 'available', probability: { percent: 99, qualifier: 'approximate' }, riskBand: 'stable' };
      if (control.referenceMode) {
        const legacy = control.referenceMode === 'prior', one = control.referenceMode === 'single70';
        row.referenceComparison = { contractVersion: 'reviewed-admission-reference-v1', status: legacy ? 'prior_data_two_estimates' : one ? 'historical70_only' : 'current_two_references',
          recordId: 'U_0123456789abcdef', school: target.university, major: target.major, originalMajor: target.major,
          bundleDigest: `sha256:${'e'.repeat(64)}`, targetYear: 2027, referenceYear: legacy ? null : control.referenceMode === 'supplement' ? 2025 : 2026,
          convertedScore: 250, passReference: one ? null : 240, registered70Reference: 260, referenceIndex: one ? null : 50,
          referenceBounds: legacy || one ? null : { pass: { low: 239, high: 241 }, registered70: { low: 259, high: 261 }, kind: 'cut_assumption_range' },
          indexRange: legacy || one ? null : { low: 49, high: 51, kind: 'cut_assumption_range' }, sourceIds: ['SOURCE_BROWSER_TEST'],
          historical70: legacy || one ? null : { year: control.referenceMode === 'supplement' ? 2025 : 2026, score: 260.2 },
          publicationReady: false, personalEligibilityApproved: false, probability: control.referenceMode === 'corrupt' ? .99 : null, empiricallyCalibrated: false, reasonCodes: [] };
      }
      return row;
    }) };
}

test('미검수 범위는 보류하고 공표 70% 컷과 해당 학년도를 구분한다', async ({ page }, testInfo) => {
  const control = await setup(page); control.conversionMode = 'pending'; control.referenceMode = 'current';
  await page.goto(path); await prepareConversion(page);
  const query = page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }), section = page.getByRole('region', { name: '자료 기준별 참고 비교' });
  await query.click(); await expect(section.locator('.jcalc-reference-score strong')).toHaveText('250.00점');
  await expect(section.getByText('예상 합격 컷', { exact: true })).toBeVisible(); await expect(section).toContainText('산출 보류');
  await expect(section).toContainText('2026학년도 최종등록자 70% 컷'); await expect(section).toContainText('260.2점');
  await expect(section).not.toContainText('239.00~241.00점'); await expect(section).not.toContainText('259.00~261.00점');
  await expect(section.locator('details')).not.toHaveAttribute('open'); await showCautions(section);
  await expect(section.getByText(/지원 단계는 실제 합격 확률이 아닙니다/)).toBeVisible(); await fits(page);
  await page.screenshot({ path: testInfo.outputPath('reviewed-reference.png'), fullPage: true });
  control.referenceMode = 'prior'; await query.click(); await expect(section).toContainText('기존 산식 환산점수'); await expect(section).toContainText('산출 보류'); await expect(section).not.toContainText('최종등록자 70% 컷');
  control.referenceMode = 'supplement'; await query.click(); await expect(section).toContainText('2025학년도 최종등록자 70% 컷');
  control.referenceMode = 'single70'; await query.click(); await expect(section.getByRole('definition').first()).toHaveText('산출 보류'); await expect(section).toContainText('260점'); await expect(section.getByRole('status')).toHaveCount(0);
  control.referenceMode = 'corrupt'; await query.click(); await expect(section).toContainText('비교 보류'); await expect(section).not.toContainText('250.00점');
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('129'); await expect(section).toHaveCount(0);
});

async function showCautions(scope) {
  const details = scope.locator('details.jcalc-cautions').first();
  if (await details.getAttribute('open') === null) await details.locator('summary').first().click();
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.body.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function fillScores(page, basis = 'official') {
  await expect(page.getByRole('combobox', { name: '국어 선택과목', exact: true })).toBeVisible();
  if (basis === 'raw') {
    const switchToRaw = page.getByRole('button', { name: '가채점 성적으로 새로 입력', exact: true });
    if (await switchToRaw.count()) { page.once('dialog', dialog => dialog.accept()); await switchToRaw.click(); }
    await expect(page.getByRole('heading', { name: '2027학년도 수능 가채점 성적', exact: true })).toBeVisible();
  }
  for (const [title, subject] of [['국어', '언어와매체'], ['수학', '미적분'], ['탐구 1', '사회·문화'], ['탐구 2', '생활과 윤리']]) {
    await page.getByRole('combobox', { name: `${title} 선택과목`, exact: true }).selectOption(subject);
    if (basis === 'official') {
      await page.getByRole('textbox', { name: `${title} 표준점수`, exact: true }).fill(title.startsWith('탐구') ? '65' : '130');
      await page.getByRole('textbox', { name: `${title} 백분위`, exact: true }).fill('95');
      await page.getByRole('combobox', { name: `${title} 등급`, exact: true }).selectOption('2');
    } else if (title.startsWith('탐구')) {
      await page.getByRole('textbox', { name: `${title} 원점수`, exact: true }).fill('40');
    } else {
      await page.getByRole('textbox', { name: `${title} 공통 원점수`, exact: true }).fill('60');
      await page.getByRole('textbox', { name: `${title} 선택 원점수`, exact: true }).fill('20');
    }
  }
  await page.getByRole('combobox', { name: '영어 등급', exact: true }).selectOption('2');
  await page.getByRole('combobox', { name: '한국사 등급', exact: true }).selectOption('1');
}

async function selectGlobal(page) {
  await page.getByRole('searchbox', { name: '대학명 검색', exact: true }).fill('한국외대 글로벌');
  await page.getByRole('button', { name: /한국외국어대학교\(글로벌\)/ }).click();
  await expect(page.getByRole('heading', { name: '한국외국어대학교(글로벌)', exact: true })).toBeVisible();
}

test('비로그인 진입은 코드 요구 없이 로그인 복귀를 안내하고 보호 API를 호출하지 않는다', async ({ page }) => {
  const control = await setup(page, { signedIn: false });
  await page.goto('/2027-jungsi-consulting#calculator');
  await expect(page.getByRole('tab', { name: '합격 계산기', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('link', { name: '계산기 신청하기', exact: true })).toHaveAttribute('href', '#application');
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(path + '$'));
  await expect(page.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
  await expect(page.getByRole('link', { name: '로그인하고 시작하기' })).toHaveAttribute('href', `/login?returnUrl=${encodeURIComponent(path)}`);
  await expect(page.locator('form')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
  expect(control.calls).toHaveLength(0);
});

test('공식 성적 확인·후보 검색·수정 상태·새로고침은 기존 성적에 쓰지 않는다', async ({ page, context, baseURL }) => {
  const control = await setup(page);
  await context.addCookies([{ name: 'synthetic-cookie-session', value: 'active', url: baseURL, httpOnly: true }]);
  await page.goto(path);
  await page.getByRole('combobox', { name: '국어 선택과목', exact: true }).selectOption('');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '국어 선택과목', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await fillScores(page);
  await page.getByRole('combobox', { name: '제2외국어·한문 응시 과목' }).selectOption('일본어Ⅰ');
  await page.getByRole('combobox', { name: '제2외국어·한문 등급' }).selectOption('3');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await expect(page.getByText('입력한 성적을 확인했습니다.', { exact: true })).toBeVisible();
  await selectGlobal(page);
  await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('컴퓨터');
  await page.getByRole('button', { name: '컴퓨터공학부 후보에 추가', exact: true }).click();
  await expect(page.getByRole('heading', { name: '지원 후보 1 / 6' })).toBeVisible();
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('129');
  await expect(page.getByText('성적이 바뀌었어요. 입력 성적을 다시 확인해주세요.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('130');
  await expect(page.getByRole('combobox', { name: '제2외국어·한문 등급' })).toHaveValue('3');
  await expect(page.getByRole('heading', { name: '지원 후보 1 / 6' })).toBeVisible();
  await expect(page.getByText('검수 완료 자료에 한해 환산합니다.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('DEV 테스트', { exact: true })).toBeVisible();
  expect(control.calls.every(call => ['get_univ_list_only', 'get_calculator_access'].includes(call.type))).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => /calculator|quantitative/i.test(key)))).toEqual([]);
});

test('가채점은 원점수에서 예상 성적을 표시하고 원래 입력만 초안에 보관한다', async ({ page }) => {
  await setup(page); await page.goto(path);
  await fillScores(page, 'raw');
  await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('77');
  await expect(page.getByRole('button', { name: '입력 성적 확인', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '국어 공통 원점수', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('60');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await expect(page.getByText('가채점 원점수 기준 · 성적 입력 확인 완료', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /표준점수|백분위/ })).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sc_jungsi_calculator_v1:calculator-student-A')));
  expect(saved.confirmed.exam.kor).toEqual({ opt: '언어와매체', common: 60, elective: 20, raw: 80 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '2027학년도 수능 가채점 성적', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '국어 공통 원점수', exact: true })).toHaveValue('60');
});

test('검색은 캠퍼스·학과를 구분하고 더 보기와 최대6개 후보·삭제를 제공한다', async ({ page }) => {
  await setup(page); await page.goto(path);
  await expect(page.getByRole('list', { name: '대학 검색 결과' }).locator('li')).toHaveCount(12);
  await page.getByRole('button', { name: '대학 더 보기', exact: true }).click();
  await expect(page.getByRole('list', { name: '대학 검색 결과' }).locator('li')).toHaveCount(17);
  await selectGlobal(page);
  await page.getByRole('button', { name: '학과 더 보기', exact: true }).click();
  await expect(page.getByRole('list', { name: '학과 검색 결과' }).locator('li')).toHaveCount(18);
  for (let index = 0; index < 6; index++) {
    await page.getByRole('list', { name: '학과 검색 결과' }).getByRole('button', { name: /후보에 추가$/ }).first().click();
  }
  await expect(page.getByRole('heading', { name: '지원 후보 6 / 6' })).toBeVisible();
  await expect(page.getByRole('list', { name: '학과 검색 결과' }).getByRole('button', { name: /후보에 추가$/ }).first()).toBeDisabled();
  await page.getByRole('button', { name: /후보 삭제$/ }).first().click();
  await expect(page.getByRole('heading', { name: '지원 후보 5 / 6' })).toBeVisible();
  await page.getByRole('button', { name: '대학 변경', exact: true }).click();
  await page.getByRole('searchbox', { name: '대학명 검색', exact: true }).fill('한국외대 서울');
  await expect(page.getByRole('list', { name: '대학 검색 결과' }).locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: /한국외국어대학교\(서울\)/ }).click();
  await expect(page.getByRole('heading', { name: '한국외국어대학교(서울)', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('없는학과');
  await expect(page.getByText('일치하는 학과가 없습니다. 검색어를 바꿔보세요.')).toBeVisible();
});

test('목록 로딩·실패·빈 응답은 명확하게 재시도하고 기존 입력을 보존한다', async ({ page }) => {
  const control = await setup(page); control.mode = 'defer';
  await page.goto(path);
  await expect(page.getByText('대학·학과 목록을 불러오고 있습니다.')).toBeVisible();
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('130');
  await expect.poll(() => Boolean(control.release)).toBe(true);
  control.mode = 'error'; control.release();
  await expect(page.getByRole('button', { name: '목록 다시 불러오기' })).toBeVisible();
  control.mode = 'empty';
  await page.getByRole('button', { name: '목록 다시 불러오기' }).click();
  await expect(page.getByRole('alert')).toContainText('목록이 비어 있습니다.');
  control.mode = 'ready';
  await page.getByRole('button', { name: '목록 다시 불러오기' }).click();
  await expect(page.getByRole('searchbox', { name: '대학명 검색' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('130');
});

test('로그아웃·다른 계정·늦은 목록 응답은 이전 학생 성적과 후보를 복원하지 않는다', async ({ page }) => {
  const control = await setup(page); await page.goto(path);
  await fillScores(page); await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await selectGlobal(page);
  await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('컴퓨터');
  await page.getByRole('button', { name: '컴퓨터공학부 후보에 추가', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('userId', 'calculator-student-B');
    dispatchEvent(new StorageEvent('storage', { key: 'userId' }));
  });
  await expect(page.getByRole('textbox', { name: '국어 공통 원점수', exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: '지원 후보 0 / 6' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('sc_jungsi_calculator_v1:calculator-student-A'))).toBeNull();
  control.mode = 'defer'; await page.reload();
  await expect.poll(() => Boolean(control.release)).toBe(true);
  await page.evaluate(() => clearClientSession());
  await expect(page.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
  control.mode = 'ready'; control.release();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
});

test('전용 화면은 여섯 화면 크기에서 실제 폰트와 문서 스크롤·선택한 대학을 유지한다', async ({ page }, testInfo) => {
  const control = await setup(page); control.possibilityMode = 'ready';
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    const title = page.getByRole('heading', { name: '합격 계산기', exact: true });
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('font-family', /^"?Paperlogy"?(?:,|$)/);
    const loadedPaperlogy = await title.evaluate(async heading => {
      const { fontWeight, fontSize } = getComputedStyle(heading);
      const faces = await document.fonts.load(`${fontWeight} ${fontSize} "Paperlogy"`, heading.textContent);
      return faces.some(face => face.family === 'Paperlogy' && face.status === 'loaded');
    });
    expect(loadedPaperlogy, `Paperlogy loads with the heading at ${width}px`).toBe(true);
    await fits(page);
    await selectGlobal(page);
    await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('컴퓨터');
    await page.getByRole('button', { name: '컴퓨터공학부 후보에 추가', exact: true }).click();
    await fillScores(page);
    await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
    await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
    await expect(page.locator('.jcalc-score > strong')).toHaveText('743.12점');
    await fits(page);
    await page.locator('.jcalc-footer').scrollIntoViewIfNeeded();
    await expect(page.locator('.jcalc-footer')).toBeInViewport();
    if ([320, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`jungsi-calculator-${width}.png`), fullPage: true });
    await page.evaluate(() => sessionStorage.removeItem('sc_jungsi_calculator_v1:calculator-student-A'));
  }
});

async function prepareConversion(page) {
  await fillScores(page); await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await selectGlobal(page);
  await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('컴퓨터');
  await page.getByRole('button', { name: '컴퓨터공학부 후보에 추가', exact: true }).click();
}

test('인증 완료 계정은 이용 기한과 계산기를 바로 보고 신청·재인증 확인을 요구받지 않는다', async ({ page }, testInfo) => {
  const control = await setup(page); await page.goto(path);
  await expect(page.getByRole('heading', { name: '합격 계산기', exact: true })).toBeVisible();
  const status = page.getByRole('region', { name: '계산기 이용 상태' });
  await expect(status).toContainText('2027. 1. 7.'); await expect(status).toContainText('까지 이용 가능');
  await expect(page.getByRole('region', { name: '나의 계산기 신청' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(신청 상태 다시 확인|이용 상태 다시 확인)$/ })).toHaveCount(0);
  await expect(page.getByText('입금 승인과 이용 인증이 필요합니다.', { exact: true })).toHaveCount(0);
  await prepareConversion(page); await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score > strong')).toHaveText('743.12점');
  expect(control.coreCalls.filter(call => call.type === 'student_get_calculator_applications')).toHaveLength(0);
  expect(control.coreCalls.filter(call => call.type === 'student_get_calculator_input')).toHaveLength(1);
  await page.setViewportSize({ width: 375, height: 900 }); await fits(page);
  await page.screenshot({ path: testInfo.outputPath('calculator-active-workspace.png'), fullPage: true });
});

test('DEV 원점수는 추정 변환 기준과 실제 반환 점수를 표시하고 수정 후 재계산한다', async ({ page }) => {
  const control = await setup(page); control.conversionMode = 'raw-preview'; await page.goto(path);
  await fillScores(page, 'raw');
  for (const [title, common, elective] of [['국어', '60', '20'], ['수학', '60', '14']]) {
    await page.getByRole('textbox', { name: `${title} 공통 원점수`, exact: true }).fill(common);
    await page.getByRole('textbox', { name: `${title} 선택 원점수`, exact: true }).fill(elective);
  }
  for (const title of ['탐구 1', '탐구 2']) await page.getByRole('textbox', { name: `${title} 원점수`, exact: true }).fill('44');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click(); await selectGlobal(page);
  await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('컴퓨터'); await page.getByRole('button', { name: '컴퓨터공학부 후보에 추가', exact: true }).click();
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByText('2027학년도 수능 추정표로 원점수를 변환해 계산했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: '자료 기준별 참고 비교' })).toContainText('710.25점');
  const first = control.calls.find(call => call.type === 'get_calculator_conversion');
  expect(first.data.scores.basis).toBe('raw'); expect(first.data.scores.exam.kor).toEqual({ opt: '언어와매체', common: 60, elective: 20, raw: 80 });
  await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('59');
  await expect(page.locator('.jcalc-forecast-badge')).toHaveCount(0);
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click(); await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByRole('region', { name: '자료 기준별 참고 비교' })).toContainText('709.25점');
});

test('환산 결과는 실제 점수·기준 만점·캠퍼스·전형·군·버전을 표시하고 수정·새로고침 후 재조회한다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score > strong')).toHaveText('743.12점');
  await expect(page.getByText(/기준 만점 1,000.00점/)).toBeVisible();
  await expect(page.locator('.jcalc-result-context')).toContainText('수능 일반전형 · 나군');
  await page.getByText('적용한 자료 버전', { exact: true }).click();
  await expect(page.getByText(/ADMISSION_RELEASE_2027_BROWSER_TEST/)).toBeVisible();
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('129');
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score')).toHaveCount(1);
  const calls = control.calls.filter(call => call.type === 'get_calculator_conversion');
  expect(calls).toHaveLength(2); expect(calls[1].data.scores.exam.kor.std).toBe(129);
  await page.reload();
  await expect(page.getByRole('heading', { name: '지원 후보 1 / 6' })).toBeVisible();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
});

test('만점 없는 점수축은 명시된 응답만 표시하고 만점 누락·알 수 없는 척도는 거부한다', async ({ page }) => {
  const control = await setup(page); control.conversionMode = 'raw-points';
  await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score > strong')).toHaveText('743.12점');
  await expect(page.getByText('별도 기준 만점이 없는 점수입니다.', { exact: true })).toBeVisible();
  await expect(page.getByText(/기준 만점 1,000.00점/)).toHaveCount(0);
  for (const mode of ['missing-maximum', 'unknown-scale']) {
    control.conversionMode = mode;
    await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
    await expect(page.locator('.jcalc-score')).toHaveCount(0);
    await expect(page.getByText('환산 결과를 확인하지 못했습니다. 다시 조회해주세요.', { exact: true })).toBeVisible();
  }
});

test('복수 전형은 임의 계산하지 않고 전형·모집군을 고른 뒤 조회한다', async ({ page }) => {
  const control = await setup(page); control.conversionMode = 'choice';
  await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByText('캠퍼스·전형·모집군을 선택한 뒤 다시 조회해주세요.', { exact: true })).toBeVisible();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await page.getByRole('combobox', { name: /컴퓨터공학부 전형 선택$/ }).selectOption('UNIT_BROWSER_SECOND');
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.locator('.jcalc-result-context')).toContainText('다군');
  expect(control.calls.at(-1).data.targets[0].admissionUnitId).toBe('UNIT_BROWSER_SECOND');
});

test('수능 성분과 미공표 소수점 정책은 최종 총점과 구분해 표시한다', async ({ page }) => {
  const control = await setup(page); control.conversionMode = 'component';
  await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByText('예상 환산점수', { exact: true })).toBeVisible(); await showCautions(page);
  await expect(page.getByText('수능 반영 점수입니다. 학생부·면접·실기 점수는 별도입니다.', { exact: true })).toBeVisible();
  control.conversionMode = 'component-exact';
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByText('공개 수능식의 계산값입니다.', { exact: false })).toBeAttached();
  await showCautions(page);
  await expect(page.getByText('공개 수능식의 계산값입니다. 최종 소수점 처리와 학생부·면접·실기 반영은 별도 확인이 필요합니다.', { exact: true })).toBeVisible();
  control.conversionMode = 'component-unknown';
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await expect(page.getByText('환산 결과를 확인하지 못했습니다. 다시 조회해주세요.', { exact: true })).toBeVisible();
});

test('승인 대기·변환표 누락·가채점·권한 부족은 가짜 숫자 없이 이유를 안내한다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  for (const [mode, message] of [['pending', '운영 승인을 기다리고'], ['missing-table', '등급표 또는 탐구 변환표'], ['denied', '나의 계산기 신청']]) {
    control.conversionMode = mode;
    await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
    await expect(page.getByText(new RegExp(message))).toBeVisible();
    await expect(page.locator('.jcalc-score')).toHaveCount(0);
  }
  control.conversionMode = 'ready';
  await refreshAccess(page);
  await expect(page.getByRole('region', { name: '계산기 이용 상태' })).toContainText('이용 가능');
  await fillScores(page, 'raw'); await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByText(/가채점 변환 자료가 아직 없습니다/)).toBeVisible();
  expect(control.calls.at(-1).data.scores.exam.kor.std).toBeUndefined();
});

test('서버 실패·잘못된 연도 응답은 입력을 보존하고 재조회할 수 있다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  for (const mode of ['error', 'invalid']) {
    control.conversionMode = mode;
    await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('.jcalc-score')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('130');
  }
  control.conversionMode = 'ready'; await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score')).toHaveCount(1);
});

test('진행 중 성적 수정·계정 변경은 늦은 환산 응답을 버린다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  control.possibilityMode = 'ready';
  control.conversionMode = 'defer';
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect.poll(() => Boolean(control.conversionRelease)).toBe(true);
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('128');
  control.conversionMode = 'ready'; control.conversionRelease();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await expect(page.locator('.jcalc-forecast-badge')).toHaveCount(0);
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  control.conversionRelease = null; control.conversionMode = 'defer';
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect.poll(() => Boolean(control.conversionRelease)).toBe(true);
  await page.evaluate(() => { localStorage.setItem('userId', 'calculator-student-C'); dispatchEvent(new StorageEvent('storage', { key: 'userId' })); });
  control.conversionMode = 'ready'; control.conversionRelease();
  await expect(page.getByRole('heading', { name: '지원 후보 0 / 6' })).toHaveCount(0);
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await expect(page.locator('.jcalc-forecast-badge')).toHaveCount(0);
});

test('5단계는 서버 분류의 색상 배지로 표시하고 숫자 지수나 합격률은 노출하지 않는다', async ({ page }) => {
  const control = await setup(page); control.possibilityMode = 'ready'; await page.goto(path); await prepareConversion(page);
  for (const [riskBand, points, label] of [['stable', 82, '안정'], ['appropriate', 70, '적정'], ['neutral', 50, '소신'], ['challenge', 30, '상향'], ['risky', 15, '위험']]) {
    control.riskBand = riskBand; control.indexPoints = points;
    await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
    const badge = page.getByLabel(`지원 단계: ${label}`, { exact: true }); await expect(badge).toHaveAttribute('data-risk', riskBand);
    await expect(page.locator('.jcalc-result')).not.toContainText('/ 100'); await showCautions(page);
    await expect(page.getByText(/지원 단계는 실제 합격률이 아닙니다/)).toBeVisible(); await expect(page.getByText(/CUT_RELEASE_BROWSER_TEST/)).toBeVisible();
  }
  const draft = await page.evaluate(() => sessionStorage.getItem('sc_jungsi_calculator_v1:calculator-student-A'));
  for (const key of ['probability', 'forecast', 'possibility']) expect(draft).not.toContain(key);
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('129'); await expect(page.locator('.jcalc-forecast-badge')).toHaveCount(0);
});

test('미검수·다른 단위·손상·구 확률 응답은 점수만 유지하고 판단 대기와 사유를 보여준다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  for (const [mode, message] of [
    ['pending', '입결 근거를 검수'],
    ['range', '환산점수와 컷의 반영 기준을 확인'],
    ['invalid', '결과를 확인하지 못했습니다. 다시 조회'],
    ['mismatch', '결과를 확인하지 못했습니다. 다시 조회'],
    ['legacy', '환산점수만 제공됩니다. 지원 단계 조회를 준비']
  ]) {
    control.possibilityMode = mode; await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click(); await showCautions(page);
    await expect(page.locator('.jcalc-cautions').first()).toContainText(message); await expect(page.locator('.jcalc-score > strong')).toHaveText('743.12점');
    await expect(page.getByLabel('지원 단계: 판단 대기', { exact: true })).toBeVisible(); await expect(page.locator('.jcalc-result')).not.toContainText('/ 100');
  }
});

test('범위 밖 지수는 배지를 만들지 않고 정상 양끝도 숫자 없이 표시하며 새로고침 후 숨긴다', async ({ page }) => {
  const control = await setup(page); control.possibilityMode = 'ready'; await page.goto(path); await prepareConversion(page);
  for (const [points, riskBand] of [[1, 'risky'], [99, 'stable'], [0, 'risky'], [100, 'stable'], [80.5, 'stable']]) {
    control.indexPoints = points; control.riskBand = riskBand; await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
    await expect(page.locator('.jcalc-forecast-badge')).toHaveAttribute('data-risk', Number.isInteger(points) && points >= 1 && points <= 99 ? riskBand : 'unavailable');
    await expect(page.locator('.jcalc-result')).not.toContainText('/ 100'); await expect(page.locator('.jcalc-result')).not.toContainText('%');
  }
  await page.reload(); await expect(page.getByRole('heading', { name: '지원 후보 1 / 6' })).toBeVisible(); await expect(page.locator('.jcalc-forecast-badge')).toHaveCount(0);
});

test.describe('합격 계산기 공개 일정', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test('DEV 조기 이용권은 공개 전 조회를 허용하고 재확인에서 예외가 없어지면 즉시 닫는다', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-20T03:00:00.000Z'));
    const control = await setup(page); control.earlyAccess = true;
    await page.goto(path);
    await prepareConversion(page);
    const calculate = page.getByRole('button', { name: '환산점수·가능성 조회', exact: true });
    const notice = page.getByRole('note', { name: '합격 계산기 공개 일정' });
    await expect(notice).toHaveCount(0);
    await expect(calculate).toBeEnabled();
    await calculate.click();
    await expect(page.locator('.jcalc-score strong')).toContainText('743.12');
    expect(control.calls.filter(call => call.type === 'get_calculator_conversion')).toHaveLength(1);
    control.earlyAccess = false;
    await refreshAccess(page);
    await expect(calculate).toBeDisabled();
    await expect(notice).toContainText('정식 공개 후');
    await expect(page.locator('.jcalc-score')).toHaveCount(0);
    control.earlyAccess = true; control.accessAllowed = false;
    await refreshAccess(page);
    await expect(page.getByRole('heading', { name: '나의 계산기 신청' })).toBeVisible();
    await expect(calculate).toHaveCount(0);
    expect(control.calls.filter(call => call.type === 'get_calculator_conversion')).toHaveLength(1);
  });
  test('확인된 이용권은 날짜가 지나도 서버 공개 승인 전에는 닫혀 있고 공개 후 조회를 연다', async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-11-27T14:59:59.000Z'));
    const control = await setup(page); control.accessSource = 'purchase'; control.calculationEnabled = false;
    await page.goto(path);
    const notice = page.getByRole('note', { name: '합격 계산기 공개 일정' });
    await expect(page.getByRole('region', { name: '계산기 이용 상태' })).toContainText('이용 가능');
    await expect(notice).toContainText('정식 공개 후');
    await prepareConversion(page); await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('calculator-opening-notice.png') });
    control.accessAllowed = false;
    await refreshAccess(page);
    await expect(page.getByRole('heading', { name: '나의 계산기 신청' })).toBeVisible();
    await expect(notice).toHaveCount(0);
    control.accessAllowed = true;
    await page.clock.setFixedTime(new Date('2026-11-27T15:01:00.000Z'));
    await refreshAccess(page);
    await expect(page.getByRole('region', { name: '계산기 이용 상태' })).toContainText('이용 가능');
    await expect(notice).toBeVisible();
    await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toBeDisabled();
    control.calculationEnabled = true; control.calculationMode = 'published'; control.earlyAccess = false; await refreshAccess(page);
    await expect(page.getByText('검수 완료 자료에 한해 환산합니다.', { exact: true })).toBeVisible();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toBeEnabled();
    expect(control.calls.every(call => ['get_univ_list_only', 'get_calculator_access'].includes(call.type))).toBe(true);
  });
});

test('이용 상태 확인 전에는 입력·검색을 열지 않고 확인 후 작업 화면을 표시한다', async ({ page }) => {
  const control = await setup(page); control.accessMode = 'defer'; await page.goto(path);
  await expect(page.getByRole('region', { name: '계산기 이용 상태' }).getByText('이용 정보를 확인하고 있습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveCount(0);
  expect(control.calls.filter(x => x.type === 'get_univ_list_only')).toHaveLength(0);
  await expect.poll(() => Boolean(control.accessRelease)).toBe(true); control.accessMode = 'ready'; control.accessRelease();
  await prepareConversion(page); await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toBeEnabled();
});

test('이용권 없음·조회 실패·손상 응답은 입력 화면을 열지 않고 수동 재확인으로 복구한다', async ({ page }) => {
  const control = await setup(page); control.accessAllowed = false; await page.goto(path);
  await expect(page.getByRole('heading', { name: '나의 계산기 신청' })).toBeVisible();
  for (const mode of ['error', 'invalid']) {
    control.accessMode = mode; await refreshAccess(page);
    await expect(page.getByRole('heading', { name: '이용 정보를 확인하지 못했습니다.' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveCount(0);
    expect(control.calls.filter(x => x.type === 'get_univ_list_only')).toHaveLength(0);
  }
  control.accessMode = 'ready'; control.accessAllowed = true; await refreshAccess(page);
  await prepareConversion(page); await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toBeEnabled();
  expect(control.calls.every(call => ['get_univ_list_only', 'get_calculator_access'].includes(call.type))).toBe(true);
});

test('권한 재확인·실제 조회 중 권한 변경은 이전 수치를 숨기고 자동 재시도하지 않는다', async ({ page }) => {
  const control = await setup(page); control.possibilityMode = 'ready'; await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByLabel('지원 단계: 안정', { exact: true })).toBeVisible();
  control.accessAllowed = false;
  await refreshAccess(page);
  await expect(page.getByRole('heading', { name: '나의 계산기 신청' })).toBeVisible();
  await expect(page.locator('.jcalc-score, .jcalc-forecast-badge')).toHaveCount(0);
  control.accessAllowed = true;
  await refreshAccess(page);
  await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toBeEnabled();
  control.conversionMode = 'denied';
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByRole('heading', { name: '나의 계산기 신청' })).toBeVisible();
  await expect(page.locator('.jcalc-score, .jcalc-forecast-badge')).toHaveCount(0);
  expect(control.calls.filter(call => call.type === 'get_calculator_conversion')).toHaveLength(2);
});

test('중복 클릭과 이용 상태의 늦은 응답은 조회를 반복하거나 다른 계정 권한을 복구하지 않는다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page); control.conversionMode = 'defer';
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).dblclick();
  await expect.poll(() => Boolean(control.conversionRelease)).toBe(true);
  expect(control.calls.filter(call => call.type === 'get_calculator_conversion')).toHaveLength(1);
  control.conversionMode = 'ready'; control.conversionRelease();
  await expect(page.locator('.jcalc-score')).toHaveCount(1);
  control.accessMode = 'defer';
  await refreshAccess(page);
  await expect.poll(() => Boolean(control.accessRelease)).toBe(true);
  await page.evaluate(() => clearClientSession());
  await expect(page.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
  control.accessMode = 'ready'; control.accessRelease();
  await expect(page.locator('.jcalc-score, .jcalc-forecast-badge')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '환산점수·가능성 조회', exact: true })).toHaveCount(0);
});

test('다른 탭에서 돌아오면 기존 화면을 유지하면서 이용 상태를 한 번만 재확인한다', async ({ page }) => {
  const control = await setup(page); control.possibilityMode = 'ready'; await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·가능성 조회', exact: true }).click();
  await expect(page.getByLabel('지원 단계: 안정', { exact: true })).toBeVisible();
  const mainFrame = page.mainFrame(), navigations = [];
  page.on('framenavigated', frame => { if (frame === mainFrame) navigations.push(frame.url()); });
  await page.clock.install({ time: new Date('2026-11-28T00:00:00+09:00') }); await page.clock.fastForward(31_000);
  control.accessAllowed = false; control.accessMode = 'defer';
  await page.evaluate(() => { dispatchEvent(new Event('focus')); dispatchEvent(new Event('focus')); dispatchEvent(new Event('focus')); });
  await expect.poll(() => Boolean(control.accessRelease)).toBe(true);
  await expect(page.getByLabel('지원 단계: 안정', { exact: true })).toBeVisible();
  expect(control.calls.filter(call => call.type === 'get_calculator_conversion')).toHaveLength(1);
  expect(navigations).toEqual([]);
  control.accessMode = 'ready'; control.accessRelease();
  await expect(page.getByRole('heading', { name: '나의 계산기 신청' })).toBeVisible();
  await expect(page.locator('.jcalc-score, .jcalc-forecast-badge')).toHaveCount(0);
  expect(control.calls.filter(call => call.type === 'get_calculator_access')).toHaveLength(2);
});

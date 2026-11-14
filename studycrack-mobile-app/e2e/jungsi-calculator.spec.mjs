import { expect, test } from '@playwright/test';

const path = '/2027-jungsi-consulting/calculator';
const catalog = [
  { univName: '한국외국어대학교(서울)', majors: ['경영학부', '경제학부'] },
  { univName: '한국외국어대학교(글로벌)', majors: ['경영학과', '컴퓨터공학부', ...Array.from({ length: 16 }, (_, index) => `가상학과${index + 1}`)] },
  ...Array.from({ length: 15 }, (_, index) => ({ univName: `가상대학교${index + 1}`, majors: ['예시학과'] }))
];

async function setup(page, { signedIn = true } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const control = { calls: [], mode: 'ready', release: null, conversionMode: 'ready', conversionRelease: null, forecastMode: 'pending', riskBand: 'stable', probabilityPercent: 82, probabilityQualifier: 'approximate', accessMode: 'ready', accessAllowed: true, accessSource: 'membership', accessRelease: null };
  await page.addInitScript(({ signedIn }) => {
    if (signedIn && !localStorage.getItem('userId') && localStorage.getItem('sc_session_ended') !== '1') {
      localStorage.setItem('userId', 'calculator-student-A');
      localStorage.setItem('userRole', 'student');
    }
  }, { signedIn });
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL=false;window.CONFIG={api:{analysis:'/__calculator-analysis',consultingPublic:'/__calculator-public',auth:'/__calculator-auth'}};` }));
  await page.route('**/__calculator-public', route => route.fulfill({ json: { success: true, data: { campaignSlug: '2027-jungsi-consulting', admissionYear: 2027, enrollmentStatus: 'unavailable', price: null } } }));
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
        return await route.fulfill({ json: { success: true, contractVersion: 'jungsi-calculator-access-v1', admissionYear: 2027,
          access: { allowed: control.accessAllowed, source: control.accessAllowed ? control.accessSource : 'none' },
          service: { state: 'preparing', purchaseAvailable: control.accessMode === 'invalid' } } });
      } catch (_) { return; }
    }
    if (payload.type === 'get_calculator_conversion') {
      expect(Object.keys(payload).sort()).toEqual(['data', 'type']);
      expect(Object.keys(payload.data).sort()).toEqual(['scores', 'targets']);
      if (control.conversionMode === 'defer') await new Promise(resolve => { control.conversionRelease = resolve; });
      try {
        if (control.conversionMode === 'error') return await route.fulfill({ status: 503, json: { code: 'CALCULATOR_TEMPORARILY_UNAVAILABLE' } });
        if (control.conversionMode === 'denied') return await route.fulfill({ status: 402, json: { code: 'CALCULATOR_ACCESS_REQUIRED' } });
        return await route.fulfill({ json: conversionResponse(payload, control) });
      } catch (_) { return; }
    }
    expect(payload).toEqual({ type: 'get_univ_list_only' });
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
      if (mode === 'choice') row.choices.push({ ...option, admissionUnitId: 'UNIT_BROWSER_SECOND', admissionGroup: 'da' });
      if (mode === 'choice' && !target.admissionUnitId) Object.assign(row, { status: 'choice_required', selected: null, reasonCodes: ['UNIT_SELECTION_REQUIRED'], convertedScore: null, maximumScore: null });
      if (target.admissionUnitId) row.selected = row.choices.find(choice => choice.admissionUnitId === target.admissionUnitId);
      const reason = payload.data.scores.basis === 'raw' ? 'RAW_SCOREBOARD_NOT_RELEASED' : mode === 'pending' ? 'DATA_RELEASE_NOT_READY' : mode === 'missing-table' ? 'SCORE_LOOKUP_NOT_FOUND' : null;
      if (reason) Object.assign(row, { status: 'unavailable', reasonCodes: [reason], convertedScore: null, maximumScore: null });
      if (control.forecastMode !== 'legacy') {
        row.forecast = { status: 'unavailable', probability: null, riskBand: null,
          reasonCodes: [row.status !== 'available' ? 'FORECAST_CONVERSION_NOT_AVAILABLE' : control.forecastMode === 'range' ? 'FORECAST_SCORE_OUTSIDE_VALIDATED_RANGE' : 'FORECAST_PUBLICATION_NOT_APPROVED'],
          policyVersion: 'calculator-forecast-publication-1.0.0', riskPolicyVersion: 'admission-risk-1.0.0' };
        if (row.status === 'available' && ['ready', 'invalid', 'mismatch'].includes(control.forecastMode)) Object.assign(row.forecast, {
          status: 'available', probability: { percent: control.probabilityPercent, qualifier: control.probabilityQualifier }, riskBand: control.riskBand, reasonCodes: [],
          modelVersion: 'probability-1.0.0', publicationId: 'CALCULATOR_FORECAST_2027_BROWSER_TEST', validatedAt: '2026-11-01T00:00:00.000Z',
          validationState: control.forecastMode === 'invalid' ? 'failed' : 'passed', dataReleaseId: release.dataReleaseId,
          admissionUnitId: control.forecastMode === 'mismatch' ? 'UNIT_OTHER_MAJOR' : row.selected.admissionUnitId
        });
      }
      return row;
    }) };
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.body.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function fillScores(page, basis = 'official') {
  await page.getByRole('radio', { name: basis === 'official' ? '성적표 기준' : '가채점 원점수', exact: true }).check();
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
  await page.getByRole('link', { name: '성적 입력·대학 검색', exact: true }).click();
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
  await expect(page.getByText('검수 완료 자료에 한해 환산합니다.', { exact: true })).toBeVisible();
  expect(control.calls.every(call => ['get_univ_list_only', 'get_calculator_access'].includes(call.type))).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => /calculator|quantitative/i.test(key)))).toEqual([]);
});

test('가채점은 공통·선택 원점수와 등급만 받고 변환 값을 만들지 않는다', async ({ page }) => {
  await setup(page); await page.goto(path);
  await fillScores(page, 'raw');
  await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('77');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '국어 공통 원점수', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('textbox', { name: '국어 공통 원점수', exact: true }).fill('60');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await expect(page.getByText('가채점 원점수 기준 · 성적 입력 확인 완료', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /표준점수|백분위/ })).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sc_jungsi_calculator_v1:calculator-student-A')));
  expect(saved.confirmed.exam.kor).toEqual({ opt: '언어와매체', common: 60, elective: 20, raw: 80 });
  await page.reload();
  await expect(page.getByRole('radio', { name: '가채점 원점수', exact: true })).toBeChecked();
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
  await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: '지원 후보 0 / 6' })).toBeVisible();
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
  const control = await setup(page); control.forecastMode = 'ready';
  await page.addInitScript(() => sessionStorage.removeItem('sc_jungsi_calculator_v1:calculator-student-A'));
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => Array.from(document.fonts).some(font => font.family === 'Paperlogy' && font.status === 'loaded'))).toBe(true);
    await fits(page);
    await selectGlobal(page);
    await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('컴퓨터');
    await page.getByRole('button', { name: '컴퓨터공학부 후보에 추가', exact: true }).click();
    await fillScores(page);
    await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
    await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
    await expect(page.locator('.jcalc-score > strong')).toHaveText('743.1256점');
    await fits(page);
    await page.locator('.jcalc-footer').scrollIntoViewIfNeeded();
    await expect(page.locator('.jcalc-footer')).toBeInViewport();
    if ([320, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`jungsi-calculator-${width}.png`), fullPage: true });
  }
});

async function prepareConversion(page) {
  await fillScores(page); await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await selectGlobal(page);
  await page.getByRole('searchbox', { name: '학과명 검색', exact: true }).fill('컴퓨터');
  await page.getByRole('button', { name: '컴퓨터공학부 후보에 추가', exact: true }).click();
}

test('환산 결과는 실제 점수·기준 만점·캠퍼스·전형·군·버전을 표시하고 수정·새로고침 후 재조회한다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score > strong')).toHaveText('743.1256점');
  await expect(page.getByText(/기준 만점 1,000점/)).toBeVisible();
  await expect(page.locator('.jcalc-result-context')).toContainText('수능 일반전형 · 나군');
  await page.getByText('적용한 자료 버전', { exact: true }).click();
  await expect(page.getByText(/ADMISSION_RELEASE_2027_BROWSER_TEST/)).toBeVisible();
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('129');
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score')).toHaveCount(1);
  const calls = control.calls.filter(call => call.type === 'get_calculator_conversion');
  expect(calls).toHaveLength(2); expect(calls[1].data.scores.exam.kor.std).toBe(129);
  await page.reload();
  await expect(page.getByRole('heading', { name: '지원 후보 1 / 6' })).toBeVisible();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
});

test('복수 전형은 임의 계산하지 않고 전형·모집군을 고른 뒤 조회한다', async ({ page }) => {
  const control = await setup(page); control.conversionMode = 'choice';
  await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.getByText('캠퍼스·전형·모집군을 선택한 뒤 다시 조회해주세요.', { exact: true })).toBeVisible();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await page.getByRole('combobox', { name: /컴퓨터공학부 전형 선택$/ }).selectOption('UNIT_BROWSER_SECOND');
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.locator('.jcalc-result-context')).toContainText('다군');
  expect(control.calls.at(-1).data.targets[0].admissionUnitId).toBe('UNIT_BROWSER_SECOND');
});

test('승인 대기·변환표 누락·가채점·권한 부족은 가짜 숫자 없이 이유를 안내한다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  for (const [mode, message] of [['pending', '운영 승인을 기다리고'], ['missing-table', '등급표 또는 탐구 변환표'], ['denied', 'Basic·Starter·Standard·Pro']]) {
    control.conversionMode = mode;
    await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
    await expect(page.getByText(new RegExp(message))).toBeVisible();
    await expect(page.locator('.jcalc-score')).toHaveCount(0);
  }
  control.conversionMode = 'ready';
  await page.getByRole('button', { name: '이용 상태 다시 확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '기존 이용권으로 조회할 수 있습니다.' })).toBeVisible();
  await fillScores(page, 'raw'); await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.getByText(/가채점 변환 자료가 아직 없습니다/)).toBeVisible();
  expect(control.calls.at(-1).data.scores.exam.kor.std).toBeUndefined();
});

test('서버 실패·잘못된 연도 응답은 입력을 보존하고 재조회할 수 있다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  for (const mode of ['error', 'invalid']) {
    control.conversionMode = mode;
    await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('.jcalc-score')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('130');
  }
  control.conversionMode = 'ready'; await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.locator('.jcalc-score')).toHaveCount(1);
});

test('진행 중 성적 수정·계정 변경은 늦은 환산 응답을 버린다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  control.forecastMode = 'ready';
  control.conversionMode = 'defer';
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect.poll(() => Boolean(control.conversionRelease)).toBe(true);
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('128');
  control.conversionMode = 'ready'; control.conversionRelease();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await expect(page.locator('.jcalc-probability')).toHaveCount(0);
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
  control.conversionRelease = null; control.conversionMode = 'defer';
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect.poll(() => Boolean(control.conversionRelease)).toBe(true);
  await page.evaluate(() => { localStorage.setItem('userId', 'calculator-student-C'); dispatchEvent(new StorageEvent('storage', { key: 'userId' })); });
  control.conversionMode = 'ready'; control.conversionRelease();
  await expect(page.getByRole('heading', { name: '지원 후보 0 / 6' })).toBeVisible();
  await expect(page.locator('.jcalc-score')).toHaveCount(0);
  await expect(page.locator('.jcalc-probability')).toHaveCount(0);
});

test('검증된 확률과 다섯 단계는 서버 분류를 표시하고 실제 합격 보장으로 표현하지 않는다', async ({ page }) => {
  const control = await setup(page); control.forecastMode = 'ready'; await page.goto(path); await prepareConversion(page);
  for (const [riskBand, percent, label] of [['stable', 82, '안정'], ['appropriate', 70, '적정'], ['neutral', 50, '중립'], ['challenge', 30, '도전'], ['risky', 15, '위험']]) {
    control.riskBand = riskBand; control.probabilityPercent = percent;
    await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
    await expect(page.locator('.jcalc-probability')).toHaveText(`약 ${percent}%`);
    await expect(page.locator('.jcalc-forecast-badge')).toHaveText(label);
    await expect(page.getByRole('list', { name: '지원 가능성 5단계' }).locator('[aria-current="true"]')).toHaveText(label);
    await expect(page.getByText('입력 성적과 검증된 모델에 따른 추정치입니다. 합격을 보장하지 않습니다.', { exact: true })).toBeVisible();
  }
  await page.getByText('확률 자료 기준', { exact: true }).click();
  await expect(page.getByText(/CALCULATOR_FORECAST_2027_BROWSER_TEST/)).toBeVisible();
  const draft = await page.evaluate(() => sessionStorage.getItem('sc_jungsi_calculator_v1:calculator-student-A'));
  expect(draft).not.toContain('probability'); expect(draft).not.toContain('forecast');
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('129');
  await expect(page.locator('.jcalc-probability')).toHaveCount(0); await expect(page.getByRole('list', { name: '지원 가능성 5단계' })).toHaveCount(0);
});

test('검증 부족·다른 모집단위·손상 응답·구 백엔드는 환산점수를 보존하고 확률과 분류를 비운다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page);
  for (const [mode, message] of [['pending', '공개 검증이 완료되지'], ['range', '검증한 점수 범위를 벗어나'], ['invalid', '확률 결과를 확인하지'], ['mismatch', '확률 결과를 확인하지'], ['legacy', '확률 조회 기능을 준비']]) {
    control.forecastMode = mode;
    await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
    await expect(page.locator('.jcalc-forecast-note')).toContainText(message);
    await expect(page.locator('.jcalc-score > strong')).toHaveText('743.1256점');
    await expect(page.locator('.jcalc-forecast-badge')).toHaveText('판단 보류');
    await expect(page.locator('.jcalc-probability')).toHaveCount(0); await expect(page.getByRole('list', { name: '지원 가능성 5단계' })).toHaveCount(0);
  }
});

test('극단 확률은 0%·100% 대신 부등호 의미로 표시하고 새로고침 뒤 결과를 복원하지 않는다', async ({ page }) => {
  const control = await setup(page); control.forecastMode = 'ready'; await page.goto(path); await prepareConversion(page);
  for (const [percent, qualifier, riskBand, expected] of [[1, 'less_than', 'risky', '1% 미만'], [99, 'more_than', 'stable', '99% 초과']]) {
    control.probabilityPercent = percent; control.probabilityQualifier = qualifier; control.riskBand = riskBand;
    await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
    await expect(page.locator('.jcalc-probability')).toHaveText(expected);
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: '지원 후보 1 / 6' })).toBeVisible();
  await expect(page.locator('.jcalc-probability')).toHaveCount(0); await expect(page.locator('.jcalc-forecast-badge')).toHaveCount(0);
});

test('이용 상태 확인 중에도 입력·검색은 유지되고 결과 조회는 서버 권한 확인 뒤 열린다', async ({ page }) => {
  const control = await setup(page); control.accessMode = 'defer'; await page.goto(path);
  await expect(page.getByRole('heading', { name: '이용 권한을 확인하고 있습니다.' })).toBeVisible();
  await prepareConversion(page);
  await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toBeDisabled();
  await expect.poll(() => Boolean(control.accessRelease)).toBe(true);
  control.accessMode = 'ready'; control.accessRelease();
  await expect(page.getByRole('heading', { name: '기존 이용권으로 조회할 수 있습니다.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toBeEnabled();
  await expect(page.getByText('검수 자료 준비 중', { exact: true })).toBeVisible();
});

test('이용권 없음·확인 실패·손상 응답을 구분하며 결제를 호출하지 않고 입력을 보존한다', async ({ page }) => {
  const control = await setup(page); control.accessAllowed = false; await page.goto(path); await prepareConversion(page);
  await expect(page.getByRole('heading', { name: '조회에는 Basic 이상 이용권이 필요합니다.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: '내 이용권 확인', exact: true })).toHaveAttribute('href', '/mypage');
  for (const mode of ['error', 'invalid']) {
    control.accessMode = mode;
    await page.getByRole('button', { name: '이용 상태 다시 확인', exact: true }).click();
    await expect(page.getByRole('heading', { name: '이용 상태를 다시 확인해주세요.' })).toBeVisible();
    await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('130');
  }
  control.accessMode = 'ready'; control.accessAllowed = true;
  await page.getByRole('button', { name: '이용 상태 다시 확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '기존 이용권으로 조회할 수 있습니다.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toBeEnabled();
  expect(control.calls.every(call => ['get_univ_list_only', 'get_calculator_access'].includes(call.type))).toBe(true);
});

test('권한 재확인·실제 조회 중 권한 변경은 이전 수치를 숨기고 자동 재시도하지 않는다', async ({ page }) => {
  const control = await setup(page); control.forecastMode = 'ready'; await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.locator('.jcalc-probability')).toHaveText('약 82%');
  control.accessAllowed = false;
  await page.getByRole('button', { name: '이용 상태 다시 확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '조회에는 Basic 이상 이용권이 필요합니다.' })).toBeVisible();
  await expect(page.locator('.jcalc-score, .jcalc-probability')).toHaveCount(0);
  control.accessAllowed = true;
  await page.getByRole('button', { name: '이용 상태 다시 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toBeEnabled();
  control.conversionMode = 'denied';
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.getByRole('heading', { name: '조회에는 Basic 이상 이용권이 필요합니다.' })).toBeVisible();
  await expect(page.locator('.jcalc-score, .jcalc-probability')).toHaveCount(0);
  expect(control.calls.filter(call => call.type === 'get_calculator_conversion')).toHaveLength(2);
});

test('중복 클릭과 이용 상태의 늦은 응답은 조회를 반복하거나 다른 계정 권한을 복구하지 않는다', async ({ page }) => {
  const control = await setup(page); await page.goto(path); await prepareConversion(page); control.conversionMode = 'defer';
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).dblclick();
  await expect.poll(() => Boolean(control.conversionRelease)).toBe(true);
  expect(control.calls.filter(call => call.type === 'get_calculator_conversion')).toHaveLength(1);
  control.conversionMode = 'ready'; control.conversionRelease();
  await expect(page.locator('.jcalc-score')).toHaveCount(1);
  control.accessMode = 'defer';
  await page.getByRole('button', { name: '이용 상태 다시 확인', exact: true }).click();
  await expect.poll(() => Boolean(control.accessRelease)).toBe(true);
  await page.evaluate(() => clearClientSession());
  await expect(page.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
  control.accessMode = 'ready'; control.accessRelease();
  await expect(page.locator('.jcalc-score, .jcalc-probability')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '환산점수·확률 조회', exact: true })).toHaveCount(0);
});

test('다른 화면에서 돌아오면 이용 상태를 재확인하고 연속 focus는 요청을 반복하지 않는다', async ({ page }) => {
  const control = await setup(page); control.forecastMode = 'ready'; await page.goto(path); await prepareConversion(page);
  await page.getByRole('button', { name: '환산점수·확률 조회', exact: true }).click();
  await expect(page.locator('.jcalc-probability')).toHaveText('약 82%');
  await page.clock.install(); await page.clock.fastForward(31_000);
  control.accessAllowed = false;
  await page.evaluate(() => { dispatchEvent(new Event('focus')); dispatchEvent(new Event('focus')); dispatchEvent(new Event('focus')); });
  await expect(page.getByRole('heading', { name: '조회에는 Basic 이상 이용권이 필요합니다.' })).toBeVisible();
  await expect(page.locator('.jcalc-score, .jcalc-probability')).toHaveCount(0);
  expect(control.calls.filter(call => call.type === 'get_calculator_access')).toHaveLength(2);
});

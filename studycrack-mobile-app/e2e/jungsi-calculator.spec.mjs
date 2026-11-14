import { expect, test } from '@playwright/test';

const path = '/2027-jungsi-consulting/calculator';
const catalog = [
  { univName: '한국외국어대학교(서울)', majors: ['경영학부', '경제학부'] },
  { univName: '한국외국어대학교(글로벌)', majors: ['경영학과', '컴퓨터공학부', ...Array.from({ length: 16 }, (_, index) => `가상학과${index + 1}`)] },
  ...Array.from({ length: 15 }, (_, index) => ({ univName: `가상대학교${index + 1}`, majors: ['예시학과'] }))
];

async function setup(page, { signedIn = true } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const control = { calls: [], mode: 'ready', release: null };
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
    expect(payload).toEqual({ type: 'get_univ_list_only' });
    expect((await route.request().allHeaders()).authorization).toBeUndefined();
    if (control.mode === 'defer') await new Promise(resolve => { control.release = resolve; });
    try {
      if (control.mode === 'error') return await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      if (control.mode === 'empty') return await route.fulfill({ json: [] });
      return await route.fulfill({ json: catalog });
    } catch (_) {}
  });
  return control;
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
  await expect(page.getByText('분석 결과는 준비 중입니다.', { exact: true })).toBeVisible();
  expect(control.calls.every(call => call.type === 'get_univ_list_only')).toBe(true);
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
  await setup(page);
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => Array.from(document.fonts).some(font => font.family === 'Paperlogy' && font.status === 'loaded'))).toBe(true);
    await fits(page);
    await selectGlobal(page);
    await fits(page);
    await page.locator('.jcalc-footer').scrollIntoViewIfNeeded();
    await expect(page.locator('.jcalc-footer')).toBeInViewport();
    if ([320, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`jungsi-calculator-${width}.png`), fullPage: true });
  }
});

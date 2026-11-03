import { expect, test } from '@playwright/test';

const widths = [320, 360, 390, 430, 768, 1440];
const steps = ['onboarding', 'survey', 'materials', 'written_consultation', 'report', 'final_call'];
const states = [
  ['ONBOARDING', 'ACCEPT_SERVICE_TERMS', 0], ['SURVEY_DRAFT', 'COMPLETE_SURVEY', 1],
  ['MATERIAL_REVIEW', 'WAIT_FOR_MATERIAL_REVIEW', 2], ['SUPPLEMENT_REQUIRED', 'SUBMIT_SUPPLEMENT', 2],
  ['AVAILABILITY_REQUIRED', 'SUBMIT_WRITTEN_AVAILABILITY', 3], ['SCHEDULING', 'WAIT_FOR_WRITTEN_ASSIGNMENT', 3],
  ['WRITTEN_SESSION_BOOKED', 'ATTEND_WRITTEN_SESSION', 3], ['WRITTEN_SESSION_COMPLETED', 'WAIT_FOR_REPORT', 4],
  ['REPORT_GENERATING', 'WAIT_FOR_REPORT', 4], ['REPORT_REVIEW', 'WAIT_FOR_REPORT', 4],
  ['REPORT_SCHEDULED', 'WAIT_FOR_REPORT_RELEASE', 4], ['FINAL_CALL_SCHEDULING', 'SUBMIT_FINAL_CALL_AVAILABILITY', 5],
  ['FINAL_CALL_BOOKED', 'ATTEND_FINAL_CALL', 5], ['SERVICE_COMPLETED', null, 6]
];
const homeFor = ([workflowState, nextAction, current]) => ({ available: true, workflowState, nextAction, nextDueAt: null, progress: steps.map((step, index) => ({ step, status: index < current ? 'completed' : index === current ? 'current' : 'upcoming' })), session: null, report: null, alerts: [] });

async function prepare(page, { loggedIn = true } = {}) {
  const state = { home: homeFor(states[1]), error: false, defer: false, campaign: { campaignSlug: '2027-jungsi-consulting', admissionYear: 2027, enrollmentStatus: 'open', price: 300000, applicationUrl: 'https://docs.google.com/forms/d/e/synthetic/viewform' } };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fontResponse = await page.request.get('/studycrack-mobile-app/dist/studycrack-mobile.css');
  expect(fontResponse.ok(), 'The preview must serve the built font stylesheet').toBe(true);
  const fonts = ((await fontResponse.text()).match(/@font-face\s*\{[^}]*\}/g) || []).filter(rule => /\bfont-family:\s*(["']?)Paperlogy\1\s*[;}]/.test(rule));
  expect(fonts.length, 'The preview stylesheet must contain the Paperlogy font faces').toBeGreaterThan(0);
  await page.route('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css', route => route.fulfill({ contentType: 'text/css', body: fonts.join('\n') }));
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.CONFIG={api:{consulting:'https://api.example.invalid/consulting',consultingPublic:'https://api.example.invalid/public'}};` }));
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    localStorage.setItem('userRole','student');
    window.hasClientSession=()=>${loggedIn};
    window.__design={home:${JSON.stringify(state.home)},error:${state.error},defer:${state.defer},calls:[]};
    window.apiFetch=async(_url,options)=>{
      const {type}=JSON.parse(options.body), f=window.__design; f.calls.push(type);
      if(type==='student_get_v2_consulting_home'){
        if(f.defer) await new Promise(resolve=>{window.__releaseHome=resolve;});
        return new Response(JSON.stringify(f.error?{success:false,code:'SERVER_ERROR'}:{success:true,data:f.home}),{status:f.error?503:200});
      }
      let data={};
      if(type==='student_get_v2_survey_schema') data={caseId:'CASE_synthetic'};
      else if(type==='student_get_v2_survey_draft') data={caseId:'CASE_synthetic',workflowState:'SURVEY_DRAFT',draft:{snapshot:null,draftRevision:0},files:[]};
      else if(type==='student_list_v2_written_slots') data={slots:['2099-01-01','2099-01-02','2099-01-03'].flatMap(localDate=>['10:00','10:30'].map(localTime=>({slotId:'WST_'+localDate.replaceAll('-','')+'_'+localTime.replace(':',''),localDate,localTime,startAt:localDate+'T'+localTime+':00+09:00',endAt:localDate+'T11:00:00+09:00'})))};
      else if(type==='student_get_v2_written_availability') data={selectedSlots:[],revision:0};
      else if(type==='student_get_v2_written_booking') data={session:null};
      else if(type==='student_get_written_session') data={session:{caseId:'CASE_synthetic',status:'booked',entryAllowed:true,startAt:'2099-01-01T01:00:00.000Z',endAt:'2099-01-01T01:30:00.000Z'}};
      else if(type==='student_list_written_messages') data={messages:[],nextCursor:null,hasMore:false};
      else if(type==='student_get_v2_report') data={available:false,report:null};
      else return new Response(JSON.stringify({success:false,code:'NOT_FOUND'}),{status:404});
      return new Response(JSON.stringify({success:true,data}));
    };
  ` }));
  await page.route('https://api.example.invalid/public', route => route.fulfill({ json: { success: true, data: state.campaign } }));
  return state;
}

async function fits(page) {
  const box = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(box.scroll).toBeLessThanOrEqual(box.width + 1);
  expect(box.body).toBeLessThanOrEqual(box.width + 1);
}

test('공개 메인은 여섯 화면 크기에서 신청·과정·문의가 읽히고 키보드로 FAQ를 조작한다', async ({ page }, testInfo) => {
  await prepare(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/2027-jungsi-consulting');
    await expect(page.locator('#consultingApply')).toHaveText('컨설팅 신청하기');
    await page.evaluate(() => document.fonts.ready);
    await fits(page);
    await expect(page.locator('#consultingPrice')).toHaveText('컨설팅 비용 300,000원');
    expect(await page.locator('.jungsi-landing-header').evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(81);
    expect(await page.locator('#consultingApply').evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(900);
    await expect(page.locator('.jungsi-landing-process li')).toHaveCount(5);
    const circles = await page.locator('.jungsi-landing-step').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return Math.abs(box.width - box.height); }));
    expect(circles.every(value => value < 1)).toBe(true);
    const rows = await page.locator('.jungsi-landing-process li').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().top));
    expect(width < 760 ? rows[1] > rows[0] : Math.abs(rows[1] - rows[0]) < 2).toBe(true);
    expect(await page.locator('body').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Paperlogy');
    expect(await page.locator('#consultingApply').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(52, 78, 143)');
    if ([390, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`consulting-landing-${width}.png`), fullPage: true });
  }
  const question = page.locator('summary').first();
  await question.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await expect(page.locator('details').first()).toContainText('10자리 인증코드');
});

test('모집 중이 아니거나 신청 URL이 올바르지 않으면 디자인 변경 뒤에도 접수를 열지 않는다', async ({ page }) => {
  const state = await prepare(page);
  for (const patch of [{ enrollmentStatus: 'unavailable' }, { enrollmentStatus: 'open', applicationUrl: 'javascript:alert(1)' }]) {
    Object.assign(state.campaign, patch);
    await page.goto('/2027-jungsi-consulting');
    await expect(page.locator('#consultingApply')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#consultingApply')).toHaveAttribute('href', '#process');
  }
});

for (const width of [320, 768, 1440]) test(`홈 14단계는 ${width}px에서 순서·현재 행동·문서 스크롤을 유지한다`, async ({ page }, testInfo) => {
  const fixture = await prepare(page);
  await page.setViewportSize({ width, height: 900 });
  for (const state of states) {
    fixture.home = homeFor(state);
    await page.goto('/2027-jungsi-consulting/home');
    await expect(page.locator('#nextTitle')).toBeVisible();
    await fits(page);
    await expect(page.locator('.consulting-v2-progress li')).toHaveCount(6);
    await expect(page.locator('[aria-current="step"]')).toHaveCount(state[0] === 'SERVICE_COMPLETED' ? 0 : 1);
    expect(await page.locator('.consulting-v2-next').evaluate(node => node.getBoundingClientRect().top < document.querySelector('.consulting-v2-progress').getBoundingClientRect().top)).toBe(true);
    if (state[0] === 'SERVICE_COMPLETED') {
      await expect(page.getByRole('button', { name: '다음 단계로 이동' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '공개 보고서 보기' })).toBeVisible();
    } else {
      const next = page.getByRole('button', { name: '다음 단계로 이동' });
      expect(await next.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(900);
      await expect(page.locator('#nextTitle')).not.toContainText('모든 컨설팅 과정이 완료');
    }
    if (state[0] === 'SURVEY_DRAFT') {
      const ys = await page.locator('.consulting-v2-progress li > span').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().top));
      expect(width < 760 ? ys[1] > ys[0] : Math.abs(ys[1] - ys[0]) < 2).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`consulting-home-${width}.png`), fullPage: true });
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('.consulting-v2-home-footer')).toBeInViewport();
    if (width === 320) expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  }
});

test('보류·빈 상태·일시 오류·미제공 다음 행동은 완료로 오인하지 않는다', async ({ page }) => {
  const fixture = await prepare(page);
  await page.setViewportSize({ width: 320, height: 900 });
  fixture.home = { ...homeFor(states[1]), serviceHold: true, nextAction: null };
  await page.goto('/2027-jungsi-consulting/home');
  await expect(page.locator('#nextTitle')).toHaveText('서비스가 일시 보류되었습니다.');
  await expect(page.getByRole('button', { name: '다음 단계로 이동' })).toHaveCount(0);
  fixture.home = { ...homeFor(states[1]), nextAction: null };
  await page.reload();
  await expect(page.locator('#nextTitle')).toHaveText('현재 진행 상태를 확인해주세요.');
  fixture.home = { available: false }; await page.reload();
  await expect(page.getByRole('heading', { name: '등록된 컨설팅이 없습니다' })).toBeVisible();
  fixture.error = true; await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => { window.__design.error = false; window.__design.home = { available: false }; });
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('heading', { name: '등록된 컨설팅이 없습니다' })).toBeVisible();
  await fits(page);
});

test('긴 조회가 진행 중이어도 중립 상태와 브랜드를 유지한다', async ({ page }) => {
  const fixture = await prepare(page); fixture.defer = true;
  await page.goto('/2027-jungsi-consulting/home');
  await expect(page.getByRole('status')).toHaveText('잠시만 기다려주세요.');
  await expect(page.locator('.consulting-v2-brand')).toBeVisible();
  await expect.poll(() => page.evaluate(() => typeof window.__releaseHome)).toBe('function');
  await page.evaluate(() => window.__releaseHome());
  await expect(page.locator('#nextTitle')).toBeVisible();
});

test('신청자 로그인 진입도 작은 화면과 확대된 레이아웃에서 두 버튼이 모두 접근 가능하다', async ({ page }) => {
  await prepare(page, { loggedIn: false });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/2027-jungsi-consulting/login');
    await expect(page.getByRole('heading', { name: '계정으로 시작하기' })).toBeVisible();
    await fits(page);
    for (const name of ['로그인', '회원가입']) {
      const link = page.getByRole('link', { name, exact: true });
      expect(await link.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await link.scrollIntoViewIfNeeded(); await expect(link).toBeInViewport();
    }
  }
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await fits(page);
  await page.getByRole('link', { name: '회원가입', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('link', { name: '회원가입', exact: true })).toBeInViewport();
});

test('기초조사 7개 입력 단계와 자료·일정·서면상담은 320px에서도 하단까지 조작한다', async ({ page }) => {
  await prepare(page); await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/2027-jungsi-consulting/survey');
  for (let i = 0; i < 7; i++) {
    await expect(page.locator('.consulting-survey-card h1')).toBeVisible();
    await fits(page);
    const next = page.getByRole('button', { name: i === 6 ? '최종 제출' : '저장하고 다음' });
    await next.scrollIntoViewIfNeeded(); await expect(next).toBeInViewport();
    if (i < 6) await next.click();
  }
  await page.goto('/2027-jungsi-consulting/materials');
  await expect(page.getByRole('button', { name: '진행 현황으로', exact: true })).toBeVisible(); await fits(page);
  await page.goto('/2027-jungsi-consulting/schedule');
  await expect(page.getByRole('button', { name: '가능 시간 저장' })).toBeVisible(); await fits(page);
  await page.goto('/2027-jungsi-consulting/written-session');
  await expect(page.locator('.consulting-written-chat footer textarea')).toBeVisible(); await fits(page);
});

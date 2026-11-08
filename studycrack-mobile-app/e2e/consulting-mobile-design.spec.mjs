import { expect, test } from '@playwright/test';
import { createEmptySurvey } from '../src/features/consulting-v2/survey-model.js';

const widths = [320, 360, 390, 430, 768, 1440];
const steps = ['onboarding', 'survey', 'materials', 'written_consultation', 'report', 'final_call'];
const states = [
  ['ONBOARDING', 'ACCEPT_SERVICE_TERMS', 0, '기초조사서 작성하기', 'survey'],
  ['SURVEY_DRAFT', 'COMPLETE_SURVEY', 1, '이어서 작성하기', 'survey'],
  ['MATERIAL_REVIEW', 'WAIT_FOR_MATERIAL_REVIEW', 2, '제출 자료 보기', 'materials'],
  ['SUPPLEMENT_REQUIRED', 'SUBMIT_SUPPLEMENT', 2, '보완 작성하기', 'survey'],
  ['AVAILABILITY_REQUIRED', 'SUBMIT_WRITTEN_AVAILABILITY', 3, '가능 시간 선택하기', 'schedule'],
  ['SCHEDULING', 'WAIT_FOR_WRITTEN_ASSIGNMENT', 3, '가능 시간 확인하기', 'schedule'],
  ['WRITTEN_SESSION_BOOKED', 'ATTEND_WRITTEN_SESSION', 3, '서면 상담 열기', 'written-session'],
  ['WRITTEN_SESSION_COMPLETED', 'WAIT_FOR_REPORT', 4, '보고서 상태 보기', 'report'],
  ['REPORT_GENERATING', 'WAIT_FOR_REPORT', 4, '보고서 상태 보기', 'report'],
  ['REPORT_REVIEW', 'WAIT_FOR_REPORT', 4, '보고서 상태 보기', 'report'],
  ['REPORT_SCHEDULED', 'WAIT_FOR_REPORT_RELEASE', 4, '보고서 상태 보기', 'report'],
  ['FINAL_CALL_SCHEDULING', 'SUBMIT_FINAL_CALL_AVAILABILITY', 5, '파이널 콜 시간 선택하기', 'final-call'],
  ['FINAL_CALL_BOOKED', 'ATTEND_FINAL_CALL', 5, '통화 일정 확인하기', 'final-call'],
  ['SERVICE_COMPLETED', null, 6, '공개 보고서 보기', 'report']
];
const homeFor = ([workflowState, nextAction, current]) => ({ available: true, workflowState, nextAction, nextDueAt: null, progress: steps.map((step, index) => ({ step, status: index < current ? 'completed' : index === current ? 'current' : 'upcoming' })), session: null, report: null, alerts: [] });

async function prepare(page, { loggedIn = true } = {}) {
  const state = { home: homeFor(states[1]), error: false, defer: false, campaign: { campaignSlug: '2027-jungsi-consulting', admissionYear: 2027, enrollmentStatus: 'open', price: 300000, applicationUrl: 'https://docs.google.com/forms/d/e/synthetic/viewform' } };
  state.survey = { caseId: 'CASE_synthetic', workflowState: 'ONBOARDING', draft: null, files: [] };
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
    window.__design={home:${JSON.stringify(state.home)},error:${state.error},defer:${state.defer},survey:${JSON.stringify(state.survey)},calls:[],saves:[],submissions:[]};
    window.apiFetch=async(_url,options)=>{
      const {type,data:input}=JSON.parse(options.body), f=window.__design; f.calls.push(type);
      if(type==='student_get_v2_consulting_home'){
        if(f.defer) await new Promise(resolve=>{window.__releaseHome=resolve;});
        return new Response(JSON.stringify(f.error?{success:false,code:'SERVER_ERROR'}:{success:true,data:f.home}),{status:f.error?503:200});
      }
      let data={};
      if(type==='student_get_v2_survey_schema') data={caseId:'CASE_synthetic'};
      else if(type==='student_get_v2_survey_draft') data=f.survey;
      else if(type==='student_save_v2_survey_draft'){
        f.saves.push(input);
        if(f.saveMode==='defer') await new Promise(resolve=>{f.releaseSave=resolve;});
        if(f.saveMode==='error') return new Response(JSON.stringify({success:false,code:'INVALID_SURVEY_INPUT'}),{status:400});
        const revision=f.survey.draft?.draftRevision||0;
        if(input.expectedDraftRevision!==revision) return new Response(JSON.stringify({success:false,code:'REVISION_CONFLICT'}),{status:409});
        f.survey.draft={snapshot:input.snapshot,draftRevision:revision+1};
        f.survey.workflowState='SURVEY_DRAFT';
        data={caseId:f.survey.caseId,workflowState:f.survey.workflowState,draftRevision:revision+1};
      }
      else if(type==='student_submit_v2_survey'){
        f.submissions.push(input);
        f.survey.workflowState='MATERIAL_REVIEW';
        data={caseId:f.survey.caseId,workflowState:f.survey.workflowState};
      }
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
  await page.getByText('소셜 로그인으로도 이용할 수 있나요?', { exact: true }).click();
  await expect(page.getByText('인증코드는 신청할 때 입력한 이메일에서 확인해주세요.', { exact: false })).toBeVisible();
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

for (const width of [320, 768, 1440]) test(`홈 14개 상태는 ${width}px에서 현재 행동과 문서 스크롤을 제공한다`, async ({ page }, testInfo) => {
  const fixture = await prepare(page);
  for (const state of states) {
    await page.setViewportSize({ width, height: 900 });
    fixture.home = homeFor(state);
    await page.goto('/2027-jungsi-consulting/home');
    await expect(page.locator('#nextTitle')).toBeVisible();
    await fits(page);
    await expect(page.getByRole('heading', { name: '전체 진행 단계' })).toHaveCount(0);
    const next = page.getByRole('button', { name: state[3], exact: true });
    await expect(page.locator('.consulting-v2-next .consulting-v2-primary')).toHaveCount(1);
    expect(await next.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(900);
    if (state[0] === 'SERVICE_COMPLETED') {
      await expect(page.getByRole('button', { name: '통화 완료 확인' })).toBeVisible();
    } else {
      await expect(page.locator('#nextTitle')).not.toContainText('모든 컨설팅 과정이 완료');
    }
    if (state[0] === 'SURVEY_DRAFT') {
      await expect.poll(() => page.locator('.consulting-v2-next-art img').evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: testInfo.outputPath(`consulting-home-${width}.png`), fullPage: true });
    }
    if (width === 320) await page.setViewportSize({ width, height: 420 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('.consulting-v2-home-footer')).toBeInViewport();
    if (width === 320) {
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await next.click();
      await expect(page).toHaveURL(new RegExp(`/2027-jungsi-consulting/${state[4]}$`));
    }
  }
});

test('보류·빈 상태·일시 오류·미제공 다음 행동은 완료로 오인하지 않는다', async ({ page }) => {
  const fixture = await prepare(page);
  await page.setViewportSize({ width: 320, height: 900 });
  fixture.home = { ...homeFor(states[1]), serviceHold: true, nextAction: null };
  await page.goto('/2027-jungsi-consulting/home');
  await expect(page.locator('#nextTitle')).toHaveText('서비스가 일시 보류되었습니다.');
  await expect(page.locator('.consulting-v2-next button')).toHaveCount(0);
  fixture.home = { ...homeFor(states[1]), nextAction: null };
  await page.reload();
  await expect(page.locator('#nextTitle')).toHaveText('진행 상황을 확인해주세요.');
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

test('기초조사 7개 입력 단계와 자료·일정·서면상담은 320px에서도 하단까지 조작한다', async ({ page }, testInfo) => {
  await prepare(page); await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/2027-jungsi-consulting/survey');
  await expect.poll(() => page.locator('.consulting-survey-mascot').evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('consulting-survey-320.png'), fullPage: true });
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

test('자동저장 실패는 멈추고 다시 저장하면 다음 구간과 새로고침에서 답변을 보존한다', async ({ page }) => {
  await page.clock.install();
  const fixture = await prepare(page);
  await page.goto('/2027-jungsi-consulting/survey');
  await page.evaluate(() => { window.__design.saveMode = 'error'; });
  await page.getByLabel('학교명', { exact: true }).fill('가상고');
  await page.clock.runFor(2100);
  await expect(page.locator('.consulting-survey-save-state')).toHaveText('저장 실패');
  await page.clock.runFor(6500);
  expect(await page.evaluate(() => window.__design.saves.length)).toBe(1);
  await expect(page.getByLabel('학교명', { exact: true })).toHaveValue('가상고');
  await page.evaluate(() => { window.__design.saveMode = 'success'; });
  await page.getByRole('button', { name: '다시 저장', exact: true }).click();
  await expect(page.locator('.consulting-survey-save-state')).toHaveText('저장됨');
  const saves = await page.evaluate(() => window.__design.saves);
  expect(saves).toHaveLength(2);
  expect(saves[1].snapshot.qualitative.consultationQuestions).toEqual([]);
  await page.getByRole('button', { name: '저장하고 다음' }).click();
  await expect(page.getByRole('heading', { name: '성적', exact: true })).toBeVisible();
  fixture.survey = await page.evaluate(() => window.__design.survey);
  await page.reload();
  await expect(page.getByLabel('학교명', { exact: true })).toHaveValue('가상고');
});

test('진행 중인 자동저장과 다음 이동은 최신 입력을 revision 순서대로 저장한다', async ({ page }) => {
  await page.clock.install();
  await prepare(page);
  await page.goto('/2027-jungsi-consulting/survey');
  await page.evaluate(() => { window.__design.saveMode = 'defer'; });
  const school = page.getByLabel('학교명', { exact: true });
  await school.fill('첫 입력');
  await page.clock.runFor(2100);
  await expect(page.locator('.consulting-survey-save-state')).toHaveText('저장 중…');
  await school.fill('최신 입력');
  await page.getByRole('button', { name: '저장하고 다음' }).click();
  await expect(page.getByRole('heading', { name: '학생 상태', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__design.saves.length)).toBe(1);
  await page.evaluate(() => { window.__design.saveMode = 'success'; window.__design.releaseSave(); });
  await expect(page.getByRole('heading', { name: '성적', exact: true })).toBeVisible();
  const saves = await page.evaluate(() => window.__design.saves);
  expect(saves.map(save => [save.expectedDraftRevision, save.snapshot.studentStatus.schoolName])).toEqual([[0, '첫 입력'], [1, '최신 입력']]);
});

test('최종 제출은 시험 종류를 안내하고 파일 검사가 끝난 최신 저장본을 제출한다', async ({ page }) => {
  const fixture = await prepare(page);
  const snapshot = createEmptySurvey();
  Object.assign(snapshot.studentStatus, { applicantType: 'graduate', residenceRegion: '서울' });
  snapshot.scores.records = snapshot.scores.records.map(row => ({ ...row, grade: 2, confirmed: true }));
  Object.assign(snapshot.preferences, { desiredRegions: ['서울'], desiredMajors: ['경영'], desiredTracks: ['상경'] });
  snapshot.strategy.riskTolerance = 'balanced';
  snapshot.qualitative.consultationQuestions = ['지원 조합이 궁금합니다.'];
  snapshot.consent.accurateInformation = true;
  const fileId = 'FILE_123e4567-e89b-12d3-a456-426614174001';
  fixture.survey = { ...fixture.survey, workflowState: 'SURVEY_DRAFT', draft: { snapshot, draftRevision: 1 }, files: [{ fileId, displayName: '성적표.pdf', status: 'quarantined' }] };
  await page.goto('/2027-jungsi-consulting/survey');
  const next = page.getByRole('button', { name: '저장하고 다음' });
  for (let step = 0; step < 6; step += 1) await next.click();
  const submit = page.getByRole('button', { name: '최종 제출' });
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('시험 종류를 선택해주세요.');
  await page.getByRole('combobox', { name: '시험 종류', exact: true }).selectOption('september_mock');
  for (let step = 1; step < 6; step += 1) await next.click();
  const consent = page.getByRole('checkbox', { name: '컨설팅 분석을 위한 자료 이용에 동의합니다.', exact: true });
  await consent.check();
  await expect(page.getByText('검사 중', { exact: true })).toBeVisible();
  await page.evaluate(() => { window.__design.survey.files[0].status = 'ready'; });
  await page.getByRole('button', { name: '검사 상태 확인' }).click();
  await expect(page.getByText('검사 완료', { exact: true })).toBeVisible();
  await expect(consent).toBeChecked();
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(page).toHaveURL(/\/2027-jungsi-consulting\/materials$/);
  const { draft, submissions } = await page.evaluate(() => ({ draft: window.__design.survey.draft, submissions: window.__design.submissions }));
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ fileIds: [fileId], expectedDraftRevision: draft.draftRevision });
  expect(draft.snapshot.consent.analysisUse).toBe(true);
});

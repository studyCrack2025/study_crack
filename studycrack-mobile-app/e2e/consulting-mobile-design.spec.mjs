import { expect, test } from '@playwright/test';
import { createEmptySurvey } from '../src/features/consulting-v2/survey-model.js';

const widths = [320, 360, 390, 430, 768, 1440];
const steps = ['onboarding', 'survey', 'materials', 'written_consultation', 'report', 'final_call'];
const states = [
  ['ONBOARDING', 'ACCEPT_SERVICE_TERMS', 0, '기초조사서 작성하기', 'survey'],
  ['SURVEY_DRAFT', 'COMPLETE_SURVEY', 1, '이어서 작성하기', 'survey'],
  ['MATERIAL_REVIEW', 'WAIT_FOR_MATERIAL_REVIEW', 2, '제출 자료 보기', 'materials'],
  ['SUPPLEMENT_REQUIRED', 'SUBMIT_SUPPLEMENT', 2, '보완 요청 확인', 'materials'],
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
  const previewFonts = fonts.join('\n').replace(/url\((["']?)(\/[^)]+?)\1\)/g, (_, quote, asset) => `url("${new URL(asset, fontResponse.url())}")`);
  await page.route('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css', route => route.fulfill({ contentType: 'text/css', body: previewFonts }));
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.CONFIG={api:{consulting:'https://api.example.invalid/consulting',consultingPublic:'https://api.example.invalid/public',file:'https://api.example.invalid/file',analysis:'https://api.example.invalid/analysis'}};` }));
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    localStorage.setItem('userRole','student');
    window.hasClientSession=()=>${loggedIn};
    window.__design={home:${JSON.stringify(state.home)},error:${state.error},defer:${state.defer},survey:${JSON.stringify(state.survey)},booking:${JSON.stringify(state.booking || null)},calls:[],saves:[],revisionSaves:[],submissions:[],conversions:[]};
    window.apiFetch=async(_url,options)=>{
      const {type,data:input}=JSON.parse(options.body), f=window.__design; f.calls.push(type);
      if(type==='student_get_v2_consulting_home'){
        if(f.defer) await new Promise(resolve=>{window.__releaseHome=resolve;});
        return new Response(JSON.stringify(f.error?{success:false,code:'SERVER_ERROR'}:{success:true,data:f.home}),{status:f.error?503:200});
      }
      let data={};
      if(type==='student_get_v2_survey_schema') data={caseId:'CASE_synthetic'};
      else if(type==='student_get_v2_survey_draft') data=f.survey;
      else if(type==='get_univ_list_only'){
        if(f.catalogUnavailable) return new Response(JSON.stringify({error:'목록 조회 실패'}),{status:503});
        return new Response(JSON.stringify([
          {univName:'가상대학교',regions:['서울']},{univName:'예시대학교(분교)',regions:['경기']},
          {univName:'한국외국어대학교',regions:['서울']},{univName:'한국외국어대학교(글로벌)',regions:['경기']}
        ]));
      }
      else if(type==='student_convert_v2_survey_scores'){
        f.conversions.push(input);
        data={results:input.records.map(row=>{
          if(f.scoreboardUnavailable) return {status:'board_unavailable'};
          return {status:'converted',metrics:{standardScore:138,percentile:100,grade:1}};
        })};
      }
      else if(type==='consulting_create_score_upload') {
        if(f.createUploadFailure) return new Response(JSON.stringify({success:false,code:'INTERNAL_SERVER_ERROR'}),{status:500});
        f.photo={fileId:f.uploadFileId || 'FILE_synthetic',displayName:input.fileName,contentType:input.contentType,size:input.size,status:'quarantined'};
        data={fileId:f.photo.fileId,fields:{key:'synthetic'},uploadUrl:'/__score-photo-upload'};
      }
      else if(type==='consulting_complete_score_upload') {
        if(input.fileId!==f.photo.fileId) throw new Error('Unexpected file ID');
        if(f.confirmUploadFailure) return new Response(JSON.stringify({success:false,code:'INTERNAL_SERVER_ERROR'}),{status:500});
        if(!f.survey.files.some(file=>file.fileId===input.fileId)) f.survey.files.push(f.photo);
        data=f.photo;
      }
      else if(type==='consulting_delete_unsubmitted_score_file') {
        f.survey.files=f.survey.files.filter(file=>file.fileId!==input.fileId);
        data={fileId:input.fileId,deleted:true};
      }
      else if(type==='student_save_v2_survey_draft'){
        f.saves.push(input);
        if(f.saveMode==='defer') await new Promise(resolve=>{f.releaseSave=resolve;});
        if(f.saveMode==='error') return new Response(JSON.stringify({success:false,code:'INVALID_SURVEY_INPUT'}),{status:400});
        const revision=f.survey.draft?.draftRevision||0;
        if(input.expectedDraftRevision!==revision) return new Response(JSON.stringify({success:false,code:'REVISION_CONFLICT'}),{status:409});
        f.survey.draft={snapshot:input.snapshot,draftRevision:revision+1};
        if(f.survey.workflowState!=='SUPPLEMENT_REQUIRED') f.survey.workflowState='SURVEY_DRAFT';
        data={caseId:f.survey.caseId,workflowState:f.survey.workflowState,draftRevision:revision+1};
      }
      else if(type==='student_save_v2_survey_revision'){
        f.revisionSaves.push(input);
        const submission=f.survey.submission;
        if(input.expectedSurveyRevision!==submission.revision) return new Response(JSON.stringify({success:false,code:'REVISION_CONFLICT'}),{status:409});
        f.survey.submission={...submission,revision:submission.revision+1,snapshot:{...submission.snapshot,...input.changes}};
        data={caseId:f.survey.caseId,workflowState:f.survey.workflowState,submission:f.survey.submission,changed:true};
      }
      else if(type==='student_submit_v2_survey'||type==='student_submit_v2_supplement'){
        f.submissions.push(input);
        if(f.failSupplementOnce&&type==='student_submit_v2_supplement'){
          f.failSupplementOnce=false;
          return new Response(JSON.stringify({success:false,code:'SERVER_ERROR'}),{status:503});
        }
        f.survey.workflowState='MATERIAL_REVIEW';
        f.survey.submission={snapshot:f.survey.draft.snapshot,fileIds:input.fileIds,revision:(f.survey.submission?.revision||0)+(type==='student_submit_v2_supplement'?1:0),submittedAt:'2026-11-10T03:30:00.000Z'};
        f.survey.supplement=null;
        data={caseId:f.survey.caseId,workflowState:f.survey.workflowState};
      }
      else if(type==='student_list_v2_written_slots') data={caseId:f.survey.caseId,window:{startDate:'2026-12-07',endDate:'2026-12-20'},slots:['2026-12-07','2026-12-08','2026-12-20'].flatMap(localDate=>['10:00','10:30'].map(localTime=>({slotId:'WST_'+localDate.replaceAll('-','')+'_'+localTime.replace(':',''),localDate,localTime,startAt:localDate+'T'+localTime+':00+09:00',endAt:localDate+'T11:00:00+09:00'})))};
      else if(type==='student_get_v2_written_availability') data={caseId:f.survey.caseId,selectedSlots:[],revision:0,...f.availability};
      else if(type==='student_submit_v2_written_availability'){
        f.availability={revision:input.expectedAvailabilityRevision+1,selectedSlots:input.selectedSlots};
        f.survey.workflowState='SCHEDULING';
        data=f.availability;
      }
      else if(type==='student_get_v2_written_booking') data={caseId:f.survey.caseId,session:null,...f.booking};
      else if(type==='student_respond_written_reschedule'){
        f.lastResponse=input;
        const change=f.booking.change;
        if(input.decision==='accept') f.booking.session={...f.booking.session,...change.offer,revision:2};
        f.booking.change=null; f.booking.changeRevision++;
        data=f.booking;
      }
      else if(type==='student_request_written_reschedule'){
        f.lastRequest=input;
        f.booking.changeRevision++;
        f.booking.change={kind:'student',selectedSlots:input.selectedSlots,revision:f.booking.changeRevision};
        data=f.booking;
      }
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
    expect(await page.evaluate(() => Array.from(document.fonts).some(font => font.family === 'Paperlogy' && font.status === 'loaded'))).toBe(true);
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

test('쿠키 로그인 상태에서 서비스 안내와 나의 컨설팅을 오가며 다시 로그인하지 않는다', async ({ page, baseURL }) => {
  const fixture = await prepare(page);
  await page.unroute('**/js/shared/api.js*');
  await page.unroute('**/js/config.js*');
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.IS_LOCAL=false;
    window.CONFIG={api:{consulting:'/__consulting',consultingPublic:'https://api.example.invalid/public',auth:'/__auth'}};
  ` }));
  await page.addInitScript(() => {
    const fetchFromPage = window.fetch.bind(window);
    window.__consultingCredentials = [];
    window.fetch = (url, options) => {
      if (url === '/__consulting') window.__consultingCredentials.push(options?.credentials);
      return fetchFromPage(url, options);
    };
  });
  await page.route('**/__auth', route => route.fulfill({ json: { success: true } }));
  let protectedCalls = 0;
  await page.route('**/__consulting', async route => {
    const request = route.request();
    const headers = await request.allHeaders();
    expect(headers.authorization).toBeUndefined();
    protectedCalls++;
    const data = {
      student_get_v2_consulting_home: fixture.home,
      student_get_v2_survey_schema: { caseId: fixture.survey.caseId },
      student_get_v2_survey_draft: fixture.survey
    }[request.postDataJSON().type];
    return route.fulfill({ json: { success: Boolean(data), data } });
  });
  await page.goto('/2027-jungsi-consulting');
  const publicLogin = page.getByRole('link', { name: '신청자 로그인', exact: true });
  await expect(publicLogin).toHaveAttribute('href', '/2027-jungsi-consulting/login');
  await publicLogin.click();
  await expect(page.getByRole('heading', { name: '계정으로 시작하기' })).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem('userId', 'student-synthetic');
    localStorage.setItem('userRole', 'student');
  });
  await page.context().addCookies([{ name: 'fixture-session', value: 'active', url: baseURL, httpOnly: true }]);
  expect(await page.context().cookies(baseURL)).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'fixture-session', httpOnly: true })]));
  await page.goto('/2027-jungsi-consulting/login');
  await expect(page).toHaveURL(/\/2027-jungsi-consulting\/home$/);
  await expect(page.getByRole('heading', { name: '나의 정시 컨설팅' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '이어서 작성하기' })).toBeVisible();
  await page.getByRole('link', { name: '서비스 안내', exact: true }).click();
  const returnLink = page.getByRole('navigation', { name: '정시 컨설팅 메뉴' }).getByRole('link', { name: '나의 컨설팅', exact: true });
  await expect(returnLink).toHaveAttribute('href', '/2027-jungsi-consulting/home');
  await expect(publicLogin).toHaveCount(0);
  await returnLink.click();
  await page.getByRole('button', { name: '이어서 작성하기' }).click();
  await expect(page.getByRole('heading', { name: '학생 상태', exact: true })).toBeVisible();
  expect(protectedCalls).toBeGreaterThanOrEqual(5);
  expect(await page.evaluate(() => window.__consultingCredentials)).toEqual(['include', 'include', 'include']);
  await page.goto('/2027-jungsi-consulting');
  await page.evaluate(() => window.clearClientSession());
  await expect(publicLogin).toHaveAttribute('href', '/2027-jungsi-consulting/login');
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
  await expect(page.getByRole('button', { name: '← 나의 컨설팅', exact: true })).toBeVisible(); await fits(page);
  await page.goto('/2027-jungsi-consulting/schedule');
  await expect(page.getByRole('button', { name: '가능 시간 저장' })).toBeVisible(); await fits(page);
  await page.goto('/2027-jungsi-consulting/written-session');
  await expect(page.locator('.consulting-written-chat footer textarea')).toBeVisible(); await fits(page);
});

test('제출 대기에서 보완 항목으로 이동해 첨부를 유지하고, 확인 후 가능한 시간을 제출한다', async ({ page }, testInfo) => {
  const fixture = await prepare(page);
  await page.setViewportSize({ width: 320, height: 900 });
  const snapshot = createEmptySurvey();
  Object.assign(snapshot.studentStatus, { applicantType: 'graduate', graduationYear: 2026, residenceRegion: '서울' });
  snapshot.conditions.commuteLimit = '60';
  snapshot.preferences.additionalPreference = '통학할 수 있는 서울 대학';
  snapshot.strategy.riskTolerance = 'balanced';
  snapshot.qualitative.consultationQuestions = ['나군 선택이 궁금합니다.'];
  snapshot.consent = { accurateInformation: true, analysisUse: true };
  const fileId = 'FILE_123e4567-e89b-42d3-a456-426614174005';
  fixture.survey = { ...fixture.survey, workflowState: 'MATERIAL_REVIEW', draft: { snapshot, draftRevision: 2 },
    files: [{ fileId, displayName: '제출한 성적표.pdf', status: 'linked' }],
    submission: { snapshot, fileIds: [fileId], revision: 0, submittedAt: '2026-11-10T03:00:00.000Z' } };
  await page.goto('/2027-jungsi-consulting/materials');
  await expect(page.getByRole('heading', { name: '기초조사서가 접수됐어요' })).toBeVisible();
  await expect(page.getByText('제출 시각')).toBeVisible();
  await expect(page.getByRole('button', { name: '내 답변 보기·수정' })).toBeVisible();
  await expect(page.getByRole('button', { name: '서면상담 가능 시간 선택' })).toHaveCount(0);

  await page.evaluate(() => {
    const fixture = window.__design;
    fixture.survey.workflowState = 'SUPPLEMENT_REQUIRED';
    fixture.survey.supplement = { fields: [
      { field: 'qualitative.consultationQuestions', label: '상담에서 답을 받고 싶은 질문', note: '나군에서 비교할 대학을 적어주세요.' },
      { field: 'studentStatus.residenceRegion', label: '거주 지역', note: '<img src=x> 구 단위로 알려주세요.' }
    ] };
    fixture.failSupplementOnce = true;
  });
  await page.getByRole('button', { name: '진행 상태 다시 확인' }).click();
  const notes = page.getByRole('region', { name: '보완 요청 내용' });
  await expect(notes).toContainText('<img src=x> 구 단위로 알려주세요.');
  await expect(notes.locator('img')).toHaveCount(0);
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('consulting-supplement-320.png'), fullPage: true });
  await page.getByRole('button', { name: '상담에서 답을 받고 싶은 질문 수정하기' }).click();
  const question = page.getByRole('textbox', { name: '상담에서 답을 받고 싶은 질문' });
  await expect(question).toBeFocused();
  await expect(page.getByRole('heading', { name: '상담 질문' })).toBeVisible();
  await question.fill('나군에서 가상대와 예시대의 통학과 계열을 비교하고 싶어요.');
  expect(await page.evaluate(() => window.__design.saves)).toHaveLength(0);
  const submit = page.getByRole('button', { name: '보완 완료 알리기' });
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('서버 응답을 확인하지 못했어요.');
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(page.getByRole('heading', { name: '기초조사서가 접수됐어요' })).toBeVisible();
  const attempts = await page.evaluate(() => window.__design.submissions);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].fileIds).toEqual([fileId]);
  expect(attempts[1]).toEqual(attempts[0]);
  await expect(page.getByRole('region', { name: '보완 요청 내용' })).toHaveCount(0);

  await page.evaluate(() => { window.__design.survey.workflowState = 'AVAILABILITY_REQUIRED'; });
  await page.getByRole('button', { name: '진행 상태 다시 확인' }).click();
  await page.getByRole('button', { name: '서면상담 가능 시간 선택' }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  const slots = page.locator('.consulting-schedule-days button');
  await expect(slots).toHaveCount(6);
  for (const slot of await slots.all()) await slot.click();
  await page.getByRole('button', { name: '가능 시간 저장' }).click();
  await expect(page.getByText('서면상담 일정 · 가능 시간 제출 완료')).toBeVisible();
  await expect(page.getByText(/가능 시간을 저장했습니다/)).toBeVisible();
  await fits(page);
});

test('입력 중 저장 요청 없이 저장 버튼 실패와 재시도 뒤 답변을 복원한다', async ({ page }) => {
  await page.clock.install();
  const fixture = await prepare(page);
  await page.goto('/2027-jungsi-consulting/survey');
  await page.evaluate(() => { window.__design.saveMode = 'error'; });
  await page.getByLabel('학교명', { exact: true }).fill('가상고');
  await page.clock.runFor(6500);
  expect(await page.evaluate(() => window.__design.saves.length)).toBe(0);
  await page.getByRole('button', { name: '저장하고 다음' }).click();
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

test('저장하고 다음은 최신 입력 한 건을 저장하고 완료될 때만 이동한다', async ({ page }) => {
  await page.clock.install();
  await prepare(page);
  await page.goto('/2027-jungsi-consulting/survey');
  await page.evaluate(() => { window.__design.saveMode = 'defer'; });
  const school = page.getByLabel('학교명', { exact: true });
  await school.fill('첫 입력');
  await page.clock.runFor(2100);
  expect(await page.evaluate(() => window.__design.saves.length)).toBe(0);
  await school.fill('최신 입력');
  await page.getByRole('button', { name: '저장하고 다음' }).click();
  await expect(page.locator('.consulting-survey-save-state')).toHaveText('저장 중…');
  await expect(school).toBeDisabled();
  await expect(page.getByRole('heading', { name: '학생 상태', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__design.saves.length)).toBe(1);
  await page.evaluate(() => { window.__design.saveMode = 'success'; window.__design.releaseSave(); });
  await expect(page.getByRole('heading', { name: '성적', exact: true })).toBeVisible();
  const saves = await page.evaluate(() => window.__design.saves);
  expect(saves.map(save => [save.expectedDraftRevision, save.snapshot.studentStatus.schoolName])).toEqual([[0, '최신 입력']]);
});

test('제출한 답변을 열어 수정하고 충돌 시 최신본과 비교해 다시 저장한다', async ({ page }) => {
  await page.clock.install();
  const fixture = await prepare(page);
  const snapshot = createEmptySurvey();
  snapshot.studentStatus = { ...snapshot.studentStatus, applicantType: 'high_school_senior', schoolName: '제출한 학교', residenceRegion: '서울' };
  Object.assign(snapshot.scores.records[0], { selection: '화법과작문', commonRawScore: 76, electiveRawScore: 20, rawScore: 96 });
  fixture.home = homeFor(states.at(-1));
  const fileId = 'FILE_123e4567-e89b-42d3-a456-426614174001';
  fixture.survey = { ...fixture.survey, workflowState: 'SERVICE_COMPLETED', submission: { snapshot, fileIds: [fileId], revision: 0 },
    files: [{ fileId, displayName: '검사된 성적표.pdf', status: 'linked' }] };
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/2027-jungsi-consulting/home');
  await page.getByRole('link', { name: /내 답변 보기/ }).click();
  await expect(page.getByText('제출한 학교', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '조사서 항목' }).selectOption({ label: '최종 확인' });
  await expect(page.getByText('검사된 성적표.pdf')).toBeVisible();
  await expect(page.getByRole('button', { name: '파일 추가' })).toHaveCount(0);
  await page.getByRole('combobox', { name: '조사서 항목' }).selectOption({ label: '학생 상태' });
  await page.getByRole('button', { name: '이 항목 수정' }).click();
  await page.getByLabel('학교명', { exact: true }).fill('내 수정 학교');
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => window.__design.revisionSaves.length)).toBe(0);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '← 나의 컨설팅' }).click();
  await expect(page).toHaveURL(/\/survey$/);
  await page.evaluate(() => {
    const submission = window.__design.survey.submission;
    submission.revision = 1;
    submission.snapshot.studentStatus.residenceRegion = '부산';
  });
  await page.getByRole('button', { name: '저장하고 다음' }).click();
  await expect(page.getByRole('alert')).toContainText('다른 화면에서 먼저 저장했습니다.');
  await expect(page.getByLabel('학교명', { exact: true })).toHaveValue('내 수정 학교');
  await page.getByRole('button', { name: '최신 답변과 비교' }).click();
  const comparison = page.getByRole('region', { name: '저장 충돌 비교' });
  await expect(comparison).toContainText('부산');
  await expect(comparison).toContainText('내 수정 학교');
  await fits(page);
  await page.getByRole('button', { name: '내 변경 이어서 편집' }).click();
  await expect(page.getByLabel('거주 지역', { exact: true })).toHaveValue('부산');
  await page.getByRole('button', { name: '저장하고 다음' }).click();
  await expect(page.getByRole('heading', { name: '성적', exact: true })).toBeVisible();
  await page.clock.runFor(2000);
  const { revisionSaves, survey, submissions, conversions } = await page.evaluate(() => window.__design);
  expect(revisionSaves.map(input => input.expectedSurveyRevision)).toEqual([0, 1]);
  expect(Object.keys(revisionSaves[1].changes)).toEqual(['studentStatus']);
  expect(survey.submission.snapshot.studentStatus).toMatchObject({ residenceRegion: '부산', schoolName: '내 수정 학교' });
  expect(survey.submission.fileIds).toEqual([fileId]);
  expect(survey.workflowState).toBe('SERVICE_COMPLETED');
  expect(submissions).toHaveLength(0);
  expect(conversions).toHaveLength(0);
  fixture.survey = survey;
  await page.reload();
  await expect(page.getByText('내 수정 학교', { exact: true })).toBeVisible();
});

test('구형 상담 답변은 숨기고 새 비교 기준과 다른 탭의 상담 주제를 유지한다', async ({ page }) => {
  const fixture = await prepare(page);
  const snapshot = createEmptySurvey();
  snapshot.formVersion = 3;
  snapshot.qualitative = { strengths: '기존 강점 메모', concerns: '구형 고민', guardianOpinion: '구형 보호자 의견', specialCircumstances: '현재 상황 메모', consultationQuestions: ['안정 지원을 어디에 둘까요?'] };
  fixture.survey = { ...fixture.survey, workflowState: 'MATERIAL_REVIEW', submission: { snapshot, fileIds: [], revision: 0 } };
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/2027-jungsi-consulting/survey');
  const sections = page.getByRole('combobox', { name: '조사서 항목' });
  await sections.selectOption({ label: '지원 조건' });
  await expect(page.locator('.consulting-survey-answer-list').getByText('재수 가능성', { exact: true })).toBeVisible();
  await expect(page.locator('.consulting-survey-answer-list').getByText('아니요', { exact: true })).toHaveCount(2);
  await sections.selectOption({ label: '상담 질문' });
  await expect(page.locator('.consulting-survey-answer-list')).toContainText('현재 상황 메모');
  for (const answer of ['기존 강점 메모', '구형 고민', '구형 보호자 의견']) await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '이 항목 수정' }).click();
  await expect(page.getByText('이전에 작성한 답변', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '강점', exact: true })).toHaveCount(0);
  const question = page.getByRole('textbox', { name: '상담에서 답을 받고 싶은 질문', exact: true });
  await expect(question).toHaveValue('안정 지원을 어디에 둘까요?');
  await page.getByRole('textbox', { name: /비교 중인 선택지와 기준/ }).fill('가상대와 예시대의 통학 거리 비교');
  await page.evaluate(() => {
    const submission = window.__design.survey.submission;
    submission.revision = 1;
    submission.snapshot.qualitative.consultationTopics = ['group_plan'];
  });
  const next = page.getByRole('button', { name: '저장하고 다음' });
  await next.click();
  await page.getByRole('button', { name: '최신 답변과 비교' }).click();
  await expect(page.getByRole('region', { name: '저장 충돌 비교' })).toContainText('가·나·다군 조합');
  await page.getByRole('button', { name: '내 변경 이어서 편집' }).click();
  await expect(page.getByRole('checkbox', { name: '가·나·다군 조합' })).toBeChecked();
  await next.click();
  await expect(page.getByRole('heading', { name: '최종 확인', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => window.__design.revisionSaves.at(-1));
  expect(saved).toEqual({ expectedSurveyRevision: 1, changes: { qualitative: {
    specialCircumstances: '현재 상황 메모', consultationQuestions: ['안정 지원을 어디에 둘까요?'],
    consultationTopics: ['group_plan'], decisionOptions: '가상대와 예시대의 통학 거리 비교'
  } } });
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await sections.selectOption({ label: '상담 질문' });
  await expect(page.locator('.consulting-survey-answer-list')).toContainText('가상대와 예시대의 통학 거리 비교');
  await fits(page);
});

test('국어·수학 공통과 선택 원점수를 저장하고 환산 수치는 학생 화면에 표시하지 않는다', async ({ page }, testInfo) => {
  const fixture = await prepare(page);
  const snapshot = createEmptySurvey();
  snapshot.formVersion = 2;
  snapshot.scores.records[0].rawScore = 91;
  snapshot.scores.records[3].subject = '';
  snapshot.scores.records[2].rawScore = 89;
  snapshot.scores.records[5].rawScore = 0;
  fixture.survey.draft = { snapshot, draftRevision: 1 };
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/2027-jungsi-consulting/survey');
  const next = page.getByRole('button', { name: '저장하고 다음' });
  await next.click();
  await expect(page.locator('.consulting-score-exam')).toContainText('2027학년도 수능');
  await expect(page.getByRole('combobox', { name: '시험 종류', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '응시 연도', exact: true })).toHaveCount(0);
  const korean = page.getByRole('group', { name: '국어', exact: true });
  const math = page.getByRole('group', { name: '수학', exact: true });
  for (const [group, common, elective] of [[korean, '76', '24'], [math, '74', '26']]) {
    await expect(group.getByRole('spinbutton', { name: '공통 원점수' })).toHaveAttribute('max', common);
    await expect(group.getByRole('spinbutton', { name: '선택 원점수' })).toHaveAttribute('max', elective);
    await expect(group.getByRole('spinbutton', { name: '원점수', exact: true })).toHaveCount(0);
  }
  await expect(korean).toContainText('이전에 저장한 총점은 91점');
  await expect(page.getByRole('spinbutton', { name: /표준점수|백분위|등급/ })).toHaveCount(0);
  for (const [area, grade] of [['영어', '2'], ['한국사', '9']]) {
    const group = page.getByRole('group', { name: area, exact: true });
    await expect(group.getByRole('combobox', { name: '등급' })).toHaveValue(grade);
    await expect(group.getByRole('spinbutton', { name: '원점수' })).toHaveCount(0);
  }
  const foreign = page.getByRole('group', { name: '제2외국어·한문', exact: true });
  await expect(foreign.getByRole('combobox', { name: '등급' })).toHaveCount(0);
  await foreign.getByRole('combobox', { name: '응시 과목 (선택)' }).selectOption('한문Ⅰ');
  await foreign.getByRole('combobox', { name: '등급' }).selectOption('4');
  await korean.getByRole('combobox', { name: '선택과목', exact: true }).selectOption('화법과작문');
  await korean.getByRole('spinbutton', { name: '공통 원점수', exact: true }).fill('76');
  await korean.getByRole('spinbutton', { name: '선택 원점수', exact: true }).fill('22');
  await expect(korean.locator('.consulting-score-total')).toHaveText('원점수 합계 98점');
  await expect.poll(() => page.evaluate(() => window.__design.conversions.some(call => call.records.some(row => row.area === 'korean' && row.rawScore === 98)))).toBe(true);
  expect(await page.evaluate(() => window.__design.survey.draft?.snapshot.scores.records[0].convertedFromRaw)).toBeUndefined();
  await expect(korean.getByRole('checkbox')).toHaveCount(0);
  await page.evaluate(() => { window.__design.scoreboardUnavailable = true; });
  await math.getByRole('combobox', { name: '선택과목', exact: true }).selectOption('미적분');
  await math.getByRole('spinbutton', { name: '공통 원점수' }).fill('74');
  await math.getByRole('spinbutton', { name: '선택 원점수' }).fill('0');
  await expect(math.locator('.consulting-score-total')).toHaveText('원점수 합계 74점');
  await expect.poll(() => page.evaluate(() => window.__design.conversions.some(call => call.records.some(row => row.area === 'math' && row.electiveRawScore === 0)))).toBe(true);
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('consulting-scores-320.png'), fullPage: true });
  await next.click();
  await expect(page.getByRole('heading', { name: '지원 조건', exact: true })).toBeVisible();
  const persisted = await page.evaluate(() => window.__design.survey.draft.snapshot);
  expect(persisted.formVersion).toBe(4);
  expect(persisted.scores).toMatchObject({ examYear: 2026, examType: 'csat' });
  expect(persisted.scores.records[0]).toMatchObject({ rawScore: 98, commonRawScore: 76, electiveRawScore: 22, standardScore: 138, convertedFromRaw: true });
  expect(persisted.scores.records[1]).toMatchObject({ rawScore: 74, commonRawScore: 74, electiveRawScore: 0, standardScore: null });
  expect(persisted.scores.records[3].subject).toBe('탐구 1');
  expect(persisted.scores.records[2]).toMatchObject({ area: 'english', grade: 2 });
  expect(persisted.scores.records[2]).not.toHaveProperty('rawScore');
  expect(persisted.scores.records[6]).toMatchObject({ area: 'foreign_language', subject: '한문Ⅰ', grade: 4 });
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(math.getByRole('spinbutton', { name: '선택 원점수' })).toHaveValue('0');
  await foreign.getByRole('combobox', { name: '응시 과목 (선택)' }).selectOption('');
  await next.click();
  await expect(page.getByRole('heading', { name: '지원 조건', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__design.survey.draft.snapshot.scores.records.some(row => row.area === 'foreign_language'))).toBe(false);
  const conversions = await page.evaluate(() => window.__design.conversions);
  expect(conversions.every(({ examYear, examType }) => examYear === 2026 && examType === 'csat')).toBe(true);
});

test('성적은 직접 입력하고 최종 확인에서 기존 첨부와 새 파일의 상태를 표시한다', async ({ page }, testInfo) => {
  const fixture = await prepare(page);
  const existing = { fileId: 'FILE_existing_score', displayName: '이전에 첨부한 성적표.jpeg', contentType: 'image/jpeg', size: 100, status: 'ready' };
  fixture.survey.files = [existing];
  let uploads = 0;
  await page.route('**/__score-photo-upload', route => {
    uploads += 1;
    return route.fulfill({ status: 204, body: '' });
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/2027-jungsi-consulting/survey');
  const next = page.getByRole('button', { name: '저장하고 다음' });
  await next.click();
  await expect(page.getByRole('heading', { name: '성적', exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const englishGrade = page.getByRole('group', { name: '영어', exact: true }).getByRole('combobox', { name: '등급' });
  await englishGrade.selectOption('6');
  for (let step = 0; step < 5; step += 1) await next.click();
  await expect(page.getByRole('heading', { name: '최종 확인', exact: true })).toBeVisible();
  const panel = page.getByRole('region', { name: '수능 성적표 첨부' });
  await expect(panel.getByText('1개 첨부됨', { exact: true })).toBeVisible();
  await expect(panel.getByText(existing.displayName, { exact: true })).toBeVisible();
  await expect(panel.getByText('보안 검사 통과', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: '파일 추가', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await panel.getByRole('button', { name: `${existing.displayName} 삭제`, exact: true }).click();
  await expect(panel.getByText('첨부된 파일이 없어요.', { exact: true })).toBeVisible();

  await page.evaluate(() => { window.__design.confirmUploadFailure = true; });
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    panel.getByRole('button', { name: '파일 선택', exact: true }).click()
  ]);
  await chooser.setFiles({ name: '성적표.jpeg', mimeType: 'image/jpeg', buffer: Buffer.from('synthetic') });
  await expect(page.getByRole('alert')).toHaveText('첨부 확인에 실패했어요. 파일 옆에서 다시 확인할 수 있어요.');
  await expect(panel.getByText('성적표.jpeg', { exact: true })).toBeVisible();
  await expect(panel.getByText('첨부 확인 대기', { exact: true })).toBeVisible();
  await page.evaluate(() => { window.__design.confirmUploadFailure = false; });
  await panel.getByRole('button', { name: '첨부 다시 확인' }).click();
  await expect(panel.getByText('보안 검사 중', { exact: true })).toBeVisible();
  expect(uploads).toBe(1);
  await page.evaluate(() => { window.__design.photo.status = 'ready'; });
  await expect(panel.getByText('보안 검사 통과', { exact: true })).toBeVisible();
  await expect(panel.getByText('1개 첨부됨', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('성적표 파일')).toBeHidden();
  await expect(panel.getByText(/판독|자동 반영/)).toHaveCount(0);
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('consulting-final-attachment-390.png'), fullPage: true });

  const previous = page.getByRole('button', { name: '이전', exact: true });
  for (let step = 0; step < 5; step += 1) await previous.click();
  await expect(englishGrade).toHaveValue('6');
  const historyGrade = page.getByRole('group', { name: '한국사', exact: true }).getByRole('combobox', { name: '등급' });
  await expect(historyGrade).toHaveValue('');
  expect(await page.evaluate(() => window.__design.calls)).not.toContain('consulting_read_score_photo');
});

test('통학·3지망·숫자 순위를 선택하고 파일 검사가 끝난 최신 저장본을 제출한다', async ({ page }, testInfo) => {
  const fixture = await prepare(page);
  await page.route('**/__score-photo-upload', route => route.fulfill({ status: 204, body: '' }));
  await page.setViewportSize({ width: 320, height: 900 });
  const snapshot = createEmptySurvey();
  snapshot.formVersion = 3;
  snapshot.preferences.rankedChoices = [{ region: '부산', university: '', track: '' }];
  Object.assign(snapshot.studentStatus, { applicantType: 'graduate', residenceRegion: '서울' });
  snapshot.strategy.riskTolerance = 'balanced';
  snapshot.qualitative.strengths = '이전 초안에 저장한 메모';
  snapshot.qualitative.consultationQuestions = ['지원 조합이 궁금합니다.'];
  snapshot.consent.accurateInformation = true;
  const fileId = 'FILE_123e4567-e89b-12d3-a456-426614174001';
  fixture.survey = { ...fixture.survey, workflowState: 'SURVEY_DRAFT', draft: { snapshot, draftRevision: 1 } };
  await page.goto('/2027-jungsi-consulting/survey');
  const next = page.getByRole('button', { name: '저장하고 다음' });
  await expect(next).toBeVisible();
  for (let step = 0; step < 6; step += 1) await next.click();
  const submit = page.getByRole('button', { name: '최종 제출' });
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('최대 편도 통학 시간을 선택해주세요.');
  const commute = page.getByRole('combobox', { name: '최대 편도 통학 시간' });
  await expect(commute.locator('option')).toHaveText(['선택해 주세요', '30분 이내', '1시간 이내', '1시간 30분 이내', '2시간 이내', '2시간 이상도 가능']);
  await expect(page.getByLabel(/등록금/)).toHaveCount(0);
  await page.getByRole('checkbox', { name: '재수 가능성', exact: true }).check();
  await commute.selectOption('over_120');
  await page.evaluate(() => { window.__design.catalogUnavailable = true; });
  await next.click();
  await expect(page.getByRole('heading', { name: '희망 지원', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: '대학 목록을 불러오지 못했어요.' })).toBeVisible();
  const note = '가상대 전자공학과 우선 검토\n목록 외 대학도 검토';
  await page.getByLabel('추가 희망 (선택)', { exact: true }).fill(note);
  await page.evaluate(() => { window.__design.catalogUnavailable = false; });
  await page.getByRole('button', { name: '대학 목록 다시 불러오기' }).click();
  const first = page.getByRole('group', { name: '1지망', exact: true });
  await expect(page.getByText('최대 3지망', { exact: true })).toBeVisible();
  await expect(first.getByLabel('희망 지역')).toHaveCount(0);
  await expect(first.getByText('이전에 입력한 희망 지역 · 부산')).toBeVisible();
  const search = first.getByRole('searchbox', { name: '대학명 검색' });
  await search.fill('없는대학');
  await expect(first.getByText(/일치하는 대학이 없어요/)).toBeVisible();
  await search.fill('가 상 대');
  await first.getByRole('button', { name: /가상대학교/ }).click();
  await expect(search).toHaveCount(0);
  await expect(first.getByRole('status').getByText('가상대학교', { exact: true })).toHaveCSS('font-size', '18px');
  await first.getByRole('button', { name: '선택 변경' }).click();
  await expect(search).toBeFocused();
  await search.fill('예시대');
  await expect(first.getByRole('button', { name: /예시대학교/ })).toBeVisible();
  await first.getByRole('button', { name: '검색 닫기' }).click();
  await expect(search).toHaveCount(0);
  await expect(first.getByRole('status').getByText('가상대학교', { exact: true })).toBeVisible();
  await first.getByLabel('희망 계열').selectOption('공학');
  await page.getByRole('button', { name: /2지망 추가/ }).click();
  const second = page.getByRole('group', { name: '2지망', exact: true });
  await second.getByRole('searchbox', { name: '대학명 검색' }).fill('한국외대 글로벌');
  await expect(second.getByRole('list', { name: '대학 검색 결과' })).toBeVisible();
  await fits(page);
  await second.getByRole('button', { name: /한국외국어대학교\(글로벌\)/ }).click();
  await expect(second.getByRole('searchbox', { name: '대학명 검색' })).toHaveCount(0);
  await expect(first.getByRole('status').getByText('가상대학교', { exact: true })).toBeVisible();
  await expect(second.getByRole('status').getByText('한국외국어대학교(글로벌)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /3지망 추가/ }).click();
  await page.getByRole('group', { name: '3지망', exact: true }).getByLabel('희망 계열').selectOption('자유전공·융합');
  await expect(page.getByRole('button', { name: '지망 추가' })).toHaveCount(0);
  await expect(page.getByLabel(/희망 학과|제외할 후보/)).toHaveCount(0);
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('consulting-preferences-320.png'), fullPage: true });
  await next.click();
  await page.getByRole('combobox', { name: '통학 순위' }).selectOption({ label: '1순위' });
  await expect(page.getByRole('combobox', { name: '지역 순위' })).toHaveValue('4');
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('consulting-priorities-320.png'), fullPage: true });
  await next.click();
  const primaryQuestion = page.getByRole('textbox', { name: '상담에서 답을 받고 싶은 질문', exact: true });
  await expect(primaryQuestion).toHaveValue('지원 조합이 궁금합니다.');
  await expect(page.getByRole('textbox', { name: '강점', exact: true })).toHaveCount(0);
  await expect(page.getByText('이전에 작성한 답변', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '올해 진학과 재수 결정', exact: true }).check();
  await page.getByRole('checkbox', { name: '가·나·다군 조합', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '상향·적정·안정 배분', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: /비교 중인 선택지와 기준/ }).fill('통학과 전공을 비교하고 싶어요.');
  await primaryQuestion.fill('');
  await next.click();
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('상담에서 확인할 질문을 한 가지 이상 입력해주세요.');
  await primaryQuestion.fill('가군에 상향을 쓴다면 나군에 어느 후보를 두면 좋을까요?');
  await page.getByRole('button', { name: '질문 추가', exact: true }).click();
  await page.getByRole('textbox', { name: '추가 질문 1', exact: true }).fill('올해 진학할 수 있는 조합도 비교하고 싶어요.');
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('consulting-questions-320.png'), fullPage: true });
  await next.click();
  const consent = page.getByRole('checkbox', { name: '컨설팅 분석을 위한 자료 이용에 동의합니다.', exact: true });
  await consent.check();
  await page.evaluate(id => { window.__design.createUploadFailure = true; window.__design.uploadFileId = id; }, fileId);
  const fileInput = page.getByLabel('성적표 파일');
  const attachment = { name: '성적표.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-') };
  await fileInput.setInputFiles(attachment);
  await expect(page.getByRole('alert')).toHaveText('성적표 업로드를 시작하지 못했어요. 잠시 후 파일을 다시 선택해 주세요.');
  await page.evaluate(() => { window.__design.createUploadFailure = false; });
  await fileInput.setInputFiles(attachment);
  await expect(page.getByText('보안 검사 중', { exact: true })).toBeVisible();
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('검사가 완료된 성적표 파일이 필요합니다.');
  await page.evaluate(() => { window.__design.survey.files[0].status = 'ready'; });
  await expect(page.getByText('보안 검사 통과', { exact: true })).toBeVisible();
  await expect(page.getByText('성적표.pdf', { exact: true })).toBeVisible();
  await expect(page.getByText('1개 첨부됨', { exact: true })).toBeVisible();
  await fits(page);
  expect(await page.evaluate(() => window.__design.calls)).not.toContain('consulting_read_score_photo');
  await expect(consent).toBeChecked();
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(page).toHaveURL(/\/2027-jungsi-consulting\/materials$/);
  const { draft, submissions } = await page.evaluate(() => ({ draft: window.__design.survey.draft, submissions: window.__design.submissions }));
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ fileIds: [fileId], expectedDraftRevision: draft.draftRevision });
  expect(draft.snapshot).toMatchObject({
    formVersion: 4,
    conditions: { commuteLimit: 'over_120', commuteMaxMinutes: null, repeatStudyAllowed: true },
    preferences: { rankedChoices: [
      { region: '부산', university: '가상대학교', track: '공학' },
      { region: '', university: '한국외국어대학교(글로벌)', track: '' },
      { region: '', university: '', track: '자유전공·융합' }
    ], additionalPreference: note },
    strategy: { priorityOrder: ['commute', 'major', 'brand', 'employment', 'region'] },
    qualitative: {
      consultationTopics: ['group_plan', 'retake_decision'],
      decisionOptions: '통학과 전공을 비교하고 싶어요.',
      consultationQuestions: ['가군에 상향을 쓴다면 나군에 어느 후보를 두면 좋을까요?', '올해 진학할 수 있는 조합도 비교하고 싶어요.']
    },
    consent: { analysisUse: true }
  });
  expect(draft.snapshot.qualitative).not.toHaveProperty('strengths');
});

test('기존 모의평가 초안의 점수는 수능으로 복사하지 않고 지망 메모와 이전 통학 시간은 이어받는다', async ({ page }) => {
  const fixture = await prepare(page);
  const snapshot = createEmptySurvey();
  delete snapshot.formVersion;
  snapshot.scores.examType = 'september_mock';
  Object.assign(snapshot.scores.records[0], { rawScore: 91, standardScore: 130, grade: 2, confirmed: true });
  snapshot.conditions = { commuteMaxMinutes: 45, tuitionBudgetAnnual: 5000000 };
  snapshot.preferences = { desiredUniversities: ['가상대'], requiredCandidates: ['가상대 전자공학과'], excludedCandidates: ['제외대'] };
  fixture.survey.draft = { snapshot, draftRevision: 4 };
  fixture.survey.workflowState = 'SURVEY_DRAFT';
  await page.goto('/2027-jungsi-consulting/survey');
  const next = page.getByRole('button', { name: '저장하고 다음' });
  await expect(next).toBeVisible();
  expect(await page.evaluate(() => window.__design.saves.length)).toBe(0);
  await next.click();
  await expect(page.getByText(/이전에 다른 시험으로 저장한 점수는 가져오지 않았어요/)).toBeVisible();
  const korean = page.getByRole('group', { name: '국어', exact: true });
  await expect(korean.getByRole('spinbutton', { name: '공통 원점수', exact: true })).toHaveValue('');
  await expect(korean.getByRole('spinbutton', { name: '표준점수', exact: true })).toHaveCount(0);
  await next.click();
  await expect(page.getByText('이전에 45분으로 입력했어요.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('최대 편도 통학 시간')).toHaveValue('');
  await next.click();
  await expect(page.getByRole('textbox', { name: '추가 희망 (선택)', exact: true })).toHaveValue('이전 조사서에 적은 희망\n대학 — 가상대\n꼭 검토할 후보 — 가상대 전자공학과');
  const migrated = await page.evaluate(() => window.__design.survey.draft.snapshot);
  expect(migrated.scores).toMatchObject({ examYear: 2026, examType: 'csat' });
  expect(migrated.conditions).not.toHaveProperty('tuitionBudgetAnnual');
  expect(migrated.preferences).not.toHaveProperty('excludedCandidates');
});

test('학생이 마이페이지에서 변경 제안을 수락하고 남은 시간으로 다시 변경을 요청한다', async ({ page }) => {
  const fixture = await prepare(page);
  fixture.home = { ...homeFor(states.find(([state]) => state === 'WRITTEN_SESSION_BOOKED')), writtenChangePending: true };
  fixture.booking = {
    canRequestChange: true, changeRevision: 3,
    session: { status: 'booked', revision: 1, startAt: '2026-12-07T02:00:00.000Z', endAt: '2026-12-07T02:30:00.000Z' },
    change: { kind: 'admin', requestId: 'WCR_synthetic', revision: 3, offer: { startAt: '2026-12-08T02:00:00.000Z', endAt: '2026-12-08T02:30:00.000Z' } }
  };
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/2027-jungsi-consulting/home');
  await page.getByRole('link', { name: /새 상담 시간 제안이 도착했어요/ }).click();
  await expect(page.getByRole('heading', { name: '운영팀에서 새 상담 시간을 제안했어요' })).toBeVisible();
  await fits(page);
  await page.getByRole('button', { name: '새 시간으로 변경' }).click();
  await expect(page.getByText('새 상담 일정으로 변경됐어요.')).toBeVisible();
  expect(await page.evaluate(() => window.__design.lastResponse)).toEqual({
    expectedSessionRevision: 1, expectedChangeRevision: 3, requestId: 'WCR_synthetic', decision: 'accept'
  });
  await page.getByRole('button', { name: '일정 변경 요청' }).click();
  await expect(page.getByText(/^12월 7일.*~.*12월 20일.*한국시간$/)).toBeVisible();
  await page.getByRole('button', { name: '10:30' }).last().click();
  await page.getByRole('button', { name: '변경 요청 보내기' }).click();
  await expect(page.getByText('변경 요청을 확인 중이에요. 확정 전까지 기존 예약이 유지됩니다.')).toBeVisible();
  expect(await page.evaluate(() => window.__design.lastRequest)).toEqual({
    expectedSessionRevision: 2, expectedChangeRevision: 4, selectedSlots: [{ slotId: 'WST_20261220_1030', priority: 2 }]
  });
  await fits(page);
});

import { expect, test } from '@playwright/test';

const caseId = 'CASE_123e4567-e89b-42d3-a456-426614174000';
const deadline = Date.parse('2026-12-07T06:00:00.000Z');
const time = (hour, minute = '00') => `2026-12-07T${hour}:${minute}:00.000Z`;
const session = { status: 'booked', revision: 1, startAt: time('08'), endAt: time('08', '30') };
const slot = { slotId: 'WST_20261207_1800', counselorId: 'operator', localDate: '2026-12-07', localTime: '18:00', startAt: time('09'), endAt: time('09', '30') };

async function prepare(page, extra = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2035-01-01T00:00:00.000Z') });
  await page.route('https://www.googletagmanager.com/**', route => route.abort());
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.CONFIG={api:{consulting:'/api/consulting'}};` }));
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    localStorage.setItem('userRole','student');window.hasClientSession=()=>true;
    window.__writtenSchedule={session:${JSON.stringify(session)},slot:${JSON.stringify(slot)},serverTime:new Date(${deadline}-60000).toISOString(),canRequestChange:true,change:null,calls:[],...${JSON.stringify(extra)}};
    window.apiFetch=async(_url,options)=>{
      const r=JSON.parse(options.body),s=window.__writtenSchedule;s.calls.push(r);let data={};
      if(r.type==='student_list_v2_written_slots')data={caseId:'${caseId}',window:{startDate:'2026-12-07',endDate:'2026-12-07'},slots:[s.slot]};
      else if(r.type==='student_get_v2_written_availability')data={caseId:'${caseId}',revision:1,selectedSlots:[],editable:false};
      else if(r.type==='student_get_v2_written_booking')data={caseId:'${caseId}',session:s.session,change:s.change,changeRevision:s.change?3:0,canRequestChange:s.canRequestChange,changeRequestDeadline:'2026-12-07T06:00:00.000Z',serverTime:s.serverTime};
      else if(r.type==='student_request_written_reschedule'){
        if(!s.rejectChange)throw new Error('Unexpected change submission');
        s.canRequestChange=false;s.serverTime=new Date(${deadline}+1).toISOString();
        return new Response(JSON.stringify({success:false,code:'WRITTEN_CHANGE_DEADLINE_PASSED',error:'일정 변경 요청은 상담 시작 2시간 전까지만 가능합니다. 이후에는 운영팀에 문의해주세요.'}),{status:409});
      }else if(r.type==='student_respond_written_reschedule'){
        if(r.data.decision==='accept')s.session={...s.session,startAt:s.slot.startAt,endAt:s.slot.endAt,revision:2};
        s.change=null;data={session:s.session};
      }else if(r.type==='student_get_v2_consulting_home')data={available:false};
      else throw new Error('Unexpected deadline request: '+r.type);
      return new Response(JSON.stringify({success:true,data}),{status:200});
    };
  ` }));
  await page.goto('/2027-jungsi-consulting/schedule');
  await expect(page.getByRole('heading', { name: '상담 일정이 확정됐습니다' })).toBeVisible();
}

test('학생 변경 화면은 서버 시각으로 마감되고 열어둔 선택 창도 자동으로 닫힌다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 }); await prepare(page);
  await page.getByRole('button', { name: '일정 변경 요청', exact: true }).click();
  await expect(page.getByRole('button', { name: '변경 요청 보내기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '18:00', exact: true }).click();
  await page.clock.fastForward(60001);
  await expect(page.getByRole('button', { name: '변경 요청 보내기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '일정 변경 요청', exact: true })).toHaveCount(0);
  await expect(page.getByText(/^일정 변경 요청이 마감됐어요/)).toBeVisible();
  expect(await page.evaluate(() => window.__writtenSchedule.calls.filter(r => r.type === 'student_request_written_reschedule'))).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('written-change-deadline-320.png'), fullPage: true });
});

test('마감 후 진입은 변경 버튼 대신 마감 안내를 표시한다', async ({ page }) => {
  await prepare(page, { serverTime: new Date(deadline + 1).toISOString(), canRequestChange: false });
  await expect(page.getByText(/^일정 변경 요청이 마감됐어요/)).toBeVisible();
  await expect(page.getByRole('button', { name: '일정 변경 요청', exact: true })).toHaveCount(0);
});

test('화면이 오래돼 서버가 마감을 거절해도 기존 예약을 유지하고 선택 창을 닫는다', async ({ page }) => {
  await prepare(page, { rejectChange: true });
  await page.getByRole('button', { name: '일정 변경 요청', exact: true }).click();
  await page.getByRole('button', { name: '18:00', exact: true }).click();
  await page.getByRole('button', { name: '변경 요청 보내기', exact: true }).click();
  await expect(page.getByText(/^일정 변경 요청이 마감됐어요/)).toBeVisible();
  await expect(page.getByRole('status')).toContainText('상담 시작 2시간 전까지만 가능합니다');
  await expect(page.getByRole('button', { name: '변경 요청 보내기', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__writtenSchedule.session)).toEqual(session);
});

for (const decision of ['accept', 'decline']) test(`마감 후에도 운영팀 제안을 ${decision === 'accept' ? '수락' : '거절'}할 수 있다`, async ({ page }) => {
  await prepare(page, { serverTime: new Date(deadline + 1).toISOString(), canRequestChange: false,
    change: { kind: 'admin', requestId: 'WCR_synthetic', revision: 3, offers: [slot] } });
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '다른 시간 제안하기' })).toHaveCount(0);
  await page.getByRole('button', { name: decision === 'accept' ? '선택한 시간으로 변경' : '기존 일정 유지', exact: true }).click();
  await expect(page.getByText(decision === 'accept' ? '새 상담 일정으로 변경됐어요.' : '기존 상담 일정을 유지했어요.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__writtenSchedule.calls.filter(r => r.type === 'student_respond_written_reschedule').map(r => r.data.decision))).toEqual([decision]);
});

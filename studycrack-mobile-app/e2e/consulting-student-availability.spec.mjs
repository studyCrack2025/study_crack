import { expect, test } from '@playwright/test';

const caseId = 'CASE_123e4567-e89b-42d3-a456-426614174000';
const slots = Array.from({ length: 14 }, (_, day) => {
    const localDate = `2026-12-${String(7 + day).padStart(2, '0')}`;
    return Array.from({ length: 20 }, (_, halfHour) => {
        const localTime = `${String(10 + Math.floor(halfHour / 2)).padStart(2, '0')}:${halfHour % 2 ? '30' : '00'}`;
        const startAt = new Date(`${localDate}T${localTime}:00+09:00`).toISOString();
        return { slotId: `WST_${localDate.replaceAll('-', '')}_${localTime.replace(':', '')}`, localDate, localTime, startAt, endAt: new Date(Date.parse(startAt) + 1800000).toISOString(), timezone: 'Asia/Seoul' };
    });
}).flat();
async function prepare(page, { empty = false, stale = false } = {}) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.CONFIG={api:{consulting:'/api/consulting'}};` }));
    await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
      localStorage.setItem('userRole','student');window.hasClientSession=()=>true;
      window.__availability={slots:${JSON.stringify(empty ? [] : slots)},revision:0,selected:[],saves:[],calls:[],stale:${stale}};
      const saved=JSON.parse(sessionStorage.getItem('availability-test-record')||'null');
      if(saved)Object.assign(window.__availability,saved);
      window.apiFetch=async(_url,options)=>{
        const r=JSON.parse(options.body),s=window.__availability;s.calls.push(r.type);let data={};
        if(r.type==='student_list_v2_written_slots')data={caseId:'${caseId}',window:{startDate:'2026-12-07',endDate:'2026-12-20'},slots:s.slots};
        else if(r.type==='student_get_v2_written_availability')data={caseId:'${caseId}',revision:s.revision,selectedSlots:s.selected,editable:true};
        else if(r.type==='student_get_v2_written_booking')data={caseId:'${caseId}',session:null,change:null,changeRevision:0};
        else if(r.type==='student_submit_v2_written_availability'){
          s.saves.push(r.data);
          if(s.stale){s.stale=false;s.slots=s.slots.filter(x=>x.slotId!==r.data.selectedSlots[0].slotId);return new Response(JSON.stringify({success:false,code:'INVALID_AVAILABILITY_SLOT',error:'선택한 시간이 먼저 마감되었습니다.'}),{status:400});}
          s.revision++;s.selected=r.data.selectedSlots;sessionStorage.setItem('availability-test-record',JSON.stringify({revision:s.revision,selected:s.selected}));data={caseId:'${caseId}',workflowState:'SCHEDULING',revision:s.revision,selectedSlots:s.selected};
        } else throw new Error('Unexpected availability request');
        return new Response(JSON.stringify({success:true,data}),{status:200});
      };
    ` }));
}

for (const width of [375, 1440]) test(`학생은 담당자 설정 없이 전체 기간에서 시간을 골라 저장하고 다시 볼 수 있다 (${width}px)`, async ({ page }, testInfo) => {
    await prepare(page); await page.setViewportSize({ width, height: 900 });
    await page.goto('/2027-jungsi-consulting/schedule');
    await expect(page.getByRole('heading', { name: '가능한 시간을 선택해주세요' })).toBeVisible();
    await expect(page.locator('.consulting-schedule-days section')).toHaveCount(14);
    await expect(page.locator('.consulting-schedule-days article button')).toHaveCount(280);
    await expect(page.getByText('가능한 시간을 먼저 제출해주세요. 운영팀이 담당자와 일정을 확인한 뒤 확정해드립니다.')).toBeVisible();
    expect(await page.evaluate(() => window.__availability.saves)).toHaveLength(0);
    await page.locator('.consulting-schedule-days section').first().getByRole('checkbox').check();
    await expect(page.getByText('20개 선택', { exact: true })).toBeVisible();
    const last = page.locator('.consulting-schedule-days section').last();
    await last.getByRole('button', { name: '19:30', exact: true }).click();
    await page.getByRole('button', { name: '가능 시간 저장', exact: true }).click();
    await expect(page.getByText('가능 시간을 저장했습니다. 운영자가 일정을 확정하면 알려드릴게요.')).toBeVisible();
    const writes = await page.evaluate(() => window.__availability.saves);
    expect(writes).toHaveLength(1); expect(writes[0].selectedSlots).toHaveLength(21);
    expect(writes[0].expectedAvailabilityRevision).toBe(0);
    expect(writes[0].selectedSlots.at(-1)).toEqual({ slotId: 'WST_20261220_1930', priority: 2 });
    expect(await page.evaluate(() => window.__availability.calls.some(type=>type.startsWith('admin_')))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`student-availability-saved-${width}.png`) });
    await page.locator('.consulting-schedule').evaluate(element => element.scrollIntoView());
    await page.screenshot({ path: testInfo.outputPath(`student-availability-start-${width}.png`) });
    await page.reload();
    await expect(page.getByText('21개 선택', { exact: true })).toBeVisible();
});

test('마지막 자리가 마감되면 최신 시간표로 갱신해 다른 시간을 제출하고 중복 자동 저장하지 않는다', async ({ page }) => {
    await prepare(page, { stale: true });
    await page.goto('/2027-jungsi-consulting/schedule');
    await page.locator('.consulting-schedule-days section').first().getByRole('button', { name: '10:00', exact: true }).click();
    await page.getByRole('button', { name: '가능 시간 저장', exact: true }).click();
    await expect(page.getByText('가능 시간이 바뀌었어요. 최신 시간표에서 다시 선택해주세요.')).toBeVisible();
    await expect(page.locator('.consulting-schedule-days article button')).toHaveCount(279);
    expect(await page.evaluate(() => window.__availability.saves)).toHaveLength(1);
    await page.locator('.consulting-schedule-days section').first().getByRole('button', { name: '10:30', exact: true }).click();
    await page.getByRole('button', { name: '가능 시간 저장', exact: true }).click();
    await expect(page.getByText('서면상담 일정 · 가능 시간 제출 완료')).toBeVisible();
    const writes = await page.evaluate(() => window.__availability.saves);
    expect(writes).toHaveLength(2); expect(writes[1].selectedSlots).toEqual([{ slotId: 'WST_20261207_1030', priority: 2 }]);
});

test('실제로 선택 시간이 없을 때 담당자 입력을 요구하지 않고 기간·예약 확인을 안내한다', async ({ page }) => {
    await prepare(page, { empty: true }); await page.goto('/2027-jungsi-consulting/schedule');
    await expect(page.getByText('지금 선택할 수 있는 시간이 없어요. 선택 기간과 예약 현황을 확인하거나 운영팀에 문의해주세요.')).toBeVisible();
    await expect(page.getByText(/운영팀에서 시간표를 열면/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '가능 시간 저장', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => window.__availability.saves)).toHaveLength(0);
});

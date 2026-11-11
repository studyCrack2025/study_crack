import { expect, test } from '@playwright/test';

test('배정된 관리자 계정은 학생 API 없이 운영자 서면상담 화면에서 답변한다', async ({ page }) => {
    const caseId = 'CASE_123e4567-e89b-12d3-a456-426614174000';
    const cssResponse = await page.request.get('/studycrack-mobile-app/dist/studycrack-mobile.css');
    expect(cssResponse.ok()).toBe(true);
    const rules = (await cssResponse.text()).match(/@font-face\s*\{[^}]*\}/g) || [];
    expect(rules.length).toBeGreaterThan(0);
    const fonts = rules.join('\n').replace(/url\((["']?)(\/[^)]+?)\1\)/g, (_, quote, asset) => `url("${new URL(asset, cssResponse.url())}")`);
    await page.route('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css', route => route.fulfill({ contentType: 'text/css', body: fonts }));
    await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
      localStorage.setItem('userRole','admin'); localStorage.setItem('userId','operator-cmo');
      window.hasClientSession=()=>true;
      window.__adminWritten={calls:[],messages:[]};
      window.apiFetch=async(_url,options)=>{
        const request=JSON.parse(options.body);const s=window.__adminWritten;s.calls.push(request);
        const session={caseId:'${caseId}',sessionId:'SESSION_synthetic',status:'open',entryAllowed:true,writable:true,
          startAt:'2099-12-07T01:00:00.000Z',endAt:'2099-12-07T01:30:00.000Z'};
        let data={};
        if(request.type==='counselor_list_written_sessions')data={sessions:[session]};
        else if(request.type==='counselor_get_written_session')data={session,note:{body:'상담 정리',revision:0}};
        else if(request.type==='counselor_list_written_messages')data={messages:s.messages,nextCursor:null,hasMore:false};
        else if(request.type==='counselor_send_written_message'){
          const message={messageId:'01K00000000000000000000001',senderRole:'counselor',body:request.data.body,createdAt:'2099-12-07T01:05:00.000Z'};
          s.messages.push(message);data={message,duplicate:false};
        }
        return new Response(JSON.stringify({success:true,data}),{status:200,headers:{'Content-Type':'application/json'}});
      };
    ` }));
    await page.goto(`/2027-jungsi-consulting/written-session?caseId=${caseId}`);
    await expect(page.getByRole('heading', { name: '상담사 전용' })).toBeVisible();
    await expect(page.getByLabel('내부 메모')).toHaveValue('상담 정리');
    await page.locator('.consulting-written-chat footer textarea').fill('운영팀 상담 답변');
    await page.getByRole('button', { name: '전송', exact: true }).click();
    await expect(page.locator('.consulting-written-messages')).toContainText('운영팀 상담 답변');
    const calls = await page.evaluate(() => window.__adminWritten.calls);
    expect(calls.filter(call => call.type === 'counselor_send_written_message')).toHaveLength(1);
    expect(calls.some(call => call.type.startsWith('student_'))).toBe(false);
});

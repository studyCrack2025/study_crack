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
        const session={caseId:'${caseId}',sessionId:'SESSION_synthetic',status:'open',entryAllowed:true,writable:true,canManage:true,
          startAt:'2099-12-07T01:00:00.000Z',endAt:'2099-12-07T01:30:00.000Z'};
        let data={};
        if(request.type==='counselor_list_written_sessions')data={sessions:[session]};
        else if(request.type==='counselor_get_written_session')data={session,note:{body:'상담 정리',revision:0}};
        else if(request.type==='counselor_get_written_preparation'){
          data={preparation:{scores:{records:[{area:'korean',selection:'언어와매체',rawScore:85}]},preferences:{rankedChoices:[{university:'가천대',track:'공학'},{university:'동국대',track:'공학'}]}}};
          if(request.data.includeComparison)data.comparison={status:'available',scoreBasis:'estimated',ranks:[
            {rank:1,university:'가천대학교',track:'공학',status:'available',counts:{evaluated:1,atOrAbove70:0,between:1,belowPass:0,unavailable:0},ranges:[],rows:[
              {key:'1',campusName:'글로벌캠퍼스',unitName:'건설환경공학과',trackName:'수능 일반전형1',admissionGroup:'na',status:'comparable',score:84.7,pass:84.5,registered70:84.9,passDelta:0.2,registered70Delta:-0.2,sourceYear:2026,scoreScope:'admission_score'}]},
            {rank:2,university:'동국대학교',track:'공학',status:'no_matching_units',counts:{evaluated:0,atOrAbove70:0,between:0,belowPass:0,unavailable:0},ranges:[],rows:[]}
          ]};
        }
        else if(request.type==='counselor_mark_written_read')data={marked:true};
        else if(request.type==='counselor_list_written_messages')data={messages:s.messages,nextCursor:null,hasMore:false};
        else if(request.type==='counselor_send_written_message'){
          const message={messageId:'01K00000000000000000000001',senderRole:'counselor',body:request.data.body,clientMessageId:request.data.clientMessageId,createdAt:'2099-12-07T01:05:00.000Z'};
          s.messages.push(message);data={message,duplicate:false};
        }
        return new Response(JSON.stringify({success:true,data}),{status:200,headers:{'Content-Type':'application/json'}});
      };
    ` }));
    await page.goto(`/2027-jungsi-consulting/written-session?caseId=${caseId}`);
    await page.getByRole('button', { name: '메모', exact: true }).click();
    await expect(page.getByRole('heading', { name: '상담사 전용' })).toBeVisible();
    await expect(page.getByLabel('내부 메모')).toHaveValue('상담 정리');
    expect(await page.evaluate(() => window.__adminWritten.calls.some(call => call.data?.includeComparison))).toBe(false);
    await page.getByRole('button', { name: '자료', exact: true }).click();
    const comparison = page.getByRole('region', { name: '수능 성적과 1~3지망 비교' });
    await comparison.scrollIntoViewIfNeeded();
    await expect(comparison.getByRole('heading', { name: '1지망 · 가천대학교 · 공학' })).toBeVisible();
    await expect(comparison.getByText('합격 컷 이상 · 70% 컷 미만')).toBeVisible();
    await expect(comparison.getByText('해당 대학·계열에서 비교할 수능위주 전형이 없어요.')).toBeVisible();
    await comparison.getByText('모집단위별 점수 보기').click();
    await expect(comparison.getByText('84.5점 (+0.2점)')).toBeVisible();
    await expect(comparison.getByText('84.9점 (-0.2점)')).toBeVisible();
    await page.getByRole('button', { name: '대화', exact: true }).click();
    await page.locator('.consulting-written-chat footer textarea').fill('운영팀 상담 답변');
    await page.getByRole('button', { name: '전송', exact: true }).click();
    await expect(page.locator('.consulting-written-messages')).toContainText('운영팀 상담 답변');
    const calls = await page.evaluate(() => window.__adminWritten.calls);
    expect(calls.filter(call => call.type === 'counselor_send_written_message')).toHaveLength(1);
    expect(calls.some(call => call.type.startsWith('student_'))).toBe(false);
});

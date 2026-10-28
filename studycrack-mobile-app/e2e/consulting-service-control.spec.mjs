import { expect, test } from '@playwright/test';
test('보류 중인 학생 홈은 완료로 오인하지 않고 다음 단계 변경을 제공하지 않는다', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('userRole', 'student'));
    await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.hasClientSession = () => true; window.apiFetch = async () => new Response(JSON.stringify({success:true,data:{available:true,workflowState:'SURVEY_DRAFT',serviceHold:true,nextAction:null,nextDueAt:null,progress:['onboarding','survey','materials','written_consultation','report','final_call'].map((step,index)=>({step,status:index===1?'current':index===0?'completed':'upcoming'})),session:null,report:null,alerts:[]}}));` }));
    await page.goto('/2027-jungsi-consulting/home', { waitUntil: 'domcontentloaded' }); await expect(page.getByRole('heading', { name: '서비스가 일시 보류되었습니다.' })).toBeVisible(); await expect(page.getByText('보류 중에는 입력·변경과 자동 처리가 진행되지 않습니다.', { exact: false })).toBeVisible(); await expect(page.getByRole('button', { name: '다음 단계로 이동' })).toHaveCount(0); await expect(page.getByText('모든 컨설팅 과정이 완료되었습니다.')).toHaveCount(0);
});

import { expect, test } from '@playwright/test';

const applicationId = 'APP_11111111-1111-4111-8111-111111111111', sourceResponseId = 'RESPONSE_SYNTHETIC_1';
const reference = { applicationId, sourceResponseId };
const scripts = ['navigation.js', '../admin_ui.js', 'notices.js', 'consulting.js', 'consulting-supplements.js', 'consulting-intake.js', 'consulting-materials.js', 'consulting-scheduling.js', 'consulting-operations.js', 'consulting-workspace.js', 'calculator.js'];
async function prepare(page, options = {}) {
    const response = await page.request.get('/admin_index.html'); expect(response.ok()).toBe(true);
    const original = await response.text(); expect(original).toMatch(/\/js\/admin\/calculator\.js\?v=/);
    const html = original.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const bootstrap = `<script>
        localStorage.setItem('userId','synthetic-admin'); localStorage.setItem('userRole','admin');
        window.CONFIG={api:{consulting:'/synthetic-api',noti:'/synthetic-api',qna:'/synthetic-api',file:'/synthetic-api'}};
        window.ADMIN_API_URL='/synthetic-api'; window.Store={get:()=>null};
        window.apiFetch=async(_url, options)=>{const response=await fetch('/synthetic-api',options);if(!response.ok)throw Object.assign(new Error('Synthetic failure'),{status:response.status});return response;};
        window.__ancillary=[];
        for(const name of ['loadAdminStats','populateTutorFilter','searchStudents','fetchUnreadNotiCount','fetchQnaBadgeCount','loadMatchingData','clearStudentJoinDateRange','loadTutorStats','loadAllQna'])window[name]=()=>window.__ancillary.push(name);
    </script>`;
    const document = html.replace('</body>', bootstrap + scripts.map(src => `<script src="/js/admin/${src}"></script>`).join('') + '</body>');
    const state = { calls: [], scope: 'calculator', emptyFirst: false, defer: false, release: null, failure: false, ...options };
    const contact = { studentName: '가상 계산기 학생', phone: '01000000000', email: 'calculator@example.invalid', payerName: '가상 입금자' };
    state.detail = { scope: 'calculator', sourceResponseId, stage: 'DEV', campaignReady: true, contact, reviewNotices: [],
        application: { applicationId, productType: 'calculator', applicationState: 'PAYMENT_REVIEW', paymentReviewStatus: 'pending', revision: 0, expectedAmount: 25000 },
        calculator: { state: 'pending_payment', phase: 'intake', stateLabel: '입금 확인 대기', nextAction: '입금 확인·승인', expiresAt: '2027-01-07T14:59:59.999Z', accountLinked: false, canApprove: true, canReviewInput: true, canReviewPayment: true, canReissue: false } };
    await page.route(/\/admin(?:_index\.html)?(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/html', body: document }));
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/synthetic-api', async route => {
        const request = route.request().postDataJSON(); state.calls.push(request);
        const { type, data: input } = request; let data;
        if (type === 'admin_get_notifications') return route.fulfill({ json: { notifications: [], sentNotices: [] } });
        if (['admin_list_v2_material_review', 'admin_list_written_unread'].includes(type)) data = { items: [], hasMore: false, nextCursor: null };
        else if (type === 'admin_list_calculator_applications') data = { scope: state.scope, productType: 'calculator',
            items: state.emptyFirst && !input.cursor || !['all', state.detail.calculator.phase].includes(input.phase) ? [] : [{ ...reference, productType: 'calculator', studentNameMask: '가* 학생', phoneMask: '010-****-0000', stateLabel: state.detail.calculator.stateLabel, nextAction: state.detail.calculator.nextAction, accessEndsAt: state.detail.calculator.expiresAt }],
            nextCursor: state.emptyFirst && !input.cursor ? 'synthetic_cursor' : null };
        else if (type === 'admin_get_calculator_application') {
            if (state.defer) await new Promise(resolve => { state.release = resolve; });
            data = { ...state.detail, scope: state.scope };
        } else if (type === 'admin_preview_calculator_review_notice') data = { applicationId, revision: state.detail.application.revision, willQueue: true, recipient: '010-****-0000', message: '[스터디크랙] 합격 계산기 신청을 보류했습니다.', previewToken: 'synthetic_preview_token' };
        else if (type === 'admin_verify_calculator_payment') {
            if (state.failure) return route.fulfill({ status: 500, json: { success: false } });
            Object.assign(state.detail.application, { revision: 2, applicationState: 'INVITED', paymentReviewStatus: 'verified' });
            Object.assign(state.detail, { activeInviteId: 'INVITE_synthetic' });
            Object.assign(state.detail.calculator, { state: 'activation_required', phase: 'onboarding', stateLabel: '이용 인증 대기', canApprove: false, canReviewInput: false, canReviewPayment: false, canReissue: true });
            data = { applicationId };
        } else if (type === 'admin_review_calculator_input') { state.detail.application.revision++; Object.assign(state.detail.contact, input.input); data = { applicationId }; }
        else if (type === 'admin_hold_calculator_payment' || type === 'admin_reject_calculator_application') {
            state.detail.application.revision++; state.detail.reviewNotices = [{ decision: type.includes('hold') ? 'hold' : 'reject', status: 'pending', createdAt: '2026-11-20T00:00:00.000Z' }]; data = { applicationId };
        } else if (type === 'admin_reissue_calculator_invite') { state.detail.application.revision++; data = { applicationId }; }
        else throw new Error('Unexpected synthetic request: ' + type);
        await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/admin_index.html' + (options.hash || '#calculator?phase=all'));
    return state;
}
async function openDetail(page) {
    await expect(page.locator('#calculatorAdminListStatus')).toHaveAttribute('data-state', 'success');
    await page.getByRole('button', { name: '계산기 신청 상세', exact: true }).click();
    await expect(page.locator('#calculatorAdminDetailContent')).toBeVisible();
}
async function fillPayment(page) {
    await page.locator('#section-calculator').getByLabel('실제 입금액', { exact: true }).fill('25000');
    await page.locator('#section-calculator').getByLabel('입금 시각 (기기 현지 시각)', { exact: true }).fill('2026-11-19T22:00');
    await page.locator('#section-calculator').getByLabel('입금자명을 직접 대조했습니다', { exact: true }).check();
}

test('별도 계산기 메뉴에서 신청자·이용 상태를 확인하고 320px와 데스크톱에서 표시한다', async ({ page }, testInfo) => {
    const state = await prepare(page); await openDetail(page);
    await expect(page.locator('#calculatorAdminFacts')).toContainText('가상 계산기 학생');
    await expect(page.locator('#calculatorAdminFacts')).toContainText('25,000원');
    await expect(page.locator('#calculatorAdminFacts')).toContainText('연결 확인 전');
    expect(state.calls.some(call => call.type.includes('consulting_student') || call.type.includes('schedule'))).toBe(false);
    await expect(page).toHaveURL(/#calculator\?phase=all&student=APP_/);
    await page.setViewportSize({ width: 320, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('calculator-admin-320.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 }); await expect(page.locator('#calculatorAdminApprove')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('calculator-admin-desktop.png'), fullPage: true });
});
test('입금 승인은 필수 대조와 최종 확인 후 한 번만 전송하며 인증 대기로 전환한다', async ({ page }) => {
    const state = await prepare(page); await openDetail(page);
    await page.locator('#calculatorAdminApprove').click();
    expect(state.calls.filter(x => x.type === 'admin_verify_calculator_payment')).toHaveLength(0);
    await fillPayment(page);
    page.once('dialog', dialog => dialog.dismiss()); await page.locator('#calculatorAdminApprove').click();
    expect(state.calls.filter(x => x.type === 'admin_verify_calculator_payment')).toHaveLength(0);
    page.once('dialog', dialog => dialog.accept()); await page.locator('#calculatorAdminApprove').click();
    await expect(page.locator('#calculatorAdminDetailStatus')).toContainText('입금 승인 및 이용 안내를 예약');
    const calls = state.calls.filter(x => x.type === 'admin_verify_calculator_payment'); expect(calls).toHaveLength(1);
    expect(calls[0].data).toMatchObject({ ...reference, expectedRevision: 0, paidAmount: 25000, payerNameConfirmed: true, reasonCode: 'MANUAL_BANK_MATCH' });
    expect(calls[0].data.idempotencyKey).toMatch(/^calculator-payment:/);
    await expect(page.locator('#calculatorAdminFacts')).toContainText('이용 인증 대기');
    await expect(page.locator('#calculatorAdminApprove')).toBeHidden();
    page.once('dialog', dialog => dialog.accept()); await page.locator('#calculatorAdminReissue').click();
    await expect.poll(() => state.calls.filter(x => x.type === 'admin_reissue_calculator_invite').length).toBe(1);
});
test('계산기 연락처 네 항목만 수정하고 입금 승인은 따로 수행한다', async ({ page }) => {
    const state = await prepare(page); await openDetail(page);
    await page.locator('#section-calculator').getByText('신청 정보 확인·수정', { exact: true }).click();
    await page.locator('#calculatorAdminName').fill('수정 학생');
    await page.getByRole('button', { name: '계산기 신청 정보 저장', exact: true }).click();
    expect(state.calls.filter(x => x.type === 'admin_review_calculator_input')).toHaveLength(0);
    await page.locator('#calculatorAdminInputConfirmed').check();
    await page.getByRole('button', { name: '계산기 신청 정보 저장', exact: true }).click();
    await expect(page.locator('#calculatorAdminDetailStatus')).toContainText('신청 정보를 확인·저장');
    const call = state.calls.find(x => x.type === 'admin_review_calculator_input');
    expect(Object.keys(call.data.input).sort()).toEqual(['email', 'payerName', 'phone', 'studentName']);
    expect(call.data.input.studentName).toBe('수정 학생');
    expect(state.calls.some(x => x.type === 'admin_verify_calculator_payment')).toBe(false);
});
test('보류·거절은 안내 미리보기와 최종 확인을 거치고 안내 이력을 표시한다', async ({ page }) => {
    const state = await prepare(page); await openDetail(page);
    await page.getByText('보류·거절 처리', { exact: true }).click();
    await page.locator('#calculatorAdminReason').fill('계좌 내역 확인 필요');
    const dismissed = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
    await page.getByRole('button', { name: '계산기 처리 안내 확인' }).click(); await dismissed;
    await expect(page.getByRole('button', { name: '계산기 처리 안내 확인' })).toBeEnabled();
    expect(state.calls.filter(x => x.type === 'admin_hold_calculator_payment')).toHaveLength(0);
    const accepted = page.waitForEvent('dialog').then(dialog => { expect(dialog.message()).toContain('합격 계산기'); return dialog.accept(); });
    await page.getByRole('button', { name: '계산기 처리 안내 확인' }).click(); await accepted;
    await expect(page.locator('#calculatorAdminDetailStatus')).toContainText('계산기 신청을 처리');
    const call = state.calls.find(x => x.type === 'admin_hold_calculator_payment'); expect(call.data.previewToken).toBe('synthetic_preview_token');
    await expect(page.locator('#calculatorAdminFacts')).toContainText('보류 · 발송 대기');
});
test('빈 첫 페이지에서도 계속 조회하고 필터·새로고침·뒤로가기를 복원한다', async ({ page }) => {
    const state = await prepare(page, { emptyFirst: true });
    await expect(page.locator('#calculatorAdminListStatus')).toHaveAttribute('data-state', 'success');
    await expect(page.locator('#calculatorAdminNext')).toBeEnabled(); await page.locator('#calculatorAdminNext').click();
    await openDetail(page); await page.reload(); await expect(page.locator('#calculatorAdminDetailContent')).toBeVisible();
    await page.getByRole('button', { name: '← 계산기 신청 목록', exact: true }).click();
    await page.getByRole('button', { name: '기간 종료', exact: true }).click();
    await expect(page).toHaveURL(/#calculator\?phase=expired$/);
    await expect(page.locator('#calculatorAdminListStatus')).toContainText('기간 종료');
    await page.goBack(); await expect(page.locator('#calculatorAdminListStatus')).toContainText('전체 신청');
    expect(state.calls.some(x => x.data?.cursor === 'synthetic_cursor')).toBe(true);
});
test('오래된 서버 응답과 불명확한 승인 실패는 개인정보·버튼을 지우고 자동 재전송하지 않는다', async ({ page }) => {
    const state = await prepare(page); await openDetail(page); await fillPayment(page); state.failure = true;
    page.once('dialog', dialog => dialog.accept()); await page.locator('#calculatorAdminApprove').click();
    await expect(page.locator('#calculatorAdminDetailStatus')).toContainText('자동으로 재전송하지 않습니다');
    await expect(page.locator('#calculatorAdminFacts')).toBeEmpty(); await expect(page.locator('#calculatorAdminName')).toHaveValue('');
    expect(state.calls.filter(x => x.type === 'admin_verify_calculator_payment')).toHaveLength(1);
    state.scope = 'consulting'; await page.getByRole('button', { name: '계산기 정보 새로고침' }).click();
    await expect(page.locator('#calculatorAdminDetailStatus')).toContainText('상세를 불러오지 못했습니다');
    await expect(page.locator('#calculatorAdminDetailContent')).toBeHidden();
});
test('메뉴·세션 전환 뒤 늦게 도착한 개인정보 응답을 표시하지 않는다', async ({ page }) => {
    const state = await prepare(page); await openDetail(page); state.defer = true;
    await page.getByRole('button', { name: '계산기 정보 새로고침' }).click();
    await expect.poll(() => typeof state.release).toBe('function');
    await page.evaluate(() => showSection('dashboard')); state.release();
    await expect(page.locator('#calculatorAdminFacts')).toBeEmpty(); await expect(page.locator('#calculatorAdminName')).toHaveValue('');
    state.defer = false; await page.evaluate(() => showSection('calculator')); await openDetail(page);
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended')));
    await expect(page.locator('#calculatorAdminFacts')).toBeEmpty(); await expect(page.locator('#calculatorAdminName')).toHaveValue('');
});

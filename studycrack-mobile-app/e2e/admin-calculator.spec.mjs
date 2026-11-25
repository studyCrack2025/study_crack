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
    state.detail = { scope: 'calculator', sourceResponseId, stage: 'DEV', campaignReady: true, contact, deletion: { available: options.deletionAvailable !== false }, reviewNotices: [],
        application: { applicationId, productType: 'calculator', applicationState: 'PAYMENT_REVIEW', paymentReviewStatus: 'pending', revision: 0, expectedAmount: 25000 },
        calculator: { state: 'pending_payment', phase: 'intake', stateLabel: '입금 확인 대기', nextAction: '입금 확인·승인', expiresAt: '2027-01-07T14:59:59.999Z', accountLinked: false, canApprove: true, canReviewInput: true, canReviewPayment: true, canReissue: false } };
    if (options.readOnly) Object.assign(state.detail, { readOnly: true,
        contact: { studentName: '가* 학생', phone: '010-****-0000', email: '', payerName: '' } });
    await page.route(/\/admin(?:_index\.html)?(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/html', body: document }));
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/synthetic-api', async route => {
        const request = route.request().postDataJSON(); state.calls.push(request);
        const { type, data: input } = request; let data;
        if (type === 'admin_get_notifications') return route.fulfill({ json: { notifications: [], sentNotices: [] } });
        if (['admin_list_v2_material_review', 'admin_list_written_unread'].includes(type)) data = { items: [], hasMore: false, nextCursor: null };
        else if (type === 'admin_list_calculator_applications') data = { scope: state.scope, productType: 'calculator',
            items: state.deleted || state.emptyFirst && !input.cursor || !['all', state.detail.calculator.phase].includes(input.phase) ? [] : [{ ...reference, productType: 'calculator', studentNameMask: '가* 학생', phoneMask: '010-****-0000', readOnly: state.crossEnvironment === true || state.detail.readOnly === true, managementAvailable: state.crossEnvironment === true, phase: state.detail.calculator.phase, stateLabel: state.detail.calculator.stateLabel, nextAction: state.detail.calculator.nextAction, accessEndsAt: state.detail.calculator.expiresAt }],
            nextCursor: state.emptyFirst && !input.cursor ? 'synthetic_cursor' : null, issueRows: state.issueRows || [], unavailableCount: state.issueRows?.length || 0 };
        else if (type === 'admin_get_calculator_application') {
            if (state.defer) await new Promise(resolve => { state.release = resolve; });
            data = { ...state.detail, scope: state.scope };
        } else if (type === 'admin_get_calculator_input') {
            data = structuredClone(state.savedInput);
            if (state.deferSaved) await new Promise(resolve => { state.release = resolve; });
        }
        else if (type === 'admin_preview_consulting_application_delete') {
            if (state.deferDeletePreview) await new Promise(resolve => { state.releaseDeletePreview = resolve; });
            data = { applicationId, confirmation: '신청 영구 삭제', previewToken: 'synthetic_delete_preview', backgroundSupported: true, storageIncluded: true, includesCase: false, resume: false, deletedCount: 0, recordCount: 5, ...state.deletePreview };
        } else if (type === 'admin_delete_consulting_application') {
            if (state.deferDelete) await new Promise(resolve => { state.releaseDelete = resolve; });
            if (state.failDelete) return route.fulfill({ status: 500, json: { success: false } });
            state.deleted = true;
            data = { applicationId, accepted: true, backgroundCleanup: true, complete: false, ...state.deleteResult };
        }
        else if (type === 'admin_preview_calculator_review_notice') data = { applicationId, revision: state.detail.application.revision, willQueue: true,
            channel: input.decision === 'hold' && input.reasonCode === 'PAYMENT_NOT_FOUND' ? 'kakao' : 'sms',
            recipient: '010-****-0000', message: '[스터디크랙] 합격 계산기 신청을 보류했습니다.', previewToken: 'synthetic_preview_token' };
        else if (type === 'admin_verify_calculator_payment') {
            if (state.failure) return route.fulfill({ status: 500, json: { success: false } });
            Object.assign(state.detail.application, { revision: 2, applicationState: 'INVITED', paymentReviewStatus: 'verified' });
            Object.assign(state.detail, { activeInviteId: 'INVITE_synthetic' });
            Object.assign(state.detail.calculator, { state: 'activation_required', phase: 'onboarding', stateLabel: '이용 인증 대기', canApprove: false, canReviewInput: false, canReviewPayment: false, canReissue: true });
            data = { applicationId };
        } else if (type === 'admin_review_calculator_input') { state.detail.application.revision++; Object.assign(state.detail.contact, input.input); data = { applicationId }; }
        else if (type === 'admin_hold_calculator_payment' || type === 'admin_reject_calculator_application') {
            const decision = type.includes('hold') ? 'hold' : 'reject';
            const channel = decision === 'hold' && input.reasonCode === 'PAYMENT_NOT_FOUND' ? 'kakao' : 'sms';
            state.detail.application.revision++;
            state.detail.reviewNotices = [{ decision, channel, status: 'pending', createdAt: '2026-11-20T00:00:00.000Z' }];
            data = { applicationId, notificationQueued: true };
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

test('다른 환경의 계산기 신청은 목록과 마스킹 상세에서 조회할 수 있다', async ({ page }) => {
    const state = await prepare(page, { readOnly: true });
    await expect(page.locator('#calculatorAdminListBody')).toContainText('조회 전용');
    await openDetail(page);
    await expect(page.locator('#calculatorAdminFacts')).toContainText('010-****-0000');
    await expect(page.locator('#calculatorAdminDetailStatus')).toContainText('조회만 할 수 있습니다');
    for (const id of ['calculatorAdminPayment', 'calculatorAdminReview', 'calculatorAdminDeleteSection', 'calculatorAdminSavedSection']) {
        await expect(page.locator('#' + id)).toBeHidden();
    }
    expect(state.calls.some(call => call.type === 'admin_get_calculator_input' || call.type === 'admin_verify_calculator_payment')).toBe(false);
});
test('자동 연결되는 다른 환경의 계산기 신청도 상세에서 승인할 수 있다', async ({ page }) => {
    const state = await prepare(page, { crossEnvironment: true });
    state.detail.stage = 'PROD';
    await expect(page.locator('#calculatorAdminListStatus')).toHaveAttribute('data-state', 'success');
    await expect(page.locator('#calculatorAdminListBody')).not.toContainText('조회 전용');
    await openDetail(page);
    await expect(page.locator('#calculatorAdminDetailStatus')).not.toContainText('조회만 할 수 있습니다');
    await expect(page.locator('#calculatorAdminPayment')).toBeVisible();
    await expect(page.locator('#calculatorAdminDeleteSection')).toBeVisible();
    await fillPayment(page);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#calculatorAdminApprove').click();
    await expect(page.locator('#calculatorAdminState')).toHaveText('이용 인증 대기');
    expect(state.calls.filter(call => call.type === 'admin_verify_calculator_payment')).toHaveLength(1);
    expect(state.calls.every(call => !Object.hasOwn(call.data || {}, 'stage') && !Object.hasOwn(call.data || {}, 'targetStage'))).toBe(true);
});
async function openDeletion(page) {
    await page.getByRole('button', { name: '계산기 신청 삭제', exact: true }).click();
    await expect(page.locator('#calculatorAdminDeleteStatus')).toContainText('확인 문구를 입력');
}

test('신청 삭제는 범위 확인·정확한 문구 후 한 번 접수하고 목록과 개인정보를 정리한다', async ({ page }, testInfo) => {
    const state = await prepare(page, { deferDelete: true }); await openDetail(page); await openDeletion(page);
    await expect(page.locator('#calculatorAdminDeleteTarget')).toHaveText('가상 계산기 학생 · 01000000000');
    await expect(page.locator('#calculatorAdminDeleteScope')).toContainText('회원 계정과 다른 신청은 유지');
    await expect(page.locator('#calculatorAdminDeleteConfirm')).toBeDisabled();
    await page.locator('#calculatorAdminDeleteConfirmation').fill('삭제');
    await expect(page.locator('#calculatorAdminDeleteConfirm')).toBeDisabled();
    expect(state.calls.filter(x => x.type === 'admin_delete_consulting_application')).toHaveLength(0);
    await page.locator('#calculatorAdminDeleteConfirmation').fill('신청 영구 삭제');
    await page.setViewportSize({ width: 320, height: 900 }); await assertLayout(page);
    await page.screenshot({ path: testInfo.outputPath('calculator-admin-delete-320.png'), fullPage: true });
    await page.locator('#calculatorAdminDeleteConfirm').click();
    await expect(page.locator('#calculatorAdminDeleteConfirm')).toBeDisabled();
    await expect(page.locator('#calculatorAdminDeleteCancel')).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(page.locator('#calculatorAdminDeleteDialog')).toBeVisible();
    await page.evaluate(() => { deleteCalculatorAdminApplication(); refreshCalculatorAdmin(); closeCalculatorAdminDetail(); });
    const calls = state.calls.filter(x => x.type === 'admin_delete_consulting_application'); expect(calls).toHaveLength(1);
    expect(calls[0].data).toEqual({ ...reference, previewToken: 'synthetic_delete_preview', confirmation: '신청 영구 삭제', backgroundCleanup: true });
    state.releaseDelete();
    await expect(page.locator('#calculatorAdminDeleteDialog')).toBeHidden();
    await expect(page.locator('#calculatorAdminListStatus')).toContainText('신청을 목록에서 제거');
    await expect(page.locator('#calculatorAdminListBody')).toContainText('신청이 없습니다');
    await expect(page.locator('#calculatorAdminFacts')).toBeEmpty();
    await expect(page.locator('#calculatorAdminDeleteTarget')).toBeEmpty();
    await expect(page.locator('#calculatorAdminEmail')).toHaveValue('');
});
test('삭제 창 취소와 권한 없는 상세에서는 삭제 요청을 보내지 않는다', async ({ page }) => {
    const state = await prepare(page); await openDetail(page); await openDeletion(page);
    await page.keyboard.press('Escape'); await expect(page.locator('#calculatorAdminDeleteDialog')).toBeHidden();
    expect(state.calls.filter(x => x.type === 'admin_delete_consulting_application')).toHaveLength(0);
    state.detail.deletion.available = false;
    await page.getByRole('button', { name: '계산기 정보 새로고침', exact: true }).click();
    await expect(page.locator('#calculatorAdminDetailContent')).toBeVisible();
    await expect(page.locator('#calculatorAdminDeleteSection')).toBeHidden();
    await page.evaluate(() => openCalculatorAdminDeletion());
    expect(state.calls.filter(x => x.type === 'admin_preview_consulting_application_delete')).toHaveLength(1);
});
for (const invalid of [{ applicationId: 'APP_other' }, { includesCase: true }, { backgroundSupported: false }, { previewToken: '' }]) test('삭제 범위가 잘못되면 전송을 막는다: ' + JSON.stringify(invalid), async ({ page }) => {
    const state = await prepare(page, { deletePreview: invalid }); await openDetail(page);
    await page.locator('#calculatorAdminDelete').click();
    await expect(page.locator('#calculatorAdminDeleteStatus')).toHaveAttribute('data-state', 'error');
    await page.locator('#calculatorAdminDeleteConfirmation').fill('신청 영구 삭제');
    await expect(page.locator('#calculatorAdminDeleteConfirm')).toBeDisabled();
    await page.evaluate(() => deleteCalculatorAdminApplication());
    expect(state.calls.filter(x => x.type === 'admin_delete_consulting_application')).toHaveLength(0);
    state.deletePreview = {};
    await page.locator('#calculatorAdminDeleteRetry').click();
    await expect(page.locator('#calculatorAdminDeleteStatus')).toContainText('확인 문구를 입력');
    await expect(page.locator('#calculatorAdminDeleteConfirmation')).toHaveValue('');
});
for (const mode of ['server-error', 'invalid-reply']) test('삭제 결과가 불확실하면 재전송을 막고 실제 목록 확인을 안내한다: ' + mode, async ({ page }) => {
    const state = await prepare(page, mode === 'server-error' ? { failDelete: true } : { deleteResult: { applicationId: 'APP_other' } });
    await openDetail(page); await openDeletion(page);
    await page.locator('#calculatorAdminDeleteConfirmation').fill('신청 영구 삭제'); await page.locator('#calculatorAdminDeleteConfirm').click();
    await expect(page.locator('#calculatorAdminDeleteStatus')).toContainText('자동 재전송하지 않습니다');
    await expect(page.locator('#calculatorAdminDeleteConfirm')).toBeDisabled(); await expect(page.locator('#calculatorAdminDeleteRetry')).toBeHidden();
    await page.evaluate(() => deleteCalculatorAdminApplication());
    expect(state.calls.filter(x => x.type === 'admin_delete_consulting_application')).toHaveLength(1);
    await page.locator('#calculatorAdminDeleteCancel').click(); await expect(page.locator('#calculatorAdminDeleteDialog')).toBeHidden();
});
test('세션 종료 후 늦게 도착한 삭제 대상 조회는 다시 표시하지 않는다', async ({ page }) => {
    const state = await prepare(page, { deferDeletePreview: true }); await openDetail(page); await page.locator('#calculatorAdminDelete').click();
    await expect.poll(() => typeof state.releaseDeletePreview).toBe('function');
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended')));
    state.releaseDeletePreview();
    await expect(page.locator('#calculatorAdminDeleteDialog')).toBeHidden(); await expect(page.locator('#calculatorAdminDeleteTarget')).toBeEmpty();
    await expect(page.locator('#calculatorAdminDeleteStatus')).toBeEmpty();
    expect(state.calls.filter(x => x.type === 'admin_delete_consulting_application')).toHaveLength(0);
});

test('계산기 목록·상세·입력 영역은 320~1280px에서 긴 정보와 버튼을 잘리지 않게 표시한다', async ({ page }, testInfo) => {
    const state = await prepare(page);
    state.detail.contact.email = 'long-address-'.repeat(15) + '@example.invalid';
    for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.locator('#calculatorAdminListBody tr')).toHaveCount(1);
        await assertLayout(page);
        if (width === 1280) await page.screenshot({ path: testInfo.outputPath('calculator-admin-list-desktop.png'), fullPage: true });
        await openDetail(page);
        await expect(page.locator('#calculatorAdminFacts')).toContainText('25,000원');
        await expect(page.locator('#calculatorAdminFacts')).toContainText(state.detail.contact.email);
        await page.locator('#calculatorAdminInput summary').click();
        await page.locator('#calculatorAdminReview summary').click();
        await assertLayout(page);
        if (width === 320 || width === 1280) await page.screenshot({ path: testInfo.outputPath('calculator-admin-detail-' + width + '.png'), fullPage: true });
        await page.getByRole('button', { name: '← 계산기 신청 목록', exact: true }).click();
        await expect(page.locator('#calculatorAdminListStatus')).toHaveAttribute('data-state', 'success');
    }
    expect(state.calls.some(call => call.type.includes('consulting_student') || call.type.includes('schedule'))).toBe(false);
});
async function assertLayout(page) {
    expect(await page.evaluate(() => {
        const section = document.getElementById('section-calculator'), boundary = section.getBoundingClientRect();
        const failures = [...section.querySelectorAll('button, input:not([type=checkbox]), select, textarea, .calculator-admin-card, .calculator-admin-table tr')].flatMap(node => {
            const rect = node.getBoundingClientRect();
            if (!rect.width || !rect.height) return [];
            return rect.left < Math.max(0, boundary.left) - 1 || rect.right > Math.min(innerWidth, boundary.right) + 1 || node.tagName === 'BUTTON' && rect.height < 44 ? [node.id || node.className] : [];
        });
        if (document.documentElement.scrollWidth > innerWidth + 1) failures.push('document overflow');
        return failures;
    })).toEqual([]);
}
test('빈 목록과 연결 확인 필요 신청도 모바일 카드와 점검 정보를 정상 표시한다', async ({ page }) => {
    const state = await prepare(page, { emptyFirst: true, issueRows: [{ ...reference, productType: 'calculator', issueCode: 'DIRECTORY_CASE_MISSING', studentNameMask: '가* 학생', phoneMask: '010-****-0000' }] });
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(page.locator('#calculatorAdminListStatus')).toContainText('확인 필요 1건');
    await expect(page.locator('#calculatorAdminListBody [data-directory-issue]')).toHaveCount(1);
    await page.getByText('점검 정보', { exact: true }).click();
    await expect(page.locator('#calculatorAdminListBody')).toContainText(applicationId); await assertLayout(page);
    await expect(page.getByRole('button', { name: '계산기 신청 상세', exact: true })).toHaveCount(0);
    state.issueRows = []; state.emptyFirst = false; state.deleted = true;
    await page.getByRole('button', { name: '계산기 정보 새로고침', exact: true }).click();
    await expect(page.locator('#calculatorAdminListBody')).toContainText('신청이 없습니다'); await assertLayout(page);
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
test('미입금 보류는 알림톡 미리보기와 최종 확인을 거치고 안내 이력을 표시한다', async ({ page }) => {
    const state = await prepare(page); await openDetail(page);
    await page.getByText('보류·거절 처리', { exact: true }).click();
    await page.locator('#calculatorAdminDecision').selectOption('hold');
    const dismissed = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
    await page.getByRole('button', { name: '계산기 처리 안내 확인' }).click(); await dismissed;
    await expect(page.getByRole('button', { name: '계산기 처리 안내 확인' })).toBeEnabled();
    expect(state.calls.filter(x => x.type === 'admin_hold_calculator_payment')).toHaveLength(0);
    const accepted = page.waitForEvent('dialog').then(dialog => {
        expect(dialog.message()).toContain('합격 계산기');
        expect(dialog.message()).toContain('알림톡 수신처 · 010-****-0000');
        return dialog.accept();
    });
    await page.getByRole('button', { name: '계산기 처리 안내 확인' }).click(); await accepted;
    await expect(page.locator('#calculatorAdminDetailStatus')).toContainText('알림톡 안내를 예약했습니다');
    const calls = state.calls.filter(x => x.type === 'admin_hold_calculator_payment');
    expect(calls).toHaveLength(1);
    expect(calls[0].data).toMatchObject({ reasonCode: 'PAYMENT_NOT_FOUND', reasonText: '', previewToken: 'synthetic_preview_token' });
    await expect(page.locator('#calculatorAdminFacts')).toContainText('보류 · 발송 대기 · 알림톡');
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


test('관리자는 명시적으로 저장 자료를 열고 자기신고 성적·후보를 검수 점수와 구분한다', async ({ page }) => {
    const state = await prepare(page);
    state.savedInput = { contractVersion: 'calculator-input-v1', applicationId, revision: 3, status: 'saved', source: 'self_reported', reviewed: false, updatedAt: '2026-11-20T00:00:00.000Z',
        input: { scores: { admissionYear: 2027, basis: 'official', exam: { kor: { opt: '언어와매체', std: 130, pct: 95, grd: 2 }, math: { opt: '미적분', std: 131, pct: 96, grd: 1 }, inq1: { name: '물리학Ⅰ', std: 65, pct: 95, grd: 2 }, inq2: { name: '화학Ⅰ', std: 64, pct: 94, grd: 2 }, eng: { grd: 2 }, hist: { grd: 1 } } }, targets: [{ university: '<img src=x onerror=alert(1)>', major: '예시학과', admissionUnitId: 'UNIT_SYNTHETIC_1' }] } };
    await openDetail(page); expect(state.calls.some(x => x.type === 'admin_get_calculator_input')).toBe(false);
    await page.getByRole('button', { name: '저장 성적·지원 후보 보기', exact: true }).click();
    await expect(page.locator('#calculatorAdminSavedInput')).toContainText('표준점수 130');
    await expect(page.locator('#calculatorAdminSavedInput')).toContainText('3판');
    await expect(page.locator('#calculatorAdminSavedInput')).toContainText('<img src=x onerror=alert(1)>');
    await expect(page.locator('#calculatorAdminSavedInput img')).toHaveCount(0);
    await expect(page.locator('#calculatorAdminSavedStatus')).toContainText('검수 완료 성적으로 반영되지 않습니다');
    state.savedInput.applicationId = 'APP_22222222-2222-4222-8222-222222222222';
    await page.getByRole('button', { name: '저장 성적·지원 후보 보기', exact: true }).click();
    await expect(page.locator('#calculatorAdminSavedStatus')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('#calculatorAdminSavedInput')).toBeEmpty();
    state.savedInput.applicationId = applicationId; state.deferSaved = true; state.release = null;
    await page.getByRole('button', { name: '저장 성적·지원 후보 보기', exact: true }).click();
    await expect.poll(() => typeof state.release).toBe('function');
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended'))); state.release();
    await expect(page.locator('#calculatorAdminSavedInput')).toBeEmpty(); await expect(page.locator('#calculatorAdminSavedStatus')).toBeEmpty();
});

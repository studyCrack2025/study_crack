import { expect, test } from '@playwright/test';

async function source(page, path) {
    const response = await page.request.get(`/${path}`);
    expect(response.ok(), `Preview asset is required: ${path}`).toBe(true);
    return response.text();
}
const applicationId = 'APP_11111111-1111-4111-8111-111111111111';

async function prepare(page) {
    await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto('http://localhost');
    const html = (await source(page, 'admin_index.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
    await page.setContent(html);
    for (const file of ['css/admin_theme.css', 'css/admin_consulting.css']) await page.addStyleTag({ content: await source(page, file) });
    await page.evaluate(id => {
        window.CONFIG = { api: { consulting: '/synthetic/consulting', noti: '/synthetic/noti', qna: '/synthetic/qna' } };
        window.__calls = [];
        window.__detail = {
            application: { applicationId: id, applicationState: 'PAYMENT_REVIEW', paymentReviewStatus: 'pending', expectedAmount: 300000, revision: 0, studentNameMask: '가*생', phoneMask: '010****0000', payerNameMask: '가*자' },
            contact: { studentName: '<img src=x onerror=alert(1)>', phone: '01000000000', email: 'synthetic@example.invalid', payerName: 'Synthetic payer' },
            contactMethod: 'email', payerRelationship: 'other', payerRelationshipDetail: '<svg onload=alert(1)>', studentStatus: 'senior'
        };
        window.apiFetch = async (url, options) => {
            const request = JSON.parse(options.body);
            window.__calls.push({ url, ...request });
            let data;
            const app = window.__detail.application;
            const student = {
                applicationId: id, sourceResponseId: 'SYNTHETIC_INTAKE_RECORD', phase: app.applicationState === 'INVITED' ? 'onboarding' : 'intake',
                studentNameMask: app.studentNameMask, phoneMask: app.phoneMask,
                stateLabel: app.inputReviewRequired ? '신청 정보 보완 필요' : '입금 확인 대기', nextAction: '신청·입금 확인'
            };
            if (request.type === 'admin_list_consulting_students') {
                data = { items: [student], nextCursor: null };
            } else if (request.type === 'admin_get_consulting_student') {
                if (window.__detailFailure) throw Object.assign(new Error('Synthetic detail failure'), { status: 503 });
                data = { ...structuredClone(window.__detail), student };
            } else if (request.type === 'admin_preview_application_review_notice') {
                data = { applicationId: id, revision: app.revision, willQueue: true, recipient: '010-****-0000',
                    message: '정시 컨설팅 신청 진행이 어렵습니다. 스터디크랙 공식 카카오톡 채널로 문의해 주세요.', previewToken: 'fixture-notice-preview' };
            } else {
                if (window.__mutationFailure) throw Object.assign(new Error('Synthetic mutation failure'), { status: 409 });
                if (window.__deferMutation) await new Promise(resolve => { window.__resolveMutation = resolve; });
                if (request.type === 'admin_verify_manual_payment') Object.assign(app, { applicationState: 'INVITED', paymentReviewStatus: 'verified', revision: 1 });
                if (request.type === 'admin_reject_application') {
                    Object.assign(app, { applicationState: 'REJECTED', paymentReviewStatus: 'rejected', revision: 1 });
                    window.__detail.reviewNotices = [{ decision: 'reject', status: 'pending', createdAt: '2026-11-10T10:00:00Z' }];
                }
                if (request.type === 'admin_review_application_input') {
                    for (const field of ['studentName', 'phone', 'email', 'payerName']) window.__detail.contact[field] = request.data.input[field];
                    for (const field of ['payerRelationship', 'contactMethod', 'studentStatus']) window.__detail[field] = request.data.input[field];
                    Object.assign(window.__detail.application, { inputReviewRequired: false, paymentReviewStatus: 'pending', intakeIssues: [], revision: request.data.expectedRevision + 1 });
                    data = { applicationId: id, revision: window.__detail.application.revision, inputReviewRequired: false };
                } else data = { applicationId: id, applicationState: app.applicationState, revision: app.revision, notificationQueued: request.type === 'admin_reject_application' };
            }
            return { json: async () => ({ success: true, data }) };
        };
    }, applicationId);
    for (const file of ['js/admin/navigation.js', 'js/admin_ui.js', 'js/admin/consulting.js', 'js/admin/consulting-intake.js', 'js/admin/consulting-workspace.js']) await page.addScriptTag({ content: await source(page, file) });
    await page.locator('a[onclick="showSection(\'consulting\')"]').click();
    await expect(page.locator('#consultingDirectoryStatus')).toHaveAttribute('data-state', 'success');
}

async function openDetail(page) {
    await page.getByRole('button', { name: '학생 상세', exact: true }).click();
    await expect(page.locator('#consultingApplicationDetail')).toBeVisible();
}

async function fillPayment(page) {
    await page.locator('#consultingPaidAmount').fill('300000');
    await page.locator('#consultingPaidAt').fill('2026-10-20T10:00');
    await page.locator('#consultingPayerConfirmed').check();
}

test('정시 메뉴는 마스킹 목록을 조회하고 상세의 입력값을 HTML로 실행하지 않는다', async ({ page }) => {
    await prepare(page);
    await expect(page.locator('#consultingDirectoryBody')).toContainText('가*생');
    await expect(page.locator('#consultingDirectoryBody')).toContainText('010****0000');
    await expect(page.locator('#consultingDirectoryBody')).not.toContainText('synthetic@example.invalid');
    await openDetail(page);
    await expect(page.locator('#consultingDetailSummary')).toContainText('synthetic@example.invalid');
    await expect(page.locator('#consultingDetailSummary')).toContainText('<svg onload=alert(1)>');
    await expect(page.locator('#consultingDetailSummary img, #consultingDetailSummary svg')).toHaveCount(0);
    await expect(page.locator('#consultingPaidAmount')).toHaveValue('');
    await expect(page.locator('#consultingPaidAt')).toHaveValue('');
    await expect(page.locator('#consultingPaymentActions')).toBeVisible();
    await expect(page.locator('#consultingInviteActions')).toBeHidden();
    await expect(page.locator('#consultingDetailSummary')).toContainText('고3');
    expect(await page.locator('#consultingIntakePanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

test('상세 닫기와 다른 메뉴 이동은 개인정보를 제거하고 새로 조회할 수 있다', async ({ page }) => {
    await prepare(page);
    await openDetail(page);
    await page.getByRole('button', { name: '← 학생 목록', exact: true }).click();
    await expect(page.locator('#consultingDetailSummary')).toBeEmpty();
    await openDetail(page);
    await expect(page.locator('#consultingDetailSummary')).toContainText('synthetic@example.invalid');
    await page.locator('a[onclick="showSection(\'students\')"]').click();
    await expect(page.locator('#consultingDetailSummary')).toBeEmpty();
});

test('입금 승인 취소는 서버 변경 없이 종료한다', async ({ page }) => {
    await prepare(page);
    await openDetail(page);
    await fillPayment(page);
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#consultingApproveBtn').click();
    expect(await page.evaluate(() => window.__calls.filter(call => call.type === 'admin_verify_manual_payment').length)).toBe(0);
    await expect(page.locator('#consultingApplicationDetail')).toBeVisible();
});

test('거절 메모는 펼쳐서 입력하고 최종 확인 뒤 선택한 신청에만 보낸다', async ({ page }) => {
    await prepare(page);
    await openDetail(page);
    const reject = page.getByRole('button', { name: '신청 거절', exact: true });
    await expect(reject).toBeHidden();
    await page.locator('#consultingPaymentAlternatives > summary').click();
    await page.getByLabel('거절 사유').selectOption('OTHER');
    await reject.click();
    await expect(page.locator('#consultingStatus')).toContainText('기타 사유는 필수');
    await page.getByLabel('거절 메모').fill('합성 테스트 신청 정리');
    const preview = page.waitForEvent('dialog');
    const click = reject.click();
    const dialog = await preview;
    const message = dialog.message();
    await dialog.dismiss();
    await click;
    expect(message).toContain('010-****-0000');
    expect(message).toContain('스터디크랙 공식 카카오톡 채널');
    expect(message).not.toContain('합성 테스트 신청 정리');
    expect(await page.evaluate(() => window.__calls.filter(call => call.type === 'admin_reject_application').length)).toBe(0);
    page.once('dialog', dialog => dialog.accept());
    await reject.click();
    await expect(page.locator('#consultingActionStatus')).toContainText('신청 거절 완료');
    const calls = await page.evaluate(() => window.__calls.filter(call => call.type === 'admin_reject_application'));
    expect(calls).toHaveLength(1);
    expect(calls[0].data).toMatchObject({ applicationId, expectedRevision: 0, reasonCode: 'OTHER', reasonText: '합성 테스트 신청 정리', previewToken: 'fixture-notice-preview' });
    await expect(page.locator('#consultingPaymentActions')).toBeHidden();
    await expect(page.locator('#consultingDetailSummary')).toContainText('발송 예약');
});

test('승인 중 모든 변경 버튼을 잠그고 완료 후 발송 예약 결과를 유지한다', async ({ page }) => {
    await prepare(page);
    await openDetail(page);
    await fillPayment(page);
    await page.locator('#consultingPaymentAlternatives > summary').click();
    await page.evaluate(() => { window.__deferMutation = true; });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#consultingApproveBtn').click();
    await expect(page.getByRole('button', { name: '보류', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '신청 거절', exact: true })).toBeDisabled();
    await expect(page.locator('#consultingPaidAmount')).toBeDisabled();
    await page.evaluate(() => { window.__detailFailure = true; window.__resolveMutation(); });
    await expect(page.locator('#consultingActionStatus')).toContainText('입금 승인 및 초대 발송 예약 완료');
    await expect(page.locator('#consultingActionStatus')).toContainText('별도 확인');
    await expect(page.locator('#consultingStudentStatus')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('#consultingDetailSummary')).toBeEmpty();
    expect(await page.evaluate(() => window.__calls.filter(call => call.type === 'admin_verify_manual_payment').length)).toBe(1);
});

test('승인 충돌은 오래된 상세를 닫고 재조회 안내만 표시한다', async ({ page }) => {
    await prepare(page);
    await openDetail(page);
    await fillPayment(page);
    await page.evaluate(() => { window.__mutationFailure = true; });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#consultingApproveBtn').click();
    await expect(page.locator('#consultingActionStatus')).toContainText('학생 상세를 다시 조회');
    await expect(page.locator('#consultingApplicationDetail')).toBeHidden();
    expect(await page.evaluate(() => window.__calls.filter(call => call.type === 'admin_verify_manual_payment').length)).toBe(1);
});

test('초대 상태는 승인 폼 대신 명시적 재발급만 제공하고 세션 종료 시 지운다', async ({ page }) => {
    await prepare(page);
    await page.evaluate(() => {
        window.__detail.application.applicationState = 'INVITED';
        window.__detail.application.paymentReviewStatus = 'verified';
        window.__detail.activeInviteId = 'synthetic-invite';
    });
    await openDetail(page);
    await expect(page.locator('#consultingPaymentActions')).toBeHidden();
    await expect(page.locator('#consultingInviteActions')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended')));
    await expect(page.locator('#consultingDetailSummary')).toBeEmpty();
    await expect(page.locator('#consultingApplicationDetail')).toBeHidden();
});

test('데스크톱에서도 상세와 승인 폼은 패널 밖으로 넘치지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await prepare(page);
    await openDetail(page);
    expect(await page.locator('#consultingIntakePanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});
test('초대 취소는 환경이 확인된 미사용 초대만 노출하고 사유와 최종 확인을 보낸다', async ({ page }) => {
    await prepare(page); await page.evaluate(() => { window.__detail.application.applicationState = 'INVITED'; window.__detail.activeInviteId = 'INVITE_synthetic'; }); await openDetail(page); await expect(page.locator('#consultingRevokeBtn')).toBeHidden();
    await page.getByRole('button', { name: '← 학생 목록', exact: true }).click(); await page.evaluate(() => { window.__detail.stageVerified = true; }); await openDetail(page);
    page.once('dialog', dialog => dialog.dismiss()); await page.locator('#consultingRevokeBtn').click(); expect(await page.evaluate(() => window.__calls.filter(x => x.type === 'admin_revoke_consulting_invite').length)).toBe(0);
    page.on('dialog', dialog => dialog.accept(dialog.type() === 'prompt' ? '잘못 발급한 합성 초대를 취소함' : undefined)); await page.locator('#consultingRevokeBtn').click(); await expect(page.locator('#consultingActionStatus')).toContainText('미사용 초대 취소 완료');
    const request = await page.evaluate(() => window.__calls.find(x => x.type === 'admin_revoke_consulting_invite')); expect(request.data.applicationId).toBe(applicationId); expect(request.data.expectedRevision).toBe(0); expect(request.data.reason).toBe('잘못 발급한 합성 초대를 취소함');
});

async function prepareInputReview(page) {
    await prepare(page);
    await page.evaluate(() => {
        Object.assign(window.__detail.application, { inputReviewRequired: true, paymentReviewStatus: 'input_review', intakeIssues: [{ field: 'phone', code: 'PHONE_FORMAT' }, { field: 'email', code: 'EMAIL_FORMAT' }] });
        Object.assign(window.__detail.contact, { studentName: '합성2', phone: '', email: 'invalid-email' });
        window.__detail.originalSubmission = { studentName: '합성2', phone: '', email: '<svg onload=alert(1)>', studentStatus: ['senior'] };
        return window.loadConsultingDirectory();
    });
    await expect(page.locator('#consultingDirectoryBody')).toContainText('신청 정보 보완 필요');
    await openDetail(page);
}

test('입력 오류 접수는 원본을 보존하고 확인 전 승인 요청을 보내지 않는다', async ({ page }) => {
    await prepareInputReview(page);
    await expect(page.locator('#consultingInputIssues')).toContainText('접수는 저장됐습니다');
    await expect(page.locator('#consultingApproveBtn')).toBeDisabled();
    await page.locator('#consultingOriginalDetails summary').click();
    await expect(page.locator('#consultingOriginalSubmission')).toContainText('<svg onload=alert(1)>');
    await expect(page.locator('#consultingOriginalSubmission svg')).toHaveCount(0);
    await page.locator('#consultingSaveInputBtn').click();
    expect(await page.evaluate(() => window.__calls.filter(x => x.type === 'admin_review_application_input').length)).toBe(0);
    await page.evaluate(() => window.approveConsultingPayment());
    expect(await page.evaluate(() => window.__calls.filter(x => x.type === 'admin_verify_manual_payment').length)).toBe(0);
});

test('같은 접수의 정보를 확인·저장하면 원본은 유지하고 승인 준비 상태를 새로 조회한다', async ({ page }) => {
    await prepareInputReview(page);
    await page.locator('#consultingContactPhone').fill('01000000000');
    await page.locator('#consultingContactEmail').fill('corrected@example.invalid');
    await page.locator('#consultingInputConfirmed').check();
    await page.locator('#consultingSaveInputBtn').click();
    await expect(page.locator('#consultingActionStatus')).toContainText('신청 정보 확인·저장 완료');
    await expect(page.locator('#consultingApplicationDetail')).toBeVisible();
    await expect(page.locator('#consultingApproveBtn')).toBeEnabled();
    await expect(page.locator('#consultingInputConfirmed')).not.toBeChecked();
    await expect(page.locator('#consultingPayerConfirmed')).not.toBeChecked();
    await expect(page.locator('#consultingContactEmail')).toHaveValue('corrected@example.invalid');
    await page.locator('#consultingOriginalDetails summary').click();
    await expect(page.locator('#consultingOriginalSubmission')).toContainText('<svg onload=alert(1)>');
    const calls = await page.evaluate(() => window.__calls);
    const request = calls.find(x => x.type === 'admin_review_application_input');
    expect(request.data.applicationId).toBe(applicationId);
    expect(request.data.expectedRevision).toBe(0);
    expect(request.data.inputReviewConfirmed).toBe(true);
    expect(calls.filter(x => x.type === 'admin_verify_manual_payment')).toHaveLength(0);
});

test('보완 저장 실패는 원본과 수정 입력을 지우며 자동 재전송하지 않는다', async ({ page }) => {
    await prepareInputReview(page);
    await page.locator('#consultingContactPhone').fill('01000000000');
    await page.locator('#consultingContactEmail').fill('corrected@example.invalid');
    await page.locator('#consultingInputConfirmed').check();
    await page.evaluate(() => { window.__mutationFailure = true; });
    await page.locator('#consultingSaveInputBtn').click();
    await expect(page.locator('#consultingActionStatus')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('#consultingOriginalSubmission')).toBeEmpty();
    await expect(page.locator('#consultingContactEmail')).toHaveValue('');
    await expect(page.locator('#consultingApplicationDetail')).toBeHidden();
    expect(await page.evaluate(() => window.__calls.filter(x => x.type === 'admin_review_application_input').length)).toBe(1);
});

test('보완 입력은 320px에서 가로 넘침 없이 마지막 확인 버튼까지 접근한다', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await prepareInputReview(page);
    expect(await page.locator('#consultingInputEditor').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    for (const id of ['consultingContactStudentName', 'consultingContactPhone', 'consultingContactEmail', 'consultingSaveInputBtn']) expect(await page.locator(`#${id}`).evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.locator('#consultingSaveInputBtn').scrollIntoViewIfNeeded();
    await expect(page.locator('#consultingSaveInputBtn')).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('consulting-input-review-320.png'), fullPage: true });
});

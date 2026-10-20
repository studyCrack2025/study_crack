import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const source = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const applicationId = 'APP_11111111-1111-4111-8111-111111111111';

async function prepare(page) {
    await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto('http://localhost');
    const html = (await source('admin_index.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
    await page.setContent(html);
    for (const file of ['css/admin_theme.css', 'css/admin_consulting.css']) await page.addStyleTag({ content: await source(file) });
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
            if (request.type === 'admin_list_payment_review') {
                if (window.__listFailure) throw Object.assign(new Error('Synthetic list failure'), { status: 503 });
                data = { items: window.__approved ? [] : [window.__detail.application] };
            } else if (request.type === 'admin_get_application_detail') {
                data = structuredClone(window.__detail);
            } else {
                if (window.__mutationFailure) throw Object.assign(new Error('Synthetic mutation failure'), { status: 409 });
                if (window.__deferMutation) await new Promise(resolve => { window.__resolveMutation = resolve; });
                if (request.type === 'admin_verify_manual_payment') window.__approved = true;
                data = { applicationId: id, applicationState: 'INVITED', revision: 2 };
            }
            return { json: async () => ({ success: true, data }) };
        };
        window.loadConsultingMaterialReview = () => {};
    }, applicationId);
    for (const file of ['js/admin_ui.js', 'js/admin/consulting.js', 'js/admin/consulting-intake.js']) await page.addScriptTag({ content: await source(file) });
    await page.locator('a[onclick="showSection(\'consulting\')"]').click();
    await expect(page.locator('#consultingStatus')).toHaveAttribute('data-state', 'success');
}

async function openDetail(page) {
    await page.getByRole('button', { name: '상세 확인', exact: true }).click();
    await expect(page.locator('#consultingApplicationDetail')).toBeVisible();
}

async function fillPayment(page) {
    await page.locator('#consultingPaidAmount').fill('300000');
    await page.locator('#consultingPaidAt').fill('2026-10-20T10:00');
    await page.locator('#consultingPayerConfirmed').check();
}

test('정시 메뉴는 마스킹 목록을 조회하고 상세의 입력값을 HTML로 실행하지 않는다', async ({ page }) => {
    await prepare(page);
    await expect(page.locator('#consultingPaymentReviewBody')).toContainText('가*생 / 010****0000');
    await expect(page.locator('#consultingPaymentReviewBody')).not.toContainText('synthetic@example.invalid');
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
    await page.getByRole('button', { name: '상세 닫기', exact: true }).click();
    await expect(page.locator('#consultingDetailSummary')).toBeEmpty();
    await page.locator('#consultingApplicationLookup').fill(applicationId);
    await page.locator('#consultingApplicationLookup').press('Enter');
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

test('승인 중 모든 변경 버튼을 잠그고 완료 후 발송 예약 결과를 유지한다', async ({ page }) => {
    await prepare(page);
    await openDetail(page);
    await fillPayment(page);
    await page.evaluate(() => { window.__deferMutation = true; });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#consultingApproveBtn').click();
    await expect(page.getByRole('button', { name: '보류', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '신청 거절', exact: true })).toBeDisabled();
    await expect(page.locator('#consultingPaidAmount')).toBeDisabled();
    await page.evaluate(() => { window.__listFailure = true; window.__resolveMutation(); });
    await expect(page.locator('#consultingActionStatus')).toContainText('입금 승인 및 초대 발송 예약 완료');
    await expect(page.locator('#consultingActionStatus')).toContainText('별도 확인');
    await expect(page.locator('#consultingStatus')).toHaveAttribute('data-state', 'error');
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
    await expect(page.locator('#consultingActionStatus')).toContainText('신청 ID로 다시 조회');
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

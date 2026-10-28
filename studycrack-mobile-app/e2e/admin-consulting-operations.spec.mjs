import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
const source = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const caseId = 'CASE_123e4567-e89b-12d3-a456-426614174000';
async function prepare(page, { empty = false, report = false } = {}) {
    await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })); await page.goto('http://localhost');
    await page.setContent((await source('admin_index.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
    for (const file of ['css/admin_theme.css', 'css/admin_consulting.css']) await page.addStyleTag({ content: await source(file) });
    await page.evaluate(({ caseId, empty, report }) => {
        window.CONFIG = { api: { consulting: '/synthetic/consulting' } }; window.__calls = [];
        window.__detail = { caseId, reference: 'TASK#OUTBOX#EVT_synthetic001', snapshot: `sha256:${'a'.repeat(64)}`, label: '<img src=x onerror=alert(1)> 확인', status: 'open', destination: 'report', retryOutbox: { allowed: !report, reason: '동일 알림을 기존 식별자로 처리합니다.' }, retryReport: { allowed: report, reason: '원자료를 다시 검증합니다.' }, outbox: { attempts: 5, maxAttempts: 5, recoveryCount: 0 } };
        window.__empty = empty; window.__report = report;
        window.apiFetch = async (_url, options) => {
            const req = JSON.parse(options.body); window.__calls.push(req); let data;
            if (req.type === 'admin_list_consulting_operations') { if (window.__deferList) await new Promise(resolve => { window.__resolveList = resolve; }); data = { items: window.__empty ? [] : [window.__detail], nextCursor: req.data.cursor ? null : 'synthetic_cursor' }; }
            else if (req.type === 'admin_get_consulting_operation') data = structuredClone(window.__detail);
            else { if (window.__deferMutation) await new Promise(resolve => { window.__resolveMutation = resolve; }); if (window.__failMutation) throw new Error('Synthetic uncertain response'); data = { result: window.__report ? window.__reportResult || 'published' : 'queued' }; }
            return { json: async () => ({ success: true, data }) };
        };
        window.loadConsultingPaymentReview = () => {}; window.loadConsultingMaterialReview = () => {};
    }, { caseId, empty, report });
    for (const file of ['js/admin_ui.js', 'js/admin/consulting.js', 'js/admin/consulting-operations.js']) await page.addScriptTag({ content: await source(file) });
    await page.locator('a[onclick="showSection(\'consulting\')"]').click(); await expect(page.locator('#consultingOperationsStatus')).toContainText('현재 페이지');
}
async function detail(page) { await page.locator('#consultingOperationsBody').getByRole('button', { name: '내용 확인' }).click(); await expect(page.locator('#consultingOperationsDetail')).toBeVisible(); }
const mutations = page => page.evaluate(() => window.__calls.filter(x => x.type.startsWith('admin_retry_')));
test('빈 filtered page도 다음 페이지를 유지하고 입력을 텍스트로 표시한다', async ({ page }) => {
    await prepare(page, { empty: true }); await expect(page.locator('#consultingOperationsBody')).toContainText('표시할 항목이 없습니다'); await expect(page.locator('#consultingOperationsNext')).toBeEnabled();
    await page.evaluate(() => { window.__empty = false; }); await page.locator('#consultingOperationsNext').click(); await expect(page.locator('#consultingOperationsBody')).toContainText('<img src=x onerror=alert(1)>'); await expect(page.locator('#consultingOperationsBody img')).toHaveCount(0); await expect(page.locator('#consultingOperationsNext')).toBeDisabled();
    await detail(page); await expect(page.locator('#consultingOperationsSummary img')).toHaveCount(0); await expect(page.locator('#consultingRetryReportBtn')).toBeHidden();
});
test('사유와 확인을 요구하고 진행 중 중복 클릭을 막는다', async ({ page }) => {
    await prepare(page); await detail(page); await page.locator('#consultingRetryOutboxBtn').click(); expect(await mutations(page)).toHaveLength(0);
    await page.locator('#consultingOperationsReason').fill('알림 상태와 학생 케이스 확인 완료'); page.once('dialog', dialog => dialog.dismiss()); await page.locator('#consultingRetryOutboxBtn').click(); expect(await mutations(page)).toHaveLength(0);
    await page.evaluate(() => { window.__deferMutation = true; }); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingRetryOutboxBtn').click(); await expect(page.locator('#consultingOperationsReason')).toBeDisabled(); await expect(page.locator('#consultingRetryOutboxBtn')).toBeDisabled();
    await page.evaluate(() => window.__resolveMutation()); await expect(page.locator('#consultingOperationsStatus')).toContainText('다음 처리 주기'); await expect(page.locator('#consultingOperationsDetail')).toBeHidden(); expect(await mutations(page)).toHaveLength(1);
});
test('응답 유실 후 같은 요청 재확인은 동일 멱등 키를 보존한다', async ({ page }) => {
    await prepare(page); await detail(page); await page.locator('#consultingOperationsReason').fill('오류 원인을 확인하고\n재처리를 요청'); await page.evaluate(() => { window.__failMutation = true; });
    page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingRetryOutboxBtn').click(); await expect(page.locator('#consultingOperationsStatus')).toContainText('결과를 확인하지 못했습니다'); await expect(page.locator('#consultingOperationsDetail')).toBeVisible();
    await page.evaluate(() => { window.__failMutation = false; }); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingRetryOutboxBtn').click(); await expect(page.locator('#consultingOperationsStatus')).toContainText('재처리를 요청'); const requests = await mutations(page); expect(requests).toHaveLength(2); expect(requests[0].data).toEqual(requests[1].data); expect(requests[0].data.reason).toBe('오류 원인을 확인하고 재처리를 요청');
});
test('보고서 보류는 재검수로 안내한다', async ({ page }) => {
    await prepare(page, { report: true }); await detail(page); await expect(page.locator('#consultingRetryOutboxBtn')).toBeHidden(); await page.locator('#consultingOperationsReason').fill('예약 공개 상태와 원자료를 확인함'); await page.evaluate(() => { window.__reportResult = 'held'; }); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingRetryReportBtn').click(); await expect(page.locator('#consultingOperationsStatus')).toContainText('공개가 보류');
});
test('메뉴 이탈과 세션 종료 뒤 늦은 응답은 상세를 복원하지 않는다', async ({ page }) => {
    await prepare(page); await detail(page); await page.locator('#consultingOperationsReason').fill('화면을 나가기 전 입력한 사유'); await page.locator('a[onclick="showSection(\'students\')"]').click(); await expect(page.locator('#consultingOperationsSummary')).toBeEmpty(); await expect(page.locator('#consultingOperationsReason')).toHaveValue('');
    await page.evaluate(() => { window.__deferList = true; }); await page.locator('a[onclick="showSection(\'consulting\')"]').click(); await expect(page.locator('#consultingOperationsPanel')).toHaveAttribute('aria-busy', 'true'); await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__resolveList(); }); await expect(page.locator('#consultingOperationsStatus')).toBeEmpty(); await expect(page.locator('#consultingOperationsDetail')).toBeHidden();
});
test('320px과 데스크톱에서 복구 폼이 패널을 넘지 않는다', async ({ page }) => {
    for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 1000 }); await prepare(page); await detail(page); expect(await page.locator('#consultingOperationsPanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true); }
});
test('검수 대기 상태도 읽기 전용 업무 항목으로 구분한다', async ({ page }) => {
    await prepare(page); await page.evaluate(() => { window.__detail.status = 'pending_review'; window.__detail.label = 'AI 초안 확인'; window.__detail.retryOutbox.allowed = false; window.__detail.retryReport.allowed = false; });
    await page.getByRole('button', { name: '운영 목록 새로고침' }).click(); await expect(page.locator('#consultingOperationsBody')).toContainText('검수 대기'); await detail(page); await expect(page.locator('#consultingRetryOutboxBtn')).toBeHidden(); await expect(page.locator('#consultingRetryReportBtn')).toBeHidden();
});

import { expect, test } from '@playwright/test';
async function source(page, path) { const response = await page.request.get(`/${path}`); expect(response.ok(), `Required preview asset: ${path}`).toBe(true); return response.text(); }
function snapshot(ready = false) {
    return { contractVersion: 'consulting-data-readiness-v1', admissionYear: 2027, checkedAt: '2026-11-14T04:00:00.000Z', environment: 'DEV', summaryState: ready ? 'connections_checked' : 'needs_review',
        release: ready ? { id: 'ADMISSION_RELEASE_2027_TEST', digest: `sha256:${'a'.repeat(64)}` } : null, sharedUnitCount: ready ? 7 : null, studentCalculationVerified: false, canPublish: false,
        checks: ready ? [{ key: 'data_release', status: 'passed', code: 'DATA_CONNECTED', entryCount: null }, { key: 'cut_reference', status: 'passed', code: 'REFERENCE_CHECKED', entryCount: 10 }, { key: 'calculator_mapping', status: 'passed', code: 'MAPPING_CHECKED', entryCount: 9 }]
            : [{ key: 'data_release', status: 'blocked', code: 'DATA_NOT_CONFIGURED', entryCount: null }, { key: 'cut_reference', status: 'blocked', code: 'REFERENCE_REVIEW_REQUIRED', entryCount: null }, { key: 'calculator_mapping', status: 'blocked', code: 'MAPPING_REVIEW_REQUIRED', entryCount: null }] };
}
async function prepare(page, data = snapshot()) {
    await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })); await page.goto('http://localhost');
    await page.setContent((await source(page, 'admin_index.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
    await page.evaluate(() => { document.getElementById('section-consulting').replaceChildren(document.getElementById('consultingAdminTools')); });
    for (const file of ['css/admin_theme.css', 'css/admin_consulting.css']) await page.addStyleTag({ content: await source(page, file) });
    await page.evaluate(data => {
        window.CONFIG = { api: { consulting: '/synthetic/consulting' } }; window.__calls = []; window.__data = data;
        window.apiFetch = async (_url, options) => {
            const request = JSON.parse(options.body); window.__calls.push(request);
            if (request.type === 'admin_list_consulting_operations') return { json: async () => ({ success: true, data: { items: [], nextCursor: null } }) };
            if (request.type !== 'admin_get_consulting_data_readiness') throw new Error('Unexpected mutation');
            const value = structuredClone(window.__data);
            if (window.__defer) await new Promise(resolve => { window.__resolve = resolve; });
            if (window.__fail) throw new Error('Private server details must not display');
            return { json: async () => ({ success: true, data: value }) };
        };
    }, data);
    for (const file of ['js/admin_ui.js', 'js/admin/consulting.js', 'js/admin/consulting-operations.js', 'js/admin/consulting-data-readiness.js']) await page.addScriptTag({ content: await source(page, file) });
    await page.locator('a[onclick="showSection(\'consulting\')"]').click(); await page.locator('#consultingAdminTools > summary').click(); await page.locator('#consultingDataReadinessDetails > summary').click();
}
const calls = page => page.evaluate(() => window.__calls.filter(c => c.type === 'admin_get_consulting_data_readiness'));
const refresh = page => page.getByRole('button', { name: '준비 상태 확인', exact: true }).click();

test('자료는 필요할 때만 조회하고 미검수 상태의 다음 조치를 표시한다', async ({ page }) => {
    await prepare(page); expect(await calls(page)).toHaveLength(0); await refresh(page);
    await expect(page.locator('#consultingDataReadinessStatus')).toContainText('자료 준비가 남아'); await expect(page.locator('#consultingDataReadinessChecks li')).toHaveCount(3);
    await expect(page.locator('#consultingDataReadinessChecks')).toContainText('두 기준선의 출처'); await expect(page.locator('#consultingDataReadinessChecks')).not.toContainText('0개');
    expect(await calls(page)).toEqual([{ type: 'admin_get_consulting_data_readiness', data: {} }]);
    await page.locator('#consultingDataReadinessDetails > summary').click(); await page.locator('#consultingDataReadinessDetails > summary').click(); expect(await calls(page)).toHaveLength(1);
});
test('연결된 항목 수와 학생별 검수 필요를 분리하고 부분 실패를 표시한다', async ({ page }) => {
    await prepare(page, snapshot(true)); await refresh(page); await expect(page.locator('#consultingDataReadinessStatus')).toContainText('학생별 자격·환산 검수');
    await expect(page.locator('#consultingDataReadinessChecks')).toContainText('연결 항목 10개'); await expect(page.locator('#consultingDataReadinessMeta')).toContainText('공통 연결 학과 7개');
    await page.evaluate(() => { window.__data.checks[1] = { key: 'cut_reference', status: 'unavailable', code: 'REFERENCE_SOURCE_UNAVAILABLE', entryCount: null }; window.__data.sharedUnitCount = null; window.__data.summaryState = 'temporarily_unavailable'; });
    await refresh(page); await expect(page.locator('#consultingDataReadinessStatus')).toContainText('확인하지 못한 항목'); await expect(page.locator('#consultingDataReadinessChecks')).toContainText('기준선 출처를 확인하지 못했습니다'); await expect(page.locator('#consultingDataReadinessMeta')).not.toContainText('공통 연결 학과');
});
test('재조회 실패는 이전 정상 결과를 지우고 자동 반복 없이 재시도를 허용한다', async ({ page }) => {
    await prepare(page, snapshot(true)); await refresh(page); await expect(page.locator('#consultingDataReadinessChecks li')).toHaveCount(3);
    await page.evaluate(() => { window.__fail = true; }); await refresh(page); await expect(page.locator('#consultingDataReadinessStatus')).toContainText('불러오지 못했습니다'); await expect(page.locator('#consultingDataReadinessChecks li')).toHaveCount(0);
    await expect(page.locator('#consultingDataReadinessMeta')).toBeEmpty(); await expect(page.getByRole('button', { name: '준비 상태 확인', exact: true })).toBeEnabled(); expect(await calls(page)).toHaveLength(2);
});
test('중복 조회와 세션 종료 뒤 늦은 결과를 차단한다', async ({ page }) => {
    await prepare(page); await page.evaluate(() => { window.__defer = true; void loadConsultingDataReadiness(); void loadConsultingDataReadiness(); });
    await expect(page.locator('#consultingDataReadinessPanel')).toHaveAttribute('aria-busy', 'true'); expect(await calls(page)).toHaveLength(1);
    await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__resolve(); }); await expect(page.locator('#consultingDataReadinessChecks li')).toHaveCount(0); await expect(page.locator('#consultingDataReadinessStatus')).toBeEmpty(); await expect(page.locator('#consultingDataReadinessMeta')).toBeEmpty();
});
test('알 수 없는 응답과 거짓 정상 상태는 표시하지 않는다', async ({ page }) => {
    await prepare(page); await page.evaluate(() => { window.__data.checks[1].code = '<img src=x onerror=alert(1)>'; }); await refresh(page); await expect(page.locator('#consultingDataReadinessStatus')).toContainText('불러오지 못했습니다'); await expect(page.locator('#consultingDataReadinessChecks img')).toHaveCount(0);
    await page.evaluate(() => { window.__data.checks[1].code = 'REFERENCE_REVIEW_REQUIRED'; window.__data.checks[1].status = 'passed'; window.__data.summaryState = 'connections_checked'; });
    await refresh(page); await expect(page.locator('#consultingDataReadinessStatus')).toContainText('불러오지 못했습니다'); await expect(page.locator('#consultingDataReadinessChecks li')).toHaveCount(0);
});
test('모바일과 데스크톱에서 세 준비 항목과 버튼을 읽을 수 있다', async ({ page }, testInfo) => {
    await prepare(page); await refresh(page); await expect(page.locator('#consultingDataReadinessChecks li')).toHaveCount(3);
    for (const width of [390, 1365]) {
        await page.setViewportSize({ width, height: 960 }); await page.locator('#consultingDataReadinessPanel').scrollIntoViewIfNeeded();
        const size = await page.locator('#consultingDataReadinessPanel').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth })); expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
        await expect(page.getByRole('button', { name: '준비 상태 확인', exact: true })).toBeVisible();
        await page.locator('#consultingDataReadinessPanel').screenshot({ path: testInfo.outputPath(`readiness-${width}.png`) });
    }
});

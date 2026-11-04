import { expect, test } from '@playwright/test';

const applicationId = n => `APP_${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const caseId = 'CASE_22222222-2222-4222-8222-222222222222';
const record = n => `RESPONSE_SYNTHETIC_${n}`;
const scripts = ['js/admin/navigation.js', 'js/admin_ui.js', 'js/admin/notices.js', 'js/admin/consulting.js', 'js/admin/consulting-intake.js', 'js/admin/consulting-materials.js', 'js/admin/consulting-scheduling.js', 'js/admin/consulting-operations.js', 'js/admin/consulting-workspace.js'];
async function prepare(page, hash = '') {
    const response = await page.request.get('/admin_index.html'); expect(response.ok()).toBe(true);
    const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const bootstrap = `<script>
        localStorage.setItem('userId', 'synthetic-admin'); localStorage.setItem('userRole', 'admin');
        window.CONFIG = { api: { consulting: '/synthetic-api', noti: '/synthetic-api', qna: '/synthetic-api', file: '/synthetic-api' } };
        window.ADMIN_API_URL = '/synthetic-api'; window.Store = { get: () => null };
        window.apiFetch = (_url, options) => fetch('/synthetic-api', options);
        for (const name of ['loadAdminStats', 'populateTutorFilter', 'searchStudents', 'fetchUnreadNotiCount', 'fetchQnaBadgeCount', 'loadMatchingData', 'clearStudentJoinDateRange', 'loadTutorStats', 'loadAllQna']) window[name] = () => {};
    </script>`;
    const document = html.replace('</body>', `${bootstrap}${scripts.map(src => `<script src="/${src}"></script>`).join('')}</body>`);
    const state = { calls: [], emptyFirst: false, deferType: null, resolve: null, failMutation: false, review: false };
    const contact = { studentName: '합성 학생', phone: '01000000000', email: 'synthetic@example.invalid', payerName: '합성 입금자' };
    const detail = n => ({ application: { applicationId: applicationId(n), applicationState: n === 2 ? 'CLAIMED' : 'PAYMENT_REVIEW', paymentReviewStatus: 'pending', revision: 0, expectedAmount: 300000, studentNameMask: '합*생', phoneMask: '010-****-0000' }, contact: { ...contact, studentName: n === 2 ? '둘째 합성 학생' : contact.studentName }, payerRelationship: 'self', contactMethod: 'email', studentStatus: 'senior', sourceResponseId: record(n), originalSubmission: { ...contact }, case: n === 2 ? { caseId, workflowState: 'REPORT_REVIEW', revision: 3 } : null, permissions: { materials: true, schedule: true, report: true, finalCall: true } });
    state.students = [detail(1), detail(2)];
    const summary = (data, n) => ({ applicationId: applicationId(n), sourceResponseId: record(n), caseId: data.case?.caseId || null, studentNameMask: n === 2 ? '둘*생' : '합*생', phoneMask: '010-****-0000', phase: data.case ? 'report' : data.application.applicationState === 'INVITED' ? 'onboarding' : 'intake', stateLabel: data.case ? '보고서 검수' : data.application.applicationState === 'INVITED' ? '초대 발급·가입 대기' : data.application.inputReviewRequired ? '신청 정보 보완' : '입금 확인 대기', nextAction: data.case ? '보고서 검수·승인' : '신청 정보·입금 확인', updatedAt: '2026-11-04T00:00:00.000Z' });
    await page.route(/\/admin(?:_index\.html)?(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/html', body: document }));
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/synthetic-api', async route => {
        const request = route.request().postDataJSON(); state.calls.push(request); let data;
        if (request.type === 'admin_list_consulting_students') {
            const items = state.students.map((item, i) => summary(item, i + 1)).filter(item => request.data.phase === 'all' || request.data.phase === item.phase);
            data = { items: state.emptyFirst && !request.data.cursor ? [] : items, nextCursor: state.emptyFirst && !request.data.cursor ? 'synthetic_cursor' : null };
        } else if (request.type === 'admin_get_consulting_student') {
            const index = state.students.findIndex(item => item.application.applicationId === request.data.applicationId);
            data = { ...structuredClone(state.students[index]), student: summary(state.students[index], index + 1) };
        } else if (request.type === 'admin_review_application_input') {
            const current = state.students[0]; Object.assign(current.contact, request.data.input); Object.assign(current.application, { inputReviewRequired: false, intakeIssues: [], paymentReviewStatus: 'pending', revision: current.application.revision + 1 });
            data = { applicationId: applicationId(1), revision: current.application.revision, inputReviewRequired: false };
        } else if (request.type === 'admin_verify_manual_payment') {
            Object.assign(state.students[0].application, { applicationState: 'INVITED', paymentReviewStatus: 'verified', revision: 1 }); state.students[0].activeInviteId = 'SYNTHETIC_INVITE';
            data = { applicationId: applicationId(1), applicationState: 'INVITED', revision: 1 };
        } else if (request.type === 'admin_get_v2_material_detail') data = { case: { caseId, workflowState: 'MATERIAL_REVIEW' }, submission: { snapshot: { preferences: {}, qualitative: { concerns: '합성 상담 내용' } } }, files: [] };
        else data = { items: [], nextCursor: null };
        if (state.deferType === request.type) await new Promise(resolve => { state.resolve = resolve; });
        if (state.failMutation && request.type === 'admin_review_application_input') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, notifications: [], sentNotices: [], tutors: [], students: [] }) });
    });
    await page.goto(`/admin${hash}`);
    return state;
}
async function enterConsulting(page) {
    await page.locator('a[onclick="showSection(\'consulting\')"]').click();
    await expect(page.locator('#consultingDirectoryStatus')).toHaveAttribute('data-state', 'success');
}
async function openStudent(page, index = 0) {
    await page.locator('#consultingDirectoryBody').getByRole('button', { name: '학생 상세' }).nth(index).click();
    await expect(page.locator('#consultingStudentStatus')).toHaveAttribute('data-state', 'success');
}

test('관리자 메뉴·Q&A 상태·공지 하위 메뉴는 실제 새로고침 뒤에도 유지한다', async ({ page }) => {
    await prepare(page);
    for (const [call, section, title] of [["showSection('students')", 'students', null], ["showSection('advanced-stats')", 'advanced-stats', null], ["showQnaSection('done')", 'qna', '응답 완료'], ["showNotiMenu('sent')", 'notifications', '보낸 공지함']]) {
        const link = page.locator(`a[onclick="${call}"]`); await link.evaluate(node => node.closest('.submenu')?.classList.add('open')); await link.click(); await page.reload();
        await expect(page.locator(`#section-${section}`)).toBeVisible(); await expect(page.locator('#section-dashboard')).toBeHidden();
        if (title) await expect(page.locator(section === 'qna' ? '#qnaStatusTitle' : '#notiPageTitle')).toContainText(title);
    }
});
test('단계별 최소 목록에서 학생 상세로 이동하고 선택한 보고서 화면을 복원한다', async ({ page }) => {
    const state = await prepare(page); await enterConsulting(page);
    await expect(page.locator('#consultingDirectoryBody')).toContainText('합*생'); await expect(page.locator('#consultingDirectoryBody')).not.toContainText('synthetic@example.invalid');
    await expect(page.locator('#consultingServicePanel')).toBeHidden(); await expect(page.locator('#consultingOperationsPanel')).toBeHidden();
    expect(state.calls.some(call => call.type === 'admin_list_consulting_operations')).toBe(false);
    await page.getByRole('button', { name: '04 분석·보고서', exact: true }).click(); await expect(page.locator('#consultingDirectoryBody')).not.toContainText('합*생'); await openStudent(page);
    await expect(page.locator('#consultingStudentTitle')).toContainText('둘째 합성 학생'); await expect(page.locator('#consultingStudentProgress [aria-current="step"]')).toHaveText('분석·보고서');
    await page.getByRole('button', { name: '분석·보고서', exact: true }).click(); await page.reload();
    await expect(page.locator('#consultingWorkspaceReport')).toBeVisible(); await expect(page.locator('#consultingStudentTitle')).toContainText('둘째 합성 학생');
    await page.route('**/2027-jungsi-consulting/report?*', route => route.fulfill({ body: '<html><body>합성 작업 화면</body></html>' }));
    await page.getByRole('button', { name: '분석·보고서 작업 화면 열기' }).click(); await expect(page).toHaveURL(new RegExp(`/report\\?caseId=${caseId}`));
    await page.goBack(); await expect(page.locator('#consultingWorkspaceReport')).toBeVisible(); await expect(page.locator('#consultingStudentTitle')).toContainText('둘째 합성 학생');
});
test('학생 상세의 뒤로·앞으로 이동과 직접 URL 진입은 단계·학생을 유지한다', async ({ page }) => {
    await prepare(page, '#consulting?phase=report'); await expect(page.locator('#consultingDirectoryBody')).toContainText('둘*생'); await openStudent(page);
    const url = page.url(); await page.goBack(); await expect(page.locator('#consultingDirectoryPanel')).toBeVisible(); await expect(page.locator('[data-phase="report"]')).toHaveAttribute('aria-current', 'page');
    await page.goForward(); await expect(page.locator('#consultingStudentTitle')).toContainText('둘째 합성 학생');
    await page.goto(url); await expect(page.locator('#consultingStudentTitle')).toContainText('둘째 합성 학생');
    expect(url).not.toContain('synthetic@example'); expect(url).not.toContain('01000000000');
});
test('빈 단계 페이지도 다음 페이지로 이어지며 필터 변경 시 첫 페이지로 돌아간다', async ({ page }) => {
    const state = await prepare(page); state.emptyFirst = true; await enterConsulting(page);
    await expect(page.locator('#consultingDirectoryNext')).toBeEnabled(); await expect(page.locator('#consultingDirectoryBody')).toContainText('다음 페이지');
    await page.getByRole('button', { name: '다음', exact: true }).click(); await expect(page.locator('#consultingDirectoryBody')).toContainText('둘*생'); await expect(page.locator('#consultingDirectoryPrevious')).toBeEnabled();
    state.emptyFirst = false; await page.getByRole('button', { name: '01 접수·입금', exact: true }).click(); await expect(page.locator('#consultingDirectoryPrevious')).toBeDisabled(); await expect(page.locator('#consultingDirectoryBody')).not.toContainText('둘*생');
    expect(state.calls.filter(call => call.type === 'admin_list_consulting_students').at(-1).data.cursor).toBeNull();
});
test('다른 메뉴로 이동하면 늦은 상세 응답이 이름·연락처를 다시 채우지 않는다', async ({ page }) => {
    const state = await prepare(page); await enterConsulting(page); state.deferType = 'admin_get_consulting_student';
    await page.locator('#consultingDirectoryBody').getByRole('button', { name: '학생 상세' }).first().click(); await expect(page.locator('#consultingStudentPanel')).toHaveAttribute('aria-busy', 'true');
    await page.locator('a[onclick="showSection(\'students\')"]').click(); await expect.poll(() => Boolean(state.resolve)).toBe(true);
    const completed = page.waitForResponse(response => response.url().endsWith('/synthetic-api') && response.request().postDataJSON().type === 'admin_get_consulting_student'); state.resolve(); await completed;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('#consultingDetailSummary')).toBeEmpty(); await expect(page.locator('#consultingStudentTitle')).toHaveText('학생 상세'); await expect(page.locator('#consultingStudentPanel')).toBeHidden();
});
test('학생 목록에서 선택한 같은 신청을 보완하고 별도 승인 후에도 목록에서 찾는다', async ({ page }) => {
    const state = await prepare(page); Object.assign(state.students[0].application, { inputReviewRequired: true, paymentReviewStatus: 'input_review' }); await enterConsulting(page); await openStudent(page);
    await expect(page.locator('#consultingApproveBtn')).toBeDisabled(); await page.locator('#consultingContactEmail').fill('corrected@example.invalid'); await page.locator('#consultingInputConfirmed').check(); await page.locator('#consultingSaveInputBtn').click();
    await expect(page.locator('#consultingActionStatus')).toContainText('신청 정보 확인·저장 완료'); await expect(page.locator('#consultingApproveBtn')).toBeEnabled();
    expect(state.calls.some(call => call.type === 'admin_verify_manual_payment')).toBe(false);
    await page.locator('#consultingPaidAmount').fill('300000'); await page.locator('#consultingPaidAt').fill('2026-11-04T10:00'); await page.locator('#consultingPayerConfirmed').check(); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingApproveBtn').click();
    await expect(page.locator('#consultingStudentState')).toContainText('초대 발급·가입 대기'); await expect(page.locator('#consultingPaymentActions')).toBeHidden();
    await page.getByRole('button', { name: '← 학생 목록' }).click(); await page.getByRole('button', { name: '02 가입·조사서' }).click(); await expect(page.locator('#consultingDirectoryBody')).toContainText('합*생');
    expect(state.calls.filter(call => call.type === 'admin_verify_manual_payment')).toHaveLength(1);
});
test('새 학생 또는 세션 종료 시 자료·수정 원본·개인정보를 지우고 늦은 자료 응답을 버린다', async ({ page }) => {
    const state = await prepare(page); await enterConsulting(page); await openStudent(page, 1); state.deferType = 'admin_get_v2_material_detail';
    await page.getByRole('button', { name: '조사서·성적표', exact: true }).click(); await expect.poll(() => Boolean(state.resolve)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended')));
    const completed = page.waitForResponse(response => response.url().endsWith('/synthetic-api') && response.request().postDataJSON().type === 'admin_get_v2_material_detail'); state.resolve(); await completed;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const id of ['consultingMaterialSummary', 'consultingMaterialSurvey', 'consultingDetailSummary', 'consultingOriginalSubmission', 'consultingStudentIdentifiers']) await expect(page.locator(`#${id}`)).toBeEmpty();
    await expect(page.locator('#consultingContactEmail')).toHaveValue(''); await expect(page.locator('#consultingStudentTitle')).toHaveText('학생 상세');
});
test('320px·390px·데스크톱에서 단계·목록·상세가 잘리지 않고 주요 버튼은44px 이상이다', async ({ page }, testInfo) => {
    const state = await prepare(page); await enterConsulting(page);
    for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.locator('#section-consulting').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        await page.screenshot({ path: testInfo.outputPath(`consulting-list-${width}.png`), fullPage: true });
        await openStudent(page); expect(await page.locator('#consultingStudentPanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        expect(await page.locator('#consultingSaveInputBtn').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        await page.screenshot({ path: testInfo.outputPath(`consulting-student-${width}.png`), fullPage: true }); await page.getByRole('button', { name: '← 학생 목록' }).click();
    }
    state.students[0].contact.studentName = 'A'.repeat(120);
    await page.setViewportSize({ width: 320, height: 900 }); await openStudent(page);
    expect(await page.locator('#consultingStudentPanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

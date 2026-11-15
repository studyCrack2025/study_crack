import { expect, test } from '@playwright/test';

const caseId = n => `CASE_${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const appId = n => `APP_${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const candidateId = n => `REF_${String(n).padStart(24, '0')}`;
const token = 'sha256:' + 'a'.repeat(64);
const version = 'sha256:' + 'b'.repeat(64);
const scripts = ['js/admin/navigation.js', 'js/admin_ui.js', 'js/admin/notices.js', 'js/admin/consulting.js', 'js/admin/consulting-supplements.js', 'js/admin/consulting-intake.js', 'js/admin/consulting-materials.js', 'js/admin/consulting-reference.js', 'js/admin/consulting-scheduling.js', 'js/admin/consulting-operations.js', 'js/admin/consulting-workspace.js'];

async function prepare(page) {
    const response = await page.request.get('/admin_index.html'); expect(response.ok()).toBe(true);
    const css = await page.request.get('/css/admin_consulting.css'); expect(css.ok()).toBe(true); expect(await css.text()).toContain('.consulting-reference-cards');
    const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const bootstrap = `<script>
        localStorage.setItem('userId','synthetic-admin');localStorage.setItem('userRole','admin');
        window.CONFIG={api:{consulting:'/synthetic-reference-api',noti:'/synthetic-reference-api',qna:'/synthetic-reference-api',file:'/synthetic-reference-api'}};
        window.ADMIN_API_URL='/synthetic-reference-api';window.Store={get:()=>null};
        window.apiFetch=async(_url,options)=>{const response=await fetch('/synthetic-reference-api',options);if(!response.ok){const data=await response.json();throw Object.assign(new Error(data.error||'Synthetic failure'),{status:response.status,code:data.code});}return response;};
        for(const name of ['loadAdminStats','populateTutorFilter','searchStudents','fetchUnreadNotiCount','fetchQnaBadgeCount','loadMatchingData','clearStudentJoinDateRange','loadTutorStats','loadAllQna'])window[name]=()=>{};
    </script>`;
    const body = html.replace('</body>', `${bootstrap}${scripts.map(x => `<script src="/${x}"></script>`).join('')}</body>`);
    await page.route(/\/admin(?:_index\.html)?(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/html', body }));
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    const state = { calls: [], early: false, getError: 0, runError: 0, defer: false, release: null, empty: false };
    const currentCase = n => ({ caseId: caseId(n), workflowState: state.early ? 'ONBOARDING' : 'MATERIAL_REVIEW', revision: 1 });
    const students = [1, 2].map(n => ({ applicationId: appId(n), sourceResponseId: `SYNTHETIC_RESPONSE_${n}`, caseId: caseId(n), studentNameMask: `합성학생${n}`, phoneMask: '010-****-0000', phase: 'onboarding', stateLabel: '자료 확인', nextAction: '기초조사서 확인', updatedAt: '2026-11-15T00:00:00Z' }));
    const referenceRecords = [{ area: 'korean', selection: '언어와 매체' }, { area: 'math', selection: '확률과통계' }, { area: 'inquiry', subject: '물리학Ⅰ' }, { area: 'inquiry', subject: '지구과학Ⅰ' }, { area: 'english', grade: 2 }];
    const snapshot = { formVersion: 4, studentStatus: { applicantType: 'high_school_senior', schoolType: 'general', schoolName: '가상고', residenceRegion: '서울', graduationYear: 2027 }, conditions: { commuteLimit: 'over_120', dormitoryAllowed: false, repeatStudyAllowed: true }, preferences: { rankedChoices: [{ university: '합성대학교', track: '공학' }], additionalPreference: '' }, strategy: { riskTolerance: 'balanced', priorityOrder: ['major', 'brand', 'region', 'commute', 'employment'] }, qualitative: { consultationTopics: ['group_plan'], decisionOptions: '합성 질문' }, consent: { accurateInformation: true, analysisUse: true }, scores: { examYear: 2026, examType: 'csat', records: [{ area: 'english', subject: '영어', grade: 2 }] } };
    const options = id => ({ contractVersion: 'consulting-local-reference-v1', action: 'options', dataVersion: version, sourceToken: token, caseId: id, surveyRevision: 0, hasSubmittedSurvey: !state.early, initialRecords: state.early ? [] : referenceRecords, initialUniversities: [], initialStream: '', risk: 'balanced', totalPrograms: 500, automaticGroupReferences: 100, universities: ['합성대학교', '다른대학교'], streams: ['자연/공학', '인문사회'], inquiries: ['물리학1', '지구과학1', '사회문화'], scoreRows: [{ subject: '국어', rows: [[133, 96, 1], [132, 95, 2]] }, { subject: '수학(미적분)', rows: [[128, 96, 1]] }, { subject: '물리학1', rows: [[66, 96, 1]] }, { subject: '지구과학1', rows: [[65, 95, 1]] }], warning: '2026 참고자료로 추천 동작을 실험합니다. 실제 합격 확률이 아닙니다.' });
    const result = request => {
        const candidates = Array.from({ length: 3 }, (_, index) => ({ id: candidateId(index + 1), university: '합성대학교', program: index ? `합성학과${index}` : '<img src=x onerror=window.__injected=1>', score: request.data.input.scores.kor.std + 200 + index, passCut: 320, top70Cut: 340, margin: 13, position: .65, band: '적정', probability: null, group: index ? ['가', '나', '다'][index] : null, groupBasis: index ? '2026_reference' : 'unconfirmed', groupEvidence: index ? [{ page: 1 }] : null }));
        for (const override of request.data.input.groupOverrides) { const row = candidates.find(x => x.id === override.candidateId); if (row) Object.assign(row, { group: override.group, groupBasis: 'admin_experiment' }); }
        const plan = ['가', '나', '다'].map((group, index) => ({ group, candidate: state.empty ? null : { ...candidates[index], group, groupBasis: '2026_reference' }, reason: state.empty ? '조건에 맞는 후보가 없습니다.' : '합성 비교 근거' }));
        return { contractVersion: 'consulting-local-reference-v1', action: 'run', dataVersion: version, sourceToken: token, caseId: request.data.caseId, plans: { A: plan, B: plan, distinctGroups: 0 }, stats: { total: 500, calculated: 400, excluded: 100, excludedByReason: { ADMISSION_FORMULA_REVIEW_REQUIRED: 100 }, groupPending: 300 }, candidates: state.empty ? [] : candidates, matchingCandidates: state.empty ? 0 : 36, page: request.data.input.page, hasNextPage: !state.empty && request.data.input.page === 0 };
    };
    await page.route('**/synthetic-reference-api', async route => {
        const request = route.request().postDataJSON(); state.calls.push(request); let data;
        if (request.type === 'admin_list_consulting_students') data = { items: students, nextCursor: null };
        else if (request.type === 'admin_get_notifications') data = { notifications: [], unreadCount: 0 };
        else if (request.type === 'admin_list_v2_material_review') data = { items: [], nextCursor: null };
        else if (request.type === 'admin_get_consulting_student') {
            const n = students.findIndex(x => request.data.caseId ? x.caseId === request.data.caseId : x.applicationId === request.data.applicationId) + 1;
            data = { student: students[n - 1], application: { applicationId: appId(n), applicationState: 'CLAIMED', paymentReviewStatus: 'verified', revision: 1, expectedAmount: 300000 }, sourceResponseId: students[n - 1].sourceResponseId, contact: { studentName: `합성학생${n}`, phone: '01000000000', email: 'synthetic@example.invalid', payerName: '합성' }, case: currentCase(n), permissions: { materials: true, schedule: false, report: false, finalCall: false } };
        } else if (request.type === 'admin_get_v2_material_detail') data = { case: currentCase(request.data.caseId === caseId(1) ? 1 : 2), canVerify: false, submission: state.early ? null : { snapshot, revision: 0, submittedAt: '2026-11-15T00:00:00Z' }, originalSubmission: null, files: [], verification: { status: 'pending', studentInput: snapshot.scores } };
        else if (request.type === 'admin_get_reference_experiment') {
            if (state.getError) return route.fulfill({ status: state.getError, json: { success: false } });
            data = options(request.data.caseId);
        } else if (request.type === 'admin_run_reference_experiment') {
            if (state.defer) await new Promise(resolve => { state.release = resolve; });
            if (state.runError) return route.fulfill({ status: state.runError, json: { success: false, error: '입력 범위를 확인해주세요.' } });
            data = result(request);
        } else throw new Error(`Unexpected synthetic request: ${request.type}`);
        try { await route.fulfill({ json: { success: true, data } }); } catch (error) { if (!request.type.includes('reference_experiment')) throw error; }
    });
    return state;
}
async function open(page, n = 1) {
    await page.goto('/admin#consulting');
    await page.locator('#consultingDirectoryBody tr').nth(n - 1).getByRole('button', { name: '학생 상세' }).click();
    await page.getByRole('button', { name: '조사서·성적표', exact: true }).click();
    await page.locator('#consultingReferenceExperiment > summary').click();
    await expect(page.locator('#consultingReferenceForm')).toBeVisible();
}
async function fill(page) {
    const panel = page.locator('#consultingReferenceExperiment');
    await panel.getByLabel('국어 선택과목', { exact: true }).selectOption('화작');
    await panel.getByLabel('수학 선택과목', { exact: true }).selectOption('미적');
    await panel.getByLabel('탐구 1 선택과목', { exact: true }).selectOption('물리학1');
    await panel.getByLabel('탐구 2 선택과목', { exact: true }).selectOption('지구과학1');
    for (const [name, value] of [['국어', '133'], ['수학', '128'], ['탐구 1', '66'], ['탐구 2', '65']]) await panel.getByLabel(`${name} 표준점수`, { exact: true }).fill(value);
    await panel.getByLabel('영어 등급', { exact: true }).selectOption('2');
    await panel.getByLabel('한국사 등급', { exact: true }).selectOption('2');
}

test('관리자는 직접 성적으로 A/B를 비교하고 자동 저장 없이 미확인 군을 실험 지정한다', async ({ page }, testInfo) => {
    const state = await prepare(page); await open(page);
    const panel = page.locator('#consultingReferenceExperiment');
    await expect(panel.getByLabel('국어 선택과목', { exact: true })).toHaveValue('언매');
    await expect(panel.getByLabel('수학 선택과목', { exact: true })).toHaveValue('확통');
    await expect(panel.getByLabel('탐구 1 선택과목', { exact: true })).toHaveValue('물리학1');
    await expect(panel.getByLabel('탐구 2 선택과목', { exact: true })).toHaveValue('지구과학1');
    await fill(page);
    await expect(panel.getByLabel('국어 백분위', { exact: true })).toHaveValue('96');
    await expect(panel.getByLabel('국어 등급', { exact: true })).toHaveValue('1');
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment')).toHaveLength(0);
    await panel.getByRole('button', { name: 'A/B 추천 실험', exact: true }).click();
    await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    await expect(page.locator('#consultingReferencePlans article')).toHaveCount(6);
    expect(state.calls.find(x => x.type === 'admin_run_reference_experiment').data.input.scores.kor).toEqual({ opt: '화작', std: 133, pct: 96, grd: 1 });
    await panel.getByText('계산 후보 전체 검색·실험용 군 지정', { exact: true }).click();
    await expect(page.locator('#consultingReferenceCandidates')).toContainText('군 확인 필요');
    await expect(page.locator('#consultingReferenceCandidates img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__injected)).toBeUndefined();
    await page.locator('#consultingReferenceCandidates select').first().selectOption('가');
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    await expect(page.locator('#consultingReferenceOverrides')).toContainText('가군 지정 해제');
    await panel.getByRole('button', { name: 'A/B 추천 실험', exact: true }).click();
    await expect(page.locator('#consultingReferenceCandidates')).toContainText('관리자 실험 지정');
    expect(state.calls.filter(x => /save|verify|approve|publish/.test(x.type))).toHaveLength(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await panel.locator('summary').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('reference-desktop.png') });
    await page.locator('.consulting-reference-plan').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('reference-desktop-plans.png') });
    await page.setViewportSize({ width: 375, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await panel.locator('summary').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('reference-mobile.png') });
    await page.locator('.consulting-reference-plan').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('reference-mobile-plans.png') });
});

test('직접 입력·검색·페이지 변경은 명시적으로 실행하고 성적 변경은 기존 결과를 폐기한다', async ({ page }) => {
    const state = await prepare(page); await open(page); await fill(page);
    await page.getByRole('button', { name: 'A/B 추천 실험', exact: true }).click();
    await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    await page.locator('#consultingReferenceExperiment').getByText('계산 후보 전체 검색·실험용 군 지정', { exact: true }).click();
    await page.getByRole('button', { name: '다음 후보', exact: true }).click();
    await expect(page.locator('#consultingReferencePage')).toContainText('2페이지');
    await page.getByLabel('국어 표준점수', { exact: true }).fill('150');
    await expect(page.getByLabel('국어 백분위', { exact: true })).toHaveValue('');
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    await page.clock.install(); await page.clock.runFor(4000);
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment')).toHaveLength(2);
});

test('실패·자료 변경·빈 결과를 구분하고 자동 재요청하지 않는다', async ({ page }) => {
    const state = await prepare(page); state.getError = 503;
    await page.goto('/admin#consulting'); await page.locator('#consultingDirectoryBody tr').first().getByRole('button', { name: '학생 상세' }).click();
    await page.locator('#consultingReferenceExperiment > summary').click();
    await expect(page.locator('#consultingReferenceStatus')).toContainText('자료를 불러오지 못');
    state.getError = 0;
    await page.getByRole('button', { name: '자료 다시 불러오기', exact: true }).click(); await fill(page);
    state.runError = 400; await page.getByRole('button', { name: 'A/B 추천 실험', exact: true }).click();
    await expect(page.locator('#consultingReferenceStatus')).toContainText('입력 범위');
    state.runError = 409; await page.getByRole('button', { name: 'A/B 추천 실험', exact: true }).click();
    await expect(page.locator('#consultingReferenceStatus')).toContainText('기준을 갱신');
    await expect(page.locator('#consultingReferenceRun')).toBeDisabled();
    state.runError = 0; state.empty = true;
    await page.getByRole('button', { name: '자료 다시 불러오기', exact: true }).click(); await fill(page);
    await page.getByRole('button', { name: 'A/B 추천 실험', exact: true }).click();
    await expect(page.locator('#consultingReferencePlans')).toContainText('조건에 맞는 후보 없음');
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment')).toHaveLength(3);
});

test('제출 전에도 실험할 수 있으며 학생 이동 후 늦은 계산 결과는 표시하지 않는다', async ({ page }) => {
    const state = await prepare(page); state.early = true; await open(page); await fill(page);
    await expect(page.locator('#consultingReferenceBasis')).toContainText('제출 전 수동 실험');
    state.defer = true; await page.getByRole('button', { name: 'A/B 추천 실험', exact: true }).click();
    await expect.poll(() => Boolean(state.release)).toBe(true);
    await page.getByRole('button', { name: '← 학생 목록', exact: true }).click();
    await page.locator('#consultingDirectoryBody tr').nth(1).getByRole('button', { name: '학생 상세' }).click();
    state.release(); state.defer = false;
    await page.getByRole('button', { name: '조사서·성적표', exact: true }).click();
    await page.locator('#consultingReferenceExperiment > summary').click();
    await expect(page.locator('#consultingReferenceForm')).toBeVisible();
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    await expect(page.getByLabel('국어 표준점수', { exact: true })).toHaveValue('');
});

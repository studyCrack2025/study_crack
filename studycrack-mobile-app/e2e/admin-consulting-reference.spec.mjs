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
    const state = { calls: [], early: false, getError: 0, runError: 0, defer: false, release: null, empty: false, blocked: false, requireStandards: false, standardSupport: true };
    const currentCase = n => ({ caseId: caseId(n), workflowState: state.early ? 'ONBOARDING' : 'AVAILABILITY_REQUIRED', revision: 1 });
    const students = [1, 2].map(n => ({ applicationId: appId(n), sourceResponseId: `SYNTHETIC_RESPONSE_${n}`, caseId: caseId(n), studentNameMask: `합성학생${n}`, phoneMask: '010-****-0000', phase: 'onboarding', stateLabel: '자료 확인', nextAction: '기초조사서 확인', updatedAt: '2026-11-15T00:00:00Z' }));
    const referenceRecords = [{ area: 'korean', selection: '언어와 매체', rawScore: 80, commonRawScore: 60, electiveRawScore: 20 }, { area: 'math', selection: '확률과통계', rawScore: 80, commonRawScore: 60, electiveRawScore: 20 }, { area: 'inquiry', subject: '물리학Ⅰ', rawScore: 40 }, { area: 'inquiry', subject: '지구과학Ⅰ', rawScore: 40 }, { area: 'english', grade: 2 }, { area: 'korean_history', grade: 1 }];
    const snapshot = { formVersion: 4, studentStatus: { applicantType: 'high_school_senior', schoolType: 'general', schoolName: '가상고', residenceRegion: '서울', graduationYear: 2027 }, conditions: { commuteLimit: 'over_120', dormitoryAllowed: false, repeatStudyAllowed: true }, preferences: { rankedChoices: [{ university: '합성대학교', track: '공학' }], additionalPreference: '' }, strategy: { riskTolerance: 'balanced', priorityOrder: ['major', 'brand', 'region', 'commute', 'employment'] }, qualitative: { consultationTopics: ['group_plan'], decisionOptions: '합성 질문' }, consent: { accurateInformation: true, analysisUse: true }, scores: { examYear: 2026, examType: 'csat', records: [{ area: 'english', subject: '영어', grade: 2 }] } };
    const options = id => ({ contractVersion: 'consulting-local-reference-v1', action: 'options', dataVersion: version, rawDataVersion: version, automaticSurveySupported: true, standardReferenceSupported: state.standardSupport, automaticSurvey: { available: !state.early, sourceToken: token, revision: 0, records: referenceRecords, risk: 'balanced', message: '최신 기초조사서를 확정하면 자동 추천을 확인할 수 있습니다.' }, sourceToken: token, caseId: id, surveyRevision: 0, hasSubmittedSurvey: !state.early, initialRecords: state.early ? [] : referenceRecords, initialUniversities: [], initialStream: '', risk: 'balanced', totalPrograms: 500, automaticGroupReferences: 100, universities: ['합성대학교', '다른대학교'], streams: ['자연/공학', '인문사회'], inquiries: ['물리학1', '지구과학1', '사회문화'], scoreRows: [{ subject: '국어', rows: [[133, 96, 1], [132, 95, 2]] }, { subject: '수학(확통)', rows: [[128, 96, 1], [126, 94, 2]] }, { subject: '물리학1', rows: [[66, 96, 1], [65, 93, 2]] }, { subject: '지구과학1', rows: [[65, 95, 1], [63, 89, 2]] }], warning: '2026 참고자료로 추천 동작을 실험합니다. 실제 합격 확률이 아닙니다.' });
    const result = request => {
        const standards = request.data.referenceScores || {};
        const keys = ['kor', 'math', 'inq1', 'inq2'];
        const missing = state.requireStandards ? keys.filter(key => !Object.hasOwn(standards, key)).map((key, index) => ({ scoreKey: key, code: 'REFERENCE_RAW_MAPPING_UNAVAILABLE', message: `${key}: 해당 원점수의 2026 참고 대응자료가 준비되지 않았습니다.` })) : [];
        const tables = [0, 1, 2, 3].map(index => options(request.data.caseId).scoreRows[index].rows);
        const scoreSummary = referenceRecords.map((row, index) => {
            const selected = tables[index]?.find(value => value[0] === standards[keys[index]]);
            return selected ? { ...row, scoreKey: keys[index], standardScore: selected[0], percentile: selected[1], grade: selected[2], scoreBasis: 'reference_standard' } : row;
        });
        const candidates = Array.from({ length: 3 }, (_, index) => ({ id: candidateId(index + 1), university: '합성대학교', program: index ? `합성학과${index}` : '<img src=x onerror=window.__injected=1>', score: 333 + index, passCut: 320, top70Cut: 340, margin: 13, position: .65, band: '적정', probability: null, group: index ? ['가', '나', '다'][index] : null, groupBasis: index ? '2026_reference' : 'unconfirmed', groupEvidence: index ? [{ page: 1 }] : null }));
        if (state.reviewed) for (const candidate of candidates) candidate.reviewedReference = {
            contractVersion: 'reviewed-admission-reference-v1', status: 'current_two_references', school: candidate.university, originalMajor: candidate.program,
            convertedScore: 250, passReference: 240, registered70Reference: 260, referenceIndex: 50, referenceYear: 2025,
            referenceBounds: { kind: 'cut_assumption_range', pass: { low: 239, high: 241 }, registered70: { low: 259, high: 261 } },
            personalEligibilityApproved: false, publicationReady: false, probability: null, empiricallyCalibrated: false
        };
        for (const override of request.data.input.groupOverrides) { const row = candidates.find(x => x.id === override.candidateId); if (row) Object.assign(row, { group: override.group, groupBasis: 'admin_experiment' }); }
        const plan = ['가', '나', '다'].map((group, index) => ({ group, candidate: state.empty ? null : { ...candidates[index], group, groupBasis: '2026_reference' }, reason: state.empty ? '조건에 맞는 후보가 없습니다.' : '합성 비교 근거' }));
        return { contractVersion: 'consulting-local-reference-v1', action: 'runSurvey', dataVersion: version, rawDataVersion: version, status: state.blocked || missing.length ? 'blocked' : 'ready', scoreSummary, scoreBasis: Object.keys(standards).length ? 'reference_standard' : 'survey_raw', missing: state.blocked ? [{ message: '국어: 해당 원점수의 2026 참고 대응자료가 준비되지 않았습니다.' }] : missing, sourceToken: token, caseId: request.data.caseId, plans: { A: plan, B: plan, C: plan, distinctGroups: 0 }, stats: { total: 500, calculated: 400, excluded: 100, excludedByReason: { ADMISSION_FORMULA_REVIEW_REQUIRED: 100 }, groupPending: 300 }, candidates: state.empty ? [] : candidates, matchingCandidates: state.empty ? 0 : 36, page: request.data.input.page, hasNextPage: !state.empty && request.data.input.page === 0 };
    };
    await page.route('**/synthetic-reference-api', async route => {
        const request = route.request().postDataJSON(); state.calls.push(request); let data;
        if (request.type === 'admin_list_consulting_students') data = { items: students, nextCursor: null };
        else if (request.type === 'admin_list_written_unread') data = { items: [], hasMore: false };
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
}

test('확정 조사서로 성적 재입력 없이 A/B/C안을 자동 비교하고 원본을 저장하지 않는다', async ({ page }, testInfo) => {
    const state = await prepare(page); await open(page);
    const panel = page.locator('#consultingReferenceExperiment');
    await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    await expect(page.locator('#consultingReferencePlans article')).toHaveCount(9);
    await expect(page.locator('#consultingReferenceScores input, #consultingReferenceScores select')).toHaveCount(0);
    await expect(page.locator('#consultingReferenceScores')).toContainText('공통 원점수');
    const request = state.calls.find(x => x.type === 'admin_run_reference_experiment').data;
    expect(request.scoreSource).toBe('approved_survey'); expect(request.input.scores).toBeUndefined();
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment')).toHaveLength(1);
    await panel.getByText('계산 후보 전체 검색·실험용 군 지정', { exact: true }).click();
    await expect(page.locator('#consultingReferenceCandidates')).toContainText('군 확인 필요');
    await expect(page.locator('#consultingReferenceCandidates img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__injected)).toBeUndefined();
    await page.locator('#consultingReferenceCandidates select').first().selectOption('가');
    await expect.poll(() => state.calls.filter(x => x.type === 'admin_run_reference_experiment').length).toBe(2);
    await expect(page.locator('#consultingReferenceCandidates')).toContainText('관리자 실험 지정');
    expect(state.calls.filter(x => /save|verify|approve|publish/.test(x.type))).toHaveLength(0);
    for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 375, 900]]) {
        await page.setViewportSize({ width, height });
        await panel.locator('summary').first().scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`reference-${name}.png`) });
        await page.locator('.consulting-reference-plan').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`reference-${name}-plans.png`) });
    }
});

test('위험도와 검색 조건 변경은 이전 결과를 폐기하고 성적 없이 자동 재계산한다', async ({ page }) => {
    const state = await prepare(page); await open(page);
    await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    await page.locator('#consultingReferenceRisk').selectOption('safe');
    await expect.poll(() => state.calls.filter(x => x.type === 'admin_run_reference_experiment').length).toBe(2);
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment').at(-1).data.input.risk).toBe('safe');
    await page.getByLabel('전체 계산 후보에서 대학·학과 찾기').fill('합성');
    await expect.poll(() => state.calls.filter(x => x.type === 'admin_run_reference_experiment').length).toBe(3);
    await page.getByText('계산 후보 전체 검색·실험용 군 지정', { exact: true }).click();
    await page.getByRole('button', { name: '다음 후보', exact: true }).click();
    await expect(page.locator('#consultingReferencePage')).toContainText('2페이지');
    for (const call of state.calls.filter(x => x.type === 'admin_run_reference_experiment')) expect(call.data.input.scores).toBeUndefined();
});

test('대응자료 미확보와 확정 상태 변경을 구분하며 무한 재시도하지 않는다', async ({ page }) => {
    const state = await prepare(page); state.standardSupport = false; state.blocked = true; await open(page);
    await expect(page.locator('#consultingReferenceStatus')).toContainText('국어');
    await expect(page.locator('#consultingReferenceStatus')).toContainText('대응자료');
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    await page.clock.install(); await page.clock.runFor(4000);
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment')).toHaveLength(1);
    state.blocked = false; state.runError = 409;
    await page.getByRole('button', { name: '다시 계산', exact: true }).click();
    await expect(page.locator('#consultingReferenceStatus')).toContainText('기준을 갱신');
    await expect(page.locator('#consultingReferenceRun')).toBeDisabled();
    state.runError = 0; state.empty = true;
    await page.getByRole('button', { name: '자료 다시 불러오기', exact: true }).click();
    await expect(page.locator('#consultingReferencePlans')).toContainText('조건에 맞는 후보 없음');
});

test('조사서 미확정 학생은 수동 성적 입력으로 우회할 수 없다', async ({ page }) => {
    const state = await prepare(page); state.early = true; await open(page);
    await expect(page.locator('#consultingReferenceStatus')).toContainText('조사서를 확정');
    await expect(page.locator('#consultingReferenceForm')).toBeHidden();
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment')).toHaveLength(0);
});

test('학생 전환 뒤 도착한 이전 학생의 자동 추천은 표시하지 않는다', async ({ page }) => {
    const state = await prepare(page); state.defer = true; await open(page);
    await expect.poll(() => Boolean(state.release)).toBe(true);
    await page.getByRole('button', { name: '← 학생 목록', exact: true }).click();
    await page.locator('#consultingDirectoryBody tr').nth(1).getByRole('button', { name: '학생 상세' }).click();
    state.release(); state.defer = false;
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    await page.getByRole('button', { name: '조사서·성적표', exact: true }).click();
    await page.locator('#consultingReferenceExperiment > summary').click();
    await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    expect(state.calls.filter(x => x.type === 'admin_run_reference_experiment').at(-1).data.caseId).toBe(caseId(2));
});

async function enterReferenceStandards(page) {
    for (const [key, value] of [['kor', '133'], ['math', '128'], ['inq1', '66'], ['inq2', '65']]) await page.locator(`[data-reference-standard="${key}"]`).selectOption(value);
}

test('원점수 대응표가 없어도 별도 표준점수와 2026 백분위·등급으로 실험하며 부분 입력 중 재요청하지 않는다', async ({ page }, testInfo) => {
    const state = await prepare(page); state.requireStandards = true; await open(page);
    await expect(page.locator('#consultingReferenceStandard')).toBeVisible();
    await expect(page.locator('[data-reference-standard]')).toHaveCount(4);
    await expect(page.locator('#consultingReferenceStatus')).toContainText('실험용 표준점수');
    await expect(page.locator('#consultingReferenceRun')).toBeDisabled();
    await page.clock.install();
    await page.locator('[data-reference-standard="kor"]').selectOption('133');
    await page.locator('[data-reference-standard="math"]').selectOption('128');
    await page.clock.runFor(1500);
    expect(state.calls.filter(call => call.type === 'admin_run_reference_experiment')).toHaveLength(1);
    await expect(page.locator('#consultingReferenceStandardInputs')).toContainText('2026 참고 백분위 96 · 1등급');
    await enterReferenceStandards(page); await page.clock.runFor(400);
    await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    await expect(page.locator('#consultingReferencePlans article')).toHaveCount(9);
    const sent = state.calls.filter(call => call.type === 'admin_run_reference_experiment').at(-1).data;
    expect(sent.referenceScores).toEqual({ kor: 133, math: 128, inq1: 66, inq2: 65 });
    expect(sent.input.scores).toBeUndefined(); expect(sent.scoreSource).toBe('approved_survey');
    await expect(page.locator('#consultingReferenceScores')).toContainText('공통 원점수');
    await expect(page.locator('#consultingReferenceScores')).toContainText('2026 참고 표준점수');
    await expect(page.locator('#consultingReferenceStatus')).toContainText('원점수는 변경하지 않았습니다');
    expect(state.calls.filter(call => /save|verify|approve|publish/.test(call.type))).toHaveLength(0);
    for (const [name, width] of [['desktop', 1280], ['mobile', 375]]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator('#consultingReferenceStandard').scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`reference-standard-${name}.png`) });
    }
    await page.locator('[data-reference-standard="kor"]').selectOption(''); await page.clock.runFor(1500);
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    await expect(page.locator('#consultingReferenceRun')).toBeDisabled();
    expect(state.calls.filter(call => call.type === 'admin_run_reference_experiment')).toHaveLength(2);
});

test('실험 점수는 자료 재조회·학생 전환·로그아웃 뒤 남지 않는다', async ({ page }) => {
    const state = await prepare(page); state.requireStandards = true; await open(page);
    await expect(page.locator('[data-reference-standard]')).toHaveCount(4);
    await enterReferenceStandards(page);
    await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    await page.getByRole('button', { name: '자료 다시 불러오기', exact: true }).click();
    await expect(page.locator('[data-reference-standard="kor"]')).toHaveValue('');
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    expect(state.calls.filter(call => call.type === 'admin_run_reference_experiment').at(-1).data.referenceScores).toBeUndefined();
    await page.getByRole('button', { name: '← 학생 목록', exact: true }).click();
    await page.locator('#consultingDirectoryBody tr').nth(1).getByRole('button', { name: '학생 상세' }).click();
    await page.getByRole('button', { name: '조사서·성적표', exact: true }).click();
    await page.locator('#consultingReferenceExperiment > summary').click();
    await expect(page.locator('[data-reference-standard="kor"]')).toHaveValue('');
    expect(state.calls.filter(call => call.type === 'admin_run_reference_experiment').at(-1).data.caseId).toBe(caseId(2));
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended')));
    await expect(page.locator('#consultingReferenceExperiment')).toBeHidden();
    await expect(page.locator('[data-reference-standard]')).toHaveCount(0);
});

test('실험 표준점수 입력 뒤 조사서·자료 버전이 바뀌면 결과와 실험값을 폐기한다', async ({ page }) => {
    const state = await prepare(page); state.requireStandards = true; await open(page);
    await expect(page.locator('[data-reference-standard]')).toHaveCount(4);
    await enterReferenceStandards(page); await expect(page.locator('#consultingReferenceResults')).toBeVisible();
    state.runError = 409; await page.locator('#consultingReferenceRisk').selectOption('safe');
    await expect(page.locator('#consultingReferenceStatus')).toContainText('기준을 갱신');
    await expect(page.locator('#consultingReferenceResults')).toBeHidden();
    await expect(page.locator('#consultingReferenceStandard')).toBeHidden();
    await expect(page.locator('[data-reference-standard]')).toHaveCount(0);
    await expect(page.locator('#consultingReferenceRun')).toBeDisabled();
});


test('컨설팅 후보에는 연결된 현행식 참고 비교를 추가하고 원래 실험 점수와 구분한다', async ({ page }, testInfo) => {
    const state = await prepare(page); state.reviewed = true; await open(page);
    const card = page.locator('#consultingReferencePlans article').first();
    await expect(card).toContainText('현행식 참고 비교'); await expect(card).toContainText('참고 환산점수');
    await expect(card).toContainText('2025학년도 보완자료'); await expect(card).toContainText('예상컷 가정 범위 239~241');
    await expect(card).toContainText('실제 합격 확률 아님'); await expect(card.locator('img')).toHaveCount(0);
    await page.setViewportSize({ width: 375, height: 900 }); await card.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('consulting-reviewed-reference.png') });
    expect(state.calls.filter(call => /save|verify|approve|publish/.test(call.type))).toHaveLength(0);
});

import { expect, test } from '@playwright/test';

const caseId = 'CASE_123e4567-e89b-12d3-a456-426614174000';
async function prepare(page, options = {}) {
    const source = async path => { const response = await page.request.get('/' + path); expect(response.ok(), path).toBe(true); return response.text(); };
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
    await page.goto('http://localhost');
    const html = (await source('admin_index.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
    await page.setContent(html);
    for (const path of ['css/admin_theme.css', 'css/admin_consulting.css']) await page.addStyleTag({ content: await source(path) });
    await page.evaluate(({ caseId, options }) => {
        window.CONFIG = { api: { consulting: '/synthetic/consulting' } };
        const applicationId = caseId.replace('CASE_', 'APP_'), responseId = 'SOURCE_RESPONSE_SYNTHETIC';
        const empty = { meeting: { channel: 'site', completedAt: '', evidence: '', confirmed: false }, conclusion: '', requiredConditions: '', flexibleConditions: '', riskTolerance: 'unconfirmed', riskReason: '',
            unresolved: { status: 'unconfirmed', detail: '' }, questions: [], clarifications: [], comparisons: [], planC: { vocational: 'confirm', medical: 'confirm', differentTrack: 'confirm', differentRegion: 'confirm' }, rationale: '', furtherChecks: '', internalMemo: '', evidenceRefs: [] };
        const content = { ...structuredClone(empty), conclusion: '통학을 유지하며 한 군의 안정 지원을 확보합니다.', requiredConditions: '재수 불가', unresolved: { status: 'none', detail: '' },
            questions: [{ id: 'Q_synthetic', question: '가·나·다군 지원 조합', answer: '한 군의 안정 지원을 확인했습니다.', status: 'answered' }] };
        const summary = { revision: 1, savedAt: '2026-12-08T03:00:00.000Z', savedBy: 'operator', content };
        const ws = { caseId, caseRevision: 7, stage: 'DEV', pipelineVersion: null, workflowState: 'WRITTEN_SESSION_COMPLETED', canEdit: !options.readOnly, summary,
            currentSummaryRevision: 1, emptySummary: empty, questions: [{ id: 'Q_synthetic', question: '가·나·다군 지원 조합' }], surveyDigest: 'sha256:' + 'a'.repeat(64), sourceDigest: 'sha256:' + 'b'.repeat(64),
            survey: { conditions: { dormitoryAllowed: false, repeatStudyAllowed: false, commuteLimit: '90' }, preferences: { rankedChoices: [{ university: '합성 대학', track: '경영' }] }, strategy: { riskTolerance: 'balanced' } },
            differences: [], fields: [{ field: 'conditions.dormitoryAllowed', label: '기숙사 이용', type: 'boolean' }, { field: 'preferences.rankedChoices.0.university', label: '1지망 대학', type: 'short' }], candidates: [],
            readiness: { canFreeze: true, numericalReady: false, items: [{ key: 'survey', label: '현재 제출 조사서', ready: true, blocking: true, detail: '현재 제출본 확인' }, { key: 'admission', label: '입시자료·예측 모델', ready: false, blocking: false, detail: '수치 품질 검수 필요' }] },
            frozen: null, sourceStatus: { status: 'not_frozen', reasons: [] }, history: [{ revision: 1, savedAt: summary.savedAt }], evidenceOptions: [{ id: '01K00000000000000000000001', label: '학생 · 기숙사 이용도 검토할 수 있어요.' }],
            consultation: { status: 'completed', endAt: '2026-12-07T01:30:00.000Z' } };
        window.__reportSource = { ws, calls: [], versions: [structuredClone(summary)], deferGet: options.deferGet, failSave: false, failGet: false };
        if (options.facts) {
            const facts = ['ga', 'na', 'da'].map((group, i) => ({ admissionUnitId: 'UNIT_TEST_00' + i, universityName: i === 0 ? '<svg onload=alert(1)> 대학' : '합성대학교', admissionUnitName: '긴 모집단위 이름을 정확하게 확인하는 합성학과', campusName: '합성캠퍼스', admissionGroup: group,
                convertedScore: 0, maximumScore: 1000, expectedCutoff: i === 2 ? null : { low: 700, point: 710, high: 720 }, cutoffStatistic: i === 2 ? 'unconfirmed' : 'registered_70pct', scoreDelta: i === 2 ? null : -710,
                probability: i === 2 ? null : { low: 0, point: 0, high: 10 }, reportRisk: { label: i === 2 ? '판단 보류' : '위험', band: i === 2 ? 'unknown' : 'risky', wide: true } }));
            const plan = { slots: facts.map(f => ({ group: f.admissionGroup, factId: f.admissionUnitId })), complete: true, riskSatisfied: false, reasonCodes: ['RISK_ALLOCATION_NOT_SATISFIED'] };
            const result = { status: 'partial', numericalReady: false, facts, baseline: { factIds: facts.map(f => f.admissionUnitId) }, planA: plan, planB: { ...plan, reasonCodes: ['TWO_DIFFERENT_ALTERNATIVES_UNAVAILABLE'] }, planC: { alternatives: [], reasonCodes: ['VOCATIONAL_VERIFIED_ALTERNATIVE_UNAVAILABLE'] },
                scoreAnalysis: { records: [{ area: 'english', subject: '영어', selection: null, grade: 2 }] }, coverage: { evaluated: 3373, eligibleConverted: 3000, regularPlanPool: 2800, exclusions: [{ code: 'EDUCATION_REGIME_UNCONFIRMED', count: 10 }] }, warnings: ['COMMUTE_AND_HOUSING_REVIEW_REQUIRED', 'CUTOFF_OR_PROBABILITY_NOT_AVAILABLE'], preferenceGaps: [{ priority: 1, matchingEligibleCount: 0 }] };
            Object.assign(ws, { frozen: { revision: 1, frozenAt: summary.savedAt }, pipelineVersion: 'prepared', sourceStatus: { status: 'current', reasons: [] },
                reportFacts: { status: options.staleFacts ? 'stale' : 'not_calculated', canCalculate: !options.readOnly && !options.staleFacts, sourceRevision: 1, sourceDigest: ws.sourceDigest, revision: 0, record: null } });
            window.__reportSource.factResult = result;
            if (options.withFactsResult) Object.assign(ws.reportFacts, { revision: 1, status: options.staleFacts ? 'stale' : 'current', record: { revision: 1, sourceRevision: 1, calculatedAt: summary.savedAt, result } });
        }
        window.apiFetch = async (_url, request) => {
            const input = JSON.parse(request.body), state = window.__reportSource; state.calls.push(input);
            let data = {};
            if (input.type === 'admin_list_consulting_students') data = { items: [{ applicationId, sourceResponseId: responseId, phase: 'report', studentNameMask: '합*생', phoneMask: '010-****-0000', stateLabel: '상담 완료', nextAction: '상담 정리', updatedAt: summary.savedAt }], nextCursor: null };
            else if (input.type === 'admin_get_consulting_student') data = { application: { applicationId, applicationState: 'CLAIMED', revision: 0, expectedAmount: 300000 }, contact: { studentName: '합성 학생' },
                student: { applicationId, sourceResponseId: responseId, phase: 'report', stateLabel: '상담 완료', nextAction: '상담 정리', updatedAt: summary.savedAt }, case: { caseId, workflowState: 'WRITTEN_SESSION_COMPLETED' }, permissions: { report: true } };
            else if (input.type === 'admin_get_report_source_workspace') {
                if (state.deferGet) await new Promise(resolve => { state.resolveGet = () => { state.deferGet = false; resolve(); }; });
                if (state.failGet) throw Object.assign(new Error('자료를 다시 불러오지 못했습니다.'), { status: 503 });
                data = structuredClone(state.ws);
                if (input.data.summaryRevision) { data.summary = structuredClone(state.versions.find(v => v.revision === input.data.summaryRevision)); data.canEdit = false; }
            } else if (input.type === 'admin_save_report_consultation_summary') {
                if (state.deferSave) await new Promise(resolve => { state.resolveSave = resolve; });
                if (state.failSave) throw Object.assign(new Error('상담 정리 또는 원자료가 변경되었습니다.'), { status: 409 });
                const revision = state.ws.currentSummaryRevision + 1;
                const saved = structuredClone(input.data.summary); saved.questions = saved.questions.map(q => ({ ...q, question: state.ws.questions.find(source => source.id === q.id).question }));
                state.ws.summary = { revision, savedAt: '2026-12-08T03:01:00.000Z', savedBy: 'operator', content: saved };
                state.ws.currentSummaryRevision = revision; state.ws.caseRevision++;
                state.versions.push(structuredClone(state.ws.summary)); state.ws.history.unshift({ revision, savedAt: state.ws.summary.savedAt });
                if (state.failRefreshAfterSave) state.failGet = true;
                data = { caseId, revision, caseRevision: state.ws.caseRevision, unchanged: false };
            } else if (input.type === 'admin_freeze_report_source') {
                state.ws.frozen = { revision: 1, frozenAt: '2026-12-08T03:02:00.000Z', references: {} }; state.ws.pipelineVersion = 'prepared'; state.ws.sourceStatus.status = 'current';
                data = { caseId, frozen: state.ws.frozen, unchanged: false };
            } else if (input.type === 'admin_calculate_report_facts') {
                if (state.deferFacts) await new Promise(resolve => { state.resolveFacts = resolve; });
                if (state.failFacts) throw Object.assign(new Error('원자료가 변경되어 결과를 저장하지 않았습니다.'), { status: 409 });
                state.ws.caseRevision++;
                Object.assign(state.ws.reportFacts, { status: 'current', revision: 1, record: { revision: 1, sourceRevision: 1, calculatedAt: summary.savedAt, result: state.factResult } });
                if (state.failRefreshAfterFacts) state.failGet = true;
                data = { revision: 1, unchanged: false, result: state.factResult };
            }
            return { json: async () => ({ success: true, data }) };
        };
    }, { caseId, options });
    for (const file of ['js/admin/navigation.js', 'js/admin_ui.js', 'js/admin/consulting.js', 'js/admin/consulting-intake.js', 'js/admin/consulting-report-facts.js', 'js/admin/consulting-report-source.js', 'js/admin/consulting-workspace.js']) await page.addScriptTag({ content: await source(file) });
    await page.locator('a[onclick="showSection(\'consulting\')"]').click();
    await page.getByRole('button', { name: '학생 상세', exact: true }).click();
    await page.locator('[data-student-tab="report"]').click();
    if (!options.deferGet) await expect(page.locator('#consultingReportSourceBody')).toBeVisible();
}

test('자료 로딩 중 편집을 잠그고 입력은 자동 저장하지 않으며 명시적 저장에만 버전을 전달한다', async ({ page }) => {
    await prepare(page, { deferGet: true });
    await expect(page.locator('#consultingReportSummaryFields')).toHaveAttribute('disabled', '');
    await expect(page.getByLabel('상담 결론', { exact: true })).toBeDisabled();
    await expect(page.locator('#consultingReportSaveSummary')).toBeDisabled();
    await page.evaluate(() => window.__reportSource.resolveGet());
    await expect(page.getByLabel('상담 결론', { exact: true })).toBeEnabled();
    await page.clock.install(); await page.getByLabel('상담 결론', { exact: true }).fill('수도권 통학을 우선합니다.'); await page.clock.fastForward(10000);
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_save_report_consultation_summary'))).toHaveLength(0);
    await expect(page.locator('#consultingReportFreezeSource')).toBeDisabled();
    await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportSourceStatus')).toContainText('상담 정리를 저장했습니다. (버전 2)');
    const calls = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_save_report_consultation_summary'));
    expect(calls).toHaveLength(1); expect(calls[0].data).toMatchObject({ caseId, expectedCaseRevision: 7, expectedSummaryRevision: 1, summary: { conclusion: '수도권 통학을 우선합니다.' } });
});

test('읽기 전용 관리자는 내용과 준비 상태를 확인하고 저장·기준 고정을 실행할 수 없다', async ({ page }) => {
    await prepare(page, { readOnly: true });
    await expect(page.locator('#consultingReportReadiness')).toContainText('수치 품질 검수 필요');
    await expect(page.getByLabel('상담 결론', { exact: true })).toHaveValue('통학을 유지하며 한 군의 안정 지원을 확보합니다.');
    await expect(page.locator('#consultingReportSaveSummary')).toBeDisabled();
    await page.evaluate(() => { window.saveConsultingReportSummary(); window.freezeConsultingReportSource(); });
    expect(await page.evaluate(() => window.__reportSource.calls.some(c => c.type === 'admin_save_report_consultation_summary' || c.type === 'admin_freeze_report_source'))).toBe(false);
});

test('조사서 원답변을 보존하고 적용값·근거를 명시한 뒤 기준 고정 확인을 받는다', async ({ page }) => {
    await prepare(page);
    await page.getByRole('button', { name: '변경 확인 항목 추가' }).click();
    const row = page.locator('[data-clarification]');
    await expect(row).toContainText('학생의 현재 답변 · 불가');
    await row.getByLabel('상담에서 확인한 값').selectOption('true');
    await row.getByLabel('보고서에 적용할 기준').selectOption('consultation');
    await row.getByLabel('확인 근거·변경 이유').fill('기숙사 이용 가능을 확인했습니다.');
    await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportAppliedValues')).toContainText('보고서 적용: 가능');
    expect(await page.evaluate(() => window.__reportSource.ws.survey.conditions.dormitoryAllowed)).toBe(false);
    page.once('dialog', dialog => dialog.dismiss()); await page.locator('#consultingReportFreezeSource').click();
    expect(await page.evaluate(() => window.__reportSource.calls.some(c => c.type === 'admin_freeze_report_source'))).toBe(false);
    page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingReportFreezeSource').click();
    await expect(page.locator('#consultingReportSourceNotice')).toContainText('작성 기준 1');
    await expect(page.locator('#consultingStudentReport')).toBeDisabled();
    const request = await page.evaluate(() => window.__reportSource.calls.find(c => c.type === 'admin_freeze_report_source'));
    expect(request.data).toMatchObject({ caseId, expectedCaseRevision: 8, expectedSummaryRevision: 2, confirmed: true });
});

test('저장 충돌과 저장 후 조회 실패는 입력을 보존하고 자동 재전송하지 않는다', async ({ page }) => {
    await prepare(page);
    await page.getByLabel('상담 결론', { exact: true }).fill('충돌해도 보존할 정리');
    await page.evaluate(() => { window.__reportSource.failSave = true; });
    await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportSourceStatus')).toContainText('입력은 보존');
    await expect(page.getByLabel('상담 결론', { exact: true })).toHaveValue('충돌해도 보존할 정리');
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_save_report_consultation_summary'))).toHaveLength(1);
    await page.evaluate(() => { window.__reportSource.failSave = false; window.__reportSource.failRefreshAfterSave = true; });
    await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportSourceStatus')).toContainText('최신 자료를 다시 불러오지는 못했습니다');
    await expect(page.getByLabel('상담 결론', { exact: true })).toHaveValue('충돌해도 보존할 정리');
    await expect(page.locator('#consultingReportFreezeSource')).toBeDisabled();
});

test('원자료 변경과 과거 상담 버전을 표시하고 저장하지 않은 입력은 확인 없이 버리지 않는다', async ({ page }) => {
    await prepare(page);
    await page.getByLabel('상담 결론', { exact: true }).fill('새 상담 결론'); await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportSummaryMeta')).toContainText('버전 2');
    await page.locator('#consultingReportSummaryVersion').selectOption('1');
    await expect(page.getByLabel('상담 결론', { exact: true })).toHaveValue('통학을 유지하며 한 군의 안정 지원을 확보합니다.');
    await expect(page.locator('#consultingReportSaveSummary')).toBeDisabled();
    await page.locator('#consultingReportSummaryVersion').selectOption('');
    await page.getByLabel('상담 결론', { exact: true }).fill('아직 저장하지 않은 결론');
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: '작성 자료 새로고침' }).click();
    await expect(page.getByLabel('상담 결론', { exact: true })).toHaveValue('아직 저장하지 않은 결론');
    await page.evaluate(() => { const s = window.__reportSource.ws; s.sourceStatus = { status: 'stale', reasons: ['조사서', '입시자료·예측 모델'] }; s.differences = [{ field: ['preferences', 'additionalPreference'], before: '이전 답변', after: '<svg onload=alert(1)>' }]; });
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '작성 자료 새로고침' }).click();
    await expect(page.locator('#consultingReportSourceNotice')).toContainText('기준 고정 후 변경된 자료');
    await page.locator('#consultingReportSurveyChanges summary').click();
    await expect(page.locator('#consultingReportSurveyChangesBody')).toContainText('<svg onload=alert(1)>');
    await expect(page.locator('#consultingWorkspaceReport svg')).toHaveCount(0);
});

test('외부 상담의 실제 완료 시각을 한국시간으로 변환하고 직접 확인과 근거를 저장한다', async ({ page }) => {
    await prepare(page);
    await page.getByLabel('상담 방식', { exact: true }).selectOption('phone');
    await page.getByLabel('외부 상담 실제 완료 시각 (한국시간)').fill('2026-12-07T10:30');
    await page.getByLabel('직접 정리한 근거', { exact: true }).fill('전화로 지원 방향을 정리했습니다.');
    await page.getByLabel('외부 상담을 실제로 마쳤으며').check(); await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportSummaryMeta')).toContainText('버전 2');
    const request = await page.evaluate(() => window.__reportSource.calls.find(c => c.type === 'admin_save_report_consultation_summary'));
    expect(request.data.summary.meeting).toEqual({ channel: 'phone', completedAt: '2026-12-07T01:30:00.000Z', evidence: '전화로 지원 방향을 정리했습니다.', confirmed: true });
});

test('세션 종료 이후 도착한 저장 응답은 학생 정보나 정리 입력을 복원하지 않는다', async ({ page }) => {
    await prepare(page); await page.getByLabel('상담 결론', { exact: true }).fill('나중에 돌아오면 안 되는 내용');
    await page.evaluate(() => { window.__reportSource.deferSave = true; }); await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportSaveSummary')).toBeDisabled();
    await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__reportSource.resolveSave(); });
    await expect(page.locator('#consultingReportSourceBody')).toBeHidden(); await expect(page.locator('#consultingReportSourceStatus')).toBeEmpty();
    await expect(page.getByLabel('상담 결론', { exact: true })).toHaveValue('');
});

test('긴 상담 내용과 입력 폼은 모바일·데스크톱에서 넘치지 않고 주요 버튼에 접근한다', async ({ page }, testInfo) => {
    await prepare(page); await page.getByLabel('상담 결론', { exact: true }).fill('지원 방향과 통학 조건을 함께 확인합니다. '.repeat(60));
    for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.locator('#consultingWorkspaceReport').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        expect(await page.locator('#consultingReportSaveSummary').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: testInfo.outputPath(`report-source-${width}.png`), fullPage: true });
    }
});

test('계산은 고정 기준만 전송하고 성적·라인·A/B/C에서 0과 미확인 수치·통계 종류를 구분한다', async ({ page }) => {
    await prepare(page, { facts: true }); await page.locator('#consultingReportCalculateFacts').click();
    const root = page.locator('#consultingReportFactsResult');
    await expect(root).toContainText('전체 평가 3,373개'); await expect(root).toContainText('등록자 70% 컷 추정');
    await expect(root).toContainText('0 / 1,000'); await expect(root).toContainText('0%'); await expect(root).toContainText('판단 보류');
    for (const index of [1, 3, 4]) await expect(root.locator('tbody tr').first().locator('td').nth(index)).toHaveText('—');
    await expect(root).toContainText('실제 통학 시간'); await expect(root).toContainText('플랜 A'); await expect(root).toContainText('플랜 B'); await expect(root).toContainText('플랜 C');
    await expect(root).toContainText('<svg onload=alert(1)> 대학'); await expect(root.locator('svg')).toHaveCount(0);
    const sent = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_calculate_report_facts'));
    expect(sent).toHaveLength(1); expect(Object.keys(sent[0].data).sort()).toEqual(['caseId', 'expectedCaseRevision', 'expectedSourceDigest', 'expectedSourceRevision']);
});

test('계산 중 입력·재실행을 잠그고 세션 종료 뒤 늦게 도착한 결과를 노출하지 않는다', async ({ page }) => {
    await prepare(page, { facts: true }); await page.evaluate(() => { window.__reportSource.deferFacts = true; });
    await page.locator('#consultingReportCalculateFacts').click(); await expect(page.locator('#consultingReportCalculateFacts')).toBeDisabled();
    await expect(page.getByLabel('상담 결론', { exact: true })).toBeDisabled();
    await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__reportSource.resolveFacts(); });
    await expect(page.locator('#consultingReportFactsResult')).toBeEmpty(); await expect(page.locator('#consultingReportFactsStatus')).toBeEmpty();
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_calculate_report_facts'))).toHaveLength(1);
});

test('읽기 전용·오래된 기준·저장 전 수정은 계산을 막고 실패는 자동 재전송하지 않는다', async ({ page }) => {
    await prepare(page, { facts: true, readOnly: true }); await expect(page.locator('#consultingReportCalculateFacts')).toBeDisabled();
    await prepare(page, { facts: true, withFactsResult: true, staleFacts: true }); await expect(page.locator('#consultingReportFactsStatus')).toContainText('이전 기준'); await expect(page.locator('#consultingReportCalculateFacts')).toBeDisabled();
    await prepare(page, { facts: true }); await page.getByLabel('상담 결론', { exact: true }).fill('저장 전 변경'); await expect(page.locator('#consultingReportCalculateFacts')).toBeDisabled();
    await page.evaluate(() => { window.__reportSource.failFacts = true; }); await page.locator('#consultingReportSaveSummary').click();
    await expect(page.locator('#consultingReportCalculateFacts')).toBeEnabled(); await page.locator('#consultingReportCalculateFacts').click();
    await expect(page.locator('#consultingReportFactsStatus')).toContainText('원자료가 변경');
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_calculate_report_facts'))).toHaveLength(1);
});

test('점수·플랜 결과는 모바일과 데스크톱에서 가로 넘침 없이 확인하고 표만 스크롤한다', async ({ page }, testInfo) => {
    await prepare(page, { facts: true, withFactsResult: true });
    for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.locator('#consultingWorkspaceReport').evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
        expect(await page.locator('#consultingReportCalculateFacts').evaluate(n => n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        await page.locator('#consultingReportFactsPanel').scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`report-facts-${width}.png`), fullPage: true });
    }
});

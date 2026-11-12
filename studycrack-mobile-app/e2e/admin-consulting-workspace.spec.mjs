import { expect, test } from '@playwright/test';

test('운영팀은 ID 입력 없이 본인의 불가 시간만 저장하고 역할별 전체 일정을 확인한다', async ({ page }, testInfo) => {
    const state = await prepare(page);
    const first = { slotId: 'WST_20261207_1000', localDate: '2026-12-07', localTime: '10:00', startAt: '2026-12-07T01:00:00.000Z' };
    const second = { ...first, slotId: 'WST_20261207_1030', localTime: '10:30', startAt: '2026-12-07T01:30:00.000Z' };
    state.board = { settings: { startDate: '2026-12-07', endDate: '2026-12-20', lunchStart: '12:00', lunchEnd: '13:00', lunchMode: 'avoid', compactDays: true, revision: 0 },
        placements: [], confirmed: [{ ...first, counselorId: 'synthetic-admin', teamRole: 'CMO', caseId: 'CASE_22222222-2222-4222-8222-222222222222', studentName: '합*생', revision: 1 }], unassigned: [], hasOpenTimes: true, canManage: true,
        team: { configured: true, revision: 4, members: [{ counselorId: 'synthetic-admin', role: 'CMO', enabled: true }],
            self: { role: 'CMO', editable: true, blockedSlots: [], lockedSlots: [second.slotId] }, slots: [first, second] } };
    await enterConsulting(page);
    await page.getByText('서면상담 전체 시간표', { exact: true }).click();
    await page.getByText('배정 옵션·나의 불가 시간', { exact: true }).click();
    await expect(page.locator('#consultingTeamIdentity')).toContainText('CMO');
    await expect(page.locator('#consultingScheduleBoardBody').getByRole('button', { name: '상담 열기' })).toBeVisible();
    await expect(page.getByLabel('상담사 ID', { exact: true })).toHaveCount(0);
    await expect(page.locator('#consultingTeamBlockedSlots').getByRole('checkbox', { name: '10:30' })).toBeDisabled();
    await page.locator('#consultingTeamBlockedSlots').getByRole('checkbox', { name: '10:00' }).check();
    await page.getByRole('button', { name: '나의 불가 시간 저장' }).click();
    await expect.poll(() => state.calls.filter(item => item.type === 'admin_save_own_written_unavailability').length).toBe(1);
    expect(state.calls.find(item => item.type === 'admin_save_own_written_unavailability').data).toEqual({ expectedRevision: 4, blockedSlots: [first.slotId] });
    expect(await page.evaluate(() => window.__adminAncillaryCalls)).not.toEqual(expect.arrayContaining(['populateTutorFilter']));
    expect(await page.evaluate(() => window.__adminAncillaryCalls)).not.toEqual(expect.arrayContaining(['fetchQnaBadgeCount']));
    await page.setViewportSize({ width: 320, height: 900 });
    await page.screenshot({ path: testInfo.outputPath('admin-team-availability-320.png'), fullPage: true });
});

test('시간표 권한 403은 자동 재조회를 멈추고 수동 재시도로 복구한다', async ({ page }) => {
    const state = await prepare(page);
    await page.clock.install();
    state.boardError = 403;
    await enterConsulting(page);
    await page.getByText('서면상담 전체 시간표', { exact: true }).click();
    await expect(page.locator('#consultingScheduleBoardStatus')).toContainText('자동 재조회를 중지');
    await page.clock.runFor(65000);
    expect(state.calls.filter(item => item.type === 'admin_get_written_schedule_board')).toHaveLength(1);
    state.boardError = 0;
    state.board = { settings: { startDate: '2026-12-07', endDate: '2026-12-20', lunchStart: '12:00', lunchEnd: '13:00', lunchMode: 'avoid', compactDays: true, revision: 0 }, placements: [], confirmed: [], unassigned: [], hasOpenTimes: false };
    await page.getByRole('button', { name: '지금 갱신', exact: true }).click();
    await expect(page.locator('#consultingScheduleBoardStatus')).toContainText('추천 0건');
});

test('초대 취소 확인은 정확한 문구를 받고 취소된 신청을 별도 분류한다', async ({ page }) => {
    const state = await prepare(page);
    Object.assign(state.students[0], { stageVerified: true, activeInviteId: 'INVITE_synthetic' });
    Object.assign(state.students[0].application, { applicationState: 'INVITED' });
    await enterConsulting(page); await openStudent(page);
    page.on('dialog', dialog => dialog.type() === 'prompt' ? dialog.accept('초대 취소') : dialog.accept());
    await page.getByRole('button', { name: '미사용 초대 취소' }).click();
    await expect.poll(() => state.calls.filter(item => item.type === 'admin_revoke_consulting_invite').length).toBe(1);
    expect(state.calls.find(item => item.type === 'admin_revoke_consulting_invite').data.reason).toBe('초대 취소');
    await page.getByRole('button', { name: '← 학생 목록', exact: true }).click();
    await page.getByRole('button', { name: '보류·거절·초대 취소', exact: true }).click();
    await expect(page.locator('#consultingDirectoryBody')).toContainText('초대 취소');
    await expect(page.locator('#consultingDirectoryBody')).not.toContainText('둘*생');
});

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
        window.apiFetch = async (_url, options) => {
            const response = await fetch('/synthetic-api', options);
            if (!response.ok) {
                const error = await response.json();
                throw Object.assign(new Error(error.error || error.message || 'Synthetic API error'), { status: response.status, code: error.code });
            }
            return response;
        };
        window.__adminAncillaryCalls = [];
        for (const name of ['loadAdminStats', 'populateTutorFilter', 'searchStudents', 'fetchUnreadNotiCount', 'fetchQnaBadgeCount', 'loadMatchingData', 'clearStudentJoinDateRange', 'loadTutorStats', 'loadAllQna']) window[name] = () => window.__adminAncillaryCalls.push(name);
    </script>`;
    const document = html.replace('</body>', `${bootstrap}${scripts.map(src => `<script src="/${src}"></script>`).join('')}</body>`);
    const state = { calls: [], emptyFirst: false, deferType: null, resolve: null, failMutation: false, materialError: false, legacyMaterial: false, revisedMaterial: false, confirmed: false };
    const contact = { studentName: '합성 학생', phone: '01000000000', email: 'synthetic@example.invalid', payerName: '합성 입금자' };
    const detail = n => ({ application: { applicationId: applicationId(n), applicationState: n === 2 ? 'CLAIMED' : 'PAYMENT_REVIEW', paymentReviewStatus: 'pending', revision: 0, expectedAmount: 300000, studentNameMask: '합*생', phoneMask: '010-****-0000' }, contact: { ...contact, studentName: n === 2 ? '둘째 합성 학생' : contact.studentName }, payerRelationship: 'self', contactMethod: 'email', studentStatus: 'senior', sourceResponseId: record(n), originalSubmission: { ...contact }, case: n === 2 ? { caseId, workflowState: 'REPORT_REVIEW', revision: 3 } : null, permissions: { materials: true, schedule: true, report: true, finalCall: true } });
    state.students = [detail(1), detail(2)];
    const summary = (data, n) => {
        if (data.application.inviteRevoked) return { applicationId: applicationId(n), sourceResponseId: record(n), phase: 'attention', stateLabel: '초대 취소', nextAction: '초대 재발급', updatedAt: '2026-11-11T00:00:00.000Z' };
        const report = data.case?.workflowState === 'REPORT_REVIEW';
        return { applicationId: applicationId(n), sourceResponseId: record(n), caseId: data.case?.caseId || null, studentNameMask: n === 2 ? '둘*생' : '합*생', phoneMask: '010-****-0000', phase: report ? 'report' : data.case || data.application.applicationState === 'INVITED' ? 'onboarding' : 'intake', stateLabel: report ? '보고서 검수' : data.case ? '자료 검수' : data.application.applicationState === 'INVITED' ? '초대 발급·가입 대기' : data.application.inputReviewRequired ? '신청 정보 보완' : '입금 확인 대기', nextAction: report ? '보고서 검수·승인' : '신청 정보·입금 확인', updatedAt: '2026-11-04T00:00:00.000Z' };
    };
    const snapshot = {
        formVersion: 4,
        studentStatus: { graduationYear: 2027, applicantType: 'high_school_senior', schoolType: 'general', schoolName: '가상고', residenceRegion: '서울 송파구' },
        conditions: { commuteLimit: 'over_120', commuteMaxMinutes: null, dormitoryAllowed: false, repeatStudyAllowed: true },
        preferences: { rankedChoices: [{ region: '서울', university: '가상대학교', track: '공학' }], additionalPreference: '가상대학교 전자공학과 검토' },
        strategy: { riskTolerance: 'safe', priorityOrder: ['major', 'region', 'brand', 'commute', 'employment'] },
        qualitative: { strengths: '이전 답변', concerns: '합성 상담 내용\n둘째 줄', guardianOpinion: '보호자 의견 예시', specialCircumstances: '<img src=x onerror=alert(1)>', consultationQuestions: ['가군 질문', '나군 질문'] },
        consent: { accurateInformation: true, analysisUse: true },
        scores: { examYear: 2026, examType: 'csat', records: [
            { area: 'korean', subject: '국어', selection: '화법과작문', commonRawScore: 76, electiveRawScore: 0, rawScore: 76 },
            { area: 'english', subject: '영어', grade: 2 }, { area: 'inquiry', subject: '탐구 1' },
            { area: 'foreign_language', subject: '독일어Ⅰ', grade: 4 }
        ] }
    };
    await page.route(/\/admin(?:_index\.html)?(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/html', body: document }));
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/synthetic-api', async route => {
        const request = route.request().postDataJSON(); state.calls.push(request); let data;
        if (request.type === 'admin_list_consulting_students') {
            const items = state.students.map((item, i) => summary(item, i + 1)).filter(item => request.data.phase === 'all' || request.data.phase === item.phase);
            const first = !request.data.cursor;
            data = {
                items: state.emptyFirst && first ? [] : state.splitPages ? items.slice(first ? 0 : 1, first ? 1 : 2) : items,
                nextCursor: first && (state.emptyFirst || (state.splitPages && items.length > 1)) ? 'synthetic_cursor' : null,
                exportLimit: state.exportLimit || null
            };
        } else if (request.type === 'admin_get_consulting_export_columns') {
            data = { columns: [
                { id: 'application_id', label: '신청 ID', group: '접수·진행' },
                { id: 'workflow_state', label: '진행 단계', group: '접수·진행' },
                { id: 'student_name', label: '학생 이름', group: '신청자·연락처' },
                { id: 'phone', label: '전화번호', group: '신청자·연락처' },
                { id: 'email', label: '이메일', group: '신청자·연락처' }
            ] };
        } else if (request.type === 'admin_export_consulting_students') {
            if (state.exportStatus) return route.fulfill({ status: state.exportStatus, json: { success: false } });
            data = { csv: '\uFEFF"진행 단계","전화번호"\r\n"입금 확인 대기","01000000001"\r\n"보고서 검수","01000000002"\r\n',
                rowCount: request.data.students.length, fileName: 'jungsi-consulting-20261110T112233Z.csv' };
        } else if (request.type === 'admin_get_consulting_student') {
            const index = state.students.findIndex(item => item.application.applicationId === request.data.applicationId);
            data = { ...structuredClone(state.students[index]), student: summary(state.students[index], index + 1) };
        } else if (request.type === 'admin_revoke_consulting_invite') {
            const current = state.students.find(item => item.application.applicationId === request.data.applicationId);
            current.inviteRevoked = true; current.application.inviteRevoked = true; current.application.revision++;
            data = { result: 'revoked', revision: current.application.revision };
        } else if (request.type === 'admin_review_application_input') {
            const current = state.students[0]; Object.assign(current.contact, request.data.input); Object.assign(current.application, { inputReviewRequired: false, intakeIssues: [], paymentReviewStatus: 'pending', revision: current.application.revision + 1 });
            data = { applicationId: applicationId(1), revision: current.application.revision, inputReviewRequired: false };
        } else if (request.type === 'admin_verify_manual_payment') {
            Object.assign(state.students[0].application, { applicationState: 'INVITED', paymentReviewStatus: 'verified', revision: 1 }); state.students[0].activeInviteId = 'SYNTHETIC_INVITE';
            data = { applicationId: applicationId(1), applicationState: 'INVITED', revision: 1 };
        } else if (request.type === 'admin_get_v2_material_detail') {
            if (state.materialError) return route.fulfill({ status: 503, json: { success: false } });
            const current = state.students[1].case;
            const pending = current.workflowState === 'MATERIAL_REVIEW';
            const submission = { submittedAt: '2026-11-04T00:00:00.000Z', snapshot };
            data = {
                case: current,
                submission: state.legacyMaterial || current.workflowState === 'SURVEY_DRAFT' ? null : submission,
                originalSubmission: state.legacyMaterial ? { ...submission, snapshot: { ...snapshot, formVersion: undefined, preferences: { desiredMajors: ['국문학'], desiredTracks: ['인문'], requiredCandidates: ['가상대'] }, conditions: { commuteMaxMinutes: 90, tuitionBudgetAnnual: 3000000 } } } : null,
                verification: pending ? { status: 'pending', studentInput: snapshot.scores } : { status: 'matched', verifiedInput: { ...snapshot.scores, records: [{ area: 'english', subject: '영어', grade: 3 }] } },
                files: [{ fileId: 'FILE_synthetic', status: 'linked', displayName: '제출 성적표.pdf' }, { fileId: 'FILE_waiting', status: 'quarantined', displayName: '검사 중.pdf' }]
            };
            if (state.revisedMaterial) {
                const next = { ...submission, revision: 6, snapshot: { ...snapshot,
                    studentStatus: { ...snapshot.studentStatus, residenceRegion: '부산' },
                    conditions: { ...snapshot.conditions, repeatStudyAllowed: false },
                    qualitative: { ...snapshot.qualitative, consultationTopics: ['group_plan', 'retake_decision'], decisionOptions: '통학과 전공을 비교' }
                } };
                data.submission = next;
                data.originalSubmission = submission;
                data.reviewedSubmission = state.confirmed ? next : submission;
                data.surveyReview = { needsReview: !state.confirmed, scoreChanged: false, changes: state.confirmed ? [] : [
                    { field: ['studentStatus', 'residenceRegion'], before: '서울 송파구', after: '부산' },
                    { field: ['qualitative', 'guardianOpinion'], before: '구형 검수 답변', after: '구형 수정 답변' }
                ] };
            }
            if (state.correctionScoreDigest) {
                data.correctionScoreDigest = state.correctionScoreDigest;
                data.submission.revision = 6;
                data.surveyReview = { needsReview: true, scoreChanged: true, changes: [] };
                data.reviewedSubmission = submission;
                data.verification.verifiedInput = { ...snapshot.scores, records: [
                    { area: 'korean', subject: '국어', selection: '화법과작문', standardScore: 126, percentile: 90, grade: 2 },
                    { area: 'english', subject: '영어', grade: 2 }
                ] };
            }
            if (state.supplementFields) {
                data.submission.revision = 0;
                data.supplementFields = state.supplementFields;
                data.supplement = state.supplement;
            }
        } else if (request.type === 'admin_request_v2_supplement') {
            const current = state.students[1].case;
            current.workflowState = 'SUPPLEMENT_REQUIRED';
            state.supplement = { fields: request.data.fieldNotes.map(({ field, note }) => ({
                field, label: field === 'studentStatus.residenceRegion' ? '거주 지역' : '1지망 대학', note
            })) };
            data = { caseId, notificationQueued: true };
        } else if (request.type === 'admin_verify_v2_materials') {
            state.students[1].case.workflowState = 'AVAILABILITY_REQUIRED';
            data = { caseId, notificationQueued: true };
        } else if (request.type === 'admin_get_written_schedule_board') {
            if (state.boardError) return route.fulfill({ status: state.boardError, contentType: 'application/json', body: JSON.stringify({ success: false, code: 'FORBIDDEN', error: 'Synthetic unavailable' }) });
            data = state.board;
        } else if (request.type === 'admin_save_own_written_unavailability') {
            state.board.team.revision++;
            state.board.team.self.blockedSlots = request.data.blockedSlots;
            data = { revision: state.board.team.revision };
        } else if (request.type === 'admin_list_schedule_candidates') {
            data = state.scheduleCandidates;
        } else if (request.type === 'admin_confirm_written_assignment') {
            state.board = { ...state.board, placements: [], confirmed: [{ ...state.board.placements[0], ...state.scheduleCandidates.candidates.find(slot => slot.slotId === request.data.slotId), revision: 1 }] };
            data = { session: state.board.confirmed[0] };
        } else if (request.type === 'admin_reschedule_written_session') {
            state.scheduleCandidates.session = { ...state.scheduleCandidates.session,
                ...state.scheduleCandidates.manualCandidates.find(slot => slot.slotId === request.data.slotId), revision: 2 };
            data = { session: state.scheduleCandidates.session };
        } else if (request.type === 'admin_request_written_reschedule') {
            state.scheduleCandidates.change = { kind: 'admin', requestId: 'WCR_synthetic', revision: 1,
                offers: state.scheduleCandidates.candidates.filter(slot => request.data.offers.some(offer => offer.slotId === slot.slotId)) };
            state.scheduleCandidates.changeRevision = 1;
            state.scheduleCandidates.candidates = [];
            data = { session: state.scheduleCandidates.session, change: state.scheduleCandidates.change };
        } else if (request.type === 'admin_save_written_schedule_settings') {
            const { expectedRevision, ...settings } = request.data;
            state.board.settings = { ...settings, revision: expectedRevision + 1 };
            data = state.board.settings;
        } else if (request.type === 'admin_list_v2_survey_changes') {
            const before = request.data.before;
            data = { caseId, nextBefore: before ? null : 2, entries: [{
                revision: before ? 1 : 6, changedAt: '2026-11-06T00:00:00.000Z', changedBy: '학생',
                changes: before ? [
                    { field: ['qualitative', 'concerns'], before: '', after: '구형 변경 이력' },
                    { field: ['qualitative', 'specialCircumstances'], before: '', after: '<img src=x>' }
                ] : [
                    { field: ['studentStatus', 'residenceRegion'], before: '서울 송파구', after: '부산' },
                    { field: ['conditions', 'repeatStudyAllowed'], before: true, after: false },
                    { field: ['qualitative', 'consultationTopics'], before: null, after: ['group_plan', 'retake_decision'] }
                ]
            }] };
        } else if (request.type === 'admin_confirm_v2_survey_revision') {
            state.confirmed = true;
            data = { caseId, surveyRevision: 6 };
        }
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

test('CSV는 여러 페이지의 선택 학생과 검색해 체크한 항목만 다운로드한다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await prepare(page);
    state.exportLimit = 25;
    state.splitPages = true;
    await enterConsulting(page);
    const toolbar = page.locator('#consultingDirectoryExportTools');
    await expect(toolbar.getByRole('button', { name: 'CSV 내보내기' })).toBeDisabled();
    await page.locator('#consultingDirectoryBody').getByRole('checkbox', { name: /합\*생/ }).check();
    await page.locator('#consultingDirectoryNext').click();
    await expect(page.locator('#consultingDirectoryPage')).toHaveText('2페이지 · 1명');
    await toolbar.getByRole('button', { name: '현재 페이지 선택', exact: true }).click();
    await expect(toolbar).toContainText('2명 선택 · 최대 25명');
    await page.locator('#consultingDirectoryPrevious').click();
    await expect(page.locator('#consultingDirectoryBody').getByRole('checkbox')).toBeChecked();
    await toolbar.getByRole('button', { name: 'CSV 내보내기' }).click();
    const dialog = page.getByRole('dialog', { name: 'CSV 내보내기' });
    await expect(dialog).toBeVisible();
    await dialog.getByText('선택 학생 2명', { exact: true }).click();
    await expect(dialog.getByRole('listitem')).toHaveCount(2);
    const submit = dialog.getByRole('button', { name: 'CSV 다운로드' });
    await expect(submit).toBeDisabled();
    await dialog.getByRole('checkbox', { name: '진행 단계', exact: true }).check();
    await dialog.getByRole('searchbox').fill('전화번호');
    await dialog.getByRole('checkbox', { name: '신청자·연락처 검색 결과 전체 선택' }).check();
    await expect(dialog).toContainText('2개 항목 선택');
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const received = page.waitForEvent('download');
    await submit.click();
    const download = await received;
    expect(download.suggestedFilename()).toBe('jungsi-consulting-20261110T112233Z.csv');
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString('utf8')).toBe('\uFEFF"진행 단계","전화번호"\r\n"입금 확인 대기","01000000001"\r\n"보고서 검수","01000000002"\r\n');
    expect(state.calls.filter(call => call.type === 'admin_export_consulting_students')).toEqual([{
        type: 'admin_export_consulting_students', data: { columnIds: ['workflow_state', 'phone'],
            students: [1, 2].map(n => ({ applicationId: applicationId(n), sourceResponseId: record(n) })) }
    }]);
    await expect(dialog).toBeHidden();
    await expect(page.locator('#consultingExportListStatus')).toHaveText('2명 CSV 다운로드를 시작했습니다.');
});

test('권한과 인원 한도, 실패와 세션 종료는 CSV 발급과 선택 노출을 막는다', async ({ page }) => {
    const state = await prepare(page);
    await enterConsulting(page);
    const toolbar = page.locator('#consultingDirectoryExportTools');
    await expect(toolbar).toBeHidden();
    await expect(page.locator('#consultingDirectoryBody').getByRole('checkbox')).toHaveCount(0);
    state.exportLimit = 1;
    await page.getByRole('button', { name: '01 접수·입금', exact: true }).click();
    await toolbar.getByRole('button', { name: '현재 페이지 선택', exact: true }).click();
    await page.getByRole('button', { name: '04 분석·보고서', exact: true }).click();
    await toolbar.getByRole('button', { name: '현재 페이지 선택', exact: true }).click();
    await expect(page.locator('#consultingExportListStatus')).toContainText('1명까지');
    await expect(toolbar).toContainText('1명 선택 · 최대 1명');
    await toolbar.getByRole('button', { name: 'CSV 내보내기' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: '진행 단계', exact: true }).check();
    const downloads = [];
    page.on('download', download => downloads.push(download));
    state.exportStatus = 403;
    await dialog.getByRole('button', { name: 'CSV 다운로드' }).click();
    await expect(dialog.getByRole('status')).toHaveText('선택한 자료를 내보낼 권한을 확인해주세요.');
    expect(downloads).toHaveLength(0);
    state.exportStatus = null;
    state.deferType = 'admin_export_consulting_students';
    await dialog.getByRole('button', { name: 'CSV 다운로드' }).click();
    await expect.poll(() => Boolean(state.resolve)).toBe(true);
    await expect(dialog.getByRole('searchbox')).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: '진행 단계', exact: true })).toBeDisabled();
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended')));
    state.resolve();
    await expect(dialog).toBeHidden();
    await expect(toolbar).toBeHidden();
    await expect(page.locator('#consultingExportStudentList')).toBeEmpty();
    await expect(page.locator('#consultingDirectoryBody')).toBeEmpty();
    expect(downloads).toHaveLength(0);
});

test('관리자는 항목별 보완 내용을 미리 확인해 한 번에 보내고 검수 완료로 시간 선택을 연다', async ({ page }) => {
    const state = await prepare(page);
    state.students[1].case.workflowState = 'MATERIAL_REVIEW';
    state.supplementFields = ['studentStatus.residenceRegion', 'preferences.rankedChoices.0.university'];
    await enterConsulting(page);
    await page.getByRole('button', { name: '02 가입·조사서', exact: true }).click();
    await openStudent(page);
    await page.getByText('거주 지역 보완 메모 추가', { exact: true }).click();
    await page.getByRole('textbox', { name: '거주 지역 보완 메모' }).fill('구 단위로 적어주세요.');
    await page.getByText('1지망 대학 보완 메모 추가', { exact: true }).click();
    await page.getByRole('textbox', { name: '1지망 대학 보완 메모' }).fill('<img src=x> 캠퍼스를 알려주세요.');
    await page.getByRole('button', { name: '보완 요청 미리보기' }).click();
    const preview = page.getByRole('dialog', { name: '보완 요청 확인' });
    await expect(preview).toContainText('구 단위로 적어주세요.');
    await expect(preview).toContainText('<img src=x> 캠퍼스를 알려주세요.');
    await expect(preview.locator('img')).toHaveCount(0);
    expect(state.calls.some(({ type }) => type === 'admin_request_v2_supplement')).toBe(false);
    await preview.getByRole('button', { name: '보완 요청 보내기' }).click();
    await expect(page.locator('#consultingMaterialSupplementNotice')).toContainText('구 단위로 적어주세요.');
    const sent = state.calls.filter(({ type }) => type === 'admin_request_v2_supplement');
    expect(sent).toHaveLength(1);
    expect(sent[0].data).toMatchObject({ caseId, expectedSurveyRevision: 0, reasonCode: 'OTHER', reasonText: '', fieldNotes: [
        { field: 'studentStatus.residenceRegion', note: '구 단위로 적어주세요.' },
        { field: 'preferences.rankedChoices.0.university', note: '<img src=x> 캠퍼스를 알려주세요.' }
    ] });

    state.students[1].case.workflowState = 'MATERIAL_REVIEW';
    state.supplement = null;
    await page.reload();
    await page.locator('#consultingMaterialReason').fill('공식 성적표 확인 완료');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '확인 완료 · 일정 선택 열기' }).click();
    await expect(page.locator('#consultingMaterialStatus')).toContainText('학생의 상담 가능 시간 선택을 열었습니다.');
    expect(state.calls.filter(({ type }) => type === 'admin_verify_v2_materials')).toHaveLength(1);
});

test('관리자 메뉴·Q&A 상태·공지 하위 메뉴는 실제 새로고침 뒤에도 유지한다', async ({ page }) => {
    await prepare(page);
    for (const [call, section, title] of [["showSection('students')", 'students', null], ["showSection('advanced-stats')", 'advanced-stats', null], ["showQnaSection('done')", 'qna', '응답 완료'], ["showNotiMenu('sent')", 'notifications', '보낸 공지함']]) {
        const link = page.locator(`a[onclick="${call}"]`); await link.evaluate(node => node.closest('.submenu')?.classList.add('open')); await link.click(); await page.reload();
        await expect(page.locator(`#section-${section}`)).toBeVisible(); await expect(page.locator('#section-dashboard')).toBeHidden();
        if (title) await expect(page.locator(section === 'qna' ? '#qnaStatusTitle' : '#notiPageTitle')).toContainText(title);
    }
});
test('단계별 최소 목록에서 학생 상세로 이동하고 선택한 보고서 화면을 복원한다', async ({ page }) => {
    const state = await prepare(page); state.students[1].case.workflowState = 'MATERIAL_REVIEW'; await enterConsulting(page);
    await expect(page.locator('#consultingDirectoryBody')).toContainText('합*생'); await expect(page.locator('#consultingDirectoryBody')).not.toContainText('synthetic@example.invalid');
    await expect(page.locator('#consultingServicePanel')).toBeHidden(); await expect(page.locator('#consultingOperationsPanel')).toBeHidden();
    expect(state.calls.some(call => call.type === 'admin_list_consulting_operations')).toBe(false);
    await page.getByRole('button', { name: '02 가입·조사서', exact: true }).click(); await expect(page.locator('#consultingDirectoryBody')).not.toContainText('합*생'); await openStudent(page);
    await expect(page.locator('#consultingStudentTitle')).toContainText('둘째 합성 학생'); await expect(page.locator('#consultingStudentProgress [aria-current="step"]')).toHaveText('가입·조사서');
    await expect(page.getByRole('button', { name: '조사서·성적표', exact: true })).toHaveAttribute('aria-current', 'page');
    const survey = page.locator('#consultingMaterialSurvey');
    for (const value of ['고3 재학생', '가상고', '서울 송파구', '서울 · 가상대학교 · 공학', '가상대학교 전자공학과 검토', '2시간 이상도 가능', '어려움', '고려 가능', '안정 중심', '1. 전공', '나군 질문', '분석 이용 동의']) await expect(survey).toContainText(value);
    for (const value of ['이전 답변', '합성 상담 내용', '보호자 의견 예시']) await expect(survey).not.toContainText(value);
    await expect(survey).toContainText('<img src=x onerror=alert(1)>');
    await expect(survey.locator('img')).toHaveCount(0);
    await expect(survey.getByRole('row', { name: /^국어 / })).toContainText('공통 76 · 선택 0 · 원점수 76');
    await expect(page.getByRole('button', { name: '제출 성적표.pdf 열기' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '검사 중.pdf 열기' })).toBeDisabled();
    await expect(page.locator('#consultingVerifiedScores')).toContainText('국어 · 원점수 76점 · 공통 76점 · 선택 0점');
    await expect(page.getByRole('spinbutton', { name: '국어 표준점수' })).toHaveValue('');
    await expect(page.getByRole('spinbutton', { name: '영어 표준점수' })).toBeDisabled();
    await expect(page.getByRole('spinbutton', { name: '영어 등급' })).toHaveValue('');
    await expect(page.locator('#consultingVerifiedScores')).toContainText('제2외국어·한문 · 학생 입력 독일어Ⅰ 4등급');
    await expect(page.getByRole('combobox', { name: '제2외국어·한문 과목명' })).toHaveValue('');
    await page.getByRole('combobox', { name: '제2외국어·한문 과목명' }).selectOption('독일어Ⅰ');
    await page.getByRole('spinbutton', { name: '제2외국어·한문 등급' }).fill('4');
    await expect(page.getByRole('textbox', { name: '탐구 1 과목명' })).toHaveValue('');
    await expect(page.getByLabel('검수 결과').locator('option').first()).toHaveText('성적표 확인 완료');
    await page.getByRole('button', { name: '신청·입금', exact: true }).click(); await page.reload();
    await expect(page.locator('#consultingApplicationDetail')).toBeVisible();
    state.students[1].case.workflowState = 'REPORT_REVIEW';
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
    const state = await prepare(page); await enterConsulting(page); state.deferType = 'admin_get_v2_material_detail';
    await page.locator('#consultingDirectoryBody').getByRole('button', { name: '학생 상세' }).nth(1).click(); await expect.poll(() => Boolean(state.resolve)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('studycrack:session-ended')));
    const completed = page.waitForResponse(response => response.url().endsWith('/synthetic-api') && response.request().postDataJSON().type === 'admin_get_v2_material_detail'); state.resolve(); await completed;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const id of ['consultingMaterialSummary', 'consultingMaterialSurvey', 'consultingSurveyHistoryEntries', 'consultingDetailSummary', 'consultingOriginalSubmission', 'consultingStudentIdentifiers']) await expect(page.locator(`#${id}`)).toBeEmpty();
    await expect(page.locator('#consultingContactEmail')).toHaveValue(''); await expect(page.locator('#consultingStudentTitle')).toHaveText('학생 상세');
});
test('현재·최초·검수본을 전환하고 수정 이력을 확인한 뒤 최신 답변을 확인한다', async ({ page }) => {
    const state = await prepare(page); state.revisedMaterial = true;
    await page.setViewportSize({ width: 320, height: 900 });
    await enterConsulting(page); await openStudent(page, 1);
    const answers = page.locator('#consultingMaterialSurvey');
    const versions = page.getByLabel('답변 버전');
    const confirm = page.getByRole('button', { name: '최신 답변 확인', exact: true });
    await expect(answers).toContainText('부산');
    await expect(answers).toContainText('가·나·다군 조합 · 올해 진학과 재수 결정');
    await expect(answers).toContainText('통학과 전공을 비교');
    const retake = answers.locator('.consulting-facts > div').filter({ has: page.getByText('재수 가능성', { exact: true }) });
    await expect(retake.locator('dd')).toHaveText('고려하지 않음');
    await versions.selectOption('original');
    await expect(answers).toContainText('서울 송파구');
    await expect(answers.getByText('이전 답변', { exact: true })).toHaveCount(0);
    await expect(confirm).toBeHidden();
    await versions.selectOption('reviewed');
    await expect(answers).toContainText('서울 송파구');
    await expect(answers).not.toContainText('보호자 의견 예시');
    await versions.selectOption('current');
    await page.getByText('검수 이후 변경된 항목', { exact: true }).click();
    await expect(page.locator('#consultingSurveyReviewChanges')).toContainText('이전 서울 송파구');
    await expect(page.locator('#consultingSurveyReviewChanges')).not.toContainText('구형 검수 답변');
    expect(state.calls.some(call => call.type === 'admin_list_v2_survey_changes')).toBe(false);
    await page.getByText('수정 이력', { exact: true }).click();
    const history = page.locator('#consultingSurveyHistoryEntries');
    await expect(history).toContainText('학생 저장 6회차');
    await expect(history).toContainText('지원 조건 · 재수 가능성');
    await expect(history).toContainText('가·나·다군 조합 · 올해 진학과 재수 결정');
    await page.getByRole('button', { name: '이전 수정 더 보기' }).click();
    await expect(history).toContainText('<img src=x>');
    await expect(history).not.toContainText('구형 변경 이력');
    await expect(history.locator('img')).toHaveCount(0);
    expect(state.calls.filter(call => call.type === 'admin_list_v2_survey_changes').map(call => call.data.before)).toEqual([undefined, 2]);
    expect(await page.locator('#consultingMaterialDetail').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await confirm.click();
    await expect(page.locator('#consultingMaterialStatus')).toContainText('최신 답변을 확인했습니다.');
    expect(state.calls.find(call => call.type === 'admin_confirm_v2_survey_revision').data).toEqual({ caseId, expectedSurveyRevision: 6 });
    await versions.selectOption('reviewed');
    await expect(answers).toContainText('부산');
});
test('제출 전·조회 실패·권한 부족을 구분하고 기존 제출본과 검수 성적을 읽는다', async ({ page }) => {
    const state = await prepare(page); state.students[1].case.workflowState = 'SURVEY_DRAFT'; await enterConsulting(page); await openStudent(page, 1);
    await expect(page.locator('#consultingApplicationDetail')).toBeVisible();
    await page.getByRole('button', { name: '조사서·성적표', exact: true }).click();
    await expect(page.locator('#consultingMaterialStatus')).toHaveAttribute('data-state', 'empty');
    state.students[1].case.workflowState = 'REPORT_REVIEW'; state.materialError = true;
    await page.getByRole('button', { name: '학생 정보 새로고침' }).click();
    await expect(page.locator('#consultingMaterialStatus')).toHaveAttribute('data-state', 'error');
    state.materialError = false; state.legacyMaterial = true;
    await page.getByRole('button', { name: '제출 자료 다시 불러오기' }).click();
    await expect(page.locator('#consultingMaterialSurvey')).toContainText('국문학');
    await expect(page.locator('#consultingMaterialSurvey')).toContainText('3,000,000원');
    await expect(page.locator('#consultingMaterialVerification')).toContainText('등급 3');
    await expect(page.locator('#consultingMaterialReviewActions')).toBeHidden();
    state.students[1].permissions.materials = false;
    const requests = state.calls.filter(call => call.type === 'admin_get_v2_material_detail').length;
    await page.getByRole('button', { name: '학생 정보 새로고침' }).click();
    await expect(page.locator('#consultingMaterialAccess')).toBeVisible();
    await expect(page.getByRole('button', { name: '조사서·성적표', exact: true })).toBeDisabled();
    expect(state.calls.filter(call => call.type === 'admin_get_v2_material_detail')).toHaveLength(requests);
});
test('320px·390px·데스크톱에서 단계·목록·상세가 잘리지 않고 주요 버튼은44px 이상이다', async ({ page }, testInfo) => {
    const state = await prepare(page); await enterConsulting(page);
    for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.locator('#section-consulting').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        await page.screenshot({ path: testInfo.outputPath(`consulting-list-${width}.png`), fullPage: true });
        await openStudent(page); expect(await page.locator('#consultingStudentPanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        expect(await page.locator('#consultingApproveBtn').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        await page.screenshot({ path: testInfo.outputPath(`consulting-student-${width}.png`), fullPage: true }); await page.getByRole('button', { name: '← 학생 목록' }).click();
        await openStudent(page, 1);
        await expect(page.locator('#consultingMaterialDetail')).toBeVisible();
        expect(await page.locator('#consultingMaterialDetail').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`consulting-survey-${width}.png`), fullPage: true }); await page.getByRole('button', { name: '← 학생 목록' }).click();
    }
    state.students[0].contact.studentName = 'A'.repeat(120);
    await page.setViewportSize({ width: 320, height: 900 }); await openStudent(page);
    expect(await page.locator('#consultingStudentPanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

test('전체 서면상담 추천을 자동 갱신하고 학생이 고른 다른 시간으로 개별 확정한다', async ({ page }) => {
    await page.clock.install();
    const state = await prepare(page);
    const settings = { startDate: '2026-12-07', endDate: '2026-12-20', lunchStart: '12:00', lunchEnd: '13:00', lunchMode: 'avoid', compactDays: true, revision: 0 };
    const slot = (time, utc) => ({ slotId: 'WST_20261207_' + time.replace(':', ''), startAt: '2026-12-07T' + utc + ':00.000Z', counselorId: 'tutor-synthetic', lunch: false });
    const first = slot('10:00', '01:00'), updated = slot('10:30', '01:30'), alternate = slot('11:00', '02:00');
    const student = { caseId, studentName: '합*생', availabilityRevision: 1, sessionRevision: null, changeKind: null };
    state.board = { settings, placements: [{ ...student, ...first }], unassigned: [], confirmed: [], hasOpenTimes: true };
    state.scheduleCandidates = { caseId, candidates: [updated, alternate], session: null, availabilityRevision: 2 };
    await enterConsulting(page);
    await page.getByText('서면상담 전체 시간표', { exact: true }).click();
    const board = page.locator('#consultingScheduleBoardBody');
    await expect(board).toContainText('10:00');
    state.board.placements = [{ ...student, ...updated, availabilityRevision: 2 }];
    await page.clock.runFor(20500);
    await expect(board).toContainText('10:30');
    await expect(board).not.toContainText('10:00');
    expect(state.calls.filter(call => call.type === 'admin_confirm_written_assignment')).toHaveLength(0);
    await board.getByRole('button', { name: '다른 시간 보기' }).click();
    const choice = page.getByRole('dialog', { name: '학생별 일정 선택' });
    await choice.getByLabel('가능한 시간').selectOption('1');
    page.once('dialog', dialog => dialog.accept());
    await choice.getByRole('button', { name: '이 시간 확정', exact: true }).click();
    await expect(choice).not.toBeVisible();
    await expect(board).toContainText('11:00');
    expect(state.calls.find(call => call.type === 'admin_confirm_written_assignment').data).toEqual({
        caseId, counselorId: 'tutor-synthetic', slotId: alternate.slotId, expectedAvailabilityRevision: 2
    });
    await page.getByText('배정 옵션·나의 불가 시간', { exact: true }).click();
    await page.getByLabel('점심 배정').selectOption('block');
    await page.getByRole('button', { name: '옵션 저장' }).click();
    await expect(page.locator('#consultingScheduleSettingsStatus')).toContainText('배정 옵션을 저장했습니다.');
    expect(state.calls.find(call => call.type === 'admin_save_written_schedule_settings').data).toMatchObject({
        expectedRevision: 0, lunchMode: 'block', startDate: '2026-12-07', endDate: '2026-12-20'
    });
});

test('학생과 직접 합의한 예외 변경은 확인과 사유를 입력한 뒤에만 전송한다', async ({ page }) => {
    const state = await prepare(page);
    state.students[1].case.workflowState = 'WRITTEN_SESSION_BOOKED';
    const session = { startAt: '2026-12-07T01:00:00.000Z', counselorId: 'tutor-synthetic', revision: 1 };
    const manual = { slotId: 'WST_20261208_1030', startAt: '2026-12-08T01:30:00.000Z', counselorId: 'tutor-synthetic' };
    state.scheduleCandidates = { caseId, candidates: [], session, canChange: true, changeRevision: 0, manualCandidates: [manual] };
    await enterConsulting(page);
    await openStudent(page, 1);
    await page.locator('[data-student-tab="written"]').click();
    await page.getByRole('button', { name: '직접 합의 후 수동 변경' }).click();
    const dialog = page.getByRole('dialog', { name: '학생과 합의한 시간으로 변경' });
    await dialog.getByLabel('가능한 시간').selectOption('0');
    const submit = dialog.getByRole('button', { name: '합의한 일정으로 변경 확정' });
    await submit.click();
    expect(state.calls.filter(call => call.type === 'admin_reschedule_written_session')).toHaveLength(0);
    await dialog.getByRole('checkbox').check();
    await dialog.getByLabel('변경 사유').fill('학생에게 연락해 해당 시간으로 합의했습니다.');
    page.once('dialog', dialog => dialog.accept());
    await submit.click();
    await expect(dialog).not.toBeVisible();
    expect(state.calls.find(call => call.type === 'admin_reschedule_written_session').data).toMatchObject({
        caseId, slotId: manual.slotId, expectedSessionRevision: 1, expectedChangeRevision: 0, mode: 'manual', contactConfirmed: true
    });
});

test('관리자는 최초 선택 중 복수 후보를 골라 한 번에 변경 제안을 보낸다', async ({ page }) => {
    const state = await prepare(page);
    state.students[1].case.workflowState = 'WRITTEN_SESSION_BOOKED';
    const candidates = Array.from({ length: 6 }, (_, index) => ({
        slotId: 'WST_20261208_' + String(10 + index).padStart(2, '0') + '00', startAt: '2026-12-08T' + String(1 + index).padStart(2, '0') + ':00:00.000Z',
        counselorId: 'tutor-synthetic'
    }));
    state.scheduleCandidates = { caseId, candidates, session: { startAt: '2026-12-07T01:00:00.000Z', counselorId: 'tutor-synthetic', revision: 2 },
        canChange: true, changeRevision: 0 };
    await enterConsulting(page);
    await openStudent(page, 1);
    await page.locator('[data-student-tab="written"]').click();
    await page.getByRole('button', { name: '변경 시간 제안', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '학생별 일정 선택' });
    const choices = dialog.getByRole('checkbox');
    await expect(dialog.getByRole('combobox')).toHaveCount(0);
    await expect(choices).toHaveCount(6);
    for (let index = 0; index < 5; index++) await choices.nth(index).check();
    await choices.nth(5).click();
    await expect(choices.nth(5)).not.toBeChecked();
    await expect(page.locator('#consultingScheduleChoiceStatus')).toContainText('최대 5개');
    for (let index = 2; index < 5; index++) await choices.nth(index).uncheck();
    page.once('dialog', dialog => dialog.accept());
    await dialog.getByRole('button', { name: '선택한 시간들 제안 보내기' }).click();
    await expect(dialog).not.toBeVisible();
    expect(state.calls.find(call => call.type === 'admin_request_written_reschedule').data).toEqual({
        caseId, expectedSessionRevision: 2, expectedChangeRevision: 0,
        offers: candidates.slice(0, 2).map(({ slotId, counselorId }) => ({ slotId, counselorId }))
    });
});


test('공개 후 성적 재검수는 기존 검수값과 동시 편집 방지값을 보내고 학생 진행 단계를 유지한다', async ({ page }) => {
    const state = await prepare(page);
    state.students[1].case.workflowState = 'FINAL_CALL_BOOKED';
    state.correctionScoreDigest = 'a'.repeat(64);
    await enterConsulting(page);
    await openStudent(page, 1);
    await page.getByRole('button', { name: '조사서·성적표', exact: true }).click();
    await expect(page.locator('#consultingSurveyReviewNotice')).toContainText('기존 공개 보고서는 그대로 유지');
    await expect(page.getByLabel('국어 표준점수', { exact: true })).toHaveValue('126');
    await expect(page.getByLabel('영어 등급', { exact: true })).toHaveValue('2');
    await page.getByLabel('국어 표준점수', { exact: true }).fill('127');
    await page.locator('#consultingMaterialReason').fill('성적표를 다시 확인하여 정정합니다.');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '정정 성적 저장', exact: true }).click();
    await expect.poll(() => state.calls.filter(call => call.type === 'admin_confirm_v2_survey_revision').length).toBe(1);
    const sent = state.calls.find(call => call.type === 'admin_confirm_v2_survey_revision');
    expect(sent.data.expectedCorrectionScoreDigest).toBe('a'.repeat(64));
    expect(sent.data.verifiedInput.records.find(row => row.area === 'korean').standardScore).toBe(127);
    expect(state.calls.some(call => call.type === 'admin_verify_v2_materials')).toBe(false);
    expect(state.students[1].case.workflowState).toBe('FINAL_CALL_BOOKED');
});

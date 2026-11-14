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
        if (options.withContent) {
            const ws = window.__reportSource.ws, result = window.__reportSource.factResult;
            ws.reportContent = { canGenerate: !options.readOnly, status: 'not_generated', sourceDigest: ws.sourceDigest, factsDigest: 'sha256:' + 'b'.repeat(64), job: null, record: null };
            if (options.contentStatus) Object.assign(ws.reportContent, { status: options.contentStatus, canGenerate: ['failed', 'stale'].includes(options.contentStatus), job: { jobId: 'REPORT_CONTENT_SYNTHETIC', status: options.contentStatus, attempts: 1, lastErrorCode: options.contentStatus === 'failed' ? 'AI_PROVIDER_HTTP_401' : null } });
            if (options.contentStatus === 'completed') ws.reportContent.record = { revision: 1, model: 'gpt-5-mini', content: { numericalReady: true, warnings: [], evidence: [{ id: 'S001', kind: 'consultation', path: 'conclusion', value: '<img src=x onerror=alert(1)> 상담에서 확인한 전공 우선' }],
                pages: ['전략 요약', '점수 분석', '성적 기준 지원 범위', '플랜 A', '플랜 B', '최종 판단 기준'].map((title, i) => ({ page: i + 1, key: ['cover', 'scoreAnalysis', 'baseline', 'planA', 'planB', 'conclusion'][i], title, paragraphs: [{ text: '<b>안정 지원과 전공 조건을 확인합니다.</b>', sourceRefs: ['S001'], factRefs: [] }], candidates: [2, 3, 4].includes(i) ? result.facts : [], ...(i === 1 ? { scores: result.scoreAnalysis.records } : {}), ...(i === 5 ? { planC: { paragraphs: [], candidates: [] } } : {}) })), unresolvedItems: [], disclaimer: '실제 합격을 보장하지 않습니다.' } };
        }
        if (options.withRevisions) {
            const state = window.__reportSource, content = state.ws.reportContent;
            content.canRequestRevision = !options.readOnly; content.record.contentDigest = 'sha256:' + 'c'.repeat(64);
            content.record.content.evidence.push({ id: 'S002', kind: 'survey', path: 'strategy.priorityOrder', value: '전공과 통학을 우선합니다.' });
            state.revisions = []; state.openCount = 0;
            state.addRevision = (input, status = 'pending') => {
                const n = state.revisions.length + 1, id = 'REVISION_' + n.toString(16).padStart(40, '0');
                const row = { requestId: id, requestKey: `REPORT#REVISION#REQUEST#2026-12-08T03:00:00.000Z#${id}`, createdAt: '2026-12-08T03:00:00.000Z', status,
                    baseContentRevision: input.baseContentRevision || content.record.revision, baseContentDigest: input.baseContentDigest || content.record.contentDigest,
                    input: { target: input.target || 'planA', paragraphIndex: input.paragraphIndex ?? null, category: input.category || 'consultation_reflection', scope: input.scope || 'section', issue: input.issue || '상담 내용 반영이 부족합니다.', instruction: input.instruction || '상담 근거로 설명을 보완해주세요.', sourceRefs: input.sourceRefs || ['S001'] },
                    jobId: 'REPORT_CONTENT_' + n.toString(16).padStart(40, '0'), idempotencyKey: input.idempotencyKey, supersedes: input.supersedes || null };
                state.revisions.unshift(row); state.openCount++; return row;
            };
            if (options.revisionStatus) state.addRevision({}, options.revisionStatus);
            state.completeRevision = () => { const row = state.revisions[0]; row.status = 'review_required'; row.resultContentRevision = content.record.revision + 1; row.outcome = { response: { status: 'addressed', explanation: '통학 조건과 전공 우선을 명확하게 반영했습니다.' }, changedTargets: ['planA'] }; content.record.revision++; content.record.contentDigest = 'sha256:' + 'd'.repeat(64); content.record.content.pages[3].paragraphs[0].text = '상담에서 확인한 통학 조건과 전공 우선을 설명에 반영합니다.'; };
            if (options.revisionStatus === 'review_required') state.completeRevision();
        }
        if (options.withApprovals) {
            const state = window.__reportSource, content = state.ws.reportContent;
            content.record.contentDigest ||= 'sha256:' + 'c'.repeat(64);
            const ownRole = options.approverRole === 'none' ? null : options.approverRole || 'CEO';
            state.approvedRoles = options.approvedRoles || [];
            state.approvalView = () => ({ target: { id: state.approvalTarget || 'sha256:' + 'f'.repeat(64), contentRevision: content.record.revision, contentDigest: content.record.contentDigest },
                status: state.approvalBlocked ? 'blocked' : state.approvedRoles.length === 3 ? 'approved' : 'awaiting_approvals', count: state.approvalBlocked ? 0 : state.approvedRoles.length,
                ownRole, canApprove: !options.readOnly && Boolean(ownRole) && !state.approvalBlocked && !state.approvedRoles.includes(ownRole), canWithdraw: !options.readOnly && state.approvedRoles.includes(ownRole),
                blockers: state.approvalBlocked ? [{ code: 'REPORT_APPROVAL_OPEN_REVISIONS', message: '처리하지 않은 수정 요청이 있습니다.' }] : [],
                roles: ['CEO', 'CTO', 'CMO'].map(role => ({ role, own: role === ownRole, status: !state.approvalBlocked && state.approvedRoles.includes(role) ? 'approved' : 'pending', approvedAt: state.approvedRoles.includes(role) ? '2026-12-08T03:05:00.000Z' : null })),
                renderRequest: state.approvedRoles.length === 3 ? { requestId: 'REPORT_RENDER_SYNTHETIC', status: 'awaiting_renderer', eligible: !state.approvalBlocked } : null,
                history: state.approvalHistory || [], nextCursor: null, studentPublicationAllowed: false });
            content.approval = state.approvalView();
            state.syncApprovals = () => { content.approval = state.approvalView(); };
        }
        if (options.withPdf) {
            const state = window.__reportSource, content = state.ws.reportContent;
            const file = { artifactId: 'ARTIFACT_123e4567-e89b-12d3-a456-426614174001', requestId: 'REPORT_RENDER_' + 'a'.repeat(40), contentRevision: 1, templateVersion: 'jungsi-six-page-1.0.0', pageCount: 6, bytes: 160000, pdfSha256: 'sha256:' + 'a'.repeat(64), createdAt: '2026-12-08T03:05:00Z', current: true };
            state.pdfFile = file;
            state.pdf = { status: options.pdfStatus || 'pending', targetId: 'sha256:' + 'f'.repeat(64), canQueue: !options.readOnly && options.pdfStatus === 'awaiting_renderer', current: options.pdfStatus === 'ready' ? file : null,
                lastArtifact: options.pdfStatus === 'historical' ? { ...file, current: false } : null, history: ['ready', 'historical'].includes(options.pdfStatus) ? [{ ...file, current: options.pdfStatus === 'ready' }] : [], nextCursor: null,
                job: { status: options.pdfStatus || 'pending', lastErrorCode: options.pdfStatus === 'failed' ? 'PDF_LAYOUT_OVERFLOW' : null, errorPages: options.pdfStatus === 'failed' ? [4] : [] }, studentPublicationAllowed: false };
            if (options.pdfStatus === 'historical') state.pdf.status = 'content_approval_required';
            if (options.pdfApproval) {
                state.pdfApprovedRoles = options.pdfApprovedRoles || [];
                state.pdfOwnRole = options.pdfOwnRole === undefined ? 'CMO' : options.pdfOwnRole;
                state.pdfApprovalView = () => ({ target: { id: state.pdfApprovalTarget || 'sha256:' + '8'.repeat(64), artifactId: file.artifactId, pdfSha256: file.pdfSha256, contentRevision: 1 },
                    status: state.pdfPublished ? 'published' : state.pdfBlocked ? 'blocked' : state.pdfApprovedRoles.length === 3 ? 'approved' : 'awaiting_approvals', count: state.pdfBlocked ? 0 : state.pdfApprovedRoles.length, ownRole: state.pdfOwnRole,
                    canApprove: !options.readOnly && Boolean(state.pdfOwnRole) && !state.pdfPublished && !state.pdfBlocked && !state.pdfApprovedRoles.includes(state.pdfOwnRole),
                    canWithdraw: !options.readOnly && !state.pdfPublished && state.pdfApprovedRoles.includes(state.pdfOwnRole), canPublish: !options.readOnly && Boolean(state.pdfOwnRole) && !state.pdfPublished && !state.pdfBlocked && state.pdfApprovedRoles.length === 3,
                    roles: ['CEO', 'CTO', 'CMO'].map(role => ({ role, own: role === state.pdfOwnRole, status: !state.pdfBlocked && state.pdfApprovedRoles.includes(role) ? 'approved' : 'pending', approvedAt: state.pdfApprovedRoles.includes(role) ? '2026-12-08T03:05:00.000Z' : null })),
                    blockers: state.pdfBlocked ? [{ message: '현재 PDF를 다시 확인해주세요.' }] : [], notifications: state.pdfPublished ? ['inapp', 'kakao', 'email'].map(channel => ({ channel, status: channel === 'email' ? 'dead_letter' : 'sent', code: channel === 'email' ? 'NOTIFICATION_DELIVERY_UNCERTAIN' : null })) : [] });
                state.syncPdfApproval = () => { state.pdf.approval = state.pdfApprovalView(); };
                state.syncPdfApproval();
            }
            if (options.pdfCorrection) { state.pdf.correction = { latest: { version: 1 }, active: null, canStart: true, changes: [] }; state.pdfPublished = true; state.syncPdfApproval(); }
            content.pdf = state.pdf;
        }
        window.apiFetch = async (_url, request) => {
            const input = JSON.parse(request.body), state = window.__reportSource; state.calls.push(input);
            let data = {};
            if (input.type === 'admin_list_consulting_students') data = { items: [{ applicationId, sourceResponseId: responseId, phase: 'report', studentNameMask: '합*생', phoneMask: '010-****-0000', stateLabel: '상담 완료', nextAction: '상담 정리', updatedAt: summary.savedAt }], nextCursor: null };
            else if (input.type === 'admin_get_consulting_student') data = { application: { applicationId, applicationState: 'CLAIMED', revision: 0, expectedAmount: 300000 }, contact: { studentName: '합성 학생' },
                student: { applicationId, sourceResponseId: responseId, phase: 'report', stateLabel: '상담 완료', nextAction: '상담 정리', updatedAt: summary.savedAt }, case: { caseId, workflowState: 'WRITTEN_SESSION_COMPLETED' }, permissions: { report: true } };
            else if (input.type === 'admin_get_report_pdf_workspace') {
                if (state.deferPdf) await new Promise(resolve => { state.resolvePdf = resolve; });
                if (state.failPdf) throw new Error('PDF 상태를 조회하지 못했습니다.');
                data = { caseId, caseRevision: state.ws.caseRevision, ...structuredClone(state.pdf) };
            } else if (input.type === 'admin_queue_report_pdf') {
                state.pdf.status = 'pending'; state.pdf.canQueue = false; data = { caseId, ...structuredClone(state.pdf) };
            } else if (input.type === 'admin_preview_report_pdf') {
                data = { caseId, artifactId: input.data.artifactId, pdfSha256: state.pdfFile.pdfSha256, current: state.pdf.status === 'ready', expiresIn: 60, url: state.badPdfUrl || `https://synthetic.s3.ap-northeast-2.amazonaws.com/generated_reports/synthetic-student/DEV-${input.data.artifactId}.pdf?signed=1` };
            } else if (['admin_approve_report_pdf', 'admin_withdraw_report_pdf_approval', 'admin_publish_report_pdf'].includes(input.type)) {
                if (state.deferPdfMutation) await new Promise(resolve => { state.resolvePdfMutation = resolve; });
                if (state.failPdfMutation) throw new Error('승인 상태가 바뀌었습니다.');
                if (input.type === 'admin_approve_report_pdf') state.pdfApprovedRoles = [...new Set([...state.pdfApprovedRoles, state.pdfOwnRole])];
                if (input.type === 'admin_withdraw_report_pdf_approval') { state.pdfApprovedRoles = []; state.pdfApprovalTarget = 'sha256:' + '9'.repeat(64); }
                if (input.type === 'admin_publish_report_pdf') state.pdfPublished = true;
                state.ws.caseRevision++; state.syncPdfApproval(); data = { caseId, caseRevision: state.ws.caseRevision, approval: structuredClone(state.pdf.approval) };
            }
            else if (input.type === 'admin_start_report_pdf_correction') { if (state.failCorrectionStart) throw new Error('정정 시작 응답을 확인하지 못했습니다.'); state.pdf.correction.active = { correctionId: 'CORRECTION_' + 'c'.repeat(40), status: 'draft', baseVersion: 1, reason: input.data.reason, category: input.data.category }; state.pdf.correction.canStart = false; state.pdfPublished = false; state.pdfApprovedRoles = []; state.pdfApprovalTarget = 'sha256:' + '7'.repeat(64); state.syncPdfApproval(); state.ws.canEdit = true; state.ws.caseRevision++; data = { caseId, correction: structuredClone(state.pdf.correction.active) }; }
            else if (input.type === 'admin_get_report_source_workspace') {
                if (state.deferGet) await new Promise(resolve => { state.resolveGet = () => { state.deferGet = false; resolve(); }; });
                if (state.failGet) throw Object.assign(new Error('자료를 다시 불러오지 못했습니다.'), { status: 503 });
                data = structuredClone(state.ws);
                if (input.data.summaryRevision) { data.summary = structuredClone(state.versions.find(v => v.revision === input.data.summaryRevision)); data.canEdit = false; }
            } else if (input.type === 'admin_queue_report_content') {
                if (state.deferContent) await new Promise(resolve => { state.resolveContent = resolve; });
                state.ws.caseRevision++; Object.assign(state.ws.reportContent, { canGenerate: false, status: 'pending', job: { jobId: 'REPORT_CONTENT_SYNTHETIC', status: 'pending', attempts: 0 } });
                data = { jobId: 'REPORT_CONTENT_SYNTHETIC', status: 'pending', unchanged: false };
            } else if (input.type === 'admin_get_report_content') {
                if (state.failContentGet) throw Object.assign(new Error('생성 상태를 확인할 수 없습니다.'), { status: 503 });
                data = { ...structuredClone(state.ws.reportContent), caseId, caseRevision: state.ws.caseRevision };
            } else if (input.type === 'admin_get_report_content_approvals') {
                if (state.deferApprovalGet) await new Promise(resolve => { state.resolveApprovalGet = resolve; });
                if (state.failApprovalGet) throw Object.assign(new Error('승인 조회를 마치지 못했습니다.'), { status: 503 });
                state.syncApprovals(); data = { caseId, caseRevision: state.ws.caseRevision, ...structuredClone(state.approvalView()) };
            } else if (['admin_approve_report_content', 'admin_withdraw_report_content_approval'].includes(input.type)) {
                if (state.deferApprovalWrite) await new Promise(resolve => { state.resolveApprovalWrite = resolve; });
                if (state.failApprovalWrite) throw Object.assign(new Error('본문이 변경되었습니다.'), { status: 409 });
                if (input.type === 'admin_approve_report_content') state.approvedRoles = [...new Set([...state.approvedRoles, state.approvalView().ownRole])];
                else { state.approvedRoles = []; state.approvalTarget = 'sha256:' + '1'.repeat(64); }
                (state.approvalHistory ||= []).unshift({ event: input.type === 'admin_approve_report_content' ? 'REPORT_CONTENT_APPROVED' : 'REPORT_CONTENT_APPROVAL_WITHDRAWN', role: state.approvalView().ownRole, contentRevision: state.ws.reportContent.record.revision, createdAt: '2026-12-08T03:05:00.000Z', reason: input.data.reason || null });
                state.ws.caseRevision++; state.syncApprovals();
                if (state.loseApprovalResponse) { state.loseApprovalResponse = false; throw Object.assign(new Error('처리 결과의 응답을 받지 못했습니다.'), { status: 503 }); }
                data = { caseId, caseRevision: state.ws.caseRevision, unchanged: false, approval: structuredClone(state.approvalView()) };
            } else if (input.type === 'admin_get_report_revision_workspace') {
                if (state.deferRevisionList) await new Promise(resolve => { state.resolveRevisionList = resolve; });
                if (state.failRevisionList) throw Object.assign(new Error('수정 요청을 조회하지 못했습니다.'), { status: 503 });
                const items = input.data.cursor ? state.revisions.slice(1) : state.revisions.slice(0, 1);
                data = { caseId, caseRevision: state.ws.caseRevision, currentContentRevision: state.ws.reportContent.record.revision, openCount: state.openCount, items: structuredClone(items), nextCursor: !input.data.cursor && state.revisions.length > 1 ? state.revisions[0].requestKey : null, hasPending: items.some(r => ['pending', 'processing'].includes(r.status)) };
            } else if (input.type === 'admin_request_report_revision') {
                if (state.deferRevisionSubmit) await new Promise(resolve => { state.resolveRevisionSubmit = resolve; });
                let row = state.revisions.find(r => r.idempotencyKey === input.data.idempotencyKey), unchanged = Boolean(row);
                if (!row) { row = state.addRevision(input.data, ['score_or_cutoff', 'candidate_or_plan'].includes(input.data.category) ? 'requires_recalculation' : 'pending'); state.ws.caseRevision++; }
                if (options.withApprovals) { state.approvalBlocked = true; state.approvedRoles = []; state.approvalTarget = 'sha256:' + '2'.repeat(64); state.syncApprovals(); }
                if (state.loseRevisionResponse) { state.loseRevisionResponse = false; throw Object.assign(new Error('응답을 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.'), { status: 503 }); }
                data = { request: structuredClone(row), unchanged };
            } else if (input.type === 'admin_get_report_revision_detail') {
                const row = state.revisions.find(r => r.requestKey === input.data.requestKey);
                data = { caseId, request: structuredClone(row), currentContentRevision: state.ws.reportContent.record.revision, canEdit: !options.readOnly, requiresReapply: row.status === 'reapply_required',
                    comparison: row.outcome ? { baseContentRevision: row.baseContentRevision, resultContentRevision: row.resultContentRevision, numbersUnchanged: true, changedTargets: ['planA'], response: row.outcome.response,
                        evidence: state.ws.reportContent.record.content.evidence, diff: [{ target: 'planA', paragraphIndex: 0, before: { text: '기존 <img src=x onerror=alert(1)> 설명', sourceRefs: ['S001'] }, after: { text: '상담에서 확인한 통학 조건과 전공 우선을 설명에 반영합니다.', sourceRefs: ['S001', 'S002'] } }] } : null };
            } else if (input.type === 'admin_resolve_report_revision') {
                const row = state.revisions.find(r => r.requestKey === input.data.requestKey); row.status = input.data.action === 'withdrawn' ? 'withdrawn' : 'resolved'; row.resolution = { reason: input.data.reason }; state.openCount--; data = { request: structuredClone(row) };
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
    for (const file of ['js/admin/navigation.js', 'js/admin_ui.js', 'js/admin/consulting.js', 'js/admin/consulting-intake.js', 'js/admin/consulting-report-facts.js', 'js/admin/consulting-report-content.js', 'js/admin/consulting-report-revision.js', 'js/admin/consulting-report-approval.js', 'js/admin/consulting-report-pdf.js', 'js/admin/consulting-report-source.js', 'js/admin/consulting-workspace.js']) await page.addScriptTag({ content: await source(file) });
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

test('새 계산 기준의 확률·단계·환산 소수는 계산기와 같은 표기로 표시하고 잘못된 응답은 보류한다', async ({ page }) => {
    await prepare(page, { facts: true, withFactsResult: true });
    for (const [point, percent, qualifier, band, label, text] of [[79.999, 79, 'approximate', 'appropriate', '적정', '약 79%'], [0, 1, 'less_than', 'risky', '위험', '1% 미만'], [100, 99, 'more_than', 'stable', '안정', '99% 초과'], [80, 0, 'approximate', 'stable', '안정', '판단 보류']]) {
        await page.evaluate(({ point, percent, qualifier, band, label }) => {
            const workspace = window.__reportSource.ws.reportFacts, fact = workspace.record.result.facts[0];
            fact.convertedScore = 743.123456; fact.probability = { low: point, point, high: point }; fact.reportRisk = { band, label, wide: false };
            fact.forecast = { status: 'available', validationState: 'passed', riskBand: band, probability: { percent, qualifier } };
            renderConsultingReportFacts(workspace);
        }, { point, percent, qualifier, band, label });
        const card = page.locator('#consultingReportFactsResult .consulting-report-fact-card').first();
        await expect(card).toContainText('743.123456 / 1,000'); await expect(card.locator('.consulting-report-fact-risk')).toHaveText(label);
        await expect(card.locator('dl > div').nth(2).locator('dd')).toHaveText(text);
        await expect(card).toContainText('신뢰구간이 아닙니다.');
        for (const width of [320, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        }
    }
});

test('입결 지수는 두 기준선·5단계와 함께 표시하고 미검수·손상 수치는 숨긴다', async ({ page }) => {
    await prepare(page, { facts: true, withFactsResult: true });
    for (const [point, band, label] of [[82.7, 'stable', '안정'], [65, 'appropriate', '적정'], [45, 'neutral', '중립'], [25, 'challenge', '도전'], [1, 'risky', '위험'], [null, null, '판단 보류'], [80.5, 'invalid', '판단 보류']]) {
        await page.evaluate(({ point, band, label }) => {
            const workspace = window.__reportSource.ws.reportFacts, fact = workspace.record.result.facts[0];
            fact.possibilityPoint = point; fact.probability = null; fact.expectedCutoff = null;
            fact.reportRisk = { band, label, wide: false };
            fact.possibility = { contractVersion: 'cut-reference-public-v1', policyVersion: 'cut-reference-possibility-1.0.0', basis: 'cut_reference_heuristic',
                status: point === null ? 'unavailable' : 'available', validationState: point === null ? 'not_available' : 'passed', probability: null, empiricallyCalibrated: false,
                index: point === null ? null : { points: Math.floor(point) }, riskBand: band, reasonCodes: point === null ? ['CUT_REFERENCE_REVIEW_REQUIRED'] : [],
                admissionUnitId: fact.admissionUnitId, sourceYear: 2026, targetYear: 2027, publicationDigest: 'sha256:'+'a'.repeat(64), referenceDigest: 'sha256:'+'b'.repeat(64) };
            fact.referenceLines = point === null ? null : { passLine: 60, registered70Line: 65, sourceYear: 2026, targetYear: 2027 };
            renderConsultingReportFacts(workspace);
        }, { point, band, label });
        const card = page.locator('#consultingReportFactsResult .consulting-report-fact-card').first();
        await expect(card.locator('.consulting-report-fact-risk')).toHaveText(label);
        await expect(card.locator('dl > div').nth(3).locator('dd')).toHaveText(label === '판단 보류' ? '판단 보류' : `약 ${Math.floor(point)}점 / 100`);
        await expect(card.locator('dl > div').nth(3).locator('dd')).not.toContainText('%');
        if (label !== '판단 보류') { await expect(card).toContainText('2026학년도 입결'); await expect(card).toContainText('실제 합격률이 아닌'); }
        else for (const index of [1, 2]) await expect(card.locator('dl > div').nth(index).locator('dd')).toHaveText('판단 보류');
        for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true); }
    }
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


test('본문 생성 요청은 고정한 자료 참조만 보내며 대기 상태를 보여준다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true });
    await page.getByRole('button', { name: 'AI 보고서 본문 생성', exact: true }).click();
    await expect(page.locator('#consultingReportContentStatus')).toContainText('생성 대기 중');
    const calls = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_queue_report_content'));
    expect(calls).toHaveLength(1); expect(calls[0].data).toEqual({ caseId, expectedCaseRevision: 7, sourceDigest: 'sha256:' + 'b'.repeat(64), factsDigest: 'sha256:' + 'b'.repeat(64), retry: false });
    await expect(page.locator('#consultingReportGenerateContent')).toBeDisabled();
});
test('완성 본문은 여섯 페이지와 계산 후보·근거를 표시하고 HTML을 실행하지 않는다', async ({ page }, testInfo) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed' });
    await expect(page.locator('.consulting-report-content-page')).toHaveCount(6);
    await expect(page.locator('#consultingReportContentResult img')).toHaveCount(0);
    await page.locator('.consulting-report-content-paragraph summary').first().click();
    await expect(page.locator('.consulting-report-content-paragraph details').first()).toContainText('<img src=x');
    await expect(page.locator('#consultingReportContentResult')).toContainText('실제 합격을 보장하지 않습니다.');
    expect(await page.locator('#consultingReportContentPanel').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await page.locator('#consultingReportContentPanel').screenshot({ path: testInfo.outputPath('report-content-review.png') });
});
test('저장하지 않은 상담 변경은 새 생성을 잠그며 본문 상태 조회로 입력을 덮어쓰지 않는다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true });
    await page.getByLabel('상담 결론', { exact: true }).fill('아직 저장하지 않은 상담 결론');
    await expect(page.locator('#consultingReportGenerateContent')).toBeDisabled();
    await page.getByRole('button', { name: '생성 상태 확인', exact: true }).click();
    await expect(page.getByLabel('상담 결론', { exact: true })).toHaveValue('아직 저장하지 않은 상담 결론');
});
test('생성 대기 자동 조회는 본문 상태만 확인하며 실패 뒤 반복 요청하지 않는다', async ({ page }) => {
    await page.clock.install(); await prepare(page, { facts: true, withContent: true, contentStatus: 'pending' });
    const before = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_get_report_source_workspace').length);
    await page.clock.fastForward(11000);
    await expect.poll(() => page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_get_report_content').length)).toBe(1);
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_get_report_source_workspace').length)).toBe(before);
    await page.evaluate(() => { window.__reportSource.failContentGet = true; });
    await page.clock.fastForward(11000); await expect(page.locator('#consultingReportContentStatus')).toContainText('확인할 수 없습니다');
    const count = await page.evaluate(() => window.__reportSource.calls.length); await page.clock.fastForward(60000); expect(await page.evaluate(() => window.__reportSource.calls.length)).toBe(count);
});
test('실패 원인을 보여주고 재시도 요청을 구분한다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'failed' });
    await expect(page.locator('#consultingReportContentStatus')).toContainText('AI 인증 설정');
    await page.getByRole('button', { name: '현재 기준으로 다시 생성', exact: true }).click();
    expect(await page.evaluate(() => window.__reportSource.calls.find(c => c.type === 'admin_queue_report_content').data.retry)).toBe(true);
});
test('생성 요청 중 로그아웃하면 늦은 응답으로 본문과 개인정보가 복구되지 않는다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true });
    await page.evaluate(() => { window.__reportSource.deferContent = true; });
    await page.locator('#consultingReportGenerateContent').click();
    await expect(page.getByLabel('상담 결론', { exact: true })).toBeDisabled();
    await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__reportSource.resolveContent(); });
    await expect(page.locator('#consultingReportContentResult')).toBeEmpty();
    await expect(page.locator('#consultingReportGenerateContent')).toBeDisabled();
});


test('자연어 수정 요청은 선택한 본문·항목·근거와 설명만 전송하고 숫자를 보내지 않는다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true });
    await page.locator('#consultingReportRevisionComposer').evaluate(e => { e.open = true; });
    await page.getByLabel('발견한 문제', { exact: true }).fill('상담에서 전공 우선으로 확인했는데 설명이 부족합니다.');
    await page.getByLabel('원하는 수정 방향', { exact: true }).fill('상담 결론에 맞게 선정 이유를 보완해주세요.');
    await page.getByRole('combobox', { name: '수정할 항목', exact: true }).selectOption('planA');
    await page.getByLabel('상담 정리 · 상담 결론', { exact: true }).check();
    await page.getByRole('button', { name: '수정 요청 보내기', exact: true }).click();
    await expect(page.locator('#consultingReportRevisionStatus')).toContainText('수정 요청을 보관');
    const sent = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_request_report_revision'));
    expect(sent).toHaveLength(1); expect(sent[0].data).toMatchObject({ caseId, baseContentRevision: 1, baseContentDigest: 'sha256:' + 'c'.repeat(64), target: 'planA', category: 'consultation_reflection', sourceRefs: ['S001'], supersedes: null });
    expect(Object.keys(sent[0].data)).not.toContain('probability'); await expect(page.locator('.consulting-report-content-page')).toHaveCount(6);
});
test('응답 유실 재전송은 같은 요청 키를 유지하고 저장된 요청을 중복 생성하지 않는다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true });
    await page.locator('#consultingReportRevisionComposer').evaluate(e => { e.open = true; });
    await page.getByLabel('발견한 문제', { exact: true }).fill('조사서 내용 반영이 부족합니다.');
    await page.getByLabel('원하는 수정 방향', { exact: true }).fill('선택 기준을 명확하게 설명해주세요.');
    await page.getByLabel('상담 정리 · 상담 결론', { exact: true }).check();
    await page.evaluate(() => { window.__reportSource.loseRevisionResponse = true; });
    await page.locator('#consultingReportRevisionSubmit').click(); await expect(page.locator('#consultingReportRevisionStatus')).toContainText('응답을 확인하지 못했습니다');
    await page.locator('#consultingReportRevisionSubmit').click(); await expect(page.locator('#consultingReportRevisionStatus')).toContainText('수정 요청을 보관');
    const sent = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_request_report_revision'));
    expect(sent).toHaveLength(2); expect(sent[0].data.idempotencyKey).toBe(sent[1].data.idempotencyKey); expect(await page.evaluate(() => window.__reportSource.revisions.length)).toBe(1);
});
test('수정 전후 문단·근거와 수치 유지 표시를 확인하고 처리 사유를 남긴다', async ({ page }, testInfo) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true, revisionStatus: 'review_required' });
    await page.getByRole('button', { name: '요청·변경 내용 보기', exact: true }).click();
    await expect(page.locator('#consultingReportRevisionDetail')).toContainText('수정 전'); await expect(page.locator('#consultingReportRevisionDetail')).toContainText('수정 후');
    await expect(page.locator('#consultingReportRevisionDetail')).toContainText('환산점수·예상컷·확률을 유지'); await expect(page.locator('#consultingReportRevisionDetail img')).toHaveCount(0);
    await expect(page.locator('[data-side="before"]')).toContainText('<img src=x');
    for (const width of [320, 1280]) { await page.setViewportSize({ width, height: 900 }); expect(await page.locator('#consultingReportRevisionDetail').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true); await page.locator('#consultingReportRevisionDetail').screenshot({ path: testInfo.outputPath(`report-revision-comparison-${width}.png`) }); }
    await page.getByRole('button', { name: '수정 결과 확인 완료', exact: true }).click(); await expect(page.locator('#consultingReportRevisionStatus')).toContainText('처리 사유를 작성');
    await page.getByLabel('수정 요청 처리 사유', { exact: true }).fill('현재 본문과 상담 근거를 직접 검토했습니다.'); page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: '수정 결과 확인 완료', exact: true }).click(); await expect(page.locator('#consultingReportRevisionDetail')).toContainText('확인 완료');
});
test('본문이 바뀌면 입력을 보존하고 명시적으로 최신 기준을 선택하기 전에는 전송을 막는다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true });
    await page.locator('#consultingReportRevisionComposer').evaluate(e => { e.open = true; });
    await page.getByLabel('발견한 문제', { exact: true }).fill('아직 보내지 않은 수정 요청입니다.');
    await page.evaluate(() => { const c = window.__reportSource.ws.reportContent; c.record.revision = 2; c.record.contentDigest = 'sha256:' + 'e'.repeat(64); });
    await page.getByRole('button', { name: '생성 상태 확인', exact: true }).click();
    await expect(page.getByLabel('발견한 문제', { exact: true })).toHaveValue('아직 보내지 않은 수정 요청입니다.'); await expect(page.locator('#consultingReportRevisionSubmit')).toBeDisabled();
    await page.getByRole('button', { name: '최신 본문을 기준으로 다시 작성', exact: true }).click(); await expect(page.locator('#consultingReportRevisionBase')).toContainText('본문 2'); await expect(page.locator('#consultingReportRevisionSubmit')).toBeEnabled();
});
test('수정 요청 자동 조회는 입력을 덮어쓰지 않고 조회 실패 뒤 연속 오류를 멈춘다', async ({ page }) => {
    await page.clock.install(); await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true, revisionStatus: 'pending' });
    await expect.poll(() => page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_get_report_revision_workspace').length)).toBe(1);
    await page.clock.fastForward(11000); await expect.poll(() => page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_get_report_revision_workspace').length)).toBe(2);
    await page.evaluate(() => { window.__reportSource.failRevisionList = true; }); await page.clock.fastForward(11000); await expect(page.locator('#consultingReportRevisionStatus')).toContainText('조회하지 못했습니다');
    const count = await page.evaluate(() => window.__reportSource.calls.length); await page.clock.fastForward(60000); expect(await page.evaluate(() => window.__reportSource.calls.length)).toBe(count);
});
test('이전 요청을 현재 본문으로 재적용할 때 설명과 연결 대상을 유지한다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true, revisionStatus: 'reapply_required' });
    await page.getByRole('button', { name: '요청·변경 내용 보기', exact: true }).click(); await page.getByRole('button', { name: '현재 본문으로 다시 요청', exact: true }).click();
    await expect(page.getByLabel('발견한 문제', { exact: true })).toHaveValue('상담 내용 반영이 부족합니다.');
    await page.getByRole('button', { name: '수정 요청 보내기', exact: true }).click();
    expect(await page.evaluate(() => window.__reportSource.calls.find(c => c.type === 'admin_request_report_revision').data.supersedes)).toContain('REPORT#REVISION#REQUEST#');
});
test('수정 요청 중 로그아웃은 입력·상세를 지우고 늦은 응답이 복구하지 못한다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true });
    await page.locator('#consultingReportRevisionComposer').evaluate(e => { e.open = true; }); await page.getByLabel('발견한 문제', { exact: true }).fill('상담 내용 확인'); await page.getByLabel('원하는 수정 방향', { exact: true }).fill('설명을 명확히 해주세요.'); await page.getByLabel('상담 정리 · 상담 결론', { exact: true }).check();
    await page.evaluate(() => { window.__reportSource.deferRevisionSubmit = true; }); await page.locator('#consultingReportRevisionSubmit').click(); await expect(page.getByLabel('발견한 문제', { exact: true })).toBeDisabled();
    await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__reportSource.resolveRevisionSubmit(); });
    await expect(page.locator('#consultingReportRevisionPanel')).toBeHidden(); await expect(page.locator('#consultingReportRevisionDetail')).toBeEmpty(); await expect(page.getByLabel('발견한 문제', { exact: true })).toHaveValue('');
});
test('읽기 전용 관리자는 비교를 볼 수 있고 수정·완료 처리는 실행할 수 없다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true, revisionStatus: 'review_required', readOnly: true });
    await page.getByRole('button', { name: '요청·변경 내용 보기', exact: true }).click(); await expect(page.locator('#consultingReportRevisionDetail')).toContainText('수정 후'); await expect(page.getByRole('button', { name: '수정 결과 확인 완료', exact: true })).toHaveCount(0); await expect(page.locator('#consultingReportRevisionSubmit')).toBeDisabled();
});


test('같은 본문의 본인 역할만 승인하고 세 번째 승인 뒤 제작 대기를 표시한다', async ({ page }, testInfo) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withApprovals: true, approvedRoles: ['CTO', 'CMO'] });
    await expect(page.locator('#consultingReportApprovalMeta')).toContainText('본문 1 · 2/3 승인 · 내 역할 CEO');
    await expect(page.locator('#consultingReportApproveContent')).toBeDisabled();
    await page.locator('#consultingReportApprovalConfirmed').check(); await page.locator('#consultingReportApproveContent').click();
    await expect(page.locator('#consultingReportApprovalMeta')).toContainText('3/3 승인'); await expect(page.locator('#consultingReportApprovalNext')).toContainText('PDF 제작 요청을 기록');
    const calls = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_approve_report_content'));
    expect(calls).toHaveLength(1); expect(calls[0].data).toEqual({ caseId, targetId: 'sha256:' + 'f'.repeat(64), confirmed: true });
    expect(calls[0].data.role).toBeUndefined(); await expect(page.locator('#consultingReportApproveContent')).toBeHidden();
    for (const width of [320, 1280]) { await page.setViewportSize({ width, height: 900 }); expect(await page.locator('#consultingReportApprovalPanel').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true); await page.locator('#consultingReportApprovalPanel').screenshot({ path: testInfo.outputPath(`report-approval-${width}.png`) }); }
});
test('승인 철회는 사유와 최종 확인을 요구하고 모든 역할의 새 승인을 기다린다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withApprovals: true, approvedRoles: ['CEO', 'CTO', 'CMO'] });
    await expect(page.locator('#consultingReportWithdrawApproval')).toBeDisabled();
    await page.getByLabel('승인 철회 사유', { exact: true }).fill('<img src=x onerror=alert(1)> 상담 근거 재검토');
    page.once('dialog', d => d.dismiss()); await page.locator('#consultingReportWithdrawApproval').click();
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_withdraw_report_content_approval'))).toHaveLength(0);
    page.once('dialog', d => d.accept()); await page.locator('#consultingReportWithdrawApproval').click();
    await expect(page.locator('#consultingReportApprovalMeta')).toContainText('0/3 승인'); await expect(page.locator('#consultingReportApprovalStatus')).toContainText('세 명 모두 다시 확인');
    await page.locator('.consulting-report-approval-ledger summary').click(); await expect(page.locator('#consultingReportApprovalHistory')).toContainText('<img src=x'); await expect(page.locator('#consultingReportApprovalHistory img')).toHaveCount(0);
});
test('원자료나 미전송 수정 요청을 편집하는 동안 승인할 수 없고 미해결 요청도 표시한다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true });
    await page.locator('#consultingReportApprovalConfirmed').check(); await page.getByLabel('상담 결론', { exact: true }).fill('아직 저장하지 않은 내용'); await expect(page.locator('#consultingReportApproveContent')).toBeDisabled();
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true, approvedRoles: ['CTO'] });
    await page.locator('#consultingReportRevisionComposer').evaluate(e => { e.open = true; }); await page.getByLabel('발견한 문제', { exact: true }).fill('상담 내용 반영 오류'); await expect(page.locator('#consultingReportApproveContent')).toBeDisabled();
    await page.getByLabel('원하는 수정 방향', { exact: true }).fill('조사서와 상담 결론에 맞춰 설명해주세요.'); await page.getByLabel('상담 정리 · 상담 결론', { exact: true }).check(); await page.locator('#consultingReportRevisionSubmit').click();
    await expect(page.locator('#consultingReportApprovalBlockers')).toContainText('처리하지 않은 수정 요청'); await expect(page.locator('#consultingReportApprovalMeta')).toContainText('0/3 승인');
});
test('승인 상태 조회만으로 표시된 본문을 바꾸거나 읽지 않은 새 본문을 승인하지 않는다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withApprovals: true });
    await page.locator('#consultingReportApprovalConfirmed').check();
    await page.evaluate(() => { const c = window.__reportSource.ws.reportContent; c.record.revision = 2; c.record.contentDigest = 'sha256:' + '9'.repeat(64); window.__reportSource.approvalTarget = 'sha256:' + '8'.repeat(64); });
    await page.locator('#consultingReportApprovalRefresh').click(); await expect(page.locator('#consultingReportApprovalBlockers')).toContainText('표시된 본문과 현재 승인 대상이 다릅니다'); await expect(page.locator('#consultingReportApproveContent')).toBeDisabled();
    await page.locator('#consultingReportRefreshContent').click(); await expect(page.locator('#consultingReportContentStatus')).toContainText('본문 2'); await expect(page.locator('#consultingReportApprovalConfirmed')).not.toBeChecked();
    await page.locator('#consultingReportApprovalConfirmed').check(); await expect(page.locator('#consultingReportApproveContent')).toBeEnabled();
});
test('응답이 유실되면 자동 재승인하지 않고 상태 조회로 성공 여부를 확인한다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withApprovals: true });
    await page.evaluate(() => { window.__reportSource.loseApprovalResponse = true; }); await page.locator('#consultingReportApprovalConfirmed').check(); await page.locator('#consultingReportApproveContent').click();
    await expect(page.locator('#consultingReportApprovalStatus')).toContainText('승인 상태를 새로고침'); await expect(page.locator('#consultingReportApproveContent')).toBeDisabled();
    await page.locator('#consultingReportApprovalRefresh').click(); await expect(page.locator('#consultingReportApprovalMeta')).toContainText('1/3 승인');
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_approve_report_content'))).toHaveLength(1);
});
test('승인 처리 중 중복 클릭과 자료 편집을 막고 로그아웃 뒤 늦은 응답을 버린다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withApprovals: true });
    await page.evaluate(() => { window.__reportSource.deferApprovalWrite = true; }); await page.locator('#consultingReportApprovalConfirmed').check(); await page.locator('#consultingReportApproveContent').click();
    await expect(page.locator('#consultingReportSummaryFields')).toHaveAttribute('disabled', ''); await expect(page.getByLabel('상담 결론', { exact: true })).toBeDisabled(); await expect(page.locator('#consultingReportApproveContent')).toBeDisabled(); await expect(page.locator('#consultingReportCalculateFacts')).toBeDisabled(); await expect(page.locator('#consultingReportRefreshContent')).toBeDisabled();
    await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__reportSource.resolveApprovalWrite(); });
    await expect(page.locator('#consultingReportApprovalPanel')).toBeHidden(); await expect(page.locator('#consultingReportApprovalRoles')).toBeEmpty(); await expect(page.locator('#consultingReportApprovalConfirmed')).not.toBeChecked();
});
test('승인자 이외의 계정은 세 명의 상태를 조회하며 승인·철회 동작을 실행하지 않는다', async ({ page }) => {
    await prepare(page, { facts: true, withContent: true, contentStatus: 'completed', withApprovals: true, approverRole: 'none', readOnly: true, approvedRoles: ['CEO'] });
    await expect(page.locator('#consultingReportApprovalMeta')).toContainText('조회 전용'); await expect(page.locator('#consultingReportApprovalOwnActions')).toBeHidden();
    await expect(page.locator('#consultingReportApprovalRoles article')).toHaveCount(3);
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_approve_report_content'))).toHaveLength(0);
});

const pdfOptions = { facts: true, withFactsResult: true, withContent: true, contentStatus: 'completed', withApprovals: true, approvedRoles: ['CEO', 'CTO', 'CMO'], withPdf: true };
test('승인 PDF의 대기부터 완료까지 조회하며 추가 제작이나 학생 발송을 하지 않는다', async ({ page }) => {
    await page.clock.install(); await prepare(page, pdfOptions);
    await expect(page.locator('#consultingReportPdfStatus')).toContainText('대기 중');
    await page.evaluate(() => { const s = window.__reportSource; s.pdf.status = 'ready'; s.pdf.current = s.pdfFile; s.pdf.history = [s.pdfFile]; });
    await page.clock.fastForward(11000);
    await expect(page.locator('#consultingReportPdfCurrent')).toContainText('6페이지');
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_queue_report_pdf' || /publish|notification/.test(c.type)))).toHaveLength(0);
});
test('구형 승인 건의 제작 요청은 한 번만 제출하고 대기 상태로 전환한다', async ({ page }) => {
    await prepare(page, { ...pdfOptions, pdfStatus: 'awaiting_renderer' });
    await page.locator('#consultingReportPdfQueue').click(); await expect(page.locator('#consultingReportPdfStatus')).toContainText('대기 중');
    await expect(page.locator('#consultingReportPdfQueue')).toBeHidden();
    const calls = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_queue_report_pdf'));
    expect(calls).toHaveLength(1); expect(calls[0].data.confirmed).toBe(true);
});
test('저장된 현재 PDF는 선택한 파일만 새 창으로 열고 다운로드도 같은 식별자를 사용한다', async ({ page }) => {
    await prepare(page, { ...pdfOptions, pdfStatus: 'ready' });
    await page.evaluate(() => { window.__pdfOpened = []; window.open = () => ({ opener: window, location: { replace: url => window.__pdfOpened.push(url) }, close: () => {} }); });
    await page.locator('#consultingReportPdfCurrent').getByRole('button', { name: 'PDF 미리보기', exact: true }).click();
    await expect(page.locator('#consultingReportPdfStatus')).toContainText('아직 학생에게 전송되지 않았습니다');
    await page.locator('#consultingReportPdfCurrent').getByRole('button', { name: 'PDF 다운로드', exact: true }).click();
    const calls = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_preview_report_pdf'));
    expect(calls.map(c => c.data.inline)).toEqual([true, false]); expect(calls[0].data.artifactId).toBe(calls[1].data.artifactId);
    expect(await page.evaluate(() => window.__pdfOpened.length)).toBe(2);
});
test('페이지 넘침은 해당 페이지와 수정 방향을 안내하고 무한 제작을 막는다', async ({ page }) => {
    await prepare(page, { ...pdfOptions, pdfStatus: 'failed' });
    await expect(page.locator('#consultingReportPdfStatus')).toContainText('4페이지'); await expect(page.locator('#consultingReportPdfStatus')).toContainText('승인을 다시');
    await expect(page.locator('#consultingReportPdfQueue')).toBeHidden();
});
test('이전 생성본은 최신 승인본으로 표시하지 않고 읽기 전용 관리자는 제작할 수 없다', async ({ page }) => {
    await prepare(page, { ...pdfOptions, pdfStatus: 'historical', readOnly: true });
    await expect(page.locator('#consultingReportPdfCurrent')).toContainText('이전 생성본'); await expect(page.locator('#consultingReportPdfCurrent')).not.toContainText('현재 승인본');
    await expect(page.locator('#consultingReportPdfQueue')).toBeHidden();
});
test('조회 실패나 학생 전환 이후의 늦은 응답으로 파일 열기가 다시 활성화되지 않는다', async ({ page }) => {
    await prepare(page, { ...pdfOptions, pdfStatus: 'ready' });
    await page.evaluate(() => { window.__reportSource.failPdf = true; }); await page.locator('#consultingReportPdfRefresh').click();
    await expect(page.locator('#consultingReportPdfCurrent').getByRole('button', { name: 'PDF 미리보기' })).toBeDisabled();
    await page.evaluate(() => { window.__reportSource.failPdf = false; window.__reportSource.deferPdf = true; window.refreshConsultingReportPdf(); });
    await page.evaluate(() => { window.resetConsultingReportSource(); window.__reportSource.resolvePdf(); });
    await expect(page.locator('#consultingReportPdfPanel')).toBeHidden();
});
test('PDF 파일 확인은 작은 화면에서도 넘치지 않고 외부 파일 주소는 거절한다', async ({ page }, testInfo) => {
    await prepare(page, { ...pdfOptions, pdfStatus: 'ready' });
    for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.locator('#consultingReportPdfPanel').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.locator('#consultingReportPdfPanel').screenshot({ path: testInfo.outputPath(`pdf-${width}.png`) });
    }
    await page.evaluate(() => { window.__reportSource.badPdfUrl = 'https://example.invalid/stolen.pdf'; window.open = () => ({ opener: null, close() {}, location: { replace() { throw new Error('Unsafe navigation'); } } }); });
    await page.locator('#consultingReportPdfCurrent').getByRole('button', { name: 'PDF 미리보기' }).click();
    await expect(page.locator('#consultingReportPdfStatus')).toContainText('주소를 확인하지 못했습니다');
});

test('PDF를 직접 확인한 본인만 승인하고 같은 파일의 세 번째 승인 후 명시적으로 학생 전송한다', async ({ page }, testInfo) => {
    await page.addInitScript(() => { window.open = () => ({ opener: null, location: { replace() {} }, close() {} }); });
    await prepare(page, { facts: true, withFactsResult: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true, withPdf: true, pdfStatus: 'ready', pdfApproval: true, pdfApprovedRoles: ['CEO', 'CTO'] });
    const approve = page.locator('#consultingReportPdfApprove'), publish = page.locator('#consultingReportPdfPublish'), confirmed = page.locator('#consultingReportPdfConfirmed');
    await expect(approve).toBeDisabled(); await expect(publish).toBeDisabled(); await expect(confirmed).toBeDisabled();
    await page.locator('#consultingReportPdfCurrent').getByRole('button', { name: 'PDF 미리보기', exact: true }).click(); await confirmed.check(); await approve.click();
    await expect(page.locator('#consultingReportPdfApprovalMeta')).toContainText('3/3 승인'); await expect(publish).toBeEnabled();
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_publish_report_pdf'))).toHaveLength(0);
    const vote = await page.evaluate(() => window.__reportSource.calls.find(c => c.type === 'admin_approve_report_pdf'));
    expect(Object.keys(vote.data).sort()).toEqual(['caseId', 'confirmed', 'targetId']);
    page.once('dialog', dialog => dialog.accept()); await publish.click(); await expect(publish).toBeDisabled();
    await expect(page.locator('#consultingReportPdfApprovalStatus')).toContainText('학생 페이지에 공개');
    await expect(page.locator('#consultingReportPdfDelivery')).toContainText('카카오톡'); await expect(page.locator('#consultingReportPdfDelivery')).toContainText('중복 방지를 위해 자동 재발송 중지');
    for (const width of [320, 1280]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.locator('#consultingReportPdfApproval').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true); await page.locator('#consultingReportPdfApproval').screenshot({ path: testInfo.outputPath(`pdf-final-approval-${width}.png`) }); }
});
test('PDF 승인 철회는 새 승인 세대를 만들며 파일 교체·저장 전 수정·읽기 전용은 전송을 잠근다', async ({ page }) => {
    await prepare(page, { facts: true, withFactsResult: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true, withPdf: true, pdfStatus: 'ready', pdfApproval: true, pdfApprovedRoles: ['CEO', 'CTO', 'CMO'] });
    await expect(page.locator('#consultingReportPdfPublish')).toBeEnabled();
    await page.locator('#consultingReportPdfWithdrawReason').fill('최종 PDF의 주의 문구를 다시 확인합니다.'); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingReportPdfWithdraw').click();
    await expect(page.locator('#consultingReportPdfApprovalMeta')).toContainText('0/3 승인'); await expect(page.locator('#consultingReportPdfPublish')).toBeDisabled(); await expect(page.locator('#consultingReportPdfConfirmed')).toBeDisabled();
    await page.evaluate(() => { const s = window.__reportSource; s.pdfApprovedRoles = ['CEO', 'CTO', 'CMO']; s.syncPdfApproval(); }); await page.locator('#consultingReportPdfRefresh').click();
    await page.locator('#consultingReportSummaryForm [name="conclusion"]').fill('새 상담 내용은 저장한 뒤 재검수합니다.'); await expect(page.locator('#consultingReportPdfPublish')).toBeDisabled();
});
test('PDF 전송 실패와 로그아웃 뒤 늦은 응답은 자동 재전송이나 학생 상세 복원으로 이어지지 않는다', async ({ page }) => {
    await page.clock.install();
    await prepare(page, { facts: true, withFactsResult: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true, withPdf: true, pdfStatus: 'ready', pdfApproval: true, pdfApprovedRoles: ['CEO', 'CTO', 'CMO'] });
    await page.evaluate(() => { window.__reportSource.failPdfMutation = true; }); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingReportPdfPublish').click();
    await expect(page.locator('#consultingReportPdfApprovalStatus')).toContainText('PDF 상태 확인'); await page.clock.fastForward('00:01:00');
    expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_publish_report_pdf'))).toHaveLength(1);
    await page.evaluate(() => { window.__reportSource.failPdfMutation = false; window.__reportSource.deferPdfMutation = true; }); await page.locator('#consultingReportPdfRefresh').click();
    page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingReportPdfPublish').click(); await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__reportSource.resolvePdfMutation(); });
    await expect(page.locator('#consultingReportPdfPanel')).toBeHidden();
});
test('읽기 전용 계정은 PDF와 세 역할 승인 상태만 조회하며 전송하지 못한다', async ({ page }) => {
    await prepare(page, { readOnly: true, facts: true, withFactsResult: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true, withPdf: true, pdfStatus: 'ready', pdfApproval: true, pdfApprovedRoles: ['CEO', 'CTO', 'CMO'], pdfOwnRole: null });
    await expect(page.locator('#consultingReportPdfApprovalMeta')).toContainText('조회 전용'); await expect(page.locator('#consultingReportPdfPublish')).toBeDisabled(); await expect(page.locator('#consultingReportPdfApprove')).toBeHidden();
});

test('공개 후 정정은 사유·기준 버전만 보내고 원본 보존과 새 승인 순서를 안내한다', async ({ page }, testInfo) => {
    await prepare(page, { facts: true, withFactsResult: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true, withPdf: true, pdfStatus: 'ready', pdfApproval: true, pdfApprovedRoles: ['CEO', 'CTO', 'CMO'], pdfCorrection: true });
    const start = page.locator('#consultingReportCorrectionStart'); await expect(start).toBeDisabled();
    await page.locator('#consultingReportCorrectionInput').fill('상담에서 확인한 전공 우선순위의 설명을 바로잡습니다.'); await expect(start).toBeEnabled(); page.once('dialog', dialog => dialog.accept()); await start.click();
    await expect(page.locator('#consultingReportCorrectionMeta')).toContainText('정정 작업 중'); await expect(page.locator('#consultingReportCorrectionReason')).toContainText('전공 우선순위'); await expect(page.locator('#consultingReportCorrectionGuide')).toContainText('본문 3인 승인'); await expect(page.locator('#consultingReportPdfPublish')).toBeDisabled();
    const calls = await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_start_report_pdf_correction')); expect(calls).toHaveLength(1); expect(calls[0].data.baseReportVersion).toBe(1); expect(calls[0].data.reason).toContain('설명을 바로잡습니다'); expect(Object.keys(calls[0].data).sort()).toEqual(['baseReportVersion','caseId','category','confirmed','expectedCaseRevision','idempotencyKey','reason']);
    for (const width of [320,1280]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.locator('#consultingReportCorrectionPanel').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true); await page.locator('#consultingReportCorrectionPanel').screenshot({ path: testInfo.outputPath(`report-correction-admin-${width}.png`) }); }
});
test('정정 시작 응답 유실은 입력과 요청 키를 유지하고 자동으로 다시 전송하지 않는다', async ({ page }) => {
    await page.clock.install(); await prepare(page, { facts: true, withFactsResult: true, withContent: true, contentStatus: 'completed', withRevisions: true, withApprovals: true, withPdf: true, pdfStatus: 'ready', pdfApproval: true, pdfApprovedRoles: ['CEO','CTO','CMO'], pdfCorrection: true });
    await page.locator('#consultingReportCorrectionInput').fill('오류가 확인된 지원 우선순위의 설명을 바로잡습니다.'); await page.evaluate(() => { window.__reportSource.failCorrectionStart = true; }); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingReportCorrectionStart').click(); await expect(page.locator('#consultingReportCorrectionStatus')).toContainText('정정 시작 응답'); await page.clock.fastForward('00:01:00'); expect(await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_start_report_pdf_correction').length)).toBe(1);
    await page.evaluate(() => { window.__reportSource.failCorrectionStart = false; }); page.once('dialog', dialog => dialog.accept()); await page.locator('#consultingReportCorrectionStart').click(); const calls=await page.evaluate(() => window.__reportSource.calls.filter(c => c.type === 'admin_start_report_pdf_correction')); expect(calls).toHaveLength(2); expect(calls[1].data).toEqual(calls[0].data);
});

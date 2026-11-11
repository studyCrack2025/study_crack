let consultingReportContent = null;
let consultingReportContentBusy = false;
let consultingReportContentGeneration = 0;
let consultingReportContentPoll = null;
let consultingReportContentPolls = 0;
const reportContentNode = id => document.getElementById(id);
const reportContentMessage = (text, state = '') => consultingWorkspaceStatus('consultingReportContentStatus', text, state);
const reportContentErrors = { AI_DISABLED: 'AI 생성이 중지돼 있습니다. 운영 설정을 확인해주세요.', AI_SECRET_UNAVAILABLE: 'AI 연결 설정을 확인하지 못했습니다.', AI_SECRET_INVALID: 'AI 연결 설정을 확인해주세요.', AI_PROVIDER_HTTP_401: 'AI 인증 설정을 확인해주세요.', AI_PROVIDER_HTTP_429: 'AI 사용 한도 또는 요청량을 확인해주세요.', AI_PROVIDER_TIMEOUT: 'AI 응답 시간이 초과됐습니다.', AI_PROVIDER_INCOMPLETE: '본문 생성을 마치지 못했습니다.', AI_PROVIDER_REFUSAL: '제공된 자료로 본문을 생성하지 못했습니다.', AI_CONTENT_SOURCE_CHANGED: '작성 기준이나 담당 권한이 변경되었습니다.', AI_CONTENT_UNSUPPORTED_CLAIM: '수치·표현 검사를 통과하지 못했습니다.', AI_CONTENT_REFERENCE_INVALID: '본문 근거 연결을 확인해야 합니다.', AI_CONTENT_SOURCE_NOT_REFLECTED: '조사서·상담 반영 검사를 통과하지 못했습니다.', AI_CONTENT_PII_DETECTED: '상담 정리에 포함된 개인정보를 확인해주세요.' };
function resetConsultingReportContent(preserveRevisions = false) {
    consultingReportContentGeneration++; clearTimeout(consultingReportContentPoll); consultingReportContentPoll = null; consultingReportContentPolls = 0;
    consultingReportContent = null; consultingReportContentBusy = false;
    reportContentNode('consultingReportContentResult')?.replaceChildren(); reportContentNode('consultingReportContentPanel')?.setAttribute('aria-busy', 'false');
    if (typeof resetConsultingReportApprovals === 'function') resetConsultingReportApprovals();
    if (!preserveRevisions && typeof resetConsultingReportRevisions === 'function') resetConsultingReportRevisions();
    reportContentMessage(''); updateConsultingReportContentButtons();
}
function updateConsultingReportContentButtons() {
    if (!reportContentNode('consultingReportGenerateContent')) return;
    const blocked = (typeof consultingReportApprovalBusy !== 'undefined' && consultingReportApprovalBusy) || (typeof consultingReportRevisionBusy !== 'undefined' && consultingReportRevisionBusy) || consultingReportContentBusy || consultingReportSourceBusy || consultingReportSourceDirty || consultingReportFactsBusy;
    reportContentNode('consultingReportGenerateContent').disabled = blocked || consultingReportContent?.canGenerate !== true;
    reportContentNode('consultingReportRefreshContent').disabled = (typeof consultingReportApprovalBusy !== 'undefined' && consultingReportApprovalBusy) || consultingReportContentBusy || (typeof consultingReportRevisionBusy !== 'undefined' && consultingReportRevisionBusy) || !consultingReportSource?.caseId;
    reportContentNode('consultingReportGenerateContent').textContent = ['failed', 'stale'].includes(consultingReportContent?.status) ? '현재 기준으로 다시 생성' : 'AI 보고서 본문 생성';
}
function reportContentParagraph(parent, paragraph, evidence) {
    const block = reportFactElement('div', undefined, 'consulting-report-content-paragraph'); block.append(reportFactElement('p', paragraph.text));
    const detail = reportFactElement('details'), summary = reportFactElement('summary', '작성 근거 확인'); detail.append(summary);
    for (const id of paragraph.sourceRefs || []) { const source = evidence.find(s => s.id === id); if (source) detail.append(reportFactElement('p', `${source.kind === 'survey' ? '기초조사서' : '상담 정리'} · ${({conclusion:'상담 결론',requiredConditions:'필수 조건',flexibleConditions:'조정 가능한 조건',riskTolerance:'지원 성향',riskReason:'지원 성향의 근거',questions:'질문별 답변',clarifications:'상담에서 확인한 변경',comparisons:'비교 의견',planC:'추가 경로 검토 의향',rationale:'판단 근거',furtherChecks:'추가 확인',unresolved:'미해결 사항','strategy.priorityOrder':'선택 기준 우선순위','strategy.riskTolerance':'지원 성향','conditions.repeatStudyAllowed':'재수 가능성','conditions.dormitoryAllowed':'기숙사 이용','conditions.commuteLimit':'통학 범위','preferences.rankedChoices':'희망 지원','preferences.additionalPreference':'추가 희망 사항','studentStatus.residenceRegion':'거주 지역','studentStatus.applicantType':'지원자 구분'})[source.path] || '학생이 작성한 지원 정보'}\n${source.value}`)); }
    if (paragraph.factRefs?.length) detail.append(reportFactElement('p', '계산 자료 참조 · ' + paragraph.factRefs.join(', ')));
    block.append(detail); parent.append(block);
}
function renderConsultingReportContent(workspace) {
    consultingReportContent = workspace || null; clearTimeout(consultingReportContentPoll); consultingReportContentPoll = null;
    const root = reportContentNode('consultingReportContentResult'); if (!root) return; root.replaceChildren();
    if (!workspace) { reportContentMessage('최신 본문 생성 기능이 적용됐는지 확인해주세요.'); updateConsultingReportContentButtons(); return; }
    const failure = reportContentErrors[workspace.job?.lastErrorCode] || '생성을 완료하지 못했습니다. 작성 자료와 AI 연결을 확인해주세요.';
    const labels = { not_generated: workspace.canGenerate ? '준비된 자료로 본문을 생성할 수 있습니다.' : '작성 기준 고정과 점수·지원 플랜 계산을 먼저 마쳐주세요.', pending: workspace.job?.lastErrorCode ? failure + ' 잠시 후 다시 확인합니다.' : '생성 대기 중입니다. 잠시 후 자동으로 상태를 확인합니다.', processing: '조사서·상담 내용과 플랜을 반영해 본문을 작성하고 있습니다.', failed: failure, stale: '현재 자료와 다른 기준의 작업입니다. 최신 작성 기준과 계산 결과를 확인해주세요.', completed: `본문 ${workspace.record?.revision || ''} · 내부 검수 필요` };
    reportContentMessage(labels[workspace.status] || '본문 상태를 확인해주세요.', ['failed', 'stale'].includes(workspace.status) ? 'error' : workspace.status === 'completed' ? 'success' : '');
    if (typeof bindConsultingReportRevisions === 'function') bindConsultingReportRevisions(workspace);
    if (typeof bindConsultingReportApprovals === 'function') bindConsultingReportApprovals(workspace);
    const content = workspace.record?.content;
    if (content) {
        if (!content.numericalReady) root.append(reportFactElement('p', '일부 수치·플랜 검수가 남아 있습니다. 이 초안은 승인할 수 없습니다.', 'consulting-report-source-notice'));
        reportFactsWarnings(root, content.warnings);
        for (const page of content.pages) {
            const card = reportFactElement('article', undefined, 'consulting-report-content-page'); card.append(reportFactElement('p', `${String(page.page).padStart(2, '0')} / 06 · 검수용 초안`, 'consulting-eyebrow'), reportFactElement('h3', page.title));
            for (const p of page.paragraphs) reportContentParagraph(card, p, content.evidence);
            if (page.scores) { const list = reportFactElement('dl', undefined, 'consulting-report-fact-metrics'); for (const score of page.scores) { const row = document.createElement('div'); row.append(reportFactElement('dt', score.subject + (score.selection ? ' · ' + score.selection : '')), reportFactElement('dd', ['english', 'korean_history', 'second_foreign'].includes(score.area) ? `등급 ${reportFactNumber(score.grade)}` : `표점 ${reportFactNumber(score.standardScore)} · 백분위 ${reportFactNumber(score.percentile)} · 등급 ${reportFactNumber(score.grade)}`)); list.append(row); } card.append(list); }
            if (page.candidates?.length) { const grid = reportFactElement('div', undefined, 'consulting-report-facts-grid'); for (const f of page.candidates) grid.append(reportFactCard(f)); card.append(grid); }
            if (page.planC) { card.append(reportFactElement('h4', '플랜 C · 추가 논의할 다른 경로')); if (!page.planC.candidates.length) card.append(reportFactElement('p', '현재 기준에서 제안할 검수된 대안이 없습니다.')); for (const p of page.planC.paragraphs) reportContentParagraph(card, p, content.evidence); for (const f of page.planC.candidates) card.append(reportFactCard(f, '학생 의향·지원 제도 확인 후 검토')); }
            if (typeof beginConsultingReportRevision === 'function' && page.key) { const edit = reportFactElement('button', '이 항목 수정 요청', 'consulting-btn consulting-btn-secondary'); edit.type = 'button'; edit.disabled = workspace.canRequestRevision !== true; edit.addEventListener('click', () => beginConsultingReportRevision(page.key)); card.append(edit); }
            root.append(card);
        }
        if (content.unresolvedItems.length) { const section = reportFactElement('section'); section.append(reportFactElement('h4', '추가 확인이 필요한 내용')); for (const p of content.unresolvedItems) reportContentParagraph(section, p, content.evidence); root.append(section); }
        root.append(reportFactElement('p', content.disclaimer, 'consulting-caption'));
    }
    updateConsultingReportContentButtons();
    if (['pending', 'processing'].includes(workspace.status) && consultingReportContentPolls < 30) {
        const generation = consultingReportContentGeneration;
        consultingReportContentPoll = setTimeout(() => { if (generation === consultingReportContentGeneration && !document.hidden && !reportContentNode('consultingWorkspaceReport')?.hidden) { consultingReportContentPolls++; refreshConsultingReportContent(true); } }, 10000);
    } else if (['pending', 'processing'].includes(workspace.status)) reportContentMessage('아직 처리 중입니다. 잠시 후 생성 상태 확인을 눌러주세요.');
}
async function refreshConsultingReportContent(automatic = false) {
    const source = consultingReportSource; if (!source?.caseId || (typeof consultingReportApprovalBusy !== 'undefined' && consultingReportApprovalBusy) || consultingReportContentBusy || (typeof consultingReportRevisionBusy !== 'undefined' && consultingReportRevisionBusy)) return;
    if (!automatic) consultingReportContentPolls = 0;
    const generation = consultingReportContentGeneration; consultingReportContentBusy = true; updateConsultingReportContentButtons();
    try {
        const result = await requestConsultingAdmin('admin_get_report_content', { caseId: source.caseId });
        if (generation !== consultingReportContentGeneration) return;
        if (result.caseId !== source.caseId) throw new Error('본문 연결을 확인해주세요.');
        if (consultingReportSource === source) source.caseRevision = Math.max(source.caseRevision || 0, result.caseRevision || 0);
        renderConsultingReportContent(result);
    } catch (error) { if (generation === consultingReportContentGeneration) { clearTimeout(consultingReportContentPoll); reportContentMessage(error.message || '생성 상태를 확인하지 못했습니다. 잠시 후 다시 확인해주세요.', 'error'); } }
    finally { if (generation === consultingReportContentGeneration) { consultingReportContentBusy = false; updateConsultingReportSourceButtons(); } }
}
async function queueConsultingReportContent() {
    const current = consultingReportContent, source = consultingReportSource;
    if ((typeof consultingReportApprovalBusy !== 'undefined' && consultingReportApprovalBusy) || consultingReportContentBusy || consultingReportSourceBusy || consultingReportSourceDirty || consultingReportFactsBusy || !current?.canGenerate || !source) return;
    const generation = consultingReportContentGeneration; consultingReportContentBusy = true; updateConsultingReportSourceButtons(); reportContentNode('consultingReportContentPanel').setAttribute('aria-busy', 'true'); reportContentMessage('본문 생성을 요청하고 있습니다.');
    try {
        await requestConsultingAdmin('admin_queue_report_content', { caseId: source.caseId, expectedCaseRevision: source.caseRevision, sourceDigest: current.sourceDigest, factsDigest: current.factsDigest, retry: ['failed', 'stale'].includes(current.status) });
        if (generation !== consultingReportContentGeneration) return;
        consultingReportContentBusy = false; await refreshConsultingReportContent();
    } catch (error) { if (generation === consultingReportContentGeneration) reportContentMessage(error.message || '생성을 요청하지 못했습니다. 최신 자료를 확인해주세요.', 'error'); }
    finally { if (generation === consultingReportContentGeneration) { consultingReportContentBusy = false; reportContentNode('consultingReportContentPanel').setAttribute('aria-busy', 'false'); updateConsultingReportSourceButtons(); } }
}

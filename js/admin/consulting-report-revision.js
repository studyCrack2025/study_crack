let consultingReportRevisionBusy = false;
let consultingReportRevisionState = { generation: 0, caseId: null, context: null, draft: null, dirty: false, items: [], cursor: null, selected: null, timer: null, polls: 0, loading: false };
const reportRevisionNode = id => document.getElementById(id);
const reportRevisionMessage = (text, state = '') => consultingWorkspaceStatus('consultingReportRevisionStatus', text, state);
const reportRevisionTargets = { cover:'전략 요약', scoreAnalysis:'점수 분석', baseline:'성적 기준 지원 범위', planA:'플랜 A', planB:'플랜 B', planC:'추가 플랜 C', conclusion:'최종 판단 기준', unresolvedItems:'추가 확인 사항' };
const reportRevisionStatuses = { pending:'작성 대기', processing:'수정본 작성 중', review_required:'수정 결과 확인 필요', partially_addressed:'일부 반영 · 추가 확인 필요', unresolved:'미해결', requires_recalculation:'원자료 검수·재계산 필요', requires_layout_review:'서식·배치 별도 검토', reapply_required:'현재 본문으로 재적용 필요', failed:'작성 실패', resolved:'확인 완료', withdrawn:'요청 철회', superseded:'새 요청으로 재적용' };
const reportRevisionElement = (tag, text, cls) => reportFactElement(tag, text, cls);
const reportRevisionForm = () => reportRevisionNode('consultingReportRevisionForm');
const reportRevisionParagraphs = (content, target) => target === 'planC' ? content.pages[5].planC.paragraphs : target === 'unresolvedItems' ? content.unresolvedItems : content.pages.find(p => p.key === target)?.paragraphs || [];
function resetConsultingReportRevisions() {
    clearTimeout(consultingReportRevisionState.timer);
    consultingReportRevisionState = { generation: consultingReportRevisionState.generation + 1, caseId: null, context: null, draft: null, dirty: false, items: [], cursor: null, selected: null, timer: null, polls: 0, loading: false };
    consultingReportRevisionBusy = false;
    reportRevisionForm()?.reset(); reportRevisionNode('consultingReportRevisionPanel')?.setAttribute('hidden', '');
    for (const id of ['consultingReportRevisionEvidence', 'consultingReportRevisionList', 'consultingReportRevisionDetail']) reportRevisionNode(id)?.replaceChildren();
    if (reportRevisionNode('consultingReportRevisionDetail')) reportRevisionNode('consultingReportRevisionDetail').hidden = true;
    if (reportRevisionNode('consultingReportRevisionComposer')) reportRevisionNode('consultingReportRevisionComposer').open = false;
    reportRevisionMessage(''); updateConsultingReportRevisionButtons();
}
function updateConsultingReportRevisionButtons() {
    const s = consultingReportRevisionState, context = s.context;
    if (!reportRevisionNode('consultingReportRevisionFields')) return;
    const stale = s.draft && s.draft.baseContentDigest !== context?.record?.contentDigest;
    const disabled = (typeof consultingReportApprovalBusy !== 'undefined' && consultingReportApprovalBusy) || consultingReportRevisionBusy || consultingReportContentBusy || consultingReportSourceBusy || consultingReportSourceDirty || context?.canRequestRevision !== true || stale;
    reportRevisionNode('consultingReportRevisionFields').disabled = Boolean(disabled);
    for (const button of reportRevisionNode('consultingReportRevisionDetail').querySelectorAll('button')) button.disabled = consultingReportRevisionBusy;
    reportRevisionNode('consultingReportRevisionRefresh').disabled = consultingReportRevisionBusy || s.loading || !s.caseId;
    reportRevisionNode('consultingReportRevisionMore').disabled = s.loading || consultingReportRevisionBusy;
    reportRevisionNode('consultingReportRevisionRebase').hidden = !stale;
    reportRevisionNode('consultingReportRevisionRebase').disabled = !context?.record || consultingReportRevisionBusy;
    reportRevisionNode('consultingReportRevisionBase').textContent = stale ? '작성 기준 본문이 바뀌었습니다. 입력은 보존했습니다. 최신 본문을 확인한 뒤 기준을 바꿔주세요.' : s.draft ? `본문 ${s.draft.baseContentRevision}을 기준으로 요청합니다. 원자료에 없는 내용은 새 사실로 반영하지 않습니다.` : '현재 본문이 준비되면 수정 요청을 작성할 수 있습니다.';
    if (typeof updateConsultingReportApprovalButtons === 'function') updateConsultingReportApprovalButtons();
}
function revisionEvidenceLabel(source) {
    const labels = { conclusion:'상담 결론', requiredConditions:'필수 조건', flexibleConditions:'조정 가능한 조건', riskReason:'지원 성향의 근거', riskTolerance:'지원 성향', questions:'질문별 답변', clarifications:'상담에서 확인한 변경', comparisons:'비교 의견', planC:'추가 경로 의향', rationale:'판단 근거', furtherChecks:'추가 확인', unresolved:'미해결 사항', 'strategy.priorityOrder':'선택 기준 우선순위', 'preferences.rankedChoices':'희망 지원', 'conditions.repeatStudyAllowed':'재수 가능성', 'conditions.commuteLimit':'통학 범위' };
    return `${source.kind === 'survey' ? '기초조사서' : '상담 정리'} · ${labels[source.path] || '지원 정보'}`;
}
function populateRevisionEvidence(selected = []) {
    const root = reportRevisionNode('consultingReportRevisionEvidence'); root.replaceChildren();
    for (const source of consultingReportRevisionState.context?.record?.content?.evidence || []) {
        const label = reportRevisionElement('label', undefined, 'consulting-report-revision-evidence-row'), input = document.createElement('input'); input.type = 'checkbox'; input.value = source.id; input.checked = selected.includes(source.id); input.setAttribute('aria-label', revisionEvidenceLabel(source));
        const copy = reportRevisionElement('span'); copy.append(reportRevisionElement('strong', revisionEvidenceLabel(source)), reportRevisionElement('span', source.value)); label.append(input, copy); root.append(label);
    }
}
function updateRevisionParagraphOptions() {
    const s = consultingReportRevisionState, form = reportRevisionForm(), select = form.elements.paragraphIndex;
    select.replaceChildren(new Option('항목 전체', ''));
    if (!s.context?.record?.content) return;
    reportRevisionParagraphs(s.context.record.content, form.elements.target.value).forEach((_p, i) => select.append(new Option(`문단 ${i + 1}`, String(i))));
}
function rebaseConsultingReportRevision() {
    const s = consultingReportRevisionState, context = s.context; if (!context?.record || consultingReportRevisionBusy) return;
    s.draft = { baseContentRevision: context.record.revision, baseContentDigest: context.record.contentDigest, sourceDigest: context.sourceDigest, factsDigest: context.factsDigest, idempotencyKey: crypto.randomUUID().replaceAll('-', '_'), supersedes: s.draft?.supersedes || null };
    populateRevisionEvidence(); updateRevisionParagraphOptions(); updateConsultingReportRevisionButtons();
}
function bindConsultingReportRevisions(context) {
    const caseId = consultingReportSource?.caseId, s = consultingReportRevisionState;
    if (!reportRevisionNode('consultingReportRevisionPanel')) return;
    if (!caseId || !context || !Object.hasOwn(context, 'canRequestRevision')) return;
    if (s.caseId && s.caseId !== caseId) resetConsultingReportRevisions();
    const state = consultingReportRevisionState, first = !state.caseId; state.caseId = caseId; state.context = context;
    reportRevisionNode('consultingReportRevisionPanel').hidden = false;
    if (!state.dirty && context.record && state.draft?.baseContentDigest !== context.record.contentDigest) rebaseConsultingReportRevision();
    const form = reportRevisionForm();
    if (!form.dataset.revisionBound) {
        form.dataset.revisionBound = 'true';
        const mark = () => { const s = consultingReportRevisionState; s.dirty = true; if (s.draft) s.draft.idempotencyKey = crypto.randomUUID().replaceAll('-', '_'); updateConsultingReportRevisionButtons(); };
        form.addEventListener('input', mark); form.addEventListener('change', mark);
        form.elements.target.addEventListener('change', updateRevisionParagraphOptions);
        form.addEventListener('change', event => { if (event.target.matches('input[type="checkbox"]') && form.querySelectorAll('input[type="checkbox"]:checked').length > 8) { event.target.checked = false; reportRevisionMessage('참고 근거는 최대 8개까지 선택해주세요.', 'error'); } });
    }
    updateConsultingReportRevisionButtons();
    if (first) refreshConsultingReportRevisions();
}
function beginConsultingReportRevision(target) {
    const s = consultingReportRevisionState; if (!s.context?.canRequestRevision) return;
    reportRevisionNode('consultingReportRevisionComposer').open = true;
    reportRevisionForm().elements.target.value = target; updateRevisionParagraphOptions();
    reportRevisionNode('consultingReportRevisionComposer').scrollIntoView({ block: 'start', behavior: 'smooth' });
    reportRevisionForm().elements.issue.focus({ preventScroll: true });
}
function renderRevisionList() {
    const s = consultingReportRevisionState, root = reportRevisionNode('consultingReportRevisionList'); root.replaceChildren();
    for (const row of s.items) {
        const item = reportRevisionElement('li'), copy = reportRevisionElement('div');
        copy.append(reportRevisionElement('strong', `${reportRevisionTargets[row.input.target]} · ${reportRevisionStatuses[row.status] || '상태 확인 필요'}`), reportRevisionElement('p', row.input.issue), reportRevisionElement('small', `기준 본문 ${row.baseContentRevision} · ${formatConsultingDate(row.createdAt)}`));
        const button = reportRevisionElement('button', '요청·변경 내용 보기', 'consulting-btn consulting-btn-secondary'); button.type = 'button'; button.addEventListener('click', () => openConsultingReportRevision(row.requestKey));
        item.append(copy, button); root.append(item);
    }
    if (!s.items.length) root.append(reportRevisionElement('li', '아직 등록한 수정 요청이 없습니다.'));
    reportRevisionNode('consultingReportRevisionMore').hidden = !s.cursor;
}
async function refreshConsultingReportRevisions(automatic = false, append = false) {
    const s = consultingReportRevisionState; if (!s.caseId || s.loading || consultingReportRevisionBusy) return;
    clearTimeout(s.timer); if (!automatic) s.polls = 0;
    const generation = s.generation, priorRevision = s.context?.record?.revision || 0; s.loading = true; updateConsultingReportRevisionButtons();
    try {
        const result = await requestConsultingAdmin('admin_get_report_revision_workspace', { caseId: s.caseId, ...(append && s.cursor ? { cursor: s.cursor } : {}) });
        if (generation !== consultingReportRevisionState.generation) return;
        if (result.caseId !== s.caseId || !Array.isArray(result.items)) throw new Error('수정 요청 목록을 확인해주세요.');
        if (consultingReportSource?.caseId === s.caseId) consultingReportSource.caseRevision = Math.max(consultingReportSource.caseRevision || 0, result.caseRevision || 0);
        s.items = append ? [...s.items, ...result.items.filter(r => !s.items.some(old => old.requestKey === r.requestKey))] : result.items; s.cursor = result.nextCursor;
        reportRevisionNode('consultingReportRevisionCount').textContent = `확인이 남은 요청 ${result.openCount}건 · 현재 본문 ${result.currentContentRevision || '준비 전'}`; renderRevisionList();
        if (result.currentContentRevision !== priorRevision && !consultingReportContentBusy) await refreshConsultingReportContent();
        if (result.hasPending && s.polls < 30) s.timer = setTimeout(() => { if (generation === consultingReportRevisionState.generation && !document.hidden && reportRevisionNode('consultingReportRevisionPanel').getClientRects().length) { s.polls++; refreshConsultingReportRevisions(true); } }, 10000);
        else if (result.hasPending) reportRevisionMessage('아직 처리 중입니다. 잠시 후 수정 요청 새로고침을 눌러주세요.');
    } catch (error) { if (generation === consultingReportRevisionState.generation) reportRevisionMessage(error.message || '수정 요청을 조회하지 못했습니다. 잠시 후 다시 확인해주세요.', 'error'); }
    finally { if (generation === consultingReportRevisionState.generation) { s.loading = false; updateConsultingReportRevisionButtons(); } }
}
function moreConsultingReportRevisions() { return refreshConsultingReportRevisions(false, true); }
async function submitConsultingReportRevision() {
    const s = consultingReportRevisionState, form = reportRevisionForm();
    if (consultingReportRevisionBusy || consultingReportSourceDirty || !s.draft || !s.context?.canRequestRevision || s.draft.baseContentDigest !== s.context.record.contentDigest) return;
    const value = name => form.elements[name].value;
    if (!value('issue').trim() || !value('instruction').trim()) return reportRevisionMessage('발견한 문제와 원하는 수정 방향을 작성해주세요.', 'error');
    const data = { caseId: s.caseId, ...s.draft, target: value('target'), paragraphIndex: value('paragraphIndex') === '' ? null : Number(value('paragraphIndex')), category: value('category'), scope: value('scope'), issue: value('issue'), instruction: value('instruction'), sourceRefs: [...form.querySelectorAll('input[type="checkbox"]:checked')].map(n => n.value) };
    const generation = s.generation; consultingReportRevisionBusy = true; updateConsultingReportSourceButtons(); reportRevisionMessage('수정 요청을 등록하고 있습니다.');
    try {
        const result = await requestConsultingAdmin('admin_request_report_revision', data);
        if (generation !== consultingReportRevisionState.generation) return;
        s.dirty = false; s.draft = null; form.reset(); rebaseConsultingReportRevision();
        reportRevisionMessage(['requires_recalculation', 'requires_layout_review'].includes(result.request.status) ? '요청을 보관했습니다. 본문의 설명 변경으로 처리할 수 없어 별도 검수가 필요합니다.' : '수정 요청을 보관했습니다. 현재 본문은 유지하며 수정 결과를 기다립니다.', 'success');
        consultingReportRevisionBusy = false; await refreshConsultingReportRevisions();
        if (typeof consultingReportApprovalState !== 'undefined' && consultingReportApprovalState.caseId === s.caseId) await refreshConsultingReportApprovals();
    } catch (error) { if (generation === consultingReportRevisionState.generation) reportRevisionMessage((error.status === 409 ? '본문이나 요청 상태가 변경되었습니다. 입력은 보존했습니다. 최신 내용을 확인해주세요. ' : '') + (error.message || '요청을 등록하지 못했습니다. 같은 내용으로 다시 보내면 중복 등록하지 않습니다.'), 'error'); }
    finally { if (generation === consultingReportRevisionState.generation) { consultingReportRevisionBusy = false; updateConsultingReportSourceButtons(); } }
}
function revisionDiff(detail, comparison) {
    if (!comparison) return;
    detail.append(reportRevisionElement('p', comparison.numbersUnchanged ? '계산된 후보·환산점수·예상컷·확률을 유지한 수정입니다.' : '수치 검수가 필요합니다.', 'consulting-report-source-notice'));
    detail.append(reportRevisionElement('p', `기준 본문 ${comparison.baseContentRevision} → ${comparison.resultContentRevision ? '본문 ' + comparison.resultContentRevision : '본문 유지'}`));
    detail.append(reportRevisionElement('p', comparison.response.explanation));
    for (const diff of comparison.diff) {
        const section = reportRevisionElement('section', undefined, 'consulting-report-revision-change'); section.append(reportRevisionElement('h5', `${reportRevisionTargets[diff.target]} · 문단 ${diff.paragraphIndex + 1}`));
        const grid = reportRevisionElement('div', undefined, 'consulting-report-revision-diff');
        for (const [side, label] of [['before', '수정 전'], ['after', '수정 후']]) { const card = reportRevisionElement('div'); card.dataset.side = side; card.append(reportRevisionElement('strong', label), reportRevisionElement('p', diff[side]?.text || (side === 'before' ? '추가된 문단입니다.' : '삭제된 문단입니다.'))); for (const id of diff[side]?.sourceRefs || []) { const source = comparison.evidence.find(e => e.id === id); if (source) card.append(reportRevisionElement('small', revisionEvidenceLabel(source))); } grid.append(card); }
        section.append(grid); detail.append(section);
    }
    if (!comparison.diff.length) detail.append(reportRevisionElement('p', '본문 변경 없이 추가 검토 사항을 안내했습니다.'));
}
async function openConsultingReportRevision(requestKey) {
    const s = consultingReportRevisionState, generation = s.generation; s.selected = requestKey;
    const root = reportRevisionNode('consultingReportRevisionDetail'); root.hidden = false; root.replaceChildren(reportRevisionElement('p', '수정 요청과 변경 내용을 확인하고 있습니다.'));
    try {
        const data = await requestConsultingAdmin('admin_get_report_revision_detail', { caseId: s.caseId, requestKey });
        if (generation !== consultingReportRevisionState.generation || s.selected !== requestKey) return;
        const row = data.request; root.replaceChildren(reportRevisionElement('h4', `${reportRevisionTargets[row.input.target]} · ${reportRevisionStatuses[row.status] || '상태 확인 필요'}`), reportRevisionElement('p', `발견한 문제 · ${row.input.issue}`), reportRevisionElement('p', `수정 방향 · ${row.input.instruction}`));
        if (row.lastErrorCode) root.append(reportRevisionElement('p', row.lastErrorCode === 'AI_REVISION_BASE_CHANGED' ? '본문 또는 원자료가 변경됐습니다. 현재 본문을 확인하고 재적용해주세요.' : reportContentErrors[row.lastErrorCode] || '수정본 생성 검사를 마치지 못했습니다. 근거와 연결 상태를 확인한 뒤 현재 본문으로 다시 요청해주세요.', 'consulting-caption'));
        if (data.requiresReapply) root.append(reportRevisionElement('p', '다른 수정이 반영되어 기준 본문이 바뀌었습니다. 현재 본문에서 이 요청이 여전히 필요한지 확인해주세요.', 'consulting-report-source-notice'));
        revisionDiff(root, data.comparison);
        const open = !['resolved', 'withdrawn', 'superseded'].includes(row.status), active = ['pending', 'processing'].includes(row.status);
        if (data.canEdit && open && !active && s.context?.canRequestRevision) { const reapply = reportRevisionElement('button', '현재 본문으로 다시 요청', 'consulting-btn consulting-btn-secondary'); reapply.type = 'button'; reapply.addEventListener('click', () => { const f = reportRevisionForm(); for (const [key, value] of Object.entries(row.input)) if (f.elements[key] && key !== 'paragraphIndex') f.elements[key].value = value; s.dirty = true; rebaseConsultingReportRevision(); s.draft.supersedes = row.requestKey; populateRevisionEvidence(row.input.sourceRefs); reportRevisionNode('consultingReportRevisionComposer').open = true; reportRevisionNode('consultingReportRevisionComposer').scrollIntoView({ block: 'start' }); reportRevisionMessage('현재 본문을 확인한 뒤 수정 요청을 다시 보내주세요.'); }); root.append(reapply); }
        if (data.canEdit && open && row.status !== 'processing') {
            const label = reportRevisionElement('label', '처리 사유'), reason = document.createElement('textarea'); reason.maxLength = 1000; reason.rows = 2; reason.setAttribute('aria-label', '수정 요청 처리 사유'); label.append(reason); root.append(label);
            const actions = reportRevisionElement('div', undefined, 'consulting-actions');
            const choices = [...(row.status === 'review_required' ? [['confirmed', '수정 결과 확인 완료']] : []), ...(row.status === 'requires_recalculation' ? [['source_reviewed', '원자료 재검수 후 처리 완료']] : []), ['withdrawn', '요청 철회']];
            for (const [action, text] of choices) { const button = reportRevisionElement('button', text, 'consulting-btn consulting-btn-secondary'); button.type = 'button'; button.addEventListener('click', () => closeConsultingReportRevision(row, action, reason.value)); actions.append(button); } root.append(actions);
        }
        if (row.resolution) root.append(reportRevisionElement('p', `처리 기록 · ${row.resolution.reason}`, 'consulting-caption'));
        root.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (error) { if (generation === consultingReportRevisionState.generation && s.selected === requestKey) root.replaceChildren(reportRevisionElement('p', error.message || '요청을 조회하지 못했습니다.')); }
}
async function closeConsultingReportRevision(row, action, reason) {
    const s = consultingReportRevisionState; if (consultingReportRevisionBusy) return;
    if (!reason.trim()) return reportRevisionMessage('처리 사유를 작성해주세요.', 'error');
    if (!confirm(action === 'withdrawn' ? '이 수정 요청을 철회하고 처리 사유를 남길까요?' : '현재 본문과 근거를 직접 확인했으며, 수정 요청의 처리를 완료할까요? 보고서 최종 승인은 별도입니다.')) return;
    const generation = s.generation; consultingReportRevisionBusy = true; updateConsultingReportSourceButtons();
    try {
        await requestConsultingAdmin('admin_resolve_report_revision', { caseId: s.caseId, requestKey: row.requestKey, action, reason, confirmed: true, expectedContentRevision: s.context?.record?.revision || 0, expectedContentDigest: s.context?.record?.contentDigest || null });
        if (generation !== consultingReportRevisionState.generation) return;
        consultingReportRevisionBusy = false; reportRevisionMessage('요청 처리 기록을 저장했습니다.', 'success'); await refreshConsultingReportRevisions(); await openConsultingReportRevision(row.requestKey);
        if (typeof consultingReportApprovalState !== 'undefined' && consultingReportApprovalState.caseId === s.caseId) await refreshConsultingReportApprovals();
    } catch (error) { if (generation === consultingReportRevisionState.generation) reportRevisionMessage(error.message || '처리 상태가 변경되었습니다. 최신 요청을 확인해주세요.', 'error'); }
    finally { if (generation === consultingReportRevisionState.generation) { consultingReportRevisionBusy = false; updateConsultingReportSourceButtons(); } }
}

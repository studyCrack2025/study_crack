let consultingReportApprovalBusy = false;
let consultingReportApprovalState = { generation: 0, caseId: null, context: null, view: null, loading: false, fresh: false, history: [], cursor: null };
const reportApprovalNode = id => document.getElementById(id);
const reportApprovalMessage = (text, state = '') => consultingWorkspaceStatus('consultingReportApprovalStatus', text, state);
function resetConsultingReportApprovals() {
    const generation = consultingReportApprovalState.generation + 1;
    consultingReportApprovalState = { generation, caseId: null, context: null, view: null, loading: false, fresh: false, history: [], cursor: null };
    consultingReportApprovalBusy = false;
    reportApprovalNode('consultingReportApprovalPanel')?.setAttribute('hidden', '');
    for (const id of ['consultingReportApprovalRoles', 'consultingReportApprovalBlockers', 'consultingReportApprovalHistory']) reportApprovalNode(id)?.replaceChildren();
    if (reportApprovalNode('consultingReportApprovalConfirmed')) reportApprovalNode('consultingReportApprovalConfirmed').checked = false;
    if (reportApprovalNode('consultingReportApprovalReason')) reportApprovalNode('consultingReportApprovalReason').value = '';
    reportApprovalMessage('');
}
function reportApprovalBodyMatches() {
    const s = consultingReportApprovalState;
    return s.context?.record && s.view?.target && s.context.status === 'completed' && !reportApprovalNode('consultingReportSummaryVersion')?.value
        && s.context.record.revision === s.view.target.contentRevision && s.context.record.contentDigest === s.view.target.contentDigest;
}
function updateConsultingReportApprovalButtons() {
    const s = consultingReportApprovalState, view = s.view;
    if (!reportApprovalNode('consultingReportApproveContent')) return;
    const blocked = consultingReportApprovalBusy || s.loading || consultingReportSourceBusy || consultingReportSourceDirty || consultingReportFactsBusy || consultingReportContentBusy || consultingReportRevisionBusy;
    const dirtyRequest = typeof consultingReportRevisionState !== 'undefined' && consultingReportRevisionState.dirty;
    const writable = s.fresh && reportApprovalBodyMatches() && !blocked && !dirtyRequest;
    reportApprovalNode('consultingReportApproveContent').disabled = !writable || view?.canApprove !== true || !reportApprovalNode('consultingReportApprovalConfirmed').checked;
    reportApprovalNode('consultingReportWithdrawApproval').disabled = !writable || view?.canWithdraw !== true || !reportApprovalNode('consultingReportApprovalReason').value.trim();
    reportApprovalNode('consultingReportApprovalConfirmed').disabled = !writable || view?.canApprove !== true;
    reportApprovalNode('consultingReportApprovalReason').disabled = !writable || view?.canWithdraw !== true;
    reportApprovalNode('consultingReportApprovalRefresh').disabled = s.loading || consultingReportApprovalBusy || !s.caseId;
    reportApprovalNode('consultingReportApprovalMore').disabled = s.loading || consultingReportApprovalBusy;
    reportApprovalNode('consultingReportApprovalPanel').setAttribute('aria-busy', String(consultingReportApprovalBusy || s.loading));
}
function renderReportApprovalHistory() {
    const s = consultingReportApprovalState, root = reportApprovalNode('consultingReportApprovalHistory'); root.replaceChildren();
    for (const item of s.history) {
        const li = reportFactElement('li');
        li.append(reportFactElement('strong', `${item.role} · 본문 ${item.contentRevision} · ${item.event === 'REPORT_CONTENT_APPROVAL_WITHDRAWN' ? '승인 철회' : '내용 승인'}`), reportFactElement('span', formatConsultingDate(item.createdAt)));
        if (item.reason) li.append(reportFactElement('p', item.reason));
        root.append(li);
    }
    if (!s.history.length) root.append(reportFactElement('li', '아직 내용 승인 이력이 없습니다.'));
    reportApprovalNode('consultingReportApprovalMore').hidden = !s.cursor;
}
function renderConsultingReportApprovals(view, append = false) {
    const s = consultingReportApprovalState, prior = s.view?.target?.id; s.view = view;
    if (prior !== view?.target?.id) reportApprovalNode('consultingReportApprovalConfirmed').checked = false;
    if (append) s.history = [...s.history, ...(view.history || [])]; else s.history = view.history || [];
    s.cursor = view.nextCursor || null;
    const matches = reportApprovalBodyMatches();
    reportApprovalNode('consultingReportApprovalMeta').textContent = `${view.target ? `본문 ${view.target.contentRevision}` : '승인할 본문 준비 중'} · ${view.count || 0}/3 승인${view.ownRole ? ` · 내 역할 ${view.ownRole}` : ' · 조회 전용'}`;
    const cards = reportApprovalNode('consultingReportApprovalRoles'); cards.replaceChildren();
    const descriptions = { CEO: '학생 의향과 제안 방향', CTO: '성적·수치와 지원 근거', CMO: '표현·가독성과 정보 누락' };
    for (const member of view.roles || []) {
        const card = reportFactElement('article', undefined, 'consulting-report-approval-role'); card.dataset.state = member.status;
        card.append(reportFactElement('h5', `${member.role}${member.own ? ' · 나' : ''}`), reportFactElement('p', descriptions[member.role]),
            reportFactElement('strong', member.status === 'approved' ? '승인 완료' : member.previousApproval ? '재확인 필요' : '승인 대기'),
            reportFactElement('span', member.approvedAt ? formatConsultingDate(member.approvedAt) : '현재 본문 검토 후 승인해주세요.'));
        cards.append(card);
    }
    const reasons = reportApprovalNode('consultingReportApprovalBlockers'); reasons.replaceChildren();
    for (const blocker of view.blockers || []) reasons.append(reportFactElement('li', blocker.message));
    if (!matches && view.target) reasons.append(reportFactElement('li', '표시된 본문과 현재 승인 대상이 다릅니다. 생성 상태 확인을 눌러 최신 본문을 읽어주세요.'));
    reportApprovalNode('consultingReportApprovalOwnActions').hidden = !view.ownRole;
    reportApprovalNode('consultingReportApprovalWithdrawFields').hidden = !view.canWithdraw;
    reportApprovalNode('consultingReportApprovalConfirmedRow').hidden = !view.canApprove;
    reportApprovalNode('consultingReportApproveContent').hidden = !view.canApprove;
    reportApprovalNode('consultingReportApprovalNext').textContent = view.renderRequest?.eligible
        ? '세 명이 같은 본문을 승인했습니다. PDF 제작 요청을 기록했습니다. 실제 PDF 생성·완성본 검수는 다음 단계에서 연결됩니다.'
        : '세 명의 유효한 승인이 모두 모이면 PDF 제작 요청을 기록합니다. 본문 수정·수정 요청·승인 철회 시 다시 승인을 받습니다.';
    renderReportApprovalHistory(); updateConsultingReportApprovalButtons();
}
function bindConsultingReportApprovals(context) {
    if (!reportApprovalNode('consultingReportApprovalPanel')) return;
    if (!context?.approval || !consultingReportSource?.caseId) { resetConsultingReportApprovals(); return; }
    const s = consultingReportApprovalState;
    if (s.caseId && s.caseId !== consultingReportSource.caseId) resetConsultingReportApprovals();
    const state = consultingReportApprovalState; state.caseId = consultingReportSource.caseId; state.context = context; state.fresh = true;
    reportApprovalNode('consultingReportApprovalPanel').hidden = false;
    renderConsultingReportApprovals(context.approval);
}
async function refreshConsultingReportApprovals(append = false) {
    const s = consultingReportApprovalState;
    if (!s.caseId || s.loading || consultingReportApprovalBusy) return;
    const generation = s.generation, caseId = s.caseId; s.loading = true; updateConsultingReportApprovalButtons();
    try {
        const data = await requestConsultingAdmin('admin_get_report_content_approvals', { caseId, ...(append && s.cursor ? { cursor: s.cursor } : {}) });
        if (generation !== consultingReportApprovalState.generation || consultingReportSource?.caseId !== caseId) return;
        if (data.caseId !== caseId || !Array.isArray(data.roles) || !Array.isArray(data.blockers)) throw new Error('승인 상태의 응답을 확인하지 못했습니다.');
        s.fresh = true; consultingReportSource.caseRevision = Math.max(consultingReportSource.caseRevision || 0, data.caseRevision || 0);
        renderConsultingReportApprovals(data, append); reportApprovalMessage('현재 본문의 승인 상태를 확인했습니다.', 'success');
    } catch (error) {
        if (generation !== consultingReportApprovalState.generation) return;
        s.fresh = false; reportApprovalMessage(error.message || '승인 상태를 확인하지 못했습니다. 새로고침 후 다시 확인해주세요.', 'error');
    } finally { if (generation === consultingReportApprovalState.generation) { s.loading = false; updateConsultingReportApprovalButtons(); } }
}
async function submitConsultingReportApproval(withdraw = false) {
    const s = consultingReportApprovalState, view = s.view;
    const button = reportApprovalNode(withdraw ? 'consultingReportWithdrawApproval' : 'consultingReportApproveContent');
    updateConsultingReportApprovalButtons(); if (button.disabled || !s.caseId || !view?.target) return;
    if (withdraw && !window.confirm('본인 승인을 철회하면 세 명 모두 현재 본문을 다시 승인해야 합니다. 철회하시겠습니까?')) return;
    const generation = s.generation, caseId = s.caseId, targetId = view.target.id;
    const data = { caseId, targetId, confirmed: true, ...(withdraw ? { reason: reportApprovalNode('consultingReportApprovalReason').value.trim() } : {}) };
    consultingReportApprovalBusy = true; updateConsultingReportSourceButtons(); reportApprovalMessage(withdraw ? '승인을 철회하고 있습니다.' : '현재 본문에 본인 승인을 등록하고 있습니다.');
    try {
        const result = await requestConsultingAdmin(withdraw ? 'admin_withdraw_report_content_approval' : 'admin_approve_report_content', data);
        if (generation !== consultingReportApprovalState.generation || consultingReportSource?.caseId !== caseId) return;
        if (result.caseId !== caseId || !result.approval) throw new Error('처리 결과를 확인하지 못했습니다. 승인 상태를 새로고침해주세요.');
        consultingReportSource.caseRevision = Math.max(consultingReportSource.caseRevision || 0, result.caseRevision || 0);
        s.fresh = true; renderConsultingReportApprovals(result.approval); reportApprovalNode('consultingReportApprovalConfirmed').checked = false;
        if (withdraw) reportApprovalNode('consultingReportApprovalReason').value = '';
        reportApprovalMessage(withdraw ? '승인을 철회했습니다. 현재 본문은 세 명 모두 다시 확인해야 합니다.' : '본인 승인을 등록했습니다.', 'success');
    } catch (error) {
        if (generation !== consultingReportApprovalState.generation) return;
        s.fresh = false; reportApprovalMessage((error.message || '처리 결과를 확인하지 못했습니다.') + ' 승인 상태를 새로고침한 뒤 확인해주세요.', 'error');
    } finally { if (generation === consultingReportApprovalState.generation) { consultingReportApprovalBusy = false; updateConsultingReportSourceButtons(); } }
}

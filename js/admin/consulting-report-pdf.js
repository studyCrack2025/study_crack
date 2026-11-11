let consultingReportPdfBusy = false;
let consultingReportPdf = { generation: 0, caseId: null, view: null, history: [], cursor: null, fresh: false, loading: false, polls: 0, timer: null };
const reportPdfNode = id => document.getElementById(id);
const reportPdfMessage = (text, state = '') => consultingWorkspaceStatus('consultingReportPdfStatus', text, state);
function resetConsultingReportPdf() {
    clearTimeout(consultingReportPdf.timer);
    consultingReportPdf = { generation: consultingReportPdf.generation + 1, caseId: null, view: null, history: [], cursor: null, fresh: false, loading: false, polls: 0, timer: null };
    consultingReportPdfBusy = false;
    reportPdfNode('consultingReportPdfPanel')?.setAttribute('hidden', '');
    reportPdfNode('consultingReportPdfCurrent')?.replaceChildren(); reportPdfNode('consultingReportPdfHistory')?.replaceChildren(); reportPdfMessage('');
}
function updateConsultingReportPdfButtons() {
    const s = consultingReportPdf;
    if (!reportPdfNode('consultingReportPdfQueue')) return;
    const blocked = consultingReportPdfBusy || s.loading || consultingReportSourceBusy || consultingReportSourceDirty || consultingReportFactsBusy || consultingReportContentBusy || consultingReportRevisionBusy || consultingReportApprovalBusy;
    const dirty = typeof consultingReportRevisionState !== 'undefined' && consultingReportRevisionState.dirty;
    reportPdfNode('consultingReportPdfQueue').disabled = blocked || dirty || !s.fresh || s.view?.canQueue !== true || Boolean(reportPdfNode('consultingReportSummaryVersion')?.value);
    reportPdfNode('consultingReportPdfRefresh').disabled = blocked || !s.caseId;
    reportPdfNode('consultingReportPdfMore').disabled = blocked;
    for (const button of reportPdfNode('consultingReportPdfPanel').querySelectorAll('[data-pdf-artifact]')) button.disabled = blocked || !s.fresh;
    reportPdfNode('consultingReportPdfPanel').setAttribute('aria-busy', String(consultingReportPdfBusy || s.loading));
}
function reportPdfArtifactCard(row) {
    const card = reportFactElement('article', undefined, 'consulting-report-pdf-file');
    card.append(reportFactElement('h5', `본문 ${row.contentRevision} · ${row.pageCount}페이지${row.current ? ' · 현재 승인본' : ' · 이전 생성본'}`),
        reportFactElement('p', `${formatConsultingDate(row.createdAt)} · ${(row.bytes / 1024).toFixed(0)} KB · 서식 ${row.templateVersion}`, 'consulting-caption'),
        reportFactElement('p', `파일 확인값 ${row.pdfSha256}`, 'consulting-report-pdf-digest'));
    const actions = reportFactElement('div', undefined, 'consulting-actions');
    for (const [inline, text] of [[true, 'PDF 미리보기'], [false, 'PDF 다운로드']]) {
        const button = reportFactElement('button', text, 'consulting-btn consulting-btn-secondary'); button.type = 'button'; button.dataset.pdfArtifact = row.artifactId;
        button.addEventListener('click', () => openConsultingReportPdf(row.artifactId, inline)); actions.append(button);
    }
    card.append(actions); return card;
}
function renderConsultingReportPdf(view, append = false) {
    const s = consultingReportPdf; clearTimeout(s.timer); s.timer = null; s.view = view;
    s.history = append ? [...s.history, ...(view.history || [])].filter((r, i, rows) => rows.findIndex(x => x.artifactId === r.artifactId) === i) : view.history || [];
    s.cursor = view.nextCursor || null;
    const labels = { content_approval_required: 'CEO·CTO·CMO가 같은 최신 본문을 모두 승인하면 PDF 제작이 시작됩니다.', not_queued: '본문 승인 상태를 먼저 확인해주세요.', awaiting_renderer: '기존에 승인한 본문입니다. 아래에서 PDF 제작을 한 번 요청해주세요.', pending: 'PDF 제작 대기 중입니다. 상태를 자동으로 확인하고 있습니다.', processing: '승인한 본문을 6페이지 PDF로 만들고 있습니다.', ready: '승인된 본문으로 6페이지 PDF를 만들었습니다. 아래에서 실제 파일을 확인해주세요.', failed: 'PDF 제작을 완료하지 못했습니다.', stale: '자료 또는 승인이 변경되어 이 제작 작업을 중지했습니다. 최신 본문을 다시 확인해주세요.', cancelled: '이전 본문의 제작이 취소됐습니다.' };
    let message = labels[view.status] || 'PDF 제작 상태를 확인해주세요.';
    if (view.job?.lastErrorCode === 'PDF_LAYOUT_OVERFLOW') message += ` ${view.job.errorPages.join(', ')}페이지의 내용이 서식 범위를 넘었습니다. 본문 길이를 정리하고 세 명의 승인을 다시 받아주세요.`;
    else if (view.job?.lastErrorCode) message += ` 확인 코드: ${view.job.lastErrorCode}`;
    reportPdfMessage(message, ['failed', 'stale'].includes(view.status) ? 'error' : view.status === 'ready' ? 'success' : '');
    const root = reportPdfNode('consultingReportPdfCurrent'); root.replaceChildren();
    if (view.current) root.append(reportPdfArtifactCard(view.current));
    else if (view.lastArtifact) { root.append(reportFactElement('p', '이 파일은 이전 생성본입니다. 현재 본문·승인 상태와 다를 수 있습니다.', 'consulting-report-source-notice'), reportPdfArtifactCard({ ...view.lastArtifact, current: false })); }
    const history = reportPdfNode('consultingReportPdfHistory'); history.replaceChildren();
    for (const row of s.history) { const li = reportFactElement('li'); li.append(reportPdfArtifactCard(row)); history.append(li); }
    if (!s.history.length) history.append(reportFactElement('li', '아직 저장된 PDF가 없습니다.'));
    reportPdfNode('consultingReportPdfMore').hidden = !s.cursor;
    reportPdfNode('consultingReportPdfQueue').hidden = !view.canQueue;
    reportPdfNode('consultingReportPdfQueue').textContent = view.status === 'awaiting_renderer' ? '승인 본문으로 PDF 제작 요청' : 'PDF 제작 다시 요청';
    updateConsultingReportPdfButtons();
    if (['pending', 'processing'].includes(view.status) && s.polls < 30 && !document.hidden) {
        const generation = s.generation; s.timer = setTimeout(() => { if (generation === consultingReportPdf.generation && !document.hidden) { s.polls++; refreshConsultingReportPdf(false, true); } }, 10000);
    }
}
function bindConsultingReportPdf(context) {
    if (!reportPdfNode('consultingReportPdfPanel')) return;
    if (!context?.pdf || !consultingReportSource?.caseId) { resetConsultingReportPdf(); return; }
    if (consultingReportPdf.caseId !== consultingReportSource.caseId) resetConsultingReportPdf();
    const s = consultingReportPdf; s.caseId = consultingReportSource.caseId; s.fresh = true;
    reportPdfNode('consultingReportPdfPanel').hidden = false; renderConsultingReportPdf(context.pdf);
}
async function refreshConsultingReportPdf(append = false, automatic = false) {
    const s = consultingReportPdf; if (!s.caseId || s.loading || consultingReportPdfBusy) return;
    clearTimeout(s.timer); s.timer = null; if (!automatic) s.polls = 0;
    const generation = s.generation, caseId = s.caseId; s.loading = true; updateConsultingReportPdfButtons();
    try {
        const data = await requestConsultingAdmin('admin_get_report_pdf_workspace', { caseId, ...(append && s.cursor ? { cursor: s.cursor } : {}) });
        if (generation !== consultingReportPdf.generation || consultingReportSource?.caseId !== caseId) return;
        if (data.caseId !== caseId || !Array.isArray(data.history) || typeof data.status !== 'string') throw new Error('PDF 상태 응답을 확인하지 못했습니다.');
        s.fresh = true; consultingReportSource.caseRevision = Math.max(consultingReportSource.caseRevision || 0, data.caseRevision || 0); renderConsultingReportPdf(data, append);
    } catch (error) {
        if (generation !== consultingReportPdf.generation) return;
        s.fresh = false; reportPdfMessage(error.message || 'PDF 상태를 확인하지 못했습니다. 상태 확인을 눌러 다시 확인해주세요.', 'error');
    } finally { if (generation === consultingReportPdf.generation) { s.loading = false; updateConsultingReportPdfButtons(); } }
}
async function queueConsultingReportPdf() {
    const s = consultingReportPdf; updateConsultingReportPdfButtons(); if (reportPdfNode('consultingReportPdfQueue').disabled || !s.view?.targetId) return;
    const generation = s.generation, caseId = s.caseId; consultingReportPdfBusy = true; updateConsultingReportSourceButtons();
    try {
        const data = await requestConsultingAdmin('admin_queue_report_pdf', { caseId, targetId: s.view.targetId, confirmed: true });
        if (generation !== consultingReportPdf.generation || consultingReportSource?.caseId !== caseId) return;
        if (data.caseId !== caseId || !Array.isArray(data.history)) throw new Error('제작 요청 결과를 확인하지 못했습니다.');
        s.fresh = true; s.polls = 0; renderConsultingReportPdf(data);
    } catch (error) { if (generation === consultingReportPdf.generation) { s.fresh = false; reportPdfMessage(error.message || '제작을 요청하지 못했습니다.', 'error'); } }
    finally { if (generation === consultingReportPdf.generation) { consultingReportPdfBusy = false; updateConsultingReportSourceButtons(); } }
}
async function openConsultingReportPdf(artifactId, inline) {
    const s = consultingReportPdf; updateConsultingReportPdfButtons();
    const button = [...reportPdfNode('consultingReportPdfPanel').querySelectorAll('[data-pdf-artifact]')].find(b => b.dataset.pdfArtifact === artifactId);
    if (!button || button.disabled || !s.caseId) return;
    const generation = s.generation, caseId = s.caseId, tab = window.open('about:blank', '_blank'); if (tab) tab.opener = null;
    consultingReportPdfBusy = true; updateConsultingReportSourceButtons();
    try {
        const data = await requestConsultingAdmin('admin_preview_report_pdf', { caseId, artifactId, inline });
        if (generation !== consultingReportPdf.generation || consultingReportSource?.caseId !== caseId) { tab?.close(); return; }
        const url = new URL(data.url);
        if (data.caseId !== caseId || data.artifactId !== artifactId || url.protocol !== 'https:' || url.username || url.password || url.port || !/^[a-z0-9][a-z0-9.-]+\.s3\.ap-northeast-2\.amazonaws\.com$/.test(url.hostname) || !/^\/generated_reports\/[^/]+\/(DEV|PROD)-ARTIFACT_[a-f0-9-]{36}\.pdf$/.test(url.pathname)) throw new Error('PDF 파일 주소를 확인하지 못했습니다.');
        if (tab) tab.location.replace(url.href);
        else { const link = reportFactElement('a', '여기를 눌러 PDF 열기', 'consulting-btn consulting-btn-secondary'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; reportPdfNode('consultingReportPdfCurrent').append(link); }
        reportPdfMessage(data.current ? '현재 승인본 PDF를 열었습니다. 아직 학생에게 전송되지 않았습니다.' : '이전 생성본을 열었습니다. 현재 승인본과 다를 수 있습니다.', 'success');
    } catch (error) { tab?.close(); if (generation === consultingReportPdf.generation) reportPdfMessage(error.message || 'PDF 파일을 열지 못했습니다.', 'error'); }
    finally { if (generation === consultingReportPdf.generation) { consultingReportPdfBusy = false; updateConsultingReportSourceButtons(); } }
}

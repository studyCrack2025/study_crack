// js/admin/pro-reports.js
// PRO 리포트 — API 인터랙션 + UI 렌더링
// currentStudentData, targetUserId, apiFetch, escapeHtml, formatReportKey,
// REPORT_API_URL, FILE_API_URL, loadProReportsForAdmin, updateCharCount 는
// detail-core.js / shared/api.js / shared/utils.js 에서 제공

// -----------------------------------------------------------
// 튜터/관리자 인터랙션 함수들
// -----------------------------------------------------------
async function submitRejectReason(key) {
    const reasonText = document.getElementById('rejectReasonText').value;
    if (reasonText.trim() === '') { alert('재검토 요청 사유를 입력해주세요.'); return; }
    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_reject_report', data: { targetUserId: targetUserId, reportKey: key, status: 'admin_review', rejectReason: reasonText } })
        });
        alert("관리자에게 재검토 요청이 전달되었습니다.");
        closeRejectModal();
        await loadProReportsForAdmin();
    } catch(e) { if (e.message !== "Auth expired") alert("재검토 요청 전송에 실패했습니다."); }
}

async function requestTutorReview(key) {
    const fileInput = document.getElementById(`pdfFile_${key}`);
    if (!fileInput.files || fileInput.files.length === 0) return alert("PDF 파일을 먼저 첨부해주세요.");
    const file = fileInput.files[0];
    if (file.type !== 'application/pdf') return alert("PDF 파일만 업로드 가능합니다.");
    if (!confirm("첨부한 PDF 파일을 업로드하고 튜터에게 최종 검수를 요청하시겠습니까?")) return;

    const btn = document.getElementById(`pdf_upload_btn_${key}`);
    if (!btn) return;
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중...';
    btn.disabled = true;

    try {
        const urlResponse = await apiFetch(FILE_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'get_presigned_url', data: { fileName: encodeURIComponent(file.name), fileType: file.type, folder: `pro_reports` } })
        });
        const { uploadUrl, fileUrl, fields } = await urlResponse.json();
        const formData = new FormData();
        Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v));
        formData.append('file', file);

        const uploadResult = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadResult.ok) throw new Error("S3 파일 업로드 실패");

        await apiFetch(REPORT_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'admin_request_tutor_review', data: { targetUserId: targetUserId, reportKey: key, reportLink: fileUrl, status: 'tutor_review' } })
        });
        alert("파일 업로드 및 튜터 검수 요청이 완료되었습니다.");
        await loadProReportsForAdmin();
    } catch(e) {
        if (e.message !== "Auth expired") alert("업로드 및 요청 실패: 서버 상태를 확인해주세요.");
    } finally {
        btn.innerHTML = originalBtnText; btn.disabled = false;
    }
}

async function publishProReportToStudent(key) {
    if(!confirm("최종 검수를 마치고 학생에게 리포트를 전송하시겠습니까? 전송 후에는 수정할 수 없습니다.")) return;
    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'tutor_publish_report', data: { targetUserId: targetUserId, reportKey: key, status: 'published' } })
        });
        alert("학생에게 최종 전송이 완료되었습니다.");
        await loadProReportsForAdmin();
    } catch(e) { if (e.message !== "Auth expired") alert("리포트 전송에 실패했습니다."); }
}

async function saveProDraft(key, silent = false) {
    const content = {
        eval: document.getElementById(`${key}_item1`)?.value || "", dist: document.getElementById(`${key}_item2`)?.value || "",
        plan: document.getElementById(`${key}_item3`)?.value || "", qna: document.getElementById(`${key}_item4`)?.value || ""
    };
    const report = currentStudentData.proReportsList.find(r => r.key === key);
    let currentStatus = report ? (report.status || 'drafting') : 'drafting';
    if (currentStatus === 'pending') currentStatus = 'drafting';

    await apiFetch(REPORT_API_URL, {
        method: 'POST', body: JSON.stringify({ type: 'save_pro_draft', data: { targetUserId: targetUserId, reportKey: key, draftContent: content, status: currentStatus } })
    });
    if (!silent) alert("저장되었습니다.");
}

async function completeProWriting(key) {
    const e1 = document.getElementById(`${key}_item1`)?.value || ""; const e2 = document.getElementById(`${key}_item2`)?.value || "";
    const e3 = document.getElementById(`${key}_item3`)?.value || ""; const e4 = document.getElementById(`${key}_item4`)?.value || "";

    if([e1,e2,e3,e4].some(v => v.replace(/\s/g, '').length < 200)) {
        return alert("PRO 리포트의 1~4번 모든 항목은 각각 최소 200자 이상 작성해야 제출할 수 있습니다. (공백 제외)");
    }
    try { await saveProDraft(key, true); } catch (e) { if (e.message !== "Auth expired") alert("내용 저장 실패로 중단합니다."); return; }
    if(!confirm("작성을 완료하고 관리자에게 제출하시겠습니까?")) return;

    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'complete_pro_writing', data: { targetUserId: targetUserId, reportKey: key } })
        });
        alert("제출 완료되었습니다. 관리자 검수 단계로 넘어갑니다.");
        await loadProReportsForAdmin();
    } catch(e) { if (e.message !== "Auth expired") alert("제출 중 오류가 발생했습니다."); }
}

// -----------------------------------------------------------
// PRO 리포트 UI 렌더링
// -----------------------------------------------------------
function renderProTab() {
    const container = document.getElementById('proReportContainer');
    container.innerHTML = '';

    const userRole = localStorage.getItem('userRole');
    const reports = currentStudentData.proReportsList || [];

    const selYear = document.getElementById('proFilterYear')?.value;
    const selMonth = document.getElementById('proFilterMonth')?.value;

    if (reports.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px; color:#94a3b8; background:#f8fafc; border-radius:8px;">학생이 아직 작성한 PRO 리포트 요청서가 없습니다.</div>`;
        return;
    }

    // 필터 로직: reportKey (예: 260401 또는 2024-W10) 기준으로 필터링
    const filtered = reports.filter(r => {
        const keyMatch = r.key?.match(/^(\d{2})(\d{2})\d{2}$/); // 신규 포맷 260401
        const oldMatch = r.key?.match(/^(\d{4})-W(\d{1,2})$/); // 구 포맷 2024-W10
        let y = null, m = null;

        if (keyMatch) {
            y = "20" + keyMatch[1]; // '26' -> '2026'
            m = parseInt(keyMatch[2], 10).toString(); // '04' -> '4'
        } else if (oldMatch) {
            y = oldMatch[1];
            const d = r.updatedAt ? new Date(r.updatedAt) : new Date();
            m = (d.getMonth() + 1).toString();
        }

        const yearMatch = !selYear || y === selYear;
        const monthMatch = !selMonth || m === selMonth;

        return yearMatch && monthMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:40px; color:#cbd5e1;">해당 월의 PRO 리포트가 없습니다.</div>';
        return;
    }

    // 최신순 정렬
    filtered.sort((a, b) => b.key.localeCompare(a.key));

    filtered.forEach(reportData => {
        const displayTitle = formatReportKey(reportData.key, true);
        container.appendChild(createProPeriodBox(displayTitle, reportData, reportData.key, userRole));
    });
}

function createProPeriodBox(title, data, reportKey, userRole) {
    const box = document.createElement('div');
    box.className = 'pro-period-section';
    box.id = reportKey;

    const isTutor = (userRole === 'tutor');
    const isAdmin = (userRole === 'admin');

    const safeData = data || {};
    const requestText = safeData.request ? escapeHtml(safeData.request) : null;
    const status = safeData.status || 'pending';
    const reportLink = safeData.reportLink || null;

    let canEdit = false;
    if (isTutor && (status === 'pending' || status === 'drafting')) canEdit = true;
    else if (isAdmin && (status === 'completed' || status === 'admin_review')) canEdit = true;

    const readOnlyAttr = canEdit ? '' : 'disabled';
    const saveBtnStyle = canEdit ? '' : 'style="display:none"';

    const reqHtml = requestText ? `<div class="req-content-area">${requestText}</div>` : `<div class="req-content-area req-empty">(학생이 작성한 추가 요청사항이 없습니다.)</div>`;

    let content = { eval: '', dist: '', plan: '', qna: '' };
    if (safeData.draft) {
        try { content = JSON.parse(safeData.draft); } catch(e) { console.error("JSON Parse Error:", e); }
    }

    const writeHtml = `
        <div class="write-header">
            <div class="write-title"><i class="fas fa-pen-nib"></i> 컨설턴트 집필 공간</div>
            <button class="guide-btn" onclick="showProGuideModal()"><i class="fas fa-info-circle"></i> 작성 가이드</button>
        </div>
        <div class="pro-write-grid">
            ${createTextAreaHtml(reportKey, 1, "1. 지난 기간의 학습평가 (리스크/KPI)", content.eval, readOnlyAttr, saveBtnStyle)}
            ${createTextAreaHtml(reportKey, 2, "2. 목표대학과의 거리 (ΔCut/기여도)", content.dist, readOnlyAttr, saveBtnStyle)}
            ${createTextAreaHtml(reportKey, 3, "3. 중기 핵심 과제 Top2 & 장기 플랜", content.plan, readOnlyAttr, saveBtnStyle)}
            ${createTextAreaHtml(reportKey, 4, "4. 학생 요청 답변 (근거 포함)", content.qna, readOnlyAttr, saveBtnStyle)}
        </div>
    `;

    let actionHtml = getActionHtml(status, isTutor, isAdmin, reportLink, reportKey, hasContent(content), safeData.rejectReason);

    box.innerHTML = `
        <div class="pro-period-title">
            <span>${title}</span>
            <span style="font-size:0.85rem; color:#64748b; font-weight:normal;">
                ${safeData.updatedAt ? '(최근 저장: ' + new Date(safeData.updatedAt).toLocaleString() + ')' : ''}
            </span>
        </div>
        <div class="student-req-card">
            <div class="req-header"><i class="fas fa-comment-dots" style="color:#f59e0b;"></i><h4 class="req-title">학생 요청사항</h4></div>
            ${reqHtml}
        </div>
        ${writeHtml}
        ${actionHtml}
    `;

    if (canEdit) attachInputListeners(reportKey, isTutor);

    return box;
}

function createTextAreaHtml(key, idx, label, val, readOnly, btnStyle) {
    const minLen = 200; const len = val ? val.replace(/\s/g, '').length : 0; const validClass = len >= minLen ? 'valid' : '';
    return `
        <div class="write-item">
            <label class="write-label">${label}</label>
            <textarea id="${key}_item${idx}" class="write-textarea" ${readOnly} placeholder="최소 ${minLen}자 이상 상세히 입력해주세요." oninput="updateCharCount(this, '${key}_count${idx}', ${minLen})">${val}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                <div id="${key}_count${idx}" class="char-count ${validClass}">${len} / 최소 ${minLen}자</div>
                <button id="${key}_btn${idx}" class="temp-save-btn" onclick="tempSaveProItem('${key}', ${idx})" ${btnStyle}>임시저장</button>
            </div>
        </div>`;
}

function getActionHtml(status, isTutor, isAdmin, reportLink, key, hasContent, rejectReason = '') {
    if (status === 'published' || status === 'sent') {
        return `
            <div class="action-bar">
                <span style="color:#2563eb; font-weight:bold;"><i class="fas fa-check-circle"></i> 학생에게 리포트 전송 완료</span>
                ${reportLink ? `<a href="${reportLink}" target="_blank" style="margin-left:10px; text-decoration:underline; color:#2563eb; font-weight:bold;"><i class="fas fa-file-pdf"></i> 첨부된 PDF 확인</a>` : ''}
                ${isAdmin ? `<button class="edit-report-btn show" onclick="enableProEdit('${key}')" style="margin-left:auto;">수정하기(관리자)</button>` : ''}
            </div>`;
    }

    if (status === 'tutor_review') {
        if (isTutor) {
            return `
                <div class="action-bar" style="flex-direction: column; align-items: stretch; gap: 15px; background: #eff6ff; padding: 20px; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:#1e3a8a; font-weight:bold; font-size:1.05rem;"><i class="fas fa-search"></i> 관리자가 PDF 첨부를 완료했습니다. 최종 검수를 진행해주세요.</span>
                        ${reportLink ? `<a href="${reportLink}" target="_blank" style="background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #bfdbfe; text-decoration:none; color:#2563eb; font-weight:bold;"><i class="fas fa-file-pdf"></i> 첨부된 PDF 확인하기</a>` : ''}
                    </div>
                    <div style="display:flex; gap: 10px; justify-content: flex-end; margin-top:10px;">
                        <button class="edit-report-btn show" style="border-color:#ef4444; color:#ef4444;" onclick="requestAdminRereview('${key}')"><i class="fas fa-undo"></i> 관리자에게 재검토 요청</button>
                        <button class="admin-report-btn completed" style="background:#166534;" onclick="publishProReportToStudent('${key}')"><i class="fas fa-paper-plane"></i> 이상 없음 (학생에게 최종 전송)</button>
                    </div>
                </div>`;
        } else {
            return `<div class="action-bar"><span style="color:#f59e0b; font-weight:bold;"><i class="fas fa-clock"></i> 튜터가 리포트 내용과 PDF를 최종 검수 중입니다...</span></div>`;
        }
    }

    if (status === 'completed' || status === 'admin_review') {
        if (isAdmin) {
            const rejectHtml = rejectReason ? `<div style="background:#fef2f2; color:#b91c1c; padding:10px; border-radius:6px; margin-bottom:15px; font-weight:bold; font-size: 0.95rem;">🚨 [튜터 재검토 요청 사유]<br><span style="font-weight:normal;">${escapeHtml(rejectReason)}</span></div>` : '';
            const existingPdfHtml = reportLink ? `<div style="margin-bottom: 10px; font-size: 0.9rem; color: #475569;">현재 첨부된 파일: <a href="${reportLink}" target="_blank" style="color:#2563eb; text-decoration:underline;">기존 PDF 확인</a></div>` : '';

            return `
                <div class="action-bar" style="flex-direction: column; align-items: stretch; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px;">
                    ${rejectHtml}
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        <span style="color:#166534; font-weight:bold;"><i class="fas fa-check"></i> 튜터 제출 완료 (수정 및 PDF를 첨부해주세요)</span>
                        <button class="temp-save-btn" onclick="saveProDraft('${key}')">텍스트 변경사항 저장</button>
                    </div>
                    ${existingPdfHtml}
                    <div style="display:flex; gap: 10px; align-items: center; justify-content: flex-end; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                        <input type="file" id="pdfFile_${key}" accept=".pdf" style="font-size:0.9rem; padding: 5px;">
                        <button id="pdf_upload_btn_${key}" class="admin-report-btn" onclick="requestTutorReview('${key}')"><i class="fas fa-upload"></i> PDF 업로드 및 튜터에게 검수 요청</button>
                    </div>
                </div>`;
        } else {
            return `<div class="action-bar"><span style="color:#64748b; font-weight:bold;"><i class="fas fa-hourglass-half"></i> 관리자 확인 및 PDF 첨부 작업 중...</span></div>`;
        }
    }

    if (isTutor) {
        const btnClass = hasContent ? 'complete-write-btn active' : 'complete-write-btn';
        return `<div class="action-bar" style="justify-content: flex-end;"><button id="${key}_completeBtn" class="${btnClass}" onclick="completeProWriting('${key}')">작성 완료 (관리자에게 제출)</button></div>`;
    } else {
        return `<div class="action-bar"><span style="color:#94a3b8; font-weight:bold;"><i class="fas fa-pen"></i> 튜터 작성 중...</span></div>`;
    }
}

function requestAdminRereview(key) {
    const existingModal = document.getElementById('rejectReasonModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="rejectReasonModal" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 500px; padding: 25px;">
                <span class="close-btn" onclick="closeRejectModal()">&times;</span>
                <h2 style="margin-top: 0; color: #1e293b; font-size: 1.4rem; display: flex; align-items: center; gap: 8px;"><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i> 재검토 요청</h2>
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 0.9rem; color: #991b1b; line-height: 1.5;">관리자에게 수정이나 재검토를 요청할 내용을 상세히 적어주세요.<br>(이 내용은 관리자 페이지에 빨간색 경고로 표시됩니다)</p>
                </div>
                <textarea id="rejectReasonText" rows="5" style="width: 100%; padding: 15px; border: 1px solid #cbd5e1; border-radius: 8px; resize: none; font-family: inherit; font-size: 0.95rem; margin-bottom: 20px; box-sizing: border-box;" placeholder="예) 3페이지 오타 수정 부탁드립니다."></textarea>
                <div style="display: flex; gap: 10px;">
                    <button onclick="closeRejectModal()" style="padding: 12px 0; background: white; border: 1px solid #cbd5e1; color: #475569; border-radius: 8px; cursor: pointer; font-weight: bold; flex: 1;">취소</button>
                    <button onclick="submitRejectReason('${key}')" style="padding: 12px 0; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; flex: 2;">요청 보내기</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeRejectModal() { const modal = document.getElementById('rejectReasonModal'); if (modal) modal.remove(); }
function hasContent(c) { return c.eval && c.dist && c.plan && c.qna; }

function attachInputListeners(key, isTutor) {
    setTimeout(() => {
        const container = document.getElementById(key);
        if (!container) return;
        for (let i = 1; i <= 4; i++) {
            const area = document.getElementById(`${key}_item${i}`);
            const btn = document.getElementById(`${key}_btn${i}`);
            if (area && btn) {
                area.addEventListener('input', () => {
                    if (btn.classList.contains('saved')) {
                        btn.classList.remove('saved'); btn.innerText = '임시 저장';
                        if (isTutor) { const completeBtn = document.getElementById(`${key}_completeBtn`); if (completeBtn) completeBtn.classList.remove('active'); }
                    }
                });
            }
        }
    }, 0);
}

async function tempSaveProItem(boxId, itemIdx) {
    const btn = document.getElementById(`${boxId}_btn${itemIdx}`);
    const originalText = btn.innerText;
    btn.innerText = "저장 중..."; btn.disabled = true;

    try {
        await saveProDraft(boxId, true);
        btn.classList.add('saved'); btn.innerText = '저장됨'; btn.disabled = false;
        checkProAllSaved(boxId);
    } catch (e) {
        if (e.message !== "Auth expired") alert("임시 저장에 실패했습니다.");
        btn.innerText = originalText; btn.disabled = false;
    }
}

function enableProEdit(key) {
    if(!confirm("이미 전송된 보고서입니다. 내용을 수정하시겠습니까?")) return;
    const container = document.getElementById(key);
    container.querySelectorAll('textarea').forEach(t => t.disabled = false);
    container.querySelectorAll('.temp-save-btn').forEach(b => b.style.display = 'inline-block');
    alert("수정 모드입니다. 수정 후 각 항목의 '임시저장' 버튼을 눌러서 덮어씌워주세요.");
}

function checkProAllSaved(boxId) {
    const container = document.getElementById(boxId);
    const btns = container.querySelectorAll('.temp-save-btn');
    const allSaved = Array.from(btns).every(b => b.classList.contains('saved'));
    const completeBtn = document.getElementById(`${boxId}_completeBtn`);
    if (completeBtn) { if (allSaved) completeBtn.classList.add('active'); else completeBtn.classList.remove('active'); }
}

function showProGuideModal() {
    const existingModal = document.getElementById('proGuideModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="proGuideModal" class="coaching-modal-overlay">
            <div class="coaching-modal-content">
                <div class="coaching-modal-header">
                    <span>🏆 Pro 코칭 운영 가이드 (필수)</span>
                    <button class="coaching-modal-close" onclick="document.getElementById('proGuideModal').remove()">&times;</button>
                </div>
                <div class="coaching-modal-body">
                    <h4>1) Pro의 역할</h4>
                    <p>목표 대학 기준으로 '최소 학습·최대 상승(효율)' 관점에서 합격 가능성을 높이는 방향과 속력을 교정합니다. (모든 근거는 반드시 지표로 제시해야 합니다.)</p>

                    <h4>2) 선생님께서 추가로 반드시 확인하셔야 할 데이터 (근거 판단)</h4>
                    <ul>
                        <li><strong>목표 대학 컷까지의 거리</strong> (컷거리 ΔCut)</li>
                        <li><strong>과목별 컷거리 기여도</strong> (어느 과목의 효율이 가장 큰지 판단)</li>
                        <li><strong>리스크 과목</strong> (무너질 때 전체 등급이 흔들리는 핵심 과목)</li>
                        <li><strong>효율 KPI</strong> (유효 학습 비중 / 인강→적용 전환율 / 오답 회수율 / 실전 연동성)</li>
                    </ul>

                    <h4>3) 반드시 작성하셔야 하는 4개 항목 (지표 근거 인용 필수)</h4>
                    <ul>
                        <li><strong>지난 기간의 학습 평가:</strong> 리스크 및 효율 KPI를 기반으로 학생의 장단점을 명확히 평가합니다.</li>
                        <li><strong>목표 대학과의 거리 (ΔCut/기여도):</strong> ΔCut 및 과목별 기여도 데이터를 기반으로 개선 여부를 구체적으로 분석합니다.</li>
                        <li><strong>중기 핵심 과제 Top 2 & 장기 플랜:</strong> 중기 과제 제시 시 ΔCut, 기여도, 리스크, KPI 중 최소 1개 이상을 인용해야 합니다. 장기 플랜은 추세 그래프 등을 활용하여 주요 마일스톤(평가원 모의고사 일정 등)에 맞춘 예상치를 제시합니다.</li>
                        <li><strong>학생 요청 사항 답변:</strong> 반드시 수치적일 필요는 없으나, 구체적이고 논리적인 근거를 들어 답변을 제공합니다.</li>
                    </ul>

                    <h4>4) Pro 코칭 원칙 (가드레일)</h4>
                    <ul>
                        <li>코칭 내용에는 <strong>반드시 지표 근거가 포함</strong>되어야 합니다.</li>
                        <li>핵심 과제 제시 시 구체적인 행동 유형(인강 / 문풀 / 오답 / 복습 / 실전)을 <strong>명확히 명시</strong>합니다.</li>
                        <li>막연한 합격 예측이나 보장 표현(합격률 단정, 무조건 합격 등)은 <strong>절대 금지</strong>합니다.</li>
                    </ul>

                    <h4>5) 리포트 제출 기한 및 유의사항 🚨</h4>
                    <ul>
                        <li>학생에게 Pro 리포트가 최종 제공되는 기한은 학생 제출 마감일의 3일 뒤인 <strong>수요일</strong>입니다.</li>
                        <li>선생님께서 작성해주신 리포트는 <strong>관리자 측의 최종 검수(재확인) 작업</strong>을 거친 후 발송됩니다.</li>
                        <li>따라서 원활한 검수 및 적시적인 발송을 위해 가급적 <strong>수요일 16:00 이전까지 작성을 완료하여 제출</strong>해 주시기 바랍니다.</li>
                    </ul>
                </div>
                <div style="text-align:right; margin-top:20px;">
                    <button class="fb-save-btn" style="background:#475569;" onclick="document.getElementById('proGuideModal').remove()">확인했습니다</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showCoachingGuideModal() {
    const existingModal = document.getElementById('coachingGuideModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="coachingGuideModal" class="coaching-modal-overlay">
            <div class="coaching-modal-content">
                <div class="coaching-modal-header">
                    <span>📋 Standard 코칭 운영 (필수)</span>
                    <button class="coaching-modal-close" onclick="document.getElementById('coachingGuideModal').remove()">&times;</button>
                </div>
                <div class="coaching-modal-body">
                    <h4>1) Standard의 역할</h4>
                    <p>보편적인 SKY 합격생 루틴을 '기준점'으로 제시하고, 취약 과목이 무너지기 전에 보완하며, 학생의 방향과 속력을 주 1회 조정합니다.</p>

                    <h4>2) 선생님께서 반드시 확인하셔야 할 데이터</h4>
                    <ul>
                        <li><strong>과목별 달성률</strong> (계획 시간 vs 실제 시간)</li>
                        <li><strong>플래너 인증</strong> (사진)</li>
                        <li><strong>실전 모의고사</strong> 응시 여부</li>
                        <li><strong>성적표 인증</strong> (필수)</li>
                        <li><strong>최근 2주 학업 추이</strong> (상승/유지/하락)</li>
                        <li><strong>학생 심층 코칭 입력</strong> (계획 점검 / 방향 고민 / 취약 과목 / 멘탈)</li>
                    </ul>

                    <h4>3) 선생님께서 반드시 작성하셔야 하는 5개 항목 (주 1회)</h4>
                    <ul>
                        <li><strong>이번 주 판단</strong> (우선순위 결론, 첫 상담하는 학생이면 선생님의 객관적 판단 우선)</li>
                        <li><strong>취약 과목 개입 포인트</strong></li>
                        <li><strong>다음 주 핵심 과제 Top 3와 그 개별적인 근거</strong></li>
                        <li><strong>플랜 조정</strong> (방향 / 속력)</li>
                        <li><strong>심층 질문에 대한 추가 답변</strong> (어떤 질문에 대한 답변인지를 명시하고, 앞 항목 내용과 중복된다면 그렇다는 사실을 명시)</li>
                    </ul>

                    <h4>4) Standard 코칭 원칙 (최소 기준)</h4>
                    <ul>
                        <li>시간표형(분 단위) 강요를 금지하고, <strong>과제 중심</strong>으로 제시합니다.</li>
                        <li><strong>취약 과목을 우선</strong>시합니다. (전 과목 균등 배분 금지)</li>
                        <li><strong>실패를 전제</strong>합니다. (지키지 못한 계획을 죄책감으로 몰지 않습니다.)</li>
                        <li><strong>의지 탓을 금지</strong>하고, 항상 판단 기준으로 설명합니다.</li>
                    </ul>

                    <h4>5) 리포트 제출 기한 및 유의사항 🚨</h4>
                    <ul>
                        <li>학생들의 주간 점검 제출은 <strong>매주 일요일 20:00</strong>에 마감됩니다.</li>
                        <li>작성해주신 피드백 리포트는 그 다음 날인 <strong>월요일 16:00</strong>에 학생들에게 일괄 제공됩니다.</li>
                        <li>따라서 학생 제출 직후 급하게 작성하시기보다는, <strong>월요일 16:00 이전까지 시간적 여유를 가지고 꼼꼼하게 작성</strong>해 주시기를 부탁드립니다.</li>
                    </ul>
                </div>
                <div style="text-align:right; margin-top:20px;">
                    <button class="fb-save-btn" style="background:#475569;" onclick="document.getElementById('coachingGuideModal').remove()">확인했습니다</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeModal() { document.getElementById('detailModal').style.display = 'none'; }
function showModal(title, contentHtml) {
    const modal = document.getElementById('detailModal');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalContent').innerHTML = contentHtml;
    modal.style.display = 'flex';
}

window.updateCharCount = function(textarea, countId, minLength) {
    const countEl = document.getElementById(countId);
    if(!countEl) return;
    const len = textarea.value.replace(/\s/g, '').length;
    countEl.innerText = `${len} / 최소 ${minLength}자`;
    if (len >= minLength) countEl.classList.add('valid'); else countEl.classList.remove('valid');
};

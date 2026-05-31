// js/analysis/coaching.js
// [코칭 & 주간 학습 점검] — js/analysis.js 에서 분리(2026-06-01).
//
// 책임:
//   - 주간 리포트 렌더링/탭 — checkWeeklyStatus, switchWeeklyTab, renderFeedbackList, setWeeklyLoadingStatus
//   - 피드백 모달 — openFeedbackModal, openFeedbackModalV2
//   - 주간 점검 입력 wizard — openWeeklyCheckModal, closeWeeklyModal, nextMobileStep, prevMobileStep, addSubjectCard 등
//   - 플래너 파일 첨부/PDF 다운로드 — handlePlannerFiles, renderPlannerFiles, removePlannerFile, downloadReportPDF, renderPdfToImages
//   - 주차 계산 헬퍼 — getWeekOfMonth, getWeekTitle, generateWeekId
//   - 등급 락 — applyCoachTierLock
//
// 외부 의존(analysis.js 글로벌):
//   - 상태: currentUserTier, weeklyDataHistory, currentPlannerFiles, originalPlannerFiles, currentTutorName, currentExamMode
//   - 헬퍼: escapeHtml, getStandardLockOverlayHTML, fetchWeeklyHistory, applySimTierLock 등
//   - 상수/API: REPORT_API_URL, FILE_API_URL, PDF_API_URL (shared/api.js), apiFetch
//
// HTML 동적 onclick 참조 (분리 후에도 글로벌 유지 필수):
//   - downloadReportPDF, removePlannerFile
// HTML 정적 onclick (analysis.html):
//   - addSubjectCard, openWeeklyCheckModal, closeWeeklyModal, submitWeeklyCheck, switchWeeklyTab, nextMobileStep, prevMobileStep

// ============================================================
// [기능 4] 코칭 & 주간 학습 점검
// ============================================================
function getWeekOfMonth(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const day = start.getDay() || 7; 
    const diff = date.getDate() - 1 + (day - 1); 
    return Math.floor(diff / 7) + 1;
}

function getWeekTitle(date) {
    const yearShort = date.getFullYear().toString().slice(2);
    const month = date.getMonth() + 1;
    const week = getWeekOfMonth(date);
    return `${yearShort}년 ${month}월 ${week}주차`;
}

// 백엔드 generateWeekId()와 동일한 로직 — DB weekId 일관성 유지
function generateWeekId(dateObj) {
    const year = dateObj.getFullYear().toString().slice(2);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const dayOfWeek = startOfMonth.getDay();
    const offsetDate = dateObj.getDate() + dayOfWeek - 1;
    const weekNum = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0');
    return `${year}${month}${weekNum}`;
}

function applyCoachTierLock() {
    const container = document.querySelector('.coach-container');
    if (!container) return;

    if (['free', 'basic', 'trial'].includes(currentUserTier)) {
        container.classList.add('tier-locked');
        container.style.position = 'relative';
        container.style.minHeight = '400px'; // 💡 높이 강제 고정으로 모달 위치 통일
        if (container.querySelector('.coach-tier-lock-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'coach-tier-lock-overlay';
        overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(200, 217, 255, 0.82); backdrop-filter: blur(6px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 50; border-radius: 12px;";
        overlay.innerHTML = getStandardLockOverlayHTML('주간 학습 점검 및 피드백');
        container.appendChild(overlay);
    } else {
        container.classList.remove('tier-locked');
        container.style.minHeight = 'auto'; // 권한 있을 시 원상복구
        const existingOverlay = container.querySelector('.coach-tier-lock-overlay');
        if (existingOverlay) existingOverlay.remove();
    }
}

function switchWeeklyTab(step) {
    // BASIC/STARTER는 Step 2(심층코칭) 접근 불가
    if (step === 'step2' && (currentUserTier === 'basic' || currentUserTier === 'starter')) {
        alert("심층코칭은 STANDARD 이상 플랜에서 이용할 수 있습니다.");
        return;
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if(step === 'step1') document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
    else document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${step}`).classList.add('active');
}

function setWeeklyLoadingStatus(isLoading) {
    const msg = document.getElementById('weeklyDeadlineMsg');
    const badge = document.getElementById('weeklyStatusBadge');
    if (!msg || !badge) return;
    
    if (isLoading) {
        badge.innerText = '...'; badge.className = 'badge-status pending'; 
        msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 로딩중...';
    } else {
        msg.innerText = '(매주 일요일 20:00 마감)';
        renderFeedbackList(); 
    }
}

// 💡 [수정] 분리된 weeklyDataHistory(배열)를 직접 순회
function checkWeeklyStatus() {
    const today = new Date();
    const currentWeekTitle = getWeekTitle(today); 
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    
    const thisWeekData = history.find(w => { 
        if(!w.title) return false; 
        return w.title.replace(/\s+/g, '').includes(currentWeekTitle.replace(/\s+/g, '')); 
    });
    
    const badge = document.getElementById('weeklyStatusBadge');
    const box = document.getElementById('weeklyBox');
    if (!badge || !box) return;
    
    if (thisWeekData) { badge.className = 'badge-status submitted'; badge.innerText = '✅ 제출완료'; } 
    else { badge.className = 'badge-status pending'; badge.innerText = '미제출'; }
    
    const day = today.getDay(); const hour = today.getHours();
    if (day === 0 && hour >= 20) { 
        badge.className = 'badge-status locked'; badge.innerText = '⛔ 마감됨'; 
        box.classList.add('disabled'); box.onclick = null; 
    } else { 
        box.classList.remove('disabled'); box.onclick = openWeeklyCheckModal; 
    }
}

function renderFeedbackList() {
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    const listContainer = document.getElementById('feedbackList');
    const select = document.getElementById('feedbackYearMonth');
    if(!listContainer || !select) return;

    const yearMonths = new Set();
    history.forEach(h => {
        const match = h.title && h.title.match(/(\d{2,4}년\s\d{1,2}월)/);
        if(match) yearMonths.add(match[1]);
    });

    const today = new Date();
    const currentYM = `${String(today.getFullYear()).slice(2)}년 ${today.getMonth()+1}월`;
    if(yearMonths.size === 0) yearMonths.add(currentYM);
    
    const prevValue = select.value;
    select.innerHTML = '';
    Array.from(yearMonths).sort().reverse().forEach(ym => {
        const option = document.createElement('option'); option.value = ym; option.innerText = ym; select.appendChild(option);
    });
    if (prevValue && yearMonths.has(prevValue)) select.value = prevValue; else select.selectedIndex = 0;
    const selectedYM = select.value;

    listContainer.innerHTML = '';
    const filtered = history.filter(h => h.title && h.title.includes(selectedYM)).sort((a,b) => new Date(b.date) - new Date(a.date));

    if(filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-feedback">제출된 기록이 없습니다.</div>';
        return;
    }

    const fragment = document.createDocumentFragment(); 
    filtered.forEach(h => {
        const fb = h.tutorFeedback || {};
        const isSubmitted = fb && fb.submitted === true;
        const hasFeedback = isSubmitted && (
            (fb.priorityCheck && String(fb.priorityCheck).trim() !== "") ||
            (fb.weakSubject && String(fb.weakSubject).trim() !== "") ||
            (fb.nextWeekTop3 && String(fb.nextWeekTop3).trim() !== "") ||
            (fb.planEvaluation && String(fb.planEvaluation).trim() !== "") ||
            (fb.extraQuestion && String(fb.extraQuestion).trim() !== "") ||
            (fb.planReason && String(fb.planReason).trim() !== "") ||
            (fb.questionAnswer && String(fb.questionAnswer).trim() !== "") ||
            (fb.weeklyPlanner && String(fb.weeklyPlanner).trim() !== "") ||
            (fb.tutorComment && String(fb.tutorComment).trim() !== "") ||
            (fb.tutorImage && String(fb.tutorImage).trim() !== "")
        );

        const div = document.createElement('div'); 
        div.className = 'feedback-tile';
        div.onclick = () => { openFeedbackModal(h); };

        const titleDiv = document.createElement('div');
        titleDiv.className = 'fb-title';
        titleDiv.textContent = h.title || "주간 리포트"; // 🔒 안전

        const statusDiv = document.createElement('div');
        statusDiv.className = 'fb-status';
        statusDiv.style.cssText = hasFeedback ? 'color:#15803d; font-weight:bold;' : 'color:#94a3b8;';
        statusDiv.textContent = hasFeedback ? '피드백 도착 ✅' : '피드백 대기중 ⏳'; // 🔒 안전

        div.appendChild(titleDiv);
        div.appendChild(statusDiv);
        fragment.appendChild(div);
    });
    listContainer.appendChild(fragment);
}

function openFeedbackModal(data) {
    const modal = document.getElementById('feedbackModal');
    const contentArea = document.querySelector('#feedbackModal .modal-body') || document.getElementById('modalContent');
    if (!contentArea) return;

    // formVersion 분기: v2이면 새 렌더링
    if ((data.formVersion || 1) >= 2) { openFeedbackModalV2(data, modal, contentArea); return; }

    const fb = data.tutorFeedback || {};
    const isSubmitted = fb && fb.submitted === true;
    const hasFeedback = isSubmitted && (
        (fb.priorityCheck && String(fb.priorityCheck).trim() !== "") ||
        (fb.weakSubject && String(fb.weakSubject).trim() !== "") ||
        (fb.nextWeekTop3 && String(fb.nextWeekTop3).trim() !== "") ||
        (fb.planEvaluation && String(fb.planEvaluation).trim() !== "") ||
        (fb.extraQuestion && String(fb.extraQuestion).trim() !== "") ||
        (fb.tutorImage && String(fb.tutorImage).trim() !== "")
    );

    if (!hasFeedback) {
        contentArea.innerHTML = `
            <div class="pending-view" style="background:#fff; padding:100px 20px; border-radius:16px;">
                <div class="pending-icon" style="font-size:4rem; color:#cbd5e1; margin-bottom:20px;"><i class="fas fa-hourglass-half"></i></div>
                <h2 style="color:#1e293b; margin-bottom:10px; font-weight:800;">피드백 작성 대기중</h2>
                <p style="color:#64748b; margin-bottom:30px;">담당 컨설턴트가 학생의 리포트를 꼼꼼히 분석하고 있습니다.</p>
                <button onclick="document.getElementById('feedbackModal').style.display='none'" style="padding:12px 30px; background:#f1f5f9; border:none; border-radius:8px; font-weight:bold; color:#475569; cursor:pointer;">닫기</button>
            </div>`;
        modal.style.display = 'block';
        return;
    }

    const consultantName = escapeHtml(data.tutorName || currentTutorName);
    let detailRows = ''; let totalPlan = '0H', totalAct = '0H', totalRate = '0%';
    
    if (data.studyTime) {
        totalPlan = data.studyTime.totalPlan || '0H'; totalAct = data.studyTime.totalAct || '0H'; totalRate = data.studyTime.totalRate || '0%';
        if (data.studyTime.details && data.studyTime.details.length > 0) {
            data.studyTime.details.forEach(d => {
                const plan = parseFloat(d.plan) || 0; const act = parseFloat(d.act) || 0;
                const rate = plan > 0 ? Math.min((act / plan) * 100, 100).toFixed(0) : 0;
                const rateColor = rate >= 80 ? '#10b981' : (rate >= 50 ? '#f59e0b' : '#ef4444');
                
                let mainSub = d.subject; let detailSub = "-";
                const match = d.subject.match(/^(.*?)\s*\((.*?)\)$/);
                if(match) { mainSub = match[1]; detailSub = match[2]; }
                
                detailRows += `<tr><td style="text-align:left; font-weight:700; color:#334155;">${escapeHtml(mainSub)}</td><td style="color:#64748b; font-size:0.85rem; font-weight:600;">${escapeHtml(detailSub)}</td><td>${plan}H</td><td style="color:#2563eb; font-weight:bold;">${act}H</td><td style="color:${rateColor}; font-weight:800;">${rate}%</td></tr>`;
            });
        }
    }
    if (!detailRows) detailRows = `<tr><td colspan="5" style="color:#94a3b8; padding:20px;">상세 학습 기록이 없습니다.</td></tr>`;
	
	const CODE_MAP = { 'un': '언매', 'hj': '화작', 'mi': '미적', 'ki': '기하', 'hw': '확통' };
    const getOptName = (code) => CODE_MAP[code] || code || '-';
    
    let examHtml = '';
    if (data.mockExam && data.mockExam.type && data.mockExam.type !== 'none') {
        const typeMap = { 'school': '교내', 'edu': '평가원/교육청', 'private': '사설' };
        const typeName = typeMap[data.mockExam.type] || '기타';
        let scoreDetails = ''; const s = data.mockExam.scores || {};
        const rowStyle = "margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;";
        if(s.kor) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">국어 (${escapeHtml(getOptName(s.korOpt))})</span> <strong style="color:#1e293b;">${escapeHtml(s.kor)}</strong></div>`;
        if(s.math) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">수학 (${escapeHtml(getOptName(s.mathOpt))})</span> <strong style="color:#1e293b;">${escapeHtml(s.math)}</strong></div>`;
        if(s.eng) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">영어</span> <strong style="color:#1e293b;">${escapeHtml(s.eng)}</strong></div>`;
        if(s.inq1) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">${escapeHtml(s.inq1Name||'탐구1')}</span> <strong style="color:#1e293b;">${escapeHtml(s.inq1)}</strong></div>`;
        if(s.inq2) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">${escapeHtml(s.inq2Name||'탐구2')}</span> <strong style="color:#1e293b;">${escapeHtml(s.inq2)}</strong></div>`;
        examHtml = `<div style="font-weight:800; font-size:1.1rem; color:#1e293b; margin-bottom:15px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">${typeName} 모의고사</div><div style="text-align:left; padding:0 10px;">${scoreDetails || '<div style="color:#94a3b8; text-align:center;">상세 점수 미입력</div>'}</div>`;
    } else {
        examHtml = `<div style="color:#94a3b8; padding:30px 0; font-weight:600;"><i class="fas fa-ban" style="margin-bottom:10px; font-size:1.5rem;"></i><br>이번 주 응시 기록 없음</div>`;
    }

    let trendHtml = '-', trendReasonsHtml = '';
    if (data.trend) {
        const t = data.trend.status;
        if(t === 'up') trendHtml = '<span style="color:#10b981; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-arrow-trend-up"></i> 상승세</span>';
        else if(t === 'down') trendHtml = '<span style="color:#ef4444; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-arrow-trend-down"></i> 하락세</span>';
        else trendHtml = '<span style="color:#64748b; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-minus"></i> 유지중</span>';
        
        if (data.trend.reasons && data.trend.reasons.length > 0) trendReasonsHtml = `<strong>하락 요인:</strong> ${data.trend.reasons.map(r => escapeHtml(r)).join(', ')}`;
        else trendReasonsHtml = '학생이 체크한 특이사항이 없습니다.';
    }

    let deepQnaHtml = '';
    const QUESTION_CATEGORIES = ['학습 계획 점검', '학습 방향성 설정', '취약 과목 솔루션', '기타 멘탈 관리'];
    if (data.deepAnswers && data.deepAnswers.some(ans => ans && ans.trim() !== "")) {
        data.deepAnswers.forEach((ans, idx) => {
            if (ans && ans.trim() !== "") {
                deepQnaHtml += `<div style="margin-bottom:15px; page-break-inside: avoid;"><strong style="color:#b91c1c; font-size:0.9rem; display:block; margin-bottom:4px;">Q${idx+1}. ${QUESTION_CATEGORIES[idx]}</strong><div style="color:#334155; font-size:0.95rem; padding-left:10px; border-left:3px solid #fecaca;">${escapeHtml(ans)}</div></div>`;
            }
        });
    } else {
        deepQnaHtml = '<div style="color:#94a3b8; padding:10px 0;">작성된 심층 질문이 없습니다.</div>';
    }
    
    let tutorFileBlockHtml = '';
    const uniqueContainerId = `pdf-render-${Date.now()}`; 
    let isPdfFile = false; let actualPdfUrl = "";

    if (fb.tutorImage && String(fb.tutorImage).trim() !== "") {
        isPdfFile = fb.tutorImage.toLowerCase().includes('.pdf');
        actualPdfUrl = fb.tutorImage;
        let fileDisplayHtml = '';
        
        if (isPdfFile) {
            fileDisplayHtml = `<div id="${uniqueContainerId}" style="width: 100%; display: block; text-align: center;"><div style="padding: 40px 0; color:#3b82f6; font-weight:bold;" class="pdf-loading-spinner"><i class="fas fa-spinner fa-spin fa-2x" style="margin-bottom:10px;"></i><br>튜터의 첨삭 PDF 문서를 불러오는 중입니다...</div></div>`;
        } else {
            const noCacheUrl = `${escapeHtml(fb.tutorImage)}?t=${new Date().getTime()}`;
            fileDisplayHtml = `<div style="text-align:center; padding: 10px 0;"><img src="${noCacheUrl}" crossorigin="anonymous" alt="튜터 플래너 코칭" style="max-width:100%; height:auto; border-radius:8px; border:1px solid #cbd5e1; display:block; margin: 0 auto;"></div>`;
        }
        
        tutorFileBlockHtml = `
            <div id="attachedPdfData" data-pdf-url="${actualPdfUrl}" style="display:none;"></div>
            <div class="doc-matched-box allow-page-break" style="margin-top: 30px;">
                <div class="doc-matched-header"><i class="fas fa-paperclip" style="color:#3b82f6;"></i> 5. 주간 플래너 코칭 & 첨삭</div>
                <div class="doc-matched-body allow-page-break-body" style="padding:25px;">${fileDisplayHtml}</div>
            </div>`;
    }

    const safeTitleForJs = escapeHtml(data.title || "주간 리포트").replace(/'/g, "\\'");
    
    const html = `
        <div class="modal-document" id="pdfTargetDocument">
            <div class="doc-controls" data-html2canvas-ignore="true">
                <button class="btn-pdf" onclick="downloadReportPDF('${safeTitleForJs}')"><i class="fas fa-file-pdf"></i> PDF 파일 다운로드</button>
                <button class="close-btn-doc" onclick="document.getElementById('feedbackModal').style.display='none'">&times;</button>
            </div>
            <div class="doc-header">
                <div><span class="doc-subtitle">PREMIUM STRATEGY</span><h2 class="doc-title">스터디크랙 주간 전략리포트</h2></div>
                <div class="doc-meta"><div>대상: <strong>${escapeHtml(data.title || "주간 리포트")}</strong></div><div>발행일: <strong>${new Date(data.date).toLocaleDateString()}</strong></div><div>분석: <strong>${consultantName}</strong></div></div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-clock"></i> 1. 학습 목표 이행 평가</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge">학생 리포트</span><table class="doc-table"><thead><tr><th>과목</th><th>세부 내용</th><th>계획</th><th>실제</th><th>달성률</th></tr></thead><tbody>${detailRows}</tbody></table><div style="margin-top:15px; text-align:right; font-size:0.9rem; color:#64748b; font-weight:700; background:#f8fafc; padding:8px; border-radius:6px;">총 달성률 <span style="color:#2563eb; font-size:1.1rem; margin-left:5px;">${totalRate}</span> <span style="font-weight:normal; font-size:0.8rem;">(${totalAct} / ${totalPlan})</span></div></div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge">Consultant 코멘트</span><h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">이전 우선순위 점검 결과</h4><div class="doc-text">${escapeHtml(fb.priorityCheck) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div></div>
                </div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-bullseye"></i> 2. 실전 성취도 & 취약점 분석</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge">시험 성적</span><div style="padding:15px; background:#f8fafc; border-radius:12px; text-align:center; border:1px solid #e2e8f0; height:calc(100% - 50px); display:flex; flex-direction:column; justify-content:center;">${examHtml}</div></div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge">Consultant 코멘트</span><h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">취약 과목 진단 및 개선 포인트</h4><div class="doc-text">${escapeHtml(fb.weakSubject) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div></div>
                </div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-route"></i> 3. 총평 및 Next Step</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge">학생 컨디션 평가</span><div style="margin-bottom:15px; font-weight:900; font-size:1.3rem; text-align:center; padding:15px; background:#f8fafc; border-radius:8px;">${trendHtml}</div><div style="font-size:0.85rem; color:#64748b; background:#fff1f2; border:1px solid #fecaca; padding:12px; border-radius:8px;">${trendReasonsHtml}</div></div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge">Consultant 코멘트</span><h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">이번 주 플랜 종합 평가</h4><div class="doc-text" style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px dashed #cbd5e1;">${escapeHtml(fb.planEvaluation) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div><h4 style="margin:0 0 10px 0; font-size:1rem; color:#2563eb;"><i class="fas fa-flag-checkered"></i> 다음 주 핵심 과제 TOP 3</h4><div class="doc-text">${escapeHtml(fb.nextWeekTop3) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div></div>
                </div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-comments"></i> 4. 심층 Q&A 솔루션</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge" style="background:#fef2f2; color:#ef4444; border-color:#fecaca;">학생의 심층 질문</span>${deepQnaHtml}</div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge" style="background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;">Consultant 추가 코멘트</span><div class="doc-text">${escapeHtml(fb.extraQuestion) || '<span style="color:#94a3b8">추가 코멘트가 없습니다.</span>'}</div></div>
                </div>
            </div>
            ${tutorFileBlockHtml}
        </div>

        <div class="mobile-only-msg" style="display:none;">
            <i class="fas fa-file-pdf" style="font-size:3rem; color:#3b82f6; margin-bottom:15px;"></i>
            <h3 style="margin:0 0 10px 0; color:#1e293b; font-size:1.4rem;">주간 리포트 도착</h3>
            <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5; word-break:keep-all;">
                모바일에서는 쾌적한 열람을 위해<br>PDF 변환 후 다운로드를 지원합니다.
            </p>
            <button onclick="downloadReportPDF('${safeTitleForJs}')" class="mobile-pdf-btn">
                <i class="fas fa-magic" style="color: #ffffff !important; font-size: 1.1rem !important; margin-bottom: 0 !important;"></i> 리포트 PDF 생성하기
            </button>
            <button class="mobile-close-btn" onclick="document.getElementById('feedbackModal').style.display='none'">
                닫기
            </button>
        </div>
    `;

    contentArea.innerHTML = html;
    modal.style.display = 'block';
    if (isPdfFile && typeof renderPdfToImages === 'function') setTimeout(() => { renderPdfToImages(actualPdfUrl, uniqueContainerId); }, 100);
}

function openFeedbackModalV2(data, modal, contentArea) {
    const fb = data.tutorFeedback || {};
    const isSubmitted = fb && fb.submitted === true;
    const hasFeedback = isSubmitted && (
        (fb.weeklyPlanner && String(fb.weeklyPlanner).trim() !== "") ||
        (fb.planReason && String(fb.planReason).trim() !== "") ||
        (fb.questionAnswer && String(fb.questionAnswer).trim() !== "") ||
        (fb.tutorComment && String(fb.tutorComment).trim() !== "") ||
        (fb.tutorImage && String(fb.tutorImage).trim() !== "")
    );

    if (!hasFeedback) {
        contentArea.innerHTML = `
            <div class="pending-view" style="background:#fff; padding:100px 20px; border-radius:16px;">
                <div class="pending-icon" style="font-size:4rem; color:#cbd5e1; margin-bottom:20px;"><i class="fas fa-hourglass-half"></i></div>
                <h2 style="color:#1e293b; margin-bottom:10px; font-weight:800;">피드백 작성 대기중</h2>
                <p style="color:#64748b; margin-bottom:30px;">담당 컨설턴트가 학생의 리포트를 꼼꼼히 분석하고 있습니다.</p>
                <button onclick="document.getElementById('feedbackModal').style.display='none'" style="padding:12px 30px; background:#f1f5f9; border:none; border-radius:8px; font-weight:bold; color:#475569; cursor:pointer;">닫기</button>
            </div>`;
        modal.style.display = 'block';
        return;
    }

    const consultantName = escapeHtml(data.tutorName || currentTutorName);
    const nl2br = (str) => str ? escapeHtml(str).replace(/\n/g, '<br>') : '<span style="color:#94a3b8">작성 내용 없음</span>';

    // 학생 달성률 테이블
    let detailRows = ''; let totalPlan = '0H', totalAct = '0H', totalRate = '0%';
    if (data.studyTime) {
        totalPlan = data.studyTime.totalPlan || '0H'; totalAct = data.studyTime.totalAct || '0H'; totalRate = data.studyTime.totalRate || '0%';
        if (data.studyTime.details && data.studyTime.details.length > 0) {
            data.studyTime.details.forEach(d => {
                const plan = parseFloat(d.plan) || 0; const act = parseFloat(d.act) || 0;
                const rate = plan > 0 ? Math.min((act / plan) * 100, 100).toFixed(0) : 0;
                const rateColor = rate >= 80 ? '#10b981' : (rate >= 50 ? '#f59e0b' : '#ef4444');
                let mainSub = d.subject; let detailSub = "-";
                const match = d.subject.match(/^(.*?)\s*\((.*?)\)$/);
                if (match) { mainSub = match[1]; detailSub = match[2]; }
                detailRows += `<tr><td style="text-align:left; font-weight:700; color:#334155;">${escapeHtml(mainSub)}</td><td style="color:#64748b; font-size:0.85rem; font-weight:600;">${escapeHtml(detailSub)}</td><td>${plan}H</td><td style="color:#2563eb; font-weight:bold;">${act}H</td><td style="color:${rateColor}; font-weight:800;">${rate}%</td></tr>`;
            });
        }
    }
    if (!detailRows) detailRows = `<tr><td colspan="5" style="color:#94a3b8; padding:20px;">상세 학습 기록이 없습니다.</td></tr>`;

    // 요일별 시간
    let availTimeHtml = '';
    if (data.weeklyAvailableTime) {
        const wt = data.weeklyAvailableTime;
        const days = [['월', wt.mon], ['화', wt.tue], ['수', wt.wed], ['목', wt.thu], ['금', wt.fri], ['토', wt.sat], ['일', wt.sun]];
        const total = days.reduce((s, d) => s + (parseFloat(d[1]) || 0), 0);
        availTimeHtml = `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">${days.map(d => `<span style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px; padding:4px 10px; font-size:0.85rem;"><strong>${d[0]}</strong> ${d[1] || 0}h</span>`).join('')}</div><div style="text-align:right; font-size:0.9rem; color:#475569; font-weight:600;">주간 합계: <span style="color:#2563eb;">${total}시간</span></div>`;
    }

    // 첨부파일
    let tutorFileBlockHtml = '';
    const uniqueContainerId = `pdf-render-${Date.now()}`;
    let isPdfFile = false; let actualPdfUrl = "";
    if (fb.tutorImage && String(fb.tutorImage).trim() !== "") {
        isPdfFile = fb.tutorImage.toLowerCase().includes('.pdf');
        actualPdfUrl = fb.tutorImage;
        let fileDisplayHtml = isPdfFile
            ? `<div id="${uniqueContainerId}" style="width:100%; text-align:center;"><div style="padding:40px 0; color:#3b82f6; font-weight:bold;" class="pdf-loading-spinner"><i class="fas fa-spinner fa-spin fa-2x" style="margin-bottom:10px;"></i><br>튜터 첨부 파일을 불러오는 중...</div></div>`
            : `<div style="text-align:center; padding:10px 0;"><img src="${escapeHtml(fb.tutorImage)}?t=${Date.now()}" crossorigin="anonymous" alt="튜터 첨부" style="max-width:100%; height:auto; border-radius:8px; border:1px solid #cbd5e1;"></div>`;
        tutorFileBlockHtml = `
            <div id="attachedPdfData" data-pdf-url="${actualPdfUrl}" style="display:none;"></div>
            <div class="doc-matched-box allow-page-break" style="margin-top:30px;">
                <div class="doc-matched-header"><i class="fas fa-paperclip" style="color:#3b82f6;"></i> 4. 첨부파일</div>
                <div class="doc-matched-body allow-page-break-body" style="padding:25px;">${fileDisplayHtml}</div>
            </div>`;
    }

    const safeTitleForJs = escapeHtml(data.title || "주간 리포트").replace(/'/g, "\\'");

    const html = `
        <div class="modal-document" id="pdfTargetDocument">
            <div class="doc-controls" data-html2canvas-ignore="true">
                <button class="btn-pdf" onclick="downloadReportPDF('${safeTitleForJs}')"><i class="fas fa-file-pdf"></i> PDF 파일 다운로드</button>
                <button class="close-btn-doc" onclick="document.getElementById('feedbackModal').style.display='none'">&times;</button>
            </div>
            <div class="doc-header">
                <div><span class="doc-subtitle">WEEKLY REPORT</span><h2 class="doc-title">스터디크랙 주간 전략리포트</h2></div>
                <div class="doc-meta"><div>대상: <strong>${escapeHtml(data.title || "주간 리포트")}</strong></div><div>발행일: <strong>${new Date(data.date).toLocaleDateString()}</strong></div><div>분석: <strong>${consultantName}</strong></div></div>
            </div>

            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-clock"></i> 1. 지난주 달성 현황</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data">
                        <span class="doc-badge">학생 리포트</span>
                        <table class="doc-table"><thead><tr><th>과목</th><th>세부</th><th>목표</th><th>실제</th><th>달성률</th></tr></thead><tbody>${detailRows}</tbody></table>
                        <div style="margin-top:15px; text-align:right; font-size:0.9rem; color:#64748b; font-weight:700; background:#f8fafc; padding:8px; border-radius:6px;">총 달성률 <span style="color:#2563eb; font-size:1.1rem; margin-left:5px;">${totalRate}</span> <span style="font-weight:normal; font-size:0.8rem;">(${totalAct} / ${totalPlan})</span></div>
                        ${data.bestPart ? `<div style="margin-top:15px; padding:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;"><strong style="color:#15803d; font-size:0.85rem;">잘 된 부분</strong><div style="color:#334155; margin-top:4px; font-size:0.9rem;">${nl2br(data.bestPart)}</div></div>` : ''}
                        ${data.hardPart ? `<div style="margin-top:10px; padding:12px; background:#fff1f2; border:1px solid #fecaca; border-radius:8px;"><strong style="color:#dc2626; font-size:0.85rem;">어려웠던 부분</strong><div style="color:#334155; margin-top:4px; font-size:0.9rem;">${nl2br(data.hardPart)}</div></div>` : ''}
                    </div>
                    <div class="doc-tutor-feedback">
                        <span class="doc-badge tutor-badge">Consultant 총평</span>
                        <div class="doc-text">${nl2br(fb.tutorComment)}</div>
                    </div>
                </div>
            </div>

            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-comments"></i> 2. 학생 질문 & 튜터 답변</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data">
                        <span class="doc-badge" style="background:#fef2f2; color:#ef4444; border-color:#fecaca;">학생 질문</span>
                        ${data.questionToTutor ? `<div style="color:#334155; font-size:0.95rem; padding-left:10px; border-left:3px solid #fecaca;">${nl2br(data.questionToTutor)}</div>` : '<div style="color:#94a3b8; padding:10px 0;">질문 없음</div>'}
                        ${data.stuckSubject ? `<div style="margin-top:15px; padding:12px; background:#fefce8; border:1px solid #fde68a; border-radius:8px;"><strong style="color:#92400e; font-size:0.85rem;">막히는 과목/유형</strong><div style="color:#334155; margin-top:4px; font-size:0.9rem;">${nl2br(data.stuckSubject)}</div></div>` : ''}
                    </div>
                    <div class="doc-tutor-feedback">
                        <span class="doc-badge tutor-badge" style="background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;">Consultant 답변</span>
                        <div class="doc-text">${nl2br(fb.questionAnswer)}</div>
                    </div>
                </div>
            </div>

            <div class="doc-matched-box allow-page-break">
                <div class="doc-matched-header"><i class="fas fa-calendar-alt"></i> 3. 이번 주 플래너</div>
                <div class="doc-matched-body allow-page-break-body">
                    <div class="doc-student-data">
                        <span class="doc-badge">학생 정보</span>
                        ${availTimeHtml ? `<div style="margin-bottom:15px;"><strong style="font-size:0.9rem; color:#1e293b; display:block; margin-bottom:8px;">공부 가능 시간</strong>${availTimeHtml}</div>` : ''}
                        ${data.currentMaterials ? `<div style="margin-bottom:10px;"><strong style="font-size:0.85rem; color:#64748b;">진행 중 교재/강의</strong><div style="color:#334155; font-size:0.9rem; margin-top:4px;">${nl2br(data.currentMaterials)}</div></div>` : ''}
                        ${data.weeklyGoal ? `<div style="margin-bottom:10px;"><strong style="font-size:0.85rem; color:#64748b;">이번 주 목표</strong><div style="color:#334155; font-size:0.9rem; margin-top:4px;">${nl2br(data.weeklyGoal)}</div></div>` : ''}
                        ${data.fixedSchedule ? `<div><strong style="font-size:0.85rem; color:#64748b;">고정 일정</strong><div style="color:#334155; font-size:0.9rem; margin-top:4px;">${nl2br(data.fixedSchedule)}</div></div>` : ''}
                    </div>
                    <div class="doc-tutor-feedback">
                        <span class="doc-badge tutor-badge">튜터 플래너</span>
                        <h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">요일별 플래너</h4>
                        <div class="doc-text" style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px dashed #cbd5e1;">${nl2br(fb.weeklyPlanner)}</div>
                        <h4 style="margin:0 0 10px 0; font-size:1rem; color:#2563eb;"><i class="fas fa-lightbulb"></i> 이렇게 짠 이유</h4>
                        <div class="doc-text">${nl2br(fb.planReason)}</div>
                    </div>
                </div>
            </div>
            ${tutorFileBlockHtml}
        </div>

        <div class="mobile-only-msg" style="display:none;">
            <i class="fas fa-file-pdf" style="font-size:3rem; color:#3b82f6; margin-bottom:15px;"></i>
            <h3 style="margin:0 0 10px 0; color:#1e293b; font-size:1.4rem;">주간 리포트 도착</h3>
            <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5; word-break:keep-all;">
                모바일에서는 쾌적한 열람을 위해<br>PDF 변환 후 다운로드를 지원합니다.
            </p>
            <button onclick="downloadReportPDF('${safeTitleForJs}')" class="mobile-pdf-btn">
                <i class="fas fa-magic" style="color:#ffffff !important; font-size:1.1rem !important; margin-bottom:0 !important;"></i> 리포트 PDF 생성하기
            </button>
            <button class="mobile-close-btn" onclick="document.getElementById('feedbackModal').style.display='none'">닫기</button>
        </div>
    `;

    contentArea.innerHTML = html;
    modal.style.display = 'block';
    if (isPdfFile && typeof renderPdfToImages === 'function') setTimeout(() => { renderPdfToImages(actualPdfUrl, uniqueContainerId); }, 100);
}

async function downloadReportPDF(reportTitle) {
    const reportElement = document.getElementById('pdfTargetDocument');
    if (!reportElement) return alert('리포트 내용을 찾을 수 없습니다.');
    if (reportElement.querySelector('.pdf-loading-spinner')) return alert("첨부파일 렌더링 중입니다. 잠시 후 다시 클릭해주세요.");

    const attachedPdfEl = reportElement.querySelector('#attachedPdfData');
    const attachedPdfUrl = attachedPdfEl ? attachedPdfEl.getAttribute('data-pdf-url') : null;

    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'pdf-loading-overlay';
    loadingOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(255,255,255,0.98); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center;';
    loadingOverlay.innerHTML = `<i class="fas fa-spinner fa-spin fa-3x" style="color:#2563eb; margin-bottom:20px;"></i><h2 style="color:#1e293b; font-weight:800; margin-bottom:10px;">프리미엄 PDF 리포트 생성 중...</h2><p style="color:#64748b;">서버에서 고화질 PDF를 렌더링하고 병합하고 있습니다. 잠시만 기다려주세요.</p>`;
    document.body.appendChild(loadingOverlay);

    let finalDownloadUrl = null;

    try {
        const clonedReport = reportElement.cloneNode(true);
        const attachedPdfDataEl = clonedReport.querySelector('#attachedPdfData');
        
        if (attachedPdfDataEl && attachedPdfUrl) {
            const section5Box = attachedPdfDataEl.nextElementSibling;
            if (section5Box && section5Box.classList.contains('doc-matched-box')) {
                section5Box.remove();
            }

            const noticeHtml = `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #cbd5e1; text-align: right; color: #2563eb; font-weight: 800; font-size: 1.1rem;">
                    <i class="fas fa-file-pdf" style="margin-right: 5px;"></i> 5. 튜터 플래너 첨삭은 다음 장에서 이어집니다 ▶
                </div>
            `;
            clonedReport.insertAdjacentHTML('beforeend', noticeHtml);
        }

        const rawHtml = `
            <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><base href="https://studycrack.co.kr">
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Noto Sans KR', sans-serif; background: #fff; color: #333; margin: 0; padding: 0; zoom: 0.9; }
                .report-wrapper { width: 100%; max-width: 900px; margin: 0 auto; background: transparent; padding: 30px 10px; box-sizing: border-box; }
                .doc-controls, .mobile-only-msg { display: none !important; }
                .doc-header { border-bottom: 3px solid #1e293b; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
                .doc-subtitle { font-size: 0.85rem; font-weight: 800; color: #3b82f6; background: #eff6ff; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 5px; }
                .doc-title { font-size: 2.2rem; font-weight: 900; color: #0f172a; margin: 0; }
                .doc-meta { font-size: 0.95rem; color: #64748b; text-align: right; line-height: 1.6; }
                .doc-matched-box { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 30px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
                .doc-matched-header { background: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 800; font-size: 1.1rem; color: #1e293b; border-radius: 12px 12px 0 0; }
                .doc-matched-body { display: table; width: 100%; box-sizing: border-box; table-layout: fixed; }
                .doc-student-data { display: table-cell; width: 40%; vertical-align: top; padding: 20px; border-right: 1px dashed #cbd5e1; word-break: break-word; overflow-wrap: break-word; }
                .doc-tutor-feedback { display: table-cell; width: 60%; vertical-align: top; padding: 20px; background: #fafafa; border-radius: 0 0 12px 0; word-break: break-word; overflow-wrap: break-word; }
                .doc-text { font-size: 0.95rem; line-height: 1.7; white-space: pre-wrap; color: #334155; word-break: break-word; overflow-wrap: break-word; }
                .doc-table th { padding: 8px 4px; border-bottom: 1px solid #e2e8f0; color: #94a3b8; vertical-align: middle; }
                .doc-table td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: middle; }
                .doc-badge { display: inline-block; padding: 4px 10px; background: #f1f5f9; color: #475569; border-radius: 6px; font-size: 0.8rem; font-weight: 800; margin-bottom: 15px; letter-spacing: -0.5px; border: 1px solid #e2e8f0; }
                .doc-badge.tutor-badge { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
                .qna-pair-container { display: block; margin-bottom: 15px; }
                .qna-student { background: #fff1f2; padding: 18px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 15px; }
                .qna-tutor { background: #f0fdf4; padding: 18px; border-radius: 8px; border: 1px solid #bbf7d0; }
                .allow-page-break { page-break-before: always !important; break-before: page !important; page-break-inside: auto !important; break-inside: auto !important; margin-top: 0 !important; }
                .allow-page-break-body { display: block !important; }
                img { page-break-inside: avoid !important; break-inside: avoid !important; max-width: 100% !important; max-height: 250mm !important; object-fit: contain !important; display: block !important; margin: 0 auto 15px auto !important; }
            </style></head>
            <body><img src="https://studycrack.co.kr/assets/backgrounds/bg_studycrack_logo.png" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:500px; opacity:0.08; z-index:9999; pointer-events:none; max-height:none !important;">
                <div class="report-wrapper">${clonedReport.innerHTML}</div>
            </body></html>
        `;

        const response = await apiFetch(PDF_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                title: reportTitle, 
                html: rawHtml,
                attachedPdfUrl: attachedPdfUrl 
            })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            finalDownloadUrl = data.downloadUrl;
        } else { throw new Error(data.error || "서버에서 PDF를 생성하지 못했습니다."); }
    } catch (error) { alert("PDF 생성 중 오류가 발생했습니다: " + error.message); } 
    finally { 
        if (loadingOverlay && loadingOverlay.parentNode) {
            loadingOverlay.parentNode.removeChild(loadingOverlay);
        }

        if (finalDownloadUrl) {
            const isMobile = window.innerWidth <= 768; 
            
            if (isMobile) {
                const contentArea = document.querySelector('#feedbackModal .modal-body') || document.getElementById('modalContent');
                if (contentArea) {
                    contentArea.innerHTML = `
                        <div class="mobile-only-msg" style="display:flex !important; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 20px; background:#ffffff; border-radius:12px; margin:0 auto; width:100%; box-sizing:border-box;">
                            <i class="fas fa-file-pdf" style="font-size:3rem; color:#ef4444; margin-bottom:15px;"></i>
                            <h3 style="margin:0 0 10px 0; color:#1e293b; font-size:1.4rem;">PDF 준비 완료</h3>
                            <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5; word-break:keep-all;">리포트 생성이 성공적으로 완료되었습니다.<br>아래 버튼을 눌러 기기에 저장하거나 확인해 주세요.</p>
                            <a href="${finalDownloadUrl}" download="스터디크랙_${reportTitle}.pdf" target="_blank" class="mobile-pdf-btn" style="width:100%; padding:14px 20px; font-size:1.05rem; background:#3b82f6; color:white; border:none; border-radius:8px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:10px; cursor:pointer; text-decoration:none;">리포트 열기 / 다운로드</a>
                            <button class="mobile-close-btn" onclick="document.getElementById('feedbackModal').style.display='none'" style="width:100%; padding:14px; font-size:1rem; background:#f1f5f9; border:none; border-radius:8px; color:#475569; font-weight:700; cursor:pointer;">닫기</button>
                        </div>
                    `;
                }
            } else {
                const link = document.createElement('a'); 
                link.href = finalDownloadUrl; 
                link.target = '_blank'; 
                link.download = `스터디크랙_${reportTitle}.pdf`; 
                document.body.appendChild(link); 
                link.click(); 
                document.body.removeChild(link);
            }
        }
    }
}

async function renderPdfToImages(url, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // html에 선언된 pdf.js 라이브러리의 worker 소스 설정 (버전 일치 필요)
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // S3에서 PDF 파일 다운로드 및 파싱
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        
        // 렌더링 시작 전 무한 로딩 스피너 제거
        container.innerHTML = ''; 

        // PDF의 모든 페이지를 순회하며 캔버스로 그려내기
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            // 고화질 렌더링을 위해 scale 값을 2.0으로 설정 (모바일/PC 모두 깔끔하게 보임)
            const scale = 2.0; 
            const viewport = page.getViewport({ scale: scale });

            // 캔버스 엘리먼트 생성
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // 스타일 적용 (반응형 100% 폭)
            canvas.style.cssText = 'width: 100%; max-width: 100%; margin-bottom: 15px; border-radius: 8px; border: 1px solid #e2e8f0; display: block; box-sizing: border-box;';

            // 화면에 캔버스 먼저 추가 후 렌더링 진행 (사용자가 진행 상황을 볼 수 있도록)
            container.appendChild(canvas); 
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
        }
    } catch (error) {
        console.error("PDF 렌더링 실패:", error);
        // 에러 발생 시 무한 로딩을 멈추고 직접 다운로드 링크 제공
        container.innerHTML = `
            <div style="padding: 30px; text-align: center; color: #ef4444; background: #fef2f2; border-radius: 8px;">
                <i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom: 10px;"></i><br>
                PDF 문서를 화면에 불러오지 못했습니다.<br>
                <a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 0.95rem; display: inline-block; margin-top: 10px; font-weight: bold;">
                    직접 다운로드하여 확인하기 <i class="fas fa-external-link-alt" style="font-size:0.8rem;"></i>
                </a>
            </div>`;
    }
}

let currentMobileStep = 0; let wizardSteps = []; let wizardResizeHandler = null;

function openWeeklyCheckModal() {
    if (!['basic', 'starter', 'standard', 'pro'].includes(currentUserTier)) {
        if (confirm("🔒 BASIC 이상 플랜에서 주간 학습점검을 이용할 수 있습니다.\n결제 페이지로 이동하시겠습니까?")) { window.location.href = '/payment'; }
        return;
    }
    // BASIC/STARTER 1회 제출 제한: 이미 제출 이력이 있으면 차단
    if ((currentUserTier === 'basic' || currentUserTier === 'starter') && weeklyDataHistory.length > 0) {
        alert("BASIC/STARTER 플랜은 1회 플래너 피드백이 제공됩니다.\n이미 제출을 완료하셨습니다. 추가 제출은 STANDARD 이상 플랜에서 가능합니다.");
        return;
    }
    const today = new Date();
    if (today.getDay() === 0 && today.getHours() >= 20) { alert("금주 학습 점검 제출이 마감되었습니다."); return; }
    
    const modal = document.getElementById('weeklyCheckModal'); const modalContent = modal.querySelector('.check-modal-content');
    const currentWeekTitle = getWeekTitle(today); const [yStr, mStr, wStr] = currentWeekTitle.split(' '); 
    document.getElementById('weeklyYear').innerText = yStr; document.getElementById('weeklyDateDetail').innerText = `${mStr} ${wStr}`;
    
    // weekId 기준 우선 탐색, 없으면 title로 fallback (구 데이터 호환)
    const currentWeekId = generateWeekId(today);
    const thisWeekData = weeklyDataHistory.find(w => w.weekId === currentWeekId)
        || weeklyDataHistory.find(w => w.title && w.title.replace(/\s/g, '') === currentWeekTitle.replace(/\s/g, ''));
    if (thisWeekData) loadWeeklyDataToForm(thisWeekData); else resetWeeklyForm();

    // BASIC/STARTER 티어: Step 2 탭 잠금 표시
    const step2Btn = modal.querySelector('.tab-btn:nth-child(2)');
    if (currentUserTier === 'basic' || currentUserTier === 'starter') {
        step2Btn.innerHTML = 'Step 2. 심층코칭 <i class="fas fa-lock" style="margin-left:4px; font-size:0.75rem; color:#94a3b8;"></i>';
        step2Btn.style.opacity = '0.5';
        step2Btn.style.cursor = 'not-allowed';
    } else {
        step2Btn.innerHTML = 'Step 2. 심층코칭';
        step2Btn.style.opacity = ''; step2Btn.style.cursor = '';
    }

    function applyModalLayout() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            modalContent.classList.add('mobile-wizard-mode');
            wizardSteps = Array.from(modal.querySelectorAll('.check-section, .pro-input-card'));
            // BASIC/STARTER는 Step 2(심층코칭) 카드 제외
            if (currentUserTier === 'basic' || currentUserTier === 'starter') { wizardSteps = wizardSteps.filter(el => !el.classList.contains('pro-input-card')); }
            if(currentMobileStep >= wizardSteps.length) currentMobileStep = 0;
            updateMobileWizardUI();
        } else {
            modalContent.classList.remove('mobile-wizard-mode'); document.getElementById('mobileWizardProgress').style.display = 'none';
            document.getElementById('wizardPrevBtn').style.display = 'none'; document.getElementById('wizardNextBtn').style.display = 'none';
            document.getElementById('wizardSubmitBtn').style.display = 'block'; document.getElementById('wizardSubmitBtn').style.width = '100%';
            switchWeeklyTab('step1'); 
        }
    }
    applyModalLayout();
    if (!wizardResizeHandler) { wizardResizeHandler = () => { if (modal.style.display === 'block') applyModalLayout(); }; window.addEventListener('resize', wizardResizeHandler); }
    modal.style.display = 'block'; document.body.style.overflow = 'hidden';
}

function updateMobileWizardUI() {
    wizardSteps.forEach((step, idx) => { if (idx === currentMobileStep) step.classList.add('active-step'); else step.classList.remove('active-step'); });
    const progressEl = document.getElementById('mobileWizardProgress'); progressEl.style.display = 'block'; progressEl.innerText = `${currentMobileStep + 1} / ${wizardSteps.length} 단계`;
    const prevBtn = document.getElementById('wizardPrevBtn'); const nextBtn = document.getElementById('wizardNextBtn'); const submitBtn = document.getElementById('wizardSubmitBtn');

    if (currentMobileStep === 0) { prevBtn.style.display = 'none'; nextBtn.style.display = 'block'; submitBtn.style.display = 'none'; } 
    else if (currentMobileStep === wizardSteps.length - 1) { prevBtn.style.display = 'block'; nextBtn.style.display = 'none'; submitBtn.style.display = 'block'; } 
    else { prevBtn.style.display = 'block'; nextBtn.style.display = 'block'; submitBtn.style.display = 'none'; }
    const modalBody = document.querySelector('.check-modal-content .modal-body.scrollable'); if (modalBody) modalBody.scrollTop = 0;
}
function nextMobileStep() { if (currentMobileStep < wizardSteps.length - 1) { currentMobileStep++; updateMobileWizardUI(); } }
function prevMobileStep() { if (currentMobileStep > 0) { currentMobileStep--; updateMobileWizardUI(); } }
function closeWeeklyModal() { document.getElementById('weeklyCheckModal').style.display = 'none'; document.body.style.overflow = 'auto'; }

function resetWeeklyForm() {
    // 1. 과목 리스트 초기화
    const list = document.getElementById('studyTimeList');
    if (list) { list.querySelectorAll('.custom-added-card').forEach(card => card.remove()); }
    document.querySelectorAll('.plan-time, .act-time, .sub-detail').forEach(input => { input.value = ''; });
    document.querySelectorAll('.rate-txt').forEach(span => { span.innerText = '0%'; span.style.color = '#334155'; });

    // 2. 총합 초기화
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setTxt('totalPlan', '0H'); setTxt('totalAct', '0H'); setTxt('totalRate', '0%');

    // 3. v2 텍스트 필드 초기화
    const v2Fields = ['wkBestPart', 'wkHardPart', 'wkMaterials', 'wkGoal', 'wkStuck', 'wkSchedule', 'wkQuestion'];
    v2Fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; const cs = el.parentElement?.querySelector('.char-count span'); if (cs) cs.innerText = '0'; }
    });

    // 4. 요일별 시간 초기화
    ['wtMon','wtTue','wtWed','wtThu','wtFri','wtSat','wtSun'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    setTxt('wtTotalHours', '0');

    // 5. 빈 과목 슬롯 1개 자동 생성
    if (typeof addSubjectCard === 'function') addSubjectCard();
}

function selectMockType(type, element) { document.getElementById('mockExamType').value = type; document.querySelectorAll('.mock-tile').forEach(tile => tile.classList.remove('selected')); element.classList.add('selected'); toggleMockExamFields(); }
function toggleMockExamFields() { const type = document.getElementById('mockExamType').value; const fields = document.getElementById('mockExamFields'); if (type === 'none') fields.style.display = 'none'; else fields.style.display = 'block'; }

function calcStudyRates() {
    const cards = document.querySelectorAll('.subject-card'); let sumPlan = 0, sumAct = 0;
    cards.forEach(card => {
        const planInput = card.querySelector('.plan-time'); const actInput = card.querySelector('.act-time'); const rateTxt = card.querySelector('.rate-txt');
        if(!planInput || !actInput) return;
        const plan = parseFloat(planInput.value) || 0; const act = parseFloat(actInput.value) || 0;
        sumPlan += plan; sumAct += act;
        if (plan > 0) {
            const rate = Math.min((act / plan) * 100, 100).toFixed(0); rateTxt.innerText = `${rate}%`;
            if(rate >= 100) rateTxt.style.color = '#10b981'; else if(rate >= 80) rateTxt.style.color = '#3b82f6'; else rateTxt.style.color = '#ef4444';
        } else { rateTxt.innerText = '0%'; rateTxt.style.color = '#334155'; }
    });
    document.getElementById('totalPlan').innerText = sumPlan.toFixed(1) + 'H'; document.getElementById('totalAct').innerText = sumAct.toFixed(1) + 'H';
    const totalRate = sumPlan > 0 ? Math.min((sumAct / sumPlan) * 100, 100).toFixed(0) : 0; document.getElementById('totalRate').innerText = `${totalRate}%`;
}

function addSubjectCard() {
    const list = document.getElementById('studyTimeList');
    const newCard = document.createElement('div');
    newCard.className = 'subject-card custom-added-card';

    // 카드 헤더 생성 (입력창 + 삭제버튼)
    const header = document.createElement('div');
    header.className = 'card-header';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'custom-subj';
    nameInput.placeholder = '과목명 직접 입력 (예: 한국사)';
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-del-card';
    delBtn.innerHTML = '<i class="fas fa-times"></i> 삭제';
    delBtn.onclick = () => { newCard.remove(); calcStudyRates(); };

    header.appendChild(nameInput);
    header.appendChild(delBtn);

    // 카드 바디 생성 (세부과목 + 계획/실제/달성률)
    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
        <input type="text" class="sub-detail" placeholder="세부과목 (선택사항)">
        <div class="time-inputs">
            <div class="input-group"><label>계획(H)</label><input type="number" class="plan-time" oninput="calcStudyRates()"></div>
            <div class="input-group"><label>실제(H)</label><input type="number" class="act-time" oninput="calcStudyRates()"></div>
            <div class="rate-display"><label>달성률</label><span class="rate-txt">0%</span></div>
        </div>
    `;

    newCard.appendChild(header);
    newCard.appendChild(body);
    list.appendChild(newCard);
}

function handlePlannerFiles(input) {
    if (input.files) {
        const files = Array.from(input.files);
        if (currentPlannerFiles.length + files.length > 5) { alert("최대 5장까지만 업로드 가능합니다."); input.value = ''; return; }
        files.forEach(f => currentPlannerFiles.push(f)); renderPlannerFiles();
    }
}

function renderPlannerFiles() {
    const list = document.getElementById('plannerFileList'); if(!list) return; list.innerHTML = '';
    if (currentPlannerFiles.length === 0) { list.innerHTML = '<span class="placeholder-text">선택된 파일 없음</span>'; return; }
    currentPlannerFiles.forEach((file, idx) => {
        let fileName = ""; let fileLink = ""; 
        if (file instanceof File) { fileName = file.name; } 
        else if (typeof file === 'string') { try { const rawName = file.split('/').pop(); fileName = decodeURIComponent(rawName); fileName = fileName.replace(/^\d+_/, ''); fileLink = file; } catch (e) { fileName = file; } }
        const div = document.createElement('div'); div.className = 'file-item';
        let nameDisplay = `<span>📄 ${escapeHtml(fileName)}</span>`;
        if (fileLink) { nameDisplay = `<a href="${fileLink}" target="_blank" style="text-decoration:none; color:#334155; display:flex; align-items:center; gap:5px;"><span>📄 ${escapeHtml(fileName)}</span> <i class="fas fa-external-link-alt" style="font-size:0.7rem; color:#3b82f6;"></i></a>`; }
        div.innerHTML = `${nameDisplay}<span class="file-remove" onclick="removePlannerFile(${idx})">x</span>`; list.appendChild(div);
    });
}
function removePlannerFile(idx) { currentPlannerFiles.splice(idx, 1); renderPlannerFiles(); }
function toggleSlumpReason() { const trend = document.querySelector('input[name="studyTrend"]:checked')?.value; const box = document.getElementById('slumpReasonBox'); if(trend === 'down') box.style.display = 'block'; else box.style.display = 'none'; }

function parseStudySubjectLabel(subject) {
    const raw = String(subject || '').trim();
    const m = raw.match(/^(.*?)\s*\((.*?)\)\s*$/);
    if (!m) return { main: raw, detail: '' };
    return { main: m[1].trim(), detail: m[2].trim() };
}

function loadWeeklyDataToForm(data) {
    // 로드 전 초기화: 기존 커스텀 카드 제거 + 고정 카드 입력값 리셋
    const list = document.getElementById('studyTimeList');
    if (list) list.querySelectorAll('.custom-added-card').forEach(card => card.remove());
    document.querySelectorAll('#studyTimeList .plan-time, #studyTimeList .act-time, #studyTimeList .sub-detail, #studyTimeList .custom-subj').forEach(input => { input.value = ''; });
    document.querySelectorAll('#studyTimeList .rate-txt').forEach(span => { span.innerText = '0%'; span.style.color = '#334155'; });

    // 과목별 달성률 (v1, v2 공통)
    if (data.studyTime && data.studyTime.details) {
        const fixedCards = {};
        document.querySelectorAll('#studyTimeList .subject-card').forEach(card => {
            const main = card.querySelector('.main-sub')?.innerText?.trim();
            if (main) fixedCards[main] = card;
        });
        const usedFixed = new Set();

        data.studyTime.details.forEach((detail) => {
            const subjectRaw = detail?.subject || '';
            const { main, detail: subDetail } = parseStudySubjectLabel(subjectRaw);
            let card = null;

            if (fixedCards[main] && !usedFixed.has(main)) {
                card = fixedCards[main];
                usedFixed.add(main);
            } else {
                addSubjectCard();
                const cards = document.querySelectorAll('#studyTimeList .subject-card');
                card = cards[cards.length - 1];
            }

            if (!card) return;
            const planInput = card.querySelector('.plan-time');
            const actInput = card.querySelector('.act-time');
            const detailInput = card.querySelector('.sub-detail');
            const customInput = card.querySelector('.custom-subj');

            if (planInput) planInput.value = detail.plan ?? '';
            if (actInput) actInput.value = detail.act ?? '';
            if (detailInput) detailInput.value = subDetail || '';
            if (customInput) customInput.value = main || subjectRaw;
        });
        calcStudyRates();
    }

    // v2 필드 로드
    const setField = (id, val) => { const el = document.getElementById(id); if (el) { el.value = val || ''; if (typeof updateCharCount === 'function') updateCharCount(el); } };
    setField('wkBestPart', data.bestPart);
    setField('wkHardPart', data.hardPart);
    setField('wkMaterials', data.currentMaterials);
    setField('wkGoal', data.weeklyGoal);
    setField('wkStuck', data.stuckSubject);
    setField('wkSchedule', data.fixedSchedule);
    setField('wkQuestion', data.questionToTutor);

    // 요일별 시간
    if (data.weeklyAvailableTime) {
        const wt = data.weeklyAvailableTime;
        const map = { wtMon: 'mon', wtTue: 'tue', wtWed: 'wed', wtThu: 'thu', wtFri: 'fri', wtSat: 'sat', wtSun: 'sun' };
        Object.entries(map).forEach(([elId, key]) => { const el = document.getElementById(elId); if (el && wt[key]) el.value = wt[key]; });
        calcWeeklyTotal();
    }
}

function updateCharCount(el) { const countSpan = el.parentElement.querySelector('.char-count span'); if(countSpan) countSpan.innerText = el.value.length; }

// 모바일/PC 화면 전환을 통합으로 처리하는 헬퍼 함수
function forceMoveToStep(mobileIdx, tabId) {
    const modalContent = document.querySelector('.check-modal-content');
    if (modalContent && modalContent.classList.contains('mobile-wizard-mode')) {
        currentMobileStep = mobileIdx;
        if (typeof updateMobileWizardUI === 'function') updateMobileWizardUI();
    } else {
        if (typeof switchWeeklyTab === 'function') switchWeeklyTab(tabId);
    }
}

// 요일별 공부 가능 시간 합계 계산
function calcWeeklyTotal() {
    const ids = ['wtMon','wtTue','wtWed','wtThu','wtFri','wtSat','wtSun'];
    let total = 0;
    ids.forEach(id => { total += parseFloat(document.getElementById(id)?.value) || 0; });
    const el = document.getElementById('wtTotalHours');
    if (el) el.innerText = total;
}

async function submitWeeklyCheck() {
    const submitBtn = document.querySelector('.save-btn');
    const originalBtnText = submitBtn ? submitBtn.innerText : "저장";

    try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "처리 중..."; }

        const totalPlanEl = document.getElementById('totalPlan');
        if (!totalPlanEl) { alert("시스템 오류: 학습 계획 시간 요소를 찾을 수 없습니다."); return; }

        const totalPlan = parseFloat(totalPlanEl.innerText);
        if (isNaN(totalPlan) || totalPlan === 0) {
            alert("지난주 학습 목표 시간을 1시간 이상 입력해주세요.");
            forceMoveToStep(0, 'step1');
            return;
        }

        // 과목별 달성 현황 수집
        const studyCards = document.querySelectorAll('.subject-card');
        let studyData = [];
        studyCards.forEach(card => {
            let subjName = "";
            const mainSub = card.querySelector('.main-sub');
            const detail = card.querySelector('.sub-detail');
            const custom = card.querySelector('.custom-subj');
            if (mainSub) {
                subjName = mainSub.innerText.replace('↳', '').trim();
                if (detail) {
                    const detailVal = detail.value.trim();
                    subjName += `(${detailVal ? detailVal : '공통'})`;
                }
            } else if (custom) {
                subjName = custom.value.trim() || "기타";
            }
            const plan = parseFloat(card.querySelector('.plan-time')?.value) || 0;
            const act = parseFloat(card.querySelector('.act-time')?.value) || 0;
            if (plan > 0 || act > 0) studyData.push({ subject: subjName, plan, act });
        });

        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : "";

        // 요일별 공부 가능 시간
        const weeklyAvailableTime = {
            mon: parseFloat(getVal('wtMon')) || 0,
            tue: parseFloat(getVal('wtTue')) || 0,
            wed: parseFloat(getVal('wtWed')) || 0,
            thu: parseFloat(getVal('wtThu')) || 0,
            fri: parseFloat(getVal('wtFri')) || 0,
            sat: parseFloat(getVal('wtSat')) || 0,
            sun: parseFloat(getVal('wtSun')) || 0
        };

        if (!confirm("제출하시겠습니까?")) return;

        const today = new Date().toISOString();
        const title = (typeof getWeekTitle === 'function') ? getWeekTitle(new Date()) : "주간점검";
        const weekId = generateWeekId(new Date());

        const weeklyData = {
            weekId, date: today, title: title,
            formVersion: 2,
            studyTime: {
                details: studyData,
                totalPlan: document.getElementById('totalPlan')?.innerText || '0H',
                totalAct: document.getElementById('totalAct')?.innerText || '0H',
                totalRate: document.getElementById('totalRate')?.innerText || '0%'
            },
            bestPart: getVal('wkBestPart'),
            hardPart: getVal('wkHardPart'),
            weeklyAvailableTime: weeklyAvailableTime,
            currentMaterials: getVal('wkMaterials'),
            weeklyGoal: getVal('wkGoal'),
            stuckSubject: getVal('wkStuck'),
            fixedSchedule: getVal('wkSchedule'),
            questionToTutor: getVal('wkQuestion')
        };

        const res = await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'save_weekly_check', data: weeklyData })
        });

        if (res.ok) {
            alert("제출이 완료되었습니다.");
            closeWeeklyModal();
            location.reload();
        } else {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || "서버 응답 오류가 발생했습니다.");
        }

    } catch(e) {
        console.error("Submit Error:", e);
        alert("처리 중 오류가 발생했습니다: " + e.message);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalBtnText; }
    }
}

function updateMockFileName(input) {
    const display = document.getElementById('mockFileNameDisplay');
    if (input.files && input.files.length > 0) { display.textContent = input.files[0].name; display.style.color = "#2563eb"; display.style.fontWeight = "bold"; } 
    else { display.textContent = "선택된 파일 없음"; display.style.color = "#94a3b8"; display.style.fontWeight = "normal"; }
}


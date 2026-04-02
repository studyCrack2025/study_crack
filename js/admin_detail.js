// js/admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');

const API_URL = CONFIG.api.admin;
const REPORT_API_URL = CONFIG.api.report;
const FILE_API_URL = CONFIG.api.file;
const PAYMENT_API_URL = CONFIG.api.payment || CONFIG.api.admin; 

let currentStudentData = null;
let currentTier = 'free';
let currentPaymentsData = []; 
let currentWeeklyData = [];   

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                localStorage.removeItem('accessToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('userRole');
                window.location.href = '/login'; 
                return Promise.reject(new Error("Auth expired")); 
            }
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error; 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = '/login';
        return;
    }

    const backBtn = document.querySelector('.back-btn');
    const userRole = localStorage.getItem('userRole');

    if (backBtn) {
        if (userRole === 'tutor') {
            backBtn.href = '/mypage/tutor?tab=students';
            backBtn.innerText = '← 내 학생 목록으로';
        } else {
            backBtn.href = '/admin';
            backBtn.innerText = '← 목록으로 돌아가기';
        }
    }
    
    initRoleBasedView();
    loadAllStudentData();
    
    const today = new Date();
    initDateFilter(today.getFullYear(), today.getMonth() + 1);
    initProDateFilter(today.getFullYear(), today.getMonth() + 1);

    // 💡 [버그 수정] 드롭다운 변경 시 리스트 갱신 이벤트 리스너 추가
    const filterYear = document.getElementById('filterYear');
    const filterMonth = document.getElementById('filterMonth');
    if (filterYear) filterYear.addEventListener('change', renderWeeklyTab);
    if (filterMonth) filterMonth.addEventListener('change', renderWeeklyTab);

    const proFilterYear = document.getElementById('proFilterYear');
    const proFilterMonth = document.getElementById('proFilterMonth');
    if (proFilterYear) proFilterYear.addEventListener('change', renderProTab);
    if (proFilterMonth) proFilterMonth.addEventListener('change', renderProTab);
});

function initRoleBasedView() {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'tutor') {
        const btnPay = document.getElementById('btn-pay');
        if (btnPay) btnPay.style.display = 'none';
    }
}

function initDateFilter(year, month) {
    const yearSel = document.getElementById('filterYear');
    const monthSel = document.getElementById('filterMonth');
    if(!yearSel || !monthSel) return;
    
    yearSel.innerHTML = ''; monthSel.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for(let y = currentYear; y >= currentYear - 2; y--) {
        yearSel.innerHTML += `<option value="${y}" ${y===year?'selected':''}>${y}년</option>`;
    }
    for(let m = 1; m <= 12; m++) {
        monthSel.innerHTML += `<option value="${m}" ${m===month?'selected':''}>${m}월</option>`;
    }
}

function initProDateFilter(year, month) {
    const yearSel = document.getElementById('proFilterYear');
    const monthSel = document.getElementById('proFilterMonth');
    if(!yearSel || !monthSel) return;

    yearSel.innerHTML = ''; monthSel.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for(let y = currentYear; y >= currentYear - 2; y--) {
        yearSel.innerHTML += `<option value="${y}" ${y===year?'selected':''}>${y}년</option>`;
    }
    for(let m = 1; m <= 12; m++) {
        monthSel.innerHTML += `<option value="${m}" ${m===month?'selected':''}>${m}월</option>`;
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('tab_' + tabName);
    if(target) target.classList.add('active');
    
    const btnId = (tabName === 'special') ? 'btn-special' : 'btn-' + tabName;
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');

    if (currentStudentData) {
        if (tabName === 'weekly') renderWeeklyTab();
        if (tabName === 'special') renderProTab();
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatReportKey(key, isPro = true) {
    if (!key) return "알 수 없는 리포트";
    
    if (key.length === 6 && /^\d+$/.test(key)) {
        const yy = key.substring(0, 2);
        const mm = parseInt(key.substring(2, 4));
        const ww = parseInt(key.substring(4, 6));
        const suffix = isPro ? " PRO 리포트" : "";
        return `${yy}년 ${mm}월 ${ww}주차${suffix}`;
    }
    
    const match = key.match(/^(\d{4})-W(\d{1,2})$/);
    if (match) {
        const suffix = isPro ? " PRO 리포트" : "";
        return `${match[1]}년 ${match[2]}주차${suffix}`;
    }
    
    return key;
}

function parseDynamoItem(item) {
    if (item === undefined || item === null) return null;
    if (typeof item !== 'object') return item;
    if (Array.isArray(item)) return item.map(parseDynamoItem);

    if (item.S !== undefined) return item.S;
    if (item.N !== undefined) return Number(item.N);
    if (item.BOOL !== undefined) return item.BOOL;
    if (item.NULL === true) return null;
    
    if (item.L !== undefined) {
        if (Array.isArray(item.L)) return item.L.map(parseDynamoItem);
        return [];
    }
    if (item.M !== undefined) {
        const obj = {};
        for (const key in item.M) obj[key] = parseDynamoItem(item.M[key]);
        return obj;
    }
    const obj = {};
    for (const key in item) obj[key] = parseDynamoItem(item[key]);
    return obj;
}

async function loadAllStudentData() {
    try {
        const detailPromise = apiFetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_get_user_detail', userId: adminId, data: { targetUserId: targetUserId }
            })
        }).then(res => res.json());

        const weeklyPromise = apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_weekly_reports', data: { targetUserId: targetUserId }
            })
        }).then(res => res.json()).catch(() => ({ weeklyReports: [] }));

        const paymentPromise = apiFetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_get_payments', data: { targetUserId: targetUserId }
            })
        }).then(res => res.json()).catch(() => ({ payments: [] }));

        const [detailData, weeklyData, paymentData] = await Promise.all([detailPromise, weeklyPromise, paymentPromise]);

        currentStudentData = parseDynamoItem(detailData);
        currentWeeklyData = parseDynamoItem(weeklyData.weeklyReports || []);
        currentPaymentsData = parseDynamoItem(paymentData.payments || []);

        renderData(currentStudentData);
    } catch (e) {
        if (e.message !== "Auth expired") alert("학생 상세 데이터를 불러오지 못했습니다.");
    }
}

async function loadProReportsForAdmin() {
    const userRole = localStorage.getItem('userRole'); 
    try {
        const response = await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_pro_reports',
                data: { targetUserId: targetUserId, requesterRole: userRole } 
            })
        });
        
        const data = await response.json();
        currentStudentData.proReportsList = parseDynamoItem(data.reports || []);
        
        const specialTab = document.getElementById('tab_special');
        if (specialTab && specialTab.classList.contains('active')) {
            renderProTab();
        }
    } catch (e) { 
        if (e.message !== "Auth expired") console.error("Pro Reports Load Error:", e); 
    }
}

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
// UI 렌더링 함수들
// -----------------------------------------------------------
function renderData(s) {
    if (!s) return;

    document.getElementById('viewName').innerText = s.name || '미입력';
    document.getElementById('viewEmail').innerText = s.email || '-';
    document.getElementById('viewSchool').innerText = s.school || '-';
    document.getElementById('viewPhone').innerText = s.phone || '-';
    document.getElementById('viewEmailFull').innerText = s.email || '-';
    document.getElementById('viewJoinDate').innerText = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-';

    const profileImg = document.getElementById('studentProfileImg');
    if(s.profileImage) profileImg.src = s.profileImage;

    currentTier = 'free';
    if (s.currentSubscription && s.currentSubscription.status === 'active') {
        currentTier = (s.currentSubscription.tier || "free").toLowerCase();
    } else {
        currentTier = calcTierFromLegacy(currentPaymentsData || []);
    }

    renderTierBadge(currentTier);
    
    const specialBtn = document.getElementById('btn-special');
    if (['pro'].includes(currentTier)) specialBtn.style.display = 'inline-block';
    else specialBtn.style.display = 'none';

    document.getElementById('adminMemoInput').value = s.adminMemo || '';

    renderTargetUnivs(s.targetUnivs || [], s.quantitative);
    renderQualitativeDetail(s.qualitative);
    
    initQuantitativeData(s.quantitative);
    
    renderPayments(currentPaymentsData);
    
    loadProReportsForAdmin();
}

function calcTierFromLegacy(payments) {
    if (!payments || payments.length === 0) return 'free';
    const paid = payments.filter(p => p.status === 'paid');
    if (paid.length === 0) return 'free';
    paid.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = (paid[0].product || "").toLowerCase();
    if (last.includes('pro')) return 'pro';
    if (last.includes('standard')) return 'standard';
    return 'basic';
}

function renderTierBadge(tier) {
    const area = document.getElementById('tierBadgeArea');
    let html = '';
    if (tier === 'pro') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #F59E0B, #FCD34D); border: 2px solid #F59E0B; color: #78350f;">PRO TIER</span>';
    else if (tier === 'standard') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #94A3B8, #CBD5E1); border: 2px solid #64748B; color: #0F172A;">STANDARD TIER</span>';
    else if (tier === 'basic') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #3B82F6, #60A5FA); border: 2px solid #3B82F6; color: white;">BASIC TIER</span>';
    else html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">FREE USER</span>';
    area.innerHTML = html;
}

function initQuantitativeData(q) {
    const selector = document.getElementById('scoreExamFilter');
    const container = document.getElementById('viewScoreTable');
    
    if (!q || Object.keys(q).length === 0) {
        selector.innerHTML = '<option value="">데이터 없음</option>';
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">입력된 성적이 없습니다.</p>';
        return;
    }
    
    const examNames = { 'mar': '3월 학평', 'apr': '4월 학평', 'may': '5월 학평', 'jun': '6월 모평', 'jul': '7월 학평', 'sep': '9월 모평', 'oct': '10월 학평', 'csat': '수능' };    
    const availableKeys = Object.keys(q).filter(k => q[k]);
    
    selector.innerHTML = '';
    availableKeys.forEach(key => {
        const label = examNames[key] || key;
        selector.innerHTML += `<option value="${key}">${label}</option>`;
    });

    if (availableKeys.length > 0) renderSelectedScore();
}

function renderSelectedScore() {
    const key = document.getElementById('scoreExamFilter').value;
    const container = document.getElementById('viewScoreTable');
    const q = currentStudentData.quantitative;

    if (!key || !q[key]) { container.innerHTML = ''; return; }

    const d = q[key];
    const subjects = [{k:'kor',n:'국어'}, {k:'math',n:'수학'}, {k:'eng',n:'영어'}, {k:'inq1',n:'탐1'}, {k:'inq2',n:'탐2'}];
    
    let html = `<div class="score-exam-block" style="margin-top:15px;"><table class="score-table"><thead><tr><th style="text-align: center;">과목</th><th style="text-align: center;">표점</th><th style="text-align: center;">등급</th></tr></thead><tbody>`;
    subjects.forEach(sub => {
        if(d[sub.k]) {
            html += `<tr><td data-label="과목" style="text-align: center;">${sub.n}</td><td data-label="표점" style="text-align: center;">${d[sub.k].std||'-'}</td><td data-label="등급" style="text-align: center;">${d[sub.k].grd||'-'}</td></tr>`;
        }
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function renderWeeklyTab() {
    const container = document.getElementById('weeklyListContainer');
    container.innerHTML = '';
    
    const weeklyHistory = currentWeeklyData || [];
    const selYear = document.getElementById('filterYear')?.value;
    const selMonth = document.getElementById('filterMonth')?.value;

    // 💡 1. 필터링 로직 수정: weekId('260401') 형식에서 년/월을 정확히 뽑아내어 드롭다운 값과 비교
    const filtered = weeklyHistory.filter(w => {
        const keyMatch = w.weekId?.match(/^(\d{2})(\d{2})\d{2}$/);
        let y = null, m = null;
        
        if (keyMatch) {
            y = "20" + keyMatch[1]; // '26' -> '2026'
            m = parseInt(keyMatch[2], 10).toString(); // '04' -> '4' (0 없애기)
        } else if (w.date) {
            const d = new Date(w.date);
            y = d.getFullYear().toString();
            m = (d.getMonth() + 1).toString();
        }
        
        const yearMatch = !selYear || y === selYear;
        const monthMatch = !selMonth || m === selMonth;
        
        return yearMatch && monthMatch;
    });

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:40px; color:#cbd5e1;">해당 월의 리포트가 없습니다.</div>';
        return;
    }

    filtered.forEach((d, idx) => {
        const dateStr = new Date(d.date).toLocaleDateString();
        const safeComment = d.comment ? escapeHtml(d.comment) : '';
        
        // 💡 2. 제목 렌더링 수정: formatReportKey 적용
        const displayTitle = formatReportKey(d.weekId, false) || d.title || (idx + 1) + '주차 리포트';
        
        let studyHtml = ''; 
        if (d.studyTime && Array.isArray(d.studyTime.details)) {
            let rows = '';
            d.studyTime.details.forEach(sub => {
                const rate = sub.plan > 0 ? Math.min((sub.act / sub.plan) * 100, 100).toFixed(0) : 0;
                const rateClass = rate >= 100 ? 'text-green' : (rate >= 80 ? 'text-blue' : 'text-gray');
                rows += `<tr><td style="text-align:left;">${escapeHtml(sub.subject)}</td><td class="text-center">${sub.plan}h</td><td class="text-center">${sub.act}h</td><td class="text-center font-bold ${rateClass}">${rate}%</td></tr>`;
            });
            studyHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clock"></i> 과목별 학습 달성도 (총 달성률: <span style="color:#2563eb;">${d.studyTime.totalRate || '0%'}</span>)</div><div class="table-responsive" style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch;"><table class="compact-table" style="min-width:300px; width:100%;"><thead><tr><th style="text-align:left;">과목</th><th class="text-center">계획</th><th class="text-center">실행</th><th class="text-center">달성</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
        }

        let checkHtml = '';
        if (d.deepAnswers && d.deepAnswers.length > 0) {
            const QUESTIONS = ['학습 계획 점검', '학습 방향성 설정', '취약 과목 솔루션', '기타 멘탈 관리'];
            const listItems = d.deepAnswers.map((ans, i) => {
               const questionLabel = QUESTIONS[i] ? `<span style="color:#1e293b; font-weight:800; margin-right:4px;">${QUESTIONS[i]}:</span>` : '';
               return `<li><i class="fas fa-check-circle text-blue" style="margin-top:4px; flex-shrink:0;"></i><div style="flex:1;">${questionLabel} ${escapeHtml(ans)}</div></li>`;
            }).join('');

            let trendHtml = '';
            if (d.trend) {
                const statusMap = { 'up': '상승세 🔥', 'down': '하락세 📉', 'keep': '유지중 -' };
                const statusText = statusMap[d.trend.status] || '유지중 -';
                let reasonHtml = '';
                
                if (d.trend.status === 'down' && Array.isArray(d.trend.reasons) && d.trend.reasons.length > 0) {
                    const reasonMap = { 'overplan': '계획 과다', 'sense': '실전 감각 저하', 'condition': '컨디션/건강', 'etc': '기타' };
                    const translatedReasons = d.trend.reasons.map(r => reasonMap[r] || r).join(', ');
                    reasonHtml = `<div style="font-size: 0.85rem; color: #dc2626; margin-top: 8px; padding: 8px 12px; background: #fef2f2; border-radius: 6px; display: inline-block; font-weight: normal; border: 1px solid #fecaca;">⚠️ <strong>원인:</strong> ${escapeHtml(translatedReasons)}</div>`;
                }
                
                trendHtml = `<div class="trend-badge ${d.trend.status || 'keep'}" style="display: flex; flex-direction: column; align-items: flex-start;"><div style="font-weight: bold;">학습 흐름: ${statusText}</div>${reasonHtml}</div>`;
            }

            checkHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clipboard-check"></i> 이번주 심층 질문</div><ul class="check-list">${listItems}</ul>${trendHtml}</div>`;
        }

        let mockHtml = '';
        if (d.mockExam && d.mockExam.scores) {
            const s = d.mockExam.scores;
            const typeMap = { 'school': '교내', 'edu': '평가원/교육청', 'private': '사설' };
            const typeLabel = typeMap[d.mockExam.type] || '기타'; 
            const typeBadge = `<span class="mock-type-badge ${d.mockExam.type || ''}">${typeLabel}</span>`;

            const scoreItems = [
                { l: '국어', v: s.kor }, { l: '수학', v: s.math }, { l: '영어', v: s.eng },
                { l: s.inq1Name || '탐1', v: s.inq1 }, { l: s.inq2Name || '탐2', v: s.inq2 }
            ].map(item => item.v ? `<div class="score-pill"><span class="lbl">${item.l}</span><span class="val">${item.v}</span></div>` : '').join('');

            let proofHtml = '';
            if (d.mockExam.proofFile && d.mockExam.proofFile.startsWith('http')) {
                proofHtml = `<div style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0; text-align:right;"><a href="${d.mockExam.proofFile}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; color:#2563eb; padding:8px 16px; border-radius:6px; text-decoration:none; font-size:0.85rem; font-weight:bold; transition:all 0.2s; white-space:nowrap;"><i class="fas fa-file-invoice"></i> 📝 모의고사 성적표 원본 보기</a></div>`;
            }

            mockHtml = `<div class="weekly-mock-box"><div class="mock-header"><i class="fas fa-edit"></i> 주간 모의고사 결과 ${typeBadge}</div><div class="score-pills-container">${scoreItems}</div>${proofHtml}</div>`;
        }

        let footerHtml = '';
        const hasFiles = d.plannerFiles && d.plannerFiles.length > 0;
        const hasComment = !!d.comment;

        if (hasFiles || hasComment) {
            let fileLinks = '';
            if (hasFiles) {
                fileLinks = d.plannerFiles.map((f, i) => {
                    let rawName = typeof f === 'string' ? decodeURIComponent(f.split('/').pop()) : `파일 ${i+1}`;
                    let cleanName = rawName.includes('_') ? rawName.split('_').slice(1).join('_') : rawName;
                    return `<a href="${f}" target="_blank" class="file-chip" style="display:inline-flex; align-items:center; gap:6px; background:#f8fafc; border:1px solid #cbd5e1; color:#334155; padding:8px 14px; border-radius:20px; text-decoration:none; font-size:0.85rem; margin:0 8px 8px 0; transition:all 0.2s;"><i class="fas fa-paperclip" style="color:#64748b;"></i> ${cleanName}</a>`;
                }).join('');
            }

            footerHtml = `<div class="weekly-section planner-auth-section" style="margin-top:20px; padding-top:20px; border-top:1px solid #e2e8f0; background:#ffffff;">${hasFiles ? `<div class="section-title" style="margin-bottom:15px; font-weight:bold; color:#1e293b;"><i class="fas fa-camera-retro" style="color:#10b981;"></i> 주간 플래너 인증 사진</div><div class="file-area" style="display:flex; flex-wrap:wrap;">${fileLinks}</div>` : ''}${hasComment ? `<div class="comment-box" style="margin-top:${hasFiles ? '15px' : '0'}; background:#f1f5f9; padding:15px; border-radius:8px; color:#334155; font-size:0.95rem;"><strong style="color:#2563eb;"><i class="fas fa-comment-dots"></i> 학생 전달사항:</strong><div style="margin-top:8px; line-height:1.6;">${safeComment}</div></div>` : ''}</div>`;
        }

        const fb = d.tutorFeedback || { priorityCheck: '', weakSubject: '', nextWeekTop3: '', planEvaluation: '', extraQuestion: '' };
        
        // 💡 3. 키값 설정 로직 (안전장치 포함)
        let weeklyKey = d.weekId;
        if (!weeklyKey) {
            const dateObj = new Date(d.date);
            const year = dateObj.getFullYear().toString().slice(2);
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
            const dayOfWeek = startOfMonth.getDay();
            const offsetDate = dateObj.getDate() + dayOfWeek - 1;
            const weekNum = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0');
            weeklyKey = `${year}${month}${weekNum}`;
        }

        const card = document.createElement('div');
        card.className = 'timeline-card weekly-new';
        card.innerHTML = `
            <div class="card-header-row">
                <div class="left">
                    <span class="week-title">${displayTitle}</span> <span class="week-date">${dateStr}</span>
                </div>
            </div>
            <div class="card-grid-body">${studyHtml}${checkHtml}</div>
            ${mockHtml}${footerHtml}
            ${renderWeeklyFeedbackArea(weeklyKey, fb)}
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 주간 리포트 - 튜터 코멘트 영역 렌더링
// ==========================================
const WEEKLY_FB_FIELDS = [
    { key: 'priorityCheck',  label: '이번 주 우선순위 점검',        placeholder: '이번 주 학습 목표 이행 여부와 우선순위를 평가해주세요.' },
    { key: 'weakSubject',    label: '취약 과목 진단 및 개입 포인트', placeholder: '취약 과목에 대한 구체적인 진단과 개선 방향을 작성해주세요.' },
    { key: 'nextWeekTop3',   label: '다음 주 핵심 과제 Top3',        placeholder: '다음 주에 집중해야 할 핵심 과제 3가지를 작성해주세요.' },
    { key: 'planEvaluation', label: '플랜 평가 및 조정',             placeholder: '이번 주 플랜 달성률을 평가하고 조정 방향을 제시해주세요.' },
    { key: 'extraQuestion',  label: '심층 질문 답변',                placeholder: '학생의 심층 질문에 대한 답변을 근거와 함께 작성해주세요.' },
];
const WEEKLY_FB_MIN = 150;

function weeklyIdKey(weeklyKey) {
    return weeklyKey.replace(/[^a-zA-Z0-9]/g, '_');
}

function renderWeeklyFeedbackArea(weeklyKey, fb) {
    const userRole = localStorage.getItem('userRole');
    const submitted = fb.submitted === true;
    if (userRole === 'tutor') {
        return submitted ? createWeeklyFbReadOnly(fb, true) : createWeeklyFbInput(weeklyKey, fb);
    }
    return createWeeklyFbReadOnly(fb, false);
}

function createWeeklyFbReadOnly(fb, isLockedTutor) {
    const hasAny = WEEKLY_FB_FIELDS.some(f => fb[f.key] && String(fb[f.key]).trim() !== '');
    const lockedBadge = isLockedTutor
        ? '<span style="font-size:0.8rem; color:#16a34a; font-weight:bold; background:#f0fdf4; padding:3px 10px; border-radius:20px; border:1px solid #bbf7d0;">✅ 최종 전송 완료 · 수정 불가</span>'
        : '';
        
    const content = hasAny
        ? WEEKLY_FB_FIELDS.map(f => fb[f.key] && String(fb[f.key]).trim() !== ''
            ? `<div style="margin-bottom:14px;"><strong>${f.label}:</strong><div style="margin-top:4px; line-height:1.6; white-space:pre-wrap;">${escapeHtml(fb[f.key])}</div></div>`
            : '').join('')
        : '<span style="color:#94a3b8">튜터가 코멘트를 작성하지 않았습니다.</span>';

    const fileHtml = fb.tutorImage 
        ? `<div style="margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:15px;"><strong>📎 첨삭 플래너 / 추가 자료:</strong><br><a href="${escapeHtml(fb.tutorImage)}" target="_blank" style="display:inline-block; margin-top:8px; background:#eff6ff; color:#2563eb; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:bold;"><i class="fas fa-file-download"></i> 첨부 파일 확인하기</a></div>` 
        : '';

    return `
        <div class="tutor-feedback-area">
            <div class="feedback-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div>👩‍🏫 튜터 코멘트</div>${lockedBadge}
            </div>
            <div class="doc-text" style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-top:10px;">
                ${content}
                ${fileHtml}
            </div>
        </div>`;
}

function createWeeklyFbInput(weeklyKey, fb) {
    const idk = weeklyIdKey(weeklyKey);
    const fieldsHtml = WEEKLY_FB_FIELDS.map(f => {
        const val = fb[f.key] || '';
        const len = val.replace(/\s/g, '').length;
        const validClass = len >= WEEKLY_FB_MIN ? 'valid' : '';
        
        const isSaved = len >= WEEKLY_FB_MIN;
        const btnClass = isSaved ? 'temp-save-btn saved' : 'temp-save-btn';
        const btnText = isSaved ? '저장됨' : '임시저장';

        return `
        <div class="write-item" style="margin-bottom:15px;">
            <label class="write-label">${f.label}</label>
            <textarea id="wfb_${idk}_${f.key}" class="write-textarea"
                placeholder="${f.placeholder} (최소 ${WEEKLY_FB_MIN}자)"
                oninput="updateCharCount(this,'wfb_cnt_${idk}_${f.key}',${WEEKLY_FB_MIN}); handleWeeklyInput('${idk}', '${f.key}');"
            >${escapeHtml(val)}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                <div id="wfb_cnt_${idk}_${f.key}" class="char-count ${validClass}">${len} / 최소 ${WEEKLY_FB_MIN}자</div>
                <button id="wfb_btn_${idk}_${f.key}" class="${btnClass}"
                    onclick="tempSaveWeeklyField('${weeklyKey}','${f.key}')">${btnText}</button>
            </div>
        </div>`;
    }).join('');

    const allPreSaved = WEEKLY_FB_FIELDS.every(f => (fb[f.key] || '').replace(/\s/g, '').length >= WEEKLY_FB_MIN);
    const submitBtnClass = allPreSaved ? 'complete-write-btn active' : 'complete-write-btn';

    const existingFileHtml = fb.tutorImage 
        ? `<div style="margin-bottom:10px; font-size:0.85rem; color:#2563eb; background:#eff6ff; padding:8px 12px; border-radius:6px; border:1px solid #bfdbfe;"><i class="fas fa-file-check"></i> 현재 첨부된 파일: <a href="${escapeHtml(fb.tutorImage)}" target="_blank" style="text-decoration:underline; font-weight:bold;">보기</a></div>` 
        : '';

    return `
        <div class="tutor-feedback-area" id="wfb_area_${idk}">
            <div class="feedback-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div>👩‍🏫 튜터 코멘트 작성</div>
                <button class="guide-btn" onclick="showCoachingGuideModal()"><i class="fas fa-info-circle"></i> 작성 가이드</button>
            </div>
            ${fieldsHtml}
            
            <div class="write-item" style="margin-bottom:15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
                <label class="write-label">첨삭 플래너 / 추가 자료 (선택)</label>
                
                <div id="wfb_existing_file_${idk}">${existingFileHtml}</div>
                
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="file" id="wfb_file_${idk}" accept="image/*,.pdf" style="font-size:0.9rem; padding:5px; border:1px solid #cbd5e1; border-radius:6px; flex:1; background:#fff;">
                    <button id="wfb_file_btn_${idk}" class="temp-save-btn" onclick="uploadWeeklyTutorFile('${weeklyKey}')" style="white-space:nowrap;"><i class="fas fa-upload"></i> 업로드</button>
                </div>
                <p style="font-size:0.8rem; color:#94a3b8; margin-top:5px;">* 이미지(jpg, png) 또는 PDF 파일만 업로드 가능합니다. (학생에게 리포트와 함께 전달됩니다)</p>
            </div>

            <div style="text-align:right; margin-top:10px;">
                <button id="wfb_submit_${idk}" class="${submitBtnClass}"
                    onclick="submitWeeklyFeedback('${weeklyKey}')">최종 전송 (학생에게 전달)</button>
            </div>
        </div>`;
}

window.handleWeeklyInput = function(idk, key) {
    const btn = document.getElementById(`wfb_btn_${idk}_${key}`);
    if (btn && btn.classList.contains('saved')) {
        btn.classList.remove('saved');
        btn.innerText = '임시저장';
    }
    checkWeeklyAllSaved(idk);
};

window.checkWeeklyAllSaved = function(idk) {
    const area = document.getElementById(`wfb_area_${idk}`);
    if (!area) return;
    
    const btns = area.querySelectorAll('.temp-save-btn');
    const allSaved = Array.from(btns).every(b => b.classList.contains('saved'));
    
    const submitBtn = document.getElementById(`wfb_submit_${idk}`);
    if (submitBtn) {
        if (allSaved) {
            submitBtn.classList.add('active');
        } else {
            submitBtn.classList.remove('active');
        }
    }
};

window.uploadWeeklyTutorFile = async function(weeklyKey) {
    const idk = weeklyIdKey(weeklyKey);
    const fileInput = document.getElementById(`wfb_file_${idk}`);
    if (!fileInput.files || fileInput.files.length === 0) return alert("업로드할 파일을 선택해주세요.");
    
    const file = fileInput.files[0];
    const btn = document.getElementById(`wfb_file_btn_${idk}`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중...';
    btn.disabled = true;

    try {
        // 1. S3 Presigned URL 발급
        const urlResponse = await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_presigned_url', data: { fileName: encodeURIComponent(file.name), fileType: file.type, folder: 'tutor_feedback' } })
        });
        const { uploadUrl, fileUrl, fields } = await urlResponse.json();
        
        // 2. S3 직접 업로드
        const formData = new FormData();
        Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v));
        formData.append('file', file);

        const uploadResult = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadResult.ok) throw new Error("S3 업로드 실패");

        // 3. 현재 입력된 텍스트 코멘트도 함께 모아서 DB 임시저장
        const feedback = {};
        WEEKLY_FB_FIELDS.forEach(f => {
            const el = document.getElementById(`wfb_${idk}_${f.key}`);
            feedback[f.key] = el ? el.value : '';
        });
        feedback.tutorImage = fileUrl; // 새로 업로드된 URL 포함

        // 4. 로컬 데이터 갱신 (저장 시 덮어씌워지지 않게 메모리 유지)
        const reportData = currentWeeklyData.find(w => w.weekId === weeklyKey || w.date === weeklyKey);
        if (reportData) {
            if (!reportData.tutorFeedback) reportData.tutorFeedback = {};
            reportData.tutorFeedback.tutorImage = fileUrl;
        }

        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_save_weekly_draft', data: { targetUserId, reportDate: weeklyKey, tutorFeedback: feedback } })
        });
        
        alert("파일이 성공적으로 업로드되었습니다.");
        
        // 💡 [핵심 해결책] 탭 전체 새로고침 삭제! 대신 해당 UI 부분만 즉시 업데이트합니다.
        const existingContainer = document.getElementById(`wfb_existing_file_${idk}`);
        if (existingContainer) {
            existingContainer.innerHTML = `<div style="margin-bottom:10px; font-size:0.85rem; color:#2563eb; background:#eff6ff; padding:8px 12px; border-radius:6px; border:1px solid #bfdbfe;"><i class="fas fa-file-check"></i> 현재 첨부된 파일: <a href="${escapeHtml(fileUrl)}" target="_blank" style="text-decoration:underline; font-weight:bold;">보기</a></div>`;
        }
        
        // 파일 인풋 초기화 (안 헷갈리게) 및 버튼 원상복구
        fileInput.value = '';
        btn.innerHTML = originalText;
        btn.disabled = false;

    } catch (e) {
        if (e.message !== "Auth expired") alert("파일 업로드에 실패했습니다.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.tempSaveWeeklyField = async function(weeklyKey, fieldName) {
    const idk = weeklyIdKey(weeklyKey);
    const btn = document.getElementById(`wfb_btn_${idk}_${fieldName}`);
    const textarea = document.getElementById(`wfb_${idk}_${fieldName}`);
    if (!btn || !textarea) return;

    const val = textarea.value;
    const valLen = val.replace(/\s/g, '').length;
    if (valLen < WEEKLY_FB_MIN) {
        alert(`최소 ${WEEKLY_FB_MIN}자 이상 입력해주세요. (현재 ${valLen}자, 공백 제외)`);
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = '저장 중...'; btn.disabled = true;

    // 기존 데이터 메모리에서 파일 URL 가져오기
    const reportData = currentWeeklyData.find(w => w.weekId === weeklyKey || w.date === weeklyKey) || {};
    const existingFb = reportData.tutorFeedback || {};

    const feedback = {};
    WEEKLY_FB_FIELDS.forEach(f => {
        const el = document.getElementById(`wfb_${idk}_${f.key}`);
        feedback[f.key] = el ? el.value : '';
    });
    feedback.tutorImage = existingFb.tutorImage || ''; // 기존 파일 URL 유지

    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_save_weekly_draft', data: { targetUserId, reportDate: weeklyKey, tutorFeedback: feedback } })
        });
        btn.classList.add('saved'); btn.innerText = '저장됨'; btn.disabled = false;
        checkWeeklyAllSaved(idk);
    } catch (e) {
        if (e.message !== 'Auth expired') alert('임시 저장에 실패했습니다.');
        btn.innerText = originalText; btn.disabled = false;
    }
};

window.submitWeeklyFeedback = async function(weeklyKey) {
    const idk = weeklyIdKey(weeklyKey);

    for (const f of WEEKLY_FB_FIELDS) {
        const el = document.getElementById(`wfb_${idk}_${f.key}`);
        if (!el || el.value.replace(/\s/g, '').length < WEEKLY_FB_MIN) {
            alert(`'${f.label}' 항목을 최소 ${WEEKLY_FB_MIN}자 이상 입력해주세요. (공백 제외)`);
            return;
        }
    }

    if (!confirm('최종 전송 후에는 더 이상 수정할 수 없습니다.\n학생에게 코멘트를 전달하시겠습니까?')) return;

    // 기존 데이터 메모리에서 파일 URL 가져오기
    const reportData = currentWeeklyData.find(w => w.weekId === weeklyKey || w.date === weeklyKey) || {};
    const existingFb = reportData.tutorFeedback || {};

    const feedback = {};
    WEEKLY_FB_FIELDS.forEach(f => {
        const el = document.getElementById(`wfb_${idk}_${f.key}`);
        feedback[f.key] = el ? el.value : '';
    });
    feedback.tutorImage = existingFb.tutorImage || ''; // 기존 파일 URL 유지
    feedback.submitted = true;

    const submitBtn = document.getElementById(`wfb_submit_${idk}`);
    if (submitBtn) { submitBtn.innerText = '전송 중...'; submitBtn.disabled = true; }

    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_submit_weekly_feedback', data: { targetUserId, reportDate: weeklyKey, tutorFeedback: feedback } })
        });
        alert('학생에게 코멘트가 전달되었습니다.');
        
        // 제출 후 폼을 읽기 전용으로 전환
        const area = document.getElementById(`wfb_area_${idk}`);
        if (area) area.outerHTML = createWeeklyFbReadOnly(feedback, true);
        
    } catch (e) {
        if (e.message !== 'Auth expired') alert('전송에 실패했습니다.');
        if (submitBtn) { submitBtn.innerText = '최종 전송 (학생에게 전달)'; submitBtn.disabled = false; }
    }
};

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

    // 💡 필터 로직 추가: reportKey (예: 260401 또는 2024-W10) 기준으로 필터링
    const filtered = reports.filter(r => {
        const keyMatch = r.key?.match(/^(\d{2})(\d{2})\d{2}$/); // 신규 포맷 260401
        const oldMatch = r.key?.match(/^(\d{4})-W(\d{1,2})$/); // 구 포맷 2024-W10
        let y = null, m = null;

        if (keyMatch) {
            y = "20" + keyMatch[1]; // '26' -> '2026'
            m = parseInt(keyMatch[2], 10).toString(); // '04' -> '4'
        } else if (oldMatch) {
            y = oldMatch[1];
            // 구 포맷은 정확한 월을 알기 어려워 업데이트 날짜로 추정
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

async function renderTargetUnivs(list, quantData) {
    const container = document.getElementById('viewTargetUnivList');
    container.innerHTML = '';

    const validList = [];
    list.forEach((u, originalIdx) => { if (u && u.univ) validList.push({ ...u, originalIdx }); });
    if (validList.length === 0) { container.innerHTML = '<p style="color:#94a3b8;">설정된 목표 대학이 없습니다.</p>'; return; }

    const examMode = 'mar';
    const hasMarScore = quantData && quantData[examMode] && (quantData[examMode].kor || quantData[examMode].math || quantData[examMode].eng);

    validList.forEach((u, idx) => {
        const div = document.createElement('div'); div.className = 'target-univ-item';
        const dateStr = u.date ? new Date(u.date).toLocaleDateString() + ' 선택' : '날짜 정보 없음';
        const choiceNum = u.originalIdx + 1;

        div.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px;"><strong>${choiceNum}지망. ${escapeHtml(u.univ)}</strong><div class="major">${escapeHtml(u.major)}</div></div>
            <div class="sim-summary-box empty" id="sim-box-${idx}">${hasMarScore ? '<div style="text-align:center; padding:10px; color:#3b82f6;"><i class="fas fa-spinner fa-spin"></i> 분석 중...</div>' : '<div class="sim-exam-label" style="color:#94a3b8;"><i class="fas fa-exclamation-circle"></i> 3월 학평 기준</div><div style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:5px 0;">성적 데이터 없음</div>'}</div>
            <div class="date">${dateStr}</div>
        `;
        container.appendChild(div);
    });

    if (!hasMarScore) return;

    try {
        const res = await apiFetch(CONFIG.api.analysis, {
            method: 'POST',
            body: JSON.stringify({ type: 'simulate_score_rise', userId: targetUserId, targetUnivs: validList, userScores: quantData[examMode], examMode: examMode })
        });
        const simData = await res.json();

        validList.forEach((u, idx) => {
            const box = document.getElementById(`sim-box-${idx}`);
            const data = Array.isArray(simData)
                ? simData.find(d => d && d.univ === u.univ && d.major === u.major)
                : simData[idx];
            if (data && typeof data.base_ui_score !== 'undefined' && data.sim_data) {
                const currentScore = data.base_ui_score.toFixed(2);
                let maxRise = 0; let bestSubName = '-';
                const subjects = [{ key: 'kor', name: '국어' }, { key: 'math', name: '수학' }, { key: 'inq1', name: data.sim_data.inq1?.name || '탐구1' }, { key: 'inq2', name: data.sim_data.inq2?.name || '탐구2' }];

                subjects.forEach(sub => { const info = data.sim_data[sub.key]; if (info && info.uiDiff > maxRise) { maxRise = info.uiDiff; bestSubName = sub.name; } });
                box.className = 'sim-summary-box';
                box.innerHTML = `<div class="sim-exam-label"><i class="fas fa-bolt"></i> 3월 학평 기준 시뮬레이션</div><div class="sim-score-row"><span>현재 환산</span><strong>${currentScore}점</strong></div><div class="sim-score-row"><span>+1점 효율</span><span class="sim-highlight">${bestSubName} (+${maxRise.toFixed(2)}점)</span></div>`;
            } else { box.innerHTML = `<div style="font-size:0.8rem; color:#ef4444; text-align:center; padding:5px 0;"><i class="fas fa-ban" style="margin-right:4px;"></i>지원 불가 (분석 데이터 없음)</div>`; }
        });
    } catch (e) { console.error("Simulation API Error:", e); validList.forEach((u, idx) => { const box = document.getElementById(`sim-box-${idx}`); if (box) box.innerHTML = `<div style="font-size:0.8rem; color:#ef4444; text-align:center; padding:5px 0;">분석 서버 오류</div>`; }); }
}

function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) { area.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">데이터가 없습니다.</p>'; return; }
    
    const v = (val) => val ? escapeHtml(val) : '-';
    
    area.innerHTML = `
        <div class="qual-section"><div class="qual-head">📍 현재 상황</div><div class="qual-grid">
            <div class="qual-item"><span class="detail-label">학년</span><div>${v(q.status)}</div></div><div class="qual-item"><span class="detail-label">출신 학교</span><div>${v(q.school)}</div></div><div class="qual-item"><span class="detail-label">희망계열</span><div>${v(q.stream)}</div></div><div class="qual-item"><span class="detail-label">희망진로</span><div>${v(q.career)}</div></div>
        </div></div>
        <div class="qual-section"><div class="qual-head">📍 원서 가치관</div><div class="qual-grid">
            <div class="qual-item"><span class="detail-label">필수 진학 여부</span><div>${v(q.values?.mustGo)}</div></div><div class="qual-item"><span class="detail-label">우선순위</span><div>${v(q.values?.priority)}</div></div><div class="qual-item"><span class="detail-label">지원 전략</span><div>${v(q.values?.strategy)}</div></div><div class="qual-item"><span class="detail-label">지역 범위</span><div>${v(q.values?.region)}</div></div><div class="qual-item"><span class="detail-label">최악의 시나리오</span><div>${v(q.values?.worst)}</div></div><div class="qual-item"><span class="detail-label">교차지원 가능 여부</span><div>${v(q.values?.cross)}</div></div>
        </div></div>
        <div class="qual-section"><div class="qual-head">📍 대학 후보군 상세</div><div class="qual-grid">
            <div class="qual-item"><span class="detail-label">가군 관심 대학</span><div>${v(q.candidates?.ga)}</div></div><div class="qual-item"><span class="detail-label">나군 관심 대학</span><div>${v(q.candidates?.na)}</div></div><div class="qual-item"><span class="detail-label">다군 관심 대학</span><div>${v(q.candidates?.da)}</div></div><div class="qual-item"><span class="detail-label">1순위 희망 대학 (이유)</span><div>${v(q.candidates?.most)}</div></div><div class="qual-item"><span class="detail-label">기피 대학 (이유)</span><div>${v(q.candidates?.least)}</div></div><div class="qual-item"><span class="detail-label">본인 감각 (상/적/안)</span><div>${v(q.candidates?.self)}</div></div>
        </div></div>
        <div class="qual-section"><div class="qual-head">📍 최종 희망 대학 리스트</div><div class="qual-grid">
            ${q.targets && Array.isArray(q.targets) ? q.targets.map((t, i) => `<div class="qual-item"><span class="detail-label">${i+1}지망</span><div>${v(t)}</div></div>`).join('') : '<div class="qual-item">데이터 없음</div>'}
        </div></div>
        <div class="qual-section"><div class="qual-head">📍 부모님 / 환경 요인</div><div class="qual-grid">
            <div class="qual-item"><span class="detail-label">부모님 의견 영향도</span><div>${v(q.parents?.influence)}</div></div><div class="qual-item"><span class="detail-label">부모님 추천/반대 대학</span><div>${v(q.parents?.opinion)}</div></div>
        </div></div>
        <div class="qual-section"><div class="qual-head">📍 특이사항</div><div class="qual-grid">
            <div class="qual-item"><span class="detail-label">편입 계획</span><div>${v(q.special?.transfer)}</div></div><div class="qual-item"><span class="detail-label">교직 이수</span><div>${v(q.special?.teaching)}</div></div><div class="qual-item" style="grid-column: 1 / -1;"><span class="detail-label">기타 멘토에게 하고 싶은 말</span><div>${v(q.special?.etc)}</div></div>
        </div></div>
    `;
}

function renderPayments(p) {
    const listBody = document.getElementById('viewPaymentList');
    const totalEl = document.getElementById('payTotalAmount');
    const lastDateEl = document.getElementById('payLastDate');
    listBody.innerHTML = "";
    if (p && p.length > 0) {
        const sortedP = [...p].sort((a,b) => new Date(b.date) - new Date(a.date));
        let total = 0;
        sortedP.forEach(item => total += parseInt(item.amount || 0));
        totalEl.innerText = total.toLocaleString() + "원";
        lastDateEl.innerText = new Date(sortedP[0].date).toLocaleDateString();
        sortedP.forEach(pay => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td data-label="결제 상품">${escapeHtml(pay.product)}</td><td data-label="결제 일시">${new Date(pay.date).toLocaleString()}</td><td data-label="금액" style="text-align:right;">${parseInt(pay.amount).toLocaleString()}원</td>`;
            listBody.appendChild(tr);
        });
    } else {
        totalEl.innerText = "0원"; lastDateEl.innerText = "-";
        listBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px;">결제 내역 없음</td></tr>`;
    }
}

async function saveAdminMemo() {
    const memo = document.getElementById('adminMemoInput').value;
    try {
        await apiFetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                type: 'admin_update_memo', 
                data: { targetUserId: targetUserId, memo: memo } 
            }) 
        });
        alert("메모 저장 완료");
    } catch(e) { 
        if (e.message !== "Auth expired") alert("저장 실패: 서버 응답을 확인해주세요."); 
    }
}
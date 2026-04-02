// js/admin_ui.js

// 1. 차트 플러그인 등록
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// 2. 전역 변수 및 설정
const ADMIN_API_URL = CONFIG.api.admin;
const NOTI_API_URL = CONFIG.api.noti;
const QNA_API_URL = CONFIG.api.qna;

// 차트 관련 변수
let salesChart = null;  
let periodChart = null; 
let rawPaymentData = []; 

// Q&A 관련 변수 (New)
let allQnaData = []; // 서버에서 가져온 전체 질문 리스트
let currentQnaFilter = 'waiting'; // 현재 탭 상태 (waiting | read | done)
let currentReplyTarget = null; // 현재 답변 작성 중인 대상 {userId, qnaId}

// 3. 초기화 (진입점)
document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    // 보안: 관리자 권한 체크
    if (!userId || role !== 'admin') {
        alert("관리자 권한이 없습니다.");
        window.location.href = '/';
        return;
    }

    // 초기 데이터 로드
    loadAdminStats(userId);
    searchStudents();
    fetchUnreadNotiCount();
    
    // 검색창에서 엔터키 누르면 검색 실행
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchStudents();
        });
    }
    
    setTimeout(() => loadMatchingData(true), 1500);
});

// 💡 공통 apiFetch 함수
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

// ============================================================
// [A] 네비게이션 및 UI 제어
// ============================================================
function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.menu-item > a').forEach(el => { el.style.backgroundColor = ''; el.style.color = '#cbd5e1'; });
    document.querySelectorAll('.submenu li a').forEach(el => { el.style.color = '#94a3b8'; });
    
    const clickedLink = document.querySelector(`a[onclick*="showSection('${sectionName}')"]`) || 
                        document.querySelector(`a[onclick*="showQnaSection"]`) ||
                        document.querySelector(`a[onclick*="showNotiMenu"]`);
                        
    if (clickedLink) {
        if (clickedLink.closest('.submenu')) {
            clickedLink.style.color = '#60a5fa'; 
            const parentMenu = clickedLink.closest('.has-submenu').querySelector('a');
            if(parentMenu) parentMenu.style.color = '#60a5fa'; 
        } else {
            clickedLink.style.backgroundColor = '#334155'; clickedLink.style.color = 'white'; 
        }
    }
    
    const secMap = {
        'students': 'section-students', 'dashboard': 'section-dashboard', 'advanced-stats': 'section-advanced-stats',
        'tutors': 'section-tutors', 'notifications': 'section-notifications', 'qna': 'section-qna', 'matching': 'section-matching'
    };

    if (secMap[sectionName]) {
        document.getElementById(secMap[sectionName]).classList.add('active');
        if (sectionName !== 'sales-chart') window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (sectionName === 'sales-chart') {
        document.getElementById('section-dashboard').classList.add('active');
        const anchor = document.getElementById('chart-section-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionName === 'tutors') loadTutorStats(); 
    else if (sectionName === 'notifications') { loadNotifications(); loadTutorListForNotice(); }
    else if (sectionName === 'matching') loadMatchingData(); 
}

window.showQnaSection = function(status) {
    showSection('qna'); 
    currentQnaFilter = status; 
    const titleMap = { 'done': '✅ 응답 완료', 'read': '👁️ 읽음 (미응답)', 'waiting': '🔴 읽지 않음' };
    document.getElementById('qnaStatusTitle').innerText = `- ${titleMap[status]}`;
    loadAllQna(); 
};

// ============================================================
// [B] 통계 및 차트 로직
// ============================================================
async function loadAdminStats(adminId) {
    try {
        const response = await apiFetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_stats', userId: adminId })
        });
        
        const data = await response.json();
        
        document.getElementById('totalStudents').innerText = `${data.totalStudents || 0}명`; 
        document.getElementById('totalRevenue').innerText = `${(data.totalRevenue || 0).toLocaleString()}원`;
        document.getElementById('monthlyRevenue').innerText = `${(data.monthlyRevenue || 0).toLocaleString()}원`;

        const tbody = document.getElementById('advancedStatsTableBody');
        if (tbody && data.studentDetails) {
            tbody.innerHTML = '';
            if (data.studentDetails.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">결제 내역이 있는 학생이 없습니다.</td></tr>';
            } else {
                data.studentDetails.forEach(s => {
                    const refHtml = s.referral === 'O' ? '<span style="color:#3b82f6; font-weight:bold;">O</span>' : '<span style="color:#94a3b8;">X</span>';
                    const safeUpsellPath = escapeHtml(s.upsellPath);
                    const upsellHtml = safeUpsellPath.includes('➔') ? `<span style="color:#f59e0b; font-weight:bold;">${safeUpsellPath}</span>` : `<span style="color:#64748b;">${safeUpsellPath}</span>`;

                    tbody.innerHTML += `
                        <tr>
                            <td data-label="학생명 (이메일)"><strong>${escapeHtml(s.name)}</strong><br><span style="font-size:0.8rem; color:#94a3b8;">${escapeHtml(s.email)}</span></td>
                            <td data-label="누적 결제액" style="font-weight:bold; color:#1e293b;">${s.totalPaid.toLocaleString()}원</td>
                            <td data-label="총 이용 기간">${s.weeksActive}주</td>
                            <td data-label="업셀링 경로">${upsellHtml}</td>
                            <td data-label="레퍼럴 유입" style="text-align:center;">${refHtml}</td>
                        </tr>
                    `;
                });
            }
        }

        rawPaymentData = data.allPayments || [];
        updateCharts();

    } catch (error) {
        if (error.message !== "Auth expired") alert("통계 정보를 불러오지 못했습니다.");
    }
}

function updateCharts() {
    const selector = document.getElementById('periodSelector');
    const periodType = selector ? selector.value : 'month';
    const aggregated = aggregateData(rawPaymentData, periodType);
    
    renderPeriodChart(aggregated.labels, aggregated.amounts);
    renderProductChart(aggregated.productCounts, aggregated.totalAmount);
}

function aggregateData(payments, type) {
    const timeMap = {}; const productMap = {}; let totalForPeriod = 0;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const oneQuarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

    payments.forEach(pay => {
        const date = new Date(pay.date);
        let key = ""; let isIncludedInPieChart = false;

        if (type === 'week') {
            const year = date.getFullYear(); const week = getWeekNumber(date);
            key = `${year}-W${week.toString().padStart(2, '0')}`; 
            if (date >= oneWeekAgo) isIncludedInPieChart = true;
        } else if (type === 'month') {
            key = pay.date.substring(0, 7); 
            if (date >= oneMonthAgo) isIncludedInPieChart = true;
        } else if (type === 'quarter') {
            const year = date.getFullYear(); const q = Math.floor(date.getMonth() / 3) + 1;
            key = `${year}-Q${q}`; 
            if (date >= oneQuarterAgo) isIncludedInPieChart = true;
        }

        timeMap[key] = (timeMap[key] || 0) + pay.amount;
        if (isIncludedInPieChart) {
            const prod = pay.product || "기타";
            productMap[prod] = (productMap[prod] || 0) + pay.amount;
            totalForPeriod += pay.amount;
        }
    });

    const labels = Object.keys(timeMap).sort();
    const amounts = labels.map(k => timeMap[k]);

    return { labels, amounts, productCounts: productMap, totalAmount: totalForPeriod };
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function renderPeriodChart(labels, data) {
    const ctx = document.getElementById('periodChart'); if (!ctx) return;
    if (periodChart) periodChart.destroy();
    periodChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels.length ? labels : ['데이터 없음'], datasets: [{ label: '매출액', data: data.length ? data : [0], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3, pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '₩' + v.toLocaleString() } } } }
    });
}

function renderProductChart(productMap, total) {
    const ctx = document.getElementById('salesChart'); if (!ctx) return;
    const labels = Object.keys(productMap); const values = Object.values(productMap);
    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels.length ? labels : ['데이터 없음'], datasets: [{ data: values.length ? values : [1], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, formatter: (value, ctx) => { if (total === 0 || (value / total) < 0.05) return ''; return ((value / total) * 100).toFixed(1) + "%"; } } } }
    });
}

// ============================================================
// [C] 학생 관리 로직
// ============================================================
async function searchStudents() {
    const adminId = localStorage.getItem('userId');
    const type = document.getElementById('searchType').value; 
    const keyword = document.getElementById('searchInput').value || ""; 
    const tbody = document.getElementById('studentListBody');

    tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>데이터 조회 중...</td></tr>";

    try {
        const response = await apiFetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_search', userId: adminId, data: { searchType: type, keyword: keyword } })
        });
        
        const rawData = await response.json();
        let students = Array.isArray(rawData) ? rawData : (rawData.students || []);
        students = students.filter(s => s.role !== 'admin' && s.role !== 'tutor');
        
        // 💡 [수정] 분리된 구독 정보(currentSubscription)를 기준으로 필터링 적용
        if (students.length > 0) {
            if (type === 'paid') {
                students = students.filter(s => s.currentSubscription && s.currentSubscription.status === 'active');
            } else if (type === 'unpaid') {
                students = students.filter(s => !s.currentSubscription || s.currentSubscription.status !== 'active');
            }
        }

        tbody.innerHTML = "";
        
        if (students.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>조건에 맞는 학생이 없거나 데이터를 불러올 수 없습니다.</td></tr>";
            return;
        }

        students.forEach(s => {
            // 💡 [수정] 뱃지 출력 시 배열이 아닌 구독 객체 전달
            let statusBadge = getTierBadgeHTML(s);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="이름"><strong>${escapeHtml(s.name) || '(이름없음)'}</strong></td>
                <td data-label="이메일">${escapeHtml(s.email) || '-'}</td>
                <td data-label="학교">${escapeHtml(s.school) || '-'}</td>
                <td data-label="상태">${statusBadge}</td>
                <td data-label="관리">
                    <div class="action-buttons">
                        <button class="btn-detail" onclick="goToStudentDetail('${s.userid}')">상세관리</button>
                        <button class="btn-up" onclick="openGrantTierModal('${s.userid}', '${escapeHtml(s.name)}')">등급UP</button>
                        <button class="btn-del" onclick="openForceDeleteModal('${s.userid}', '${escapeHtml(s.name)}')">강제탈퇴</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        if (error.message !== "Auth expired") tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>학생 데이터를 불러오는 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</td></tr>";
    }
}

function goToStudentDetail(targetUserId) { window.location.href = `/admin/detail?uid=${targetUserId}`; }

// 💡 [수정] 새로운 구독 스키마 기반 등급 뱃지 함수
function getTierBadgeHTML(studentItem) {
    if (!studentItem || !studentItem.currentSubscription || studentItem.currentSubscription.status !== 'active') {
        return '<span style="color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:12px; font-size:0.8rem;">FREE</span>';
    }
    
    const tier = (studentItem.currentSubscription.tier || "").toUpperCase();

    if (tier.includes('BLACK')) return '<span style="color:#FFD700; background:#171717; padding:4px 8px; border-radius:12px; font-size:0.8rem; border:1px solid #333; font-weight:bold;">BLACK</span>';
    else if (tier.includes('PRO')) return '<span style="color:#92400e; background:#fef3c7; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">PRO</span>';
    else if (tier.includes('STANDARD')) return '<span style="color:#334155; background:#e2e8f0; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">STANDARD</span>';
    else return '<span style="color:#1e40af; background:#dbeafe; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">BASIC</span>';
}

// ============================================================
// [D] 질의 관리(Q&A) 로직
// ============================================================
async function loadAllQna() {
    const tbody = document.getElementById('qnaListBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await apiFetch(QNA_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_all_qna' }) });
        const data = await response.json();
        allQnaData = data.qnaList || [];
        renderQnaList();
    } catch (e) { if (e.message !== "Auth expired") alert("질의 목록을 불러오는데 실패했습니다."); }
}

function renderQnaList() {
    const tbody = document.getElementById('qnaListBody'); if (!tbody) return;
    tbody.innerHTML = '';
    const filtered = allQnaData.filter(q => q.status === currentQnaFilter);

    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty-msg" style="text-align:center; padding:30px;">해당 상태의 문의가 없습니다.</td></tr>'; return; }

    filtered.forEach(q => {
        const tr = document.createElement('tr'); const dateStr = new Date(q.createdAt).toLocaleDateString();
        let actionBtn = '';
        if (q.status === 'waiting') actionBtn = `<button onclick="markAsRead('${q.userid}', '${q.qnaId}')" style="background:#f59e0b; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">읽음 처리</button>`;
        else if (q.status === 'read') actionBtn = `<button onclick="openReplyModal('${q.userid}', '${q.qnaId}')" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">답변하기</button>`;
        else actionBtn = `<span style="color:#10b981; font-weight:bold;">완료됨</span>`;

        tr.innerHTML = `<td data-label="상태">${getQnaStatusBadge(q.status)}</td><td data-label="학생명">${escapeHtml(q.userName)}<br><span style="font-size:0.8rem; color:#94a3b8;">${q.userPhone || '-'}</span></td><td data-label="제목" style="cursor:pointer;" onclick="openReplyModal('${q.userid}', '${q.qnaId}', true)"><strong>${escapeHtml(q.title)}</strong><div style="font-size:0.85rem; color:#64748b; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:300px;">${escapeHtml(q.content)}</div></td><td data-label="등록일">${dateStr}</td><td data-label="관리">${actionBtn}</td>`;
        tbody.appendChild(tr);
    });
}

function getQnaStatusBadge(status) {
    if (status === 'waiting') return '<span style="background:#fef2f2; color:#ef4444; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">안읽음</span>';
    if (status === 'read') return '<span style="background:#fff7ed; color:#f97316; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">미응답</span>';
    return '<span style="background:#ecfdf5; color:#10b981; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">완료</span>';
}

async function markAsRead(targetUserId, qnaId) {
    if(!confirm("이 문의를 '읽음' 상태로 변경하시겠습니까?")) return;
    try {
        await apiFetch(QNA_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_mark_qna_read', data: { targetUserId, qnaId } }) });
        const item = allQnaData.find(q => q.qnaId === qnaId); 
        if(item) item.status = 'read';
        
        renderQnaList(); 
    } catch(e) { 
        if (e.message !== "Auth expired") alert("상태 업데이트에 실패했습니다. 네트워크 연결을 확인해주세요."); 
    }
}

function openReplyModal(targetUserId, qnaId, isViewOnly = false) {
    const item = allQnaData.find(q => q.qnaId === qnaId); 
    if (!item) return; 
    
    currentReplyTarget = { targetUserId, qnaId };
    
    document.getElementById('replyModalTitle').innerText = item.title; 
    document.getElementById('replyModalContent').innerText = item.content;
    const replyInput = document.getElementById('replyInput'); 
    const submitBtn = document.querySelector('#reply-modal button');

    if (item.status === 'done' || isViewOnly) { 
        replyInput.value = item.answer || "(답변 내용 없음)"; 
        replyInput.disabled = true; 
        submitBtn.style.display = 'none'; 
    } else { 
        replyInput.value = ''; 
        replyInput.disabled = false; 
        submitBtn.style.display = 'block'; 
    }
    
    const modal = document.getElementById('reply-modal'); 
    if (modal) modal.classList.remove('hidden');
}

async function submitReply() {
    const answer = document.getElementById('replyInput').value.trim();
    if (!answer) { alert("답변 내용을 입력해주세요."); return; }
    if (!currentReplyTarget || !confirm("답변을 전송하시겠습니까?\n전송 후에는 수정할 수 없으며 학생에게 노출됩니다.")) return;

    try {
        await apiFetch(QNA_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ type: 'admin_reply_qna', data: { targetUserId: currentReplyTarget.targetUserId, qnaId: currentReplyTarget.qnaId, answer: answer } }) 
        });
        
        const qnaTitle = document.getElementById('replyModalTitle').innerText;
        await apiFetch(NOTI_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ type: 'admin_notify_qna_reply', data: { targetUserId: currentReplyTarget.targetUserId, qnaTitle: qnaTitle } }) 
        }).catch(e => {});

        alert("답변이 전송되었습니다.");
        
        // 💡 수정됨: q.id -> q.qnaId
        const item = allQnaData.find(q => q.qnaId === currentReplyTarget.qnaId); 
        if(item) { 
            item.status = 'done'; 
            item.answer = answer; 
        }
        
        closeReplyModal(); 
        renderQnaList(); 
    } catch(e) { 
        if (e.message !== "Auth expired") alert("답변 전송 중 문제가 발생했습니다. 작성하신 내용을 복사한 뒤 창을 새로고침 해주세요."); 
    }
}

function closeReplyModal() { const modal = document.getElementById('reply-modal'); if (modal) modal.classList.add('hidden'); currentReplyTarget = null; }


// ============================================================
// [E] 튜터 관리 로직
// ============================================================
async function loadTutorStats() {
    const container = document.getElementById('tutorListBody');
    container.innerHTML = '<p style="text-align:center;">데이터를 불러오는 중...</p>';

    try {
        const response = await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_tutor_stats' }) });
        const data = await response.json();
        
        container.innerHTML = '';
        if (data.tutors.length === 0) { container.innerHTML = '<p style="text-align:center;">등록된 튜터가 없습니다.</p>'; return; }

        data.tutors.forEach(t => {
            const card = document.createElement('div'); card.className = 'tutor-card';
            let withdrawalUI = '';
            if (t.withdrawalStatus === 'pending') {
                withdrawalUI = `<div style="margin-top:15px; padding:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; display:flex; justify-content:space-between; align-items:center;"><span style="color:#991b1b; font-size:0.9rem;"><strong>⚠️ 파트너십 해지(탈퇴) 요청 대기 중</strong></span><button onclick="approveTutorWithdrawal('${t.userid}')" style="padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.85rem; font-weight:bold;">요청 승인하기</button></div>`;
            } else if (t.withdrawalStatus === 'approved') {
                withdrawalUI = `<div style="margin-top:15px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;"><span style="color:#475569; font-size:0.9rem;"><strong>✅ 탈퇴 승인 완료</strong> (튜터의 최종 확인 및 탈퇴 대기 중)</span></div>`;
            }

            card.innerHTML = `
                <div class="tutor-header" onclick="toggleTutorDetail(this)">
                    <div class="tutor-info-main"><span class="tutor-badge">Tutor</span><span class="tutor-name">${escapeHtml(t.nickname)}</span><span style="font-size:0.85rem; color:#94a3b8; margin-left:8px;">(총 ${t.totalStudents}명)</span>${t.withdrawalStatus === 'pending' ? '<span style="color:#ef4444; font-size:0.8rem; font-weight:bold; margin-left:5px;">[탈퇴요청]</span>' : ''}</div>
                    <div class="tutor-arrow"><i class="fas fa-chevron-down"></i></div>
                </div>
                <div class="tutor-details">
                    <div class="tutor-grid" style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px dashed #e2e8f0;">
                        <div><p><strong>본명:</strong> ${escapeHtml(t.name) || '-'}</p><p><strong>학교:</strong> ${escapeHtml(t.school) || '-'}</p><p><strong>계약시작일:</strong> ${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</p></div>
                        <div><p><strong>최대 학생 수:</strong> <span style="color:#2563eb; font-weight:bold;">${t.maxStudents ? t.maxStudents + '명' : '미설정'}</span></p><p><strong>주 최대 시간:</strong> <span style="color:#2563eb; font-weight:bold;">${t.maxHours ? t.maxHours + '시간' : '미설정'}</span></p><p><strong>입금 계좌:</strong> ${escapeHtml(t.accountNumber) || '<span style="color:#94a3b8">미등록</span>'}</p></div>
                    </div>
                    ${withdrawalUI}
                    <div class="tutor-tier-accordions" style="${t.withdrawalStatus ? 'margin-top:20px;' : ''}">
                        <div class="tier-acc-group"><div class="tier-acc-header pro" onclick="toggleTierList(this)"><span>🔥 PRO 학생</span><strong>${t.proCount}명 <i class="fas fa-chevron-down"></i></strong></div><div class="tier-acc-content">${generateStudentListHtml(t.proStudents, '현재 담당 중인 PRO 학생이 없습니다.', 'pro')}</div></div>
                        <div class="tier-acc-group"><div class="tier-acc-header std" onclick="toggleTierList(this)"><span>📘 STANDARD 학생</span><strong>${t.stdCount}명 <i class="fas fa-chevron-down"></i></strong></div><div class="tier-acc-content">${generateStudentListHtml(t.stdStudents, '현재 담당 중인 STANDARD 학생이 없습니다.', 'standard')}</div></div>
                        <div class="tier-acc-group"><div class="tier-acc-header exp" onclick="toggleTierList(this)"><span>⏳ 구독 만료 / 대기 학생</span><strong>${t.freeCount}명 <i class="fas fa-chevron-down"></i></strong></div><div class="tier-acc-content">${generateStudentListHtml(t.freeStudents, '만료되거나 대기 중인 학생이 없습니다.', 'free')}</div></div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch(e) { if (e.message !== "Auth expired") container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
}

window.approveTutorWithdrawal = async function(tutorId) {
    if (event) event.stopPropagation();
    if (!confirm("이 튜터의 파트너십 해지(탈퇴)를 승인하시겠습니까?\n승인 시 튜터에게 알림이 전송되며, 튜터가 직접 최종 탈퇴 처리를 진행하게 됩니다.")) return;

    try {
        await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_approve_withdrawal', data: { tutorId: tutorId } }) });
        alert("탈퇴 승인이 완료되었습니다. 해당 튜터에게 알림이 발송되었습니다.");
        loadTutorStats(); 
    } catch (e) { if (e.message !== "Auth expired") alert("서버 통신 중 오류가 발생했습니다."); }
};

function reportBadge(status) {
    if (!status) return '<span class="report-badge none">-</span>';
    if (status.tutorSubmitted) return '<span class="report-badge done">✅ 완료</span>';
    if (status.studentSubmitted) return '<span class="report-badge pending">🕐 피드백 대기</span>';
    return '<span class="report-badge missing">❌ 미작성</span>';
}

function generateStudentListHtml(students, emptyMsg, tier = 'free') {
    if (!students || students.length === 0) return `<div class="tier-student-empty">${emptyMsg}</div>`;
    const showWeekly = tier === 'standard' || tier === 'pro';
    const showPro = tier === 'pro';

    let headers = '<th>이름</th><th>최초 가입일</th><th>마지막 결제일</th>';
    if (showWeekly) headers += '<th>주간 보고서 (이번 주)</th>';
    if (showPro)    headers += '<th>PRO 보고서 (2주 이내)</th>';
    headers += '<th>누적 결제 이력</th>';

    let html = `<div class="table-responsive"><table class="tier-student-table"><thead><tr>${headers}</tr></thead><tbody>`;
    students.forEach(s => {
        const jDate = s.joinDate ? new Date(s.joinDate).toLocaleDateString() : '-';
        const lDate = s.lastPayDate ? new Date(s.lastPayDate).toLocaleDateString() : '<span style="color:#ef4444;">결제 없음</span>';
        const pays = Object.entries(s.payCounts || {}).map(([prod, cnt]) => `<span class="pay-badge">${prod} ${cnt}회</span>`).join(' ') || '-';
        let row = `<tr>
            <td data-label="이름"><strong>${escapeHtml(s.name)}</strong></td>
            <td data-label="최초 가입일">${jDate}</td>
            <td data-label="마지막 결제일">${lDate}</td>`;
        if (showWeekly) row += `<td data-label="주간 보고서">${reportBadge(s.weeklyStatus)}</td>`;
        if (showPro)    row += `<td data-label="PRO 보고서">${reportBadge(s.proStatus)}</td>`;
        row += `<td data-label="결제 이력">${pays}</td></tr>`;
        html += row;
    });
    html += `</tbody></table></div>`;
    return html;
}

window.toggleTutorDetail = function(el) {
    el.classList.toggle('active'); const details = el.nextElementSibling; details.classList.toggle('open');
    if(details.classList.contains('open')) details.style.maxHeight = 'none'; else details.style.maxHeight = null;
}

window.toggleTierList = function(headerEl) {
    if (event) event.stopPropagation();
    headerEl.classList.toggle('active'); const content = headerEl.nextElementSibling;
    if (content.style.maxHeight) content.style.maxHeight = null; else content.style.maxHeight = content.scrollHeight + "px";
}

window.toggleNoticeTree = function(iconEl) {
    const childrenBlock = iconEl.closest('.tree-group').querySelector('.tree-children');
    if (childrenBlock.style.display === 'none') { childrenBlock.style.display = 'grid'; iconEl.style.transform = 'rotate(180deg)'; } 
    else { childrenBlock.style.display = 'none'; iconEl.style.transform = 'rotate(0deg)'; }
}

// ============================================================
// [F] 알림 시스템 및 공지 발송 로직
// ============================================================
function switchNotiTab(tabName) {
    document.querySelectorAll('.noti-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tabBtn-' + tabName).classList.add('active');
    document.getElementById('notiTab-inbox').style.display = (tabName === 'inbox') ? 'block' : 'none';
    document.getElementById('notiTab-send').style.display = (tabName === 'send') ? 'block' : 'none';
}

async function fetchUnreadNotiCount() {
    try {
        const response = await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_notifications' }) });
        const data = await response.json();
        const unreadCount = (data.notifications || []).filter(n => !n.isRead).length;
        const badge = document.getElementById('notiBadge');
        if (unreadCount > 0) { badge.style.display = 'inline-block'; badge.innerText = unreadCount; } else { badge.style.display = 'none'; }
    } catch(e) { }
}

async function loadNotifications() {
    const container = document.getElementById('notiListBody'); container.innerHTML = '<p style="text-align:center;">알림을 불러오는 중...</p>';
    try {
        const response = await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_notifications' }) });
        const data = await response.json();
        container.innerHTML = '';
        if (!data.notifications || data.notifications.length === 0) { container.innerHTML = '<p style="text-align:center; color:#94a3b8;">최근 알림이 없습니다.</p>'; return; }
        data.notifications.forEach(n => {
            const card = document.createElement('div'); card.className = `noti-item ${n.isRead ? '' : 'unread'}`;
            card.innerHTML = `
    <div style="width: 100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
            <div class="noti-time" style="font-size: 0.85rem; color: #94a3b8;">${new Date(n.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
            ${!n.isRead ? `<button class="noti-btn" onclick="markAsReadNoti('${n.id}')" style="background:#f59e0b; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">확인</button>` : '<span style="color:#10b981; font-size:0.8rem; font-weight:bold;">읽음</span>'}
        </div>
        <div style="font-weight:bold; color:#1e293b; font-size:1.05rem; margin-bottom:4px;">${escapeHtml(n.title || n.message)}</div>
        ${n.detail ? `<div class="noti-text" style="color:#475569; font-size:0.95rem; line-height:1.4;">${escapeHtml(n.detail)}</div>` : ''}
    </div>
            `;
            container.appendChild(card);
        });
        fetchUnreadNotiCount();
    } catch(e) { if (e.message !== "Auth expired") container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
}

async function markAsReadNoti(notiId) {
    try {
        await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_read_notification', data: { notiId } }) });
        loadNotifications(); 
    } catch(e) { if (e.message !== "Auth expired") alert('처리 실패'); }
}

async function markAllNotiAsRead() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markAsReadNoti('all');
}

window.showNotiMenu = function(tabName) {
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    document.getElementById('section-notifications').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('notiTab-inbox').style.display = 'none';
    document.getElementById('notiTab-send').style.display = 'none';
    document.getElementById('notiTab-sent').style.display = 'none';
    const titleEl = document.getElementById('notiPageTitle');

    if (tabName === 'inbox') { document.getElementById('notiTab-inbox').style.display = 'block'; titleEl.innerText = '📥 알림 수신함'; loadNotifications(); } 
    else if (tabName === 'send') { document.getElementById('notiTab-send').style.display = 'block'; titleEl.innerText = '📢 새 공지 발송'; loadTutorListForNotice(); } 
    else if (tabName === 'sent') { document.getElementById('notiTab-sent').style.display = 'block'; titleEl.innerText = '📤 보낸 공지함'; loadSentNotices(); }
};

window.loadSentNotices = async function() {
    const container = document.getElementById('sentNotiListBody'); container.innerHTML = '<p class="empty-msg">보낸 공지를 불러오는 중...</p>';
    try {
        const response = await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_notifications' }) });
        const data = await response.json();
        container.innerHTML = '';
        const sentList = data.sentNotices || []; sentList.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (sentList.length === 0) { container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding: 30px;">보낸 공지가 없습니다.</p>'; return; }
        sentList.forEach(n => {
            const card = document.createElement('div'); card.className = `noti-item`; const targetText = n.targetNames ? n.targetNames : `${n.targetCount}명`;
            card.innerHTML = `<div style="width: 100%;"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="noti-time">${new Date(n.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div><div class="noti-tags"><span class="tag-tutor" style="background:#f1f5f9; color:#475569;">👥 수신: ${escapeHtml(targetText)} (총 ${n.targetCount}명)</span></div></div><div style="font-weight:bold; margin-top:8px; color:#1e293b; font-size:1.1rem;">${escapeHtml(n.title)}</div><div class="noti-text" style="margin-top:10px; white-space:pre-wrap; background:#f8fafc; padding:15px; border-radius:8px; font-size:0.95rem; border:1px solid #e2e8f0;">${escapeHtml(n.detail)}</div></div>`;
            container.appendChild(card);
        });
    } catch(e) { if (e.message !== "Auth expired") container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
};

let globalUserList = [];

// 공지 수신자 트리도 새로운 뱃지 로직(currentSubscription) 사용
async function loadTutorListForNotice() {
    const adminId = localStorage.getItem('userId');
    try {
        const [tutorRes, studentRes] = await Promise.all([
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_tutor_stats' }) }),
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_search', userId: adminId, data: {} }) })
        ]);

        const tutorData = await tutorRes.json(); const studentData = await studentRes.json();
        const tutors = tutorData.tutors || [];
        let students = Array.isArray(studentData) ? studentData : (studentData.students || studentData.Items || []);
        students = students.filter(u => u.role !== 'admin' && u.role !== 'tutor');
        globalUserList = [...tutors, ...students];
        
        let html = `<div class="quick-select-box"><strong>⚡ 빠른 선택:</strong><label><input type="checkbox" onchange="toggleAllCheckboxes(this)"> 싹 다 전체</label><label><input type="checkbox" onchange="toggleByClass('is-tutor', this)"> 튜터(선생님) 전체</label><label><input type="checkbox" onchange="toggleByClass('is-pro', this)"> PRO 전체</label><label><input type="checkbox" onchange="toggleByClass('is-standard', this)"> STANDARD 전체</label></div><div class="tree-grid-container">`;

        tutors.forEach(t => {
            const myStus = students.filter(s => {
                if (!s.tutorName) return false;
                const targetTutor = s.tutorName.trim();
                return targetTutor === (t.nickname || '').trim() || targetTutor === (t.name || '').trim();
            });

            html += `
                <div class="tree-group">
                    <div class="tree-parent" style="display:flex; justify-content:space-between; align-items:center;">
                        <label><input type="checkbox" class="is-tutor target-chk" value="${t.userid}" onchange="toggleChildren(this)"> 👨‍🏫 ${t.nickname} (${t.name}) 튜터 그룹</label>
                        <i class="fas fa-chevron-down" style="cursor:pointer; padding:10px 5px; color:#94a3b8; transition:transform 0.3s; transform: rotate(180deg);" onclick="toggleNoticeTree(this)"></i>
                    </div>
                    <div class="tree-children" style="display:grid;">
            `;
            
            if (myStus.length === 0) { 
                html += `<span style="color:#94a3b8; font-size:0.85rem; padding-left:5px;">소속 학생 없음</span>`; 
            } else {
                myStus.forEach(s => {
                    const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
                    const tierClass = tier.toLowerCase();
                    html += `<label><input type="checkbox" class="is-${tierClass} target-chk" value="${s.userid}"> 🎓 ${s.name} (${tier})</label>`;
                });
            }
            html += `</div></div>`;
        });
        
        const proStus = students.filter(s => { 
            const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE'; 
            return tier.toLowerCase() === 'pro' && !s.tutorName; 
        });
        if(proStus.length > 0) { 
            html += `<div class="tree-group"><div class="tree-parent"><label><input type="checkbox" onchange="toggleChildren(this)"> 🔥 PRO (미배정) 대기중</label></div><div class="tree-children">`; 
            proStus.forEach(s => { 
                html += `<label><input type="checkbox" class="is-pro target-chk" value="${s.userid}"> 🎓 ${s.name}</label>`; 
            }); 
            html += `</div></div>`; 
        }

        const stdStus = students.filter(s => { 
            const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE'; 
            return tier.toLowerCase() === 'standard' && !s.tutorName; 
        });
        if(stdStus.length > 0) { 
            html += `<div class="tree-group"><div class="tree-parent"><label><input type="checkbox" onchange="toggleChildren(this)"> 📘 STANDARD (미배정) 대기중</label></div><div class="tree-children">`; 
            stdStus.forEach(s => { 
                html += `<label><input type="checkbox" class="is-standard target-chk" value="${s.userid}"> 🎓 ${s.name}</label>`; 
            }); 
            html += `</div></div>`; 
        }

        const basicStus = students.filter(s => { const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE'; return tier.toLowerCase() === 'basic' && !s.tutorName; });
        if(basicStus.length > 0) { html += `<div class="tree-group"><div class="tree-parent"><label><input type="checkbox" onchange="toggleChildren(this)"> 🌱 BASIC (미배정) 모음</label></div><div class="tree-children">`; basicStus.forEach(s => { html += `<label><input type="checkbox" class="is-basic target-chk" value="${s.userid}"> 🎓 ${s.name}</label>`; }); html += `</div></div>`; }

        const freeStus = students.filter(s => { const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE'; return tier.toLowerCase() === 'free' && !s.tutorName; });
        if(freeStus.length > 0) { html += `<div class="tree-group"><div class="tree-parent"><label><input type="checkbox" onchange="toggleChildren(this)"> ☁️ FREE (미배정) 모음</label></div><div class="tree-children">`; freeStus.forEach(s => { html += `<label><input type="checkbox" class="is-free target-chk" value="${s.userid}"> 🎓 ${s.name}</label>`; }); html += `</div></div>`; }

        html += `</div>`;
        document.getElementById('noticeTargetCheckboxes').innerHTML = html;
    } catch(e) { console.error("Notice Box Render Error:", e); }
}

window.toggleChildren = function(parentChk) { const children = parentChk.closest('.tree-group').querySelectorAll('.tree-children input[type="checkbox"]'); children.forEach(child => child.checked = parentChk.checked); }
window.toggleAllCheckboxes = function(chk) { document.querySelectorAll('#noticeTargetCheckboxes input[type="checkbox"]').forEach(c => c.checked = chk.checked); }
window.toggleByClass = function(className, chk) { document.querySelectorAll('#noticeTargetCheckboxes .' + className).forEach(c => { c.checked = chk.checked; }); }

function loadTargetUsers() {
    const groupVal = document.getElementById('noticeTargetGroup').value;
    const userSelect = document.getElementById('noticeTargetUser');
    userSelect.innerHTML = '<option value="all">해당 그룹 전체에게 보내기</option>';
    if (!groupVal || groupVal === 'all' || groupVal === 'all_tutor' || groupVal === 'all_student') return;

    let filtered = [];
    if (['pro', 'standard', 'basic', 'free'].includes(groupVal)) {
        filtered = globalUserList.filter(u => u.role !== 'admin' && u.role !== 'tutor');
        filtered = filtered.filter(s => { const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE'; return tier.toLowerCase() === groupVal; });
    } 
    else if (groupVal.startsWith('tutor_')) {
        const tName = groupVal.replace('tutor_', '');
        filtered = globalUserList.filter(u => u.role !== 'admin' && u.role !== 'tutor' && u.tutorName === tName);
    }
    filtered.forEach(u => { userSelect.innerHTML += `<option value="${escapeHtml(u.userid)}">${escapeHtml(u.name)} (${escapeHtml(u.email) || '-'})</option>`; });
}

async function sendAdminNotice() {
    const checkedBoxes = document.querySelectorAll('.target-chk:checked');
    const targetUserIds = [...new Set(Array.from(checkedBoxes).map(b => b.value))];
    const title = document.getElementById('noticeTitle').value.trim(); const content = document.getElementById('noticeContent').value.trim();

    if (targetUserIds.length === 0) { alert("발송할 대상을 한 명 이상 선택해주세요."); return; }
    if (!title || !content) { alert("제목과 내용을 모두 입력해주세요."); return; }
    if (!confirm(`총 ${targetUserIds.length}명에게 공지를 발송하시겠습니까?`)) return;

    const targetNamesList = targetUserIds.map(uid => { const user = globalUserList.find(u => u.userid === uid); return user ? (user.name || user.nickname || '알수없음') : '알수없음'; });
    let targetNamesDisplay = targetNamesList.slice(0, 5).join(', '); if (targetNamesList.length > 5) targetNamesDisplay += ` 외 ${targetNamesList.length - 5}명`;

    try {
        await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_send_notice', data: { targetUserIds: targetUserIds, title: title, content: content, targetNamesDisplay: targetNamesDisplay } }) });
        alert("공지 발송 및 기록 저장이 완료되었습니다.");
        document.getElementById('noticeTitle').value = ''; document.getElementById('noticeContent').value = '';
        document.querySelectorAll('#noticeTargetCheckboxes input[type="checkbox"]').forEach(c => c.checked = false); showNotiMenu('sent'); 
    } catch(e) { if (e.message !== "Auth expired") alert("공지 발송이 원활하게 진행되지 않았습니다. 서버 상태를 확인해주세요."); }
}

// ============================================================
// [I] 튜터 매칭 시스템 로직
// ============================================================
let globalUnmatchedStudents = []; let globalTutorsForMatch = []; let globalAllStudentsForMatch = [];

function switchMatchingTab(tabName) {
    document.getElementById('matchTab_new').style.display = tabName === 'new' ? 'block' : 'none'; document.getElementById('matchTab_change').style.display = tabName === 'change' ? 'block' : 'none';
    document.getElementById('btn-match-new').classList.toggle('active', tabName === 'new'); document.getElementById('btn-match-change').classList.toggle('active', tabName === 'change');
}

async function loadMatchingData(isSilent = false) {
    const adminId = localStorage.getItem('userId');
    if (!isSilent) document.getElementById('newMatchList').innerHTML = '<p>데이터를 불러오는 중...</p>';

    try {
        const [tutorRes, studentRes] = await Promise.all([
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_tutor_stats' }) }),
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_search', userId: adminId, data: {} }) })
        ]);

        const tutorData = await tutorRes.json(); const studentData = await studentRes.json();
        globalTutorsForMatch = tutorData.tutors || [];
        let allUsers = Array.isArray(studentData) ? studentData : (studentData.students || studentData.Items || []);
        globalAllStudentsForMatch = allUsers.filter(u => u.role !== 'admin' && u.role !== 'tutor');

        globalUnmatchedStudents = globalAllStudentsForMatch.filter(s => {
            if (s.tutorName) return false; 
            // 💡 [수정] 매칭 시스템에서도 바뀐 티어 추출 방식 적용
            const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
            const tierLower = tier.toLowerCase();
            return tierLower === 'standard' || tierLower === 'pro';
        });

        const badge = document.getElementById('matchingBadge'); const countText = document.getElementById('newMatchCount');
        if (badge && countText) {
            countText.innerText = `(${globalUnmatchedStudents.length})`;
            if (globalUnmatchedStudents.length > 0) { badge.style.display = 'inline-block'; badge.innerText = globalUnmatchedStudents.length; } 
            else { badge.style.display = 'none'; }
        }

        if (!isSilent) { renderNewMatchingList(); initTutorChangeSelects(); }
    } catch (e) { console.error("Matching Data Load Error:", e); }
}

function renderNewMatchingList() {
    const container = document.getElementById('newMatchList'); 
    container.innerHTML = '';
    
    if (globalUnmatchedStudents.length === 0) { 
        container.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #94a3b8; background: #f8fafc; border-radius: 8px;">현재 신규 매칭 대기 중인 학생이 없습니다.</div>'; 
        return; 
    }

    const tutorOptions = globalTutorsForMatch.map(t => `<option value="${t.nickname}">${t.nickname} (${t.name}) - 배정 ${t.totalStudents}명</option>`).join('');

    globalUnmatchedStudents.forEach(s => {
        const tierBadge = getTierBadgeHTML(s);
        const card = document.createElement('div'); 
        card.className = 'match-card';
        card.style.cssText = "background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 15px;";
        
        card.innerHTML = `
            <div class="match-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                <div>
                    <h4 class="match-card-name" style="margin:0 0 5px 0; font-size:1.1rem; color:#1e293b;">${escapeHtml(s.name)}</h4>
                    <div class="match-card-date" style="font-size:0.85rem; color:#94a3b8;">가입일: ${new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
                <div>${tierBadge}</div>
            </div>
            <div class="match-select-box" style="display:flex; gap:10px;">
                <select id="select_tutor_${s.userid}" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.9rem;">
                    <option value="">튜터 선택...</option>
                    ${tutorOptions}
                </select>
                <button class="match-btn" onclick="executeMatching('${s.userid}', false)" style="background:#3b82f6; color:white; border:none; padding:8px 15px; border-radius:4px; font-weight:bold; cursor:pointer;">배정하기</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function initTutorChangeSelects() {
    const oldSel = document.getElementById('changeOldTutor'); const newSel = document.getElementById('changeNewTutor');
    let options = '<option value="">선택하세요</option>';
    globalTutorsForMatch.forEach(t => { options += `<option value="${escapeHtml(t.nickname)}">${escapeHtml(t.nickname)} (${escapeHtml(t.name)})</option>`; });
    oldSel.innerHTML = options; newSel.innerHTML = options;
}

function updateChangeStudentList() {
    const oldTutorName = document.getElementById('changeOldTutor').value; const stuSel = document.getElementById('changeStudent');
    if (!oldTutorName) { stuSel.innerHTML = '<option value="">먼저 튜터를 선택하세요</option>'; return; }
    const myStus = globalAllStudentsForMatch.filter(s => s.tutorName === oldTutorName);
    if (myStus.length === 0) { stuSel.innerHTML = '<option value="">배정된 학생이 없습니다.</option>'; return; }

    let stuOptions = '<option value="">학생을 선택하세요</option>';
    myStus.forEach(s => {
        const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
        stuOptions += `<option value="${s.userid}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)} (${tier})</option>`;
    });
    stuSel.innerHTML = stuOptions;
}

function confirmTutorChange() {
    const oldTutor = document.getElementById('changeOldTutor').value; const stuSel = document.getElementById('changeStudent');
    const studentId = stuSel.value; const studentName = stuSel.options[stuSel.selectedIndex]?.text || ''; const newTutor = document.getElementById('changeNewTutor').value;

    if (!oldTutor || !studentId || !newTutor) return alert("모든 항목을 선택해 주세요.");
    if (oldTutor === newTutor) return alert("현재 튜터와 변경할 튜터가 동일합니다.");

    if (confirm(`🚨 [튜터 변경 최종 확인]\n\n학생: ${studentName}\n기존 튜터: ${oldTutor} 선생님\n변경 튜터: ${newTutor} 선생님\n\n정말로 튜터를 변경하시겠습니까? 이 작업은 즉시 반영됩니다.`)) {
        executeMatching(studentId, true, newTutor, oldTutor);
    }
}

async function executeMatching(studentId, isChange, newTutorArg = null, oldTutorArg = null) {
    const newTutorName = isChange ? newTutorArg : document.getElementById(`select_tutor_${studentId}`).value;
    if (!newTutorName) return alert("튜터를 선택해주세요.");
    const adminId = localStorage.getItem('userId');

    try {
        await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_assign_tutor', userId: adminId, data: { targetUserId: studentId, newTutorName: newTutorName, isChange: isChange, oldTutorName: oldTutorArg } }) });
        alert(isChange ? "튜터가 성공적으로 변경되었습니다." : "튜터 배정이 완료되었습니다.");
        if (isChange) { document.getElementById('changeOldTutor').value = ''; document.getElementById('changeStudent').innerHTML = '<option value="">먼저 튜터를 선택하세요</option>'; document.getElementById('changeNewTutor').value = ''; }
        await loadMatchingData(); 
    } catch(e) { console.error(e); if (e.message !== "Auth expired") alert("통신 오류 발생"); }
}

// ==========================================
// [J] 강제 탈퇴 / [K] 임의 등급 부여 로직
// ==========================================
window.openForceDeleteModal = function(userId, userName) {
    document.getElementById('fdUserId').value = userId; document.getElementById('fdUserName').innerText = userName || "이름없음";
    document.getElementById('fdReason').value = ''; document.getElementById('fdConfirmText').value = '';
    const modal = document.getElementById('forceDelete-modal'); modal.classList.remove('hidden'); modal.style.display = 'flex'; 
};

window.closeForceDeleteModal = function() {
    const modal = document.getElementById('forceDelete-modal'); modal.classList.add('hidden'); modal.style.display = 'none';
};

window.executeForceDelete = async function() {
    const userId = document.getElementById('fdUserId').value; const reason = document.getElementById('fdReason').value.trim(); const confirmText = document.getElementById('fdConfirmText').value.trim();
    if (!reason) return alert("탈퇴 사유를 반드시 입력해주세요.");
    if (confirmText !== "강제 탈퇴 확인했습니다") return alert("동의 확인 문구를 정확히 띄어쓰기까지 맞춰서 입력해주세요.");
    if (!confirm("마지막 확인입니다. 정말 삭제하시겠습니까? 데이터 복구는 불가능합니다.")) return;

    try {
        await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_force_delete_user', userId: localStorage.getItem('userId'), data: { targetUserId: userId, reason: reason } }) });
        alert("강제 탈퇴 처리가 완료되었습니다."); closeForceDeleteModal(); searchStudents(); 
    } catch (e) { if (e.message !== "Auth expired") alert("탈퇴 처리 중 오류가 발생했습니다."); }
};

window.openGrantTierModal = function(userId, userName) {
    document.getElementById('gtUserId').value = userId; document.getElementById('gtUserName').innerText = userName || "이름없음"; document.getElementById('gtAmount').value = "0"; 
    const modal = document.getElementById('grantTier-modal'); modal.classList.remove('hidden'); modal.style.display = 'flex'; 
};

window.closeGrantTierModal = function() {
    const modal = document.getElementById('grantTier-modal'); modal.classList.add('hidden'); modal.style.display = 'none';
};

window.executeGrantTier = async function() {
    const userId = document.getElementById('gtUserId').value; const tier = document.getElementById('gtProductTier').value; const amount = document.getElementById('gtAmount').value;
    if (!confirm(`해당 학생에게 [${tier}] 등급을 강제로 부여하시겠습니까?\n이 내역은 장부 및 통계에 기록됩니다.`)) return;

    try {
        await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_grant_tier', userId: localStorage.getItem('userId'), data: { targetUserId: userId, productTier: tier, amount: amount } }) });
        alert("등급 부여가 완료되었습니다."); closeGrantTierModal(); searchStudents(); 
    } catch (e) { if (e.message !== "Auth expired") alert("등급 부여 처리 중 오류가 발생했습니다."); }
};
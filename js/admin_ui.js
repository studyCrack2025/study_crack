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
            if (e.key === 'Enter') {
                searchStudents();
            }
        });
    }
    
    setTimeout(() => loadMatchingData(true), 1500);
});

// ============================================================
// [A] 네비게이션 및 UI 제어
// ============================================================

function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

// 메인 섹션 전환 및 사이드바 Active 스타일 적용
function showSection(sectionName) {
    // 1. 모든 메인 화면 섹션 숨기기
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    
    // 2. 사이드바 메뉴 시각적 Active 상태 초기화
    document.querySelectorAll('.menu-item > a').forEach(el => {
        el.style.backgroundColor = '';
        el.style.color = '#cbd5e1'; // 기본 글자색
    });
    document.querySelectorAll('.submenu li a').forEach(el => {
        el.style.color = '#94a3b8'; // 서브메뉴 기본 글자색
    });
    
    // 3. 클릭된 요소 찾아서 시각적 효과 부여
    const clickedLink = document.querySelector(`a[onclick*="showSection('${sectionName}')"]`) || 
                        document.querySelector(`a[onclick*="showQnaSection"]`) ||
                        document.querySelector(`a[onclick*="showNotiMenu"]`);
                        
    if (clickedLink) {
        if (clickedLink.closest('.submenu')) {
            clickedLink.style.color = '#60a5fa'; // 서브메뉴 액티브 색상
            const parentMenu = clickedLink.closest('.has-submenu').querySelector('a');
            if(parentMenu) parentMenu.style.color = '#60a5fa'; // 부모 메뉴 하이라이트
        } else {
            clickedLink.style.backgroundColor = '#334155'; // 메인메뉴 액티브 배경
            clickedLink.style.color = 'white'; // 메인메뉴 액티브 글자
        }
    }
    
    // 4. 선택된 섹션 화면에 보이기
    if (sectionName === 'students') {
        document.getElementById('section-students').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } 
    else if (sectionName === 'dashboard') {
        document.getElementById('section-dashboard').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } 
    else if (sectionName === 'sales-chart') {
        document.getElementById('section-dashboard').classList.add('active');
        const anchor = document.getElementById('chart-section-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    } 
    else if (sectionName === 'tutors') {
        document.getElementById('section-tutors').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadTutorStats(); 
    } 
    else if (sectionName === 'notifications') {
        document.getElementById('section-notifications').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadNotifications(); 
        loadTutorListForNotice();
    }
    else if (sectionName === 'qna') {
        document.getElementById('section-qna').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else if (sectionName === 'matching') {
        document.getElementById('section-matching').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadMatchingData(); // 매칭 데이터 로드 호출
    }
}

// 질의 관리(Q&A) 전용 섹션 전환 및 필터링 함수
window.showQnaSection = function(status) {
    // 1. 화면을 Q&A 섹션으로 전환
    showSection('qna'); 
    
    // 2. 현재 필터 상태 업데이트
    currentQnaFilter = status; 
    
    // 3. 상단 타이틀 텍스트 변경
    const titleMap = {
        'done': '✅ 응답 완료',
        'read': '👁️ 읽음 (미응답)',
        'waiting': '🔴 읽지 않음'
    };
    document.getElementById('qnaStatusTitle').innerText = `- ${titleMap[status]}`;
    
    // 4. 데이터 로드 및 렌더링
    loadAllQna(); 
};

// ============================================================
// [B] 통계 및 차트 로직
// ============================================================

async function loadAdminStats(adminId) {
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ type: 'admin_stats', userId: adminId })
        });
        
        if (!response.ok) throw new Error("서버 오류");
        const data = await response.json();
        
        document.getElementById('totalUsers').innerText = `${data.totalUsers}명`;
        document.getElementById('totalRevenue').innerText = `${(data.totalRevenue || 0).toLocaleString()}원`;
        document.getElementById('monthlyRevenue').innerText = `${(data.monthlyRevenue || 0).toLocaleString()}원`;

        rawPaymentData = data.allPayments || [];
        updateCharts();

    } catch (error) {
        console.error(error);
        alert("통계 정보를 불러오지 못했습니다.");
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
    const timeMap = {};
    const productMap = {};
    let total = 0;

    payments.forEach(pay => {
        const date = new Date(pay.date);
        let key = "";

        if (type === 'week') {
            const year = date.getFullYear();
            const week = getWeekNumber(date);
            key = `${year}-W${week}`; 
        } else if (type === 'month') {
            key = pay.date.substring(0, 7); 
        } else if (type === 'quarter') {
            const year = date.getFullYear();
            const q = Math.floor(date.getMonth() / 3) + 1;
            key = `${year}-Q${q}`; 
        }

        timeMap[key] = (timeMap[key] || 0) + pay.amount;
        const prod = pay.product || "기타";
        productMap[prod] = (productMap[prod] || 0) + pay.amount;
        total += pay.amount;
    });

    const labels = Object.keys(timeMap).sort();
    const amounts = labels.map(k => timeMap[k]);

    return { labels, amounts, productCounts: productMap, totalAmount: total };
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function renderPeriodChart(labels, data) {
    const ctx = document.getElementById('periodChart');
    if (!ctx) return;

    if (periodChart) periodChart.destroy();

    periodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['데이터 없음'],
            datasets: [{
                label: '매출액',
                data: data.length ? data : [0],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                datalabels: { display: false } 
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { callback: v => '₩' + v.toLocaleString() }
                }
            }
        }
    });
}

function renderProductChart(productMap, total) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    const labels = Object.keys(productMap);
    const values = Object.values(productMap);

    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['데이터 없음'],
            datasets: [{
                data: values.length ? values : [1],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value, ctx) => {
                        if (total === 0) return '';
                        let percentage = ((value / total) * 100).toFixed(1) + "%";
                        if ((value / total) < 0.05) return ''; 
                        return percentage;
                    }
                }
            }
        }
    });
}

// ============================================================
// [C] 학생 관리 로직
// ============================================================

async function searchStudents() {
    const adminId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    const type = document.getElementById('searchType').value; 
    const keyword = document.getElementById('searchInput').value || ""; 
    const tbody = document.getElementById('studentListBody');

    tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>데이터 조회 중...</td></tr>";

    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                type: 'admin_search',
                userId: adminId,
                data: { searchType: type, keyword: keyword } 
            })
        });
        
        // [디버깅] 서버가 실제로 뭘 주는지 콘솔에서 확인하기 위함
        const rawData = await response.json();
        console.log("🔍 [Admin Search Result]:", rawData);

        // [중요 수정] 데이터가 배열인지 확인 후 처리 (에러 방지)
        let students = [];
        if (Array.isArray(rawData)) {
            students = rawData;
        } else if (rawData.students && Array.isArray(rawData.students)) {
            // 혹시 { students: [...] } 형태로 왔을 경우 대비
            students = rawData.students;
        } else {
            console.error("❌ 데이터 형식이 배열이 아닙니다:", rawData);
            // 배열이 아니면 빈 배열로 처리하여 forEach 에러 방지
            students = [];
        }
        
        // role이 'tutor'나 'admin'인 유저를 제외하고 순수 학생만 남김
        students = students.filter(s => s.role !== 'admin' && s.role !== 'tutor');
        
        // 필터링 로직 (데이터가 있을 때만 수행)
        if (students.length > 0) {
            if (type === 'paid') {
                students = students.filter(s => 
                    s.payments && s.payments.some(p => p.status === 'paid')
                );
            } else if (type === 'unpaid') {
                students = students.filter(s => 
                    !s.payments || !s.payments.some(p => p.status === 'paid')
                );
            }
        }

        tbody.innerHTML = "";
        
        if (students.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>조건에 맞는 학생이 없거나 데이터를 불러올 수 없습니다.</td></tr>";
            return;
        }

        // 이제 students는 무조건 배열이므로 forEach가 안전함
        students.forEach(s => {
            let statusBadge = getTierBadgeHTML(s.payments);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(s.name) || '(이름없음)'}</strong></td>
                <td>${escapeHtml(s.email) || '-'}</td>
                <td>${escapeHtml(s.school) || '-'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button style="padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer;" 
                            onclick="goToStudentDetail('${s.userid}')">
                        상세관리
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Search Error:", error);
        tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>오류가 발생했습니다. (콘솔 확인 필요)</td></tr>";
    }
}

function goToStudentDetail(targetUserId) {
    window.location.href = `/admin/detail?uid=${targetUserId}`;
}

// ============================================================
// [D] 질의 관리(Q&A) 로직
// ============================================================

// 1. 전체 질문 불러오기
async function loadAllQna() {
    const token = localStorage.getItem('accessToken');
    const tbody = document.getElementById('qnaListBody');
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">데이터를 불러오는 중...</td></tr>';
    }

    try {
        const response = await fetch(QNA_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type: 'admin_get_all_qna' }) 
        });

        if (!response.ok) throw new Error("로드 실패");
        const data = await response.json();
        
        allQnaData = data.qnaList || [];
        renderQnaList();

    } catch (e) {
        console.error(e);
        alert("질의 목록을 불러오는데 실패했습니다.");
    }
}

// 2. 목록 렌더링 (필터 적용)
function renderQnaList() {
    const tbody = document.getElementById('qnaListBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    // 필터링 (waiting / read / done)
    const filtered = allQnaData.filter(q => q.status === currentQnaFilter);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg" style="text-align:center; padding:30px;">해당 상태의 문의가 없습니다.</td></tr>';
        return;
    }

    filtered.forEach(q => {
        const tr = document.createElement('tr');
        const dateStr = new Date(q.createdAt).toLocaleDateString();
        
        // 버튼 로직 분기
        let actionBtn = '';
        
        // (1) 읽지 않음 -> '읽음 처리' 버튼
        if (q.status === 'waiting') {
            actionBtn = `<button onclick="markAsRead('${q.userId}', '${q.id}')" style="background:#f59e0b; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">읽음 처리</button>`;
        } 
        // (2) 읽음(미응답) -> '답변하기' 버튼
        else if (q.status === 'read') {
            actionBtn = `<button onclick="openReplyModal('${q.userId}', '${q.id}')" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">답변하기</button>`;
        } 
        // (3) 완료 -> 텍스트 표시 (수정 필요시 버튼 추가 가능)
        else {
            actionBtn = `<span style="color:#10b981; font-weight:bold;">완료됨</span>`;
        }

        // 행 클릭 시 상세 모달을 띄우려면 onclick 추가 가능 (여기서는 버튼 위주로 구성)
        tr.innerHTML = `
            <td>${getQnaStatusBadge(q.status)}</td>
            <td>${escapeHtml(q.userName)}<br><span style="font-size:0.8rem; color:#94a3b8;">${q.userPhone || '-'}</span></td>
            <td style="cursor:pointer;" onclick="openReplyModal('${q.userId}', '${q.id}', true)">
                <strong>${escapeHtml(q.title)}</strong>
                <div style="font-size:0.85rem; color:#64748b; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:300px;">
                    ${escapeHtml(q.content)}
                </div>
            </td>
            <td>${dateStr}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function getQnaStatusBadge(status) {
    if (status === 'waiting') return '<span style="background:#fef2f2; color:#ef4444; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">안읽음</span>';
    if (status === 'read') return '<span style="background:#fff7ed; color:#f97316; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">미응답</span>';
    return '<span style="background:#ecfdf5; color:#10b981; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">완료</span>';
}

// 3. 읽음 처리
async function markAsRead(targetUserId, qnaId) {
    if(!confirm("이 문의를 '읽음' 상태로 변경하시겠습니까?")) return;

    const token = localStorage.getItem('accessToken');

    try {
        const res = await fetch(QNA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_mark_qna_read',
                data: { targetUserId, qnaId } // data 안의 구조만 유지
            })
        });

        if (res.ok) {
            const item = allQnaData.find(q => q.id === qnaId);
            if(item) item.status = 'read';
            renderQnaList(); 
        } else {
            alert("처리 실패");
        }
    } catch(e) { console.error(e); alert("오류 발생"); }
}

// 4. 답변 모달 열기
function openReplyModal(targetUserId, qnaId, isViewOnly = false) {
    const item = allQnaData.find(q => q.id === qnaId);
    if (!item) return;

    currentReplyTarget = { targetUserId, qnaId };
    
    // 모달 내용 채우기
    document.getElementById('replyModalTitle').innerText = item.title;
    document.getElementById('replyModalContent').innerText = item.content;
    
    const replyInput = document.getElementById('replyInput');
    const submitBtn = document.querySelector('#reply-modal button');

    if (item.status === 'done' || isViewOnly) {
        // 완료된 건이거나 제목 클릭해서 볼 때는 보기 전용
        replyInput.value = item.answer || "(답변 내용 없음)";
        replyInput.disabled = true;
        submitBtn.style.display = 'none';
    } else {
        // 답변 작성 모드
        replyInput.value = '';
        replyInput.disabled = false;
        submitBtn.style.display = 'block';
    }

    // 모달 표시 (CSS 클래스 제어)
    const modal = document.getElementById('reply-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeReplyModal() {
    const modal = document.getElementById('reply-modal');
    if (modal) modal.classList.add('hidden');
    currentReplyTarget = null;
}

// 5. 답변 전송
async function submitReply() {
    const answer = document.getElementById('replyInput').value.trim();
    if (!answer) { alert("답변 내용을 입력해주세요."); return; }
    if (!currentReplyTarget) return;

    if(!confirm("답변을 전송하시겠습니까?\n전송 후에는 수정할 수 없으며 학생에게 노출됩니다.")) return;

    const token = localStorage.getItem('accessToken');

    try {
        const res = await fetch(QNA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_reply_qna',
                data: {
                    targetUserId: currentReplyTarget.targetUserId,
                    qnaId: currentReplyTarget.qnaId,
                    answer: answer
                }
            })
        });

        if (res.ok) {
            alert("답변이 전송되었습니다.");
            const item = allQnaData.find(q => q.id === currentReplyTarget.qnaId);
            if(item) {
                item.status = 'done';
                item.answer = answer;
            }
            closeReplyModal();
            renderQnaList(); 
        } else {
            alert("전송 실패");
        }
    } catch(e) { console.error(e); alert("오류 발생"); }
}

// ============================================================
// [E] 튜터 관리 로직
// ============================================================
async function loadTutorStats() {
    const token = localStorage.getItem('accessToken');
    const container = document.getElementById('tutorListBody');
    container.innerHTML = '<p style="text-align:center;">데이터를 불러오는 중...</p>';

    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'admin_get_tutor_stats' })
        });
        if (!response.ok) throw new Error("로드 실패");
        const data = await response.json();
        
        container.innerHTML = '';
        if (data.tutors.length === 0) {
            container.innerHTML = '<p style="text-align:center;">등록된 튜터가 없습니다.</p>';
            return;
        }

        data.tutors.forEach(t => {
            const card = document.createElement('div');
            card.className = 'tutor-card';
            
            // 탈퇴 상태에 따른 UI 분기
            let withdrawalUI = '';
            if (t.withdrawalStatus === 'pending') {
                withdrawalUI = `
                    <div style="margin-top:15px; padding:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#991b1b; font-size:0.9rem;"><strong>⚠️ 파트너십 해지(탈퇴) 요청 대기 중</strong></span>
                        <button onclick="approveTutorWithdrawal('${t.userid}')" style="padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.85rem; font-weight:bold;">요청 승인하기</button>
                    </div>
                `;
            } else if (t.withdrawalStatus === 'approved') {
                withdrawalUI = `
                    <div style="margin-top:15px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;">
                        <span style="color:#475569; font-size:0.9rem;"><strong>✅ 탈퇴 승인 완료</strong> (튜터의 최종 확인 및 탈퇴 대기 중)</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="tutor-header" onclick="toggleTutorDetail(this)">
                    <div class="tutor-info-main">
                        <span class="tutor-badge">Tutor</span>
                        <span class="tutor-name">${escapeHtml(t.nickname)}</span>
                        <span style="font-size:0.85rem; color:#94a3b8; margin-left:8px;">(총 ${t.totalStudents}명)</span>
                        ${t.withdrawalStatus === 'pending' ? '<span style="color:#ef4444; font-size:0.8rem; font-weight:bold; margin-left:5px;">[탈퇴요청]</span>' : ''}
                    </div>
                    <div class="tutor-arrow"><i class="fas fa-chevron-down"></i></div>
                </div>
                <div class="tutor-details">
                    <div class="tutor-grid" style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px dashed #e2e8f0;">
                        <div>
                            <p><strong>본명:</strong> ${escapeHtml(t.name) || '-'}</p>
                            <p><strong>학교:</strong> ${escapeHtml(t.school) || '-'}</p>
                            <p><strong>계약시작일:</strong> ${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</p>
                        </div>
                        <div>
                            <p><strong>최대 학생 수:</strong> <span style="color:#2563eb; font-weight:bold;">${t.maxStudents ? t.maxStudents + '명' : '미설정'}</span></p>
                            <p><strong>주 최대 시간:</strong> <span style="color:#2563eb; font-weight:bold;">${t.maxHours ? t.maxHours + '시간' : '미설정'}</span></p>
                            <p><strong>입금 계좌:</strong> ${escapeHtml(t.accountNumber) || '<span style="color:#94a3b8">미등록</span>'}</p>
                        </div>
                    </div>
                    
                    ${withdrawalUI} <div class="tutor-tier-accordions" style="${t.withdrawalStatus ? 'margin-top:20px;' : ''}">
                        <div class="tier-acc-group">
                            <div class="tier-acc-header pro" onclick="toggleTierList(this)">
                                <span>🔥 PRO 학생</span>
                                <strong>${t.proCount}명 <i class="fas fa-chevron-down"></i></strong>
                            </div>
                            <div class="tier-acc-content">${generateStudentListHtml(t.proStudents, '현재 담당 중인 PRO 학생이 없습니다.')}</div>
                        </div>
                        
                        <div class="tier-acc-group">
                            <div class="tier-acc-header std" onclick="toggleTierList(this)">
                                <span>📘 STANDARD 학생</span>
                                <strong>${t.stdCount}명 <i class="fas fa-chevron-down"></i></strong>
                            </div>
                            <div class="tier-acc-content">${generateStudentListHtml(t.stdStudents, '현재 담당 중인 STANDARD 학생이 없습니다.')}</div>
                        </div>
                        
                        <div class="tier-acc-group">
                            <div class="tier-acc-header exp" onclick="toggleTierList(this)">
                                <span>⏳ 구독 만료 / 대기 학생</span>
                                <strong>${t.freeCount}명 <i class="fas fa-chevron-down"></i></strong>
                            </div>
                            <div class="tier-acc-content">${generateStudentListHtml(t.freeStudents, '만료되거나 대기 중인 학생이 없습니다.')}</div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch(e) { container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
}

// 튜터 탈퇴 승인 처리 함수
window.approveTutorWithdrawal = async function(tutorId) {
    // 이벤트 버블링 방지 (아코디언이 열리고 닫히는 현상 방지)
    if (event) event.stopPropagation();

    if (!confirm("이 튜터의 파트너십 해지(탈퇴)를 승인하시겠습니까?\n승인 시 튜터에게 알림이 전송되며, 튜터가 직접 최종 탈퇴 처리를 진행하게 됩니다.")) return;

    const token = localStorage.getItem('accessToken');
    try {
        const res = await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_approve_withdrawal',
                data: { tutorId: tutorId }
            })
        });

        if (res.ok) {
            alert("탈퇴 승인이 완료되었습니다. 해당 튜터에게 알림이 발송되었습니다.");
            loadTutorStats(); // 리스트 새로고침
        } else {
            alert("승인 처리 중 오류가 발생했습니다.");
        }
    } catch (e) {
        console.error(e);
        alert("서버 통신 중 오류가 발생했습니다.");
    }
};

// 헬퍼 함수: 티어별 학생 리스트 테이블 HTML 생성
function generateStudentListHtml(students, emptyMsg) {
    if (!students || students.length === 0) return `<div class="tier-student-empty">${emptyMsg}</div>`;
    
    let html = `<div class="table-responsive"><table class="tier-student-table">
        <thead><tr><th>이름</th><th>최초 가입일</th><th>마지막 결제일</th><th>누적 결제 이력</th></tr></thead>
        <tbody>`;
    
    students.forEach(s => {
        const jDate = s.joinDate ? new Date(s.joinDate).toLocaleDateString() : '-';
        const lDate = s.lastPayDate ? new Date(s.lastPayDate).toLocaleDateString() : '<span style="color:#ef4444;">결제 없음</span>';
        
        const pays = Object.entries(s.payCounts || {})
            .map(([prod, cnt]) => `<span class="pay-badge">${prod} ${cnt}회</span>`)
            .join(' ') || '-';

        html += `<tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${jDate}</td>
            <td>${lDate}</td>
            <td>${pays}</td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    return html;
}

// 튜터 메인 아코디언 토글
window.toggleTutorDetail = function(el) {
    el.classList.toggle('active');
    const details = el.nextElementSibling;
    details.classList.toggle('open');
    // 내부 리스트가 길어질 수 있으므로 열렸을 때는 높이 제한 해제
    if(details.classList.contains('open')) {
        details.style.maxHeight = 'none';
    } else {
        details.style.maxHeight = null;
    }
}

// 내부 티어별 명단 커튼 토글
window.toggleTierList = function(headerEl) {
    // 이벤트 버블링 방지
    if (event) event.stopPropagation();
    
    headerEl.classList.toggle('active');
    const content = headerEl.nextElementSibling;
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
    }
}

// ============================================================
// [F] 알림 시스템 로직
// ============================================================
function switchNotiTab(tabName) {
    document.querySelectorAll('.noti-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tabBtn-' + tabName).classList.add('active');
    
    document.getElementById('notiTab-inbox').style.display = (tabName === 'inbox') ? 'block' : 'none';
    document.getElementById('notiTab-send').style.display = (tabName === 'send') ? 'block' : 'none';
}

async function fetchUnreadNotiCount() {
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'admin_get_notifications' })
        });
        const data = await response.json();
        const unreadCount = (data.notifications || []).filter(n => !n.isRead).length;
        
        const badge = document.getElementById('notiBadge');
        if (unreadCount > 0) {
            badge.style.display = 'inline-block';
            badge.innerText = unreadCount;
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {}
}

async function loadNotifications() {
    const token = localStorage.getItem('accessToken');
    const container = document.getElementById('notiListBody');
    container.innerHTML = '<p style="text-align:center;">알림을 불러오는 중...</p>';

    try {
        const response = await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'admin_get_notifications' })
        });
        const data = await response.json();
        
        container.innerHTML = '';
        if (!data.notifications || data.notifications.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8;">최근 알림이 없습니다.</p>';
            return;
        }

        data.notifications.forEach(n => {
            const card = document.createElement('div');
            card.className = `noti-item ${n.isRead ? '' : 'unread'}`;
            card.innerHTML = `
                <div>
                    <div class="noti-time">${new Date(n.createdAt).toLocaleString()}</div>
                    <div class="noti-tags">
                        <span class="tag-tutor">👨‍🏫 ${escapeHtml(n.tutorName)}</span>
                        <span class="tag-student">🎓 ${escapeHtml(n.studentName)}</span>
                    </div>
                    <div class="noti-text">${escapeHtml(n.message)}</div>
                </div>
                ${!n.isRead ? `<button class="noti-btn" onclick="markAsReadNoti('${n.id}')">확인</button>` : ''}
            `;
            container.appendChild(card);
        });
        
        fetchUnreadNotiCount();
    } catch(e) { container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
}

async function markAsReadNoti(notiId) {
    const token = localStorage.getItem('accessToken');
    try {
        await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'admin_read_notification', data: { notiId } })
        });
        loadNotifications(); 
    } catch(e) { alert('처리 실패'); }
}

async function markAllNotiAsRead() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markAsReadNoti('all');
}

// ============================================================
// [H] 관리자 공지 발송 로직
// ============================================================
let globalUserList = [];

// 1. 유저 목록 가져와서 체크박스 트리 렌더링
async function loadTutorListForNotice() {
    const token = localStorage.getItem('accessToken');
    const adminId = localStorage.getItem('userId');
    
    try {
        // 🔥 [핵심 수정] 튜터 목록 API와 학생 검색 API를 동시에 확실하게 호출합니다!
        const [tutorRes, studentRes] = await Promise.all([
            fetch(ADMIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'admin_get_tutor_stats' })
            }),
            fetch(ADMIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'admin_search', userId: adminId, data: {} })
            })
        ]);

        const tutorData = await tutorRes.json();
        const studentData = await studentRes.json();

        // 튜터 데이터 세팅
        const tutors = tutorData.tutors || [];

        // 학생 데이터 세팅 (배열 형태 호환성 보장)
        let students = [];
        if (Array.isArray(studentData)) students = studentData;
        else if (studentData.students && Array.isArray(studentData.students)) students = studentData.students;
        else if (studentData.Items) students = studentData.Items;

        // 순수 학생만 남기기
        students = students.filter(u => u.role !== 'admin' && u.role !== 'tutor');
        globalUserList = [...tutors, ...students];
        
        let html = `
            <div class="quick-select-box">
                <strong>⚡ 빠른 선택:</strong>
                <label><input type="checkbox" onchange="toggleAllCheckboxes(this)"> 싹 다 전체</label>
                <label><input type="checkbox" onchange="toggleByClass('is-tutor', this)"> 튜터(선생님) 전체</label>
                <label><input type="checkbox" onchange="toggleByClass('is-pro', this)"> PRO 전체</label>
                <label><input type="checkbox" onchange="toggleByClass('is-standard', this)"> STANDARD 전체</label>
            </div>
        `;

        html += `<div class="tree-grid-container">`;

        // (1) 튜터 및 소속 학생들 그룹
        tutors.forEach(t => {
            // 학생의 tutorName과 튜터의 nickname이 일치하는 학생 필터링
            const myStus = students.filter(s => s.tutorName === t.nickname);
            
            html += `
                <div class="tree-group">
                    <div class="tree-parent">
                        <label><input type="checkbox" class="is-tutor target-chk" value="${t.userid}" onchange="toggleChildren(this)"> 👨‍🏫 ${t.nickname} (${t.name}) 튜터 그룹</label>
                    </div>
                    <div class="tree-children">
            `;
            if (myStus.length === 0) {
                html += `<span style="color:#94a3b8; font-size:0.85rem; padding-left:5px;">소속 학생 없음</span>`;
            } else {
                myStus.forEach(s => {
                    const tier = (getTierBadgeHTML(s.payments).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
                    const tierClass = tier.toLowerCase();
                    html += `<label><input type="checkbox" class="is-${tierClass} target-chk" value="${s.userid}"> 🎓 ${s.name} (${tier})</label>`;
                });
            }
            html += `</div></div>`;
        });

        // (2) BASIC 학생 그룹 (담당 튜터가 없는 미배정 인원만)
        const basicStus = students.filter(s => {
            const tier = (getTierBadgeHTML(s.payments).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
            return tier.toLowerCase() === 'basic' && !s.tutorName;
        });
        if(basicStus.length > 0) {
            html += `<div class="tree-group">
                <div class="tree-parent"><label><input type="checkbox" onchange="toggleChildren(this)"> 🌱 BASIC (미배정) 모음</label></div>
                <div class="tree-children">`;
            basicStus.forEach(s => {
                html += `<label><input type="checkbox" class="is-basic target-chk" value="${s.userid}"> 🎓 ${s.name}</label>`;
            });
            html += `</div></div>`;
        }

        // (3) FREE 학생 그룹 (담당 튜터가 없는 미배정 인원만)
        const freeStus = students.filter(s => {
            const tier = (getTierBadgeHTML(s.payments).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
            return tier.toLowerCase() === 'free' && !s.tutorName;
        });
        if(freeStus.length > 0) {
            html += `<div class="tree-group">
                <div class="tree-parent"><label><input type="checkbox" onchange="toggleChildren(this)"> ☁️ FREE (미배정) 모음</label></div>
                <div class="tree-children">`;
            freeStus.forEach(s => {
                html += `<label><input type="checkbox" class="is-free target-chk" value="${s.userid}"> 🎓 ${s.name}</label>`;
            });
            html += `</div></div>`;
        }

        html += `</div>`;

        document.getElementById('noticeTargetCheckboxes').innerHTML = html;
    } catch(e) { console.error("Notice Box Render Error:", e); }
}

// 체크박스 유틸리티 함수
window.toggleChildren = function(parentChk) {
    const children = parentChk.closest('.tree-group').querySelectorAll('.tree-children input[type="checkbox"]');
    children.forEach(child => child.checked = parentChk.checked);
}
window.toggleAllCheckboxes = function(chk) {
    document.querySelectorAll('#noticeTargetCheckboxes input[type="checkbox"]').forEach(c => c.checked = chk.checked);
}
window.toggleByClass = function(className, chk) {
    document.querySelectorAll('#noticeTargetCheckboxes .' + className).forEach(c => {
        c.checked = chk.checked;
    });
}

// 2. 그룹 선택 시 세부 타겟팅 리스트업
function loadTargetUsers() {
    const groupVal = document.getElementById('noticeTargetGroup').value;
    const userSelect = document.getElementById('noticeTargetUser');
    userSelect.innerHTML = '<option value="all">해당 그룹 전체에게 보내기</option>';
    
    if (!groupVal || groupVal === 'all' || groupVal === 'all_tutor' || groupVal === 'all_student') return;

    let filtered = [];
    
    // 등급별 분류
    if (['pro', 'standard', 'basic', 'free'].includes(groupVal)) {
        filtered = globalUserList.filter(u => u.role !== 'admin' && u.role !== 'tutor');
        filtered = filtered.filter(s => {
            const tier = (getTierBadgeHTML(s.payments).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
            return tier.toLowerCase() === groupVal;
        });
    } 
    // 특정 튜터의 학생 분류
    else if (groupVal.startsWith('tutor_')) {
        const tName = groupVal.replace('tutor_', '');
        filtered = globalUserList.filter(u => u.role !== 'admin' && u.role !== 'tutor' && u.tutorName === tName);
    }

    filtered.forEach(u => {
        userSelect.innerHTML += `<option value="${u.userid}">${u.name} (${u.email || '-'})</option>`;
    });
}

// 3. 폼 검증 및 전송
async function sendAdminNotice() {
    const checkedBoxes = document.querySelectorAll('.target-chk:checked');
    const targetUserIds = [...new Set(Array.from(checkedBoxes).map(b => b.value))];

    const title = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();

    if (targetUserIds.length === 0) { alert("발송할 대상을 한 명 이상 선택해주세요."); return; }
    if (!title || !content) { alert("제목과 내용을 모두 입력해주세요."); return; }
    if (!confirm(`총 ${targetUserIds.length}명에게 공지를 발송하시겠습니까?`)) return;

    const targetNamesList = targetUserIds.map(uid => {
        const user = globalUserList.find(u => u.userid === uid);
        return user ? (user.name || user.nickname || '알수없음') : '알수없음';
    });
    
    let targetNamesDisplay = targetNamesList.slice(0, 5).join(', ');
    if (targetNamesList.length > 5) {
        targetNamesDisplay += ` 외 ${targetNamesList.length - 5}명`;
    }

    const token = localStorage.getItem('accessToken');

    try {
        const res = await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_send_notice',
                data: {
                    targetUserIds: targetUserIds, 
                    title: title,
                    content: content,
                    targetNamesDisplay: targetNamesDisplay
                }
            })
        });

        if (res.ok) {
            alert("공지 발송 및 기록 저장이 완료되었습니다.");
            document.getElementById('noticeTitle').value = '';
            document.getElementById('noticeContent').value = '';
            document.querySelectorAll('#noticeTargetCheckboxes input[type="checkbox"]').forEach(c => c.checked = false);
            showNotiMenu('sent'); 
        } else {
            alert("발송 실패");
        }
    } catch(e) { alert("서버 오류 발생"); }
}

// ============================================================
// [H] 알림 센터 사이드바 메뉴 제어 및 보낸 공지함
// ============================================================

// 사이드바에서 알림 하위 메뉴 클릭 시 실행
window.showNotiMenu = function(tabName) {
    // 1. 메인 섹션을 '알림 센터'로 강제 활성화
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    document.getElementById('section-notifications').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. 내부 화면 끄기
    document.getElementById('notiTab-inbox').style.display = 'none';
    document.getElementById('notiTab-send').style.display = 'none';
    document.getElementById('notiTab-sent').style.display = 'none';

    const titleEl = document.getElementById('notiPageTitle');

    // 3. 선택된 메뉴에 맞춰 화면 켜기 및 데이터 로드
    if (tabName === 'inbox') {
        document.getElementById('notiTab-inbox').style.display = 'block';
        titleEl.innerText = '📥 알림 수신함';
        loadNotifications(); // 기존 수신함 로드
    } else if (tabName === 'send') {
        document.getElementById('notiTab-send').style.display = 'block';
        titleEl.innerText = '📢 새 공지 발송';
        loadTutorListForNotice(); // 트리 메뉴 로드
    } else if (tabName === 'sent') {
        document.getElementById('notiTab-sent').style.display = 'block';
        titleEl.innerText = '📤 보낸 공지함';
        loadSentNotices(); // 보낸 내역 로드
    }
};

// 보낸 공지함 데이터 불러오기 및 렌더링
window.loadSentNotices = async function() {
    const token = localStorage.getItem('accessToken');
    const container = document.getElementById('sentNotiListBody');
    container.innerHTML = '<p class="empty-msg">보낸 공지를 불러오는 중...</p>';

    try {
        const response = await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'admin_get_notifications' })
        });
        const data = await response.json();
        
        container.innerHTML = '';
        const sentList = data.sentNotices || [];
        sentList.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (sentList.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding: 30px;">보낸 공지가 없습니다.</p>';
            return;
        }

        sentList.forEach(n => {
            const card = document.createElement('div');
            card.className = `noti-item`; 
            const targetText = n.targetNames ? n.targetNames : `${n.targetCount}명`;

            card.innerHTML = `
                <div style="width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="noti-time">${new Date(n.createdAt).toLocaleString()}</div>
                        <div class="noti-tags">
                            <span class="tag-tutor" style="background:#f1f5f9; color:#475569;">
                                👥 수신: ${escapeHtml(targetText)} (총 ${n.targetCount}명)
                            </span>
                        </div>
                    </div>
                    <div style="font-weight:bold; margin-top:8px; color:#1e293b; font-size:1.1rem;">${escapeHtml(n.title)}</div>
                    <div class="noti-text" style="margin-top:10px; white-space:pre-wrap; background:#f8fafc; padding:15px; border-radius:8px; font-size:0.95rem; border:1px solid #e2e8f0;">${escapeHtml(n.detail)}</div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch(e) { container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
};

// ============================================================
// [I] 튜터 매칭 시스템 로직
// ============================================================
let globalUnmatchedStudents = [];
let globalTutorsForMatch = [];
let globalAllStudentsForMatch = [];

// 매칭 섹션 탭 전환
function switchMatchingTab(tabName) {
    document.getElementById('matchTab_new').style.display = tabName === 'new' ? 'block' : 'none';
    document.getElementById('matchTab_change').style.display = tabName === 'change' ? 'block' : 'none';
    
    document.getElementById('btn-match-new').classList.toggle('active', tabName === 'new');
    document.getElementById('btn-match-change').classList.toggle('active', tabName === 'change');
}

// 매칭에 필요한 전체 데이터 로드 (백그라운드 뱃지용으로도 호출됨)
async function loadMatchingData(isSilent = false) {
    const token = localStorage.getItem('accessToken');
    const adminId = localStorage.getItem('userId');
    
    if (!isSilent) document.getElementById('newMatchList').innerHTML = '<p>데이터를 불러오는 중...</p>';

    try {
        const [tutorRes, studentRes] = await Promise.all([
            fetch(ADMIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'admin_get_tutor_stats' })
            }),
            fetch(ADMIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'admin_search', userId: adminId, data: {} })
            })
        ]);

        const tutorData = await tutorRes.json();
        const studentData = await studentRes.json();

        globalTutorsForMatch = tutorData.tutors || [];
        
        let allUsers = Array.isArray(studentData) ? studentData : (studentData.students || studentData.Items || []);
        globalAllStudentsForMatch = allUsers.filter(u => u.role !== 'admin' && u.role !== 'tutor');

        // 신규 매칭 대상 필터링: 결제 내역 상 Standard/Pro 인데 tutorName이 없는 학생
        globalUnmatchedStudents = globalAllStudentsForMatch.filter(s => {
            if (s.tutorName) return false; // 이미 튜터가 있으면 제외
            const tier = (getTierBadgeHTML(s.payments).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
            const tierLower = tier.toLowerCase();
            return tierLower === 'standard' || tierLower === 'pro';
        });

        // 뱃지 업데이트
        const badge = document.getElementById('matchingBadge');
        const countText = document.getElementById('newMatchCount');
        if (badge && countText) {
            countText.innerText = `(${globalUnmatchedStudents.length})`;
            if (globalUnmatchedStudents.length > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = globalUnmatchedStudents.length;
            } else {
                badge.style.display = 'none';
            }
        }

        if (!isSilent) {
            renderNewMatchingList();
            initTutorChangeSelects();
        }

    } catch (e) { console.error("Matching Data Load Error:", e); }
}

// [신규 매칭] 화면 렌더링
function renderNewMatchingList() {
    const container = document.getElementById('newMatchList');
    container.innerHTML = '';

    if (globalUnmatchedStudents.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #94a3b8; background: #f8fafc; border-radius: 8px;">현재 신규 매칭 대기 중인 학생이 없습니다.</div>';
        return;
    }

    // 튜터 옵션 HTML 생성
    const tutorOptions = globalTutorsForMatch.map(t => `<option value="${t.nickname}">${t.nickname} (${t.name}) - 배정 ${t.totalStudents}명</option>`).join('');

    globalUnmatchedStudents.forEach(s => {
        const tierBadge = getTierBadgeHTML(s.payments);
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div class="match-card-header">
                <div>
                    <h4 class="match-card-name">${escapeHtml(s.name)}</h4>
                    <div class="match-card-date">결제/가입일: ${new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
                <div>${tierBadge}</div>
            </div>
            <div class="match-select-box">
                <select id="select_tutor_${s.userid}">
                    <option value="">튜터 선택...</option>
                    ${tutorOptions}
                </select>
                <button class="match-btn" onclick="executeMatching('${s.userid}', false)">배정하기</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// [튜터 변경] 초기 드롭다운 셋업
function initTutorChangeSelects() {
    const oldSel = document.getElementById('changeOldTutor');
    const newSel = document.getElementById('changeNewTutor');
    
    let options = '<option value="">선택하세요</option>';
    globalTutorsForMatch.forEach(t => {
        options += `<option value="${t.nickname}">${t.nickname} (${t.name})</option>`;
    });

    oldSel.innerHTML = options;
    newSel.innerHTML = options;
}

// [튜터 변경] 기존 튜터 선택 시 소속 학생 목록 업데이트
function updateChangeStudentList() {
    const oldTutorName = document.getElementById('changeOldTutor').value;
    const stuSel = document.getElementById('changeStudent');
    
    if (!oldTutorName) {
        stuSel.innerHTML = '<option value="">먼저 튜터를 선택하세요</option>';
        return;
    }

    const myStus = globalAllStudentsForMatch.filter(s => s.tutorName === oldTutorName);
    
    if (myStus.length === 0) {
        stuSel.innerHTML = '<option value="">배정된 학생이 없습니다.</option>';
        return;
    }

    let stuOptions = '<option value="">학생을 선택하세요</option>';
    myStus.forEach(s => {
        const tier = (getTierBadgeHTML(s.payments).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
        stuOptions += `<option value="${s.userid}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)} (${tier})</option>`;
    });
    
    stuSel.innerHTML = stuOptions;
}

// [튜터 변경] 변경 검토 버튼 클릭 시 재확인 로직
function confirmTutorChange() {
    const oldTutor = document.getElementById('changeOldTutor').value;
    const stuSel = document.getElementById('changeStudent');
    const studentId = stuSel.value;
    const studentName = stuSel.options[stuSel.selectedIndex]?.text || '';
    const newTutor = document.getElementById('changeNewTutor').value;

    if (!oldTutor || !studentId || !newTutor) return alert("모든 항목을 선택해 주세요.");
    if (oldTutor === newTutor) return alert("현재 튜터와 변경할 튜터가 동일합니다.");

    const confirmMsg = `🚨 [튜터 변경 최종 확인]\n\n학생: ${studentName}\n기존 튜터: ${oldTutor} 선생님\n변경 튜터: ${newTutor} 선생님\n\n정말로 튜터를 변경하시겠습니까? 이 작업은 즉시 반영됩니다.`;
    
    if (confirm(confirmMsg)) {
        executeMatching(studentId, true, newTutor, oldTutor);
    }
}

// 매칭/변경 실행 (백엔드 API 호출)
async function executeMatching(studentId, isChange, newTutorArg = null, oldTutorArg = null) {
    const newTutorName = isChange ? newTutorArg : document.getElementById(`select_tutor_${studentId}`).value;
    
    if (!newTutorName) return alert("튜터를 선택해주세요.");

    const token = localStorage.getItem('accessToken');
    const adminId = localStorage.getItem('userId');

    try {
        const res = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_assign_tutor',
                userId: adminId,
                data: {
                    targetUserId: studentId,
                    newTutorName: newTutorName,
                    isChange: isChange,
                    oldTutorName: oldTutorArg
                }
            })
        });

        if (res.ok) {
            alert(isChange ? "튜터가 성공적으로 변경되었습니다." : "튜터 배정이 완료되었습니다.");
            
            // 변경 UI 초기화
            if (isChange) {
                document.getElementById('changeOldTutor').value = '';
                document.getElementById('changeStudent').innerHTML = '<option value="">먼저 튜터를 선택하세요</option>';
                document.getElementById('changeNewTutor').value = '';
            }
            
            // 리스트 갱신
            await loadMatchingData(); 
        } else {
            alert("처리에 실패했습니다.");
        }
    } catch(e) { console.error(e); alert("통신 오류 발생"); }
}

// ============================================================
// [J] 유틸리티
// ============================================================

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getTierBadgeHTML(payments) {
    if (!payments || payments.length === 0) {
        return '<span style="color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:12px; font-size:0.8rem;">FREE</span>';
    }
    const paidHistory = payments.filter(p => p.status === 'paid');
    if (paidHistory.length === 0) {
        return '<span style="color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:12px; font-size:0.8rem;">FREE</span>';
    }

    paidHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestProduct = (paidHistory[0].product || "").toUpperCase();

    if (latestProduct.includes('BLACK')) {
        return '<span style="color:#FFD700; background:#171717; padding:4px 8px; border-radius:12px; font-size:0.8rem; border:1px solid #333; font-weight:bold;">BLACK</span>';
    } else if (latestProduct.includes('PRO')) {
        return '<span style="color:#92400e; background:#fef3c7; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">PRO</span>';
    } else if (latestProduct.includes('STANDARD')) {
        return '<span style="color:#334155; background:#e2e8f0; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">STANDARD</span>';
    } else {
        return '<span style="color:#1e40af; background:#dbeafe; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">BASIC</span>';
    }
}
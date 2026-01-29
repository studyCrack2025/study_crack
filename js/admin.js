// js/admin.js

// 1. 차트 플러그인 등록
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// 2. 전역 변수 및 설정
const ADMIN_API_URL = CONFIG.api.base; 

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
        window.location.href = 'index.html';
        return;
    }

    // 초기 데이터 로드
    loadAdminStats(userId);
    searchStudents(); 
});

// ============================================================
// [A] 네비게이션 및 UI 제어
// ============================================================

function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

// 메인 섹션 전환 (대시보드 / 학생관리)
function showSection(sectionName) {
    // 모든 섹션 숨기기
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    
    // 선택된 섹션 보이기
    if (sectionName === 'students') {
        document.getElementById('section-students').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionName === 'dashboard') {
        document.getElementById('section-dashboard').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionName === 'sales-chart') {
        document.getElementById('section-dashboard').classList.add('active');
        const anchor = document.getElementById('chart-section-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    }
}

// [NEW] Q&A 섹션 전환 및 필터링
function showQnaSection(filterStatus) {
    // 다른 섹션 숨기기
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    // Q&A 섹션 활성화
    const qnaSection = document.getElementById('section-qna');
    if (qnaSection) qnaSection.classList.add('active');
    
    // 필터 설정
    currentQnaFilter = filterStatus;
    
    // 타이틀 변경
    const titleMap = {
        'waiting': '(읽지 않음)',
        'read': '(읽었지만 미응답)',
        'done': '(응답 완료)'
    };
    const titleEl = document.getElementById('qnaStatusTitle');
    if(titleEl) titleEl.innerText = titleMap[filterStatus];

    // 데이터 로드 또는 렌더링
    if (allQnaData.length === 0) {
        loadAllQna(); // 데이터가 없으면 서버에서 가져옴
    } else {
        renderQnaList(); // 있으면 바로 렌더링
    }
}

// ============================================================
// [B] 통계 및 차트 로직 (기존 유지)
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
// [C] 학생 관리 로직 (기존 유지)
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
    window.location.href = `admin_detail.html?uid=${targetUserId}`;
}

// ============================================================
// [D] 질의 관리(Q&A) 로직 (NEW)
// ============================================================

// 1. 전체 질문 불러오기
async function loadAllQna() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    const tbody = document.getElementById('qnaListBody');
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">데이터를 불러오는 중...</td></tr>';
    }

    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type: 'admin_get_all_qna', userId: userId })
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
    const adminId = localStorage.getItem('userId');

    try {
        const res = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_mark_qna_read',
                userId: adminId,
                data: { targetUserId, qnaId }
            })
        });

        if (res.ok) {
            // 로컬 데이터 갱신 (서버 재호출 최소화)
            const item = allQnaData.find(q => q.id === qnaId);
            if(item) item.status = 'read';
            
            // 화면 갱신 (waiting 목록에서 사라짐)
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
    const adminId = localStorage.getItem('userId');

    try {
        const res = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_reply_qna',
                userId: adminId,
                data: {
                    targetUserId: currentReplyTarget.targetUserId,
                    qnaId: currentReplyTarget.qnaId,
                    answer: answer
                }
            })
        });

        if (res.ok) {
            alert("답변이 전송되었습니다.");
            
            // 로컬 데이터 갱신
            const item = allQnaData.find(q => q.id === currentReplyTarget.qnaId);
            if(item) {
                item.status = 'done';
                item.answer = answer;
            }
            
            closeReplyModal();
            renderQnaList(); // read 목록에서 사라짐 -> done으로 이동
        } else {
            alert("전송 실패");
        }
    } catch(e) { console.error(e); alert("오류 발생"); }
}

// ============================================================
// [E] 유틸리티
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
// js/admin.js

const ADMIN_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
// 그래프 객체를 담을 변수 (중복 그리기 방지용)
let salesChart = null;
let currentModalUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 관리자 권한 체크
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    // role이 admin이 아니거나, userId가 없으면 쫓아냄
    if (!userId || role !== 'admin') {
        alert("관리자 권한이 없습니다.");
        window.location.href = 'index.html';
        return;
    }

    // 2. 초기 데이터(통계) 로드
    loadAdminStats(userId);
});

// ==========================================
// [UI] 사이드바 및 화면 전환 기능
// ==========================================

// 하위 메뉴(아코디언) 열고 닫기
function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle('open');
    }
}

// 메인 화면 섹션 전환 (대시보드 <-> 학생관리)
function showSection(sectionName) {
    // 모든 섹션 숨김
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    
    // 선택된 섹션만 보임
    // 'sales-chart'나 'dashboard'를 누르면 대시보드 섹션을 보여줌
    if (sectionName === 'students') {
        document.getElementById('section-students').classList.add('active');
    } else {
        document.getElementById('section-dashboard').classList.add('active');
    }
}

// ==========================================
// [API] 통계 데이터 로드 및 차트 그리기
// ==========================================

async function loadAdminStats(adminId) {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_stats', userId: adminId })
        });
        
        if (!response.ok) throw new Error("권한 없음 또는 서버 오류");

        const data = await response.json();
        
        // 1. 텍스트 데이터 바인딩 (숫자 콤마 찍기)
        document.getElementById('totalUsers').innerText = `${data.totalUsers}명`;
        document.getElementById('totalRevenue').innerText = `${(data.totalRevenue || 0).toLocaleString()}원`;
        document.getElementById('monthlyRevenue').innerText = `${(data.monthlyRevenue || 0).toLocaleString()}원`;

        // 2. 차트 그리기
        renderChart(data.productStats || {});

    } catch (error) {
        console.error(error);
        alert("통계 정보를 불러오지 못했습니다.");
    }
}

function renderChart(statsData) {
    // HTML에 <canvas id="salesChart">가 있어야 함
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // 데이터가 하나도 없으면 '데이터 없음' 표시를 위해 가짜 데이터 0을 넣음
    const labels = Object.keys(statsData).length > 0 ? Object.keys(statsData) : ['판매 내역 없음'];
    const values = Object.keys(statsData).length > 0 ? Object.values(statsData) : [0];

    // 기존에 그려진 차트가 있으면 삭제 (안 하면 마우스 올릴 때 떨림 현상 발생)
    if (salesChart) {
        salesChart.destroy();
    }

    // 새 차트 생성
    salesChart = new Chart(ctx, {
        type: 'bar', // 막대 그래프
        data: {
            labels: labels,
            datasets: [{
                label: '매출액 (원)',
                data: values,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.6)', // 파랑
                    'rgba(16, 185, 129, 0.6)', // 초록
                    'rgba(245, 158, 11, 0.6)', // 노랑
                    'rgba(239, 68, 68, 0.6)'   // 빨강
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₩' + value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false }, // 범례 숨김 (깔끔하게)
                title: {
                    display: true,
                    text: '상품별 총 매출 현황'
                }
            }
        }
    });
}

// ==========================================
// [API] 학생 검색 기능
// ==========================================

async function searchStudents() {
    const adminId = localStorage.getItem('userId');
    const type = document.getElementById('searchType').value;
    const keyword = document.getElementById('searchInput').value;
    const tbody = document.getElementById('studentListBody');

    if(!keyword) { alert("검색어를 입력하세요"); return; }

    // 로딩 표시
    tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>데이터 조회 중...</td></tr>";

    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_search',
                userId: adminId,
                data: { searchType: type, keyword: keyword }
            })
        });
        
        const students = await response.json();
        
        tbody.innerHTML = "";
        
        if (!students || students.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>검색 결과가 없습니다.</td></tr>";
            return;
        }

        // 검색 결과 테이블 렌더링
        students.forEach(s => {
            // 결제 여부 확인 (payments 배열이 있고 길이가 0보다 크면 유료회원)
            const isPaid = s.payments && s.payments.length > 0;
            const statusBadge = isPaid 
                ? '<span style="color:#16a34a; font-weight:bold; background:#dcfce7; padding:4px 8px; border-radius:12px; font-size:0.8rem;">PREMIUM</span>' 
                : '<span style="color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:12px; font-size:0.8rem;">FREE</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.name || '(이름없음)'}</strong></td>
                <td>${s.email || '-'}</td>
                <td>${s.school || '-'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button style="padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.9rem;" 
                            onclick="openStudentModal('${s.userid}')">
                        상세보기
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>오류가 발생했습니다.</td></tr>";
    }
}

// ==========================================
// [API] 학생 상세 보기 (모달)
// ==========================================

async function openStudentModal(targetUserId) {
    const adminId = localStorage.getItem('userId');
    currentModalUserId = targetUserId;
    
    const modal = document.getElementById('studentModal');
    if(modal) modal.classList.remove('hidden');
    
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_get_user_detail',
                userId: adminId,
                data: { targetUserId }
            })
        });

        const student = await response.json();
        renderStudentDetail(student);

    } catch (error) {
        alert("학생 상세 정보를 불러오지 못했습니다.");
    }
}

function renderStudentDetail(s) {
    // 모달 상단 이름
    const titleEl = document.getElementById('modalStudentName');
    if(titleEl) titleEl.innerText = `${s.name || '학생'} 상세 정보`;
    
    // 1. 관리자 메모
    const memoEl = document.getElementById('adminMemoInput');
    if(memoEl) memoEl.value = s.adminMemo || '';

    // 2. 기본 정보 탭
    setText('viewSchool', s.school);
    setText('viewPhone', s.phone);

    // 3. 정성 조사서 탭
    const q = s.qualitative || {};
    setText('viewStatus', q.status);
    setText('viewStream', q.stream);
    setText('viewCareer', q.career);
    setText('viewTargets', q.targets ? q.targets.join(', ') : '-');

    // 4. 성적표 탭
    const quan = s.quantitative || {};
    const scoreBox = document.getElementById('viewScoreTable');
    if (scoreBox) {
        if (Object.keys(quan).length === 0) {
            scoreBox.innerHTML = '<p style="color:#94a3b8; text-align:center;">입력된 성적이 없습니다.</p>';
        } else {
            let scoreHtml = '<ul style="padding-left:20px; line-height:1.8;">';
            for(const [exam, data] of Object.entries(quan)) {
                // exam 코드를 한글로 변환 (예: mar -> 3월 학평)
                const examName = convertExamName(exam);
                scoreHtml += `<li><strong>${examName}:</strong> 국어(${data.kor?.grd || '-'}), 수학(${data.math?.grd || '-'}), 영어(${data.eng?.grd || '-'})</li>`;
            }
            scoreHtml += "</ul>";
            scoreBox.innerHTML = scoreHtml;
        }
    }

    // 5. 결제 내역 탭
    const payList = document.getElementById('viewPaymentList');
    if (payList) {
        payList.innerHTML = "";
        if (s.payments && s.payments.length > 0) {
            s.payments.forEach(p => {
                // 날짜 포맷팅 (YYYY-MM-DD 만 보여주기 등)
                const simpleDate = p.date ? p.date.split(' ')[0] : '-';
                payList.innerHTML += `
                    <li style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                        <span style="font-weight:bold; color:#2563EB;">[${simpleDate}]</span> 
                        ${p.product} 
                        <span style="float:right; font-weight:bold;">${parseInt(p.amount).toLocaleString()}원</span>
                    </li>`;
            });
        } else {
            payList.innerHTML = '<p style="color:#94a3b8; text-align:center;">결제 내역이 없습니다.</p>';
        }
    }
}

// 헬퍼 함수: ID로 엘리먼트 찾아 텍스트 넣기
function setText(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text || '-';
}

// 헬퍼 함수: 시험 코드 변환
function convertExamName(code) {
    const map = {
        'mar': '3월 학평', 'may': '5월 학평', 'jun': '6월 모평',
        'jul': '7월 학평', 'sep': '9월 모평', 'oct': '10월 학평', 'csat': '수능'
    };
    return map[code] || code;
}

// === [API] 관리자 메모 저장 ===
async function saveAdminMemo() {
    const adminId = localStorage.getItem('userId');
    const memo = document.getElementById('adminMemoInput').value;

    if(!currentModalUserId) return;

    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_update_memo',
                userId: adminId,
                data: { targetUserId: currentModalUserId, memo: memo }
            })
        });
        alert("메모가 저장되었습니다.");
    } catch (error) {
        alert("저장 실패");
    }
}

// === UI: 모달 닫기 및 탭 전환 ===
function closeModal() {
    const modal = document.getElementById('studentModal');
    if(modal) modal.classList.add('hidden');
    currentModalUserId = null;
}

function switchModalTab(tabName) {
    document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetView = document.getElementById('view_' + tabName);
    if(targetView) targetView.classList.add('active');
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
}
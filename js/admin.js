// js/admin.js

const ADMIN_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
let salesChart = null;  // 상품별 차트 객체
let periodChart = null; // ★ 기간별 차트 객체

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    if (!userId || role !== 'admin') {
        alert("관리자 권한이 없습니다.");
        window.location.href = 'index.html';
        return;
    }

    // 1. 통계 로드
    loadAdminStats(userId);
    
    // 2. ★ 학생 전체 목록 즉시 로드 (검색어 없이 호출)
    searchStudents(); 
});

// UI: 사이드바 토글
function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

// UI: 섹션 전환
function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    
    if (sectionName === 'students') {
        document.getElementById('section-students').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionName === 'dashboard') {
        document.getElementById('section-dashboard').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionName === 'sales-chart') {
        document.getElementById('section-dashboard').classList.add('active');
        document.getElementById('chart-section-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }
}

// API: 통계 로드 & 차트 그리기
async function loadAdminStats(adminId) {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_stats', userId: adminId })
        });
        
        if (!response.ok) throw new Error("서버 오류");
        const data = await response.json();
        
        document.getElementById('totalUsers').innerText = `${data.totalUsers}명`;
        document.getElementById('totalRevenue').innerText = `${(data.totalRevenue || 0).toLocaleString()}원`;
        document.getElementById('monthlyRevenue').innerText = `${(data.monthlyRevenue || 0).toLocaleString()}원`;

        // 두 가지 차트 렌더링
        renderProductChart(data.productStats || {});
        renderPeriodChart(data.periodStats || {}); // ★ 신규 추가

    } catch (error) {
        console.error(error);
        alert("통계 정보를 불러오지 못했습니다.");
    }
}

// [차트 1] 상품별 매출 (기존)
function renderProductChart(statsData) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    const labels = Object.keys(statsData);
    const values = Object.values(statsData);

    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'doughnut', // 원형 차트가 비중 보기에 더 예쁩니다 (bar로 해도 됨)
        data: {
            labels: labels.length ? labels : ['데이터 없음'],
            datasets: [{
                data: values.length ? values : [1], // 빈 데이터면 회색 1
                backgroundColor: values.length ? ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'] : ['#e2e8f0'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // 크기 자동 조절
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// [차트 2] ★ 기간별 매출 추이 (신규 - 꺾은선 그래프)
function renderPeriodChart(statsData) {
    const ctx = document.getElementById('periodChart');
    if (!ctx) return;

    // 날짜 순으로 정렬 (2025-10, 2025-11...)
    const sortedKeys = Object.keys(statsData).sort(); 
    const sortedValues = sortedKeys.map(key => statsData[key]);

    if (periodChart) periodChart.destroy();

    periodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedKeys.length ? sortedKeys : ['데이터 없음'],
            datasets: [{
                label: '월별 매출',
                data: sortedValues.length ? sortedValues : [0],
                borderColor: '#3b82f6', // 파란 선
                backgroundColor: 'rgba(59, 130, 246, 0.1)', // 선 아래 채우기
                fill: true,
                tension: 0.3, // 곡선 부드럽게
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { callback: v => '₩' + v.toLocaleString() }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// API: 학생 검색 (전체 목록 로드 포함)
async function searchStudents() {
    const adminId = localStorage.getItem('userId');
    const type = document.getElementById('searchType').value;
    // 입력값이 없으면 빈 문자열 전송 -> 전체 목록 반환됨
    const keyword = document.getElementById('searchInput').value || ""; 
    const tbody = document.getElementById('studentListBody');

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
            tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>데이터가 없습니다.</td></tr>";
            return;
        }

        students.forEach(s => {
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
                    <button style="padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer;" 
                            onclick="goToStudentDetail('${s.userid}')">
                        상세관리
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>오류가 발생했습니다.</td></tr>";
    }
}

function goToStudentDetail(targetUserId) {
    window.location.href = `admin_student_detail.html?uid=${targetUserId}`;
}
// js/admin.js

// ★ [필수] 차트 플러그인 등록 (퍼센트 라벨 표시용)
// HTML 헤더에 chartjs-plugin-datalabels 스크립트가 있어야 작동합니다.
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

const ADMIN_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
let salesChart = null;  // 상품별 차트
let periodChart = null; // 기간별 차트
let rawPaymentData = []; // ★ 서버에서 받은 전체 데이터를 저장해두는 변수

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    // 1. 관리자 권한 체크
    if (!userId || role !== 'admin') {
        alert("관리자 권한이 없습니다.");
        window.location.href = 'index.html';
        return;
    }

    // 2. 통계 로드
    loadAdminStats(userId);
    
    // 3. 학생 전체 목록 즉시 로드
    searchStudents(); 
});

// ==========================================
// [UI] 사이드바 및 화면 전환
// ==========================================

function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

function showSection(sectionName) {
    // 모든 섹션 숨김
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    
    if (sectionName === 'students') {
        document.getElementById('section-students').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } else if (sectionName === 'dashboard') {
        document.getElementById('section-dashboard').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } else if (sectionName === 'sales-chart') {
        document.getElementById('section-dashboard').classList.add('active');
        // 차트 섹션으로 스크롤 이동
        const anchor = document.getElementById('chart-section-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==========================================
// [API] 통계 데이터 로드 및 가공
// ==========================================

async function loadAdminStats(adminId) {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_stats', userId: adminId })
        });
        
        if (!response.ok) throw new Error("서버 오류");
        const data = await response.json();
        
        // 1. 텍스트 요약 정보 표시
        document.getElementById('totalUsers').innerText = `${data.totalUsers}명`;
        document.getElementById('totalRevenue').innerText = `${(data.totalRevenue || 0).toLocaleString()}원`;
        document.getElementById('monthlyRevenue').innerText = `${(data.monthlyRevenue || 0).toLocaleString()}원`;

        // 2. 전체 결제 내역 저장 (프론트엔드 가공용)
        rawPaymentData = data.allPayments || [];

        // 3. 초기 차트 그리기 (기본값: 월간)
        updateCharts();

    } catch (error) {
        console.error(error);
        alert("통계 정보를 불러오지 못했습니다.");
    }
}

// === 차트 업데이트 컨트롤러 (드롭다운 변경 시 호출) ===
function updateCharts() {
    // HTML의 <select id="periodSelector"> 값 가져오기
    const selector = document.getElementById('periodSelector');
    const periodType = selector ? selector.value : 'month'; // week, month, quarter
    
    // 1. 데이터 가공 (선택된 기간 단위로 묶기)
    const aggregated = aggregateData(rawPaymentData, periodType);
    
    // 2. 차트 렌더링
    renderPeriodChart(aggregated.labels, aggregated.amounts);
    renderProductChart(aggregated.productCounts, aggregated.totalAmount);
}

// === 데이터 집계 로직 (핵심) ===
function aggregateData(payments, type) {
    const timeMap = {};
    const productMap = {};
    let total = 0;

    payments.forEach(pay => {
        const date = new Date(pay.date);
        let key = "";

        // 기간 키 생성 로직
        if (type === 'week') {
            const year = date.getFullYear();
            const week = getWeekNumber(date);
            key = `${year}-W${week}`; // 예: 2026-W02
        } else if (type === 'month') {
            key = pay.date.substring(0, 7); // 예: 2026-01
        } else if (type === 'quarter') {
            const year = date.getFullYear();
            const q = Math.floor(date.getMonth() / 3) + 1;
            key = `${year}-Q${q}`; // 예: 2026-Q1
        }

        // 1. 시간대별 매출 합산
        timeMap[key] = (timeMap[key] || 0) + pay.amount;

        // 2. 상품별 매출 합산
        const prod = pay.product || "기타";
        productMap[prod] = (productMap[prod] || 0) + pay.amount;
        
        total += pay.amount;
    });

    // 날짜순 정렬
    const labels = Object.keys(timeMap).sort();
    const amounts = labels.map(k => timeMap[k]);

    return { labels, amounts, productCounts: productMap, totalAmount: total };
}

// (헬퍼) 주차 계산 함수
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}


// ==========================================
// [Chart.js] 차트 렌더링 함수들
// ==========================================

// [차트 1] 기간별 매출 추이 (꺾은선)
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
                tension: 0.3, // 부드러운 곡선
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // ★ CSS 높이(300px)를 따르도록 설정
            plugins: { 
                legend: { display: false },
                // 꺾은선에는 숫자 라벨 끔 (너무 복잡해짐)
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

// [차트 2] 상품별 판매 비중 (도넛) + 퍼센트 라벨
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
            maintainAspectRatio: false, // ★ CSS 높이를 따르도록 설정
            plugins: {
                legend: { position: 'right' }, // 범례 오른쪽
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value, ctx) => {
                        if (total === 0) return '';
                        // 퍼센트 계산 및 표시
                        let percentage = ((value / total) * 100).toFixed(1) + "%";
                        // 너무 작은 섹션(5% 미만)은 글씨 숨기기 (겹침 방지)
                        if ((value / total) < 0.05) return ''; 
                        return percentage;
                    }
                }
            }
        }
    });
}

// ==========================================
// [API] 학생 검색 및 상세페이지 이동
// ==========================================

async function searchStudents() {
    const adminId = localStorage.getItem('userId');
    const type = document.getElementById('searchType').value;
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
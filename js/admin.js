// js/admin.js

if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// API URL
const ADMIN_API_URL = CONFIG.api.base; 

let salesChart = null;  
let periodChart = null; 
let rawPaymentData = []; 

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    if (!userId || role !== 'admin') {
        alert("관리자 권한이 없습니다.");
        window.location.href = 'index.html';
        return;
    }

    loadAdminStats(userId);
    searchStudents(); 
});

function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

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
        const anchor = document.getElementById('chart-section-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    }
}

async function loadAdminStats(adminId) {
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // ★ 토큰 추가
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
        
        let students = await response.json();
        
        if (type === 'paid') {
            students = students.filter(s => 
                s.payments && s.payments.some(p => p.status === 'paid')
            );
        } else if (type === 'unpaid') {
            students = students.filter(s => 
                !s.payments || !s.payments.some(p => p.status === 'paid')
            );
        }

        tbody.innerHTML = "";
        
        if (!students || students.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>조건에 맞는 학생이 없습니다.</td></tr>";
            return;
        }

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
        console.error(error);
        tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>오류가 발생했습니다.</td></tr>";
    }
}

function goToStudentDetail(targetUserId) {
    window.location.href = `admin_detail.html?uid=${targetUserId}`;
}

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
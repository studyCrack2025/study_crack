// js/admin/stats.js
// 대시보드 통계 및 차트 로직
// ADMIN_API_URL, apiFetch, escapeHtml 은 auth.js / admin_ui.js 에서 제공

async function loadAdminStats(adminId) {
    try {
        const response = await apiFetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_stats', userId: adminId })
        });

        const data = await response.json();

        const totalStudentsEl = document.getElementById('totalStudents');
        if (totalStudentsEl) {
            totalStudentsEl.innerText = `${(Number(data.totalStudents) || 0).toLocaleString()}명`;
        }
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

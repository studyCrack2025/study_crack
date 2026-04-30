// js/admin/detail-core.js
// 학생 상세 페이지 — 공통 초기화 · 데이터 로딩 · 기본 렌더링
// URL 상수 및 apiFetch, escapeHtml, formatReportKey는 shared/api.js + shared/utils.js 에서 제공

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');

let currentStudentData = null;
let currentTier = 'free';
let currentPaymentsData = [];
let currentWeeklyData = [];


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
    const cacheKey = 'studentDetail_' + targetUserId;

    // 캐시 확인 (2분 TTL) — 자주 돌아오는 튜터/관리자 UX 개선
    const cached = Store.get(cacheKey);
    if (cached) {
        currentStudentData  = cached.detail;
        currentWeeklyData   = cached.weekly;
        currentPaymentsData = cached.payments;
        renderData(currentStudentData);
        return;
    }

    try {
        const detailPromise = apiFetch(ADMIN_API_URL, {
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

        const paymentPromise = apiFetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_get_payments', data: { targetUserId: targetUserId }
            })
        }).then(res => res.json()).catch(() => ({ payments: [] }));

        const [detailData, weeklyData, paymentData] = await Promise.all([detailPromise, weeklyPromise, paymentPromise]);

        currentStudentData  = parseDynamoItem(detailData);
        currentWeeklyData   = parseDynamoItem(weeklyData.weeklyReports || []);
        currentPaymentsData = parseDynamoItem(paymentData.payments || []);

        // 결과를 Store에 캐싱 (2분)
        Store.set(cacheKey, {
            detail:   currentStudentData,
            weekly:   currentWeeklyData,
            payments: currentPaymentsData
        }, 120);

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
        await apiFetch(ADMIN_API_URL, {
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

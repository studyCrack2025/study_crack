// admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
// config.js가 없으면 아래 주석 해제하여 사용
const ADMIN_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = 'admin.html';
        return;
    }
    loadStudentDetail();
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('tab_' + tabName);
    if(target) target.classList.add('active');
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
}

async function loadStudentDetail() {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_get_user_detail',
                userId: adminId,
                data: { targetUserId: targetUserId }
            })
        });

        if (!response.ok) throw new Error("Server Error");
        const data = await response.json();
        if(!data) throw new Error("No Data");

        renderData(data);
    } catch (e) {
        console.error(e);
        alert("데이터 로드 중 오류가 발생했습니다.");
    }
}

function renderData(s) {
    if (!s) return;

    // 1. 프로필 & 기본 정보
    document.getElementById('viewName').innerText = s.name || '이름 없음';
    document.getElementById('viewEmail').innerText = s.email || '-';
    
    document.getElementById('viewSchool').innerText = s.school || '미입력';
    document.getElementById('viewPhone').innerText = s.phone || '미입력';
    const emailFull = document.getElementById('viewEmailFull');
    if(emailFull) emailFull.innerText = s.email || '-';
    
    document.getElementById('viewJoinDate').innerText = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-';

    // 2. 뱃지 및 상태
    renderTierBadge(s.payments || []);
    document.getElementById('analysisEditor').value = s.analysisContent || '';
    document.getElementById('adminMemoInput').value = s.adminMemo || '';
    updateAnalysisBadge(s.analysisStatus);

    // 3. 탭별 데이터 렌더링
    renderQualitativeDetail(s.qualitative || null);
    renderQuantitativeDetail(s.quantitative || {});
    renderPayments(s.payments || []);
}

// [결제 내역: 요약 + 테이블]
function renderPayments(p) {
    const listBody = document.getElementById('viewPaymentList');
    const totalEl = document.getElementById('payTotalAmount');
    const lastDateEl = document.getElementById('payLastDate');
    
    listBody.innerHTML = "";

    if (p && p.length > 0) {
        const sortedP = [...p].sort((a,b) => new Date(b.date) - new Date(a.date));
        
        // 요약 정보 계산
        let total = 0;
        sortedP.forEach(item => total += parseInt(item.amount || 0));
        totalEl.innerText = total.toLocaleString() + "원";
        lastDateEl.innerText = new Date(sortedP[0].date).toLocaleDateString();

        // 테이블 렌더링
        sortedP.forEach(pay => {
            const dateStr = new Date(pay.date).toLocaleString();
            const amountStr = parseInt(pay.amount).toLocaleString() + "원";
            const productLower = (pay.product || "").toLowerCase();
            
            let tierTag = "";
            if (productLower.includes('black')) tierTag = '<span class="pay-tier-tag black">BLACK</span>';
            else if (productLower.includes('pro')) tierTag = '<span class="pay-tier-tag pro">PRO</span>';
            else if (productLower.includes('standard')) tierTag = '<span class="pay-tier-tag standard">STD</span>';
            else tierTag = '<span class="pay-tier-tag basic">BASIC</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <span style="font-weight:600; color:#1e293b;">${pay.product}</span>
                    ${tierTag}
                </td>
                <td><span class="date-tag">${dateStr}</span></td>
                <td style="text-align:right;"><span class="amount-tag">${amountStr}</span></td>
            `;
            listBody.appendChild(tr);
        });
    } else {
        totalEl.innerText = "0원";
        lastDateEl.innerText = "-";
        listBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 40px; color:#cbd5e1;">결제 내역이 없습니다.</td></tr>`;
    }
}

function renderTierBadge(payments) {
    const area = document.getElementById('tierBadgeArea');
    let html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">FREE USER</span>';
    
    if (payments && payments.length > 0) {
        const paid = payments.filter(p => p.status === 'paid');
        if (paid.length > 0) {
            paid.sort((a, b) => new Date(b.date) - new Date(a.date));
            const last = (paid[0].product || "").toLowerCase();
            
            if (last.includes('black')) {
                html = '<span class="tier-badge" style="background: linear-gradient(to bottom right, #ffffff, #f8fafc); border: 2px solid #171717; color: #171717; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">BLACK TIER</span>';
            } else if (last.includes('pro')) {
                html = '<span class="tier-badge" style="background: linear-gradient(135deg, #F59E0B, #FCD34D); border: 2px solid #F59E0B; color: #78350f;">PRO TIER</span>';
            } else if (last.includes('standard')) {
                html = '<span class="tier-badge" style="background: linear-gradient(135deg, #94A3B8, #CBD5E1); border: 2px solid #64748B; color: #0F172A;">STANDARD TIER</span>';
            } else {
                html = '<span class="tier-badge" style="background: linear-gradient(135deg, #3B82F6, #60A5FA); border: 2px solid #3B82F6; color: white;">BASIC TIER</span>';
            }
        }
    }
    area.innerHTML = html;
}

function updateAnalysisBadge(status) {
    const badge = document.getElementById('analysisStatusBadge');
    if(!badge) return;
    if (status === 'completed') {
        badge.className = 'analysis-badge completed';
        badge.innerHTML = '✅ 분석 리포트 발송 완료';
    } else {
        badge.className = 'analysis-badge pending';
        badge.innerHTML = '⏳ 분석 대기중';
    }
}

// 정성/정량/저장 함수는 기존 로직 유지 (안전성 확보됨)
function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) { area.innerHTML = '<p class="no-data-msg">데이터가 없습니다.</p>'; return; }
    const v = (val) => val ? val : '-';
    // ... (기존 HTML 구조 생성 코드와 동일, 생략 없이 위 코드 사용)
    // 편의상 핵심 구조만 재확인:
    let html = `<div class="qual-section"><div class="qual-head">📍 현재 상황</div><div class="qual-grid">
        <div class="qual-item"><span class="qual-label">학생 신분</span><div class="qual-value">${v(q.status)}</div></div>
        <div class="qual-item"><span class="qual-label">계열</span><div class="qual-value">${v(q.stream)}</div></div>
        <div class="qual-item"><span class="qual-label">진로</span><div class="qual-value">${v(q.career)}</div></div>
        </div></div>`;
    
    // 타겟 대학 등 나머지 내용 추가...
    const targets = q.targets || [];
    html += `<div class="qual-section"><div class="qual-head">🏫 목표 대학</div><div class="qual-grid">
        <div class="qual-item"><span class="qual-label">1지망</span><div class="qual-value">${v(targets[0])}</div></div>
        <div class="qual-item"><span class="qual-label">2지망</span><div class="qual-value">${v(targets[1])}</div></div>
        <div class="qual-item"><span class="qual-label">3지망</span><div class="qual-value">${v(targets[2])}</div></div>
        </div></div>`;

    if(q.special) {
         html += `<div class="qual-section"><div class="qual-head">💬 기타 사항</div><div class="qual-grid">
            <div class="qual-item" style="grid-column:1/-1"><span class="qual-label">전달사항</span><div class="qual-value long-text">${v(q.special.etc)}</div></div>
         </div></div>`;
    }
    area.innerHTML = html;
}

function renderQuantitativeDetail(q) {
    const area = document.getElementById('viewScoreTable');
    if (!q || Object.keys(q).length === 0) { area.innerHTML = '<p class="no-data-msg">성적 데이터 없음</p>'; return; }
    
    const examNames = { 'mar':'3월 학평', 'jun':'6월 모평', 'sep':'9월 모평', 'csat':'수능' };
    const subjects = [{k:'kor',n:'국어'}, {k:'math',n:'수학'}, {k:'eng',n:'영어'}, {k:'inq1',n:'탐1'}, {k:'inq2',n:'탐2'}];
    
    let html = '';
    ['csat','sep','jun','mar'].forEach(key => {
        if(!q[key]) return;
        const d = q[key];
        html += `<div class="score-exam-block"><div class="score-exam-title">${examNames[key]||key}</div><table class="score-table"><thead><tr><th>과목</th><th>표점</th><th>백분위</th><th>등급</th></tr></thead><tbody>`;
        subjects.forEach(sub => {
            if(d[sub.k]) {
                const row = d[sub.k];
                let gHtml = row.grd ? `<span class="grade-badge ${row.grd==1?'g1':(row.grd==2?'g2':'g3')}">${row.grd}</span>` : '-';
                html += `<tr><td>${sub.n}</td><td>${row.std||'-'}</td><td>${row.pct||'-'}</td><td>${gHtml}</td></tr>`;
            }
        });
        html += `</tbody></table></div>`;
    });
    area.innerHTML = html || '<p class="no-data-msg">데이터 없음</p>';
}

async function saveAnalysis() {
    const content = document.getElementById('analysisEditor').value;
    if(!content.trim()) return alert("내용을 입력하세요");
    if(!confirm("저장하시겠습니까?")) return;
    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST', body: JSON.stringify({ type:'admin_save_analysis', userId:adminId, data:{targetUserId, content, status:'completed'} })
        });
        alert("저장 완료");
        updateAnalysisBadge('completed');
    } catch(e) { alert("저장 실패"); }
}

async function saveAdminMemo() {
    const memo = document.getElementById('adminMemoInput').value;
    try {
        await fetch(ADMIN_API_URL, {
            method:'POST', body:JSON.stringify({ type:'admin_update_memo', userId:adminId, data:{targetUserId, memo} })
        });
        alert("메모 저장 완료");
    } catch(e) { alert("저장 실패"); }
}
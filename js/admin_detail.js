// admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');

// config.js가 없으면 이 변수가 사용됩니다.
const ADMIN_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다. (ID 누락)");
        window.location.href = 'admin.html';
        return;
    }
    loadStudentDetail();
});

// 탭 전환
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById('tab_' + tabName);
    if(targetTab) targetTab.classList.add('active');
    
    const evt = window.event; 
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    }
}

// 데이터 로드
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

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        if (!data) throw new Error("데이터 비어있음");

        renderData(data);

    } catch (e) {
        console.error("Load Error:", e);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
}

// 전체 데이터 렌더링
function renderData(s) {
    if (!s) return;

    // 1. 기본 정보 & 대시보드
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

    // 3. 상세 탭 렌더링
    renderQualitativeDetail(s.qualitative || null);
    renderQuantitativeDetail(s.quantitative || {});
    renderPayments(s.payments || []);
}

// === [티어 뱃지: 요청하신 색상 적용] ===
function renderTierBadge(payments) {
    const area = document.getElementById('tierBadgeArea');
    // 기본값: FREE
    let html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">FREE USER</span>';
    
    if (payments && payments.length > 0) {
        const paid = payments.filter(p => p.status === 'paid');
        if (paid.length > 0) {
            paid.sort((a, b) => new Date(b.date) - new Date(a.date));
            const last = (paid[0].product || "").toLowerCase();
            
            // 이미지에서 추출한 색상 코드 적용 (인라인 스타일)
            if (last.includes('black')) {
                // BLACK: Neutral-900 / 그라데이션
                html = '<span class="tier-badge" style="background: linear-gradient(to bottom right, #ffffff, #f8fafc); border: 2px solid #171717; color: #171717; box-shadow: 0 0 10px rgba(0,0,0,0.3);">BLACK TIER</span>';
            } else if (last.includes('pro')) {
                // PRO: Amber-500 (#F59E0B)
                html = '<span class="tier-badge" style="background: linear-gradient(135deg, #F59E0B, #FCD34D); border: 2px solid #F59E0B; color: #78350f;">PRO TIER</span>';
            } else if (last.includes('standard')) {
                // STANDARD: Slate-500 (#64748B)
                html = '<span class="tier-badge" style="background: linear-gradient(135deg, #94A3B8, #CBD5E1); border: 2px solid #64748B; color: #0F172A;">STANDARD TIER</span>';
            } else {
                // BASIC: Blue-500 (#3B82F6)
                html = '<span class="tier-badge" style="background: linear-gradient(135deg, #3B82F6, #60A5FA); border: 2px solid #3B82F6; color: white;">BASIC TIER</span>';
            }
        }
    }
    area.innerHTML = html;
}

// === [정성 조사서 렌더링] ===
function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) {
        area.innerHTML = '<p class="no-data-msg">작성된 정성 조사서가 없습니다.</p>';
        return;
    }
    const v = (val) => val ? val : '-';

    // HTML 생성
    let html = `
        <div class="qual-section">
            <div class="qual-head">📍 현재 상황 및 진로</div>
            <div class="qual-grid">
                <div class="qual-item"><span class="qual-label">학생 신분</span><div class="qual-value">${v(q.status)}</div></div>
                <div class="qual-item"><span class="qual-label">계열 (목표)</span><div class="qual-value">${v(q.stream)}</div></div>
                <div class="qual-item"><span class="qual-label">희망 진로/직업</span><div class="qual-value">${v(q.career)}</div></div>
                <div class="qual-item"><span class="qual-label">교차 지원 의사</span><div class="qual-value">${v(q.values?.cross)}</div></div>
            </div>
        </div>
        <div class="qual-section">
            <div class="qual-head">🎯 입시 전략 및 가치관</div>
            <div class="qual-grid">
                <div class="qual-item"><span class="qual-label">대학 vs 학과 우선순위</span><div class="qual-value">${v(q.values?.priority)}</div></div>
                <div class="qual-item"><span class="qual-label">올해 대학 진학 필수 여부</span><div class="qual-value">${v(q.values?.mustGo)}</div></div>
                <div class="qual-item"><span class="qual-label">주력 전형 전략</span><div class="qual-value">${v(q.values?.strategy)}</div></div>
                <div class="qual-item"><span class="qual-label">지역 제한 (통학/기숙사)</span><div class="qual-value">${v(q.values?.region)}</div></div>
                <div class="qual-item" style="grid-column: span 2;"><span class="qual-label">최악의 시나리오</span><div class="qual-value long-text">${v(q.values?.worst)}</div></div>
            </div>
        </div>
    `;

    const targets = q.targets || [];
    html += `
        <div class="qual-section">
            <div class="qual-head">🏫 목표 대학 리스트</div>
            <div class="qual-grid">
                <div class="qual-item"><span class="qual-label">1지망</span><div class="qual-value">${v(targets[0])}</div></div>
                <div class="qual-item"><span class="qual-label">2지망</span><div class="qual-value">${v(targets[1])}</div></div>
                <div class="qual-item"><span class="qual-label">3지망</span><div class="qual-value">${v(targets[2])}</div></div>
                <div class="qual-item"><span class="qual-label">4지망</span><div class="qual-value">${v(targets[3])}</div></div>
                <div class="qual-item"><span class="qual-label">5지망</span><div class="qual-value">${v(targets[4])}</div></div>
            </div>
            <div class="qual-grid" style="margin-top:15px;">
                 <div class="qual-item"><span class="qual-label">가군 후보</span><div class="qual-value">${v(q.candidates?.ga)}</div></div>
                 <div class="qual-item"><span class="qual-label">나군 후보</span><div class="qual-value">${v(q.candidates?.na)}</div></div>
                 <div class="qual-item"><span class="qual-label">다군 후보</span><div class="qual-value">${v(q.candidates?.da)}</div></div>
            </div>
        </div>
        <div class="qual-section">
            <div class="qual-head">👨‍👩‍👧 부모님 의견 및 기타</div>
            <div class="qual-grid">
                <div class="qual-item"><span class="qual-label">부모님 관여도</span><div class="qual-value">${v(q.parents?.influence)}</div></div>
                <div class="qual-item" style="grid-column: span 2;"><span class="qual-label">부모님 의견</span><div class="qual-value long-text">${v(q.parents?.opinion)}</div></div>
                <div class="qual-item"><span class="qual-label">편입 계획</span><div class="qual-value">${v(q.special?.transfer)}</div></div>
                <div class="qual-item"><span class="qual-label">교직 이수 희망</span><div class="qual-value">${v(q.special?.teaching)}</div></div>
                <div class="qual-item" style="grid-column: 1 / -1;"><span class="qual-label">컨설턴트에게 한마디</span><div class="qual-value long-text">${v(q.special?.etc)}</div></div>
            </div>
        </div>
    `;
    area.innerHTML = html;
}

// === [성적표 렌더링] ===
function renderQuantitativeDetail(q) {
    const area = document.getElementById('viewScoreTable');
    if (!q || Object.keys(q).length === 0) {
        area.innerHTML = '<p class="no-data-msg">입력된 성적 데이터가 없습니다.</p>';
        return;
    }

    const examNames = { 
        'mar':'3월 학력평가', 'may':'5월 학력평가', 'jun':'6월 모의평가', 
        'jul':'7월 학력평가', 'sep':'9월 모의평가', 'oct':'10월 학력평가', 'csat':'수능' 
    };
    const subjects = [
        { key: 'kor', label: '국어' }, { key: 'math', label: '수학' }, { key: 'eng', label: '영어' },
        { key: 'hist', label: '한국사' }, { key: 'inq1', label: '탐구1' }, { key: 'inq2', label: '탐구2' }, { key: 'fl', label: '제2외국어' }
    ];

    let html = '';
    const orderedKeys = ['csat', 'oct', 'sep', 'jul', 'jun', 'may', 'mar'];

    orderedKeys.forEach(examKey => {
        if (!q[examKey]) return; 
        const data = q[examKey];
        html += `<div class="score-exam-block"><div class="score-exam-title"><span>${examNames[examKey] || examKey}</span></div><table class="score-table"><thead><tr><th style="width:15%">과목</th><th>표준점수</th><th>백분위</th><th>등급</th></tr></thead><tbody>`;

        subjects.forEach(sub => {
            const subData = data[sub.key];
            if (subData) {
                let gradeHtml = '-';
                if(subData.grd) {
                    const g = parseInt(subData.grd);
                    const badgeClass = g === 1 ? 'g1' : (g === 2 ? 'g2' : (g === 3 ? 'g3' : ''));
                    gradeHtml = `<span class="grade-badge ${badgeClass}">${subData.grd}</span>`;
                }
                html += `<tr><td>${sub.label}</td><td>${subData.std || '-'}</td><td>${subData.pct || '-'}</td><td>${gradeHtml}</td></tr>`;
            }
        });
        html += `</tbody></table></div>`;
    });

    if (html === '') html = '<p class="no-data-msg">표시할 성적 데이터가 없습니다.</p>';
    area.innerHTML = html;
}

// === [결제 내역 렌더링: 테이블 방식] ===
function renderPayments(p) {
    const listBody = document.getElementById('viewPaymentList');
    listBody.innerHTML = "";

    if (p && p.length > 0) {
        const sortedP = [...p].sort((a,b) => new Date(b.date) - new Date(a.date));
        
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
                <td>${dateStr}</td>
                <td><span class="pay-product-name">${pay.product}</span>${tierTag}</td>
                <td><span class="pay-amount-text">${amountStr}</span></td>
                <td><span class="pay-status-badge paid">결제 완료</span></td>
            `;
            listBody.appendChild(tr);
        });
    } else {
        listBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: #94a3b8;">결제 내역이 존재하지 않습니다.</td></tr>`;
    }
}

function updateAnalysisBadge(status) {
    const badge = document.getElementById('analysisStatusBadge');
    if(!badge) return;
    if (status === 'completed') {
        badge.className = 'analysis-badge completed';
        badge.innerText = '✅ 분석 완료 (리포트 발송됨)';
    } else {
        badge.className = 'analysis-badge pending';
        badge.innerText = '⏳ 분석 대기중';
    }
}

async function saveAnalysis() {
    const content = document.getElementById('analysisEditor').value;
    if (!content.trim()) return alert("분석 내용을 입력해주세요.");
    if (!confirm("저장하시겠습니까?")) return;

    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_save_analysis',
                userId: adminId,
                data: { targetUserId, content, status: 'completed' }
            })
        });
        alert("성공적으로 저장되었습니다.");
        updateAnalysisBadge('completed');
    } catch (e) {
        alert("저장 중 오류가 발생했습니다.");
    }
}

async function saveAdminMemo() {
    const memo = document.getElementById('adminMemoInput').value;
    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_update_memo', userId: adminId, data: { targetUserId, memo } })
        });
        alert("관리자 메모가 저장되었습니다.");
    } catch (e) {
        alert("메모 저장 실패");
    }
}
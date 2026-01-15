// admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
// config.js에 ADMIN_API_URL이 정의되어 있다고 가정, 없으면 아래 주석 해제
// const ADMIN_API_URL = "여기에_API_URL_입력"; 

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = 'admin.html';
        return;
    }
    loadStudentDetail();
});

// 탭 전환
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab_' + tabName).classList.add('active');
    event.currentTarget.classList.add('active');
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
        const data = await response.json();
        renderData(data);
    } catch (e) {
        console.error(e);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
}

// 전체 데이터 렌더링
function renderData(s) {
    // 1. 프로필 및 기본 정보
    document.getElementById('viewName').innerText = s.name || '이름 없음';
    document.getElementById('viewEmail').innerText = s.email || '-';
    document.getElementById('viewSchool').innerText = s.school || '미입력';
    document.getElementById('viewPhone').innerText = s.phone || '미입력';
    document.getElementById('viewJoinDate').innerText = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-';

    // 2. 뱃지 및 상태
    renderTierBadge(s.payments);
    
    // 3. 분석 내용 및 상태
    document.getElementById('analysisEditor').value = s.analysisContent || '';
    document.getElementById('adminMemoInput').value = s.adminMemo || '';
    updateAnalysisBadge(s.analysisStatus);

    // 4. 상세 탭 렌더링 (핵심)
    renderQualitativeDetail(s.qualitative);
    renderQuantitativeDetail(s.quantitative);
    renderPayments(s.payments);
}

// === [핵심 기능 1] 정성 조사서 상세 렌더링 ===
function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) {
        area.innerHTML = '<p class="no-data-msg">작성된 정성 조사서가 없습니다.</p>';
        return;
    }

    // 헬퍼: 값이 없으면 '-' 표시
    const v = (val) => val ? val : '-';

    // 섹션별 HTML 생성
    let html = '';

    // 섹션 1: 현재 상황 및 진로
    html += `
        <div class="qual-section">
            <div class="qual-head">📍 현재 상황 및 진로</div>
            <div class="qual-grid">
                <div class="qual-item"><span class="qual-label">학생 신분</span><div class="qual-value">${v(q.status)}</div></div>
                <div class="qual-item"><span class="qual-label">계열 (목표)</span><div class="qual-value">${v(q.stream)}</div></div>
                <div class="qual-item"><span class="qual-label">희망 진로/직업</span><div class="qual-value">${v(q.career)}</div></div>
                <div class="qual-item"><span class="qual-label">교차 지원 의사</span><div class="qual-value">${v(q.values?.cross)}</div></div>
            </div>
        </div>
    `;

    // 섹션 2: 입시 전략 및 가치관
    html += `
        <div class="qual-section">
            <div class="qual-head">🎯 입시 전략 및 가치관</div>
            <div class="qual-grid">
                <div class="qual-item"><span class="qual-label">대학 vs 학과 우선순위</span><div class="qual-value">${v(q.values?.priority)}</div></div>
                <div class="qual-item"><span class="qual-label">올해 대학 진학 필수 여부</span><div class="qual-value">${v(q.values?.mustGo)}</div></div>
                <div class="qual-item"><span class="qual-label">주력 전형 전략</span><div class="qual-value">${v(q.values?.strategy)}</div></div>
                <div class="qual-item"><span class="qual-label">지역 제한 (통학/기숙사)</span><div class="qual-value">${v(q.values?.region)}</div></div>
                <div class="qual-item" style="grid-column: span 2;"><span class="qual-label">최악의 시나리오 (재수 등)</span><div class="qual-value long-text">${v(q.values?.worst)}</div></div>
            </div>
        </div>
    `;

    // 섹션 3: 목표 대학
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
    `;

    // 섹션 4: 부모님 및 컨설팅 정보
    html += `
        <div class="qual-section">
            <div class="qual-head">👨‍👩‍👧 부모님 의견 및 기타</div>
            <div class="qual-grid">
                <div class="qual-item"><span class="qual-label">부모님 관여도</span><div class="qual-value">${v(q.parents?.influence)}</div></div>
                <div class="qual-item" style="grid-column: span 2;"><span class="qual-label">부모님 의견</span><div class="qual-value long-text">${v(q.parents?.opinion)}</div></div>
                <div class="qual-item"><span class="qual-label">편입 계획</span><div class="qual-value">${v(q.special?.transfer)}</div></div>
                <div class="qual-item"><span class="qual-label">교직 이수 희망</span><div class="qual-value">${v(q.special?.teaching)}</div></div>
                <div class="qual-item" style="grid-column: 1 / -1;"><span class="qual-label">컨설턴트에게 하고 싶은 말</span><div class="qual-value long-text">${v(q.special?.etc)}</div></div>
            </div>
        </div>
    `;

    area.innerHTML = html;
}

// === [핵심 기능 2] 성적표 상세 테이블 렌더링 ===
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
        { key: 'kor', label: '국어' },
        { key: 'math', label: '수학' },
        { key: 'eng', label: '영어' },
        { key: 'hist', label: '한국사' },
        { key: 'inq1', label: '탐구1' },
        { key: 'inq2', label: '탐구2' },
        { key: 'fl', label: '제2외국어' }
    ];

    let html = '';

    // 최신 시험이 위로 오도록 정렬 (옵션)
    // 여기서는 수능 -> 9월 -> ... 순서가 좋으므로 키 순서를 지정해서 순회
    const orderedKeys = ['csat', 'oct', 'sep', 'jul', 'jun', 'may', 'mar'];

    orderedKeys.forEach(examKey => {
        if (!q[examKey]) return; // 해당 시험 데이터 없으면 패스
        
        const data = q[examKey];
        
        html += `
            <div class="score-exam-block">
                <div class="score-exam-title">
                    <span>${examNames[examKey] || examKey}</span>
                </div>
                <table class="score-table">
                    <thead>
                        <tr>
                            <th style="width:15%">과목</th>
                            <th>표준점수</th>
                            <th>백분위</th>
                            <th>등급</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        subjects.forEach(sub => {
            const subData = data[sub.key];
            if (subData) {
                // 등급 뱃지 스타일링
                let gradeHtml = '-';
                if(subData.grd) {
                    const g = parseInt(subData.grd);
                    const badgeClass = g === 1 ? 'g1' : (g === 2 ? 'g2' : (g === 3 ? 'g3' : ''));
                    gradeHtml = `<span class="grade-badge ${badgeClass}">${subData.grd}</span>`;
                }

                html += `
                    <tr>
                        <td>${sub.label}</td>
                        <td>${subData.std || '-'}</td>
                        <td>${subData.pct || '-'}</td>
                        <td>${gradeHtml}</td>
                    </tr>
                `;
            }
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    if (html === '') {
        html = '<p class="no-data-msg">표시할 성적 데이터가 없습니다.</p>';
    }

    area.innerHTML = html;
}

// === 기타 기능 (결제, 뱃지, 분석 저장 등) ===

function renderPayments(p) {
    const list = document.getElementById('viewPaymentList');
    list.innerHTML = "";
    if (p && p.length) {
        // 날짜 내림차순 정렬
        p.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        p.forEach(pay => {
            list.innerHTML += `
                <div class="payment-item">
                    <div>
                        <span class="pay-product">${pay.product}</span>
                        <div class="pay-date">${new Date(pay.date).toLocaleString()}</div>
                    </div> 
                    <div class="pay-amount">${parseInt(pay.amount).toLocaleString()}원</div>
                </div>`;
        });
    } else {
        list.innerHTML = "<p class='no-data-msg'>결제 내역이 없습니다.</p>";
    }
}

function renderTierBadge(payments) {
    const area = document.getElementById('tierBadgeArea');
    let html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b;">FREE USER</span>';
    
    if (payments && payments.length > 0) {
        const paid = payments.filter(p => p.status === 'paid');
        if (paid.length > 0) {
            paid.sort((a, b) => new Date(b.date) - new Date(a.date));
            const last = (paid[0].product || "").toLowerCase();
            
            if (last.includes('black')) html = '<span class="tier-badge" style="background:#171717; color:#FFD700; box-shadow:0 0 10px rgba(0,0,0,0.3);">BLACK TIER</span>';
            else if (last.includes('pro')) html = '<span class="tier-badge" style="background:#fffbeb; color:#b45309; border:1px solid #fcd34d;">PRO TIER</span>';
            else if (last.includes('standard')) html = '<span class="tier-badge" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">STANDARD TIER</span>';
            else html = '<span class="tier-badge" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">BASIC TIER</span>';
        }
    }
    area.innerHTML = html;
}

function updateAnalysisBadge(status) {
    const badge = document.getElementById('analysisStatusBadge');
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
    if (!confirm("저장하시겠습니까? 저장 시 학생에게 알림이 갈 수 있습니다.")) return;

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
// js/admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
const API_URL = CONFIG.api.base;

let currentStudentData = null;
let currentTier = 'free';
let currentAdminFile = null; // (Legacy) 채팅 첨부파일

document.addEventListener('DOMContentLoaded', () => {
    // 1. 잘못된 접근 차단
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = '/login';
        return;
    }

    // 2. Back 버튼 처리 (튜터/관리자 분기) - [수정됨: 절대경로 적용]
    const backBtn = document.querySelector('.back-btn');
    const userRole = localStorage.getItem('userRole');

    if (backBtn) {
        if (userRole === 'tutor') {
            // 튜터라면: 튜터 마이페이지로 이동 (절대 경로)
            backBtn.href = '/mypage/tutor?tab=students';
            backBtn.innerText = '← 내 학생 목록으로';
        } else {
            // 관리자라면: 관리자 페이지로 이동
            backBtn.href = '/admin';
            backBtn.innerText = '← 목록으로 돌아가기';
        }
    }
    
    initRoleBasedView();
    loadStudentDetail();
    
    // 날짜 필터 초기화
    const today = new Date();
    initDateFilter(today.getFullYear(), today.getMonth() + 1);
    initProDateFilter(today.getFullYear(), today.getMonth() + 1);
});

function initRoleBasedView() {
    const userRole = localStorage.getItem('userRole');
    
    // 튜터라면 결제(pay), 분석(analysis) 탭 버튼 숨김
    if (userRole === 'tutor') {
        const btnPay = document.getElementById('btn-pay');
        const btnAnalysis = document.getElementById('btn-analysis');
        
        if (btnPay) btnPay.style.display = 'none';
        if (btnAnalysis) btnAnalysis.style.display = 'none';
    }
}

// 공통 날짜 필터 (주간점검용)
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

// FOR PRO 탭 날짜 필터
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

// 탭 전환 (밑줄 버그 수정)
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('tab_' + tabName);
    if(target) target.classList.add('active');
    
    // [수정] ID로 버튼 찾아서 active 클래스 추가
    const btnId = (tabName === 'special') ? 'btn-special' : 'btn-' + tabName;
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');

    // 특수 탭 렌더링 호출
    if (currentStudentData) {
        if (tabName === 'weekly') renderWeeklyTab();
        if (tabName === 'special') renderProTab();
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function loadStudentDetail() {
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_get_user_detail',
                userId: adminId,
                data: { targetUserId: targetUserId }
            })
        });

        if (!response.ok) throw new Error("Server Error");
        const data = await response.json();
        
        currentStudentData = data;
        renderData(data);
    } catch (e) {
        console.error(e);
        alert("데이터 로드 실패");
    }
}

function renderData(s) {
    if (!s) return;

    document.getElementById('viewName').innerText = s.name || '미입력';
    document.getElementById('viewEmail').innerText = s.email || '-';
    document.getElementById('viewSchool').innerText = s.school || '-';
    document.getElementById('viewPhone').innerText = s.phone || '-';
    document.getElementById('viewEmailFull').innerText = s.email || '-';
    document.getElementById('viewJoinDate').innerText = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-';

    // [수정 2] 프로필 사진 로드
    const profileImg = document.getElementById('studentProfileImg');
    if(s.profileImage) {
        profileImg.src = s.profileImage;
    }

    currentTier = calcTier(s.payments || []);
    renderTierBadge(currentTier);
    
    // [수정 6] PRO 탭 노출 제어
    const specialBtn = document.getElementById('btn-special');
    if (['pro', 'black'].includes(currentTier)) {
        specialBtn.style.display = 'inline-block';
    } else {
        specialBtn.style.display = 'none';
    }

    updateAnalysisBadge(s.analysisStatus);
    document.getElementById('analysisEditor').value = s.analysisContent || '';
    document.getElementById('adminMemoInput').value = s.adminMemo || '';

    renderTargetUnivs(s.targetUnivs || []);
    renderQualitativeDetail(s.qualitative);
    
    // [수정 3] 성적 데이터 초기화 (드롭다운 빌드)
    initQuantitativeData(s.quantitative);
    
    renderPayments(s.payments || []);
}

function calcTier(payments) {
    if (!payments || payments.length === 0) return 'free';
    const paid = payments.filter(p => p.status === 'paid');
    if (paid.length === 0) return 'free';
    
    paid.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = (paid[0].product || "").toLowerCase();
    
    if (last.includes('black')) return 'black';
    if (last.includes('pro')) return 'pro';
    if (last.includes('standard')) return 'standard';
    return 'basic';
}

function renderTierBadge(tier) {
    const area = document.getElementById('tierBadgeArea');
    let html = '';
    if (tier === 'black') html = '<span class="tier-badge" style="background: linear-gradient(to bottom right, #ffffff, #f8fafc); border: 2px solid #171717; color: #171717; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">BLACK TIER</span>';
    else if (tier === 'pro') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #F59E0B, #FCD34D); border: 2px solid #F59E0B; color: #78350f;">PRO TIER</span>';
    else if (tier === 'standard') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #94A3B8, #CBD5E1); border: 2px solid #64748B; color: #0F172A;">STANDARD TIER</span>';
    else if (tier === 'basic') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #3B82F6, #60A5FA); border: 2px solid #3B82F6; color: white;">BASIC TIER</span>';
    else html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">FREE USER</span>';
    
    area.innerHTML = html;
}

// [수정 3] 성적 데이터: 드롭다운 초기화 및 렌더링
function initQuantitativeData(q) {
    const selector = document.getElementById('scoreExamFilter');
    const container = document.getElementById('viewScoreTable');
    
    if (!q || Object.keys(q).length === 0) {
        selector.innerHTML = '<option value="">데이터 없음</option>';
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">입력된 성적이 없습니다.</p>';
        return;
    }
    
    const examNames = { 
        'mar': '3월 학평', 
        'apr': '4월 학평', 
        'may': '5월 학평', 
        'jun': '6월 모평', 
        'jul': '7월 학평', 
        'sep': '9월 모평', 
        'oct': '10월 학평', 
        'csat': '수능' 
    };    
    const availableKeys = Object.keys(q).filter(k => q[k]);
    
    // 셀렉터 옵션 생성
    selector.innerHTML = '';
    availableKeys.forEach(key => {
        const label = examNames[key] || key;
        selector.innerHTML += `<option value="${key}">${label}</option>`;
    });

    // 기본적으로 첫 번째(가장 최신일 확률 높음 or 키 순서) 선택
    if (availableKeys.length > 0) {
        renderSelectedScore();
    }
}

function renderSelectedScore() {
    const key = document.getElementById('scoreExamFilter').value;
    const container = document.getElementById('viewScoreTable');
    const q = currentStudentData.quantitative;

    if (!key || !q[key]) {
        container.innerHTML = '';
        return;
    }

    const d = q[key];
    const subjects = [{k:'kor',n:'국어'}, {k:'math',n:'수학'}, {k:'eng',n:'영어'}, {k:'inq1',n:'탐1'}, {k:'inq2',n:'탐2'}];
    
    let html = `<div class="score-exam-block" style="margin-top:15px;">
        <table class="score-table">
            <thead><tr><th>과목</th><th>표점</th><th>등급</th></tr></thead>
            <tbody>`;
            
    subjects.forEach(sub => {
        if(d[sub.k]) {
            html += `<tr><td>${sub.n}</td><td>${d[sub.k].std||'-'}</td><td>${d[sub.k].grd||'-'}</td></tr>`;
        }
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// [수정 4] 주간 점검 상세 렌더링
// 모달을 화면에 띄우는 함수
function showCoachingGuideModal() {
    // 이미 모달이 있다면 제거
    const existingModal = document.getElementById('coachingGuideModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="coachingGuideModal" class="coaching-modal-overlay">
            <div class="coaching-modal-content">
                <div class="coaching-modal-header">
                    <span>📋 Standard 코칭 운영 (필수)</span>
                    <button class="coaching-modal-close" onclick="document.getElementById('coachingGuideModal').remove()">&times;</button>
                </div>
                <div class="coaching-modal-body">
                    <h4>1) Standard의 역할</h4>
                    <p>보편적인 SKY 합격생 루틴을 ‘기준점’으로 제시하고, 취약 과목이 무너지기 전에 보완하며, 학생의 방향과 속력을 주 1회 조정합니다.</p>
                    
                    <h4>2) 선생님께서 반드시 확인하셔야 할 데이터</h4>
                    <ul>
                        <li><strong>과목별 달성률</strong> (계획 시간 vs 실제 시간)</li>
                        <li><strong>플래너 인증</strong> (사진)</li>
                        <li><strong>실전 모의고사</strong> 응시 여부</li>
                        <li><strong>성적표 인증</strong> (필수)</li>
                        <li><strong>최근 2주 학업 추이</strong> (상승/유지/하락)</li>
                        <li><strong>학생 심층 코칭 입력</strong> (계획 점검 / 방향 고민 / 취약 과목 / 멘탈)</li>
                    </ul>

                    <h4>3) 선생님께서 반드시 작성하셔야 하는 4개 항목 (주 1회)</h4>
                    <ul>
                        <li><strong>이번 주 판단</strong> (우선순위 결론, 첫 상담하는 학생이면 선생님의 객관적 판단 우선)</li>
                        <li><strong>취약 과목 개입 포인트</strong></li>
                        <li><strong>다음 주 핵심 과제 Top 3와 그 개별적인 근거</strong></li>
                        <li><strong>플랜 조정</strong> (방향 / 속력)</li>
                    </ul>

                    <h4>4) Standard 코칭 원칙 (최소 기준)</h4>
                    <ul>
                        <li>시간표형(분 단위) 강요를 금지하고, <strong>과제 중심</strong>으로 제시합니다.</li>
                        <li><strong>취약 과목을 우선</strong>시합니다. (전 과목 균등 배분 금지)</li>
                        <li><strong>실패를 전제</strong>합니다. (지키지 못한 계획을 죄책감으로 몰지 않습니다.)</li>
                        <li>의지 탓을 금지하고, <strong>항상 판단 기준으로 설명</strong>합니다.</li>
                    </ul>
                </div>
                <div style="text-align:right; margin-top:20px;">
                    <button class="fb-save-btn" style="background:#475569;" onclick="document.getElementById('coachingGuideModal').remove()">확인했습니다</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 주간 점검 상세 렌더링
function renderWeeklyTab() {
    const container = document.getElementById('weeklyListContainer');
    container.innerHTML = '';
    
    const weeklyHistory = currentStudentData.weeklyHistory || [];
    const selYear = document.getElementById('filterYear').value;
    const selMonth = document.getElementById('filterMonth').value;
    const userRole = localStorage.getItem('userRole'); // 권한 확인 (admin/tutor)

    // 날짜 필터링 및 정렬
    const filtered = weeklyHistory.filter(w => {
        const d = new Date(w.date);
        return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
    });

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:40px; color:#cbd5e1;">해당 월의 리포트가 없습니다.</div>';
        return;
    }

    filtered.forEach((d, idx) => {
        const dateStr = new Date(d.date).toLocaleDateString();
        const safeComment = escapeHtml(d.comment);
        
        // 1. 학습 시간 테이블
        let studyHtml = ''; 
        if (d.studyTime && Array.isArray(d.studyTime.details)) {
             let rows = '';
             d.studyTime.details.forEach(sub => {
                const rate = sub.plan > 0 ? Math.min((sub.act / sub.plan) * 100, 100).toFixed(0) : 0;
                const rateClass = rate >= 100 ? 'text-green' : (rate >= 80 ? 'text-blue' : 'text-gray');
                rows += `<tr><td>${escapeHtml(sub.subject)}</td><td class="text-center">${sub.plan}h</td><td class="text-center">${sub.act}h</td><td class="text-center font-bold ${rateClass}">${rate}%</td></tr>`;
             });
             studyHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clock"></i> 과목별 학습 달성도</div><table class="compact-table"><thead><tr><th>과목</th><th>계획</th><th>실행</th><th>달성</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }

        // 2. 자가 점검 (Deep Answers)
        let checkHtml = '';
        if (d.deepAnswers && d.deepAnswers.length > 0) {
            const QUESTIONS = ['학습 계획 점검', '학습 방향성 설정', '취약 과목 솔루션', '기타 멘탈 관리'];
            const listItems = d.deepAnswers.map((ans, i) => {
               const questionLabel = QUESTIONS[i] ? `<span style="color:#1e293b; font-weight:800; margin-right:4px;">${QUESTIONS[i]}:</span>` : '';
               return `<li><i class="fas fa-check-circle text-blue" style="margin-top:4px; flex-shrink:0;"></i><div style="flex:1;">${questionLabel} ${escapeHtml(ans)}</div></li>`;
            }).join('');
            checkHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clipboard-check"></i> 금주 중점 점검 사항</div><ul class="check-list">${listItems}</ul>${d.trend ? `<div class="trend-badge ${d.trend.status === 'up' ? 'up' : (d.trend.status === 'down' ? 'down' : 'keep')}">학습 흐름: ${d.trend.status === 'up' ? '상승세 🔥' : (d.trend.status === 'down' ? '하락세 📉' : '유지중 -')}</div>` : ''}</div>`;
        }

        // 3. 주간 모의고사 결과 (뱃지 적용)
        let mockHtml = '';
        if (d.mockExam && d.mockExam.scores) {
            const s = d.mockExam.scores;
            const typeMap = { 'school': '교내', 'edu': '평가원/교육청', 'private': '사설' };
            const typeLabel = typeMap[d.mockExam.type] || '기타'; 
            const typeBadge = `<span class="mock-type-badge ${d.mockExam.type || ''}">${typeLabel}</span>`;

            const scoreItems = [
                { l: '국어', v: s.kor }, { l: '수학', v: s.math }, { l: '영어', v: s.eng },
                { l: s.inq1Name || '탐1', v: s.inq1 }, { l: s.inq2Name || '탐2', v: s.inq2 }
            ].map(item => item.v ? `<div class="score-pill"><span class="lbl">${item.l}</span><span class="val">${item.v}</span></div>` : '').join('');

            mockHtml = `
                <div class="weekly-mock-box">
                    <div class="mock-header">
                        <i class="fas fa-edit"></i> 주간 모의고사 결과 ${typeBadge}
                    </div>
                    <div class="score-pills-container">${scoreItems}</div>
                </div>
            `;
        }

        // 4. 주간 평가 응답 (4개 항목으로 전면 개편)
        // 기존 데이터 호환을 위해 없으면 빈 문자열로 초기화
        const fb = d.tutorFeedback || { 
            priorityCheck: '', 
            weakSubject: '', 
            nextWeekTop3: '', 
            planEvaluation: '' 
        };
        
        const isReadOnly = (userRole === 'admin') ? 'disabled' : '';
        const btnDisplay = (userRole === 'admin') ? 'none' : 'inline-block';
        const weekId = d.weekId || d.date; // 저장 시 사용할 키
        
        const feedbackHtml = `
            <div class="tutor-feedback-area">
                <div class="feedback-header">
                    <div>👩‍🏫 튜터 주간 평가 (Weekly Feedback)</div>
                    <button class="coaching-guide-btn" onclick="showCoachingGuideModal()">
                        <i class="fas fa-info-circle"></i> 코칭 작성시 주의사항
                    </button>
                </div>
                <div class="feedback-grid">
                    <div class="fb-item">
                        <label>1. 저번주에 제안된 우선 순위에 맞게 이번주 공부를 진행했는지 (최소 150자)</label>
                        <textarea id="fb_priority_${idx}" ${isReadOnly} placeholder="작성 대기중...">${escapeHtml(fb.priorityCheck || '')}</textarea>
                    </div>
                    <div class="fb-item">
                        <label>2. 취약 과목을 하나 선정하고 개선 포인트 잡기 (최소 150자)</label>
                        <textarea id="fb_weak_${idx}" ${isReadOnly} placeholder="작성 대기중...">${escapeHtml(fb.weakSubject || '')}</textarea>
                    </div>
                    <div class="fb-item">
                        <label>3. 다음주에 진행해야할 핵심 과제 TOP3와 그 이유 (최소 150자, 각각 명시)</label>
                        <textarea id="fb_top3_${idx}" ${isReadOnly} placeholder="작성 대기중...">${escapeHtml(fb.nextWeekTop3 || '')}</textarea>
                    </div>
                    <div class="fb-item">
                        <label>4. 최종적인 플랜 진행방향 제고와 평가 (방향/속력에서 변화가 있는지) (최소 150자)</label>
                        <textarea id="fb_plan_${idx}" ${isReadOnly} placeholder="작성 대기중...">${escapeHtml(fb.planEvaluation || '')}</textarea>
                    </div>
                </div>
                <div style="text-align:right; margin-top:20px; display:${btnDisplay};">
                    <button class="fb-save-btn" onclick="saveWeeklyFeedback('${weekId}', ${idx})">평가 저장</button>
                </div>
            </div>
        `;

        // 5. 플래너 파일 및 코멘트
        let footerHtml = '';
        const fileLinks = (d.plannerFiles || []).map((f, i) => {
            let name = typeof f === 'string' ? decodeURIComponent(f.split('/').pop()) : `파일 ${i+1}`;
            return `<a href="${f}" target="_blank" class="file-chip"><i class="fas fa-image"></i> ${name}</a>`;
        }).join('');
        
        footerHtml = `
            <div class="weekly-footer">
                <div class="file-area">${fileLinks}</div>
                ${d.comment ? `<div class="comment-box"><strong>💁‍♂️ 학생 코멘트:</strong> ${safeComment}</div>` : ''}
            </div>
        `;

        // 최종 카드 조립
        const card = document.createElement('div');
        card.className = 'timeline-card weekly-new';
        card.innerHTML = `
            <div class="card-header-row">
                <div class="left">
                    <span class="week-title">${d.title || (idx+1)+'주차 리포트'}</span>
                    <span class="week-date">${dateStr}</span>
                </div>
                <div class="right">
                    <span class="total-rate-badge">총 달성률 ${d.studyTime?.totalRate || '0%'}</span>
                </div>
            </div>
            <div class="card-grid-body">
                ${studyHtml}
                ${checkHtml}
            </div>
            ${mockHtml}
            ${footerHtml}
            ${feedbackHtml}
        `;
        container.appendChild(card);
    });
}

// 개편된 4개 항목을 전송하도록 수정된 함수
async function saveWeeklyFeedback(weekId, idx) {
    const priority = document.getElementById(`fb_priority_${idx}`).value;
    const weak = document.getElementById(`fb_weak_${idx}`).value;
    const top3 = document.getElementById(`fb_top3_${idx}`).value;
    const plan = document.getElementById(`fb_plan_${idx}`).value;
    
    // 유효성 검사 (글자수 제한 등을 추가하려면 이곳에 로직 추가 가능)
    if(!confirm("주간 평가 내용을 저장하시겠습니까?")) return;

    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'tutor_update_weekly_feedback',
                userId: adminId, 
                data: {
                    targetUserId: targetUserId,
                    weekId: weekId,
                    feedback: {
                        priorityCheck: priority,
                        weakSubject: weak,
                        nextWeekTop3: top3,
                        planEvaluation: plan
                    }
                }
            })
        });

        if (response.ok) {
            alert("평가가 성공적으로 저장되었습니다.");
            // 전체 리로드 없이 그대로 두거나 로컬 데이터 갱신
        } else {
            throw new Error("Server Error");
        }
    } catch(e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다.");
    }
}

// [수정 6] FOR PRO 탭 렌더링 (1일~15일 / 16일~말일 분리)
function renderProTab() {
    const container = document.getElementById('proReportContainer');
    container.innerHTML = '';

    const selYear = document.getElementById('proFilterYear').value;
    const selMonth = document.getElementById('proFilterMonth').value;
    
    // DB에서 'proCoachingHistory'를 가져온다고 가정
    const history = currentStudentData.proCoachingHistory || [];
    
    const currentMonthData = history.filter(h => {
        const d = new Date(h.date);
        return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
    });

    const firstHalf = currentMonthData.find(h => new Date(h.date).getDate() <= 15);
    const secondHalf = currentMonthData.find(h => new Date(h.date).getDate() > 15);

    container.appendChild(createProPeriodBox(selMonth + '월 상반기 (1일~15일)', firstHalf));
    container.appendChild(createProPeriodBox(selMonth + '월 하반기 (16일~말일)', secondHalf));
}

function createProPeriodBox(title, data) {
    const box = document.createElement('div');
    box.className = 'pro-period-section';
    
    const requestText = data ? escapeHtml(data.request) : '';
    const reportText = data ? escapeHtml(data.report) : '';
    
    const reqContent = requestText || '<span class="pro-empty">학생 요청 사항이 없습니다.</span>';
    const repContent = reportText || '<span class="pro-empty">작성된 리포트가 없습니다.</span>';

    box.innerHTML = `
        <div class="pro-period-title">
            <span>${title}</span>
            ${data ? `<span style="font-size:0.8rem; font-weight:normal; color:#64748b;">${new Date(data.date).toLocaleDateString()}</span>` : ''}
        </div>
        <div class="pro-item-grid">
            <div class="pro-box">
                <div class="pro-box-label req"><i class="fas fa-question-circle"></i> 학생 특별 요청 사항</div>
                <div class="pro-content">${reqContent}</div>
            </div>
            <div class="pro-box">
                <div class="pro-box-label res"><i class="fas fa-file-alt"></i> 특별 보고서 (Admin 작성)</div>
                <div class="pro-content">${repContent}</div>
                ${data ? `<div style="text-align:right; margin-top:10px;"><button class="memo-btn" style="font-size:0.8rem; padding:5px 12px;" onclick="alert('보고서 수정 기능 준비중')">수정</button></div>` : ''}
            </div>
        </div>
    `;
    return box;
}

// [Legacy / Backup] 삭제하지 않고 보존된 채팅 및 심층상담 관련 기능들
function renderAdminChat() { console.log('Chat render (Legacy)'); }
function sendAdminChat() { console.log('Chat send (Legacy)'); }
function handleAdminFile(input) { console.log('File handle (Legacy)'); }
function clearAdminFile() { currentAdminFile = null; }

// 모달 로직 (공통)
function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
}
function showModal(title, contentHtml) {
    const modal = document.getElementById('detailModal');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalContent').innerHTML = contentHtml;
    modal.style.display = 'flex';
}

// 기타 렌더링 (Target Univs, Qualitative, Payments, Etc) - 유지
function renderTargetUnivs(list) {
    const container = document.getElementById('viewTargetUnivList');
    container.innerHTML = '';
    const validList = list.filter(u => u && u.univ);
    if (validList.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8;">설정된 목표 대학이 없습니다.</p>';
        return;
    }
    validList.forEach((u, idx) => {
        const div = document.createElement('div');
        div.className = 'target-univ-item';
        const dateStr = u.date ? new Date(u.date).toLocaleDateString() + ' 선택' : '날짜 정보 없음';
        div.innerHTML = `<div><strong>${idx+1}. ${escapeHtml(u.univ)}</strong><div class="major">${escapeHtml(u.major)}</div></div><div class="date">${dateStr}</div>`;
        container.appendChild(div);
    });
}

function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) { area.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">데이터가 없습니다.</p>'; return; }
    const v = (val) => val ? escapeHtml(val) : '-';
    area.innerHTML = `<div class="qual-section"><div class="qual-head">📍 현재 상황</div><div class="qual-grid"><div class="qual-item"><span class="detail-label">신분</span><div>${v(q.status)}</div></div><div class="qual-item"><span class="detail-label">계열</span><div>${v(q.stream)}</div></div><div class="qual-item"><span class="detail-label">진로</span><div>${v(q.career)}</div></div></div></div>`;
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
            tr.innerHTML = `<td>${escapeHtml(pay.product)}</td><td>${new Date(pay.date).toLocaleString()}</td><td style="text-align:right;">${parseInt(pay.amount).toLocaleString()}원</td>`;
            listBody.appendChild(tr);
        });
    } else {
        totalEl.innerText = "0원"; lastDateEl.innerText = "-";
        listBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px;">결제 내역 없음</td></tr>`;
    }
}

function updateAnalysisBadge(status) {
    const badge = document.getElementById('analysisStatusBadge');
    if(!badge) return;
    if (status === 'completed') { badge.className = 'analysis-badge completed'; badge.innerHTML = '✅ 분석 리포트 발송 완료'; }
    else { badge.className = 'analysis-badge pending'; badge.innerHTML = '⏳ 분석 대기중'; }
}

async function saveAnalysis() {
    const content = document.getElementById('analysisEditor').value;
    const token = localStorage.getItem('accessToken');
    if(!content.trim()) return alert("내용을 입력하세요");
    if(!confirm("저장하시겠습니까?")) return;
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type:'admin_save_analysis', userId:adminId, data:{targetUserId, content, status:'completed'} })
        });
        alert("저장 완료"); updateAnalysisBadge('completed');
    } catch(e) { alert("저장 실패"); }
}

async function saveAdminMemo() {
    const memo = document.getElementById('adminMemoInput').value;
    const token = localStorage.getItem('accessToken');
    try {
        await fetch(API_URL, {
            method:'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:JSON.stringify({ type:'admin_update_memo', userId:adminId, data:{targetUserId, memo} })
        });
        alert("메모 저장 완료");
    } catch(e) { alert("저장 실패"); }
}
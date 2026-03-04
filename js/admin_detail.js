// js/admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
const API_URL = CONFIG.api.base;

let currentStudentData = null;
let currentTier = 'free';

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
    if (userRole === 'tutor') {
        const btnPay = document.getElementById('btn-pay');
        if (btnPay) btnPay.style.display = 'none';
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

// PRO 보고서 데이터 로드 함수
async function loadProReportsForAdmin() {
    const token = localStorage.getItem('accessToken');
    // userRole은 전역변수나 로컬스토리지에서 가져옴
    const userRole = localStorage.getItem('userRole'); 
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'get_pro_reports',
                userId: targetUserId, // 학생 ID
                requesterRole: userRole // 'admin' or 'tutor' (초안 복호화 권한용)
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            // 받아온 보고서 배열을 전역 객체에 저장
            currentStudentData.proReportsList = data.reports || [];
            
            // 만약 현재 탭이 'special'(Pro 탭)이면 화면 갱신
            const specialTab = document.getElementById('tab_special');
            if (specialTab && specialTab.classList.contains('active')) {
                renderProTab();
            }
        }
    } catch (e) {
        console.error("Pro Reports Load Error:", e);
    }
}

function renderData(s) {
    if (!s) return;

    // 1. 기본 인적사항
    document.getElementById('viewName').innerText = s.name || '미입력';
    document.getElementById('viewEmail').innerText = s.email || '-';
    document.getElementById('viewSchool').innerText = s.school || '-';
    document.getElementById('viewPhone').innerText = s.phone || '-';
    document.getElementById('viewEmailFull').innerText = s.email || '-';
    document.getElementById('viewJoinDate').innerText = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-';

    // 2. 프로필 사진 로드
    const profileImg = document.getElementById('studentProfileImg');
    if(s.profileImage) {
        profileImg.src = s.profileImage;
    }

    // 3. 티어 뱃지 및 PRO 탭 노출 제어
    currentTier = calcTier(s.payments || []);
    renderTierBadge(currentTier);
    
    const specialBtn = document.getElementById('btn-special');
    if (['pro', 'black'].includes(currentTier)) {
        specialBtn.style.display = 'inline-block';
    } else {
        specialBtn.style.display = 'none';
    }

    // 4. 종합 분석 리포트 상태, 내용, UI 렌더링
    updateAnalysisBadge(s.analysisStatus);
    
    // [수정된 부분] 에디터 값 세팅 및 권한/상태에 따른 잠금 처리
    const editor = document.getElementById('analysisEditor');
    editor.value = s.analysisContent || '';
    
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'tutor' || s.analysisStatus === 'published') {
        editor.disabled = true;
        editor.style.backgroundColor = '#f1f5f9'; // 비활성화 시각적 피드백
    } else {
        editor.disabled = false;
        editor.style.backgroundColor = '#fcfcfc'; // 입력 가능 상태
    }

    document.getElementById('adminMemoInput').value = s.adminMemo || '';
    renderAnalysisActionArea(s.analysisStatus, s.analysisFile);

    // 5. 기타 데이터 렌더링
    renderTargetUnivs(s.targetUnivs || []);
    renderQualitativeDetail(s.qualitative);
    
    // 성적 데이터 초기화 (드롭다운 빌드)
    initQuantitativeData(s.quantitative);
    
    renderPayments(s.payments || []);
    
    loadProReportsForAdmin();
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

                    <h4>3) 선생님께서 반드시 작성하셔야 하는 5개 항목 (주 1회)</h4>
                    <ul>
                        <li><strong>이번 주 판단</strong> (우선순위 결론, 첫 상담하는 학생이면 선생님의 객관적 판단 우선)</li>
                        <li><strong>취약 과목 개입 포인트</strong></li>
                        <li><strong>다음 주 핵심 과제 Top 3와 그 개별적인 근거</strong></li>
                        <li><strong>플랜 조정</strong> (방향 / 속력)</li>
                        <li><strong>심층 질문에 대한 추가 답변(어떤 질문에 대한 답변인지를 명시하고, 앞 항목 내용과 중복된다면 그렇다는 사실을 명시)</li>
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
            checkHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clipboard-check"></i> 이번주 심층 질문</div><ul class="check-list">${listItems}</ul>${d.trend ? `<div class="trend-badge ${d.trend.status === 'up' ? 'up' : (d.trend.status === 'down' ? 'down' : 'keep')}">학습 흐름: ${d.trend.status === 'up' ? '상승세 🔥' : (d.trend.status === 'down' ? '하락세 📉' : '유지중 -')}</div>` : ''}</div>`;
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

        // 4. 주간 평가 응답 (5개 항목으로 개편)
        // 기존 데이터 호환을 위해 없으면 빈 문자열로 초기화
        const fb = d.tutorFeedback || { 
            priorityCheck: '', 
            weakSubject: '', 
            nextWeekTop3: '', 
            planEvaluation: '',
            extraQuestion: ''
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
                    <div class="fb-item">
                        <label>5. 학생 심층 질문에 대한 추가 답변(필요시에, 최소 150자)</label>
                        <textarea id="fb_extra_${idx}" ${isReadOnly} placeholder="작성 대기중...">${escapeHtml(fb.extraQuestion || '')}</textarea>
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
    const extra = document.getElementById(`fb_extra_${idx}`).value;
    
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
                        planEvaluation: plan,
                        extraQuestion: extra
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

// ============================================================
// [기능] FOR PRO 탭 로직
// ============================================================

function renderProTab() {
    const container = document.getElementById('proReportContainer');
    container.innerHTML = '';

    const selYear = document.getElementById('proFilterYear').value;
    const selMonth = document.getElementById('proFilterMonth').value;
    const userRole = localStorage.getItem('userRole');

    const yearShort = selYear.slice(2);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStr = monthNames[parseInt(selMonth) - 1];
    
    const keyPre = `${yearShort}${monthStr}Pre`;
    const keyPost = `${yearShort}${monthStr}Post`;

    const reports = currentStudentData.proReportsList || [];
    const dataPre = reports.find(r => r.key === keyPre);
    const dataPost = reports.find(r => r.key === keyPost);

    container.appendChild(createProPeriodBox(`${selMonth}월 상반기 (Pre)`, dataPre, keyPre, userRole));
    container.appendChild(createProPeriodBox(`${selMonth}월 하반기 (Post)`, dataPost, keyPost, userRole));
}

function createProPeriodBox(title, data, reportKey, userRole) {
    const box = document.createElement('div');
    box.className = 'pro-period-section';
    box.id = reportKey;

    const isTutor = (userRole === 'tutor');
    const isAdmin = (userRole === 'admin');

    const safeData = data || {};
    const requestText = safeData.request ? escapeHtml(safeData.request) : null;
    const status = safeData.status || 'pending'; // pending -> drafting -> completed(admin_review) -> tutor_review -> published
    const reportLink = safeData.reportLink || null;

    let canEdit = false;
    if (isTutor && (status === 'pending' || status === 'drafting')) canEdit = true;
    else if (isAdmin && (status === 'completed' || status === 'admin_review')) canEdit = true;

    const readOnlyAttr = canEdit ? '' : 'disabled';
    const saveBtnStyle = canEdit ? '' : 'style="display:none"';

    const reqHtml = requestText 
        ? `<div class="req-content-area">${requestText}</div>`
        : `<div class="req-content-area req-empty">(학생이 작성한 추가 요청사항이 없습니다.)</div>`;

    let content = { eval: '', dist: '', plan: '', qna: '' };
    if (safeData.draft) {
        try { content = JSON.parse(safeData.draft); } catch(e) { console.error("JSON Parse Error:", e); }
    }

    const writeHtml = `
        <div class="write-header">
            <div class="write-title"><i class="fas fa-pen-nib"></i> 컨설턴트 집필 공간</div>
            <button class="guide-btn" onclick="showProGuideModal()"><i class="fas fa-info-circle"></i> 작성 가이드</button>
        </div>
        <div class="pro-write-grid">
            ${createTextAreaHtml(reportKey, 1, "1. 지난 2주간의 학습평가 (리스크/KPI)", content.eval, readOnlyAttr, saveBtnStyle)}
            ${createTextAreaHtml(reportKey, 2, "2. 목표대학과의 거리 (ΔCut/기여도)", content.dist, readOnlyAttr, saveBtnStyle)}
            ${createTextAreaHtml(reportKey, 3, "3. 중기 핵심 과제 Top2 & 장기 플랜", content.plan, readOnlyAttr, saveBtnStyle)}
            ${createTextAreaHtml(reportKey, 4, "4. 학생 요청 답변 (근거 포함)", content.qna, readOnlyAttr, saveBtnStyle)}
        </div>
    `;

    let actionHtml = getActionHtml(status, isTutor, isAdmin, reportLink, reportKey, hasContent(content));

    box.innerHTML = `
        <div class="pro-period-title">
            <span>${title}</span>
            <span style="font-size:0.85rem; color:#64748b; font-weight:normal;">
                ${safeData.updatedAt ? '(업데이트: ' + new Date(safeData.updatedAt).toLocaleDateString() + ')' : ''}
            </span>
        </div>
        <div class="student-req-card">
            <div class="req-header">
                <i class="fas fa-comment-dots" style="color:#f59e0b;"></i>
                <h4 class="req-title">학생 요청사항</h4>
            </div>
            ${reqHtml}
        </div>
        ${writeHtml}
        ${actionHtml}
    `;

    if (canEdit) attachInputListeners(reportKey, isTutor);

    return box;
}

function createTextAreaHtml(key, idx, label, val, readOnly, btnStyle) {
    return `
        <div class="write-item">
            <label class="write-label">${label}</label>
            <textarea id="${key}_item${idx}" class="write-textarea" ${readOnly} placeholder="내용을 입력하세요.">${val}</textarea>
            <button id="${key}_btn${idx}" class="temp-save-btn" onclick="tempSaveProItem('${key}', ${idx})" ${btnStyle}>임시저장</button>
        </div>
    `;
}

// 🚨 FOR PRO 탭용: 4단계 검수 UI
function getActionHtml(status, isTutor, isAdmin, reportLink, key, hasContent) {
    
    // 단계 4: 학생에게 최종 전송 완료
    if (status === 'published' || status === 'sent') { 
        return `
            <div class="action-bar">
                <span style="color:#2563eb; font-weight:bold;"><i class="fas fa-check-circle"></i> 학생에게 리포트 전송 완료</span>
                ${reportLink ? `<a href="${reportLink}" target="_blank" style="margin-left:10px; text-decoration:underline; color:#2563eb; font-weight:bold;"><i class="fas fa-file-pdf"></i> 첨부된 PDF 확인</a>` : ''}
                ${isAdmin ? `<button class="edit-report-btn show" onclick="enableProEdit('${key}')" style="margin-left:auto;">수정하기(관리자)</button>` : ''}
            </div>`;
    } 
    
    // 단계 3: 관리자 PDF 첨부 완료 -> 튜터 최종 확인 대기
    if (status === 'tutor_review') {
        if (isTutor) {
            return `
                <div class="action-bar" style="justify-content: space-between; background: #eff6ff; padding: 15px; border-radius: 8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:#1e3a8a; font-weight:bold;"><i class="fas fa-search"></i> 관리자가 PDF를 첨부했습니다. 검수 후 전송해주세요.</span>
                        ${reportLink ? `<a href="${reportLink}" target="_blank" style="text-decoration:underline; color:#2563eb;"><i class="fas fa-file-pdf"></i> PDF 보기</a>` : ''}
                    </div>
                    <button class="admin-report-btn completed" style="background:#166534;" onclick="publishProReportToStudent('${key}')">최종 학생에게 전송</button>
                </div>`;
        } else {
            return `<div class="action-bar"><span style="color:#f59e0b; font-weight:bold;"><i class="fas fa-clock"></i> 튜터 최종 검수 및 전송 대기 중...</span></div>`;
        }
    }

    // 단계 2: 튜터 작성 완료 -> 관리자 확인 및 PDF 첨부
    if (status === 'completed' || status === 'admin_review') { 
        if (isAdmin) {
            return `
                <div class="action-bar" style="flex-direction: column; align-items: stretch; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px;">
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        <span style="color:#166534; font-weight:bold;"><i class="fas fa-check"></i> 튜터 제출 완료 (검수 후 PDF를 첨부해주세요)</span>
                        <button class="temp-save-btn" onclick="saveProDraft('${key}')">텍스트 변경사항 저장</button>
                    </div>
                    <div style="display:flex; gap: 10px; align-items: center; justify-content: flex-end; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                        <input type="file" id="pdfFile_${key}" accept=".pdf" style="font-size:0.9rem; padding: 5px;">
                        <button class="admin-report-btn" onclick="requestTutorReview('${key}')"><i class="fas fa-upload"></i> PDF 업로드 및 튜터 검수 요청</button>
                    </div>
                </div>`;
        } else {
            return `<div class="action-bar"><span style="color:#64748b; font-weight:bold;"><i class="fas fa-hourglass-half"></i> 관리자 검수 및 PDF 첨부 중...</span></div>`;
        }
    }

    // 단계 1: 튜터 작성 중
    if (isTutor) {
        const btnClass = hasContent ? 'complete-write-btn active' : 'complete-write-btn';
        return `
            <div class="action-bar" style="justify-content: flex-end;">
                <button id="${key}_completeBtn" class="${btnClass}" onclick="completeProWriting('${key}')">작성 완료 (관리자에게 제출)</button>
            </div>`;
    } else {
        return `<div class="action-bar"><span style="color:#94a3b8; font-weight:bold;"><i class="fas fa-pen"></i> 튜터 작성 중...</span></div>`;
    }
}

// 🚨 FOR PRO 탭용: 관리자가 PDF 업로드 후 튜터에게 핑 날리기
async function requestTutorReview(key) {
    const fileInput = document.getElementById(`pdfFile_${key}`);
    if (!fileInput.files || fileInput.files.length === 0) return alert("PDF 파일을 먼저 첨부해주세요.");

    const file = fileInput.files[0];
    if (file.type !== 'application/pdf') return alert("PDF 파일만 업로드 가능합니다.");
    if (!confirm("첨부한 PDF 파일을 업로드하고 튜터에게 최종 검수를 요청하시겠습니까?")) return;

    const token = localStorage.getItem('accessToken');
    const btn = event.currentTarget;
    const originalBtnText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중...';
    btn.disabled = true;

    try {
        const urlResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'get_presigned_url',
                userId: adminId,
                data: {
                    fileName: encodeURIComponent(file.name),
                    fileType: file.type,
                    folder: `pro_reports/${targetUserId}` 
                }
            })
        });

        if (!urlResponse.ok) throw new Error("업로드 주소 발급 실패");
        const { uploadUrl, fileUrl } = await urlResponse.json();

        const uploadResult = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        });

        if (!uploadResult.ok) throw new Error("S3 파일 업로드 실패");

        const dbResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_request_tutor_review', 
                userId: adminId,
                data: { targetUserId: targetUserId, reportKey: key, reportLink: fileUrl, status: 'tutor_review' }
            })
        });

        if (!dbResponse.ok) throw new Error("DB 업데이트 실패");

        alert("파일 업로드 및 튜터 검수 요청이 완료되었습니다.");
        await loadProReportsForAdmin(); 

    } catch(e) { 
        console.error(e);
        alert("요청 전송 실패: " + e.message); 
    } finally {
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
}

// 🚨 FOR PRO 탭용: 튜터가 확인 후 학생에게 최종 전송
async function publishProReportToStudent(key) {
    if(!confirm("최종 검수를 마치고 학생에게 리포트를 전송하시겠습니까? 전송 후에는 수정할 수 없습니다.")) return;

    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'tutor_publish_report', 
                userId: adminId,
                data: { targetUserId: targetUserId, reportKey: key, status: 'published' }
            })
        });

        if (!response.ok) throw new Error("Server Error");

        alert("학생에게 최종 전송이 완료되었습니다.");
        await loadProReportsForAdmin(); 
    } catch(e) { alert("전송 실패: " + e.message); }
}

function hasContent(c) { return c.eval && c.dist && c.plan && c.qna; }

function attachInputListeners(key, isTutor) {
    setTimeout(() => {
        const container = document.getElementById(key);
        if (!container) return;
        for (let i = 1; i <= 4; i++) {
            const area = document.getElementById(`${key}_item${i}`);
            const btn = document.getElementById(`${key}_btn${i}`);
            if (area && btn) {
                area.addEventListener('input', () => {
                    if (btn.classList.contains('saved')) {
                        btn.classList.remove('saved');
                        btn.innerText = '임시 저장';
                        if (isTutor) {
                            const completeBtn = document.getElementById(`${key}_completeBtn`);
                            if (completeBtn) completeBtn.classList.remove('active');
                        }
                    }
                });
            }
        }
    }, 0);
}

async function tempSaveProItem(boxId, itemIdx) {
    const btn = document.getElementById(`${boxId}_btn${itemIdx}`);
    const originalText = btn.innerText;
    
    btn.innerText = "저장 중...";
    btn.disabled = true;

    try {
        await saveProDraft(boxId, true);
        btn.classList.add('saved');
        btn.innerText = '저장됨';
        btn.disabled = false;
        checkProAllSaved(boxId);
    } catch (e) {
        alert("저장 실패");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function saveProDraft(key, silent = false) {
    const content = {
        eval: document.getElementById(`${key}_item1`)?.value || "",
        dist: document.getElementById(`${key}_item2`)?.value || "",
        plan: document.getElementById(`${key}_item3`)?.value || "",
        qna: document.getElementById(`${key}_item4`)?.value || ""
    };

    const token = localStorage.getItem('accessToken');
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            type: 'save_pro_draft', 
            userId: adminId,
            targetUserId: targetUserId,
            reportKey: key,
            draftContent: content
        })
    });

    if (!response.ok) throw new Error("Save Failed");
    if (!silent) alert("저장되었습니다.");
}

async function completeProWriting(key) {
    try { await saveProDraft(key, true); } catch (e) { return alert("내용 저장 실패로 중단합니다."); }

    if(!confirm("작성을 완료하고 관리자에게 제출하시겠습니까?")) return;

    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'complete_pro_writing',
                userId: adminId,
                targetUserId: targetUserId,
                reportKey: key
            })
        });

        if (!response.ok) throw new Error("Server Error");
        
        alert("제출 완료되었습니다. 관리자 검수 단계로 넘어갑니다.");
        await loadProReportsForAdmin(); 

    } catch(e) { alert("오류 발생: " + e.message); }
}

function enableProEdit(key) {
    if(!confirm("이미 전송된 보고서입니다. 내용을 수정하시겠습니까?")) return;
    const container = document.getElementById(key);
    container.querySelectorAll('textarea').forEach(t => t.disabled = false);
    container.querySelectorAll('.temp-save-btn').forEach(b => b.style.display = 'inline-block');
    alert("수정 모드입니다. 수정 후 '전체 저장' 하세요.");
}

function checkProAllSaved(boxId) {
    const container = document.getElementById(boxId);
    const btns = container.querySelectorAll('.temp-save-btn');
    const allSaved = Array.from(btns).every(b => b.classList.contains('saved'));
    
    const completeBtn = document.getElementById(`${boxId}_completeBtn`);
    if (completeBtn) {
        if (allSaved) completeBtn.classList.add('active');
        else completeBtn.classList.remove('active');
    }
}

function showProGuideModal() {
    const modalHtml = `
        <div id="proGuideModal" class="modal-overlay" onclick="if(event.target===this) this.remove()">
            <div class="modal-window guide-modal-content">
                <div class="modal-header">
                    <h3>🏆 Pro 코칭 운영 가이드</h3>
                    <span class="close-modal" onclick="document.getElementById('proGuideModal').remove()">&times;</span>
                </div>
                <div class="modal-body guide-body">
                    <p><strong>핵심:</strong> 목표 대학 기준 '최소 학습·최대 효율' 전략 제시</p>
                    <ul>
                        <li><strong>학습 평가:</strong> KPI(유효학습, 오답회수율 등) 기반 평가</li>
                        <li><strong>목표 거리:</strong> ΔCut 및 과목별 기여도 분석</li>
                        <li><strong>핵심 과제:</strong> 구체적 행동(인강/실전 등) 명시</li>
                        <li><strong>금지:</strong> 막연한 합격 보장 멘트 금지</li>
                    </ul>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ============================================================
// 기타 공통 UI (모달, 표 렌더링 등)
// ============================================================

function closeModal() { document.getElementById('detailModal').style.display = 'none'; }
function showModal(title, contentHtml) {
    const modal = document.getElementById('detailModal');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalContent').innerHTML = contentHtml;
    modal.style.display = 'flex';
}

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
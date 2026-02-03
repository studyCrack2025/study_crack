// js/mypage.js

// 기존 API (회원정보, 주간점검 등)
const MYPAGE_API_URL = CONFIG.api.base; 
// 대학 목록 조회용 API
const UNIV_DATA_API_URL = CONFIG.api.analysis;

let currentUserTier = 'free';
let userTargetUnivs = [null, null, null, null, null, null, null, null]; 
let univData = []; 
let univMap = {};  
let userQuantData = null; 
let weeklyDataHistory = [];
let currentSlotIndex = null;
let currentPlannerFiles = []; 
let originalPlannerFiles = [];

let currentExamMode = 'csat'; 
const EXAM_DISPLAY_NAMES = {
    "csat": "대학수학능력시험 (수능)",
    "sep": "9월 모의평가",
    "jun": "6월 모의평가",
    "jul": "7월 학력평가",
    "oct": "10월 학력평가",
    "mar": "3월 학력평가",
    "may": "5월 학력평가"
};

function getWeekOfMonth(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const day = start.getDay() || 7; 
    const diff = date.getDate() - 1 + (day - 1); 
    return Math.floor(diff / 7) + 1;
}

function getWeekTitle(date) {
    const yearShort = date.getFullYear().toString().slice(2);
    const month = date.getMonth() + 1;
    const week = getWeekOfMonth(date);
    return `${yearShort}년 ${month}월 ${week}주차`; 
}

document.addEventListener('DOMContentLoaded', () => {
    // accessToken 대신 idToken 사용 (Cognito 권장)
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    setWeeklyLoadingStatus(true);
    console.log("🚀 [Init] 데이터 로딩 시작...");

    // [수정] Promise.allSettled를 사용하여 하나가 실패해도 나머지는 실행되도록 변경
    Promise.allSettled([
        fetchUserData(userId).then(() => console.log("  - ✅ 회원정보 로드 완료")),
        fetchUnivData().then(() => console.log("  - ✅ 대학목록 로드 완료"))
    ]).then((results) => {
        // 실패한 요청이 있는지 확인
        results.forEach((res, idx) => {
            if (res.status === 'rejected') {
                console.error(`❌ [Critical] 초기 데이터 로드 실패 (Index ${idx}):`, res.reason);
            }
        });

        console.log("🚀 [Init] 초기화 단계 진입");
        initUnivGrid(); 
        
        // 여기서 강제로 실행
        console.log("🚀 [Init] 분석 UI 업데이트 호출");
        updateAnalysisUI(); 
        
        checkBlackStatusForButton();
        setWeeklyLoadingStatus(false);
        setTimeout(() => { checkWeeklyStatus(); }, 500); 

        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const sol = params.get('sol');
        if (tab) {
            switchMainTab(tab);
            if (tab === 'solution' && sol) {
                setTimeout(() => openSolution(sol), 100); 
            }
        }
    });

    setupUI();
});

function setWeeklyLoadingStatus(isLoading) {
    const msg = document.getElementById('weeklyDeadlineMsg');
    const badge = document.getElementById('weeklyStatusBadge');
    if (!msg || !badge) return;
    if (isLoading) {
        badge.innerText = '...'; badge.className = 'badge-status pending'; 
        msg.style.color = '#3b82f6'; msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 데이터 로딩중...';
    } else {
        msg.style.color = '#10b981'; msg.innerHTML = '<strong>✅ 로드 완료</strong>';
    }
}

async function fetchUserData(userId) {
    const token = localStorage.getItem('idToken'); // [수정] idToken
    const safeUserId = userId || localStorage.getItem('userId'); 
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, // [수정] 토큰 헤더
            // [수정] Body에 userId 명시 (401 방지)
            body: JSON.stringify({ type: 'get_user', userId: safeUserId }) 
        });
        
        if (response.status === 401) throw new Error("인증 실패 (401): 다시 로그인해주세요.");
        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error || "서버 오류");
        }
        
        const data = await response.json();
        renderUserInfo(data);
        applyUserTier(data.computedTier || 'free'); 
        updateSurveyStatus(data);
        if (data.targetUnivs) userTargetUnivs = data.targetUnivs;
        if (data.quantitative) userQuantData = data.quantitative;
        weeklyDataHistory = data.weeklyHistory || []; 
        if (typeof buildUnivMap === 'function') buildUnivMap();
    } catch (error) { 
        console.error("데이터 로드 중 오류:", error); 
        if(error.message.includes("401")) { alert("세션이 만료되었습니다."); location.href='login.html'; }
    }
}

function applyUserTier(tier) {
    currentUserTier = tier;
    const profileBox = document.querySelector('.profile-summary');
    profileBox.classList.remove('tier-basic', 'tier-standard', 'tier-pro', 'tier-black');
    if (tier !== 'free') profileBox.classList.add(`tier-${tier}`);
    let badge = document.querySelector('.premium-badge');
    if (tier !== 'free') {
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'premium-badge';
            profileBox.appendChild(badge);
        }
        badge.innerText = `${tier.toUpperCase()} MEMBER`;
    } else if (badge) badge.remove();
}

async function fetchUnivData() {
    const token = localStorage.getItem('idToken'); // [수정] idToken
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            // [수정] type과 함께 userId를 반드시 전송
            body: JSON.stringify({ type: 'get_univ_list_only', userId: userId }) 
        });
        if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);
        const data = await response.json();
        
        // 백엔드 구조에 따라 바로 배열이 오거나, data.univs로 올 수 있음. 안전하게 처리.
        univData = Array.isArray(data) ? data : (data.univs || []); 
        
        univMap = {};
        univData.forEach(item => { univMap[item.univName] = item.majors.map(m => ({ name: m })); });
    } catch (e) { console.error("대학 데이터 로드 실패:", e); }
}

function buildUnivMap() {
    if (!univData || univData.length === 0) return;
    const userStream = determineUserStream(); 
}

function determineUserStream() {
    if (!userQuantData) return '문과';
    const examPriorities = ['csat', 'sep', 'jun', 'oct', 'jul', 'mar', 'may'];
    let targetExam = null;
    for (const examName of examPriorities) {
        if (userQuantData[examName] && userQuantData[examName].math && userQuantData[examName].math.opt) {
            targetExam = userQuantData[examName];
            break; 
        }
    }
    if (!targetExam) return '문과';
    const mathOpt = targetExam.math.opt; 
    const isMathScience = (mathOpt === 'mi' || mathOpt === 'ki');
    if (isMathScience) return '이과'; else return '문과';
}

function renderUserInfo(data) {
    document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
    document.getElementById('userEmailDisplay').innerText = data.email || '';
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileSchool').value = data.school || '';
    document.getElementById('profileEmail').value = data.email || '';
}

function updateSurveyStatus(data) {
    const isQualDone = !!data.qualitative;
    const isQuanDone = data.quantitative && Object.keys(data.quantitative).length > 0;
    const badge = document.getElementById('statusBadge');
    document.getElementById('qualStatus').innerText = isQualDone ? "✅ 작성완료" : "❌ 미작성";
    document.getElementById('quanStatus').innerText = isQuanDone ? "✅ 작성완료" : "❌ 미작성";
    badge.className = 'status-badge';
    if (isQualDone && isQuanDone) { badge.classList.add('complete'); badge.innerText = "작성 완료"; }
    else if (isQualDone || isQuanDone) { badge.classList.add('partial'); badge.innerText = "작성 중"; }
    else { badge.classList.add('incomplete'); badge.innerText = "미작성"; }
}

function switchMainTab(tabName) {
    if (tabName === 'solution' && currentUserTier === 'free') { alert("유료 회원만 이용 가능합니다."); return; }
    document.querySelectorAll('.main-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (tabName === 'solution') openSolution('univ');
}

function openSolution(solType) {
    if ((solType === 'sim' || solType === 'coach') && ['free', 'basic'].includes(currentUserTier)) { alert("Standard 버전 이상만 이용 가능합니다."); return; }
//    if (solType === 'black' && currentUserTier !== 'black') { alert("BLACK 회원 전용 공간입니다."); return; }
    document.querySelectorAll('.sol-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sol-content').forEach(content => content.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    document.getElementById(`sol-${solType}`).classList.add('active');
    if (solType === 'univ') { initUnivGrid(); updateAnalysisUI(); }
    if (solType === 'coach') { initCoachLock(); checkWeeklyStatus(); }
}

function initUnivGrid() {
    const grid = document.getElementById('univGrid');
    if(!grid) return;
    grid.innerHTML = ''; 
    const tierLimits = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 };
    const limit = tierLimits[currentUserTier] || 2;
    const now = new Date();

    for (let i = 0; i < 8; i++) {
        const isActive = i < limit;
        const savedData = userTargetUnivs[i] || { univ: '', major: '', date: null };
        const slotDiv = document.createElement('div');
        if (isActive) {
            slotDiv.className = 'univ-slot';
            let isLocked = false;
            let dateMsg = '';
            if (savedData.date) {
                const savedDate = new Date(savedData.date);
                const unlockDate = new Date(savedDate);
                unlockDate.setDate(unlockDate.getDate() + 14);
                if (now < unlockDate) { isLocked = true; dateMsg = `🔒 ${unlockDate.getMonth()+1}월 ${unlockDate.getDate()}일 이후 수정 가능`; }
            }
            const btnText = (savedData.univ && savedData.major) ? `<strong>${savedData.univ}</strong><br><small>${savedData.major}</small>` : `<span class="placeholder">대학 및 학과를 선택하세요</span>`;
            slotDiv.innerHTML = `<label>지망 ${i+1}</label><button type="button" class="univ-select-btn" onclick="${isLocked ? '' : `openUnivSelectModal(${i})`}" ${isLocked ? 'disabled' : ''} style="${isLocked ? 'background-color:#f3f4f6; cursor:not-allowed;' : ''}"><div>${btnText}</div>${isLocked ? '<i class="fas fa-lock" style="color:#ef4444;"></i>' : '<i class="fas fa-chevron-right"></i>'}</button>${isLocked ? `<span class="slot-msg">${dateMsg}</span>` : ''}`;
            grid.appendChild(slotDiv);
        } else {
            let requiredTier = (i < 5) ? 'Standard' : 'PRO/BLACK';
            slotDiv.className = 'univ-slot locked-tier';
            slotDiv.setAttribute('data-msg', `${requiredTier} 이상`);
            grid.appendChild(slotDiv);
        }
    }
}

function openUnivSelectModal(index) {
    currentSlotIndex = index;
    const modal = document.getElementById('univSelectModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    showUnivStep();
}

function closeUnivModal() {
    document.getElementById('univSelectModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentSlotIndex = null;
}

function showUnivStep() {
    document.getElementById('modalTitle').innerText = "대학 선택";
    document.getElementById('stepUnivList').style.display = 'grid';
    document.getElementById('stepMajorList').style.display = 'none';
    document.getElementById('modalFooter').style.display = 'none';
    const listContainer = document.getElementById('stepUnivList');
    listContainer.innerHTML = '';
    Object.keys(univMap).sort().forEach(univName => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerText = univName;
        item.onclick = () => showMajorStep(univName);
        listContainer.appendChild(item);
    });
}

function showMajorStep(univName) {
    document.getElementById('modalTitle').innerText = `${univName} - 학과 선택`;
    document.getElementById('stepUnivList').style.display = 'none';
    document.getElementById('stepMajorList').style.display = 'grid';
    document.getElementById('modalFooter').style.display = 'block';
    const listContainer = document.getElementById('stepMajorList');
    listContainer.innerHTML = '';
    const majors = univMap[univName] || [];
    majors.sort((a,b) => a.name.localeCompare(b.name));
    majors.forEach(majorObj => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerText = majorObj.name;
        item.onclick = () => selectComplete(univName, majorObj.name);
        listContainer.appendChild(item);
    });
}

function selectComplete(univ, major) {
    if (currentSlotIndex !== null) {
        userTargetUnivs[currentSlotIndex] = { univ: univ, major: major, date: null };
        initUnivGrid(); updateAnalysisUI(); 
    }
    closeUnivModal();
}

async function saveTargetUnivs() {
    if(!confirm("저장하면 2주 동안 수정할 수 없습니다.\n정말 저장하시겠습니까?")) return;
    const newUnivs = [...userTargetUnivs]; 
    const nowISO = new Date().toISOString();
    const tierLimits = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 };
    const limit = tierLimits[currentUserTier] || 2;
    while(newUnivs.length < 8) newUnivs.push(null);
    for(let i=0; i<limit; i++) {
        const currentData = userTargetUnivs[i];
        if (currentData && currentData.univ && currentData.major) { if (!currentData.date) currentData.date = nowISO; } 
        else { userTargetUnivs[i] = null; }
    }
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); // [수정] idToken
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_target_univs', userId: userId, data: userTargetUnivs })
        });
        if(response.ok) { alert("저장되었습니다."); location.reload(); } else { throw new Error("저장 실패"); }
    } catch(e) { console.error(e); alert("통신 오류 발생"); }
}

// ============================================================
// 목표대학 분석 UI (시험 선택 기능 추가됨)
// ============================================================
async function updateAnalysisUI() {
    console.clear(); 
    console.log("🔥 [Start] 통합 분석 시작");

    const container = document.getElementById('univAnalysisResult');
    if (!container) return;
    
    // 1. 데이터 검증 & 사용 가능한 시험 찾기
    const hasTargets = userTargetUnivs && userTargetUnivs.some(u => u && u.univ);
    
    // userQuantData 중에서 실제 점수 데이터가 있는 키만 추출
    const availableExams = userQuantData ? Object.keys(userQuantData).filter(key => {
        const data = userQuantData[key];
        // 데이터가 존재하고, 과목 점수가 하나라도 있는지 확인 (빈 객체 제외)
        return data && (data.kor || data.math || data.eng);
    }) : [];

    // 데이터가 아예 없거나 목표 대학이 없으면 중단
    if (!hasTargets || availableExams.length === 0) { 
        console.warn("⚠️ 데이터 없음");
        container.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:40px; color:#64748b; background:#f8fafc; border-radius:12px;">
                <i class="fas fa-exclamation-circle fa-2x" style="margin-bottom:10px; color:#94a3b8;"></i><br>
                목표 대학을 설정하고<br>성적표를 입력해주세요.
            </div>`; 
        return; 
    }

    // 2. 현재 모드 설정 (유효하지 않으면 첫 번째 가용한 시험으로 강제 변경)
    if (!currentExamMode || !availableExams.includes(currentExamMode)) {
        // 우선순위: 수능 > 9월 > 6월 > 나머지 (역순 정렬 등 필요시 로직 추가 가능)
        if (availableExams.includes('csat')) currentExamMode = 'csat';
        else if (availableExams.includes('sep')) currentExamMode = 'sep';
        else if (availableExams.includes('jun')) currentExamMode = 'jun';
        else currentExamMode = availableExams[0];
    }

    // 3. UI 골격 생성 (컨트롤 패널 + 결과 컨테이너)
    // 여기가 핵심입니다: 드롭다운 메뉴를 결과창 위에 그립니다.
    const selectorHTML = `
        <div class="analysis-controls" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#fff; padding:15px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
            <div style="font-weight:700; color:#334155; font-size:1rem;">
                <i class="fas fa-chart-pie" style="color:#3b82f6; margin-right:6px;"></i> 합격 예측 리포트
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <label for="examSelector" style="font-size:0.85rem; color:#64748b; font-weight:500;">기준 시험:</label>
                <select id="examSelector" onchange="changeExamMode(this.value)" style="padding:6px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem; color:#1e293b; outline:none; cursor:pointer; font-family:inherit; background-color:#f8fafc;">
                    ${availableExams.map(key => `
                        <option value="${key}" ${key === currentExamMode ? 'selected' : ''}>
                            ${EXAM_DISPLAY_NAMES[key] || key.toUpperCase()}
                        </option>
                    `).join('')}
                </select>
            </div>
        </div>
        <div id="analysisCardsContainer"></div>
    `;
    
    container.innerHTML = selectorHTML;
    
    // 로딩 표시 (카드 컨테이너 안에)
    const cardsContainer = document.getElementById('analysisCardsContainer');
    cardsContainer.innerHTML = `
        <div style="padding:60px; text-align:center; color:#3b82f6;">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p style="margin-top:15px; font-weight:600; font-size:1rem;">
                ${EXAM_DISPLAY_NAMES[currentExamMode] || currentExamMode} 기준으로<br>
                정밀 환산 분석 중입니다...
            </p>
        </div>`;

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const currentScoreData = userQuantData[currentExamMode];

    try {
        console.log(`🚀 [요청] ${UNIV_DATA_API_URL} (Mode: ${currentExamMode})`);

        const res = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'analyze_my_targets',
                userId: userId,
                targetUnivs: userTargetUnivs,
                userScores: currentScoreData,
                examMode: currentExamMode
            })
        });

        const data = await res.json();
        const results = data.results || [];

        // 상세 로그 출력
        if (data.server_debug?.logs) {
            // console.groupCollapsed("🖥️ Server Logs");
            // data.server_debug.logs.forEach(l => console.log(l));
            // console.groupEnd();
        }

        console.group(`🧮 [${currentExamMode}] 상세 계산 내역`);
        results.forEach(r => {
            if (r.calculation_log && r.calculation_log.length > 0) {
                console.groupCollapsed(`${r.univ} ${r.major} (UI:${r.converted_score})`);
                r.calculation_log.forEach(l => console.log(l));
                console.groupEnd();
            }
        });
        console.groupEnd();

        // 4. 결과 렌더링
        if (results.length === 0) {
            cardsContainer.innerHTML = `
                <div style="text-align:center; padding:40px; color:#64748b;">
                    <i class="far fa-folder-open fa-2x" style="margin-bottom:10px;"></i><br>
                    분석 가능한 결과가 없습니다.<br>
                    <small>입력하신 성적으로 지원 가능한 전형을 찾지 못했거나 데이터가 부족합니다.</small>
                </div>`;
        } else {
            cardsContainer.innerHTML = results.map(item => renderAnalysisCard(item)).join('');
        }

    } catch (e) {
        console.error("❌ 통신 에러:", e);
        cardsContainer.innerHTML = `
            <div style="text-align:center; padding:30px; color:#ef4444; background:#fff; border-radius:8px;">
                <i class="fas fa-bug fa-2x" style="margin-bottom:10px;"></i>
                <p>분석 중 오류가 발생했습니다.<br><small>${e.message}</small></p>
            </div>`;
    }
}

// [Helper] 시험 모드 변경 핸들러
// (HTML의 onchange 이벤트에서 호출됨)
function changeExamMode(mode) {
    console.log(`🔄 시험 모드 변경: ${mode}`);
    currentExamMode = mode;
    updateAnalysisUI(); // 변경된 모드로 재분석 요청
}

// ============================================================
// [Helper] 상세 분석 카드 HTML 생성 함수
// ============================================================
function renderAnalysisCard(res) {
    // 1. 에러/데이터 부족 처리
    if (res.msg.includes("오류") || res.msg.includes("데이터 없음") || res.status === '분석 불가') {
        return `
        <div class="analysis-card" style="border-left: 4px solid #94a3b8; margin-bottom:15px; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            <div class="analysis-header" style="margin-bottom:10px;">
                <h4 style="margin:0;">${res.idx + 1}지망: ${res.univ} <small style="color:#64748b;">${res.major}</small></h4>
                <span style="background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:4px; font-size:0.8rem; margin-top:5px; display:inline-block;">데이터 부족</span>
            </div>
            <p style="color:#64748b; font-size:0.9rem; margin:0;">${res.msg || '해당 학과의 작년 입시 데이터가 없습니다.'}</p>
        </div>`;
    }

    // 2. 스타일 정의
    const badgeStyle = `background:${res.color}15; color:${res.color}; border:1px solid ${res.color};`; 
    const scoreStyle = `color:${res.color}; font-weight:800; font-size:1.5rem;`;

    // 3. 카드 HTML 구성
    return `
    <div class="analysis-card" style="margin-bottom:20px; background:#fff; border-radius:12px; padding:25px; box-shadow:0 4px 10px rgba(0, 0, 0, 0.05); border-left: 6px solid ${res.color}; transition: transform 0.2s;">
        <div class="analysis-header" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #f1f5f9; padding-bottom:15px; margin-bottom:15px;">
            <div>
                <span style="color:#64748b; font-size:1.1rem; font-weight:800; display:block; margin-bottom:5px;">${res.idx + 1}지망</span>
                <h4 style="margin:0; font-size:1.2rem; color:#1e293b; letter-spacing:-0.5px;">${res.univ}</h4>
                <div style="color:#64748b; font-size:0.95rem; margin-top:2px;">${res.major}</div>
            </div>
            <div style="text-align:right;">
                <span style="${badgeStyle} padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:bold; display:inline-block; margin-bottom:5px;">
                    ${res.status}
                </span>
                <div style="font-size:0.8rem; color:${res.color}; font-weight:600;">${res.msg}</div>
            </div>
        </div>

        <div class="analysis-body" style="display:grid; grid-template-columns: 1fr; gap:25px;">
            
            <div class="score-section">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                    <span style="font-size:0.95rem; color:#475569; font-weight:600;">AI 환산 진단점수</span>
                    <span style="${scoreStyle}">${res.converted_score}<span style="font-size:1rem; font-weight:normal; margin-left:2px; color:#64748b;">점</span></span>
                </div>
                
                <div style="position:relative; width:100%; padding-bottom:20px;">
                    <div style="position:relative; height:12px; background:#f1f5f9; border-radius:6px; margin:10px 0; overflow:hidden;">
                        <div style="position:absolute; left:40%; top:0; bottom:0; width:2px; background:#fff; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                        <div style="position:absolute; left:60%; top:0; bottom:0; width:2px; background:#fff; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                        
                        <div style="position:absolute; left:0; top:0; height:100%; width:${Math.min((res.converted_score / 250) * 100, 100)}%; background:${res.color}; border-radius:6px; transition: width 1s ease-out; z-index:1;"></div>
                    </div>

                    <div style="font-size:0.75rem; color:#94a3b8; height:15px;">
                        <span style="position:absolute; left:0; bottom:0;">0</span>
                        
                        <span style="position:absolute; left:40%; bottom:0; transform:translateX(-50%); color:#64748b; font-weight:600; white-space:nowrap;">
                            합격(100)
                        </span>
                        
                        <span style="position:absolute; left:60%; bottom:0; transform:translateX(-50%); color:#64748b; font-weight:600; white-space:nowrap;">
                            안정(150)
                        </span>
                        
                        <span style="position:absolute; right:0; bottom:0;">MAX(250)</span>
                    </div>
                </div>
            </div>

            <div class="advice-section" style="background:#f8fafc; border-radius:10px; padding:18px; border:1px solid #e2e8f0;">
                <h5 style="margin:0 0 8px 0; font-size:0.9rem; color:#334155; display:flex; align-items:center;">
                    <i class="fas fa-lightbulb" style="color:#fbbf24; margin-right:6px;"></i> 합격 전략 코멘트
                </h5>
                <p style="margin:0; font-size:0.95rem; color:#475569; line-height:1.6;">
                    ${getSimpleAdvice(res.converted_score, res.status)}
                </p>
            </div>

        </div>
    </div>`;
}

// [Helper] 점수대에 따른 조언 생성
function getSimpleAdvice(score, status) {
    if (score >= 150) return `<strong>매우 안정적인 지원</strong>입니다. <br>최초 합격이 유력하며, 장학금 혜택을 확인해보시거나 상위 대학에 소신 지원 카드를 섞는 전략을 추천합니다.`;
    if (score >= 120) return `<strong>합격 가능성이 높습니다.</strong> <br>안정 지원 카드로 활용하기 좋으며, 경쟁률이 폭등하지 않는 한 무난한 합격이 예상됩니다.`;
    if (score >= 100) return `<strong>적정 지원 구간</strong>입니다. <br>예상 합격 컷 부근 점수이며, 추합 가능성이 높습니다. 경쟁률 추이를 끝까지 모니터링하세요.`;
    if (score >= 80) return `<strong>소신 지원이 필요</strong>합니다. <br>합격선보다 다소 낮지만, 학과 내 경쟁률 변화나 추합 변수에 따라 역전 가능성이 존재합니다.`;
    return `<strong>상향 지원(위험)</strong>입니다. <br>점수 차이가 있습니다. 다양한 조합을 고려하여 다른 안정 카드를 반드시 확보하시기 바랍니다.`;
}

// ============================================================
// [기능] 점수 상승 시뮬레이션
// ============================================================

// 1. 시뮬레이션 탭 진입 시 초기화
function initSimulation() {
    const listContainer = document.getElementById('simUnivList');
    if (!listContainer) return;

    // DB에 Null 데이터가 섞여있을 경우를 대비해 유효한 데이터만 필터링
    const validTargets = userTargetUnivs 
        ? userTargetUnivs.filter(t => t && t.univ) // null이나 빈 객체 제거
        : [];

    // 필터링 후에도 데이터가 없으면 안내 표시
    if (validTargets.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:30px 10px;">
                <i class="fas fa-university" style="color:#cbd5e1; font-size:2rem; margin-bottom:10px;"></i>
                <p style="font-size:0.9rem; color:#64748b;">목표 대학이 설정되지 않았습니다.<br>분석 탭에서 대학을 먼저 추가해주세요.</p>
            </div>`;
        return;
    }

    // 체크박스 생성 (validTargets 기준)
    listContainer.innerHTML = validTargets.map((t, i) => `
        <label style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:8px; cursor:pointer; transition:background 0.2s; border:1px solid transparent; margin-bottom:8px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <input type="checkbox" class="sim-univ-check" value="${i}" checked onchange="runSimulationRender()" style="accent-color:#3b82f6; transform:scale(1.2);">
            <div style="font-size:0.9rem;">
                <div style="font-weight:700; color:#334155; margin-bottom:2px;">${t.univ}</div>
                <div style="font-size:0.8rem; color:#64748b;">${t.major}</div>
            </div>
        </label>
    `).join('');

    // 최초 데이터 로드 (유효한 데이터가 있을 때만)
    fetchSimulationData();
}

let cachedSimData = []; // 서버에서 받은 데이터 캐싱

// 2. API 호출 (simulate_score_rise)
async function fetchSimulationData() {
    const chartArea = document.getElementById('simChartBars');
    chartArea.innerHTML = '<div style="width:100%; text-align:center; padding-top:80px;"><i class="fas fa-spinner fa-spin"></i> 분석 중...</div>';

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const scoreData = userQuantData[currentExamMode]; // 현재 선택된 모의고사 기준

    try {
        const res = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'simulate_score_rise',
                userId: userId,
                targetUnivs: userTargetUnivs,
                userScores: scoreData,
                examMode: currentExamMode
            })
        });

        cachedSimData = await res.json();
        runSimulationRender(); // 데이터 수신 후 렌더링

    } catch (e) {
        console.error("Sim Error:", e);
        chartArea.innerHTML = '오류 발생';
    }
}

// 3. 화면 렌더링 (체크박스 필터링 적용)
function runSimulationRender() {
    const checkboxes = document.querySelectorAll('.sim-univ-check:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    // 선택된 대학 중, API 결과가 있는 것만 필터링
    // (API 결과에는 univ, major 이름이 있으므로 userTargetUnivs[idx]와 매칭 필요)
    // 간단하게 순서가 같다면 index로 매칭하거나, 이름으로 매칭
    
    const filteredData = cachedSimData.filter(d => {
        // 캐시된 데이터 d가 선택된 목록에 있는지 확인 (대학명+학과명 매칭)
        return selectedIndices.some(idx => {
            const target = userTargetUnivs[idx];
            return target.univ === d.univ && target.major === d.major;
        });
    });

    renderSimChart(filteredData);
    renderSimCards(filteredData);
}

// [렌더링] 막대 그래프
function renderSimChart(data) {
    const container = document.getElementById('simChartBars');
    container.innerHTML = '';

    data.forEach(item => {
        const heightPct = (item.base_ui_score / 250) * 100; // 250점 만점 기준 %
        const color = item.base_ui_score >= 150 ? '#10b981' : (item.base_ui_score >= 100 ? '#3b82f6' : '#ef4444');
        
        const html = `
            <div style="display:flex; flex-direction:column; align-items:center; width:40px; height:100%; position:relative;">
                <div style="flex-grow:1; display:flex; align-items:flex-end; width:100%;">
                    <div style="width:100%; height:${Math.min(heightPct, 100)}%; background:${color}; border-radius:4px 4px 0 0; position:relative; transition: height 0.5s;">
                        <span style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-size:0.75rem; font-weight:bold; color:${color};">
                            ${Math.round(item.base_ui_score)}
                        </span>
                    </div>
                </div>
                <div style="font-size:0.7rem; color:#475569; text-align:center; margin-top:5px; height:30px; line-height:1.1; overflow:hidden;">
                    ${item.univ}<br>${item.major.substring(0,4)}..
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// [렌더링] 과목별 상승 카드
function renderSimCards(data) {
    const container = document.getElementById('simCardArea');
    container.innerHTML = '';

    data.forEach(item => {
        // 가장 효과가 좋은 과목 찾기
        let bestSubj = '';
        let maxRise = -1;
        
        ['kor', 'math', 'inq'].forEach(k => {
            if (item.sim_data[k].diff > maxRise) {
                maxRise = item.sim_data[k].diff;
                bestSubj = k;
            }
        });

        const subjNames = { kor: '국어', math: '수학', inq: '탐구' };
        
        const cardHtml = `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                <div style="font-weight:bold; color:#334155; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
                    ${item.univ} <span style="font-weight:normal; font-size:0.85rem; color:#64748b;">${item.major}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${['kor', 'math', 'inq'].map(subj => {
                        const info = item.sim_data[subj];
                        const isBest = (subj === bestSubj && info.diff > 0);
                        const rowBg = isBest ? '#eff6ff' : 'transparent';
                        const scoreColor = info.diff > 0 ? '#ef4444' : '#94a3b8';
                        
                        return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px; background:${rowBg}; border-radius:6px;">
                            <div style="display:flex; align-items:center; gap:5px;">
                                <span style="font-size:0.9rem; font-weight:600; color:#475569;">${subjNames[subj]}</span>
                                ${isBest ? '<span style="font-size:0.7rem; background:#3b82f6; color:#fff; padding:1px 4px; border-radius:3px;">추천</span>' : ''}
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.9rem; font-weight:bold; color:${scoreColor};">${info.msg.replace('점 상승', '')} ${info.diff > 0 ? '▲' : ''}</div>
                                <div style="font-size:0.7rem; color:#94a3b8;">${info.diff > 0 ? `(재환산 +${info.diff.toFixed(1)})` : ''}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function checkWeeklyStatus() {
    const today = new Date();
    const currentWeekTitle = getWeekTitle(today); 
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    const thisWeekData = history.find(w => { if(!w.title) return false; return w.title.replace(/\s+/g, '').includes(currentWeekTitle.replace(/\s+/g, '')); });
    const badge = document.getElementById('weeklyStatusBadge');
    const msg = document.getElementById('weeklyDeadlineMsg');
    const box = document.getElementById('weeklyBox');
    if (!badge || !box || !msg) return;
    if (thisWeekData) { badge.className = 'badge-status submitted'; badge.innerText = '✅ 제출완료'; } 
    else { badge.className = 'badge-status pending'; badge.innerText = '미제출'; }
    const day = today.getDay(); const hour = today.getHours();
    if (day === 0 && hour >= 20) { badge.className = 'badge-status locked'; badge.innerText = '⛔ 마감됨'; msg.style.color = '#ef4444'; msg.innerText = "수정 불가 (매주 일요일 20시 마감)"; box.classList.add('disabled'); box.onclick = null; box.setAttribute('onclick', ''); } 
    else { msg.style.color = '#64748b'; msg.innerText = "※ 일요일 20:00 마감"; box.classList.remove('disabled'); box.onclick = openWeeklyCheckModal; }
}

function openWeeklyCheckModal() {
    const today = new Date();
    if (today.getDay() === 0 && today.getHours() >= 20) { alert("금주 학습 점검 제출이 마감되었습니다."); return; }
    const modal = document.getElementById('weeklyCheckModal');
    const currentWeekTitle = getWeekTitle(today); 
    const [yStr, mStr, wStr] = currentWeekTitle.split(' '); 
    document.getElementById('weeklyYear').innerText = yStr; 
    document.getElementById('weeklyDateDetail').innerText = `${mStr} ${wStr}`;
    
    const thisWeekData = weeklyDataHistory.find(w => w.title && w.title.replace(/\s/g, '') === currentWeekTitle.replace(/\s/g, ''));
    if (thisWeekData) { loadWeeklyDataToForm(thisWeekData); } 
    else { resetWeeklyForm(); }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function resetWeeklyForm() {
    document.getElementById('weekComment').value = '';
    document.querySelectorAll('.plan-time, .act-time, .sub-detail, .custom-subj').forEach(i => i.value = '');
    document.querySelectorAll('.rate-txt').forEach(s => s.innerText = '0%');
    document.getElementById('totalPlan').innerText = '0H';
    document.getElementById('totalAct').innerText = '0H';
    document.getElementById('totalRate').innerText = '0%';
    selectMockType('none', document.querySelector('.mock-tile')); 
    document.querySelectorAll('.mock-score').forEach(i => i.value = '');
    document.getElementById('slumpDetail').value = '';
    document.querySelectorAll('#slumpReasonBox input').forEach(cb => cb.checked = false);
    document.getElementById('slumpReasonBox').style.display = 'none';
    const radios = document.getElementsByName('studyTrend');
    if(radios.length) radios[0].checked = false;
    
    currentPlannerFiles = [];
    renderPlannerFiles();
}

function closeWeeklyModal() {
    document.getElementById('weeklyCheckModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function handlePlannerFiles(input) {
    if (input.files) {
        const files = Array.from(input.files);
        if (currentPlannerFiles.length + files.length > 5) {
            alert("최대 5장까지만 업로드 가능합니다.");
            input.value = ''; 
            return;
        }
        files.forEach(f => currentPlannerFiles.push(f)); 
        renderPlannerFiles();
    }
}

function renderPlannerFiles() {
    const list = document.getElementById('plannerFileList');
    list.innerHTML = '';
    
    if (currentPlannerFiles.length === 0) {
        list.innerHTML = '<span class="placeholder-text">선택된 파일 없음</span>';
        return;
    }

    currentPlannerFiles.forEach((file, idx) => {
        let fileName = "";
        let fileLink = ""; 

        if (file instanceof File) {
            fileName = file.name;
        } 
        else if (typeof file === 'string') {
            try {
                const rawName = file.split('/').pop();
                fileName = decodeURIComponent(rawName);
                fileName = fileName.replace(/^\d+_/, '');
                fileLink = file; 
            } catch (e) {
                fileName = file; 
            }
        }

        const div = document.createElement('div');
        div.className = 'file-item';
        
        let nameDisplay = `<span>📄 ${fileName}</span>`;
        if (fileLink) {
            nameDisplay = `<a href="${fileLink}" target="_blank" style="text-decoration:none; color:#334155; display:flex; align-items:center; gap:5px;">
                <span>📄 ${fileName}</span> 
                <i class="fas fa-external-link-alt" style="font-size:0.7rem; color:#3b82f6;"></i>
            </a>`;
        }

        div.innerHTML = `
            ${nameDisplay}
            <span class="file-remove" onclick="removePlannerFile(${idx})">x</span>
        `;
        list.appendChild(div);
    });
}

function removePlannerFile(idx) {
    currentPlannerFiles.splice(idx, 1);
    renderPlannerFiles();
}

function loadWeeklyDataToForm(data) {
    if (data.studyTime && data.studyTime.details) {
        const rows = document.querySelectorAll('#studyTimeBody tr');
        data.studyTime.details.forEach((detail, idx) => {
            if (rows[idx]) {
                rows[idx].querySelector('.plan-time').value = detail.plan;
                rows[idx].querySelector('.act-time').value = detail.act;
                const detailInput = rows[idx].querySelector('.sub-detail');
                const customInput = rows[idx].querySelector('.custom-subj');
                if (detail.subject.includes('(') && detailInput) {
                    const match = detail.subject.match(/\((.*?)\)/);
                    if(match) detailInput.value = match[1];
                } else if (customInput) customInput.value = detail.subject;
            }
        });
        calcStudyRates(); 
    }
    if (data.mockExam) {
        const targetTile = document.querySelector(`.mock-tile[onclick*="'${data.mockExam.type}'"]`);
        if(targetTile) selectMockType(data.mockExam.type, targetTile);
        if (data.mockExam.scores) {
            const inputs = document.querySelectorAll('.mock-score');
            if(inputs.length > 0) {
                inputs[0].value = data.mockExam.scores.kor || '';
                inputs[1].value = data.mockExam.scores.math || '';
                inputs[2].value = data.mockExam.scores.eng || '';
                inputs[3].value = data.mockExam.scores.inq1 || '';
                inputs[4].value = data.mockExam.scores.inq2 || '';
            }
        }
    }
    if (data.trend) {
        const radio = document.querySelector(`input[name="studyTrend"][value="${data.trend.status}"]`);
        if (radio) {
            radio.checked = true;
            toggleSlumpReason(); 
            if (data.trend.status === 'down' && data.trend.reasons) {
                data.trend.reasons.forEach(r => {
                    const cb = document.querySelector(`#slumpReasonBox input[value="${r}"]`);
                    if(cb) cb.checked = true; else document.getElementById('slumpDetail').value = r; 
                });
            }
        }
    }
    if (data.comment) {
        const ta = document.getElementById('weekComment');
        ta.value = data.comment;
        checkLength(ta);
    }
    currentPlannerFiles = data.plannerFiles || [];
    originalPlannerFiles = [...currentPlannerFiles];
    renderPlannerFiles();
}

function calcStudyRates() {
    const rows = document.querySelectorAll('#studyTimeBody tr');
    let sumPlan = 0, sumAct = 0;
    rows.forEach(row => {
        const plan = parseFloat(row.querySelector('.plan-time').value) || 0;
        const act = parseFloat(row.querySelector('.act-time').value) || 0;
        sumPlan += plan; sumAct += act;
        const rateTxt = row.querySelector('.rate-txt');
        if (plan > 0) {
            const rate = Math.min((act / plan) * 100, 100).toFixed(0);
            rateTxt.innerText = `${rate}%`;
            if(rate >= 100) rateTxt.style.color = '#10b981'; else if(rate >= 80) rateTxt.style.color = '#3b82f6'; else rateTxt.style.color = '#ef4444';
        } else { rateTxt.innerText = '0%'; rateTxt.style.color = '#94a3b8'; }
    });
    document.getElementById('totalPlan').innerText = sumPlan.toFixed(1) + 'H';
    document.getElementById('totalAct').innerText = sumAct.toFixed(1) + 'H';
    const totalRate = sumPlan > 0 ? Math.min((sumAct / sumPlan) * 100, 100).toFixed(0) : 0;
    document.getElementById('totalRate').innerText = `${totalRate}%`;
}

function selectMockType(type, element) {
    document.getElementById('mockExamType').value = type;
    document.querySelectorAll('.mock-tile').forEach(tile => tile.classList.remove('selected'));
    element.classList.add('selected');
    toggleMockExamFields();
}

function toggleMockExamFields() {
    const type = document.getElementById('mockExamType').value;
    const fields = document.getElementById('mockExamFields');
    if (type === 'none') fields.style.display = 'none'; else fields.style.display = 'block';
}

function toggleSlumpReason() {
    const trend = document.querySelector('input[name="studyTrend"]:checked')?.value;
    const box = document.getElementById('slumpReasonBox');
    if(trend === 'down') box.style.display = 'block'; else box.style.display = 'none';
}

function checkLength(el) { document.getElementById('currLen').innerText = el.value.length; }

async function submitWeeklyCheck() {
    const totalPlan = parseFloat(document.getElementById('totalPlan').innerText);
    if (totalPlan === 0) { alert("학습 계획 시간을 입력해주세요."); return; }

    const mockType = document.getElementById('mockExamType').value;
    let mockData = { type: mockType, proofFile: null, scores: {} };

    if (mockType !== 'none') {
        const fileInput = document.getElementById('mockExamProof');
        mockData.proofFile = fileInput.files.length > 0 ? fileInput.files[0].name : "file_uploaded"; 
        
        const scores = document.querySelectorAll('.mock-score');
        mockData.scores = { 
            kor: scores[0].value, 
            math: scores[1].value, 
            eng: scores[2].value, 
            inq1: scores[3].value, 
            inq2: scores[4].value 
        };
    }

    const comment = document.getElementById('weekComment').value.trim();
    if (!comment) { alert("핵심 회고를 작성해주세요."); return; }

    const studyRows = document.querySelectorAll('#studyTimeBody tr');
    let studyData = [];
    studyRows.forEach(row => {
        let subjName = "";
        const mainSub = row.querySelector('.main-sub');
        const detail = row.querySelector('.sub-detail');
        const custom = row.querySelector('.custom-subj');

        if(mainSub) {
            subjName = mainSub.innerText;
            if(detail && detail.value) subjName += `(${detail.value.trim()})`;
        } else if(custom) {
            subjName = custom.value.trim() || "기타";
        }

        const plan = parseFloat(row.querySelector('.plan-time').value) || 0;
        const act = parseFloat(row.querySelector('.act-time').value) || 0;
        if(plan > 0 || act > 0) studyData.push({ subject: subjName, plan, act });
    });

    const trend = document.querySelector('input[name="studyTrend"]:checked')?.value || 'keep';
    let reasons = [];
    if(trend === 'down') {
        document.querySelectorAll('#slumpReasonBox input:checked').forEach(cb => reasons.push(cb.value));
        const det = document.getElementById('slumpDetail').value;
        if(det) reasons.push(det);
    }

    if(!confirm("제출하시겠습니까?\n(수정 시 기존 데이터는 덮어씌워집니다)")) return;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); // [수정] idToken
    const submitBtn = document.querySelector('.save-btn');
    const originalBtnText = submitBtn.innerText;

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "데이터 처리 중...";

        const currentUrls = currentPlannerFiles.filter(f => typeof f === 'string');
        const filesToDelete = originalPlannerFiles.filter(url => !currentUrls.includes(url));

        if (filesToDelete.length > 0) {
            submitBtn.innerText = "기존 파일 삭제 중...";
            await Promise.all(filesToDelete.map(url => 
                fetch(MYPAGE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ 
                        type: 'delete_s3_file', 
                        userId: userId, 
                        data: { fileUrl: url } 
                    })
                })
            ));
        }

        let finalFileUrls = [...currentUrls]; 
        const newFiles = currentPlannerFiles.filter(f => typeof f !== 'string');

        if (newFiles.length > 0) {
            submitBtn.innerText = "새 사진 업로드 중... (잠시만 기다려주세요)";
            
            for (const file of newFiles) {
                const res = await fetch(MYPAGE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ 
                        type: 'get_presigned_url', 
                        userId: userId, 
                        data: { fileName: file.name, fileType: file.type } 
                    })
                });

                if (!res.ok) throw new Error("업로드 URL 발급 실패");
                const { uploadUrl, fileUrl } = await res.json();

                await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type },
                    body: file
                });
                finalFileUrls.push(fileUrl);
            }
        }

        submitBtn.innerText = "저장 중...";
        
        const today = new Date().toISOString();
        const title = getWeekTitle(new Date()); 

        const weeklyData = {
            date: today,
            title: title, 
            studyTime: {
                details: studyData, 
                totalPlan: document.getElementById('totalPlan').innerText,
                totalAct: document.getElementById('totalAct').innerText,
                totalRate: document.getElementById('totalRate').innerText
            },
            mockExam: mockData,
            trend: { status: trend, reasons: reasons },
            comment: comment,
            plannerFiles: finalFileUrls 
        };

        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ type: 'save_weekly_check', userId, data: weeklyData })
        });
        
        if(res.ok) { 
            alert("제출 및 수정이 완료되었습니다."); 
            closeWeeklyModal(); 
            location.reload(); 
        } else {
            throw new Error("서버 응답 오류");
        }

    } catch(e) { 
        console.error("Submit Error:", e); 
        alert("처리 중 오류가 발생했습니다: " + e.message); 
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
    }
}

function openDeepCoachingModal() {
    if (currentUserTier !== 'pro') {
        if(currentUserTier === 'black') alert("BLACK 회원은 [FOR BLACK] 메뉴를 이용해주세요.");
        else alert("PRO 멤버십 전용 기능입니다.");
        return;
    }
    const modal = document.getElementById('deepCoachingModal');
    modal.querySelectorAll('textarea').forEach(el => { el.value = ''; el.nextElementSibling.innerText = '0/200'; });
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeDeepModal() {
    document.getElementById('deepCoachingModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function updateCharCount(el) { el.parentElement.querySelector('.char-count span').innerText = el.value.length; }

async function submitDeepCoaching() {
    const textareas = document.querySelectorAll('#deepCoachingModal textarea');
    const ans = Array.from(textareas).map(t => t.value.trim());
    if(ans.every(a => a === "")) { alert("내용을 입력해주세요."); return; }
    if(!confirm("심층 코칭을 요청하시겠습니까?")) return;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); // [수정] idToken
    const reqData = { date: new Date().toISOString(), plan: ans[0], direction: ans[1], subject: ans[2], etc: ans[3], status: 'pending' };
    try {
        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'save_pro_coaching', userId, data: reqData })
        });
        if(res.ok) { alert("요청이 접수되었습니다."); closeDeepModal(); } else throw new Error("전송 실패");
    } catch(e) { console.error(e); alert("오류가 발생했습니다."); }
}

function initCoachLock() {
    const lockOverlay = document.getElementById('deepCoachingLock');
    if (['pro', 'black'].includes(currentUserTier)) { if(lockOverlay) lockOverlay.style.display = 'none'; } 
    else { if(lockOverlay) lockOverlay.style.display = 'flex'; }
}

async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); // [수정] idToken
    const newName = document.getElementById('profileName').value;
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;
    const newEmail = document.getElementById('profileEmail').value;
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('newPasswordConfirm').value;
    if (!newName) return alert("이름을 입력해주세요.");
    if (newPw && newPw !== confirmPw) return alert("새 비밀번호가 일치하지 않습니다.");
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_profile', userId, data: { name: newName, phone: newPhone, school: newSchool, email: newEmail } })
        });
        if(response.ok) { alert("회원 정보가 수정되었습니다."); location.reload(); } else { throw new Error("저장 실패"); }
    } catch (error) { alert("저장 중 오류가 발생했습니다."); }
}

function checkBlackStatusForButton() {
    const btn = document.getElementById('btnBlackAction');
    if (btn && currentUserTier === 'black') {
        
        // 1. 링크 변경
        btn.onclick = function() {
            window.location.href = 'black_index.html';
        };

        // 2. 텍스트 변경
        // 💡 <span> 태그 안에 팁 내용을 추가했습니다.
        btn.innerHTML = `
            👑 BLACK LOUNGE 입장하기
            <span style="display:block; font-size:0.9rem; margin-top:5px; color:#555;">
                (💡Tip: 메인화면 우측 하단 버튼으로도 바로 접속 가능합니다)
            </span>
        `;
        
        // 3. 스타일 변경 (실버/화이트 톤으로 고급스럽게)
        btn.style.background = "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)"; 
        // btn.style.color = "#1a1a1a";
        // btn.style.border = "1px solid #ccc";
    }
}

async function handleDeleteAccount() {
    if (!confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 영구 삭제됩니다.")) return;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); // [수정] idToken
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'delete_user', userId })
        });
        if (response.ok) { alert("탈퇴가 완료되었습니다."); localStorage.clear(); sessionStorage.clear(); window.location.href = 'index.html'; } else { throw new Error("탈퇴 실패"); }
    } catch (error) { alert("오류 발생"); }
}

function setupUI() {
    const pwConfirmInput = document.getElementById('newPasswordConfirm');
    if (pwConfirmInput) {
        pwConfirmInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') saveProfile(); });
    }
}
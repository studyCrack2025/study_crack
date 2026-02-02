// js/mypage.js

// 기존 API (회원정보, 주간점검 등)
const MYPAGE_API_URL = CONFIG.api.base; 
// 대학 목록 조회용 API
const UNIV_DATA_API_URL = CONFIG.api.analysis;
// 환산점수 계산 전용 Lambda URL
const CALC_API_URL = CONFIG.api.calc;

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
const EXAM_NAMES = {
    'csat': '수능 (실채점)',
    'sep': '9월 모의평가',
    'jun': '6월 모의평가',
    'oct': '10월 학력평가',
    'jul': '7월 학력평가',
    'mar': '3월 학력평가',
    'may': '5월 학력평가'
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
// [디버깅] 목표대학 분석 UI 업데이트 (범인 찾기용)
// ============================================================
async function updateAnalysisUI() {
    console.log("🏃‍♂️ [Start] updateAnalysisUI 함수 시작됨");

    const container = document.getElementById('univAnalysisResult');
    if (!container) {
        console.error("❌ [Error] 'univAnalysisResult' 컨테이너가 HTML에 없습니다.");
        return;
    }
    
    // 1. 목표 대학 데이터 확인
    console.log("🔍 [Check 1] 목표 대학 데이터 확인 중...", userTargetUnivs);
    const hasTargets = userTargetUnivs && userTargetUnivs.some(u => u && u.univ);
    
    if (!hasTargets) { 
        console.warn("⚠️ [Stop] 설정된 목표 대학이 없습니다. 요청을 중단합니다.");
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">목표 대학을 설정하면 분석 결과가 나타납니다.</p>'; 
        return; 
    }

    // 2. 성적 데이터 확인
    console.log("🔍 [Check 2] 성적 데이터 확인 중...", userQuantData);
    if (!userQuantData || Object.keys(userQuantData).length === 0) {
        console.warn("⚠️ [Stop] 입력된 성적 데이터가 없습니다. 요청을 중단합니다.");
        container.innerHTML = '<p style="text-align:center; color:#ef4444; padding:30px;">입력된 성적 데이터가 없습니다.</p>';
        return;
    }

    // 3. 시험 모드 선택
    const availableExams = Object.keys(userQuantData).filter(key => userQuantData[key] && (userQuantData[key].kor || userQuantData[key].math));
    console.log("🔍 [Check 3] 가용한 시험 모드:", availableExams, "현재 선택:", currentExamMode);
    
    if (!availableExams.includes(currentExamMode) && availableExams.length > 0) {
        console.log(`🔄 [Auto] 현재 모드(${currentExamMode}) 데이터가 없어 ${availableExams[0]}로 자동 변경합니다.`);
        currentExamMode = availableExams[0];
    }

    // 4. UI 로딩 표시
    container.innerHTML = `
        <div class="analysis-controls" style="display:flex; justify-content:flex-end; margin-bottom:15px; align-items:center; gap:10px;">
            <label style="font-size:0.9rem; color:#64748b;">분석 기준:</label>
            <select id="examModeSelector" onchange="changeExamMode(this.value)" style="padding:5px 10px; border:1px solid #cbd5e1; border-radius:6px;">
                ${availableExams.map(key => `<option value="${key}" ${key === currentExamMode ? 'selected' : ''}>${EXAM_NAMES[key] || key}</option>`).join('')}
            </select>
        </div>
        <div id="analysisCardsContainer">
            <div style="text-align:center; padding:50px;">
                <i class="fas fa-spinner fa-spin" style="font-size:2rem; color:#3b82f6;"></i>
                <p style="margin-top:10px; color:#64748b;">서버에 재계산을 요청 중입니다...</p>
            </div>
        </div>
    `;

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const currentScoreData = userQuantData[currentExamMode];

    // 5. 실제 요청 전송
    console.log("🚀 [Fetch] 서버로 분석 요청을 보냅니다!");
    console.log("   -> URL:", CALC_API_URL);
    console.log("   -> Payload:", JSON.stringify({
        type: 'analyze_my_targets',
        userId: userId,
        targetUnivs: userTargetUnivs,
        userScores: currentScoreData
    }));

    try {
        const res = await fetch(CALC_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                type: 'analyze_my_targets',
                userId: userId,
                targetUnivs: userTargetUnivs,
                userScores: currentScoreData
            })
        });
        
        console.log("📩 [Response] 서버 응답 도착. 상태코드:", res.status);

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`서버 에러 (${res.status}): ${errText}`);
        }
        
        const resultWrapper = await res.json();
        console.log("📦 [Data] 받은 데이터:", resultWrapper); // 여기가 핵심입니다!

        const results = resultWrapper.results || [];
        const cardsContainer = document.getElementById('analysisCardsContainer');
        
        if (results.length === 0) {
             console.warn("⚠️ [Warning] 결과 배열이 비어있습니다.");
             cardsContainer.innerHTML = '<p style="text-align:center; padding:30px;">분석할 데이터가 없습니다.</p>';
        } else {
             cardsContainer.innerHTML = results.map(item => renderAnalysisCard(item)).join('');
             console.log("✅ [Done] 카드 렌더링 완료");
        }

    } catch (e) {
        console.error("❌ [Error] 분석 요청 중 치명적 오류:", e);
        const errContainer = document.getElementById('analysisCardsContainer');
        if(errContainer) {
            errContainer.innerHTML = `
            <div style="text-align:center; padding:30px; color:#ef4444;">
                <i class="fas fa-exclamation-triangle"></i><br>
                오류 발생: ${e.message}
            </div>`;
        }
    }
}

// 시험 모드 변경 핸들러
function changeExamMode(mode) {
    currentExamMode = mode;
    updateAnalysisUI(); // 재분석 요청
}

// 상세 분석 카드 HTML 생성 함수 (서버 데이터를 그대로 렌더링)
function renderAnalysisCard(res) {
    // 1. 에러 처리
    if (res.error || res.status === '분석 불가') {
        return `
        <div class="analysis-card" style="border-left: 4px solid #94a3b8; margin-bottom:15px; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            <div class="analysis-header" style="margin-bottom:10px;">
                <h4 style="margin:0;">${res.idx + 1}지망: ${res.univ} <small style="color:#64748b;">${res.major}</small></h4>
                <span style="background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:4px; font-size:0.8rem;">분석 데이터 부족</span>
            </div>
            <p style="color:#64748b; font-size:0.9rem; margin:0;">${res.msg || '해당 학과의 작년 입시 데이터가 없습니다.'}</p>
        </div>`;
    }

    // 2. 서버에서 받은 컬러와 상태값 사용
    const badgeStyle = `background:${res.color}15; color:${res.color}; border:1px solid ${res.color};`; // 배경은 연하게, 글자는 진하게
    const scoreStyle = `color:${res.color}; font-weight:800; font-size:1.2rem;`;

    return `
    <div class="analysis-card" style="margin-bottom:20px; background:#fff; border-radius:12px; padding:25px; box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.1); border-left: 5px solid ${res.color};">
        <div class="analysis-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:15px; margin-bottom:15px;">
            <h4 style="margin:0; font-size:1.1rem;">
                <span style="color:#64748b; font-weight:normal; font-size:0.9rem;">${res.idx + 1}지망</span> 
                <span style="font-weight:bold; color:#333;">${res.univ}</span>
                <span style="color:#64748b; font-weight:normal; font-size:0.95rem;">${res.major}</span>
            </h4>
            <span style="${badgeStyle} padding:4px 12px; border-radius:20px; font-size:0.85rem; font-weight:bold;">
                ${res.status}
            </span>
        </div>

        <div class="analysis-body" style="display:grid; grid-template-columns: 1.2fr 1fr; gap:20px;">
            <div class="score-summary">
                <h5 style="margin:0 0 10px 0; font-size:0.9rem; color:#64748b;">📊 AI 환산 분석</h5>
                <div style="background:#f8fafc; padding:15px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-size:0.9rem; color:#475569;">자체 환산 점수</span>
                        <span style="${scoreStyle}">${res.converted_score}점</span>
                    </div>
                    
                    <div style="width:100%; height:8px; background:#e2e8f0; border-radius:4px; margin:10px 0; position:relative; overflow:hidden;">
                        <div style="position:absolute; left:0; top:0; height:100%; width:${Math.min((res.converted_score / 160) * 100, 100)}%; background:${res.color}; transition: width 1s;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8;">
                        <span>0</span>
                        <span>Pass(100)</span>
                        <span>Top70(130)</span>
                    </div>

                    <div style="margin-top:12px; font-size:0.9rem; color:#334155; font-weight:500; text-align:right;">
                        "${res.msg}"
                    </div>
                </div>
            </div>

            <div class="subject-diagnosis">
                 <h5 style="margin:0 0 10px 0; font-size:0.9rem; color:#64748b;">⚖️ 과목별 유불리</h5>
                 <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:15px; height:80%;">
                    <p style="font-size:0.85rem; color:#64748b; line-height:1.6;">
                        ${getSimpleAdvice(res.converted_score)}
                    </p>
                 </div>
            </div>
        </div>
    </div>`;
}

// 점수대에 따른 간단 조언 멘트 (프론트엔드용 헬퍼)
function getSimpleAdvice(score) {
    if (score >= 130) return "성적 여유가 충분합니다. <br>장학금이나 상위 학과 도전도 고려해보세요.";
    if (score >= 100) return "합격권 내에 있습니다. <br>면접 등 남은 전형 요소가 있다면 실수만 줄이세요.";
    if (score >= 85) return "추가 합격을 노려볼 수 있는 구간입니다. <br>경쟁률 추이를 끝까지 지켜봐야 합니다.";
    return "현재 점수로는 합격이 어렵습니다. <br>반영비가 유리한 다른 대학을 찾아보시길 권장합니다.";
}

// 과목별 진단 헬퍼 함수
function getSubjectDiagnostics(scores, ratios) {
    // scores: 유저 성적 (등급 등), ratios: 대학 반영비 (예: 30)
    // 간단한 로직: 반영비가 높은데 등급이 낮으면 '미달', 반대면 '우수'
    // 실제로는 백엔드에서 정밀 분석 값을 주는 게 좋지만, 여기선 프론트에서 약식 진단
    
    const subjects = [
        { key: 'kor', label: '국어', scoreKey: 'kor' },
        { key: 'math', label: '수학', scoreKey: 'math' },
        { key: 'eng', label: '영어', scoreKey: 'eng' },
        { key: 'inq', label: '탐구', scoreKey: 'inq1' } // 탐구는 평균 등으로 처리 필요하나 편의상 1과목
    ];

    let html = '';

    subjects.forEach(sub => {
        const ratio = parseFloat(ratios[sub.key]) || 0;
        if (ratio === 0) return; // 반영 안 함

        // 유저 등급 (score객체 구조에 따라 다름, 여기선 scores[key]가 등급이라 가정하거나 scores[key].grade)
        // 기존 코드 구조상 scores.kor, scores.math 등이 문자열/숫자로 저장됨
        let grade = 0;
        if (typeof scores[sub.scoreKey] === 'object') grade = parseInt(scores[sub.scoreKey].grade || 9);
        else grade = parseInt(scores[sub.scoreKey] || 9);

        let status = '';
        let color = '';

        // 진단 로직 (예시)
        // 반영비 30% 이상 & 1-2등급 -> 강점
        // 반영비 30% 이상 & 4등급 이하 -> 위험
        if (grade <= 2) {
            status = '🟢 우수'; color = '#10b981';
        } else if (grade <= 3) {
            status = '🟡 적정'; color = '#f59e0b';
        } else {
            status = (ratio >= 30) ? '🔴 부족 (위험)' : '⚪ 부족 (영향↓)';
            color = (ratio >= 30) ? '#ef4444' : '#94a3b8';
        }

        html += `
        <div style="display:flex; justify-content:space-between; font-size:0.9rem; align-items:center;">
            <div style="display:flex; align-items:center; gap:5px;">
                <span style="background:#eff6ff; color:#3b82f6; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${ratio}%</span>
                <span>${sub.label}</span>
            </div>
            <span style="color:${color}; font-weight:500;">${status}</span>
        </div>`;
    });

    if (html === '') return '<p style="font-size:0.85rem; color:#94a3b8;">반영비 정보가 없습니다.</p>';
    return html;
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
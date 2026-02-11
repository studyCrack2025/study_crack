// js/analysis.js

// ============================================================
// [설정] API 및 상수 정의
// ============================================================
const MYPAGE_API_URL = CONFIG.api.base;       // 사용자 정보, 주간점검 저장 등
const UNIV_DATA_API_URL = CONFIG.api.analysis; // 대학 분석, 시뮬레이션 등

let currentUserTier = 'free';
let userTargetUnivs = [null, null, null, null, null, null, null, null]; // 8슬롯
let univData = []; 
let univMap = {};  
let userQuantData = null; 
let weeklyDataHistory = [];

// 대학 선택 모달 관련
let currentSlotIndex = null;

// 플래너 파일 업로드 관련
let currentPlannerFiles = []; 
let originalPlannerFiles = [];

// 시험 모드 (수능/평가원 등)
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

// ============================================================
// [초기화] DOM 로드 시 실행
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    setWeeklyLoadingStatus(true);
    console.log("🚀 [Analysis] 데이터 로딩 시작...");

    // 병렬 데이터 로드
    Promise.allSettled([
        fetchUserData(userId).then(() => console.log("  - ✅ 회원정보 로드 완료")),
        fetchUnivData().then(() => console.log("  - ✅ 대학 목록 로드 완료"))
    ]).then((results) => {
        results.forEach((res, idx) => {
            if (res.status === 'rejected') {
                console.error(`❌ 데이터 로드 실패 (Index ${idx}):`, res.reason);
            }
        });

        // 초기화 로직 실행
        initUnivGrid(); 
        updateAnalysisUI(); 
        initCoachLock();
        checkBlackStatusForButton();
        
        setWeeklyLoadingStatus(false);
        setTimeout(() => { checkWeeklyStatus(); }, 500); 

        // URL 파라미터 확인 (?sol=sim 등)
        const params = new URLSearchParams(window.location.search);
        const sol = params.get('sol');
        if (sol) { 
            setTimeout(() => openSolution(sol), 100); 
        }
    });
});

// ============================================================
// [데이터 로드] 사용자 정보 & 대학 목록
// ============================================================
async function fetchUserData(userId) {
    const token = localStorage.getItem('idToken');
    const safeUserId = userId || localStorage.getItem('userId'); 
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: safeUserId }) 
        });
        
        if (!response.ok) throw new Error("사용자 데이터 로드 실패");
        
        const data = await response.json();
        
        // 상단 프로필 정보 렌더링
        renderUserInfo(data);
        applyUserTier(data.computedTier || 'free'); 
        updateSurveyStatus(data);
        
        // 전역 변수 설정
        if (data.targetUnivs) userTargetUnivs = data.targetUnivs;
        if (data.quantitative) userQuantData = data.quantitative;
        weeklyDataHistory = data.weeklyHistory || []; 
        
        // 대학 매핑 빌드
        if (typeof buildUnivMap === 'function') buildUnivMap();
        
        // 프로필 이미지 (사이드바)
        if (data && data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if (imgElem) imgElem.src = data.profileImage;
        }
    } catch (error) { 
        console.error("User Data Error:", error); 
        if(error.message.includes("401")) { location.href='/login'; }
    }
}

function renderUserInfo(data) {
    const nameEl = document.getElementById('userNameDisplay');
    const emailEl = document.getElementById('userEmailDisplay');
    if(nameEl) nameEl.innerText = data.name || '이름 없음';
    if(emailEl) emailEl.innerText = data.email || '';
}

function applyUserTier(tier) {
    currentUserTier = tier;
    // 티어 배지 등 UI 업데이트 (필요 시 구현)
}

function updateSurveyStatus(data) {
    // ---------------------------
    // 1. 정성 데이터 (Qualitative)
    // ---------------------------
    const qual = data.qualitative; // 정성 데이터 객체
    const isQualDone = !!qual;     // 존재 여부

    const qualStatusEl = document.getElementById('qualStatus');
    const qualStreamRow = document.getElementById('qualStreamRow');
    const qualTargetRow = document.getElementById('qualTargetRow');
    
    if (isQualDone) {
        // (1) 상태 표시
        qualStatusEl.innerHTML = '<span style="color:#166534; font-weight:bold;">✅ 작성완료</span>';
        
        // (2) 희망 계열 (문과/이과 등)
        // data.qualitative.group 값 사용 (예: humanities, natural)
        // 값이 없으면 '-' 표시
        const groupMap = { 
            'humanities': '인문계열', 
            'natural': '자연계열', 
            'arts': '예체능', 
            'undefined': '미정' 
        };
        const groupKey = qual.group || 'undefined';
        const groupName = groupMap[groupKey] || groupKey; // 매핑 없으면 그대로 출력
        
        document.getElementById('qualStream').innerText = groupName;
        qualStreamRow.style.display = 'flex';

        // (3) 목표 대학 (1, 2지망)
        // qual 데이터 내부에 target_univ_1 등이 있거나, userTargetUnivs 배열 사용
        let targets = [];
        if (qual.target_univ_1) targets.push(qual.target_univ_1);
        if (qual.target_univ_2) targets.push(qual.target_univ_2);
        
        // 정성 데이터에 없으면 전역 타겟 대학에서 가져오기 (fallback)
        if (targets.length === 0 && data.targetUnivs) {
            if(data.targetUnivs[0]?.univ) targets.push(data.targetUnivs[0].univ);
            if(data.targetUnivs[1]?.univ) targets.push(data.targetUnivs[1].univ);
        }

        if (targets.length > 0) {
            document.getElementById('qualTarget').innerText = targets.join(', ');
            qualTargetRow.style.display = 'flex';
        } else {
            qualTargetRow.style.display = 'none';
        }

    } else {
        // 미작성 상태
        qualStatusEl.innerHTML = '<span style="color:#991b1b; font-weight:bold;">❌ 미작성</span>';
        qualStreamRow.style.display = 'none';
        qualTargetRow.style.display = 'none';
    }

    // ---------------------------
    // 2. 정량 데이터 (Quantitative)
    // ---------------------------
    const quan = data.quantitative || {};
    // 실제 점수가 입력된 시험만 필터링 (국어 또는 수학 점수가 있는 경우)
    const validExams = Object.keys(quan).filter(key => {
        const d = quan[key];
        return d && (d.kor || d.math);
    });
    const isQuanDone = validExams.length > 0;

    const quanListEl = document.getElementById('quanDataList');
    const quanEmptyEl = document.getElementById('quanEmpty');

    quanListEl.innerHTML = ''; // 초기화

    if (isQuanDone) {
        quanEmptyEl.style.display = 'none';
        
        // 시험 순서 정렬 (3월 -> 수능 순)
        const sortOrder = ['mar', 'apr', 'may', 'jun', 'jul', 'sep', 'oct', 'csat'];
        validExams.sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));

        // 최근 3개만 보여주기 (너무 길어짐 방지) or 전체 보여주기
        // 여기서는 전체를 보여주되, 공간 부족 시 스크롤 되도록 CSS 처리 권장
        validExams.forEach(key => {
            const examData = quan[key];
            const examName = EXAM_DISPLAY_NAMES[key] ? EXAM_DISPLAY_NAMES[key].split(' ')[0] : key.toUpperCase(); // "6월", "9월", "수능" 등 짧게
            
            // 점수 요약 (예: 국92 수88)
            let scoreSummary = [];
            if (examData.kor) scoreSummary.push(`국${examData.kor}`);
            if (examData.math) {
                // 수학은 구조가 {score:88, opt:'...'} 일 수도 있고 그냥 숫자일 수도 있음
                const mScore = typeof examData.math === 'object' ? examData.math.score : examData.math;
                if(mScore) scoreSummary.push(`수${mScore}`);
            }
            if (examData.eng) scoreSummary.push(`영${examData.eng}`);

            // 리스트 아이템 생성
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="label">${examName}</span>
                <span class="data-summary">${scoreSummary.join(' ')}</span>
            `;
            quanListEl.appendChild(li);
        });

    } else {
        quanEmptyEl.style.display = 'block';
    }

    // ---------------------------
    // 3. 전체 배지 상태 업데이트
    // ---------------------------
    const badge = document.getElementById('statusBadge');
    if(badge) {
        badge.className = 'status-badge';
        if (isQualDone && isQuanDone) { 
            badge.classList.add('complete'); 
            badge.innerText = "분석 준비 완료"; 
        } else if (isQualDone || isQuanDone) { 
            badge.classList.add('partial'); 
            badge.innerText = "데이터 부족"; 
        } else { 
            badge.classList.add('incomplete'); 
            badge.innerText = "시작 필요"; 
        }
    }
}

async function fetchUnivData() {
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_univ_list_only', userId: userId }) 
        });
        if (!response.ok) throw new Error(`서버 응답 오류`);
        const data = await response.json();
        
        univData = Array.isArray(data) ? data : (data.univs || []); 
        univMap = {};
        univData.forEach(item => { 
            univMap[item.univName] = item.majors.map(m => ({ name: m })); 
        });
    } catch (e) { console.error("대학 데이터 로드 실패:", e); }
}

function buildUnivMap() {
    // 필요 시 계열 구분 로직 추가
}

// ============================================================
// [UI 동작] 탭 전환
// ============================================================
function openSolution(type) {
    if (currentUserTier === 'free') { 
        alert("유료 회원만 이용 가능합니다."); 
        return; 
    }
    
    // 모든 콘텐츠 숨기기
    document.querySelectorAll('.sol-content').forEach(el => el.style.display = 'none');
    
    // 선택된 콘텐츠 보이기
    const targetContent = document.getElementById(`sol-${type}`);
    if (targetContent) targetContent.style.display = 'block';

    // 메뉴 버튼 활성화 상태 변경
    document.querySelectorAll('.solution-menu .sol-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(`'${type}'`)) {
            btn.classList.add('active');
        }
    });

    // 시뮬레이션 탭 진입 시 초기화
    if (type === 'sim') {
        initSimulation();
    }
}

// ============================================================
// [기능 1] 목표대학 설정
// ============================================================
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
            
            // 2주 락 체크
            if (savedData.date) {
                const savedDate = new Date(savedData.date);
                const unlockDate = new Date(savedDate);
                unlockDate.setDate(unlockDate.getDate() + 14);
                if (now < unlockDate) { 
                    isLocked = true; 
                    dateMsg = `🔒 ${unlockDate.getMonth()+1}월 ${unlockDate.getDate()}일 이후 수정 가능`; 
                }
            }
            
            const btnText = (savedData.univ && savedData.major) 
                ? `<strong>${savedData.univ}</strong><br><small>${savedData.major}</small>` 
                : `<span class="placeholder">대학 및 학과를 선택하세요</span>`;
            
            const clickHandler = isLocked ? '' : `openUnivSelectModal(${i})`;
            const disabledAttr = isLocked ? 'disabled' : '';
            const cursorStyle = isLocked ? 'background-color:#f3f4f6; cursor:not-allowed;' : '';
            const iconHtml = isLocked ? '<i class="fas fa-lock" style="color:#ef4444;"></i>' : '<i class="fas fa-chevron-right"></i>';
            const msgHtml = isLocked ? `<span class="slot-msg">${dateMsg}</span>` : '';

            slotDiv.innerHTML = `
                <label>지망 ${i+1}</label>
                <button type="button" class="univ-select-btn" onclick="${clickHandler}" ${disabledAttr} style="${cursorStyle}">
                    <div>${btnText}</div>
                    ${iconHtml}
                </button>
                ${msgHtml}
            `;
            grid.appendChild(slotDiv);
        } else {
            let requiredTier = (i < 5) ? 'Standard' : 'PRO/BLACK';
            slotDiv.className = 'univ-slot locked-tier';
            slotDiv.setAttribute('data-msg', `${requiredTier} 이상`);
            grid.appendChild(slotDiv);
        }
    }
}

// 대학 선택 모달 열기
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

// 1단계: 대학 목록 표시
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

// 2단계: 학과 목록 표시
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

// 선택 완료
function selectComplete(univ, major) {
    if (currentSlotIndex !== null) {
        // 날짜는 저장 시점에 갱신
        userTargetUnivs[currentSlotIndex] = { univ: univ, major: major, date: null };
        initUnivGrid(); 
        updateAnalysisUI(); 
    }
    closeUnivModal();
}

// 설정 저장 (2주 락 적용)
async function saveTargetUnivs() {
    if(!confirm("저장하면 2주 동안 수정할 수 없습니다.\n정말 저장하시겠습니까?")) return;
    
    const newUnivs = [...userTargetUnivs]; 
    const nowISO = new Date().toISOString();
    const tierLimits = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 };
    const limit = tierLimits[currentUserTier] || 2;
    
    // 데이터 정리 (빈 슬롯 null 처리)
    while(newUnivs.length < 8) newUnivs.push(null);
    for(let i=0; i<limit; i++) {
        const currentData = userTargetUnivs[i];
        if (currentData && currentData.univ && currentData.major) { 
            // 이미 날짜가 있으면 유지, 없으면 현재 시간 기록
            if (!currentData.date) currentData.date = nowISO; 
        } else { 
            userTargetUnivs[i] = null; 
        }
    }
    
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); 
    
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_target_univs', userId: userId, data: userTargetUnivs })
        });
        if(response.ok) { 
            alert("저장되었습니다."); 
            location.reload(); 
        } else { 
            throw new Error("저장 실패"); 
        }
    } catch(e) { 
        console.error(e); 
        alert("통신 오류 발생"); 
    }
}

// ============================================================
// [기능 2] 목표대학 분석 리포트
// ============================================================
async function updateAnalysisUI() {
    const container = document.getElementById('univAnalysisResult');
    if (!container) return;
    
    const hasTargets = userTargetUnivs && userTargetUnivs.some(u => u && u.univ);
    const availableExams = userQuantData ? Object.keys(userQuantData).filter(key => {
        const data = userQuantData[key];
        return data && (data.kor || data.math || data.eng);
    }) : [];

    if (!hasTargets || availableExams.length === 0) { 
        container.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:40px; color:#64748b; background:#f8fafc; border-radius:12px;">
                <i class="fas fa-exclamation-circle fa-2x" style="margin-bottom:10px; color:#94a3b8;"></i><br>
                목표 대학을 설정하고 성적표를 입력해주세요.
            </div>`; 
        return; 
    }
    
    // 기본 시험 모드 설정
    if (!currentExamMode || !availableExams.includes(currentExamMode)) {
        if (availableExams.includes('csat')) currentExamMode = 'csat';
        else currentExamMode = availableExams[0];
    }

    // 컨트롤 UI 렌더링
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
        <div id="analysisCardsContainer">
             <div style="padding:60px; text-align:center; color:#3b82f6;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top:15px; font-weight:600;">${EXAM_DISPLAY_NAMES[currentExamMode]} 기준으로<br>분석 중입니다...</p>
            </div>
        </div>
    `;
    container.innerHTML = selectorHTML;
    
    const cardsContainer = document.getElementById('analysisCardsContainer');
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const currentScoreData = userQuantData[currentExamMode];

    try {
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
        
        if (results.length === 0) {
            cardsContainer.innerHTML = `<div style="text-align:center; padding:40px;">분석 가능한 결과가 없습니다.</div>`;
        } else {
            cardsContainer.innerHTML = results.map(item => renderAnalysisCard(item)).join('');
        }
    } catch (e) {
        console.error(e);
        cardsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444;">분석 중 오류가 발생했습니다.</div>`;
    }
}

function changeExamMode(mode) {
    currentExamMode = mode;
    updateAnalysisUI();
}

function renderAnalysisCard(res) {
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

    const badgeStyle = `background:${res.color}15; color:${res.color}; border:1px solid ${res.color};`; 
    const scoreStyle = `color:${res.color}; font-weight:800; font-size:1.5rem;`;

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
                        <span style="position:absolute; left:40%; bottom:0; transform:translateX(-50%); color:#64748b; font-weight:600; white-space:nowrap;">합격(100)</span>
                        <span style="position:absolute; left:60%; bottom:0; transform:translateX(-50%); color:#64748b; font-weight:600; white-space:nowrap;">안정(150)</span>
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

function getSimpleAdvice(score, status) {
    if (score >= 140) return `<strong>👑 최초 합격 / 장학금 유력</strong> 구간입니다. 더 높은 대학을 과감하게 상향 지원해보는 전략이 필요합니다.`;
    if (score >= 125) return `<strong>매우 안정 (최초합 유력)</strong>입니다. 이 대학을 보험으로 두고 상향 지원 전략을 짜세요.`;
    if (score >= 112) return `<strong>합격 가능성이 높습니다. (안정)</strong> 무난한 합격이 예상됩니다.`;
    if (score >= 100) return `<strong>적정 지원 (추합권)</strong>입니다. 추가 합격 가능성이 높으며 경쟁률 변화를 주시해야 합니다.`;
    if (score >= 87) return `<strong>소신 지원 (문 닫고 입학)</strong> 전략입니다. 불합격 리스크를 감수해야 합니다.`;
    if (score >= 75) return `<strong>상향 지원 (위험)</strong>입니다. 반드시 다른 군에 확실한 안정 카드를 확보하세요.`;
    return `<strong>지원 불가 / 초고위험</strong> 구간입니다. 눈높이를 낮추거나 전형을 변경하는 것을 권장합니다.`;
}

// ============================================================
// [기능 3] 점수 상승 시뮬레이션
// ============================================================
function initSimulation() {
    const listContainer = document.getElementById('simUnivList');
    if (!listContainer) return;

    const validTargets = userTargetUnivs ? userTargetUnivs.filter(t => t && t.univ) : [];

    if (validTargets.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:30px;"><p style="font-size:0.9rem;">목표 대학을 먼저 설정해주세요.</p></div>`;
        return;
    }

    listContainer.innerHTML = validTargets.map((t, i) => `
        <label style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:8px; cursor:pointer; margin-bottom:8px;">
            <input type="checkbox" class="sim-univ-check" value="${i}" checked onchange="runSimulationRender()" style="accent-color:#3b82f6;">
            <div style="font-size:0.9rem; font-weight:700;">${t.univ} <span style="font-weight:normal; font-size:0.8rem;">${t.major}</span></div>
        </label>
    `).join('');

    fetchSimulationData();
}

let cachedSimData = [];

async function fetchSimulationData() {
    const chartArea = document.getElementById('simChartBars');
    chartArea.innerHTML = '<div style="width:100%; text-align:center; padding-top:80px;"><i class="fas fa-spinner fa-spin"></i> 분석 중...</div>';
    
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const scoreData = userQuantData[currentExamMode];
    
    try {
        const res = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'simulate_score_rise', 
                userId, 
                targetUnivs: userTargetUnivs, 
                userScores: scoreData, 
                examMode: currentExamMode 
            })
        });
        cachedSimData = await res.json();
        runSimulationRender();
    } catch (e) { 
        chartArea.innerHTML = '오류 발생'; 
        console.error(e);
    }
}

function runSimulationRender() {
    const checkboxes = document.querySelectorAll('.sim-univ-check:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    const filteredData = cachedSimData.filter(d => {
        return selectedIndices.some(idx => {
            const target = userTargetUnivs[idx];
            // 대학명과 학과명으로 매칭
            return target.univ === d.univ && target.major === d.major;
        });
    });
    
    renderSimChart(filteredData);
    renderSimCards(filteredData);
}

function renderSimChart(data) {
    const container = document.getElementById('simChartBars');
    container.style.overflow = 'visible'; 
    container.parentElement.style.overflow = 'visible'; 
    container.parentElement.parentElement.style.paddingBottom = '60px'; 
    container.innerHTML = '';

    const shortName = (name) => name.replace('학교', '');

    data.forEach(item => {
        const heightPct = (item.base_ui_score / 250) * 100;
        let color = '#ef4444'; 
        if (item.base_ui_score >= 150) color = '#10b981'; 
        else if (item.base_ui_score >= 100) color = '#3b82f6';

        const html = `
            <div style="position:relative; width:60px; height:100%; margin: 0 8px;">
                <div style="position:absolute; bottom:0; left:0; width:100%; height:${Math.min(heightPct, 100)}%; background:${color}; border-radius:6px 6px 0 0; transition: height 0.5s; min-height:4px; z-index:1;">
                    <span style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); font-size:0.85rem; font-weight:800; color:${color}; white-space:nowrap;">
                        ${Math.round(item.base_ui_score)}
                    </span>
                </div>
                <div style="position:absolute; top:100%; left:50%; transform:translateX(-50%); width:80px; text-align:center; padding-top:8px; z-index:2;">
                    <div style="font-size:0.85rem; font-weight:700; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${shortName(item.univ)}</div>
                    <div style="font-size:0.75rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${item.major}</div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderSimCards(data) {
    const container = document.getElementById('simCardArea');
    container.innerHTML = '';

    data.forEach(item => {
        let bestSubj = '';
        let maxRise = -1;
        ['kor', 'math', 'inq1', 'inq2'].forEach(k => {
            if (item.sim_data[k] && item.sim_data[k].diff > maxRise) {
                maxRise = item.sim_data[k].diff;
                bestSubj = k;
            }
        });

        const cardHtml = `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                <div style="font-weight:bold; color:#334155; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
                    ${item.univ} <span style="font-weight:normal; font-size:0.85rem; color:#64748b;">${item.major}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${['kor', 'math', 'inq1', 'inq2'].map(subj => {
                        const info = item.sim_data[subj];
                        if (!info) return ''; 
                        const isInactive = (info.msg === "응시 안 함" || info.msg === "변동 없음 (반영X)");
                        const isBest = (subj === bestSubj && info.diff > 0);
                        const rowBg = isBest ? '#eff6ff' : (isInactive ? '#f8fafc' : 'transparent');
                        const nameColor = isInactive ? '#cbd5e1' : '#475569';
                        const scoreColor = info.diff > 0 ? '#ef4444' : (isInactive ? '#cbd5e1' : '#94a3b8');
                        const displayName = info.name || (subj.includes('inq') ? '탐구' : subj);

                        return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px; background:${rowBg}; border-radius:6px;">
                            <div style="display:flex; align-items:center; gap:5px;">
                                <span style="font-size:0.9rem; font-weight:600; color:${nameColor}; width:70px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${displayName}</span>
                                ${isBest ? '<span style="font-size:0.7rem; background:#3b82f6; color:#fff; padding:1px 4px; border-radius:3px;">추천</span>' : ''}
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.9rem; font-weight:bold; color:${scoreColor};">${info.msg.replace('점 상승', '')} ${info.diff > 0 ? '▲' : ''}</div>
                                ${info.diff > 0 ? `<div style="font-size:0.7rem; color:#94a3b8;">(변환전 +${info.diff.toFixed(2)})</div>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        container.innerHTML += cardHtml;
    });
}

// ============================================================
// [기능 4] 코칭 & 주간 학습 점검
// ============================================================
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

function checkWeeklyStatus() {
    const today = new Date();
    const currentWeekTitle = getWeekTitle(today); 
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    const thisWeekData = history.find(w => { 
        if(!w.title) return false; 
        return w.title.replace(/\s+/g, '').includes(currentWeekTitle.replace(/\s+/g, '')); 
    });
    
    const badge = document.getElementById('weeklyStatusBadge');
    const msg = document.getElementById('weeklyDeadlineMsg');
    const box = document.getElementById('weeklyBox');
    
    if (!badge || !box || !msg) return;
    
    if (thisWeekData) { 
        badge.className = 'badge-status submitted'; 
        badge.innerText = '✅ 제출완료'; 
    } else { 
        badge.className = 'badge-status pending'; 
        badge.innerText = '미제출'; 
    }
    
    const day = today.getDay(); const hour = today.getHours();
    if (day === 0 && hour >= 20) { 
        badge.className = 'badge-status locked'; 
        badge.innerText = '⛔ 마감됨'; 
        msg.style.color = '#ef4444'; 
        msg.innerText = "수정 불가 (매주 일요일 20시 마감)"; 
        box.classList.add('disabled'); 
        box.onclick = null; 
        box.setAttribute('onclick', ''); 
    } else { 
        msg.style.color = '#64748b'; 
        msg.innerText = "※ 일요일 20:00 마감"; 
        box.classList.remove('disabled'); 
        box.onclick = openWeeklyCheckModal; 
    }
}

function openWeeklyCheckModal() {
    const today = new Date();
    if (today.getDay() === 0 && today.getHours() >= 20) { 
        alert("금주 학습 점검 제출이 마감되었습니다."); 
        return; 
    }
    
    const modal = document.getElementById('weeklyCheckModal');
    const currentWeekTitle = getWeekTitle(today); 
    const [yStr, mStr, wStr] = currentWeekTitle.split(' '); 
    document.getElementById('weeklyYear').innerText = yStr; 
    document.getElementById('weeklyDateDetail').innerText = `${mStr} ${wStr}`;
    
    const thisWeekData = weeklyDataHistory.find(w => w.title && w.title.replace(/\s/g, '') === currentWeekTitle.replace(/\s/g, ''));
    
    if (thisWeekData) loadWeeklyDataToForm(thisWeekData); 
    else resetWeeklyForm(); 
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeWeeklyModal() {
    document.getElementById('weeklyCheckModal').style.display = 'none';
    document.body.style.overflow = 'auto';
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

// 플래너 파일 핸들링
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
            } catch (e) { fileName = file; }
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

// 주간 점검 제출 (파일 S3 업로드 + DB 저장)
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
    const token = localStorage.getItem('idToken'); 
    const submitBtn = document.querySelector('.save-btn');
    const originalBtnText = submitBtn.innerText;

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "데이터 처리 중...";

        // 1. 기존 파일 삭제 처리
        const currentUrls = currentPlannerFiles.filter(f => typeof f === 'string');
        const filesToDelete = originalPlannerFiles.filter(url => !currentUrls.includes(url));

        if (filesToDelete.length > 0) {
            submitBtn.innerText = "기존 파일 삭제 중...";
            await Promise.all(filesToDelete.map(url => 
                fetch(MYPAGE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ type: 'delete_s3_file', userId: userId, data: { fileUrl: url } })
                })
            ));
        }

        // 2. 새 파일 업로드 처리
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

// 심층 코칭 (Pro/Black)
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
    const token = localStorage.getItem('idToken'); 
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
    if (['pro'].includes(currentUserTier)) { if(lockOverlay) lockOverlay.style.display = 'none'; } 
    else { if(lockOverlay) lockOverlay.style.display = 'flex'; }
}

// ============================================================
// [기능 5] BLACK 전용 버튼
// ============================================================
function checkBlackStatusForButton() {
    const btn = document.getElementById('btnBlackAction');
    if (btn && currentUserTier === 'black') {
        btn.onclick = function() {
            window.location.href = '/black';
        };
        btn.innerHTML = `
            👑 BLACK LOUNGE 입장하기
            <span style="display:block; font-size:0.9rem; margin-top:5px; color:#555;">
                (💡Tip: 메인화면 우측 하단 버튼으로도 바로 접속 가능합니다)
            </span>
        `;
        btn.style.background = "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)"; 
    }
}

// ============================================================
// [유틸리티] 날짜/주차 계산 등
// ============================================================
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
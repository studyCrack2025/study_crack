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

const SUBJECT_CODE_MAP = {
    // 국어
    'un': '언매', 'hj': '화작',
    // 수학
    'mi': '미적', 'ki': '기하', 'hw': '확통',
    // 탐구는 보통 이름이 직접 들어오지만 코드로 올 경우를 대비해 필요시 추가
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
        checkBlackStatusForButton();
        
        setWeeklyLoadingStatus(false);
        setTimeout(() => { 
            checkWeeklyStatus();
            applyCoachTierLock();
        }, 500); 
        
        const loader = document.getElementById('pageLoadingOverlay');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('hidden');
            }, 500);
        }

        // URL 파라미터 확인 (?sol=sim 등)
        const params = new URLSearchParams(window.location.search);
        const sol = params.get('sol');
        if (sol) { 
            setTimeout(() => openSolution(sol), 100); 
        }
    });
});

// [보안] XSS 방지용 이스케이프 함수
function escapeHtml(text) {
    if (text == null) return ""; // null 또는 undefined 처리
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// [유틸] DynamoDB JSON 파서
function parseDynamoItem(item) {
    if (item === undefined || item === null) return null;
    if (typeof item !== 'object') return item;

    // [🔥 핵심 수정] 배열이 들어오면 객체로 변환하지 말고 배열 그대로 매핑해서 반환
    if (Array.isArray(item)) {
        return item.map(parseDynamoItem);
    }

    // 1. DynamoDB 타입별 처리
    if (item.S !== undefined) return item.S;
    if (item.N !== undefined) return Number(item.N);
    if (item.BOOL !== undefined) return item.BOOL;
    if (item.NULL === true) return null;
    
    // 2. 리스트 (L)
    if (item.L !== undefined) {
        if (Array.isArray(item.L)) return item.L.map(parseDynamoItem);
        return [];
    }
    
    // 3. 맵 (M)
    if (item.M !== undefined) {
        const obj = {};
        for (const key in item.M) {
            obj[key] = parseDynamoItem(item.M[key]);
        }
        return obj;
    }
    
    // 4. 일반 객체 재귀 탐색 (Fallback)
    const obj = {};
    for (const key in item) {
        obj[key] = parseDynamoItem(item[key]);
    }
    return obj;
}

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
        
        if (response.status === 401) {
            alert("세션이 만료되었습니다. 다시 로그인해주세요.");
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) throw new Error("사용자 데이터 로드 실패");
        
        // [중요] DB 데이터 파싱
        const rawData = await response.json();
        const data = parseDynamoItem(rawData);
        
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
            if (imgElem) imgElem.src = escapeHtml(data.profileImage); // URL도 이스케이프
        }
    } catch (error) { 
        console.error("User Data Error:", error); 
        if(error.message.includes("401")) { location.href='/login'; }
    }
}

function renderUserInfo(data) {
    const nameEl = document.getElementById('userNameDisplay');
    const emailEl = document.getElementById('userEmailDisplay');
    
    // innerText는 자동 이스케이프되지만 명시적으로 처리해도 무방
    if(nameEl) nameEl.innerText = data.name || '이름 없음';
    if(emailEl) emailEl.innerText = data.email || '';
}

function applyUserTier(tier) {
    currentUserTier = tier;
}

function updateSurveyStatus(data) {
    // ---------------------------
    // 1. 정성 데이터 (Qualitative)
    // ---------------------------
    const qual = data.qualitative;
    const isQualDone = !!qual; 

    const qualStatusEl = document.getElementById('qualStatus');
    const qualGradeRow = document.getElementById('qualGradeRow');
    const qualStreamRow = document.getElementById('qualStreamRow');
    const qualTargetRow = document.getElementById('qualTargetRow');
    
    if (isQualDone) {
        qualStatusEl.innerHTML = '<span style="color:#166534; font-weight:bold;">✅ 작성완료</span>';
        
        // (1) 학년
        const statusVal = qual.status || '';
        if (statusVal) {
            document.getElementById('qualGrade').innerText = statusVal;
            qualGradeRow.style.display = 'flex';
        } else { qualGradeRow.style.display = 'none'; }

        // (2) 계열
        const groupMap = { 'humanities': '인문', 'natural': '자연', 'nature': '자연', 'arts': '예체능', 'undefined': '미정' };
        const groupKey = qual.stream || 'undefined';
        document.getElementById('qualStream').innerText = groupMap[groupKey] || groupKey;
        qualStreamRow.style.display = 'flex';

        // (3) 목표 대학 (1, 2지망 분리 표시)
        let targets = [];
        if (Array.isArray(qual.targets)) {
            targets = qual.targets.filter(t => t && t.trim() !== "");
        }
        // Fallback
        if (targets.length === 0 && data.targetUnivs) {
            data.targetUnivs.forEach(t => { if(t && t.univ) targets.push(t.univ); });
        }

        const targetContainer = document.getElementById('qualTargetContainer');
        targetContainer.innerHTML = ''; // 초기화

        if (targets.length > 0) {
            // 중복 제거 후 최대 2개
            const uniqueTargets = [...new Set(targets)].slice(0, 2);
            
            let targetHtml = '';
            if (uniqueTargets[0]) {
                targetHtml += `<div class="target-row"><span class="target-badge first">1지망</span> ${escapeHtml(uniqueTargets[0])}</div>`;
            }
            if (uniqueTargets[1]) {
                targetHtml += `<div class="target-row"><span class="target-badge second">2지망</span> ${escapeHtml(uniqueTargets[1])}</div>`;
            }
            targetContainer.innerHTML = targetHtml;
            qualTargetRow.style.display = 'flex';
        } else {
            qualTargetRow.style.display = 'none';
        }

    } else {
        qualStatusEl.innerHTML = '<span style="color:#991b1b; font-weight:bold;">❌ 미작성</span>';
        qualGradeRow.style.display = 'none';
        qualStreamRow.style.display = 'none';
        qualTargetRow.style.display = 'none';
    }

    // ---------------------------
    // 2. 정량 데이터 (Quantitative) - 드롭다운 방식
    // ---------------------------
    const quan = data.quantitative;
    const validExams = [];
    
    // 데이터가 존재하는 시험 찾기
    if (quan) {
        Object.keys(quan).forEach(key => {
            const d = quan[key];
            if (d && (d.kor || d.math || d.eng)) validExams.push(key);
        });
    }
    
    const isQuanDone = validExams.length > 0;
    
    // 요소 가져오기
    const quanEmptyEl = document.getElementById('quanEmpty');
    const quanContentBox = document.getElementById('quanContentBox');
    const selector = document.getElementById('sideQuanSelector');
    const detailBox = document.getElementById('sideQuanDetail');

    if (isQuanDone) {
        quanEmptyEl.style.display = 'none';
        quanContentBox.style.display = 'block';

        // 1. 최신순 정렬 (수능 -> 3월)
        const sortOrder = ['mar', 'apr', 'may', 'jun', 'jul', 'sep', 'oct', 'csat'];
        validExams.sort((a, b) => sortOrder.indexOf(b) - sortOrder.indexOf(a));

        // 2. 드롭다운 옵션 생성
        selector.innerHTML = validExams.map(key => {
            const name = EXAM_DISPLAY_NAMES[key] || key.toUpperCase();
            return `<option value="${key}">${name}</option>`;
        }).join('');

        // 3. 상세 점수 렌더링 함수 (내부 함수)
        const renderSideScore = (examKey) => {
            const d = quan[examKey];
            if (!d) return;

            // 행 렌더링 헬퍼
            const makeRow = (label, obj) => {
                if (!obj) return ''; // 데이터 없으면 빈 문자열

                // 선택과목명
                let optText = '';
                if (obj.opt) optText = `<span class="opt-badge">(${SUBJECT_CODE_MAP[obj.opt] || obj.opt})</span>`;
                else if (obj.name) optText = `<span class="opt-badge">(${obj.name})</span>`;

                // 점수 데이터
                const std = obj.std || '-';
                const pct = obj.pct ? obj.pct + '%' : '-';
                const grd = obj.grd ? `<span class="grade-circle">${obj.grd}</span>` : '';

                // 영어/한국사는 등급만
                let valStr = '';
                if (label === '영어' || label === '한국사') {
                    valStr = grd; 
                } else {
                    valStr = `${std} / ${pct} ${grd}`;
                }

                return `
                    <tr>
                        <td class="subj-label">${label}</td>
                        <td class="score-info">
                            ${optText} ${valStr}
                        </td>
                    </tr>
                `;
            };

            // 테이블 조립
            let html = '<table class="side-score-table">';
            html += makeRow('국어', d.kor);
            html += makeRow('수학', d.math);
            html += makeRow('영어', d.eng);
            html += makeRow('탐구1', d.inq1);
            html += makeRow('탐구2', d.inq2);
            html += '</table>';

            detailBox.innerHTML = html;
        };

        // 4. 초기 렌더링 (가장 최신 시험)
        renderSideScore(validExams[0]);

        // 5. 이벤트 리스너 (변경 시 렌더링)
        selector.onchange = (e) => {
            renderSideScore(e.target.value);
        };

    } else {
        quanEmptyEl.style.display = 'block';
        quanContentBox.style.display = 'none';
    }

    // 상태 배지 업데이트
    const badge = document.getElementById('statusBadge');
    if(badge) {
        badge.className = 'status-badge';
        if (isQualDone && isQuanDone) { 
            badge.classList.add('complete'); badge.innerText = "분석 준비 완료"; 
        } else if (isQualDone || isQuanDone) { 
            badge.classList.add('partial'); badge.innerText = "데이터 부족"; 
        } else { 
            badge.classList.add('incomplete'); badge.innerText = "시작 필요"; 
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

function buildUnivMap() {}

// ============================================================
// [UI 동작] 탭 전환
// ============================================================
function openSolution(type) {
    if (currentUserTier === 'free') { 
        alert("유료 회원만 이용 가능합니다."); 
        return; 
    }
    
    document.querySelectorAll('.sol-content').forEach(el => el.style.display = 'none');
    const targetContent = document.getElementById(`sol-${type}`);
    if (targetContent) targetContent.style.display = 'block';

    document.querySelectorAll('.solution-menu .sol-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(`'${type}'`)) {
            btn.classList.add('active');
        }
    });

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
            
            if (savedData.date) {
                const savedDate = new Date(savedData.date);
                const unlockDate = new Date(savedDate);
                unlockDate.setDate(unlockDate.getDate() + 14);
                if (now < unlockDate) { 
                    isLocked = true; 
                    dateMsg = `🔒 ${unlockDate.getMonth()+1}월 ${unlockDate.getDate()}일 이후 수정 가능`; 
                }
            }
            
            // [보안] 대학명/학과명 이스케이프 적용
            const safeUniv = escapeHtml(savedData.univ);
            const safeMajor = escapeHtml(savedData.major);

            const btnText = (savedData.univ && savedData.major) 
                ? `<strong>${safeUniv}</strong><br><small>${safeMajor}</small>` 
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
        item.innerText = univName; // innerText는 자동 이스케이프
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
        initUnivGrid(); 
        updateAnalysisUI(); 
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
        if (currentData && currentData.univ && currentData.major) { 
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
    
    if (!currentExamMode || !availableExams.includes(currentExamMode)) {
        if (availableExams.includes('csat')) currentExamMode = 'csat';
        else currentExamMode = availableExams[0];
    }

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
                <h4 style="margin:0;">${escapeHtml(res.idx + 1)}지망: ${escapeHtml(res.univ)} <small style="color:#64748b;">${escapeHtml(res.major)}</small></h4>
                <span style="background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:4px; font-size:0.8rem; margin-top:5px; display:inline-block;">데이터 부족</span>
            </div>
            <p style="color:#64748b; font-size:0.9rem; margin:0;">${escapeHtml(res.msg || '해당 학과의 작년 입시 데이터가 없습니다.')}</p>
        </div>`;
    }

    const badgeStyle = `background:${res.color}15; color:${res.color}; border:1px solid ${res.color};`; 
    const scoreStyle = `color:${res.color}; font-weight:800; font-size:1.5rem;`;

    // [보안] 변수 이스케이프 처리
    const safeIdx = escapeHtml(res.idx + 1);
    const safeUniv = escapeHtml(res.univ);
    const safeMajor = escapeHtml(res.major);
    const safeStatus = escapeHtml(res.status);
    const safeMsg = escapeHtml(res.msg);
    const safeScore = escapeHtml(res.converted_score);

    // [모바일 대응] 화면 너비 768px 이하 확인
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    // 모바일일 경우 텍스트 위치 조정 (지그재그 배치)
    const labelStyle = "position:absolute; bottom:0; transform:translateX(-50%); color:#64748b; font-weight:600; white-space:nowrap;";
    
    // 모바일에서는 '합격(100)'을 위로 올림 (bottom: 12px)
    const passLabelStyle = isMobile 
        ? `${labelStyle} bottom: 12px;` 
        : labelStyle;
    
    // '안정(120)'은 그대로 둠
    const stableLabelStyle = labelStyle; 

    return `
    <div class="analysis-card" style="margin-bottom:20px; background:#fff; border-radius:12px; padding:25px; box-shadow:0 4px 10px rgba(0, 0, 0, 0.05); border-left: 6px solid ${res.color}; transition: transform 0.2s;">
        <div class="analysis-header" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #f1f5f9; padding-bottom:15px; margin-bottom:15px;">
            <div>
                <span style="color:#64748b; font-size:1.1rem; font-weight:800; display:block; margin-bottom:5px;">${safeIdx}지망</span>
                <h4 style="margin:0; font-size:1.2rem; color:#1e293b; letter-spacing:-0.5px;">${safeUniv}</h4>
                <div style="color:#64748b; font-size:0.95rem; margin-top:2px;">${safeMajor}</div>
            </div>
            <div style="text-align:right;">
                <span style="${badgeStyle} padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:bold; display:inline-block; margin-bottom:5px;">
                    ${safeStatus}
                </span>
                <div style="font-size:0.8rem; color:${res.color}; font-weight:600;">${safeMsg}</div>
            </div>
        </div>

        <div class="analysis-body" style="display:grid; grid-template-columns: 1fr; gap:25px;">
            <div class="score-section">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                    <span style="font-size:0.95rem; color:#475569; font-weight:600;">AI 환산 진단점수</span>
                    <span style="${scoreStyle}">${safeScore}<span style="font-size:1rem; font-weight:normal; margin-left:2px; color:#64748b;">점</span></span>
                </div>
                
                <div style="position:relative; width:100%; padding-bottom:30px;">
                    <div style="position:relative; height:12px; background:#f1f5f9; border-radius:6px; margin:10px 0; overflow:hidden;">
                        <div style="position:absolute; left:50%; top:0; bottom:0; width:2px; background:#fff; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                        <div style="position:absolute; left:60%; top:0; bottom:0; width:2px; background:#fff; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                        <div style="position:absolute; left:0; top:0; height:100%; width:${Math.min((res.converted_score / 200) * 100, 100)}%; background:${res.color}; border-radius:6px; transition: width 1s ease-out; z-index:1;"></div>
                    </div>
                    
                    <div style="font-size:0.75rem; color:#94a3b8; height:25px; position: relative;">
                        <span style="position:absolute; left:0; bottom:0;">0</span>
                        
                        <span style="${passLabelStyle} left:50%;">
                            합격(100)
                            ${isMobile ? '<div style="height:8px; border-left:1px solid #cbd5e1; margin:0 auto;"></div>' : ''} 
                        </span>
                        
                        <span style="${stableLabelStyle} left:60%;">안정(120)</span>
                        
                        <span style="position:absolute; right:0; bottom:0;">MAX(200)</span>
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
    if (score >= 145) return `<strong>👑 최초 합격 / 장학금 유력</strong> 구간입니다. 더 높은 대학을 과감하게 상향 지원해보는 전략이 필요합니다.`;
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
            <div style="font-size:0.9rem; font-weight:700;">
                ${escapeHtml(t.univ)} <span style="font-weight:normal; font-size:0.8rem;">${escapeHtml(t.major)}</span>
            </div>
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
        const heightPct = (item.base_ui_score / 200) * 100;
        let color = '#ef4444'; 
        if (item.base_ui_score >= 120) color = '#10b981'; 
        else if (item.base_ui_score >= 100) color = '#3b82f6';

        // [보안] 이스케이프 적용
        const safeUniv = escapeHtml(shortName(item.univ));
        const safeMajor = escapeHtml(item.major);
        const safeScore = escapeHtml(Math.round(item.base_ui_score));

        const html = `
            <div style="position:relative; width:60px; height:100%; margin: 0 8px;">
                <div style="position:absolute; bottom:0; left:0; width:100%; height:${Math.min(heightPct, 100)}%; background:${color}; border-radius:6px 6px 0 0; transition: height 0.5s; min-height:4px; z-index:1;">
                    <span style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); font-size:0.85rem; font-weight:800; color:${color}; white-space:nowrap;">
                        ${safeScore}
                    </span>
                </div>
                <div style="position:absolute; top:100%; left:50%; transform:translateX(-50%); width:80px; text-align:center; padding-top:8px; z-index:2;">
                    <div style="font-size:0.85rem; font-weight:700; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeUniv}</div>
                    <div style="font-size:0.75rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${safeMajor}</div>
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

        // [보안] 이스케이프
        const safeUniv = escapeHtml(item.univ);
        const safeMajor = escapeHtml(item.major);

        const cardHtml = `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                <div style="font-weight:bold; color:#334155; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
                    ${safeUniv} <span style="font-weight:normal; font-size:0.85rem; color:#64748b;">${safeMajor}</span>
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

                        // [보안] 내부 데이터 이스케이프
                        const safeName = escapeHtml(displayName);
                        const safeMsg = escapeHtml(info.msg.replace('점 상승', ''));
                        const safeDiff = info.diff > 0 ? `(변환전 +${info.diff.toFixed(2)})` : '';

                        return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px; background:${rowBg}; border-radius:6px;">
                            <div style="display:flex; align-items:center; gap:5px;">
                                <span style="font-size:0.9rem; font-weight:600; color:${nameColor}; width:70px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeName}</span>
                                ${isBest ? '<span style="font-size:0.7rem; background:#3b82f6; color:#fff; padding:1px 4px; border-radius:3px;">추천</span>' : ''}
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.9rem; font-weight:bold; color:${scoreColor};">${safeMsg} ${info.diff > 0 ? '▲' : ''}</div>
                                <div style="font-size:0.7rem; color:#94a3b8;">${safeDiff}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        container.innerHTML += cardHtml;
    });
}

// ============================================================
// [기능 4] 코칭 & 주간 학습 점검 (리팩토링 완료)
// ============================================================

// [유틸리티] 날짜/주차 계산 (필수 Helper)
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

// ------------------------------------------------------------

// 코칭 영역 등급 제한 (Blur 처리)
function applyCoachTierLock() {
    const container = document.querySelector('.coach-container');
    if (!container) return;

    const allowedTiers = ['standard', 'pro', 'black'];

    // [잠금 조건]
    if (!allowedTiers.includes(currentUserTier)) {
        container.classList.add('tier-locked');
        container.style.position = 'relative';

        if (container.querySelector('.tier-lock-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'tier-lock-overlay';
        overlay.innerHTML = `
            <div class="lock-message-box">
                <i class="fas fa-lock"></i>
                <h3>Standard 멤버십 전용</h3>
                <p>
                    주간 학습 점검 및 피드백 기능은<br>
                    <strong>Standard 등급 이상</strong>부터 이용 가능합니다.
                </p>
            </div>
        `;
        container.appendChild(overlay);
        
    } else {
        // [해제 조건]
        container.classList.remove('tier-locked');
        const existingOverlay = container.querySelector('.tier-lock-overlay');
        if (existingOverlay) existingOverlay.remove();
    }
}

// 탭 전환 로직
function switchWeeklyTab(step) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if(step === 'step1') document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
    else document.querySelector('.tab-btn:nth-child(2)').classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${step}`).classList.add('active');
}

function setWeeklyLoadingStatus(isLoading) {
    const msg = document.getElementById('weeklyDeadlineMsg');
    const badge = document.getElementById('weeklyStatusBadge');
    if (!msg || !badge) return;
    
    if (isLoading) {
        badge.innerText = '...'; badge.className = 'badge-status pending'; 
        msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 로딩중...';
    } else {
        msg.innerText = '(매주 일요일 20:00 마감)';
        renderFeedbackList(); // 로딩 완료 후 피드백 리스트 렌더링
    }
}

function checkWeeklyStatus() {
    const today = new Date();
    const currentWeekTitle = getWeekTitle(today); 
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    
    // 이번 주 데이터 확인
    const thisWeekData = history.find(w => { 
        if(!w.title) return false; 
        return w.title.replace(/\s+/g, '').includes(currentWeekTitle.replace(/\s+/g, '')); 
    });
    
    const badge = document.getElementById('weeklyStatusBadge');
    const box = document.getElementById('weeklyBox');
    
    if (!badge || !box) return;
    
    if (thisWeekData) { 
        badge.className = 'badge-status submitted'; 
        badge.innerText = '✅ 제출완료'; 
    } else { 
        badge.className = 'badge-status pending'; 
        badge.innerText = '미제출'; 
    }
    
    const day = today.getDay(); const hour = today.getHours();
    // 일요일 20시 이후 잠금
    if (day === 0 && hour >= 20) { 
        badge.className = 'badge-status locked'; 
        badge.innerText = '⛔ 마감됨'; 
        box.classList.add('disabled'); 
        box.onclick = null; 
    } else { 
        box.classList.remove('disabled'); 
        box.onclick = openWeeklyCheckModal; 
    }
}

// 주간학습 피드백 리스트 렌더링
function renderFeedbackList() {
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    const listContainer = document.getElementById('feedbackList');
    const select = document.getElementById('feedbackYearMonth');
    
    if(!listContainer || !select) return;

    // 연/월 추출
    const yearMonths = new Set();
    history.forEach(h => {
        const match = h.title.match(/(\d{4}년\s\d{1,2}월)/);
        if(match) yearMonths.add(match[1]);
    });

    // 이번달 추가 (데이터가 없을 경우 대비)
    const today = new Date();
    const currentYM = `${today.getFullYear()}년 ${today.getMonth()+1}월`;
    if(yearMonths.size === 0) yearMonths.add(currentYM);
    
    // Select Box 갱신
    // (사용자가 이미 선택한 값이 있으면 유지하려 노력, 없으면 새로 렌더링)
    const prevValue = select.value;
    select.innerHTML = '';
    
    Array.from(yearMonths).sort().reverse().forEach(ym => {
        const option = document.createElement('option');
        option.value = ym;
        option.innerText = ym;
        select.appendChild(option);
    });
    
    // 이전 선택값 복원 또는 디폴트 설정
    if (prevValue && yearMonths.has(prevValue)) {
        select.value = prevValue;
    } else {
        select.selectedIndex = 0;
    }
    
    const selectedYM = select.value;

    // 리스트 렌더링
    listContainer.innerHTML = '';
    const filtered = history.filter(h => h.title.includes(selectedYM)).sort((a,b) => b.title.localeCompare(a.title));

    if(filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-feedback">제출된 기록이 없습니다.</div>';
        return;
    }

    filtered.forEach(h => {
        const div = document.createElement('div');
        div.className = 'feedback-tile';
        div.onclick = () => { document.getElementById('feedbackModal').style.display='block'; };
        
        div.innerHTML = `
            <div class="fb-title">${h.title}</div>
            <div class="fb-status"><i class="fas fa-check-circle"></i> 피드백 보기</div>
        `;
        listContainer.appendChild(div);
    });
}

function openWeeklyCheckModal() {
    const allowedTiers = ['standard', 'pro', 'black'];
    
    if (!allowedTiers.includes(currentUserTier)) {
        alert("🔒 Standard 멤버십 이상 전용 기능입니다.\n멤버십 업그레이드 후 이용해주세요.");
        return;
    }

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
    
    switchWeeklyTab('step1');
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeWeeklyModal() {
    document.getElementById('weeklyCheckModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 폼 초기화 함수
function resetWeeklyForm() {
    // Step 1: 학습시간 초기화
    document.querySelectorAll('.plan-time, .act-time, .sub-detail, .custom-subj').forEach(i => i.value = '');
    document.querySelectorAll('.rate-txt').forEach(s => s.innerText = '0%');
    document.getElementById('totalPlan').innerText = '0H';
    document.getElementById('totalAct').innerText = '0H';
    document.getElementById('totalRate').innerText = '0%';
    
    // 모의고사 초기화 (ID 기반)
    selectMockType('none', document.querySelector('.mock-tile')); 
    const mockIds = [
        'mockKorScore', 'mockKorOpt',
        'mockMathScore', 'mockMathOpt',
        'mockEngScore',
        'mockInq1Score', 'mockInq1Name',
        'mockInq2Score', 'mockInq2Name'
    ];
    mockIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const fileTxt = document.getElementById('mockFileNameDisplay');
    if(fileTxt) { fileTxt.innerText = '선택된 파일 없음'; fileTxt.style.color = '#94a3b8'; }

    // 트렌드 초기화
    document.getElementById('slumpDetail').value = '';
    document.querySelectorAll('#slumpReasonBox input').forEach(cb => cb.checked = false);
    document.getElementById('slumpReasonBox').style.display = 'none';
    const radios = document.getElementsByName('studyTrend');
    if(radios.length) radios.length > 1 ? radios[1].checked = true : null;
    
    currentPlannerFiles = [];
    renderPlannerFiles();

    // Step 2: 심층 코칭 초기화
    ['deepQ1', 'deepQ2', 'deepQ3', 'deepQ4'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.value = '';
            if(el.nextElementSibling && el.nextElementSibling.classList.contains('char-count')) {
                el.nextElementSibling.querySelector('span').innerText = '0';
            }
        }
    });
}

// --- 헬퍼 함수들 (UI Interaction) ---

function selectMockType(type, element) {
    document.getElementById('mockExamType').value = type;
    document.querySelectorAll('.mock-tile').forEach(tile => tile.classList.remove('selected'));
    element.classList.add('selected');
    toggleMockExamFields();
}

function toggleMockExamFields() {
    const type = document.getElementById('mockExamType').value;
    const fields = document.getElementById('mockExamFields');
    if (type === 'none') fields.style.display = 'none';
    else fields.style.display = 'block';
}

function calcStudyRates() {
    const rows = document.querySelectorAll('#studyTimeBody tr');
    let sumPlan = 0, sumAct = 0;
    
    rows.forEach(row => {
        const planInput = row.querySelector('.plan-time');
        const actInput = row.querySelector('.act-time');
        const rateTxt = row.querySelector('.rate-txt');
        
        if(!planInput || !actInput) return;

        const plan = parseFloat(planInput.value) || 0;
        const act = parseFloat(actInput.value) || 0;
        
        sumPlan += plan; 
        sumAct += act;
        
        if (plan > 0) {
            const rate = Math.min((act / plan) * 100, 100).toFixed(0);
            rateTxt.innerText = `${rate}%`;
            if(rate >= 100) rateTxt.style.color = '#10b981';
            else if(rate >= 80) rateTxt.style.color = '#3b82f6';
            else rateTxt.style.color = '#ef4444';
        } else { 
            rateTxt.innerText = '0%'; 
            rateTxt.style.color = '#94a3b8'; 
        }
    });
    
    document.getElementById('totalPlan').innerText = sumPlan.toFixed(1) + 'H';
    document.getElementById('totalAct').innerText = sumAct.toFixed(1) + 'H';
    
    const totalRate = sumPlan > 0 ? Math.min((sumAct / sumPlan) * 100, 100).toFixed(0) : 0;
    document.getElementById('totalRate').innerText = `${totalRate}%`;
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
    if(!list) return;
    
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
        } else if (typeof file === 'string') {
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

function toggleSlumpReason() {
    const trend = document.querySelector('input[name="studyTrend"]:checked')?.value;
    const box = document.getElementById('slumpReasonBox');
    
    if(trend === 'down') box.style.display = 'block'; 
    else box.style.display = 'none';
}

// 데이터 로드 함수
function loadWeeklyDataToForm(data) {
    // 1. 학습 시간 (기존 로직 유지)
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

    // 2. 모의고사 데이터 로드 (핵심 수정)
    if (data.mockExam) {
        // 타일 선택 상태 복원
        const targetTile = document.querySelector(`.mock-tile[onclick*="'${data.mockExam.type}'"]`);
        if(targetTile) selectMockType(data.mockExam.type, targetTile);
        
        // 점수 및 옵션 복원
        if (data.mockExam.scores) {
            const s = data.mockExam.scores;
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if(el) el.value = val || '';
            };

            setVal('mockKorScore', s.kor);
            setVal('mockKorOpt', s.korOpt);
            
            setVal('mockMathScore', s.math);
            setVal('mockMathOpt', s.mathOpt);
            
            setVal('mockEngScore', s.eng);
            
            setVal('mockInq1Score', s.inq1);
            setVal('mockInq1Name', s.inq1Name);
            
            setVal('mockInq2Score', s.inq2);
            setVal('mockInq2Name', s.inq2Name);
        }
    }

    // 3. 트렌드 (기존 유지)
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
    
    // 4. 심층 코칭 답변 (기존 유지)
    if (data.deepAnswers && Array.isArray(data.deepAnswers)) {
        ['deepQ1', 'deepQ2', 'deepQ3', 'deepQ4'].forEach((id, idx) => {
            const el = document.getElementById(id);
            if(el) {
                el.value = data.deepAnswers[idx] || '';
                if(typeof updateCharCount === 'function') updateCharCount(el); 
            }
        });
    }

    currentPlannerFiles = data.plannerFiles || [];
    originalPlannerFiles = [...currentPlannerFiles];
    renderPlannerFiles();
}

function updateCharCount(el) { 
    const countSpan = el.parentElement.querySelector('.char-count span');
    if(countSpan) countSpan.innerText = el.value.length; 
}

// 주간 점검 제출 함수
async function submitWeeklyCheck() {
    // 1. 학습평가 데이터 수집
    const totalPlanEl = document.getElementById('totalPlan');
    // 안전 장치: 요소가 없으면 중단
    if (!totalPlanEl) { console.error("totalPlan 요소 없음"); return; }
    
    const totalPlan = parseFloat(totalPlanEl.innerText);
    if (totalPlan === 0) { 
        alert("학습 계획 시간을 입력해주세요."); 
        switchWeeklyTab('step1'); 
        return; 
    }

    // 2. 심층 코칭 데이터 수집
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : "";
    
    const q1 = getVal('deepQ1');
    const q2 = getVal('deepQ2');
    const q3 = getVal('deepQ3');
    const q4 = getVal('deepQ4');

    if (!q1 && !q2 && !q3 && !q4) {
        alert("심층 코칭 질문을 최소 1개 이상 작성해주세요.");
        switchWeeklyTab('step2'); 
        return;
    }

    // 3. 모의고사 데이터 수집 (ID 매핑 수정됨)
    const mockType = document.getElementById('mockExamType').value;
    let mockData = { type: mockType, proofFile: null, scores: {} };
    
    if (mockType !== 'none') {
        const fileInput = document.getElementById('mockExamProof');
        mockData.proofFile = (fileInput && fileInput.files.length > 0) ? fileInput.files[0].name : "file_uploaded"; 
        
        // [핵심 수정] HTML ID와 1:1 매핑하여 데이터 수집
        mockData.scores = { 
            // 국어
            kor: getVal('mockKorScore'), 
            korOpt: getVal('mockKorOpt'),
            // 수학
            math: getVal('mockMathScore'), 
            mathOpt: getVal('mockMathOpt'),
            // 영어
            eng: getVal('mockEngScore'),
            // 탐구1
            inq1: getVal('mockInq1Score'), 
            inq1Name: getVal('mockInq1Name'),
            // 탐구2
            inq2: getVal('mockInq2Score'), 
            inq2Name: getVal('mockInq2Name')
        };
    }

    // 4. 학습 시간 상세 데이터 수집 (기존 유지)
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
        
        const planEl = row.querySelector('.plan-time');
        const actEl = row.querySelector('.act-time');
        const plan = planEl ? (parseFloat(planEl.value) || 0) : 0;
        const act = actEl ? (parseFloat(actEl.value) || 0) : 0;
        
        if(plan > 0 || act > 0) studyData.push({ subject: subjName, plan, act });
    });

    // 5. 트렌드 데이터
    const trendEl = document.querySelector('input[name="studyTrend"]:checked');
    const trend = trendEl ? trendEl.value : 'keep';
    let reasons = [];
    if(trend === 'down') {
        document.querySelectorAll('#slumpReasonBox input:checked').forEach(cb => reasons.push(cb.value));
        const det = document.getElementById('slumpDetail').value;
        if(det) reasons.push(det);
    }

    if(!confirm("제출하시겠습니까?")) return;

    // 6. 서버 전송
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); 
    const submitBtn = document.querySelector('.save-btn');
    
    // 버튼 텍스트 백업
    const originalBtnText = submitBtn ? submitBtn.innerText : "저장";

    try {
        if(submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "처리 중...";
        }

        // 파일 처리 로직 (기존 유지)
        const currentUrls = currentPlannerFiles.filter(f => typeof f === 'string');
        const filesToDelete = originalPlannerFiles.filter(url => !currentUrls.includes(url));
        if (filesToDelete.length > 0) {
            await Promise.all(filesToDelete.map(url => 
                fetch(MYPAGE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ type: 'delete_s3_file', userId: userId, data: { fileUrl: url } })
                })
            ));
        }
        let finalFileUrls = [...currentUrls]; 
        const newFiles = currentPlannerFiles.filter(f => typeof f !== 'string');
        if (newFiles.length > 0) {
            for (const file of newFiles) {
                const res = await fetch(MYPAGE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ type: 'get_presigned_url', userId: userId, data: { fileName: file.name, fileType: file.type } })
                });
                if (!res.ok) throw new Error("업로드 URL 발급 실패");
                const { uploadUrl, fileUrl } = await res.json();
                await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
                finalFileUrls.push(fileUrl);
            }
        }

        const today = new Date().toISOString();
        const title = (typeof getWeekTitle === 'function') ? getWeekTitle(new Date()) : "주간점검"; 

        const weeklyData = {
            date: today,
            title: title, 
            studyTime: {
                details: studyData, 
                totalPlan: document.getElementById('totalPlan').innerText,
                totalAct: document.getElementById('totalAct').innerText,
                totalRate: document.getElementById('totalRate').innerText
            },
            mockExam: mockData, // 위에서 수집한 mockData 사용
            trend: { status: trend, reasons: reasons },
            deepAnswers: [q1, q2, q3, q4], 
            plannerFiles: finalFileUrls 
        };

        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'save_weekly_check', userId, data: weeklyData })
        });
        
        if(res.ok) { 
            alert("제출이 완료되었습니다."); 
            closeWeeklyModal(); 
            location.reload(); 
        } else {
            throw new Error("서버 응답 오류");
        }

    } catch(e) { 
        console.error("Submit Error:", e); 
        alert("처리 중 오류가 발생했습니다: " + e.message); 
    } finally {
        if(submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    }
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
// js/analysis.js

// ============================================================
// [설정] API 및 상수 정의
// ============================================================
const MYPAGE_API_URL = CONFIG.api.base;       // 사용자 정보, 주간점검 저장 등
const UNIV_DATA_API_URL = CONFIG.api.analysis; // 대학 분석, 시뮬레이션 등

let currentUserTier = 'free';
let userTargetUnivs = [null, null, null, null, null, null]; // 6슬롯
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
    // console.log("🚀 [Analysis] 데이터 로딩 시작...");

    // 병렬 데이터 로드
    Promise.allSettled([
        fetchUserData(userId),
        fetchUnivData()
    ]).then((results) => {
        results.forEach((res, idx) => {
            if (res.status === 'rejected') {
                // console.error(`❌ 데이터 로드 실패 (Index ${idx}):`, res.reason);
            }
        });

        // 초기화 로직 실행
        initUnivGrid(); 
        updateAnalysisUI();
        initProSection();
        
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
        
        // 주소창에 ?tab=pro 가 있다면 openSolution('pro')가 실행됨
        const targetTab = params.get('tab');
        if (targetTab) {
            openSolution(targetTab);         
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
        
        checkMbtiReport(data);
        applyFreeTierLock();
        
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

function applyFreeTierLock() {
    if (currentUserTier === 'free') {
        // 모든 솔루션 탭 콘텐츠에 블러 오버레이 씌우기
        document.querySelectorAll('.sol-content').forEach(content => {
            content.style.position = 'relative';
            
            // 이미 오버레이가 생성되어 있다면 건너뜀
            if (content.querySelector('.free-lock-overlay')) return;
            
            const overlay = document.createElement('div');
            overlay.className = 'free-lock-overlay';
            
            // 동적 스타일 및 마크업
            overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(8px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 50; border-radius: 12px;";
            
            overlay.innerHTML = `
                <div style="background: white; padding: 40px 50px; border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e2e8f0; max-width: 90%;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: #94a3b8; margin-bottom: 20px;"></i>
                    <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 1.4rem;">유료회원 전용 기능입니다</h3>
                    <p style="color: #64748b; font-size: 1rem; margin-bottom: 25px; line-height: 1.6;">
                        나만의 목표대학 정밀 분석 및 점수 시뮬레이션은<br>
                        <strong>Standard 멤버십</strong> 이상부터 이용 가능합니다.
                    </p>
                    <button onclick="location.href='/payment'" style="padding: 14px 35px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: background 0.2s;">
                        🚀 멤버십 알아보기
                    </button>
                </div>
            `;
            content.appendChild(overlay);
        });
    }
}

function checkMbtiReport(data) {
    const container = document.getElementById('mbtiReportContainer');
    if (!container) return;
    
    const promo = data.promoCode; 
    
    if (!promo || !promo.includes("-STC") || data.mbtiReportDownloaded) {
        container.innerHTML = '';
        return;
    }
    
    let hex = promo.replace("-STC", "").replace("-", "");
    let mbti = '';
    for (let i = 0; i < hex.length; i += 2) {
        mbti += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    
    const uppercaseMbti = mbti.toUpperCase();
    
    container.innerHTML = `
        <button onclick="downloadMbtiReport()" id="mbtiDownBtn" class="btn-go-survey" style="background-color: #10b981; color: white; border: none; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
            <i class="fas fa-file-download"></i> [${uppercaseMbti}] 보고서 다운받기
        </button>
    `;
}

async function downloadMbtiReport() {
    if (!confirm("해당 MBTI 리포트는 1회만 다운로드 가능합니다.\n지금 다운로드 하시겠습니까?")) return;
    
    const btn = document.getElementById('mbtiDownBtn');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 발급 중...`;
        btn.disabled = true;
    }

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    try {
        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_mbti_report', userId: userId })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            alert("다운로드가 시작되었습니다.");
            const link = document.createElement('a');
            link.href = data.downloadUrl;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            const container = document.getElementById('mbtiReportContainer');
            if (container) container.innerHTML = ''; 
        } else {
            alert(data.error || "보고서 발급에 실패했습니다.");
            if (btn) { btn.innerHTML = `<i class="fas fa-file-download"></i> 보고서 다운받기`; btn.disabled = false; }
        }
    } catch (e) {
        alert("서버 통신 오류가 발생했습니다.");
        if (btn) { btn.innerHTML = `<i class="fas fa-file-download"></i> 보고서 다운받기`; btn.disabled = false; }
    }
}

// ============================================================
// [기능 1] 목표대학 설정
// ============================================================
function initUnivGrid() {
    const grid = document.getElementById('univGrid');
    if(!grid) return;
    
    grid.innerHTML = ''; 
    const tierLimits = { 'basic': 2, 'standard': 4, 'pro': 6};
    const limit = tierLimits[currentUserTier] || 2;
    const now = new Date();

    for (let i = 0; i < 6; i++) {
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
                // if (now < unlockDate) { 
                //     isLocked = true; 
                //     dateMsg = `🔒 ${unlockDate.getMonth()+1}월 ${unlockDate.getDate()}일 이후 수정 가능`; 
                // }
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
            let requiredTier = (i < 4) ? 'Standard' : 'PRO';
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
    // if(!confirm("저장하면 2주 동안 수정할 수 없습니다.\n정말 저장하시겠습니까?")) return;
    
    const newUnivs = [...userTargetUnivs]; 
    const nowISO = new Date().toISOString();
    const tierLimits = { 'basic': 2, 'standard': 4, 'pro': 6};
    const limit = tierLimits[currentUserTier] || 2;
    
    while(newUnivs.length < 6) newUnivs.push(null);
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
    // 1. 데이터 부족/오류 처리
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

    // 2. 스타일 정의
    const badgeStyle = `background:${res.color}15; color:${res.color}; border:1px solid ${res.color};`; 
    const scoreStyle = `color:${res.color}; font-weight:800; font-size:1.5rem;`;

    const safeIdx = escapeHtml(res.idx + 1);
    const safeUniv = escapeHtml(res.univ);
    const safeMajor = escapeHtml(res.major);
    const safeStatus = escapeHtml(res.status);
    const safeMsg = escapeHtml(res.msg);
    const safeScore = escapeHtml(res.converted_score);

    // [모바일 감지]
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    // 공통 텍스트 스타일
    const baseLabelStyle = "position:absolute; transform:translateX(-50%); color:#64748b; font-weight:600; white-space:nowrap; font-size:0.75rem; line-height:1;";

    // [위치 조정 로직]
    // 모바일: '합격(100)'을 위로 22px 띄움 / PC: 바닥(0px)에 둠
    const passLabelStyle = isMobile 
        ? `${baseLabelStyle} bottom: 24px; color:#3b82f6;`  // 파란색 강조 및 위로 올림
        : `${baseLabelStyle} bottom: 0;`;
    
    // '안정(150)'은 항상 바닥
    const stableLabelStyle = `${baseLabelStyle} bottom: 0;`;

    // [지시선] 모바일에서만 '합격' 라벨 아래에 점선 표시
    const guideLine = isMobile 
        ? `<div style="position:absolute; left:50%; bottom:-24px; width:1px; height:22px; border-left:1px dashed #3b82f6; transform:translateX(-50%); opacity:0.6;"></div>` 
        : '';

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
                    <div style="position:relative; height:12px; background:#f1f5f9; border-radius:6px; margin:10px 0; overflow:visible;">
                        <div style="position:absolute; left:40%; top:-5px; bottom:-5px; width:1px; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                        <div style="position:absolute; left:60%; top:-5px; bottom:-5px; width:1px; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                        
                        <div style="position:absolute; left:0; top:0; height:100%; width:${Math.min((res.converted_score / 250) * 100, 100)}%; background:${res.color}; border-radius:6px; transition: width 1s ease-out; z-index:1;"></div>
                    </div>
                    
                    <div style="font-size:0.75rem; color:#94a3b8; height:40px; position: relative;">
                        <span style="position:absolute; left:0; bottom:0;">0</span>
                        
                        <span style="${passLabelStyle} left:40%;">
                            합격(100)
                            ${guideLine}
                        </span>
                        
                        <span style="${stableLabelStyle} left:60%;">안정(150)</span>
                        
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
    if (score >= 170) return `<strong>👑 최초 합격 / 장학금 유력</strong> 구간입니다. 더 높은 대학을 과감하게 상향 지원해보는 전략이 필요합니다.`;
    if (score >= 145) return `<strong>매우 안정 (최초합 유력)</strong>입니다. 이 대학을 보험으로 두고 상향 지원 전략을 짜세요.`;
    if (score >= 120) return `<strong>합격 가능성이 높습니다. (안정)</strong> 무난한 합격이 예상됩니다.`;
    if (score >= 100) return `<strong>적정 지원 (추합권)</strong>입니다. 추가 합격 가능성이 높으며 경쟁률 변화를 주시해야 합니다.`;
    if (score >= 85) return `<strong>소신 지원 (문 닫고 입학)</strong> 전략입니다. 불합격 리스크를 감수해야 합니다.`;
    if (score >= 65) return `<strong>상향 지원 (위험)</strong>입니다. 반드시 다른 군에 확실한 안정 카드를 확보하세요.`;
    return `<strong>지원 불가 / 초고위험</strong> 구간입니다. 눈높이를 낮추거나 전형을 변경하는 것을 권장합니다.`;
}

// ============================================================
// [기능 3] 점수 상승 시뮬레이션
// ============================================================

let currentSimChartType = 'bar'; // 'bar' or 'line'
let cachedSimData = [];
let selectedSimIndex = null; // 현재 선택된 대학 인덱스

// 1. 초기화 (체크박스 생성 X, 바로 데이터 로드)
function initSimulation() {
    // 목표 대학이 없으면 안내 표시
    const validTargets = userTargetUnivs ? userTargetUnivs.filter(t => t && t.univ) : [];
    if (validTargets.length === 0) {
        document.getElementById('simChartArea').innerHTML = 
            `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8;">목표 대학을 먼저 설정해주세요.</div>`;
        return;
    }
    
    // 데이터 바로 로드
    fetchSimulationData();
}

// 2. 데이터 가져오기
async function fetchSimulationData() {
    const chartArea = document.getElementById('simChartArea');
    chartArea.innerHTML = '<div style="margin:auto; color:#3b82f6;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
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
        
        // 데이터가 있으면 첫 번째 대학 자동 선택
        if (cachedSimData.length > 0) {
            selectedSimIndex = 0;
        }
        
        renderSimChart(); // 차트 그리기
        
    } catch (e) { 
        chartArea.innerHTML = '데이터 로드 실패'; 
        console.error(e);
    }
}

// 3. 차트 타입 변경 (막대 <-> 꺾은선)
function setSimChartType(type) {
    currentSimChartType = type;
    
    // 버튼 스타일 업데이트
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    const btnIdx = type === 'bar' ? 0 : 1;
    document.querySelectorAll('.toggle-btn')[btnIdx].classList.add('active');
    
    renderSimChart();
}

// [전역 변수]
let simSvgRefs = null;

// 4. 차트 렌더링 (메인 함수)
function renderSimChart() {
    const container = document.getElementById('simChartArea');
    if (!cachedSimData || cachedSimData.length === 0) return;

    const examName = EXAM_DISPLAY_NAMES[currentExamMode] || currentExamMode;

    // 배지 HTML 생성 헬퍼
    const getBadgeHTML = () => `
        <div class="sim-info-badge">
            <span><i class="fas fa-history"></i> ${examName} 기준</span>
        </div>
    `;

    // ==================================================================================
    // [TYPE: BAR] 막대 그래프 (배지 추가됨)
    // ==================================================================================
    if (currentSimChartType === 'bar') {
        simSvgRefs = null;
        container.innerHTML = ''; 
        container.style.overflow = 'visible';

        // 1. 컨테이너 구조 생성
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-inner-container';
        wrapper.style.height = 'auto'; 
        wrapper.style.minHeight = '360px';

        wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());
        
        const graphArea = document.createElement('div');
        graphArea.className = 'chart-graph-area';
        
        const labelArea = document.createElement('div');
        labelArea.className = 'chart-label-area';
        
        wrapper.appendChild(graphArea);
        wrapper.appendChild(labelArea);
        container.appendChild(wrapper);

        const mobileLegendDiv = document.createElement('div');
        mobileLegendDiv.className = 'mobile-legend-area';
        container.appendChild(mobileLegendDiv);

        const isMobile = window.innerWidth <= 768;

        // 🚀 [수정 포인트] 픽셀(px) 계산을 제거하고 퍼센트(%) 기준으로 변경
        const MAX_SCORE = 250; // 0~250점 고정 스케일

        // [중요] % 비율을 정확히 맞추기 위해 내부 padding-top을 없애고 margin-top으로 여백 확보
        if (isMobile) {
            graphArea.style.padding = '0 15px 0 15px';
            graphArea.style.marginTop = '40px'; 
            graphArea.style.height = '200px'; 
        } else {
            graphArea.style.padding = '0 60px 0 20px';
            graphArea.style.marginTop = '50px'; 
            graphArea.style.height = '260px'; 
        }
        graphArea.style.paddingBottom = '0';

        // 2. 가이드 라인을 무조건 250점 대비 퍼센트(%)로 배치
        const guideStyle100 = `bottom: ${(100 / MAX_SCORE) * 100}%;`;
        const guideStyle150 = `bottom: ${(150 / MAX_SCORE) * 100}%;`;
        
        graphArea.insertAdjacentHTML('beforeend', 
            `<div class="chart-guide-line guide-100" style="${guideStyle100}"><span class="chart-guide-label">합격(100)</span></div>`
        );
        graphArea.insertAdjacentHTML('beforeend', 
            `<div class="chart-guide-line guide-150" style="${guideStyle150}"><span class="chart-guide-label">안정(150)</span></div>`
        );

        mobileLegendDiv.innerHTML = `
            <div class="mobile-legend-item">
                <div style="width:12px; height:2px; background:#10b981; margin-right:4px;"></div> 안정(150)
            </div>
            <div class="mobile-legend-item">
                <div style="width:12px; height:2px; background:#3b82f6; margin-right:4px;"></div> 합격(100)
            </div>
        `;

        cachedSimData.forEach((item, index) => {
            const score = item.base_ui_score;
            
            // 3. 막대의 높이 또한 250점 대비 퍼센트(%)로 그리기
            const currentHeightPct = `${(score / MAX_SCORE) * 100}%`;
            
            let color = '#ef4444'; 
            if (score >= 150) color = '#10b981'; 
            else if (score >= 100) color = '#3b82f6';

            const isActive = (index === selectedSimIndex) ? 'active' : '';
            const safeScore = Math.round(score);
            const shortUniv = item.univ.replace('학교', '');

            let extensionHtml = '';
            let mainBarRadius = '6px 6px 0 0'; 
            let showOriginalLabel = true;
            let maxRise = 0;
            if (item.sim_data) {
                Object.values(item.sim_data).forEach(sub => { if (sub && sub.uiDiff > maxRise) maxRise = sub.uiDiff; });
            }

            if (isActive && maxRise > 0 && score < MAX_SCORE) {
                const potentialScore = Math.min(score + maxRise, MAX_SCORE);
                const riseAmount = potentialScore - score; 
                
                // 4. 상승분 막대는 메인 막대(부모) 내부에 위치하므로, 현재 점수 대비 비율로 계산
                const safeScoreForMath = Math.max(score, 0.01); // 0으로 나누기 에러 방지
                const riseHeightPct = `${(riseAmount / safeScoreForMath) * 100}%`;
                
                mainBarRadius = '0 0 0 0'; 
                showOriginalLabel = false; 
                extensionHtml = `
                    <div style="position:absolute; bottom:100%; left:0; width:100%; height:${riseHeightPct}; background:rgba(245, 158, 11, 0.15); border:2px dashed #f59e0b; border-bottom:none; border-radius: 6px 6px 0 0; box-sizing:border-box; pointer-events:none;">
                         <span style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); color:#d97706; font-size:0.8rem; font-weight:800; white-space:nowrap;">
                            ${Math.round(potentialScore)} <span style="font-size:0.7rem;">(+${maxRise.toFixed(1)})</span>
                         </span>
                    </div>
                `;
            }

            const barHtml = `
                <div class="sim-bar-item ${isActive}" onclick="selectSimUniv(${index})">
                    <div class="sim-bar" style="height:${currentHeightPct}; background:${color}; border-radius:${mainBarRadius};">
                        ${extensionHtml}
                        <span class="sim-score-label" style="${showOriginalLabel ? '' : 'display:none;'}">${safeScore}</span>
                    </div>
                </div>
            `;
            graphArea.insertAdjacentHTML('beforeend', barHtml);

            const labelHtml = `
                <div class="sim-label-item" onclick="selectSimUniv(${index})">
                    <span class="label-mobile">${index + 1}지망</span>
                    <span class="label-pc">
                        <strong>${index + 1}지망</strong><br>${shortUniv}<br>${item.major}
                    </span>
                </div>
            `;
            labelArea.insertAdjacentHTML('beforeend', labelHtml);
        });
    }
    // ==================================================================================
    // [TYPE: LINE] 꺾은선 그래프
    // ==================================================================================
    else if (currentSimChartType === 'line') {
        if (!document.getElementById('simLineWrapper')) {
            container.innerHTML = '';
            container.style.overflow = 'visible'; // [중요] 모바일 포인트 잘림 방지

            const wrapper = document.createElement('div');
            wrapper.id = 'simLineWrapper';
            wrapper.className = 'sim-line-container';

            // [추가] 꺾은선 그래프 상단 배지
            wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());

            const chartArea = document.createElement('div');
            chartArea.className = 'sim-line-chart-area';
            chartArea.style.overflow = "visible"; // [중요] 차트 영역 오버플로우 허용

            const btnBox = document.createElement('div');
            btnBox.className = 'sim-univ-scroll-box'; 

            wrapper.appendChild(chartArea);
            wrapper.appendChild(btnBox);
            container.appendChild(wrapper);

            initSimSvg(chartArea);
            renderSimUnivButtons(btnBox);
        }
        updateSimLineGraph(selectedSimIndex || 0);
    }
    
    renderDetailedSimCard();
}

// [헬퍼 1] SVG 구조 생성
function initSimSvg(targetDiv) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "sim-svg-layer");
    svg.style.overflow = "visible";
    
    const isMobile = window.innerWidth <= 768;
    const baseRadius = isMobile ? "4" : "6";
    
    const guides = {
        g0: createGuideGroup(ns, "#cbd5e1", "0점"),
        g100: createGuideGroup(ns, "#3b82f6", "100 합격"),
        g150: createGuideGroup(ns, "#10b981", "150 안정"),
        g250: createGuideGroup(ns, "#cbd5e1", "250 만점")
    };

    const path = document.createElementNS(ns, "path");
    path.setAttribute("class", "sim-path");

    // [변경 1] 배경 요소(가이드, 선)를 먼저 붙입니다. (가장 밑에 깔림)
    svg.appendChild(guides.g0.g);
    svg.appendChild(guides.g100.g);
    svg.appendChild(guides.g150.g);
    svg.appendChild(guides.g250.g);
    
    // [변경 2] 선을 점보다 먼저 붙입니다.
    svg.appendChild(path);

    const points = [];
    const labels = [];
    const labelsGroup = document.createElementNS(ns, "g");
    
    for(let i=0; i<4; i++) {
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("class", "sim-point");
        c.setAttribute("r", baseRadius);
        
        const t = document.createElementNS(ns, "text");
        t.setAttribute("class", "sim-point-label");
        
        // [변경 3] 이제 점을 붙이면 선 위에 그려집니다.
        svg.appendChild(c); 
        labelsGroup.appendChild(t); 
        points.push(c);
        labels.push(t);
    }
    
    // [변경 4] 라벨(텍스트)은 가장 위에 오도록 마지막에 붙입니다.
    svg.appendChild(labelsGroup);
    targetDiv.appendChild(svg);

    const xAxis = document.createElement('div');
    xAxis.style.cssText = "position:absolute; bottom:0; left:0; width:100%; display:flex; justify-content:space-around; padding-bottom:5px; pointer-events:none;";
    
    const xAxisTexts = [];
    ['국어', '수학', '탐구1', '탐구2'].forEach(txt => {
        const sp = document.createElement('span');
        sp.innerText = txt;
        sp.style.cssText = "font-size:11px; color:#64748b; font-weight:600; width:40px; text-align:center;";
        xAxis.appendChild(sp);
        xAxisTexts.push(sp);
    });
    targetDiv.appendChild(xAxis);

    simSvgRefs = { svg, guides, path, points, labels, xAxisTexts };
}

// [헬퍼 2] 가이드 라인 그룹
function createGuideGroup(ns, color, txt) {
    const g = document.createElementNS(ns, "g");
    const line = document.createElementNS(ns, "line");
    line.setAttribute("class", "sim-guide-line");
    line.setAttribute("stroke", color);
    const text = document.createElementNS(ns, "text");
    text.setAttribute("class", "sim-guide-text");
    text.setAttribute("fill", color);
    text.textContent = txt;
    g.appendChild(line);
    g.appendChild(text);
    return { g, line, text };
}

// [헬퍼 3] 하단 대학 선택 버튼
function renderSimUnivButtons(targetDiv) {
    targetDiv.innerHTML = '';
    cachedSimData.forEach((d, i) => {
        const btn = document.createElement('div'); 
        btn.className = `univ-select-btn ${i === selectedSimIndex ? 'active' : ''}`;
        
        const univName = d.univ.replace('학교', '');
        const deptName = d.major || '학부';
        
        btn.innerHTML = `
            <span style="font-weight:700;">${univName}</span>
            <span style="font-size:0.85em; opacity:0.9;">${deptName}</span>
        `;
        
        btn.onclick = () => {
            selectSimUniv(i); 
            const btns = targetDiv.querySelectorAll('.univ-select-btn');
            btns.forEach((b, idx) => {
                if (idx === i) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        };
        targetDiv.appendChild(btn);
    });
}

// [헬퍼 4] 그래프 업데이트
function updateSimLineGraph(idx) {
    if (!simSvgRefs) return;

    // [반응형] 리사이즈 이벤트 등록
    window.lastSimGraphIdx = idx;
    if (!window.simGraphResizeHandler) {
        window.simGraphResizeHandler = () => {
            if (typeof window.lastSimGraphIdx !== 'undefined') {
                updateSimLineGraph(window.lastSimGraphIdx);
            }
        };
        window.addEventListener('resize', window.simGraphResizeHandler);
    }

    const data = cachedSimData[idx];
    if (!data) return;

    // 그래프 상하 높이 설정
    const TARGET_HEIGHT = 260; 
    
    // 부모 컨테이너 높이 강제 고정
    simSvgRefs.svg.parentNode.style.height = `${TARGET_HEIGHT}px`;
    simSvgRefs.svg.parentNode.style.minHeight = `${TARGET_HEIGHT}px`;

    const svgEl = simSvgRefs.svg;
    const W = svgEl.clientWidth || 300; 
    
    // 🚀 [핵심 수정] 브라우저 Reflow 지연으로 인해 예전 높이(180)를 읽어오는 현상 방지.
    // clientHeight에 의존하지 않고 TARGET_HEIGHT를 직접 계산에 사용합니다.
    const H = TARGET_HEIGHT - 30; 

    // 1. X축 텍스트
    const realNames = ['국어', '수학'];
    realNames.push(data.sim_data.inq1?.name || '탐구1');
    realNames.push(data.sim_data.inq2?.name || '탐구2');
    simSvgRefs.xAxisTexts.forEach((span, i) => { span.innerText = realNames[i]; });

    // 2. 점수 데이터
    const keys = ['kor', 'math', 'inq1', 'inq2'];
    const currentScore = data.base_ui_score;
    const scores = keys.map(k => {
        const rise = (data.sim_data && data.sim_data[k]) ? data.sim_data[k].uiDiff : 0;
        return Math.min(250, currentScore + rise);
    });

    // 3. 25점 단위 가이드 라인 계산
    const GAP = 25; 
    let minS = Math.min(...scores);
    let maxS = Math.max(...scores);
    const centerScore = (minS + maxS) / 2;
    
    let midLine = Math.round(centerScore / GAP) * GAP;
    let bottomLine = midLine - GAP;
    let topLine = midLine + GAP;

    // 0~250 범위 제한
    if (bottomLine < 0) { bottomLine = 0; midLine = 25; topLine = 50; }
    else if (topLine > 250) { topLine = 250; midLine = 225; bottomLine = 200; }

    // 4. [여백 최적화] 위아래 여백을 10점으로 줄임 (그래프 꽉 채우기)
    let yMin = bottomLine - 10;
    let yMax = topLine + 10;
    
    const yRange = yMax - yMin || 1;
    const getY = (score) => H - ((score - yMin) / yRange * H) + 15;

    // 5. 가이드 라인 그리기
    const targetGuides = [bottomLine, midLine, topLine];
    const guideObjects = Object.values(simSvgRefs.guides); 

    guideObjects.forEach((guideObj, i) => {
        if (i < 3) {
            const val = targetGuides[i];
            const y = getY(val);
            
            guideObj.g.style.opacity = 1;
            
            guideObj.line.setAttribute("x1", 0);
            guideObj.line.setAttribute("x2", W); 
            guideObj.line.setAttribute("y1", y);
            guideObj.line.setAttribute("y2", y);
            
            guideObj.text.setAttribute("x", W - 5);
            guideObj.text.setAttribute("y", y - 4);
            guideObj.text.textContent = val; 
        } else {
            guideObj.g.style.opacity = 0;
        }
    });

    // 6. 패스 & 포인트 그리기
    const sectionW = W / 4;
    let d = "";
    
    const isFlat = (minS === maxS);
    const maxIdx = isFlat ? -1 : scores.indexOf(maxS);
    const minIdx = isFlat ? -1 : scores.indexOf(minS);

    scores.forEach((s, i) => {
        const cx = (sectionW * i) + (sectionW / 2);
        const cy = getY(s);
        
        if (i === 0) d += `M ${cx} ${cy}`;
        else d += ` L ${cx} ${cy}`;
        
        simSvgRefs.points[i].setAttribute("cx", cx);
        simSvgRefs.points[i].setAttribute("cy", cy);
        
        const pointEl = simSvgRefs.points[i];
        const labelEl = simSvgRefs.labels[i];
        
        pointEl.style.fill = "#bfdbfe"; 
        pointEl.style.stroke = "#2563EB"; 
        labelEl.style.opacity = 0;
        labelEl.style.fontWeight = "normal";
        labelEl.style.fill = "#1e293b";

        if (!isFlat) {
            if (i === maxIdx) { 
                pointEl.style.fill = "#10b981"; pointEl.style.stroke = "#059669";
                labelEl.style.fill = "#10b981"; labelEl.style.opacity = 1; labelEl.style.fontWeight = "bold";
            }
            if (i === minIdx) { 
                pointEl.style.fill = "#ef4444"; pointEl.style.stroke = "#b91c1c";
                labelEl.style.fill = "#ef4444"; labelEl.style.opacity = 1; labelEl.style.fontWeight = "bold";
            }
        }
        
        labelEl.textContent = Math.round(s);
        labelEl.setAttribute("x", cx);
        labelEl.setAttribute("y", cy - 12);
        
        // 요소 순서 재배치 (선 위로 올리기)
        pointEl.parentNode.appendChild(pointEl);
        labelEl.parentNode.appendChild(labelEl);
    });

    simSvgRefs.path.setAttribute("d", d);
}

// 5. 대학 선택 시 동작
function selectSimUniv(index) {
    selectedSimIndex = index;
    renderSimChart(); // 차트 다시 그려서 active 클래스 갱신
}

// 6. 상세 분석 카드 렌더링
function renderDetailedSimCard() {
    const cardArea = document.getElementById('simDetailCard');
    
    if (selectedSimIndex === null || !cachedSimData[selectedSimIndex]) {
        cardArea.innerHTML = `<div class="empty-sim-state"><p>대학을 선택해주세요.</p></div>`;
        return;
    }

    const data = cachedSimData[selectedSimIndex];
    const currentScore = Math.round(data.base_ui_score);
    
    // 🚨 [방어 로직] 현재 점수가 250점(MAX)이면 상승폭을 모두 0으로 강제 처리
    if (currentScore >= 250) {
        Object.keys(data.sim_data).forEach(key => {
            if (data.sim_data[key]) {
                data.sim_data[key].uiDiff = 0;
            }
        });
    }

    const getStatusText = (s) => {
        if (s >= 150) return "안정권"; 
        if (s >= 100) return "적정권"; 
        if (s >= 50) return "소신지원";
        return "위험";
    };
    const currentStatus = getStatusText(currentScore);

    // 추천 과목 및 최대 상승폭 찾기
    let maxRise = 0;
    let bestSubjectKey = '';
    const subjects = [
        { key: 'kor', name: '국어' },
        { key: 'math', name: '수학' },
        { key: 'inq1', name: '탐구1' },
        { key: 'inq2', name: '탐구2' }
    ];

    subjects.forEach(sub => {
        const info = data.sim_data[sub.key];
        if (info && info.uiDiff > maxRise) {
            maxRise = info.uiDiff;
            bestSubjectKey = sub.key;
        }
    });

    let subjectsHTML = '';
    subjects.forEach(sub => {
        const info = data.sim_data[sub.key];
        if (!info) return;

        const diffVal = info.uiDiff.toFixed(1);
        const isBest = (sub.key === bestSubjectKey && maxRise > 0);
        
        let desc = '';
        if (info.msg.includes("응시 안 함")) {
            desc = `<span style="color:#94a3b8;">미응시 과목입니다.</span>`;
        } else if (info.diff <= 0) {
            desc = `<span style="color:#ef4444;">점수 변화 없음 (만점 등)</span>`;
        } else {
            desc = isBest 
                ? `<strong>가장 합격 상승에 유리합니다.</strong>` 
                : `점수 상승으로 합격 가능성이 높아집니다.`;
        }

        const subText = info.diff > 0 
            ? `(실점수 +${(info.diff || 3.0).toFixed(2)}점)` 
            : ``;
        subjectsHTML += `
            <div class="sim-item ${isBest ? 'best-pick' : ''}">
                <div class="sim-item-header">
                    <span>${info.name || sub.name} (+1점)</span>
                    <span style="color:${info.uiDiff > 0 ? '#ef4444' : '#94a3b8'}">
                        +${diffVal}점
                    </span>
                </div>
                <div class="sim-item-body">
                    <div>${desc}</div>
                    <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">${subText}</div>
                </div>
            </div>
        `;
    });

    // 🚨 [추가된 로직] 점수 상황에 따른 동적 경고문구 출력
    let warningHTML = '';
    if (currentScore < 10 && (currentScore + maxRise) < 25) {
        // [추가] 상승해도 여전히 매우 불합권인 경우
        warningHTML = `<div class="sim-warning" style="background:#fff7ed; border-color:#fdba74; color:#c2410c;"><i class="fas fa-exclamation-circle"></i><div><strong>여전히 불합격권입니다.</strong><br>한 문제를 더 맞혀도 매우 어렵습니다. 다른 전형이나 대학을 함께 고려해보세요.</div></div>`;
    } 
    else if (currentScore >= 225 || (currentScore + maxRise) >= 250) {
        warningHTML = `<div class="sim-warning" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534;"><i class="fas fa-check-circle"></i><div><strong>이미 상당히 안정권입니다.</strong><br>한 문제를 더 맞혀도 합격 가능성에 유의미한 변화가 없습니다. 상위 대학 및 전형에 도전해보세요.</div></div>`;
    }

    cardArea.innerHTML = `
        <div class="sim-result-card">
            <div class="sim-card-header">
                <div>
                    <span class="sim-univ-title">${data.univ}</span>
                    <span class="sim-univ-dept">${data.major}</span>
                </div>
                <div class="sim-score-change">
                    <span class="score-badge">현재: ${currentStatus}</span>
                    <span class="score-diff">${currentScore}점</span>
                </div>
            </div>
            <div class="sim-grid">${subjectsHTML}</div>
            ${warningHTML}
        </div>
    `;
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

    // 1. 연/월 추출 및 Select Box 구성
    const yearMonths = new Set();
    history.forEach(h => {
        // "26년 2월 2주차" 등에서 "26년 2월" 추출
        const match = h.title && h.title.match(/(\d{2,4}년\s\d{1,2}월)/);
        if(match) yearMonths.add(match[1]);
    });

    const today = new Date();
    const currentYM = `${String(today.getFullYear()).slice(2)}년 ${today.getMonth()+1}월`;
    if(yearMonths.size === 0) yearMonths.add(currentYM);
    
    const prevValue = select.value;
    select.innerHTML = '';
    
    Array.from(yearMonths).sort().reverse().forEach(ym => {
        const option = document.createElement('option');
        option.value = ym;
        option.innerText = ym;
        select.appendChild(option);
    });
    
    if (prevValue && yearMonths.has(prevValue)) {
        select.value = prevValue;
    } else {
        select.selectedIndex = 0;
    }
    
    const selectedYM = select.value;

    // 2. 리스트 렌더링
    listContainer.innerHTML = '';
    
    // 필터링 및 정렬 (최신순)
    const filtered = history.filter(h => h.title && h.title.includes(selectedYM))
                            .sort((a,b) => new Date(b.date) - new Date(a.date));

    if(filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-feedback">제출된 기록이 없습니다.</div>';
        return;
    }

    filtered.forEach(h => {
        const div = document.createElement('div');
        div.className = 'feedback-tile';

        const fb = h.tutorFeedback || {};
        
        // 새로 추가된 5가지 필드 중 하나라도 작성되어 있으면 피드백 완료로 간주
        const hasFeedback = fb && (
            (fb.priorityCheck && String(fb.priorityCheck).trim() !== "") || 
            (fb.weakSubject && String(fb.weakSubject).trim() !== "") || 
            (fb.nextWeekTop3 && String(fb.nextWeekTop3).trim() !== "") || 
            (fb.planEvaluation && String(fb.planEvaluation).trim() !== "") ||
            (fb.extraQuestion && String(fb.extraQuestion).trim() !== "")
        );

        const statusText = hasFeedback ? '피드백 도착 ✅' : '피드백 대기중 ⏳';
        const statusStyle = hasFeedback ? 'color:#15803d; font-weight:bold;' : 'color:#94a3b8;';

        div.onclick = () => { openFeedbackModal(h); };
        
        div.innerHTML = `
            <div class="fb-title">${h.title || "주간 리포트"}</div>
            <div class="fb-status" style="${statusStyle}">
                ${statusText}
            </div>
        `;
        listContainer.appendChild(div);
    });
}

// 피드백 상세 모달 열기 및 문서 형식 데이터 바인딩 (모바일 최적화 적용)
function openFeedbackModal(data) {
    const modal = document.getElementById('feedbackModal');
    const contentArea = document.querySelector('#feedbackModal .modal-body') || document.getElementById('modalContent'); 

    if (!contentArea) return;

    const fb = data.tutorFeedback || {};
    
    // 1. [체크] 피드백 데이터가 없는 경우 -> 대기중 화면 렌더링
    const hasFeedback = fb && (
        (fb.priorityCheck && String(fb.priorityCheck).trim() !== "") || 
        (fb.weakSubject && String(fb.weakSubject).trim() !== "") ||
        (fb.extraQuestion && String(fb.extraQuestion).trim() !== "")
    );

    if (!hasFeedback) {
        contentArea.innerHTML = `
            <div class="pending-view">
                <div class="pending-icon"><i class="fas fa-hourglass-half"></i></div>
                <h2 style="color:#334155; margin-bottom:10px;">피드백 작성 대기중</h2>
                <p style="color:#64748b; margin-bottom:30px;">
                    담당 컨설턴트가 학생의 리포트를 꼼꼼히 분석하고 있습니다.<br>
                    조금만 기다려주시면 알림을 보내드릴게요!
                </p>
                <button onclick="document.getElementById('feedbackModal').style.display='none'" 
                        style="padding:10px 25px; background:#e2e8f0; border:none; border-radius:8px; font-weight:bold; color:#475569; cursor:pointer;">
                    닫기
                </button>
            </div>
        `;
        modal.style.display = 'block';
        return;
    }

    // -----------------------------------------------------------
    // 피드백이 있는 경우 -> 정식 리포트 렌더링
    // -----------------------------------------------------------
    const consultantName = "담당 컨설턴트"; 
    
    // [데이터 가공]
    // 1. 학습 시간 및 요약
    let studyTimeHtml = '<div style="color:#94a3b8; text-align:center;">데이터 없음</div>';
    if (data.studyTime) {
        const totalPlan = data.studyTime.totalPlan || '0H';
        const totalAct = data.studyTime.totalAct || '0H';
        const totalRate = data.studyTime.totalRate || '0%';
        const rateColor = parseInt(totalRate) >= 80 ? '#16a34a' : (parseInt(totalRate) >= 50 ? '#d97706' : '#ef4444');
        
        studyTimeHtml = `
            <div style="display:flex; justify-content:space-around; align-items:center; text-align:center;">
                <div><div style="font-size:0.8rem; color:#64748b;">계획</div><div style="font-weight:700; color:#334155;">${totalPlan}</div></div>
                <div><div style="font-size:0.8rem; color:#64748b;">실행</div><div style="font-weight:700; color:#2563eb;">${totalAct}</div></div>
                <div><div style="font-size:0.8rem; color:#64748b;">달성률</div><div style="font-weight:800; color:${rateColor};">${totalRate}</div></div>
            </div>
        `;
    }

    // 2. 모의고사 정보
    let examHtml = '<span style="color:#94a3b8;">응시 기록 없음</span>';
    if (data.mockExam && data.mockExam.type && data.mockExam.type !== 'none') {
        const typeMap = { 'school': '교내', 'edu': '평가원/교육청', 'private': '사설' };
        const typeName = typeMap[data.mockExam.type] || '기타';
        
        let scoreSummary = [];
        const s = data.mockExam.scores || {};
        if(s.kor) scoreSummary.push(`국:${s.kor}`);
        if(s.math) scoreSummary.push(`수:${s.math}`);
        if(s.eng) scoreSummary.push(`영:${s.eng}`);
        
        const scoreStr = scoreSummary.length > 0 ? scoreSummary.join(', ') : '점수 상세 확인';
        examHtml = `<strong>${typeName} 모의고사</strong><br><span style="font-size:0.85rem; color:#64748b;">(${scoreStr})</span>`;
    } else {
        examHtml = '<span style="color:#94a3b8;">이번 주 응시 없음</span>';
    }

    // 3. 학습 추이
    let trendHtml = '-';
    if (data.trend) {
        const t = data.trend.status;
        if(t === 'up') trendHtml = '<span style="color:#16a34a; font-weight:bold;">📈 상승세</span>';
        else if(t === 'down') trendHtml = '<span style="color:#ef4444; font-weight:bold;">📉 하락세</span>';
        else trendHtml = '<span style="color:#64748b; font-weight:bold;">➖ 유지중</span>';
    }

    const summarySectionHtml = `
        <div style="display:grid; grid-template-columns: 1.2fr 1fr 0.8fr; gap:15px; align-items:center; background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0;">
            <div style="border-right:1px solid #f1f5f9; padding-right:15px;">
                <div style="font-size:0.9rem; font-weight:bold; color:#1e293b; margin-bottom:10px;">⏱️ 학습 시간</div>
                ${studyTimeHtml}
            </div>
            <div style="border-right:1px solid #f1f5f9; padding-right:15px; text-align:center;">
                <div style="font-size:0.9rem; font-weight:bold; color:#1e293b; margin-bottom:8px;">📝 시험 응시</div>
                <div style="font-size:0.95rem;">${examHtml}</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:0.9rem; font-weight:bold; color:#1e293b; margin-bottom:8px;">📊 최근 추이</div>
                <div style="font-size:1rem;">${trendHtml}</div>
            </div>
        </div>
    `;

    // 4. 심층 Q&A 구성
    let deepQnaHtml = '';
    const QUESTION_CATEGORIES = ['학습 계획 점검', '학습 방향성 설정', '취약 과목 솔루션', '기타 멘탈 관리'];
    
    if (data.deepAnswers && data.deepAnswers.length > 0) {
        deepQnaHtml += '<div style="display:flex; flex-direction:column; gap:12px;">';
        data.deepAnswers.forEach((ans, idx) => {
            if (ans && ans.trim() !== "") {
                const category = QUESTION_CATEGORIES[idx] || `질문 ${idx+1}`;
                deepQnaHtml += `
                    <div style="background:white; padding:12px; border-radius:8px; border:1px solid #f1f5f9;">
                        <span style="display:inline-block; background:#eff6ff; color:#2563eb; font-size:0.8rem; font-weight:bold; padding:2px 8px; border-radius:4px; margin-bottom:6px;">${category}</span>
                        <div style="font-size:0.95rem; color:#334155; line-height:1.5;">${escapeHtml(ans)}</div>
                    </div>
                `;
            }
        });
        deepQnaHtml += '</div>';
    } else {
        deepQnaHtml = '<div style="color:#94a3b8; text-align:center; padding:10px;">작성된 심층 질문이 없습니다.</div>';
    }

    // HTML 조립
    const html = `
        <div class="modal-document">
            <div class="doc-controls">
                <button class="btn-pdf" onclick="window.print()">
                    <i class="fas fa-print"></i> PDF 저장/인쇄
                </button>
                <button class="close-btn-doc" onclick="document.getElementById('feedbackModal').style.display='none'">
                    &times;
                </button>
            </div>

            <div class="doc-header">
                <h2 class="doc-title">스터디크랙 - 주간 피드백</h2>
                <div class="doc-meta">
                    <div>대상: ${data.title || "주간 리포트"}</div>
                    <div>작성일: ${new Date(data.date).toLocaleDateString()}</div>
                    <div>작성자: ${consultantName}</div>
                </div>
            </div>

            <div class="mobile-only-msg">
                <i class="fas fa-file-pdf"></i>
                <p>
                    상세 피드백 미리보기는 pc에서 확인해주세요.<br>
                    <strong>PDF로 저장</strong>하여 확인해주세요.
                </p>
                <button class="mobile-pdf-btn" onclick="window.print()">
                    <i class="fas fa-download"></i> PDF 저장하기
                </button>
                <button class="mobile-close-btn" onclick="document.getElementById('feedbackModal').style.display='none'">
                    닫기
                </button>
            </div>

            <div class="report-content-body">
                <div class="doc-section">
                    <div class="doc-section-title">📊 이번 주 학습 요약</div>
                    <div class="doc-box" style="background:#f8fafc; border:none; padding:0;">
                        ${summarySectionHtml}
                    </div>
                </div>

                <div class="doc-section">
                    <div class="doc-section-title">👩‍🏫 컨설턴트 주간 평가</div>
                    <div class="doc-box">
                        <div class="doc-box-item">
                            <strong>1. 이전 우선순위 이행 점검</strong>
                            <div class="doc-text">${escapeHtml(fb.priorityCheck)}</div>
                        </div>
                        <div class="doc-box-item">
                            <strong>2. 취약 과목 선정 및 개선 포인트</strong>
                            <div class="doc-text">${escapeHtml(fb.weakSubject)}</div>
                        </div>
                        <div class="doc-box-item">
                            <strong>3. 다음 주 핵심 과제 TOP3 및 근거</strong>
                            <div class="doc-text">${escapeHtml(fb.nextWeekTop3)}</div>
                        </div>
                        <div class="doc-box-item">
                            <strong>4. 플랜 진행 방향 제고 및 평가</strong>
                            <div class="doc-text">${escapeHtml(fb.planEvaluation)}</div>
                        </div>
                    </div>
                </div>

                <div class="doc-section">
                    <div class="doc-section-title">💬 심층 Q&A</div>
                    <div class="qna-pair">
                        <div class="qna-student">
                            <strong style="margin-bottom:12px; display:block;">💁 학생의 고민 (심층 질문)</strong>
                            ${deepQnaHtml}
                        </div>
                        <div class="qna-tutor" style="margin-top:20px; padding-top:20px; border-top:1px dashed #86efac;">
                            <strong style="margin-bottom:12px; display:block;">👩‍🏫 컨설턴트의 추가 코멘트</strong>
                            <div class="doc-text">${escapeHtml(fb.extraQuestion)}</div>
                        </div>
                    </div>
                </div>
            </div> </div>
    `;

    contentArea.innerHTML = html;
    modal.style.display = 'block';
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

    // 4. 학습 시간 상세 데이터 수집
    const studyRows = document.querySelectorAll('#studyTimeBody tr');
    let studyData = [];
    studyRows.forEach(row => {
        let subjName = "";
        const mainSub = row.querySelector('.main-sub');
        const detail = row.querySelector('.sub-detail');
        const custom = row.querySelector('.custom-subj');
        
        if(mainSub) {
            // 동적으로 추가된 행의 '↳' 기호와 공백을 깔끔하게 제거
            subjName = mainSub.innerText.replace('↳', '').trim();
            if(detail && detail.value) subjName += `(${detail.value.trim()})`;
        } else if(custom) {
            subjName = custom.value.trim() || "기타";
        }
        
        const planEl = row.querySelector('.plan-time');
        const actEl = row.querySelector('.act-time');
        const plan = planEl ? (parseFloat(planEl.value) || 0) : 0;
        const act = actEl ? (parseFloat(actEl.value) || 0) : 0;
        
        // 계획이나 실제 공부 시간이 0 이상 입력된 경우만 배열에 담기
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
        
        if (mockData.type !== 'none') {
            const mockFileInput = document.getElementById('mockExamProof');
            
            // 새 파일이 선택된 경우에만 S3 업로드 진행
            if (mockFileInput && mockFileInput.files.length > 0) {
                const mFile = mockFileInput.files[0];
                const mRes = await fetch(MYPAGE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    // Lambda가 처리할 수 있도록 folder를 'mock_exams'로 지정
                    body: JSON.stringify({ type: 'get_presigned_url', userId: userId, data: { fileName: mFile.name, fileType: mFile.type, folder: 'mock_exams' } })
                });
                
                if (!mRes.ok) throw new Error("모의고사 파일 업로드 URL 발급 실패");
                
                const { uploadUrl, fileUrl } = await mRes.json();
                await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mFile.type }, body: mFile });
                
                // S3에 올라간 진짜 URL을 데이터에 덮어씌움
                mockData.proofFile = fileUrl; 
            } else if (!mockData.proofFile || mockData.proofFile === "file_uploaded") {
                // 파일도 없고 기존 URL도 없는 경우 (필수값 체크)
                alert("모의고사 성적 인증 사진을 첨부해주세요.");
                switchWeeklyTab('step1'); // 탭 이동
                if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalBtnText; }
                return; // 🚨 함수 완전 종료
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

// 모의고사 파일 선택 시 파일명 표시
function updateMockFileName(input) {
    const display = document.getElementById('mockFileNameDisplay');
    if (input.files && input.files.length > 0) {
        display.textContent = input.files[0].name;
        display.style.color = "#2563eb"; // 선택 시 파란색으로 강조
        display.style.fontWeight = "bold";
    } else {
        display.textContent = "선택된 파일 없음";
        display.style.color = "#94a3b8";
        display.style.fontWeight = "normal";
    }
}

// 과목 행 동적 추가 함수
function addSubjectRow(btn, subject) {
    const tr = btn.closest('tr');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>
            <span class="main-sub" style="color:#94a3b8; font-size:0.9rem;">↳ ${subject}</span>
        </td>
        <td><input type="text" class="sub-detail" placeholder="세부과목"></td>
        <td><input type="number" class="plan-time" oninput="calcStudyRates()"></td>
        <td><input type="number" class="act-time" oninput="calcStudyRates()"></td>
        <td style="display:flex; align-items:center; justify-content:center; gap:5px; height:100%; border:none;">
            <span class="rate-txt">0%</span>
            <button type="button" class="delete-row-btn" onclick="this.closest('tr').remove(); calcStudyRates();"><i class="fas fa-minus-circle"></i></button>
        </td>
    `;
    tr.insertAdjacentElement('afterend', newRow);
}

// 기타 행 동적 추가 함수
function addCustomRow(btn) {
    const tr = btn.closest('tr');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>
            <span style="color:#94a3b8; font-size:0.9rem;">↳ </span>
            <input type="text" placeholder="기타" class="custom-subj" style="width: 70%;">
        </td>
        <td>-</td>
        <td><input type="number" class="plan-time" oninput="calcStudyRates()"></td>
        <td><input type="number" class="act-time" oninput="calcStudyRates()"></td>
        <td style="display:flex; align-items:center; justify-content:center; gap:5px; height:100%; border:none;">
            <span class="rate-txt">0%</span>
            <button type="button" class="delete-row-btn" onclick="this.closest('tr').remove(); calcStudyRates();"><i class="fas fa-minus-circle"></i></button>
        </td>
    `;
    tr.insertAdjacentElement('afterend', newRow);
}

// ============================================================
// [기능 5] PRO EXCLUSIVE 섹션 렌더링 (홍보 vs 대시보드)
// ============================================================

// 페이지 로드 시 호출 필요 (예: DOMContentLoaded 내부)
function initProSection() {
    const container = document.getElementById('sol-pro');
    if (!container) return;

    // currentUserTier는 전역 변수로 가정 (basic, standard, pro, black)
    // PRO 이상(pro, black)이면 전용 페이지, 아니면 홍보 페이지
    if (['pro', 'black'].includes(currentUserTier)) {
        renderProDashboard(container);
    } else {
        renderProPromo(container);
    }
}

// 1. [홍보 페이지] Basic/Standard 유저 대상
function renderProPromo(container) {
    // 평가원 시험 자동 계산 (예시 로직)
    const month = new Date().getMonth() + 1;
    let nextExam = "6월 모의평가";
    if (month >= 6 && month < 9) nextExam = "9월 모의평가";
    else if (month >= 9 && month < 11) nextExam = "수능(CSAT)";
    
    container.innerHTML = `
        <div class="pro-header">
            <span class="pro-badge">PREMIUM STRATEGY</span>
            <h2 class="pro-title">PRO EXCLUSIVE : 전략의 차이가 결과의 차이</h2>
            <p class="pro-desc">데이터 기반 개인화된 맞춤 전략으로 합격 확률을 극대화하세요.</p>
        </div>

        <div class="pro-promo-grid">
            <div class="pro-feature-card">
                <span class="feat-icon">📅</span>
                <span class="feat-title">Bi-weekly 리포트</span>
                <p class="feat-desc">
                    2주/1개월 단위 플래너 밀착 점검.<br>
                    단순 기록 확인이 아닌, <strong>학습 밀도와 성취도</strong>를 정밀 평가합니다.
                </p>
            </div>
            <div class="pro-feature-card">
                <span class="feat-icon">🎯</span>
                <span class="feat-title">실전 시험 완벽 대비</span>
                <p class="feat-desc">
                    가장 가까운 <strong>${nextExam}</strong> 대비 집중 가이드.<br>
                    시기별 놓치지 말아야 할 체크포인트를 제공합니다.
                </p>
            </div>
            <div class="pro-feature-card highlight">
                <span class="feat-icon">⚡</span>
                <span class="feat-title">최소 시간 상승 조합</span>
                <p class="feat-desc">
                    <strong>"무엇을 먼저 공부해야 할까?"</strong><br>
                    현 점수와 과목 가중치를 분석해, 가장 적은 시간으로 목표 점수에 도달하는 최적의 학습 조합을 제시합니다.
                </p>
            </div>
        </div>

        <button onclick="location.href='/payment'" class="pro-cta-btn">
            🚀 PRO 멤버십으로 업그레이드 하기
            <div style="font-size:0.8rem; opacity:0.8; margin-top:5px; font-weight:400;">나만의 입시 전략 연구소 갖기</div>
        </button>
    `;
}

// 2. [전용 대시보드] Pro 이상 유저 대상
function renderProDashboard(container) {
    const now = new Date();
    
    // 1. 데이터 조회용 Key 생성 (예: 26MarPre)
    const yearShort = now.getFullYear().toString().slice(2);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStr = monthNames[now.getMonth()];
    const day = now.getDate();
    const suffix = day <= 15 ? 'Pre' : 'Post';
    
    const currentKey = `${yearShort}${monthStr}${suffix}`; // DB 조회용 키
    
    // 2. 화면 표시용 날짜 문자열 생성 (예: 2026년 3월 상반기)
    const displayYear = now.getFullYear();
    const displayMonth = now.getMonth() + 1;
    const displayPeriod = suffix === 'Pre' ? '상반기' : '하반기';
    const displayDateStr = `${displayYear}년 ${displayMonth}월 ${displayPeriod}`;

    // 3. 마감일 계산
    let deadlineDate;
    if (suffix === 'Pre') {
        deadlineDate = new Date(now.getFullYear(), now.getMonth(), 13, 23, 59, 59);
    } else {
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        deadlineDate = new Date(now.getFullYear(), now.getMonth(), lastDay - 2, 23, 59, 59);
    }
    
    const isDeadlinePassed = now > deadlineDate;
    const deadlineStr = `${deadlineDate.getMonth()+1}월 ${deadlineDate.getDate()}일`;

    // 4. UI 그리기
    container.innerHTML = `
        <div class="pro-header">
            <div style="font-size:2rem; margin-bottom:10px;">🎓</div>
            <h2 class="pro-title">PRO STRATEGY LOUNGE</h2>
            <p class="pro-desc">
                상위 1%를 위한 프리미엄 분석 센터입니다.<br>
                <strong>${displayDateStr}</strong> 회차 리포트 요청이 진행 중입니다.
            </p>
        </div>

        <div class="pro-dashboard-layout">
            <div class="dashboard-actions">
                <div style="color:#bfdbfe; margin-bottom:15px; font-size:0.95rem;">
                    ⏳ 요청 마감: <strong>${deadlineStr}</strong> 까지
                </div>
                <div id="requestBtnContainer">
                    <button class="req-btn" onclick="openProReportModal()">
                        <i class="fas fa-edit"></i> 분석 요청서 작성하기
                    </button>
                </div>
            </div>

            <div class="report-list-container">
                <h4 style="color:white; margin:0 0 15px 0; border-left:4px solid #3b82f6; padding-left:10px;">
                    📑 분석 보고서 보관함
                </h4>
                <div id="proReportListArea">
                    <div style="text-align:center; color:#64748b; padding:20px;">
                        <i class="fas fa-spinner fa-spin"></i> 로딩 중...
                    </div>
                </div>
            </div>
        </div>
    `;

    // 데이터 로드 후 버튼 상태 업데이트
    loadProReports(currentKey, isDeadlinePassed);
}

let cachedProReports = []; // 전역 변수 추가

// 1. [신규 추가] 26MarPre -> "26년 3월 전반기" 로 예쁘게 바꿔주는 변환 함수
function formatReportKey(key) {
    if (!key || key.length < 7) return key; // 예외 처리

    const yearStr = key.substring(0, 2);  // "26"
    const monthStr = key.substring(2, 5); // "Mar"
    const periodStr = key.substring(5);   // "Pre" 또는 "Post"

    const monthMap = {
        'Jan': '1월', 'Feb': '2월', 'Mar': '3월', 'Apr': '4월', 'May': '5월', 'Jun': '6월',
        'Jul': '7월', 'Aug': '8월', 'Sep': '9월', 'Oct': '10월', 'Nov': '11월', 'Dec': '12월'
    };

    const year = `${yearStr}년`;
    const month = monthMap[monthStr] || monthStr;
    const period = periodStr === 'Pre' ? '전반기' : (periodStr === 'Post' ? '후반기' : periodStr);

    return `${year} ${month} ${period}`;
}


// 2. [수정된 함수] 학생용 PRO 리포트 로드 함수
async function loadProReports(currentKey, isDeadlinePassed) {
    const listArea = document.getElementById('proReportListArea');
    const btnContainer = document.getElementById('requestBtnContainer');
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    try {
        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_pro_reports', userId: userId, requesterRole: 'student' })
        });
        const data = await res.json();
        cachedProReports = data.reports || []; // [{key, request, reportLink, status}, ...]

        // 1. 리스트 렌더링
        if (cachedProReports.length === 0) {
            listArea.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:30px;">발행된 보고서가 없습니다.</div>`;
        } else {
            let html = '<div class="report-grid">';
            cachedProReports.forEach(rep => {
                
                // 🚨 핵심 수정 1: 튜터가 최종 전송한 'published' 상태일 때만 열람 가능하도록 수정!
                // (과거에 이미 발송된 'sent' 상태의 보고서도 열람 가능하도록 호환성 유지)
                const isReady = (rep.status === 'published' || rep.status === 'sent');
                
                const statusBadge = isReady 
                    ? '<span style="color:#4ade80; font-size:0.8rem;">● 열람 가능</span>' 
                    : '<span style="color:#fbbf24; font-size:0.8rem;">● 분석중</span>';
                
                // 🚨 핵심 수정 2: 포맷팅 함수를 사용해 예쁜 이름으로 출력
                const formattedName = formatReportKey(rep.key);
                
                html += `
                    <div class="report-item" onclick="${isReady ? `window.open('${rep.reportLink}')` : "alert('튜터가 리포트를 최종 검수 중입니다. 잠시만 기다려주세요.')"}" style="cursor:${isReady?'pointer':'default'}">
                        <div class="rep-info">
                            <strong>${formattedName} 보고서</strong>
                            ${statusBadge}
                        </div>
                        <div class="rep-icon"><i class="fas fa-download" style="color:${isReady?'#3b82f6':'#475569'}"></i></div>
                    </div>
                `;
            });
            html += `</div>`;
            listArea.innerHTML = html;
        }

        // 2. 요청 버튼 상태 업데이트 (이 부분은 기존과 동일)
        const currentData = cachedProReports.find(r => r.key === currentKey);
        const hasRequested = currentData && currentData.request;

        if (isDeadlinePassed) {
            btnContainer.innerHTML = `
                <button class="req-btn disabled" disabled style="background:#e2e8f0; color:#94a3b8; cursor:not-allowed;">
                    <i class="fas fa-lock"></i> 접수 마감됨
                </button>
            `;
        } else if (hasRequested) {
            // 이미 요청함 -> 수정 모드
            btnContainer.innerHTML = `
                <button class="req-btn" style="background:#dcfce7; color:#166534; border:1px solid #86efac;" onclick="modifyProRequest()">
                    <i class="fas fa-check-circle"></i> 요청 완료 (수정하기)
                </button>
            `;
            document.getElementById('proReportRequest').value = currentData.request;
        } else {
            // 요청 안 함 -> 기본 버튼 유지
        }

    } catch (e) {
        console.error(e);
    }
}

function modifyProRequest() {
    if(confirm("이미 제출된 요청사항을 수정하시겠습니까?")) {
        openProReportModal();
    }
}

// ------------------------------------------------------------
// 모달 관련 기능
// ------------------------------------------------------------
function openProReportModal() {
    const modal = document.getElementById('proReportModal');
    const textarea = document.getElementById('proReportRequest');
    if (modal) {
        modal.style.display = 'block';
        if(textarea) {
            textarea.value = ''; // 초기화
            textarea.focus();
            updateCharCount(textarea); // 글자수 초기화
        }
        document.body.style.overflow = 'hidden';
    }
}

function closeProModal() {
    document.getElementById('proReportModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// [API] PRO 보고서 요청 제출
async function submitProReport() {
    const text = document.getElementById('proReportRequest').value;
    if (text.trim().length < 10) {
        alert("요청 사항을 10자 이상 구체적으로 적어주세요.");
        return;
    }

    if (!confirm("작성하신 내용으로 보고서를 요청하시겠습니까?\n(제출 후에는 수정이 어렵습니다)")) return;

    const submitBtn = document.querySelector('.pro-submit-btn');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "처리 중...";
    submitBtn.disabled = true;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    try {
        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'request_pro_report',
                userId: userId,
                requestText: text
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.msg || "요청이 정상적으로 접수되었습니다.");
            
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'pro'); // type이 'pro'이므로 이렇게 세팅
            window.location.href = url.toString();
        } else {
            // [수정] 서버에서 보낸 msg가 있으면 쓰고, 없으면 기본 한글 메시지 출력
            const errorMsg = data.msg || "요청 처리 중 오류가 발생했습니다.";
            throw new Error(errorMsg);
        }

    } catch (e) {
        console.error("Submit Error:", e);
        // e.message에 이미 위에서 정의한 한글 메시지가 담겨 있습니다.
        alert(e.message); 
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

// 글자수 세기 리스너 연결 (DOMContentLoaded 등에 추가)
document.addEventListener('input', function(e) {
    if(e.target.id === 'proReportRequest') {
        const countSpan = e.target.parentElement.querySelector('.char-count span');
        if(countSpan) countSpan.innerText = e.target.value.length;
    }
});

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
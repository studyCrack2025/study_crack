// js/analysis.js

// ============================================================
// [설정] API 및 상수 정의
// ============================================================
const MYPAGE_API_URL = CONFIG.api.base;
const UNIV_DATA_API_URL = CONFIG.api.analysis;

let currentUserTier = 'free';
let univChangeRemaining = 30;
let userRecentPaymentDate = null;
let userTargetUnivs = [null, null, null, null, null, null]; // 6슬롯
let univData = []; 
let univMap = {};  
let userQuantData = null; 
let weeklyDataHistory = [];
let currentSelectStep = 'univ';
let selectedUnivForMajor = '';

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
        
        if (data.payments && Array.isArray(data.payments)) {
            const paid = data.payments.filter(p => p.status === 'paid').sort((a,b) => new Date(b.date) - new Date(a.date));
            if (paid.length > 0 && paid[0].date) {
                userRecentPaymentDate = new Date(paid[0].date);
            }
        }
        
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
        univChangeRemaining = data.univChangeRemaining !== undefined ? data.univChangeRemaining : 30;
        
        updateQuotaUI();
        
        // 대학 매핑 빌드
        if (typeof buildUnivMap === 'function') buildUnivMap();
        
        // 프로필 이미지 (사이드바)
        if (data && data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if (imgElem) imgElem.src = escapeHtml(data.profileImage);
        }
    } catch (error) { 
        console.error("User Data Error:", error); 
        if(error.message.includes("401")) { location.href='/login'; }
    }
}

function renderUserInfo(data) {
    const nameEl = document.getElementById('userNameDisplay');
    const tierBadgeEl = document.getElementById('userTierBadge');
    
    // 1. 이름 렌더링
    if (nameEl) nameEl.innerText = data.name || '이름 없음';
    
    // 2. 이메일 대신 티어 뱃지 렌더링
    if (tierBadgeEl) {
        const tier = data.computedTier || 'free';
        let tierText = 'FREE';
        let tierClass = 'tier-badge-free';
        let iconHtml = '';

        if (tier === 'basic') { 
            tierText = 'BASIC'; 
            tierClass = 'tier-badge-basic'; 
        }
        else if (tier === 'standard') { 
            tierText = 'STANDARD'; 
            tierClass = 'tier-badge-standard'; 
            iconHtml = '<i class="fas fa-gem" style="margin-right:4px;"></i>';
        }
        else if (tier === 'pro') { 
            tierText = 'PRO'; 
            tierClass = 'tier-badge-pro'; 
            iconHtml = '<i class="fas fa-crown" style="margin-right:4px;"></i>';
        }

        tierBadgeEl.className = `user-tier-badge ${tierClass}`;
        tierBadgeEl.innerHTML = `${iconHtml}${tierText} 멤버십`;
    }
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
// 1. 기존 initUnivGrid() 함수 전체를 아래 코드로 교체하세요.
function initUnivGrid() {
    const grid = document.getElementById('univGrid');
    if(!grid) return;
    
    grid.innerHTML = ''; 
    
    const isQuotaZero = (currentUserTier === 'free' || currentUserTier === 'basic') && (univChangeRemaining <= 0);

    for (let i = 0; i < 6; i++) {
        const savedData = userTargetUnivs[i] || { univ: '', major: '', date: null };
        const slotDiv = document.createElement('div');
        
        slotDiv.className = 'univ-slot';
        slotDiv.style.position = 'relative'; // 삭제 버튼 위치 조정을 위해 필수
        
        const safeUniv = escapeHtml(savedData.univ);
        const safeMajor = escapeHtml(savedData.major);
        const hasData = !!(savedData.univ && savedData.major); // 데이터 존재 여부
        
        const btnText = hasData
            ? `<strong>${safeUniv}</strong><br><small>${safeMajor}</small>` 
            : `<span class="placeholder">대학 및 학과를 선택하세요</span>`;
        
        // 횟수가 0이면 대학 변경(클릭)만 막음 (삭제는 가능)
        const clickHandler = isQuotaZero ? '' : `openUnivSelectModal(${i})`;
        const cursorStyle = isQuotaZero ? 'cursor:not-allowed; opacity:0.8; background-color:#f1f5f9;' : '';
        const iconHtml = isQuotaZero ? '<i class="fas fa-lock" style="color:#ef4444;"></i>' : '<i class="fas fa-chevron-right"></i>';

        // 대학이 설정되어 있을 때만 '삭제' 버튼 표시
        const deleteBtnHtml = hasData 
            ? `<button class="univ-delete-btn" onclick="clearUnivSlot(${i})" title="대학 삭제"><i class="fas fa-times"></i></button>` 
            : '';

        slotDiv.innerHTML = `
            <label>지망 ${i+1}</label>
            ${deleteBtnHtml}
            <button type="button" class="univ-select-btn" onclick="${clickHandler}" style="${cursorStyle}" ${isQuotaZero ? 'disabled' : ''}>
                <div style="text-align: left;">${btnText}</div>
                ${iconHtml}
            </button>
        `;
        grid.appendChild(slotDiv);
    }
}

function clearUnivSlot(index) {
    const isBasic = (currentUserTier === 'free' || currentUserTier === 'basic');
    const msg = isBasic 
        ? `${index + 1}지망 대학을 삭제하시겠습니까?\n(대학을 삭제하는 것은 횟수가 차감되지 않습니다.\n삭제 후 하단의 '저장하기'를 눌러야 반영됩니다.)`
        : `${index + 1}지망 대학을 삭제하시겠습니까?\n(삭제 후 하단의 '저장하기'를 눌러야 반영됩니다.)`;

    if (confirm(msg)) {
        userTargetUnivs[index] = null; // 해당 슬롯 비우기
        initUnivGrid(); // 화면 즉시 다시 그리기
    }
}

// 횟수 상태를 화면에 그려주는 함수
function updateQuotaUI() {
    const container = document.getElementById('univQuotaContainer');
    if (!container) return;

    if (currentUserTier === 'standard' || currentUserTier === 'pro') {
        container.innerHTML = `<div class="quota-info-box" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534; flex-wrap:wrap; gap:8px;">
            <span><i class="fas fa-check-circle"></i> Standard/Pro 멤버십 혜택</span>
            <span style="font-weight:bold;">목표대학 무제한 설정 가능</span>
        </div>`;
        return;
    }

    const isWarning = univChangeRemaining < 10;
    const isUpsell = univChangeRemaining <= 5;
    const isZero = univChangeRemaining <= 0;

    let boxStyle = '';
    let textColor = '#2563eb';
    
    if (isZero) { boxStyle = 'background:#fef2f2; border-color:#fecaca;'; textColor = '#ef4444'; }
    else if (isWarning) { boxStyle = 'background:#fff7ed; border-color:#fed7aa;'; textColor = '#ea580c'; }

    let html = `<div class="quota-info-box" style="${boxStyle} flex-wrap:wrap; gap:8px;">
        <span><i class="fas fa-ticket-alt"></i> 목표대학 설정 잔여 횟수</span>
        <span><strong class="remain-count" style="font-size:1.2rem; color:${textColor};">${univChangeRemaining}</strong> / 30회</span>
    </div>`;

    if (isUpsell) {
        const bannerStyle = isZero ? 'border-color:#ef4444; background:#fef2f2;' : 'border-color:#fb923c; background:#fffaf0;';
        const btnStyle = isZero ? 'background:#ef4444;' : 'background:#ea580c;';
        const msg = isZero ? '⛔ <strong>목표대학 설정 횟수가 모두 소진되었습니다!</strong>' : `⚠️ <strong>설정 가능 횟수가 ${univChangeRemaining}회밖에 남지 않았습니다!</strong>`;
        
        html += `<div class="upgrade-promo-banner" style="${bannerStyle} flex-wrap:wrap; gap:12px;">
            <div style="flex:1; min-width:240px; word-break:keep-all;">
                <p style="margin:0; font-size:0.9rem; line-height:1.5;">
                    ${msg}<br>Standard 멤버십으로 업그레이드하고 <strong>무제한 대학 분석</strong>을 이용해보세요.
                </p>
            </div>
            <button class="upgrade-btn-small" style="${btnStyle} margin:0; flex:1; min-width:140px; padding:12px;" onclick="location.href='/payment'">멤버십 알아보기</button>
        </div>`;
    }
    
    container.innerHTML = html;
}

function openUnivSelectModal(index) {
    currentSlotIndex = index;
    const modal = document.getElementById('univSelectModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // 검색창 초기화
    const searchInput = document.getElementById('univSearchInput');
    if(searchInput) searchInput.value = '';
    
    showUnivStep();
}

function closeUnivModal() {
    document.getElementById('univSelectModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentSlotIndex = null;
    selectedUnivForMajor = '';
}

function showUnivStep() {
    currentSelectStep = 'univ';
    selectedUnivForMajor = '';
    
    document.getElementById('modalTitle').innerText = "대학 선택";
    document.getElementById('stepUnivList').style.display = 'grid';
    document.getElementById('stepMajorList').style.display = 'none';
    document.getElementById('modalFooter').style.display = 'none';
    
    // 검색 플레이스홀더 변경 및 입력창 비우기
    const searchInput = document.getElementById('univSearchInput');
    if(searchInput) {
        searchInput.placeholder = "대학명 검색 (예: 서울대, 연세)";
        searchInput.value = '';
    }
    
    renderUnivList(''); // 검색어 없이 전체 리스트 렌더링
}

function showMajorStep(univName) {
    currentSelectStep = 'major';
    selectedUnivForMajor = univName;
    
    document.getElementById('modalTitle').innerText = `${univName} - 학과 선택`;
    document.getElementById('stepUnivList').style.display = 'none';
    document.getElementById('stepMajorList').style.display = 'grid';
    document.getElementById('modalFooter').style.display = 'flex';
    
    // 검색 플레이스홀더 변경 및 입력창 비우기
    const searchInput = document.getElementById('univSearchInput');
    if(searchInput) {
        searchInput.placeholder = "학과명 검색 (예: 컴퓨터, 경영)";
        searchInput.value = '';
    }
    
    renderMajorList(univName, ''); // 검색어 없이 전체 리스트 렌더링
}

function handleModalSearch(e) {
    const text = e.target.value.trim().toLowerCase();
    if (currentSelectStep === 'univ') {
        renderUnivList(text);
    } else if (currentSelectStep === 'major') {
        renderMajorList(selectedUnivForMajor, text);
    }
}

function renderUnivList(filterText) {
    const listContainer = document.getElementById('stepUnivList');
    listContainer.innerHTML = '';
    
    const allUnivs = Object.keys(univMap).sort();
    const filteredUnivs = allUnivs.filter(u => u.toLowerCase().includes(filterText));
    
    if (filteredUnivs.length === 0) {
        listContainer.innerHTML = '<div class="empty-search-result"><i class="fas fa-search" style="font-size:2.5rem; color:#cbd5e1;"></i>찾으시는 대학이 없습니다.</div>';
        return;
    }

    filteredUnivs.forEach(univName => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerHTML = highlightSearchText(escapeHtml(univName), filterText);
        item.onclick = () => showMajorStep(univName);
        listContainer.appendChild(item);
    });
}

function renderMajorList(univName, filterText) {
    const listContainer = document.getElementById('stepMajorList');
    listContainer.innerHTML = '';
    
    const majors = univMap[univName] || [];
    const filteredMajors = [...majors]
        .sort((a,b) => a.name.localeCompare(b.name))
        .filter(m => m.name.toLowerCase().includes(filterText));
    
    if (filteredMajors.length === 0) {
        listContainer.innerHTML = '<div class="empty-search-result"><i class="fas fa-search" style="font-size:2.5rem; color:#cbd5e1;"></i>찾으시는 학과가 없습니다.</div>';
        return;
    }

    filteredMajors.forEach(majorObj => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerHTML = highlightSearchText(escapeHtml(majorObj.name), filterText);
        item.onclick = () => selectComplete(univName, majorObj.name);
        listContainer.appendChild(item);
    });
}

// 텍스트 하이라이트 유틸리티 (검색된 키워드 파란색으로 강조)
function highlightSearchText(text, keyword) {
    if (!keyword) return text;
    // 정규식으로 대소문자 구분 없이 검색어 찾기
    const regex = new RegExp(`(${keyword})`, 'gi');
    return text.replace(regex, '<span style="color:#2563EB; font-weight:900;">$1</span>');
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
    // 저장 확인 메시지만 티어별로 다르게 출력
    if (currentUserTier === 'free' || currentUserTier === 'basic') {
        if(!confirm("목표 대학을 저장하시겠습니까?\n(변경된 대학 수만큼 남은 횟수에서 차감됩니다.)")) return;
    } else {
        if(!confirm("목표 대학을 저장하시겠습니까?")) return;
    }

    const newUnivs = [...userTargetUnivs]; 
    const nowISO = new Date().toISOString();
    
    // 무조건 6칸 채워서 보내기
    while(newUnivs.length < 6) newUnivs.push(null);
    for(let i = 0; i < 6; i++) {
        if (newUnivs[i] && newUnivs[i].univ && newUnivs[i].major) { 
            if (!newUnivs[i].date) newUnivs[i].date = nowISO; 
        } else { 
            newUnivs[i] = null; 
        }
    }
    
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); 
    
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_target_univs', userId: userId, data: newUnivs })
        });
        
        const resData = await response.json();
        
        if(response.ok) { 
            const msg = resData.changedCount > 0 
                ? `저장되었습니다. (차감 횟수: ${resData.changedCount}회, 남은 횟수: ${resData.remainCount}회)` 
                : "저장되었습니다. (변경된 내용 없음)";
            alert(msg); 
            location.reload(); 
        } else { 
            // 서버에서 "횟수 부족" 400 에러를 던지면 여기서 잡힘
            throw new Error(resData.error || "저장 실패"); 
        }
    } catch(e) { 
        alert(e.message || "통신 오류 발생"); 
    }
}

// ============================================================
// [기능 2] 목표대학 분석 리포트
// ============================================================
async function updateAnalysisUI() {
    const container = document.getElementById('univAnalysisResult');
    if (!container) return;
    
    if (currentUserTier === 'free') {
        return; 
    }
    
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

// 1. 초기화
function initSimulation() {
    if (currentUserTier === 'free') {
        return;
    }
    
    const chartArea = document.getElementById('simChartArea');
    if (!userQuantData || Object.keys(userQuantData).length === 0) {
        chartArea.innerHTML = 
            `<div style="width:100%; height:100%; min-height: 200px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; color:#94a3b8;">
                <i class="fas fa-exclamation-circle fa-2x" style="color:#cbd5e1;"></i>
                <span style="font-weight:600;">성적 데이터를 먼저 입력해야 시뮬레이션을 실행할 수 있습니다.</span>
            </div>`;
        return;
    }
    
    if (!currentExamMode || !userQuantData[currentExamMode]) {
        const availableExams = Object.keys(userQuantData).filter(k => userQuantData[k] && (userQuantData[k].kor || userQuantData[k].math || userQuantData[k].eng));
        if (availableExams.length > 0) {
            currentExamMode = availableExams[0];
        } else {
            chartArea.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8;">유효한 성적 데이터가 없습니다.</div>`;
            return;
        }
    }

    const validTargets = userTargetUnivs ? userTargetUnivs.filter(t => t && t.univ) : [];
    if (validTargets.length === 0) {
        chartArea.innerHTML = 
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

    const getBadgeHTML = () => `
        <div class="sim-info-badge">
            <span><i class="fas fa-history"></i> ${examName} 기준</span>
        </div>
    `;

    // 막대그래프 확장(흰색) 및 모바일 터치 깜빡임 방지 전용 CSS
    if (!document.getElementById('simExtensionStyle')) {
        const style = document.createElement('style');
        style.id = 'simExtensionStyle';
        style.innerHTML = `
            .sim-extension-bar { width: 40px; background: #ffffff !important; border: 2px dashed #f59e0b; border-bottom: none; border-radius: 6px 6px 0 0; box-sizing: border-box; pointer-events: none; z-index: 2; position: absolute; }
            /* 🚀 모바일 터치 시 발생하는 회색 음영 깜빡임 완벽 제거 */
            .sim-bar-item, .sim-label-item { -webkit-tap-highlight-color: transparent; }
            @media (max-width: 768px) { .sim-extension-bar { width: 28px; } }
        `;
        document.head.appendChild(style);
    }

    // ==================================================================================
    // [TYPE: BAR] 막대 그래프
    // ==================================================================================
    if (currentSimChartType === 'bar') {
        simSvgRefs = null;

        // 🚀 [핵심] DOM이 없을 때만 딱 한 번 HTML을 생성! (클릭 시 새로고침 깜빡임 방지)
        if (!document.getElementById('simBarWrapper')) {
            container.innerHTML = ''; 
            container.style.overflow = 'visible';

            const wrapper = document.createElement('div');
            wrapper.id = 'simBarWrapper';
            wrapper.className = 'chart-inner-container';
            wrapper.style.height = 'auto'; 
            wrapper.style.minHeight = '360px';

            wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());
            
            const graphArea = document.createElement('div');
            graphArea.className = 'chart-graph-area';
            
            const labelArea = document.createElement('div');
            labelArea.className = 'chart-label-area';

            const isMobile = window.innerWidth <= 768;
            const MAX_SCORE = 250; 

            // 🚀 [스케일 픽스] padding-top을 완전히 제거하고 margin-top 적용. 
            // 이로써 막대의 %와 점선의 %가 완벽히 동일한 좌표계를 공유하게 됨
            if (isMobile) {
                graphArea.style.padding = '0 15px'; // top, bottom 패딩 0
                graphArea.style.marginTop = '40px'; 
                graphArea.style.height = '200px'; 
            } else {
                graphArea.style.padding = '0 60px 0 20px'; // top, bottom 패딩 0
                graphArea.style.marginTop = '50px'; 
                graphArea.style.height = '260px'; 
            }

            let graphHtml = '';
            let labelHtml = '';

            const guideStyle100 = `bottom: ${(100 / MAX_SCORE) * 100}%; border-top-color: #3b82f6;`;
            const guideStyle150 = `bottom: ${(150 / MAX_SCORE) * 100}%; border-top-color: #10b981;`;
            
            graphHtml += `<div class="chart-guide-line guide-100" style="${guideStyle100}"><span class="chart-guide-label">합격(100)</span></div>`;
            graphHtml += `<div class="chart-guide-line guide-150" style="${guideStyle150}"><span class="chart-guide-label">안정(150)</span></div>`;

            cachedSimData.forEach((item, index) => {
                const score = item.base_ui_score;
                const currentHeightPct = `${(score / MAX_SCORE) * 100}%`;
                
                let color = '#ef4444'; 
                if (score >= 150) color = '#10b981'; 
                else if (score >= 100) color = '#3b82f6';

                const safeScore = Math.round(score);
                const shortUniv = item.univ.replace('학교', '');

                let extensionHtml = '';
                let maxRise = 0;
                
                if (item.sim_data) {
                    Object.values(item.sim_data).forEach(sub => { if (sub && sub.uiDiff > maxRise) maxRise = sub.uiDiff; });
                }

                // 🚀 클릭 안해도 상승분(주황선) HTML은 미리 다 그려두되, display:none으로 숨겨둠
                if (maxRise > 0 && score < MAX_SCORE) {
                    const potentialScore = Math.min(score + maxRise, MAX_SCORE);
                    const riseAmount = potentialScore - score; 
                    const riseHeightPct = `${(riseAmount / MAX_SCORE) * 100}%`;
                    
                    extensionHtml = `
                        <div class="sim-extension-bar" style="bottom:${currentHeightPct}; height:${riseHeightPct}; display:none;">
                             <span style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); color:#d97706; font-size:0.8rem; font-weight:800; white-space:nowrap;">
                                ${Math.round(potentialScore)} <span style="font-size:0.7rem;">(+${maxRise.toFixed(1)})</span>
                             </span>
                        </div>
                    `;
                }

                graphHtml += `
                    <div class="sim-bar-item" onclick="selectSimUniv(${index})">
                        <div style="position:relative; height:100%; width:100%; display:flex; justify-content:center;">
                            <div class="sim-bar" style="position:absolute; bottom:0; height:${currentHeightPct}; background:${color}; border-radius:6px 6px 0 0; z-index:1;">
                                <span class="sim-score-label">${safeScore}</span>
                            </div>
                            ${extensionHtml}
                        </div>
                    </div>
                `;

                labelHtml += `
                    <div class="sim-label-item" onclick="selectSimUniv(${index})">
                        <span class="label-mobile">${index + 1}지망</span>
                        <span class="label-pc">
                            <strong>${index + 1}지망</strong><br>${shortUniv}<br>${item.major}
                        </span>
                    </div>
                `;
            });

            graphArea.innerHTML = graphHtml;
            labelArea.innerHTML = labelHtml;

            wrapper.appendChild(graphArea);
            wrapper.appendChild(labelArea);

            const mobileLegendDiv = document.createElement('div');
            mobileLegendDiv.className = 'mobile-legend-area';
            mobileLegendDiv.innerHTML = `
                <div class="mobile-legend-item">
                    <div style="width:12px; height:2px; background:#10b981; margin-right:4px;"></div> 안정(150)
                </div>
                <div class="mobile-legend-item">
                    <div style="width:12px; height:2px; background:#3b82f6; margin-right:4px;"></div> 합격(100)
                </div>
            `;

            container.appendChild(wrapper);
            container.appendChild(mobileLegendDiv);
        }
        
        // 🚀 클릭 시 전체를 렌더링하지 않고, 이 헬퍼 함수를 통해 속성만 변경 (새로고침 현상 원천 차단)
        updateSimBarGraph(selectedSimIndex || 0);
    }
    // ==================================================================================
    // [TYPE: LINE] 꺾은선 그래프
    // ==================================================================================
    else if (currentSimChartType === 'line') {
        if (!document.getElementById('simLineWrapper')) {
            container.innerHTML = '';
            container.style.overflow = 'visible';

            const wrapper = document.createElement('div');
            wrapper.id = 'simLineWrapper';
            wrapper.className = 'sim-line-container';
            wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());

            const chartArea = document.createElement('div');
            chartArea.className = 'sim-line-chart-area';
            chartArea.style.overflow = "visible"; 

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

// 막대를 클릭할 때 DOM을 부수지 않고 디자인만 매끄럽게 교체합니다.
function updateSimBarGraph(idx) {
    const items = document.querySelectorAll('.sim-bar-item');
    
    items.forEach((item, i) => {
        const extBar = item.querySelector('.sim-extension-bar');
        const mainBar = item.querySelector('.sim-bar');
        const scoreLabel = item.querySelector('.sim-score-label');
        
        if (i === idx) {
            item.classList.add('active');
            if (extBar) {
                extBar.style.display = 'block'; // 숨겨둔 주황선 노출
                if (mainBar) mainBar.style.borderRadius = '0 0 0 0'; // 모서리 직각으로
                if (scoreLabel) scoreLabel.style.display = 'none'; // 점수 텍스트 숨김
            }
        } else {
            item.classList.remove('active');
            if (extBar) {
                extBar.style.display = 'none'; // 주황선 숨김
            }
            if (mainBar) mainBar.style.borderRadius = '6px 6px 0 0';
            if (scoreLabel) scoreLabel.style.display = '';
        }
    });
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
        gBottom: createGuideGroup(ns, "#cbd5e1", ""),
        gMid: createGuideGroup(ns, "#cbd5e1", ""),
        gTop: createGuideGroup(ns, "#cbd5e1", ""),
        g100: createGuideGroup(ns, "#3b82f6", "100 합격"),
        g150: createGuideGroup(ns, "#10b981", "150 안정")
    };

    const path = document.createElementNS(ns, "path");
    path.setAttribute("class", "sim-path");

    svg.appendChild(guides.gBottom.g);
    svg.appendChild(guides.gMid.g);
    svg.appendChild(guides.gTop.g);
    svg.appendChild(guides.g100.g);
    svg.appendChild(guides.g150.g);
    
    // 선을 점보다 먼저 붙입니다.
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
        
        svg.appendChild(c); 
        labelsGroup.appendChild(t); 
        points.push(c);
        labels.push(t);
    }
    
    // 라벨(텍스트)은 가장 위에 오도록 마지막에 붙입니다.
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

    const TARGET_HEIGHT = 260; 
    
    simSvgRefs.svg.parentNode.style.height = `${TARGET_HEIGHT}px`;
    simSvgRefs.svg.parentNode.style.minHeight = `${TARGET_HEIGHT}px`;

    const svgEl = simSvgRefs.svg;
    const W = svgEl.clientWidth || 300; 
    
    // 1. X축 텍스트
    const realNames = ['국어', '수학'];
    realNames.push(data.sim_data.inq1?.name || '탐구1');
    realNames.push(data.sim_data.inq2?.name || '탐구2');
    simSvgRefs.xAxisTexts.forEach((span, i) => { span.innerText = realNames[i]; });

    // 2. 점수 데이터 추출
    const keys = ['kor', 'math', 'inq1', 'inq2'];
    const currentScore = data.base_ui_score;
    const scores = keys.map(k => {
        const rise = (data.sim_data && data.sim_data[k]) ? data.sim_data[k].uiDiff : 0;
        return Math.min(250, currentScore + rise);
    });

    // 3. 간격(GAP) 동적 계산 및 Y축 완전 고정 맵핑
    let minS = Math.min(...scores);
    let maxS = Math.max(...scores);
    const scoreDiff = maxS - minS;

    let GAP = 25;
    if (scoreDiff > 160) GAP = 125;
    else if (scoreDiff > 90) GAP = 100;
    else if (scoreDiff > 40) GAP = 50;
    
    let centerScore = (minS + maxS) / 2;
    let midLine = Math.round(centerScore / 25) * 25;

    if (midLine + GAP < maxS) midLine += 25;
    if (midLine - GAP > minS) midLine -= 25;

    if (midLine - GAP < 0) midLine = GAP;
    if (midLine + GAP > 250) midLine = 250 - GAP;

    const midY = 130; 
    const pixelPerGap = 90; 
    const getY = (score) => midY - ((score - midLine) / GAP) * pixelPerGap;

    // 4. 가이드 라인 그리기
    const targetGuides = [
        { obj: simSvgRefs.guides.gBottom, val: midLine - GAP, isFixed: false },
        { obj: simSvgRefs.guides.gMid, val: midLine, isFixed: false },
        { obj: simSvgRefs.guides.gTop, val: midLine + GAP, isFixed: false },
        { obj: simSvgRefs.guides.g100, val: 100, isFixed: true, label: "100 합격" },
        { obj: simSvgRefs.guides.g150, val: 150, isFixed: true, label: "150 안정" }
    ];

    targetGuides.forEach(guide => {
        const { obj, val, isFixed, label } = guide;
        
        if (val >= midLine - GAP && val <= midLine + GAP) {
            obj.g.style.opacity = 1;
            const y = getY(val);
            
            obj.line.setAttribute("x1", 0);
            obj.line.setAttribute("x2", W); 
            obj.line.setAttribute("y1", y);
            obj.line.setAttribute("y2", y);
            
            obj.text.setAttribute("x", W - 5);
            obj.text.setAttribute("y", y - 4);
            
            if (isFixed) {
                obj.text.textContent = label;
                obj.line.style.opacity = 1;
            } else {
                if (val === 100 || val === 150) {
                    obj.text.textContent = "";
                    obj.line.style.opacity = 0;
                } else {
                    obj.text.textContent = val;
                    obj.line.style.opacity = 0.5;
                }
            }
        } else {
            obj.g.style.opacity = 0;
        }
    });

    // 5. 꺾은선 패스 & 점 그리기
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

    });

    simSvgRefs.path.setAttribute("d", d);
}

// 5. 대학 선택 시 동작
function selectSimUniv(index) {
    selectedSimIndex = index;
    if (currentSimChartType === 'bar') {
        updateSimBarGraph(index);
    } else if (currentSimChartType === 'line') {
        updateSimLineGraph(index);
        
        // 꺾은선일 때 하단 버튼 Active 상태 부드럽게 업데이트
        const btns = document.querySelectorAll('.sim-univ-scroll-box .univ-select-btn');
        btns.forEach((b, idx) => {
            if (idx === index) b.classList.add('active');
            else b.classList.remove('active');
        });
    }
    renderDetailedSimCard(); 
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
    
    // 현재 점수가 250점(MAX)이면 상승폭을 모두 0으로 강제 처리
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

// PDF 파일을 고화질 이미지 리스트로 변환하여 HTML에 삽입하는 함수
async function renderPdfToImages(pdfUrl, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        container.classList.add('is-rendering');

        // PDF.js 워커 설정
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        // 조각(Fragment)을 만들어 이미지를 모두 모은 뒤 한 번에 출력
        const fragment = document.createDocumentFragment();

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 }); // 1.5배 고해상도

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.marginBottom = '15px';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid #cbd5e1';
            img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            img.style.display = 'block';

            fragment.appendChild(img);
        }
        
        container.innerHTML = ''; 
        container.appendChild(fragment); // 한 번에 삽입

    } catch (error) {
        console.error('PDF Render Error:', error);
        container.innerHTML = `
            <div style="color:#ef4444; padding:20px; text-align:center; background:#fef2f2; border-radius:8px;">
                PDF를 화면에 불러오지 못했습니다.<br>
                <a href="${pdfUrl}" target="_blank" style="color:#2563eb; text-decoration:underline;">원본 PDF 열기</a>
            </div>`;
    } finally {
        container.classList.remove('is-rendering'); 
    }
}

// 피드백 상세 모달 열기 및 문서 형식 데이터 바인딩 (맞춤형 보고서 형식)
function openFeedbackModal(data) {
    const modal = document.getElementById('feedbackModal');
    const contentArea = document.querySelector('#feedbackModal .modal-body') || document.getElementById('modalContent'); 

    if (!contentArea) return;

    const fb = data.tutorFeedback || {};
    
    // 1. [체크] 피드백 데이터 확인
    const hasFeedback = fb && (
        (fb.priorityCheck && String(fb.priorityCheck).trim() !== "") || 
        (fb.weakSubject && String(fb.weakSubject).trim() !== "") || 
        (fb.nextWeekTop3 && String(fb.nextWeekTop3).trim() !== "") || 
        (fb.planEvaluation && String(fb.planEvaluation).trim() !== "") ||
        (fb.extraQuestion && String(fb.extraQuestion).trim() !== "") ||
        (fb.tutorImage && String(fb.tutorImage).trim() !== "")
    );

    if (!hasFeedback) {
        contentArea.innerHTML = `
            <div class="pending-view" style="background:#fff; padding:100px 20px; border-radius:16px;">
                <div class="pending-icon" style="font-size:4rem; color:#cbd5e1; margin-bottom:20px;"><i class="fas fa-hourglass-half"></i></div>
                <h2 style="color:#1e293b; margin-bottom:10px; font-weight:800;">피드백 작성 대기중</h2>
                <p style="color:#64748b; margin-bottom:30px;">담당 컨설턴트가 학생의 리포트를 꼼꼼히 분석하고 있습니다.</p>
                <button onclick="document.getElementById('feedbackModal').style.display='none'" style="padding:12px 30px; background:#f1f5f9; border:none; border-radius:8px; font-weight:bold; color:#475569; cursor:pointer;">닫기</button>
            </div>`;
        modal.style.display = 'block';
        return;
    }

    const consultantName = "담당 수석 컨설턴트"; 
    
    // (A) 과목별 학습 시간 디테일 테이블
    let detailRows = '';
    let totalPlan = '0H', totalAct = '0H', totalRate = '0%';
    
    if (data.studyTime) {
        totalPlan = data.studyTime.totalPlan || '0H';
        totalAct = data.studyTime.totalAct || '0H';
        totalRate = data.studyTime.totalRate || '0%';
        
        if (data.studyTime.details && data.studyTime.details.length > 0) {
            data.studyTime.details.forEach(d => {
                const plan = parseFloat(d.plan) || 0;
                const act = parseFloat(d.act) || 0;
                const rate = plan > 0 ? Math.min((act / plan) * 100, 100).toFixed(0) : 0;
                const rateColor = rate >= 80 ? '#10b981' : (rate >= 50 ? '#f59e0b' : '#ef4444');
                
                let mainSub = d.subject;
                let detailSub = "-";
                const match = d.subject.match(/^(.*?)\s*\((.*?)\)$/);
                if(match) {
                    mainSub = match[1];
                    detailSub = match[2];
                }
                
                detailRows += `
                    <tr>
                        <td style="text-align:left; font-weight:700; color:#334155;">${escapeHtml(mainSub)}</td>
                        <td style="color:#64748b; font-size:0.85rem; font-weight:600;">${escapeHtml(detailSub)}</td>
                        <td>${plan}H</td>
                        <td style="color:#2563eb; font-weight:bold;">${act}H</td>
                        <td style="color:${rateColor}; font-weight:800;">${rate}%</td>
                    </tr>`;
            });
        }
    }
    if (!detailRows) detailRows = `<tr><td colspan="5" style="color:#94a3b8; padding:20px;">상세 학습 기록이 없습니다.</td></tr>`;

    // (B) 모의고사 데이터
    let examHtml = '';
    if (data.mockExam && data.mockExam.type && data.mockExam.type !== 'none') {
        const typeMap = { 'school': '교내', 'edu': '평가원/교육청', 'private': '사설' };
        const typeName = typeMap[data.mockExam.type] || '기타';
        
        let scoreDetails = '';
        const s = data.mockExam.scores || {};
        if(s.kor) scoreDetails += `<div style="margin-bottom:6px;"><span style="color:#64748b; font-size:0.85rem;">국어 (${s.korOpt||'-'})</span> <strong style="float:right; color:#1e293b;">${s.kor}</strong></div>`;
        if(s.math) scoreDetails += `<div style="margin-bottom:6px;"><span style="color:#64748b; font-size:0.85rem;">수학 (${s.mathOpt||'-'})</span> <strong style="float:right; color:#1e293b;">${s.math}</strong></div>`;
        if(s.eng) scoreDetails += `<div style="margin-bottom:6px;"><span style="color:#64748b; font-size:0.85rem;">영어</span> <strong style="float:right; color:#1e293b;">${s.eng}</strong></div>`;
        if(s.inq1) scoreDetails += `<div style="margin-bottom:6px;"><span style="color:#64748b; font-size:0.85rem;">${s.inq1Name||'탐구1'}</span> <strong style="float:right; color:#1e293b;">${s.inq1}</strong></div>`;
        if(s.inq2) scoreDetails += `<div style="margin-bottom:6px;"><span style="color:#64748b; font-size:0.85rem;">${s.inq2Name||'탐구2'}</span> <strong style="float:right; color:#1e293b;">${s.inq2}</strong></div>`;
        
        examHtml = `
            <div style="font-weight:800; font-size:1.1rem; color:#1e293b; margin-bottom:15px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">${typeName} 모의고사</div>
            <div style="text-align:left; padding:0 10px;">${scoreDetails || '<div style="color:#94a3b8; text-align:center;">상세 점수 미입력</div>'}</div>`;
    } else {
        examHtml = `<div style="color:#94a3b8; padding:30px 0; font-weight:600;"><i class="fas fa-ban" style="margin-bottom:10px; font-size:1.5rem;"></i><br>이번 주 응시 기록 없음</div>`;
    }

    // (C) 학습 추이 데이터
    let trendHtml = '-', trendReasonsHtml = '';
    if (data.trend) {
        const t = data.trend.status;
        if(t === 'up') trendHtml = '<span style="color:#10b981;"><i class="fas fa-arrow-trend-up"></i> 상승세</span>';
        else if(t === 'down') trendHtml = '<span style="color:#ef4444;"><i class="fas fa-arrow-trend-down"></i> 하락세</span>';
        else trendHtml = '<span style="color:#64748b;"><i class="fas fa-minus"></i> 유지중</span>';
        
        if (data.trend.reasons && data.trend.reasons.length > 0) {
            trendReasonsHtml = `<strong>하락 요인:</strong> ${data.trend.reasons.map(r => escapeHtml(r)).join(', ')}`;
        } else {
            trendReasonsHtml = '학생이 체크한 특이사항이 없습니다.';
        }
    }

    // (D) 심층 Q&A
    let deepQnaHtml = '';
    const QUESTION_CATEGORIES = ['학습 계획 점검', '학습 방향성 설정', '취약 과목 솔루션', '기타 멘탈 관리'];
    if (data.deepAnswers && data.deepAnswers.some(ans => ans && ans.trim() !== "")) {
        data.deepAnswers.forEach((ans, idx) => {
            if (ans && ans.trim() !== "") {
                deepQnaHtml += `
                    <div style="margin-bottom:15px; page-break-inside: avoid;">
                        <strong style="color:#b91c1c; font-size:0.9rem; display:block; margin-bottom:4px;">Q${idx+1}. ${QUESTION_CATEGORIES[idx]}</strong>
                        <div style="color:#334155; font-size:0.95rem; padding-left:10px; border-left:3px solid #fecaca;">${escapeHtml(ans)}</div>
                    </div>`;
            }
        });
    } else {
        deepQnaHtml = '<div style="color:#94a3b8; padding:10px 0;">작성된 심층 질문이 없습니다.</div>';
    }
    
    let tutorFileBlockHtml = '';
    const uniqueContainerId = `pdf-render-${Date.now()}`; // 고유 ID 부여
    let isPdfFile = false;
    let actualPdfUrl = "";

    if (fb.tutorImage && String(fb.tutorImage).trim() !== "") {
        isPdfFile = fb.tutorImage.toLowerCase().includes('.pdf');
        actualPdfUrl = fb.tutorImage;
        
        let fileDisplayHtml = '';
        if (isPdfFile) {
            // PDF인 경우: 변환될 공간(div)만 만들어두고 JS로 이미지를 밀어넣음
            fileDisplayHtml = `
                <div id="${uniqueContainerId}" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
                    <div style="padding: 40px 0; color:#3b82f6; font-weight:bold;" class="pdf-loading-spinner">
                        <i class="fas fa-spinner fa-spin fa-2x" style="margin-bottom:10px;"></i><br>
                        튜터의 첨삭 PDF 문서를 불러오는 중입니다...
                    </div>
                </div>
            `;
        } else {
            // 이미지인 경우: 바로 렌더링
            fileDisplayHtml = `
                <div style="text-align:center; padding: 10px 0;">
                    <img src="${escapeHtml(fb.tutorImage)}" alt="튜터 플래너 코칭" style="max-width:100%; height:auto; border-radius:8px; border:1px solid #cbd5e1; box-shadow:0 4px 10px rgba(0,0,0,0.05); display:block; margin: 0 auto;">
                </div>
            `;
        }

        // 그림자/겹침 현상 해결을 위해 스타일 분리 (clear: both, margin-top 하드코딩)
        tutorFileBlockHtml = `
            <div class="doc-matched-box" style="page-break-inside: auto; clear: both; display: block; margin-top: 30px; float: none; position: relative;">
                <div class="doc-matched-header" style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:15px 20px; font-weight:800;">
                    <i class="fas fa-paperclip" style="color:#3b82f6;"></i> 5. 주간 플래너 코칭 & 첨삭
                </div>
                <div class="doc-matched-body" style="flex-direction:column; padding:25px; gap:15px;">
                    <span class="doc-badge tutor-badge" style="background:#eff6ff; color:#2563eb; border-color:#bfdbfe; align-self:flex-start;">Consultant 첨부 자료</span>
                    ${fileDisplayHtml}
                </div>
            </div>
        `;
    }

    // -----------------------------------------------------------
    // [HTML 조립 파트] 
    // -----------------------------------------------------------
    // 🎯 주의: JS에서 display:none 같은 인라인 스타일 억지 적용을 모두 제거했습니다. CSS가 처리합니다.
    const html = `
        <div class="modal-document" id="pdfTargetDocument">
            <div class="doc-controls" data-html2canvas-ignore="true">
                <button class="btn-pdf" onclick="downloadReportPDF('${data.title || "주간리포트"}')"><i class="fas fa-file-pdf"></i> PDF 파일 다운로드</button>
                <button class="close-btn-doc" onclick="document.getElementById('feedbackModal').style.display='none'">&times;</button>
            </div>

            <div class="doc-header">
                <div>
                    <span class="doc-subtitle">PREMIUM STRATEGY</span>
                    <h2 class="doc-title">스터디크랙 주간 전략리포트</h2>
                </div>
                <div class="doc-meta">
                    <div>대상: <strong>${data.title || "주간 리포트"}</strong></div>
                    <div>발행일: <strong>${new Date(data.date).toLocaleDateString()}</strong></div>
                    <div>분석: <strong>${consultantName}</strong></div>
                </div>
            </div>

            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-clock"></i> 1. 학습 목표 이행 평가</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data">
                        <span class="doc-badge">학생 리포트</span>
                        <table class="doc-table">
                            <thead><tr><th>과목</th><th>세부 내용</th><th>계획</th><th>실제</th><th>달성률</th></tr></thead>
                            <tbody>${detailRows}</tbody>
                        </table>
                        <div style="margin-top:15px; text-align:right; font-size:0.9rem; color:#64748b; font-weight:700; background:#f8fafc; padding:8px; border-radius:6px;">
                            총 달성률 <span style="color:#2563eb; font-size:1.1rem; margin-left:5px;">${totalRate}</span> 
                            <span style="font-weight:normal; font-size:0.8rem;">(${totalAct} / ${totalPlan})</span>
                        </div>
                    </div>
                    <div class="doc-tutor-feedback">
                        <span class="doc-badge tutor-badge">Consultant 코멘트</span>
                        <h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">이전 우선순위 점검 결과</h4>
                        <div class="doc-text">${escapeHtml(fb.priorityCheck) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div>
                    </div>
                </div>
            </div>

            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-bullseye"></i> 2. 실전 성취도 & 취약점 분석</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data">
                        <span class="doc-badge">시험 성적</span>
                        <div style="padding:15px; background:#f8fafc; border-radius:12px; text-align:center; border:1px solid #e2e8f0; height:calc(100% - 50px); display:flex; flex-direction:column; justify-content:center;">
                            ${examHtml}
                        </div>
                    </div>
                    <div class="doc-tutor-feedback">
                        <span class="doc-badge tutor-badge">Consultant 코멘트</span>
                        <h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">취약 과목 진단 및 개선 포인트</h4>
                        <div class="doc-text">${escapeHtml(fb.weakSubject) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div>
                    </div>
                </div>
            </div>

            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-route"></i> 3. 총평 및 Next Step</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data">
                        <span class="doc-badge">학생 컨디션 평가</span>
                        <div style="margin-bottom:15px; font-weight:900; font-size:1.3rem; text-align:center; padding:15px; background:#f8fafc; border-radius:8px;">${trendHtml}</div>
                        <div style="font-size:0.85rem; color:#64748b; background:#fff1f2; border:1px solid #fecaca; padding:12px; border-radius:8px;">
                            ${trendReasonsHtml}
                        </div>
                    </div>
                    <div class="doc-tutor-feedback">
                        <span class="doc-badge tutor-badge">Consultant 코멘트</span>
                        <h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">이번 주 플랜 종합 평가</h4>
                        <div class="doc-text" style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px dashed #cbd5e1;">${escapeHtml(fb.planEvaluation) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div>
                        <h4 style="margin:0 0 10px 0; font-size:1rem; color:#2563eb;"><i class="fas fa-flag-checkered"></i> 다음 주 핵심 과제 TOP 3</h4>
                        <div class="doc-text">${escapeHtml(fb.nextWeekTop3) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div>
                    </div>
                </div>
            </div>

            <div class="doc-matched-box">
                <div class="doc-matched-header" style="background:#fff;"><i class="fas fa-comments"></i> 4. 심층 Q&A 솔루션</div>
                <div class="doc-matched-body" style="flex-direction:column; padding:25px; gap:20px; border-top:1px solid #e2e8f0;">
                    <div class="qna-student">
                        <span class="doc-badge" style="background:#fef2f2; color:#ef4444; border-color:#fecaca;">학생의 심층 질문</span>
                        ${deepQnaHtml}
                    </div>
                    <div class="qna-tutor">
                        <span class="doc-badge tutor-badge" style="background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;">Consultant 추가 코멘트</span>
                        <div class="doc-text">${escapeHtml(fb.extraQuestion) || '<span style="color:#94a3b8">추가 코멘트가 없습니다.</span>'}</div>
                    </div>
                </div>
            </div>
        </div>
        
        ${tutorFileBlockHtml}

        <div class="mobile-only-msg" id="mobileMsgBox">
            <i class="fas fa-file-pdf"></i>
            <h3 style="margin:0 0 10px 0; color:#1e293b;">리포트 도착 완료!</h3>
            <p>모바일에서는 전체 레이아웃 확인이 어렵습니다.<br><strong>PDF 파일로 다운로드</strong>하여 PC와 동일한 프리미엄 포맷으로 확인하세요.</p>
            <button class="mobile-pdf-btn" onclick="downloadReportPDF('${data.title || "주간리포트"}')"><i class="fas fa-download"></i> PDF 다운로드</button>
            <button class="mobile-close-btn" onclick="document.getElementById('feedbackModal').style.display='none'">닫기</button>
        </div>
    `;

    contentArea.innerHTML = html;
    modal.style.display = 'block';
    
    if (isPdfFile) {
        setTimeout(() => {
            renderPdfToImages(actualPdfUrl, uniqueContainerId);
        }, 100);
    }
}

// ============================================================
// PDF 다운로드 기능
// ============================================================
function downloadReportPDF(reportTitle) {
    const reportElement = document.getElementById('pdfTargetDocument');
    if (!reportElement) return alert('리포트 내용을 찾을 수 없습니다.');

    // 1. PDF.js 로딩 스피너가 돌거나 렌더링 중인지 확인
    if (reportElement.querySelector('.pdf-loading-spinner') || reportElement.querySelector('.is-rendering')) {
        alert("튜터의 첨부 문서를 고화질 이미지로 변환 중입니다.\n화면에 문서가 모두 나타난 후 다시 클릭해주세요.");
        return;
    }

    // 2. DOM 객체를 깊은 복사
    const printNode = reportElement.cloneNode(true);
    printNode.classList.add('pdf-rendering');

    const isMobile = window.innerWidth <= 768;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px'; 
    iframe.style.top = '0';
    iframe.style.width = '1024px'; 
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(link => `<link rel="stylesheet" href="${link.href}">`)
        .join('');

    const mobilePrintCSS = isMobile ? `
        body { zoom: 0.7 !important; }
        @supports not (zoom: 0.7) {
            body {
                transform: scale(0.7);
                transform-origin: top left;
                width: 1462px !important;
            }
        }
    ` : '';

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    // 🚨 텍스트(문자열) 출력 방식은 뼈대 HTML만 그리도록 최소화합니다.
    iframeDoc.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <title>스터디크랙_${reportTitle}</title>
            <meta name="viewport" content="width=1024">
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            ${styleLinks}
            <style>
                @page { margin: 20mm 10mm 10mm 10mm; } 

                body { 
                    width: 1024px !important;
                    background: white !important; 
                    margin: 0; padding: 0; 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact; 
                }
                
                * { box-shadow: none !important; }

                .modal-document::after { display: none !important; }
                .doc-controls, .mobile-only-msg { display: none !important; }
                
                .modal-document {
                    width: 100% !important;
                    padding: 40px !important;
                    box-sizing: border-box !important;
                }

                .doc-matched-box { 
                    margin-bottom: 20px !important; 
                    display: block !important; 
                    width: 100% !important;
                    clear: both !important; 
                }
                
                .doc-matched-box:not(:last-child) {
                    page-break-inside: avoid !important; 
                    break-inside: avoid !important; 
                }

                /* 🚨 핵심: 큰 이미지가 백지로 튕기는 현상 원천 차단 */
                .doc-matched-box img {
                    display: block !important;
                    max-width: 100% !important;
                    page-break-inside: auto !important; 
                    break-inside: auto !important;
                }

                .doc-matched-box:not(:last-child):not(:nth-last-child(2)) .doc-matched-body { 
                    display: flex !important; 
                    flex-direction: row !important; 
                    flex-wrap: nowrap !important;
                }
                
                .doc-matched-box:not(:last-child):not(:nth-last-child(2)) .doc-student-data { 
                    border-bottom: none !important; 
                    border-right: 1px dashed #cbd5e1 !important; 
                    flex: 1 1 45% !important; 
                    box-sizing: border-box !important;
                }

                .doc-matched-box:not(:last-child):not(:nth-last-child(2)) .doc-tutor-feedback { 
                    flex: 1 1 55% !important; 
                    box-sizing: border-box !important;
                }

                .doc-matched-box:last-child .doc-matched-body,
                .doc-matched-box:nth-last-child(2) .doc-matched-body {
                    display: flex !important;
                    flex-direction: column !important;
                }

                ${mobilePrintCSS}
            </style>
        </head>
        <body id="print-body">
        </body>
        </html>
    `);
    iframeDoc.close();

    // 🚨 핵심: 수십 메가바이트의 Base64를 문자열로 넘기지 않고 JS 노드로 직접 꽂아 넣음
    iframeDoc.getElementById('print-body').appendChild(printNode);

    // 🚨 핵심: 복사된 이미지들이 인쇄 엔진 메모리에 모두 올라갈 때까지 대기
    const imgs = iframeDoc.querySelectorAll('img');
    let loadedCount = 0;
    
    function checkAllImagesLoaded() {
        if (loadedCount >= imgs.length) {
            // 브라우저 렌더링 큐 처리를 위해 추가로 0.5초 여유 딜레이 부여
            setTimeout(function() {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 500); 
        }
    }

    if (imgs.length === 0) {
        checkAllImagesLoaded();
    } else {
        imgs.forEach(img => {
            if (img.complete) {
                loadedCount++;
            } else {
                img.onload = () => { loadedCount++; checkAllImagesLoaded(); };
                img.onerror = () => { loadedCount++; checkAllImagesLoaded(); };
            }
        });
        // 혹시 캐시 처리로 인해 이벤트가 무시될 경우를 위한 안전장치
        checkAllImagesLoaded(); 
    }

    iframe.contentWindow.onafterprint = function() {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    };
    
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 60000); 
}

function openWeeklyCheckModal() {
    const allowedTiers = ['standard', 'pro'];
    
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
                return;
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

// 페이지 로드 시 호출 필요
function initProSection() {
    const container = document.getElementById('sol-pro');
    if (!container) return;

    if (['pro'].includes(currentUserTier)) {
        renderProDashboard(container);
    } else {
        renderProPromo(container);
    }
}

function renderProPromo(container) {
    container.innerHTML = `
        <div class="pro-header">
            <span class="pro-badge">PREMIUM STRATEGY</span>
            <h2 class="pro-title">PRO EXCLUSIVE :<br>최소 학습, 최대 효율</h2>
            <p class="pro-desc">추상적인 조언은 배제합니다. 데이터 기반으로 목표 대학을 향한 최단 경로를 설계하세요.</p>
        </div>

        <div class="pro-promo-grid">
            <div class="pro-feature-card">
                <span class="feat-icon">📊</span>
                <span class="feat-title">학습 정밀 진단</span>
                <p class="feat-desc">단순한 착석 시간이 아닌 <strong>유효 학습 시간, 오답 회수율</strong> 등 객관적 지표로 학습 밀도를 진단합니다.</p>
            </div>
            <div class="pro-feature-card">
                <span class="feat-icon">🎯</span>
                <span class="feat-title">합격 기여도 분석</span>
                <p class="feat-desc">목표 대학 합격선까지의 부족한 점수(ΔCut)를 파악하고, 점수 상승 <strong>기여도가 가장 높은 과목</strong>을 짚어냅니다.</p>
            </div>
            <div class="pro-feature-card highlight">
                <span class="feat-icon">⚡</span>
                <span class="feat-title">명확한 Next Step</span>
                <p class="feat-desc">막연한 조언 대신 특정 인강 수강, 실전 모의고사 등 당장 실행해야 할 <strong>구체적인 행동 지침</strong>을 제시합니다.</p>
            </div>
        </div>

        <button onclick="location.href='/payment'" class="pro-cta-btn">
            🚀 PRO 멤버십으로<br>업그레이드 하기
            <div style="font-size:0.8rem; opacity:0.8; margin-top:5px; font-weight:400;">데이터 기반 1:1 맞춤 컨설팅 시작하기</div>
        </button>
    `;
}

// [헬퍼] 주차 기반 보고서 키 생성기
function generateReportKey(dateObj) {
    const year = dateObj.getFullYear().toString().slice(2); // "26"
    
    // 월을 무조건 2자리 숫자로 (예: 4월 -> "04")
    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); 
    
    // 해당 월의 정확한 주차 계산
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const dayOfWeek = startOfMonth.getDay(); 
    const offsetDate = dateObj.getDate() + dayOfWeek - 1;
    
    // 주차를 무조건 2자리 숫자로 (예: 2주차 -> "02")
    const weekNum = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0'); 

    // 최종 결합 (영문 없이 숫자만 결합)
    return `${year}${month}${weekNum}`; // 결과: "260402"
}

// [헬퍼] 키를 화면 표시용 문자열로 변환
function formatReportKey(key) {
    // 키가 없거나 6자리 숫자(예: 260402)가 아니면 원본 그대로 반환
    if (!key || key.length !== 6) return key;

    const yStr = key.substring(0, 2); // "26"
    const mStr = parseInt(key.substring(2, 4), 10); // "04" -> 4
    const wStr = parseInt(key.substring(4, 6), 10); // "02" -> 2

    return `20${yStr}년 ${mStr}월 ${wStr}주차 PRO 분석`;
}

// ------------------------------------------------------------
// 2. [전용 대시보드] Pro 이상 유저 대상
// ------------------------------------------------------------
async function renderProDashboard(container) {
    const now = new Date();
    const currentKey = generateReportKey(now); // 예: 26AprW2
    const displayDateStr = formatReportKey(currentKey).replace(" PRO 분석", ""); // "2026년 4월 2주차"
    
    // 1. 유저의 최근 결제일 가져오기
    let paymentDate = userRecentPaymentDate || new Date();

    // 2. 마감일 계산 로직: 결제일 + 최소 7일 경과 후 '돌아오는 일요일' 자정
    let deadlineDate = new Date(paymentDate);
    deadlineDate.setDate(deadlineDate.getDate() + 7); // 무조건 최소 7일은 보장
    const daysToSunday = (7 - deadlineDate.getDay()) % 7; // 일요일까지 남은 일수 (일=0, 월=6...)
    deadlineDate.setDate(deadlineDate.getDate() + daysToSunday);
    deadlineDate.setHours(23, 59, 59, 999);

    // 3. 발송일 계산: 마감일(일요일) + 3일 = 돌아오는 수요일
    let releaseDate = new Date(deadlineDate);
    releaseDate.setDate(releaseDate.getDate() + 3);

    const isDeadlinePassed = now > deadlineDate;
    const deadlineStr = `${deadlineDate.getMonth() + 1}월 ${deadlineDate.getDate()}일(일) 자정`;
    const releaseStr = `${releaseDate.getMonth() + 1}월 ${releaseDate.getDate()}일(수)`;

    // 4. UI 그리기
    container.innerHTML = `
        <div class="pro-header">
            <div style="font-size:2rem; margin-bottom:10px;">🎓</div>
            <h2 class="pro-title">PRO STRATEGY LOUNGE</h2>
            <p class="pro-desc">
                상위 1%를 위한 프리미엄 분석 센터입니다.<br>
                <strong>${displayDateStr}</strong> 회차 리포트 요청이 진행 중입니다.
            </p>
            <div style="margin-top:10px; font-size:0.85rem; color:#cbd5e1;">
                <i class="fas fa-bell" style="color:#fbbf24;"></i> 리포트는 <strong>${releaseStr}</strong>에 일괄 발송됩니다.
            </div>
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

    loadProReports(currentKey, isDeadlinePassed);
}

let cachedProReports = []; 

// 3. 학생용 PRO 리포트 로드 함수
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
        cachedProReports = data.reports || [];

        if (cachedProReports.length === 0) {
            listArea.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:30px;">발행된 보고서가 없습니다.</div>`;
        } else {
            let html = '<div class="report-grid">';
            cachedProReports.forEach(rep => {
                const isReady = (rep.status === 'published' || rep.status === 'sent');
                const statusBadge = isReady 
                    ? '<span style="color:#4ade80; font-size:0.8rem;">● 열람 가능</span>' 
                    : '<span style="color:#fbbf24; font-size:0.8rem;">● 분석중</span>';
                
                const formattedName = formatReportKey(rep.key);
                
                html += `
                    <div class="report-item" onclick="${isReady ? `window.open('${rep.reportLink}')` : "alert('튜터가 리포트를 최종 검수 중입니다. 잠시만 기다려주세요.')"}" style="cursor:${isReady?'pointer':'default'}">
                        <div class="rep-info">
                            <strong>${formattedName}</strong>
                            ${statusBadge}
                        </div>
                        <div class="rep-icon"><i class="fas fa-download" style="color:${isReady?'#3b82f6':'#475569'}"></i></div>
                    </div>
                `;
            });
            html += `</div>`;
            listArea.innerHTML = html;
        }

        const currentData = cachedProReports.find(r => r.key === currentKey);
        const hasRequested = currentData && currentData.request;

        if (isDeadlinePassed) {
            btnContainer.innerHTML = `
                <button class="req-btn disabled" disabled style="background:#e2e8f0; color:#94a3b8; cursor:not-allowed;">
                    <i class="fas fa-lock"></i> 접수 마감됨
                </button>
            `;
        } else if (hasRequested) {
            btnContainer.innerHTML = `
                <button class="req-btn" style="background:#dcfce7; color:#166534; border:1px solid #86efac;" onclick="modifyProRequest()">
                    <i class="fas fa-check-circle"></i> 요청 완료 (수정하기)
                </button>
            `;
            document.getElementById('proReportRequest').value = currentData.request;
        }

    } catch (e) {
        console.error(e);
        listArea.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
    }
}

function modifyProRequest() {
    if(confirm("이미 제출된 요청사항을 수정하시겠습니까?")) {
        openProReportModal();
    }
}

function openProReportModal() {
    const modal = document.getElementById('proReportModal');
    const textarea = document.getElementById('proReportRequest');
    if (modal) {
        modal.style.display = 'block';
        if(textarea) {
            textarea.value = ''; 
            textarea.focus();
            updateCharCount(textarea); 
        }
        document.body.style.overflow = 'hidden';
    }
}

function closeProModal() {
    document.getElementById('proReportModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// PRO 보고서 요청 제출
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
            url.searchParams.set('tab', 'pro'); 
            window.location.href = url.toString();
        } else {
            const errorMsg = data.msg || "요청 처리 중 오류가 발생했습니다.";
            throw new Error(errorMsg);
        }

    } catch (e) {
        alert(e.message); 
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

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
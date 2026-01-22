/* js/mypage.js */

const MYPAGE_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
const UNIV_DATA_API_URL = "https://ftbrlbyaprizjcp5w7b2g5t6sq0srwem.lambda-url.ap-northeast-2.on.aws/";

// 전역 변수
let currentUserTier = 'free';
let userTargetUnivs = [null, null, null, null, null, null, null, null]; 
let univData = []; 
let univMap = {};  
let userQuantData = null; 
let weeklyDataHistory = [];

// 모달 상태 관리
let currentSlotIndex = null;

// === [중요] 헬퍼 함수 (최상단 배치) ===
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

// === 초기화 ===
document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 1. [로딩 시작] 텍스트 표시
    setWeeklyLoadingStatus(true);

    // 2. 데이터 병렬 로드
    Promise.all([
        fetchUserData(userId),
        fetchUnivData()
    ]).then(() => {
        console.log("🚀 모든 데이터 로드 완료");
        initUnivGrid(); 
        updateAnalysisUI();
        
        // 3. [로딩 완료] 표시
        setWeeklyLoadingStatus(false);

        // 4. [1초 대기 후] 실제 제출 상태(미제출/제출완료) 표시
        // '로드 완료' 메시지를 유저가 볼 수 있게 시간을 줍니다.
        setTimeout(() => {
            checkWeeklyStatus(); 
        }, 1000); 
    }).catch(err => {
        console.error("초기화 실패:", err);
        const msg = document.getElementById('weeklyDeadlineMsg');
        if(msg) {
            msg.style.color = 'red';
            msg.innerText = "데이터 로드 실패";
        }
    });

    setupUI();
});

function setWeeklyLoadingStatus(isLoading) {
    const msg = document.getElementById('weeklyDeadlineMsg');
    const badge = document.getElementById('weeklyStatusBadge');
    
    if (!msg || !badge) return;

    if (isLoading) {
        badge.innerText = '...';
        badge.className = 'badge-status pending'; // 스타일 초기화
        msg.style.color = '#3b82f6'; // 파란색
        msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 데이터 로딩중...';
    } else {
        // 로드 완료 직후 보여줄 메시지
        msg.style.color = '#10b981'; // 초록색
        msg.innerHTML = '<strong>✅ 로드 완료</strong>';
    }
}

// === 1. 유저 정보 불러오기 ===
async function fetchUserData(userId) {
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });

        if (!response.ok) throw new Error("서버 오류");

        const data = await response.json();
        
        renderUserInfo(data);
        checkPaymentStatus(data.payments);
        updateSurveyStatus(data);

        if (data.targetUnivs) userTargetUnivs = data.targetUnivs;
        if (data.quantitative) userQuantData = data.quantitative;
        
        // [중요] 주간 점검 기록 저장
        weeklyDataHistory = data.weeklyHistory || []; 

        if (typeof buildUnivMap === 'function') {
            buildUnivMap();
        }
        
    } catch (error) {
        console.error("데이터 로드 중 오류:", error);
    }
}

// === 2. 대학 데이터 가져오기 ===
async function fetchUnivData() {
    try {
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get_all_data' }) 
        });

        if (!response.ok) throw new Error(`서버 응답 오류`);

        const data = await response.json();
        univData = data; 
        buildUnivMap(); 

    } catch (e) {
        console.error("대학 데이터 로드 실패:", e);
    }
}

// === 계열 판단 및 데이터 가공 ===
function buildUnivMap() {
    if (!univData || univData.length === 0) return;

    const userStream = determineUserStream(); 
    console.log(`🎯 유저 계열 판정: ${userStream}`);

    univMap = {};
    
    univData.forEach(item => {
        const univName = item["대학명"];
        if (!univName) return;

        const majors = [];
        const streams = item["데이터"]; 
        
        if (streams) {
            const targetStreamData = streams[userStream]; 
            if (targetStreamData && targetStreamData["전형별"] && Array.isArray(targetStreamData["전형별"])) {
                targetStreamData["전형별"].forEach(dept => {
                    majors.push({
                        name: dept["학과명"],
                        cut_pass: parseFloat(dept["합격권 추정"]) || 0,
                        cut_70: parseFloat(dept["상위 70% 추정"]) || 0,
                        stream: userStream 
                    });
                });
            }
        }

        if (majors.length > 0) {
            if (!univMap[univName]) univMap[univName] = [];
            univMap[univName].push(...majors);
        }
    });
    
    updateAnalysisUI();
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
    const inq1Name = targetExam.inq1?.name || "";
    const inq2Name = targetExam.inq2?.name || "";

    const isMathScience = (mathOpt === 'mi' || mathOpt === 'ki');
    const scienceRegex = /물리|화학|생명|지구/;
    const isInq1Science = scienceRegex.test(inq1Name);
    const isInq2Science = scienceRegex.test(inq2Name);

    if (isMathScience && isInq1Science && isInq2Science) return '이과';
    else return '문과';
}

// === UI 렌더링 ===
function renderUserInfo(data) {
    document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
    document.getElementById('userEmailDisplay').innerText = data.email || '';
    
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileSchool').value = data.school || '';
    document.getElementById('profileEmail').value = data.email || '';
}

function checkPaymentStatus(payments) {
    const profileBox = document.querySelector('.profile-summary');
    let tier = 'free'; let tierClass = ''; let badgeText = '';

    if (payments && payments.length > 0) {
        const paidHistory = payments.filter(p => p.status === 'paid');
        if (paidHistory.length > 0) {
            paidHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
            const latestPayment = paidHistory[0];
            const productName = (latestPayment.product || "").toLowerCase();

            if (productName.includes('black')) { tier = 'black'; tierClass = 'tier-black'; badgeText = 'BLACK MEMBER'; }
            else if (productName.includes('pro')) { tier = 'pro'; tierClass = 'tier-pro'; badgeText = 'PRO MEMBER'; }
            else if (productName.includes('standard')) { tier = 'standard'; tierClass = 'tier-standard'; badgeText = 'STANDARD MEMBER'; }
            else { tier = 'basic'; tierClass = 'tier-basic'; badgeText = 'BASIC MEMBER'; }
        }
    }
    currentUserTier = tier;
    profileBox.classList.remove('tier-basic', 'tier-standard', 'tier-pro', 'tier-black');
    if (tierClass) profileBox.classList.add(tierClass);

    let badge = document.querySelector('.premium-badge');
    if (tier !== 'free') {
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'premium-badge';
            profileBox.appendChild(badge);
        }
        badge.innerText = badgeText;
    } else if (badge) {
        badge.remove();
    }
}

function updateSurveyStatus(data) {
    const isQualDone = !!data.qualitative;
    const isQuanDone = data.quantitative && Object.keys(data.quantitative).length > 0;
    const badge = document.getElementById('statusBadge');
    document.getElementById('qualStatus').innerText = isQualDone ? "✅ 작성완료" : "❌ 미작성";
    document.getElementById('quanStatus').innerText = isQuanDone ? "✅ 작성완료" : "❌ 미작성";

    badge.className = 'status-badge';
    if (isQualDone && isQuanDone) {
        badge.classList.add('complete'); badge.innerText = "작성 완료";
    } else if (isQualDone || isQuanDone) {
        badge.classList.add('partial'); badge.innerText = "작성 중";
    } else {
        badge.classList.add('incomplete'); badge.innerText = "미작성";
    }
}

// === 탭 전환 ===
function switchMainTab(tabName) {
    if (tabName === 'solution' && currentUserTier === 'free') {
        alert("유료 회원만 이용 가능합니다."); return;
    }
    document.querySelectorAll('.main-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'solution') openSolution('univ');
}

function openSolution(solType) {
    if ((solType === 'sim' || solType === 'coach') && ['free', 'basic'].includes(currentUserTier)) {
        alert("Standard 버전 이상만 이용 가능합니다."); return;
    }
    if (solType === 'black' && currentUserTier !== 'black') {
        alert("BLACK 회원 전용 공간입니다."); return;
    }

    document.querySelectorAll('.sol-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sol-content').forEach(content => content.classList.remove('active'));
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    document.getElementById(`sol-${solType}`).classList.add('active');

    if (solType === 'univ') {
        initUnivGrid(); 
        updateAnalysisUI(); 
    }
    if (solType === 'coach') {
        initCoachLock();
        checkWeeklyStatus(); 
    }
}

// === 3. 목표 대학 설정 (그리드) ===
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

            const btnText = (savedData.univ && savedData.major) 
                ? `<strong>${savedData.univ}</strong><br><small>${savedData.major}</small>` 
                : `<span class="placeholder">대학 및 학과를 선택하세요</span>`;

            slotDiv.innerHTML = `
                <label>지망 ${i+1}</label>
                <button type="button" class="univ-select-btn" 
                        onclick="${isLocked ? '' : `openUnivSelectModal(${i})`}" 
                        ${isLocked ? 'disabled' : ''}
                        style="${isLocked ? 'background-color:#f3f4f6; cursor:not-allowed;' : ''}">
                    <div>${btnText}</div>
                    ${isLocked ? '<i class="fas fa-lock" style="color:#ef4444;"></i>' : '<i class="fas fa-chevron-right"></i>'}
                </button>
                ${isLocked ? `<span class="slot-msg">${dateMsg}</span>` : ''}
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

// === 모달 (대학 선택) ===
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
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_target_univs', userId: userId, data: userTargetUnivs })
        });
        
        if(response.ok) { alert("저장되었습니다."); location.reload(); } 
        else { throw new Error("저장 실패"); }
    } catch(e) { console.error(e); alert("통신 오류 발생"); }
}

// === 목표 대학 기본 분석 (디자인 복구) ===
function updateAnalysisUI() {
    const container = document.getElementById('univAnalysisResult');
    if (!container) return;

    const hasTargets = userTargetUnivs && userTargetUnivs.some(u => u && u.univ);
    if (!hasTargets) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">설정된 목표 대학이 없습니다.</p>';
        return;
    }
    
    if (Object.keys(univMap).length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">대학 데이터를 불러오는 중...</p>';
        return;
    }

    let myScore = 0;
    if (userQuantData && userQuantData.csat) {
        const d = userQuantData.csat;
        myScore += parseInt(d.kor?.std || 0) + parseInt(d.math?.std || 0) + parseInt(d.inq1?.std || 0) + parseInt(d.inq2?.std || 0);
    }

    let html = '';
    
    userTargetUnivs.forEach((target, idx) => {
        if (!target || !target.univ) return;

        const univInfo = univMap[target.univ];
        let cutPass = 0;
        let cut70 = 0;
        
        if (univInfo) {
            const majorInfo = univInfo.find(m => m.name === target.major);
            if (majorInfo) {
                cutPass = majorInfo.cut_pass || 0;
                cut70 = majorInfo.cut_70 || 0;
            }
        }

        const diff = (myScore - cutPass).toFixed(1);
        const diffClass = diff >= 0 ? 'plus' : 'minus';
        const diffText = cutPass > 0 ? (diff >= 0 ? `+${diff}` : diff) : '-';
        
        html += `
        <div class="analysis-card">
            <div class="analysis-header">
                <h4>${idx+1}지망: ${target.univ} <small>${target.major}</small></h4>
                <span class="univ-badge" style="background:#eff6ff; color:#2563eb; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:bold;">
                    ${diff >= 0 ? '합격 유력' : '소신 지원'}
                </span>
            </div>
            <div class="analysis-body">
                <div class="score-table-box">
                    <table class="score-compare-table">
                        <tr><th>구분</th><th>점수 (환산)</th><th>비고</th></tr>
                        <tr><td>합격권 추정</td><td class="score-val">${cutPass > 0 ? cutPass : '데이터 없음'}</td><td>-</td></tr>
                        <tr><td>상위 70% Cut</td><td class="score-val">${cut70 > 0 ? cut70 : '-'}</td><td style="font-size:0.8rem; color:#64748b;">안정권 기준</td></tr>
                        <tr class="score-row highlight"><td>내 환산 점수</td><td class="score-val" style="color:#2563eb;">${myScore > 0 ? myScore : '0'}</td><td><span class="diff-badge ${diffClass}">${diffText}</span></td></tr>
                    </table>
                </div>
                <div class="chart-box">
                    <div class="pie-chart" style="background: conic-gradient(${diff >= 0 ? '#10b981' : '#ef4444'} 0% 75%, #e5e7eb 75% 100%);"></div>
                    <div class="chart-legend"><div class="legend-item"><span class="color-dot" style="background:${diff >= 0 ? '#10b981' : '#ef4444'}"></span>내 점수</div><div class="legend-item"><span class="color-dot" style="background:#e5e7eb"></span>부족분</div></div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// === 주간 점검 상태 체크 ===
function checkWeeklyStatus() {
    const today = new Date();
    const currentWeekTitle = getWeekTitle(today); 
    
    // 안전장치: 데이터가 아직 없거나 배열이 아니면 빈 배열 처리
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];

    // 공백 제거 후 비교 (타이틀 불일치 방지)
    const thisWeekData = history.find(w => 
        w.title && w.title.replace(/\s/g, '') === currentWeekTitle.replace(/\s/g, '')
    );
    
    const badge = document.getElementById('weeklyStatusBadge');
    const msg = document.getElementById('weeklyDeadlineMsg');
    const box = document.getElementById('weeklyBox');

    if (!badge || !box || !msg) return;

    // 1. 제출 상태 배지 업데이트
    if (thisWeekData) {
        badge.className = 'badge-status submitted';
        badge.innerText = '✅ 제출완료';
    } else {
        badge.className = 'badge-status pending';
        badge.innerText = '미제출';
    }

    // 2. 마감 시간 체크 (일요일 20:00 ~ 월요일 00:00)
    const day = today.getDay(); // 0:일요일
    const hour = today.getHours();

    // 일요일이면서 20시 이상이면 잠금
    if (day === 0 && hour >= 20) {
        badge.className = 'badge-status locked';
        badge.innerText = '⛔ 마감됨';
        
        msg.style.color = '#ef4444';
        msg.innerText = "수정 불가 (매주 일요일 20시 마감)";
        
        // 박스 비활성화
        box.classList.add('disabled');
        box.onclick = null; 
        box.setAttribute('onclick', ''); 
    } else {
        // 마감 전이면 안내 메시지 표시 (기존 '로드 완료' 메시지를 덮어씀)
        msg.style.color = '#64748b'; // 회색 복귀
        msg.innerText = "※ 일요일 20:00 마감";
        
        // 박스 활성화 (혹시 잠겨있었다면 해제)
        box.classList.remove('disabled');
        box.onclick = openWeeklyCheckModal; // 함수 재연결
    }
}

// === 주간 학습 점검 모달 ===
function openWeeklyCheckModal() {
    const today = new Date();
    if (today.getDay() === 0 && today.getHours() >= 20) {
        alert("금주 학습 점검 제출이 마감되었습니다."); return;
    }

    const modal = document.getElementById('weeklyCheckModal');
    const currentWeekTitle = getWeekTitle(today); 

    const [yStr, mStr, wStr] = currentWeekTitle.split(' '); 
    document.getElementById('weeklyYear').innerText = yStr; 
    document.getElementById('weeklyDateDetail').innerText = `${mStr} ${wStr}`;
    
    // 데이터 불러오기
    const thisWeekData = weeklyDataHistory.find(w => w.title && w.title.replace(/\s/g, '') === currentWeekTitle.replace(/\s/g, ''));
    
    if (thisWeekData) {
        loadWeeklyDataToForm(thisWeekData); 
    } else {
        resetWeeklyForm(); 
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeWeeklyModal() {
    document.getElementById('weeklyCheckModal').style.display = 'none';
    document.body.style.overflow = 'auto';
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
                } else if (customInput) {
                    customInput.value = detail.subject;
                }
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
                    if(cb) cb.checked = true;
                    else document.getElementById('slumpDetail').value = r; 
                });
            }
        }
    }
    
    if (data.comment) {
        const ta = document.getElementById('weekComment');
        ta.value = data.comment;
        checkLength(ta);
    }
}

// === 중요: 누락되었던 계산 및 UI 제어 함수들 ===
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
            if(rate >= 100) rateTxt.style.color = '#10b981';
            else if(rate >= 80) rateTxt.style.color = '#3b82f6';
            else rateTxt.style.color = '#ef4444';
        } else {
            rateTxt.innerText = '0%'; rateTxt.style.color = '#94a3b8';
        }
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
    if (type === 'none') fields.style.display = 'none';
    else fields.style.display = 'block';
}

function toggleSlumpReason() {
    const trend = document.querySelector('input[name="studyTrend"]:checked')?.value;
    const box = document.getElementById('slumpReasonBox');
    if(trend === 'down') box.style.display = 'block';
    else box.style.display = 'none';
}

function checkLength(el) {
    document.getElementById('currLen').innerText = el.value.length;
}

// === 제출 ===
async function submitWeeklyCheck() {
    const totalPlan = parseFloat(document.getElementById('totalPlan').innerText);
    if (totalPlan === 0) { alert("학습 계획 시간을 입력해주세요."); return; }

    const mockType = document.getElementById('mockExamType').value;
    let mockData = { type: mockType, proofFile: null, scores: {} };

    if (mockType !== 'none') {
        const fileInput = document.getElementById('mockExamProof');
        // 파일 검증 로직 (필요시 활성화)
        mockData.proofFile = fileInput.files.length > 0 ? fileInput.files[0].name : "file_uploaded"; 
        
        const scores = document.querySelectorAll('.mock-score');
        mockData.scores = { kor: scores[0].value, math: scores[1].value, eng: scores[2].value, inq1: scores[3].value, inq2: scores[4].value };
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

    const userId = localStorage.getItem('userId');
    const today = new Date().toISOString();
    const title = getWeekTitle(new Date()); 

    const weeklyData = {
        date: today,
        title: title, // 식별용 키
        studyTime: {
            details: studyData,
            totalPlan: document.getElementById('totalPlan').innerText,
            totalAct: document.getElementById('totalAct').innerText,
            totalRate: document.getElementById('totalRate').innerText
        },
        mockExam: mockData,
        trend: { status: trend, reasons: reasons },
        comment: comment
    };

    if(!confirm("제출하시겠습니까?\n(수정 시 기존 데이터는 덮어씌워집니다)")) return;

    try {
        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'save_weekly_check', userId, data: weeklyData })
        });
        if(res.ok) { 
            alert("제출 완료되었습니다."); 
            closeWeeklyModal(); 
            location.reload(); 
        } else {
            throw new Error("서버 응답 오류");
        }
    } catch(e) { console.error(e); alert("제출 실패"); }
}

// === 심층 코칭 ===
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

function updateCharCount(el) {
    el.parentElement.querySelector('.char-count span').innerText = el.value.length;
}

async function submitDeepCoaching() {
    const textareas = document.querySelectorAll('#deepCoachingModal textarea');
    const ans = Array.from(textareas).map(t => t.value.trim());
    if(ans.every(a => a === "")) { alert("내용을 입력해주세요."); return; }

    if(!confirm("심층 코칭을 요청하시겠습니까?")) return;

    const userId = localStorage.getItem('userId');
    const reqData = { date: new Date().toISOString(), plan: ans[0], direction: ans[1], subject: ans[2], etc: ans[3], status: 'pending' };

    try {
        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'save_deep_coaching', userId, data: reqData })
        });
        if(res.ok) { alert("요청이 접수되었습니다."); closeDeepModal(); }
        else throw new Error("전송 실패");
    } catch(e) { console.error(e); alert("오류가 발생했습니다."); }
}

// === 기타 ===
function initCoachLock() {
    const lockOverlay = document.getElementById('deepCoachingLock');
    if (['pro', 'black'].includes(currentUserTier)) { if(lockOverlay) lockOverlay.style.display = 'none'; } 
    else { if(lockOverlay) lockOverlay.style.display = 'flex'; }
}

async function saveProfile() {
    const userId = localStorage.getItem('userId');
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
            body: JSON.stringify({ type: 'update_profile', userId, data: { name: newName, phone: newPhone, school: newSchool, email: newEmail } })
        });
        if(response.ok) { alert("회원 정보가 수정되었습니다."); location.reload(); } 
        else { throw new Error("저장 실패"); }
    } catch (error) { alert("저장 중 오류가 발생했습니다."); }
}

async function handleDeleteAccount() {
    if (!confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 영구 삭제됩니다.")) return;
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'delete_user', userId })
        });
        if (response.ok) { alert("탈퇴가 완료되었습니다."); localStorage.clear(); sessionStorage.clear(); window.location.href = 'index.html'; } 
        else { throw new Error("탈퇴 실패"); }
    } catch (error) { alert("오류 발생"); }
}

function setupUI() {
    const pwConfirmInput = document.getElementById('newPasswordConfirm');
    if (pwConfirmInput) {
        pwConfirmInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') saveProfile();
        });
    }
}
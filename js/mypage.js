// js/mypage.js

const MYPAGE_API_URL = CONFIG.api.base; 
const UNIV_DATA_API_URL = CONFIG.api.analysis; 

let currentUserTier = 'free';
let userTargetUnivs = [null, null, null, null, null, null, null, null]; 
let univData = []; 
let univMap = {};  
let userQuantData = null; 
let weeklyDataHistory = [];
let currentSlotIndex = null;
// 플래너 파일 저장용 전역 변수
let currentPlannerFiles = []; 
let originalPlannerFiles = [];

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
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (!accessToken) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    setWeeklyLoadingStatus(true);

    Promise.all([
        fetchUserData(userId),
        fetchUnivData()
    ]).then(() => {
        console.log("🚀 모든 데이터 로드 완료");
        initUnivGrid(); 
        updateAnalysisUI();
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
    }).catch(err => {
        console.error("초기화 실패:", err);
        const msg = document.getElementById('weeklyDeadlineMsg');
        if(msg) { msg.style.color = 'red'; msg.innerText = "데이터 로드 실패"; }
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
    const token = localStorage.getItem('accessToken');
    const safeUserId = userId || localStorage.getItem('userId'); 
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: safeUserId }) 
        });
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
    } catch (error) { console.error("데이터 로드 중 오류:", error); }
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
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_univ_list_only' }) 
        });
        if (!response.ok) throw new Error(`서버 응답 오류`);
        const data = await response.json();
        univData = data; 
        univMap = {};
        data.forEach(item => { univMap[item.univName] = item.majors.map(m => ({ name: m })); });
    } catch (e) { console.error("대학 데이터 로드 실패:", e); }
}

function buildUnivMap() {
    if (!univData || univData.length === 0) return;
    const userStream = determineUserStream(); 
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
    if (solType === 'black' && currentUserTier !== 'black') { alert("BLACK 회원 전용 공간입니다."); return; }
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
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_target_univs', userId: userId, data: userTargetUnivs })
        });
        if(response.ok) { alert("저장되었습니다."); location.reload(); } else { throw new Error("저장 실패"); }
    } catch(e) { console.error(e); alert("통신 오류 발생"); }
}

async function updateAnalysisUI() {
    const container = document.getElementById('univAnalysisResult');
    if (!container) return;
    const hasTargets = userTargetUnivs && userTargetUnivs.some(u => u && u.univ);
    if (!hasTargets) { container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">목표 대학을 설정하면 분석 결과가 나타납니다.</p>'; return; }
    
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem; color:#3b82f6; margin-bottom:10px;"></i><p>AI가 합격 가능성을 분석 중입니다...</p></div>`;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'analyze_my_targets', userId: userId })
        });
        if (!response.ok) throw new Error("분석 API 호출 실패");
        const data = await response.json(); 
        const { myScore, results } = data;
        if (!results || results.length === 0) { container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">분석할 데이터가 없거나 서버 오류입니다.</p>'; return; }
        let html = '';
        results.forEach((res, idx) => {
            const isSafe = res.is_safe;
            const statusColor = isSafe ? '#10b981' : '#ef4444';
            const bgBadge = isSafe ? '#ecfdf5' : '#fef2f2'; 
            const diffVal = parseFloat(res.diff);
            const diffText = diffVal >= 0 ? `+${diffVal}` : diffVal;
            const diffClass = diffVal >= 0 ? 'plus' : 'minus';
            html += `<div class="analysis-card"><div class="analysis-header"><h4>${idx+1}지망: ${res.univ} <small>${res.major}</small></h4><span class="univ-badge" style="background:${bgBadge}; color:${statusColor}; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:bold; border:1px solid ${statusColor}">${res.status}</span></div><div class="analysis-body"><div class="score-table-box"><table class="score-compare-table"><tr><th>구분</th><th>결과</th><th>비고</th></tr><tr><td>판정</td><td class="score-val" style="font-weight:bold; color:${statusColor}">${res.status}</td><td style="font-size:0.85rem;">${res.msg}</td></tr><tr class="score-row highlight"><td>점수 차이</td><td class="score-val"><span class="diff-badge ${diffClass}" style="color:${statusColor}">${diffText}</span></td><td style="font-size:0.85rem; color:#64748b;">내 점수: ${myScore}</td></tr></table></div><div class="chart-box"><div class="pie-chart" style="background: conic-gradient(${statusColor} 0% 100%); opacity:0.9;"></div><div class="chart-legend" style="margin-top:8px;"><div class="legend-item"><span class="color-dot" style="background:${statusColor}"></span>${res.status}권</div></div></div></div></div>`;
        });
        container.innerHTML = html;
    } catch (e) { console.error(e); container.innerHTML = '<p style="text-align:center; color:#ef4444; padding:30px;">분석 정보를 불러오는 중 오류가 발생했습니다.</p>'; }
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

// 리셋 함수 추가 (500 에러 해결)
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
    
    // 플래너 초기화
    currentPlannerFiles = [];
    renderPlannerFiles();
}

function closeWeeklyModal() {
    document.getElementById('weeklyCheckModal').style.display = 'none';
    document.body.style.overflow = 'auto';
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
        // 파일 객체 자체를 push
        files.forEach(f => currentPlannerFiles.push(f)); 
        renderPlannerFiles();
    }
}

// 플래너 파일 목록 렌더링
function renderPlannerFiles() {
    const list = document.getElementById('plannerFileList');
    list.innerHTML = '';
    
    if (currentPlannerFiles.length === 0) {
        list.innerHTML = '<span class="placeholder-text">선택된 파일 없음</span>';
        return;
    }

    currentPlannerFiles.forEach((file, idx) => {
        let fileName = "";
        let fileLink = ""; // 미리보기 링크 (저장된 파일인 경우)

        // Case 1: 새로 추가한 파일 (File 객체)
        if (file instanceof File) {
            fileName = file.name;
        } 
        // Case 2: DB에서 불러온 S3 URL (문자열)
        else if (typeof file === 'string') {
            // URL에서 파일명 추출 (디코딩 포함)
            try {
                // 전체 경로에서 마지막 '/' 뒤의 부분을 가져옴
                const rawName = file.split('/').pop();
                // URL 인코딩된 한글 등을 복원
                fileName = decodeURIComponent(rawName);
                
                // 앞의 타임스탬프(숫자_)가 보기 싫으면 제거하는 로직
                fileName = fileName.replace(/^\d+_/, '');
                
                fileLink = file; // URL 저장
            } catch (e) {
                fileName = file; // 에러 시 그냥 전체 출력
            }
        }

        const div = document.createElement('div');
        div.className = 'file-item';
        
        // 저장된 파일이면 클릭해서 볼 수 있게 링크 제공
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
    // 공부시간 로드
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
    // 모의고사 로드
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
    // 추이 로드
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
    // 코멘트 로드
    if (data.comment) {
        const ta = document.getElementById('weekComment');
        ta.value = data.comment;
        checkLength(ta);
    }
    // 플래너 파일 로드
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
    // 1. 유효성 검사 (학습 시간)
    const totalPlan = parseFloat(document.getElementById('totalPlan').innerText);
    if (totalPlan === 0) { alert("학습 계획 시간을 입력해주세요."); return; }

    // 2. 모의고사 데이터 수집
    const mockType = document.getElementById('mockExamType').value;
    let mockData = { type: mockType, proofFile: null, scores: {} };

    if (mockType !== 'none') {
        const fileInput = document.getElementById('mockExamProof');
        // 모의고사 사진은 일단 기존 로직 유지 (파일명만 저장) - 필요 시 여기도 S3 로직 적용 가능
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

    // 3. 코멘트 유효성 검사
    const comment = document.getElementById('weekComment').value.trim();
    if (!comment) { alert("핵심 회고를 작성해주세요."); return; }

    // 4. 과목별 데이터 수집
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

    // 5. 추이 및 슬럼프 데이터 수집
    const trend = document.querySelector('input[name="studyTrend"]:checked')?.value || 'keep';
    let reasons = [];
    if(trend === 'down') {
        document.querySelectorAll('#slumpReasonBox input:checked').forEach(cb => reasons.push(cb.value));
        const det = document.getElementById('slumpDetail').value;
        if(det) reasons.push(det);
    }

    if(!confirm("제출하시겠습니까?\n(수정 시 기존 데이터는 덮어씌워집니다)")) return;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    const submitBtn = document.querySelector('.save-btn');
    const originalBtnText = submitBtn.innerText;

    try {
        // UI 로딩 상태 전환
        submitBtn.disabled = true;
        submitBtn.innerText = "데이터 처리 중...";

        // ============================================================
        // [A] 삭제된 파일 감지 및 S3 삭제 요청
        // ============================================================
        // originalPlannerFiles: 이전에 불러왔던 원본 파일 리스트 (문자열 URL들)
        // currentPlannerFiles: 현재 화면에 있는 파일 리스트 (문자열 URL + 새로 추가된 File 객체 혼합)
        
        // 현재 리스트에서 "기존에 있던 URL"만 골라냄
        const currentUrls = currentPlannerFiles.filter(f => typeof f === 'string');
        
        // 원본에는 있었는데, 현재 리스트에는 없는 URL -> 삭제 대상
        const filesToDelete = originalPlannerFiles.filter(url => !currentUrls.includes(url));

        if (filesToDelete.length > 0) {
            submitBtn.innerText = "기존 파일 삭제 중...";
            // 병렬로 삭제 요청 전송
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

        // ============================================================
        // [B] 신규 파일 S3 업로드 로직
        // ============================================================
        // 최종적으로 DB에 저장될 URL 리스트 (기존 URL들은 유지)
        let finalFileUrls = [...currentUrls]; 
        
        // 새로 추가된 파일(File 객체)만 골라내기
        const newFiles = currentPlannerFiles.filter(f => typeof f !== 'string');

        if (newFiles.length > 0) {
            submitBtn.innerText = "새 사진 업로드 중... (잠시만 기다려주세요)";
            
            for (const file of newFiles) {
                // 1. Presigned URL 발급 요청
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

                // 2. S3로 직접 업로드 (PUT)
                // Content-Type 헤더가 Presigned URL 생성 시점과 일치해야 함
                await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type },
                    body: file
                });

                // 3. 업로드 성공한 URL을 최종 리스트에 추가
                finalFileUrls.push(fileUrl);
            }
        }

        // ============================================================
        // [C] 최종 데이터 DB 저장
        // ============================================================
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
            plannerFiles: finalFileUrls // 최종 정리된 URL 리스트 저장
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
        // UI 원복
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
    const token = localStorage.getItem('accessToken');
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
    const token = localStorage.getItem('accessToken');
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

async function handleDeleteAccount() {
    if (!confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 영구 삭제됩니다.")) return;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
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
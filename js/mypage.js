/* js/mypage.js */

const MYPAGE_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
// [주의] 방금 만드신 람다 함수(S3 데이터 가져오는 함수)의 URL을 여기에 꼭 넣어주세요!
const UNIV_DATA_API_URL = "https://ftbrlbyaprizjcp5w7b2g5t6sq0srwem.lambda-url.ap-northeast-2.on.aws/"; 

// 전역 변수
let currentUserTier = 'free'; 
let userTargetUnivs = []; 
let univData = []; // 원본 JSON 데이터
let univMap = {};  // UI용 가공 데이터: { "대학명": [ {name, cut_pass, cut_70}, ... ] }
let userQuantData = null; 

// 모달 상태 관리 변수
let currentSlotIndex = null; // 현재 수정 중인 지망 슬롯 번호 (0~7)

document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    fetchUserData(userId);
    fetchUnivData(); 
});

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

        userTargetUnivs = data.targetUnivs || [];
        userQuantData = data.quantitative; 
        
        // ★ [추가] 성적 데이터가 로드되었으니 계열을 다시 판단해서 대학 목록 갱신
        if (typeof buildUnivMap === 'function') {
            buildUnivMap();
        }
    } catch (error) {
        console.error("데이터 로드 중 오류:", error);
    }
}

// === 2. 대학 데이터 가져오기 및 파싱 (변경된 구조 반영) ===
// === [수정됨] 대학 데이터 S3에서 가져오기 및 계열별 필터링 ===
async function fetchUnivData() {
    try {
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get_all_data' }) 
        });

        if (!response.ok) throw new Error(`서버 응답 오류`);

        const data = await response.json();
        univData = data; // 원본 데이터 저장

        // 데이터 파싱 실행 (유저 성적에 따라 문/이과 자동 분류)
        buildUnivMap();

    } catch (e) {
        console.error("대학 데이터 로드 실패:", e);
    }
}

// === [신규] 유저 성적 기반 계열 판단 및 데이터 가공 함수 ===
function buildUnivMap() {
    if (!univData || univData.length === 0) return;

    // 1. 유저의 계열 판단 (이과 vs 문과)
    const userStream = determineUserStream(); 
    console.log(`🎯 유저 계열 판정: ${userStream}`);

    // 2. 해당 계열 데이터만 추출하여 맵핑
    univMap = {};
    
    univData.forEach(item => {
        const univName = item["대학명"];
        if (!univName) return;

        const majors = [];
        const streams = item["데이터"]; // { "문과": {...}, "이과": {...} }
        
        if (streams) {
            // ★ 핵심: 판정된 계열(userStream)의 데이터만 가져옴
            // 예: userStream이 "이과"면 streams["이과"]만 참조
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

        // 해당 대학에 갈 수 있는 학과가 있을 때만 맵에 추가
        if (majors.length > 0) {
            if (!univMap[univName]) {
                univMap[univName] = [];
            }
            univMap[univName].push(...majors);
        }
    });

    console.log(`✅ ${userStream} 데이터 파싱 완료: 총 ${Object.keys(univMap).length}개 대학`);

    // UI 갱신 (이미 탭이 열려있다면)
    if (document.getElementById('sol-univ').classList.contains('active')) {
        initUnivGrid(); 
    }
}

// === [신규] 계열 판단 로직 (미적/기하 + 과탐2 = 이과) ===
function determineUserStream() {
    // 1. 데이터가 없으면 기본값 '문과' (또는 '이과'로 설정 가능)
    if (!userQuantData) return '문과';

    // 2. 가장 최신 시험 데이터 찾기 (수능 > 9월 > 6월 ... 순서로 우선순위 둠)
    const examPriorities = ['csat', 'sep', 'jun', 'oct', 'jul', 'mar', 'may'];
    let targetExam = null;

    for (const examName of examPriorities) {
        if (userQuantData[examName] && userQuantData[examName].math && userQuantData[examName].math.opt) {
            targetExam = userQuantData[examName];
            break; 
        }
    }

    // 입력된 성적이 아예 없으면 기본값 리턴
    if (!targetExam) return '문과';

    // 3. 조건 검사
    const mathOpt = targetExam.math.opt; // 'mi'(미적), 'ki'(기하), 'hwak'(확통)
    const inq1Name = targetExam.inq1?.name || "";
    const inq2Name = targetExam.inq2?.name || "";

    // 조건 A: 수학이 미적분(mi) 또는 기하(ki)
    const isMathScience = (mathOpt === 'mi' || mathOpt === 'ki');

    // 조건 B: 탐구 2과목 모두 과탐 (물화생지 포함 여부로 판단)
    // 정규식: 물리학, 화학, 생명과학, 지구과학 (I, II 포함)
    const scienceRegex = /물리|화학|생명|지구/;
    const isInq1Science = scienceRegex.test(inq1Name);
    const isInq2Science = scienceRegex.test(inq2Name);

    // ★ 최종 판단: 수학(미/기) AND 과탐(2개) ==> 이과, 그 외 ==> 문과
    if (isMathScience && isInq1Science && isInq2Science) {
        return '이과';
    } else {
        return '문과';
    }
}

// === 기본 UI 렌더링 함수들 ===
function renderUserInfo(data) {
    document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
    document.getElementById('userEmailDisplay').innerText = data.email || localStorage.getItem('userEmail') || '';
    
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

// === 탭 전환 로직 ===
function switchMainTab(tabName) {
    if (tabName === 'solution' && currentUserTier === 'free') {
        alert("유료 회원만 이용 가능합니다.");
        return;
    }
    document.querySelectorAll('.main-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchMainTab('${tabName}')"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'solution') {
        openSolution('univ');
    }
}

function openSolution(solType) {
    if ((solType === 'sim' || solType === 'coach') && ['free', 'basic'].includes(currentUserTier)) {
        alert("Standard 버전 이상만 이용 가능합니다.");
        return;
    }
    if (solType === 'black' && currentUserTier !== 'black') {
        alert("BLACK 회원 전용 공간입니다.");
        return;
    }

    document.querySelectorAll('.sol-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.sol-btn[onclick="openSolution('${solType}')"]`).classList.add('active');
    document.querySelectorAll('.sol-content').forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(`sol-${solType}`);
    targetContent.classList.add('active');

    if (solType === 'univ') {
        initUnivGrid(); 
        renderUnivAnalysis(); 
    }
    if (solType === 'coach') initCoachLock();
}

// === 3. 목표대학 설정 로직 (모달 연동) ===
function initUnivGrid() {
    const grid = document.getElementById('univGrid');
    grid.innerHTML = ''; 

    const tierLimits = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 };
    const limit = tierLimits[currentUserTier] || 0;
    const now = new Date(); // 현재 시간

    for (let i = 0; i < 8; i++) {
        const isActive = i < limit;
        // DB에서 불러온 데이터가 없으면 빈 객체로 초기화
        const savedData = userTargetUnivs[i] || { univ: '', major: '', date: null };
        
        const slotDiv = document.createElement('div');
        
        if (isActive) {
            slotDiv.className = 'univ-slot';
            
            // --- [핵심] 2주 락 체크 로직 ---
            let isLocked = false;
            let dateMsg = '';
            
            if (savedData.date) {
                const savedDate = new Date(savedData.date);
                const unlockDate = new Date(savedDate);
                unlockDate.setDate(unlockDate.getDate() + 14); // 14일 더하기
                
                // 만약 현재 시간이 락 해제 시간보다 이전이라면 (아직 잠겨있음)
                if (now < unlockDate) {
                    isLocked = true;
                    // 날짜 포맷 예쁘게 (월/일)
                    const m = unlockDate.getMonth() + 1;
                    const d = unlockDate.getDate();
                    dateMsg = `🔒 ${m}월 ${d}일 이후 수정 가능`;
                }
            }

            // 버튼 텍스트 (값이 있으면 대학/학과 표시, 없으면 안내문구)
            const btnText = (savedData.univ && savedData.major) 
                ? `<strong>${savedData.univ}</strong><br><small>${savedData.major}</small>` 
                : `<span class="placeholder">대학 및 학과를 선택하세요</span>`;

            // HTML 생성
            // 락이 걸려있으면(isLocked) 버튼에 disabled 속성을 추가하고, 클릭 이벤트(onclick)도 막음
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
            
            // 만약 저장된 데이터는 있는데 락이 풀린 상태라면? -> 수정 가능하도록 렌더링됨
            
            grid.appendChild(slotDiv);

        } else {
            // 티어 제한으로 비활성화된 슬롯
            let requiredTier = (i < 5) ? 'Standard' : 'PRO/BLACK';
            slotDiv.className = 'univ-slot locked-tier';
            slotDiv.setAttribute('data-msg', `${requiredTier} 이상`);
            grid.appendChild(slotDiv);
        }
    }
}

// === 4. 대학/학과 선택 모달 로직 ===

// 모달 열기
function openUnivSelectModal(index) {
    currentSlotIndex = index;
    const modal = document.getElementById('univSelectModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    
    showUnivStep(); // 1단계(대학 선택) 화면 로드
}

// 모달 닫기
function closeUnivModal() {
    document.getElementById('univSelectModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentSlotIndex = null;
}

// 1단계: 대학 목록 보여주기
function showUnivStep() {
    document.getElementById('modalTitle').innerText = "대학 선택";
    document.getElementById('stepUnivList').style.display = 'grid';
    document.getElementById('stepMajorList').style.display = 'none';
    document.getElementById('modalFooter').style.display = 'none';

    const listContainer = document.getElementById('stepUnivList');
    listContainer.innerHTML = '';

    // 대학 이름순 정렬하여 타일 생성
    Object.keys(univMap).sort().forEach(univName => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerText = univName;
        item.onclick = () => showMajorStep(univName);
        listContainer.appendChild(item);
    });
}

// 2단계: 학과 목록 보여주기
function showMajorStep(univName) {
    document.getElementById('modalTitle').innerText = `${univName} - 학과 선택`;
    document.getElementById('stepUnivList').style.display = 'none';
    document.getElementById('stepMajorList').style.display = 'grid';
    document.getElementById('modalFooter').style.display = 'block'; // 뒤로가기 버튼 활성화

    const listContainer = document.getElementById('stepMajorList');
    listContainer.innerHTML = '';

    const majors = univMap[univName] || [];
    // 학과 이름순 정렬
    majors.sort((a,b) => a.name.localeCompare(b.name));

    majors.forEach(majorObj => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerText = majorObj.name;
        // 선택 시 완료 함수 호출
        item.onclick = () => selectComplete(univName, majorObj.name);
        listContainer.appendChild(item);
    });
}

// 선택 완료
function selectComplete(univ, major) {
    if (currentSlotIndex !== null) {
        // 임시 저장 (서버 저장은 아님, 화면 갱신용)
        // date: null 로 설정하여 '저장되지 않은 수정 상태'임을 표시
        userTargetUnivs[currentSlotIndex] = { univ: univ, major: major, date: null };
        initUnivGrid(); // 그리드 다시 그리기
    }
    closeUnivModal();
}


// === 5. 목표 대학 서버 저장 (2주 락 적용) ===
async function saveTargetUnivs() {
    if(!confirm("저장하면 2주 동안 수정할 수 없습니다.\n정말 저장하시겠습니까?")) return;

    // 저장할 데이터 배열 생성
    // 기존 데이터(userTargetUnivs)를 기반으로, 이번에 수정된 내용은 새로 갱신
    const newUnivs = [...userTargetUnivs]; 
    const nowISO = new Date().toISOString(); // 현재 시간 (예: 2026-01-21T12:00:00.000Z)

    // UI상에 있는 빈 슬롯들도 null로 채워 넣어야 순서가 유지됨
    // 8개 슬롯(limit)을 루프 돌며 데이터 구성
    const tierLimits = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 };
    const limit = tierLimits[currentUserTier] || 2; // 기본값 안전장치

    // 배열 길이 맞추기 (8개로 고정하거나 limit에 맞춤)
    while(newUnivs.length < 8) newUnivs.push(null);

    // 현재 선택된 값들로 업데이트
    for(let i=0; i<limit; i++) {
        // 현재 메모리(userTargetUnivs)에 있는 값 확인
        // (selectComplete 함수에서 이미 userTargetUnivs[i]를 업데이트 해뒀음)
        const currentData = userTargetUnivs[i];

        if (currentData && currentData.univ && currentData.major) {
            // 유효한 데이터가 있는데 날짜가 없다? => 방금 새로 입력한 것 => 날짜 부여 (락 시작)
            if (!currentData.date) {
                currentData.date = nowISO;
            }
            // 날짜가 이미 있다면? => 기존에 저장된 것 => 날짜 유지 (락 유지)
        } else {
            // 데이터가 없거나 지워진 경우
            userTargetUnivs[i] = null;
        }
    }

    const userId = localStorage.getItem('userId');
    
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_target_univs',  // 백엔드에서 이 type을 처리해야 함
                userId: userId,
                data: userTargetUnivs // 업데이트된 배열 전체 전송
            })
        });
        
        if(response.ok) {
            alert("저장되었습니다.");
            // 페이지를 새로고침해서 DB 데이터를 다시 확실하게 불러오는 것을 추천
            location.reload(); 
        } else {
            const err = await response.json();
            alert("저장 실패: " + (err.error || "서버 응답 오류"));
        }
    } catch(e) {
        console.error(e);
        alert("통신 중 오류가 발생했습니다.");
    }
}

// === 6. 목표 대학 기본 분석 렌더링 (점수 비교) ===
function renderUnivAnalysis() {
    const container = document.getElementById('univAnalysisResult');
    container.innerHTML = ''; 

    const targets = userTargetUnivs.filter(t => t && t.univ && t.major);

    if (targets.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">설정된 목표 대학이 없습니다.</p>';
        return;
    }

    targets.forEach(target => {
        // 저장된 univMap에서 해당 학과 데이터 찾기
        const majorList = univMap[target.univ] || [];
        const deptInfo = majorList.find(m => m.name === target.major);

        const cutPass = deptInfo ? deptInfo.cut_pass : 0; // 합격권 추정
        const cut70 = deptInfo ? deptInfo.cut_70 : 0;     // 상위 70% 추정

        // [내 점수 자동 계산 로직] 합격권 대비 2% 부족하게 설정 (요청사항)
        let myScore = 0;
        if (cutPass > 0) {
            myScore = cutPass * 0.98; 
        }

        // 점수 차이 계산
        let diff = 0;
        let diffText = '-';
        let diffClass = '';

        if (cutPass > 0) {
            diff = (myScore - cutPass).toFixed(2);
            if (diff >= 0) {
                diffClass = 'high'; diffText = `+${diff} (안정)`;
            } else {
                diffClass = 'low'; diffText = `${diff} (부족)`;
            }
        } else {
            diffText = "데이터 없음";
        }

        const card = document.createElement('div');
        card.className = 'analysis-card';
        card.innerHTML = `
            <div class="analysis-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="univ-badge">${target.univ}</span>
                    <h4>${target.major}</h4>
                </div>
            </div>
            <div class="analysis-body">
                <div class="score-table-box">
                    <table class="score-compare-table">
                        <tr>
                            <th>구분</th>
                            <th>점수 (환산)</th>
                            <th>비고</th>
                        </tr>
                        <tr>
                            <td>합격권 추정</td>
                            <td class="score-val">${cutPass ? cutPass.toFixed(2) : '-'}</td>
                            <td>-</td>
                        </tr>
                        <tr>
                            <td>상위 70% Cut</td>
                            <td class="score-val">${cut70 ? cut70.toFixed(2) : '-'}</td>
                            <td style="font-size:0.8rem; color:#64748b;">안정권 기준</td>
                        </tr>
                        <tr class="score-row highlight">
                            <td>내 환산 점수</td>
                            <td class="score-val" style="color:#2563eb;">${myScore ? myScore.toFixed(2) : '-'}</td>
                            <td style="font-size:0.8rem;">(예상치)</td>
                        </tr>
                        <tr>
                            <td>점수 차이</td>
                            <td colspan="2"><span class="diff-badge ${diff >= 0 ? 'plus' : 'minus'}">${diffText}</span></td>
                        </tr>
                    </table>
                </div>
                <div class="chart-box">
                    <div class="pie-chart"></div>
                    <div class="chart-legend">
                        <div class="legend-item"><span class="color-dot" style="background:#3b82f6"></span>국어</div>
                        <div class="legend-item"><span class="color-dot" style="background:#ef4444"></span>수학</div>
                        <div class="legend-item"><span class="color-dot" style="background:#f59e0b"></span>영어</div>
                        <div class="legend-item"><span class="color-dot" style="background:#10b981"></span>탐구</div>
                    </div>
                    <p style="font-size:0.8rem; margin-top:10px; color:#64748b;">[반영비율 예시]</p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// === 주간 학습 점검 로직 ===

// 모달 열기 (년도 및 날짜 계산)
function openWeeklyCheckModal() {
    if (['free', 'basic'].includes(currentUserTier)) {
        // Standard 이상만 가능 (필요시 주석 해제)
        alert("Standard 멤버십 이상 이용 가능합니다."); 
        return;
    }

    const modal = document.getElementById('weeklyCheckModal');
    
    // 1. 날짜 계산
    const today = new Date();
    const yearShort = today.getFullYear().toString().slice(2); // '26'
    const month = today.getMonth() + 1;
    const week = getWeekOfMonth(today);

    // 2. 텍스트 업데이트 (ID로 직접 접근)
    document.getElementById('weeklyYear').innerText = `${yearShort}년`;
    document.getElementById('weeklyDateDetail').innerText = `${month}월 ${week}주차`;
    
    // 폼 초기화 및 모달 표시
    resetWeeklyForm();
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeWeeklyModal() {
    document.getElementById('weeklyCheckModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 월의 몇 번째 주인지 계산하는 헬퍼 함수
function getWeekOfMonth(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const day = start.getDay() || 7; // 월요일 시작 기준 (1~7)
    const diff = date.getDate() - 1 + (day - 1); 
    return Math.floor(diff / 7) + 1;
}

// 모의고사 타일 선택 함수
function selectMockType(type, element) {
    // 1. 값 저장
    document.getElementById('mockExamType').value = type;
    
    // 2. 비주얼 업데이트 (selected 클래스 이동)
    const tiles = document.querySelectorAll('.mock-tile');
    tiles.forEach(tile => tile.classList.remove('selected'));
    element.classList.add('selected');
    
    // 3. 입력 필드 토글
    toggleMockExamFields();
}

// 1. 학습 시간 자동 계산
function calcStudyRates() {
    const rows = document.querySelectorAll('#studyTimeBody tr');
    let sumPlan = 0;
    let sumAct = 0;

    rows.forEach(row => {
        const planInp = row.querySelector('.plan-time');
        const actInp = row.querySelector('.act-time');
        const rateTxt = row.querySelector('.rate-txt');

        const plan = parseFloat(planInp.value) || 0;
        const act = parseFloat(actInp.value) || 0;

        sumPlan += plan;
        sumAct += act;

        // 개별 달성률 계산
        if (plan > 0) {
            const rate = Math.min((act / plan) * 100, 100).toFixed(0); // 100% 초과 방지
            rateTxt.innerText = `${rate}%`;
            
            // 색상 효과
            if(rate >= 100) rateTxt.style.color = '#10b981'; // 초록
            else if(rate >= 80) rateTxt.style.color = '#3b82f6'; // 파랑
            else rateTxt.style.color = '#ef4444'; // 빨강
        } else {
            rateTxt.innerText = '0%';
            rateTxt.style.color = '#94a3b8';
        }
    });

    // 총계 업데이트
    document.getElementById('totalPlan').innerText = sumPlan.toFixed(1) + 'H';
    document.getElementById('totalAct').innerText = sumAct.toFixed(1) + 'H';
    
    const totalRate = sumPlan > 0 ? Math.min((sumAct / sumPlan) * 100, 100).toFixed(0) : 0;
    const totalRateEl = document.getElementById('totalRate');
    totalRateEl.innerText = `${totalRate}%`;
}

// 2. 모의고사 필드 토글
function toggleMockExamFields() {
    const type = document.getElementById('mockExamType').value;
    const fields = document.getElementById('mockExamFields');
    
    if (type === 'none') {
        fields.style.display = 'none';
        document.getElementById('mockExamProof').value = '';
        document.querySelectorAll('.mock-score').forEach(el => el.value = '');
    } else {
        fields.style.display = 'block';
    }
}

// 3. 하락 원인 토글
function toggleSlumpReason() {
    const trend = document.querySelector('input[name="studyTrend"]:checked')?.value;
    const slumpBox = document.getElementById('slumpReasonBox');
    
    if (trend === 'down') {
        slumpBox.style.display = 'block';
    } else {
        slumpBox.style.display = 'none';
        // 체크박스 해제 로직 등은 선택사항
    }
}

// 4. 글자수 체크
function checkLength(el) {
    const len = el.value.length;
    document.getElementById('currLen').innerText = len;
}

// 폼 초기화
function resetWeeklyForm() {
    document.querySelectorAll('#weeklyCheckModal input').forEach(input => {
        if(input.type === 'radio' || input.type === 'checkbox') input.checked = false;
        else input.value = '';
    });
    document.querySelector('#weeklyCheckModal textarea').value = '';
    
    // 타일 초기화
    document.getElementById('mockExamType').value = 'none';
    const tiles = document.querySelectorAll('.mock-tile');
    tiles.forEach(t => t.classList.remove('selected'));
    tiles[0].classList.add('selected'); // '미응시' 선택
    
    toggleMockExamFields();
    
    document.querySelectorAll('.rate-txt').forEach(el => el.innerText = '0%');
    document.getElementById('totalPlan').innerText = '0H';
    document.getElementById('totalAct').innerText = '0H';
    document.getElementById('totalRate').innerText = '0%';
    document.getElementById('currLen').innerText = '0';
    document.getElementById('slumpReasonBox').style.display = 'none';
}

// === 주간 학습 점검 제출 로직 ===
async function submitWeeklyCheck() {
    // 1. 유효성 검사
    const totalPlan = parseFloat(document.getElementById('totalPlan').innerText);
    if (totalPlan === 0) {
        alert("최소 한 과목 이상의 학습 계획 시간을 입력해주세요.");
        return;
    }

    // 2. 모의고사 데이터 수집
    const mockType = document.getElementById('mockExamType').value;
    let mockData = { type: mockType, proofFile: null, scores: {} };

    if (mockType !== 'none') {
        const fileInput = document.getElementById('mockExamProof');
        if (fileInput.files.length === 0) {
            alert("모의고사 성적 인증 사진을 첨부해주세요.");
            return;
        }
        mockData.proofFile = fileInput.files[0].name; 

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

    // 3. 학습 시간 데이터 수집 (구체적 과목명 포함)
    const studyRows = document.querySelectorAll('#studyTimeBody tr');
    let studyData = [];
    
    studyRows.forEach((row) => {
        // 과목명 가져오기 logic
        let subjName = "";
        
        // 고정 과목(국수탐)인 경우: 텍스트 + (입력된 세부과목)
        const mainSubSpan = row.querySelector('.main-sub');
        const detailInput = row.querySelector('.sub-detail');
        const customInput = row.querySelector('.custom-subj');

        if (mainSubSpan) {
            subjName = mainSubSpan.innerText;
            if (detailInput && detailInput.value.trim()) {
                subjName += `(${detailInput.value.trim()})`; // 예: 수학(미적)
            }
        } else if (customInput) {
            subjName = customInput.value.trim() || "기타";
        } else {
            subjName = row.cells[0].innerText; // 영어 등
        }

        const plan = row.querySelector('.plan-time').value || 0;
        const act = row.querySelector('.act-time').value || 0;
        
        // 데이터가 있는 경우만 저장
        if (plan > 0 || act > 0) {
            studyData.push({ subject: subjName, plan: plan, act: act });
        }
    });

    const trend = document.querySelector('input[name="studyTrend"]:checked')?.value || 'keep';
    let slumpReasons = [];
    if (trend === 'down') {
        document.querySelectorAll('#slumpReasonBox input[type="checkbox"]:checked').forEach(cb => slumpReasons.push(cb.value));
        const detail = document.getElementById('slumpDetail').value;
        if(detail) slumpReasons.push(detail);
    }

    const userId = localStorage.getItem('userId');
    const today = new Date().toISOString();
    const titleText = document.getElementById('weeklyTitle').innerText;

    const weeklyData = {
        date: today,
        title: titleText,
        studyTime: {
            details: studyData,
            totalPlan: document.getElementById('totalPlan').innerText,
            totalAct: document.getElementById('totalAct').innerText,
            totalRate: document.getElementById('totalRate').innerText
        },
        mockExam: mockData,
        trend: { status: trend, reasons: slumpReasons },
        comment: comment
    };

    if(!confirm("이번 주 학습 점검을 제출하시겠습니까?")) return;

    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'save_weekly_check',
                userId: userId,
                data: weeklyData
            })
        });

        if (response.ok) {
            alert("✅ 제출되었습니다! 컨설턴트 피드백을 기다려주세요.");
            closeWeeklyModal();
        } else {
            throw new Error("서버 응답 오류");
        }
    } catch (e) {
        console.error(e);
        alert("제출 실패: " + e.message);
    }
}

// === [신규] 심층 코칭(PRO) 로직 ===

function openDeepCoachingModal() {
    // 1. 권한 체크 (PRO 유저만 가능)
    if (currentUserTier !== 'pro') {
        if (currentUserTier === 'black') {
            alert("BLACK 멤버십 회원님은 [FOR BLACK] 전용관에서\n더 심도 있는 관리를 받으실 수 있습니다.");
            // 선택적으로 FOR BLACK 탭으로 이동시킬 수 있음
            // switchMainTab('solution'); openSolution('black');
        } else {
            alert("PRO 멤버십 전용 기능입니다.\n멤버십을 업그레이드하여 전문가의 1:1 코칭을 받아보세요.");
        }
        return;
    }

    const modal = document.getElementById('deepCoachingModal');
    
    // 초기화
    modal.querySelectorAll('textarea').forEach(el => {
        el.value = '';
        el.parentElement.querySelector('.char-count span').innerText = '0';
    });

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeDeepModal() {
    document.getElementById('deepCoachingModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 글자수 카운터
function updateCharCount(el) {
    const len = el.value.length;
    // 형제 요소 중 char-count 찾기
    const counter = el.parentElement.querySelector('.char-count span');
    if (counter) counter.innerText = len;
}

// 심층 코칭 제출
async function submitDeepCoaching() {
    // 입력값 수집 (순서대로: 계획, 방향, 과목, 기타)
    const textareas = document.querySelectorAll('#deepCoachingModal .pro-textarea');
    const answers = Array.from(textareas).map(t => t.value.trim());

    // 1. 유효성 검사 (최소 1개 이상 작성했는지)
    // 전부 비어있으면 거절
    const isAllEmpty = answers.every(ans => ans === "");
    if (isAllEmpty) {
        alert("최소 한 가지 항목 이상 내용을 작성해주세요.");
        return;
    }

    if (!confirm("작성하신 내용으로 컨설팅을 요청하시겠습니까?\n제출 후에는 수정이 불가능합니다.")) return;

    const userId = localStorage.getItem('userId');
    const today = new Date().toISOString();

    const requestData = {
        date: today,
        plan: answers[0],
        direction: answers[1],
        subject: answers[2],
        etc: answers[3],
        status: 'pending' // 대기중
    };

    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'save_deep_coaching', // Lambda에 이 케이스 추가 필요
                userId: userId,
                data: requestData
            })
        });

        if (response.ok) {
            alert("✅ 컨설팅 요청이 접수되었습니다!\n담당 컨설턴트 배정 후 24시간 내 답변이 등록됩니다.");
            closeDeepModal();
        } else {
            throw new Error("서버 통신 오류");
        }
    } catch (e) {
        console.error(e);
        alert("요청 실패: " + e.message);
    }
}

// === 기타 기능 (기존 유지) ===
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
            body: JSON.stringify({
                type: 'update_profile',
                userId: userId,
                data: { name: newName, phone: newPhone, school: newSchool, email: newEmail }
            })
        });
        if(response.ok) { alert("회원 정보가 수정되었습니다."); location.reload(); } 
        else { throw new Error("저장 실패"); }
    } catch (error) { alert("저장 중 오류가 발생했습니다."); }
}

async function handleDeleteAccount() {
    const isConfirmed = confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 영구 삭제됩니다.");
    if (!isConfirmed) return;
    const userId = localStorage.getItem('userId');
    if (!userId) return window.location.href = 'login.html';
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'delete_user', userId: userId })
        });
        if (response.ok) {
            alert("탈퇴가 완료되었습니다.");
            localStorage.clear(); sessionStorage.clear(); window.location.href = 'index.html';
        } else { throw new Error("탈퇴 실패"); }
    } catch (error) { alert("오류 발생"); }
}
const MYPAGE_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

const UNIV_DATA_API_URL = "https://ftbrlbyaprizjcp5w7b2g5t6sq0srwem.lambda-url.ap-northeast-2.on.aws/"; 

let currentUserTier = 'free'; 
let userTargetUnivs = []; 
let univData = []; // S3에서 가져온 원본 대학 데이터
let univMap = {};  // 대학명 -> [학과목록] 구조로 변환한 데이터
let userQuantData = null; // 학생 성적 데이터 (분석용)

document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    fetchUserData(userId);
    fetchUnivData(); // 대학 데이터 미리 로드
});

// === 유저 정보 불러오기 ===
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
        userQuantData = data.quantitative; // 성적 데이터 저장

    } catch (error) {
        console.error("데이터 로드 중 오류:", error);
    }
}

// === 대학 데이터 S3에서 가져오기 ===
async function fetchUnivData() {
    try {
        // 1. 람다 API 호출 (전체 데이터 요청)
        // UNIV_DATA_API_URL 변수가 상단에 선언되어 있어야 합니다.
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get_all_data' }) // 람다 함수에서 이 type을 확인하여 전체 데이터를 줍니다.
        });

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        
        // 2. 전역 변수에 원본 데이터 저장
        univData = data; 

        // 3. 드롭다운용 데이터 가공: { "서울대": ["컴공", "경영"], ... }
        univMap = {};
        
        univData.forEach(row => {
            const univ = row["대학"];   // JSON 파일의 Key 이름과 일치해야 함
            const major = row["학과명"]; // JSON 파일의 Key 이름과 일치해야 함
            
            // 데이터가 유효한 경우에만 처리
            if (univ && major) {
                if (!univMap[univ]) {
                    univMap[univ] = [];
                }
                // 학과명 중복 방지 (같은 학과가 분할 모집하는 경우 등 대비)
                if (!univMap[univ].includes(major)) {
                    univMap[univ].push(major);
                }
            }
        });

        console.log(`대학 데이터 로드 완료: 총 ${univData.length}개 학과 정보`);

        // 4. 데이터 로드 완료 후 UI 갱신
        // (사용자가 이미 탭을 보고 있을 경우 드롭다운에 옵션을 채워넣기 위함)
        if (document.getElementById('sol-univ').classList.contains('active')) {
            initUnivGrid(); 
        }

    } catch (e) {
        console.error("대학 데이터 로드 실패:", e);
        // 사용자에게 조용히 실패를 알리거나, 재시도 로직을 넣을 수 있음
    }
}

// 정보 렌더링 함수
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
    let tier = 'free';
    let tierClass = '';
    let badgeText = '';

    if (payments && payments.length > 0) {
        const paidHistory = payments.filter(p => p.status === 'paid');
        if (paidHistory.length > 0) {
            paidHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
            const latestPayment = paidHistory[0];
            const productName = (latestPayment.product || "").toLowerCase();

            if (productName.includes('black')) {
                tier = 'black'; tierClass = 'tier-black'; badgeText = 'BLACK MEMBER';
            } else if (productName.includes('pro')) {
                tier = 'pro'; tierClass = 'tier-pro'; badgeText = 'PRO MEMBER';
            } else if (productName.includes('standard')) {
                tier = 'standard'; tierClass = 'tier-standard'; badgeText = 'STANDARD MEMBER';
            } else {
                tier = 'basic'; tierClass = 'tier-basic'; badgeText = 'BASIC MEMBER';
            }
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
        renderUnivAnalysis(); // 분석 탭도 함께 렌더링
    }
    if (solType === 'coach') initCoachLock();
}

// === 2-1. 목표대학 설정 로직 (Dropdown + Lock) ===
function initUnivGrid() {
    const grid = document.getElementById('univGrid');
    grid.innerHTML = ''; 

    const tierLimits = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 };
    const limit = tierLimits[currentUserTier] || 0;
    const now = new Date();

    // 대학 목록 옵션 HTML 생성
    let univOptions = '<option value="">대학 선택</option>';
    Object.keys(univMap).sort().forEach(univ => {
        univOptions += `<option value="${univ}">${univ}</option>`;
    });

    for (let i = 0; i < 8; i++) {
        const isActive = i < limit;
        const savedData = userTargetUnivs[i] || { univ: '', major: '', date: null };
        const slotDiv = document.createElement('div');
        
        if (isActive) {
            slotDiv.className = 'univ-slot';
            
            // 2주 락 체크
            let isLocked = false;
            let dateMsg = '';
            
            if (savedData.date) {
                const savedDate = new Date(savedData.date);
                const unlockDate = new Date(savedDate);
                unlockDate.setDate(unlockDate.getDate() + 14);
                unlockDate.setHours(12, 0, 0, 0); // KST 12:00 설정 (서버시간 고려 필요하지만 일단 로컬처리)

                if (now < unlockDate) {
                    isLocked = true;
                    dateMsg = `🔒 ${unlockDate.getMonth()+1}/${unlockDate.getDate()} 12:00 수정 가능`;
                }
            }

            // HTML 구조 생성
            slotDiv.innerHTML = `
                <label>지망 ${i+1}</label>
                <select id="univ_sel_${i}" onchange="updateMajors(${i})" ${isLocked ? 'disabled' : ''}>
                    ${univOptions}
                </select>
                <select id="major_sel_${i}" ${isLocked ? 'disabled' : ''}>
                    <option value="">학과 선택</option>
                </select>
                ${isLocked ? `<span class="slot-msg">${dateMsg}</span>` : ''}
            `;

            grid.appendChild(slotDiv);

            // 값 복원 (중요: 대학 선택 후 학과 옵션 로드해야 함)
            if (savedData.univ) {
                const uSel = document.getElementById(`univ_sel_${i}`);
                uSel.value = savedData.univ;
                updateMajors(i); // 학과 목록 로드
                if (savedData.major) {
                    document.getElementById(`major_sel_${i}`).value = savedData.major;
                }
            }

        } else {
            // 비활성화 슬롯
            let requiredTier = (i < 5) ? 'Standard' : 'PRO/BLACK';
            slotDiv.className = 'univ-slot locked-tier';
            slotDiv.setAttribute('data-msg', `${requiredTier} 이상`);
            grid.appendChild(slotDiv);
        }
    }
    
    // 저장 버튼 상태 관리 (하나라도 락이 안 걸린게 있으면 활성)
    // 여기선 일단 항상 활성화하되 저장 시 체크
}

// 대학 선택 시 학과 목록 업데이트
function updateMajors(index) {
    const univSel = document.getElementById(`univ_sel_${index}`);
    const majorSel = document.getElementById(`major_sel_${index}`);
    const selectedUniv = univSel.value;

    majorSel.innerHTML = '<option value="">학과 선택</option>';
    
    if (selectedUniv && univMap[selectedUniv]) {
        univMap[selectedUniv].forEach(major => {
            const opt = document.createElement('option');
            opt.value = major;
            opt.innerText = major;
            majorSel.appendChild(opt);
        });
    }
}

// === 목표 대학 저장 (API 호출 + 2주 날짜 기록) ===
async function saveTargetUnivs() {
    if(!confirm("저장하면 2주 동안 수정할 수 없습니다.\n정말 저장하시겠습니까?")) return;

    const newUnivs = [];
    const limit = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 }[currentUserTier] || 0;
    const nowISO = new Date().toISOString();

    for(let i=0; i<limit; i++) {
        const univEl = document.getElementById(`univ_sel_${i}`);
        const majorEl = document.getElementById(`major_sel_${i}`);
        
        if(univEl) {
            // 이미 락 걸려있으면 기존 데이터 유지
            if(univEl.disabled) {
                newUnivs.push(userTargetUnivs[i]);
            } else {
                // 수정 가능한 슬롯
                const uVal = univEl.value;
                const mVal = majorEl.value;
                if(uVal && mVal) {
                    newUnivs.push({ univ: uVal, major: mVal, date: nowISO });
                } else {
                    newUnivs.push(null); // 비어있음
                }
            }
        }
    }

    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_target_univs', 
                userId: userId,
                data: newUnivs
            })
        });
        
        if(response.ok) {
            alert("저장되었습니다.");
            userTargetUnivs = newUnivs;
            initUnivGrid(); 
            renderUnivAnalysis(); // 분석 갱신
        } else {
            alert("저장 실패");
        }
    } catch(e) {
        alert("오류 발생");
    }
}

// === 3. 목표 대학 기본 분석 렌더링 ===
function renderUnivAnalysis() {
    const container = document.getElementById('univAnalysisResult');
    container.innerHTML = ''; // 초기화

    // 유효한 목표 대학 필터링
    const targets = userTargetUnivs.filter(t => t && t.univ && t.major);

    if (targets.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">설정된 목표 대학이 없습니다.</p>';
        return;
    }

    // 내 환산점수 계산 (임시 로직: 실제로는 복잡한 계산 엔진 필요)
    // 여기서는 컷 점수와 비교 효과를 보여주기 위해 더미 값을 생성하거나, 정량 데이터가 있으면 단순 합산
    let myScore = 0;
    if (userQuantData && userQuantData.csat) {
        // 예: 수능 국+수 표준점수 합 (단순 예시)
        const k = parseFloat(userQuantData.csat.kor?.std || 0);
        const m = parseFloat(userQuantData.csat.math?.std || 0);
        myScore = (k + m) * 1.5; // 대략적인 환산점수 흉내
    } else {
        myScore = 400.0; // 데이터 없으면 기본값
    }

    targets.forEach(target => {
        // JSON 데이터에서 해당 학과 정보 찾기
        const info = univData.find(d => d["대학"] === target.univ && d["학과명"] === target.major);
        const cutScore = info ? parseFloat(info["추정 2025 최종등록자 100%cut(환산)"]) : 0;
        
        let diff = 0;
        let diffClass = '';
        let diffText = '-';

        if (cutScore > 0) {
            diff = (myScore - cutScore).toFixed(1);
            if (diff >= 0) {
                diffClass = 'high'; diffText = `+${diff} (안정권)`;
            } else {
                diffClass = 'low'; diffText = `${diff} (부족)`;
            }
        } else {
            diffText = "데이터 없음";
        }

        // 카드 HTML 생성
        const card = document.createElement('div');
        card.className = 'analysis-card';
        card.innerHTML = `
            <div class="analysis-header">
                <h4>${target.univ} ${target.major}</h4>
            </div>
            <div class="analysis-body">
                <div class="score-table-box">
                    <table class="score-compare-table">
                        <tr>
                            <th>구분</th>
                            <th>점수</th>
                        </tr>
                        <tr>
                            <td>합격 컷 (예상)</td>
                            <td>${cutScore || '-'}점</td>
                        </tr>
                        <tr>
                            <td>내 환산 점수</td>
                            <td>${myScore.toFixed(1)}점</td>
                        </tr>
                        <tr>
                            <td>차이</td>
                            <td class="score-diff ${diffClass}">${diffText}</td>
                        </tr>
                    </table>
                </div>
                <div class="chart-box">
                    <div class="pie-chart"></div>
                    <div class="chart-legend">
                        <div class="legend-item"><span class="color-dot" style="background:#3b82f6"></span>국어</div>
                        <div class="legend-item"><span class="color-dot" style="background:#ef4444"></span>수학</div>
                        <div class="legend-item"><span class="color-dot" style="background:#f59e0b"></span>영어</div>
                        <div class="legend-item"><span class="color-dot" style="background:#10b981"></span>탐1</div>
                        <div class="legend-item"><span class="color-dot" style="background:#8b5cf6"></span>탐2</div>
                    </div>
                    <p style="font-size:0.8rem; margin-top:5px; color:#64748b;">(반영비 예시)</p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function initCoachLock() {
    const lockOverlay = document.getElementById('deepCoachingLock');
    if (['pro', 'black'].includes(currentUserTier)) {
        if(lockOverlay) lockOverlay.style.display = 'none';
    } else {
        if(lockOverlay) lockOverlay.style.display = 'flex';
    }
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
        
        if(response.ok) {
            alert("회원 정보가 수정되었습니다.");
            location.reload(); 
        } else {
            throw new Error("저장 실패");
        }
    } catch (error) {
        alert("저장 중 오류가 발생했습니다.");
    }
}

async function handleDeleteAccount() {
    const isConfirmed = confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터(성적, 결제 내역 등)가 영구 삭제되며 복구할 수 없습니다.");
    if (!isConfirmed) return;

    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인 정보가 유효하지 않습니다.");
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'delete_user', 
                userId: userId
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert("탈퇴가 완료되었습니다.\n그동안 이용해 주셔서 감사합니다.");
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        } else {
            throw new Error(result.error || "탈퇴 처리에 실패했습니다.");
        }

    } catch (error) {
        console.error("탈퇴 오류:", error);
        alert("오류가 발생했습니다: " + error.message);
    }
}
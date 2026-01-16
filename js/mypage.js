const MYPAGE_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

// 전역 변수로 현재 유저의 티어 관리 (기본값: free)
let currentUserTier = 'free'; 
let userTargetUnivs = []; // 불러온 목표 대학 데이터 저장

document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    fetchUserData(userId);
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
        
        // 1. 프로필 정보 렌더링
        renderUserInfo(data);
        
        // 2. 결제 상태 확인 및 티어 설정 (가장 중요)
        checkPaymentStatus(data.payments);

        // 3. 조사서 작성 상태 확인
        updateSurveyStatus(data);

        // 4. 목표 대학 정보 저장 (나중에 탭 열 때 사용)
        userTargetUnivs = data.targetUnivs || []; 

    } catch (error) {
        console.error("데이터 로드 중 오류:", error);
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

// 결제 여부 및 티어 확인 함수
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

    // 전역 변수 업데이트
    currentUserTier = tier;

    // UI 적용
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

// === 1. 메인 탭 전환 로직 ===
function switchMainTab(tabName) {
    // 유료 기능 접근 제한 체크
    if (tabName === 'solution' && currentUserTier === 'free') {
        alert("유료 회원만 이용 가능합니다.");
        return;
    }

    // 탭 버튼 스타일
    document.querySelectorAll('.main-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchMainTab('${tabName}')"]`).classList.add('active');

    // 컨텐츠 표시
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // 솔루션 탭 처음 진입 시 기본값(목표대학) 로드
    if (tabName === 'solution') {
        openSolution('univ');
    }
}

// === 2. 나만의 솔루션 서브 메뉴 전환 로직 ===
function openSolution(solType) {
    // 권한 체크 (Standard 이상만 시뮬레이션/코칭 접근)
    if ((solType === 'sim' || solType === 'coach') && ['free', 'basic'].includes(currentUserTier)) {
        alert("Standard 버전 이상만 이용 가능합니다.");
        return;
    }
    // 권한 체크 (Black 전용)
    if (solType === 'black' && currentUserTier !== 'black') {
        alert("BLACK 회원 전용 공간입니다.");
        return;
    }

    // 서브 탭 스타일
    document.querySelectorAll('.sol-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.sol-btn[onclick="openSolution('${solType}')"]`).classList.add('active');

    // 서브 컨텐츠 표시
    document.querySelectorAll('.sol-content').forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(`sol-${solType}`);
    targetContent.classList.add('active');

    // 각 탭별 초기화 로직
    if (solType === 'univ') initUnivGrid();
    if (solType === 'coach') initCoachLock();
    // Black은 정적 UI라 별도 초기화 X
}

// === 2-1. 목표대학 설정 로직 (핵심) ===
function initUnivGrid() {
    const grid = document.getElementById('univGrid');
    grid.innerHTML = ''; // 초기화

    // 티어별 슬롯 개수 설정
    const tierLimits = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 };
    const limit = tierLimits[currentUserTier] || 0;
    
    // 최대 8칸 생성
    for (let i = 0; i < 8; i++) {
        const isActive = i < limit;
        const savedData = userTargetUnivs[i] || { name: '', date: null };
        const slotDiv = document.createElement('div');
        
        if (isActive) {
            // 활성화된 슬롯
            slotDiv.className = 'univ-slot';
            
            // 2주(14일) 수정 제한 체크
            let isLockedByDate = false;
            let dateMsg = '';
            
            if (savedData.date) {
                const savedDate = new Date(savedData.date);
                const now = new Date();
                const diffTime = Math.abs(now - savedDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (diffDays < 14) {
                    isLockedByDate = true;
                    dateMsg = `${savedData.date.split('T')[0]} 저장됨 (수정 불가)`;
                }
            }

            slotDiv.innerHTML = `
                <label>지망 ${i+1}</label>
                <input type="text" placeholder="대학명/학과 입력" 
                       value="${savedData.name}" 
                       ${isLockedByDate ? 'disabled' : ''} 
                       id="univ_input_${i}">
                ${isLockedByDate ? `<span class="slot-date">${dateMsg}</span>` : ''}
            `;
        } else {
            // 비활성화 슬롯 (티어 제한)
            let requiredTier = '';
            if (i < 5) requiredTier = 'Standard';
            else requiredTier = 'PRO/BLACK';
            
            slotDiv.className = 'univ-slot locked';
            slotDiv.setAttribute('data-msg', `${requiredTier} 이상 이용 가능`);
        }
        grid.appendChild(slotDiv);
    }
}

async function saveTargetUnivs() {
    if(!confirm("2주에 1회만 수정 가능합니다.\n정말 저장하시겠습니까?")) return;

    const newUnivs = [];
    const limit = { 'basic': 2, 'standard': 5, 'pro': 8, 'black': 8 }[currentUserTier] || 0;
    const nowISO = new Date().toISOString();

    for(let i=0; i<limit; i++) {
        const input = document.getElementById(`univ_input_${i}`);
        if(input) {
            // 이미 날짜 락이 걸려 disabled된 input은 기존 값 유지
            if(input.disabled) {
                newUnivs.push(userTargetUnivs[i]); 
            } else {
                // 새로 입력/수정하는 경우 날짜 업데이트
                const val = input.value.trim();
                if(val) {
                    newUnivs.push({ name: val, date: nowISO });
                } else {
                    newUnivs.push({ name: '', date: null });
                }
            }
        }
    }

    // 서버 저장 (기존 saveProfile 로직 응용)
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_target_univs', // 백엔드에서 처리 필요
                userId: userId,
                data: newUnivs
            })
        });
        
        if(response.ok) {
            alert("저장되었습니다.");
            // 로컬 데이터 갱신 및 리렌더링
            userTargetUnivs = newUnivs;
            initUnivGrid(); 
        } else {
            alert("저장 실패 (서버 로직 미구현 시 오류 발생 가능)");
        }
    } catch(e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다.");
    }
}

// === 2-3. 코칭 락 처리 ===
function initCoachLock() {
    const lockOverlay = document.getElementById('deepCoachingLock');
    // PRO 이상이면 락 제거
    if (['pro', 'black'].includes(currentUserTier)) {
        if(lockOverlay) lockOverlay.style.display = 'none';
    } else {
        if(lockOverlay) lockOverlay.style.display = 'flex';
    }
}

// === 기존 프로필 저장 함수 (유지) ===
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

// === 회원 탈퇴 함수 (유지) ===
async function handleDeleteAccount() {
    const isConfirmed = confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 삭제되며 복구할 수 없습니다.");
    if (!isConfirmed) return;
    // ... (기존 로직 동일)
    alert("탈퇴 기능 실행"); // 실제 코드는 위에서 제공해주신 것 그대로 유지
}
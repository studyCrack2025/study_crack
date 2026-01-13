// js/mypage.js

const MYPAGE_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

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
        
        // 2. 결제 상태 확인 (뱃지 표시)
        checkPaymentStatus(data.payments);

        // 3. 조사서 작성 상태 확인 (사이드바 표시용)
        updateSurveyStatus(data);

    } catch (error) {
        console.error("데이터 로드 중 오류:", error);
    }
}

// 정보 렌더링 함수
function renderUserInfo(data) {
    // 사이드바
    document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
    document.getElementById('userEmailDisplay').innerText = data.email || localStorage.getItem('userEmail') || '';
    
    // 입력 폼
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileSchool').value = data.school || '';
    document.getElementById('profileEmail').value = data.email || '';
}

// 결제 여부 및 티어 확인 함수
function checkPaymentStatus(payments) {
    const profileBox = document.querySelector('.profile-summary');
    
    // 1. 결제 내역이 없거나 비어있으면 종료
    if (!payments || payments.length === 0) return;

    // 2. 'paid' 상태인 결제만 필터링
    const paidHistory = payments.filter(p => p.status === 'paid');
    if (paidHistory.length === 0) return;

    // 3. 날짜순 정렬 (최신순: 내림차순)
    // 날짜 형식이 "YYYY-MM-DD HH:mm:ss" 또는 ISOString이라고 가정
    paidHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 4. 가장 최근 결제 상품 가져오기
    const latestPayment = paidHistory[0];
    const productName = (latestPayment.product || "").toLowerCase();

    // 5. 티어별 스타일 클래스 및 뱃지 텍스트 결정
    let tierClass = '';
    let badgeText = '';

    if (productName.includes('black')) {
        tierClass = 'tier-black';
        badgeText = 'BLACK MEMBER';
    } else if (productName.includes('pro')) {
        tierClass = 'tier-pro';
        badgeText = 'PRO MEMBER';
    } else if (productName.includes('standard')) {
        tierClass = 'tier-standard';
        badgeText = 'STANDARD MEMBER';
    } else {
        // basic 또는 기타 상품
        tierClass = 'tier-basic';
        badgeText = 'BASIC MEMBER';
    }

    // 6. UI 적용
    // 기존 티어 클래스가 있다면 제거 (혹시 모를 중복 방지)
    profileBox.classList.remove('tier-basic', 'tier-standard', 'tier-pro', 'tier-black');
    profileBox.classList.add(tierClass);

    // 뱃지가 없으면 생성, 있으면 텍스트만 변경
    let badge = document.querySelector('.premium-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'premium-badge';
        profileBox.appendChild(badge);
    }
    badge.innerText = badgeText;
}

// 조사서 작성 상태 업데이트 (사이드바)
function updateSurveyStatus(data) {
    const isQualDone = !!data.qualitative; // 정성 데이터 존재 여부
    const isQuanDone = data.quantitative && Object.keys(data.quantitative).length > 0; // 정량 데이터 존재 여부
    
    const badge = document.getElementById('statusBadge');
    
    document.getElementById('qualStatus').innerText = isQualDone ? "✅ 작성완료" : "❌ 미작성";
    document.getElementById('quanStatus').innerText = isQuanDone ? "✅ 작성완료" : "❌ 미작성";

    badge.className = 'status-badge';
    if (isQualDone && isQuanDone) {
        badge.classList.add('complete');
        badge.innerText = "작성 완료";
    } else if (isQualDone || isQuanDone) {
        badge.classList.add('partial');
        badge.innerText = "작성 중";
    } else {
        badge.classList.add('incomplete');
        badge.innerText = "미작성";
    }
}

// === 프로필 정보 저장 ===
async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const newName = document.getElementById('profileName').value;
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;
    const newEmail = document.getElementById('profileEmail').value;
    
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('newPasswordConfirm').value;

    if (!newName) return alert("이름을 입력해주세요.");
    
    // 비밀번호 확인 로직 (프론트엔드 체크)
    if (newPw && newPw !== confirmPw) {
        return alert("새 비밀번호가 일치하지 않습니다.");
    }

    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_profile',
                userId: userId,
                data: { 
                    name: newName, 
                    phone: newPhone, 
                    school: newSchool, 
                    email: newEmail 
                    // 실제 비밀번호 변경은 Cognito API 호출 필요 (여기서는 생략하고 정보만 전송)
                }
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

// === 회원 탈퇴 함수 ===
async function handleDeleteAccount() {
    const isConfirmed = confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 삭제되며 복구할 수 없습니다.");
    if (!isConfirmed) return;

    const userId = localStorage.getItem('userId');

    try {
        // 1. DynamoDB 데이터 삭제
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'delete_user', userId: userId })
        });

        if (!response.ok) throw new Error("DB 삭제 실패");

        // 2. Cognito 계정 삭제
        const poolData = {
            UserPoolId: CONFIG.cognito.userPoolId,
            ClientId: CONFIG.cognito.clientId
        };
        const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        const cognitoUser = userPool.getCurrentUser();

        if (cognitoUser) {
            cognitoUser.getSession((err, session) => {
                if (err) return alert("세션 만료. 다시 로그인해주세요.");
                
                cognitoUser.deleteUser((err, result) => {
                    if (err) return alert("계정 삭제 실패: " + err.message);
                    alert("탈퇴가 완료되었습니다.");
                    localStorage.clear();
                    window.location.href = 'index.html';
                });
            });
        } else {
            localStorage.clear();
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error(error);
        alert("오류가 발생했습니다.");
    }
}
// js/mypage.js

const MYPAGE_API_URL = CONFIG.api.base; 
let currentUserTier = 'free';
let cognitoUser = null; // Cognito 유저 객체 전역 관리
let currentTutorData = null;

// ==========================================
// [초기화] DOM 로드 및 데이터 페치
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    // Cognito 유저 세션 초기화 (계정 변경 기능을 위해 필요)
    initCognitoUser();

    // 1. 사용자 정보 불러오기
    fetchUserData(userId);

    // 2. UI 이벤트 리스너 등록
    setupUI();
});

// Cognito 유저 초기화
function initCognitoUser() {
    const poolData = { 
        UserPoolId: CONFIG.cognito.userPoolId, 
        ClientId: CONFIG.cognito.clientId 
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const username = localStorage.getItem('username') || localStorage.getItem('email'); // 저장된 username 사용

    if (username) {
        cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });
    }
}

// [보안] XSS 방지용 이스케이프 함수
function escapeHtml(text) {
    if (text == null) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// DynamoDB 포맷 파싱 함수
function parseDynamoItem(item) {
    if (item === undefined || item === null) return null;
    if (typeof item !== 'object') return item;
    if (item.S !== undefined) return item.S;
    if (item.N !== undefined) return Number(item.N);
    if (item.BOOL !== undefined) return item.BOOL;
    if (item.NULL === true) return null;
    if (item.L !== undefined) {
        if (Array.isArray(item.L)) return item.L.map(parseDynamoItem);
        return [];
    }
    if (item.M !== undefined) {
        const obj = {};
        for (const key in item.M) obj[key] = parseDynamoItem(item.M[key]);
        return obj;
    }
    const obj = {};
    const keys = Object.keys(item);
    if (keys.length === 0) return item;
    for (const key of keys) obj[key] = parseDynamoItem(item[key]);
    return obj;
}

// ==========================================
// [데이터 로드] 유저 정보 가져오기
// ==========================================
async function fetchUserData(userId) {
    const token = localStorage.getItem('idToken');
    const safeUserId = userId || localStorage.getItem('userId');
    
    try {
        // (1) 내 정보 가져오기
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: safeUserId }) 
        });
        
        if (!response.ok) throw new Error("서버 통신 오류");
        const rawData = await response.json();
        const userData = parseDynamoItem(rawData); // 내 정보 파싱

        // (2) 내 정보 렌더링
        renderUserInfo(userData);
        applyUserTier(userData.computedTier || 'free');

        // 프로필 이미지 처리
        if (userData.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if (imgElem) {
                imgElem.src = escapeHtml(userData.profileImage);
                checkDeleteButtonVisibility(userData.profileImage);
            }
        }

        // (3) [NEW] 튜터 정보가 있다면 추가로 가져오기
        // 내 정보에 tutorName 필드가 있다고 가정
        if (userData.tutorName) {
            // [디버깅] 여기에 로그를 추가해서 콘솔창(F12)을 확인하세요.
            console.log("학생 데이터에 저장된 튜터 이름:", `"${userData.tutorName}"`); // 따옴표를 넣어 공백 여부 확인
            
            // 공백이 있다면 제거하고 요청
            const cleanTutorName = userData.tutorName.trim();
            await fetchTutorInfo(cleanTutorName, userData.computedTier);
        } else {
            console.log("학생 데이터에 tutorName 필드가 없습니다.");
        }

    } catch (error) { 
        console.error("데이터 로드 실패:", error); 
    }
}

async function fetchTutorInfo(tutorName, userTier) {
    const token = localStorage.getItem('idToken');
    
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'get_tutor_info', 
                data: { tutorName: tutorName } 
            })
        });

        if (response.ok) {
            const resData = await response.json();
            currentTutorData = resData; 
            
            // 티어 확인 후 튜터 보기 버튼 표시 (Standard 이상)
            checkTutorButtonVisibility(userTier || 'free');
        } else {
            // 실패 시 조용히 넘어가거나, 필요하다면 최소한의 경고만 남김
            console.warn("튜터 정보를 불러오지 못했습니다.");
        }
    } catch (e) {
        console.error("fetchTutorInfo Error:", e);
    }
}

function renderUserInfo(data) {
    const nameEl = document.getElementById('userNameDisplay');
    const emailEl = document.getElementById('userEmailDisplay');
    
    if (nameEl) nameEl.innerText = data.name ? data.name : '이름 없음';
    if (emailEl) emailEl.innerText = data.email ? data.email : '';
    
    const nameInput = document.getElementById('profileName');
    if(nameInput) {
        nameInput.value = data.name || '';
        document.getElementById('profilePhone').value = data.phone || '';
        document.getElementById('profileSchool').value = data.school || '';
        const currentEmailDisplay = document.getElementById('currentEmailDisplay');
        if(currentEmailDisplay) currentEmailDisplay.innerText = data.email || '';
    }
}

function applyUserTier(tier) {
    currentUserTier = tier;
    const profileBox = document.querySelector('.profile-summary');
    if (profileBox) {
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
        } else if (badge) {
            badge.remove();
        }
    }
}


// ==========================================
// [기능 1] 기본 인적사항 수정 (개별 토글)
// ==========================================
async function toggleEdit(fieldId, btn) {
    const input = document.getElementById(fieldId);
    
    // 1. 수정 모드로 전환
    if (input.disabled) {
        input.disabled = false;
        input.focus();
        btn.innerText = "저장하기";
        btn.classList.add('saving');
    } 
    // 2. 저장 수행
    else {
        const newValue = input.value.trim();
        if (!newValue) { alert("내용을 입력해주세요."); return; }

        // 필드별 매핑 (DB 컬럼명에 맞춤)
        let dbField = '';
        if (fieldId === 'profileName') dbField = 'name';
        else if (fieldId === 'profilePhone') dbField = 'phone';
        else if (fieldId === 'profileSchool') dbField = 'school';

        // 저장 로직 실행
        const success = await saveSingleField(dbField, newValue);
        
        if (success) {
            alert("수정되었습니다.");
            input.disabled = true;
            btn.innerText = "수정하기";
            btn.classList.remove('saving');
            
            // 이름 변경 시 사이드바 등 즉시 반영
            if (dbField === 'name') {
                const nameEl = document.getElementById('userNameDisplay');
                if (nameEl) nameEl.innerText = newValue;
            }
        }
    }
}

async function saveSingleField(field, value) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                // [변경] 기존 회원가입용 로직과 분리하기 위해 새로운 type 사용
                type: 'update_member_info', 
                userId, 
                data: { [field]: value } 
            })
        });
        
        if(response.ok) return true;
        else throw new Error("저장 실패");
    } catch (error) {
        console.error(error);
        alert("저장 중 오류가 발생했습니다.");
        return false;
    }
}

// ==========================================
// [기능 2] 계정 정보 변경 (모달 & Cognito)
// ==========================================

// --- 모달 공통 ---
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    // 초기화
    if(modalId === 'emailModal') {
        document.getElementById('step-email-input').classList.remove('hidden');
        document.getElementById('step-email-verify').classList.add('hidden');
        document.getElementById('newEmailInput').value = '';
        document.getElementById('emailVerifyCode').value = '';
        if(emailTimerInterval) clearInterval(emailTimerInterval);
    }
    if(modalId === 'passwordModal') {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newChangePassword').value = '';
        document.getElementById('newChangePasswordConfirm').value = '';
    }
}

// --- 이메일 변경 ---
function openEmailModal() {
    document.getElementById('emailModal').classList.remove('hidden');
}

function requestEmailChange() {
    const newEmail = document.getElementById('newEmailInput').value;
    if (!newEmail || !newEmail.includes('@')) { alert("유효한 이메일을 입력해주세요."); return; }

    // Cognito 속성 업데이트 요청
    // 주의: Cognito 설정에서 이메일 변경 시 검증(Verify)을 요구하도록 되어 있어야 함
    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: newEmail })
    ];

    cognitoUser.updateAttributes(attributeList, function(err, result) {
        if (err) {
            alert("이메일 변경 요청 실패: " + (err.message || err));
            return;
        }
        
        // 성공 시 인증 단계로 이동
        alert("인증번호가 전송되었습니다. 이메일을 확인해주세요.");
        document.getElementById('step-email-input').classList.add('hidden');
        document.getElementById('step-email-verify').classList.remove('hidden');
        
        // 타이머 시작
        startTimer(5 * 60, 'emailTimer');
    });
}

function verifyEmailChange() {
    const code = document.getElementById('emailVerifyCode').value;
    if (!code) { alert("인증코드를 입력해주세요."); return; }

    // Cognito 속성 검증
    cognitoUser.verifyAttribute('email', code, {
        onSuccess: async function(result) {
            alert("이메일이 성공적으로 변경되었습니다.");
            
            // DB에도 이메일 정보 동기화
            const newEmail = document.getElementById('newEmailInput').value;
            await saveSingleField('email', newEmail);
            
            closeModal('emailModal');
            location.reload(); // 정보 갱신을 위해 새로고침
        },
        onFailure: function(err) {
            alert("인증 실패: " + (err.message || err));
        }
    });
}

// --- 비밀번호 변경 ---
function openPasswordModal() {
    document.getElementById('passwordModal').classList.remove('hidden');
}

function changePassword() {
    const oldPw = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newChangePassword').value;
    const confirmPw = document.getElementById('newChangePasswordConfirm').value;

    if (!oldPw || !newPw) { alert("모든 항목을 입력해주세요."); return; }
    if (newPw !== confirmPw) { alert("새 비밀번호가 일치하지 않습니다."); return; }
    if (newPw.length < 8) { alert("비밀번호는 8자 이상이어야 합니다."); return; }

    cognitoUser.changePassword(oldPw, newPw, function(err, result) {
        if (err) {
            alert("비밀번호 변경 실패: " + (err.message || err));
            return;
        }
        alert("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
        handleSignOut(); // 보안을 위해 로그아웃
    });
}

// 타이머 함수 (auth.js 참고)
function startTimer(duration, displayId) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById(displayId);
    
    if(emailTimerInterval) clearInterval(emailTimerInterval);
    
    emailTimerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(emailTimerInterval);
            display.textContent = "만료";
            alert("인증 시간이 만료되었습니다. 다시 시도해주세요.");
            closeModal('emailModal');
        }
    }, 1000);
}

// ==========================================
// [기능 3] 프로필 사진 관리
// ==========================================
function triggerFileUpload() { document.getElementById('profileFileInput').click(); }

async function handleProfileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    imgElem.style.opacity = '0.5';

    try {
        const presignRes = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'get_presigned_url',
                userId: userId,
                data: { fileName: file.name, fileType: file.type, folder: 'profile' }
            })
        });

        if (!presignRes.ok) throw new Error("Presigned URL 발급 실패");
        const { uploadUrl, fileUrl } = await presignRes.json();

        const s3Upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        const updateRes = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_user_profile_image', userId: userId, data: { profileImageUrl: fileUrl } })
        });
        if (!updateRes.ok) throw new Error("DB 업데이트 실패");

        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        console.error(e); alert("사진 업로드 중 오류가 발생했습니다.");
        imgElem.src = originalSrc;
    } finally {
        imgElem.style.opacity = '1'; input.value = '';
    }
}

async function handleProfileDelete() {
    if (!confirm("프로필 사진을 삭제하시겠습니까?")) return;
    const imgElem = document.getElementById('profileImg');
    const currentUrl = imgElem.src;
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    try {
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await fetch(CONFIG.api.base, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'delete_s3_file', data: { fileUrl: currentUrl } })
            });
        }
        const dbRes = await fetch(CONFIG.api.base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_user_profile_image', data: { profileImageUrl: "" }, userId: userId })
        });

        if (!dbRes.ok) throw new Error("DB 삭제 실패");
        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("프로필 사진이 삭제되었습니다.");
        checkDeleteButtonVisibility("");

    } catch (e) { console.error(e); alert("삭제 실패"); }
}

function checkDeleteButtonVisibility(url) {
    const deleteBtn = document.getElementById('deletePicBtn');
    if (url && !url.includes('sample_profile') && !url.includes('placehold.co')) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

// ==========================================
// [기능 4] 회원 탈퇴
// ==========================================
async function handleDeleteAccount() {
    if (!confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 영구 삭제됩니다.")) return;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'delete_user', userId })
        });
        if (response.ok) { 
            alert("탈퇴가 완료되었습니다."); 
            localStorage.clear(); sessionStorage.clear(); 
            window.location.href = '/index'; 
        } else { throw new Error("탈퇴 실패"); }
    } catch (error) { alert("오류 발생"); }
}

// 로그아웃 처리 (auth.js와 연동되거나 단독 사용)
function handleSignOut() {
    if (cognitoUser) cognitoUser.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
}

function setupUI() {
    // 모달 닫기 이벤트 등
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    }
}

// ==========================================
// [기능 5] 튜터 프로필 보기 버튼 제어
// ==========================================
function checkTutorButtonVisibility(tier) {
    const btnContainer = document.getElementById('tutorBtnContainer');
    
    // 1. 버튼 컨테이너가 HTML에 있는지 확인 (없으면 에러 방지)
    if (!btnContainer) return;

    // 2. 조건 확인: (Standard 이상 등급) AND (튜터 데이터 존재)
    // 'black' 티어도 있다면 포함
    const allowedTiers = ['standard', 'pro', 'black']; 
    
    if (allowedTiers.includes(tier) && currentTutorData) {
        btnContainer.classList.remove('hidden'); // 버튼 보이기
    } else {
        btnContainer.classList.add('hidden'); // 버튼 숨기기
    }
}

// ==========================================
// [기능 6] 튜터 모달 열기 (데이터 바인딩)
// ==========================================
function openTutorModal() {
    // 1. 데이터 확인
    if (!currentTutorData) {
        alert("튜터 정보가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }
    
    const tutor = currentTutorData;

    // 2. 텍스트 데이터 바인딩
    const setContext = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text || '-';
    };

    setContext('tutorName', tutor.name);
    setContext('tutorNickname', tutor.nickname);
    
    // 학교 + 전공 합쳐서 표시
    const schoolInfo = [tutor.school, tutor.major].filter(Boolean).join(' ');
    setContext('tutorSchoolMajor', schoolInfo || '학교 정보 없음');

    setContext('tutorPhone', tutor.phone || '비공개');
    setContext('tutorStrengths', tutor.strengths);
    
    // 메시지는 따옴표 장식
    const msgEl = document.getElementById('tutorMessage');
    if (msgEl) msgEl.innerText = tutor.message ? `"${tutor.message}"` : '"함께 목표를 달성해봅시다!"';

    // 3. 프로필 이미지 처리
    const imgEl = document.getElementById('tutorProfileImg');
    if (imgEl) {
        // 이미지가 있으면 그 URL, 없으면 기본 이미지
        imgEl.src = tutor.profileImage ? escapeHtml(tutor.profileImage) : 'assets/images/sample_profile.png';
    }

    // 4. 모달 표시 (hidden 클래스 제거)
    const modal = document.getElementById('tutorModal');
    if (modal) modal.classList.remove('hidden');
}
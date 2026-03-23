// js/mypage.js
const FILE_API_URL = CONFIG.api.file;

let currentUserTier = 'free';
let cognitoUser = null; 
let currentTutorData = null;

// 💡 공통 apiFetch 함수 (accessToken 기반 통합 및 401 예외 처리)
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const currentPath = window.location.pathname;
                if (!['/login', '/signup', '/'].includes(currentPath)) {
                    alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                    handleSignOut(); 
                }
                return Promise.reject(new Error("Auth expired")); 
            }
            throw new Error(`서버 통신 오류 (상태 코드: ${response.status})`);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error; 
    }
}

// 💡 한층 더 강력해진 escapeHtml 적용
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// [초기화] DOM 로드 및 데이터 페치
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 기본 토큰 존재 여부만 1차 확인 (accessToken으로 통일)
    const accessToken = localStorage.getItem('accessToken'); 
    if (!accessToken) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    // 2. 세션 갱신 및 데이터 페치를 순차적으로 실행
    initCognitoAndFetchData();

    // 3. UI 이벤트 리스너 등록
    setupUI();
});

function initCognitoAndFetchData() {
    const poolData = { 
        UserPoolId: CONFIG.cognito.userPoolId, 
        ClientId: CONFIG.cognito.clientId 
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    
    cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser != null) {
        cognitoUser.getSession(function(err, session) {
            if (err) {
                alert("세션이 만료되었습니다. 다시 로그인해주세요.");
                handleSignOut(); 
                return;
            }

            // 💡 갱신된 새 토큰(accessToken)을 로컬스토리지에 덮어씌움
            const freshAccessToken = session.getAccessToken().getJwtToken();
            const freshIdToken = session.getIdToken().getJwtToken();
            localStorage.setItem('accessToken', freshAccessToken);
            localStorage.setItem('idToken', freshIdToken);

            const userId = localStorage.getItem('userId');
            fetchUserData(userId);
        });
    } else {
        alert("로그인 정보가 유효하지 않습니다.");
        handleSignOut();
    }
}

// ==========================================
// [데이터 로드] 유저 정보 가져오기
// ==========================================
async function fetchUserData(userId) {
    try {
        // 1. 내 정보 가져오기 (apiFetch 사용)
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user' }) 
        });
        
        const userData = await response.json();

        // 2. 내 정보 렌더링
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

        // 3. 튜터 정보가 있다면 추가로 가져오기
        if (userData.tutorName) {            
            const cleanTutorName = userData.tutorName.trim();
            await fetchTutorInfo(cleanTutorName, userData.computedTier);
        }

    } catch (error) { 
        if (error.message !== "Auth expired") console.error("내 정보 로드 실패:", error);
    }
}

async function fetchTutorInfo(tutorName, userTier) {
    try {
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'get_tutor_info', 
                data: { tutorName: tutorName } 
            })
        });

        const resData = await response.json();
        currentTutorData = resData; 
        
        checkTutorButtonVisibility(userTier || 'free');
    } catch (error) {
        if (error.message !== "Auth expired") console.error("튜터 정보 로드 실패:", error);
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

        let dbField = '';
        if (fieldId === 'profileName') dbField = 'name';
        else if (fieldId === 'profilePhone') dbField = 'phone';
        else if (fieldId === 'profileSchool') dbField = 'school';

        const success = await saveSingleField(dbField, newValue);
        
        if (success) {
            alert("수정되었습니다.");
            input.disabled = true;
            btn.innerText = "수정하기";
            btn.classList.remove('saving');
            
            if (dbField === 'name') {
                const nameEl = document.getElementById('userNameDisplay');
                if (nameEl) nameEl.innerText = newValue;
            }
        }
    }
}

async function saveSingleField(field, value) {
    try {
        await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'update_member_info', 
                data: { [field]: value } 
            })
        });
        return true;
    } catch (error) {
        if (error.message !== "Auth expired") alert("저장 중 오류가 발생했습니다.");
        return false;
    }
}

// ==========================================
// [기능 2] 계정 정보 변경 (모달 & Cognito)
// ==========================================

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
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

function openEmailModal() {
    document.getElementById('emailModal').classList.remove('hidden');
}

function requestEmailChange() {
    const newEmail = document.getElementById('newEmailInput').value;
    if (!newEmail || !newEmail.includes('@')) { alert("유효한 이메일을 입력해주세요."); return; }

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: newEmail })
    ];

    cognitoUser.updateAttributes(attributeList, function(err, result) {
        if (err) {
            alert("이메일 변경 요청 실패: " + (err.message || err));
            return;
        }
        
        alert("인증번호가 전송되었습니다. 이메일을 확인해주세요.");
        document.getElementById('step-email-input').classList.add('hidden');
        document.getElementById('step-email-verify').classList.remove('hidden');
        
        startTimer(5 * 60, 'emailTimer');
    });
}

function verifyEmailChange() {
    const code = document.getElementById('emailVerifyCode').value;
    if (!code) { alert("인증코드를 입력해주세요."); return; }

    cognitoUser.verifyAttribute('email', code, {
        onSuccess: async function(result) {
            alert("이메일이 성공적으로 변경되었습니다.");
            
            const newEmail = document.getElementById('newEmailInput').value;
            await saveSingleField('email', newEmail);
            
            localStorage.setItem('userEmail', newEmail); 
            
            closeModal('emailModal');
            location.reload(); 
        },
        onFailure: function(err) {
            alert("인증 실패: 인증코드가 틀리거나 만료되었습니다.");
        }
    });
}

function openPasswordModal() {
    document.getElementById('passwordModal').classList.remove('hidden');
}

function changePassword() {
    const oldPw = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newChangePassword').value;
    const confirmPw = document.getElementById('newChangePasswordConfirm').value;

    if (!oldPw || !newPw) { alert("모든 항목을 입력해주세요."); return; }
    if (newPw !== confirmPw) { alert("새 비밀번호가 일치하지 않습니다."); return; }
    
    // 💡 강력한 비밀번호 정규식 검사 보완
    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pwRegex.test(newPw)) {
        alert("비밀번호 조건을 확인해주세요.\n(영문 대/소문자, 숫자, 특수문자 포함 8자 이상)");
        document.getElementById('newChangePassword').focus();
        return;
    }

    cognitoUser.changePassword(oldPw, newPw, function(err, result) {
        if (err) {
            if (err.name === 'NotAuthorizedException') alert("현재 비밀번호가 일치하지 않습니다.");
            else alert("비밀번호 변경 실패: 정책에 맞지 않거나 오류가 발생했습니다.");
            return;
        }
        alert("비밀번호가 변경되었습니다. 안전을 위해 다시 로그인해주세요.");
        handleSignOut(); 
    });
}

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

function handleSignOut() {
    if (cognitoUser) cognitoUser.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
}

// ==========================================
// [기능 3] 프로필 사진 관리 (일반 fetch 유지 필수)
// ==========================================
function triggerFileUpload() { document.getElementById('profileFileInput').click(); }

async function handleProfileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    imgElem.style.opacity = '0.5';

    try {
        // 1. Presigned URL 발급 (apiFetch 사용)
        const presignRes = await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_presigned_url',
                data: { fileName: file.name, fileType: file.type, folder: 'profile' }
            })
        });

        const { uploadUrl, fileUrl, fields } = await presignRes.json();

        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
        formData.append('file', file);
        
        // 💡 2. S3 실제 업로드 (순수 fetch 사용)
        const s3Upload = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        // 3. DB 업데이트 (apiFetch 사용)
        await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                data: { profileImageUrl: fileUrl } 
            })
        });

        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        if (e.message !== "Auth expired") alert("사진 업로드 중 오류가 발생했습니다.");
        imgElem.src = originalSrc;
    } finally {
        imgElem.style.opacity = '1'; 
        input.value = '';
    }
}

async function handleProfileDelete() {
    if (!confirm("프로필 사진을 삭제하시겠습니까?")) return;
    const imgElem = document.getElementById('profileImg');
    const currentUrl = imgElem.src;

    try {
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await apiFetch(FILE_API_URL, {
                method: 'POST',
                body: JSON.stringify({ 
                    type: 'delete_s3_file', 
                    data: { fileUrl: currentUrl } 
                })
            });
        }
        
        await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                data: { profileImageUrl: "" } 
            })
        });

        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("프로필 사진이 삭제되었습니다.");
        checkDeleteButtonVisibility("");

    } catch (e) { 
        if (e.message !== "Auth expired") alert("삭제 실패"); 
    }
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
function handleDeleteAccount() {
    document.getElementById('deleteAccountPassword').value = ''; 
    document.getElementById('deleteAccountModal').classList.remove('hidden');
}

function executeDeleteAccount() {
    const password = document.getElementById('deleteAccountPassword').value;
    
    if (!password) {
        alert("비밀번호를 입력해주세요.");
        return;
    }

    if (!cognitoUser) {
        alert("유저 세션이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = '/login';
        return;
    }

    const btn = document.querySelector('#deleteAccountModal .danger-btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 비밀번호 확인 중...`;
    btn.disabled = true;

    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: cognitoUser.getUsername(),
        Password: password,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async function (result) {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 데이터 삭제 중...`;
            await processBackendDeletion();
        },
        onFailure: function (err) {
            // 💡 AWS 원시 에러 대신 친절한 경고창으로 안내
            alert("비밀번호가 일치하지 않습니다. 다시 확인해주세요.");
            btn.innerText = "네, 모든 데이터를 삭제하고 탈퇴합니다";
            btn.disabled = false;
        }
    });
}

async function processBackendDeletion() {
    try {
        await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'delete_user' })
        });
        
        alert("회원 탈퇴가 정상적으로 완료되었습니다. 그동안 스터디크랙을 이용해 주셔서 감사합니다."); 
        localStorage.clear(); 
        sessionStorage.clear(); 
        window.location.href = '/'; 
    } catch (error) { 
        if (error.message !== "Auth expired") alert("서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        const btn = document.querySelector('#deleteAccountModal .danger-btn');
        btn.innerText = "네, 모든 데이터를 삭제하고 탈퇴합니다";
        btn.disabled = false;
    }
}

// ==========================================
// [기능 5] 튜터 프로필 보기 버튼 제어
// ==========================================
function checkTutorButtonVisibility(tier) {
    const btnContainer = document.getElementById('tutorBtnContainer');
    if (!btnContainer) return;

    const allowedTiers = ['standard', 'pro', 'black']; 
    
    if (allowedTiers.includes(tier) && currentTutorData) {
        btnContainer.classList.remove('hidden'); 
    } else {
        btnContainer.classList.add('hidden'); 
    }
}

function setupUI() {
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            handleSignOut();
        });
    }
}

// ==========================================
// [기능 6] 튜터 모달 열기 
// ==========================================
function openTutorModal() {
    if (!currentTutorData) {
        alert("튜터 정보가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }
    
    const tutor = currentTutorData;

    const setContext = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text || '-';
    };

    setContext('tutorNickname', tutor.nickname);
    
    const schoolInfo = [tutor.school, tutor.major].filter(Boolean).join(' ');
    setContext('tutorSchoolMajor', schoolInfo || '학교 정보 없음');

    setContext('tutorStrengths', tutor.strengths);
    
    const msgEl = document.getElementById('tutorMessage');
    if (msgEl) msgEl.innerText = tutor.message ? `"${tutor.message}"` : '"함께 목표를 달성해봅시다!"';

    const imgEl = document.getElementById('tutorProfileImg');
    if (imgEl) {
        imgEl.src = tutor.profileImage ? escapeHtml(tutor.profileImage) : 'assets/images/sample_profile.png';
    }

    const modal = document.getElementById('tutorModal');
    if (modal) modal.classList.remove('hidden');
}
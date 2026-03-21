// js/mypage.js

const USER_API_URL = CONFIG.api.user; 
const FILE_API_URL = CONFIG.api.file;

let currentUserTier = 'free';
let cognitoUser = null; // Cognito 유저 객체 전역 관리
let currentTutorData = null;

// ==========================================
// [초기화] DOM 로드 및 데이터 페치
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 기본 토큰 존재 여부만 1차 확인
    const idToken = localStorage.getItem('idToken'); 
    if (!idToken) {
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
    
    // 현재 세션에 남아있는 유저를 가져옵니다.
    cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser != null) {
        // getSession은 토큰이 만료되었으면 자동으로 Refresh Token을 사용해 새 토큰을 받아옵니다.
        cognitoUser.getSession(function(err, session) {
            if (err) {
                // console.error("세션 갱신 실패:", err);
                alert("세션이 만료되었습니다. 다시 로그인해주세요.");
                handleSignOut(); // 에러 시 깔끔하게 로그아웃
                return;
            }

            // ★ 핵심: 갱신된 따끈따끈한 새 토큰을 가져와서 로컬스토리지에 덮어씌웁니다!
            const freshIdToken = session.getIdToken().getJwtToken();
            localStorage.setItem('idToken', freshIdToken);

            // 이제 새 토큰이 보장된 상태이므로 안전하게 데이터를 불러옵니다.
            const userId = localStorage.getItem('userId');
            fetchUserData(userId);
        });
    } else {
        // 유저 객체를 아예 복구할 수 없는 경우
        alert("로그인 정보가 유효하지 않습니다.");
        handleSignOut();
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
    
    try {
        // (1) 내 정보 가져오기
        const response = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user' }) 
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
            // 공백이 있다면 제거하고 요청
            const cleanTutorName = userData.tutorName.trim();
            await fetchTutorInfo(cleanTutorName, userData.computedTier);
        } else {
            // console.log("학생 데이터에 tutorName 필드가 없습니다.");
        }

    } catch (error) { 
        // console.error("데이터 로드 실패:", error); 
    }
}

async function fetchTutorInfo(tutorName, userTier) {
    const token = localStorage.getItem('idToken');
    
    try {
        const response = await fetch(USER_API_URL, {
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
            // console.warn("튜터 정보를 불러오지 못했습니다.");
        }
    } catch (e) {
        // console.error("fetchTutorInfo Error:", e);
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
    const token = localStorage.getItem('idToken');
    
    try {
        const response = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_member_info', 
                data: { [field]: value } 
            })
        });
        
        if(response.ok) return true;
        else throw new Error("저장 실패");
    } catch (error) {
        // console.error(error);
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
            
            localStorage.setItem('email', newEmail); 
            if(localStorage.getItem('username') && localStorage.getItem('username').includes('@')) {
                localStorage.setItem('username', newEmail);
            }
            
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

// 로그아웃 처리 (auth.js와 연동되거나 단독 사용)
function handleSignOut() {
    if (cognitoUser) cognitoUser.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
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
    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    imgElem.style.opacity = '0.5';

    try {
        // 1. Presigned URL 및 검증 필드(fields) 발급
        const presignRes = await fetch(FILE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'get_presigned_url',
                data: { 
                    fileName: file.name, 
                    fileType: file.type, 
                    folder: 'profile' 
                }
            })
        });

        if (!presignRes.ok) throw new Error("Presigned URL 발급 실패");
        
        const { uploadUrl, fileUrl, fields } = await presignRes.json();

        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
            formData.append(key, value);
        });
        // 주의: S3 정책상 'file' 데이터는 무조건 맨 마지막에 append 되어야 합니다.
        formData.append('file', file);
        const s3Upload = await fetch(uploadUrl, { 
            method: 'POST', 
            body: formData 
        });
        
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        // 3. DB 업데이트
        const updateRes = await fetch(FILE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                data: { profileImageUrl: fileUrl } 
            })
        });
        if (!updateRes.ok) throw new Error("DB 업데이트 실패");

        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        console.error("Upload Error:", e);
        alert("사진 업로드 중 오류가 발생했습니다.");
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
    const token = localStorage.getItem('idToken');

    try {
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            // 파일 삭제
            const delRes = await fetch(FILE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    type: 'delete_s3_file', 
                    data: { fileUrl: currentUrl } 
                })
            });
            if (!delRes.ok) throw new Error("S3 파일 삭제 실패");
        }
        
        // DB 업데이트 (삭제 처리)
        const dbRes = await fetch(FILE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                data: { profileImageUrl: "" } 
            })
        });

        if (!dbRes.ok) throw new Error("DB 프로필 삭제 실패");
        
        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("프로필 사진이 삭제되었습니다.");
        checkDeleteButtonVisibility("");

    } catch (e) { 
        console.error("Delete Error:", e); 
        alert("삭제 실패"); 
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

// 1. 탈퇴 버튼 클릭 시 단순 알림창이 아닌 '비밀번호 확인 모달'을 띄웁니다.
function handleDeleteAccount() {
    document.getElementById('deleteAccountPassword').value = ''; // 모달 열 때마다 비밀번호 입력칸 초기화
    document.getElementById('deleteAccountModal').classList.remove('hidden');
}

// 2. 모달에서 '탈퇴합니다' 버튼을 눌렀을 때 실행되는 로직
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

    // 로딩 상태 표시 (중복 클릭 방지)
    const btn = document.querySelector('#deleteAccountModal .danger-btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 비밀번호 확인 중...`;
    btn.disabled = true;

    // Cognito를 통해 현재 비밀번호가 일치하는지(본인인지) 검증합니다.
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: cognitoUser.getUsername(),
        Password: password,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async function (result) {
            // 비밀번호 검증이 완벽하게 통과되면 실제 DB 삭제 API를 호출합니다.
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 데이터 삭제 중...`;
            await processBackendDeletion();
        },
        onFailure: function (err) {
            // 비밀번호가 틀렸을 경우
            alert("비밀번호가 일치하지 않습니다. 다시 확인해주세요.");
            btn.innerText = "네, 모든 데이터를 삭제하고 탈퇴합니다";
            btn.disabled = false;
        }
    });
}

// 3. 실제 백엔드(DB, Cognito)에서 데이터를 지우는 통신 로직
async function processBackendDeletion() {
    const token = localStorage.getItem('idToken');
    
    try {
        const response = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'delete_user' })
        });
        
        if (response.ok) { 
            alert("회원 탈퇴가 정상적으로 완료되었습니다. 그동안 스터디크랙을 이용해 주셔서 감사합니다."); 
            localStorage.clear(); 
            sessionStorage.clear(); 
            window.location.href = '/'; // 탈퇴 완료 후 메인 페이지로 이동
        } else { 
            throw new Error("탈퇴 처리 실패"); 
        }
    } catch (error) { 
        alert("서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
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
        btnContainer.classList.remove('hidden'); // 버튼 보이기
    } else {
        btnContainer.classList.add('hidden'); // 버튼 숨기기
    }
}

function setupUI() {
    // 모달 닫기 이벤트 등
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); // a 태그의 기본 동작(페이지 맨 위로 튕기는 현상) 방지
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
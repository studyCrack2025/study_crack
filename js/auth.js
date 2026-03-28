// js/auth.js

// API URL 변경 (Gateway 사용)
const USER_API_URL = CONFIG.api.user;
const AUTH_URL = CONFIG.api.auth;

const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// 전역 변수
let isPhoneVerified = false; 
let isEmailVerified = false;

// 💡 무한 루프 방지 및 헤더 병합 에러 방지가 적용된 글로벌 apiFetch
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...(options.headers || {}) };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const currentPath = window.location.pathname;
                if (!['/login', '/signup', '/'].includes(currentPath)) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/login'; 
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

// 💡 [핵심 보안/버그 패치] 분리된 DB 구조에 맞춘 스마트 권한 식별 함수
async function resolveUserIdentity(isLoginEvent = false) {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
        // 1. 학생/튜터 테이블 먼저 찌르기 (UserCore)
        const userRes = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user' })
        });

        if (userRes.ok) {
            const data = await userRes.json();
            if (data.name) localStorage.setItem('userName', data.name);
            if (data.computedTier) localStorage.setItem('userTier', data.computedTier);
            
            const role = data.role || 'student';
            handleRoleSuccess(role, isLoginEvent, data.name);
            return;
        }

        // 2. 만약 404/403 에러가 났다면 관리자(Admin)인지 프로빙 (AdminCore)
        if (userRes.status === 404 || userRes.status === 403) {
            const adminRes = await fetch(CONFIG.api.admin, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'admin_stats' })
            });

            if (adminRes.ok) {
                localStorage.setItem('userName', '관리자');
                handleRoleSuccess('admin', isLoginEvent, '관리자');
                return;
            }
        }

        // 어디에도 없으면 진짜 에러
        throw new Error("계정 정보를 데이터베이스에서 찾을 수 없습니다.");

    } catch (error) {
        console.error("Identity Resolve Error:", error);
        if (isLoginEvent) {
            alert("회원 정보 연동에 실패했습니다. 관리자에게 문의해주세요.");
            handleSignOut(true); // 조용히 로그아웃
        } else {
            console.warn("Session invalid. Logging out silently.");
            handleSignOut(true);
        }
    }
}

// 식별 성공 시 후처리 함수
function handleRoleSuccess(role, isLoginEvent, userName = '회원') {
    const currentLocalRole = localStorage.getItem('userRole');
    
    // 백그라운드 갱신인 경우 (새로고침 시)
    if (!isLoginEvent) {
        if (currentLocalRole !== role) {
            console.warn("Security Event: LocalStorage role mismatch detected. Correcting...");
            localStorage.setItem('userRole', role);
            window.location.reload();
        }
        return;
    }

    // 실제 로그인 이벤트인 경우
    localStorage.setItem('userRole', role);
    if (role === 'admin') {
        alert("관리자 계정으로 로그인되었습니다.");
        window.location.href = '/admin';
    } else if (role === 'tutor') {
        alert(`${userName} 선생님, 안녕하세요.`);
        window.location.href = '/mypage/tutor';
    } else {
        alert("로그인 성공!");
        window.location.href = '/';
    }
}

// 💡 XSS 방지용 이스케이프 함수
function escapeHtml(text) {
    if (text == null) return ""; 
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// [Part A] 초기화 및 유틸리티
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    
    const pwInput = document.getElementById('password');
    const pwConfirmInput = document.getElementById('passwordConfirm');
    if(pwInput && pwConfirmInput) {
        pwInput.addEventListener('input', checkPasswordMatch);
        pwConfirmInput.addEventListener('input', checkPasswordMatch);
    }
    
    const emailInput = document.getElementById('email');
    if (emailInput && pwInput) {
        const triggerSignIn = (e) => { if (e.key === 'Enter') handleSignIn(); };
        emailInput.addEventListener('keypress', triggerSignIn);
        pwInput.addEventListener('keypress', triggerSignIn);
    }
    
    const findEmailName = document.getElementById('findEmailName');
    const findEmailPhone = document.getElementById('findEmailPhone');
    if (findEmailName && findEmailPhone) {
        const triggerFindEmail = (e) => { if (e.key === 'Enter') handleFindEmail(); };
        findEmailName.addEventListener('keypress', triggerFindEmail);
        findEmailPhone.addEventListener('keypress', triggerFindEmail);
    }

    const forgotPwEmail = document.getElementById('forgotPwEmail');
    if (forgotPwEmail) {
        forgotPwEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') requestPasswordReset();
        });
    }
    
    const forgotPwCode = document.getElementById('forgotPwCode');
    const forgotPwNew = document.getElementById('forgotPwNew');
    const forgotPwConfirm = document.getElementById('forgotPwConfirm');
    if (forgotPwCode && forgotPwNew && forgotPwConfirm) {
        const triggerConfirmReset = (e) => { if (e.key === 'Enter') confirmPasswordReset(); };
        forgotPwCode.addEventListener('keypress', triggerConfirmReset);
        forgotPwNew.addEventListener('keypress', triggerConfirmReset);
        forgotPwConfirm.addEventListener('keypress', triggerConfirmReset);
    }

    const chkAll = document.getElementById('chkAll');
    const chkRequired = document.querySelectorAll('.chk-required');
    const chkOptional = document.querySelectorAll('.chk-optional');

    if (chkAll) {
        chkAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            chkRequired.forEach(chk => { chk.checked = isChecked; });
            chkOptional.forEach(chk => { chk.checked = isChecked; });
            updateSubmitButton(); 
        });
    }

    const updateChkAllState = () => {
        const allRequiredChecked = Array.from(chkRequired).every(c => c.checked);
        const allOptionalChecked = Array.from(chkOptional).every(c => c.checked);
        if (chkAll) chkAll.checked = allRequiredChecked && allOptionalChecked;
        updateSubmitButton(); 
    };

    chkRequired.forEach(chk => chk.addEventListener('change', updateChkAllState));
    chkOptional.forEach(chk => chk.addEventListener('change', updateChkAllState));

    const urlParams = new URLSearchParams(window.location.search);
    const promoParam = urlParams.get('promo');
    
    if (promoParam) {
        const promoInput = document.getElementById('promoCode');
        if (promoInput) {
            promoInput.value = promoParam;
            promoInput.readOnly = true; 
            promoInput.style.backgroundColor = '#f1f5f9'; 
        }
    }

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal-overlay')) {
            closeAuthModal(event.target.id);
        }
    });
});

window.openTermModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
};

window.closeTermModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
};

function toggleEtc(type, isShow) {
    let inputId = type === 'major' ? 'majorEtc' : 'referralEtc';
    const etcInput = document.getElementById(inputId);
    if (isShow) {
        etcInput.classList.remove('hidden');
        etcInput.required = true;
    } else {
        etcInput.classList.add('hidden');
        etcInput.required = false;
        etcInput.value = ""; 
    }
}

function checkPasswordMatch() {
    const pw = document.getElementById('password').value;
    const confirm = document.getElementById('passwordConfirm').value;
    const msgBox = document.getElementById('pwMsg');

    if (!confirm) { msgBox.innerHTML = ""; return; }
    
    if (pw === confirm) {
        msgBox.innerHTML = "<span class='text-success'>비밀번호가 일치합니다.</span>";
    } else {
        msgBox.innerHTML = "<span class='text-error'>비밀번호가 일치하지 않습니다.</span>";
    }
}

function getErrorMessage(err) {
    switch (err.code) {
        case "NotAuthorizedException": 
        case "UserNotFoundException":  
            return "이메일 혹은 비밀번호가 정확하지 않습니다.";
        case "UsernameExistsException": return "이미 가입된 이메일입니다.";
        case "InvalidParameterException": return "입력 정보가 올바르지 않습니다.";
        case "InvalidPasswordException": 
            return "비밀번호는 영문 대/소문자, 숫자, 특수문자를 각각 최소 1개 이상 포함하여 8자 이상으로 설정해야 합니다.";
        case "CodeMismatchException": return "인증 코드가 일치하지 않습니다.";
        case "LimitExceededException": return "요청 횟수 초과. 잠시 후 시도하세요.";
        case "UserNotConfirmedException": return "이메일 인증이 완료되지 않은 계정입니다.";
        default: return "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (" + (err.code || "") + ")";
    }
}

function updateSubmitButton() {
    const btn = document.getElementById('finalSubmitBtn');
    if(!btn) return; 

    const chkRequired = document.querySelectorAll('.chk-required');
    let allTermsChecked = true;
    if (chkRequired.length > 0) {
        allTermsChecked = Array.from(chkRequired).every(c => c.checked);
    }

    if (isEmailVerified && isPhoneVerified && allTermsChecked) {
        btn.disabled = false;
        btn.style.backgroundColor = "#2563EB";
        btn.innerText = "회원가입 완료";
    } else {
        btn.disabled = true;
        btn.style.backgroundColor = "#ccc";
        if (!isEmailVerified) btn.innerText = "이메일 인증을 완료해주세요";
        else if (!isPhoneVerified) btn.innerText = "전화번호 인증을 완료해주세요";
        else if (!allTermsChecked) btn.innerText = "필수 약관에 모두 동의해주세요";
    }
}

// ==========================================
// [Part B] 이메일 인증 (Cognito)
// ==========================================
let emailTimerInterval;

async function handleSendCode() {
    const email = document.getElementById('email').value;
    if (!email) { alert("이메일을 입력해주세요."); return; }

    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.innerText = "전송 중...";
    sendBtn.disabled = true;

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_email_auth', email: email })
        });

        if (!response.ok) throw new Error("발송 실패");
        
        alert("이메일로 인증번호가 발송되었습니다.");
        document.getElementById('verifySection').classList.remove('hidden');
        startTimer(5 * 60, 'timer', emailTimerInterval);
    } catch (e) {
        alert("이메일 발송에 실패했습니다.");
    } finally {
        sendBtn.innerText = "재전송";
        sendBtn.disabled = false;
    }
}

async function handleVerify() {
    const email = document.getElementById('email').value;
    const code = document.getElementById('verifyCode').value;

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'verify_code', email: email, code: code })
        });
        const result = await response.json();

        if (result.success) {
            alert("이메일 인증 성공!");
            isEmailVerified = true;
            document.getElementById('verifySection').innerHTML = "<p class='text-success'>✅ 이메일 인증 완료</p>";
            document.getElementById('email').disabled = true;
            updateSubmitButton();
        } else {
            alert("인증번호가 일치하지 않습니다.");
        }
    } catch (e) { alert("확인 중 오류 발생"); }
}

// ==========================================
// [Part C] 전화번호 인증 (Lambda)
// ==========================================
let phoneTimerInterval;

async function handleSendPhoneCode() {
    let phone = document.getElementById('phone').value;
    
    if (!phone) { alert("전화번호를 입력해주세요."); return; }

    let cleanPhone = phone.replace(/-/g, '').trim();
    if (cleanPhone.startsWith('010')) {
        cleanPhone = '+82' + cleanPhone.substring(1); 
    } else if (cleanPhone.startsWith('10')) {
        cleanPhone = '+82' + cleanPhone;
    } else if (!cleanPhone.startsWith('+')) {
        alert("휴대폰 번호 형식을 확인해주세요. (예: 01012345678)");
        return;
    }

    const btn = document.getElementById('sendPhoneCodeBtn');
    btn.innerText = "전송 중...";
    btn.disabled = true;

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_sms_auth', phone: cleanPhone })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "SMS 발송 실패");
        }
        
        alert(`인증번호가 발송되었습니다. 5분 이내에 입력해주세요.`);
        document.getElementById('phoneVerifySection').classList.remove('hidden');
        btn.innerText = "재전송";
        btn.disabled = false;
        document.getElementById('phone').disabled = true;

        startTimer(5 * 60, 'phoneTimer', phoneTimerInterval);

    } catch (error) {
        console.error(error);
        alert("인증번호 발송에 실패했습니다. (관리자에게 문의하세요)");
        btn.innerText = "인증번호 전송";
        btn.disabled = false;
    }
}

async function handleVerifyPhone() {
    let phone = document.getElementById('phone').value.replace(/-/g, '').trim();
    
    if (phone.startsWith('010')) {
        phone = '+82' + phone.substring(1);
    } else if (phone.startsWith('10')) {
        phone = '+82' + phone;
    }

    const inputCode = document.getElementById('phoneVerifyCode').value;
    if (!inputCode) { alert("인증코드를 입력해주세요."); return; }

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'verify_code', 
                phone: phone,          
                code: inputCode
            })
        });

        const result = await response.json();

        if (result.success) {
            alert("전화번호 인증이 완료되었습니다.");
            document.getElementById('phoneVerifySection').innerHTML = "<p class='text-success'>✅ 전화번호 인증 완료</p>";
            isPhoneVerified = true;
            updateSubmitButton();
        } else {
            alert("인증번호가 일치하지 않거나 만료되었습니다.");
        }
    } catch (error) {
        alert("인증 확인 중 오류가 발생했습니다.");
    }
}

// ==========================================
// [Part D] 타이머
// ==========================================

function startTimer(duration, displayId, intervalVar) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById(displayId);
    
    if (displayId === 'timer') clearInterval(emailTimerInterval);
    else clearInterval(phoneTimerInterval);

    const interval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(interval);
            display.textContent = "00:00";
            alert("인증 시간이 만료되었습니다. 재전송 버튼을 눌러주세요.");
        }
    }, 1000);

    if (displayId === 'timer') emailTimerInterval = interval;
    else phoneTimerInterval = interval;
}

// ==========================================
// [Part E] 최종 회원가입 
// ==========================================

async function handleFinalSubmit() {
    if (!isEmailVerified || !isPhoneVerified) {
        alert("이메일과 전화번호 인증을 모두 완료해주세요.");
        return;
    }
    
    const chkRequired = document.querySelectorAll('.chk-required');
    const allTermsAgreed = Array.from(chkRequired).every(chk => chk.checked);

    if (!allTermsAgreed) {
        alert("모든 필수 약관에 동의하셔야 가입이 가능합니다.");
        return;
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const name = document.getElementById('name').value;
    const gender = document.getElementById('gender').value;
    const birthdate = document.getElementById('birthdate').value;
    const phoneRaw = document.getElementById('phone').value;
    
    const chkMarketingEl = document.getElementById('chkMarketing');
    const marketingAgreed = chkMarketingEl ? chkMarketingEl.checked : false;
    const promoCode = document.getElementById('promoCode') ? document.getElementById('promoCode').value : "";

    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pwRegex.test(password)) {
        alert("비밀번호 조건을 확인해주세요.\n(영문 대/소문자, 숫자, 특수문자 포함 8자 이상)");
        document.getElementById('password').focus();
        return;
    }
    
    if (password !== passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    const majorRadio = document.querySelector('input[name="major"]:checked');
    const referralRadio = document.querySelector('input[name="referral"]:checked');

    if (!majorRadio || !referralRadio) {
        alert("희망 계열과 가입 경로를 선택해주세요.");
        return;
    }

    let major = majorRadio.value;
    if (major === 'etc') major = document.getElementById('majorEtc').value;

    let referral = referralRadio.value;
    if (referral === 'etc') referral = document.getElementById('referralEtc').value;

    let onlyNumbers = phoneRaw.replace(/[^0-9]/g, ''); 

    let cleanPhone = onlyNumbers;
    if (cleanPhone.startsWith('010')) {
        cleanPhone = '+82' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('10')) {
        cleanPhone = '+82' + cleanPhone;
    }

    let dbFormattedPhone = onlyNumbers.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'gender', Value: gender }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'given_name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'phone_number', Value: cleanPhone }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'birthdate', Value: birthdate })
    ];

    const submitBtn = document.getElementById('finalSubmitBtn');
    submitBtn.innerText = "가입 처리 중...";
    submitBtn.disabled = true;

    userPool.signUp(email, password, attributeList, null, async function(err, result) {
        if (err) {
            alert(getErrorMessage(err)); 
            submitBtn.innerText = "회원가입 완료";
            submitBtn.disabled = false;
            return;
        }

        const userSub = result.userSub;

        try {
            const response = await fetch(AUTH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'update_profile', 
                    userId: userSub,
                    data: {
                        name: name,
                        email: email,
                        phone: dbFormattedPhone,
                        cognitoPhone: cleanPhone,
                        promoCode: promoCode, 
                        major: major,
                        referral: referral,
                        gender: gender,
                        birthdate: birthdate,
                        termsAgreed: true,
                        marketingAgreed: marketingAgreed
                    }
                })
            });

            if (!response.ok) throw new Error("계정 승인 및 DB 저장 실패");
            
            const authData = { Username: email, Password: password };
            const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
            const cognitoUserToAuth = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

            cognitoUserToAuth.authenticateUser(authDetails, {
                onSuccess: function(authResult) {
                    localStorage.setItem('accessToken', authResult.getAccessToken().getJwtToken());
                    localStorage.setItem('idToken', authResult.getIdToken().getJwtToken());
                    localStorage.setItem('userId', authResult.getIdToken().payload.sub);
                    localStorage.setItem('userEmail', email);
                    localStorage.setItem('userRole', 'student');
                    
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push({
                        event: "login",
                        user_id: authResult.getIdToken().payload.sub
                    });
                    
                    // 신규 가입 시 스마트 라우팅 태우기
                    resolveUserIdentity(true);
                },
                onFailure: function(err) {
                    console.error("Auto Login Failed:", err);
                    setTimeout(() => {
                        if (promoCode) window.location.href = `/welcome?promo=${encodeURIComponent(promoCode)}`;
                        else window.location.href = '/welcome';
                    }, 300);
                }
            });

        } catch (error) {
            console.error(error);
            alert("계정은 생성되었으나 활성화에 실패했습니다. 관리자에게 문의하세요.");
        }
    });
}

// ==========================================
// [Part F] 로그인 및 로그아웃
// ==========================================

function checkLoginStatus() {
    const accessToken = localStorage.getItem('accessToken');
    const userRole = localStorage.getItem('userRole');

    const loginBtn = document.getElementById('loginBtn');
    const myPageBtn = document.getElementById('myPageBtn');
    const adminBtn = document.getElementById('adminBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginBtn && logoutBtn) {
        if (accessToken) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            if (userRole === 'student') {
                if(myPageBtn) myPageBtn.classList.remove('hidden');
                if(adminBtn) adminBtn.classList.add('hidden');
            } else {
                if(myPageBtn) myPageBtn.classList.add('hidden');
                if(adminBtn) adminBtn.classList.remove('hidden');
            }
        } else {
            loginBtn.classList.remove('hidden');
            if(myPageBtn) myPageBtn.classList.add('hidden');
            if(adminBtn) adminBtn.classList.add('hidden');
            logoutBtn.classList.add('hidden');
        }
    }
    
    if (accessToken) {
        // 💡 [핵심] 조용히 백그라운드에서 신분(Role)을 재확인
        resolveUserIdentity(false);
    }
}

function handleSignOut(silent = false) {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) cognitoUser.signOut();
    
    localStorage.clear();
    sessionStorage.clear();
    
    if (!silent) alert("로그아웃 되었습니다.");
    window.location.href = '/login';
}

function handleSignIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert("이메일과 비밀번호를 입력해주세요.");
        return;
    }

    const authData = { Username: email, Password: password };
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: function(result) {
            const accessToken = result.getAccessToken().getJwtToken();
            const idToken = result.getIdToken();
            const userId = idToken.payload.sub;
            
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('idToken', idToken.getJwtToken());
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userId', userId);
            
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: "login",
                user_id: userId
            });
            
            // 💡 [핵심] 로그인 이벤트와 함께 스마트 라우팅 시작
            resolveUserIdentity(true);
        },
        onFailure: function(err) {
            alert(getErrorMessage(err));
        }
    });
}

// ==========================================
// [Part G] 이메일/비밀번호 찾기 로직 
// ==========================================

window.openAuthModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
};

window.closeAuthModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    
    if(modalId === 'forgotPwModal') {
        document.getElementById('forgotPwStep1').classList.remove('hidden');
        document.getElementById('forgotPwStep2').classList.add('hidden');
        document.getElementById('forgotPwEmail').value = '';
        document.getElementById('forgotPwCode').value = '';
        document.getElementById('forgotPwNew').value = '';
        document.getElementById('forgotPwConfirm').value = '';
        const btn = document.getElementById('reqResetBtn');
        if (btn) { btn.innerText = "인증 코드 받기"; btn.disabled = false; }
    } else if (modalId === 'findEmailModal') {
        document.getElementById('findEmailName').value = '';
        document.getElementById('findEmailPhone').value = '';
        document.getElementById('foundEmailResult').classList.add('hidden');
    }
};

async function requestPasswordReset() {
    const email = document.getElementById('forgotPwEmail').value.trim();
    if(!email) { alert("이메일을 입력해주세요."); return; }

    const btn = document.getElementById('reqResetBtn');
    btn.innerText = "발송 중...";
    btn.disabled = true;

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_pw_reset_code', email: email })
        });

        if (response.ok) {
            alert("비밀번호 재설정 코드가 이메일로 발송되었습니다.");
            document.getElementById('forgotPwStep1').classList.add('hidden');
            document.getElementById('forgotPwStep2').classList.remove('hidden');
        } else {
            const data = await response.json();
            alert(data.error || "가입되지 않은 이메일입니다.");
            btn.innerText = "인증 코드 받기";
            btn.disabled = false;
        }
    } catch (e) {
        alert("통신 중 오류가 발생했습니다.");
        btn.innerText = "인증 코드 받기";
        btn.disabled = false;
    }
}

async function confirmPasswordReset() {
    const email = document.getElementById('forgotPwEmail').value.trim();
    const code = document.getElementById('forgotPwCode').value.trim();
    const newPw = document.getElementById('forgotPwNew').value;
    const confirmPw = document.getElementById('forgotPwConfirm').value;

    if(!code || !newPw || !confirmPw) { alert("모든 항목을 입력해주세요."); return; }
    if(newPw !== confirmPw) { alert("비밀번호가 일치하지 않습니다."); return; }
    if(newPw.length < 8) { alert("비밀번호는 8자 이상이어야 합니다."); return; }

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'reset_password', email: email, code: code, newPassword: newPw })
        });

        if (response.ok) {
            alert("비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.");
            closeAuthModal('forgotPwModal');
            document.getElementById('password').value = ''; 
        } else {
            const data = await response.json();
            alert(data.error || "인증코드가 일치하지 않거나 만료되었습니다.");
        }
    } catch (e) {
        alert("통신 중 오류가 발생했습니다.");
    }
}

async function handleFindEmail() {
    const name = document.getElementById('findEmailName').value.trim();
    const phoneRaw = document.getElementById('findEmailPhone').value.replace(/[^0-9]/g, '');

    if (!name || !phoneRaw) { alert("이름과 전화번호를 모두 입력해주세요."); return; }

    let dbFormattedPhone = phoneRaw.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'find_email', name: name, phone: dbFormattedPhone })
        });
        
        if (response.ok) {
            const data = await response.json();
            const resultBox = document.getElementById('foundEmailResult');
            
            if (data.email) {
                resultBox.innerHTML = '';
                resultBox.appendChild(document.createTextNode("회원님의 이메일은 "));
    
                const strongTag = document.createElement('strong');
                strongTag.textContent = escapeHtml(data.email); 
                resultBox.appendChild(strongTag);
    
                resultBox.appendChild(document.createTextNode(" 입니다."));
                resultBox.classList.remove('hidden');
            } else {
                alert("입력하신 정보와 일치하는 계정을 찾을 수 없습니다.");
            }
        } else {
            alert("입력하신 정보와 일치하는 계정을 찾을 수 없습니다.");
        }
    } catch (e) {
        alert("통신 중 오류가 발생했습니다. 잠시 후 시도해주세요.");
    }
}
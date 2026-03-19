// js/auth.js

// API URL 변경 (Gateway 사용)
const API_URL = CONFIG.api.base;
const AUTH_URL = CONFIG.api.auth;

const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// 전역 변수
let tempUserId = ""; 
let isPhoneVerified = false; 
let isEmailVerified = false; 
let serverPhoneCode = ""; 

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
    
    // 엔터키 지원 코드들
    const emailInput = document.getElementById('email');
    if (emailInput && pwInput) {
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSignIn(); 
        });

        pwInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSignIn();
        });
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

    // URL에서 promo 파라미터 확인 후 프로모션 코드 자동 입력
    const urlParams = new URLSearchParams(window.location.search);
    const promoParam = urlParams.get('promo');
    
    if (promoParam) {
        const promoInput = document.getElementById('promoCode');
        if (promoInput) {
            promoInput.value = promoParam;
            // 코드를 임의로 수정하지 못하게 막고 싶다면 아래 두 줄을 유지하세요.
            promoInput.readOnly = true; 
            promoInput.style.backgroundColor = '#f1f5f9'; 
        }
    }
});

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
        case "InvalidPasswordException": return "비밀번호는 8자 이상이어야 합니다.";
        case "CodeMismatchException": return "인증 코드가 일치하지 않습니다.";
        case "LimitExceededException": return "요청 횟수 초과. 잠시 후 시도하세요.";
        case "UserNotConfirmedException": return "이메일 인증이 완료되지 않은 계정입니다.";
        default: return "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (" + (err.code || "") + ")";
    }
}

function updateSubmitButton() {
    const btn = document.getElementById('finalSubmitBtn');
    if(!btn) return; 

    if (isEmailVerified && isPhoneVerified) {
        btn.disabled = false;
        btn.style.backgroundColor = "#2563EB";
        btn.innerText = "회원가입 완료";
    } else {
        btn.disabled = true;
        btn.style.backgroundColor = "#ccc";
        if (!isEmailVerified) btn.innerText = "이메일 인증을 완료해주세요";
        else if (!isPhoneVerified) btn.innerText = "전화번호 인증을 완료해주세요";
    }
}

// ==========================================
// [Part B] 이메일 인증 (Cognito)
// ==========================================
let emailTimerInterval;

// [수정] 이메일 인증번호 발송 (Cognito signUp 호출 제거)
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

// [수정] 이메일 인증번호 확인
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
        // [중요] SMS 발송은 로그인 전이므로 토큰 없이 요청 (백엔드에서 SMS 타입은 토큰 체크 안함)
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'send_sms_auth', 
                phone: cleanPhone 
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "SMS 발송 실패");
        }
        
        const data = await response.json();
        
        alert(`인증번호가 발송되었습니다.`);
        document.getElementById('phoneVerifySection').classList.remove('hidden');
        btn.innerText = "재전송";
        btn.disabled = false;
        document.getElementById('phone').disabled = true;

        startTimer(3 * 60, 'phoneTimer', phoneTimerInterval);

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
    // 이제 phone은 '+821012345678' 형태가 됩니다.

    const inputCode = document.getElementById('phoneVerifyCode').value;
    if (!inputCode) { alert("인증코드를 입력해주세요."); return; }

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'verify_code', // Lambda에서 이 타입으로 처리하는지 확인
                phone: phone,          // 변환된 +82 번호 전송
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
// [Part E] 최종 회원가입 (DB 저장)
// ==========================================

async function handleFinalSubmit() {
    // 1. 사전 검증
    if (!isEmailVerified || !isPhoneVerified) {
        alert("이메일과 전화번호 인증을 모두 완료해주세요.");
        return;
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const name = document.getElementById('name').value;
    const gender = document.getElementById('gender').value;
    const birthdate = document.getElementById('birthdate').value;
    const phoneRaw = document.getElementById('phone').value;
    
    // 대신 promoCode를 여기서 미리 가져오면 깔끔합니다.
    const promoCode = document.getElementById('promoCode').value;

    // 2. 비밀번호 재확인
    if (password !== passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    // 3. 라디오 버튼 값 추출 (계열 및 유입경로)
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

    // 4. 전화번호 형식 변환
    let onlyNumbers = phoneRaw.replace(/[^0-9]/g, ''); // 사용자가 어떻게 입력했든 숫자만 쏙 빼냅니다.

    // 4-1. Cognito 가입용 (+82 포맷)
    let cleanPhone = onlyNumbers;
    if (cleanPhone.startsWith('010')) {
        cleanPhone = '+82' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('10')) {
        cleanPhone = '+82' + cleanPhone;
    }

    // 4-2. DB 저장용 (010-XXXX-XXXX 포맷 강제 적용)
    let dbFormattedPhone = onlyNumbers;
    if (onlyNumbers.length === 11) {
        // 11자리 번호 (ex: 01012345678 -> 010-1234-5678)
        dbFormattedPhone = onlyNumbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (onlyNumbers.length === 10) {
        // 예전 10자리 번호 예외 처리 (ex: 0111234567 -> 011-123-4567)
        dbFormattedPhone = onlyNumbers.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }

    // 5. Cognito 전송용 속성 설정
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

    // 6. Cognito 회원가입 실행
    userPool.signUp(email, password, attributeList, null, async function(err, result) {
        if (err) {
            alert(getErrorMessage(err)); 
            submitBtn.innerText = "회원가입 완료";
            submitBtn.disabled = false;
            return;
        }

        const userSub = result.userSub;

        // 7. 성공 시 Lambda 호출 (승인 + DB 저장 한 번에!)
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
                        promoCode: promoCode, 
                        major: major,
                        referral: referral,
                        gender: gender,
                        birthdate: birthdate
                    }
                })
            });

            if (!response.ok) throw new Error("계정 승인 및 DB 저장 실패");
            
            // 가입 완료 즉시 '자동 로그인'을 백그라운드에서 실행합니다.
            const authData = { Username: email, Password: password };
            const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
            const cognitoUserToAuth = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

            cognitoUserToAuth.authenticateUser(authDetails, {
                onSuccess: function(authResult) {
                    // 로그인 토큰을 브라우저에 저장
                    localStorage.setItem('accessToken', authResult.getAccessToken().getJwtToken());
                    localStorage.setItem('idToken', authResult.getIdToken().getJwtToken());
                    localStorage.setItem('userId', authResult.getIdToken().payload.sub);
                    localStorage.setItem('userEmail', email);
                    
                    const isTutor = (promoCode === "studycrack_1111");
                    localStorage.setItem('userRole', isTutor ? 'tutor' : 'student');
                    
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push({
                        event: "login",
                        userid: currentUserId
                    });
                    
                    // 이미 로그인(토큰 발급)이 완료된 상태로 Welcome 페이지 이동!
                    if (promoCode) {
                        window.location.href = `/welcome?promo=${encodeURIComponent(promoCode)}`;
                    } else {
                        window.location.href = '/welcome';
                    }
                },
                onFailure: function(err) {
                    // 혹시라도 자동 로그인이 실패하면 기존처럼 수동 로그인하도록 Welcome 이동
                    console.error("Auto Login Failed:", err);
                    if (promoCode) {
                        window.location.href = `/welcome?promo=${encodeURIComponent(promoCode)}`;
                    } else {
                        window.location.href = '/welcome';
                    }
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
}

function handleSignOut() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) cognitoUser.signOut();
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userTier');
    
    alert("로그아웃 되었습니다.");
    window.location.href = '/';
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
                userid: userId
            });
            
            // [중요] 토큰 헤더 포함해서 유저 정보 조회 (Authorization)
            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}` // ★ 토큰 추가
                },
                body: JSON.stringify({ type: 'get_user' }) 
            })
            .then(res => {
                if (!res.ok) throw new Error("회원 정보를 불러오지 못했습니다.");
                return res.json();
            })
            .then(data => {
                if (data.name) {
                    localStorage.setItem('userName', data.name);
                }

                if (data.computedTier) {
                    localStorage.setItem('userTier', data.computedTier);
                }

                if (data.role === 'admin') {
                    localStorage.setItem('userRole', 'admin');
                    alert("관리자 계정으로 로그인되었습니다.");
                    window.location.href = '/admin';

                } else if (data.role === 'tutor') {
                    localStorage.setItem('userRole', 'tutor');
                    
                    // [수정] 튜터 실명으로 환영 메시지 출력
                    const tutorName = data.name || '스터디크랙';
                    alert(`${tutorName} 선생님, 안녕하세요.`);
                    
                    window.location.href = '/mypage/tutor';

                } else {
                    localStorage.setItem('userRole', 'student');
                    alert("로그인 성공!");
                    window.location.href = '/';
                }
            })
            .catch(err => {
                console.error("Role Check Error:", err);
                alert("회원 정보 불러오기 실패! : " + err.message);
            });
        },
        onFailure: function(err) {
            alert(getErrorMessage(err));
        }
    });
}

// ==========================================
// [Part G] 이메일/비밀번호 찾기 로직
// ==========================================

// 모달 열기/닫기 유틸리티
function openAuthModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeAuthModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    // 데이터 초기화
    if(modalId === 'forgotPwModal') {
        document.getElementById('forgotPwStep1').classList.remove('hidden');
        document.getElementById('forgotPwStep2').classList.add('hidden');
        document.getElementById('forgotPwEmail').value = '';
        document.getElementById('forgotPwCode').value = '';
        document.getElementById('forgotPwNew').value = '';
        document.getElementById('forgotPwConfirm').value = '';
        const btn = document.getElementById('reqResetBtn');
        btn.innerText = "인증 코드 받기";
        btn.disabled = false;
    } else if (modalId === 'findEmailModal') {
        document.getElementById('findEmailName').value = '';
        document.getElementById('findEmailPhone').value = '';
        document.getElementById('foundEmailResult').classList.add('hidden');
    }
}

// 1. 비밀번호 찾기
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

// 2. 비밀번호 재설정 확정
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

// 3. 이메일 찾기
async function handleFindEmail() {
    const name = document.getElementById('findEmailName').value.trim();
    const phoneRaw = document.getElementById('findEmailPhone').value.replace(/[^0-9]/g, '');

    if (!name || !phoneRaw) { alert("이름과 전화번호를 모두 입력해주세요."); return; }

    let dbFormattedPhone = phoneRaw;
    if (phoneRaw.length === 11) {
        dbFormattedPhone = phoneRaw.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (phoneRaw.length === 10) {
        dbFormattedPhone = phoneRaw.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'find_email', name: name, phone: dbFormattedPhone })
        });
        
        if (response.ok) {
            const data = await response.json();
            const resultBox = document.getElementById('foundEmailResult');
            
            if (data.email) {
                resultBox.innerHTML = `회원님의 이메일은 <strong>${data.email}</strong> 입니다.`;
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
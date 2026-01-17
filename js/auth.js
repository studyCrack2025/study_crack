// js/auth.js

// API URL & Cognito 설정
const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
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
    
    // 비밀번호 확인 리스너 (요소가 있을 때만 연결)
    const pwInput = document.getElementById('password');
    const pwConfirmInput = document.getElementById('passwordConfirm');
    if(pwInput && pwConfirmInput) {
        pwInput.addEventListener('input', checkPasswordMatch);
        pwConfirmInput.addEventListener('input', checkPasswordMatch);
    }
});

// 기타(etc) 입력창 토글 함수
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

// 비밀번호 일치 확인
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

// Cognito 에러 메시지 한글 변환
function getErrorMessage(err) {
    switch (err.code) {
        case "UsernameExistsException": return "이미 가입된 이메일입니다.";
        case "InvalidParameterException": return "입력 정보가 올바르지 않습니다.";
        case "InvalidPasswordException": return "비밀번호는 8자 이상이어야 합니다.";
        case "CodeMismatchException": return "인증 코드가 일치하지 않습니다.";
        case "LimitExceededException": return "요청 횟수 초과. 잠시 후 시도하세요.";
        default: return "오류 발생: " + (err.message || err.code);
    }
}

// 가입 버튼 활성화 업데이트
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

function handleSendCode() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const name = document.getElementById('name').value;
    const gender = document.getElementById('gender').value;
    const birthdate = document.getElementById('birthdate').value;

    if (!email || !password || !name || !birthdate) {
        alert("기본 정보를 모두 입력해주세요.");
        return;
    }
    if (password !== passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'gender', Value: gender }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'birthdate', Value: birthdate })
    ];

    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.innerText = "전송 중...";
    sendBtn.disabled = true;

    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            alert(getErrorMessage(err));
            sendBtn.innerText = "인증번호 받기";
            sendBtn.disabled = false;
            return;
        }

        tempUserId = result.userSub; 
        alert("인증번호가 발송되었습니다. 이메일을 확인해주세요.");
        
        document.getElementById('verifySection').classList.remove('hidden');
        sendBtn.innerText = "재전송";
        sendBtn.disabled = false;
        document.getElementById('email').disabled = true; 
        
        startTimer(5 * 60, 'timer', emailTimerInterval); 
    });
}

function handleVerify() {
    const email = document.getElementById('email').value;
    const code = document.getElementById('verifyCode').value;

    if (!code) { alert("인증코드를 입력해주세요."); return; }

    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, function(err, result) {
        if (err) {
            alert(getErrorMessage(err));
            return;
        }
        
        alert("이메일 인증이 완료되었습니다.");
        document.getElementById('verifySection').innerHTML = "<p class='text-success'>✅ 이메일 인증 완료</p>";
        isEmailVerified = true;
        updateSubmitButton();
    });
}

// ==========================================
// [Part C] 전화번호 인증 (Lambda)
// ==========================================
let phoneTimerInterval;

async function handleSendPhoneCode() {
    const phone = document.getElementById('phone').value;
    if (!phone || phone.length < 10) {
        alert("올바른 전화번호를 입력해주세요.");
        return;
    }

    const btn = document.getElementById('sendPhoneCodeBtn');
    btn.innerText = "전송 중...";
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_sms_auth', phone: phone })
        });

        if (!response.ok) throw new Error("SMS 발송 실패");
        const data = await response.json();
        
        serverPhoneCode = data.authCode; 
        alert(`인증번호가 발송되었습니다.`);
        document.getElementById('phoneVerifySection').classList.remove('hidden');
        btn.innerText = "재전송";
        btn.disabled = false;
        document.getElementById('phone').disabled = true;

        startTimer(3 * 60, 'phoneTimer', phoneTimerInterval);

    } catch (error) {
        console.error(error);
        alert("인증번호 발송에 실패했습니다.");
        btn.innerText = "인증번호 전송";
        btn.disabled = false;
    }
}

function handleVerifyPhone() {
    const inputCode = document.getElementById('phoneVerifyCode').value;
    
    if (inputCode && inputCode == serverPhoneCode) {
        alert("전화번호 인증이 완료되었습니다.");
        document.getElementById('phoneVerifySection').innerHTML = "<p class='text-success'>✅ 전화번호 인증 완료</p>";
        isPhoneVerified = true;
        updateSubmitButton(); 
    } else {
        alert("인증번호가 일치하지 않습니다.");
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
    // 1. 인증 상태 재확인
    if (!isEmailVerified || !isPhoneVerified) {
        alert("이메일과 전화번호 인증을 모두 완료해주세요.");
        return;
    }

    // 2. 선택 정보 가져오기 (오류 방지)
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

    // 3. 나머지 정보 가져오기
    const name = document.getElementById('name').value;
    const phoneRaw = document.getElementById('phone').value;
    const school = document.getElementById('school').value;
    const email = document.getElementById('email').value;

    if (!tempUserId) {
        alert("오류: 회원 식별 정보가 없습니다. 새로고침 후 다시 시도해주세요.");
        return;
    }

    // 4. DB 저장 API 호출
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_profile',
                userId: tempUserId,
                data: {
                    name: name,
                    phone: phoneRaw,
                    school: school,
                    email: email,
                    major: major,      
                    referral: referral 
                }
            })
        });

        if (!response.ok) throw new Error("DB 저장 실패");
        
        alert("회원가입이 성공적으로 완료되었습니다! 로그인 페이지로 이동합니다.");
        window.location.href = 'login.html';

    } catch (error) {
        console.error(error);
        alert("회원가입 마무리 중 오류가 발생했습니다. 관리자에게 문의하세요.");
    }
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
            if (userRole === 'admin') {
                if(myPageBtn) myPageBtn.classList.add('hidden');
                if(adminBtn) adminBtn.classList.remove('hidden');
            } else {
                if(myPageBtn) myPageBtn.classList.remove('hidden');
                if(adminBtn) adminBtn.classList.add('hidden');
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
    localStorage.clear();
    alert("로그아웃 되었습니다.");
    window.location.href = 'index.html';
}

function handleSignIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

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
            
            // 로그인 후 권한(Role) 확인
            fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ type: 'get_user', userId: userId })
            })
            .then(res => res.json())
            .then(data => {
                if (data.role === 'admin') {
                    localStorage.setItem('userRole', 'admin');
                    alert("관리자 계정으로 로그인되었습니다.");
                    window.location.href = 'admin.html';
                } else {
                    localStorage.setItem('userRole', 'student');
                    alert("로그인 성공!");
                    window.location.href = 'index.html';
                }
            })
            .catch(err => {
                console.error(err);
                // DB에 정보가 없는 경우라도 일반 로그인 처리
                localStorage.setItem('userRole', 'student');
                alert("로그인 성공!");
                window.location.href = 'index.html';
            });
        },
        onFailure: function(err) {
            alert("로그인 실패: " + getErrorMessage(err));
        }
    });
}
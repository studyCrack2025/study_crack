// js/auth.js

// API URL & Cognito 설정
const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

let tempUserId = ""; 
let isPhoneVerified = false; // 전화번호 인증 상태
let isEmailVerified = false; // 이메일 인증 상태 (가입 완료 시 true)
let serverPhoneCode = "";    // 서버에서 받은 인증코드 (해시 또는 실제값)

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
});

// 기타(etc) 입력창 토글 함수
function toggleEtc(type, isShow) {
    let inputId = "";
    if (type === 'major') inputId = 'majorEtc';
    else if (type === 'referral') inputId = 'referralEtc';

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

// Cognito 에러 메시지 한글 변환 함수
function getErrorMessage(err) {
    switch (err.code) {
        case "UsernameExistsException":
            return "이미 가입된 이메일입니다.";
        case "InvalidParameterException":
            return "입력 정보가 올바르지 않습니다. (이메일 형식을 확인해주세요)";
        case "InvalidPasswordException":
            return "비밀번호는 8자 이상, 영문/숫자/특수문자를 포함해야 합니다.";
        case "CodeMismatchException":
            return "인증 코드가 일치하지 않습니다.";
        case "LimitExceededException":
            return "요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.";
        default:
            return "오류가 발생했습니다: " + (err.message || err.code);
    }
}

// 가입 버튼 상태 업데이트
function updateSubmitButton() {
    const btn = document.getElementById('finalSubmitBtn');
    
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
// [Part B] 이메일 인증 (Cognito 회원가입)
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
            // [수정] 한글 에러 메시지 적용
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

    cognitoUser.confirmRegistration(code, true, async function(err, result) {
        if (err) {
            alert(getErrorMessage(err));
            return;
        }
        
        alert("이메일 인증이 완료되었습니다.");
        document.getElementById('verifySection').innerHTML = "<p class='text-success'>✅ 이메일 인증 완료</p>";
        isEmailVerified = true;
        updateSubmitButton();
        
        try {
            await createInitialUserDB();
        } catch (dbErr) {
            console.error(dbErr);
        }
    });
}

// ==========================================
// [Part C] 전화번호 인증 (실제 API 연동)
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
        // [수정] 실제 Lambda API 호출하여 SMS 발송 요청
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'send_sms_auth', // Lambda에서 이 타입을 처리해야 함
                phone: phone
            })
        });

        if (!response.ok) throw new Error("SMS 발송 실패");
        const data = await response.json();
        
        // 서버에서 인증코드(또는 해시)를 임시 저장 (클라이언트 검증용)
        // 보안을 위해 서버에서 검증하는 것이 좋으나, 간편 구현을 위해 코드를 받음
        serverPhoneCode = data.authCode; 

        alert(`인증번호가 발송되었습니다.`);
        document.getElementById('phoneVerifySection').classList.remove('hidden');
        btn.innerText = "재전송";
        btn.disabled = false;
        document.getElementById('phone').disabled = true;

        startTimer(3 * 60, 'phoneTimer', phoneTimerInterval);

    } catch (error) {
        console.error(error);
        alert("인증번호 발송에 실패했습니다. 관리자에게 문의하세요.");
        btn.innerText = "인증번호 전송";
        btn.disabled = false;
    }
}

function handleVerifyPhone() {
    const inputCode = document.getElementById('phoneVerifyCode').value;
    
    // [수정] 서버에서 받은 코드와 비교
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
// [Part D] 타이머 및 DB 저장
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
            alert("인증 시간이 만료되었습니다. 재전송 버튼을 눌러주세요.");
        }
    }, 1000);

    if (displayId === 'timer') emailTimerInterval = interval;
    else phoneTimerInterval = interval;
}

// DB 초기 데이터 생성 및 추가 정보 업데이트
async function createInitialUserDB() {
    const name = document.getElementById('name').value;
    const phoneRaw = document.getElementById('phone').value;
    const school = document.getElementById('school').value;
    const email = document.getElementById('email').value; 

    let major = document.querySelector('input[name="major"]:checked').value;
    if (major === 'etc') major = document.getElementById('majorEtc').value;

    let referral = document.querySelector('input[name="referral"]:checked').value;
    if (referral === 'etc') referral = document.getElementById('referralEtc').value;

    if (!tempUserId) return;

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

    if (!response.ok) throw new Error("DB 생성 실패");
    
    if (isPhoneVerified && isEmailVerified) {
        alert("회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.");
        window.location.href = 'login.html';
    }
}

// ==========================================
// [Part E] 로그인/로그아웃 (기존 로직 유지)
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
            });
        },
        onFailure: function(err) {
            alert("로그인 실패: " + getErrorMessage(err));
        }
    });
}
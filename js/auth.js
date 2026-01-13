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

// 기타(etc) 입력창 토글 함수 (희망계열, 유입경로 공용)
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

// 가입 버튼 상태 업데이트
function updateSubmitButton() {
    const btn = document.getElementById('finalSubmitBtn');
    
    // 이메일과 전화번호 모두 인증되어야 가입 가능
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
    
    // 필수 값 체크
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

    // Cognito 회원가입 요청 (이메일로 코드 발송됨)
    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            alert("인증번호 발송 실패: " + err.message);
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
            alert("인증 실패: " + err.message);
            return;
        }
        
        // 이메일 인증 성공
        alert("이메일 인증이 완료되었습니다.");
        document.getElementById('verifySection').innerHTML = "<p class='text-success'>✅ 이메일 인증 완료</p>";
        isEmailVerified = true;
        updateSubmitButton();
        
        // 이메일 인증 후 DB에 초기 데이터 생성 시도
        try {
            await createInitialUserDB();
        } catch (dbErr) {
            console.error(dbErr);
        }
    });
}

// ==========================================
// [Part C] 전화번호 인증 (UI 시뮬레이션)
// ==========================================

let phoneTimerInterval;

function handleSendPhoneCode() {
    const phone = document.getElementById('phone').value;
    if (!phone || phone.length < 10) {
        alert("올바른 전화번호를 입력해주세요.");
        return;
    }

    const btn = document.getElementById('sendPhoneCodeBtn');
    btn.innerText = "전송 중...";
    btn.disabled = true;

    // 실제로는 여기서 백엔드 API를 호출하여 SMS를 발송해야 합니다.
    // 현재는 UI 시뮬레이션으로 1초 후 성공 처리합니다.
    setTimeout(() => {
        alert(`인증번호가 발송되었습니다.\n(테스트용 인증코드: 123456)`);
        document.getElementById('phoneVerifySection').classList.remove('hidden');
        btn.innerText = "재전송";
        btn.disabled = false;
        document.getElementById('phone').disabled = true;

        startTimer(3 * 60, 'phoneTimer', phoneTimerInterval);
    }, 1000);
}

function handleVerifyPhone() {
    const code = document.getElementById('phoneVerifyCode').value;
    
    // 테스트용 하드코딩된 인증번호 '123456'
    if (code === '123456') {
        alert("전화번호 인증이 완료되었습니다.");
        document.getElementById('phoneVerifySection').innerHTML = "<p class='text-success'>✅ 전화번호 인증 완료</p>";
        isPhoneVerified = true;
        updateSubmitButton(); // 가입 버튼 활성화 체크
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
    
    clearInterval(intervalVar);

    intervalVar = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(intervalVar);
            alert("인증 시간이 만료되었습니다. 재전송 버튼을 눌러주세요.");
        }
    }, 1000);
}

// DB 초기 데이터 생성 및 추가 정보 업데이트
async function createInitialUserDB() {
    const name = document.getElementById('name').value;
    const phoneRaw = document.getElementById('phone').value;
    const school = document.getElementById('school').value;
    const email = document.getElementById('email').value; 

    // 라디오 버튼 값 가져오기 (기타 처리 포함)
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
                major: major,      // 추가된 정보
                referral: referral // 추가된 정보
            }
        })
    });

    if (!response.ok) throw new Error("DB 생성 실패");
    
    // 이메일/전화번호 모두 인증되었으면 최종 완료 메시지
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
            alert("로그인 실패: " + err.message);
        }
    });
}
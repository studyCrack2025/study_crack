// js/auth.js

// 1. AWS Cognito 설정 초기화
const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// ==========================================
// [Part A] 공통 및 유틸리티 (로그인 상태 관리)
// ==========================================

// 페이지 로드 시 실행: 로그인 상태 체크하여 헤더 버튼 변경
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();

    // 비밀번호 실시간 확인 리스너 등록 (회원가입 페이지용)
    const pwInput = document.getElementById('password');
    const pwConfirmInput = document.getElementById('passwordConfirm');
    if(pwInput && pwConfirmInput) {
        pwInput.addEventListener('input', checkPasswordMatch);
        pwConfirmInput.addEventListener('input', checkPasswordMatch);
    }
});

// 로그인 상태 확인 함수
function checkLoginStatus() {
    const accessToken = localStorage.getItem('accessToken');
    const loginBtn = document.getElementById('loginBtn');
    const myPageBtn = document.getElementById('myPageBtn'); // 마이페이지 버튼
    const logoutBtn = document.getElementById('logoutBtn');
    
    // 요소가 있는 경우에만 실행 (login.html 등에는 헤더가 다를 수 있음)
    if (loginBtn && logoutBtn) {
        if (accessToken) {
            // 로그인 상태
            loginBtn.classList.add('hidden');
            if(myPageBtn) myPageBtn.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
        } else {
            // 비로그인 상태
            loginBtn.classList.remove('hidden');
            if(myPageBtn) myPageBtn.classList.add('hidden');
            logoutBtn.classList.add('hidden');
        }
    }
}

// 로그아웃 함수
function handleSignOut() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) {
        cognitoUser.signOut();
    }
    localStorage.clear();
    alert("로그아웃 되었습니다.");
    window.location.href = 'index.html';
}


// ==========================================
// [Part B] 로그인 (Sign In) 로직
// ==========================================

function handleSignIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const authData = { Username: email, Password: password };
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
    
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: function(result) {
            // 토큰 저장
            localStorage.setItem('accessToken', result.getAccessToken().getJwtToken());
            localStorage.setItem('idToken', result.getIdToken().getJwtToken());
            localStorage.setItem('userEmail', email);
            
            alert("로그인 성공!");
            window.location.href = 'index.html';
        },
        onFailure: function(err) {
            alert("로그인 실패: " + err.message);
        }
    });
}


// ==========================================
// [Part C] 회원가입 (Sign Up) 로직 - 최신 반영됨
// ==========================================

// 비밀번호 일치 확인
function checkPasswordMatch() {
    const pwInput = document.getElementById('password');
    const pwConfirmInput = document.getElementById('passwordConfirm');
    const msgBox = document.getElementById('pwMsg');
    
    const pw = pwInput.value;
    const confirm = pwConfirmInput.value;

    if (!confirm) {
        msgBox.innerHTML = "";
        return;
    }

    if (pw === confirm) {
        msgBox.innerHTML = "<span class='text-success'>비밀번호가 일치합니다.</span>";
    } else {
        msgBox.innerHTML = "<span class='text-error'>비밀번호가 일치하지 않습니다.</span>";
    }
}

// 기타(Etc) 입력창 토글
function toggleEtc(isShow) {
    const etcInput = document.getElementById('referralEtc');
    if (isShow) {
        etcInput.classList.remove('hidden');
        etcInput.required = true;
    } else {
        etcInput.classList.add('hidden');
        etcInput.required = false;
        etcInput.value = ""; 
    }
}

// 인증번호 받기 (회원가입 요청)
let timerInterval;

function handleSendCode() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const name = document.getElementById('name').value;
    const gender = document.getElementById('gender').value;
    const birthdate = document.getElementById('birthdate').value;
    const phoneRaw = document.getElementById('phone').value;
    const school = document.getElementById('school').value;
    
    const major = document.querySelector('input[name="major"]:checked').value;
    let referral = document.querySelector('input[name="referral"]:checked').value;
    
    if (referral === 'etc') {
        referral = document.getElementById('referralEtc').value;
        if (!referral.trim()) {
            alert("유입 경로(기타) 내용을 입력해주세요.");
            return;
        }
    }

    if (!email || !password || !name || !phoneRaw || !school) {
        alert("모든 필수 정보를 입력해주세요.");
        return;
    }
    if (password !== passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    const phone = "+82" + phoneRaw.replace(/-/g, '').replace(/^0/, '');

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'phone_number', Value: phone }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'given_name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'gender', Value: gender }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'birthdate', Value: birthdate })
    ];

    const clientMetadata = {
        school: school,
        major: major,
        referral: referral
    };

    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.innerText = "전송 중...";
    sendBtn.disabled = true;

    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            alert("인증번호 발송 실패: " + err.message);
            sendBtn.innerText = "인증번호 받기";
            sendBtn.disabled = false;
            return;
        }

        alert("인증번호가 발송되었습니다. 이메일을 확인해주세요.");
        document.getElementById('verifySection').classList.remove('hidden');
        sendBtn.innerText = "재전송";
        sendBtn.disabled = false;
        document.getElementById('email').disabled = true;
        
        startTimer(5 * 60); 
    }, clientMetadata);
}

// 타이머 함수
function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('timer');
    
    clearInterval(timerInterval);

    timerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(timerInterval);
            alert("인증 시간이 만료되었습니다. 재전송 버튼을 눌러주세요.");
        }
    }, 1000);
}

// 인증코드 확인
function handleVerify() {
    const email = document.getElementById('email').value;
    const code = document.getElementById('verifyCode').value;

    if (!code) {
        alert("인증코드를 입력해주세요.");
        return;
    }

    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, function(err, result) {
        if (err) {
            alert("인증 실패: " + err.message);
            return;
        }
        
        clearInterval(timerInterval);
        document.getElementById('verifySection').classList.add('hidden');
        
        const sendBtn = document.getElementById('sendCodeBtn');
        sendBtn.innerText = "인증 완료";
        sendBtn.style.backgroundColor = "#16a34a";
        sendBtn.disabled = true;

        const finalBtn = document.getElementById('finalSubmitBtn');
        finalBtn.innerText = "회원가입 완료 및 로그인하러 가기";
        finalBtn.disabled = false;
        finalBtn.style.backgroundColor = "#2563EB";
        
        finalBtn.onclick = function() {
            alert("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
            window.location.href = 'login.html';
        };
    });
}
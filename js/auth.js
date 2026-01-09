// js/auth.js

// ★ 1. Lambda URL 설정 (회원가입 시 DB 저장을 위해 필요)
const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

// AWS Cognito 설정
const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// 임시 저장용 변수 (회원가입 과정에서 사용)
let tempUserId = ""; 

// ==========================================
// [Part A] 공통 및 유틸리티
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    
    // 비밀번호 실시간 확인
    const pwInput = document.getElementById('password');
    const pwConfirmInput = document.getElementById('passwordConfirm');
    if(pwInput && pwConfirmInput) {
        pwInput.addEventListener('input', checkPasswordMatch);
        pwConfirmInput.addEventListener('input', checkPasswordMatch);
    }
});

function checkLoginStatus() {
    const accessToken = localStorage.getItem('accessToken');
    const loginBtn = document.getElementById('loginBtn');
    const myPageBtn = document.getElementById('myPageBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginBtn && logoutBtn) {
        if (accessToken) {
            loginBtn.classList.add('hidden');
            if(myPageBtn) myPageBtn.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
        } else {
            loginBtn.classList.remove('hidden');
            if(myPageBtn) myPageBtn.classList.add('hidden');
            logoutBtn.classList.add('hidden');
        }
    }
}

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
// [Part B] 로그인 로직 (userId 저장 기능 추가됨)
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
            // 1. 토큰 추출
            const accessToken = result.getAccessToken().getJwtToken();
            const idToken = result.getIdToken();
            
            // ★ [핵심 해결 1] 로그인 할 때 userId(sub)를 반드시 저장해야 마이페이지가 열림
            const userId = idToken.payload.sub; 
            
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('idToken', idToken.getJwtToken());
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userId', userId); // ★ 저장 필수!
            
            alert("로그인 성공!");
            window.location.href = 'index.html';
        },
        onFailure: function(err) {
            alert("로그인 실패: " + err.message);
        }
    });
}

// ==========================================
// [Part C] 회원가입 로직 (DB 저장 기능 추가됨)
// ==========================================

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
            alert("유입 경로 내용을 입력해주세요.");
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

        // ★ 여기서 생성된 userId(sub)를 임시 변수에 저장해둡니다.
        // 나중에 인증 완료(handleVerify)할 때 이 ID로 DB에 저장할 겁니다.
        tempUserId = result.userSub; 

        alert("인증번호가 발송되었습니다. 이메일을 확인해주세요.");
        document.getElementById('verifySection').classList.remove('hidden');
        sendBtn.innerText = "재전송";
        sendBtn.disabled = false;
        document.getElementById('email').disabled = true;
        
        startTimer(5 * 60); 
    }, clientMetadata);
}

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

// ★ [핵심 해결 2] 인증 완료 시 DB에 초기 데이터 생성
function handleVerify() {
    const email = document.getElementById('email').value;
    const code = document.getElementById('verifyCode').value;

    if (!code) {
        alert("인증코드를 입력해주세요.");
        return;
    }

    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, async function(err, result) {
        if (err) {
            alert("인증 실패: " + err.message);
            return;
        }
        
        // 인증 성공! -> 이제 DB에 데이터를 저장합시다.
        try {
            await createInitialUserDB(); // DB 저장 함수 호출
            alert("회원가입 및 DB 생성이 완료되었습니다! 로그인 페이지로 이동합니다.");
            window.location.href = 'login.html';
        } catch (dbErr) {
            console.error(dbErr);
            // DB 저장이 실패해도 일단 가입은 된 것이므로 로그인 페이지로 보냄 (로그인 후 정보수정 하면 됨)
            alert("회원가입 완료. (초기 데이터 생성 중 오류가 있었으나 로그인 후 이용 가능합니다)");
            window.location.href = 'login.html';
        }
    });
}

// DB 초기 데이터 생성 함수 (Lambda 호출)
async function createInitialUserDB() {
    // 입력된 값들 가져오기
    const name = document.getElementById('name').value;
    const phoneRaw = document.getElementById('phone').value;
    const school = document.getElementById('school').value;

    // tempUserId가 없으면(새로고침 등) 실행 불가
    if (!tempUserId) {
        console.error("User ID가 없습니다.");
        return;
    }

    // Lambda API 호출
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            type: 'update_profile', // 프로필 업데이트 기능 재활용
            userId: tempUserId,
            data: {
                name: name,
                phone: phoneRaw,
                school: school
            }
        })
    });

    if (!response.ok) {
        throw new Error("DB 생성 실패");
    }
}
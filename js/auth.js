// js/auth.js

// AWS Cognito 설정
const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// === 1. 비밀번호 실시간 확인 로직 ===
document.addEventListener('DOMContentLoaded', () => {
    const pwInput = document.getElementById('password');
    const pwConfirmInput = document.getElementById('passwordConfirm');
    const msgBox = document.getElementById('pwMsg');

    function checkPasswordMatch() {
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

    if(pwInput && pwConfirmInput) {
        pwInput.addEventListener('input', checkPasswordMatch);
        pwConfirmInput.addEventListener('input', checkPasswordMatch);
    }
});

// === 2. 기타(Etc) 입력창 토글 로직 ===
function toggleEtc(isShow) {
    const etcInput = document.getElementById('referralEtc');
    if (isShow) {
        etcInput.classList.remove('hidden');
        etcInput.required = true;
    } else {
        etcInput.classList.add('hidden');
        etcInput.required = false;
        etcInput.value = ""; // 숨기면 값 초기화
    }
}

// === 3. 인증번호 받기 (실제 회원가입 요청) ===
let timerInterval;

function handleSendCode() {
    // 모든 필드 값 가져오기
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const name = document.getElementById('name').value;
    const gender = document.getElementById('gender').value;
    const birthdate = document.getElementById('birthdate').value;
    const phoneRaw = document.getElementById('phone').value;
    const school = document.getElementById('school').value;
    
    // 라디오 버튼 값 가져오기
    const major = document.querySelector('input[name="major"]:checked').value;
    let referral = document.querySelector('input[name="referral"]:checked').value;
    
    // '기타' 선택 시 텍스트 입력값으로 덮어쓰기
    if (referral === 'etc') {
        referral = document.getElementById('referralEtc').value;
        if (!referral.trim()) {
            alert("유입 경로(기타) 내용을 입력해주세요.");
            return;
        }
    }

    // 유효성 검사
    if (!email || !password || !name || !phoneRaw || !school) {
        alert("모든 정보를 입력해주세요. 정보가 있어야 인증코드를 보낼 수 있습니다.");
        return;
    }
    if (password !== passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    // 전화번호 포맷 (+82)
    const phone = "+82" + phoneRaw.replace(/-/g, '').replace(/^0/, '');

    // Cognito 속성 구성
    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'phone_number', Value: phone }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'given_name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'gender', Value: gender }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'birthdate', Value: birthdate })
    ];

    // Lambda로 보낼 메타데이터
    const clientMetadata = {
        school: school,
        major: major,
        referral: referral
    };

    // 버튼 로딩 처리
    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.innerText = "전송 중...";
    sendBtn.disabled = true;

    // 회원가입 요청 (성공 시 인증메일 발송됨)
    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            alert("인증번호 발송 실패: " + err.message);
            sendBtn.innerText = "인증번호 받기";
            sendBtn.disabled = false;
            return;
        }

        // 성공 시: 인증 박스 보여주기 & 타이머 시작
        alert("인증번호가 발송되었습니다. 이메일을 확인해주세요.");
        document.getElementById('verifySection').classList.remove('hidden');
        sendBtn.innerText = "재전송";
        sendBtn.disabled = false;
        
        // 입력 필드들 수정 불가 처리 (UX)
        document.getElementById('email').disabled = true;
        
        startTimer(5 * 60); // 5분
    }, clientMetadata);
}

// === 4. 타이머 함수 ===
function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('timer');
    
    clearInterval(timerInterval); // 기존 타이머 있으면 초기화

    timerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(timerInterval);
            alert("인증 시간이 만료되었습니다. 재전송 버튼을 눌러주세요.");
            // 여기서 재전송 로직 구현은 복잡하므로 페이지 새로고침 유도 or 재전송 버튼 활성화
        }
    }, 1000);
}

// === 5. 인증코드 확인 (최종 완료) ===
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
        
        // 인증 성공!
        clearInterval(timerInterval);
        document.getElementById('verifySection').classList.add('hidden'); // 박스 숨김
        
        // 성공 UI 변경
        const sendBtn = document.getElementById('sendCodeBtn');
        sendBtn.innerText = "인증 완료";
        sendBtn.style.backgroundColor = "#16a34a"; // 초록색
        sendBtn.disabled = true;

        // 최종 가입 버튼 활성화 및 텍스트 변경
        const finalBtn = document.getElementById('finalSubmitBtn');
        finalBtn.innerText = "회원가입 완료 및 로그인하러 가기";
        finalBtn.disabled = false;
        finalBtn.style.backgroundColor = "#2563EB";
        
        // 최종 버튼 클릭 이벤트 변경 (로그인 페이지 이동)
        finalBtn.onclick = function() {
            alert("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
            window.location.href = 'login.html';
        };
    });
}